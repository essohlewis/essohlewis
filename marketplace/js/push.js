/* =========================================================================
   push.js — Notifications push web (côté client).
   S'appuie sur le Service Worker (sw.js) et l'API serveur (/api/shop/push/*).
   Dégradation propre : sans support navigateur, sans serveur ou en file://,
   toutes les fonctions renvoient un état « non supporté » sans erreur.
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const API_BASE = (location.protocol === "http:" || location.protocol === "https:") ? "/api/shop" : null;

  function supported() {
    return !!API_BASE && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }
  function token() { return (window.MP.Api && window.MP.Api.token && window.MP.Api.token()) || ""; }

  function urlBase64ToUint8Array(base64) {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  async function registration() {
    if (!("serviceWorker" in navigator)) return null;
    return (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.ready);
  }

  /** État courant : { supported, permission, subscribed }. */
  async function status() {
    if (!supported()) return { supported: false, permission: "unsupported", subscribed: false };
    let subscribed = false;
    try { const reg = await registration(); subscribed = !!(reg && (await reg.pushManager.getSubscription())); } catch (e) {}
    return { supported: true, permission: Notification.permission, subscribed };
  }

  async function serverKey() {
    const r = await fetch(API_BASE + "/push/vapidPublicKey");
    const j = await r.json();
    if (!j || !j.ok || !j.key) throw new Error("Clé VAPID indisponible");
    return j.key;
  }

  /** Demande la permission puis s'abonne et enregistre l'abonnement côté serveur. */
  async function enable() {
    if (!supported()) return { ok: false, error: "Non supporté par ce navigateur." };
    if (!token()) return { ok: false, error: "Connectez-vous pour activer les notifications." };
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, error: "Permission refusée." };
    const reg = await registration();
    if (!reg) return { ok: false, error: "Service Worker indisponible." };
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const key = await serverKey();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
    }
    const r = await fetch(API_BASE + "/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
      body: JSON.stringify({ subscription: sub.toJSON ? sub.toJSON() : sub }),
    });
    const j = await r.json().catch(() => ({}));
    return j && j.ok ? { ok: true } : { ok: false, error: (j && j.error) || "Échec de l'abonnement." };
  }

  /** Se désabonne (localement + côté serveur). */
  async function disable() {
    if (!supported()) return { ok: false };
    try {
      const reg = await registration();
      const sub = reg && (await reg.pushManager.getSubscription());
      if (sub) {
        await fetch(API_BASE + "/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
    } catch (e) {}
    return { ok: true };
  }

  /** Envoie une notification de test à soi-même. */
  async function test() {
    if (!token()) return { ok: false, error: "Connexion requise." };
    const r = await fetch(API_BASE + "/push/test", { method: "POST", headers: { Authorization: "Bearer " + token() } });
    return r.json().catch(() => ({ ok: false }));
  }

  window.MP.Push = { supported, status, enable, disable, test };
})();
