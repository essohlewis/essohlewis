/* Conteo — Paramètres : volume, thème, langue de narration par défaut. */

import { el, toast } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { setSetting } from '../../core/db.js';
import { parentShell } from './shell.js';
import { loadCatalog } from '../../content/catalog.js';
import { applyTheme } from '../../main.js';
import { t } from '../../core/i18n.js';

export async function settingsView() {
  const catalog = await loadCatalog().catch(() => ({ langs: [{ code: 'fr', label: 'Français' }] }));
  const body = el('div', { class: 'stack' });

  // Volume
  const vol = el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(store.volume ?? 0.8), style: { width: '100%' } });
  vol.addEventListener('input', async () => {
    store.volume = Number(vol.value);
    await setSetting('volume', store.volume);
  });

  // Thème
  const themeSeg = el('div', { class: 'seg' }, [
    themeBtn('light', '☀️ Clair'),
    themeBtn('dark', '🌙 Sombre')
  ]);
  function themeBtn(val, label) {
    const b = el('button', { 'aria-pressed': String(store.theme === val), text: label });
    b.addEventListener('pointerup', async () => {
      store.theme = val;
      applyTheme(val);
      await setSetting('theme', val);
      [...themeSeg.children].forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    });
    return b;
  }

  // Langue de narration par défaut
  const defLang = await (async () => (await import('../../core/db.js')).getSetting('default_lang', 'fr'))();
  const langSel = el('select', {}, (catalog.langs || []).map((l) =>
    el('option', { value: l.code, text: l.label, selected: l.code === defLang })));
  langSel.addEventListener('change', async () => { await setSetting('default_lang', langSel.value); toast('Langue par défaut mise à jour', 'ok'); });

  body.append(
    el('div', { class: 'card stack' }, [
      el('h3', { text: 'Son' }),
      el('div', { class: 'field' }, [el('label', { text: 'Volume' }), vol])
    ]),
    el('div', { class: 'card stack' }, [
      el('h3', { text: 'Apparence' }),
      el('div', { class: 'field' }, [el('label', { text: 'Thème' }), themeSeg])
    ]),
    el('div', { class: 'card stack' }, [
      el('h3', { text: 'Narration' }),
      el('div', { class: 'field' }, [el('label', { text: 'Langue par défaut' }), langSel])
    ]),
    el('div', { class: 'note' }, [
      el('strong', { text: '🔒 Vie privée — ' }),
      'Aucune donnée ne quitte cet appareil : ni prénom, ni âge, ni voix. Zéro traçage, zéro publicité.'
    ])
  );

  return parentShell('settings', body);
}
