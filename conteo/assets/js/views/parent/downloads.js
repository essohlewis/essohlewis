/* Conteo — Gestion des téléchargements hors-ligne + espace disque. */

import { el, toast } from '../../core/dom.js';
import { store } from '../../core/store.js';
import { loadCatalog } from '../../content/catalog.js';
import { parentShell } from './shell.js';
import { downloadPack, removePack, packStatus } from '../../offline/downloader.js';
import { isPackUnlocked } from '../../billing/entitlements.js';
import { estimate, requestPersistence } from '../../offline/storage.js';
import { bytes, fcfa } from '../../utils/format.js';

export async function downloadsView() {
  const catalog = await loadCatalog();
  const body = el('div', { class: 'stack' });

  // Espace disque
  const est = await estimate();
  const persist = await requestPersistence();
  const storageCard = el('div', { class: 'card' }, [
    el('h3', { text: 'Espace de stockage' }),
    el('p', { class: 'text-muted', text: est.supported
      ? `${bytes(est.usage)} utilisés sur ${bytes(est.quota)}`
      : 'Estimation non disponible sur cet appareil.' }),
    el('div', { class: 'progress storage-bar' }, [el('span', { style: { width: Math.min(100, (est.ratio || 0) * 100) + '%' } })]),
    !persist.granted ? el('p', { class: 'note', text: '⚠️ Le stockage persistant n’est pas garanti : l’OS peut purger le contenu hors-ligne. Sur mobile, l’app native le sécurise.' }) : null
  ]);
  body.append(storageCard);

  const list = el('div', { class: 'plist' });
  for (const pack of catalog.packs || []) {
    const unlocked = isPackUnlocked(catalog, pack);
    const status = await packStatus(pack.id);

    const bar = el('div', { class: 'progress', style: { display: 'none' } }, [el('span')]);
    const actionBtn = el('button', { class: 'btn' });

    const setState = (st) => {
      if (st === 'complete') {
        actionBtn.textContent = '🗑️ ' + 'Supprimer';
        actionBtn.className = 'btn btn--ghost';
        bar.style.display = 'none';
      } else {
        actionBtn.textContent = '⬇ Télécharger';
        actionBtn.className = 'btn';
      }
    };
    setState(status);

    actionBtn.addEventListener('pointerup', async () => {
      const current = await packStatus(pack.id);
      if (current === 'complete') {
        await removePack(pack.id);
        setState('pending');
        toast('Pack supprimé', 'ok');
        return;
      }
      if (!unlocked) { toast('Pack verrouillé — débloque-le dans la Boutique', 'err'); return; }
      actionBtn.disabled = true;
      bar.style.display = 'block';
      try {
        await downloadPack(catalog, pack.id, {
          onProgress: (done, total) => { bar.firstChild.style.width = (done / total * 100) + '%'; }
        });
        setState('complete');
        toast('Téléchargement terminé', 'ok');
      } catch (e) {
        toast('Échec du téléchargement', 'err');
      } finally { actionBtn.disabled = false; }
    });

    list.append(el('div', { class: 'pitem', style: { flexWrap: 'wrap' } }, [
      el('span', { 'aria-hidden': 'true', style: { fontSize: '28px' }, text: pack.is_free ? '🎁' : (unlocked ? '📦' : '🔒') }),
      el('div', { class: 'grow' }, [
        el('h3', { text: pack.title }),
        el('p', { text: `${pack.tales.length} contes · ${pack.size_mb} Mo · ${pack.is_free ? 'Gratuit' : fcfa(pack.price_fcfa)}` })
      ]),
      actionBtn,
      el('div', { style: { flexBasis: '100%' } }, [bar])
    ]));
  }
  body.append(list);

  return parentShell('downloads', body);
}
