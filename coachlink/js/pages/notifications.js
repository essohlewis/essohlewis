/* ==========================================================================
   pages/notifications.js — Centre de notifications (tous rôles).
   Liste complète, filtres lu/non-lu, marquer comme lu, accès rapide au lien.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};
  const { el } = CL.dom;
  const { auth, notifications, ui, format } = CL;

  // Icône + couleur selon le type de notification.
  const TYPES = {
    reservation: { icone: "calendrier", couleur: "var(--bleu-confiance)" },
    confirmation: { icone: "check", couleur: "var(--vert-validation)" },
    refus: { icone: "fermer", couleur: "var(--rouge-alerte)" },
    annulation: { icone: "fermer", couleur: "var(--orange-cta)" },
    message: { icone: "message", couleur: "var(--bleu-confiance)" },
    avis: { icone: "etoile", couleur: "var(--jaune-etoile)" },
    paiement: { icone: "portefeuille", couleur: "var(--vert-validation)" },
    info: { icone: "cloche", couleur: "var(--texte-doux)" },
    rappel: { icone: "calendrier", couleur: "var(--orange-cta)" },
  };

  CL.pages.notifications = function () {
    const u = auth.courant();
    let filtre = "toutes"; // toutes | non_lues
    const liste = el("div", { class: "pile-3" });

    function rendre() {
      CL.dom.vider(liste);
      let items = notifications.parUtilisateur(u.id);
      if (filtre === "non_lues") items = items.filter((n) => !n.lu);
      if (!items.length) {
        liste.appendChild(ui.vide("cloche", filtre === "non_lues" ? "Aucune notification non lue" : "Aucune notification", "Vous serez alerté ici des demandes, messages, avis et confirmations."));
        return;
      }
      items.forEach((n) => liste.appendChild(carteNotif(n)));
    }

    function carteNotif(n) {
      const t = TYPES[n.type] || TYPES.info;
      const carte = el("div", { class: "carte carte-corps notif-carte" + (n.lu ? "" : " non-lu"), style: "cursor:pointer" }, [
        el("div", { class: "rangee gap-3", style: "align-items:flex-start" }, [
          el("div", { class: "notif-carte__icone", style: `background:${t.couleur}1a;color:${t.couleur}`, html: CL.icon(t.icone, 20, { fill: n.type === "avis" || n.type === "confirmation" }) }),
          el("div", { style: "flex:1;min-width:0" }, [
            el("div", { class: "rangee entre gap-2" }, [
              el("strong", { class: "texte-sm", text: n.texte }),
              n.lu ? null : el("span", { class: "notif-point" }),
            ]),
            el("div", { class: "texte-xs texte-faible mt-2", text: format.tempsRelatif(n.date) }),
          ]),
        ]),
      ]);
      carte.addEventListener("click", () => {
        notifications.marquerLue(n.id);
        if (n.lien) location.hash = n.lien;
        else rendre();
      });
      return carte;
    }

    const onglets = el("div", { class: "onglets mb-4" }, [
      ["toutes", "Toutes"], ["non_lues", "Non lues"],
    ].map(([cle, label], i) => {
      const o = el("button", { class: "onglet" + (i === 0 ? " actif" : ""), text: label });
      o.addEventListener("click", () => { filtre = cle; onglets.querySelectorAll(".onglet").forEach((x) => x.classList.remove("actif")); o.classList.add("actif"); rendre(); });
      return o;
    }));

    const nbNonLues = notifications.nbNonLues(u.id);
    rendre();

    return el("div", {}, [
      el("div", { class: "page-entete" }, [
        el("div", {}, [el("h1", { text: "Notifications" }), el("p", { text: nbNonLues ? nbNonLues + " notification(s) non lue(s)." : "Vous êtes à jour." })]),
        nbNonLues ? el("button", { class: "btn btn-fantome", html: CL.icon("check", 18) + " Tout marquer lu", onclick: () => { notifications.marquerToutesLues(u.id); CL.toast.succes("Notifications", "Toutes marquées comme lues."); CL.router.rendre(); } }) : null,
      ]),
      onglets,
      liste,
    ]);
  };
})();
