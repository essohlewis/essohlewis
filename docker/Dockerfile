# ─────────────────────────────────────────────────────────────
# Transouscris — image applicative (PHP 8.2 + Apache)
# ─────────────────────────────────────────────────────────────
FROM php:8.2-apache

# Extensions requises par l'application (curl, openssl, json, pdo sont déjà
# fournis par l'image officielle ; on ajoute pdo_mysql).
RUN docker-php-ext-install pdo_mysql \
    && a2enmod rewrite headers

# Le document root pointe vers public/ (seul dossier exposé).
COPY docker/vhost.conf /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html

# Code applicatif (également monté en volume en développement via compose).
COPY . /var/www/html

# Dossiers d'exécution accessibles en écriture par Apache.
RUN mkdir -p storage/logs storage/cache \
    && chown -R www-data:www-data storage

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80
ENTRYPOINT ["entrypoint.sh"]
CMD ["apache2-foreground"]
