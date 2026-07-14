/* Conteo — Tableau de bord parent : stats + graphique temps d'écran (Canvas). */

import { el } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { getAllByIndex } from '../../core/db.js';
import { parentShell } from './shell.js';
import { barChart } from './chart.js';
import { minutes } from '../../utils/format.js';
import { isoDate, shortDay } from '../../utils/format.js';
import { avatarEmoji } from '../kid/pick-profile.js';
import { t } from '../../core/i18n.js';

export async function dashboardView() {
  const profile = store.activeProfile || store.profiles[0];
  const body = el('div', { class: 'stack' });

  if (!profile) {
    body.append(el('p', { class: 'note', text: 'Crée d’abord un profil enfant.' }));
    return parentShell('dashboard', body);
  }

  // Sélecteur d'enfant.
  const selector = el('div', { class: 'row row--wrap' }, store.profiles.map((p) =>
    el('button', { class: 'seg', style: { padding: '0' } }, [
      el('button', { 'aria-pressed': String(p.id === profile.id), text: `${avatarEmoji(p.avatar_key)} ${p.first_name}`,
        onpointerup: async () => { store.activeProfile = p; store.activeProfileId = p.id; renderFor(p); } })
    ])
  ));

  const dynamic = el('div', { class: 'stack' });
  body.append(selector, dynamic);

  async function renderFor(p) {
    dynamic.replaceChildren();

    const [progress, screenRows] = await Promise.all([
      getAllByIndex('progress', 'by_profile', p.id),
      getAllByIndex('screen_time', 'by_profile', p.id)
    ]);

    const talesRead = progress.filter((x) => x.completed).length;
    const wordsSet = new Set();
    progress.forEach((x) => (x.words_discovered || []).forEach((w) => wordsSet.add(w)));
    const avgQuiz = progress.length
      ? Math.round(progress.reduce((s, x) => s + (x.quiz_score || 0), 0) / progress.length * 10) / 10 : 0;

    // 7 derniers jours de temps d'écran.
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = isoDate(d);
      const row = screenRows.find((r) => r.date === key);
      days.push({ key, min: minutes(row?.seconds || 0) });
    }
    const todayMin = days[days.length - 1].min;

    dynamic.append(
      el('div', { class: 'stat-grid' }, [
        stat(todayMin + ' min', t('screen_time') + " (aujourd'hui)"),
        stat(String(talesRead), t('tales_read')),
        stat(String(wordsSet.size), t('words_found')),
        stat(String(avgQuiz), 'Score quiz moyen')
      ]),
      el('div', { class: 'card chart-card' }, [
        el('h3', { text: t('screen_time') + ' — 7 jours', style: { marginBottom: '8px' } }),
        barChart(days.map((d) => d.min), {
          labels: days.map((d) => shortDay(d.key)),
          unit: '', color: getComputedStyle(document.documentElement).getPropertyValue('--c-leaf').trim() || '#2E7D5B',
          max: Math.max((profile.daily_limit_minutes || 0), ...days.map((d) => d.min), 15)
        })
      ]),
      wordsSet.size ? el('div', { class: 'card' }, [
        el('h3', { text: t('words_found'), style: { marginBottom: '8px' } }),
        el('div', { class: 'row row--wrap' }, [...wordsSet].map((w) =>
          el('span', { class: 'badge', text: w })))
      ]) : null
    );
  }

  await renderFor(profile);
  return parentShell('dashboard', body);
}

function stat(value, label) {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat__value', text: value }),
    el('div', { class: 'stat__label', text: label })
  ]);
}
