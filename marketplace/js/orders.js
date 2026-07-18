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
  function checkout(delivery, opts) {
    opts = opts || {};
    const user = window.MP.Auth.current();
    if (!user) return { ok: false, error: "Connexion requise." };

    const err = validateDelivery(delivery);
    if (err) return { ok: false, error: err };

    const groups = window.MP.Cart.grouped();
    if (!groups.length) return { ok: false, error: "Votre panier est vide." };

    // Vérifie la disponibilité de chaque boutique (mode fermé / zone desservie).
    for (const g of groups) {
      const store = window.MP.Store.get(g.store.id);
      if (store && store.closed) return { ok: false, error: `La boutique « ${store.name} » est actuellement fermée.` };
      if (store && !window.MP.Store.servesCommune(store, delivery.commune)) {
        return { ok: false, error: `« ${store.name} » ne livre pas encore à ${delivery.commune}.` };
      }
    }

    const code = String(opts.code || "").trim();
    const slot = String(opts.slot || "").trim();

    const created = [];
    groups.forEach((g) => {
      const store = window.MP.Store.get(g.store.id);
      let fee = window.MP.Store.deliveryFee(store, delivery.commune);

      // Coupon (spécifique à la boutique) + livraison offerte dès un seuil.
      let discount = 0, appliedCode = "", couponId = "";
      if (code) {
        const v = window.MP.Coupons.validate(g.store.id, code, g.subtotal);
        if (v.ok) {
          appliedCode = v.coupon.code; couponId = v.coupon.id;
          discount = v.discount || 0;
          if (v.freeShip) fee = 0;
        }
      }
      if (store.freeShipThreshold && g.subtotal >= store.freeShipThreshold) fee = 0;

      const total = Math.max(0, g.subtotal - discount) + fee;
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
          cost: l.product.cost || 0, // coût d'achat au moment de la commande (marge)
          qty: l.qty,
          variant: l.variant || {},
        })),
        itemsTotal: g.subtotal,        // montant des articles
        discount,                      // remise coupon
        couponCode: appliedCode,       // code appliqué
        deliveryFee: fee,              // frais de livraison
        total,                         // montant à encaisser à la livraison
        status: "en_attente",
        paid: false,                   // encaissement (COD)
        payment: "livraison",          // paiement à la livraison
        slot,                          // créneau de livraison souhaité
        cancelReason: "",              // motif d'annulation
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
      if (couponId) window.MP.Coupons.redeem(couponId);

      // Décrémente le stock + notifie le vendeur en cas de stock faible/rupture.
      g.lines.forEach((l) => {
        window.MP.Products.decrementStock(l.product.id, l.qty);
        const p = window.MP.Products.get(l.product.id);
        if (p && p.stock <= 0) {
          window.MP.Notifications.push(store.ownerId, { type: "info", message: `Rupture de stock : « ${p.title} ».`, link: "#/seller/products?status=published" });
        } else if (p && p.stock <= 3) {
          window.MP.Notifications.push(store.ownerId, { type: "info", message: `Stock faible (${p.stock}) : « ${p.title} ».`, link: "#/seller/products" });
        }
      });

      // Simule le chiffre d'affaires (articles moins remise) — écriture système.
      DB.update(DB.KEYS.stores, g.store.id, { revenueSim: (store.revenueSim || 0) + Math.max(0, g.subtotal - discount) });

      // Notifie le vendeur de la nouvelle commande.
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
    const patch = { status, history };
    // Une commande livrée est considérée encaissée (paiement à la livraison).
    if (status === "livree") patch.paid = true;
    DB.update(K, orderId, patch);
    window.MP.Notifications.push(order.buyerId, {
      type: "order_status",
      message: `Votre commande ${order.number} est désormais « ${STATUS[status]} ».`,
      link: "#/orders",
    });
    return { ok: true };
  }

  /**
   * Annule une commande avec un motif (par l'acheteur ou le vendeur).
   * @param {string} by "buyer" | "seller"
   */
  function cancel(orderId, reason, by) {
    const order = get(orderId);
    if (!order) return { ok: false };
    if (order.status === "livree") return { ok: false, error: "Une commande livrée ne peut être annulée." };
    const history = (order.history || []).concat([{ status: "annulee", at: Date.now() }]);
    DB.update(K, orderId, { status: "annulee", cancelReason: String(reason || "").trim(), history });
    // Restaure le stock des articles.
    order.items.forEach((it) => {
      const p = window.MP.Products.get(it.productId);
      if (p) window.MP.Products.quickSet(p.id, { stock: (p.stock || 0) + it.qty });
    });
    // Notifie l'autre partie.
    if (by === "buyer") {
      const store = window.MP.Store.get(order.storeId);
      if (store) window.MP.Notifications.push(store.ownerId, { type: "order_status", message: `Commande ${order.number} annulée par le client${reason ? " : " + reason : ""}.`, link: "#/seller/orders" });
    } else {
      window.MP.Notifications.push(order.buyerId, { type: "order_status", message: `Votre commande ${order.number} a été annulée par le vendeur${reason ? " : " + reason : ""}.`, link: "#/orders" });
    }
    return { ok: true };
  }

  /** Marque une commande comme encaissée / non encaissée (COD). */
  function setPaid(orderId, paid) {
    const order = get(orderId);
    if (!order) return { ok: false };
    DB.update(K, orderId, { paid: !!paid });
    return { ok: true };
  }

  /**
   * Le vendeur ajuste les frais de livraison d'une commande.
   * Recalcule le total et notifie l'acheteur.
   */
  function setDeliveryFee(orderId, fee) {
    const order = get(orderId);
    if (!order) return { ok: false };
    fee = Math.max(0, Math.round(Number(fee) || 0));
    const itemsTotal = order.itemsTotal != null ? order.itemsTotal : (order.total - (order.deliveryFee || 0));
    const total = itemsTotal + fee;
    DB.update(K, orderId, { itemsTotal, deliveryFee: fee, total });
    window.MP.Notifications.push(order.buyerId, {
      type: "order_status",
      message: `Frais de livraison de la commande ${order.number} : ${window.MP.UI.fcfa(fee)}. Nouveau total à régler : ${window.MP.UI.fcfa(total)}.`,
      link: "#/orders",
    });
    return { ok: true, total };
  }

  window.MP.Orders = {
    STATUS, STATUS_FLOW, checkout, get, byBuyer, byStore, setStatus, setPaid, setDeliveryFee, cancel, validateDelivery,
  };
})();
