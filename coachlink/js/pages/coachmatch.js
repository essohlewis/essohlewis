/* ==========================================================================
   pages/coachmatch.js — « CoachMatch » : assistant de recommandation
   intelligent. Mini-questionnaire → coachs classés par compatibilité, avec
   score et raisons explicites. S'appuie sur CL.matchService.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};
  const { el } = CL.dom;
  const { coachService, matchService, ui, format } = CL;

  CL.pages.coachmatch = function () {
    CL.socialService.resetOpenGraph();
    const etat = { etape: 0, reponses: { specialite: "", budget: null, commune: "", langue: "", jour: "" } };
    const langues = Array.from(new Set(coachService.lister().flatMap((c) => c.langues))).sort();

    const etapes = [
      {
        cle: "specialite", titre: "Quel est votre objectif ?", sousTitre: "Choisissez le domaine qui vous intéresse (ou passez).",
        rendre: () => grilleChoix(coachService.specialites().map((s) => ({ val: s.id, label: s.nom, emoji: s.emoji })), "specialite"),
      },
      {
        cle: "budget", titre: "Quel est votre budget par séance ?", sousTitre: "Une estimation suffit.",
        rendre: () => grilleChoix([
          { val: 8000, label: "≤ 8 000 FCFA", emoji: "💵" },
          { val: 15000, label: "≤ 15 000 FCFA", emoji: "💳" },
          { val: 30000, label: "≤ 30 000 FCFA", emoji: "💰" },
          { val: 999999, label: "Peu importe", emoji: "✨" },
        ], "budget"),
      },
      {
        cle: "commune", titre: "Où souhaitez-vous être coaché ?", sousTitre: "Sélectionnez votre commune à Abidjan.",
        rendre: () => selectChoix(["Peu importe", ...coachService.communes()], "commune"),
      },
      {
        cle: "langue", titre: "Dans quelle langue ?", sousTitre: "La langue de vos séances.",
        rendre: () => selectChoix(["Peu importe", ...langues], "langue"),
      },
      {
        cle: "jour", titre: "Quel jour êtes-vous disponible ?", sousTitre: "Pour trouver un coach avec des créneaux libres.",
        rendre: () => grilleChoix(format.JOURS_COURTS.map((j, i) => ({ val: j, label: format.JOURS[i], emoji: "📅" })), "jour"),
      },
    ];

    const zone = el("div", { class: "carte carte-corps", style: "max-width:720px;margin:0 auto" });

    function rendreEtape() {
      CL.dom.vider(zone);
      // Barre de progression
      const points = el("div", { class: "etapes" });
      for (let i = 0; i < etapes.length; i++) {
        points.appendChild(el("div", { class: "etape-point " + (i < etat.etape ? "faite" : i === etat.etape ? "active" : "") }));
      }
      zone.appendChild(points);

      const e = etapes[etat.etape];
      zone.appendChild(el("div", { class: "texte-centre mb-4" }, [
        el("span", { class: "badge badge-reactif", text: "Étape " + (etat.etape + 1) + " / " + etapes.length }),
        el("h2", { class: "mt-3", text: e.titre }),
        el("p", { text: e.sousTitre }),
      ]));
      zone.appendChild(e.rendre());

      // Navigation
      const nav = el("div", { class: "rangee entre mt-5" }, [
        el("button", { class: "btn btn-fantome", html: CL.icon("fleche_gauche", 16) + " Retour", disabled: etat.etape === 0 ? "disabled" : null, onclick: () => { if (etat.etape > 0) { etat.etape--; rendreEtape(); } } }),
        el("div", { class: "rangee gap-2" }, [
          el("button", { class: "btn-lien", text: "Passer", onclick: suivant }),
          el("button", { class: "btn btn-cta", html: (etat.etape === etapes.length - 1 ? "Voir mes résultats " : "Continuer ") + CL.icon("fleche_droite", 16), onclick: suivant }),
        ]),
      ]);
      zone.appendChild(nav);
    }

    function suivant() {
      if (etat.etape < etapes.length - 1) { etat.etape++; rendreEtape(); }
      else afficherResultats();
    }

    /* --- Composants de choix --- */
    function grilleChoix(options, cle) {
      const grille = el("div", { class: "grille grille-auto" });
      options.forEach((o) => {
        const actif = String(etat.reponses[cle]) === String(o.val);
        const carte = el("button", { class: "option-carte" + (actif ? " actif" : ""), style: "flex-direction:column;text-align:center;align-items:center;gap:8px" }, [
          el("div", { style: "font-size:1.8rem", text: o.emoji }),
          el("strong", { class: "texte-sm", text: o.label }),
        ]);
        carte.addEventListener("click", () => {
          etat.reponses[cle] = (etat.reponses[cle] === o.val) ? "" : o.val;
          rendreEtape();
        });
        grille.appendChild(carte);
      });
      return grille;
    }

    function selectChoix(options, cle) {
      const sel = el("select", { class: "select", style: "max-width:360px;margin:0 auto;display:block" },
        options.map((o, i) => el("option", { value: i === 0 ? "" : o, text: o, selected: (etat.reponses[cle] || "") === (i === 0 ? "" : o) ? "selected" : null })));
      sel.addEventListener("change", () => { etat.reponses[cle] = sel.value; });
      return el("div", { class: "champ" }, [sel]);
    }

    /* --- Résultats --- */
    function afficherResultats() {
      const budget = etat.reponses.budget === 999999 ? null : etat.reponses.budget;
      const reponses = Object.assign({}, etat.reponses, { budget });
      const resultats = matchService.recommander(reponses, 6);

      CL.dom.vider(page);
      page.appendChild(el("div", { class: "page-entete" }, [
        el("div", {}, [
          el("h1", { html: CL.icon("eclair", 26, { fill: true }) + " Vos coachs recommandés" }),
          el("p", { text: "Classés par compatibilité avec vos réponses. " + resultats.length + " suggestions." }),
        ]),
        el("button", { class: "btn btn-fantome", html: CL.icon("fleche_gauche", 16) + " Refaire le test", onclick: () => { etat.etape = 0; etat.reponses = { specialite: "", budget: null, commune: "", langue: "", jour: "" }; CL.dom.vider(page); page.appendChild(intro); page.appendChild(zone); rendreEtape(); window.scrollTo(0, 0); } }),
      ]));

      // Podium : le meilleur match mis en avant.
      const top = resultats[0];
      if (top) {
        page.appendChild(el("div", { class: "carte carte-corps mb-4", style: "border:2px solid var(--vert-validation)" }, [
          el("div", { class: "rangee gap-4 rangee-wrap", style: "align-items:center" }, [
            anneauScore(top.score, 84),
            el("div", { style: "flex:1;min-width:200px" }, [
              el("span", { class: "badge badge-verifie mb-2", html: CL.icon("etoile", 12, { fill: true }) + " Meilleure correspondance" }),
              el("h3", {}, [document.createTextNode(coachService.nomComplet(top.coach) + " ")]),
              el("p", { class: "texte-sm texte-doux", text: top.coach.titre }),
              el("div", { class: "rangee rangee-wrap gap-2 mt-2" }, top.raisons.slice(0, 4).map((r) => el("span", { class: "chip chip-statique texte-xs", html: CL.icon("check", 12) + " " + CL.dom.esc(r) }))),
            ]),
            el("a", { class: "btn btn-cta", href: "#/coach/" + top.coach.id, html: "Voir le profil " + CL.icon("fleche_droite", 16) }),
          ]),
        ]));
      }

      const grille = el("div", { class: "grille grille-coachs" });
      resultats.slice(1).forEach((res) => grille.appendChild(carteResultat(res)));
      page.appendChild(grille);
      window.scrollTo(0, 0);
    }

    function carteResultat(res) {
      const lib = matchService.libelleScore(res.score);
      const carte = el("article", { class: "carte carte-interactive", style: "overflow:hidden" }, [
        el("div", { style: "padding:var(--e-5)" }, [
          el("div", { class: "rangee entre" }, [
            el("div", { class: "rangee gap-3" }, [
              ui.avatarCoach(res.coach, "avatar-md"),
              el("div", {}, [el("strong", { text: coachService.nomComplet(res.coach) }), el("div", { class: "texte-sm texte-doux", text: format.tronquer(res.coach.titre, 32) })]),
            ]),
            anneauScore(res.score, 56),
          ]),
          el("div", { class: "rangee rangee-wrap gap-2 mt-3" }, [el("span", { class: "badge " + lib.classe, text: lib.texte })]),
          el("ul", { class: "mt-3 pile-2" }, res.raisons.slice(0, 3).map((r) => el("li", { class: "rangee gap-2 texte-sm texte-doux", html: '<span style="color:var(--vert-validation)">' + CL.icon("check", 14) + "</span> " + CL.dom.esc(r) }))),
          el("a", { class: "btn btn-primaire btn-bloc mt-4", href: "#/coach/" + res.coach.id, text: "Voir le profil" }),
        ]),
      ]);
      return carte;
    }

    /* --- Anneau de score circulaire --- */
    function anneauScore(score, taille) {
      const couleur = score >= 85 ? "var(--vert-validation)" : score >= 70 ? "var(--bleu-confiance)" : score >= 50 ? "var(--orange-cta)" : "var(--texte-faible)";
      const interne = Math.round(taille * 0.74);
      return el("div", {
        style: `--p:${score};width:${taille}px;height:${taille}px;flex-shrink:0;border-radius:50%;background:conic-gradient(${couleur} calc(var(--p)*1%), var(--bordure) 0);display:flex;align-items:center;justify-content:center`,
      }, [
        el("div", { style: `width:${interne}px;height:${interne}px;border-radius:50%;background:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1` }, [
          el("strong", { style: `font-size:${Math.round(taille * 0.26)}px;color:${couleur}`, text: score + "%" }),
          taille > 70 ? el("span", { class: "texte-xs texte-faible", text: "match" }) : null,
        ]),
      ]);
    }

    /* --- Intro --- */
    const intro = el("div", { class: "texte-centre", style: "max-width:640px;margin:0 auto var(--e-5)" }, [
      el("span", { class: "badge badge-nouveau", html: CL.icon("eclair", 13, { fill: true }) + " Nouveau" }),
      el("h1", { class: "mt-3", text: "CoachMatch — Trouvez votre coach idéal" }),
      el("p", { class: "texte-lg", text: "Répondez à 5 questions rapides. Notre algorithme de compatibilité vous propose les coachs les plus adaptés à vos besoins, avec une explication claire." }),
    ]);

    const page = el("div", { class: "contenu--large" }, [intro, zone]);
    rendreEtape();
    return page;
  };
})();
