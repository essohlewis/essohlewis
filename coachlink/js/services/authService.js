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

    /** Utilisateur connecté (ou null) */
    courant() {
      const session = storage.lire(storage.CLES.session);
      if (!session || !session.userId) return null;
      return utilisateurs().find((u) => u.id === session.userId) || null;
    },

    estConnecte() { return !!auth.courant(); },
    estRole(role) { const u = auth.courant(); return u && u.role === role; },

    /**
     * Inscription. donnees = { role, prenom, nom, email, telephone, motDePasse, ... }
     * Si role === "coach", crée aussi une fiche coach liée.
     */
    inscrire(donnees) {
      const liste = utilisateurs();
      if (liste.some((u) => u.email.toLowerCase() === donnees.email.toLowerCase())) {
        return { ok: false, message: "Un compte existe déjà avec cet email." };
      }
      const id = CL.dom.uid("u");
      const user = {
        id,
        role: donnees.role || "client",
        prenom: donnees.prenom,
        nom: donnees.nom,
        email: donnees.email,
        telephone: donnees.telephone || "",
        motDePasse: pseudoHash(donnees.motDePasse || ""),
        source: donnees.source || "email",
        creeLe: new Date().toISOString(),
      };
      liste.push(user);
      sauverUtilisateurs(liste);

      // Création d'une fiche coach minimale si rôle coach.
      if (user.role === "coach" && CL.coachService) {
        user.coachId = CL.coachService.creerDepuisInscription(user, donnees);
        sauverUtilisateurs(utilisateurs().map((u) => (u.id === id ? user : u)));
      }

      auth._ouvrirSession(id);
      return { ok: true, user };
    },

    /** Connexion par email + mot de passe. */
    connecter(email, motDePasse) {
      const user = utilisateurs().find((u) => u.email.toLowerCase() === String(email).toLowerCase());
      if (!user) return { ok: false, message: "Aucun compte trouvé avec cet email." };
      if (user.motDePasse !== pseudoHash(motDePasse)) {
        return { ok: false, message: "Mot de passe incorrect." };
      }
      auth._ouvrirSession(user.id);
      return { ok: true, user };
    },

    /** Connexion sociale simulée (Facebook / LinkedIn). */
    connexionSociale(reseau) {
      const email = `demo.${reseau}@coachlink.ci`;
      let user = utilisateurs().find((u) => u.email === email);
      if (!user) {
        const res = auth.inscrire({
          role: "client",
          prenom: reseau === "linkedin" ? "Profil" : "Ami",
          nom: reseau === "linkedin" ? "LinkedIn" : "Facebook",
          email,
          motDePasse: "social-" + reseau,
          source: reseau,
        });
        user = res.user;
      } else {
        auth._ouvrirSession(user.id);
      }
      return { ok: true, user };
    },

    /** Récupération de mot de passe (simulée). */
    motDePasseOublie(email) {
      const existe = utilisateurs().some((u) => u.email.toLowerCase() === String(email).toLowerCase());
      return {
        ok: true,
        message: existe
          ? "Un lien de réinitialisation vous a été envoyé (simulé)."
          : "Si ce compte existe, un lien a été envoyé (simulé).",
      };
    },

    deconnecter() { storage.supprimer(storage.CLES.session); },

    _ouvrirSession(userId) {
      // Token simulé — remplacé par un JWT renvoyé par l'API plus tard.
      const token = "tok_" + btoa(userId + ":" + Date.now()).replace(/=/g, "");
      storage.ecrire(storage.CLES.session, { userId, token, depuis: Date.now() });
    },

    /** Met à jour le profil de l'utilisateur courant. */
    majUtilisateur(patch) {
      const u = auth.courant();
      if (!u) return null;
      const liste = utilisateurs().map((x) => (x.id === u.id ? Object.assign({}, x, patch) : x));
      sauverUtilisateurs(liste);
      return liste.find((x) => x.id === u.id);
    },
  };

  CL.auth = auth;
})();
