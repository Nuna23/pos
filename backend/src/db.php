<?php
// PDO connection + self-creating schema and seed data (so phpMyAdmin / a
// migration step is never required — the app builds its own tables on first
// run, exactly like the JLcheckin reference). PHP 5.6 compatible.

function db($config)
{
    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        $config['db_host'],
        $config['db_port'],
        $config['db_name']
    );
    return new PDO($dsn, $config['db_user'], $config['db_pass'], array(
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ));
}

// Cheap existence check first so we don't run DDL on every request.
function ensure_schema($pdo)
{
    try {
        $pdo->query('SELECT 1 FROM products LIMIT 1');
        return; // already set up
    } catch (Exception $e) {
        // fall through and create + seed
    }
    create_schema($pdo);
    seed_products($pdo);
}

function create_schema($pdo)
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS products (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            name             VARCHAR(100) NOT NULL,
            category         ENUM('DOUGH','TOPPING') NOT NULL,
            price            DECIMAL(10,2) NOT NULL,
            stock_quantity   DOUBLE NOT NULL,
            alert_threshold  DOUBLE NOT NULL,
            deduction_amount DOUBLE NOT NULL DEFAULT 1,
            alert_sent       TINYINT(1) NOT NULL DEFAULT 0,
            created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) CHARACTER SET utf8mb4"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS orders (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            queue_number  INT NOT NULL,
            total_price   DECIMAL(10,2) NOT NULL,
            status        ENUM('PENDING','COOKING','DONE','CANCELLED') NOT NULL DEFAULT 'PENDING',
            push_endpoint TEXT NULL,
            push_p256dh   TEXT NULL,
            push_auth     TEXT NULL,
            created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_orders_created (created_at),
            INDEX idx_orders_status (status)
        ) CHARACTER SET utf8mb4"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS order_items (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            order_id      INT NOT NULL,
            base_dough_id INT NOT NULL,
            created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (base_dough_id) REFERENCES products(id)
        ) CHARACTER SET utf8mb4"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS order_item_toppings (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            order_item_id INT NOT NULL,
            product_id    INT NOT NULL,
            FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        ) CHARACTER SET utf8mb4"
    );
}

// Initial CrepePOS menu (ported from the old Prisma seed.ts).
function seed_products($pdo)
{
    $rows = array(
        // แป้งเครป (DOUGH): name, price, stock, threshold, deduction
        array('แป้งธรรมดา',   'DOUGH', 30, 100, 20, 1),
        array('แป้งโกโก้',     'DOUGH', 35, 80,  15, 1),
        array('แป้งมัทฉะ',     'DOUGH', 35, 60,  15, 1),
        array('แป้งสตรอเบอรี่', 'DOUGH', 35, 60,  15, 1),
        // ท็อปปิ้ง (TOPPING)
        array('กล้วย',         'TOPPING', 10, 50, 10, 0.5),
        array('สตรอเบอรี่',    'TOPPING', 15, 40, 10, 0.5),
        array('นูเทลล่า',      'TOPPING', 15, 30, 5,  0.3),
        array('ชีส',           'TOPPING', 15, 40, 10, 0.5),
        array('ไข่',           'TOPPING', 10, 60, 15, 1),
        array('ไส้กรอก',       'TOPPING', 15, 40, 10, 1),
        array('แฮม',           'TOPPING', 15, 40, 10, 1),
        array('ครีม',          'TOPPING', 10, 50, 10, 0.3),
        array('นมข้นหวาน',     'TOPPING', 5,  80, 20, 0.2),
        array('ซอสช็อกโกแลต',  'TOPPING', 5,  80, 20, 0.2),
    );

    $stmt = $pdo->prepare(
        'INSERT INTO products (name, category, price, stock_quantity, alert_threshold, deduction_amount)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ($rows as $r) {
        $stmt->execute($r);
    }
}
