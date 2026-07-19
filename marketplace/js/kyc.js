/* =========================================================================
   kyc.js — Vérification d'identité vendeur (front).
   Dialogue avec le backend PHP (backend/api.php) quand il est joignable ;
   sinon, repli local (localStorage) pour que la démo fonctionne en file://.
   Gère aussi la capture caméra en direct (getUserMedia) et la détection de
   visage (FaceDetector, si disponible).
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;

  const KYC = {
    enabled: false,             // backend joignable ?
    faceMatch: false,           // service biométrique externe branché ?
    adminToken: "admin-demo-token", // doit correspondre à ADMIN_TOKEN côté PHP
    _stream: null,
  };

  /** URL de base de l'API, ou null si on est en file:// (backend inutilisable). */
  function apiBase() {
    if (location.protocol !== "http:" && location.protocol !== "https:") return null;
    // backend/api.php relatif à la racine du site.
    const path = location.pathname.replace(/[^/]*$/, "");
    return path + "backend/api.php";
  }

  /** Teste la présence du backend (action=ping). */
  async function init() {
    const base = apiBase();
    if (!base) { KYC.enabled = false; return; }
    try {
      const r = await fetch(base + "?action=ping", { cache: "no-store" });
      const j = await r.json();
      KYC.enabled = !!(j && j.ok);
      KYC.faceMatch = !!(j && j.faceMatch);
    } catch (e) { KYC.enabled = false; }
  }

  /** Contexte sécurisé requis par la caméra (http(s) ou localhost). */
  function secureContextOk() {
    return (window.isSecureContext === true) || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  }

  /* -------------------- API vendeur -------------------- */
  async function submit(payload) {
    if (KYC.enabled) {
      const r = await fetch(apiBase() + "?action=submit", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      return await r.json();
    }
    // Repli localStorage : écrit dans la boutique (revue par l'admin en local).
    if (payload.storeId) {
      DB.update(DB.KEYS.stores, payload.storeId, {
        kyc: { status: "pending", doc: payload.idImage, selfie: payload.selfie, idType: payload.idType, idNumber: payload.idNumber, submittedAt: Date.now() },
      });
    }
    return { ok: true, status: "pending", local: true };
  }

  async function status(vendorId, store) {
    if (KYC.enabled) {
      try {
        const r = await fetch(apiBase() + "?action=status&vendorId=" + encodeURIComponent(vendorId), { cache: "no-store" });
        return await r.json();
      } catch (e) { /* bascule sur le local */ }
    }
    const st = store && store.kyc ? store.kyc.status : "none";
    return { ok: true, status: st || "none", reason: (store && store.kyc && store.kyc.reason) || "", local: true };
  }

  /* -------------------- API admin -------------------- */
  function _tokUrl(url) { return url + (url.indexOf("?") >= 0 ? "&" : "?") + "token=" + encodeURIComponent(KYC.adminToken); }

  async function list(statusFilter) {
    const base = apiBase();
    const r = await fetch(base + "?action=list&status=" + (statusFilter || "pending"), { headers: { "X-Admin-Token": KYC.adminToken }, cache: "no-store" });
    const j = await r.json();
    if (!j.ok) return [];
    // Complète les URLs d'images avec la base + le token (pour les <img>).
    const dir = base.replace(/[^/]*$/, "");
    return (j.items || []).map((it) => Object.assign({}, it, {
      idImageUrl: it.idImageUrl ? _tokUrl(dir + it.idImageUrl) : "",
      idBackUrl: it.idBackUrl ? _tokUrl(dir + it.idBackUrl) : "",
      selfieUrl: it.selfieUrl ? _tokUrl(dir + it.selfieUrl) : "",
    }));
  }

  async function review(id, decision, reason) {
    const r = await fetch(apiBase() + "?action=review", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Admin-Token": KYC.adminToken },
      body: JSON.stringify({ id, decision, reason: reason || "" }),
    });
    return await r.json();
  }

  /* -------------------- Caméra (capture en direct) -------------------- */
  const camera = {
    async start(videoEl) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("no-camera");
      KYC._stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } }, audio: false });
      videoEl.srcObject = KYC._stream;
      await videoEl.play().catch(() => {});
      return KYC._stream;
    },
    /** Capture l'image courante de la vidéo → data URL (JPEG). */
    capture(videoEl) {
      const w = videoEl.videoWidth || 480, h = videoEl.videoHeight || 480;
      const side = Math.min(w, h);
      const cv = document.createElement("canvas");
      cv.width = 480; cv.height = 480;
      const ctx = cv.getContext("2d");
      // Recadre au centre (carré) et effet miroir (comme un miroir).
      ctx.translate(cv.width, 0); ctx.scale(-1, 1);
      ctx.drawImage(videoEl, (w - side) / 2, (h - side) / 2, side, side, 0, 0, 480, 480);
      return cv.toDataURL("image/jpeg", 0.85);
    },
    stop() {
      if (KYC._stream) { KYC._stream.getTracks().forEach((t) => t.stop()); KYC._stream = null; }
    },
  };

  /** Détecte la présence d'un visage (FaceDetector). null = API indisponible. */
  async function detectFace(dataUrl) {
    if (!("FaceDetector" in window)) return null;
    try {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
      const fd = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await fd.detect(img);
      return faces && faces.length > 0;
    } catch (e) { return null; }
  }

  KYC.apiBase = apiBase;
  KYC.init = init;
  KYC.secureContextOk = secureContextOk;
  KYC.submit = submit;
  KYC.status = status;
  KYC.list = list;
  KYC.review = review;
  KYC.camera = camera;
  KYC.detectFace = detectFace;
  window.MP.KYC = KYC;
})();
