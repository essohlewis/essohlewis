/**
 * CONTEO — Bibliothèque enfant.
 * Grille de vignettes filtrée par le niveau du profil actif.
 * Badges « nouveau » / « déjà lu ». Aucun texte requis pour naviguer.
 */

import { el, mount, toast } from '../../utils/dom.js';
import { api } from '../../core/api.js';
import { db } from '../../core/db.js';
import { state } from '../../core/store.js';
import { navigate } from '../../core/router.js';
import { blip, unlockAudio } from '../../audio/sfx.js';

export async function renderLibrary() {
  unlockAudio();
  const profile = state.activeProfile;
  const level = profile?.reading_level || 'N2';
  const lang = profile?.narration_lang || 'fr';

  const header = el('div', { class: 'kid-header' }, [
    el('div', { class: 'kid-avatar', text: avatarEmoji(profile?.avatar_key) }),
    el('div', { class: 'kid-title', text: profile ? `Bonjour ${profile.first_name} !` : 'CONTEO' }),
    el('button', {
      class: 'parent-key', 'aria-label': 'Espace parent', text: '👤',
      onClick: () => { blip(440); navigate('/parent'); },
    }),
  ]);

  const grid = el('div', { class: 'library' });
  const container = el('div', { class: 'kid' }, [header, grid]);
  mount(container);

  // Progression locale (pour badge « déjà lu »), tolérante au hors-ligne.
  let progressMap = {};
  try {
    const all = await db.allProgress();
    all.forEach((p) => { progressMap[p.tale_id] = p; });
  } catch { /* ignore */ }

  let tales = [];
  try {
    tales = await api.get(`/tales?level=${level}&lang=${lang}`).then((d) => d.tales || []);
    await db.set('catalogue', tales); // cache pour hors-ligne
  } catch (err) {
    tales = (await db.get('catalogue')) || [];
    if (!tales.length) {
      grid.append(el('p', { class: 'hint', text: 'Aucun conte disponible hors-ligne pour le moment.' }));
      return;
    }
    toast('Mode hors-ligne');
  }

  tales.forEach((t) => grid.append(taleCard(t, progressMap[t.id], lang)));
}

function taleCard(t, prog, lang) {
  const card = el('button', { class: 'tale-card', 'aria-label': t.title });

  const img = el('img', { alt: '', loading: 'lazy', src: t.cover || '/assets/icons/icon-192.png' });
  card.append(img);

  if (prog?.completed) card.append(el('span', { class: 'badge read', text: '✓' }));
  else if (t.is_new) card.append(el('span', { class: 'badge new', text: 'Nouveau' }));

  if (t.locked) card.append(el('span', { class: 'lock', text: '🔒' }));

  card.append(el('div', { class: 'cap', text: t.title }));

  card.addEventListener('click', () => {
    blip();
    if (t.locked) {
      toast('Ce conte nécessite un abonnement.');
      navigate('/parent');
      return;
    }
    navigate(`/conte/${t.slug}`);
  });

  return card;
}

function avatarEmoji(key) {
  const map = { avatar_01: '🦁', avatar_02: '🐘', avatar_03: '🐢', avatar_04: '🦜', avatar_05: '🐆' };
  return map[key] || '🦁';
}
