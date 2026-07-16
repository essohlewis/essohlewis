/* ==========================================================================
   services/litigeService.js — File de litiges (réclamations client ⇄ coach).
   Hors-ligne : amorcée avec une démo. Mode API : hydratée pour l'admin
   (GET /admin/litiges), ouverte par le client (POST /litiges), résolue par
   l'admin (PATCH /admin/litiges/:id).
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { storage } = CL;

  // Données de démonstration (mode hors-ligne uniquement).
  const SEED = [
    { id: "l1", client: "Awa S.", coach: "Koffi Aka", motif: "Séance non honorée", statut: "ouvert", date: "2026-07-10" },
    { id: "l2", client: "Marc B.", coach: "Ismaël Traoré", motif: "Remboursement demandé", statut: "en_cours", date: "2026-07-12" },
  ];

  function _api() { return CL.API && CL.API.actif; }

  const litiges = {
    /** Liste des litiges (hydratée en mode API, amorcée en démo hors-ligne). */
    lister() {
      let l = storage.lire(storage.CLES.litiges, null);
      if (l === null) { l = _api() ? [] : SEED.slice(); storage.ecrire(storage.CLES.litiges, l); }
      return l;
    },

    /** Ouvre un litige (côté client). */
    ouvrir(donnees) {
      const l = litiges.lister();
      const item = {
        id: CL.dom.uid("litige"), client: donnees.client, coach: donnees.coach || "",
        motif: donnees.motif, statut: "ouvert", date: new Date().toISOString(),
      };
      l.unshift(item);
      storage.ecrire(storage.CLES.litiges, l);
      if (_api()) CL.API.post("/litiges", { coachNom: donnees.coach || "", motif: donnees.motif }).catch(() => {});
      return item;
    },

    /** Change le statut d'un litige (côté admin) : ouvert | en_cours | resolu. */
    changerStatut(id, statut) {
      const l = litiges.lister();
      const item = l.find((x) => String(x.id) === String(id));
      if (item) { item.statut = statut; storage.ecrire(storage.CLES.litiges, l); }
      if (_api()) CL.API.patch("/admin/litiges/" + id, { statut }).catch(() => {});
      return !!item;
    },
  };

  CL.litiges = litiges;
})();
