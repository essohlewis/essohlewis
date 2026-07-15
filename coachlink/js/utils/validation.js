/* ==========================================================================
   utils/validation.js — Validation systématique des entrées (front sécurisé).
   Inclut la validation du format téléphone ivoirien (07/05/01 + Wave).
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  const validation = {
    /** Email basique */
    email(v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
    },

    /**
     * Téléphone Côte d'Ivoire.
     * Opérateurs : Orange (07), MTN (05), Moov (01). Wave utilise ces mêmes numéros.
     * Accepte 10 chiffres, éventuellement préfixé +225.
     * @returns {boolean}
     */
    telephoneCI(v) {
      const clean = String(v || "").replace(/[\s.\-]/g, "").replace(/^\+225/, "");
      return /^(07|05|01)\d{8}$/.test(clean);
    },

    /** Détermine l'opérateur d'après le préfixe */
    operateurDepuisTel(v) {
      const clean = String(v || "").replace(/[\s.\-]/g, "").replace(/^\+225/, "");
      const p = clean.slice(0, 2);
      if (p === "07") return "Orange Money";
      if (p === "05") return "MTN MoMo";
      if (p === "01") return "Moov Money";
      return null;
    },

    /** Longueur minimale (mot de passe : 6) */
    motDePasse(v) {
      return String(v || "").length >= 6;
    },

    /** Champ non vide */
    requis(v) {
      return String(v || "").trim().length > 0;
    },

    /** Longueur entre min et max */
    longueur(v, min, max) {
      const l = String(v || "").trim().length;
      return l >= (min || 0) && l <= (max || Infinity);
    },

    /**
     * Valide un objet de champs selon un schéma { champ: [regles] }.
     * Retourne { valide:bool, erreurs:{champ:msg} }.
     */
    valider(valeurs, schema) {
      const erreurs = {};
      for (const [champ, regles] of Object.entries(schema)) {
        for (const regle of regles) {
          if (!regle.test(valeurs[champ], valeurs)) {
            erreurs[champ] = regle.message;
            break;
          }
        }
      }
      return { valide: Object.keys(erreurs).length === 0, erreurs };
    },
  };

  CL.validation = validation;
})();
