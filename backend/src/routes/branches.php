<?php
// /api/branches
//   GET /branches             list the 3 branches
//   GET /branches/{id}/stock  ingredients admin has allocated to this branch
//                             (what the branch's แม่ค้า is allowed to see)
// PHP 5.6 compatible.

function route_branches($pdo, $rest, $method)
{
    if (count($rest) === 0 && $method === 'GET') {
        return branches_list($pdo);
    }

    if (count($rest) === 2 && $rest[1] === 'stock' && $method === 'GET') {
        return branch_stock_list($pdo, (int) $rest[0]);
    }

    json_out(array('error' => 'not found'), 404);
}

function branches_list($pdo)
{
    $rows = $pdo->query('SELECT id, name FROM branches ORDER BY id ASC')->fetchAll();
    $out = array();
    foreach ($rows as $r) {
        $out[] = array('id' => (int) $r['id'], 'name' => $r['name']);
    }
    json_out($out);
}

function branch_stock_list($pdo, $branchId)
{
    // Only ingredients actually given to this branch (quantity > 0).
    $stmt = $pdo->prepare(
        'SELECT p.id, p.name, p.category, p.alert_threshold, bs.quantity
         FROM branch_stock bs
         JOIN products p ON p.id = bs.product_id
         WHERE bs.branch_id = ? AND bs.quantity > 0 AND p.is_active = 1
         ORDER BY p.category ASC, p.name ASC'
    );
    $stmt->execute(array($branchId));

    $out = array();
    foreach ($stmt->fetchAll() as $r) {
        $out[] = array(
            'id'             => (int) $r['id'],
            'name'           => $r['name'],
            'category'       => $r['category'],
            'alertThreshold' => (float) $r['alert_threshold'],
            'quantity'       => (float) $r['quantity'],
        );
    }
    json_out($out);
}
