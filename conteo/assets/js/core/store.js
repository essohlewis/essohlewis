/* Conteo — Store réactif basé sur Proxy natif (~50 lignes).
 * Abonnement par clé ou global ; notifications sur mutation. */

const listeners = new Set();      // { keys: Set|null, fn }

const state = {
  ready: false,
  catalog: null,
  profiles: [],
  activeProfileId: null,
  activeProfile: null,
  entitlements: {},   // pack_id -> entitlement
  route: { path: '/', params: {} },
  theme: 'light',
  volume: 0.8,
  online: navigator.onLine
};

function notify(key) {
  for (const l of listeners) {
    if (!l.keys || l.keys.has(key)) l.fn(store, key);
  }
}

export const store = new Proxy(state, {
  set(target, key, value) {
    if (target[key] === value) return true;
    target[key] = value;
    notify(key);
    return true;
  }
});

/* subscribe(fn) → global ; subscribe(['a','b'], fn) → ciblé. Renvoie une fonction de désabonnement. */
export function subscribe(a, b) {
  const [keys, fn] = typeof a === 'function' ? [null, a] : [new Set(a), b];
  const entry = { keys, fn };
  listeners.add(entry);
  return () => listeners.delete(entry);
}

/* Fusion pratique de plusieurs clés en une passe */
export function setState(patch) {
  for (const [k, v] of Object.entries(patch)) store[k] = v;
}
