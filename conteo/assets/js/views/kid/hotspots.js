/* Conteo — Tap-to-explore. Overlay de hotspots au-dessus de l'illustration.
 * Implémentation par <button> en position absolue (%), préférée pour
 * l'accessibilité (§10.4). Coordonnées normalisées 0→1, indépendantes de la
 * résolution. Un tap → animation CSS + effet sonore + mot prononcé. */

import { el } from '../../core/dom.js';
import { play as playSfx } from '../../audio/sfx.js';
import { speakOnce } from '../../audio/speech.js';
import { store } from '../../core/store.js';

export function buildHotspotOverlay(page, { lang, onDiscover } = {}) {
  const overlay = el('div', { class: 'reader__overlay' });
  const hotspots = page.hotspots || [];

  for (const hs of hotspots) {
    const btn = el('button', {
      class: 'hotspot-btn',
      'aria-label': hs.label || 'objet',
      style: placeStyle(hs)
    });
    btn.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      triggerHotspot(btn, hs, lang);
      onDiscover?.(hs.id);
    });
    overlay.append(btn);
  }
  return overlay;
}

function placeStyle(hs) {
  if (hs.shape === 'rect') {
    return {
      left: pct(hs.x), top: pct(hs.y),
      width: pct(hs.w), height: pct(hs.h),
      borderRadius: '12px'
    };
  }
  // cercle : centré sur (cx,cy), diamètre = 2r
  const d = (hs.r || 0.1) * 2;
  return {
    left: pct(hs.cx - hs.r), top: pct(hs.cy - hs.r),
    width: pct(d), height: pct(d)
  };
}
const pct = (v) => (v * 100).toFixed(3) + '%';

async function triggerHotspot(btn, hs, lang) {
  // Animation
  const anim = { shake: 'anim-shake', fly: 'anim-fly', pop: 'anim-pop' }[hs.animation] || 'anim-pop';
  btn.classList.remove(anim);
  void btn.offsetWidth;          // reflow pour rejouer l'animation
  btn.classList.add(anim);
  btn.addEventListener('animationend', () => btn.classList.remove(anim), { once: true });

  // Effet sonore (Web Audio) puis mot prononcé.
  if (hs.sfx) playSfx(hs.sfx);
  const voiceUrl = hs.voice?.[lang] || hs.voice?.fr;
  setTimeout(() => speakWord(voiceUrl, hs.label), 220);   // léger décalage après le SFX
}

/* Prononce le mot : audio enregistré si disponible, sinon synthèse vocale
   du libellé (le libellé est en français, comme le texte des contes). */
function speakWord(url, label) {
  const vol = store.volume ?? 0.8;
  if (url) {
    const a = new Audio(url);
    a.volume = vol;
    a.play().catch(() => { if (label) speakOnce(label, { volume: vol }); });
    a.addEventListener('error', () => { if (label) speakOnce(label, { volume: vol }); }, { once: true });
  } else if (label) {
    speakOnce(label, { volume: vol });
  }
}
