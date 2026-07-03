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

## Nouveautés v2 — performance

Cette version 2 se concentre sur la **performance** (temps de réponse, bande passante, charge base de données) tout en ajoutant de nouvelles fonctionnalités.

**Backend plus rapide**
- **Recherche FULLTEXT** : la recherche utilise désormais un index `FULLTEXT` MySQL (`MATCH … AGAINST` en mode booléen avec troncature `mot*`) au lieu de `LIKE '%mot%'`, qui ne pouvait pas s'appuyer sur un index et forçait un balayage complet de la table. Repli automatique sur `LIKE` pour les recherches de moins de 3 caractères (limite `innodb_ft_min_token_size`).
- **Cache mémoire des statistiques** par utilisateur (TTL 30 s, invalidé à chaque écriture) : l'agrégat de `/api/tasks/stats` n'est plus recalculé à chaque chargement du tableau. En-tête `X-Cache: HIT|MISS` pour observer le comportement.
- **Compression gzip** (`compression`) de toutes les réponses : payloads JSON et fichiers statiques nettement plus légers.
- **Endpoint groupé** `PATCH /api/tasks/bulk` : déplacer/supprimer jusqu'à 200 tâches en **une seule requête HTTP et une seule requête SQL** (au lieu de N allers-retours).
- **Pool MySQL** : `keep-alive` activé (moins de reconnexions) et taille configurable via `DB_POOL_LIMIT`.

**Frontend plus réactif**
- **UI optimiste** : le glisser-déposer et le changement de statut mettent à jour l'affichage instantanément (déplacement local de la carte), puis synchronisent avec le serveur en arrière-plan — avec annulation automatique (rollback) en cas d'échec. Fini le rechargement complet du tableau après chaque action.
- **Statistiques calculées côté client** à partir du modèle déjà chargé : plus d'appel réseau `/stats` après chaque action.
- **Sélection multiple + actions groupées** : cases à cocher sur les cartes, barre d'actions pour déplacer ou supprimer plusieurs tâches d'un coup via l'endpoint bulk.

**Outillage**
- **Intégration continue GitHub Actions** (`.github/workflows/taskflow-ci.yml`) : démarre un MySQL jetable, importe le schéma et lance la suite Jest à chaque push/PR touchant `taskflow/`.
- Nouveaux tests d'intégration : recherche plein texte et actions groupées.

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

**3. Créer la base de données**
```bash
mysql -u root -p < schema.sql
```

**4. Configurer les variables d'environnement**
```bash
cp .env.example .env
```
Édite `.env` avec tes identifiants MySQL et un `JWT_SECRET` long et aléatoire.

**5. Lancer le serveur**
```bash
npm start        # production
npm run dev       # développement (redémarrage auto)
```

Ouvre **http://localhost:3000**.

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
| POST    | /api/auth/register      | Non      | Créer un compte                        |
| POST    | /api/auth/login          | Non      | Se connecter                            |
| GET     | /api/tasks?search=&priority=&tag=&sort= | Oui | Lister mes tâches (filtrable)  |
| GET     | /api/tasks/stats         | Oui      | Statistiques (total, retard, %) — mises en cache |
| PATCH   | /api/tasks/bulk          | Oui      | Action groupée sur plusieurs tâches    |
| GET     | /api/tasks/:id           | Oui      | Voir une tâche                          |
| POST    | /api/tasks               | Oui      | Créer une tâche                         |
| PUT     | /api/tasks/:id           | Oui      | Modifier une tâche                      |
| DELETE  | /api/tasks/:id           | Oui      | Supprimer une tâche                     |

`sort` accepte : `recent` (défaut), `ancien`, `echeance`, `priorite`.

**`PATCH /api/tasks/bulk`** — corps attendu :
```json
{ "ids": [1, 2, 3], "action": "status", "value": "terminee" }
```
`action` vaut `status` (avec `value` = statut), `priority` (avec `value` = priorité) ou `delete` (sans `value`). Jusqu'à 200 ids par appel. Réponse : `{ "affected": 3 }`.

### Migration depuis la v1

Ajoute l'index FULLTEXT nécessaire à la recherche indexée :
```sql
CREATE FULLTEXT INDEX idx_tasks_fulltext ON tasks(title, description);
```

## Pistes d'amélioration futures

- Pagination / défilement infini sur la liste des tâches
- Refresh token / expiration glissante de session
- Sous-tâches et pièces jointes
- Notifications par email pour les échéances proches
- Partage de tâches entre utilisateurs (équipes)
