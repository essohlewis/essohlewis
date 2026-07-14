/* Conteo — Sélection du profil enfant. Icônes + audio, aucun texte requis. */

import { el, mount } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { store } from '../../core/store.js';
import { setSetting } from '../../core/db.js';
import { uiTone } from '../../audio/sfx.js';
import { resolveLevel } from '../../content/level.js';
import { t } from '../../core/i18n.js';

const AVATARS = {
  avatar_01: '🦁', avatar_02: '🐘', avatar_03: '🦒', avatar_04: '🐢',
  avatar_05: '🦜', avatar_06: '🐊', avatar_07: '🦓', avatar_08: '🐆'
};
export function avatarEmoji(key) { return AVATARS[key] || '🙂'; }

export async function pickProfileView() {
  const pick = async (profile) => {
    uiTone('tap');
    store.activeProfileId = profile.id;
    store.activeProfile = { ...profile, reading_level: resolveLevel(profile) };
    await setSetting('active_child', profile.id);
    navigate('/library');
  };

  const cards = store.profiles.map((p) =>
    el('button', { class: 'profile-card', onpointerup: () => pick(p) }, [
      el('div', { class: 'avatar', 'aria-hidden': 'true', text: avatarEmoji(p.avatar_key) }),
      el('span', { class: 'profile-card__name', text: p.first_name })
    ])
  );

  cards.push(
    el('button', { class: 'profile-card profile-card--add',
      'aria-label': t('add_child'),
      onpointerup: () => { uiTone('tap'); navigate('/parent/profiles'); } }, [
      el('div', { class: 'avatar', 'aria-hidden': 'true', text: '➕' }),
      el('span', { class: 'profile-card__name', text: t('add_child') })
    ])
  );

  const node = el('section', { class: 'kid view center' }, [
    el('h1', { class: 'section-title', text: t('choose_child') }),
    el('div', { class: 'profile-grid' }, cards),
    el('button', { class: 'icon-btn', style: { marginTop: '32px' },
      'aria-label': t('parent_space'), title: t('parent_space'),
      onpointerup: () => navigate('/parent'), text: '⚙️' })
  ]);

  return mount(node);
}
