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
    'frontend_url' => getenv('FRONTEND_URL') ?: 'http://localhost:3000',

    // --- LINE Messaging API (low-stock alert pushed to the owner) ---
    'line_token'   => getenv('LINE_CHANNEL_ACCESS_TOKEN') ?: '',
    'line_user_id' => getenv('LINE_NOTIFY_USER_ID') ?: '',

    // --- Web Push (VAPID) — "your crepe is ready" to the customer ---
    'vapid_public'  => getenv('WEB_PUSH_VAPID_PUBLIC_KEY') ?: '',
    'vapid_private' => getenv('WEB_PUSH_VAPID_PRIVATE_KEY') ?: '',
    'vapid_subject' => getenv('WEB_PUSH_VAPID_EMAIL') ?: 'mailto:admin@example.com',

    // Shared secret that protects the cron-triggered stock-alert HTTP endpoint.
    'cron_secret' => getenv('CRON_SECRET') ?: 'changeme',
);
