/* Conteo — Effets sonores via Web Audio API.
 * Buffers préchargés et décodés ; lecture faible latence.
 * Repli synthétique (bip) si l'asset est absent (utile en dev/offline). */

import { getContext } from './unlock.js';
import { store } from '../core/store.js';

const buffers = new Map();  // url -> AudioBuffer

export async function preload(urls = []) {
  const ctx = getContext();
  if (!ctx) return;
  await Promise.all(urls.filter(Boolean).map(loadBuffer));
}

async function loadBuffer(url) {
  if (buffers.has(url)) return buffers.get(url);
  const ctx = getContext();
  if (!ctx) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('404');
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    buffers.set(url, buf);
    return buf;
  } catch {
    buffers.set(url, null);   // marque comme indisponible pour éviter les re-fetch
    return null;
  }
}

export async function play(url, { volume } = {}) {
  const ctx = getContext();
  if (!ctx) return;
  ctx.resume?.();
  const buf = await loadBuffer(url);
  const gain = ctx.createGain();
  gain.gain.value = (volume ?? store.volume ?? 0.8);
  gain.connect(ctx.destination);
  if (buf) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    src.start(0);
  } else {
    blip(ctx, gain);   // repli : petite tonalité
  }
}

/* Repli synthétique — tonalité douce, jamais silencieux pour le retour tactile. */
function blip(ctx, gain) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 520;
  osc.connect(gain);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.start(now);
  osc.stop(now + 0.2);
}

/* Son d'interface générique (tap, succès, erreur) */
export function uiTone(kind = 'tap') {
  const ctx = getContext();
  if (!ctx) return;
  ctx.resume?.();
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.value = (store.volume ?? 0.8) * 0.5;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  const map = { tap: 440, ok: 660, err: 180, star: 880 };
  osc.frequency.value = map[kind] || 440;
  osc.connect(gain);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  osc.start(now);
  osc.stop(now + 0.24);
}
