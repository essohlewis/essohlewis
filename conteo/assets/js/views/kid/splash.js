/* Conteo — Splash. Premier écran ; débloque l'audio iOS au premier tap. */

import { el, mount } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { unlockAudio } from '../../audio/unlock.js';
import { uiTone } from '../../audio/sfx.js';
import { t } from '../../core/i18n.js';
import { store } from '../../core/store.js';

export function splashView() {
  const go = () => {
    unlockAudio();
    uiTone('tap');
    navigate(store.profiles.length ? '/pick' : '/parent/profiles');
  };

  const node = el('section', { class: 'kid splash', onpointerdown: go, role: 'button',
    tabindex: '0', 'aria-label': t('tap_to_start'),
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') go(); } }, [
    el('div', { class: 'splash__logo', 'aria-hidden': 'true', text: '🦁📖' }),
    el('h1', { class: 'splash__title', text: 'Conteo' }),
    el('p', { class: 'splash__tap', text: t('tap_to_start') })
  ]);

  return mount(node);
}
