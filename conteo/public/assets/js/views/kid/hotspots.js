/**
 * CONTEO — Tap-to-explore : zones actives (hotspots) sur une illustration.
 *
 * Les coordonnées sont normalisées (0→1) et donc indépendantes de la
 * résolution. Au tap : animation CSS + son + mot prononcé.
 */

import { el } from '../../utils/dom.js';
import { playSfx, blip } from '../../audio/sfx.js';

/**
 * Construit la couche de hotspots pour une page.
 * @param {HTMLElement} stage    conteneur positionné (relative)
 * @param {object[]} hotspots    définitions issues du manifest
 * @param {string} lang          langue de narration active
 */
export function renderHotspots(stage, hotspots, lang) {
  // Retire les anciens hotspots.
  stage.querySelectorAll('.hotspot').forEach((h) => h.remove());

  (hotspots || []).forEach((hs) => {
    const zone = el('button', {
      class: 'hotspot',
      'aria-label': hs.label || 'objet',
    });
    positionHotspot(zone, hs);

    zone.addEventListener('click', () => activate(zone, stage, hs, lang));
    stage.append(zone);
  });
}

function positionHotspot(zone, hs) {
  // Position en pourcentage du conteneur (indépendante de la résolution).
  if (hs.shape === 'circle') {
    const d = hs.r * 2 * 100;
    Object.assign(zone.style, {
      left: `${(hs.cx - hs.r) * 100}%`,
      top: `${(hs.cy - hs.r) * 100}%`,
      width: `${d}%`,
      height: `${d}%`,
      // taille tactile minimale garantie
      minWidth: '72px', minHeight: '72px',
    });
  } else {
    Object.assign(zone.style, {
      left: `${hs.x * 100}%`,
      top: `${hs.y * 100}%`,
      width: `${hs.w * 100}%`,
      height: `${hs.h * 100}%`,
      borderRadius: '16px',
      minWidth: '72px', minHeight: '72px',
    });
  }
}

async function activate(zone, stage, hs, lang) {
  // Halo visuel
  zone.classList.remove('pulse');
  void zone.offsetWidth; // reflow pour rejouer l'animation
  zone.classList.add('pulse');

  // Animation de l'illustration (si une classe est prévue)
  const img = stage.querySelector('.page-img');
  if (img && hs.animation) {
    const cls = `anim-${hs.animation}`;
    img.classList.remove(cls);
    void img.offsetWidth;
    img.classList.add(cls);
    img.addEventListener('animationend', () => img.classList.remove(cls), { once: true });
  }

  // Son d'ambiance (SFX) puis mot prononcé dans la langue active.
  if (hs.sound) playSfx(hs.sound);
  else blip();

  const voiceUrl = hs.voice && (hs.voice[lang] || hs.voice.fr);
  if (voiceUrl) {
    setTimeout(() => {
      const v = new Audio(voiceUrl);
      v.play().catch(() => {});
    }, 350);
  }
}
