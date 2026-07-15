/* ==========================================================================
   pages/howItWorks.js — Page "Comment ça marche" + confiance & sécurité + FAQ.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};
  const { el } = CL.dom;

  CL.pages.commentCaMarche = function () {
    CL.socialService.resetOpenGraph();
    const frag = el("div");

    frag.appendChild(el("section", { class: "hero", style: "padding:var(--e-7) 0" }, [
      el("div", { class: "conteneur texte-centre" }, [
        el("span", { class: "badge badge-reactif mb-3", text: "Simple, transparent, rassurant" }),
        el("h1", { text: "Comment fonctionne CoachLink CI ?" }),
        el("p", { class: "accroche", style: "margin:12px auto 0;max-width:60ch", text: "Nous avons pensé chaque étape pour bâtir la confiance entre coachs et clients." }),
      ]),
    ]));

    // Pour les clients
    frag.appendChild(bloc("Pour les clients", "utilisateur", [
      ["1", "Recherchez", "Filtrez par spécialité, commune, note et budget pour trouver le coach idéal."],
      ["2", "Vérifiez la confiance", "Consultez le TrustScore, les diplômes vérifiés et les avis authentiques."],
      ["3", "Réservez & payez", "Sélectionnez un créneau et réglez en Mobile Money en toute sécurité."],
      ["4", "Évaluez", "Après la séance, laissez un avis pour aider la communauté."],
    ]));

    // Pour les coachs
    frag.appendChild(bloc("Pour les coachs", "diplome", [
      ["1", "Créez votre profil", "Photo, bio, spécialités, tarifs et disponibilités."],
      ["2", "Faites vérifier vos diplômes", "Uploadez vos certifications : notre équipe les valide."],
      ["3", "Recevez des demandes", "Acceptez ou refusez, échangez par messagerie."],
      ["4", "Développez votre réputation", "Séances réalisées, avis et badges construisent votre TrustScore."],
    ], true));

    // Confiance & sécurité
    frag.appendChild(el("section", { class: "section" }, [
      el("div", { class: "conteneur" }, [
        el("div", { class: "section__titre" }, [el("h2", { text: "Confiance & sécurité" })]),
        el("div", { class: "grille grille-3" }, [
          f("bouclier", "Vérification des diplômes", "Aucun badge « Vérifié » sans contrôle humain de nos administrateurs."),
          f("etoile", "Avis contrôlés", "Seules les séances réellement terminées permettent de laisser un avis."),
          f("portefeuille", "Paiement protégé", "Vos transactions Mobile Money sont simulées et jamais partagées."),
        ]),
      ]),
    ]));

    // FAQ
    frag.appendChild(el("section", { class: "section section--alt" }, [
      el("div", { class: "conteneur", style: "max-width:760px" }, [
        el("div", { class: "section__titre" }, [el("h2", { text: "Questions fréquentes" })]),
        faq("Combien coûte l'inscription ?", "L'inscription est 100 % gratuite, pour les clients comme pour les coachs."),
        faq("Comment sont vérifiés les coachs ?", "Chaque diplôme uploadé est examiné par notre équipe avant l'attribution du badge « Vérifié »."),
        faq("Quels moyens de paiement sont acceptés ?", "Orange Money (07), MTN MoMo (05), Moov Money (01) et Wave."),
        faq("Puis-je annuler une réservation ?", "Oui, tant que la séance n'a pas eu lieu, depuis votre espace réservations."),
        faq("Comment fonctionne le TrustScore ?", "C'est un score sur 100 combinant diplômes vérifiés, note moyenne, ancienneté et taux de réponse."),
      ]),
    ]));

    frag.appendChild(el("section", { class: "section" }, [
      el("div", { class: "conteneur" }, [el("div", { class: "cta-final" }, [
        el("h2", { text: "Une question de plus ?" }),
        el("p", { text: "Rejoignez la communauté et découvrez la différence par vous-même." }),
        el("a", { class: "btn btn-cta btn-lg", href: "#/inscription", text: "Créer mon compte gratuitement" }),
      ])]),
    ]));

    return frag;
  };

  function bloc(titre, icone, etapes, alt) {
    return el("section", { class: "section" + (alt ? " section--alt" : "") }, [
      el("div", { class: "conteneur" }, [
        el("div", { class: "rangee gap-3 mb-5" }, [el("div", { class: "fonctionnalite__icone", style: "margin:0", html: CL.icon(icone, 26) }), el("h2", { text: titre })]),
        el("div", { class: "grille grille-4" }, etapes.map(([n, t, d]) => el("div", { class: "carte fonctionnalite" }, [
          el("div", { class: "etape-num", text: n }), el("h3", { text: t }), el("p", { text: d }),
        ]))),
      ]),
    ]);
  }
  function f(icone, titre, texte) {
    return el("div", { class: "carte fonctionnalite" }, [el("div", { class: "fonctionnalite__icone", html: CL.icon(icone, 26, { fill: icone === "etoile" }) }), el("h3", { text: titre }), el("p", { text: texte })]);
  }
  function faq(q, r) {
    const rep = el("div", { style: "max-height:0;overflow:hidden;transition:max-height .3s ease" }, [el("p", { class: "texte-doux", style: "padding:0 0 16px", text: r })]);
    const btn = el("button", { class: "rangee entre", style: "width:100%;padding:16px 0;text-align:left;font-weight:600", html: "<span>" + CL.dom.esc(q) + "</span>" + CL.icon("plus", 18) });
    let ouvert = false;
    btn.addEventListener("click", () => { ouvert = !ouvert; rep.style.maxHeight = ouvert ? rep.scrollHeight + "px" : "0"; });
    return el("div", { style: "border-bottom:1px solid var(--bordure)" }, [btn, rep]);
  }
})();
