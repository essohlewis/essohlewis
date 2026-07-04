# TaskFlow — Gestion de tâches (Node.js + Express + MySQL)

Application web complète : inscription/connexion (JWT), CRUD de tâches organisées par statut, recherche, filtres, tri, statistiques, glisser-déposer, mode sombre.

## Structure du projet

```
taskflow/
├── config/db.js               # Connexion MySQL (pool)
├── controllers/                # Logique métier (auth + tâches)
├── middleware/
│   ├── auth.js                 # Vérification du token JWT
│   ├── asyncHandler.js         # Capture automatique des erreurs async
│   ├── errorHandler.js         # Gestionnaire d'erreurs centralisé
│   ├── validators.js           # Règles de validation des entrées
│   └── rateLimiter.js          # Anti brute-force / anti-abus
├── routes/                     # Définition des routes API
├── public/                     # Frontend (HTML/CSS/JS, sans framework)
├── tests/                      # Tests d'intégration (Jest + Supertest)
├── schema.sql                  # Script de création de la base de données
├── server.js                   # Point d'entrée
├── Dockerfile / docker-compose.yml
├── .env.example
└── package.json
```

## Nouveautés — fonctionnalités sociales

TaskFlow intègre désormais une couche **réseau social** :

- **Profils** : chaque utilisateur a une **bio** et un **avatar** (upload image), plus des statistiques publiques (tâches terminées, abonnés, abonnements). L'email n'est visible que sur son propre profil.
- **Suivi + fil d'actualité** : suivre d'autres utilisateurs (follow/unfollow) et consulter un **fil** des activités des personnes suivies (création et complétion de tâches, commentaires).
- **Commentaires + mentions** : fil de **discussion** sur chaque tâche (accessible au propriétaire et aux personnes avec qui elle est partagée), avec **mentions @nom** mises en évidence.
- **Réactions** : réagir à une tâche par emoji (👍 ❤️ 🎉), avec compteurs (toggle).

Ces interactions respectent le partage existant : on ne peut commenter/réagir/voir que les tâches qu'on possède **ou** qui nous ont été partagées. Les compteurs (commentaires, réactions) sont renvoyés par `GET /api/tasks` via des **agrégats groupés** (pas de N+1). Endpoints sous `/api/users/*` et `/api/tasks/:id/{comments,reactions}`.

## Nouveautés v2 — performance

Cette version 2 se concentre sur la **performance** (temps de réponse, bande passante, charge base de données) tout en ajoutant de nouvelles fonctionnalités.

**Sécurité : sessions à refresh token**
- **Token d'accès court** (15 min par défaut) + **refresh token** long (30 j) : si le token d'accès est volé, sa fenêtre d'exploitation est très réduite.
- **Rotation** du refresh token à chaque rafraîchissement (un jeton ne sert qu'une fois) et **stockage haché** (SHA-256) en base — le jeton en clair n'existe que côté client.
- **Révocation** possible : `POST /api/auth/logout` invalide le refresh token (déconnexion réelle côté serveur).
- Côté client, le rafraîchissement est **transparent** : sur un `401`, l'app rejoue automatiquement la requête après avoir renouvelé le token (single-flight pour éviter les rafraîchissements concurrents).

**Backend plus rapide**
- **Recherche FULLTEXT** : la recherche utilise désormais un index `FULLTEXT` MySQL (`MATCH … AGAINST` en mode booléen avec troncature `mot*`) au lieu de `LIKE '%mot%'`, qui ne pouvait pas s'appuyer sur un index et forçait un balayage complet de la table. Repli automatique sur `LIKE` pour les recherches de moins de 3 caractères (limite `innodb_ft_min_token_size`).
- **Cache mémoire des statistiques** par utilisateur (TTL 30 s, invalidé à chaque écriture) : l'agrégat de `/api/tasks/stats` n'est plus recalculé à chaque chargement du tableau. En-tête `X-Cache: HIT|MISS` pour observer le comportement.
- **Compression gzip** (`compression`) de toutes les réponses : payloads JSON et fichiers statiques nettement plus légers.
- **Endpoint groupé** `PATCH /api/tasks/bulk` : déplacer/supprimer jusqu'à 200 tâches en **une seule requête HTTP et une seule requête SQL** (au lieu de N allers-retours).
- **Pool MySQL** : `keep-alive` activé (moins de reconnexions) et taille configurable via `DB_POOL_LIMIT`.

**Nouvelle fonctionnalité : partage de tâches**
- Depuis la fenêtre d'édition, on peut **partager une tâche (en lecture)** avec un autre utilisateur, par son email, et **révoquer** le partage.
- Le destinataire retrouve les tâches partagées dans une vue **« Partagées avec moi »** (bouton dans l'en-tête), avec le nom du propriétaire.
- Sécurité : seul le propriétaire gère les partages ; le modèle de propriété des tâches reste inchangé (le partage est en lecture seule et n'ouvre aucun droit d'écriture). Partages supprimés **en cascade** avec la tâche ou l'utilisateur.

**Nouvelle fonctionnalité : pièces jointes**
- Ajout de **fichiers** à une tâche (jusqu'à 5 Mo, configurable via `MAX_UPLOAD_MB`), avec téléchargement et suppression.
- Stockage sur disque (`uploads/`, hors du dossier public) : les fichiers ne sont **jamais servis en statique**, uniquement via une **route authentifiée** qui vérifie l'appartenance de la tâche. Noms de fichiers aléatoires (anti-collision / anti-path-traversal), nom d'origine conservé en base. Suppression **en cascade** avec la tâche.
- Le compteur de pièces jointes est renvoyé par `GET /api/tasks` (agrégat, sans N+1).

**Nouvelle fonctionnalité : tags colorés + filtre**
- Chaque tag reçoit une **couleur déterministe** ; un filtre « Tous les tags » (alimenté par `GET /api/tasks/tags`) permet de n'afficher qu'un tag.

**Nouvelle fonctionnalité : pagination**
- La liste se charge par pages de 50 (`?limit=&offset=`) avec un bouton **« Charger plus »**. Le bandeau de statistiques est alimenté par `/stats` (exact même en pagination).

**Nouvelle fonctionnalité : édition complète des tâches**
- Bouton **✎** sur chaque carte : une fenêtre modale permet de modifier le **titre, la description, la priorité, le tag et l'échéance** (avant, seul le statut était modifiable depuis l'interface).
- Correction backend : `PUT /api/tasks/:id` distingue désormais « champ absent » (conservé) de « champ à `null` » (effacé) — on peut donc **retirer une échéance** ou vider un tag. Fermeture au clic extérieur / touche `Échap`.

**Nouvelle fonctionnalité : rappels d'échéance**
- Une **cloche de notifications** (avec badge) signale les tâches **en retard** et celles dont **l'échéance approche** (3 jours par défaut).
- Alimentée par `GET /api/tasks/reminders?days=N` (requête indexée, non filtrée) ; l'endpoint est prêt pour un futur envoi par email.

**Nouvelle fonctionnalité : export / import**
- **Export** de toutes ses tâches en **JSON** ou **CSV** (téléchargement authentifié), pour la sauvegarde et la portabilité des données.
- **Import** depuis un fichier JSON (tableau brut ou export `{ tasks: [...] }`) : insertion **multi-lignes en une seule requête**, nettoyage/normalisation côté serveur (valeurs invalides ramenées aux défauts, lignes sans titre ignorées).

**Nouvelle fonctionnalité : sous-tâches (checklist)**
- Chaque tâche peut contenir une **checklist** de sous-tâches cochables, avec un indicateur d'avancement (ex. `2/5`) affiché sur la carte.
- L'avancement provient d'un **agrégat en une seule requête** (pas de N+1) renvoyé directement par `GET /api/tasks` — aucun surcoût par carte.
- La checklist est **chargée à la demande** (au premier dépliage) et se coche en **UI optimiste** (rollback si erreur). Suppression **en cascade** avec la tâche parente.

**Frontend plus réactif**
- **UI optimiste** : le glisser-déposer et le changement de statut mettent à jour l'affichage instantanément (déplacement local de la carte), puis synchronisent avec le serveur en arrière-plan — avec annulation automatique (rollback) en cas d'échec. Fini le rechargement complet du tableau après chaque action.
- **Statistiques calculées côté client** à partir du modèle déjà chargé : plus d'appel réseau `/stats` après chaque action.
- **Sélection multiple + actions groupées** : cases à cocher sur les cartes, barre d'actions pour déplacer ou supprimer plusieurs tâches d'un coup via l'endpoint bulk.

**Nouvelle fonctionnalité : Archivage & Restauration (Soft Delete)**
- La suppression d'une tâche (`DELETE /api/tasks/:id`) ne l'efface plus de la base de données. Elle est marquée comme "archivée" et masquée de l'interface principale.
- Cela prévient toute perte de données accidentelle et conserve l'historique.
- De nouveaux endpoints permettent de lister les tâches archivées (`GET /api/tasks/archived`) et de restaurer une tâche à son état précédent (`POST /api/tasks/:id/restore`).

**Nouvelle fonctionnalité : Journal d'Audit**
- Chaque modification apportée à une tâche (création, mise à jour, changement de statut) est désormais enregistrée dans une table d'audit.
- Un nouvel endpoint `GET /api/tasks/:id/history` permet de consulter l'historique complet des changements pour une tâche donnée, offrant une traçabilité totale.

**Outillage**
- **Intégration continue GitHub Actions** (`.github/workflows/taskflow-ci.yml`) : démarre un MySQL jetable, importe le schéma et lance la suite Jest à chaque push/PR touchant `taskflow/`.
- Nouveaux tests d'intégration : recherche plein texte et actions groupées.

## Nouveautés — étiquettes multiples & vues enregistrées

**Étiquettes multiples** (en plus du `tag` unique historique, conservé) :

- Une tâche peut porter **plusieurs étiquettes** (saisies séparées par des
  virgules à la création et dans la modale d'édition). Dédoublonnage
  insensible à la casse, 40 caractères et 20 étiquettes max.
- Les étiquettes s'affichent en **puces cliquables** sur les cartes : un clic
  **filtre** la liste sur cette étiquette (re-clic pour retirer le filtre), avec
  un indicateur « Étiquette : … ✕ » dans la barre d'outils.
- `GET /api/tasks?label=…` filtre côté serveur (via la table `task_labels`,
  agrégat groupé sans N+1). Chaque tâche renvoyée inclut un tableau `labels`.

**Vues enregistrées** :

- Le bouton **💾 Enregistrer la vue** sauvegarde la **combinaison de filtres/tri
  courante** (recherche, priorité, tag, étiquette, tri) sous un nom.
- Les vues apparaissent en puces : un clic **ré-applique** tous les filtres, la
  croix les supprime. Limite de 30 vues par utilisateur.
- Les filtres sont **assainis côté serveur** (liste blanche de clés/valeurs)
  avant d'être stockés dans une colonne `JSON` : aucun contenu arbitraire.

## Nouveautés — rappels d'échéance automatiques

Le serveur **surveille les échéances** en tâche de fond et prévient
automatiquement, sans action de l'utilisateur :

- Un balayage périodique (par défaut toutes les 15 min, configurable via
  `DUE_REMINDER_INTERVAL_MS`) repère les tâches **en retard** ou **à échéance
  proche** (par défaut ≤ 1 jour, `DUE_REMINDER_DAYS`) qui ne sont ni terminées
  ni archivées.
- Chaque tâche concernée génère une **notification** pour son propriétaire,
  poussée en **temps réel via SSE** et persistée (elle apparaît donc dans la
  cloche de notifications de l'app, comme les autres).
- **Anti-doublon** : une tâche n'est rappelée qu'une fois (`due_reminded_at`).
  Le rappel se **réarme** automatiquement si l'on modifie l'échéance de la tâche.
- Le scheduler ne démarre que lorsqu'on lance réellement le serveur (jamais sous
  Jest) et ses timers sont `unref()` (n'empêchent pas l'arrêt du process).

La logique est isolée dans `utils/dueReminders.js` (`runDueReminderScan`), avec
la fonction de notification injectée → testable sans dépendre du transport SSE.

## Nouveautés — tâches récurrentes

Une tâche peut désormais **se répéter** automatiquement :

- Choix de la récurrence à la création et dans la modale d'édition :
  **quotidienne**, **hebdomadaire** ou **mensuelle** (ou aucune).
- Quand une tâche récurrente **dotée d'une échéance** passe à *Terminée*, la
  **prochaine occurrence** est créée automatiquement (statut *À faire*, échéance
  décalée de l'intervalle, mêmes titre/description/priorité/tag/espace).
- Le calcul de la nouvelle date se fait **côté SQL** (`DATE_ADD`), donc sans
  dérive de fuseau. L'intervalle provient d'une **liste blanche** (`daily` /
  `weekly` / `monthly`) : aucune injection possible.
- Un badge **🔁** signale les tâches récurrentes ; un toast confirme la date de
  la prochaine occurrence lorsqu'elle est générée.

La réponse de `PUT /api/tasks/:id` inclut `next_occurrence` (la tâche créée, ou
`null`). La colonne `recurrence` de `tasks` est créée automatiquement au
démarrage si elle manque.

## Nouveautés — suivi du temps (minuteur)

Chaque tâche dispose désormais d'un **minuteur intégré** (fonctionnalité de type
« time tracking » des apps modernes de gestion de tâches) :

- Bouton **▶ / ⏸** sur la carte pour démarrer / arrêter le chrono.
- Le temps cumulé s'affiche en **HH:MM:SS** et s'incrémente en direct pendant que
  le minuteur tourne (un unique *ticker* global rafraîchit toutes les cartes,
  sans fuite mémoire au re-rendu).
- Le total est **persistant** : on peut arrêter, recharger la page, reprendre.
- Le calcul de la durée est fait **côté serveur** (`TIMESTAMPDIFF` sur l'horloge
  MySQL), donc insensible au fuseau horaire ou à l'horloge du navigateur.
- Démarrage/arrêt **idempotents** ; les actions sont journalisées dans l'audit
  de la tâche (`timer_started` / `timer_stopped`).

Endpoints : `POST /api/tasks/:id/timer/start` et `POST /api/tasks/:id/timer/stop`
(accès en écriture requis, comme la modification d'une tâche). Les colonnes
`time_spent` et `timer_start` de `tasks` sont créées automatiquement au démarrage
si elles manquent.

## Nouveautés de cette version

**Sécurité & robustesse**
- Validation stricte des entrées (`express-validator`) sur toutes les routes
- En-têtes de sécurité HTTP (`helmet`)
- Limiteur de requêtes anti brute-force sur `/auth` (20 tentatives / 15 min) et limiteur général sur `/api`
- Gestionnaire d'erreurs centralisé (plus de try/catch répété dans chaque contrôleur)
- Message de connexion identique en cas d'email inconnu ou de mot de passe erroné (n'expose pas si un compte existe)

**Fonctionnalités**
- Recherche plein texte sur le titre et la description (`GET /api/tasks?search=...`)
- Filtres par priorité et par tag
- Tri : plus récentes, plus anciennes, par échéance, par priorité
- Tags libres sur les tâches (ex : "travail", "perso")
- Route `GET /api/tasks/stats` : total, répartition par statut, tâches en retard, taux de complétion

**Expérience utilisateur**
- Glisser-déposer des tâches entre les colonnes (plus besoin du menu déroulant)
- Notifications toast (fini les `alert()` du navigateur)
- Boîte de confirmation personnalisée avant suppression
- Mise en évidence visuelle des tâches en retard
- Barre de statistiques avec barre de progression
- Mode sombre (persisté dans le navigateur)
- États vides ("Aucune tâche ici") au lieu de colonnes silencieusement vides

**Outillage**
- Tests d'intégration (Jest + Supertest) pour l'authentification et le CRUD des tâches
- Docker Compose (app + MySQL) pour un démarrage en une commande

## Installation

### Option A — avec Docker (le plus rapide)

```bash
docker compose up --build
```

Cela lance MySQL (avec le schéma déjà importé) et l'application. Ouvre **http://localhost:3000**.

⚠️ Change `JWT_SECRET` dans `docker-compose.yml` avant toute mise en production.

### Option B — en local

**1. Prérequis**
- Node.js (v18 ou plus)
- MySQL installé et lancé localement

**2. Installer les dépendances**
```bash
npm install
```

**3. Configurer les variables d'environnement**
```bash
cp .env.example .env
```
Édite `.env` avec tes identifiants MySQL et un `JWT_SECRET` long et aléatoire.

**4. Créer la base de données**

Le plus simple (utilise les identifiants de `.env`, pas besoin du client `mysql`) :
```bash
npm run db:init
```
Ou, si tu préfères le client en ligne de commande :
```bash
mysql -u root -p < schema.sql
```

**5. Lancer le serveur**
```bash
npm start        # production
npm run dev       # développement (redémarrage auto)
```

Ouvre **http://localhost:3000**. Au démarrage, la console indique la cible MySQL
tentée et, en cas d'échec, un conseil précis (identifiants, base absente, serveur arrêté…).

### Dépannage de la connexion MySQL

**`Access denied for user 'root'@'localhost' (using password: YES)`**
→ Le mot de passe de `.env` (`DB_PASSWORD`) ne correspond pas. Vérifie-le :
```bash
mysql -u root -p     # si ça refuse aussi, le problème vient bien du mot de passe
```
- root **sans** mot de passe → laisse `DB_PASSWORD=` (vide) dans `.env`.
- root en `auth_socket` (MySQL 8 sous Linux) → crée un utilisateur dédié :
  ```sql
  -- sudo mysql
  CREATE USER 'taskflow'@'localhost' IDENTIFIED BY 'mon_mot_de_passe';
  GRANT ALL PRIVILEGES ON taskflow.* TO 'taskflow'@'localhost';
  FLUSH PRIVILEGES;
  ```
  puis renseigne `DB_USER=taskflow` / `DB_PASSWORD=mon_mot_de_passe` dans `.env`.

**`ECONNREFUSED 127.0.0.1:3306`** → MySQL n'est pas démarré, ou `DB_HOST`/`DB_PORT` sont faux.

**`Unknown database 'taskflow'` (ER_BAD_DB_ERROR)** → lance `npm run db:init`.

**Aucune envie de configurer MySQL ?** Utilise Docker (tout est câblé) : `docker compose up --build`.

### Migration depuis l'ancienne version

Si tu avais déjà créé la base avant cette mise à jour (sans la colonne `tag`), exécute :
```sql
ALTER TABLE tasks ADD COLUMN tag VARCHAR(40) NULL AFTER priority;
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
```

## Lancer les tests

Les tests utilisent une vraie connexion MySQL (configurée via `.env`). Utilise idéalement une base de test dédiée.

```bash
npm test
```

## Routes API

| Méthode | Route                | Protégée | Description                          |
|---------|------------------------|----------|----------------------------------------|
| POST    | /api/auth/register      | Non      | Créer un compte (renvoie token + refreshToken) |
| POST    | /api/auth/login          | Non      | Se connecter (renvoie token + refreshToken) |
| POST    | /api/auth/refresh        | Non*     | Échanger un refresh token (rotation)   |
| POST    | /api/auth/logout         | Non*     | Révoquer un refresh token              |
| GET     | /api/tasks?search=&priority=&tag=&sort= | Oui | Lister mes tâches (filtrable)  |
| GET     | /api/tasks/stats         | Oui      | Statistiques (total, retard, %) — mises en cache |
| GET     | /api/tasks/reminders?days=N | Oui   | Tâches en retard / échéance proche     |
| GET     | /api/tasks/export?format=json\|csv | Oui | Exporter ses tâches                |
| POST    | /api/tasks/import        | Oui      | Importer des tâches (JSON)             |
| PATCH   | /api/tasks/bulk          | Oui      | Action groupée sur plusieurs tâches    |
| GET     | /api/tasks/:id           | Oui      | Voir une tâche                          |
| POST    | /api/tasks               | Oui      | Créer une tâche                         |
| PUT     | /api/tasks/:id           | Oui      | Modifier une tâche                      |
| DELETE  | /api/tasks/:id           | Oui      | Supprimer une tâche                     |
| GET     | /api/tasks/tags          | Oui      | Tags distincts (avec compteur)         |
| GET     | /api/tasks/shared        | Oui      | Tâches partagées avec moi              |
| GET/POST/DELETE | /api/tasks/:id/shares[/:userId] | Oui | Gérer le partage d'une tâche    |
| GET/POST| /api/tasks/:id/attachments | Oui    | Lister / téléverser une pièce jointe   |
| GET     | /api/tasks/:id/attachments/:aid/download | Oui | Télécharger une pièce jointe |
| DELETE  | /api/tasks/:id/attachments/:aid | Oui | Supprimer une pièce jointe           |
| GET/POST| /api/tasks/:id/comments  | Oui      | Lister / ajouter un commentaire         |
| DELETE  | /api/tasks/:id/comments/:cid | Oui  | Supprimer un commentaire (auteur/proprio) |
| GET/POST| /api/tasks/:id/reactions | Oui      | Réactions (POST = toggle emoji)         |
| GET/PUT | /api/users/me            | Oui      | Mon profil / mise à jour (nom, bio)     |
| POST    | /api/users/me/avatar     | Oui      | Téléverser mon avatar                   |
| GET     | /api/users/:id           | Oui      | Profil public                           |
| GET     | /api/users/:id/avatar    | Non      | Avatar (image)                          |
| POST/DELETE | /api/users/:id/follow | Oui     | Suivre / ne plus suivre                 |
| GET     | /api/users/:id/followers\|following | Oui | Abonnés / abonnements            |
| GET     | /api/users/feed          | Oui      | Fil d'actualité                         |
| GET     | /api/tasks/:id/subtasks  | Oui      | Lister les sous-tâches                   |
| POST    | /api/tasks/:id/subtasks  | Oui      | Ajouter une sous-tâche                   |
| PATCH   | /api/tasks/:id/subtasks/:subId | Oui | Cocher / renommer une sous-tâche      |
| DELETE  | /api/tasks/:id/subtasks/:subId | Oui | Supprimer une sous-tâche              |
| POST    | /api/tasks/:id/timer/start | Oui    | Démarrer le minuteur de la tâche       |
| POST    | /api/tasks/:id/timer/stop  | Oui    | Arrêter le minuteur (cumule le temps)  |
| GET     | /api/tasks?label=…       | Oui      | Filtrer par étiquette multiple          |
| GET/POST| /api/views               | Oui      | Lister / créer une vue enregistrée      |
| DELETE  | /api/views/:id           | Oui      | Supprimer une vue enregistrée           |

`sort` accepte : `recent` (défaut), `ancien`, `echeance`, `priorite`.

Chaque tâche renvoyée par `GET /api/tasks` inclut `subtasks_total`, `subtasks_done`,
`labels` (tableau d'étiquettes), `recurrence` (`daily`/`weekly`/`monthly` ou
`null`), ainsi que `time_spent` (secondes cumulées) et `timer_elapsed` (secondes
du minuteur en cours, 0 si à l'arrêt). `POST`/`PUT /api/tasks` acceptent les
champs `recurrence` et `labels` (tableau).

\* `/refresh` et `/logout` ne nécessitent pas de token d'accès, mais un `refreshToken` valide dans le corps :
```json
{ "refreshToken": "…" }
```

**`PATCH /api/tasks/bulk`** — corps attendu :
```json
{ "ids": [1, 2, 3], "action": "status", "value": "terminee" }
```
`action` vaut `status` (avec `value` = statut), `priority` (avec `value` = priorité) ou `delete` (sans `value`). Jusqu'à 200 ids par appel. Réponse : `{ "affected": 3 }`.

### Migration depuis la v1

Ajoute l'index FULLTEXT et la table des sous-tâches :
```sql
CREATE FULLTEXT INDEX idx_tasks_fulltext ON tasks(title, description);

CREATE TABLE IF NOT EXISTS subtasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  done TINYINT(1) NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
CREATE INDEX idx_subtasks_task ON subtasks(task_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_refresh_token_hash (token_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
```

Pour la couche sociale (profils, suivi, commentaires, réactions), le plus simple
est de **rejouer `schema.sql`** (toutes les instructions sont idempotentes) via
`npm run db:init`, ou d'appliquer :
```sql
ALTER TABLE users ADD COLUMN bio VARCHAR(500) NULL, ADD COLUMN avatar VARCHAR(255) NULL;
-- + tables follows / activities / comments / reactions (voir schema.sql)
```

## Pistes d'amélioration futures

- Pagination / défilement infini sur la liste des tâches
- Pièces jointes sur les tâches
- Notifications par email pour les échéances proches
- Partage de tâches entre utilisateurs (équipes)
