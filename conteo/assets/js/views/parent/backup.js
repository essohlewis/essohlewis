/* Conteo — Export / import de sauvegarde JSON.
 * Indispensable en l'absence de compte cloud : migration d'appareil à appareil. */

import { el, toast } from '../../core/dom.js';
import { exportAll, importAll } from '../../core/db.js';
import { parentShell } from './shell.js';
import { store } from '../../core/store.js';
import { t } from '../../core/i18n.js';

export function backupView() {
  const body = el('div', { class: 'stack' });

  const exportBtn = el('button', { class: 'btn btn--block', text: '⬇ ' + t('export_backup') });
  exportBtn.addEventListener('pointerup', async () => {
    try {
      const dump = await exportAll({ includeRecordings: true });
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: `conteo-sauvegarde-${new Date().toISOString().slice(0,10)}.json` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('Sauvegarde exportée', 'ok');
    } catch { toast('Échec de l’export', 'err'); }
  });

  const fileInput = el('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only' });
  const importBtn = el('button', { class: 'btn btn--ghost btn--block', text: '⬆ ' + t('import_backup') });
  importBtn.addEventListener('pointerup', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!confirm('Importer remplacera les profils et la progression actuels. Continuer ?')) { fileInput.value = ''; return; }
    try {
      const text = await file.text();
      const dump = JSON.parse(text);
      await importAll(dump);
      // Recharge l'état en mémoire.
      const { getAll } = await import('../../core/db.js');
      store.profiles = await getAll('profiles');
      store.activeProfile = null; store.activeProfileId = null;
      toast('Sauvegarde importée', 'ok');
    } catch (e) {
      toast('Fichier invalide', 'err');
    } finally { fileInput.value = ''; }
  });

  body.append(
    el('div', { class: 'card stack' }, [
      el('h3', { text: t('backup') }),
      el('p', { class: 'text-muted', text: 'Aucun compte, aucun serveur : tes données restent sur l’appareil. Exporte-les pour les sauvegarder ou les transférer sur un autre appareil.' }),
      exportBtn,
      importBtn,
      fileInput
    ]),
    el('p', { class: 'note', text: '🔓 Le fichier de sauvegarde est en clair (non chiffré). Conserve-le dans un endroit sûr : il contient les prénoms et la progression de tes enfants.' })
  );

  return parentShell('backup', body);
}
