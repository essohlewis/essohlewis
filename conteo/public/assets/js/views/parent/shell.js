/**
 * CONTEO — Coquille commune de l'espace parent (en-tête + onglets).
 */

import { el, mount } from '../../utils/dom.js';
import { navigate } from '../../core/router.js';

const TABS = [
  { id: 'dashboard', label: 'Suivi', path: '/parent' },
  { id: 'profiles',  label: 'Enfants', path: '/parent/profils' },
  { id: 'downloads', label: 'Hors-ligne', path: '/parent/telechargements' },
  { id: 'billing',   label: 'Abonnement', path: '/parent/abonnement' },
  { id: 'settings',  label: 'Réglages', path: '/parent/reglages' },
];

/**
 * @param {string} active id de l'onglet actif
 * @param {HTMLElement} body contenu
 */
export function parentShell(active, body) {
  const header = el('div', { class: 'parent-header' }, [
    el('button', { class: 'btn ghost', text: '← Enfant', onClick: () => navigate('/') }),
    el('h1', { text: 'Espace parent' }),
  ]);

  const tabs = el('div', { class: 'parent-tabs' },
    TABS.map((t) => el('button', {
      class: t.id === active ? 'on' : '',
      text: t.label,
      onClick: () => navigate(t.path),
    }))
  );

  mount(el('div', { class: 'parent' }, [
    header, tabs,
    el('div', { class: 'parent-body' }, [body]),
  ]));
}
