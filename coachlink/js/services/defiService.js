/* ==========================================================================
   services/defiService.js — Défis lancés par le coach au client.
   Le coach propose un défi (objectif court terme) ; le client le valide
   (réussi) ou l'abandonne. Motivation et engagement partagés.
   >>> Branchement API : /defis … <<<
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { storage } = CL;
  function tous() { return storage.lire(storage.CLES.defis, []); }
  function sauver(l) { storage.ecrire(storage.CLES.defis, l); }
  function _api() { return CL.API && CL.API.actif; }

  const defiService = {
    parClient(clientId) { return tous().filter((d) => d.clientId === clientId).sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe)); },
    parCoach(coachId) { return tous().filter((d) => d.coachId === coachId).sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe)); },
    obtenir(id) { return tous().find((d) => String(d.id) === String(id)) || null; },

    /** Le coach lance un défi. */
    async creer(d) {
      if (_api()) { const x = CL.API.mapDefi(await CL.API.post("/defis", d)); const l = tous(); l.unshift(x); sauver(l); return x; }
      const l = tous();
      const defi = {
        id: CL.dom.uid("defi"), coachId: d.coachId, coachNom: d.coachNom, clientId: d.clientId, clientNom: d.clientNom,
        titre: d.titre, description: d.description || "", echeance: d.echeance || "", statut: "propose",
        creeLe: new Date().toISOString(), valideLe: null,
      };
      l.unshift(defi); sauver(l);
      if (CL.notifications) CL.notifications.ajouter(d.clientId, { type: "info", texte: `Nouveau défi de ${d.coachNom} : « ${d.titre} » 💪`, lien: "#/client" });
      return defi;
    },

    /** Le client change le statut (reussi / echoue). */
    async changerStatut(id, statut) {
      if (_api()) { const x = CL.API.mapDefi(await CL.API.patch("/defis/" + id + "/statut", { statut })); _remplacer(x); return x; }
      const l = tous(); const d = l.find((x) => String(x.id) === String(id));
      if (!d) return null;
      d.statut = statut; d.valideLe = new Date().toISOString(); sauver(l);
      const coach = CL.coachService && CL.coachService.obtenir(d.coachId);
      if (coach && coach.proprietaire && CL.notifications) {
        CL.notifications.ajouter(coach.proprietaire, { type: "info", texte: `${d.clientNom} a ${statut === "reussi" ? "réussi 🎉" : "abandonné"} le défi « ${d.titre} ».`, lien: "#/espace-coach" });
      }
      return d;
    },
  };
  function _remplacer(x) { const l = tous(); const i = l.findIndex((y) => String(y.id) === String(x.id)); if (i >= 0) l[i] = x; else l.unshift(x); sauver(l); }
  CL.defiService = defiService;
})();
