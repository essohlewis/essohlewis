/**
 * totp.js — TOTP (RFC 6238) sans dépendance externe, pour la double
 * authentification par application (Google Authenticator, Authy, …).
 */
"use strict";

const crypto = require("crypto");
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
  let bits = 0, val = 0, out = "";
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  str = String(str || "").replace(/=+$/, "").toUpperCase();
  let bits = 0, val = 0; const out = [];
  for (const c of str) {
    const idx = B32.indexOf(c); if (idx < 0) continue;
    val = (val << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

function generateSecret() { return base32Encode(crypto.randomBytes(20)); }

function hotp(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", key).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff);
  return String(code % 1000000).padStart(6, "0");
}

/** Code TOTP courant (fenêtre 30 s). */
function totp(secret, t) { return hotp(secret, Math.floor((t || Date.now()) / 1000 / 30)); }

/** Vérifie un code sur une petite fenêtre temporelle (tolérance de dérive). */
function verify(secret, token, window) {
  if (!/^\d{6}$/.test(String(token || ""))) return false;
  const w = window == null ? 1 : window;
  const c = Math.floor(Date.now() / 1000 / 30);
  for (let i = -w; i <= w; i++) if (hotp(secret, c + i) === String(token)) return true;
  return false;
}

/** URI otpauth:// à afficher en QR code pour l'appli d'authentification. */
function uri(secret, label, issuer) {
  issuer = issuer || "Marché CI";
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=30`;
}

module.exports = { generateSecret, totp, verify, uri };
