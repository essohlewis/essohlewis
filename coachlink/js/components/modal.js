/* ==========================================================================
   components/modal.js — Modales génériques (ouverture/fermeture, focus,
   Échap, clic sur l'overlay). Le contenu est fourni par l'appelant.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { el } = CL.dom;

  let overlayCourant = null;

  /**
   * Ouvre une modale.
   * @param {object} opts { titre, contenu(HTMLElement|string), large, pied(HTMLElement),
   *                         surFermeture }
   * @returns {object} { fermer }
   */
  function ouvrir(opts) {
    fermer(); // une seule à la fois
    opts = opts || {};

    const corps = typeof opts.contenu === "string"
      ? el("div", { html: opts.contenu })
      : (opts.contenu || el("div"));

    const btnFermer = el("button", {
      class: "btn-icone btn-fantome", "aria-label": "Fermer",
      html: CL.icon("fermer", 20),
    });

    const modale = el("div", { class: "modale" + (opts.large ? " modale--large" : ""), role: "dialog", "aria-modal": "true" }, [
      el("div", { class: "modale__entete" }, [
        el("h3", { text: opts.titre || "" }),
        btnFermer,
      ]),
      el("div", { class: "modale__corps" }, [corps]),
      opts.pied ? el("div", { class: "modale__pied" }, Array.isArray(opts.pied) ? opts.pied : [opts.pied]) : null,
    ]);

    const overlay = el("div", { class: "modale-overlay" }, [modale]);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) fermer(); });
    btnFermer.addEventListener("click", fermer);

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    overlayCourant = overlay;
    overlayCourant._surFermeture = opts.surFermeture;

    // Focus sur le premier champ si présent.
    setTimeout(() => {
      const focusable = modale.querySelector("input, textarea, select, button");
      focusable && focusable.focus();
    }, 60);

    return { fermer, element: modale };
  }

  function fermer() {
    if (!overlayCourant) return;
    const cb = overlayCourant._surFermeture;
    overlayCourant.remove();
    overlayCourant = null;
    document.body.style.overflow = "";
    if (typeof cb === "function") cb();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlayCourant) fermer();
  });

  CL.modal = { ouvrir, fermer };
})();
