# Pronos — plateforme de pronostics sportifs (Afrique de l'Ouest)

Plateforme sociale où des pronostiqueurs bâtissent une réputation vérifiable et
vendent l'accès à leurs pronostics par abonnement mensuel, la plateforme prenant
une commission. Phase 1 (MVP) : foot, Côte d'Ivoire.

## Monorepo

| Dossier | Rôle | Stack | État |
|---|---|---|---|
| [`backend/`](backend/) | API + logique métier | Laravel 13 / PHP 8.4 / Sanctum | ✅ MVP fonctionnel, testé |
| [`frontend/`](frontend/) | Web app (classement, profil, wallet, abonnement) | React 18 / Vite | ✅ Fonctionnel |
| [`docs/`](docs/) | Architecture technique | — | ✅ |

Mobile (Expo) : prévu en Phase 2.

## Démarrage rapide

**Backend** (port 8000)
```bash
cd backend
cp .env.example .env && composer install && php artisan key:generate
touch database/database.sqlite && php artisan migrate --seed
php artisan serve
```

**Frontend** (port 5173, proxifie `/api` vers le backend)
```bash
cd frontend
npm install
npm run dev
```

Ouvre http://127.0.0.1:5173. Le seed crée un pronostiqueur noté et des matchs.
Connexion de démo : téléphone `+2250700000002` (le code OTP s'affiche en dev).

## Principes de conception

Trois invariants gouvernent tout le code — détails dans
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) :

1. **Track record immuable** — un pronostic ne peut être ni modifié ni supprimé
   après le coup d'envoi. Aucune route d'écriture ne l'autorise.
2. **Argent traçable** — chaque mouvement est une écriture de ledger idempotente,
   sous verrou, jamais négative. Wallet prépayé + Mobile Money par webhooks signés.
3. **Rôles séparés** — un même utilisateur peut être consommateur et/ou
   pronostiqueur ; les capacités découlent d'un statut vérifié, pas d'un booléen.

## Tests

```bash
cd backend && php artisan test     # invariants critiques couverts
cd frontend && npm run build       # build de production
```

## Conformité

La plateforme **ne prend aucun pari** : elle vend un service d'information. Cette
frontière (réglementation des jeux, LONACI, 18+) doit être validée juridiquement
avant toute mise en production — voir la section Sécurité de l'architecture.
