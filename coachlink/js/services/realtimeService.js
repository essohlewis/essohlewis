/* ==========================================================================
   services/realtimeService.js — « Temps réel » côté client par interrogation
   périodique (polling) du backend, en mode API uniquement.

   Principe : on interroge GET /notifications à intervalle régulier (léger).
   - Si la liste change → on met à jour le store + on rafraîchit la cloche
     (événement cl:notif).
   - Si une nouvelle notification de type « message » apparaît → on recharge
     les conversations et on émet cl:message (le chat ouvert se met à jour).

   Économe : mis en pause quand l'onglet est masqué, une seule requête en vol,
   aucun effet hors-ligne. Intervalle réglable via localStorage.cl_poll_ms.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  let timer = null;
  let enCours = false;
  let vus = new Set(); // identifiants de notifications déjà connus

  function _api() { return CL.API && CL.API.actif; }
  function intervalle() {
    const v = parseInt(localStorage.getItem("cl_poll_ms"), 10);
    return v && v >= 500 ? v : 8000;
  }

  async function tick() {
    if (enCours || document.hidden) return;
    if (!_api() || !CL.auth.estConnecte()) return;
    enCours = true;
    try {
      const rep = await CL.API.notifications();
      const items = ((rep && rep.items) || []).map(CL.API.mapNotif);

      // Notifications non encore vues (la base est amorcée à demarrer()).
      const nouveaux = items.filter((n) => !vus.has(String(n.id)));
      items.forEach((n) => vus.add(String(n.id)));

      // Mise à jour du store + cloche si l'état a changé (nouvelles ou lues).
      const ancien = CL.storage.lire(CL.storage.CLES.notifications, []);
      const signature = (l) => JSON.stringify(l.map((n) => [n.id, n.lu ? 1 : 0]));
      if (signature(ancien) !== signature(items)) {
        CL.storage.ecrire(CL.storage.CLES.notifications, items);
        window.dispatchEvent(new CustomEvent("cl:notif"));
      }

      // Nouveau message reçu → recharge les conversations + notifie l'UI.
      if (nouveaux.some((n) => n.type === "message")) {
        if (CL.hydrate) await CL.hydrate.conversations();
        window.dispatchEvent(new CustomEvent("cl:message", { detail: { via: "poll" } }));
      }
    } catch (_) {
      /* réseau instable : on réessaiera au prochain tick */
    } finally {
      enCours = false;
    }
  }

  const realtime = {
    /** Démarre l'interrogation périodique (sans effet hors-ligne). */
    demarrer() {
      if (timer || !_api()) return;
      // Amorce la base des notifications déjà vues pour éviter tout faux « nouveau ».
      vus = new Set((CL.storage.lire(CL.storage.CLES.notifications, []) || []).map((n) => String(n.id)));
      timer = setInterval(tick, intervalle());
      if (!realtime._visibilite) {
        realtime._visibilite = () => { if (!document.hidden) tick(); };
        document.addEventListener("visibilitychange", realtime._visibilite);
      }
    },

    /** Arrête l'interrogation (déconnexion). */
    arreter() {
      if (timer) { clearInterval(timer); timer = null; }
      vus = new Set();
    },

    /** Déclenche un cycle immédiat (utile après une action). */
    forcer: tick,
  };

  CL.realtime = realtime;
})();
