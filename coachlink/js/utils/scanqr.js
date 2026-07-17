/* ==========================================================================
   utils/scanqr.js — Scan caméra d'un QR, réutilisable (réservations,
   abonnements…). Utilise BarcodeDetector s'il existe, sinon jsQR (décodeur
   autonome) sur les images de la vidéo — fonctionne sur tous les navigateurs.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};
  const el = CL.dom.el;

  const scanQr = {
    /** Caméra disponible (getUserMedia) sur cet appareil / ce contexte. */
    disponible() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); },

    /**
     * Démarre le scan dans `container`. Appelle `onDetecte(valeur)` au 1er QR lu.
     * Renvoie une fonction d'arrêt. Peut lever (caméra refusée / indisponible).
     */
    async camera(container, onDetecte) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = el("video", { style: "width:100%;max-width:300px;border-radius:10px;background:#000", autoplay: "autoplay", muted: "muted", playsinline: "playsinline" });
      video.setAttribute("muted", ""); video.setAttribute("playsinline", "");
      video.srcObject = stream; try { await video.play(); } catch (_) { /* certains navigateurs jouent après insertion */ }
      CL.dom.vider(container); container.appendChild(video);

      const detector = ("BarcodeDetector" in window) ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
      let canvas = null, cctx = null;
      if (!detector) { canvas = document.createElement("canvas"); cctx = canvas.getContext("2d", { willReadFrequently: true }); }

      let actif = true;
      function arreter() { actif = false; try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {} CL.dom.vider(container); }
      async function tick() {
        if (!actif) return;
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes && codes.length) { const v = codes[0].rawValue; arreter(); onDetecte(v); return; }
          } else if (video.videoWidth && window.jsQR) {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            cctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = cctx.getImageData(0, 0, canvas.width, canvas.height);
            const res = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
            if (res && res.data) { arreter(); onDetecte(res.data); return; }
          }
        } catch (_) { /* trame illisible → on réessaie */ }
        if (actif) requestAnimationFrame(tick);
      }
      tick();
      return arreter;
    },

    /**
     * Ouvre une modale « scanner ou saisir un code ». `onValider(code)` doit
     * renvoyer une promesse { ok, message? }. En cas de succès, la modale se ferme.
     * opts : { titre, phrase, labelCode, boutonValider, onSucces(res) }
     */
    modal(opts) {
      opts = opts || {};
      const code = el("input", { class: "input", inputmode: "numeric", placeholder: "Code à 6 chiffres", maxlength: "6", style: "font-family:monospace;letter-spacing:4px;text-align:center;font-size:1.2rem" });
      const zoneScan = el("div", { style: "display:flex;justify-content:center" });
      let arreter = null;
      const libelleScan = () => { btnCam.innerHTML = CL.icon("qrcode", 16) + " Scanner le QR avec la caméra"; };

      async function soumettre(valeur, btn) {
        if (btn) btn.disabled = true;
        const res = await opts.onValider(valeur);
        if (!res || !res.ok) { if (btn) btn.disabled = false; return CL.toast.erreur("Validation impossible", (res && res.message) || ""); }
        if (arreter) { arreter(); arreter = null; }
        CL.modal.fermer();
        opts.onSucces && opts.onSucces(res);
      }

      const btnCam = el("button", { class: "btn btn-primaire btn-bloc", html: CL.icon("qrcode", 16) + " Scanner le QR avec la caméra" });
      btnCam.addEventListener("click", async () => {
        if (arreter) { arreter(); arreter = null; libelleScan(); return; }
        if (!scanQr.disponible()) {
          return CL.toast.erreur("Caméra indisponible",
            window.isSecureContext ? "Ce navigateur ne permet pas l'accès à la caméra. Saisissez le code à 6 chiffres."
              : "La caméra nécessite une connexion sécurisée (HTTPS). Saisissez le code à 6 chiffres.");
        }
        btnCam.disabled = true;
        try {
          arreter = await scanQr.camera(zoneScan, (valeur) => { arreter = null; libelleScan(); btnCam.disabled = false; soumettre(valeur, null); });
          btnCam.innerHTML = CL.icon("fermer", 16) + " Arrêter la caméra"; btnCam.disabled = false;
        } catch (e) {
          btnCam.disabled = false; libelleScan();
          const nom = e && e.name;
          const msg = nom === "NotAllowedError" ? "Autorisez l'accès à la caméra dans votre navigateur, puis réessayez."
            : nom === "NotFoundError" ? "Aucune caméra détectée sur cet appareil."
              : "Impossible d'ouvrir la caméra. Saisissez le code à 6 chiffres.";
          CL.toast.erreur("Caméra", msg);
        }
      });

      CL.modal.ouvrir({
        titre: opts.titre || "Valider par QR",
        contenu: el("div", { class: "pile-3" }, [
          opts.phrase ? el("p", { class: "texte-sm texte-doux", text: opts.phrase }) : null,
          btnCam,
          zoneScan,
          el("div", { class: "champ" }, [el("label", { text: opts.labelCode || "Code de présence (valable 30 s)" }), code]),
        ]),
        pied: [
          el("button", { class: "btn btn-fantome", text: "Annuler", onclick: () => { if (arreter) arreter(); CL.modal.fermer(); } }),
          el("button", { class: "btn btn-succes", html: CL.icon("check", 16) + " " + (opts.boutonValider || "Valider"), onclick: (e) => soumettre(code.value, e.currentTarget) }),
        ],
      });
    },
  };

  CL.scanQr = scanQr;
})();
