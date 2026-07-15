/* ==========================================================================
   services/messageService.js — Messagerie simulée client ⇄ coach.
   Conversations persistées en localStorage. "Temps réel local" via un
   événement CustomEvent déclenché à chaque nouveau message.
   >>> Branchement API : WebSocket ou polling GET /conversations … <<<
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { storage } = CL;

  function toutes() { return storage.lire(storage.CLES.conversations, []); }
  function sauver(l) { storage.ecrire(storage.CLES.conversations, l); }

  function cleConv(a, b) { return [a, b].sort().join("__"); }

  const messageService = {
    /** Conversations impliquant l'utilisateur. */
    parUtilisateur(userId) {
      return toutes()
        .filter((c) => c.participants.includes(userId))
        .sort((a, b) => new Date(b.majLe || 0) - new Date(a.majLe || 0));
    },

    obtenir(convId) { return toutes().find((c) => c.id === convId) || null; },

    /**
     * Récupère (ou crée) une conversation entre deux utilisateurs.
     * meta = { userId, userNom, autreId, autreNom }
     */
    ouvrir(meta) {
      const liste = toutes();
      const cle = cleConv(meta.userId, meta.autreId);
      let conv = liste.find((c) => c.cle === cle);
      if (!conv) {
        conv = {
          id: CL.dom.uid("conv"),
          cle,
          participants: [meta.userId, meta.autreId],
          noms: { [meta.userId]: meta.userNom, [meta.autreId]: meta.autreNom },
          messages: [],
          majLe: new Date().toISOString(),
        };
        liste.push(conv);
        sauver(liste);
      } else {
        // Met à jour les noms au cas où.
        conv.noms[meta.userId] = meta.userNom;
        conv.noms[meta.autreId] = meta.autreNom;
        sauver(liste);
      }
      return conv;
    },

    /** Envoie un message dans une conversation. */
    envoyer(convId, expediteurId, texte, piecesJointes) {
      const liste = toutes();
      const conv = liste.find((c) => c.id === convId);
      if (!conv) return null;
      const msg = {
        id: CL.dom.uid("msg"),
        de: expediteurId,
        texte: texte,
        pieces: piecesJointes || [],
        date: new Date().toISOString(),
        lu: false,
      };
      conv.messages.push(msg);
      conv.majLe = msg.date;
      sauver(liste);

      // Notifie le destinataire + événement temps réel local.
      const destinataire = conv.participants.find((p) => p !== expediteurId);
      CL.notifications && CL.notifications.ajouter(destinataire, {
        type: "message",
        texte: `Nouveau message de ${conv.noms[expediteurId] || "un utilisateur"}.`,
        lien: "#/messages",
      });
      window.dispatchEvent(new CustomEvent("cl:message", { detail: { convId, msg } }));
      return msg;
    },

    /** Marque tous les messages reçus comme lus. */
    marquerLu(convId, userId) {
      const liste = toutes();
      const conv = liste.find((c) => c.id === convId);
      if (!conv) return;
      let change = false;
      conv.messages.forEach((m) => { if (m.de !== userId && !m.lu) { m.lu = true; change = true; } });
      if (change) sauver(liste);
    },

    nbNonLus(userId) {
      return messageService.parUtilisateur(userId).reduce((total, conv) => {
        return total + conv.messages.filter((m) => m.de !== userId && !m.lu).length;
      }, 0);
    },

    dernierMessage(conv) {
      return conv.messages.length ? conv.messages[conv.messages.length - 1] : null;
    },
  };

  CL.messageService = messageService;
})();
