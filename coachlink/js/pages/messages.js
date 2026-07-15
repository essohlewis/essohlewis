/* ==========================================================================
   pages/messages.js — Messagerie : liste des conversations + fenêtre de chat.
   "Temps réel local" via l'événement cl:message. Réponse coach simulée.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  CL.pages = CL.pages || {};
  const { el, esc } = CL.dom;
  const { auth, messageService, ui, format } = CL;

  let ecouteurMessage = null; // référence à l'écouteur cl:message courant

  CL.pages.messages = function (params) {
    const u = auth.courant();
    let convActiveId = params.conv || null;

    const listeConv = el("div", { class: "conversations" });
    const zoneChat = el("div", { class: "chat" });
    const conteneur = el("div", { class: "messagerie" }, [listeConv, zoneChat]);

    function rafraichirListe() {
      CL.dom.vider(listeConv);
      listeConv.appendChild(el("div", { style: "padding:16px;border-bottom:1px solid var(--bordure)" }, [el("h3", { text: "Messages" })]));
      const convs = messageService.parUtilisateur(u.id);
      if (!convs.length) { listeConv.appendChild(ui.vide("message", "Aucune conversation", "Contactez un coach pour démarrer.")); return; }
      if (!convActiveId) convActiveId = convs[0].id;
      convs.forEach((conv) => {
        const autre = conv.participants.find((p) => p !== u.id);
        const dernier = messageService.dernierMessage(conv);
        const nonLus = conv.messages.filter((m) => m.de !== u.id && !m.lu).length;
        const item = el("div", { class: "conversation-item" + (conv.id === convActiveId ? " actif" : "") }, [
          ui.avatarNom(conv.noms[autre] || "?", "avatar-md", "#1b4dcc"),
          el("div", { class: "conversation-item__contenu" }, [
            el("div", { class: "conversation-item__nom" }, [el("strong", { text: conv.noms[autre] || "Utilisateur" }), el("span", { class: "texte-xs texte-faible", text: dernier ? format.tempsRelatif(dernier.date) : "" })]),
            el("div", { class: "conversation-item__apercu", text: dernier ? (dernier.de === u.id ? "Vous : " : "") + dernier.texte : "Nouvelle conversation" }),
          ]),
          nonLus ? el("span", { class: "cloche__pastille", style: "position:static", text: String(nonLus) }) : null,
        ]);
        item.addEventListener("click", () => { convActiveId = conv.id; conteneur.classList.add("voir-chat"); ouvrirChat(); rafraichirListe(); });
        listeConv.appendChild(item);
      });
    }

    function ouvrirChat() {
      CL.dom.vider(zoneChat);
      const conv = messageService.obtenir(convActiveId);
      if (!conv) { zoneChat.appendChild(ui.vide("message", "Sélectionnez une conversation", "")); return; }
      messageService.marquerLu(conv.id, u.id);
      const autre = conv.participants.find((p) => p !== u.id);

      const corps = el("div", { class: "chat__corps" });
      const saisie = el("input", { class: "input", placeholder: "Écrivez votre message…" });

      const entete = el("div", { class: "chat__entete" }, [
        el("button", { class: "btn-icone btn-fantome", style: "display:none", html: CL.icon("fleche_gauche", 20), onclick: () => conteneur.classList.remove("voir-chat") }),
        ui.avatarNom(conv.noms[autre] || "?", "avatar-sm", "#1b4dcc"),
        el("div", {}, [el("strong", { text: conv.noms[autre] || "Utilisateur" }), el("div", { class: "texte-xs texte-faible", text: "En ligne" })]),
      ]);
      // Afficher le bouton retour sur mobile.
      if (window.matchMedia("(max-width:900px)").matches) entete.firstChild.style.display = "inline-flex";

      function rendreMessages() {
        CL.dom.vider(corps);
        conv.messages.forEach((m) => {
          const moi = m.de === u.id;
          corps.appendChild(el("div", { class: "bulle " + (moi ? "bulle-moi" : "bulle-autre") }, [
            el("div", { text: m.texte }),
            el("span", { class: "bulle__heure", text: format.heure(m.date) }),
          ]));
        });
        corps.scrollTop = corps.scrollHeight;
      }
      rendreMessages();

      function envoyer() {
        const txt = saisie.value.trim();
        if (!txt) return;
        messageService.envoyer(conv.id, u.id, txt);
        saisie.value = "";
        rendreMessages();
        rafraichirListe();
        // Réponse simulée si l'interlocuteur est un coach (démo).
        if (String(autre).startsWith("coach:") || u.role === "client") {
          setTimeout(() => {
            const conv2 = messageService.obtenir(conv.id);
            if (conv2) {
              messageService.envoyer(conv.id, autre, reponseAuto(txt));
              if (convActiveId === conv.id) { rendreMessages(); }
              rafraichirListe();
            }
          }, 1400);
        }
      }

      saisie.addEventListener("keydown", (e) => { if (e.key === "Enter") envoyer(); });
      zoneChat.appendChild(entete);
      zoneChat.appendChild(corps);
      zoneChat.appendChild(el("div", { class: "chat__saisie" }, [
        el("button", { class: "btn-icone btn-fantome", title: "Pièce jointe", html: CL.icon("trombone", 20), onclick: () => CL.toast.info("Pièces jointes", "Bientôt disponible via l'API.") }),
        saisie,
        el("button", { class: "btn-icone btn-primaire", "aria-label": "Envoyer", html: CL.icon("envoyer", 20), onclick: envoyer }),
      ]));
    }

    // Écoute temps réel local. On retire l'écouteur précédent pour éviter
    // l'accumulation à chaque visite de la page.
    if (ecouteurMessage) window.removeEventListener("cl:message", ecouteurMessage);
    ecouteurMessage = () => { if (document.body.contains(conteneur)) rafraichirListe(); };
    window.addEventListener("cl:message", ecouteurMessage);

    rafraichirListe();
    if (convActiveId) { conteneur.classList.add("voir-chat"); ouvrirChat(); } else ouvrirChat();

    return el("div", {}, [
      el("div", { class: "page-entete" }, [el("div", {}, [el("h1", { text: "Messagerie" }), el("p", { text: "Échangez avec vos coachs et clients." })])]),
      conteneur,
    ]);
  };

  function reponseAuto(txt) {
    const t = txt.toLowerCase();
    if (t.includes("prix") || t.includes("tarif") || t.includes("combien")) return "Mes tarifs sont indiqués sur mon profil. Je propose aussi des packs avantageux 😊";
    if (t.includes("disponible") || t.includes("créneau") || t.includes("quand")) return "Je suis disponible en semaine et le samedi matin. Choisissez un créneau libre sur mon calendrier !";
    if (t.includes("bonjour") || t.includes("salut")) return "Bonjour ! Ravi de votre message. Comment puis-je vous aider dans votre objectif ?";
    if (t.includes("merci")) return "Avec plaisir ! N'hésitez pas si vous avez d'autres questions.";
    return "Merci pour votre message ! Je reviens vers vous très vite pour organiser une séance. 💪";
  }
})();
