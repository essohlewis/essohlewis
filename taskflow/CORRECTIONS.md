# Corrections apportées à TaskFlow

Analyse du projet (Node.js / Express / MySQL, avec un frontend statique dans
`public/` et un frontend Next.js dans `frontend/`) et corrections des anomalies
trouvées. Résumé ci-dessous, du plus impactant au plus mineur.

---

## 1. `Dockerfile` — mauvais runtime (bloquant en déploiement)

**Problème.** Le `Dockerfile` était basé sur `php:8.2-apache` et le couple
`.htaccess` / `router.php` routait toutes les requêtes vers un `index.php`… qui
n'existe pas dans le dépôt. L'application est en réalité une app **Node.js**
(`server.js` + `package.json`). Résultat : `docker compose up` démarrait un
serveur Apache/PHP incapable de servir l'application (le README annonce pourtant
« Node.js + Express + MySQL »).

**Correction.** Réécriture du `Dockerfile` en image **Node 20** :
`npm ci --omit=dev`, copie du code, création de `uploads/` et `logs/`, exécution
en utilisateur non-root (`node`), `CMD ["node", "server.js"]`.

## 2. `docker-compose.yml` — port privilégié incompatible avec l'utilisateur non-root

**Problème.** Le service `app` fixait `PORT: 80`. Comme le conteneur tourne
désormais en utilisateur non-root, écouter sur le port 80 (privilégié, < 1024)
échouerait.

**Correction.** `PORT: 3000` et mapping `3000:3000`.

## 3. `controllers/tenantController.js` — double `conn.release()` + transaction non annulée

**Problème.** Dans `createTenant`, lorsque le slug existe déjà, le code appelait
`conn.release()` puis `return`. Or le bloc `finally` appelle **aussi**
`conn.release()` : la même connexion du pool était donc **libérée deux fois**, et
la transaction ouverte (`beginTransaction`) n'était jamais annulée avant d'être
rendue au pool — ce qui peut corrompre l'état du pool et polluer la prochaine
requête qui réutilise cette connexion.

**Correction.** Remplacement du `conn.release()` prématuré par un
`await conn.rollback()` ; la libération est laissée au `finally` (une seule fois).

## 4. `controllers/taskController.js` — cache de stats jamais invalidé en contexte « organisation » (tenant)

**Problème.** La clé du cache de `/api/tasks/stats` incluait un préfixe
`tenant_<id>_` en **lecture**, mais l'**invalidation** (après création /
modification / suppression) utilisait des clés sans ce préfixe
(`userId_personal`, `userId_<workspaceId>`). En contexte tenant, la clé écrite et
la clé invalidée ne correspondaient donc jamais : les statistiques restaient
**périmées** jusqu'à 30 s après chaque écriture.

**Correction.** Introduction d'un unique helper `statsCacheKey(userId, tenantId,
workspaceId)` utilisé à la fois par `getStats` et par **toutes** les
invalidations (create / update / delete / restore / bulk / import).

## 5. `controllers/taskController.js` — `importTasks` n'enregistrait pas `tenant_id`

**Problème.** L'`INSERT` de l'import omettait la colonne `tenant_id`. Les tâches
importées depuis une organisation étaient donc créées avec `tenant_id = NULL` et
**n'apparaissaient jamais** dans la liste (`getTasks` filtre sur `tenant_id = ?`).

**Correction.** Ajout de `tenant_id` (issu de `req.tenantId`) à l'`INSERT`
d'import, comme le fait déjà `createTask`.

## 6. `controllers/taskController.js` — `getReminders` incluait les tâches archivées

**Problème.** La requête des rappels ne filtrait pas `is_archived`, donc une
tâche archivée mais toujours dotée d'une échéance continuait à générer des
rappels « en retard ». La condition espace/personnel manquait aussi de
parenthèses explicites.

**Correction.** Ajout de `AND t.is_archived = false` et parenthésage explicite de
la condition `(user_id perso) OR (espaces rejoints)`.

## 7. Répertoire parasite supprimé

Un dossier `{config,routes,controllers,middleware,public` (avec des
sous-dossiers `css,public` / `js}`) traînait à la racine : c'est le résultat d'un
`mkdir -p {config,routes,...}` exécuté dans un shell qui ne gère pas l'expansion
d'accolades. Répertoire vide et sans usage → supprimé.

---

## 8. Nettoyage du code mort (2ᵉ passe)

Suppression des fichiers inertes qui n'étaient jamais chargés par l'application
Node mais entretenaient la confusion (et auraient planté s'ils avaient été
importés, faute de dépendances). Vérifié au préalable : aucun `require` de l'app
ne pointe vers eux, et aucun code JS/JSON ne référence les fichiers PHP.

**Restes de l'ancienne implémentation PHP (remplacée par Node) :**
- `app/Core/*.php` (JWT, Middleware, Request, Response, Router)
- `app/Middleware/*.php` (Cors, RateLimiter)
- `config/db.php`
- `router.php`
- `.htaccess`

**Modules JS orphelins référençant des dépendances absentes de `package.json` :**
- `config/pgDb.js` (`pg`) — l'app utilise MySQL via `config/db.js`
- `utils/logger.js` (`winston`)
- `utils/schemas.js` (`joi`)
- `middleware/requestLogger.js` et `middleware/joiValidator.js`
- `utils/cache.js` (`redis`, de surcroît configuré avec l'API v3) — le cache de
  stats en mémoire (`middleware/statsCache.js`) reste le seul mécanisme utilisé.

**Conséquence sur `package.json` :** la dépendance `redis` (dont `utils/cache.js`
était le seul consommateur) a été retirée. Le projet est désormais **100 % Node**
et cohérent : toutes les dépendances déclarées sont réellement utilisées, et tous
les modules présents sont réellement chargeables.

> Note : `MIGRATION.md` mentionne encore des dépendances jamais installées
> (`winston`, `joi`, `socket.io`, `swagger-*`, `uuid`) — c'est de la
> documentation d'un plan d'évolution, laissée telle quelle.
