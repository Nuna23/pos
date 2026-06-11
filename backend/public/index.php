<?php
// Front controller: every request is rewritten here by .htaccess. Parses the
// path (optionally prefixed with /api) and dispatches to a route handler.
// PHP 5.6 compatible.

require __DIR__ . '/../src/bootstrap.php';

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = trim($path, '/');
$segments = $path === '' ? array() : explode('/', $path);

// Allow either "/api/orders" (matches the frontend's NEXT_PUBLIC_API_URL) or
// a bare "/orders".
if (!empty($segments) && $segments[0] === 'api') {
    array_shift($segments);
}

$method = $_SERVER['REQUEST_METHOD'];

if (empty($segments)) {
    json_out(array('status' => 'ok', 'service' => 'CrepePOS PHP backend'));
}

$resource = array_shift($segments); // remaining $segments are the sub-path

switch ($resource) {
    case 'products':
        route_products($pdo, $segments, $method);
        break;
    case 'orders':
        route_orders($pdo, $config, $segments, $method);
        break;
    case 'dashboard':
        route_dashboard($pdo, $segments, $method);
        break;
    case 'internal':
        route_internal($pdo, $config, $segments, $method);
        break;
    case 'branches':
        route_branches($pdo, $segments, $method);
        break;
    case 'admin':
        route_admin($pdo, $segments, $method);
        break;
    default:
        json_out(array('error' => 'not found'), 404);
}
