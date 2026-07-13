/**
 * CONTEO — Gestion des profils enfants (jusqu'à 4).
 * CRUD + calcul automatique du niveau (surchargeable).
 */

import { el, toast } from '../../utils/dom.js';
import { api } from '../../core/api.js';
import { db } from '../../core/db.js';
import { state } from '../../core/store.js';
import { parentShell } from './shell.js';

const AVATARS = ['avatar_01', 'avatar_02', 'avatar_03', 'avatar_04', 'avatar_05'];
const AVATAR_EMOJI = { avatar_01: '🦁', avatar_02: '🐘', avatar_03: '🐢', avatar_04: '🦜', avatar_05: '🐆' };
const LANGS = [
  { code: 'fr', label: 'Français' }, { code: 'bci', label: 'Baoulé' },
  { code: 'dyu', label: 'Dioula' }, { code: 'bet', label: 'Bété' },
  { code: 'wol', label: 'Wolof' }, { code: 'bam', label: 'Bambara' },
];

export async function renderProfiles() {
  const body = el('div');
  parentShell('profiles', body);

  let profiles = [];
  try {
    profiles = await api.get('/profiles').then((d) => d.profiles || []);
    state.profiles = profiles;
    await db.saveProfiles(profiles);
  } catch {
    profiles = await db.allProfiles();
  }

  body.append(el('h2', { text: 'Profils enfants' }));
  profiles.forEach((p) => body.append(profileRow(p, refresh)));

  if (profiles.length < 4) {
    body.append(el('button', { class: 'btn block', text: '+ Ajouter un enfant', style: 'margin-top:16px',
      onClick: () => showForm(body, null, refresh) }));
  }

  function refresh() { renderProfiles(); }
}

function profileRow(p, onChange) {
  return el('div', { class: 'profile-row' }, [
    el('div', { class: 'av', text: AVATAR_EMOJI[p.avatar_key] || '🦁' }),
    el('div', { class: 'meta' }, [
      el('b', { text: p.first_name }),
      el('span', { class: 'hint', text: `${p.birth_month}/${p.birth_year} · ${langLabel(p.narration_lang)} · ${p.daily_limit_minutes} min/j` }),
    ]),
    el('span', { class: 'pill', text: p.reading_level }),
    el('button', { class: 'btn ghost', text: '✏️', 'aria-label': 'Modifier',
      onClick: () => editProfile(p, onChange) }),
  ]);
}

function editProfile(p, onChange) {
  // Formulaire simple via prompts pour rester compact ; UI dédiée possible.
  showForm(document.querySelector('.parent-body'), p, onChange);
}

function showForm(container, existing, onChange) {
  const isEdit = Boolean(existing);
  const first = el('input', { class: 'input', value: existing?.first_name || '', placeholder: 'Prénom' });
  const year = el('input', { class: 'input', type: 'number', value: existing?.birth_year || 2021, min: 2010, max: 2025 });
  const month = el('input', { class: 'input', type: 'number', value: existing?.birth_month || 1, min: 1, max: 12 });

  const avatarSel = el('select', { class: 'input' }, AVATARS.map((a) =>
    el('option', { value: a, text: `${AVATAR_EMOJI[a]} ${a}`, selected: existing?.avatar_key === a ? 'selected' : null })));

  const langSel = el('select', { class: 'input' }, LANGS.map((l) =>
    el('option', { value: l.code, text: l.label, selected: existing?.narration_lang === l.code ? 'selected' : null })));

  const levelSel = el('select', { class: 'input' }, ['auto', 'N1', 'N2', 'N3'].map((lv) =>
    el('option', { value: lv, text: lv === 'auto' ? 'Automatique selon l\'âge' : lv,
      selected: existing?.level_locked && existing?.reading_level === lv ? 'selected' : (lv === 'auto' && !existing?.level_locked ? 'selected' : null) })));

  const limitSel = el('select', { class: 'input' }, [15, 30, 45, 60].map((m) =>
    el('option', { value: m, text: `${m} minutes / jour`, selected: existing?.daily_limit_minutes === m ? 'selected' : null })));

  const save = el('button', { class: 'btn block', text: isEdit ? 'Enregistrer' : 'Créer le profil',
    onClick: async () => {
      const payload = {
        first_name: first.value.trim(),
        birth_year: Number(year.value),
        birth_month: Number(month.value),
        avatar_key: avatarSel.value,
        narration_lang: langSel.value,
        daily_limit_minutes: Number(limitSel.value),
      };
      if (levelSel.value !== 'auto') payload.reading_level = levelSel.value;
      try {
        if (isEdit) await api.patch(`/profiles/${existing.id}`, payload);
        else await api.post('/profiles', payload);
        toast('Profil enregistré');
        onChange();
      } catch (e) { toast(e.message || 'Erreur'); }
    } });

  const del = isEdit ? el('button', { class: 'btn ghost', text: 'Supprimer ce profil', style: 'color:var(--c-danger)',
    onClick: async () => {
      if (!confirm('Supprimer ce profil et sa progression ?')) return;
      await api.del(`/profiles/${existing.id}`);
      toast('Profil supprimé'); onChange();
    } }) : null;

  const form = el('div', { style: 'background:var(--surface);padding:16px;border-radius:16px;margin-top:16px' }, [
    el('h3', { text: isEdit ? 'Modifier le profil' : 'Nouvel enfant' }),
    labeled('Prénom', first), labeled('Année de naissance', year), labeled('Mois', month),
    labeled('Avatar', avatarSel), labeled('Langue de narration', langSel),
    labeled('Niveau de lecture', levelSel), labeled('Limite quotidienne', limitSel),
    save, del,
  ]);
  container.append(form);
  form.scrollIntoView({ behavior: 'smooth' });
}

function labeled(label, input) {
  return el('div', { class: 'field' }, [el('label', { text: label }), input]);
}
function langLabel(code) { return (LANGS.find((l) => l.code === code) || {}).label || code; }
