/* audio.js — Web Audio API + voix off.
   - SFX & cris : fichiers .mp3 s'ils existent, sinon sons synthétisés (offline, 0 asset).
   - Voix (consignes) : SpeechSynthesis française (offline sur la plupart des appareils),
     avec repli sur un .mp3 si présent. Coupe toujours la voix précédente.
   API : Audio.load(manifest), play(id,{volume}), speak(text|id), stopAll(), setMuted(bool). */

let ctx = null;
const buffers = new Map();     // id -> AudioBuffer (fichiers chargés)
let muted = false;
let volVoix = 1, volSfx = 0.7;
let frVoice = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

/* Débloque le contexte au premier tap (contrainte iOS/Android). */
export function unlock() {
  const c = ac();
  if (c.state === "suspended") c.resume();
  // Sélectionne une voix française pour la synthèse.
  pickVoice();
}

function pickVoice() {
  if (!("speechSynthesis" in window)) return;
  const vs = speechSynthesis.getVoices();
  frVoice = vs.find(v => /fr[-_]?(FR|CI|SN)?/i.test(v.lang)) || vs.find(v => /^fr/i.test(v.lang)) || null;
}
if ("speechSynthesis" in window) speechSynthesis.onvoiceschanged = pickVoice;

/* Charge un lot de sons (fichiers réels). Les manquants sont ignorés (repli synthèse). */
export async function load(manifest = []) {
  const c = ac();
  await Promise.all(manifest.map(async ({ id, url }) => {
    if (!url || buffers.has(id)) return;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      buffers.set(id, await c.decodeAudioData(buf));
    } catch (_) { /* absent — on synthétisera */ }
  }));
}

function gain(v) {
  const c = ac(); const g = c.createGain();
  g.gain.value = muted ? 0 : v; g.connect(c.destination); return g;
}

/* Petit synthé pour SFX et cris quand aucun fichier n'est fourni. */
function synth(id, v) {
  const c = ac(), t = c.currentTime, g = gain(v);
  const tone = (freq, start, dur, type = "sine", slideTo) => {
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t + start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + start + dur);
    const eg = c.createGain(); eg.gain.setValueAtTime(0.0001, t + start);
    eg.gain.exponentialRampToValueAtTime(1, t + start + 0.02);
    eg.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
    o.connect(eg).connect(g); o.start(t + start); o.stop(t + start + dur + 0.02);
  };
  switch (id) {
    case "success": [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.18, "triangle")); break;
    case "star":    tone(880, 0, 0.12, "triangle"); tone(1319, 0.08, 0.16, "triangle"); break;
    case "tap":     tone(440, 0, 0.05, "square"); break;
    case "neutral": tone(300, 0, 0.16, "sine", 220); break;   // erreur douce, jamais un buzzer
    case "transition": tone(392, 0, 0.1, "sine", 587); break;
    case "win":     [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.12, 0.3, "triangle")); break;
    /* Cris d'animaux approximés (jusqu'à fourniture de vrais .mp3) */
    case "cri-lion": case "cri-panthere": case "cri-buffle":
      tone(160, 0, 0.5, "sawtooth", 90); break;
    case "cri-elephant": case "cri-hippopotame":
      tone(120, 0, 0.7, "sawtooth", 180); break;
    case "cri-coq": tone(700, 0, 0.15, "square", 500); tone(900, 0.18, 0.25, "square", 400); break;
    case "cri-serpent": tone(2000, 0, 0.5, "sawtooth", 1800); break;
    default:
      if (id.startsWith("cri-")) { tone(400, 0, 0.25, "sawtooth", 300); tone(500, 0.2, 0.2, "sawtooth"); }
      else tone(660, 0, 0.1, "sine");
  }
}

export function play(id, { volume } = {}) {
  if (muted) return;
  const v = (volume != null ? volume : 1) * volSfx;
  const buf = buffers.get(id);
  if (buf) {
    const c = ac(), src = c.createBufferSource();
    src.buffer = buf; src.connect(gain(v)); src.start();
  } else {
    try { synth(id, v); } catch (_) {}
  }
}

/* Consigne vocale. text = phrase à dire OU id d'un buffer voix chargé. */
export function speak(text) {
  if (muted) return;
  // Si un fichier voix a été chargé sous cet id, on le joue.
  if (buffers.has(text)) { play(text, { volume: volVoix / volSfx }); return; }
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();               // coupe la voix précédente
  const u = new SpeechSynthesisUtterance(String(text));
  u.lang = "fr-FR"; u.rate = 0.92; u.pitch = 1.08; u.volume = volVoix;
  if (frVoice) u.voice = frVoice;
  speechSynthesis.speak(u);
}

export function stopAll() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

export function setMuted(b) {
  muted = !!b;
  if (muted) stopAll();
}
export function setVolumes({ voix, sfx }) {
  if (voix != null) volVoix = voix;
  if (sfx != null) volSfx = sfx;
}
export function isMuted() { return muted; }

export default { load, play, speak, stopAll, setMuted, setVolumes, unlock, isMuted };
