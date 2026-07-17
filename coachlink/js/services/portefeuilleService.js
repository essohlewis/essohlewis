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
        // Uniquement les mensualités LIBÉRÉES du séquestre (toutes séances validées).
        (a.paiements || []).forEach((p) => { if (!p.libere) return; ops.push({ type: "abonnement",
          libelle: "Abonnement (" + p.mois + ") — " + a.clientNom, montant: Number(p.montant) || 0,
          reference: p.reference, date: p.date }); });
      });
      storage.lire(storage.CLES.retraits, []).forEach((rt) => {
        if (rt.coachId !== coachId) return;
        ops.push({ type: "retrait", libelle: "Retrait " + rt.operateur + " — " + rt.numero,
          montant: -(Number(rt.montant) || 0), reference: rt.reference, date: rt.date });
      });
      ops.sort((x, y) => String(y.date).localeCompare(String(x.date)));
      const solde = ops.reduce((s, o) => s + (Number(o.montant) || 0), 0);
      return { solde, operations: ops };
    },

    /** Retrait du portefeuille vers Mobile Money. Renvoie { ok, solde?, operations?, message? }. */
    async retirer(coachId, d) {
      const montant = Math.round(Number(d.montant) || 0);
      if (montant < 500) return { ok: false, message: "Montant minimum de retrait : 500 FCFA." };
      if (!d.numero) return { ok: false, message: "Numéro Mobile Money requis." };
      const { solde } = await portefeuille.pour(coachId);
      if (montant > solde) return { ok: false, message: "Solde insuffisant (disponible : " + solde + " FCFA)." };

      if (CL.API && CL.API.actif) {
        try {
          const res = await CL.API.retirerPortefeuille({ montant, operateur: d.operateur, numero: d.numero });
          return { ok: true, solde: Number(res.solde) || 0, operations: res.operations || [] };
        } catch (e) { return { ok: false, message: (e && e.message) || "Retrait impossible." }; }
      }
      const liste = storage.lire(storage.CLES.retraits, []);
      liste.unshift({ id: CL.dom.uid("rt"), coachId, montant, operateur: d.operateur, numero: d.numero,
        statut: "effectue", reference: "RT" + Date.now().toString().slice(-8), date: new Date().toISOString() });
      storage.ecrire(storage.CLES.retraits, liste);
      if (CL.notifications) {
        const u = CL.auth && CL.auth.courant();
        if (u) CL.notifications.ajouter(u.id, { type: "paiement", texte: "Retrait de " + CL.format.fcfa(montant) + " vers " + d.operateur + " effectué.", lien: "#/espace-coach/portefeuille" });
      }
      const maj = await portefeuille.pour(coachId);
      return { ok: true, solde: maj.solde, operations: maj.operations };
    },
  };

  CL.portefeuille = portefeuille;
})();
