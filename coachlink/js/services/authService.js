/* ==========================================================================
   services/authService.js — Authentification simulée (inscription, connexion,
   session persistée avec token simulé, mot de passe oublié, connexion sociale).
   >>> Branchement API : remplacer par POST /auth/login, /auth/register… <<<
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const { storage } = CL;

  // Petit "hash" non cryptographique — uniquement pour la démo front.
  function pseudoHash(txt) {
    let h = 0;
    for (let i = 0; i < txt.length; i++) { h = (h << 5) - h + txt.charCodeAt(i); h |= 0; }
    return "h" + Math.abs(h).toString(36);
  }

  function utilisateurs() { return storage.lire(storage.CLES.users, []); }
  function sauverUtilisateurs(u) { storage.ecrire(storage.CLES.users, u); }

  const auth = {
    /** Hash non cryptographique exposé (utilisé pour amorcer les comptes démo). */
    hacher: pseudoHash,

    /** Code de parrainage personnel d'un utilisateur (stable, partageable). */
    codeParrainage(user) {
      if (!user) return null;
      const suffixe = String(user.id).replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase().padStart(4, "X");
      return "PARRAIN-" + suffixe;
    },

    /** Utilisateur connecté (ou null). Toujours synchrone. */
    courant() {
      const session = storage.lire(storage.CLES.session);
      if (!session || !session.userId) return null;
      if (session.user) return session.user; // mode API : utilisateur persisté dans la session
      return utilisateurs().find((u) => u.id === session.userId) || null;
    },

    estConnecte() { return !!auth.courant(); },
    estRole(role) { const u = auth.courant(); return u && u.role === role; },

    /** True si le backend API est activé. */
    _api() { return CL.API && CL.API.actif; },

    /**
     * Inscription (asynchrone). donnees = { role, prenom, nom, email, telephone,
     * motDePasse, titre, specialites, commune, categorie }.
     * Renvoie une Promise<{ ok, user, message?, erreurs? }>.
     */
    async inscrire(donnees) {
      if (auth._api()) {
        try {
          const res = await CL.API.inscrire({
            role: donnees.role || "client",
            prenom: donnees.prenom, nom: donnees.nom, email: donnees.email,
            telephone: donnees.telephone || "", motDePasse: donnees.motDePasse,
            titre: donnees.titre, commune: donnees.commune, categorie: donnees.categorie,
            specialite: (donnees.specialites || [])[0] || null,
          });
          auth._ouvrirSession(res.user.id, { token: res.token, user: res.user, coachId: res.user.coachId || null });
          return { ok: true, user: res.user };
        } catch (e) {
          return { ok: false, message: e.message || "Inscription impossible.", erreurs: e.erreurs || {} };
        }
      }
      // --- Mode hors-ligne (localStorage) ---
      const liste = utilisateurs();
      if (liste.some((u) => u.email.toLowerCase() === donnees.email.toLowerCase())) {
        return { ok: false, message: "Un compte existe déjà avec cet email." };
      }
      const id = CL.dom.uid("u");
      const user = {
        id, role: donnees.role || "client", prenom: donnees.prenom, nom: donnees.nom,
        email: donnees.email, telephone: donnees.telephone || "",
        motDePasse: pseudoHash(donnees.motDePasse || ""), source: donnees.source || "email",
        creeLe: new Date().toISOString(),
      };
      liste.push(user);
      sauverUtilisateurs(liste);
      if (user.role === "coach" && CL.coachService) {
        user.coachId = CL.coachService.creerDepuisInscription(user, donnees);
        sauverUtilisateurs(utilisateurs().map((u) => (u.id === id ? user : u)));
      }
      auth._ouvrirSession(id);
      return { ok: true, user };
    },

    /** Connexion (asynchrone). Renvoie Promise<{ ok, user, message? }>. */
    async connecter(email, motDePasse) {
      if (auth._api()) {
        try {
          const res = await CL.API.connecter({ email, motDePasse });
          auth._ouvrirSession(res.user.id, { token: res.token, user: res.user, coachId: res.user.coachId || null });
          return { ok: true, user: res.user };
        } catch (e) {
          return { ok: false, message: e.message || "Connexion impossible." };
        }
      }
      // --- Mode hors-ligne ---
      const user = utilisateurs().find((u) => u.email.toLowerCase() === String(email).toLowerCase());
      if (!user) return { ok: false, message: "Aucun compte trouvé avec cet email." };
      if (user.motDePasse !== pseudoHash(motDePasse)) {
        return { ok: false, message: "Mot de passe incorrect." };
      }
      auth._ouvrirSession(user.id);
      return { ok: true, user };
    },

    /** Connexion sociale simulée (Facebook / LinkedIn), hors-ligne uniquement. */
    async connexionSociale(reseau) {
      if (auth._api()) {
        return { ok: false, message: "Connexion sociale bientôt disponible côté serveur." };
      }
      const email = `demo.${reseau}@coachlink.ci`;
      let user = utilisateurs().find((u) => u.email === email);
      if (!user) {
        const res = await auth.inscrire({
          role: "client",
          prenom: reseau === "linkedin" ? "Profil" : "Ami",
          nom: reseau === "linkedin" ? "LinkedIn" : "Facebook",
          email, motDePasse: "social-" + reseau, source: reseau,
        });
        user = res.user;
      } else {
        auth._ouvrirSession(user.id);
      }
      return { ok: true, user };
    },

    /** Demande de réinitialisation (asynchrone). En mode API, renvoie aussi le
     *  jeton de simulation (aucun email n'est réellement envoyé). */
    async motDePasseOublie(email) {
      if (auth._api()) {
        try {
          const d = await CL.API.post("/auth/mot-de-passe/oubli", { email });
          return { ok: true, message: d.message, token: d.token || null };
        } catch (e) { return { ok: false, message: e.message || "Demande impossible." }; }
      }
      const existe = utilisateurs().some((u) => u.email.toLowerCase() === String(email).toLowerCase());
      return {
        ok: true,
        message: existe
          ? "Un lien de réinitialisation vous a été envoyé (simulé)."
          : "Si ce compte existe, un lien a été envoyé (simulé).",
      };
    },

    /** Réinitialise le mot de passe à partir d'un jeton (mode API). */
    async reinitialiser(token, motDePasse) {
      if (auth._api()) {
        try {
          const d = await CL.API.post("/auth/mot-de-passe/reset", { token, motDePasse });
          return { ok: true, message: d.message };
        } catch (e) { return { ok: false, message: e.message || "Réinitialisation impossible.", erreurs: e.erreurs || {} }; }
      }
      return { ok: false, message: "La réinitialisation nécessite le backend." };
    },

    deconnecter() {
      storage.supprimer(storage.CLES.session);
      if (CL.API) CL.API.definirToken(null);
      if (CL.realtime) CL.realtime.arreter();
    },

    /** Coach lié à l'utilisateur courant (id de fiche coach), si connu. */
    coachIdCourant() {
      const session = storage.lire(storage.CLES.session);
      return (session && session.coachId) || null;
    },

    _ouvrirSession(userId, extra) {
      extra = extra || {};
      // JWT réel (mode API) ou token simulé (hors-ligne).
      const token = extra.token || ("tok_" + btoa(userId + ":" + Date.now()).replace(/=/g, ""));
      storage.ecrire(storage.CLES.session, Object.assign({ userId, token, depuis: Date.now() }, extra, { token }));
      if (CL.API && extra.token) CL.API.definirToken(extra.token);
      // Démarre le « temps réel » (polling) en mode API.
      if (CL.realtime) CL.realtime.demarrer();
    },

    /** Met à jour le profil de l'utilisateur courant. */
    majUtilisateur(patch) {
      const session = storage.lire(storage.CLES.session);
      if (session && session.user) {
        session.user = Object.assign({}, session.user, patch);
        storage.ecrire(storage.CLES.session, session);
        return session.user;
      }
      const u = auth.courant();
      if (!u) return null;
      const liste = utilisateurs().map((x) => (x.id === u.id ? Object.assign({}, x, patch) : x));
      sauverUtilisateurs(liste);
      return liste.find((x) => x.id === u.id);
    },
  };

  CL.auth = auth;
})();
