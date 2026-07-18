/* =========================================================================
   orders.js — Commandes (paiement à la livraison). Une commande par boutique.
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;
  const K = DB.KEYS.orders;

  // Libellés lisibles des statuts.
  const STATUS = {
    en_attente: "En attente",
    confirmee: "Confirmée",
    expediee: "Expédiée",
    livree: "Livrée",
    annulee: "Annulée",
  };
  const STATUS_FLOW = ["en_attente", "confirmee", "expediee", "livree"];

  /** Numéro de commande lisible : CI-AAMMJJ-XXXX. */
  function _number() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `CI-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${rnd}`;
  }

  /**
   * Valide les coordonnées de livraison.
   */
  function validateDelivery(d) {
    if (!d.name || !d.name.trim()) return "Nom du destinataire requis.";
    if (!window.MP.Auth.validPhone(d.phone)) return "Numéro de téléphone de livraison invalide.";
    if (!d.commune) return "Commune de livraison requise.";
    if (!d.address || d.address.trim().length < 4) return "Adresse / point de repère requis.";
    return null;
  }

  /**
   * Passe commande à partir du panier groupé : crée une commande par boutique.
   * @param {object} delivery coordonnées de livraison
   * @returns { ok, error?, orders? }
   */
  function checkout(delivery) {
    const user = window.MP.Auth.current();
    if (!user) return { ok: false, error: "Connexion requise." };

    const err = validateDelivery(delivery);
    if (err) return { ok: false, error: err };

    const groups = window.MP.Cart.grouped();
    if (!groups.length) return { ok: false, error: "Votre panier est vide." };

    const created = [];
    groups.forEach((g) => {
      const order = {
        id: DB.uid("ord"),
        number: _number(),
        buyerId: user.id,
        buyerName: user.name,
        storeId: g.store.id,
        storeName: g.store.name,
        items: g.lines.map((l) => ({
          productId: l.product.id,
          title: l.product.title,
          image: (l.product.images && l.product.images[0]) || "",
          unit: l.unit,
          qty: l.qty,
          variant: l.variant || {},
        })),
        total: g.subtotal,
        status: "en_attente",
        payment: "livraison", // paiement à la livraison
        delivery: {
          name: delivery.name.trim(),
          phone: delivery.phone.trim(),
          commune: delivery.commune,
          address: delivery.address.trim(),
          note: (delivery.note || "").trim(),
        },
        createdAt: Date.now(),
        history: [{ status: "en_attente", at: Date.now() }],
      };
      DB.insert(K, order);
      created.push(order);

      // Décrémente le stock.
      g.lines.forEach((l) => window.MP.Products.decrementStock(l.product.id, l.qty));

      // Simule le chiffre d'affaires de la boutique. On écrit directement via
      // DB : c'est une opération système au checkout (l'acheteur n'est pas le
      // propriétaire de la boutique, la garde d'autorisation de Store.update
      // bloquerait la mise à jour).
      const store = window.MP.Store.get(g.store.id);
      DB.update(DB.KEYS.stores, g.store.id, { revenueSim: (store.revenueSim || 0) + g.subtotal });

      // Notifie le vendeur.
      window.MP.Notifications.push(g.store.ownerId, {
        type: "new_order",
        message: `Nouvelle commande ${order.number} (${window.MP.UI.fcfa(order.total)}) à livrer.`,
        link: "#/seller/orders",
      });
    });

    // Vide le panier.
    window.MP.Cart.clear();
    return { ok: true, orders: created };
  }

  function get(id) { return DB.find(K, id); }

  /** Commandes passées par un acheteur. */
  function byBuyer(userId) {
    return DB.all(K).filter((o) => o.buyerId === userId).sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Commandes reçues par une boutique. */
  function byStore(storeId) {
    return DB.all(K).filter((o) => o.storeId === storeId).sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Change le statut d'une commande (vendeur) -> notifie l'acheteur. */
  function setStatus(orderId, status) {
    if (!STATUS[status]) return { ok: false };
    const order = get(orderId);
    if (!order) return { ok: false };
    const history = (order.history || []).concat([{ status, at: Date.now() }]);
    DB.update(K, orderId, { status, history });
    window.MP.Notifications.push(order.buyerId, {
      type: "order_status",
      message: `Votre commande ${order.number} est désormais « ${STATUS[status]} ».`,
      link: "#/orders",
    });
    return { ok: true };
  }

  window.MP.Orders = {
    STATUS, STATUS_FLOW, checkout, get, byBuyer, byStore, setStatus, validateDelivery,
  };
})();
