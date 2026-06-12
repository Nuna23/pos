<?php
// App configuration + secrets. This is a .php file on purpose: even if someone
// requests it directly in a browser, PHP executes it and returns nothing, so
// the credentials are never disclosed (unlike a plain .env file).
//
// On cPanel the hardcoded values below are used. Local Docker dev overrides
// them via environment variables (docker-compose sets DB_HOST=db, etc.) —
// getenv() returns false on cPanel, so it falls back to the hardcoded value.
// PHP 5.6 compatible.

return array(
    // --- database (cPanel MySQL) ---
    'db_host' => getenv('DB_HOST') ?: 'localhost',
    'db_port' => getenv('DB_PORT') ?: '3306',
    'db_name' => getenv('DB_NAME') ?: 'baanrac1_crepepos',
    'db_user' => getenv('DB_USER') ?: 'baanrac1_crepepos',
    'db_pass' => getenv('DB_PASS') ?: 'Jlhome2026',

    // --- misc ---
    'tz'           => getenv('APP_TZ') ?: 'Asia/Bangkok',
    'frontend_url' => getenv('FRONTEND_URL') ?: 'https://pos.golfy.in.th',

    // --- LINE Messaging API (low-stock alert pushed to the owner) ---
    'line_token'   => getenv('LINE_CHANNEL_ACCESS_TOKEN') ?: 'JAl69IIqE0bSyBxqYeSMMAK4FqaQb0k2NutAyYzskq9WZBc4DSyIlP2xoBH+XNTnl53tUbM9mZoGh5usPfT5TFoWFGVz25qbSz8syp3ZM8jxFt7aVyaGilQlnILigSt9u3CM3PXAF18iyPnCCM3RZQdB04t89/1O/w1cDnyilFU=',
    'line_user_id' => getenv('LINE_NOTIFY_USER_ID') ?: 'Ud04904aa1580d7e4597c2c83d7c0e103',

    // --- Web Push (VAPID) — "your crepe is ready" to the customer ---
    'vapid_public'  => getenv('VAPID_PUBLIC_KEY') ?: 'BApbdQIY77kyE2g05LVZiABYVcY7T7xAlJAAvXzp3mqWT6cNmsx5b85VqnAAh_H9-FmtzppDRRQW-L9-m6aoyb0',
    'vapid_private' => getenv('VAPID_PRIVATE_KEY') ?: 'FRlcBm7eYR5mAuC1jojWrAAdQobZEDbKsXLQIMqtp9c',
    'vapid_subject' => getenv('VAPID_SUBJECT') ?: 'mailto:palmome23@gmail.com',

    // Shared secret that protects the cron-triggered stock-alert HTTP endpoint.
    'cron_secret' => getenv('CRON_SECRET') ?: 'changeme',
);
