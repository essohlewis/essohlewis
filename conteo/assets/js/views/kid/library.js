/* Conteo — Bibliothèque enfant. Grille filtrée par le niveau du profil actif. */

import { el, mount, toast } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { store } from '../../core/store.js';
import { loadCatalog, talesForLevel } from '../../content/catalog.js';
import { isTaleUnlocked } from '../../billing/entitlements.js';
import { getAllByIndex } from '../../core/db.js';
import { packStatus } from '../../offline/downloader.js';
import { uiTone } from '../../audio/sfx.js';
import { avatarEmoji } from './pick-profile.js';
import { kidNav } from './nav.js';
import { levelLabel } from '../../content/level.js';
import { t } from '../../core/i18n.js';

export async function libraryView() {
  const profile = store.activeProfile;
  if (!profile) return navigate('/pick', { replace: true });

  const catalog = await loadCatalog();
  const level = profile.reading_level;
  const tales = talesForLevel(catalog, level);

  const progressRows = await getAllByIndex('progress', 'by_profile', profile.id);
  const progressBySlug = Object.fromEntries(progressRows.map((r) => [r.tale_slug, r]));

  const grid = el('div', { class: 'library-grid' });

  for (const tale of tales) {
    const unlocked = isTaleUnlocked(catalog, tale);
    const prog = progressBySlug[tale.slug];
    const dl = await packStatus(tale.pack_id);
    const badges = [];
    if (!prog) badges.push(el('span', { class: 'badge badge--new', text: t('new') }));
    else if (prog.completed) badges.push(el('span', { class: 'badge badge--read', text: '✓ ' + t('already_read') }));
    if (!unlocked) badges.push(el('span', { class: 'badge badge--lock', text: '🔒' }));
    else if (dl !== 'complete') badges.push(el('span', { class: 'badge', text: '⬇' }));

    const card = el('button', {
      class: 'tale-card' + (unlocked ? '' : ' tale-card--locked'),
      'aria-label': tale.title + (unlocked ? '' : ' (' + t('locked') + ')'),
      onpointerup: () => {
        uiTone('tap');
        if (!unlocked) { toast('🔒 Demande à un parent', ''); return; }
        navigate('/reader/' + tale.slug);
      }
    }, [
      coverImg(tale.cover),
      el('div', { class: 'tale-card__badges' }, badges),
      el('div', { class: 'tale-card__title', text: tale.title }),
      !unlocked && el('div', { class: 'tale-card__lock', 'aria-hidden': 'true', text: '🔒' })
    ]);
    grid.append(card);
  }

  if (!tales.length) {
    grid.append(el('p', { class: 'text-muted', text: 'Aucun conte pour ce niveau pour le moment.' }));
  }

  // « Reprendre la lecture » : conte le plus récent commencé mais non terminé.
  const resumeCard = buildResumeCard(catalog, tales, progressRows);

  const scroll = el('div', { style: { flex: '1', overflowY: 'auto' } }, [resumeCard, grid]);

  const node = el('section', { class: 'kid view--full', style: { flex: '1', display: 'flex', flexDirection: 'column' } }, [
    el('header', { class: 'library-head' }, [
      el('div', { class: 'avatar', 'aria-hidden': 'true', text: avatarEmoji(profile.avatar_key) }),
      el('div', {}, [
        el('strong', { text: profile.first_name }),
        el('div', { class: 'text-muted', style: { fontSize: '13px' }, text: 'Niveau ' + levelLabel(level) })
      ])
    ]),
    scroll,
    kidNav('library')
  ]);

  return mount(node);
}

/* Bandeau « Reprendre » pour le dernier conte commencé et non terminé. */
function buildResumeCard(catalog, tales, progressRows) {
  const bySlug = Object.fromEntries(tales.map((t) => [t.slug, t]));
  const candidate = progressRows
    .filter((p) => !p.completed && p.last_page > 1 && bySlug[p.tale_slug])
    .filter((p) => isTaleUnlocked(catalog, bySlug[p.tale_slug]))
    .sort((a, b) => (b.last_read_at || 0) - (a.last_read_at || 0))[0];
  if (!candidate) return null;
  const tale = bySlug[candidate.tale_slug];

  return el('button', {
    class: 'resume-card',
    'aria-label': 'Reprendre : ' + tale.title,
    onpointerup: () => { uiTone('tap'); navigate('/reader/' + tale.slug); }
  }, [
    el('span', { class: 'resume-card__ico', 'aria-hidden': 'true', text: '▶️' }),
    el('div', { class: 'resume-card__body' }, [
      el('span', { class: 'resume-card__kicker', text: 'Reprendre la lecture' }),
      el('strong', { class: 'resume-card__title', text: tale.title })
    ])
  ]);
}

/* Vignette avec repli dégradé si l'image manque (dev/offline). */
export function coverImg(src, cls = 'tale-card__cover') {
  const img = el('img', { class: cls, src, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => { img.removeAttribute('src'); img.style.opacity = '1'; });
  return img;
}
