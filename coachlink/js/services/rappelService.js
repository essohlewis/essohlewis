/* ==========================================================================
   services/rappelService.js — Rappels automatiques avant chaque rendez-vous.
   À l'ouverture de l'appli (et après connexion), on parcourt les réservations
   confirmées et les séances d'abonnement actives de l'utilisateur courant :
   pour chaque occurrence à venir « demain » (J-1) ou plus tard dans la journée,
   une notification de rappel est créée — une seule fois par occurrence (anti-
   doublon persistant). Fonctionne côté client (rappelle la cliente) comme côté
   coach (rappelle le coach). Purement local : aucun planificateur serveur requis.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { storage } = CL;
  const CLE_ENVOYES = "cl_rappels_envoyes";

  const jours = () => (CL.format && CL.format.JOURS_COURTS) || ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  /** Prochaine date/heure correspondant à un jour court ("Lun") + heure ("08:00"). */
  function prochaineOccurrence(jourCourt, heure) {
    const idx = jours().indexOf(jourCourt);
    if (idx < 0) return null;
    const [h, m] = String(heure || "00:00").split(":").map(Number);
    const now = new Date();
    const d = new Date(now);
    d.setHours(h || 0, m || 0, 0, 0);
    let delta = (idx - d.getDay() + 7) % 7;
    if (delta === 0 && d <= now) delta = 7; // le créneau d'aujourd'hui est passé → semaine suivante
    d.setDate(d.getDate() + delta);
    return d;
  }

  /** Écart en jours calendaires (0 = aujourd'hui, 1 = demain). */
  function ecartJours(occ) {
    const now = new Date();
    const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const b = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate());
    return Math.round((b - a) / 86400000);
  }

  // Fenêtres de rappel configurables (préférences utilisateur) :
  //   j1 = la veille (J-1) ; h2 = deux heures avant la séance.
  const FENETRES = [
    { cle: "j1", actif: (occ, now) => ecartJours(occ) === 1, quand: () => "demain" },
    { cle: "h2", actif: (occ, now) => (occ - now) / 3600000 <= 2, quand: () => "dans moins de 2 h" },
  ];
  function fenetresActivees() {
    const r = (storage.lire(storage.CLES.prefs, {}) || {}).rappels || {};
    return FENETRES.filter((f) => r[f.cle] !== false); // activées par défaut
  }
  /** Une occurrence est-elle éligible et non passée ? */
  function eligible(occ) { return occ && occ > new Date(); }

  function nomCoach(coachId) {
    const c = CL.coachService && CL.coachService.obtenir(coachId);
    return c ? CL.coachService.nomComplet(c) : "votre coach";
  }
  function termePour(coachId) {
    const c = CL.coachService && CL.coachService.obtenir(coachId);
    return (c && CL.profilCat) ? CL.profilCat.pour(c).terme : "séance";
  }
  function lieuTexte(r) {
    if (!r || !r.lieuType || !CL.profilCat) return "";
    const cfg = CL.profilCat.lieu(r.lieuType);
    const detail = cfg.enLigne ? "en visioconférence" : (CL.localisation ? CL.localisation.resume(r) : "");
    return " — " + (cfg.enLigne ? "en visioconférence" : (cfg.label + (detail ? " (" + detail + ")" : "")));
  }

  const rappels = {
    prochaineOccurrence, eligible,

    /** Génère les rappels dus pour l'utilisateur courant. Renvoie le nombre créé. */
    verifier() {
      if (!CL.auth || !CL.auth.estConnecte()) return 0;
      const u = CL.auth.courant();
      const estCoach = u.role === "coach";
      const monCoach = estCoach && CL.coachCourant ? CL.coachCourant() : null;
      if (estCoach && !monCoach) return 0;

      const fenetres = fenetresActivees();
      if (!fenetres.length) return 0;
      const now = new Date();
      const envoyes = new Set(storage.lire(CLE_ENVOYES, []));
      let n = 0;
      const emettre = (cle, texte, lien) => {
        if (envoyes.has(cle)) return;
        CL.notifications.ajouter(u.id, { type: "rappel", texte, lien });
        envoyes.add(cle); n++;
      };
      // Pour une occurrence donnée, émet un rappel par fenêtre active éligible.
      const planifier = (occ, base, phrase, lien) => {
        if (!eligible(occ)) return;
        const jour = occ.toISOString().slice(0, 10);
        fenetres.forEach((f) => {
          if (!f.actif(occ, now)) return;
          emettre(base + "@" + jour + ":" + f.cle, phrase(f.quand()), lien);
        });
      };

      // 1) Réservations ponctuelles confirmées.
      storage.lire(storage.CLES.bookings, []).forEach((r) => {
        if (r.statut !== "confirmee") return;
        const pourMoi = estCoach ? r.coachId === monCoach.id : r.clientId === u.id;
        if (!pourMoi) return;
        const qui = estCoach ? (r.clientNom || "votre client") : nomCoach(r.coachId);
        const terme = termePour(r.coachId);
        const lien = estCoach ? "#/espace-coach/reservations" : "#/client/reservations";
        planifier(prochaineOccurrence(r.jour, r.heure), "resa:" + r.id,
          (q) => "Rappel : votre " + terme + " avec " + qui + " a lieu " + q + " à " + r.heure + lieuTexte(r) + ".", lien);
      });

      // 2) Séances programmées d'un abonnement actif.
      storage.lire(storage.CLES.abonnements, []).forEach((a) => {
        if (a.statut !== "actif" || !a.programme) return;
        const pourMoi = estCoach ? a.coachId === monCoach.id : a.clientId === u.id;
        if (!pourMoi) return;
        const qui = estCoach ? (a.clientNom || "votre client") : (a.coachNom || "votre coach");
        const terme = termePour(a.coachId);
        const lien = estCoach ? "#/espace-coach/abonnements" : "#/client/abonnements";
        Object.keys(a.programme).forEach((j) => {
          (a.programme[j] || []).forEach((h) => {
            planifier(prochaineOccurrence(j, h), "abo:" + a.id + ":" + j + h,
              (q) => "Rappel : votre " + terme + " d'abonnement avec " + qui + " a lieu " + q + " à " + h + ".", lien);
          });
        });
      });

      if (n) storage.ecrire(CLE_ENVOYES, Array.from(envoyes).slice(-400)); // borne l'historique anti-doublon
      return n;
    },
  };

  CL.rappels = rappels;
})();
