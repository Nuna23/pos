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
    $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], array(
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ));

    // Align the DB session timezone with the app timezone (the container's MySQL
    // defaults to UTC). This keeps CURRENT_TIMESTAMP and every created_at range
    // comparison consistent with PHP's date() math instead of 7h off.
    try {
        $offset = date_create('now', timezone_open($config['tz']))->format('P'); // e.g. +07:00
        $pdo->exec("SET time_zone = '" . $offset . "'");
    } catch (Exception $e) {
        // Leave the server default if the offset can't be resolved.
    }

    return $pdo;
}

function table_exists($pdo, $name)
{
    try {
        $stmt = $pdo->query('SELECT 1 FROM `' . $name . '` LIMIT 1');
        $stmt->fetchAll(); // consume so the cursor doesn't stay open
        return true;
    } catch (Exception $e) {
        return false;
    }
}

function column_exists($pdo, $table, $col)
{
    try {
        $stmt = $pdo->query("SELECT `$col` FROM `$table` LIMIT 1");
        $stmt->fetchAll();
        return true;
    } catch (Exception $e) {
        return false;
    }
}

// Swallow "duplicate column" if a concurrent cold-start request already ran the
// same ALTER (the seed itself is duplicate-safe via UNIQUE(name)+INSERT IGNORE).
function safe_exec($pdo, $sql)
{
    try {
        $pdo->exec($sql);
    } catch (Exception $e) {
        // ignore — already applied
    }
}

// Ensure schema + first-time seed. Fast path = cheap existence checks. Seeding
// is idempotent (UNIQUE product name + INSERT IGNORE), so even two concurrent
// cold-start requests can't create duplicate rows.
function ensure_schema($pdo)
{
    if (
        table_exists($pdo, 'products') &&
        table_exists($pdo, 'branch_stock') &&
        table_exists($pdo, 'expenses') &&
        column_exists($pdo, 'products', 'unit_cost') &&
        column_exists($pdo, 'orders', 'branch_id') &&
        column_exists($pdo, 'expenses', 'frequency')
    ) {
        return; // already fully set up
    }

    if (!table_exists($pdo, 'products')) {
        create_schema($pdo);
        seed_products($pdo);
    }
    if (!table_exists($pdo, 'branch_stock')) {
        create_branch_schema($pdo);
    }
    if (!column_exists($pdo, 'orders', 'branch_id')) {
        safe_exec($pdo, 'ALTER TABLE orders ADD COLUMN branch_id INT NULL');
    }
    // Unit-based cost (unit_cost / crepes_per_unit -> per-crepe cost).
    if (!column_exists($pdo, 'products', 'unit_cost')) {
        safe_exec($pdo, 'ALTER TABLE products ADD COLUMN unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER price');
        safe_exec($pdo, 'ALTER TABLE products ADD COLUMN crepes_per_unit DOUBLE NOT NULL DEFAULT 1 AFTER unit_cost');
    }
    // Admin-managed "other costs" (rent, gas, wages, ...). frequency = ONCE for
    // a one-day cost, or MONTHLY for a recurring cost spread evenly per day.
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS expenses (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            label      VARCHAR(190) NOT NULL,
            amount     DECIMAL(10,2) NOT NULL,
            spent_on   DATE NOT NULL,
            frequency  ENUM('ONCE','MONTHLY') NOT NULL DEFAULT 'ONCE',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_expenses_date (spent_on)
        ) CHARACTER SET utf8mb4"
    );
    if (!column_exists($pdo, 'expenses', 'frequency')) {
        safe_exec($pdo, "ALTER TABLE expenses ADD COLUMN frequency ENUM('ONCE','MONTHLY') NOT NULL DEFAULT 'ONCE'");
    }
}

// 3 branches + the per-branch allocation of each ingredient that admin gives.
function create_branch_schema($pdo)
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS branches (
            id   INT PRIMARY KEY,
            name VARCHAR(100) NOT NULL
        ) CHARACTER SET utf8mb4"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS branch_stock (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            branch_id  INT NOT NULL,
            product_id INT NOT NULL,
            quantity   DOUBLE NOT NULL DEFAULT 0,
            UNIQUE KEY uniq_branch_product (branch_id, product_id),
            FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        ) CHARACTER SET utf8mb4"
    );

    $stmt = $pdo->prepare('INSERT IGNORE INTO branches (id, name) VALUES (?, ?)');
    foreach (array(1 => 'สาขา 1', 2 => 'สาขา 2', 3 => 'สาขา 3') as $id => $name) {
        $stmt->execute(array($id, $name));
    }
}

function create_schema($pdo)
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS products (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            name             VARCHAR(100) NOT NULL,
            category         ENUM('DOUGH','TOPPING') NOT NULL,
            price            DECIMAL(10,2) NOT NULL,
            unit_cost        DECIMAL(10,2) NOT NULL DEFAULT 0,
            crepes_per_unit  DOUBLE NOT NULL DEFAULT 1,
            stock_quantity   DOUBLE NOT NULL,
            alert_threshold  DOUBLE NOT NULL,
            deduction_amount DOUBLE NOT NULL DEFAULT 1,
            alert_sent       TINYINT(1) NOT NULL DEFAULT 0,
            created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_product_name (name)
        ) CHARACTER SET utf8mb4"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS orders (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            queue_number   INT NOT NULL,
            total_price    DECIMAL(10,2) NOT NULL,
            status         ENUM('PENDING','COOKING','DONE','CANCELLED') NOT NULL DEFAULT 'PENDING',
            payment_method ENUM('CASH','QR') NULL,
            branch_id     INT NULL,
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
    // name, category, price, unit_cost, crepes_per_unit, stock, threshold, deduction
    // (unit_cost / crepes_per_unit gives the per-crepe cost — these stand in for
    // the values that would come from the shop's Excel cost sheet.)
    $rows = array(
        // แป้งเครป (DOUGH)
        array('แป้งธรรมดา',   'DOUGH', 30, 600, 50, 100, 20, 1),
        array('แป้งโกโก้',     'DOUGH', 35, 750, 50, 80,  15, 1),
        array('แป้งมัทฉะ',     'DOUGH', 35, 800, 50, 60,  15, 1),
        array('แป้งสตรอเบอรี่', 'DOUGH', 35, 800, 50, 60,  15, 1),
        // ท็อปปิ้ง (TOPPING)
        array('กล้วย',         'TOPPING', 10, 40,  10, 50, 10, 0.5),
        array('สตรอเบอรี่',    'TOPPING', 15, 140, 20, 40, 10, 0.5),
        array('นูเทลล่า',      'TOPPING', 15, 240, 30, 30, 5,  0.3),
        array('ชีส',           'TOPPING', 15, 140, 20, 40, 10, 0.5),
        array('ไข่',           'TOPPING', 10, 120, 30, 60, 15, 1),
        array('ไส้กรอก',       'TOPPING', 15, 140, 20, 40, 10, 1),
        array('แฮม',           'TOPPING', 15, 160, 20, 40, 10, 1),
        array('ครีม',          'TOPPING', 10, 200, 50, 50, 10, 0.3),
        array('นมข้นหวาน',     'TOPPING', 5,  40,  20, 80, 20, 0.2),
        array('ซอสช็อกโกแลต',  'TOPPING', 5,  60,  30, 80, 20, 0.2),
    );

    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO products (name, category, price, unit_cost, crepes_per_unit, stock_quantity, alert_threshold, deduction_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($rows as $r) {
        $stmt->execute($r);
    }
}
