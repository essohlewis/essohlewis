/* Conteo — Mini-jeux post-conte : find_animal, order_images, quiz.
 * order_images utilise les Pointer Events (le DnD HTML5 est peu fiable sur mobile). */

import { el, mount, clear } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { uiTone } from '../../audio/sfx.js';
import { get, put } from '../../core/db.js';
import { coverImg } from './library.js';
import { t } from '../../core/i18n.js';

export function gamesView({ tale, manifest, level, profile }) {
  const games = (manifest.games || []).filter(Boolean);
  let idx = 0;
  let score = 0;

  const root = el('section', { class: 'kid', style: { flex: '1', display: 'flex', flexDirection: 'column' } });
  mount(root);

  function next() {
    if (idx >= games.length) return finish();
    const g = games[idx];
    if (g.type === 'order_images') renderOrder(g);
    else renderChoices(g);   // find_animal + quiz
  }

  // ---------- find_animal / quiz ----------
  function renderChoices(g) {
    clear(root);
    let locked = false;
    const grid = el('div', { class: 'choices' });
    (g.options || []).forEach((opt) => {
      const btn = el('button', { class: 'choice', 'aria-label': opt.label }, [
        coverImg(opt.image, ''),
        el('div', { class: 'choice__label', text: opt.label })
      ]);
      btn.querySelector('img').classList.add('choice__img');
      btn.addEventListener('pointerup', () => {
        if (locked) return;
        if (opt.correct) {
          locked = true;
          btn.classList.add('choice--right');
          uiTone('ok'); score++;
          setTimeout(() => { idx++; next(); }, 900);
        } else {
          btn.classList.add('choice--wrong');
          uiTone('err');
          setTimeout(() => btn.classList.remove('choice--wrong'), 500);
        }
      });
      grid.append(btn);
    });

    clear(root);
    root.append(el('div', { class: 'game' }, [
      el('button', { class: 'icon-btn', style: { alignSelf: 'flex-start' }, 'aria-label': t('back'),
        text: '←', onpointerup: () => navigate('/library') }),
      el('p', { class: 'game__q', text: g.question || 'Choisis la bonne image' }),
      grid
    ]));
  }

  // ---------- order_images (Pointer Events) ----------
  function renderOrder(g) {
    clear(root);
    const order = shuffle(g.images.map((_, i) => i));
    const strip = el('div', { class: 'order-strip' });

    const tiles = order.map((imgIdx, pos) => {
      const tile = el('div', { class: 'order-tile', dataset: { img: imgIdx } }, [
        el('span', { class: 'num', text: String(pos + 1) }),
        coverImg(g.images[imgIdx], '')
      ]);
      enablePointerDrag(tile, strip, () => tiles);
      return tile;
    });
    tiles.forEach((tl) => strip.append(tl));

    const check = el('button', { class: 'btn btn--leaf', text: t('continue') });
    check.addEventListener('pointerup', () => {
      const current = [...strip.querySelectorAll('.order-tile')].map((t) => Number(t.dataset.img));
      const ok = current.every((v, i) => v === g.correct_order[i]);
      if (ok) { uiTone('star'); score++; idx++; next(); }
      else {
        uiTone('err');
        strip.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 300 });
        renumber(strip);
      }
    });

    root.append(el('div', { class: 'game' }, [
      el('button', { class: 'icon-btn', style: { alignSelf: 'flex-start' }, 'aria-label': t('back'),
        text: '←', onpointerup: () => navigate('/library') }),
      el('p', { class: 'game__q', text: "Remets les images dans l'ordre de l'histoire" }),
      strip,
      check
    ]));
  }

  async function finish() {
    await saveScore(score);
    clear(root);
    const total = games.length;
    const stars = '⭐'.repeat(Math.max(1, score)) ;
    root.append(el('div', { class: 'reward' }, [
      el('div', { class: 'reward__star', 'aria-hidden': 'true', text: '🏆' }),
      el('h1', { class: 'section-title', text: t('well_done') }),
      el('div', { class: 'stars', 'aria-hidden': 'true', text: stars }),
      el('p', { class: 'text-muted', text: `${score} / ${total}` }),
      el('div', { class: 'row', style: { marginTop: '16px' } }, [
        el('button', { class: 'btn', text: '📚 ' + t('library'), onpointerup: () => navigate('/library') })
      ])
    ]));
    uiTone('star');
  }

  async function saveScore(sc) {
    const key = [profile.id, tale.slug];
    const prev = await get('progress', key);
    await put('progress', {
      ...(prev || { profile_id: profile.id, tale_slug: tale.slug, level }),
      quiz_score: Math.max(prev?.quiz_score || 0, sc),
      completed: true,
      last_read_at: Date.now()
    });
  }

  next();
}

/* Réordonnancement tactile par Pointer Events. */
function enablePointerDrag(tile, strip) {
  tile.style.touchAction = 'none';
  let dragging = false, startX = 0, startY = 0, tx = 0, ty = 0;

  tile.addEventListener('pointerdown', (e) => {
    dragging = true;
    tile.setPointerCapture(e.pointerId);
    tile.classList.add('dragging');
    startX = e.clientX; startY = e.clientY; tx = 0; ty = 0;
  });
  tile.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    tx = e.clientX - startX; ty = e.clientY - startY;
    tile.style.transform = `translate(${tx}px, ${ty}px)`;
    // Détecte le voisin sous le centre du tile déplacé.
    const others = [...strip.querySelectorAll('.order-tile')].filter((o) => o !== tile);
    const cx = e.clientX, cy = e.clientY;
    for (const o of others) {
      const r = o.getBoundingClientRect();
      if (cx > r.left && cx < r.right && cy > r.top && cy < r.bottom) {
        const rect = tile.getBoundingClientRect();
        const before = cx < r.left + r.width / 2;
        strip.insertBefore(tile, before ? o : o.nextSibling);
        // Réajuste l'origine pour éviter le saut visuel.
        const nr = tile.getBoundingClientRect();
        startX += nr.left - rect.left; startY += nr.top - rect.top;
        break;
      }
    }
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    tile.classList.remove('dragging');
    tile.style.transform = '';
    renumber(strip);
  };
  tile.addEventListener('pointerup', end);
  tile.addEventListener('pointercancel', end);
}

function renumber(strip) {
  [...strip.querySelectorAll('.order-tile')].forEach((t, i) => {
    const n = t.querySelector('.num'); if (n) n.textContent = String(i + 1);
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Évite l'ordre déjà correct au démarrage.
  return a.every((v, i) => v === arr[i]) ? shuffle(arr) : a;
}
