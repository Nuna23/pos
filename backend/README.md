# CrepePOS — PHP backend

Plain PHP + Apache + MySQL/MariaDB (PDO), in the same self-contained style as
the JLcheckin reference: **no Composer, no migrations, no build step**. The app
creates its own tables and seeds the menu on first request.

It replaces the previous NestJS/Prisma backend while keeping the exact same HTTP
API the Next.js frontend already calls.

## Layout

```
public/index.php   Front controller — all requests route here (.htaccess rewrite)
public/.htaccess   Rewrite rules
src/config.php     Config + secrets (env vars override the cPanel fallbacks)
src/db.php         PDO connection + self-creating schema + menu seed
src/bootstrap.php  CORS, JSON helpers, includes
src/serialize.php  snake_case DB rows -> camelCase JSON the frontend expects
src/routes/        products, orders, dashboard, internal
src/lib/           line.php (LINE push), webpush.php (RFC 8291), xlsx.php (Excel)
bin/stock-alert.php  CLI low-stock LINE alert (for cron)
```

## API

Base path is `/api` (matches the frontend's `NEXT_PUBLIC_API_URL`).

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/api/products` | optional `?category=DOUGH\|TOPPING` |
| GET | `/api/products/{id}` | |
| POST | `/api/products` | |
| PATCH | `/api/products/{id}` | partial update |
| PATCH | `/api/products/{id}/replenish` | body `{amount}` |
| DELETE | `/api/products/{id}` | |
| GET | `/api/orders` | optional `?status=` |
| GET | `/api/orders/today` | board view, ordered by queue number |
| GET | `/api/orders/{id}` | nested order |
| POST | `/api/orders` | `{items:[{baseDoughId,toppingIds[]}], pushSubscription?}` |
| PUT | `/api/orders/{id}/status` | body `{status}`; fires web push on `DONE` |
| GET | `/api/dashboard/summary` | `?period=day\|month` |
| GET | `/api/dashboard/export` | `?start=&end=` → `.xlsx` |
| GET | `/api/internal/stock-alert` | `?secret=` → run LINE low-stock check |

## Run locally

From the repo root: `docker compose up --build` (starts db + backend + frontend).
The backend is then at <http://localhost:3001/api>.

## Real-time

The old socket.io live updates were replaced with **client-side polling**
(the kanban board polls `/orders/today`, the queue tracker polls `/orders/{id}`),
since plain PHP/Apache can't host a persistent socket server.

## Notifications

- **LINE low-stock alert** — works on PHP 5.6. Trigger it from cron:
  ```
  */5 * * * * php /var/www/html/bin/stock-alert.php >/dev/null 2>&1
  # or over HTTP:
  */5 * * * * curl -s "https://your-host/api/internal/stock-alert?secret=CHANGE_ME"
  ```
- **Web push** ("your crepe is ready") — implemented in `src/lib/webpush.php`
  but requires **PHP 7.3+** (ECDH/HKDF/AES-GCM). On the PHP 5.6 Docker image it
  is a logged no-op; deploy on `ea-php82` (or set the Docker image to
  `php:8.2-apache`) and configure the VAPID keys to enable it.
