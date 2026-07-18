/* ==========================================================================
   services/evaluationClientService.js — Notation bidirectionnelle : le coach
   évalue le sérieux / la ponctualité du client après une séance.
   >>> Branchement API : /clients/:id/evaluation … <<<
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { storage } = CL;
  function toutes() { return storage.lire(storage.CLES.evaluationsClient, []); }
  function sauver(l) { storage.ecrire(storage.CLES.evaluationsClient, l); }
  function _api() { return CL.API && CL.API.actif; }

  const evaluationClientService = {
    parClient(clientId) { return toutes().filter((e) => e.clientId === clientId).sort((a, b) => new Date(b.date) - new Date(a.date)); },

    /** Note moyenne + nombre d'évaluations d'un client. */
    resume(clientId) {
      const l = evaluationClientService.parClient(clientId);
      if (!l.length) return { note: 0, nb: 0 };
      return { note: Math.round((l.reduce((s, e) => s + (Number(e.note) || 0), 0) / l.length) * 10) / 10, nb: l.length };
    },

    /** Le coach évalue un client. */
    async evaluer(clientId, d) {
      if (_api()) { const x = CL.API.mapEvaluationClient(await CL.API.post("/clients/" + clientId + "/evaluation", d)); const l = toutes(); l.unshift(x); sauver(l); return x; }
      const l = toutes();
      const ev = { id: CL.dom.uid("evc"), clientId, coachId: d.coachId, coachNom: d.coachNom, note: Number(d.note) || 0, texte: d.texte || "", date: new Date().toISOString() };
      l.unshift(ev); sauver(l);
      if (CL.notifications) CL.notifications.ajouter(clientId, { type: "etoile", texte: `${d.coachNom} vous a évalué (${ev.note}★).`, lien: "#/client" });
      return ev;
    },
  };
  CL.evaluationClientService = evaluationClientService;
})();
