/* Conteo — Compteur de temps d'écran + verrouillage quotidien.
 * Ne tourne PAS en arrière-plan (visibilitychange / appStateChange).
 * Accumule les secondes par (profil, jour) dans IndexedDB. */

import { get, put } from '../core/db.js';
import { store } from '../core/store.js';
import { isoDate } from './format.js';

let ticking = false;
let lastTick = 0;
let rafId = 0;
let onLimit = null;      // callback quand la limite est atteinte
let flushTimer = 0;
let pending = 0;         // secondes en attente d'écriture

export function onLimitReached(fn) { onLimit = fn; }

export async function todaySeconds(profileId) {
  const row = await get('screen_time', [profileId, isoDate()]);
  return row?.seconds || 0;
}

async function addSeconds(profileId, delta) {
  const key = [profileId, isoDate()];
  const row = (await get('screen_time', key)) || { profile_id: profileId, date: isoDate(), seconds: 0 };
  row.seconds += delta;
  await put('screen_time', row);
  return row.seconds;
}

function loop(ts) {
  if (!ticking) return;
  if (!lastTick) lastTick = ts;
  const dt = (ts - lastTick) / 1000;
  if (dt >= 1) {
    const whole = Math.floor(dt);
    pending += whole;
    lastTick += whole * 1000;
    checkLimit();
  }
  rafId = requestAnimationFrame(loop);
}

async function checkLimit() {
  const p = store.activeProfile;
  if (!p) return;
  const limit = (p.daily_limit_minutes || 0) * 60;
  if (!limit) return;
  const used = (await todaySeconds(p.id)) + pending;
  if (used >= limit) { onLimit?.(); pauseScreenTimer(); }
}

export function startScreenTimer() {
  if (ticking) return;
  ticking = true;
  lastTick = 0;
  rafId = requestAnimationFrame(loop);
  flushTimer = setInterval(flush, 10000);   // écriture batelée toutes les 10 s
}

export function pauseScreenTimer() {
  ticking = false;
  cancelAnimationFrame(rafId);
  clearInterval(flushTimer);
  lastTick = 0;
  flush();
}

export function resumeScreenTimer() { if (store.activeProfile) startScreenTimer(); }

async function flush() {
  if (!pending || !store.activeProfile) return;
  const n = pending; pending = 0;
  await addSeconds(store.activeProfile.id, n);
}

/* Installe le suivi du cycle de vie (à appeler une fois). */
export function installLifecycleHooks() {
  document.addEventListener('visibilitychange', () => {
    document.hidden ? pauseScreenTimer() : resumeScreenTimer();
  });
  window.addEventListener('pagehide', pauseScreenTimer);
  // Capacitor (mobile) : @capacitor/app 'appStateChange'
  const App = window.Capacitor?.Plugins?.App;
  App?.addListener?.('appStateChange', ({ isActive }) => {
    isActive ? resumeScreenTimer() : pauseScreenTimer();
  });
}
