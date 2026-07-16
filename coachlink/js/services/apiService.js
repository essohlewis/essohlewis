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

    /* ------- Mappage API (snake_case) → format du front (camelCase) ------ */
    mapCoach(c) {
      if (!c) return null;
      return {
        id: c.id, proprietaire: c.proprietaire ? Number(c.proprietaire) : null,
        prenom: c.prenom, nom: c.nom, titre: c.titre, categorie: c.categorie,
        commune: c.commune, ville: c.ville, bio: c.bio,
        note: Number(c.note) || 0, nbAvis: Number(c.nb_avis) || 0,
        nbSeances: Number(c.nb_seances) || 0, ancienneteMois: Number(c.anciennete_mois) || 0,
        tauxReponse: Number(c.taux_reponse) || 0, couleur: c.couleur || "#1b4dcc",
        email: c.email, telephone: c.telephone,
        photo: c.photo || null, couverture: c.couverture || null,
        specialites: c.specialites || [], langues: c.langues || [],
        tarifs: (c.tarifs || []).map((t) => ({ id: t.id, nom: t.nom, type: t.type, prix: Number(t.prix), duree: Number(t.duree), description: t.description })),
        diplomes: (c.diplomes || []).map((d) => ({ id: d.id, titre: d.titre, ecole: d.ecole, annee: d.annee, statut: d.statut })),
        avis: (c.avis || []).map((a) => ({ id: a.id, auteur: a.auteur, note: Number(a.note), texte: a.texte, reponse: a.reponse, date: a.date })),
        galerie: (c.galerie || []).map((g) => ({ id: g.id, image: g.image, legende: g.legende, date: g.date })),
        posts: (c.posts || []).map((p) => ({ id: p.id, texte: p.texte, image: p.image, video: p.video, likes: Number(p.likes) || 0, date: p.date })),
        disponibilites: c.disponibilites || { Lun: [], Mar: [], Mer: [], Jeu: [], Ven: [], Sam: [], Dim: [] },
      };
    },

    mapReservation(r) {
      return {
        id: r.id, coachId: r.coach_id, clientId: Number(r.client_id), clientNom: r.client_nom,
        tarifId: r.tarif_id, tarifNom: r.tarif_nom, prix: Number(r.prix), duree: Number(r.duree),
        jour: r.jour, heure: r.heure, message: r.message, statut: r.statut,
        avisLaisse: !!Number(r.avis_laisse), creeLe: r.cree_le,
        paiement: Number(r.paye) ? {
          operateur: r.paiement_op, numero: r.paiement_numero, montant: Number(r.paiement_montant),
          remise: Number(r.paiement_remise) || 0, promo: r.paiement_promo,
          reference: r.paiement_ref, date: r.paiement_date,
        } : null,
      };
    },

    mapNotif(n) {
      return { id: n.id, pour: Number(n.pour), type: n.type, texte: n.texte, lien: n.lien, lu: !!Number(n.lu), date: n.date };
    },
  };

  // Activation possible sans modifier ce fichier : définissez dans la console
  //   localStorage.cl_api_base = "http://127.0.0.1:8000"
  // puis rechargez. (Pratique pour les tests et la première mise en service.)
  try {
    const baseSauve = localStorage.getItem("cl_api_base");
    if (baseSauve) { API.base = baseSauve; API.actif = true; }
    if (localStorage.getItem("cl_api_actif") === "0") API.actif = false;
  } catch (_) {}

  CL.API = API;

  /* ======================================================================
     Hydratation : charge les données de l'API dans le store local, pour que
     les pages synchrones continuent de fonctionner sans réécriture.
     ====================================================================== */
  CL.hydrate = {
    /** Charge le catalogue coachs (public). */
    async catalogue() {
      const liste = await API.coachs();
      CL.storage.ecrire(CL.storage.CLES.coachs, liste.map(API.mapCoach));
    },

    /** Charge les données de l'utilisateur connecté (réservations, notifs, favoris). */
    async donneesUtilisateur() {
      const u = CL.auth.courant();
      if (!u) return;
      try {
        // Réservations selon le rôle : client → les siennes, coach → reçues.
        const resasP = u.role === "coach"
          ? API.get("/reservations/coach").catch(() => [])
          : API.mesResas().catch(() => []);
        const [resas, notifs] = await Promise.all([
          resasP,
          API.notifications().catch(() => ({ items: [] })),
        ]);
        CL.storage.ecrire(CL.storage.CLES.bookings, (resas || []).map(API.mapReservation));
        CL.storage.ecrire(CL.storage.CLES.notifications, ((notifs && notifs.items) || []).map(API.mapNotif));

        // Favoris (client) : on stocke la liste d'identifiants.
        if (u.role === "client") {
          const favs = await API.get("/favoris").catch(() => []);
          CL.storage.ecrire(CL.storage.CLES.favoris, (favs || []).map((c) => c.id));
        }
      } catch (e) { console.warn("Hydratation utilisateur partielle", e); }
    },

    /** Recharge le profil complet d'un coach depuis l'API. */
    async coach(id) {
      const c = API.mapCoach(await API.coach(id));
      const liste = CL.storage.lire(CL.storage.CLES.coachs, []);
      const i = liste.findIndex((x) => x.id === id);
      if (i >= 0) liste[i] = c; else liste.push(c);
      CL.storage.ecrire(CL.storage.CLES.coachs, liste);
      return c;
    },
  };
})();
