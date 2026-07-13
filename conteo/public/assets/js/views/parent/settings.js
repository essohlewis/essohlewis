/**
 * CONTEO — Réglages (espace parent).
 * Langue d'interface, volume, thème (clair/sombre), déconnexion,
 * suppression de compte (droit RGPD/COPPA).
 */

import { el, toast } from '../../utils/dom.js';
import { api } from '../../core/api.js';
import { db } from '../../core/db.js';
import { state } from '../../core/store.js';
import { navigate } from '../../core/router.js';
import { parentShell } from './shell.js';

export async function renderSettings() {
  const body = el('div');
  parentShell('settings', body);

  // Thème.
  const currentTheme = (await db.get('theme')) || 'light';
  const themeToggle = el('input', { type: 'checkbox', style: 'width:auto', ...(currentTheme === 'dark' ? { checked: 'checked' } : {}) });
  themeToggle.addEventListener('change', async () => {
    const theme = themeToggle.checked ? 'dark' : 'light';
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
    await db.set('theme', theme);
  });

  // Volume.
  const vol = (await db.get('volume')) ?? 0.8;
  const volInput = el('input', { type: 'range', min: '0', max: '1', step: '0.1', value: String(vol), style: 'width:160px' });
  volInput.addEventListener('input', async () => { await db.set('volume', Number(volInput.value)); });

  body.append(
    el('h2', { text: 'Réglages' }),
    row('Thème sombre', themeToggle),
    row('Volume', volInput),
    el('div', { class: 'toggle-row' }, [
      el('span', { text: 'Compte' }),
      el('span', { class: 'hint', text: state.user?.phone || '' }),
    ]),
    el('button', { class: 'btn block secondary', text: 'Se déconnecter', style: 'margin-top:16px',
      onClick: async () => {
        try { await api.post('/auth/logout', {}); } catch { /* ignore */ }
        state.token = null; state.user = null;
        await db.del('token'); await db.del('user');
        navigate('/connexion');
      } }),
    el('button', { class: 'btn ghost block', text: 'Supprimer mon compte', style: 'color:var(--c-danger);margin-top:8px',
      onClick: async () => {
        if (!confirm('Supprimer définitivement votre compte et toutes les données associées ?')) return;
        try {
          await api.del('/auth/me');
          state.token = null; state.user = null;
          await db.del('token'); await db.del('user');
          toast('Compte supprimé.');
          navigate('/connexion');
        } catch (e) { toast(e.message || 'Erreur'); }
      } }),
  );
}

function row(label, control) {
  return el('div', { class: 'toggle-row' }, [el('span', { text: label }), control]);
}
