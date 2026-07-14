/* Conteo — Vérification des codes d'activation (HMAC-SHA256 tronqué).
 *
 * Format : CONT-<PACK>-<SERIAL>-<SIG>   ex. CONT-SAGE-4F2A-9B71
 *   PACK   : code court (4 lettres) mappé vers un pack_id
 *   SERIAL : 4 hexa (numéro de série du lot)
 *   SIG    : 4 hexa = 2 premiers octets de HMAC-SHA256(clé, "packId:serial")
 *
 * ⚠️ Compromis assumé (§8) : sans backend, un code peut être réutilisé sur
 * plusieurs appareils. HMAC est symétrique : la clé embarquée sert à la fois
 * à générer (outil hors-ligne) et à vérifier. La rotation de clé par version
 * limite la portée d'une fuite. Ce n'est pas incassable — c'est un compromis.
 */

// Clé de vérification embarquée dans le build (à faire tourner à chaque version).
const VERIFY_KEY = 'conteo-2026-07-key-rotate-me';

// Codes courts → pack_id
export const PACK_CODES = {
  SAGE: 'pack-sagesse',
  ANIM: 'pack-animaux',
  HERO: 'pack-heros'
};

const enc = new TextEncoder();

async function hmacHex(message) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(VERIFY_KEY),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/* Signature attendue (4 hexa) pour un pack_id + serial donnés. */
export async function expectedSig(packId, serial) {
  const full = await hmacHex(`${packId}:${serial.toUpperCase()}`);
  return full.slice(0, 4);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* Vérifie un code saisi. → { valid, pack_id, serial } */
export async function verifyCode(raw) {
  const code = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  const m = /^CONT-([A-Z]{4})-([0-9A-F]{4})-([0-9A-F]{4})$/.exec(code);
  if (!m) return { valid: false, reason: 'format' };
  const [, packShort, serial, sig] = m;
  const packId = PACK_CODES[packShort];
  if (!packId) return { valid: false, reason: 'pack' };
  const expect = await expectedSig(packId, serial);
  if (!timingSafeEqual(sig, expect)) return { valid: false, reason: 'signature' };
  return { valid: true, pack_id: packId, serial };
}
