/* ==========================================================================
   services/portefeuilleService.js — Portefeuille du coach (modèle séquestre).
   Le solde regroupe : les séances dont la PRÉSENCE a été validée (QR scanné en
   fin de séance) et les règlements mensuels d'abonnement. Les fonds ne sont
   crédités qu'une fois la prestation prouvée / réglée.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { storage } = CL;

  const portefeuille = {
    /** Renvoie { solde, operations:[{type,libelle,montant,reference,date}] }. */
    async pour(coachId) {
      if (CL.API && CL.API.actif) {
        try {
          const d = await CL.API.portefeuille();
          return { solde: Number(d.solde) || 0, operations: d.operations || [] };
        } catch (_) { /* repli local */ }
      }
      const ops = [];
      storage.lire(storage.CLES.bookings, []).forEach((r) => {
        if (r.coachId !== coachId || !r.presenceValidee) return;
        const montant = (r.paiement && r.paiement.montant) ? r.paiement.montant : r.prix;
        ops.push({ type: "seance", libelle: r.tarifNom + " — " + r.clientNom, montant: Number(montant) || 0,
          reference: (r.paiement && r.paiement.reference) || ("SE" + r.id), date: r.presenceLe || r.creeLe });
      });
      storage.lire(storage.CLES.abonnements, []).forEach((a) => {
        if (a.coachId !== coachId) return;
        (a.paiements || []).forEach((p) => ops.push({ type: "abonnement",
          libelle: "Abonnement (" + p.mois + ") — " + a.clientNom, montant: Number(p.montant) || 0,
          reference: p.reference, date: p.date }));
      });
      ops.sort((x, y) => String(y.date).localeCompare(String(x.date)));
      const solde = ops.reduce((s, o) => s + (Number(o.montant) || 0), 0);
      return { solde, operations: ops };
    },
  };

  CL.portefeuille = portefeuille;
})();
