/* assets.js — Couche médias : chemins de fichiers + manifeste de disponibilité.
   Sépare les URLs des jeux pour permettre :
   - le remplacement de la synthèse/SVG par de vrais fichiers, sans toucher aux jeux ;
   - l'ajout de langues locales (voix/dioula/, voix/baoule/) via un simple réglage.

   Principe « les deux » : on ne tente de charger que les fichiers DÉCLARÉS dans
   assets/manifest.json (donc aucune requête 404 tant qu'aucun vrai média n'est
   fourni). Ce qui n'est pas déclaré est rendu par la synthèse Web Audio /
   SpeechSynthesis / SVG procédural. Pour brancher de vrais médias : déposez les
   fichiers puis listez leurs ids dans assets/manifest.json. */

import Store from "./storage.js";

const AUDIO = "assets/audio";
const IMG = "assets/img";

export function lang() { return Store.getSettings().lang || "fr"; }

/* Langues de la voix off. Le français dispose d'une synthèse (SpeechSynthesis) ;
   les langues locales ne « parlent » que via des fichiers .mp3 enregistrés.
   drapeau : emoji indicatif ; tts : synthèse vocale disponible sans fichiers. */
export const LANGUES = [
  { id: "fr",     nom: "Français", drapeau: "🇫🇷", tts: true },
  { id: "dioula", nom: "Dioula",   drapeau: "🗣️", tts: false },
  { id: "baoule", nom: "Baoulé",   drapeau: "🗣️", tts: false },
  { id: "bete",   nom: "Bété",     drapeau: "🗣️", tts: false }
];

/* Renvoie { langId: disponible? } — disponible = TTS (fr) OU au moins un fichier
   voix déclaré dans le manifeste pour cette langue. */
export async function voixAvailability() {
  const m = await manifest();
  const out = {};
  LANGUES.forEach(l => { out[l.id] = l.tts || ((m.voix[l.id] || []).length > 0); });
  return out;
}

export const voixURL = (id) => `${AUDIO}/voix/${lang()}/${id}.mp3`;
export const criURL  = (id) => `${AUDIO}/cris/${id}.mp3`;
export const sfxURL  = (id) => `${AUDIO}/sfx/${id}.mp3`;
export const imgURL  = (cat, id, ext = "svg") => `${IMG}/${cat}/${id}.${ext}`;

/* Effets globaux susceptibles d'être fournis en fichiers. */
export const SFX = ["success", "star", "tap", "neutral", "transition", "win"];

/* Manifeste de disponibilité (chargé une seule fois, mis en cache mémoire). */
let _manifest = null;
async function manifest() {
  if (_manifest) return _manifest;
  try {
    const res = await fetch("assets/manifest.json");
    _manifest = res.ok ? await res.json() : {};
  } catch (_) { _manifest = {}; }
  _manifest.voix = _manifest.voix || {};      // { "fr": ["agouti", "lettre-A", …] }
  _manifest.cris = _manifest.cris || [];       // ["lion", …]
  _manifest.sfx  = _manifest.sfx  || [];       // ["success", …]
  _manifest.img  = _manifest.img  || {};       // { "animaux": ["lion", …] }
  return _manifest;
}

/* Manifestes de préchargement filtrés sur ce qui est réellement disponible. */
export async function voixManifest(ids) {
  const m = await manifest(); const have = m.voix[lang()] || [];
  return ids.filter(id => have.includes(id)).map(id => ({ id: "voix-" + id, url: voixURL(id) }));
}
export async function criManifest(ids) {
  const m = await manifest();
  return ids.filter(id => m.cris.includes(id)).map(id => ({ id: "cri-" + id, url: criURL(id) }));
}
export async function sfxManifest(ids) {
  const m = await manifest();
  return ids.filter(id => m.sfx.includes(id)).map(id => ({ id, url: sfxURL(id) }));
}

/* Illustration : <img> si un vrai fichier est déclaré (donnée `img` ou manifeste),
   sinon null → le jeu utilise la fabrique SVG procédurale. */
export function imageFor(entry, cat) {
  if (entry && entry.img) {
    const el = document.createElement("img");
    el.src = entry.img.includes("/") ? entry.img : imgURL(cat, entry.img, entry.img.split(".").pop());
    el.alt = entry.nom || ""; el.loading = "eager";
    return el;
  }
  return null;
}
