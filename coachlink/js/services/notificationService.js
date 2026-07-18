/* ==========================================================================
   services/notificationService.js — Notifications in-app (cloche + liste).
   Chaque notification appartient à un utilisateur destinataire.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { storage } = CL;

  function toutes() { return storage.lire(storage.CLES.notifications, []); }
  function sauver(l) { storage.ecrire(storage.CLES.notifications, l); }

  const notifications = {
    /** Ajoute une notification pour un destinataire. */
    ajouter(destinataireId, notif) {
      if (!destinataireId) return;
      const liste = toutes();
      liste.unshift({
        id: CL.dom.uid("notif"),
        pour: destinataireId,
        type: notif.type || "info",
        texte: notif.texte,
        lien: notif.lien || null,
        lu: false,
        date: new Date().toISOString(),
      });
      sauver(liste);
      window.dispatchEvent(new CustomEvent("cl:notif"));
    },

    parUtilisateur(userId) {
      return toutes().filter((n) => n.pour === userId);
    },

    nbNonLues(userId) {
      return toutes().filter((n) => n.pour === userId && !n.lu).length;
    },

    marquerToutesLues(userId) {
      const liste = toutes();
      liste.forEach((n) => { if (n.pour === userId) n.lu = true; });
      sauver(liste);
      // API : synchronisation en tâche de fond.
      if (CL.API && CL.API.actif) CL.API.post("/notifications/toutes-lues").catch(() => {});
      window.dispatchEvent(new CustomEvent("cl:notif"));
    },

    marquerLue(id) {
      const liste = toutes();
      const n = liste.find((x) => x.id === id);
      if (n) {
        n.lu = true; sauver(liste);
        if (CL.API && CL.API.actif) CL.API.patch("/notifications/" + id + "/lue").catch(() => {});
        window.dispatchEvent(new CustomEvent("cl:notif"));
      }
    },
  };

  CL.notifications = notifications;
})();
