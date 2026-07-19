/* =========================================================================
   kyc.js — Vérification d'identité vendeur (100 % front-end).
   Pièce d'identité + selfie capturé en direct (getUserMedia), stockés
   localement (localStorage). La revue est faite manuellement par l'admin.
   Détection de visage best-effort via l'API FaceDetector si disponible.
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;

  const KYC = {
    enabled: false,   // pas de backend : fonctionnement 100 % local
    faceMatch: false, // pas de service biométrique
    _stream: null,
  };

  /** Initialisation (aucun backend). */
  function init() { KYC.enabled = false; KYC.faceMatch = false; }

  /** Contexte sécurisé requis par la caméra (http(s) ou localhost). */
  function secureContextOk() {
    return (window.isSecureContext === true) || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  }

  /* -------------------- API vendeur -------------------- */
  /** Enregistre la vérification dans la boutique (localStorage). */
  async function submit(payload) {
    if (payload.storeId) {
      DB.update(DB.KEYS.stores, payload.storeId, {
        kyc: { status: "pending", doc: payload.idImage, selfie: payload.selfie, idType: payload.idType, idNumber: payload.idNumber, submittedAt: Date.now() },
      });
    }
    return { ok: true, status: "pending", local: true };
  }

  /** Statut de vérification lu depuis la boutique (localStorage). */
  async function status(vendorId, store) {
    const st = store && store.kyc ? store.kyc.status : "none";
    return { ok: true, status: st || "none", reason: (store && store.kyc && store.kyc.reason) || "", local: true };
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
    capture(videoEl, size) {
      size = size || 480;
      const w = videoEl.videoWidth || 480, h = videoEl.videoHeight || 480;
      const side = Math.min(w, h);
      const cv = document.createElement("canvas");
      cv.width = size; cv.height = size;
      const ctx = cv.getContext("2d");
      // Recadre au centre (carré) et effet miroir (comme un miroir).
      ctx.translate(cv.width, 0); ctx.scale(-1, 1);
      ctx.drawImage(videoEl, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
      return cv.toDataURL("image/jpeg", size <= 260 ? 0.7 : 0.85);
    },
    /** Capture une rafale de N images (pour la vivacité), en basse résolution. */
    async captureBurst(videoEl, count, intervalMs, onTick) {
      count = count || 10; intervalMs = intervalMs || 260;
      const frames = [];
      for (let i = 0; i < count; i++) {
        frames.push(this.capture(videoEl, 260));
        if (onTick) onTick(i + 1, count);
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      return frames;
    },
    stop() {
      if (KYC._stream) { KYC._stream.getTracks().forEach((t) => t.stop()); KYC._stream = null; }
    },
  };

  /** Vivacité indisponible sans service : ignorée (best-effort front-only). */
  async function checkLiveness() { return { live: null, skipped: true }; }

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

  KYC.init = init;
  KYC.secureContextOk = secureContextOk;
  KYC.submit = submit;
  KYC.status = status;
  KYC.camera = camera;
  KYC.detectFace = detectFace;
  KYC.checkLiveness = checkLiveness;
  window.MP.KYC = KYC;
})();
