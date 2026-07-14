/* Conteo — Mode Conte du soir : minuteur, assombrissement progressif,
 * musique douce en boucle, arrêt automatique. */

import { el, mount } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { store } from '../../core/store.js';
import { getContext } from '../../audio/unlock.js';
import { kidNav } from './nav.js';
import { uiTone } from '../../audio/sfx.js';

export function bedtimeView() {
  let count = 2;              // nombre de contes (1, 2, 3)
  let running = false;
  let remaining = 0;
  let rafId = 0, lastTs = 0;
  let musicNode = null;

  const stage = el('div', { class: 'bedtime' });
  const timerEl = el('div', { class: 'bedtime__timer', 'aria-live': 'polite', text: '' });
  const startBtn = el('button', { class: 'btn btn--indigo', text: '🌙 Commencer' });

  const opts = el('div', { class: 'bedtime__opts' }, [1, 2, 3].map((n) =>
    el('button', { class: 'btn-kid', 'aria-pressed': String(n === count),
      text: '⭐'.repeat(n),
      onpointerup: (e) => {
        count = n;
        [...opts.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i + 1 === n)));
        uiTone('tap');
      } })
  ));

  function estimate() { return count * 6 * 60; }   // ~6 min par conte

  function start() {
    running = true;
    remaining = estimate();
    startBtn.remove();
    opts.remove();
    startMusic();
    lastTs = 0;
    rafId = requestAnimationFrame(tick);
  }

  function tick(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    remaining -= (ts - lastTs) / 1000;
    lastTs = ts;
    if (remaining <= 0) return stop();
    const m = Math.floor(remaining / 60), s = Math.floor(remaining % 60);
    timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
    // Assombrissement progressif via filter: brightness().
    const ratio = remaining / estimate();
    stage.style.filter = `brightness(${(0.4 + ratio * 0.6).toFixed(2)})`;
    rafId = requestAnimationFrame(tick);
  }

  function startMusic() {
    const ctx = getContext();
    if (!ctx) return;
    ctx.resume?.();
    // Berceuse synthétique très douce (deux oscillateurs en boucle).
    const gain = ctx.createGain();
    gain.gain.value = (store.volume ?? 0.8) * 0.08;
    gain.connect(ctx.destination);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 220;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 277;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.15;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = (store.volume ?? 0.8) * 0.04;
    lfo.connect(lfoGain); lfoGain.connect(gain.gain);
    o1.connect(gain); o2.connect(gain);
    o1.start(); o2.start(); lfo.start();
    musicNode = { o1, o2, lfo, gain };
  }

  function stopMusic() {
    if (!musicNode) return;
    try { musicNode.o1.stop(); musicNode.o2.stop(); musicNode.lfo.stop(); } catch {}
    musicNode = null;
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    stopMusic();
    stage.style.filter = 'brightness(0.35)';
    timerEl.textContent = '';
    stage.append(el('p', { text: '😴 Bonne nuit !', style: { fontSize: 'var(--fs-kid-lg)' } }));
  }

  startBtn.addEventListener('pointerup', () => { uiTone('tap'); start(); });

  stage.append(
    el('div', { class: 'bedtime__moon', 'aria-hidden': 'true', text: '🌙' }),
    el('h1', { text: 'Conte du soir', style: { fontFamily: 'var(--font-kid)' } }),
    el('p', { text: 'Combien d’histoires ce soir ?' }),
    opts, timerEl, startBtn
  );

  const root = el('section', { class: 'kid', style: { flex: '1', display: 'flex', flexDirection: 'column' } }, [
    stage, kidNav('bedtime')
  ]);
  mount(root);

  return () => { running = false; cancelAnimationFrame(rafId); stopMusic(); };
}
