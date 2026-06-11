<?php
// /api/dashboard
//   GET /dashboard/summary?period=day|month   revenue / order count / peaks / top toppings
//   GET /dashboard/export?start=&end=          .xlsx download of sales
// PHP 5.6 compatible.

function route_dashboard($pdo, $rest, $method)
{
    if (count($rest) === 1 && $rest[0] === 'summary' && $method === 'GET') {
        return dashboard_summary($pdo);
    }
    if (count($rest) === 1 && $rest[0] === 'export' && $method === 'GET') {
        return dashboard_export($pdo);
    }
    json_out(array('error' => 'not found'), 404);
}

function dashboard_summary($pdo)
{
    $period = v($_GET, 'period', 'day');
    if ($period !== 'month') {
        $period = 'day';
    }
    $start = $period === 'day' ? date('Y-m-d 00:00:00') : date('Y-m-01 00:00:00');

    $stmt = $pdo->prepare(
        "SELECT * FROM orders WHERE created_at >= ? AND status <> 'CANCELLED'"
    );
    $stmt->execute(array($start));
    $orders = $stmt->fetchAll();

    $totalRevenue = 0;
    $orderCount   = count($orders);
    $peakHoursMap = array();

    foreach ($orders as $o) {
        $totalRevenue += (float) $o['total_price'];
        $hour = (int) date('G', strtotime($o['created_at']));
        $peakHoursMap[$hour] = (isset($peakHoursMap[$hour]) ? $peakHoursMap[$hour] : 0) + 1;
    }

    // Count toppings sold across these orders (one query via joins).
    $toppingCount = array();
    if ($orderCount > 0) {
        $ids = array();
        foreach ($orders as $o) {
            $ids[] = (int) $o['id'];
        }
        $in = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare(
            "SELECT p.name AS name, COUNT(*) AS cnt
             FROM order_item_toppings oit
             JOIN order_items oi ON oi.id = oit.order_item_id
             JOIN products p ON p.id = oit.product_id
             WHERE oi.order_id IN ($in)
             GROUP BY p.name ORDER BY cnt DESC LIMIT 10"
        );
        $stmt->execute($ids);
        foreach ($stmt->fetchAll() as $r) {
            $toppingCount[] = array('name' => $r['name'], 'count' => (int) $r['cnt']);
        }
    }

    $peakHours = array();
    foreach ($peakHoursMap as $hour => $count) {
        $peakHours[] = array('hour' => (int) $hour, 'count' => (int) $count);
    }

    json_out(array(
        'period'       => $period,
        'totalRevenue' => $totalRevenue,
        'orderCount'   => $orderCount,
        'peakHours'    => $peakHours,
        'topToppings'  => $toppingCount,
    ));
}

function dashboard_export($pdo)
{
    @ini_set('display_errors', '0'); // keep notices out of the binary

    $start = v($_GET, 'start');
    $end   = v($_GET, 'end');
    $startDt = $start ? date('Y-m-d 00:00:00', strtotime($start)) : date('Y-m-01 00:00:00');
    $endDt   = $end ? date('Y-m-d 23:59:59', strtotime($end)) : date('Y-m-d H:i:s');

    $stmt = $pdo->prepare(
        'SELECT * FROM orders WHERE created_at >= ? AND created_at <= ? ORDER BY created_at ASC'
    );
    $stmt->execute(array($startDt, $endDt));
    $orders = load_orders($pdo, $stmt->fetchAll());

    // Header row (Thai), matching the old exceljs export.
    $rows = array(array('วันที่', 'เลขคิว', 'สถานะ', 'แป้ง', 'ไส้', 'ราคา (บาท)'));

    foreach ($orders as $order) {
        foreach ($order['items'] as $item) {
            $doughName = $item['baseDough'] ? $item['baseDough']['name'] : '';
            $toppingNames = array();
            foreach ($item['toppings'] as $t) {
                if ($t['product']) {
                    $toppingNames[] = $t['product']['name'];
                }
            }
            $rows[] = array(
                str_replace('T', ' ', (string) $order['createdAt']),
                (int) $order['queueNumber'],
                $order['status'],
                $doughName,
                implode(', ', $toppingNames),
                (float) $order['totalPrice'],
            );
        }
    }

    $filename = 'sales_' . date('Y-m-d') . '.xlsx';
    xlsx_download($rows, $filename, 'Sales'); // streams + exit
}
