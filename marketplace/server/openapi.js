/**
 * openapi.js — Contrat d'API OpenAPI 3.0 de Marché CI (généré sans dépendance).
 *
 * La spécification décrit les principaux points d'entrée publics, client, vendeur
 * et administrateur. Elle est servie en JSON (`/api/openapi.json`) et rendue par
 * une page navigable (`/api/docs`). Le serveur monte l'API sous `/api/v1` (chemin
 * canonique) ; `/api` reste un alias rétro-compatible.
 */
"use strict";

const bearer = [{ bearerAuth: [] }];
const adminAuth = [{ adminToken: [] }];

/** Réponse paginée standard { items, total, limit, offset, hasMore }. */
function paged(itemRef) {
  return {
    type: "object",
    properties: {
      ok: { type: "boolean", example: true },
      items: { type: "array", items: itemRef ? { $ref: itemRef } : {} },
      total: { type: "integer", example: 42 },
      limit: { type: "integer", example: 50 },
      offset: { type: "integer", example: 0 },
      hasMore: { type: "boolean", example: false },
    },
  };
}

const pageParams = [
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 500, default: 50 }, description: "Nombre d'éléments (1–500)." },
  { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 }, description: "Décalage." },
];

function op(tag, summary, extra = {}) {
  return { tags: [tag], summary, responses: { 200: { description: "Succès" } }, ...extra };
}

function build({ version = "1.0.0", baseUrl = "/api/v1" } = {}) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Marché CI — API",
      version,
      description:
        "API de la marketplace multi-vendeurs Marché CI (Côte d'Ivoire) : espace " +
        "client (comptes, catalogue, panier, commandes), paiements (mobile money / " +
        "carte), espace vendeur (boutiques, ventes, portefeuille, retraits), " +
        "administration et vérification d'identité (KYC + reconnaissance faciale). " +
        "Chemin canonique : `/api/v1`. `/api` reste un alias rétro-compatible.",
      contact: { name: "Marché CI" },
      license: { name: "Propriétaire" },
    },
    servers: [
      { url: baseUrl, description: "Version 1 (canonique)" },
      { url: "/api", description: "Alias non versionné (rétro-compatibilité)" },
    ],
    tags: [
      { name: "Système", description: "État du service." },
      { name: "Authentification", description: "Inscription, connexion, jetons, 2FA, OTP." },
      { name: "Catalogue", description: "Produits et avis." },
      { name: "Panier & commandes", description: "Panier, passage de commande, suivi." },
      { name: "Paiements", description: "Mobile money, carte, confirmation, webhooks." },
      { name: "Vendeur", description: "Boutique, ventes, portefeuille, retraits." },
      { name: "Administration", description: "Gestion, réconciliation, sauvegardes, schéma." },
      { name: "KYC", description: "Vérification d'identité + reconnaissance faciale + vivacité." },
    ],
    paths: {
      "/shop/health": { get: op("Système", "État de la base client et nombre de produits", { security: [] }) },

      "/shop/register": {
        post: op("Authentification", "Créer un compte client → jeton de session", {
          security: [],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Register" } } } },
          responses: { 200: { description: "Compte créé + jeton", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResult" } } } } },
        }),
      },
      "/shop/login": {
        post: op("Authentification", "Connexion (mot de passe) → jeton, ou 2FA requise", {
          security: [],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Login" } } } },
        }),
      },
      "/shop/login/2fa": { post: op("Authentification", "Seconde étape 2FA (code TOTP)", { security: [] }) },
      "/shop/login/otp/request": { post: op("Authentification", "Demander un code OTP par SMS", { security: [] }) },
      "/shop/login/otp/verify": { post: op("Authentification", "Vérifier l'OTP → jeton de session", { security: [] }) },
      "/shop/login/face": { post: op("Authentification", "Connexion biométrique (selfie vs visage KYC)", { security: [] }) },
      "/shop/refresh": { post: op("Authentification", "Rafraîchir le jeton (rotation)", { security: [] }) },
      "/shop/logout": { post: op("Authentification", "Fermer la session courante", { security: bearer }) },
      "/shop/logout-all": { post: op("Authentification", "Fermer toutes les sessions", { security: bearer }) },
      "/shop/sessions": { get: op("Authentification", "Lister mes sessions (appareils)", { security: bearer }) },
      "/shop/sessions/{id}/revoke": {
        post: op("Authentification", "Révoquer une session précise", {
          security: bearer, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        }),
      },
      "/shop/me": { get: op("Authentification", "Profil du client connecté", { security: bearer }) },
      "/shop/verify/email": { post: op("Authentification", "Vérifier l'e-mail (code)", { security: bearer }) },
      "/shop/password/forgot": { post: op("Authentification", "Demander un code de réinitialisation", { security: [] }) },
      "/shop/password/reset": { post: op("Authentification", "Réinitialiser le mot de passe", { security: [] }) },
      "/shop/password/change": { post: op("Authentification", "Changer de mot de passe (connecté)", { security: bearer }) },
      "/shop/2fa/setup": { post: op("Authentification", "Initialiser la 2FA (secret + URI otpauth)", { security: bearer }) },
      "/shop/2fa/enable": { post: op("Authentification", "Activer la 2FA (confirmer un code)", { security: bearer }) },
      "/shop/2fa/disable": { post: op("Authentification", "Désactiver la 2FA", { security: bearer }) },

      "/shop/products": {
        get: op("Catalogue", "Catalogue paginé", {
          security: [],
          parameters: [
            { name: "category", in: "query", schema: { type: "string" } },
            { name: "q", in: "query", schema: { type: "string" }, description: "Recherche plein texte." },
            { name: "storeId", in: "query", schema: { type: "string" } },
            ...pageParams,
          ],
          responses: { 200: { description: "Liste paginée", content: { "application/json": { schema: paged("#/components/schemas/Product") } } } },
        }),
        post: op("Administration", "Ajouter / mettre à jour des produits", {
          security: adminAuth,
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { products: { type: "array", items: { $ref: "#/components/schemas/Product" } } } } } } },
        }),
      },
      "/shop/products/{id}": {
        get: op("Catalogue", "Détail d'un produit", { security: [], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }),
      },
      "/shop/reviews": {
        get: op("Catalogue", "Avis (paginés) d'une cible + note moyenne", {
          security: [],
          parameters: [
            { name: "targetType", in: "query", schema: { type: "string", enum: ["product", "store"] } },
            { name: "targetId", in: "query", schema: { type: "string" } },
            ...pageParams,
          ],
        }),
        post: op("Catalogue", "Déposer un avis (client)", { security: bearer }),
      },

      "/shop/cart": {
        get: op("Panier & commandes", "Récupérer mon panier", { security: bearer }),
        put: op("Panier & commandes", "Remplacer mon panier", { security: bearer }),
      },
      "/shop/orders": {
        get: op("Panier & commandes", "Mes commandes", { security: bearer }),
        post: op("Panier & commandes", "Passer commande (total recalculé serveur)", {
          security: bearer,
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/OrderInput" } } } },
          responses: { 200: { description: "Commande créée" }, 403: { description: "Vente bloquée (KYC vendeur non validé)" } },
        }),
      },
      "/shop/orders/{id}": {
        get: op("Panier & commandes", "Détail d'une commande", { security: bearer, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }),
      },

      "/shop/payments/methods": { get: op("Paiements", "Moyens de paiement disponibles", { security: [] }) },
      "/shop/payments/initiate": { post: op("Paiements", "Initier un paiement (mobile money / carte)", { security: bearer }) },
      "/shop/payments/{id}/confirm": { post: op("Paiements", "Confirmer un paiement (« J'ai payé »)", { security: bearer, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }) },
      "/shop/payments/webhook/{provider}": { post: op("Paiements", "Webhook fournisseur (confirmation asynchrone)", { security: [], parameters: [{ name: "provider", in: "path", required: true, schema: { type: "string" } }] }) },
      "/shop/payments/{id}": { get: op("Paiements", "État d'un paiement", { security: bearer, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }) },

      "/shop/stores": { post: op("Vendeur", "Créer une boutique (devient vendeur)", { security: bearer }) },
      "/shop/vendor/store": { get: op("Vendeur", "Ma boutique", { security: bearer }) },
      "/shop/vendor/sales": { get: op("Vendeur", "Mes ventes", { security: bearer }) },
      "/shop/vendor/wallet": { get: op("Vendeur", "Portefeuille (escrow / disponible / retiré / commission)", { security: bearer }) },
      "/shop/vendor/payouts": { post: op("Vendeur", "Demander un retrait", { security: bearer }) },

      "/shop/admin/orders": { get: op("Administration", "Toutes les commandes (paginées)", { security: adminAuth, parameters: pageParams }) },
      "/shop/admin/orders/{id}/status": { post: op("Administration", "Changer le statut d'une commande", { security: adminAuth, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }) },
      "/shop/admin/orders/{id}/refund": { post: op("Administration", "Rembourser / annuler une commande", { security: adminAuth, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }) },
      "/shop/admin/stores": { get: op("Administration", "Boutiques (paginées)", { security: adminAuth, parameters: pageParams }) },
      "/shop/admin/stores/{id}/status": { post: op("Administration", "Approuver / suspendre une boutique", { security: adminAuth, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }) },
      "/shop/admin/payments": { get: op("Administration", "Paiements (paginés)", { security: adminAuth, parameters: pageParams }) },
      "/shop/admin/transactions": { get: op("Administration", "Journal comptable (paginé) + réconciliation", { security: adminAuth, parameters: pageParams }) },
      "/shop/admin/payouts": { get: op("Administration", "Retraits vendeurs", { security: adminAuth }) },
      "/shop/admin/payouts/{id}/status": { post: op("Administration", "Valider / refuser un retrait", { security: adminAuth, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] }) },
      "/shop/admin/reviews": { get: op("Administration", "Avis à modérer", { security: adminAuth }) },
      "/shop/admin/stats": { get: op("Administration", "Statistiques (comptes, produits, CA)", { security: adminAuth }) },
      "/shop/admin/schema": { get: op("Administration", "Version de schéma + migrations appliquées", { security: adminAuth }) },
      "/shop/admin/backup": { get: op("Administration", "Export complet de la base (JSON)", { security: adminAuth }) },
      "/shop/admin/restore": { post: op("Administration", "Restaurer la base (remplacement transactionnel)", { security: adminAuth }) },

      "/kyc/health": { get: op("KYC", "État KYC + reconnaissance faciale + vivacité", { security: [] }) },
      "/kyc/liveness": { post: op("KYC", "Vérifier la vivacité (rafale d'images, anti-photo)", { security: [] }) },
      "/kyc/submit": { post: op("KYC", "Soumettre une vérification (pièce + selfie + rafale)", { security: [] }) },
      "/kyc/status": { get: op("KYC", "Statut d'un vendeur", { security: [], parameters: [{ name: "vendorId", in: "query", required: true, schema: { type: "string" } }] }) },
      "/kyc/list": { get: op("KYC", "File des vérifications (admin)", { security: adminAuth, parameters: [{ name: "status", in: "query", schema: { type: "string" } }] }) },
      "/kyc/review": { post: op("KYC", "Décision : approuver / rejeter (admin)", { security: adminAuth }) },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "Jeton de session renvoyé par /shop/login (en-tête Authorization: Bearer …)." },
        adminToken: { type: "apiKey", in: "header", name: "X-Admin-Token", description: "Jeton d'administration (ou session de rôle admin)." },
      },
      schemas: {
        Register: {
          type: "object", required: ["email", "password"],
          properties: { name: { type: "string" }, email: { type: "string", format: "email" }, phone: { type: "string" }, password: { type: "string", minLength: 6 } },
        },
        Login: { type: "object", required: ["email", "password"], properties: { email: { type: "string" }, password: { type: "string" } } },
        AuthResult: {
          type: "object",
          properties: {
            ok: { type: "boolean" }, token: { type: "string" }, refreshToken: { type: "string" },
            expiresAt: { type: "integer" }, user: { $ref: "#/components/schemas/User" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string" }, name: { type: "string" }, email: { type: "string" }, phone: { type: "string" },
            role: { type: "string", enum: ["client", "vendor", "admin"] },
            emailVerified: { type: "boolean" }, phoneVerified: { type: "boolean" }, twofaEnabled: { type: "boolean" },
          },
        },
        Product: {
          type: "object",
          properties: {
            id: { type: "string" }, storeId: { type: "string" }, storeName: { type: "string" },
            name: { type: "string" }, description: { type: "string" },
            price: { type: "integer", description: "Prix en FCFA (entier)." }, currency: { type: "string", example: "FCFA" },
            category: { type: "string" }, image: { type: "string" }, stock: { type: "integer" }, active: { type: "boolean" },
          },
        },
        OrderInput: {
          type: "object", required: ["items"],
          properties: {
            customerName: { type: "string" }, phone: { type: "string" }, address: { type: "string" }, city: { type: "string" },
            paymentMethod: { type: "string", enum: ["cod", "orange", "mtn", "moov", "wave", "card"] },
            note: { type: "string" },
            items: { type: "array", items: { type: "object", properties: { productId: { type: "string" }, qty: { type: "integer", minimum: 1 }, variant: { type: "string" } }, required: ["productId", "qty"] } },
          },
        },
        Error: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } },
      },
    },
  };
}

module.exports = { build };
