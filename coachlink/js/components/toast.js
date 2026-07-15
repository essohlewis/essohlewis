/* ==========================================================================
   components/toast.js — Notifications éphémères (toasts).
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { el, esc } = CL.dom;

  function zone() {
    let z = document.getElementById("toast-zone");
    if (!z) {
      z = el("div", { id: "toast-zone", class: "toast-zone", role: "status", "aria-live": "polite" });
      document.body.appendChild(z);
    }
    return z;
  }

  function afficher(type, titre, message, duree) {
    const icones = { succes: "check", erreur: "fermer", info: "cloche" };
    const t = el("div", { class: `toast toast--${type}` }, [
      el("span", { class: `puce-verifie`, html: CL.icon(icones[type] || "cloche", 20) }),
      el("div", { class: "pile" }, [
        el("div", { class: "toast__titre", text: titre || "" }),
        message ? el("div", { class: "toast__msg", text: message }) : null,
      ]),
    ]);
    zone().appendChild(t);
    const fermer = () => {
      t.classList.add("sortie");
      setTimeout(() => t.remove(), 260);
    };
    t.addEventListener("click", fermer);
    setTimeout(fermer, duree || 3800);
  }

  CL.toast = {
    succes: (titre, msg, d) => afficher("succes", titre, msg, d),
    erreur: (titre, msg, d) => afficher("erreur", titre, msg, d),
    info: (titre, msg, d) => afficher("info", titre, msg, d),
  };
})();
