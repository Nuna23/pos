<?php
// /api/admin — central inventory + distribution to branches.
//   GET  /admin/stock       every ingredient: total stock, per-branch
//                           allocation, and unallocated remainder
//   POST /admin/distribute  body {productId, branchId, amount}
//                           amount > 0 gives to the branch, < 0 takes back
//
// NOTE: this is entered by URL only and is intentionally unauthenticated, in
// keeping with the rest of the app (no login layer yet). PHP 5.6 compatible.

function route_admin($pdo, $rest, $method)
{
    if (count($rest) === 1 && $rest[0] === 'stock' && $method === 'GET') {
        return admin_stock($pdo);
    }
    if (count($rest) === 1 && $rest[0] === 'distribute' && $method === 'POST') {
        return admin_distribute($pdo);
    }
    if (count($rest) === 1 && $rest[0] === 'finance' && $method === 'GET') {
        return admin_finance($pdo);
    }
    if (count($rest) === 1 && $rest[0] === 'import' && $method === 'POST') {
        return admin_import($pdo);
    }

    // Other-costs CRUD
    if (count($rest) === 1 && $rest[0] === 'expenses') {
        if ($method === 'GET') {
            return expenses_list($pdo);
        }
        if ($method === 'POST') {
            return expenses_create($pdo);
        }
    }
    if (count($rest) === 2 && $rest[0] === 'expenses') {
        $id = (int) $rest[1];
        if ($method === 'PATCH') {
            return expenses_update($pdo, $id);
        }
        if ($method === 'DELETE') {
            return expenses_delete($pdo, $id);
        }
    }

    json_out(array('error' => 'not found'), 404);
}

// --- other costs (expenses) ---------------------------------------------

function expense_json($r)
{
    return array(
        'id'        => (int) $r['id'],
        'label'     => $r['label'],
        'amount'    => (float) $r['amount'],
        'spentOn'   => $r['spent_on'],
        'frequency' => isset($r['frequency']) ? $r['frequency'] : 'ONCE',
    );
}

function expenses_list($pdo)
{
    // Monthly recurring costs always apply; one-time costs only within the
    // optional date window.
    $start = v($_GET, 'start');
    $end   = v($_GET, 'end');
    if ($start && $end) {
        $stmt = $pdo->prepare(
            "SELECT * FROM expenses
             WHERE frequency = 'MONTHLY' OR (spent_on >= ? AND spent_on <= ?)
             ORDER BY frequency DESC, spent_on DESC, id DESC"
        );
        $stmt->execute(array(date('Y-m-d', strtotime($start)), date('Y-m-d', strtotime($end))));
    } else {
        $stmt = $pdo->query('SELECT * FROM expenses ORDER BY frequency DESC, spent_on DESC, id DESC');
    }
    $out = array();
    foreach ($stmt->fetchAll() as $r) {
        $out[] = expense_json($r);
    }
    json_out($out);
}

function expenses_create($pdo)
{
    $b      = json_body();
    $label  = trim((string) v($b, 'label', ''));
    $amount = v($b, 'amount');
    $spent  = v($b, 'spentOn');
    $freq   = v($b, 'frequency') === 'MONTHLY' ? 'MONTHLY' : 'ONCE';
    if ($label === '') {
        json_out(array('error' => 'label is required'), 400);
    }
    if (!is_numeric($amount) || $amount < 0) {
        json_out(array('error' => 'amount must be a number >= 0'), 400);
    }
    $spentOn = $spent ? date('Y-m-d', strtotime($spent)) : date('Y-m-d');

    $stmt = $pdo->prepare('INSERT INTO expenses (label, amount, spent_on, frequency) VALUES (?, ?, ?, ?)');
    $stmt->execute(array($label, $amount, $spentOn, $freq));
    $id = (int) $pdo->lastInsertId();
    $stmt = $pdo->prepare('SELECT * FROM expenses WHERE id = ?');
    $stmt->execute(array($id));
    json_out(expense_json($stmt->fetch()), 201);
}

function expenses_update($pdo, $id)
{
    $stmt = $pdo->prepare('SELECT * FROM expenses WHERE id = ?');
    $stmt->execute(array($id));
    if (!$stmt->fetch()) {
        json_out(array('error' => "Expense #$id not found"), 404);
    }
    $b   = json_body();
    $map = array('label' => 'label', 'amount' => 'amount', 'spentOn' => 'spent_on', 'frequency' => 'frequency');
    $sets   = array();
    $params = array();
    foreach ($map as $jsonKey => $col) {
        if (array_key_exists($jsonKey, $b)) {
            $val = $b[$jsonKey];
            if ($col === 'spent_on') {
                $val = date('Y-m-d', strtotime((string) $val));
            }
            if ($col === 'frequency') {
                $val = ($val === 'MONTHLY') ? 'MONTHLY' : 'ONCE';
            }
            $sets[]   = "$col = ?";
            $params[] = $val;
        }
    }
    if (!empty($sets)) {
        $params[] = $id;
        $pdo->prepare('UPDATE expenses SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
    }
    $stmt = $pdo->prepare('SELECT * FROM expenses WHERE id = ?');
    $stmt->execute(array($id));
    json_out(expense_json($stmt->fetch()));
}

function expenses_delete($pdo, $id)
{
    $pdo->prepare('DELETE FROM expenses WHERE id = ?')->execute(array($id));
    json_out(array('ok' => true));
}

function admin_stock($pdo)
{
    $products = $pdo->query(
        'SELECT id, name, category, stock_quantity FROM products WHERE is_active = 1 ORDER BY category ASC, name ASC'
    )->fetchAll();

    // All allocations in one query, grouped by product.
    $allocByProduct = array();
    $rows = $pdo->query('SELECT branch_id, product_id, quantity FROM branch_stock')->fetchAll();
    foreach ($rows as $r) {
        $pid = (int) $r['product_id'];
        if (!isset($allocByProduct[$pid])) {
            $allocByProduct[$pid] = array();
        }
        $allocByProduct[$pid][(int) $r['branch_id']] = (float) $r['quantity'];
    }

    $branchIds = array(1, 2, 3);
    $out = array();
    foreach ($products as $p) {
        $pid   = (int) $p['id'];
        $total = (float) $p['stock_quantity'];

        $branchStock = array();
        $allocated = 0;
        foreach ($branchIds as $bid) {
            $q = isset($allocByProduct[$pid][$bid]) ? $allocByProduct[$pid][$bid] : 0;
            $branchStock[$bid] = $q;
            $allocated += $q;
        }

        $out[] = array(
            'id'            => $pid,
            'name'          => $p['name'],
            'category'      => $p['category'],
            'stockQuantity' => $total,
            'branchStock'   => $branchStock,        // {1: q, 2: q, 3: q}
            'allocated'     => $allocated,
            'unallocated'   => $total - $allocated,
        );
    }
    json_out($out);
}

function admin_distribute($pdo)
{
    $b         = json_body();
    $productId = (int) v($b, 'productId', 0);
    $branchId  = (int) v($b, 'branchId', 0);
    $amount    = v($b, 'amount');

    if ($productId <= 0 || !in_array($branchId, array(1, 2, 3), true)) {
        json_out(array('error' => 'valid productId and branchId (1-3) are required'), 400);
    }
    if (!is_numeric($amount) || $amount == 0) {
        json_out(array('error' => 'amount must be a non-zero number'), 400);
    }
    $amount = (float) $amount;

    $pdo->beginTransaction();
    try {
        // Lock the product row and read its total stock.
        $stmt = $pdo->prepare('SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE');
        $stmt->execute(array($productId));
        $row = $stmt->fetch();
        if (!$row) {
            $pdo->rollBack();
            json_out(array('error' => "Product #$productId not found"), 404);
        }
        $total = (float) $row['stock_quantity'];

        // Current allocation for this branch + the product's total allocation.
        $stmt = $pdo->prepare('SELECT branch_id, quantity FROM branch_stock WHERE product_id = ?');
        $stmt->execute(array($productId));
        $branchQty = 0;
        $allocated = 0;
        foreach ($stmt->fetchAll() as $r) {
            $allocated += (float) $r['quantity'];
            if ((int) $r['branch_id'] === $branchId) {
                $branchQty = (float) $r['quantity'];
            }
        }

        $newBranchQty = $branchQty + $amount;
        if ($newBranchQty < 0) {
            $pdo->rollBack();
            json_out(array('error' => 'branch cannot go below zero'), 400);
        }
        $newAllocated = $allocated - $branchQty + $newBranchQty;
        if ($newAllocated > $total) {
            $pdo->rollBack();
            json_out(array('error' => 'not enough unallocated stock'), 400);
        }

        // Upsert the branch allocation.
        $stmt = $pdo->prepare(
            'INSERT INTO branch_stock (branch_id, product_id, quantity) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)'
        );
        $stmt->execute(array($branchId, $productId, $newBranchQty));

        $pdo->commit();
    } catch (Exception $e) {
        $pdo->rollBack();
        json_out(array('error' => 'distribution failed'), 500);
    }

    // Return the refreshed admin view for this product.
    json_out(admin_stock_one($pdo, $productId));
}

// Single-product version of the admin stock shape (used after distribute).
function admin_stock_one($pdo, $productId)
{
    $stmt = $pdo->prepare('SELECT id, name, category, stock_quantity FROM products WHERE id = ?');
    $stmt->execute(array($productId));
    $p = $stmt->fetch();

    $stmt = $pdo->prepare('SELECT branch_id, quantity FROM branch_stock WHERE product_id = ?');
    $stmt->execute(array($productId));
    $alloc = array();
    foreach ($stmt->fetchAll() as $r) {
        $alloc[(int) $r['branch_id']] = (float) $r['quantity'];
    }

    $total = (float) $p['stock_quantity'];
    $branchStock = array();
    $allocated = 0;
    foreach (array(1, 2, 3) as $bid) {
        $q = isset($alloc[$bid]) ? $alloc[$bid] : 0;
        $branchStock[$bid] = $q;
        $allocated += $q;
    }

    return array(
        'id'            => (int) $p['id'],
        'name'          => $p['name'],
        'category'      => $p['category'],
        'stockQuantity' => $total,
        'branchStock'   => $branchStock,
        'allocated'     => $allocated,
        'unallocated'   => $total - $allocated,
    );
}

// --- finance / profit ----------------------------------------------------
//   GET /admin/finance?period=day|month&date=YYYY-MM-DD
// Sales, ingredient cost (COGS), other costs, profit, and a per-ingredient
// breakdown for the chosen day or month.
function admin_finance($pdo)
{
    $period = v($_GET, 'period', 'day');
    if ($period !== 'month') {
        $period = 'day';
    }
    $base = v($_GET, 'date');
    $ts   = $base ? strtotime($base) : time();

    if ($period === 'day') {
        $start = date('Y-m-d 00:00:00', $ts);
        $end   = date('Y-m-d 00:00:00', strtotime('+1 day', $ts));
        $dStart = date('Y-m-d', $ts);
        $dEnd   = $dStart;
    } else {
        $start = date('Y-m-01 00:00:00', $ts);
        $end   = date('Y-m-01 00:00:00', strtotime('+1 month', strtotime(date('Y-m-01', $ts))));
        $dStart = date('Y-m-01', $ts);
        $dEnd   = date('Y-m-t', $ts);
    }

    // Revenue + crepe/order counts (exclude cancelled).
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) AS orders, COALESCE(SUM(total_price),0) AS revenue
         FROM orders WHERE created_at >= ? AND created_at < ? AND status <> 'CANCELLED'"
    );
    $stmt->execute(array($start, $end));
    $o = $stmt->fetch();
    $revenue    = (float) $o['revenue'];
    $orderCount = (int) $o['orders'];

    // Per-ingredient usage = doughs (one per order item) + toppings.
    $usage = array(); // productId => count
    $stmt = $pdo->prepare(
        "SELECT oi.base_dough_id AS pid, COUNT(*) AS cnt
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
         WHERE o.created_at >= ? AND o.created_at < ? AND o.status <> 'CANCELLED'
         GROUP BY oi.base_dough_id"
    );
    $stmt->execute(array($start, $end));
    $crepeCount = 0;
    foreach ($stmt->fetchAll() as $r) {
        $usage[(int) $r['pid']] = (int) $r['cnt'];
        $crepeCount += (int) $r['cnt']; // one dough per crepe
    }
    $stmt = $pdo->prepare(
        "SELECT oit.product_id AS pid, COUNT(*) AS cnt
         FROM order_item_toppings oit
         JOIN order_items oi ON oi.id = oit.order_item_id
         JOIN orders o ON o.id = oi.order_id
         WHERE o.created_at >= ? AND o.created_at < ? AND o.status <> 'CANCELLED'
         GROUP BY oit.product_id"
    );
    $stmt->execute(array($start, $end));
    foreach ($stmt->fetchAll() as $r) {
        $pid = (int) $r['pid'];
        $usage[$pid] = (isset($usage[$pid]) ? $usage[$pid] : 0) + (int) $r['cnt'];
    }

    // Join usage with each product's price/cost for the breakdown.
    $perIngredient = array();
    $cogs = 0;
    if (!empty($usage)) {
        $ids = array_keys($usage);
        $in  = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare("SELECT id, name, category, price, unit_cost, crepes_per_unit FROM products WHERE id IN ($in)");
        $stmt->execute($ids);
        foreach ($stmt->fetchAll() as $p) {
            $pid   = (int) $p['id'];
            $units = $usage[$pid];
            // Per-crepe cost = unit cost / crepes a unit yields.
            $perCrepe = ((float) $p['crepes_per_unit'] > 0) ? (float) $p['unit_cost'] / (float) $p['crepes_per_unit'] : 0;
            $rev   = (float) $p['price'] * $units;
            $cost  = $perCrepe * $units;
            $cogs += $cost;
            $perIngredient[] = array(
                'id'       => $pid,
                'name'     => $p['name'],
                'category' => $p['category'],
                'units'    => $units,
                'revenue'  => $rev,
                'cost'     => $cost,
                'profit'   => $rev - $cost,
            );
        }
        // Most profitable first.
        usort($perIngredient, 'finance_by_profit_desc');
    }

    // One-time costs that fall in the window.
    $stmt = $pdo->prepare(
        "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE frequency = 'ONCE' AND spent_on >= ? AND spent_on <= ?"
    );
    $stmt->execute(array($dStart, $dEnd));
    $oneTimeCosts = (float) $stmt->fetchColumn();

    // Monthly recurring costs, spread evenly: a day gets amount / days-in-month,
    // a month gets the full amount.
    $monthlySum = (float) $pdo->query(
        "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE frequency = 'MONTHLY'"
    )->fetchColumn();
    if ($period === 'day') {
        $daysInMonth = (int) date('t', $ts);
        $recurringMonthly = $daysInMonth > 0 ? $monthlySum / $daysInMonth : 0;
    } else {
        $recurringMonthly = $monthlySum;
    }

    $otherCosts  = $oneTimeCosts + $recurringMonthly;
    $grossProfit = $revenue - $cogs;
    $netProfit   = $grossProfit - $otherCosts;

    json_out(array(
        'period'             => $period,
        'date'               => date('Y-m-d', $ts),
        'revenue'            => $revenue,
        'cogs'               => $cogs,          // ingredient cost
        'otherCosts'         => $otherCosts,
        'oneTimeCosts'       => $oneTimeCosts,
        'recurringMonthly'   => $recurringMonthly, // monthly costs amortized to this period
        'grossProfit'        => $grossProfit,   // revenue - cogs
        'netProfit'          => $netProfit,     // grossProfit - otherCosts
        'orderCount'         => $orderCount,
        'crepeCount'         => $crepeCount,
        'grossProfitPerCrepe' => $crepeCount > 0 ? $grossProfit / $crepeCount : 0,
        'perIngredient'      => $perIngredient,
    ));
}

function finance_by_profit_desc($a, $b)
{
    if ($a['profit'] == $b['profit']) {
        return 0;
    }
    return ($a['profit'] < $b['profit']) ? 1 : -1;
}

// --- ingredient import (Excel / CSV) ------------------------------------
//   POST /admin/import  (multipart, field "file")
// Upserts ingredients by name. Recognised columns (header row, EN or TH,
// case/space-insensitive): name, category, price, unit_cost, crepes_per_unit,
// stock. Only the columns present are applied.
function admin_import($pdo)
{
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        json_out(array('error' => 'no file uploaded'), 400);
    }
    $content = file_get_contents($_FILES['file']['tmp_name']);
    $rows = read_table_file($content);
    if (count($rows) < 2) {
        json_out(array('error' => 'ไฟล์ไม่มีข้อมูล (ต้องมีหัวตารางและอย่างน้อย 1 แถว)'), 400);
    }

    // Map header columns to known fields.
    $colMap = array();
    foreach ($rows[0] as $i => $h) {
        $key = import_field($h);
        if ($key !== null && !isset($colMap[$key])) {
            $colMap[$key] = $i;
        }
    }
    if (!isset($colMap['name'])) {
        json_out(array('error' => 'ไม่พบคอลัมน์ชื่อวัตถุดิบ (name)'), 400);
    }

    $findStmt = $pdo->prepare('SELECT id FROM products WHERE name = ?');
    $added = 0;
    $updated = 0;
    $skipped = 0;

    foreach (array_slice($rows, 1) as $r) {
        $name = isset($colMap['name']) ? trim((string) v($r, $colMap['name'], '')) : '';
        if ($name === '') {
            $skipped++;
            continue;
        }
        $price    = import_num($r, $colMap, 'price');
        $unitCost = import_num($r, $colMap, 'unit_cost');
        $crepes   = import_num($r, $colMap, 'crepes_per_unit');
        $stock    = import_num($r, $colMap, 'stock');
        $category = import_category(isset($colMap['category']) ? v($r, $colMap['category'], '') : '');

        $findStmt->execute(array($name));
        $existing = $findStmt->fetch();

        if ($existing) {
            // Update only the provided columns; re-activate if it was deleted.
            $sets = array('is_active = 1');
            $params = array();
            if (isset($colMap['category'])) { $sets[] = 'category = ?'; $params[] = $category; }
            if ($price !== null)    { $sets[] = 'price = ?';            $params[] = $price; }
            if ($unitCost !== null) { $sets[] = 'unit_cost = ?';        $params[] = $unitCost; }
            if ($crepes !== null)   { $sets[] = 'crepes_per_unit = ?';  $params[] = $crepes; }
            if ($stock !== null)    { $sets[] = 'stock_quantity = ?';   $params[] = $stock; }
            $params[] = (int) $existing['id'];
            $pdo->prepare('UPDATE products SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
            $updated++;
        } else {
            // New ingredient needs a sell price.
            if ($price === null || $price <= 0) {
                $skipped++;
                continue;
            }
            $stmt = $pdo->prepare(
                'INSERT INTO products (name, category, price, unit_cost, crepes_per_unit, stock_quantity, alert_threshold, deduction_amount)
                 VALUES (?, ?, ?, ?, ?, ?, 0, 1)'
            );
            $stmt->execute(array(
                $name,
                $category,
                $price,
                $unitCost !== null ? $unitCost : 0,
                $crepes !== null ? $crepes : 1,
                $stock !== null ? $stock : 0,
            ));
            $added++;
        }
    }

    json_out(array('added' => $added, 'updated' => $updated, 'skipped' => $skipped));
}

// Normalise a header cell and map it to a known field key (or null).
function import_field($h)
{
    $h = strtolower(trim((string) $h));
    $h = preg_replace('/\s+/', '', $h);
    $aliases = array(
        'name' => 'name', 'ชื่อ' => 'name', 'ชื่อวัตถุดิบ' => 'name', 'ingredient' => 'name', 'วัตถุดิบ' => 'name',
        'category' => 'category', 'ประเภท' => 'category', 'type' => 'category', 'หมวด' => 'category',
        'price' => 'price', 'ราคา' => 'price', 'ราคาขาย' => 'price', 'sellprice' => 'price',
        'unitcost' => 'unit_cost', 'unit_cost' => 'unit_cost', 'cost' => 'unit_cost',
        'ต้นทุน' => 'unit_cost', 'ทุน' => 'unit_cost', 'ทุนต่อหน่วย' => 'unit_cost', 'ทุน/หน่วย' => 'unit_cost',
        'crepesperunit' => 'crepes_per_unit', 'crepes_per_unit' => 'crepes_per_unit', 'crepes' => 'crepes_per_unit',
        'จำนวนเครป' => 'crepes_per_unit', 'ทำได้' => 'crepes_per_unit', 'เครปต่อหน่วย' => 'crepes_per_unit',
        'stock' => 'stock', 'สต็อก' => 'stock', 'stockquantity' => 'stock', 'คงคลัง' => 'stock',
    );
    return isset($aliases[$h]) ? $aliases[$h] : null;
}

function import_num($row, $colMap, $key)
{
    if (!isset($colMap[$key])) {
        return null;
    }
    $raw = isset($row[$colMap[$key]]) ? trim((string) $row[$colMap[$key]]) : '';
    if ($raw === '') {
        return null;
    }
    $raw = str_replace(',', '', $raw); // tolerate thousands separators
    return is_numeric($raw) ? (float) $raw : null;
}

function import_category($v)
{
    $v = trim((string) $v);
    if ($v === 'DOUGH' || strtolower($v) === 'dough' || strpos($v, 'แป้ง') !== false) {
        return 'DOUGH';
    }
    return 'TOPPING';
}
