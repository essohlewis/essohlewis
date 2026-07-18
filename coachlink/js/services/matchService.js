/* ==========================================================================
   services/matchService.js — « CoachMatch » : moteur de recommandation
   intelligent. À partir des réponses d'un client, calcule un score de
   compatibilité (0-100) par coach, avec des raisons explicites.

   Algorithme transparent et pondéré (pas de boîte noire) :
     - Spécialité recherchée .......... 34 pts
     - Budget respecté ................ 16 pts (dégressif)
     - Localisation (commune/ville) ... 16 pts
     - Langue commune ................. 10 pts
     - Disponibilité le jour voulu .... 10 pts
     - Confiance (TrustScore) ......... 14 pts
   >>> Branchement API : POST /coachmatch avec le même schéma de réponses. <<<
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  const matchService = {
    /**
     * Calcule le score de compatibilité d'un coach avec les réponses.
     * @param {object} coach
     * @param {object} r  { specialite, budget, commune, langue, jour }
     * @returns {{score:number, raisons:string[], manques:string[]}}
     */
    scorer(coach, r) {
      let score = 0;
      const raisons = [];
      const manques = [];

      // 1) Spécialité (34) — critère principal.
      if (r.specialite) {
        if ((coach.specialites || []).includes(r.specialite)) {
          score += 34;
          raisons.push("Spécialiste en " + CL.ui.labelSpecialite(r.specialite));
        } else {
          manques.push("Autre spécialité que " + CL.ui.labelSpecialite(r.specialite));
        }
      } else {
        score += 17; // pas de préférence : demi-score neutre
      }

      // 2) Budget (16) — dégressif : plein si prix mini ≤ budget.
      if (r.budget) {
        const prix = CL.coachService.prixMin(coach);
        if (prix <= r.budget) {
          score += 16;
          raisons.push("Dans votre budget (dès " + CL.format.fcfa(prix) + ")");
        } else {
          // Pénalité douce selon dépassement.
          const ratio = r.budget / prix;
          score += Math.max(0, Math.round(16 * ratio - 4));
          manques.push("Un peu au-dessus du budget");
        }
      } else {
        score += 8;
      }

      // 3) Localisation (16).
      if (r.commune) {
        if (coach.commune === r.commune) {
          score += 16;
          raisons.push("Situé à " + coach.commune + " (votre commune)");
        } else if (coach.ville === "Abidjan") {
          score += 8;
          raisons.push("À Abidjan (" + coach.commune + ")");
        }
      } else {
        score += 8;
      }

      // 4) Langue (10).
      if (r.langue) {
        if ((coach.langues || []).includes(r.langue)) {
          score += 10;
          raisons.push("Parle " + r.langue);
        } else {
          manques.push("Ne parle pas " + r.langue);
        }
      } else {
        score += 5;
      }

      // 5) Disponibilité (10).
      if (r.jour) {
        if ((coach.disponibilites[r.jour] || []).length > 0) {
          score += 10;
          raisons.push("Disponible le " + jourLong(r.jour));
        } else {
          manques.push("Peu disponible le " + jourLong(r.jour));
        }
      } else {
        score += 5;
      }

      // 6) Confiance (14) — proportionnel au TrustScore.
      const trust = CL.coachService.trustScore(coach);
      score += Math.round((trust / 100) * 14);
      if (trust >= 80) raisons.push("Très haute confiance (TrustScore " + trust + ")");

      return { score: Math.min(100, Math.round(score)), raisons, manques };
    },

    /**
     * Recommande les meilleurs coachs classés par compatibilité.
     * @param {object} reponses
     * @param {number} n  nombre de résultats (défaut : tous)
     */
    recommander(reponses, n) {
      const res = CL.coachService.lister().map((coach) => {
        const m = matchService.scorer(coach, reponses);
        return { coach, score: m.score, raisons: m.raisons, manques: m.manques };
      });
      res.sort((a, b) => b.score - a.score || b.coach.note - a.coach.note);
      return n ? res.slice(0, n) : res;
    },

    /** Libellé qualitatif d'un score. */
    libelleScore(s) {
      if (s >= 85) return { texte: "Compatibilité excellente", classe: "badge-verifie" };
      if (s >= 70) return { texte: "Très bonne compatibilité", classe: "badge-reactif" };
      if (s >= 50) return { texte: "Bonne compatibilité", classe: "badge-top" };
      return { texte: "Compatibilité modérée", classe: "badge-neutre" };
    },
  };

  function jourLong(court) {
    const idx = CL.format.JOURS_COURTS.indexOf(court);
    return idx >= 0 ? CL.format.JOURS[idx] : court;
  }

  CL.matchService = matchService;
})();
