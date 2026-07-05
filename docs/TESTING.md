# Tests critiques — Transouscris

Priorité aux zones où un bug coûte de l'argent ou expose des données :
**transactions financières, webhooks de paiement, IDOR**. Cette liste est
ordonnée par criticité décroissante.

## Comment exécuter

```bash
composer install         # installe PHPUnit (dev)
composer test            # ou : php vendor/bin/phpunit

# sans Composer :
php phpunit.phar --testsuite unit
```

Les tests **unitaires** (répertoire `tests/Unit`) ne requièrent pas de base et
tournent en CI. Les tests **d'intégration** (`tests/Feature`) nécessitent une
base MySQL de test (`DB_NAME=transouscris_test`) — voir la section dédiée.

État actuel : 16 tests unitaires verts (détection opérateur, invariants de
partie double, validation, signature de webhook CinetPay).

---

## 1. Transactions financières (priorité maximale)

### 1.1 Grand livre — invariants (unitaire, sans DB) ✅ implémenté
- Rejet d'une transaction déséquilibrée (`Σ débits ≠ Σ crédits`).
- Rejet d'une transaction à moins de deux écritures.
- Rejet d'une direction d'écriture invalide.
- Rejet d'un montant ≤ 0.

### 1.2 Grand livre — intégration (MySQL requis)
- **Idempotence** : deux `post()` avec la même `reference` ne créent qu'une
  transaction et n'appliquent le mouvement qu'une fois.
- **Solde insuffisant** : un débit supérieur au solde lève
  `InsufficientFundsException` et **ne laisse aucune écriture** (rollback total).
- **Atomicité** : une erreur au milieu d'un `post()` multi-écritures annule tout.
- **Cohérence globale** : après N opérations aléatoires, `SUM(balance) = 0` sur
  l'ensemble des comptes.
- **`balance_after`** de chaque écriture correspond au solde recalculé.

### 1.3 Concurrence (MySQL requis)
- **Verrou pessimiste** : deux débits concurrents sur le même wallet (solde juste
  suffisant pour un seul) ⇒ exactement un succès, un `InsufficientFundsException`,
  jamais de solde négatif (test avec 2 connexions/processus et `FOR UPDATE`).
- **Anti-deadlock** : deux transactions croisées (A→B et B→A) se sérialisent
  grâce au verrouillage ordonné par `id`.

### 1.4 Recharge & garantie de remboursement
- Recharge : débit wallet → séquestre ; statut `dispatched`.
- Confirmation opérateur : séquestre → revenus ; statut `success` (idempotent).
- **Garantie** : une recharge non confirmée après l'échéance est remboursée
  (séquestre → wallet), statut `refunded`, une seule fois.
- Une recharge déjà `success` n'est jamais remboursée.

---

## 2. Webhooks de paiement (priorité maximale)

### 2.1 Signature (unitaire) ✅ implémenté (CinetPay)
- Signature HMAC valide acceptée.
- Signature absente rejetée.
- Corps falsifié (montant modifié) rejeté.
- À dupliquer pour PayDunya (hash master_key) et Wave (`Wave-Signature`).

### 2.2 Re-vérification serveur (intégration)
- **Le contenu du webhook ne crédite jamais seul** : avec une passerelle factice
  dont `verify()` renvoie `PENDING`, aucun crédit n'est appliqué même si le
  webhook annonce un succès.
- `verify()` = `SUCCESS` + montant concordant ⇒ wallet crédité **une seule fois**.
- `verify()` = `SUCCESS` mais **montant différent** de l'intention ⇒ crédit refusé,
  intention marquée `failed` (anti-fraude).
- **Rejeu** : deux webhooks pour la même référence ⇒ un seul crédit.
- Référence inconnue ⇒ pas de crédit, journalisé.

> Gabarit : injecter une `FakeGateway` via
> `PaymentGatewayFactory::register('fake', $mock)` puis piloter les retours de
> `verify()`.

---

## 3. IDOR & contrôle d'accès (priorité haute)

- **Reçu de recharge** : l'utilisateur A ne peut pas ouvrir
  `/recharge/{id}/receipt` d'une recharge appartenant à B ⇒ 403
  (`authorizeOwnership`).
- **Portefeuille** : l'historique n'expose que les écritures du compte de
  l'utilisateur connecté.
- **Cagnotte** : la création exige l'authentification ; la contribution publique
  ne divulgue pas les données du propriétaire.
- **Admin** : les routes `/admin/*` renvoient 403 pour un rôle non-admin.
- **Agent** : bascule de disponibilité réservée au compte agent propriétaire.

---

## 4. Authentification & OTP (priorité haute)

- OTP jamais stocké en clair (seul le hash est en base).
- Code expiré / déjà consommé refusé.
- **Rate limiting** : au-delà de N envois par fenêtre, l'envoi est bloqué (429).
- **Anti brute-force** : au-delà de `otp_max_attempts`, le code est brûlé.
- Régénération de l'ID de session à la connexion (anti fixation).

---

## 5. Sécurité transverse (priorité moyenne)

- **CSRF** : une requête POST sans jeton valide ⇒ 419 ; les webhooks en sont
  exclus (signature HMAC à la place).
- **Rate limiting HTTP** : dépassement ⇒ 429 sur les endpoints paiement.
- **Validation** : montants négatifs, numéros invalides, gateways inconnus rejetés.

---

## Mise en place d'une base de test (intégration)

```sql
CREATE DATABASE transouscris_test CHARACTER SET utf8mb4;
```
```bash
DB_NAME=transouscris_test php bin/console.php migrate
DB_NAME=transouscris_test php phpunit.phar --testsuite feature
```

Chaque test d'intégration s'exécute dans une transaction annulée en `tearDown`
(ou recrée les tables) pour l'isolation.
