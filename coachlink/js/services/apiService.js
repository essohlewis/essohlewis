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
    put(chemin, corps) { return API.appel("PUT", chemin, corps); },
    patch(chemin, corps) { return API.appel("PATCH", chemin, corps); },
    supprimer(chemin) { return API.appel("DELETE", chemin); },

    /* --------------------------- Téléversement ------------------------ */
    /**
     * Envoie un fichier (multipart) vers /uploads. Retourne l'URL absolue.
     * @param {Blob|File} blob
     * @param {string} nom  nom de fichier suggéré
     */
    async televerser(blob, nom) {
      const form = new FormData();
      form.append("fichier", blob, nom || "fichier");
      const entetes = {};
      const token = API.token();
      if (token) entetes["Authorization"] = "Bearer " + token;
      let reponse;
      try {
        reponse = await fetch(API.base + "/uploads", { method: "POST", headers: entetes, body: form });
      } catch (e) { throw { message: "Serveur injoignable (upload)." }; }
      let json = {};
      try { json = await reponse.json(); } catch (_) {}
      if (!reponse.ok || json.ok === false) throw { message: (json && json.message) || "Téléversement refusé." };
      // On stocke le chemin renvoyé par le serveur tel quel (relatif) ; l'affichage
      // le préfixe via urlMedia() au moment du mappage (mapCoach).
      return (json.data && json.data.url) || null;
    },

    /** Convertit une data-URL en Blob puis la téléverse. Retourne l'URL serveur. */
    async televerserImage(dataUrl) {
      if (!dataUrl || !/^data:/.test(dataUrl)) return dataUrl; // déjà une URL
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      return API.televerser(blob, "image." + ext);
    },

    /**
     * Normalise une URL de média : les data-URL et URLs absolues passent
     * telles quelles ; un chemin relatif renvoyé par l'API (/uploads/…) est
     * préfixé par l'origine de l'API (utile quand le front et l'API diffèrent).
     */
    urlMedia(u) {
      if (!u || /^(https?:|data:|blob:)/i.test(u)) return u || null;
      try {
        const origine = new URL(API.base, location.href).origin;
        return origine + (u.charAt(0) === "/" ? u : "/" + u);
      } catch (_) { return u; }
    },

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
    validerPresence(id, code) { return API.post("/reservations/" + id + "/valider-presence", { code }); },
    portefeuille() { return API.get("/portefeuille"); },
    retirerPortefeuille(d) { return API.post("/portefeuille/retrait", d); },
    abonnementAuto(id, actif) { return API.patch("/abonnements/" + id + "/auto", { actif }); },
    abonnementRenouveler(id, mois) { return API.post("/abonnements/" + id + "/renouveler", { mois }); },
    abonnementValiderSeance(id, code) { return API.post("/abonnements/" + id + "/valider-seance", { code }); },
    abonnementExercices(id, exercices) { return API.patch("/abonnements/" + id + "/exercices", { exercices }); },
    // Défis, notation client, mesures santé.
    creerDefi(d) { return API.post("/defis", d); },
    defiStatut(id, statut) { return API.patch("/defis/" + id + "/statut", { statut }); },
    mesDefis() { return API.get("/defis/mes"); },
    defisCoach() { return API.get("/defis/coach"); },
    evaluerClient(clientId, d) { return API.post("/clients/" + clientId + "/evaluation", d); },
    mesMesures() { return API.get("/mesures"); },
    ajouterMesure(d) { return API.post("/mesures", d); },
    supprimerMesure(id) { return API.supprimer("/mesures/" + id); },
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
        experienceAnnees: Number(c.experience_annees) || 0, clientsAccompagnes: Number(c.clients_accompagnes) || 0,
        interventions: (function () { try { return typeof c.interventions === "string" ? (JSON.parse(c.interventions) || []) : (c.interventions || []); } catch (_) { return []; } })(),
        email: c.email, telephone: c.telephone,
        photo: API.urlMedia(c.photo), couverture: API.urlMedia(c.couverture),
        specialites: c.specialites || [], langues: c.langues || [],
        tarifs: (c.tarifs || []).map((t) => ({ id: t.id, nom: t.nom, type: t.type, prix: Number(t.prix), duree: Number(t.duree), description: t.description })),
        diplomes: (c.diplomes || []).map((d) => ({ id: d.id, titre: d.titre, ecole: d.ecole, annee: d.annee, statut: d.statut })),
        avis: (c.avis || []).map((a) => ({ id: a.id, auteur: a.auteur, note: Number(a.note), texte: a.texte, reponse: a.reponse, date: a.date, video: a.video || null })),
        galerie: (c.galerie || []).map((g) => ({ id: g.id, image: API.urlMedia(g.image), legende: g.legende, date: g.date })),
        posts: (c.posts || []).map((p) => ({ id: p.id, texte: p.texte, image: API.urlMedia(p.image), video: p.video, likes: Number(p.likes) || 0, date: p.date })),
        disponibilites: c.disponibilites || { Lun: [], Mar: [], Mer: [], Jeu: [], Ven: [], Sam: [], Dim: [] },
      };
    },

    mapReservation(r) {
      return {
        id: r.id, coachId: r.coach_id, clientId: Number(r.client_id), clientNom: r.client_nom,
        tarifId: r.tarif_id, tarifNom: r.tarif_nom, prix: Number(r.prix), duree: Number(r.duree),
        jour: r.jour, heure: r.heure, message: r.message, statut: r.statut,
        lieuType: r.lieu_type || "", lieuNom: r.lieu_nom || "", adresse: r.adresse || "",
        ville: r.ville || "", commune: r.commune || "", quartier: r.quartier || "",
        lat: r.lat || "", lng: r.lng || "",
        jeton: r.jeton || "", presenceValidee: !!Number(r.presence_validee), presenceLe: r.presence_le || "",
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

    mapUser(u) {
      return {
        id: Number(u.id), role: u.role, prenom: u.prenom, nom: u.nom,
        email: u.email, telephone: u.telephone, source: u.source || "email",
        creeLe: u.cree_le || u.creeLe, coachId: u.coachId || null,
      };
    },

    mapLitige(l) {
      return {
        id: l.id, clientId: l.client_id ? Number(l.client_id) : null,
        client: l.client_nom, coach: l.coach_nom, motif: l.motif,
        statut: l.statut, date: l.date,
      };
    },

    mapMessage(m) {
      return { id: m.id, de: Number(m.de), texte: m.texte, pieces: m.image ? [{ type: "image", url: m.image }] : [], date: m.date, lu: !!Number(m.lu) };
    },

    mapAbonnement(a) {
      let prog = a.programme;
      if (typeof prog === "string") { try { prog = JSON.parse(prog); } catch (_) { prog = {}; } }
      let exos = a.exercices;
      if (typeof exos === "string") { try { exos = JSON.parse(exos); } catch (_) { exos = []; } }
      return {
        id: a.id, clientId: Number(a.client_id), clientNom: a.client_nom,
        coachId: a.coach_id, coachNom: a.coach_nom, objectif: a.objectif,
        seancesSemaine: Number(a.seances_semaine) || 1, lieuType: a.lieu_type,
        lieuNom: a.lieu_nom, adresse: a.adresse, ville: a.ville, commune: a.commune,
        quartier: a.quartier, lat: a.lat, lng: a.lng,
        prixSeance: Number(a.prix_seance) || 0, prixMensuel: Number(a.prix_mensuel) || 0,
        inclutSalle: !!Number(a.inclut_salle), fixePar: a.fixe_par,
        programme: prog && typeof prog === "object" ? prog : {},
        exercices: Array.isArray(exos) ? exos : [],
        statut: a.statut, dateDebut: a.date_debut, dateFin: a.date_fin, creeLe: a.cree_le,
        autoRenouvellement: !!Number(a.auto_renouvellement), jeton: a.jeton || "",
        contratRef: a.contrat_ref || "", contratCoachLe: a.contrat_coach_le || "", contratClientLe: a.contrat_client_le || "",
        paiements: (a.paiements || []).map((p) => ({
          id: p.id, mois: p.mois, montant: Number(p.montant) || 0,
          operateur: p.operateur, reference: p.reference, date: p.date,
          seancesPrevues: Number(p.seances_prevues) || 0, seancesValidees: Number(p.seances_validees) || 0, libere: !!Number(p.libere),
          montantLibere: Number(p.montant_libere) || 0, rembourse: Number(p.rembourse) || 0,
        })),
        seances: (a.seances || []).map((s) => ({ mois: s.mois, fenetre: Number(s.fenetre) || 0, date: s.date })),
      };
    },

    mapDefi(d) {
      return { id: d.id, coachId: d.coach_id, coachNom: d.coach_nom, clientId: Number(d.client_id), clientNom: d.client_nom,
        titre: d.titre, description: d.description, echeance: d.echeance, statut: d.statut, creeLe: d.cree_le, valideLe: d.valide_le };
    },
    mapEvaluationClient(e) {
      return { id: e.id, clientId: Number(e.client_id), coachId: e.coach_id, coachNom: e.coach_nom, note: Number(e.note) || 0, texte: e.texte, date: e.date };
    },
    mapMesure(m) {
      return { id: m.id, clientId: Number(m.client_id), date: m.date,
        poids: m.poids != null ? Number(m.poids) : null, tourTaille: m.tour_taille != null ? Number(m.tour_taille) : null,
        tourHanches: m.tour_hanches != null ? Number(m.tour_hanches) : null, tourBras: m.tour_bras != null ? Number(m.tour_bras) : null,
        note: m.note || "", photo: m.photo || null };
    },

    /** Conversation serveur (user_a/user_b) → format du front (participants/noms). */
    mapConversation(c) {
      const a = Number(c.user_a), b = Number(c.user_b);
      return {
        id: c.id,
        cle: [a, b].sort((x, y) => x - y).join("__"),
        participants: [a, b],
        noms: { [a]: c.nom_a, [b]: c.nom_b },
        messages: (c.messages || []).map(API.mapMessage),
        majLe: c.maj_le || c.majLe,
      };
    },
  };

  // 1) Configuration de déploiement (production) : window.CL_CONFIG est défini
  //    par un fichier js/config.js facultatif chargé avant ce script
  //    (voir js/config.example.js et DEPLOIEMENT.md).
  if (window.CL_CONFIG) {
    if (window.CL_CONFIG.apiBase) API.base = window.CL_CONFIG.apiBase;
    if (typeof window.CL_CONFIG.apiActif === "boolean") API.actif = window.CL_CONFIG.apiActif;
  }

  // 2) Surcharge locale (dev/tests) sans modifier de fichier : dans la console
  //    localStorage.cl_api_base = "http://127.0.0.1:8000" ; puis rechargez.
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

    /** Charge les données de l'utilisateur connecté (réservations, notifs, favoris…). */
    async donneesUtilisateur() {
      const u = CL.auth.courant();
      if (!u) return;
      try {
        // « J'aime » de l'utilisateur (tous rôles) : liste d'identifiants de posts.
        const likesP = API.get("/mes-likes").catch(() => []);

        // Administrateur : comptes + réservations + litiges pour les tableaux de bord.
        if (u.role === "admin") {
          const [users, resas, notifs, litiges, likes] = await Promise.all([
            API.get("/admin/utilisateurs").catch(() => []),
            API.get("/admin/reservations").catch(() => []),
            API.notifications().catch(() => ({ items: [] })),
            API.get("/admin/litiges").catch(() => []),
            likesP,
          ]);
          CL.storage.ecrire(CL.storage.CLES.users, (users || []).map(API.mapUser));
          CL.storage.ecrire(CL.storage.CLES.bookings, (resas || []).map(API.mapReservation));
          CL.storage.ecrire(CL.storage.CLES.notifications, ((notifs && notifs.items) || []).map(API.mapNotif));
          CL.storage.ecrire(CL.storage.CLES.litiges, (litiges || []).map(API.mapLitige));
          CL.storage.ecrire(CL.storage.CLES.likes, likes || []);
          return;
        }

        // Réservations selon le rôle : client → les siennes, coach → reçues.
        const resasP = u.role === "coach"
          ? API.get("/reservations/coach").catch(() => [])
          : API.mesResas().catch(() => []);
        // Abonnements selon le rôle.
        const aboP = u.role === "coach"
          ? API.get("/abonnements/coach").catch(() => [])
          : API.get("/abonnements/mes").catch(() => []);
        const [resas, notifs, convs, likes, abos] = await Promise.all([
          resasP,
          API.notifications().catch(() => ({ items: [] })),
          API.get("/conversations").catch(() => []),
          likesP,
          aboP,
        ]);
        CL.storage.ecrire(CL.storage.CLES.bookings, (resas || []).map(API.mapReservation));
        CL.storage.ecrire(CL.storage.CLES.notifications, ((notifs && notifs.items) || []).map(API.mapNotif));
        CL.storage.ecrire(CL.storage.CLES.conversations, (convs || []).map(API.mapConversation));
        CL.storage.ecrire(CL.storage.CLES.likes, likes || []);
        CL.storage.ecrire(CL.storage.CLES.abonnements, (abos || []).map(API.mapAbonnement));

        // Coach : s'assurer que sa propre fiche est dans le store (utile juste
        // après l'inscription, quand le catalogue ne la contient pas encore).
        if (u.role === "coach" && CL.hydrate.maFiche) {
          await CL.hydrate.maFiche().catch(() => {});
        }

        // Favoris (client) : on stocke la liste d'identifiants.
        if (u.role === "client") {
          const favs = await API.get("/favoris").catch(() => []);
          CL.storage.ecrire(CL.storage.CLES.favoris, (favs || []).map((c) => c.id));
          const mesures = await API.mesMesures().catch(() => []);
          CL.storage.ecrire(CL.storage.CLES.mesures, (mesures || []).map(API.mapMesure));
        }

        // Défis (client & coach).
        const defis = await (u.role === "coach" ? API.defisCoach() : API.mesDefis()).catch(() => []);
        CL.storage.ecrire(CL.storage.CLES.defis, (defis || []).map(API.mapDefi));
      } catch (e) { console.warn("Hydratation utilisateur partielle", e); }
    },

    /** Recharge la fiche du coach connecté (après édition) dans le catalogue local. */
    async maFiche() {
      const u = CL.auth.courant();
      if (!u || u.role !== "coach") return null;
      try {
        const c = API.mapCoach(await API.maFicheCoach());
        const liste = CL.storage.lire(CL.storage.CLES.coachs, []);
        const i = liste.findIndex((x) => x.id === c.id || String(x.proprietaire) === String(u.id));
        if (i >= 0) liste[i] = c; else liste.push(c);
        CL.storage.ecrire(CL.storage.CLES.coachs, liste);
        return c;
      } catch (e) { console.warn("Hydratation fiche coach", e); return null; }
    },

    /** Recharge les conversations de l'utilisateur connecté. */
    async conversations() {
      if (!CL.auth.estConnecte()) return;
      try {
        const convs = await API.get("/conversations");
        CL.storage.ecrire(CL.storage.CLES.conversations, (convs || []).map(API.mapConversation));
      } catch (e) { console.warn("Hydratation conversations", e); }
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
