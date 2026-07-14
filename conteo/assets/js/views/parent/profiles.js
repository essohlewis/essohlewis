/* Conteo — CRUD des profils enfants (max 4). */

import { el, toast, modal } from '../../core/dom.js';
import { getAll, add, put, del } from '../../core/db.js';
import { store } from '../../core/store.js';
import { parentShell } from './shell.js';
import { resolveLevel, levelLabel, LEVELS, ageInYears, levelForAge } from '../../content/level.js';
import { avatarEmoji } from '../kid/pick-profile.js';
import { loadCatalog } from '../../content/catalog.js';
import { t } from '../../core/i18n.js';

const AVATAR_KEYS = ['avatar_01','avatar_02','avatar_03','avatar_04','avatar_05','avatar_06','avatar_07','avatar_08'];
const MAX_PROFILES = 4;

export async function profilesView() {
  const catalog = await loadCatalog().catch(() => ({ langs: [{ code: 'fr', label: 'Français' }] }));
  const body = el('div', { class: 'stack' });

  async function refresh() {
    store.profiles = await getAll('profiles');
    render();
  }

  function render() {
    body.replaceChildren();
    const list = el('div', { class: 'plist' });
    for (const p of store.profiles) {
      list.append(el('div', { class: 'pitem' }, [
        el('div', { class: 'avatar', 'aria-hidden': 'true', text: avatarEmoji(p.avatar_key) }),
        el('div', { class: 'grow' }, [
          el('h3', { text: p.first_name }),
          el('p', { text: `Né(e) ${p.birth_month}/${p.birth_year} · Niveau ${levelLabel(resolveLevel(p))}${p.level_locked ? ' (fixé)' : ''}` })
        ]),
        el('button', { class: 'icon-btn', 'aria-label': 'Modifier', text: '✏️', onpointerup: () => openForm(p) }),
        el('button', { class: 'icon-btn', 'aria-label': t('delete'), text: '🗑️', onpointerup: () => remove(p) })
      ]));
    }
    body.append(list);
    if (store.profiles.length < MAX_PROFILES) {
      body.append(el('button', { class: 'btn btn--block', text: '➕ ' + t('add_child'), onpointerup: () => openForm(null) }));
    } else {
      body.append(el('p', { class: 'note', text: `Maximum ${MAX_PROFILES} profils.` }));
    }
  }

  async function remove(p) {
    if (!confirm(`Supprimer le profil de ${p.first_name} ? Sa progression sera perdue.`)) return;
    await del('profiles', p.id);
    if (store.activeProfileId === p.id) { store.activeProfileId = null; store.activeProfile = null; }
    toast('Profil supprimé', 'ok');
    refresh();
  }

  function openForm(p) {
    const isNew = !p;
    const nowYear = new Date().getFullYear();
    const nameI = el('input', { type: 'text', maxlength: '20', value: p?.first_name || '', required: true });
    const yearI = el('input', { type: 'number', min: String(nowYear - 8), max: String(nowYear), value: String(p?.birth_year || nowYear - 4) });
    const monthI = el('input', { type: 'number', min: '1', max: '12', value: String(p?.birth_month || 1) });
    const langI = el('select', {}, (catalog.langs || [{ code:'fr', label:'Français' }]).map((l) =>
      el('option', { value: l.code, text: l.label, selected: (p?.narration_lang || 'fr') === l.code })));
    const limitI = el('select', {}, [15, 30, 45, 60].map((m) =>
      el('option', { value: String(m), text: m + ' min', selected: (p?.daily_limit_minutes || 30) === m })));
    const lockI = el('input', { type: 'checkbox', checked: !!p?.level_locked });
    const levelI = el('select', {}, LEVELS.map((lv) =>
      el('option', { value: lv, text: levelLabel(lv), selected: (p?.reading_level) === lv })));

    // Avatar picker
    let avatar = p?.avatar_key || 'avatar_01';
    const avatarRow = el('div', { class: 'row row--wrap' }, AVATAR_KEYS.map((k) =>
      el('button', { class: 'btn-kid', style: { width: '56px', height: '56px', fontSize: '28px', outline: k === avatar ? '3px solid var(--c-sun)' : 'none' },
        text: avatarEmoji(k), 'aria-label': k,
        onpointerup: (e) => { avatar = k; [...avatarRow.children].forEach((b, i) => b.style.outline = AVATAR_KEYS[i] === k ? '3px solid var(--c-sun)' : 'none'); } })));

    const autoLevelNote = el('p', { class: 'text-muted', style: { fontSize: '13px' } });
    const updateAuto = () => {
      const age = ageInYears(Number(yearI.value), Number(monthI.value));
      autoLevelNote.textContent = `Niveau automatique : ${levelLabel(levelForAge(age))} (${age} ans)`;
    };
    yearI.addEventListener('input', updateAuto); monthI.addEventListener('input', updateAuto); updateAuto();

    const form = el('div', { class: 'stack' }, [
      el('h2', { text: isNew ? t('add_child') : 'Modifier le profil' }),
      field('Prénom', nameI),
      el('div', { class: 'row' }, [field('Année', yearI), field('Mois', monthI)]),
      autoLevelNote,
      field('Langue de narration', langI),
      field('Limite quotidienne', limitI),
      el('label', { class: 'row', style: { gap: '8px' } }, [lockI, el('span', { text: 'Fixer le niveau manuellement' })]),
      field('Niveau (si fixé)', levelI),
      el('div', {}, [el('label', { text: 'Avatar', style: { fontSize: '14px', color: 'var(--text-muted)' } }), avatarRow]),
      el('div', { class: 'row' }, [
        el('button', { class: 'btn btn--ghost', text: 'Annuler', onpointerup: () => close() }),
        el('button', { class: 'btn spacer', text: isNew ? 'Créer' : 'Enregistrer', onpointerup: save })
      ])
    ]);
    const close = modal(form);

    async function save() {
      const name = nameI.value.trim();
      if (!name) { toast('Entre un prénom', 'err'); return; }
      const record = {
        ...(p || {}),
        first_name: name,
        birth_year: Number(yearI.value),
        birth_month: Number(monthI.value),
        avatar_key: avatar,
        narration_lang: langI.value,
        daily_limit_minutes: Number(limitI.value),
        level_locked: lockI.checked,
        reading_level: lockI.checked ? levelI.value : levelForAge(ageInYears(Number(yearI.value), Number(monthI.value)))
      };
      if (isNew) { record.created_at = Date.now(); await add('profiles', record); }
      else await put('profiles', record);
      close();
      toast('Profil enregistré', 'ok');
      refresh();
    }
  }

  await refresh();
  return parentShell('profiles', body);
}

function field(label, input) {
  return el('div', { class: 'field', style: { flex: '1' } }, [
    el('label', { text: label }), input
  ]);
}
