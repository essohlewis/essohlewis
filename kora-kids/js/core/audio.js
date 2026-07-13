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

/* Note pitchée, plusieurs timbres d'instruments ouest-africains.
   timbre : "balafon" (bois), "kalimba" (métal pincé), "flute" (souffle),
   "kora" (corde pincée). Toujours harmonieux (pas de sons agressifs). */
export function note(freq, { timbre = "balafon", volume = 1 } = {}) {
  if (muted) return;
  const c = ac(), t = c.currentTime, g = gain(volume * volSfx);
  // Voix élémentaire : oscillateur + enveloppe exponentielle.
  const voice = (f, ty, peak, dur, attack = 0.008, filter) => {
    const o = c.createOscillator(); o.type = ty; o.frequency.value = f;
    const eg = c.createGain();
    eg.gain.setValueAtTime(0.0001, t);
    eg.gain.exponentialRampToValueAtTime(peak, t + attack);
    eg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) { const bf = c.createBiquadFilter(); bf.type = "lowpass"; bf.frequency.value = filter; o.connect(bf); node = bf; }
    node.connect(eg).connect(g); o.start(t); o.stop(t + dur + 0.03);
    return o;
  };
  switch (timbre) {
    case "kalimba":                    // métal pincé, brillant, court
      voice(freq, "sine", 1, 0.55);
      voice(freq * 3, "sine", 0.22, 0.4);
      break;
    case "flute":                      // souffle doux, attaque lente + vibrato
      { const o = voice(freq, "sine", 0.9, 1.0, 0.06);
        const lfo = c.createOscillator(); lfo.frequency.value = 5.5;
        const lg = c.createGain(); lg.gain.value = 3.5;
        lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + 1.03);
        voice(freq * 2, "sine", 0.15, 0.9, 0.06); }
      break;
    case "kora":                       // corde pincée (harpe-luth), filtrée
      voice(freq, "sawtooth", 0.8, 0.85, 0.006, freq * 6);
      voice(freq * 2, "triangle", 0.25, 0.7);
      break;
    default:                           // balafon : bois, fondamentale + octave
      voice(freq, "triangle", 1, 0.7);
      voice(freq * 2, "sine", 0.32, 0.55);
  }
}

/* Percussion type djembé : "basse" (grave, chute de hauteur) ou "aigu" (claque). */
export function drum(kind = "basse") {
  if (muted) return;
  const c = ac(), t = c.currentTime, g = gain(0.9 * volSfx);
  if (kind === "basse") {
    const o = c.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.18);
    const eg = c.createGain(); eg.gain.setValueAtTime(1, t); eg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(eg).connect(g); o.start(t); o.stop(t + 0.32);
  } else {
    // claque : bruit filtré court
    const n = 0.12, buf = c.createBuffer(1, c.sampleRate * n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(); src.buffer = buf;
    const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
    src.connect(hp).connect(g); src.start(t);
  }
}

/* Consigne vocale. Coupe toujours la voix précédente.
   - speak(text)            → prononce la phrase via SpeechSynthesis.
   - speak(text, { id })    → si un vrai fichier voix "voix-<id>" est chargé,
                              le joue ; sinon repli sur la synthèse de `text`.
   - speak(id)              → rétro-compat : joue un buffer voix chargé sous cet id. */
export function speak(text, { id } = {}) {
  if (muted) return;
  stopAll();
  // Fichier voix réel prioritaire (via un id explicite ou un id direct).
  const bufId = id != null ? "voix-" + id : text;
  if (buffers.has(bufId)) { play(bufId, { volume: volSfx ? volVoix / volSfx : 1 }); return; }
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(String(text));
  u.lang = "fr-FR"; u.rate = 0.92; u.pitch = 1.08; u.volume = volVoix;
  if (frVoice) u.voice = frVoice;
  speechSynthesis.speak(u);
}

export function stopAll() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

/* Vide les voix en mémoire (au changement de langue) pour éviter des buffers
   périmés d'une langue précédente ; les jeux rechargeront la bonne langue. */
export function clearVoix() {
  for (const key of [...buffers.keys()]) if (key.startsWith("voix-")) buffers.delete(key);
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

export default { load, play, speak, note, drum, stopAll, clearVoix, setMuted, setVolumes, unlock, isMuted };
