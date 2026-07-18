/* ==========================================================================
   utils/dom.js — Aides DOM & sécurité (échappement XSS, création d'éléments).
   Namespace global : window.CL
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  const dom = {
    /**
     * Échappe les caractères HTML dangereux pour prévenir les injections XSS.
     * À utiliser SYSTÉMATIQUEMENT sur toute entrée utilisateur affichée.
     * @param {*} valeur
     * @returns {string}
     */
    esc(valeur) {
      if (valeur === null || valeur === undefined) return "";
      return String(valeur)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },

    /** Sélecteur court */
    qs(sel, racine) { return (racine || document).querySelector(sel); },
    qsa(sel, racine) { return Array.from((racine || document).querySelectorAll(sel)); },

    /**
     * Crée un élément DOM avec attributs et enfants.
     * @param {string} tag
     * @param {object} attrs  ex: { class:"btn", "data-id":1, onclick:fn }
     * @param {Array|string} enfants
     */
    el(tag, attrs, enfants) {
      const noeud = document.createElement(tag);
      if (attrs) {
        for (const [cle, val] of Object.entries(attrs)) {
          if (val === null || val === undefined || val === false) continue;
          if (cle === "class") noeud.className = val;
          else if (cle === "html") noeud.innerHTML = val;
          else if (cle === "text") noeud.textContent = val;
          else if (cle.startsWith("on") && typeof val === "function") {
            noeud.addEventListener(cle.slice(2).toLowerCase(), val);
          } else if (cle === "dataset") {
            Object.assign(noeud.dataset, val);
          } else {
            noeud.setAttribute(cle, val);
          }
        }
      }
      if (enfants !== undefined) {
        const liste = Array.isArray(enfants) ? enfants : [enfants];
        liste.forEach((enf) => {
          if (enf === null || enf === undefined) return;
          noeud.appendChild(typeof enf === "string" ? document.createTextNode(enf) : enf);
        });
      }
      return noeud;
    },

    /** Délégation d'événements sur un conteneur */
    on(conteneur, evenement, selecteur, gestionnaire) {
      conteneur.addEventListener(evenement, (e) => {
        const cible = e.target.closest(selecteur);
        if (cible && conteneur.contains(cible)) gestionnaire(e, cible);
      });
    },

    /** Vide un conteneur */
    vider(noeud) { while (noeud.firstChild) noeud.removeChild(noeud.firstChild); },

    /** Génère un identifiant unique simple */
    uid(prefixe) {
      return (prefixe || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },

    /** Debounce pour la recherche instantanée */
    debounce(fn, delai) {
      let t;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), delai || 250);
      };
    },
  };

  CL.dom = dom;
})();
