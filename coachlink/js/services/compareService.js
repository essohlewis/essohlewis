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

    /** Ajoute/retire un coach. Retourne { actif, plein }. */
    basculer(id) {
      let l = compareService.liste();
      if (l.includes(id)) {
        l = l.filter((x) => x !== id);
        storage.ecrire(CLE, l);
        window.dispatchEvent(new CustomEvent("cl:compare"));
        return { actif: false, plein: false };
      }
      if (l.length >= MAX) return { actif: false, plein: true };
      l.push(id);
      storage.ecrire(CLE, l);
      window.dispatchEvent(new CustomEvent("cl:compare"));
      return { actif: true, plein: false };
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
