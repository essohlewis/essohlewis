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

  /** Change le mot de passe de l'utilisateur courant. */
  function changePassword(currentPw, newPw) {
    const user = current();
    if (!user) return { ok: false, error: "Non connecté." };
    if (user.password !== currentPw) return { ok: false, error: "Mot de passe actuel incorrect." };
    if (!newPw || newPw.length < 4) return { ok: false, error: "Nouveau mot de passe trop court (min. 4)." };
    if (newPw === currentPw) return { ok: false, error: "Le nouveau mot de passe doit être différent." };
    DB.update(K, user.id, { password: newPw });
    return { ok: true };
  }

  /**
   * Rassemble toutes les données personnelles de l'utilisateur (portabilité).
   * @returns {object} données exportables (sans le mot de passe)
   */
  function exportData() {
    const user = current();
    if (!user) return null;
    const safeUser = Object.assign({}, user);
    delete safeUser.password;
    const has = (list, fn) => DB.all(list).filter(fn);
    return {
      exporte_le: new Date().toISOString(),
      profil: safeUser,
      commandes: has(DB.KEYS.orders, (o) => o.buyerId === user.id),
      avis: has(DB.KEYS.reviews, (r) => r.userId === user.id),
      questions: has(DB.KEYS.questions, (q) => q.userId === user.id),
      favoris: (DB.get(DB.KEYS.favorites, {})[user.id]) || [],
      abonnements: (DB.get(DB.KEYS.subscriptions, {})[user.id]) || [],
      alertes: has(DB.KEYS.alerts, (a) => a.userId === user.id),
      recherches_enregistrees: has(DB.KEYS.savedSearches, (s) => s.userId === user.id),
      messages: has(DB.KEYS.messages, (m) => m.buyerId === user.id),
    };
  }

  /**
   * Supprime le compte courant et ses données personnelles côté client.
   * Les commandes sont conservées (registre du vendeur) mais anonymisées.
   */
  function deleteAccount() {
    const user = current();
    if (!user) return { ok: false, error: "Non connecté." };
    const id = user.id;
    // Anonymise les commandes du client (conservées pour le vendeur).
    DB.all(DB.KEYS.orders).forEach((o) => {
      if (o.buyerId === id) DB.update(DB.KEYS.orders, o.id, { buyerId: "compte_supprime", buyerName: "Client supprimé" });
    });
    // Supprime les données rattachées à l'utilisateur.
    [DB.KEYS.reviews, DB.KEYS.questions, DB.KEYS.alerts, DB.KEYS.savedSearches].forEach((key) => {
      DB.all(key).filter((x) => x.userId === id).forEach((x) => DB.removeItem(key, x.id));
    });
    ["favorites", "subscriptions", "recent", "searchHist", "carts"].forEach((k) => {
      const map = DB.get(DB.KEYS[k], {});
      if (map && map[id] !== undefined) { delete map[id]; DB.set(DB.KEYS[k], map); }
    });
    DB.removeItem(DB.KEYS.users, id);
    logout();
    return { ok: true };
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
    changePassword, exportData, deleteAccount,
  };
})();
