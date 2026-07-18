/* ==========================================================================
   utils/gamification.js — Badges & niveaux du client (motivation).
   Dérivé des statistiques (séances réalisées, abonnements, coachs suivis).
   Aucune dépendance. Purement calculé : aucune donnée à stocker.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  const PALIERS = [0, 1, 5, 10, 25, 50, 100];
  const NIVEAUX = ["Débutant", "Initié", "Régulier", "Assidu", "Confirmé", "Champion", "Légende"];

  function stats(userId) {
    return (CL.insights ? CL.insights.statsClient(userId) : { seancesRealisees: 0, abonnementsActifs: 0, coachsSuivis: 0, totalInvesti: 0 });
  }

  const gamification = {
    /** Niveau selon le nombre de séances réalisées : { niveau, nom, seances, suivant, restant, progres }. */
    niveau(userId) {
      const n = stats(userId).seancesRealisees;
      let niv = 0;
      for (let i = 0; i < PALIERS.length; i++) if (n >= PALIERS[i]) niv = i;
      const suivant = PALIERS[niv + 1] || null;
      const base = PALIERS[niv];
      const progres = suivant ? Math.min(1, (n - base) / (suivant - base)) : 1;
      return { niveau: niv, nom: NIVEAUX[niv] || "Champion", seances: n, suivant, restant: suivant ? suivant - n : 0, progres };
    },

    /** Liste de badges avec état (acquis / progression). */
    badges(userId) {
      const st = stats(userId);
      const defs = [
        { cle: "premiere", icone: "etoile", titre: "Première séance", desc: "Réaliser sa première séance", seuil: 1, valeur: st.seancesRealisees },
        { cle: "regulier", icone: "eclair", titre: "Régulier", desc: "5 séances réalisées", seuil: 5, valeur: st.seancesRealisees },
        { cle: "assidu", icone: "pouce", titre: "Assidu", desc: "10 séances réalisées", seuil: 10, valeur: st.seancesRealisees },
        { cle: "champion", icone: "diplome", titre: "Champion", desc: "25 séances réalisées", seuil: 25, valeur: st.seancesRealisees },
        { cle: "engage", icone: "coeur", titre: "Engagé", desc: "Souscrire un abonnement", seuil: 1, valeur: st.abonnementsActifs },
        { cle: "explorateur", icone: "globe", titre: "Explorateur", desc: "Suivre 2 coachs différents", seuil: 2, valeur: st.coachsSuivis },
      ];
      return defs.map((d) => ({
        cle: d.cle, icone: d.icone, titre: d.titre, desc: d.desc,
        acquis: d.valeur >= d.seuil, progres: Math.min(1, d.valeur / d.seuil),
      }));
    },
  };

  CL.gamification = gamification;
})();
