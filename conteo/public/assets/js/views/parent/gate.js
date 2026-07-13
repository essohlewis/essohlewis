/**
 * CONTEO — Verrou d'accès à l'espace parent.
 * Opération arithmétique simple (pas de PIN, pas de biométrie).
 * Une fois résolu, l'accès est ouvert pour une courte durée (session).
 */

import { el, mount } from '../../utils/dom.js';
import { navigate } from '../../core/router.js';
import { blip } from '../../audio/sfx.js';

const GATE_TTL_MS = 5 * 60 * 1000; // accès valable 5 min après résolution

export function gateIsOpen() {
  const until = Number(sessionStorage.getItem('conteo_gate_until') || 0);
  return Date.now() < until;
}

function openGate() {
  sessionStorage.setItem('conteo_gate_until', String(Date.now() + GATE_TTL_MS));
}

/** Affiche le verrou. onSuccess appelé après résolution. */
export function renderGate(onSuccess) {
  if (gateIsOpen()) { onSuccess(); return; }

  const a = 2 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 8);
  const answer = a * b;
  let entry = '';

  const answerEl = el('div', { class: 'answer', text: '' });
  const question = el('div', { class: 'q', text: `${a} × ${b} = ?` });

  const update = () => { answerEl.textContent = entry || '·'; };

  const press = (d) => {
    blip(520);
    if (entry.length < 3) entry += d;
    update();
    if (entry.length >= String(answer).length) {
      if (Number(entry) === answer) { openGate(); onSuccess(); }
      else { entry = ''; update(); shake(); }
    }
  };

  const keypad = el('div', { class: 'keypad' },
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) =>
      el('button', { class: 'key', text: k, onClick: () => {
        if (k === 'C') { entry = ''; update(); blip(300); }
        else if (k === '⌫') { entry = entry.slice(0, -1); update(); blip(300); }
        else press(k);
      } })
    )
  );

  const wrap = el('div', { class: 'gate' }, [
    el('div', {}, [
      el('div', { style: 'font-size:48px', text: '🔒' }),
      el('h2', { text: 'Espace réservé aux parents' }),
      el('p', { class: 'hint', text: 'Résous l\'opération pour continuer.' }),
      question,
      answerEl,
      keypad,
      el('button', { class: 'btn ghost', text: 'Retour', style: 'margin-top:16px', onClick: () => navigate('/') }),
    ]),
  ]);

  function shake() {
    wrap.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }],
      { duration: 250 }
    );
  }

  mount(el('div', { class: 'parent' }, [wrap]));
}
