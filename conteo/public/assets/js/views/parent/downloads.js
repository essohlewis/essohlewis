/**
 * CONTEO — Gestion des téléchargements hors-ligne.
 * Packs disponibles, espace disque utilisé, suppression sélective.
 */

import { el, toast } from '../../utils/dom.js';
import { api } from '../../core/api.js';
import { parentShell } from './shell.js';
import { downloadPack, removePack, offlinePacks } from '../../offline/downloader.js';
import { storageInfo } from '../../offline/cache.js';

export async function renderDownloads() {
  const body = el('div');
  parentShell('downloads', body);

  // Espace disque.
  const { usage, quota } = await storageInfo();
  const usedMb = (usage / 1048576).toFixed(1);
  const quotaMb = quota ? (quota / 1048576).toFixed(0) : '?';
  body.append(el('div', { class: 'pack-row' }, [
    el('b', { text: 'Espace utilisé' }),
    el('div', { class: 'progress' }, [el('i', { style: `width:${quota ? Math.min(100, (usage / quota) * 100) : 0}%` })]),
    el('span', { class: 'hint', text: `${usedMb} Mo / ${quotaMb} Mo` }),
  ]));

  const downloaded = await offlinePacks();
  const downloadedIds = new Set(downloaded.map((p) => p.id));

  let packs = [];
  try { packs = (await api.get('/packs')).packs || []; }
  catch { toast('Catalogue de packs indisponible hors-ligne.'); }

  body.append(el('h2', { text: 'Packs de contes' }));

  if (!packs.length && downloaded.length) {
    downloaded.forEach((p) => body.append(offlineRow(p, refresh)));
  }

  packs.forEach((pack) => {
    const isDown = downloadedIds.has(pack.id);
    body.append(packRow(pack, isDown, refresh));
  });

  function refresh() { renderDownloads(); }
}

function packRow(pack, isDown, onChange) {
  const bar = el('div', { class: 'progress' }, [el('i')]);
  const fill = bar.querySelector('i');

  const actionBtn = isDown
    ? el('button', { class: 'btn ghost', text: '🗑 Supprimer', style: 'color:var(--c-danger)',
        onClick: async () => { await removePack(pack.id); toast('Pack supprimé'); onChange(); } })
    : el('button', {
        class: 'btn', text: pack.owned ? `⬇ Télécharger (${pack.total_size_mb} Mo)` : `🔒 ${pack.price_fcfa} FCFA`,
        onClick: async () => {
          if (!pack.owned) { toast('Débloquez ce pack dans l\'onglet Abonnement.'); return; }
          actionBtn.disabled = true; actionBtn.textContent = 'Téléchargement…';
          try {
            await downloadPack(pack, (pct) => { fill.style.width = pct + '%'; });
            toast('Pack disponible hors-ligne ✓'); onChange();
          } catch (e) { toast(e.message || 'Échec du téléchargement'); actionBtn.disabled = false; }
        },
      });

  return el('div', { class: 'pack-row' }, [
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:12px' }, [
      el('div', {}, [el('b', { text: pack.title }), el('br'), el('span', { class: 'hint', text: `${pack.tale_count} contes` })]),
      isDown ? el('span', { class: 'pill', text: 'Hors-ligne ✓' }) : null,
    ]),
    bar,
    actionBtn,
  ]);
}

function offlineRow(p, onChange) {
  return el('div', { class: 'pack-row' }, [
    el('b', { text: p.title }),
    el('span', { class: 'hint', text: `${(p.size_bytes / 1048576).toFixed(1)} Mo` }),
    el('button', { class: 'btn ghost', text: '🗑 Supprimer', style: 'color:var(--c-danger)',
      onClick: async () => { await removePack(p.id); toast('Supprimé'); onChange(); } }),
  ]);
}
