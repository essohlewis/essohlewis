/* ==========================================================================
   pages/home.js — Landing : hero, catégories, coachs populaires, confiance,
   comment ça marche, témoignages, CTA final.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};
  const { el } = CL.dom;
  const { coachService, ui, format } = CL;

  CL.pages.home = function () {
    CL.socialService.resetOpenGraph();
    const frag = el("div");

    /* ------------------------------ HERO ---------------------------- */
    const topCoachs = coachService.populaires(2);
    frag.appendChild(el("section", { class: "hero" }, [
      el("div", { class: "conteneur hero__grille" }, [
        el("div", {}, [
          el("span", { class: "badge badge-verifie mb-4", html: CL.icon("bouclier", 14, { fill: true }) + " Coachs vérifiés & notés" }),
          el("h1", {}, [document.createTextNode("Trouvez le "), el("span", { class: "surligne", text: "coach de confiance" }), document.createTextNode(" qu'il vous faut.")]),
          el("p", { class: "accroche", text: "Sport, bien-être, business, scolaire, artistique… Réservez en toute confiance des coachs aux diplômes vérifiés, près de chez vous à Abidjan." }),
          el("div", { class: "hero__cta" }, [
            el("a", { class: "btn btn-cta btn-lg", href: "#/recherche", html: CL.icon("recherche", 18) + " Trouver mon coach" }),
            el("a", { class: "btn btn-fantome btn-lg", href: "#/inscription", html: CL.icon("plus", 18) + " Devenir coach" }),
          ]),
          el("div", { class: "hero__preuves" }, [
            preuve("+" + coachService.lister().length, "Coachs actifs"),
            preuve("+2 500", "Séances réalisées"),
            preuve("4.8/5", "Note moyenne"),
          ]),
        ]),
        el("div", { class: "hero__visuel" }, [
          topCoachs[0] ? CL.coachCard(topCoachs[0]) : null,
          topCoachs[1] ? el("div", { class: "hero__carte-flottante" }, [
            el("div", { class: "rangee gap-2" }, [
              ui.avatarCoach(topCoachs[1], "avatar-sm"),
              el("div", {}, [
                el("strong", { class: "texte-sm", text: coachService.nomComplet(topCoachs[1]) }),
                el("div", { class: "rangee gap-2" }, [ui.etoiles(topCoachs[1].note), el("span", { class: "texte-xs texte-faible", text: format.note(topCoachs[1].note) })]),
              ]),
            ]),
            el("div", { class: "badge badge-verifie mt-2", html: CL.icon("verifie", 12, { fill: true }) + " Diplôme vérifié" }),
          ]) : null,
        ]),
      ]),
    ]));

    /* --------------------------- Catégories ------------------------- */
    const cats = coachService.specialites().slice(0, 8);
    frag.appendChild(el("section", { class: "section section--alt" }, [
      el("div", { class: "conteneur" }, [
        el("div", { class: "section__titre" }, [
          el("h2", { text: "Explorez par catégorie" }),
          el("p", { text: "Un besoin, un expert. Choisissez le domaine qui vous correspond." }),
        ]),
        el("div", { class: "grille grille-4" }, cats.map((s) => {
          const c = el("a", { class: "carte carte-interactive categorie-carte", href: "#/recherche?specialite=" + s.id }, [
            el("div", { class: "categorie-carte__emoji", text: s.emoji }),
            el("strong", { text: s.nom }),
            el("span", { class: "texte-xs texte-faible", text: coachService.rechercher({ specialite: s.id }).length + " coachs" }),
          ]);
          return c;
        })),
      ]),
    ]));

    /* ----------------------- Coachs populaires ---------------------- */
    frag.appendChild(el("section", { class: "section" }, [
      el("div", { class: "conteneur" }, [
        el("div", { class: "rangee entre mb-5" }, [
          el("div", {}, [el("h2", { text: "Coachs les mieux notés" }), el("p", { text: "La confiance construite par la preuve." })]),
          el("a", { class: "btn btn-doux", href: "#/recherche", html: "Voir tout " + CL.icon("fleche_droite", 16) }),
        ]),
        el("div", { class: "grille grille-coachs" }, coachService.populaires(4).map((c) => CL.coachCard(c))),
      ]),
    ]));

    /* --------------------------- Confiance -------------------------- */
    frag.appendChild(el("section", { class: "section section--alt" }, [
      el("div", { class: "conteneur" }, [
        el("div", { class: "section__titre" }, [
          el("h2", { text: "Pourquoi CoachLink CI ?" }),
          el("p", { text: "Nous éliminons le doute pour que vous ne gardiez que la confiance." }),
        ]),
        el("div", { class: "grille grille-3" }, [
          fonctionnalite("bouclier", "Diplômes vérifiés", "Chaque diplôme est contrôlé par notre équipe avant l'obtention du badge « Vérifié »."),
          fonctionnalite("etoile", "Avis authentiques", "Seuls les clients ayant réellement terminé une séance peuvent laisser un avis."),
          fonctionnalite("eclair", "TrustScore transparent", "Un score de confiance calculé sur les diplômes, avis, ancienneté et réactivité."),
          fonctionnalite("portefeuille", "Paiement Mobile Money", "Payez en toute sécurité avec Orange Money, MTN, Moov ou Wave."),
          fonctionnalite("calendrier", "Réservation simple", "Choisissez un créneau, demandez, c'est confirmé. Sans friction."),
          fonctionnalite("message", "Messagerie intégrée", "Échangez directement avec votre coach avant de réserver."),
        ]),
      ]),
    ]));

    /* ----------------------- Comment ça marche ---------------------- */
    frag.appendChild(el("section", { class: "section" }, [
      el("div", { class: "conteneur" }, [
        el("div", { class: "section__titre" }, [el("h2", { text: "Comment ça marche ?" }), el("p", { text: "Trois étapes pour démarrer votre accompagnement." })]),
        el("div", { class: "grille grille-3" }, [
          etape("1", "Recherchez", "Filtrez par spécialité, note, prix et commune d'Abidjan pour trouver la perle rare."),
          etape("2", "Réservez & payez", "Choisissez un créneau et réglez en Mobile Money. Le coach confirme."),
          etape("3", "Progressez", "Suivez vos séances, discutez, puis laissez un avis pour aider la communauté."),
        ]),
      ]),
    ]));

    /* ------------------------- Témoignages -------------------------- */
    frag.appendChild(el("section", { class: "section section--alt" }, [
      el("div", { class: "conteneur" }, [
        el("div", { class: "section__titre" }, [el("h2", { text: "Ils nous font confiance" })]),
        el("div", { class: "grille grille-3" }, [
          temoignage("Awa S.", "Cliente", "J'ai enfin trouvé une coach nutrition sérieuse et diplômée. Résultats au rendez-vous !"),
          temoignage("Koffi A.", "Coach sportif", "La plateforme m'a permis de tripler ma clientèle. Le badge vérifié rassure vraiment."),
          temoignage("Serge N.", "Coach carrière", "Interface pro, paiement simple, et des clients de qualité. Je recommande."),
        ]),
      ]),
    ]));

    /* --------------------------- CTA final -------------------------- */
    frag.appendChild(el("section", { class: "section" }, [
      el("div", { class: "conteneur" }, [
        el("div", { class: "cta-final" }, [
          el("h2", { text: "Prêt à passer au niveau supérieur ?" }),
          el("p", { text: "Rejoignez des milliers d'Ivoiriens qui progressent avec le bon coach." }),
          el("div", { class: "rangee centre gap-4 rangee-wrap" }, [
            el("a", { class: "btn btn-cta btn-lg", href: "#/recherche", text: "Trouver un coach" }),
            el("a", { class: "btn btn-fantome btn-lg", href: "#/inscription", style: "background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.4)", text: "Devenir coach" }),
          ]),
        ]),
      ]),
    ]));

    // Apparition progressive au défilement (sauf le hero, visible d'emblée).
    CL.dom.qsa(".section", frag).forEach((s) => s.classList.add("reveal"));

    return frag;
  };

  function preuve(valeur, label) {
    return el("div", { class: "hero__preuve" }, [el("strong", { text: valeur }), el("span", { text: label })]);
  }
  function fonctionnalite(icone, titre, texte) {
    return el("div", { class: "carte fonctionnalite" }, [
      el("div", { class: "fonctionnalite__icone", html: CL.icon(icone, 26, { fill: icone === "etoile" }) }),
      el("h3", { text: titre }), el("p", { text: texte }),
    ]);
  }
  function etape(num, titre, texte) {
    return el("div", { class: "carte fonctionnalite" }, [
      el("div", { class: "etape-num", text: num }),
      el("h3", { text: titre }), el("p", { text: texte }),
    ]);
  }
  function temoignage(nom, role, texte) {
    return el("div", { class: "carte temoignage" }, [
      ui.etoiles(5),
      el("p", { class: "temoignage__texte mt-3", text: "« " + texte + " »" }),
      el("div", { class: "rangee gap-2" }, [ui.avatarNom(nom, "avatar-sm", "#1b4dcc"), el("div", {}, [el("strong", { class: "texte-sm", text: nom }), el("div", { class: "texte-xs texte-faible", text: role })])]),
    ]);
  }
})();
