/* ==========================================================================
   services/compareService.js — Comparateur de coachs.
   Gère une sélection (max 3) persistée, pour une comparaison côte à côte.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { storage } = CL;
  const CLE = "comparateur";
  const MAX = 3;

  const compareService = {
    MAX,
    liste() { return storage.lire(CLE, []); },
    contient(id) { return compareService.liste().includes(id); },
    nombre() { return compareService.liste().length; },

    /** Catégorie de la sélection en cours (ou null si vide). */
    categorieActuelle() {
      const l = compareService.liste();
      if (!l.length) return null;
      const c = CL.coachService.obtenir(l[0]);
      return c ? c.categorie : null;
    },

    /**
     * Ajoute/retire un coach au comparateur.
     * Règle métier : on ne compare que des coachs de la MÊME catégorie
     * (un coach sportif ne se compare pas à un coach nutrition, etc.).
     * @returns {{actif:boolean, plein?:boolean, categorieDifferente?:boolean, categorie?:string}}
     */
    basculer(id) {
      let l = compareService.liste();
      if (l.includes(id)) {
        l = l.filter((x) => x !== id);
        storage.ecrire(CLE, l);
        window.dispatchEvent(new CustomEvent("cl:compare"));
        return { actif: false };
      }
      if (l.length >= MAX) return { actif: false, plein: true };

      // Vérifie la cohérence de catégorie.
      const nouveau = CL.coachService.obtenir(id);
      const catActuelle = compareService.categorieActuelle();
      if (catActuelle && nouveau && nouveau.categorie !== catActuelle) {
        return { actif: false, categorieDifferente: true, categorie: catActuelle };
      }

      l.push(id);
      storage.ecrire(CLE, l);
      window.dispatchEvent(new CustomEvent("cl:compare"));
      return { actif: true };
    },

    retirer(id) {
      storage.ecrire(CLE, compareService.liste().filter((x) => x !== id));
      window.dispatchEvent(new CustomEvent("cl:compare"));
    },

    vider() {
      storage.ecrire(CLE, []);
      window.dispatchEvent(new CustomEvent("cl:compare"));
    },

    /** Coachs sélectionnés (objets). */
    coachs() {
      return compareService.liste().map((id) => CL.coachService.obtenir(id)).filter(Boolean);
    },
  };

  CL.compareService = compareService;
})();
