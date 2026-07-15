/* ==========================================================================
   pages/search.js — Recherche & filtres : texte instantané, spécialité,
   commune, note, prix, langue, disponibilité, tri. Squelettes au chargement.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};
  const { el, debounce } = CL.dom;
  const { coachService, ui, format } = CL;

  CL.pages.recherche = function (params) {
    CL.socialService.resetOpenGraph();

    const criteres = {
      texte: params.texte || "",
      specialite: params.specialite || "",
      commune: params.commune || "",
      langue: "",
      noteMin: "",
      prixMax: "",
      dispoJour: "",
      tri: "trust",
    };

    const resultats = el("div");
    const compteur = el("p", { class: "texte-doux" });

    /* ------------------------- Panneau filtres ---------------------- */
    const langues = Array.from(new Set(coachService.lister().flatMap((c) => c.langues))).sort();

    const inputTexte = el("input", { class: "input", type: "search", placeholder: "Nom, spécialité, mot-clé…", value: criteres.texte });
    const inputTexteWrap = el("div", { class: "input-icone" }, [el("span", { html: CL.icon("recherche", 18) }), inputTexte]);
    inputTexte.addEventListener("input", debounce(() => { criteres.texte = inputTexte.value.trim(); lancer(); }, 200));

    const selTri = el("select", { class: "select" }, [
      opt("trust", "Pertinence (TrustScore)"), opt("note", "Meilleures notes"),
      opt("prix_asc", "Prix croissant"), opt("prix_desc", "Prix décroissant"),
    ]);
    selTri.value = criteres.tri;
    selTri.addEventListener("change", () => { criteres.tri = selTri.value; lancer(); });

    // Chips spécialités
    const chipsSpe = el("div", { class: "filtre-chips" });
    const rebuildChips = () => {
      CL.dom.vider(chipsSpe);
      chipsSpe.appendChild(chip("Toutes", "", criteres.specialite === ""));
      coachService.specialites().forEach((s) => chipsSpe.appendChild(chip(s.emoji + " " + s.nom, s.id, criteres.specialite === s.id)));
    };
    function chip(label, val, actif) {
      const c = el("button", { class: "chip" + (actif ? " actif" : ""), text: label });
      c.addEventListener("click", () => { criteres.specialite = val; rebuildChips(); lancer(); });
      return c;
    }
    rebuildChips();

    const selCommune = selectFiltre(["Toutes les communes", ...coachService.communes()], (v, i) => { criteres.commune = i === 0 ? "" : v; lancer(); });
    const selLangue = selectFiltre(["Toutes les langues", ...langues], (v, i) => { criteres.langue = i === 0 ? "" : v; lancer(); });
    const selNote = el("select", { class: "select" }, [opt("", "Toutes les notes"), opt("4.5", "4.5 ★ et +"), opt("4", "4 ★ et +"), opt("3.5", "3.5 ★ et +")]);
    selNote.addEventListener("change", () => { criteres.noteMin = selNote.value; lancer(); });

    const inputPrix = el("input", { class: "input", type: "number", placeholder: "Prix max (FCFA)", min: "0", step: "5000" });
    inputPrix.addEventListener("input", debounce(() => { criteres.prixMax = inputPrix.value; lancer(); }, 300));

    const selJour = el("select", { class: "select" }, [opt("", "N'importe quel jour"), ...format.JOURS_COURTS.map((j) => opt(j, "Disponible " + j))]);
    selJour.addEventListener("change", () => { criteres.dispoJour = selJour.value; lancer(); });

    const btnReset = el("button", { class: "btn btn-fantome btn-bloc btn-sm", text: "Réinitialiser les filtres", onclick: () => {
      Object.assign(criteres, { texte: "", specialite: "", commune: "", langue: "", noteMin: "", prixMax: "", dispoJour: "", tri: "trust" });
      inputTexte.value = ""; selCommune.value = selCommune.options[0].value; selLangue.selectedIndex = 0;
      selNote.value = ""; inputPrix.value = ""; selJour.value = ""; selTri.value = "trust"; rebuildChips(); lancer();
    } });

    const filtres = el("aside", { class: "filtres" }, [
      groupe("Spécialité", chipsSpe),
      groupe("Commune", selCommune),
      groupe("Langue", selLangue),
      groupe("Note minimale", selNote),
      groupe("Budget", inputPrix),
      groupe("Disponibilité", selJour),
      el("div", { class: "mt-4" }, [btnReset]),
    ]);

    /* ---------------------------- Lancement ------------------------- */
    function lancer() {
      // Squelette bref pour l'effet de chargement.
      CL.dom.vider(resultats);
      resultats.appendChild(ui.squelettesCoachs(6));
      setTimeout(() => {
        const liste = coachService.rechercher(criteres);
        CL.dom.vider(resultats);
        compteur.textContent = liste.length + " coach" + (liste.length > 1 ? "s" : "") + " trouvé" + (liste.length > 1 ? "s" : "");
        if (!liste.length) {
          resultats.appendChild(ui.vide("recherche", "Aucun coach trouvé", "Essayez d'élargir vos critères de recherche."));
          return;
        }
        const grille = el("div", { class: "grille grille-coachs" });
        liste.forEach((c) => grille.appendChild(CL.coachCard(c)));
        resultats.appendChild(grille);
      }, 260);
    }

    const page = el("div", { class: "contenu--large" }, [
      el("div", { class: "page-entete" }, [
        el("div", {}, [el("h1", { text: "Trouver un coach" }), compteur]),
      ]),
      el("div", { class: "barre-recherche" }, [inputTexteWrap, el("div", { style: "min-width:220px" }, [selTri])]),
      el("div", { class: "recherche-layout" }, [filtres, resultats]),
    ]);

    lancer();
    return page;
  };

  function groupe(titre, contenu) {
    return el("div", { class: "filtre-groupe" }, [el("h4", { text: titre }), contenu]);
  }
  function opt(v, label) { return el("option", { value: v, text: label }); }
  function selectFiltre(options, onChange) {
    const s = el("select", { class: "select" }, options.map((o) => el("option", { value: o, text: o })));
    s.addEventListener("change", () => onChange(s.value, s.selectedIndex));
    return s;
  }
})();
