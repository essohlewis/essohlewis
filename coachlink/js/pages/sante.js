/* ==========================================================================
   pages/sante.js — Suivi santé / progrès du client : mensurations,
   courbe de poids, photos avant/après.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};
  const { el } = CL.dom;
  const { auth, mesureService, format } = CL;

  CL.pages.clientSante = function () {
    const u = auth.courant();
    if (!u) { location.hash = "#/connexion"; return el("div"); }
    const zone = el("div", { class: "pile-4" });

    function rendre() {
      CL.dom.vider(zone);
      const mesures = mesureService.parClient(u.id);
      const variation = mesureService.variationPoids(u.id);

      // Résumé.
      const avecPoids = mesures.filter((m) => m.poids != null);
      zone.appendChild(el("div", { class: "grille grille-3" }, [
        CL.statCarte("graphique", "var(--bleu-confiance)", mesures.length, "Mesures"),
        CL.statCarte("portefeuille", "var(--vert-validation)", avecPoids.length ? avecPoids[avecPoids.length - 1].poids + " kg" : "—", "Poids actuel"),
        CL.statCarte("eclair", variation != null && variation <= 0 ? "var(--vert-validation)" : "var(--orange-cta)", variation == null ? "—" : (variation > 0 ? "+" : "") + variation + " kg", "Évolution"),
      ]));

      // Courbe de poids.
      if (avecPoids.length >= 2) {
        zone.appendChild(el("div", { class: "carte carte-corps" }, [el("h4", { class: "mb-2", text: "Courbe de poids (kg)" }), courbePoids(avecPoids)]));
      }

      // Formulaire d'ajout.
      zone.appendChild(formulaire(rendre));

      // Historique + photos avant/après.
      if (mesures.length) {
        zone.appendChild(el("h3", { class: "mt-2 mb-1", text: "Historique" }));
        zone.appendChild(el("div", { class: "pile-3" }, mesures.slice().reverse().map((m) => ligneMesure(m, rendre))));
      } else {
        zone.appendChild(CL.ui.vide("graphique", "Aucune mesure", "Ajoutez votre première mesure pour suivre vos progrès."));
      }
    }
    rendre();

    return el("div", {}, [
      el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Ma progression santé" }), el("p", { text: "Suivez votre poids, vos mensurations et vos photos avant/après." })])]),
      zone,
    ]);
  };

  function courbePoids(mesures) {
    const vals = mesures.map((m) => m.poids);
    const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
    const W = 320, H = 90, pad = 6;
    const pts = mesures.map((m, i) => {
      const x = pad + (i * (W - 2 * pad)) / Math.max(1, mesures.length - 1);
      const y = H - pad - ((m.poids - min) / span) * (H - 2 * pad);
      return x.toFixed(1) + "," + y.toFixed(1);
    });
    const svg = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" height="110" preserveAspectRatio="none">' +
      '<polyline fill="none" stroke="var(--bleu-confiance)" stroke-width="2" points="' + pts.join(" ") + '"/>' +
      pts.map((p) => '<circle cx="' + p.split(",")[0] + '" cy="' + p.split(",")[1] + '" r="2.5" fill="var(--bleu-confiance)"/>').join("") +
      "</svg>";
    const box = el("div"); box.innerHTML = svg;
    box.appendChild(el("div", { class: "rangee entre texte-xs texte-faible mt-1" }, [el("span", { text: min + " kg" }), el("span", { text: max + " kg" })]));
    return box;
  }

  function formulaire(onSave) {
    const inp = (ph, type) => el("input", { class: "input", type: type || "number", step: "0.1", placeholder: ph });
    const poids = inp("Poids (kg)"), taille = inp("Tour de taille (cm)"), hanches = inp("Tour de hanches (cm)"), bras = inp("Tour de bras (cm)");
    const note = el("input", { class: "input", placeholder: "Note (facultatif)" });
    let photo = null;
    const apercu = el("div", { class: "mt-2" });
    const btnPhoto = el("button", { class: "btn btn-fantome btn-sm", type: "button", html: CL.icon("image", 15) + " Ajouter une photo" });
    btnPhoto.addEventListener("click", async () => {
      if (!CL.media) return;
      const d = await CL.media.choisirImage(900, 0.7);
      if (d) { photo = d; CL.dom.vider(apercu); apercu.appendChild(el("img", { src: d, style: "max-width:120px;border-radius:8px" })); }
    });
    const champ = (l, i) => el("div", { class: "champ" }, [el("label", { text: l }), i]);
    return el("div", { class: "carte carte-corps" }, [
      el("h4", { class: "mb-2", text: "Nouvelle mesure" }),
      el("div", { class: "grille grille-2" }, [champ("Poids (kg)", poids), champ("Tour de taille (cm)", taille), champ("Tour de hanches (cm)", hanches), champ("Tour de bras (cm)", bras)]),
      champ("Note", note),
      el("div", { class: "rangee gap-2 rangee-wrap mt-1" }, [btnPhoto, apercu]),
      el("button", { class: "btn btn-cta mt-3", html: CL.icon("check", 16) + " Enregistrer la mesure", onclick: async (e) => {
        if (!poids.value && !taille.value && !hanches.value && !bras.value && !photo) return CL.toast.erreur("Vide", "Renseignez au moins une valeur.");
        e.currentTarget.disabled = true;
        await mesureService.ajouter(auth.courant().id, { poids: poids.value, tourTaille: taille.value, tourHanches: hanches.value, tourBras: bras.value, note: note.value.trim(), photo });
        CL.toast.succes("Mesure enregistrée", "");
        onSave();
      } }),
    ]);
  }

  function ligneMesure(m, onChange) {
    const infos = [m.poids != null ? m.poids + " kg" : null, m.tourTaille ? "taille " + m.tourTaille : null, m.tourHanches ? "hanches " + m.tourHanches : null, m.tourBras ? "bras " + m.tourBras : null].filter(Boolean).join(" · ");
    return el("div", { class: "carte carte-corps rangee entre rangee-wrap gap-3" }, [
      el("div", { class: "rangee gap-3" }, [
        m.photo ? el("img", { src: m.photo, style: "width:64px;height:64px;object-fit:cover;border-radius:8px" }) : null,
        el("div", {}, [
          el("strong", { text: infos || "Mesure" }),
          el("div", { class: "texte-xs texte-faible", text: format.date(m.date) + (m.note ? " · " + m.note : "") }),
        ]),
      ]),
      el("button", { class: "btn-icone btn-fantome", title: "Supprimer", html: CL.icon("poubelle", 16), onclick: async () => { await mesureService.supprimer(m.id); onChange(); } }),
    ]);
  }
})();
