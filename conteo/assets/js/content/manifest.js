/* Conteo — Chargement d'un manifest de conte (par niveau) et de ses timings. */

const _manifestCache = new Map();
const _timingsCache = new Map();

export async function loadManifest(taleEntry, level) {
  const levelInfo = taleEntry.levels?.[level];
  if (!levelInfo) throw new Error(`Niveau ${level} indisponible pour ${taleEntry.slug}`);
  const url = levelInfo.manifest;
  if (_manifestCache.has(url)) return _manifestCache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Manifest introuvable : ' + url);
  const manifest = await res.json();
  _manifestCache.set(url, manifest);
  return manifest;
}

export async function loadTimings(manifest, lang) {
  const audio = manifest.audio?.[lang] || manifest.audio?.fr;
  if (!audio?.timings) return null;
  const url = audio.timings;
  if (_timingsCache.has(url)) return _timingsCache.get(url);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const timings = await res.json();
    _timingsCache.set(url, timings);
    return timings;
  } catch {
    return null;   // pas de timings → karaoké désactivé, lecture normale
  }
}

/* Résout la source audio pour une langue avec fallback iOS (.m4a). */
export function resolveAudio(manifest, lang) {
  const a = manifest.audio?.[lang] || manifest.audio?.fr;
  if (!a) return null;
  const canOpus = document.createElement('audio')
    .canPlayType('audio/ogg; codecs=opus') !== '';
  return { primary: a.src, fallback: a.fallback, preferFallback: !canOpus };
}
