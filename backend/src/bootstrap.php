<?php
// Shared setup for every request: config, DB (+ self-creating schema), CORS,
// JSON helpers, and the route/lib includes. PHP 5.6 compatible.

error_reporting(E_ALL);
ini_set('display_errors', '0'); // never leak warnings into JSON/binary output

require __DIR__ . '/db.php';
require __DIR__ . '/serialize.php';
require __DIR__ . '/lib/line.php';
require __DIR__ . '/lib/webpush.php';
require __DIR__ . '/lib/xlsx.php';
require __DIR__ . '/routes/products.php';
require __DIR__ . '/routes/orders.php';
require __DIR__ . '/routes/dashboard.php';
require __DIR__ . '/routes/internal.php';
require __DIR__ . '/routes/branches.php';
require __DIR__ . '/routes/admin.php';

$config = require __DIR__ . '/config.php';
date_default_timezone_set($config['tz']);

// --- CORS (the frontend calls cross-origin with credentials) -------------
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
header('Access-Control-Allow-Origin: ' . ($origin !== '' ? $origin : $config['frontend_url']));
header('Vary: Origin');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$pdo = db($config);
ensure_schema($pdo);

// --- helpers -------------------------------------------------------------

function json_out($data, $code = 200)
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_body()
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : array();
}

// Restrict an endpoint to a given HTTP method (or list of methods).
function only()
{
    $methods = func_get_args();
    if (!in_array($_SERVER['REQUEST_METHOD'], $methods, true)) {
        json_out(array('error' => 'method not allowed'), 405);
    }
}

// Read a key from an array with a default (a PHP 5.6-friendly ?? operator).
function v($arr, $key, $default = null)
{
    return isset($arr[$key]) ? $arr[$key] : $default;
}
