<?php
// /api/internal — operational endpoints not used by the browser UI.
//   GET|POST /internal/stock-alert?secret=...   run the LINE low-stock check.
// Intended to be hit by a cron job (curl). The same logic is available on the
// CLI via bin/stock-alert.php. PHP 5.6 compatible.

function route_internal($pdo, $config, $rest, $method)
{
    if (count($rest) === 1 && $rest[0] === 'stock-alert') {
        $secret = (string) v($_GET, 'secret', '');
        if (!hash_equals((string) $config['cron_secret'], $secret)) {
            json_out(array('error' => 'forbidden'), 403);
        }
        $result = run_stock_alert($pdo, $config);
        json_out($result);
    }
    json_out(array('error' => 'not found'), 404);
}

// Find products at/below their alert threshold that haven't been alerted yet,
// push a LINE message to the owner, and mark them alerted. Returns a summary.
// (Ported from the old NestJS @Cron job.)
function run_stock_alert($pdo, $config)
{
    $stmt = $pdo->query(
        'SELECT * FROM products WHERE alert_sent = 0 AND stock_quantity <= alert_threshold'
    );
    $low = $stmt->fetchAll();
    if (empty($low)) {
        return array('alerted' => 0);
    }

    $lines = array();
    $ids   = array();
    foreach ($low as $p) {
        $ids[]   = (int) $p['id'];
        $lines[] = sprintf(
            '⚠️ %s: เหลือ %s (ถึงขีดแจ้งเตือน %s)',
            $p['name'],
            rtrim(rtrim((string) $p['stock_quantity'], '0'), '.'),
            rtrim(rtrim((string) $p['alert_threshold'], '0'), '.')
        );
    }
    $message = "🥞 CrepePOS แจ้งเตือนสต็อกใกล้หมด:\n" . implode("\n", $lines);

    $sent = line_push($config, $message);
    if (!$sent) {
        return array('alerted' => 0, 'error' => 'LINE not configured or send failed');
    }

    $in = implode(',', array_fill(0, count($ids), '?'));
    $pdo->prepare("UPDATE products SET alert_sent = 1 WHERE id IN ($in)")->execute($ids);

    return array('alerted' => count($ids));
}
