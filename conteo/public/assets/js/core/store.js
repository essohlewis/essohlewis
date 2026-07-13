/**
 * CONTEO — État global réactif via Proxy.
 * Les vues s'abonnent aux changements et se re-rendent au besoin.
 */

const listeners = new Set();

const state = new Proxy({
  token: null,
  user: null,
  profiles: [],
  activeProfile: null,   // profil enfant sélectionné
  online: navigator.onLine,
  narrationLang: 'fr',
}, {
  set(target, key, value) {
    target[key] = value;
    listeners.forEach((fn) => fn(key, value));
    return true;
  },
});

export { state };

/** S'abonne aux changements d'état. Renvoie une fonction de désabonnement. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isAuthenticated() {
  return Boolean(state.token);
}
