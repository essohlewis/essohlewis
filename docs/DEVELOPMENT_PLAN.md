# Plan de développement — Transouscris

Développement en **6 phases**. Chaque phase est livrable et testable
indépendamment. L'état actuel du dépôt couvre le squelette complet des phases
1 à 4 et pose les fondations des phases 5 et 6.

---

## Phase 1 — Fondations (noyau MVC & sécurité)
**Objectif :** socle applicatif robuste.

- [x] Front controller + routeur (`{param}`, groupes, middlewares)
- [x] Noyau : Request/Response, Config/Env, Session, Logger
- [x] Connexion PDO + helper `transaction()`
- [x] Sécurité transverse : CSRF, RateLimiter, Validator, gestion d'erreurs
- [x] Schéma de base + migrations (`bin/console.php migrate`)
- [x] PWA de base (manifest + service worker)

**Critère de sortie :** une route protégée par CSRF/Auth répond correctement ;
les tables sont créées.

---

## Phase 2 — Portefeuille & grand livre
**Objectif :** le cœur financier avant tout paiement réel.

- [x] `ledger_accounts` / `ledger_transactions` / `ledger_entries`
- [x] `WalletService::post()` (partie double, `FOR UPDATE`, idempotence, solde ≥ 0)
- [x] Comptes système (clearing, séquestre, revenus, cashback)
- [x] Historique wallet + contrôle d'intégrité (`SUM(balance)=0`)
- [x] Audit log des écritures

**Critère de sortie :** crédit/débit atomiques, tests unitaires d'équilibre verts,
aucun solde négatif possible sur un compte utilisateur.

---

## Phase 3 — Paiement (approvisionnement wallet)
**Objectif :** faire entrer de l'argent en toute sécurité.

- [x] `PaymentGatewayInterface` + CinetPay + PayDunya + Wave + factory
- [x] `PaymentIntent` (pivot idempotent) + initialisation
- [x] Webhooks : vérification de **signature** puis **re-vérification serveur**
- [x] Crédit wallet idempotent + contrôle de montant
- [x] **Passerelle de simulation** (sandbox) pour tester le flux complet en
      local sans compte marchand (APP_DEBUG uniquement)
- [ ] Rapprochement/relance des paiements `pending` (cron)
- [ ] Stripe (carte internationale — support diaspora)

**Critère de sortie :** un paiement sandbox crédite le wallet une seule fois,
même en cas de rejeu de webhook ; un montant falsifié est refusé.

---

## Phase 4 — Recharge & réseau d'agents
**Objectif :** la valeur d'usage principale.

- [x] Détection opérateur (préfixe + point d'extension HLR)
- [x] Forfaits par opérateur + recharge crédit
- [x] `RechargeService` (débit wallet → séquestre → dispatch opérateur)
- [x] Reçu téléchargeable (avec garde IDOR)
- [x] Agents : disponibilité, notation, score de fiabilité
- [x] **Garantie de remboursement automatique** (`RefundGuaranteeService` + worker)
- [ ] Intégration réelle d'un agrégateur airtime (remplacer `OperatorDispatcher`)

**Critère de sortie :** une recharge débite le wallet, se dispatche, et est
remboursée automatiquement si non confirmée dans le délai.

---

## Phase 5 — Fonctionnalités différenciantes
**Objectif :** l'innovation produit.

- [x] Favoris (Moi, Famille, Conjoint, Enfants, Amis) + accès rapide recharge
- [x] Historique dédié + « Refaire cette opération » + recherche
- [x] Comparateur de forfaits inter-opérateurs (coût/Go, meilleur prix, filtres)
- [x] Mode sombre (bascule persistante, sur toute l'application)
- [x] Cagnotte / recharge collective (lien partageable public)
- [x] Recharge programmée récurrente (mensuelle / hebdomadaire) : CRUD,
      worker `scheduled:run` (réservation + exécution, anti double-débit),
      exécution manuelle. Reste à faire : déclenchement sur seuil bas
      (nécessite un lookup du solde opérateur)
- [ ] Cashback + gamification (paliers, badges, défis) — tables prêtes
- [ ] Assistant conversationnel transactionnel (NLU → intention de recharge)
- [ ] Fidélité inter-plateformes (points échangeables, ex. SAMSON GYM)
- [ ] Support diaspora complet (Stripe + conformité)

**Critère de sortie :** au moins la cagnotte et la recharge programmée sont
opérationnelles de bout en bout.

---

## Phase 6 — Back-office admin & exploitation
**Objectif :** piloter, superviser, résoudre les litiges.

- [x] Tableau de bord (stats, contrôle d'intégrité comptable)
- [x] Consultation des transactions du grand livre & des agents
- [ ] Gestion des litiges / remboursements manuels
- [ ] Rôles & permissions fins (support, finance, admin)
- [ ] Export comptable + rapprochement fournisseurs
- [ ] Observabilité (métriques, alertes sur écarts de solde)

**Critère de sortie :** un litige peut être tracé et résolu ; les écarts de
solde déclenchent une alerte.

---

## Jalons transverses (toutes phases)
- Tests critiques prioritaires (voir `docs/TESTING.md`).
- Journalisation d'audit systématique sur le wallet.
- Revue de sécurité avant chaque mise en production (CSRF, IDOR, rate limit, secrets).
