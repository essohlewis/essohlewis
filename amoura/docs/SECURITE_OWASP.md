# 🔐 Amoura — Recette de sécurité (OWASP Top 10 : 2021)

**Objectif :** checklist de revue avant mise en production, mappée sur le code
existant. Statuts : ✅ couvert · 🟡 partiel / à vérifier en prod · ⬜ à faire.

---

## A01 — Contrôle d'accès défaillant
- ✅ Garde d'authentification centralisée (`Core\Controller::requireAuth`).
- ✅ Vérification d'appartenance aux ressources (ex. `Conversation::isMember`,
  reçus limités à leur propriétaire `Transaction::receiptFor`).
- ✅ Rôles admin/staff sur les routes `/admin/*` (middleware `$staff`).
- 🟡 Vérifier les *IDOR* sur chaque nouvel endpoint (tester avec un second compte).

## A02 — Défaillances cryptographiques
- ✅ Mots de passe : Argon2id (`Core\Security\Auth::hash`).
- ✅ Messages chiffrés au repos (`Core\Security\Crypto`, libsodium secretbox).
- ✅ OTP jamais stockés en clair (hash uniquement).
- 🟡 TLS 1.2/1.3 obligatoire en frontal (voir `deploy/nginx.sample.conf`, HSTS).
- 🟡 `APP_KEY` fort (32+ octets) et secrets hors dépôt (`.env` non versionné).

## A03 — Injection
- ✅ 100 % requêtes préparées PDO (émulation désactivée) ; aucune concaténation SQL.
- ✅ Anti-XSS : échappement automatique des vues (`e()`), `Sanitizer`.
- ✅ Noms de colonnes dynamiques filtrés (`Model::assertColumn`).
- ✅ CSP par nonce (pas de script inline).

## A04 — Conception non sécurisée
- ✅ Match mutuel et débits de crédits atomiques (`SELECT … FOR UPDATE`).
- ✅ Idempotence des webhooks de paiement + re-vérification serveur.
- ✅ Anti-fraude (`RiskScorer`) et modération automatique du contenu.
- ✅ Limitation de débit (login, actions) — `Core\Security\RateLimiter`.

## A05 — Mauvaise configuration de sécurité
- ✅ En-têtes de sécurité (`Response::securityHeaders` + Nginx : HSTS, nosniff,
  X-Frame-Options, Referrer-Policy).
- ✅ `APP_DEBUG=false` en production (pas de stack trace exposée).
- ✅ Fichiers sensibles refusés côté serveur (`.env`, `app/`, `database/`).
- 🟡 Comptes/ mots de passe par défaut à changer (DB, admin, TURN).

## A06 — Composants vulnérables et obsolètes
- ✅ Dépendances minimales, verrouillées (`composer.lock`).
- 🟡 `composer audit` régulier ; suivi des CVE (Ratchet, web-push, guzzle).
- 🟡 Mises à jour PHP/MySQL/Redis planifiées.

## A07 — Défaillances d'identification et d'authentification
- ✅ OTP e-mail (à durée de vie limitée, tentatives plafonnées).
- ✅ 2FA TOTP (RFC 6238) optionnelle.
- ✅ Révocation de sessions (« déconnecter partout »).
- ✅ Détection d'appareils & alerte de connexion (`DeviceMonitor`).
- 🟡 Fournisseur SMS réel pour l'OTP téléphone (`Services\Sms\HttpSmsGateway`).

## A08 — Manque d'intégrité des données et du logiciel
- ✅ CI/CD (lint + tests) et analyse statique PHPStan avant fusion.
- ✅ Migrations versionnées et tracées (`schema_migrations`).
- 🟡 Vérifier la signature/intégrité des artefacts de déploiement.

## A09 — Défaillances de journalisation et de supervision
- ✅ Journalisation structurée JSON (`Services\Logger`) sur erreurs & cron.
- ✅ Journal d'audit des actions sensibles (`ActivityLog`).
- 🟡 Agréger les logs (ELK/Loki), alertes sur pics d'erreurs 5xx / échecs OTP.
- 🟡 Supervision de la file d'envoi (`Outbox::counts` : `failed` > seuil).

## A10 — Falsification de requête côté serveur (SSRF)
- ✅ Pas de récupération d'URL arbitraire fournie par l'utilisateur.
- 🟡 Sorties HTTP restreintes aux domaines prestataires (paiements, SMS, push).

---

## Contrôles complémentaires avant lancement
- [ ] **Sauvegarde/restauration** testée de bout en bout (`scripts/backup.sh`).
- [ ] **Test de charge** chat & signaling (budget p95 défini).
- [ ] **Plan de reprise** (RTO/RPO) documenté.
- [ ] **Pentest léger** (au minimum : IDOR, auth, upload, paiement, CSP bypass).
- [ ] **RGPD** : export/suppression de compte vérifiés, registre de traitement,
      DPA prestataires signés.
- [ ] **18+** : vérification d'âge et modération des contenus sensibles actives.

*Document vivant — à repasser à chaque itération majeure. Amoura © 2026.*
