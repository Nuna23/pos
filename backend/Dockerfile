# CrepePOS PHP backend.
# Pinned to PHP 5.6 to match the cPanel hosting (same approach as JLcheckin).
# Debian Stretch is archived, hence the apt source fix.
#
# NOTE: web push (notifications.lib) needs PHP 7.3+ and is a no-op on 5.6 — the
# rest of the API (products / orders / dashboard / LINE alert) works fully here.
FROM php:5.6-apache

RUN echo 'deb http://archive.debian.org/debian stretch main' > /etc/apt/sources.list \
 && printf 'Acquire::Check-Valid-Until "false";\nAcquire::AllowInsecureRepositories "true";\n' > /etc/apt/apt.conf.d/99archive \
 && apt-get update \
 && apt-get install -y --allow-unauthenticated zlib1g-dev libcurl4-openssl-dev \
 && docker-php-ext-install pdo_mysql curl \
 && a2enmod rewrite headers \
 && rm -rf /var/lib/apt/lists/*

# Serve from public/ so src/ (config + secrets) is never web-accessible.
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
 && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf \
 && sed -ri 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

COPY . /var/www/html/
