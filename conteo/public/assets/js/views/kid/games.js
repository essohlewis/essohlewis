/**
 * CONTEO — Mini-jeux post-conte (N2/N3).
 *   - find_animal   : 4 vignettes, 1 bonne réponse
 *   - order_images  : remettre les images dans l'ordre (drag & drop tactile)
 *   - quiz          : questions à choix d'images (N3)
 */

import { el, mount, toast } from '../../utils/dom.js';
import { blip, playSfx } from '../../audio/sfx.js';

export function renderGames(manifest, profile, onDone) {
  const games = (manifest.games || []).slice();
  let i = 0;
  let score = 0;

  const next = () => {
    if (i >= games.length) return finish();
    const g = games[i++];
    if (g.type === 'find_animal' || g.type === 'quiz') renderChoice(g, gained => { score += gained; next(); });
    else if (g.type === 'order_images') renderOrder(g, gained => { score += gained; next(); });
    else next();
  };

  const finish = async () => {
    const pct = games.length ? Math.round((score / games.length) * 100) : 100;
    // Le score du quiz est persisté par le lecteur (reader.js) via la
    // progression ; on affiche ici l'écran de félicitations.
    mount(el('div', { class: 'game' }, [
      el('div', { style: 'font-size:64px', text: pct >= 50 ? '🎉' : '🌟' }),
      el('h2', { text: `Bravo ! ${pct}%` }),
      el('button', { class: 'btn', text: 'Retour aux contes', onClick: () => { blip(); onDone(); } }),
    ]));
  };

  next();

  function renderChoice(g, done) {
    const grid = el('div', { class: 'game-grid' });
    (g.options || []).forEach((opt) => {
      const cell = el('button', { class: 'game-option' }, [el('img', { alt: '', src: opt.image })]);
      cell.addEventListener('click', () => {
        if (cell.dataset.answered) return;
        cell.dataset.answered = '1';
        if (opt.correct) {
          cell.classList.add('correct');
          playSfx();
          blip(880);
          setTimeout(() => done(1), 700);
        } else {
          cell.classList.add('wrong');
          blip(200);
          setTimeout(() => done(0), 700);
        }
      });
      grid.append(cell);
    });
    mount(el('div', { class: 'game' }, [
      el('h2', { text: g.question || 'Quel est le bon ?' }),
      grid,
    ]));
  }

  function renderOrder(g, done) {
    const strip = el('div', { class: 'order-strip' });
    // Mélange les images en gardant l'index d'origine.
    const items = (g.images || []).map((src, idx) => ({ src, idx }));
    shuffle(items);

    let dragEl = null;
    items.forEach((it) => {
      const box = el('div', { class: 'order-item', draggable: 'true', dataset: { idx: it.idx } }, [
        el('img', { alt: '', src: it.src }),
      ]);
      box.addEventListener('dragstart', () => { dragEl = box; box.classList.add('dragging'); });
      box.addEventListener('dragend', () => box.classList.remove('dragging'));
      box.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (dragEl && dragEl !== box) {
          const rect = box.getBoundingClientRect();
          const after = e.clientX > rect.left + rect.width / 2;
          strip.insertBefore(dragEl, after ? box.nextSibling : box);
        }
      });
      // Support tactile simplifié : tap pour envoyer en fin de bande.
      box.addEventListener('click', () => { strip.append(box); blip(); });
      strip.append(box);
    });

    const validate = el('button', {
      class: 'btn', text: 'Valider', onClick: () => {
        const order = [...strip.children].map((c) => Number(c.dataset.idx));
        const correct = JSON.stringify(order) === JSON.stringify(g.correct_order);
        if (correct) { toast('Parfait !'); blip(880); done(1); }
        else { toast('Essaie encore'); blip(200); done(0); }
      },
    });

    mount(el('div', { class: 'game' }, [
      el('h2', { text: 'Remets les images dans l\'ordre' }),
      strip,
      validate,
    ]));
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
