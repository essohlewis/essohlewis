/* ==========================================================================
   services/apiService.js — Pont vers le backend PHP (API REST).
   Client fetch minimal : gère le token JWT, le JSON et les erreurs.

   >>> Comment brancher le front sur l'API <<<
   1. Démarrez le backend (voir api/README.md).
   2. Définissez l'URL de base ci-dessous (CL.API.base).
   3. Dans chaque service (authService, coachService…), remplacez les accès
      localStorage par des appels CL.API.* — la signature des méthodes et le
      format des données restent identiques, les pages ne changent pas.

   Tant que CL.API.actif est false, l'application continue de fonctionner
   hors-ligne (localStorage). Passez-le à true une fois le backend en place.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  const CLE_TOKEN = "cl_token";

  const API = {
    // À adapter selon votre déploiement (ex: "https://mondomaine.ci/api").
    base: "/api",
    // Mettez à true pour utiliser le backend PHP au lieu de localStorage.
    actif: false,

    token() { return localStorage.getItem(CLE_TOKEN); },
    definirToken(t) { t ? localStorage.setItem(CLE_TOKEN, t) : localStorage.removeItem(CLE_TOKEN); },

    /**
     * Appel générique. Retourne { ok, data } ou lève une erreur normalisée.
     * @param {string} methode  GET/POST/PATCH/DELETE
     * @param {string} chemin   ex: "/coachs" ou "/coachs/c1"
     * @param {object} corps    payload JSON (facultatif)
     */
    async appel(methode, chemin, corps) {
      const entetes = { "Content-Type": "application/json" };
      const token = API.token();
      if (token) entetes["Authorization"] = "Bearer " + token;

      let reponse;
      try {
        reponse = await fetch(API.base + chemin, {
          method: methode,
          headers: entetes,
          body: corps ? JSON.stringify(corps) : undefined,
        });
      } catch (e) {
        throw { message: "Serveur injoignable. Vérifiez votre connexion." };
      }

      let json = {};
      try { json = await reponse.json(); } catch (_) {}

      if (!reponse.ok || json.ok === false) {
        throw {
          statut: reponse.status,
          message: json.message || "Erreur (" + reponse.status + ")",
          erreurs: json.erreurs || {},
        };
      }
      return json.data;
    },

    get(chemin) { return API.appel("GET", chemin); },
    post(chemin, corps) { return API.appel("POST", chemin, corps); },
    patch(chemin, corps) { return API.appel("PATCH", chemin, corps); },
    supprimer(chemin) { return API.appel("DELETE", chemin); },

    /* --------- Exemples de raccourcis (mappage endpoints) -------------- */
    // Auth
    inscrire(d)   { return API.post("/auth/register", d); },
    connecter(d)  { return API.post("/auth/login", d); },
    moi()         { return API.get("/auth/me"); },
    // Coachs
    coachs(q)     { return API.get("/coachs" + (q ? "?" + new URLSearchParams(q) : "")); },
    coach(id)     { return API.get("/coachs/" + id); },
    maFicheCoach() { return API.get("/coachs/moi"); },
    // Réservations
    reserver(d)   { return API.post("/reservations", d); },
    mesResas()    { return API.get("/reservations/mes"); },
    payer(id, d)  { return API.post("/reservations/" + id + "/payer", d); },
    // Notifications
    notifications() { return API.get("/notifications"); },
  };

  CL.API = API;
})();
