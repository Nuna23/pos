<?php
// Generate realistic mock data for TODAY so the dashboard / finance / board
// pages show a full picture. Spreads orders across business hours (so the
// peak-hours chart varies), across all 3 branches, with mixed crepes, payment
// methods and statuses, plus a few expenses. Re-running replaces today's data.
//
//   docker compose exec backend php /var/www/html/bin/mock-today.php
//
// PHP 5.6 compatible.

require __DIR__ . '/../src/db.php';

$config = require __DIR__ . '/../src/config.php';
date_default_timezone_set($config['tz']);

$pdo = db($config);
ensure_schema($pdo);

$today = date('Y-m-d');

// --- 1) Plenty of stock everywhere so nothing blocks the mock orders --------
$pdo->exec('UPDATE products SET stock_quantity = 1000');
$products = $pdo->query(
    'SELECT id, category, price, deduction_amount FROM products'
)->fetchAll();

$pdo->exec('DELETE FROM branch_stock');
$insBranch = $pdo->prepare('INSERT INTO branch_stock (branch_id, product_id, quantity) VALUES (?, ?, ?)');
foreach (array(1, 2, 3) as $bid) {
    foreach ($products as $p) {
        $insBranch->execute(array($bid, $p['id'], 300));
    }
}

$doughs = array();
$toppings = array();
foreach ($products as $p) {
    if ($p['category'] === 'DOUGH') {
        $doughs[] = $p;
    } else {
        $toppings[] = $p;
    }
}

// --- 2) Clear today's orders + expenses for a clean, repeatable picture ------
$pdo->prepare('DELETE FROM orders WHERE created_at >= ? AND created_at < ?')
    ->execute(array($today . ' 00:00:00', date('Y-m-d', strtotime('+1 day')) . ' 00:00:00'));
$pdo->prepare('DELETE FROM expenses WHERE spent_on = ?')->execute(array($today));

// --- 3) Build a weighted set of order times across the day ------------------
$hourWeights = array(
    8 => 1, 9 => 2, 10 => 3, 11 => 6, 12 => 8, 13 => 6,
    14 => 3, 15 => 3, 16 => 4, 17 => 7, 18 => 8, 19 => 5, 20 => 2,
);
$hourPool = array();
foreach ($hourWeights as $h => $w) {
    for ($k = 0; $k < $w; $k++) {
        $hourPool[] = $h;
    }
}

$ORDER_COUNT = 65;
$times = array();
for ($i = 0; $i < $ORDER_COUNT; $i++) {
    $h = $hourPool[mt_rand(0, count($hourPool) - 1)];
    $times[] = sprintf('%s %02d:%02d:%02d', $today, $h, mt_rand(0, 59), mt_rand(0, 59));
}
sort($times);

// --- 4) Insert the orders ---------------------------------------------------
$insOrder = $pdo->prepare(
    'INSERT INTO orders (queue_number, total_price, status, payment_method, branch_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)'
);
$insItem = $pdo->prepare('INSERT INTO order_items (order_id, base_dough_id, created_at) VALUES (?, ?, ?)');
$insTop  = $pdo->prepare('INSERT INTO order_item_toppings (order_item_id, product_id) VALUES (?, ?)');
$dedProd = $pdo->prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?');
$dedBr   = $pdo->prepare('UPDATE branch_stock SET quantity = quantity - ? WHERE branch_id = ? AND product_id = ?');

$pdo->beginTransaction();

$queue = 1;
$revenue = 0;
$crepes = 0;
foreach ($times as $ts) {
    $branchId = mt_rand(1, 3);

    // Status: mostly DONE, a few live ones for the board, some cancelled.
    $r = mt_rand(1, 100);
    if ($r <= 70) {
        $status = 'DONE';
    } elseif ($r <= 80) {
        $status = 'COOKING';
    } elseif ($r <= 90) {
        $status = 'PENDING';
    } else {
        $status = 'CANCELLED';
    }
    $payment = (mt_rand(0, 1) === 0) ? 'CASH' : 'QR';

    // 1-3 crepes per order (weighted toward 1-2).
    $numCrepes = (mt_rand(1, 100) <= 55) ? 1 : (mt_rand(1, 100) <= 75 ? 2 : 3);

    // Build the crepes first so we know the total price.
    $crepeDefs = array();
    $total = 0;
    for ($c = 0; $c < $numCrepes; $c++) {
        $dough = $doughs[mt_rand(0, count($doughs) - 1)];
        $total += (float) $dough['price'];

        $numTop = mt_rand(0, 3);
        shuffle($toppings);
        $picked = array();
        for ($t = 0; $t < $numTop && $t < count($toppings); $t++) {
            $picked[] = $toppings[$t];
            $total += (float) $toppings[$t]['price'];
        }
        $crepeDefs[] = array('dough' => $dough, 'toppings' => $picked);
    }

    $insOrder->execute(array($queue, $total, $status, $payment, $branchId, $ts, $ts));
    $orderId = (int) $pdo->lastInsertId();

    foreach ($crepeDefs as $def) {
        $insItem->execute(array($orderId, $def['dough']['id'], $ts));
        $itemId = (int) $pdo->lastInsertId();
        $dedProd->execute(array($def['dough']['deduction_amount'], $def['dough']['id']));
        $dedBr->execute(array($def['dough']['deduction_amount'], $branchId, $def['dough']['id']));

        foreach ($def['toppings'] as $top) {
            $insTop->execute(array($itemId, $top['id']));
            $dedProd->execute(array($top['deduction_amount'], $top['id']));
            $dedBr->execute(array($top['deduction_amount'], $branchId, $top['id']));
        }
        $crepes++;
    }

    if ($status !== 'CANCELLED') {
        $revenue += $total;
    }
    $queue++;
}

// --- 5) A few "other costs" for today ---------------------------------------
$expenses = array(
    array('ค่าเช่าแผง (วันนี้)', 400),
    array('ค่าแก๊ส', 150),
    array('ค่าแรงพนักงาน', 600),
    array('ค่าบรรจุภัณฑ์/ถุง', 180),
);
$insExp = $pdo->prepare('INSERT INTO expenses (label, amount, spent_on) VALUES (?, ?, ?)');
$expTotal = 0;
foreach ($expenses as $e) {
    $insExp->execute(array($e[0], $e[1], $today));
    $expTotal += $e[1];
}

$pdo->commit();

echo "Mock data for $today created:\n";
echo "  orders:   $ORDER_COUNT\n";
echo "  crepes:   $crepes\n";
echo "  revenue:  " . number_format($revenue, 2) . " (excl. cancelled)\n";
echo "  expenses: " . number_format($expTotal, 2) . "\n";
