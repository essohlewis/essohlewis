# 🔏 Amoura — Conformité RGPD

**Phase 4 (Confiance & conformité).** Registre des traitements, bases légales,
durées de conservation, sous-traitants et exercice des droits. Document de
référence pour le DPO et la revue de conformité avant lancement.

---

## 1. Registre des activités de traitement (art. 30)

| Traitement | Finalité | Base légale | Données | Conservation |
|---|---|---|---|---|
| Compte & authentification | Créer et sécuriser l'accès | Exécution du contrat | E-mail, téléphone, mot de passe (Argon2id), 2FA | Vie du compte + purge à l'effacement |
| Profil & découverte | Proposer des profils pertinents | Exécution du contrat | Photos, bio, âge, localisation, centres d'intérêt, style de vie | Vie du compte |
| Messagerie & appels | Communication entre membres | Exécution du contrat | Messages (chiffrés au repos), métadonnées d'appel | Vie du compte ; messages supprimés purgés à 30 j |
| Paiements & abonnements | Facturation, lutte anti-fraude | Obligation légale (comptable) | Transactions, moyen de paiement (tokenisé) | Registres conservés (loi comptable), PII anonymisée à l'effacement |
| Modération & sécurité | Sécurité, contenus illicites, 18+ | Intérêt légitime | Signalements, score de risque, appareils de connexion | 90 j (signalements traités) ; appareils purgés à l'effacement |
| Notifications & marketing | Engagement, offres | Consentement (marketing) / Intérêt légitime (transactionnel) | E-mail, jetons push | Jusqu'au retrait du consentement |
| Mesure d'audience | Amélioration du service | Consentement (analytics) | Événements anonymisés | Jusqu'au retrait |

---

## 2. Consentements (preuve — art. 7)

Journalisés dans la table **`user_consents`** (append-only) : `purpose`,
`granted`, `version` du document, `ip`, horodatage. Finalités :

- `privacy_policy`, `terms` — recueillis à l'inscription (obligatoires).
- `marketing` — opt-in explicite (case décochée par défaut), révocable.
- `analytics` — opt-in, révocable.

Retrait à tout moment via **Paramètres → Sécurité → Confidentialité**
(`POST /settings/consents`). Chaque changement crée une nouvelle ligne :
l'historique complet constitue la preuve de consentement.

---

## 3. Exercice des droits des personnes

| Droit (article) | Mise en œuvre |
|---|---|
| Accès & portabilité (15, 20) | Export JSON complet — `Services\Gdpr\DataExport`, `GET /settings/data/export` |
| Effacement (17) | Anonymisation + purge atomique — `Services\Gdpr\DataErasure`, `POST /settings/data/delete` |
| Rectification (16) | Édition du profil — `/profile/edit` |
| Retrait du consentement (7-3) | `/settings/consents` |
| Opposition / limitation (18, 21) | Blocage, désinscription marketing, suppression de compte |

**Effacement — détail.** La ligne `users` est **anonymisée** (et non supprimée)
pour préserver l'intégrité référentielle : e-mail/téléphone/nom retirés, mot de
passe rendu irrécupérable, statut `deleted`. Sont purgés : profil (PII), photos
(fichiers + lignes), jetons, sessions, appareils, abonnements push, swipes,
vues de profil, notifications, préférences, blocages. Les **contenus de messages
émis** sont neutralisés. Les **transactions** sont conservées (obligation
comptable) mais dépourvues de PII une fois le compte anonymisé.

---

## 4. Sécurité des données (art. 32)

- Mots de passe : Argon2id. Messages : chiffrés au repos (libsodium).
- TLS 1.2/1.3 obligatoire (voir `deploy/nginx.sample.conf`), HSTS.
- 2FA (TOTP), révocation de sessions, détection d'appareils.
- Journalisation & audit (`Services\Logger`, `ActivityLog`).
- Voir la revue complète : `docs/SECURITE_OWASP.md`.

---

## 5. Sous-traitants (DPA à signer — art. 28)

| Sous-traitant | Rôle | Données transmises | DPA |
|---|---|---|---|
| Stripe / PayPal | Paiements internationaux | E-mail, montant, moyen de paiement | ⬜ à signer |
| CinetPay / PayDunya | Mobile Money (Afrique de l'Ouest) | Téléphone, montant | ⬜ à signer |
| Fournisseur SMTP | E-mails transactionnels | E-mail, contenu | ⬜ à signer |
| Fournisseur SMS | OTP / alertes | Téléphone, contenu | ⬜ à signer |
| Hébergeur / CDN / S3 | Infrastructure, médias | Toutes (chiffrées en transit/au repos) | ⬜ à signer |
| Service push (VAPID) | Notifications navigateur | Jeton d'abonnement | ⬜ à signer |

> Localisation des données : privilégier un hébergement UE/pays adéquat ; pour
> tout transfert hors UE, prévoir des clauses contractuelles types (CCT).

---

## 6. À finaliser avant lancement

- [ ] Signer les DPA de chaque sous-traitant (§5).
- [ ] Publier une politique de confidentialité et des CGU versionnées
      (`policy_version` dans les réglages CMS).
- [ ] Désigner un DPO / point de contact vie privée.
- [ ] Registre des violations + procédure de notification (72 h, art. 33-34).
- [ ] Analyse d'impact (AIPD/DPIA) — données sensibles, contenu 18+.
- [ ] Bandeau cookies/consentement analytics côté front.

*Document vivant — à réviser à chaque évolution des traitements. Amoura © 2026.*
