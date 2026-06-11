<?php
// /api/orders
//   GET  /orders            list (optional ?status=)
//   GET  /orders/today      today's orders, ordered by queue number
//   GET  /orders/{id}       one (nested)
//   POST /orders            create  body {items:[{baseDoughId,toppingIds[]}], pushSubscription?}
//   PUT  /orders/{id}/status  body {status}
// PHP 5.6 compatible.

function route_orders($pdo, $config, $rest, $method)
{
    if (count($rest) === 0) {
        if ($method === 'GET') {
            return orders_list($pdo);
        }
        if ($method === 'POST') {
            return orders_create($pdo);
        }
        json_out(array('error' => 'method not allowed'), 405);
    }

    if (count($rest) === 1 && $rest[0] === 'today' && $method === 'GET') {
        return orders_today($pdo);
    }

    $id = (int) $rest[0];

    if (count($rest) === 1 && $method === 'GET') {
        return orders_find_one($pdo, $id);
    }

    if (count($rest) === 2 && $rest[1] === 'status' && $method === 'PUT') {
        return orders_update_status($pdo, $config, $id);
    }

    json_out(array('error' => 'not found'), 404);
}

function orders_list($pdo)
{
    $status = v($_GET, 'status');
    $valid  = array('PENDING', 'COOKING', 'DONE', 'CANCELLED');
    if (in_array($status, $valid, true)) {
        $stmt = $pdo->prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC');
        $stmt->execute(array($status));
    } else {
        $stmt = $pdo->query('SELECT * FROM orders ORDER BY created_at DESC');
    }
    json_out(load_orders($pdo, $stmt->fetchAll()));
}

function orders_today($pdo)
{
    $stmt = $pdo->prepare(
        'SELECT * FROM orders WHERE created_at >= ? AND created_at < ? ORDER BY queue_number ASC'
    );
    $stmt->execute(day_bounds());
    json_out(load_orders($pdo, $stmt->fetchAll()));
}

function orders_find_one($pdo, $id)
{
    $order = load_order($pdo, $id);
    if ($order === null) {
        json_out(array('error' => "Order #$id not found"), 404);
    }
    json_out($order);
}

function orders_create($pdo)
{
    $b     = json_body();
    $items = v($b, 'items');
    if (!is_array($items) || count($items) === 0) {
        json_out(array('error' => 'items must be a non-empty array'), 400);
    }

    // Collect every referenced product id and validate shapes.
    $allIds = array();
    foreach ($items as $item) {
        $doughId   = (int) v($item, 'baseDoughId', 0);
        $toppingIds = v($item, 'toppingIds', array());
        if ($doughId <= 0) {
            json_out(array('error' => 'each item needs a baseDoughId'), 400);
        }
        if (!is_array($toppingIds)) {
            json_out(array('error' => 'toppingIds must be an array'), 400);
        }
        $allIds[] = $doughId;
        foreach ($toppingIds as $tid) {
            $allIds[] = (int) $tid;
        }
    }

    $products = product_map($pdo, $allIds); // keyed by id, JSON shape

    // Compute total price and verify every product exists.
    $totalPrice = 0;
    foreach ($items as $item) {
        $doughId = (int) $item['baseDoughId'];
        if (!isset($products[$doughId])) {
            json_out(array('error' => "Dough #$doughId not found"), 400);
        }
        $totalPrice += $products[$doughId]['price'];
        foreach ($item['toppingIds'] as $tid) {
            $tid = (int) $tid;
            if (!isset($products[$tid])) {
                json_out(array('error' => "Topping #$tid not found"), 400);
            }
            $totalPrice += $products[$tid]['price'];
        }
    }

    // Per-day queue number (resets each day).
    $bounds = day_bounds();
    $stmt = $pdo->prepare(
        'SELECT queue_number FROM orders WHERE created_at >= ? AND created_at < ?
         ORDER BY queue_number DESC LIMIT 1'
    );
    $stmt->execute($bounds);
    $last = $stmt->fetchColumn();
    $queueNumber = ($last !== false ? (int) $last : 0) + 1;

    $push = v($b, 'pushSubscription');
    $hasPush = is_array($push) && v($push, 'endpoint') && v($push, 'p256dh') && v($push, 'auth');

    $payment = v($b, 'paymentMethod');
    if ($payment !== 'CASH' && $payment !== 'QR') {
        $payment = null;
    }

    $branchId = v($b, 'branchId');
    $branchId = in_array((int) $branchId, array(1, 2, 3), true) ? (int) $branchId : null;

    // Total amount of each ingredient this order consumes (deduction per use).
    $needed = array();
    foreach ($items as $item) {
        $doughId = (int) $item['baseDoughId'];
        $needed[$doughId] = (isset($needed[$doughId]) ? $needed[$doughId] : 0) + $products[$doughId]['deductionAmount'];
        foreach ($item['toppingIds'] as $tid) {
            $tid = (int) $tid;
            $needed[$tid] = (isset($needed[$tid]) ? $needed[$tid] : 0) + $products[$tid]['deductionAmount'];
        }
    }

    $pdo->beginTransaction();
    try {
        // When ordering from a branch, make sure it has enough of each
        // ingredient (otherwise the customer shouldn't have been able to pick it).
        if ($branchId !== null) {
            $check = $pdo->prepare(
                'SELECT quantity FROM branch_stock WHERE branch_id = ? AND product_id = ? FOR UPDATE'
            );
            foreach ($needed as $pid => $amt) {
                $check->execute(array($branchId, $pid));
                $have = $check->fetchColumn();
                $have = ($have === false) ? 0 : (float) $have;
                if ($have < $amt) {
                    $pdo->rollBack();
                    json_out(array(
                        'error'     => 'out_of_stock',
                        'product'   => $products[$pid]['name'],
                        'productId' => $pid,
                    ), 409);
                }
            }
        }

        $stmt = $pdo->prepare(
            'INSERT INTO orders (queue_number, total_price, payment_method, branch_id, push_endpoint, push_p256dh, push_auth)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute(array(
            $queueNumber,
            $totalPrice,
            $payment,
            $branchId,
            $hasPush ? $push['endpoint'] : null,
            $hasPush ? $push['p256dh'] : null,
            $hasPush ? $push['auth'] : null,
        ));
        $orderId = (int) $pdo->lastInsertId();

        $insItem = $pdo->prepare('INSERT INTO order_items (order_id, base_dough_id) VALUES (?, ?)');
        $insTop  = $pdo->prepare('INSERT INTO order_item_toppings (order_item_id, product_id) VALUES (?, ?)');
        $deduct  = $pdo->prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?');

        foreach ($items as $item) {
            $doughId = (int) $item['baseDoughId'];
            $insItem->execute(array($orderId, $doughId));
            $itemId = (int) $pdo->lastInsertId();
            $deduct->execute(array($products[$doughId]['deductionAmount'], $doughId));

            foreach ($item['toppingIds'] as $tid) {
                $tid = (int) $tid;
                $insTop->execute(array($itemId, $tid));
                $deduct->execute(array($products[$tid]['deductionAmount'], $tid));
            }
        }

        // Deduct the branch's allocation too, keeping total stock and branch
        // stock consistent.
        if ($branchId !== null) {
            $deductBranch = $pdo->prepare(
                'UPDATE branch_stock SET quantity = quantity - ? WHERE branch_id = ? AND product_id = ?'
            );
            foreach ($needed as $pid => $amt) {
                $deductBranch->execute(array($amt, $branchId, $pid));
            }
        }

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        json_out(array('error' => 'failed to create order'), 500);
    }

    json_out(load_order($pdo, $orderId), 201);
}

function orders_update_status($pdo, $config, $id)
{
    $status = (string) v(json_body(), 'status', '');
    $valid  = array('PENDING', 'COOKING', 'DONE', 'CANCELLED');
    if (!in_array($status, $valid, true)) {
        json_out(array('error' => 'invalid status'), 400);
    }

    $stmt = $pdo->prepare('SELECT id FROM orders WHERE id = ?');
    $stmt->execute(array($id));
    if (!$stmt->fetch()) {
        json_out(array('error' => "Order #$id not found"), 404);
    }

    $pdo->prepare('UPDATE orders SET status = ? WHERE id = ?')->execute(array($status, $id));

    // Fetch the raw row for push fields, plus nested JSON for the response.
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
    $stmt->execute(array($id));
    $row = $stmt->fetch();
    $order = load_order($pdo, $id);

    // Notify the waiting customer that their crepe is ready.
    if ($status === 'DONE') {
        webpush_notify_order_done($config, $row);
    }

    json_out($order);
}

// Start-of-today and start-of-tomorrow as "Y-m-d H:i:s" strings, for range
// queries that respect the app timezone.
function day_bounds()
{
    $start = date('Y-m-d 00:00:00');
    $tomorrow = date('Y-m-d 00:00:00', strtotime('+1 day'));
    return array($start, $tomorrow);
}
