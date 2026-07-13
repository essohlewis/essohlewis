/* storage.js — Wrapper localStorage (profils, progression, réglages).
   Aucun compte, aucun réseau. Schéma versionné pour migrations futures. */

const KEY = "kora-kids";
const VERSION = 1;

const DEFAULT = {
  version: VERSION,
  profiles: [],
  settings: { volumeVoix: 1, volumeSfx: 0.7, sombre: false, minuteur: 30, lang: "fr" },
  activeProfile: null
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    const data = JSON.parse(raw);
    return migrate(data);
  } catch (_) { return structuredClone(DEFAULT); }
}

function migrate(data) {
  if (!data.version) data.version = 1;
  // Futures migrations : if (data.version < 2) { … data.version = 2; }
  return { ...structuredClone(DEFAULT), ...data, settings: { ...DEFAULT.settings, ...(data.settings || {}) } };
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
}

/* ---------- Profils ---------- */
export function getProfiles() { return state.profiles; }

export function addProfile({ nom, avatar, palier }) {
  const id = "p" + Date.now().toString(36);
  const p = { id, nom, avatar, palier, etoiles: {}, accessoires: [], sessions: [] };
  state.profiles.push(p); persist(); return p;
}
export function updateProfile(id, patch) {
  const p = state.profiles.find(x => x.id === id);
  if (p) { Object.assign(p, patch); persist(); }
  return p;
}
export function removeProfile(id) {
  state.profiles = state.profiles.filter(p => p.id !== id);
  if (state.activeProfile === id) state.activeProfile = null;
  persist();
}
export function setActive(id) { state.activeProfile = id; persist(); }
export function getActive() { return state.profiles.find(p => p.id === state.activeProfile) || null; }

/* ---------- Étoiles & progression ---------- */
export function addStars(gameId, n) {
  const p = getActive(); if (!p) return 0;
  p.etoiles[gameId] = (p.etoiles[gameId] || 0) + n;
  checkUnlocks(p);
  persist();
  return totalStars(p);
}
export function totalStars(p = getActive()) {
  if (!p) return 0;
  return Object.values(p.etoiles).reduce((a, b) => a + b, 0);
}
export function starsFor(gameId, p = getActive()) {
  return (p && p.etoiles[gameId]) || 0;
}

const UNLOCK_TIERS = [20, 50, 100, 200, 350, 500];
const ACCESSORIES = ["chapeau", "pagne", "sac", "lunettes", "ballon", "collier"];
function checkUnlocks(p) {
  const total = totalStars(p);
  UNLOCK_TIERS.forEach((tier, i) => {
    if (total >= tier && !p.accessoires.includes(ACCESSORIES[i])) p.accessoires.push(ACCESSORIES[i]);
  });
}
export function nextUnlock(p = getActive()) {
  const total = totalStars(p);
  const tier = UNLOCK_TIERS.find(t => total < t);
  return tier ? { need: tier, have: total } : null;
}

/* ---------- Sessions (temps de jeu / jour) ---------- */
export function logSession(minutes) {
  const p = getActive(); if (!p) return;
  const date = new Date().toISOString().slice(0, 10);
  let s = p.sessions.find(x => x.date === date);
  if (s) s.minutes += minutes; else p.sessions.push({ date, minutes });
  persist();
}
export function todayMinutes(p = getActive()) {
  if (!p) return 0;
  const date = new Date().toISOString().slice(0, 10);
  const s = p.sessions.find(x => x.date === date);
  return s ? s.minutes : 0;
}

/* ---------- Réglages ---------- */
export function getSettings() { return state.settings; }
export function setSettings(patch) { Object.assign(state.settings, patch); persist(); }

/* ---------- Réinitialisation ---------- */
export function resetProgress() {
  state.profiles.forEach(p => { p.etoiles = {}; p.accessoires = []; p.sessions = []; });
  persist();
}
export function resetAll() { state = structuredClone(DEFAULT); persist(); }

export default {
  getProfiles, addProfile, updateProfile, removeProfile, setActive, getActive,
  addStars, totalStars, starsFor, nextUnlock, logSession, todayMinutes,
  getSettings, setSettings, resetProgress, resetAll
};
