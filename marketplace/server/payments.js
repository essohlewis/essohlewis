/**
 * payments.js — Fournisseurs de paiement (architecture enfichable).
 *
 * Chaque moyen de paiement est un « adaptateur ». En l'absence de clés d'API
 * (variables d'environnement), l'adaptateur bascule sur un **simulateur** qui
 * reproduit fidèlement le déroulé réel du mobile money : on initie la demande,
 * on renvoie une référence + des instructions (USSD / appli), puis le paiement
 * est confirmé par un rappel (webhook côté opérateur, ou action « J'ai payé »
 * en démonstration).
 *
 * Pour passer en production : renseignez les clés (ex. CINETPAY_API_KEY,
 * ORANGE_MONEY_*), et implémentez `initiate`/`verify` réels dans l'adaptateur —
 * le reste de l'application (commandes, statuts, pages) ne change pas.
 */
"use strict";

const crypto = require("crypto");

// Un agrégateur unique (CinetPay/Paystack…) couvre en général tous les opérateurs.
const AGGREGATOR_KEY = process.env.CINETPAY_API_KEY || process.env.PAYSTACK_SECRET_KEY || "";
const LIVE = !!AGGREGATOR_KEY;

/** Catalogue des moyens de paiement proposés en Côte d'Ivoire. */
const METHODS = [
  { id: "cod",    label: "Paiement à la livraison", kind: "cod",    icon: "💵" },
  { id: "orange", label: "Orange Money",            kind: "mobile", icon: "🟠", ussd: "#144#",  color: "#ff7900" },
  { id: "mtn",    label: "MTN MoMo",                kind: "mobile", icon: "🟡", ussd: "*133#",  color: "#ffcc00" },
  { id: "moov",   label: "Moov Money",              kind: "mobile", icon: "🔵", ussd: "*155#",  color: "#0a3d91" },
  { id: "wave",   label: "Wave",                    kind: "mobile", icon: "🌊", app: true,      color: "#1dc3ff" },
  { id: "card",   label: "Carte bancaire",          kind: "card",   icon: "💳" },
];
const byId = (id) => METHODS.find((m) => m.id === id) || null;

/** Liste publique des moyens (avec indication du mode simulateur/production). */
function methods() {
  return METHODS.map((m) => ({ id: m.id, label: m.label, kind: m.kind, icon: m.icon, live: m.kind === "cod" ? true : LIVE }));
}

function fcfa(n) { return (n || 0).toLocaleString("fr-FR") + " FCFA"; }

/**
 * Initie un paiement. Renvoie { reference, instructions, status, live }.
 * status : "paid" (COD accepté immédiatement) ou "pending" (attente de confirmation).
 */
function initiate(methodId, { amount, phone }) {
  const m = byId(methodId);
  if (!m) return { error: "Moyen de paiement inconnu." };
  const reference = "MP-" + crypto.randomBytes(4).toString("hex").toUpperCase();

  if (m.kind === "cod") {
    return { reference, status: "cod", live: true, instructions: "Vous réglerez " + fcfa(amount) + " en espèces à la livraison." };
  }

  // Production : ici on appellerait l'agrégateur (création de transaction, URL de paiement).
  // if (LIVE) { ... appel réseau réel, retour de l'URL/lien opérateur ... }

  // Simulateur (démonstration) : instructions crédibles par opérateur.
  let instructions;
  if (m.kind === "mobile") {
    instructions = m.app
      ? `Ouvrez l'application ${m.label} sur le ${phone || "numéro indiqué"} et validez la demande de paiement de ${fcfa(amount)} (réf. ${reference}).`
      : `Composez ${m.ussd} sur le ${phone || "numéro indiqué"}, choisissez « Paiement marchand », saisissez le montant ${fcfa(amount)} et validez avec votre code secret (réf. ${reference}).`;
  } else {
    instructions = `Vous allez être redirigé vers la page sécurisée pour régler ${fcfa(amount)} par carte (réf. ${reference}).`;
  }
  return { reference, status: "pending", live: LIVE, instructions };
}

/**
 * Vérifie/confirme un paiement (rappel opérateur en production, ou action de démo).
 * En production : on interrogerait l'agrégateur avec la référence.
 */
function verify(/* methodId, reference */) {
  return { status: "paid", live: LIVE };
}

module.exports = { METHODS, methods, byId, initiate, verify, LIVE };
