# 💞 Amoura — Feuille de route des améliorations

**Plan d'amélioration continue de la plateforme**
Version : 1.0 · Date : 26 juillet 2026 · Portée : améliorations livrées + backlog priorisé

> Légende — **Impact** : 🟢 Faible · 🟡 Moyen · 🔴 Élevé | **Effort** : S (≤2 j) · M (≤1 sem) · L (2–3 sem) · XL (>1 mois) | **Priorité** : P0 (critique) → P3 (confort)

---

## 1. Améliorations livrées dans cette itération ✅

Ces améliorations issues des Phases 1 & 2 de la feuille de route produit ont été
**implémentées et testées** (suite passée à 90 tests / 216 assertions).

| Amélioration | Axe | Détail | Vérification |
|---|---|---|---|
| **Recommandations par affinité** | Produit / UX | `Services\Recommender` classe la découverte : intérêts partagés, proximité (distance ou ville/pays), proximité d'âge, présence en ligne, activité récente, badge vérifié. | 7 tests unitaires + 1 test d'intégration |
| **Purge planifiée (cron)** | Fiabilité | `Services\Maintenance` + `scripts/cron.php` : suppression des statuts expirés, jetons OTP, sessions, rate-limits, notifications & messages anciens. | 1 test d'intégration (purge sélective) |
| **Journalisation structurée** | Observabilité | `Services\Logger` écrit des lignes JSON exploitables (ELK/Loki) ; branché sur le gestionnaire d'erreurs global et le cron. | 2 tests unitaires |
| **PWA installable + hors-ligne** | UX / Mobile | `manifest.webmanifest`, `service-worker.js` (cache-first assets, network-first API, repli `offline.html`), icônes 192/512, enregistrement auto. | Smoke test HTTP (200 sur tous les fichiers) |
| **Serveur de dev correct** | DevEx | `server.php` sert les fichiers statiques + PWA en développement (les assets ne partaient plus en 404 hors Apache). | Smoke test (assets 200) |
| **CI/CD (GitHub Actions)** | DevEx | `.github/workflows/amoura-ci.yml` : lint PHP + tests unitaires & d'intégration (service MySQL) à chaque push/PR. | Workflow validé (yaml + étapes) |
| **Index & requêtes optimisés** | Performance | Nouveaux index composites (matchs, swipes, stories, posts) + réécriture `forUser` en UNION (2 lookups indexés au lieu d'un scan). Vérifié via `EXPLAIN`. | EXPLAIN + tests d'intégration |
| **Migrations versionnées** | DevEx | `database/migrations/` + runner (`migrate` / `--fresh` baseline / `status`) suivi dans `schema_migrations`. | Testé (fresh + BDD existante) |
| **Signature webhook PayPal** | Sécurité | `verifyWebhookSignature` via l'API `/v1/notifications/verify-webhook-signature` (fail-closed). | 1 test unit + 2 intégration |
| **CSP par nonce** | Sécurité | Suppression de `'unsafe-inline'` (scripts) : nonce par requête + délégation d'événements (`ui.js`, 17 handlers migrés). | Smoke test (nonce en-tête = balises) |
| **« Qui a vu mon profil »** | UX / Monétisation | Table `profile_views`, suivi des visites, page `/visitors` (liste floutée hors Premium). | 3 tests d'intégration |
| **i18n FR/EN** | UX | `Core\I18n` + fichiers de langue + helper `t()` + détection cookie/Accept-Language + sélecteur de langue ; nav/accueil/connexion traduits. | 5 tests unitaires |
| **Onboarding guidé** | UX | Carte de complétion de profil (étapes cochables) sur la découverte tant que < 100 %. | Smoke test (rendu) |
| **Notifications Web Push** | UX / Engagement | VAPID + abonnements (`push_subscriptions`), service worker (`push`/`notificationclick`), `PushService` (dégradation gracieuse), câblé aux messages. | 1 intégration + envoi vérifié |
| **Cache Redis** | Performance / Scale | Abstraction `Core\Cache` (Redis + repli mémoire), réglages CMS mis en cache, **sessions partagées** (handler Redis), **rate-limiter distribué** (INCR atomique). | 5 unit + 3 intégration (Redis réel) |
| **Clustering WebSocket** | Scale | Bus pub/sub (`websocket/Bus` : Redis via clue/redis-react + repli local mono-instance) ; le serveur relaie les messages entre instances. | Boot vérifié (local + Redis) |
| **Modération IA v1** | Confiance | `Services\Moderation\ContentModerator` (interface `Moderator` échangeable) : coordonnées, arnaques, harcèlement, sollicitation, spam → score + action ; publications à risque bloquées ou mises en file de revue. | 8 unit + 2 intégration + E2E |
| **2FA (TOTP)** | Sécurité | `Core\Security\Totp` conforme RFC 6238 (Google Authenticator/Authy) : configuration, activation, connexion en deux étapes, désactivation par mot de passe. | 7 unit + 1 intégration + E2E |
| **Révocation de sessions** | Sécurité | « Déconnecter partout » via `sessions_valid_after` (comparaison stricte) ; la session courante est préservée. | 2 intégration + E2E (2 sessions) |
| **Achats à l'unité** | Monétisation | Catalogue `products` + portefeuille `user_credits` (débit atomique) ; Boost (ordre de découverte), Super Like (gating), Reveal (déblocage 24 h). Paiement → `Fulfillment` crédite (idempotent). | 3 intégration + E2E |
| **Dunning (relances)** | Monétisation | `Services\Billing\Dunning` (cron) : rappel J-3 → `past_due` à l'échéance → `expired` après grâce, avec notifications. | 4 tests d'intégration |

---

## 2. Backlog d'améliorations priorisé

### 2.1 🔒 Sécurité & conformité

| Amélioration | Impact | Effort | Priorité |
|---|---|---|---|
| ~~Nonces CSP + suppression des handlers inline~~ | 🔴 | L | ✅ **Livré** |
| ~~Vérification de signature webhook PayPal~~ | 🔴 | M | ✅ **Livré** |
| ~~Authentification à deux facteurs (2FA) optionnelle~~ | 🟡 | M | ✅ **Livré** |
| ~~Rotation & révocation de sessions (« déconnecter partout »)~~ | 🟡 | S | ✅ **Livré** |
| Chiffrement au repos des messages sensibles | 🟡 | L | P2 |
| Détection d'appareils & alertes de connexion suspecte | 🟡 | M | P2 |

### 2.2 ⚡ Performance & passage à l'échelle

| Amélioration | Impact | Effort | Priorité |
|---|---|---|---|
| ~~Cache Redis (sessions, rate-limit, réglages CMS)~~ | 🔴 | M | ✅ **Livré** |
| ~~Index composites & `EXPLAIN` sur découverte / fil / messages~~ | 🔴 | S | ✅ **Livré** |
| Réplicas de lecture MySQL (séparation lecture/écriture) | 🟡 | L | P2 |
| ~~Clustering WebSocket (Redis pub/sub)~~ | 🔴 | L | ✅ **Livré** |
| CDN + stockage objet (S3) pour médias, transcodage vocal | 🟡 | L | P2 |
| Pagination par curseur généralisée (au lieu d'`OFFSET`) | 🟡 | M | P1 |

### 2.3 🎨 Expérience utilisateur

| Amélioration | Impact | Effort | Priorité |
|---|---|---|---|
| ~~Notifications Web Push~~ | 🔴 | M | ✅ **Livré** |
| ~~Internationalisation (i18n) FR/EN + sélecteur~~ | 🟡 | M | ✅ **Livré** |
| ~~Onboarding guidé + complétion de profil~~ | 🟡 | M | ✅ **Livré** |
| ~~« Qui a vu mon profil » + derniers visiteurs~~ | 🟡 | S | ✅ **Livré** |
| Réponses citées & messages éphémères dans le chat | 🟢 | S | P2 |
| Filtres de découverte enrichis (style de vie, valeurs) | 🟡 | S | P2 |
| Skeletons/optimistic UI systématiques | 🟢 | S | P3 |

### 2.4 🛡️ Confiance & modération

| Amélioration | Impact | Effort | Priorité |
|---|---|---|---|
| Modération assistée par IA (nudité, arnaque, mineurs) — *v1 heuristique* ✅ ; ML/API à venir | 🔴 | L | P2 |
| Vérification selfie semi-automatique (liveness) | 🔴 | L | P1 |
| Anti-fraude : score de risque des profils & signaux | 🔴 | L | P1 |
| File de modération priorisée + actions groupées | 🟡 | S | P2 |

### 2.5 🧪 Qualité & industrialisation (DevEx)

| Amélioration | Impact | Effort | Priorité |
|---|---|---|---|
| ~~CI/CD (lint + tests) via GitHub Actions~~ | 🔴 | S | ✅ **Livré** |
| ~~Migrations de schéma versionnées~~ | 🟡 | M | ✅ **Livré** |
| Couverture de tests > 70 % (contrôleurs, WebSocket, paiements) | 🟡 | M | P1 |
| Analyse statique (PHPStan/Psalm niveau élevé) + PHP-CS-Fixer | 🟡 | S | P1 |
| Documentation API OpenAPI + collection de tests | 🟢 | M | P2 |
| Environnement de préproduction (staging) automatisé | 🟡 | M | P2 |

### 2.6 💳 Monétisation

| Amélioration | Impact | Effort | Priorité |
|---|---|---|---|
| ~~Achats à l'unité (Boost, Super Like, révéler admirateurs)~~ | 🔴 | M | ✅ **Livré** |
| ~~Relances d'échec de paiement (dunning)~~ + renouvellement auto *(état + notifs livrés ; recharge prestataire à venir)* | 🔴 | M | ✅ **Livré** |
| Facturation/reçus PDF + portefeuille de crédits | 🟡 | M | P2 |
| Essais gratuits, coupons & offres annuelles | 🟡 | S | P2 |

---

## 3. Matrice impact / effort

**⚡ Quick wins (fort impact, faible effort) — à faire en priorité :**

- Index composites + `EXPLAIN` sur les requêtes chaudes (P0).
- CI/CD GitHub Actions (P0).
- Révocation de sessions « déconnecter partout » (P1).
- « Qui a vu mon profil » (P2).

**🏗️ Grands chantiers (fort impact, fort effort) — à planifier :**

- Nonces CSP, cache Redis, clustering WebSocket.
- Modération IA, vérification liveness, anti-fraude.

**🧹 À intégrer au fil de l'eau (faible effort) :** skeletons, réponses citées, coupons.

---

## 4. Prochaines itérations recommandées

| Sprint | Thème | Contenu clé |
|---|---|---|
| **Sprint +1** ✅ | Socle production | CI/CD · index & `EXPLAIN` · nonces CSP · signature webhook PayPal — *livré* |
| **Sprint +2** ✅ | Engagement | Web Push · i18n FR/EN · onboarding · « qui a vu mon profil » — *livré* |
| **Sprint +3** ✅ | Scale & confiance | Cache Redis · clustering WebSocket · modération IA (v1) — *livré* |
| **Sprint +4** ✅ | Sécurité des comptes | 2FA (TOTP) · révocation de sessions — *livré* |
| **Sprint +5** ✅ | Monétisation | Achats à l'unité (Boost/Super Like/Reveal) · dunning — *livré* |

---

## 5. Indicateurs de suivi des améliorations

- **Performance** : p95 des temps de réponse API, latence WebSocket, temps de requête découverte.
- **Fiabilité** : taux d'erreur 5xx, volume purgé/jour, disponibilité (uptime).
- **Qualité** : couverture de tests, nombre de tests, alertes d'analyse statique.
- **Engagement** : taux d'installation PWA, opt-in Web Push, CTR des recommandations.
- **Sécurité** : incidents, délai de correctif, comptes frauduleux bloqués.

---

*Document vivant — mis à jour à chaque itération. Amoura © 2026.*
