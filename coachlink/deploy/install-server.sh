#!/usr/bin/env bash
# ==========================================================================
# deploy/install-server.sh — Provisionnement serveur (Debian/Ubuntu).
# Installe PHP + le serveur web choisi, déploie les configs, prépare HTTPS.
#
# À exécuter EN ROOT sur le serveur cible (pas dans un conteneur de dev).
#
# Usage :
#   sudo DOMAIN=coachlink.ci WEBROOT=/var/www/coachlink SERVER=nginx \
#        deploy/install-server.sh
#   Variables : DOMAIN (requis), WEBROOT (défaut /var/www/coachlink),
#               SERVER=apache|nginx (défaut nginx), PHP=8.2
# ==========================================================================
set -euo pipefail
[[ "$(id -u)" -eq 0 ]] || { echo "À lancer en root (sudo)." >&2; exit 1; }

DOMAIN="${DOMAIN:?Définissez DOMAIN=votre-domaine}"
WEBROOT="${WEBROOT:-/var/www/coachlink}"
SERVER="${SERVER:-nginx}"
PHP="${PHP:-8.2}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "→ Domaine=$DOMAIN  Webroot=$WEBROOT  Serveur=$SERVER  PHP=$PHP"

apt-get update -y
apt-get install -y "php${PHP}-cli" "php${PHP}-mysql" "php${PHP}-mbstring" \
  "php${PHP}-curl" "php${PHP}-xml" unzip certbot

if [[ "$SERVER" == "apache" ]]; then
  apt-get install -y apache2 "libapache2-mod-php${PHP}" python3-certbot-apache
  a2enmod rewrite ssl headers
  sed "s#coachlink.ci#$DOMAIN#g; s#/var/www/coachlink#$WEBROOT#g" \
      "$HERE/apache/coachlink.conf" > /etc/apache2/sites-available/coachlink.conf
  a2ensite coachlink && systemctl reload apache2
  certbot --apache -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" || \
    echo "⚠ certbot : lancez-le manuellement une fois le DNS pointé."
else
  apt-get install -y nginx "php${PHP}-fpm" python3-certbot-nginx
  sed "s#coachlink.ci#$DOMAIN#g; s#/var/www/coachlink#$WEBROOT#g; s#php8.2-fpm#php${PHP}-fpm#g" \
      "$HERE/nginx/coachlink.conf" > /etc/nginx/sites-available/coachlink
  ln -sf /etc/nginx/sites-available/coachlink /etc/nginx/sites-enabled/coachlink
  nginx -t && systemctl reload nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "admin@$DOMAIN" || \
    echo "⚠ certbot : lancez-le manuellement une fois le DNS pointé."
fi

# Permissions : le serveur web écrit dans uploads/ et le cache.
chown -R www-data:www-data "$WEBROOT/coachlink/api/uploads" 2>/dev/null || true
echo "✓ Serveur configuré. Exécutez ensuite deploy/setup.sh (secrets + config + migration)."
