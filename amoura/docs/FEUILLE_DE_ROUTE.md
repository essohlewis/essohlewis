# 💞 Amoura — Feuille de route produit

**Plateforme SaaS de rencontres en ligne**
Version du document : 1.0 · Date : 26 juillet 2026 · Statut : MVP livré, en cours d'industrialisation

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
| Qualité | ✅ Livré | **32 tests PHPUnit** (unitaires + intégration MySQL), tous verts |
| Déploiement | ✅ Livré | Docker Compose (web + MySQL + WebSocket + coturn), installeur XAMPP |

---

## 3. Feuille de route par phases

### 🟢 Phase 1 — Stabilisation & mise en production *(T3 2026 · 4–6 semaines)*

*Objectif : passer du MVP à un service exploitable en production.*

- [ ] Durcissement CSP (nonces + handlers externalisés à la place de `unsafe-inline`).
- [ ] File d'attente e-mail/SMS asynchrone (OTP, notifications) + fournisseur SMS réel.
- [ ] Déploiement TURN (coturn) supervisé + `wss://` derrière Nginx.
- [ ] Purge planifiée (statuts expirés, tokens, sessions) via tâches cron.
- [ ] Journalisation centralisée + supervision (uptime, erreurs, métriques WebSocket).
- [ ] Tests de charge (chat & signaling) et budget de performance.
- [ ] Politique de sauvegarde/restauration MySQL et plan de reprise.
- [ ] Recette de sécurité (pentest léger, revue OWASP Top 10).

### 🔵 Phase 2 — Engagement & rétention *(T4 2026 · 6–8 semaines)*

*Objectif : augmenter le temps passé et la fréquence de retour.*

- [ ] Push mobile web (Web Push / PWA installable) pour messages, matchs, appels.
- [ ] Recommandations améliorées (score d'affinité : intérêts + activité + proximité).
- [ ] « Qui a vu mon profil », derniers visiteurs.
- [ ] Réactions et réponses citées dans le chat, messages éphémères.
- [ ] Filtres de découverte enrichis (style de vie, valeurs, langues).
- [ ] Onboarding guidé + complétion de profil gamifiée.
- [ ] Traduction i18n (français, anglais) et sélecteur de langue.

### 🟣 Phase 3 — Monétisation avancée *(T1 2027 · 6 semaines)*

*Objectif : diversifier et augmenter le revenu par utilisateur.*

- [ ] Achats à l'unité : Boosts, Super Likes, révélation d'admirateurs.
- [ ] Paliers Premium/VIP annuels + essais gratuits et coupons.
- [ ] Portefeuille interne (crédits) et reçus/facturation PDF.
- [ ] Renouvellement automatique + relances d'échec de paiement (dunning).
- [ ] Mode incognito et navigation privée (VIP).
- [ ] Tableau de bord revenus avancé (cohortes, LTV, churn) côté admin.

### 🟠 Phase 4 — Confiance, sécurité & conformité *(T1–T2 2027 · en continu)*

*Objectif : plateforme sûre pour un contenu sensible.*

- [ ] Vérification de profil semi-automatique (selfie + détection de vivacité).
- [ ] Modération assistée par IA (nudité, arnaques, mineurs) + file prioritaire.
- [ ] Anti-fraude : détection de faux profils, appareils, schémas d'arnaque.
- [ ] Chiffrement de bout en bout optionnel des messages sensibles.
- [ ] Centre de sécurité utilisateur (conseils, blocage, signalement en 1 clic).
- [ ] Conformité RGPD renforcée + registre de traitement + DPA prestataires.

### 🔴 Phase 5 — Croissance & international *(T2–T3 2027)*

*Objectif : élargir la base et les marchés.*

- [ ] Applications natives (React Native / Flutter) réutilisant l'API REST.
- [ ] Multi-devises et passerelles supplémentaires (Wave, M-Pesa, Flutterwave).
- [ ] Programme de parrainage et invitations.
- [ ] Événements & communautés (speed-dating vidéo, salons thématiques).
- [ ] Marketing d'acquisition (SEO, liens profonds, partage social).

### ⚫ Phase 6 — Intelligence & passage à l'échelle *(T4 2027+)*

*Objectif : personnalisation et robustesse à grande échelle.*

- [ ] Matching par apprentissage (embeddings d'affinité, feedback implicite).
- [ ] Brise-glaces et suggestions de conversation assistés par IA.
- [ ] Passage à l'échelle : cache Redis, réplicas de lecture, clustering WebSocket.
- [ ] Média : transcodage vocal serveur, stockage objet (S3), CDN images.
- [ ] Observabilité complète (traçage distribué, SLO/SLA).

---

## 4. Backlog technique (dette & améliorations)

| Priorité | Élément | Bénéfice |
|---|---|---|
| Haute | Nonces CSP + suppression des scripts inline | Sécurité renforcée |
| Haute | Couche cache (Redis) sessions & rate-limit | Performance & scalabilité |
| Moyenne | Migrations versionnées (au lieu du schéma monolithique) | Évolution BDD maîtrisée |
| Moyenne | Couverture de tests > 70 % (contrôleurs, WebSocket) | Fiabilité |
| Moyenne | CI/CD (lint + tests + build Docker automatisés) | Livraison continue |
| Basse | Documentation API OpenAPI | Intégrations tierces |

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
