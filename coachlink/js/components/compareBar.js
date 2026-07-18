/* ==========================================================================
   components/compareBar.js — Barre flottante du comparateur + vue comparative.
   Apparaît dès qu'un coach est ajouté à la comparaison. Se met à jour via
   l'événement cl:compare.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { el } = CL.dom;
  const { compareService, coachService, ui, format } = CL;

  let barre = null;

  function installer() {
    barre = el("div", { class: "compare-bar", id: "compare-bar" });
    document.body.appendChild(barre);
    rendre();
    window.addEventListener("cl:compare", rendre);
  }

  function rendre() {
    if (!barre) return;
    const coachs = compareService.coachs();
    if (!coachs.length) { barre.classList.remove("visible"); CL.dom.vider(barre); return; }
    barre.classList.add("visible");
    CL.dom.vider(barre);

    const vignettes = el("div", { class: "compare-bar__vignettes" }, coachs.map((c) => {
      const v = el("div", { class: "compare-bar__vignette", title: coachService.nomComplet(c) }, [
        ui.avatarCoach(c, "avatar-sm"),
        el("button", { class: "compare-bar__retirer", "aria-label": "Retirer", html: CL.icon("fermer", 12), onclick: () => compareService.retirer(c.id) }),
      ]);
      return v;
    }));
    // Emplacements vides restants.
    for (let i = coachs.length; i < compareService.MAX; i++) {
      vignettes.appendChild(el("div", { class: "compare-bar__vide", text: "+" }));
    }

    const categorie = compareService.categorieActuelle();
    barre.appendChild(el("div", { class: "compare-bar__inner conteneur" }, [
      el("div", { class: "rangee gap-3" }, [
        el("div", { class: "pile" }, [
          el("strong", { class: "texte-sm", html: CL.icon("graphique", 18) + " Comparateur" }),
          categorie ? el("span", { class: "texte-xs texte-faible", text: "Catégorie : " + categorie }) : null,
        ]),
        vignettes,
      ]),
      el("div", { class: "rangee gap-2" }, [
        el("button", { class: "btn btn-fantome btn-sm", text: "Vider", onclick: () => compareService.vider() }),
        el("button", { class: "btn btn-cta btn-sm", disabled: coachs.length < 2 ? "disabled" : null, html: "Comparer (" + coachs.length + ")", onclick: ouvrirComparaison }),
      ]),
    ]));
  }

  function ouvrirComparaison() {
    const coachs = compareService.coachs();
    if (coachs.length < 2) return CL.toast.info("Comparateur", "Ajoutez au moins 2 coachs.");

    const lignes = [
      ["Catégorie", (c) => el("span", { class: "badge badge-reactif", text: c.categorie })],
      ["Titre", (c) => format.tronquer(c.titre, 40)],
      ["TrustScore", (c) => jauge(coachService.trustScore(c))],
      ["Note", (c) => el("span", { class: "rangee gap-2" }, [ui.etoiles(c.note), el("strong", { text: format.note(c.note) })])],
      ["Avis", (c) => String(c.nbAvis)],
      ["Prix (dès)", (c) => el("strong", { text: format.fcfa(coachService.prixMin(c)) })],
      ["Commune", (c) => c.commune],
      ["Langues", (c) => (c.langues || []).join(", ")],
      ["Séances", (c) => String(c.nbSeances)],
      ["Taux de réponse", (c) => c.tauxReponse + " %"],
      ["Badges", (c) => ui.badges(c)],
      ["", (c) => el("a", { class: "btn btn-primaire btn-sm btn-bloc", href: "#/coach/" + c.id, text: "Voir le profil", onclick: () => CL.modal.fermer() })],
    ];

    const table = el("table", { class: "tableau compare-table" }, [
      el("thead", {}, [el("tr", {}, [
        el("th", { text: "" }),
        ...coachs.map((c) => el("th", {}, [
          el("div", { class: "pile", style: "align-items:center;gap:6px;text-align:center" }, [
            ui.avatarCoach(c, "avatar-md"),
            el("strong", { class: "texte-sm", text: coachService.nomComplet(c) }),
          ]),
        ])),
      ])]),
      el("tbody", {}, lignes.map(([label, fn]) => el("tr", {}, [
        el("td", { class: "gras texte-sm", text: label }),
        ...coachs.map((c) => {
          const val = fn(c);
          return el("td", { style: "text-align:center" }, [typeof val === "string" ? document.createTextNode(val) : val]);
        }),
      ]))),
    ]);

    const categorie = compareService.categorieActuelle();
    CL.modal.ouvrir({
      titre: "Comparaison — " + (categorie || "coachs") + " (" + coachs.length + ")",
      large: true,
      contenu: el("div", { class: "table-wrap", style: "border:none" }, [table]),
    });
  }

  function jauge(score) {
    const couleur = score >= 80 ? "var(--vert-validation)" : score >= 60 ? "var(--bleu-confiance)" : "var(--orange-cta)";
    return el("div", { class: "pile", style: "align-items:center;gap:4px" }, [
      el("div", { style: `--p:${score};width:46px;height:46px;border-radius:50%;background:conic-gradient(${couleur} calc(var(--p)*1%),var(--bordure) 0);display:flex;align-items:center;justify-content:center` }, [
        el("span", { style: "width:34px;height:34px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:" + couleur, text: String(score) }),
      ]),
    ]);
  }

  CL.compareBar = { installer, ouvrirComparaison };
})();
