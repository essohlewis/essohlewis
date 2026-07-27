# 💞 Amoura — Feuille de route des améliorations

**Plan d'amélioration continue de la plateforme**
Version : 2.6 · Date : 27 juillet 2026 · Portée : améliorations livrées + backlog priorisé

> Légende — **Impact** : 🟢 Faible · 🟡 Moyen · 🔴 Élevé | **Effort** : S (≤2 j) · M (≤1 sem) · L (2–3 sem) · XL (>1 mois) | **Priorité** : P0 (critique) → P3 (confort)

---

## 1. Améliorations livrées dans cette itération ✅

Ces améliorations issues des Phases 1 & 2 de la feuille de route produit ont été
**implémentées et testées** (suite passée à **200 tests / 529 assertions**, analyse
statique **PHPStan niveau 5 sans erreur**).

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

### 1.1 Itération de durcissement (Sprint +6) ✅

Dernière itération : **tout le reliquat du backlog** a été traité.

| Amélioration | Axe | Détail | Vérification |
|---|---|---|---|
| **Chiffrement des messages au repos** | Sécurité | `Core\Security\Crypto` (libsodium secretbox, clé dérivée d'`APP_KEY`) : `Message::send()` chiffre le corps, `history()` déchiffre ; rétro-compatible (texte clair renvoyé tel quel), dégradation gracieuse sans l'extension. | 4 unit + 1 intégration (chiffré en base, clair via l'API) |
| **Détection d'appareils** | Sécurité | `Services\Security\DeviceMonitor` : empreinte (UA + préfixe réseau /24-/48), table `login_devices`, alerte de connexion depuis un nouvel appareil. | 1 test d'intégration (2ᵉ appareil = 1 alerte) |
| **Réplicas de lecture** | Scale | `Database::read()` (réplica `DB_READ_*`, repli automatique sur le primaire). | Config `.env` + repli vérifié |
| **CDN + stockage objet S3** | Scale | Abstraction `Core\Storage` (`LocalStorage` défaut, `S3Storage` SigV4, `StorageManager` piloté par `STORAGE_DRIVER`), URLs CDN. | 5 tests unitaires (local, anti-traversée) |
| **Pagination par curseur** | Performance | `Core\Paginator` (curseur opaque base64url keyset) ; notifications & historique migrés depuis `OFFSET`. | 4 tests unitaires |
| **Réponses citées & éphémères** | UX | `messages.reply_to_id` (réponse citée déchiffrée) + `expires_at` (TTL, exclus après expiration, purgés par le cron). | 2 tests d'intégration |
| **Filtres de style de vie** | UX | `profiles` : tabac, alcool, enfants, religion, objectif de relation ; filtres de découverte + édition de profil. | Intégration matching |
| **Anti-fraude (score de risque)** | Confiance | `Services\Moderation\RiskScorer` : âge du compte, photo, signalements, coordonnées/arnaque en bio, vélocité, remise si vérifié → score 0–100 + niveau. | 5 tests unitaires |
| **File de modération priorisée + actions groupées** | Confiance | `Report::queue()` triée par sévérité (mineurs → arnaque → …) + `bulkResolve()` ; UI admin (cases à cocher, actions en masse). | 2 tests d'intégration |
| **Reçus de paiement** | Monétisation | Historique de facturation (`/premium/history`) + reçu imprimable/PDF (`/premium/receipt/{id}`, portée utilisateur, transactions payées uniquement). | 1 test d'intégration (portée) + smoke rendu |
| **Coupons & offres** | Monétisation | `Models\Coupon` (% ou montant, plafond de rachats, expiration, rachat atomique) intégré au tunnel d'abonnement. | 1 unit + 2 intégration |
| **Analyse statique (PHPStan)** | DevEx | `phpstan.neon` niveau 5 (app/scripts/websocket), script `composer stan`, **0 erreur** (corrections de types réelles au passage). | CI-ready |
| **Documentation API (OpenAPI)** | DevEx | `docs/openapi.yaml` (OpenAPI 3.0.3) : découverte, swipe, messagerie chiffrée, notifications, push, webhooks. | Spéc validée |

### 1.2 Mise en production — Phase 1, lot 1 (Sprint +7) ✅

| Amélioration | Axe | Détail | Vérification |
|---|---|---|---|
| **File d'envoi e-mail/SMS asynchrone** | Fiabilité / Scale | Table `message_outbox` + `Models\Outbox` (réclamation par lot `FOR UPDATE SKIP LOCKED`, relances à **backoff exponentiel**, lettre morte) ; `Messaging\Dispatcher` (modes `sync`/`async`) ; `scripts/worker.php` (démon + `--once`) ; drain intégré au cron. Découple la latence prestataire du temps de réponse HTTP. | 6 tests d'intégration (file, drain, backoff, lettre morte) |
| **Passerelle SMS réelle** | Infrastructure | `Services\Sms` : interface `SmsGateway`, `LogSmsGateway` (dev), `HttpSmsGateway` (REST générique, bearer, réf. prestataire), `SmsManager` piloté par `SMS_DRIVER`. `Mailer::send` route désormais via la file. | 3 tests unitaires |
| **Exemple Nginx `wss://` + TLS** | Déploiement | `deploy/nginx.sample.conf` : terminaison TLS, HSTS, cache assets, proxy WebSocket sécurisé ; service **worker** ajouté au `docker-compose`. | Config fournie |
| **Sauvegarde MySQL** | Fiabilité | `scripts/backup.sh` : `mysqldump --single-transaction`, compression, **rotation** configurable. | Syntaxe validée |
| **Checklist OWASP Top 10** | Sécurité | `docs/SECURITE_OWASP.md` : revue A01–A10 mappée au code + contrôles de lancement. | Document de revue |

---

## 2. Backlog d'améliorations priorisé

### 2.1 🔒 Sécurité & conformité

| Amélioration | Impact | Effort | Priorité |
|---|---|---|---|
| ~~Nonces CSP + suppression des handlers inline~~ | 🔴 | L | ✅ **Livré** |
| ~~Vérification de signature webhook PayPal~~ | 🔴 | M | ✅ **Livré** |
| ~~Authentification à deux facteurs (2FA) optionnelle~~ | 🟡 | M | ✅ **Livré** |
| ~~Rotation & révocation de sessions (« déconnecter partout »)~~ | 🟡 | S | ✅ **Livré** |
| ~~Chiffrement au repos des messages sensibles~~ | 🟡 | L | ✅ **Livré** |
| ~~Détection d'appareils & alertes de connexion suspecte~~ | 🟡 | M | ✅ **Livré** |

### 2.2 ⚡ Performance & passage à l'échelle

| Amélioration | Impact | Effort | Priorité |
|---|---|---|---|
| ~~Cache Redis (sessions, rate-limit, réglages CMS)~~ | 🔴 | M | ✅ **Livré** |
| ~~Index composites & `EXPLAIN` sur découverte / fil / messages~~ | 🔴 | S | ✅ **Livré** |
| ~~Réplicas de lecture MySQL (séparation lecture/écriture)~~ | 🟡 | L | ✅ **Livré** |
| ~~Clustering WebSocket (Redis pub/sub)~~ | 🔴 | L | ✅ **Livré** |
| ~~CDN + stockage objet (S3) pour médias~~ *(transcodage vocal à venir)* | 🟡 | L | ✅ **Livré** |
| ~~Pagination par curseur généralisée (au lieu d'`OFFSET`)~~ | 🟡 | M | ✅ **Livré** |

### 2.3 🎨 Expérience utilisateur

| Amélioration | Impact | Effort | Priorité |
|---|---|---|---|
| ~~Notifications Web Push~~ | 🔴 | M | ✅ **Livré** |
| ~~Internationalisation (i18n) FR/EN + sélecteur~~ | 🟡 | M | ✅ **Livré** |
| ~~Onboarding guidé + complétion de profil~~ | 🟡 | M | ✅ **Livré** |
| ~~« Qui a vu mon profil » + derniers visiteurs~~ | 🟡 | S | ✅ **Livré** |
| ~~Réponses citées & messages éphémères dans le chat~~ | 🟢 | S | ✅ **Livré** |
| ~~Filtres de découverte enrichis (style de vie, valeurs)~~ | 🟡 | S | ✅ **Livré** |
| Skeletons/optimistic UI systématiques | 🟢 | S | P3 |

### 2.4 🛡️ Confiance & modération

| Amélioration | Impact | Effort | Priorité |
|---|---|---|---|
| Modération assistée par IA (nudité, arnaque, mineurs) — *v1 heuristique* ✅ ; ML/API à venir | 🔴 | L | P2 |
| Vérification selfie semi-automatique (liveness) *(file de demandes livrée ; liveness ML à venir)* | 🔴 | L | P1 |
| ~~Anti-fraude : score de risque des profils & signaux~~ | 🔴 | L | ✅ **Livré** |
| ~~File de modération priorisée + actions groupées~~ | 🟡 | S | ✅ **Livré** |

### 2.5 🧪 Qualité & industrialisation (DevEx)

| Amélioration | Impact | Effort | Priorité |
|---|---|---|---|
| ~~CI/CD (lint + tests) via GitHub Actions~~ | 🔴 | S | ✅ **Livré** |
| ~~Migrations de schéma versionnées~~ | 🟡 | M | ✅ **Livré** |
| Couverture de tests > 70 % *(121 tests ; contrôleurs/WebSocket à renforcer)* | 🟡 | M | P1 |
| ~~Analyse statique (PHPStan niveau 5)~~ *(PHP-CS-Fixer à venir)* | 🟡 | S | ✅ **Livré** |
| ~~Documentation API OpenAPI~~ *(collection de tests à venir)* | 🟢 | M | ✅ **Livré** |
| Environnement de préproduction (staging) automatisé | 🟡 | M | P2 |

### 2.6 💳 Monétisation

| Amélioration | Impact | Effort | Priorité |
|---|---|---|---|
| ~~Achats à l'unité (Boost, Super Like, révéler admirateurs)~~ | 🔴 | M | ✅ **Livré** |
| ~~Relances d'échec de paiement (dunning)~~ + renouvellement auto *(état + notifs livrés ; recharge prestataire à venir)* | 🔴 | M | ✅ **Livré** |
| ~~Facturation/reçus (imprimable/PDF)~~ *(portefeuille de crédits déjà livré)* | 🟡 | M | ✅ **Livré** |
| ~~Coupons & offres~~ *(essais gratuits à venir)* | 🟡 | S | ✅ **Livré** |

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
| **Sprint +6** ✅ | Durcissement (reliquat backlog) | Chiffrement des messages · détection d'appareils · réplicas de lecture · stockage S3/CDN · pagination par curseur · réponses citées/éphémères · filtres style de vie · anti-fraude · file de modération priorisée · reçus · coupons · PHPStan · OpenAPI — *livré* |
| **Sprint +7** ✅ | Mise en production (Phase 1, lot 1) | File d'envoi e-mail/SMS asynchrone (outbox + worker, relances backoff) · passerelle SMS réelle (driver HTTP) · exemple Nginx `wss://` · script de sauvegarde MySQL · checklist OWASP — *livré* |
| **Sprint +8** ✅ | Mise en production (Phase 1, lot 2) | Tests de charge HTTP & WebSocket + budget de performance (CI) · briques `Benchmark`/`Realtime` testées · **correction d'un crash du serveur WS à la connexion** (parse_url sur objet PSR-7) — *livré* |
| **Sprint +9** ✅ | Confiance & conformité (Phase 4, lot 1) | RGPD : consentements granulaires (`user_consents`) · export complet (accès/portabilité) & effacement (droit à l'oubli) `Services\Gdpr` · centre de sécurité (appareils, consentements) · registre de traitement `docs/RGPD.md` — *livré* |
| **Sprint +10** ✅ | Confiance & conformité (Phase 4, lot 2) | Vérification de profil par selfie : soumission membre + pré-analyse heuristique (`Services\Verification`, interface liveness pluggable) · file de revue admin (score auto, approbation → badge, rejet) · notifications — *livré* |
| **Sprint +11** ✅ | Monétisation — finitions (Phase 3) | Mode incognito (navigation privée VIP, gated) · tableau de bord revenus admin (MRR, ARPU, LTV, churn, tendance 12 mois, répartition prestataire/offre, graphe SVG sans script) — *livré* |
| **Sprint +12** ✅ | Croissance (Phase 5) | Programme de parrainage : code unique par membre, lien `/register?ref=`, récompense Super Likes à la qualification du filleul (transactionnel, idempotent), page « Inviter » avec stats + partage — *livré* |
| **Sprint +13** ✅ | Observabilité (Phase 6) | Health checks liveness/readiness (`/healthz`, `/healthz/ready`), métriques Prometheus (`/metrics`, jauges applicatives, jeton), request-id de corrélation propagé dans tous les logs + journal d'accès — *livré* |
| **Sprint +14** ✅ | Intelligence (Phase 6) | Brise-glaces assistés : `Services\Icebreaker` (interface pluggable LLM + heuristique v1 : intérêts communs, ville, métier, objectif, repli) · endpoint `/api/icebreakers/{id}` (réservé aux matchs) · suggestions intégrées au fil de discussion vide — *livré* |
| **Sprint +15** ✅ | Intelligence (Phase 6) | Matching par apprentissage v1 : `Services\Matching\TasteProfile` (apprend âge/vérifié/intérêts préférés du feedback implicite) + `PersonalizedRanker` (reclasse la découverte en mêlant affinité et goût appris ; sans signal, ordre conservé) — *livré* |
| **Sprint +16** ✅ | Croissance / international (Phase 5) | Multi-devises : table `currency_rates` (base XOF, 6 devises seedées), `Services\Money` (conversion + formatage), sélecteur d'affichage par cookie, prix indicatifs (« ≈ ») sur accueil/offres/boutique — *livré* |

---

## 5. Indicateurs de suivi des améliorations

- **Performance** : p95 des temps de réponse API, latence WebSocket, temps de requête découverte.
- **Fiabilité** : taux d'erreur 5xx, volume purgé/jour, disponibilité (uptime).
- **Qualité** : couverture de tests, nombre de tests, alertes d'analyse statique.
- **Engagement** : taux d'installation PWA, opt-in Web Push, CTR des recommandations.
- **Sécurité** : incidents, délai de correctif, comptes frauduleux bloqués.

---

*Document vivant — mis à jour à chaque itération. Amoura © 2026.*
