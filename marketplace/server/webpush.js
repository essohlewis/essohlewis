/**
 * webpush.js — Web Push (VAPID + chiffrement aes128gcm), SANS dépendance.
 *
 * Implémente le protocole Web Push :
 *   • VAPID (RFC 8292) : JWT ES256 signé avec la clé privée du serveur, prouvant
 *     l'identité de l'expéditeur au service de push du navigateur.
 *   • Chiffrement de charge utile (RFC 8291, content-encoding « aes128gcm ») :
 *     ECDH P-256 + HKDF-SHA256 → CEK/nonce, AES-128-GCM.
 *
 * Le tout avec `node:crypto` uniquement. La livraison réelle nécessite un
 * abonnement (PushSubscription) obtenu côté navigateur et un accès réseau au
 * service de push (FCM/Mozilla/…). Sans clés VAPID configurées, le serveur en
 * génère une paire éphémère (démo) ; en production, fixez VAPID_PUBLIC_KEY /
 * VAPID_PRIVATE_KEY (persistantes) et VAPID_SUBJECT (mailto:…).
 */
"use strict";

const crypto = require("node:crypto");

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** Génère une paire de clés VAPID (P-256) au format base64url. */
function generateVapidKeys() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return { publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(ecdh.getPrivateKey()) };
}

/** Reconstruit un objet clé privée EC (PKCS8) à partir du scalaire brut + clé publique. */
function privateKeyObject(privateRaw, publicRaw) {
  const jwk = {
    kty: "EC", crv: "P-256",
    d: b64url(privateRaw),
    x: b64url(publicRaw.subarray(1, 33)),
    y: b64url(publicRaw.subarray(33, 65)),
  };
  return crypto.createPrivateKey({ key: jwk, format: "jwk" });
}

/** En-tête d'autorisation VAPID pour un endpoint donné. */
function vapidAuthorization(endpoint, vapid) {
  const url = new URL(endpoint);
  const aud = url.origin;
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud, exp: now + 12 * 3600, sub: vapid.subject || "mailto:admin@marche.ci" };
  const signingInput = b64url(JSON.stringify(header)) + "." + b64url(JSON.stringify(payload));
  const pubRaw = fromB64url(vapid.publicKey);
  const privKey = privateKeyObject(fromB64url(vapid.privateKey), pubRaw);
  // Signature ECDSA au format brut r||s (IEEE P1363), requis par JOSE.
  const sig = crypto.sign(null, Buffer.from(signingInput), { key: privKey, dsaEncoding: "ieee-p1363" });
  const jwt = signingInput + "." + b64url(sig);
  return { authorization: `vapid t=${jwt}, k=${vapid.publicKey}`, jwt };
}

function hmac(key, data) { return crypto.createHmac("sha256", key).update(data).digest(); }
/** HKDF (SHA-256) réduit à une seule expansion (longueur ≤ 32). */
function hkdf(salt, ikm, info, length) {
  const prk = hmac(salt, ikm);
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length);
}

/**
 * Chiffre une charge utile pour un abonnement (aes128gcm).
 * @returns {Buffer} corps binaire prêt à POSTer.
 */
function encrypt(payload, ua_public_b64, auth_b64) {
  const uaPublic = fromB64url(ua_public_b64);        // clé publique du navigateur (65 o)
  const authSecret = fromB64url(auth_b64);           // secret d'authentification (16 o)

  const server = crypto.createECDH("prime256v1");
  server.generateKeys();
  const serverPublic = server.getPublicKey();        // 65 o
  const sharedSecret = server.computeSecret(uaPublic);
  const salt = crypto.randomBytes(16);

  // PRK combinée : HKDF(auth_secret, ecdh) avec key_info spécifique Web Push.
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, serverPublic]);
  const ikm = hkdf(authSecret, sharedSecret, keyInfo, 32);

  const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0"), 12);

  // Corps = plaintext || 0x02 (délimiteur de padding, sans octet de bourrage).
  const record = Buffer.concat([Buffer.from(payload), Buffer.from([2])]);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);

  // En-tête aes128gcm : salt(16) | rs(4) | idlen(1)=65 | serverPublic(65) | ciphertext
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096, 0);
  const idlen = Buffer.from([serverPublic.length]);
  return Buffer.concat([salt, rs, idlen, serverPublic, ciphertext]);
}

/**
 * Envoie une notification à un abonnement. Meilleur effort : renvoie
 * { ok, status } en cas de réponse du service de push, ou { ok:false, error }
 * si le réseau/endpoint est indisponible (comportement « simulateur »).
 */
async function send(subscription, payloadObj, vapid, ttl) {
  if (!subscription || !subscription.endpoint || !subscription.keys) return { ok: false, error: "abonnement invalide" };
  const body = encrypt(JSON.stringify(payloadObj), subscription.keys.p256dh, subscription.keys.auth);
  const { authorization } = vapidAuthorization(subscription.endpoint, vapid);
  try {
    const r = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        "TTL": String(ttl || 2419200),
        "Authorization": authorization,
      },
      body,
    });
    // 404/410 → abonnement expiré (l'appelant devrait le purger).
    return { ok: r.ok, status: r.status, expired: r.status === 404 || r.status === 410 };
  } catch (e) {
    return { ok: false, error: e.message, unreachable: true };
  }
}

module.exports = { generateVapidKeys, vapidAuthorization, encrypt, send, b64url, fromB64url };
