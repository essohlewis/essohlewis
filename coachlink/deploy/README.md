# CoachLink CI — Kit de déploiement HTTPS

Déploiement **clé-en-main** en production (HTTPS, secrets hors dépôt). Voir aussi
le guide détaillé `../DEPLOIEMENT.md`.

## Contenu

| Fichier | Rôle |
|---------|------|
| `config.production.php` | Configuration de prod (lit les secrets depuis l'environnement) — copiée en `api/config/config.php` |
| `coachlink.env.example` | Modèle du fichier de secrets/paramètres (→ `api/config/coachlink.env`, chmod 600) |
| `setup.sh` | Génère le `jwt_secret`, installe config + env + `js/config.js`, permissions, migration |
| `apache/coachlink.conf` | VirtualHost Apache 2.4 (HTTPS, réécriture, sécurité) |
| `nginx/coachlink.conf` | Server block Nginx + PHP-FPM (HTTPS) |
| `install-server.sh` | Provisionnement serveur (paquets, config, certbot) — à lancer en root |
| `gen-cert-dev.sh` | Certificat auto-signé pour tester HTTPS **en local** |
| `rehearsal-router.php` | Rejoue le routage même-origine (front + `/api`) avec `php -S` |

## Mise en production — étapes

```bash
# 1. Sur le serveur, en root : paquets + serveur web + HTTPS
sudo DOMAIN=coachlink.ci SERVER=nginx WEBROOT=/var/www/coachlink \
     deploy/install-server.sh

# 2. Secrets + configuration + base
deploy/setup.sh --migrate
nano api/config/coachlink.env      # domaine, mot de passe MySQL, intégrations

# 3. Front en mode API : décommentez dans index.html
#    <script src="js/config.js"></script>

# 4. Vérifications
curl https://coachlink.ci/api/ping
```

Puis **changez le mot de passe admin** (`admin@coachlink.ci` / `admin123`) et
activez les intégrations dans `coachlink.env` (voir `../DEPLOIEMENT.md` §7).

## Où vivent les secrets

Uniquement dans **`api/config/coachlink.env`** (chmod 600, **ignoré par git**).
`config.production.php` les lit via l'environnement. Rien de sensible n'est
versionné ; seuls les fichiers `*.example` le sont.

## Tester HTTPS en local (répétition)

```bash
deploy/setup.sh --sqlite --migrate --force        # config + base SQLite de test
deploy/gen-cert-dev.sh                             # certificat auto-signé
# Front + API même origine (HTTP) :
php -S 127.0.0.1:8080 deploy/rehearsal-router.php
# → http://127.0.0.1:8080/  et  http://127.0.0.1:8080/api/ping
```

> Le certificat auto-signé sert **au test uniquement**. En production, le
> certificat est fourni et renouvelé automatiquement par **certbot**
> (Let's Encrypt), branché par `install-server.sh`.
