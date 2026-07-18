/* ==========================================================================
   utils/otp.js — Code de présence rotatif (type TOTP), régénéré toutes les 30 s.
   Le jeton de la réservation reste secret (jamais affiché) ; on en dérive un
   code à 6 chiffres qui change à chaque fenêtre de 30 secondes. Un code capturé
   devient inutilisable après expiration → sécurité renforcée du QR de présence.
   La dérivation (FNV-1a + avalanche, 32 bits) est STRICTEMENT identique côté
   PHP (core/Otp.php) pour que la validation serveur concorde avec l'affichage.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  var PERIODE = 30; // secondes

  // Multiplication 32 bits non signée (équivalent Math.imul, reproductible en PHP).
  function imul(a, b) { return Math.imul(a, b) >>> 0; }

  // Hachage déterministe 32 bits (FNV-1a + avalanche). ASCII uniquement.
  function hash(str) {
    var h = 0x811c9dc5 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h = (h ^ str.charCodeAt(i)) >>> 0;
      h = imul(h, 0x01000193);
    }
    h = (h ^ (h >>> 15)) >>> 0; h = imul(h, 0x2c1b3c6d);
    h = (h ^ (h >>> 13)) >>> 0; h = imul(h, 0x297a2d39);
    h = (h ^ (h >>> 16)) >>> 0;
    return h >>> 0;
  }

  function fenetre(t) { return Math.floor((t == null ? Date.now() : t) / 1000 / PERIODE); }
  function code(secret, f) { return String(hash(String(secret) + "|" + f) % 1000000).padStart(6, "0"); }
  function payload(secret, f) { return "CLQR-" + f + "-" + code(secret, f); }

  CL.otp = {
    PERIODE: PERIODE,
    fenetre: fenetre,
    code: code,
    payload: payload,

    /** État courant : { fenetre, code, payload, resteSec }. */
    courant: function (secret, t) {
      var now = t == null ? Date.now() : t, f = fenetre(now);
      return { fenetre: f, code: code(secret, f), payload: payload(secret, f), resteSec: PERIODE - Math.floor((now / 1000) % PERIODE) };
    },

    /** Fenêtre correspondante (nombre) si le code est valide (± `tol`), sinon null. */
    fenetreValide: function (secret, saisi, t, tol) {
      saisi = String(saisi == null ? "" : saisi).trim();
      var m = saisi.match(/(\d{6})$/); if (m) saisi = m[1]; // accepte le code brut ou le payload complet
      if (!/^\d{6}$/.test(saisi)) return null;
      var f = fenetre(t); tol = tol == null ? 1 : tol;
      for (var d = -tol; d <= tol; d++) if (code(secret, f + d) === saisi) return f + d;
      return null;
    },

    /** Valide un code saisi/scané en tolérant la fenêtre courante ± `tol` (défaut 1). */
    valide: function (secret, saisi, t, tol) {
      return this.fenetreValide(secret, saisi, t, tol) !== null;
    },
  };
})();
