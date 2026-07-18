/* ==========================================================================
   services/mesureService.js — Suivi santé / progrès du client.
   Mensurations horodatées (poids, tours) + photo avant/après facultative.
   >>> Branchement API : /mesures … <<<
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { storage } = CL;
  function toutes() { return storage.lire(storage.CLES.mesures, []); }
  function sauver(l) { storage.ecrire(storage.CLES.mesures, l); }
  function _api() { return CL.API && CL.API.actif; }

  const mesureService = {
    /** Mesures d'un client, triées par date croissante (pour les courbes). */
    parClient(clientId) { return toutes().filter((m) => m.clientId === clientId).sort((a, b) => new Date(a.date) - new Date(b.date)); },

    async ajouter(clientId, d) {
      if (_api()) { const x = CL.API.mapMesure(await CL.API.post("/mesures", d)); const l = toutes(); l.push(x); sauver(l); return x; }
      const l = toutes();
      const m = {
        id: CL.dom.uid("mes"), clientId, date: d.date || new Date().toISOString(),
        poids: d.poids != null && d.poids !== "" ? Number(d.poids) : null,
        tourTaille: d.tourTaille ? Number(d.tourTaille) : null,
        tourHanches: d.tourHanches ? Number(d.tourHanches) : null,
        tourBras: d.tourBras ? Number(d.tourBras) : null,
        note: d.note || "", photo: d.photo || null,
      };
      l.push(m); sauver(l);
      return m;
    },

    async supprimer(id) {
      if (_api()) { try { await CL.API.supprimer("/mesures/" + id); } catch (_) {} }
      sauver(toutes().filter((m) => String(m.id) !== String(id)));
    },

    /** Variation de poids entre la première et la dernière mesure. */
    variationPoids(clientId) {
      const l = mesureService.parClient(clientId).filter((m) => m.poids != null);
      if (l.length < 2) return null;
      return Math.round((l[l.length - 1].poids - l[0].poids) * 10) / 10;
    },
  };
  CL.mesureService = mesureService;
})();
