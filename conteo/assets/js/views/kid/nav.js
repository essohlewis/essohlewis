/* Conteo — Barre de navigation basse de l'espace enfant.
 * Icônes + libellés courts, cibles ≥ 64px. Aucun lien externe. */

import { el } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { uiTone } from '../../audio/sfx.js';
import { t } from '../../core/i18n.js';

export function kidNav(active) {
  const item = (key, ico, label, path) =>
    el('button', {
      'aria-current': active === key ? 'page' : null,
      'aria-label': label,
      onpointerup: () => { uiTone('tap'); navigate(path); }
    }, [
      el('span', { class: 'ico', 'aria-hidden': 'true', text: ico }),
      el('span', { text: label })
    ]);

  return el('nav', { class: 'kid-nav', 'aria-label': 'Navigation' }, [
    item('library', '📚', t('library'), '/library'),
    item('bedtime', '🌙', t('bedtime'), '/bedtime'),
    item('stories', '🎙️', t('my_stories'), '/my-stories'),
    item('profiles', '🙂', 'Profils', '/pick')
  ]);
}
