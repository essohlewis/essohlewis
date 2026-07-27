# 💞 Amoura — Feuille de route produit

**Plateforme SaaS de rencontres en ligne**
Version du document : 2.6 · Date : 27 juillet 2026 · Statut : socle industrialisé (Sprints +1 → +12 livrés)

---

## 1. Vision & objectifs

**Vision.** Faire d'Amoura la plateforme de rencontres de référence en Afrique de l'Ouest
et au-delà, en combinant une expérience mobile fluide, des échanges riches (chat, vocal,
appels vidéo) et un modèle économique adapté aux paiements locaux (Mobile Money) comme
internationaux (cartes, PayPal).

**Objectifs stratégiques.**

| Objectif | Indicateur cible (12 mois) |
|---|---|
| Acquisition | 100 000 inscrits |
| Engagement | 40 % d'utilisateurs actifs hebdomadaires (WAU) |
| Qualité des rencontres | 1 match mutuel / utilisateur actif / semaine |
| Monétisation | 5 % de taux de conversion Premium |
| Confiance | < 0,5 % de comptes signalés comme frauduleux |

---

## 2. État actuel — v1.0 (MVP livré ✅)

Le socle applicatif est **fonctionnel, testé et déployable**. Architecture MVC PHP pure
(sans framework), MySQL, temps réel WebSocket, appels WebRTC.

| Module | Statut | Détail |
|---|---|---|
| Schéma de données | ✅ Livré | 30 tables (users, profils, matchs, messages, appels, social, paiements, modération, CMS, audit) |
| Cœur MVC | ✅ Livré | Routeur, autoloader PSR-4, PDO singleton, moteur de vues, sessions |
| Sécurité | ✅ Livré | Argon2id, CSRF, anti-XSS + CSP, rate-limiting, `FOR UPDATE` |
| Authentification | ✅ Livré | Inscription + OTP email, vérification, connexion, réinitialisation |
| Profils & découverte | ✅ Livré | Profil riche, photos, filtres, like/pass, **match mutuel atomique** |
| Messagerie temps réel | ✅ Livré | Chat WebSocket, frappe, accusés lu/reçu, présence, **vocal + waveform**, images |
| Appels audio/vidéo | ✅ Livré | WebRTC P2P + signaling WebSocket + config STUN/TURN |
| Social | ✅ Livré | Statuts éphémères 24 h, mur (posts/likes/commentaires), notifications |
| Abonnements & paiements | ✅ Livré | Stripe, PayPal, CinetPay, PayDunya + **vérification serveur idempotente** |
| Espace admin / CMS | ✅ Livré | Tableau de bord, membres, modération, facturation, réglages, rôles, audit |
| Design system | ✅ Livré | Tokens, thèmes clair/sombre, responsive mobile-first |
| Qualité | ✅ Livré | **169 tests PHPUnit** (unit + intégration MySQL/Redis) + **PHPStan niveau 5** + tests de charge, tous verts |
| Déploiement | ✅ Livré | Docker Compose (web + MySQL + WebSocket + coturn), installeur XAMPP |

---

## 3. Feuille de route par phases

> Légende : **[x]** livré · **[~]** partiellement livré · **[ ]** à faire.
> Phases 1–4 bouclées côté code ; Phase 5 entamée (parrainage, Sprint +12). Restent le gros de la Phase 5 (apps natives, passerelles, événements) et la Phase 6 (IA/observabilité).

### 🟢 Phase 1 — Stabilisation & mise en production *(T3 2026 · 4–6 semaines)*

*Objectif : passer du MVP à un service exploitable en production.*

- [x] **Durcissement CSP** (nonces + handlers externalisés) — *Sprint +1*. ✅
- [x] **File d'attente e-mail/SMS asynchrone** (`message_outbox` + worker, relances backoff) + **passerelle SMS réelle** (`Services\Sms`, driver HTTP) — *Sprint +7*. ✅
- [~] **coturn** (STUN/TURN) fourni + **exemple Nginx TLS `wss://`** (`deploy/nginx.sample.conf`) — *Sprint +7* · *(déploiement supervisé à finaliser)*
- [x] **Purge planifiée** (statuts expirés, tokens, sessions, rate-limits) via cron (`scripts/cron.php`). ✅
- [x] **Journalisation structurée** JSON (`Services\Logger`) branchée sur le gestionnaire d'erreurs. ✅ *(supervision à compléter)*
- [x] **Tests de charge HTTP & WebSocket/signaling** + **budget de performance** (`scripts/loadtest.php`, `scripts/ws_loadtest.php`, `perf-budget.json`, `docs/PERFORMANCE.md`) — *Sprint +8*. ✅ *(a révélé et corrigé un crash du serveur WS à la connexion)*
- [~] **Sauvegarde/restauration MySQL** avec rotation (`scripts/backup.sh`) — *Sprint +7* · *(plan de reprise RTO/RPO à documenter)*
- [~] **Checklist OWASP Top 10** mappée au code (`docs/SECURITE_OWASP.md`) — *Sprint +7* · *(pentest léger à mener)*

### 🔵 Phase 2 — Engagement & rétention *(T4 2026 · 6–8 semaines)*

*Objectif : augmenter le temps passé et la fréquence de retour.*

- [x] **PWA installable** (manifest, service worker, coquille hors-ligne) + **Web Push** (VAPID) — *Sprints +2*. ✅
- [x] **Recommandations par affinité** (intérêts + proximité + âge + activité + vérifié) — `Services\Recommender`. ✅
- [x] **« Qui a vu mon profil »**, derniers visiteurs — *Sprint +2*. ✅
- [x] **Réactions, réponses citées et messages éphémères** dans le chat — *Sprints +3/+6*. ✅
- [x] **Filtres de découverte enrichis** (style de vie, langues) — *Sprint +6*. ✅
- [x] **Onboarding guidé** + complétion de profil — *Sprint +2*. ✅
- [x] **i18n FR/EN** + sélecteur de langue — *Sprint +2*. ✅

### 🟣 Phase 3 — Monétisation avancée *(T1 2027 · 6 semaines)*

*Objectif : diversifier et augmenter le revenu par utilisateur.*

- [x] **Achats à l'unité** : Boosts, Super Likes, révélation d'admirateurs — *Sprint +5*. ✅
- [x] **Coupons de réduction** — *Sprint +6* ✅ · *(paliers annuels & essais gratuits à venir)*
- [x] **Portefeuille de crédits** + **reçus imprimables/PDF** — *Sprints +5/+6*. ✅
- [x] **Relances d'échec (dunning)** — *Sprint +5* ✅ · *(renouvellement auto prestataire à venir)*
- [x] **Mode incognito** (navigation privée VIP : consulter sans laisser de trace, gated sur l'offre VIP) — *Sprint +11*. ✅
- [x] **Tableau de bord revenus** (MRR, ARPU, LTV, churn, tendance 12 mois, répartition prestataire/offre) — *Sprint +11*. ✅

### 🟠 Phase 4 — Confiance, sécurité & conformité *(T1–T2 2027 · en continu)*

*Objectif : plateforme sûre pour un contenu sensible.*

- [x] **Vérification de profil par selfie** : soumission membre + pré-analyse heuristique (`Services\Verification`, interface liveness pluggable) + file de revue admin → badge vérifié — *Sprint +10*. ✅ *(prestataire liveness ML à brancher)*
- [x] **Modération assistée (v1 heuristique)** + **file prioritaire & actions groupées** — *Sprints +3/+6*. ✅
- [x] **Anti-fraude** : score de risque + **détection d'appareils** — *Sprint +6*. ✅
- [~] **Chiffrement des messages au repos** (libsodium) — *Sprint +6* · *(bout-en-bout à venir)*
- [~] **Centre de sécurité** enrichi (2FA, sessions, appareils connus, consentements, export/suppression en 1 clic) — *Sprint +9* · *(blocage 1-clic déjà dispo ; conseils à étoffer)*
- [~] **RGPD renforcé** : consentements granulaires (`user_consents`), export complet & effacement (`Services\Gdpr`), **registre de traitement** (`docs/RGPD.md`) — *Sprint +9* · *(DPA prestataires à signer)*

### 🔴 Phase 5 — Croissance & international *(T2–T3 2027)*

*Objectif : élargir la base et les marchés.*

- [ ] Applications natives (React Native / Flutter) réutilisant l'API REST.
- [ ] Multi-devises et passerelles supplémentaires (Wave, M-Pesa, Flutterwave).
- [x] **Programme de parrainage** : code unique par membre, lien d'invitation, récompense en Super Likes à la qualification du filleul (idempotent) + page « Inviter » — *Sprint +12*. ✅
- [ ] Événements & communautés (speed-dating vidéo, salons thématiques).
- [ ] Marketing d'acquisition (SEO, liens profonds, partage social).

### ⚫ Phase 6 — Intelligence & passage à l'échelle *(T4 2027+)*

*Objectif : personnalisation et robustesse à grande échelle.*

- [ ] Matching par apprentissage (embeddings d'affinité, feedback implicite).
- [ ] Brise-glaces et suggestions de conversation assistés par IA.
- [x] **Cache Redis, réplicas de lecture, clustering WebSocket** — *Sprints +3/+6*. ✅
- [x] **Stockage objet (S3) + CDN images** — *Sprint +6* ✅ · *(transcodage vocal serveur à venir)*
- [ ] Observabilité complète (traçage distribué, SLO/SLA).

---

## 4. Backlog technique (dette & améliorations)

| Priorité | Élément | Bénéfice |
|---|---|---|
| ✅ Livré | ~~Nonces CSP + suppression des scripts inline~~ | Sécurité renforcée |
| ✅ Livré | ~~Couche cache (Redis) sessions & rate-limit~~ | Performance & scalabilité |
| ✅ Livré | ~~Migrations versionnées~~ | Évolution BDD maîtrisée |
| 🟡 En cours | Couverture de tests > 70 % (147 tests ; contrôleurs/WebSocket à renforcer) | Fiabilité |
| ✅ Livré | ~~CI/CD (lint + tests) GitHub Actions~~ + **PHPStan** | Livraison continue |
| ✅ Livré | ~~Documentation API OpenAPI~~ (`docs/openapi.yaml`) | Intégrations tierces |

---

## 5. Indicateurs de succès (KPIs)

- **Acquisition** : inscriptions/jour, coût par inscription, taux de vérification.
- **Activation** : % de profils complétés à J+1, 1er match sous 48 h.
- **Engagement** : DAU/WAU/MAU, messages/utilisateur, durée d'appel moyenne.
- **Rétention** : rétention J1/J7/J30, churn d'abonnement.
- **Monétisation** : taux de conversion Premium, ARPU, LTV, MRR.
- **Confiance** : taux de signalement, délai de traitement modération, faux profils bloqués.

---

## 6. Jalons indicatifs

| Jalon | Période | Livrable clé |
|---|---|---|
| **M0 — MVP** | ✅ Juil. 2026 | Socle complet livré, testé, déployable |
| **M1 — Production** | T3 2026 | Service en ligne supervisé, sécurisé, sauvegardé |
| **M2 — Rétention** | T4 2026 | Push, recommandations, i18n |
| **M3 — Monétisation** | T1 2027 | Achats à l'unité, abonnements annuels, dunning |
| **M4 — Confiance** | T2 2027 | Modération IA, anti-fraude, vérification |
| **M5 — Mobile & scale** | T3 2027 | Apps natives, montée en charge |

---

## 7. Risques & mesures d'atténuation

| Risque | Impact | Atténuation |
|---|---|---|
| Faux profils / arnaques | Élevé | Vérification, modération IA, anti-fraude (Phase 4) |
| Coûts TURN (appels vidéo) | Moyen | Priorité P2P, TURN uniquement en repli, quotas |
| Dépendance passerelles de paiement | Moyen | Multi-fournisseurs, reprise sur webhook, réconciliation |
| Charge temps réel (WebSocket) | Moyen | Clustering, Redis pub/sub, tests de charge (Phase 6) |
| Conformité RGPD / données sensibles | Élevé | Chiffrement, minimisation, export/suppression, audit |

---

*Document vivant — à réviser à chaque fin de phase. Amoura © 2026.*
