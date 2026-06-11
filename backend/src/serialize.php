<?php
// Map snake_case DB rows to the camelCase JSON shapes the frontend expects
// (see frontend/types/index.ts). PHP 5.6 compatible.

function iso_date($dt)
{
    if ($dt === null || $dt === '') {
        return null;
    }
    // MySQL DATETIME "Y-m-d H:i:s" -> ISO-ish "Y-m-dTH:i:s" (string; the
    // frontend only ever passes these to new Date()).
    return str_replace(' ', 'T', (string) $dt);
}

function product_json($r)
{
    return array(
        'id'              => (int) $r['id'],
        'name'            => $r['name'],
        'category'        => $r['category'],
        'price'           => (float) $r['price'],
        'stockQuantity'   => (float) $r['stock_quantity'],
        'alertThreshold'  => (float) $r['alert_threshold'],
        'deductionAmount' => (float) $r['deduction_amount'],
        'alertSent'       => (bool) $r['alert_sent'],
        'createdAt'       => iso_date(v($r, 'created_at')),
        'updatedAt'       => iso_date(v($r, 'updated_at')),
    );
}

// Fetch the given product ids and return them keyed by id as JSON shapes.
function product_map($pdo, $ids)
{
    $ids = array_values(array_unique(array_map('intval', $ids)));
    if (empty($ids)) {
        return array();
    }
    $in   = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("SELECT * FROM products WHERE id IN ($in)");
    $stmt->execute($ids);
    $map = array();
    foreach ($stmt->fetchAll() as $r) {
        $map[(int) $r['id']] = product_json($r);
    }
    return $map;
}

function order_json($o, $items)
{
    return array(
        'id'           => (int) $o['id'],
        'queueNumber'  => (int) $o['queue_number'],
        'totalPrice'   => (float) $o['total_price'],
        'status'       => $o['status'],
        'pushEndpoint' => v($o, 'push_endpoint'),
        'createdAt'    => iso_date(v($o, 'created_at')),
        'updatedAt'    => iso_date(v($o, 'updated_at')),
        'items'        => $items,
    );
}

// Turn a set of order rows into fully-nested order JSON (items -> baseDough +
// toppings -> product), loading items/toppings/products in batches to avoid
// an N+1 query storm.
function load_orders($pdo, $orders)
{
    if (empty($orders)) {
        return array();
    }

    $orderIds = array();
    foreach ($orders as $o) {
        $orderIds[] = (int) $o['id'];
    }

    $in    = implode(',', array_fill(0, count($orderIds), '?'));
    $stmt  = $pdo->prepare("SELECT * FROM order_items WHERE order_id IN ($in) ORDER BY id ASC");
    $stmt->execute($orderIds);
    $items = $stmt->fetchAll();

    $itemIds    = array();
    $productIds = array();
    foreach ($items as $it) {
        $itemIds[]    = (int) $it['id'];
        $productIds[] = (int) $it['base_dough_id'];
    }

    $toppings = array();
    if (!empty($itemIds)) {
        $in2  = implode(',', array_fill(0, count($itemIds), '?'));
        $stmt = $pdo->prepare("SELECT * FROM order_item_toppings WHERE order_item_id IN ($in2) ORDER BY id ASC");
        $stmt->execute($itemIds);
        $toppings = $stmt->fetchAll();
        foreach ($toppings as $t) {
            $productIds[] = (int) $t['product_id'];
        }
    }

    $products = product_map($pdo, $productIds);

    // Group toppings under their order item.
    $topByItem = array();
    foreach ($toppings as $t) {
        $iid = (int) $t['order_item_id'];
        if (!isset($topByItem[$iid])) {
            $topByItem[$iid] = array();
        }
        $pid = (int) $t['product_id'];
        $topByItem[$iid][] = array(
            'id'          => (int) $t['id'],
            'orderItemId' => $iid,
            'productId'   => $pid,
            'product'     => isset($products[$pid]) ? $products[$pid] : null,
        );
    }

    // Group items under their order.
    $itemsByOrder = array();
    foreach ($items as $it) {
        $oid = (int) $it['order_id'];
        $iid = (int) $it['id'];
        $did = (int) $it['base_dough_id'];
        if (!isset($itemsByOrder[$oid])) {
            $itemsByOrder[$oid] = array();
        }
        $itemsByOrder[$oid][] = array(
            'id'          => $iid,
            'orderId'     => $oid,
            'baseDoughId' => $did,
            'baseDough'   => isset($products[$did]) ? $products[$did] : null,
            'toppings'    => isset($topByItem[$iid]) ? $topByItem[$iid] : array(),
        );
    }

    $out = array();
    foreach ($orders as $o) {
        $oid = (int) $o['id'];
        $out[] = order_json($o, isset($itemsByOrder[$oid]) ? $itemsByOrder[$oid] : array());
    }
    return $out;
}

// Convenience: load a single order (or null) as nested JSON.
function load_order($pdo, $id)
{
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id = ?');
    $stmt->execute(array((int) $id));
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    $list = load_orders($pdo, array($row));
    return $list[0];
}
