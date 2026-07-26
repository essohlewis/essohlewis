/* =============================================================================
   Amoura — délégation d'événements UI (remplace les handlers inline on*).
   Permet une CSP stricte sans 'unsafe-inline' pour les scripts.
   Conventions dans le HTML :
     data-action="fn" [data-arg="x"]   → clic : appelle window.fn(arg, element)
     data-action-change="fn"           → change : appelle window.fn(element)
     data-confirm="message"            → submit : demande confirmation
     data-toggle="elementId"           → clic : bascule la classe .hidden
     data-modal-open="dialogId"        → clic : dialog.showModal()
     data-modal-close[="dialogId"]     → clic : ferme le <dialog> (parent si vide)
   ========================================================================== */
(function () {
  "use strict";

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-action],[data-toggle],[data-modal-open],[data-modal-close]");
    if (!t) return;

    if (t.hasAttribute("data-action")) {
      const fn = window[t.getAttribute("data-action")];
      if (typeof fn === "function") { e.preventDefault(); fn(t.dataset.arg, t); }
      return;
    }
    if (t.hasAttribute("data-toggle")) {
      e.preventDefault();
      const el = document.getElementById(t.getAttribute("data-toggle"));
      if (el) el.classList.toggle("hidden");
      return;
    }
    if (t.hasAttribute("data-modal-open")) {
      e.preventDefault();
      const dlg = document.getElementById(t.getAttribute("data-modal-open"));
      if (dlg && dlg.showModal) dlg.showModal();
      return;
    }
    if (t.hasAttribute("data-modal-close")) {
      const id = t.getAttribute("data-modal-close");
      const dlg = id ? document.getElementById(id) : t.closest("dialog");
      if (dlg && dlg.close) dlg.close();
      // ne pas preventDefault si le bouton est aussi un submit
    }
  });

  document.addEventListener("change", (e) => {
    const t = e.target.closest("[data-action-change]");
    if (!t) return;
    const fn = window[t.getAttribute("data-action-change")];
    if (typeof fn === "function") fn(t);
  });

  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (form.matches && form.matches("[data-confirm]")) {
      if (!window.confirm(form.getAttribute("data-confirm"))) e.preventDefault();
    }
  });
})();
