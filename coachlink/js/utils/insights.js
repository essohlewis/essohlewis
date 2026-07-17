/* ==========================================================================
   utils/insights.js — Données pour les tableaux de bord (client & coach).
   Calculs dérivés du store local (réservations, abonnements, portefeuille) :
   prochaine séance, statistiques, chronologie des revenus. Aucune dépendance.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const S = () => CL.storage;

  function occ(jour, heure) { return CL.rappels ? CL.rappels.prochaineOccurrence(jour, heure) : null; }

  /** Libellé lisible d'une échéance : « aujourd'hui/demain à HH:MM », « Lun à … », date. */
  function libelleQuand(d) {
    if (!d) return "";
    const now = new Date();
    const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dj = Math.round((b - a) / 86400000);
    const hh = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    if (dj <= 0) return "aujourd'hui à " + hh;
    if (dj === 1) return "demain à " + hh;
    const jours = (CL.format && CL.format.JOURS) || [];
    if (dj < 7 && jours.length) return jours[d.getDay()] + " à " + hh;
    return d.toLocaleDateString("fr-FR") + " à " + hh;
  }

  /** Prochaine séance à venir (réservation confirmée ou séance d'abonnement actif). */
  function prochainRendezVous(role, ref) {
    ref = ref || {};
    const now = new Date();
    const items = [];
    S().lire(S().CLES.bookings, []).forEach((r) => {
      if (r.statut !== "confirmee") return;
      const mien = role === "coach" ? r.coachId === ref.coachId : r.clientId === ref.clientId;
      if (!mien) return;
      const o = occ(r.jour, r.heure);
      if (o && o > now) {
        const coach = CL.coachService && CL.coachService.obtenir(r.coachId);
        items.push({ occ: o, avec: role === "coach" ? r.clientNom : (coach ? CL.coachService.nomComplet(coach) : "votre coach"), sous: r.tarifNom, type: "seance", lieuType: r.lieuType });
      }
    });
    S().lire(S().CLES.abonnements, []).forEach((a) => {
      if (a.statut !== "actif" || !a.programme) return;
      const mien = role === "coach" ? a.coachId === ref.coachId : a.clientId === ref.clientId;
      if (!mien) return;
      Object.keys(a.programme).forEach((j) => (a.programme[j] || []).forEach((h) => {
        const o = occ(j, h);
        if (o && o > now) items.push({ occ: o, avec: role === "coach" ? a.clientNom : a.coachNom, sous: "Abonnement · " + a.objectif, type: "abo", lieuType: a.lieuType });
      }));
    });
    items.sort((x, y) => x.occ - y.occ);
    return items[0] || null;
  }

  /** Statistiques du client. */
  function statsClient(userId) {
    const resas = S().lire(S().CLES.bookings, []).filter((r) => r.clientId === userId);
    const abos = S().lire(S().CLES.abonnements, []).filter((a) => a.clientId === userId);
    let investi = 0, seances = 0;
    resas.forEach((r) => { if (r.paiement) investi += Number(r.paiement.montant || r.prix) || 0; if (r.statut === "terminee") seances++; });
    abos.forEach((a) => (a.paiements || []).forEach((p) => { investi += Number(p.montant) || 0; seances += Number(p.seancesValidees) || 0; }));
    const coachs = new Set();
    resas.forEach((r) => coachs.add(r.coachId));
    abos.forEach((a) => coachs.add(a.coachId));
    return {
      seancesRealisees: seances,
      abonnementsActifs: abos.filter((a) => a.statut === "actif").length,
      totalInvesti: investi,
      coachsSuivis: coachs.size,
    };
  }

  /** Statistiques du coach. */
  function statsCoach(coach) {
    const id = coach.id;
    const resas = S().lire(S().CLES.bookings, []).filter((r) => r.coachId === id);
    const abos = S().lire(S().CLES.abonnements, []).filter((a) => a.coachId === id);
    const engagees = resas.filter((r) => r.statut === "confirmee" || r.statut === "terminee");
    const validees = resas.filter((r) => r.presenceValidee).length;
    const tauxPresence = engagees.length ? Math.round((100 * validees) / engagees.length) : null;
    const moisCourant = new Date().toISOString().slice(0, 7);
    let revenusMois = 0;
    resas.forEach((r) => { if (r.presenceValidee && String(r.presenceLe || "").slice(0, 7) === moisCourant) revenusMois += Number((r.paiement && r.paiement.montant) || r.prix) || 0; });
    abos.forEach((a) => (a.paiements || []).forEach((p) => { if (p.libere && String(p.date || "").slice(0, 7) === moisCourant) revenusMois += Number(p.montantLibere || p.montant) || 0; }));
    const clients = new Set();
    resas.forEach((r) => { if (r.statut === "confirmee" || r.statut === "terminee") clients.add(r.clientId); });
    abos.forEach((a) => { if (a.statut === "actif") clients.add(a.clientId); });
    return { tauxPresence, revenusMois, clientsActifs: clients.size, validees };
  }

  /** Revenus des 6 derniers mois (gains libérés), pour l'histogramme. */
  function revenus6Mois(coachId) {
    const buckets = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ cle: d.toISOString().slice(0, 7), label: (CL.format && CL.format.MOIS ? CL.format.MOIS[d.getMonth()].slice(0, 3) : String(d.getMonth() + 1)), montant: 0 });
    }
    const idx = {}; buckets.forEach((b) => (idx[b.cle] = b));
    S().lire(S().CLES.bookings, []).forEach((r) => {
      if (r.coachId !== coachId || !r.presenceValidee) return;
      const k = String(r.presenceLe || r.creeLe || "").slice(0, 7);
      if (idx[k]) idx[k].montant += Number((r.paiement && r.paiement.montant) || r.prix) || 0;
    });
    S().lire(S().CLES.abonnements, []).forEach((a) => {
      if (a.coachId !== coachId) return;
      (a.paiements || []).forEach((p) => { if (!p.libere) return; const k = String(p.date || "").slice(0, 7); if (idx[k]) idx[k].montant += Number(p.montantLibere || p.montant) || 0; });
    });
    return buckets;
  }

  CL.insights = { libelleQuand, prochainRendezVous, statsClient, statsCoach, revenus6Mois };
})();
