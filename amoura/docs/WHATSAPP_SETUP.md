# 📲 Configurer l'envoi des codes par WhatsApp (Cloud API Meta)

Ce guide explique, **pas à pas**, comment obtenir les identifiants WhatsApp Cloud
API et les brancher dans Amoura pour envoyer les codes de vérification
(inscription, renvoi, mot de passe oublié) par WhatsApp.

> En **développement**, vous n'avez **rien** à configurer : avec `WHATSAPP_DRIVER=log`
> le code s'affiche à l'écran et est écrit dans `storage/logs/whatsapp.log`.
> Ce guide concerne la **production** (`WHATSAPP_DRIVER=cloud`).

---

## 0. Ce qu'il vous faut

- Un compte **Facebook** et un accès à **Meta for Developers** (developers.facebook.com).
- Un **compte Meta Business** (Business Manager) — sera créé automatiquement si besoin.
- Un **numéro de téléphone** dédié à l'envoi (idéalement **pas** un numéro déjà
  utilisé sur l'app WhatsApp classique). Pour les tests, Meta fournit un **numéro
  de test gratuit**.

---

## 1. Créer une application Meta

1. Allez sur **https://developers.facebook.com/apps** → **Créer une application**.
2. Type d'application : choisissez **« Autre »** puis **« Entreprise »** (Business).
3. Donnez un nom (ex. « Amoura »), associez votre compte Business, créez.

## 2. Ajouter le produit WhatsApp

1. Dans le tableau de bord de l'app → **Ajouter des produits** → **WhatsApp** → **Configurer**.
2. Sélectionnez (ou laissez créer) votre **compte WhatsApp Business**.
3. Vous arrivez sur la page **API Setup / Démarrage rapide**.

## 3. Récupérer le `phone_number_id` et un jeton de test

Sur la page **API Setup** :

- **From (Numéro de téléphone)** : Meta affiche un **numéro de test** avec, juste
  en dessous, un **« Phone number ID »** (identifiant à ~15 chiffres).
  → C'est votre **`WHATSAPP_PHONE_ID`**.
- **Temporary access token** : un jeton temporaire (valable **24 h**).
  → Utile pour **tester tout de suite** ; à remplacer par un jeton permanent (étape 5).
- **To** : ajoutez votre **propre numéro WhatsApp** comme destinataire de test
  (le numéro de test ne peut écrire qu'à des numéros **pré-enregistrés**, max 5).

> Vous pouvez déjà tester : mettez `WHATSAPP_DRIVER=cloud`, le token temporaire et
> le `phone_number_id`, puis inscrivez-vous avec votre numéro de test enregistré.

## 4. (Production) Ajouter votre vrai numéro

Quand vous êtes prêt à sortir du bac à sable :

1. Page WhatsApp → **Numéros de téléphone** → **Ajouter un numéro**.
2. Renseignez un numéro que vous contrôlez (SMS/appel de vérification).
3. Une fois vérifié, il obtient son propre **`phone_number_id`** (à utiliser en prod).

## 5. Créer un jeton **permanent** (utilisateur système)

Le jeton temporaire expire en 24 h. Pour la production, créez un **System User** :

1. **business.facebook.com** → **Paramètres d'entreprise** → **Utilisateurs → Utilisateurs système**.
2. **Ajouter** → nom (ex. « amoura-wa »), rôle **Admin**.
3. **Attribuer des actifs** → sélectionnez votre **app** ET votre **compte WhatsApp
   Business** → droits **Gérer** (Full control).
4. **Générer un nouveau jeton** → choisissez l'app → **permissions** :
   `whatsapp_business_messaging` **et** `whatsapp_business_management`.
5. Copiez le **jeton** (affiché **une seule fois**).
   → C'est votre **`WHATSAPP_TOKEN`** (permanent).

## 6. Créer et faire approuver un **modèle d'authentification** (obligatoire)

Pour envoyer un **OTP à un numéro qui ne vous a pas écrit** dans les 24 h (le cas
d'une inscription), WhatsApp **exige un modèle approuvé**. Sans modèle, l'API
refuse (ou n'aboutit que dans la fenêtre de test).

1. **business.facebook.com** → **WhatsApp Manager** → **Modèles de messages** →
   **Créer un modèle**.
2. **Catégorie : Authentification** (choix important — délais d'approbation courts).
3. **Nom** : ex. `amoura_verif` (minuscules + underscores). → **`WHATSAPP_TEMPLATE`**.
4. **Langue** : ex. **Français** (`fr`) — notez le **code** exact. → **`WHATSAPP_LANG`**.
5. Le corps d'un modèle d'authentification est standardisé : il contient un
   paramètre `{{1}}` pour le **code**, et (selon l'UI) un bouton « Copier le code ».
   Amoura envoie le code comme paramètre `{{1}}` — laissez le format par défaut.
6. **Soumettre**. L'approbation prend en général **quelques minutes à quelques heures**.

> Tant que le modèle n'est pas approuvé, gardez `WHATSAPP_TEMPLATE` **vide** :
> Amoura enverra alors un **message texte** (valable uniquement pour vos numéros
> de test). Une fois le modèle approuvé, renseignez son nom.

## 7. Renseigner le `.env`

```dotenv
WHATSAPP_DRIVER=cloud
WHATSAPP_TOKEN=EAAG...            # jeton permanent (étape 5)
WHATSAPP_PHONE_ID=123456789012345 # Phone number ID (étape 3/4)
WHATSAPP_TEMPLATE=amoura_verif    # nom du modèle approuvé (étape 6) — vide sinon
WHATSAPP_LANG=fr                  # code langue du modèle
WHATSAPP_DEFAULT_CC=225           # indicatif ajouté aux numéros locaux (07…→22507…)
WHATSAPP_VERSION=v21.0            # version de l'API (défaut)
```

- **`WHATSAPP_DEFAULT_CC`** : si vos utilisateurs saisissent un numéro **local**
  (ex. `07 12 34 56 78`), indiquez l'indicatif pays (Côte d'Ivoire = `225`) : le
  `0` de tête est remplacé par l'indicatif. S'ils saisissent déjà `+225…`,
  laissez ce champ vide, ce n'est pas nécessaire.

> Ces valeurs peuvent aussi être définies depuis l'**admin** (réglages `whatsapp_*`,
> groupe « messaging ») ; le `.env` reste prioritaire.

## 8. Tester

1. Videz le cache de config si besoin, rechargez l'app.
2. Inscrivez-vous avec un **numéro autorisé** (votre numéro de test tant que vous
   n'êtes pas en production).
3. Vous devez recevoir le code **sur WhatsApp**. En cas d'échec, le message d'erreur
   de l'API est remonté (token invalide, modèle non approuvé, numéro non autorisé…).

---

## Dépannage rapide

| Symptôme | Cause probable | Solution |
|---|---|---|
| `WhatsApp non configuré` | `WHATSAPP_TOKEN` ou `WHATSAPP_PHONE_ID` vide | Renseignez-les dans `.env`. |
| `(#132000) template ... does not exist` | Nom/langue du modèle incorrects ou non approuvé | Vérifiez `WHATSAPP_TEMPLATE` + `WHATSAPP_LANG`, attendez l'approbation. |
| `(#131030) Recipient phone number not in allowed list` | Numéro de test → destinataire non enregistré | Ajoutez le numéro dans **To**, ou passez en production. |
| `(#190) access token ... expired` | Jeton **temporaire** expiré (24 h) | Créez un **jeton permanent** (étape 5). |
| Rien ne part, pas d'erreur | `WHATSAPP_DRIVER` ≠ `cloud` | Mettez `WHATSAPP_DRIVER=cloud`. |

## Alternative : fournisseur tiers

Si vous préférez éviter la configuration Meta directe, des agrégateurs proposent
WhatsApp « clé en main » (Twilio WhatsApp, 360dialog, MessageBird, Termii…). Ils
exposent une API HTTP ; il suffirait d'ajouter un petit pilote « http » à
`WhatsAppService` sur le modèle de la passerelle SMS (`HttpSmsGateway`). Dites-le
si vous voulez ce pilote.
