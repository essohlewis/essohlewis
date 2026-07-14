/* Conteo — Installabilité PWA + indicateur hors-ligne.
 * - Capte 'beforeinstallprompt' et propose une puce « Installer l'app ».
 * - Affiche une bannière discrète quand l'appareil passe hors-ligne.
 * Marché cible : l'installation sur l'écran d'accueil + l'offline sont clés. */

import { el } from '../core/dom.js';
import { store } from '../core/store.js';

let deferredPrompt = null;

export function initPWA() {
  const banner = el('div', { id: 'pwa-banner', class: 'pwa-banner hidden', role: 'status' });
  document.body.append(banner);

  const showOffline = () => {
    banner.textContent = '📴 Mode hors-ligne — tes contes téléchargés restent disponibles';
    banner.className = 'pwa-banner pwa-banner--offline';
  };
  const hideBanner = () => { banner.className = 'pwa-banner hidden'; };

  window.addEventListener('offline', () => { store.online = false; showOffline(); });
  window.addEventListener('online', () => {
    store.online = true;
    banner.textContent = '✅ De nouveau en ligne';
    banner.className = 'pwa-banner pwa-banner--online';
    setTimeout(hideBanner, 2000);
  });
  if (!navigator.onLine) showOffline();

  // Invite d'installation (Android/Chrome). iOS n'expose pas l'évènement :
  // on garde le comportement natif « Ajouter à l'écran d'accueil » de Safari.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallChip();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; removeInstallChip(); });
}

function showInstallChip() {
  if (document.getElementById('install-chip')) return;
  const chip = el('button', {
    id: 'install-chip', class: 'install-chip',
    'aria-label': 'Installer l’application',
    onpointerup: async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch {}
      deferredPrompt = null;
      removeInstallChip();
    }
  }, [el('span', { 'aria-hidden': 'true', text: '⬇️ ' }), 'Installer']);
  document.body.append(chip);
}

function removeInstallChip() { document.getElementById('install-chip')?.remove(); }
