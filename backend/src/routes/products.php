<?php
// /api/products
//   GET    /products            list (optional ?category=DOUGH|TOPPING)
//   GET    /products/{id}       one
//   POST   /products            create
//   PATCH  /products/{id}       update (partial)
//   PATCH  /products/{id}/replenish  body {amount}  add stock, clear alert
//   DELETE /products/{id}       delete
// PHP 5.6 compatible.

function route_products($pdo, $rest, $method)
{
    // Collection: /products
    if (count($rest) === 0) {
        if ($method === 'GET') {
            return products_list($pdo);
        }
        if ($method === 'POST') {
            return products_create($pdo);
        }
        json_out(array('error' => 'method not allowed'), 405);
    }

    $id = (int) $rest[0];

    // /products/{id}
    if (count($rest) === 1) {
        if ($method === 'GET') {
            return products_find_one($pdo, $id);
        }
        if ($method === 'PATCH') {
            return products_update($pdo, $id);
        }
        if ($method === 'DELETE') {
            return products_remove($pdo, $id);
        }
        json_out(array('error' => 'method not allowed'), 405);
    }

    // /products/{id}/replenish
    if (count($rest) === 2 && $rest[1] === 'replenish' && $method === 'PATCH') {
        return products_replenish($pdo, $id);
    }

    json_out(array('error' => 'not found'), 404);
}

function products_list($pdo)
{
    $category = v($_GET, 'category');
    if ($category === 'DOUGH' || $category === 'TOPPING') {
        $stmt = $pdo->prepare('SELECT * FROM products WHERE is_active = 1 AND category = ? ORDER BY name ASC');
        $stmt->execute(array($category));
    } else {
        $stmt = $pdo->query('SELECT * FROM products WHERE is_active = 1 ORDER BY name ASC');
    }
    $out = array();
    foreach ($stmt->fetchAll() as $r) {
        $out[] = product_json($r);
    }
    json_out($out);
}

function products_find_one($pdo, $id)
{
    $row = product_row($pdo, $id);
    if (!$row) {
        json_out(array('error' => "Product #$id not found"), 404);
    }
    json_out(product_json($row));
}

function products_create($pdo)
{
    $b = json_body();
    $name      = trim((string) v($b, 'name', ''));
    $category  = (string) v($b, 'category', '');
    $price     = v($b, 'price');
    $unitCost  = v($b, 'unitCost', 0);
    $crepesPer = v($b, 'crepesPerUnit', 1);
    $stock     = v($b, 'stockQuantity');
    $thresh    = v($b, 'alertThreshold');
    $deduct    = v($b, 'deductionAmount');

    if ($name === '') {
        json_out(array('error' => 'name is required'), 400);
    }
    if ($category !== 'DOUGH' && $category !== 'TOPPING') {
        json_out(array('error' => 'category must be DOUGH or TOPPING'), 400);
    }
    if (!is_numeric($price) || $price <= 0) {
        json_out(array('error' => 'price must be a positive number'), 400);
    }
    foreach (array('stockQuantity' => $stock, 'alertThreshold' => $thresh, 'deductionAmount' => $deduct, 'unitCost' => $unitCost) as $k => $val) {
        if (!is_numeric($val) || $val < 0) {
            json_out(array('error' => "$k must be a number >= 0"), 400);
        }
    }
    if (!is_numeric($crepesPer) || $crepesPer <= 0) {
        json_out(array('error' => 'crepesPerUnit must be a positive number'), 400);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO products (name, category, price, unit_cost, crepes_per_unit, stock_quantity, alert_threshold, deduction_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute(array($name, $category, $price, $unitCost, $crepesPer, $stock, $thresh, $deduct));
    $id = (int) $pdo->lastInsertId();
    json_out(product_json(product_row($pdo, $id)), 201);
}

function products_update($pdo, $id)
{
    $row = product_row($pdo, $id);
    if (!$row) {
        json_out(array('error' => "Product #$id not found"), 404);
    }
    $b = json_body();

    // Only update fields that were actually provided (partial update).
    $map = array(
        'name'            => 'name',
        'category'        => 'category',
        'price'           => 'price',
        'unitCost'        => 'unit_cost',
        'crepesPerUnit'   => 'crepes_per_unit',
        'stockQuantity'   => 'stock_quantity',
        'alertThreshold'  => 'alert_threshold',
        'deductionAmount' => 'deduction_amount',
    );
    $sets   = array();
    $params = array();
    foreach ($map as $jsonKey => $col) {
        if (array_key_exists($jsonKey, $b)) {
            $sets[]   = "$col = ?";
            $params[] = $b[$jsonKey];
        }
    }

    if (!empty($sets)) {
        $params[] = $id;
        $stmt = $pdo->prepare('UPDATE products SET ' . implode(', ', $sets) . ' WHERE id = ?');
        $stmt->execute($params);
    }

    $updated = product_row($pdo, $id);

    // If stock was raised back above the alert threshold, re-arm the alert.
    if (array_key_exists('stockQuantity', $b) && $updated['stock_quantity'] > $updated['alert_threshold']) {
        $pdo->prepare('UPDATE products SET alert_sent = 0 WHERE id = ?')->execute(array($id));
        $updated = product_row($pdo, $id);
    }

    json_out(product_json($updated));
}

function products_replenish($pdo, $id)
{
    $row = product_row($pdo, $id);
    if (!$row) {
        json_out(array('error' => "Product #$id not found"), 404);
    }
    $amount = v(json_body(), 'amount');
    if (!is_numeric($amount)) {
        json_out(array('error' => 'amount must be a number'), 400);
    }
    $stmt = $pdo->prepare(
        'UPDATE products SET stock_quantity = stock_quantity + ?, alert_sent = 0 WHERE id = ?'
    );
    $stmt->execute(array($amount, $id));
    json_out(product_json(product_row($pdo, $id)));
}

function products_remove($pdo, $id)
{
    $row = product_row($pdo, $id);
    if (!$row) {
        json_out(array('error' => "Product #$id not found"), 404);
    }
    // Soft delete: keep the row (orders/finance history reference it) but hide
    // it and drop its branch allocations so it leaves the menus.
    $pdo->prepare('UPDATE products SET is_active = 0 WHERE id = ?')->execute(array($id));
    $pdo->prepare('DELETE FROM branch_stock WHERE product_id = ?')->execute(array($id));
    json_out(array('ok' => true, 'id' => (int) $id));
}

function product_row($pdo, $id)
{
    $stmt = $pdo->prepare('SELECT * FROM products WHERE id = ?');
    $stmt->execute(array((int) $id));
    return $stmt->fetch();
}
