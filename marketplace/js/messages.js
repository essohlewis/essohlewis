/* =========================================================================
   messages.js — Messagerie in-app acheteur ↔ vendeur (localStorage).
   Une conversation = (storeId, buyerId). Chaque message a un émetteur
   ("buyer" ou "seller").
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;
  const K = DB.KEYS.messages;

  function all() { return DB.all(K); }

  /** Messages d'une conversation, plus anciens en premier. */
  function conversation(storeId, buyerId) {
    return all().filter((m) => m.storeId === storeId && m.buyerId === buyerId).sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Envoie un message.
   * @param {object} { storeId, buyerId, buyerName, from, text, productId }
   */
  function send(data) {
    const text = String(data.text || "").trim();
    if (!text) return { ok: false };
    const msg = {
      id: DB.uid("msg"),
      storeId: data.storeId,
      buyerId: data.buyerId,
      buyerName: data.buyerName || "",
      from: data.from === "seller" ? "seller" : "buyer",
      text,
      productId: data.productId || "",
      read: false,
      createdAt: Date.now(),
    };
    DB.insert(K, msg);

    // Notifie le destinataire.
    const store = window.MP.Store.get(data.storeId);
    if (msg.from === "buyer" && store) {
      window.MP.Notifications.push(store.ownerId, { type: "message", message: `Nouveau message de ${msg.buyerName || "un client"}.`, link: "#/seller/messages" });
    } else if (msg.from === "seller") {
      window.MP.Notifications.push(data.buyerId, { type: "message", message: `${store ? store.name : "Le vendeur"} vous a répondu.`, link: "#/messages" });
    }
    return { ok: true, msg };
  }

  /** Marque comme lus les messages reçus par un point de vue donné. */
  function markRead(storeId, buyerId, viewer) {
    // viewer = "seller" lit les messages "buyer" ; "buyer" lit les "seller".
    const target = viewer === "seller" ? "buyer" : "seller";
    const list = all();
    let changed = false;
    list.forEach((m) => {
      if (m.storeId === storeId && m.buyerId === buyerId && m.from === target && !m.read) { m.read = true; changed = true; }
    });
    if (changed) DB.set(K, list);
  }

  /** Conversations d'une boutique (pour le vendeur), regroupées par acheteur. */
  function threadsForStore(storeId) {
    const map = {};
    all().filter((m) => m.storeId === storeId).forEach((m) => {
      if (!map[m.buyerId]) map[m.buyerId] = { buyerId: m.buyerId, buyerName: m.buyerName, last: 0, unread: 0, count: 0 };
      const t = map[m.buyerId];
      t.count++;
      t.last = Math.max(t.last, m.createdAt);
      if (m.from === "buyer" && !m.read) t.unread++;
      if (m.buyerName) t.buyerName = m.buyerName;
    });
    return Object.values(map).sort((a, b) => b.last - a.last);
  }

  /** Conversations d'un acheteur (toutes boutiques confondues). */
  function threadsForBuyer(buyerId) {
    const map = {};
    all().filter((m) => m.buyerId === buyerId).forEach((m) => {
      if (!map[m.storeId]) map[m.storeId] = { storeId: m.storeId, last: 0, unread: 0, count: 0 };
      const t = map[m.storeId];
      t.count++;
      t.last = Math.max(t.last, m.createdAt);
      if (m.from === "seller" && !m.read) t.unread++;
    });
    return Object.values(map).sort((a, b) => b.last - a.last);
  }

  function unreadForSeller(storeId) {
    return all().filter((m) => m.storeId === storeId && m.from === "buyer" && !m.read).length;
  }
  function unreadForBuyer(buyerId) {
    return all().filter((m) => m.buyerId === buyerId && m.from === "seller" && !m.read).length;
  }

  window.MP.Messages = {
    all, conversation, send, markRead, threadsForStore, threadsForBuyer, unreadForSeller, unreadForBuyer,
  };
})();
