# CoachLink CI — Guide de déploiement en production

Ce guide décrit la mise en ligne de **CoachLink CI** (front statique + API PHP)
sur un serveur, en **HTTPS**, avec activation progressive des intégrations
(Mobile Money, email, connexion sociale).

> **Voie rapide (automatisée)** : le dossier **`deploy/`** fournit un kit
> clé-en-main — configs Apache/Nginx, provisionnement (`install-server.sh`),
> génération des secrets + config (`setup.sh`), et une répétition HTTPS locale.
> Voir **`deploy/README.md`**. Le présent document en donne le détail complet.

> Rien de secret n'est versionné : tous les identifiants vivent dans
> `api/config/config.php` (ignoré par git) et `js/config.js` (ignoré par git).

---

## 1. Prérequis serveur

- **PHP 8.1+** avec extensions : `pdo`, `pdo_mysql`, `json`, `mbstring`,
  `curl` (intégrations), `fileinfo` (uploads), `openssl`.
- **MySQL 5.7+ / MariaDB** (production). SQLite convient au test uniquement.
- **HTTPS obligatoire** (JWT, Mobile Money, OAuth). Certificat Let's Encrypt.
- Apache 2.4 (avec `mod_rewrite`) **ou** Nginx + PHP-FPM.

---

## 2. Récupération et arborescence

```bash
git clone <votre-dépôt> /var/www/coachlink
cd /var/www/coachlink/coachlink
```

Deux dossiers à servir :
- le **front** (racine `coachlink/` : `index.html`, `css/`, `js/`, `assets/`…),
- l'**API** (`coachlink/api/`).

Recommandé : **même domaine**, l'API sous `/api`
(front `https://coachlink.ci`, API `https://coachlink.ci/api`). Cela simplifie
CORS (même origine) et les URLs.

---

## 3. Base de données (MySQL)

```bash
mysql -u root -p -e "CREATE DATABASE coachlink CHARACTER SET utf8mb4;"
mysql -u root -p -e "CREATE USER 'coachlink'@'localhost' IDENTIFIED BY 'motDePasseFort';
GRANT ALL PRIVILEGES ON coachlink.* TO 'coachlink'@'localhost'; FLUSH PRIVILEGES;"
```

Configurez `api/config/config.php` (voir §4) puis créez le schéma + les données :

```bash
cd api
php database/migrate.php     # crée les tables + admin + 12 coachs de démo
```

> `migrate.php` utilise le pilote défini dans `config.php`. En MySQL, adaptez
> les identifiants du bloc `db`.

---

## 4. Configuration de l'API (`api/config/config.php`)

```bash
cp api/config/config.example.php api/config/config.php
# puis éditez les valeurs
```

**Checklist minimale de production :**

| Clé | À faire |
|-----|---------|
| `db` | pilote `mysql` + hôte/nom/user/password réels |
| `jwt_secret` | **remplacer** par une longue chaîne aléatoire (`openssl rand -hex 32`) |
| `cors_origins` | **restreindre** à votre domaine : `['https://coachlink.ci']` |
| `uploads_url` | `/api/uploads` (Apache) — voir note uploads du README API |
| `cache_dir` | un dossier **inscriptible, hors racine web** (rate-limit, mails log) |
| `rate_limit` | garder ou ajuster (`global`, `auth`) |

**Compte admin par défaut** : `admin@coachlink.ci` / `admin123` →
**changez le mot de passe** dès la première connexion.

Activez les intégrations quand vous avez les identifiants (voir §7) :
`paiement.mode='reel'`, `mail.mode='smtp'`, `oauth.<reseau>.actif=true`.

---

## 5. Configuration du front (`js/config.js`)

Par défaut le front est en **mode démonstration** (hors-ligne). Pour le brancher
sur l'API :

```bash
cp js/config.example.js js/config.js
```

`js/config.js` (même domaine, API sous `/api`) :
```js
window.CL_CONFIG = { apiBase: "/api", apiActif: true };
```

Puis **décommentez** dans `index.html` (avant `apiService.js`) :
```html
<script src="js/config.js"></script>
```

---

## 6. Serveur web + HTTPS

### Option A — Apache

Le fichier `api/.htaccess` réécrit déjà tout vers `index.php`. Exemple de
*virtual host* :

```apache
<VirtualHost *:443>
    ServerName coachlink.ci
    DocumentRoot /var/www/coachlink/coachlink

    <Directory /var/www/coachlink/coachlink>
        AllowOverride All
        Require all granted
        Options -Indexes           # désactive le listing de répertoires
    </Directory>

    # Certificat Let's Encrypt
    SSLEngine on
    SSLCertificateFile      /etc/letsencrypt/live/coachlink.ci/fullchain.pem
    SSLCertificateKeyFile   /etc/letsencrypt/live/coachlink.ci/privkey.pem
</VirtualHost>

# Redirection HTTP → HTTPS
<VirtualHost *:80>
    ServerName coachlink.ci
    Redirect permanent / https://coachlink.ci/
</VirtualHost>
```

```bash
a2enmod rewrite ssl headers
apachectl configtest && systemctl reload apache2
```

### Option B — Nginx + PHP-FPM

```nginx
server {
    listen 443 ssl;
    server_name coachlink.ci;
    root /var/www/coachlink/coachlink;
    index index.html;

    ssl_certificate     /etc/letsencrypt/live/coachlink.ci/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/coachlink.ci/privkey.pem;

    # Front (SPA) : sert les fichiers statiques.
    location / { try_files $uri $uri/ /index.html; }

    # API : tout /api/* passe par le front controller PHP.
    location /api/ {
        try_files $uri /api/index.php$is_args$args;
    }
    location ~ ^/api/index\.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    # Fichiers téléversés servis directement.
    location /api/uploads/ { }

    # Ne jamais exposer la config ni la base SQLite.
    location ~* /api/(config|database)/ { deny all; }
}

server {   # HTTP → HTTPS
    listen 80; server_name coachlink.ci;
    return 301 https://$host$request_uri;
}
```

### Certificat HTTPS (Let's Encrypt)
```bash
sudo certbot --apache -d coachlink.ci        # ou : --nginx
```

---

## 7. Activer les intégrations (quand vous avez les identifiants)

Toutes sont **désactivées par défaut** (simulateur / mode démo). Le passage en
réel se fait **uniquement dans `config.php`**, sans toucher au code.

- **Mobile Money** — `paiement.mode = 'reel'` puis, par opérateur,
  `paiement.<orange|wave|mtn|moov>.actif = true` + identifiants marchands.
  Renseignez `paiement.callback_url` (URL HTTPS publique) et
  `paiement.callback_secret` ; déclarez le webhook `/api/paiements/callback`
  chez l'opérateur.
- **Email** — `mail.mode = 'smtp'` + `mail.smtp` (host/port/chiffrement/user/
  password) + `mail.app_url = 'https://coachlink.ci'` (liens des emails).
- **Connexion sociale** — `oauth.<facebook|linkedin>.actif = true` +
  `client_id`/`client_secret`, `oauth.redirect_base = 'https://coachlink.ci/api'`,
  `oauth.front_url = 'https://coachlink.ci'`. Déclarez le *redirect URI*
  `https://coachlink.ci/api/auth/oauth/<reseau>/callback` chez le fournisseur.

---

## 8. Checklist de sécurité (avant ouverture)

- [ ] `jwt_secret` remplacé par une valeur aléatoire longue.
- [ ] Mot de passe **admin** changé.
- [ ] `cors_origins` restreint à votre domaine.
- [ ] **HTTPS** actif + redirection HTTP→HTTPS.
- [ ] Listing de répertoires **désactivé** (`Options -Indexes` / Nginx).
- [ ] `config/config.php`, `database/*.sqlite`, `uploads/` **non listables**
      publiquement (règles §6).
- [ ] `uploads/` **inscriptible** par le serveur web, `cache_dir` inscriptible.
- [ ] Permissions : code en lecture seule pour le serveur, écriture limitée à
      `uploads/` et `cache_dir`.
- [ ] Sauvegardes régulières de la base + du dossier `uploads/`.

---

## 9. Vérification post-déploiement

```bash
# API vivante
curl https://coachlink.ci/api/ping
# En-têtes de sécurité présents
curl -sI https://coachlink.ci/api/ping | grep -iE "content-security|x-frame|x-content-type"
```

Dans le navigateur : ouvrez `https://coachlink.ci`, créez un compte, réservez et
payez (simulateur tant que Mobile Money n'est pas activé), vérifiez la
messagerie et les notifications.

---

## 10. Maintenance

- **Mises à jour** : `git pull` puis, si le schéma a changé, `php database/migrate.php`
  (idempotent — n'efface pas les données existantes).
- **Journalisation** : surveillez les logs Apache/Nginx et PHP-FPM.
- **Tests** avant déploiement : `cd api && composer install && composer test`
  (voir README API §7), et la CI GitHub Actions valide chaque push.
