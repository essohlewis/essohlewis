/* =========================================================================
   auth.js — Authentification (inscription, connexion, session, rôles).
   NB : les mots de passe sont stockés en clair (démo front-only). Ne jamais
   faire cela en production — utiliser un back-end + hachage.
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;
  const K = DB.KEYS.users;

  /** Retourne l'utilisateur actuellement connecté, ou null. */
  function current() {
    const sess = DB.get(DB.KEYS.session, null);
    if (!sess || !sess.userId) return null;
    return DB.find(K, sess.userId);
  }

  function isLogged() { return !!current(); }

  function findByEmail(email) {
    email = String(email || "").trim().toLowerCase();
    return DB.all(K).find((u) => u.email.toLowerCase() === email) || null;
  }

  /** Validation basique d'email. */
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

  /**
   * Validation d'un numéro de téléphone ivoirien.
   * Accepte 10 chiffres (ex : 07 12 34 56 78) avec préfixe +225 optionnel.
   */
  function validPhone(p) {
    const digits = String(p || "").replace(/[\s\-().]/g, "").replace(/^\+?225/, "");
    return /^\d{8,10}$/.test(digits);
  }

  /**
   * Inscription d'un nouvel utilisateur.
   * @returns {object} { ok, error?, user? }
   */
  function register({ name, email, phone, password, role }) {
    name = String(name || "").trim();
    email = String(email || "").trim();
    if (!name) return { ok: false, error: "Le nom est requis." };
    if (!validEmail(email)) return { ok: false, error: "Adresse e-mail invalide." };
    if (phone && !validPhone(phone)) return { ok: false, error: "Numéro de téléphone invalide." };
    if (!password || password.length < 4) return { ok: false, error: "Mot de passe trop court (min. 4)." };
    if (findByEmail(email)) return { ok: false, error: "Cet e-mail est déjà utilisé." };

    const user = {
      id: DB.uid("usr"),
      name,
      email,
      phone: phone || "",
      password, // démo uniquement
      role: role === "vendor" ? "vendor" : "client",
      createdAt: Date.now(),
      commune: "",
      address: "",
    };
    DB.insert(K, user);
    _startSession(user.id);
    return { ok: true, user };
  }

  /** Connexion par e-mail + mot de passe. */
  function login(email, password) {
    const user = findByEmail(email);
    if (!user || user.password !== password) {
      return { ok: false, error: "E-mail ou mot de passe incorrect." };
    }
    _startSession(user.id);
    return { ok: true, user };
  }

  function _startSession(userId) {
    DB.set(DB.KEYS.session, { userId, at: Date.now() });
  }

  function logout() {
    DB.remove(DB.KEYS.session);
  }

  /** Met à jour le profil de l'utilisateur courant. */
  function updateProfile(patch) {
    const user = current();
    if (!user) return { ok: false, error: "Non connecté." };
    if (patch.phone && !validPhone(patch.phone)) return { ok: false, error: "Téléphone invalide." };
    const updated = DB.update(K, user.id, patch);
    return { ok: true, user: updated };
  }

  /** Transforme le compte courant en vendeur (activation "Ouvrir ma boutique"). */
  function becomeVendor() {
    const user = current();
    if (!user) return { ok: false };
    if (user.role !== "admin") DB.update(K, user.id, { role: "vendor" });
    return { ok: true, user: current() };
  }

  function isVendor() { const u = current(); return !!u && (u.role === "vendor" || u.role === "admin"); }
  function isAdmin() { const u = current(); return !!u && u.role === "admin"; }

  window.MP.Auth = {
    current, isLogged, findByEmail, validEmail, validPhone,
    register, login, logout, updateProfile, becomeVendor, isVendor, isAdmin,
  };
})();
