/* Conteo — Verrou d'accès à l'espace parent : opération arithmétique simple.
 * Pas de PIN (oubli fréquent), pas de biométrie (indisponible en PWA). */

import { el, mount } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { t } from '../../core/i18n.js';

let passedUntil = 0;   // fenêtre de validité pour éviter de redemander sans cesse

export function gatePassed() { return Date.now() < passedUntil; }

export function gateView(nextPath = '/parent/dashboard') {
  if (gatePassed()) return navigate(nextPath, { replace: true });

  const a = 2 + Math.floor(Math.random() * 8);   // 2..9
  const b = 2 + Math.floor(Math.random() * 8);
  const answer = a * b;
  let entry = '';

  const display = el('div', { class: 'gate__display', 'aria-live': 'polite', text: '?' });

  const submit = () => {
    if (Number(entry) === answer) {
      passedUntil = Date.now() + 5 * 60 * 1000;   // 5 minutes
      navigate(nextPath, { replace: true });
    } else {
      display.textContent = t('wrong_answer');
      display.style.color = 'var(--c-danger)';
      entry = '';
      setTimeout(() => { display.textContent = '?'; display.style.color = ''; }, 900);
    }
  };

  const pad = el('div', { class: 'gate__pad' });
  ['1','2','3','4','5','6','7','8','9','C','0','OK'].forEach((k) => {
    pad.append(el('button', { text: k, onpointerup: () => {
      if (k === 'C') { entry = ''; display.textContent = '?'; }
      else if (k === 'OK') submit();
      else { entry = (entry + k).slice(0, 3); display.textContent = entry; display.style.color = ''; }
    } }));
  });

  const root = el('section', { class: 'parent gate' }, [
    el('div', { class: 'card gate__card' }, [
      el('button', { class: 'icon-btn', 'aria-label': t('back'), text: '←',
        onpointerup: () => navigate('/pick') }),
      el('h2', { text: t('parent_space'), style: { marginTop: '8px' } }),
      el('p', { class: 'text-muted', text: t('gate_prompt') }),
      el('div', { class: 'gate__q', text: `${a} × ${b} = ?` }),
      display,
      pad
    ])
  ]);
  return mount(root);
}
