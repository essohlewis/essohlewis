/* =========================================================================
   notifications.js — Système de notifications côté client (localStorage).
   Déclencheurs : nouvel article d'un vendeur suivi, changement de statut de
   commande, réponse à un avis.
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;
  const K = DB.KEYS.notifications;

  /** Toutes les notifications d'un utilisateur, plus récentes en premier. */
  function forUser(userId) {
    return DB.all(K)
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Nombre de notifications non lues de l'utilisateur courant. */
  function unreadCount() {
    const user = window.MP.Auth && window.MP.Auth.current();
    if (!user) return 0;
    return DB.all(K).filter((n) => n.userId === user.id && !n.read).length;
  }

  /**
   * Crée une notification.
   * @param {string} userId destinataire
   * @param {object} data { type, message, link, icon }
   */
  // Correspondance type de notification -> clé de préférence utilisateur.
  const PREF_KEY = { new_product: "newProduct", order_status: "orderStatus", review_reply: "orderStatus", message: "messages" };

  function push(userId, data) {
    if (!userId) return;
    // Respecte les préférences de notification du destinataire (si définies).
    const recipient = DB.find(DB.KEYS.users, userId);
    if (recipient && recipient.notifPrefs) {
      const key = PREF_KEY[data.type];
      if (key && recipient.notifPrefs[key] === false) return;
    }
    const notif = {
      id: DB.uid("ntf"),
      userId,
      type: data.type || "info",
      message: data.message || "",
      link: data.link || "",
      read: false,
      createdAt: Date.now(),
    };
    DB.insert(K, notif);
    // Rafraîchit le badge si le destinataire est l'utilisateur connecté.
    const cur = window.MP.Auth && window.MP.Auth.current();
    if (cur && cur.id === userId && window.MP.UI) window.MP.UI.refreshBadges();
    return notif;
  }

  /**
   * Notifie tous les abonnés d'une boutique (ex : nouvel article publié).
   */
  function notifySubscribers(storeId, data) {
    const subs = DB.get(DB.KEYS.subscriptions, {});
    Object.keys(subs).forEach((userId) => {
      if ((subs[userId] || []).includes(storeId)) {
        push(userId, data);
      }
    });
  }

  function markRead(id) {
    DB.update(K, id, { read: true });
    if (window.MP.UI) window.MP.UI.refreshBadges();
  }

  function markAllRead(userId) {
    const list = DB.all(K);
    list.forEach((n) => { if (n.userId === userId) n.read = true; });
    DB.set(K, list);
    if (window.MP.UI) window.MP.UI.refreshBadges();
  }

  function clearAll(userId) {
    DB.set(K, DB.all(K).filter((n) => n.userId !== userId));
    if (window.MP.UI) window.MP.UI.refreshBadges();
  }

  /** Supprime une notification unique. */
  function remove(id) {
    DB.removeItem(K, id);
    if (window.MP.UI) window.MP.UI.refreshBadges();
  }

  window.MP.Notifications = {
    forUser, unreadCount, push, notifySubscribers, markRead, markAllRead, clearAll, remove,
  };
})();
