/* Conteo — Déverrouillage audio iOS.
 * Safari exige une interaction utilisateur avant toute lecture.
 * On débloque l'AudioContext au premier geste. */

let ctx = null;
let unlocked = false;

export function getContext() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

export function unlockAudio() {
  if (unlocked) return;
  const c = getContext();
  if (!c) return;
  try {
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
    c.resume?.();
    unlocked = true;
  } catch { /* ignoré */ }
}

export function isUnlocked() { return unlocked; }

/* À appeler une fois au démarrage : installe un déblocage sur le premier geste. */
export function installUnlockOnce() {
  const handler = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('touchstart', handler);
    window.removeEventListener('keydown', handler);
  };
  window.addEventListener('pointerdown', handler, { once: false });
  window.addEventListener('touchstart', handler, { once: false });
  window.addEventListener('keydown', handler, { once: false });
}
