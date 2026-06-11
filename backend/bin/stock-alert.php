<?php
// CLI entry point for the low-stock LINE alert. Run from cron, e.g.:
//   */5 * * * * php /var/www/html/bin/stock-alert.php >/dev/null 2>&1
// (Or hit GET /api/internal/stock-alert?secret=... over HTTP instead.)
// PHP 5.6 compatible.

require __DIR__ . '/../src/db.php';
require __DIR__ . '/../src/serialize.php';
require __DIR__ . '/../src/lib/line.php';
require __DIR__ . '/../src/routes/internal.php';

$config = require __DIR__ . '/../src/config.php';
date_default_timezone_set($config['tz']);

// Minimal v() since we don't load bootstrap.php here.
if (!function_exists('v')) {
    function v($arr, $key, $default = null)
    {
        return isset($arr[$key]) ? $arr[$key] : $default;
    }
}

$pdo = db($config);
$result = run_stock_alert($pdo, $config);

echo 'stock-alert: ' . json_encode($result) . "\n";
