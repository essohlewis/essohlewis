/**
 * CONTEO — Effets sonores courts via Web Audio API.
 * Sons de hotspots, feedback d'interaction. Décodés et mis en cache.
 */

let ctx = null;
const buffers = new Map();

function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  // iOS suspend le contexte hors interaction : on le reprend au besoin.
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Précharge et décode un son. */
async function load(url) {
  if (buffers.has(url)) return buffers.get(url);
  const res = await fetch(url);
  const arr = await res.arrayBuffer();
  const buf = await audioCtx().decodeAudioData(arr);
  buffers.set(url, buf);
  return buf;
}

/** Joue un son court (ex. rugissement, oiseau). */
export async function playSfx(url) {
  try {
    const buf = await load(url);
    const src = audioCtx().createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx().destination);
    src.start(0);
  } catch {
    /* son indisponible : on ignore silencieusement */
  }
}

/** Petit « bip » de confirmation généré (aucun asset requis). */
export function blip(freq = 660, ms = 120) {
  try {
    const c = audioCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, c.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + ms / 1000);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + ms / 1000);
  } catch { /* ignore */ }
}

/** Débloque le contexte audio suite à une interaction (requis iOS). */
export function unlockAudio() {
  audioCtx();
}
