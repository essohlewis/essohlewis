/* Conteo — Coque de l'espace parent : barre d'onglets + zone de contenu. */

import { el, mount } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { t } from '../../core/i18n.js';

const TABS = [
  ['dashboard', 'dashboard', '/parent/dashboard'],
  ['profiles', 'profiles', '/parent/profiles'],
  ['downloads', 'downloads', '/parent/downloads'],
  ['shop', 'shop', '/parent/store'],
  ['backup', 'backup', '/parent/backup'],
  ['settings', 'settings', '/parent/settings']
];

export function parentShell(activeKey, bodyNode) {
  const tabs = el('nav', { class: 'parent-tabs', 'aria-label': t('parent_space') },
    TABS.map(([key, label, path]) =>
      el('button', {
        'aria-current': key === activeKey ? 'page' : null,
        text: t(label),
        onpointerup: () => navigate(path)
      })
    )
  );

  const root = el('section', { class: 'parent', style: { flex: '1', display: 'flex', flexDirection: 'column' } }, [
    el('header', { class: 'appbar' }, [
      el('button', { class: 'icon-btn', 'aria-label': t('back'), text: '🏠',
        onpointerup: () => navigate('/pick') }),
      el('h1', { text: t('parent_space') })
    ]),
    tabs,
    el('div', { class: 'parent-body' }, [bodyNode])
  ]);
  return mount(root);
}
