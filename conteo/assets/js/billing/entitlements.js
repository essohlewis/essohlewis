/* Conteo — Résolution des droits d'accès aux packs.
 * Un pack est débloqué s'il est gratuit, ou si un entitlement existe
 * (source: iap | code | free). Stockage local, revalidation IAP au lancement. */

import { getAll, put, get } from '../core/db.js';
import { store } from '../core/store.js';
import { verifyCode } from './codes.js';
import { iapAvailable, purchase, restore } from './iap.js';
import { getPack } from '../content/catalog.js';

export async function loadEntitlements() {
  const rows = await getAll('entitlements');
  const map = {};
  for (const r of rows) map[r.pack_id] = r;
  store.entitlements = map;
  return map;
}

export function isPackUnlocked(catalog, packId) {
  const pack = getPack(catalog, packId);
  if (pack?.is_free) return true;
  return !!store.entitlements[packId];
}

export function isTaleUnlocked(catalog, tale) {
  return isPackUnlocked(catalog, tale.pack_id);
}

async function grant(packId, source, extra = {}) {
  const row = { pack_id: packId, source, granted_at: Date.now(), ...extra };
  await put('entitlements', row);
  store.entitlements = { ...store.entitlements, [packId]: row };
  return row;
}

/* Débloque via code d'activation (vérif HMAC côté client). */
export async function redeemCode(rawCode) {
  const res = await verifyCode(rawCode);
  if (!res.valid) return { ok: false, reason: res.reason };
  await grant(res.pack_id, 'code', { serial: res.serial });
  return { ok: true, pack_id: res.pack_id };
}

/* Achat in-app (mobile). productId conventionnel : "ci.conteo.<packId>". */
export async function buyPack(packId) {
  if (!iapAvailable()) return { ok: false, reason: 'iap_unavailable' };
  const productId = `ci.conteo.${packId}`;
  const receiptData = await purchase(productId);
  await grant(packId, 'iap', { receipt: receiptData.receipt, transaction_id: receiptData.transactionId });
  return { ok: true, pack_id: packId };
}

/* Revalidation au lancement : restaure les achats natifs. */
export async function revalidate() {
  if (!iapAvailable()) return;
  try {
    const txs = await restore();
    for (const tx of txs) {
      const packId = (tx.productIdentifier || '').replace('ci.conteo.', '');
      if (packId) await grant(packId, 'iap', { receipt: tx.transactionReceipt || '', transaction_id: tx.transactionId || '' });
    }
  } catch { /* silencieux : offline ou store indisponible */ }
}
