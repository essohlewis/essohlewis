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
  const merged = { ...structuredClone(DEFAULT), ...data, settings: { ...DEFAULT.settings, ...(data.settings || {}) } };
  // Compat : garde-robe. Les profils antérieurs portent d'emblée ce qu'ils ont débloqué.
  (merged.profiles || []).forEach(p => {
    if (!Array.isArray(p.accessoires)) p.accessoires = [];
    if (!Array.isArray(p.porte)) p.porte = p.accessoires.slice();
  });
  return merged;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
}

/* ---------- Profils ---------- */
export function getProfiles() { return state.profiles; }

export function addProfile({ nom, avatar, palier }) {
  const id = "p" + Date.now().toString(36);
  const p = { id, nom, avatar, palier, etoiles: {}, accessoires: [], porte: [], sessions: [] };
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
  const nouveaux = checkUnlocks(p);
  if (nouveaux.length) _justUnlocked = nouveaux;
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

/* Accessoires d'avatar et leurs paliers de déblocage (en étoiles totales). */
export const ACCESSOIRES = [
  { id: "chapeau",  nom: "le chapeau",   tier: 20 },
  { id: "pagne",    nom: "le pagne",     tier: 50 },
  { id: "sac",      nom: "le sac",       tier: 100 },
  { id: "lunettes", nom: "les lunettes", tier: 200 },
  { id: "ballon",   nom: "le ballon",    tier: 350 },
  { id: "collier",  nom: "le collier",   tier: 500 }
];

/* Débloque les accessoires atteints et les équipe automatiquement (effet « waouh »).
   Renvoie la liste des accessoires nouvellement débloqués ce coup-ci. */
function checkUnlocks(p) {
  const total = totalStars(p);
  const nouveaux = [];
  ACCESSOIRES.forEach(({ id, tier }) => {
    if (total >= tier && !p.accessoires.includes(id)) {
      p.accessoires.push(id);
      if (!p.porte) p.porte = [];
      p.porte.push(id);                 // porté d'emblée
      nouveaux.push(id);
    }
  });
  return nouveaux;
}
export function nextUnlock(p = getActive()) {
  const total = totalStars(p);
  const acc = ACCESSOIRES.find(a => total < a.tier);
  return acc ? { need: acc.tier, have: total, id: acc.id } : null;
}

/* ---------- Accessoires portés (garde-robe) ---------- */
export function isUnlocked(id, p = getActive()) { return !!(p && p.accessoires.includes(id)); }
export function getWorn(p = getActive()) { return (p && p.porte) || []; }
export function isWorn(id, p = getActive()) { return getWorn(p).includes(id); }
export function toggleWorn(id) {
  const p = getActive(); if (!p || !p.accessoires.includes(id)) return getWorn(p);
  if (!p.porte) p.porte = [];
  const i = p.porte.indexOf(id);
  if (i >= 0) p.porte.splice(i, 1); else p.porte.push(id);
  persist();
  return p.porte;
}
/* Accessoires nouvellement débloqués lors du dernier ajout d'étoiles. */
let _justUnlocked = [];
export function takeJustUnlocked() { const n = _justUnlocked; _justUnlocked = []; return n; }

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
  getSettings, setSettings, resetProgress, resetAll,
  ACCESSOIRES, isUnlocked, getWorn, isWorn, toggleWorn, takeJustUnlocked
};
