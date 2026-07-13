/**
 * CONTEO — Bootstrap de l'application (SPA vanilla, modules ES natifs).
 *
 * - Enregistre le Service Worker (offline).
 * - Restaure la session depuis IndexedDB.
 * - Configure le routeur SPA et l'aiguillage enfant/parent.
 * - Applique le thème, la bannière hors-ligne, la synchronisation différée.
 */

import { route, setNotFound, navigate, startRouter } from './core/router.js';
import { state, subscribe } from './core/store.js';
import { db } from './core/db.js';
import { el, mount, clear } from './utils/dom.js';
import { initSync, flush } from './utils/sync.js';

import { renderAuth } from './views/auth.js';
import { renderLibrary } from './views/kid/library.js';
import { renderReader } from './views/kid/reader.js';
import { renderBedtime } from './views/kid/bedtime.js';
import { renderGate, gateIsOpen } from './views/parent/gate.js';
import { renderDashboard } from './views/parent/dashboard.js';
import { renderProfiles } from './views/parent/profiles.js';
import { renderDownloads } from './views/parent/downloads.js';
import { renderBilling } from './views/parent/billing.js';
import { renderSettings } from './views/parent/settings.js';

async function boot() {
  // ── Thème ──
  const theme = (await db.get('theme')) || matchTheme();
  document.documentElement.classList.toggle('theme-dark', theme === 'dark');

  // ── Restaure la session ──
  state.token = (await db.get('token')) || null;
  state.user = (await db.get('user')) || null;
  state.profiles = (await db.allProfiles()) || [];
  const savedProfileId = await db.get('activeProfileId');
  if (savedProfileId) {
    state.activeProfile = state.profiles.find((p) => p.id === savedProfileId) || null;
  }

  // ── Service Worker ──
  registerSW();

  // ── Connectivité ──
  updateOfflineBanner();
  window.addEventListener('online', () => { state.online = true; updateOfflineBanner(); });
  window.addEventListener('offline', () => { state.online = false; updateOfflineBanner(); });
  subscribe((key) => { if (key === 'online') updateOfflineBanner(); });

  // ── Synchronisation différée ──
  initSync();
  navigator.serviceWorker?.addEventListener?.('message', (e) => {
    if (e.data?.type === 'flush-sync') flush();
  });

  setupRoutes();
  startRouter();
}

function setupRoutes() {
  // ── Espace enfant ──
  route('/', () => requireAuth(() => requireProfile(renderLibrary)));
  route('/conte/:slug', (p) => requireAuth(() => requireProfile(() => renderReader(p.slug))));
  route('/soir', () => requireAuth(() => requireProfile(renderBedtime)));
  route('/profils-enfant', () => requireAuth(renderProfileChooser));

  // ── Authentification ──
  route('/connexion', renderAuth);

  // ── Retour de paiement ──
  route('/paiement/retour', renderPaymentReturn);

  // ── Espace parent (protégé par verrou arithmétique) ──
  const gated = (fn) => () => requireAuth(() => renderGate(fn));
  route('/parent', gated(renderDashboard));
  route('/parent/profils', gated(renderProfiles));
  route('/parent/telechargements', gated(renderDownloads));
  route('/parent/abonnement', gated(renderBilling));
  route('/parent/reglages', gated(renderSettings));

  setNotFound(() => navigate('/', true));
}

/** Exige une session ; sinon renvoie vers l'écran d'authentification. */
function requireAuth(fn) {
  if (!state.token) { renderAuth(); return; }
  fn();
}

/** Exige un profil enfant actif ; sinon affiche le sélecteur. */
async function requireProfile(fn) {
  if (state.activeProfile) { fn(); return; }
  if (!state.profiles?.length) {
    state.profiles = await db.allProfiles();
  }
  if (state.profiles?.length === 1) {
    await setActiveProfile(state.profiles[0]);
    fn();
    return;
  }
  if (!state.profiles?.length) {
    // Aucun profil : diriger le parent vers la création.
    navigate('/parent/profils');
    return;
  }
  renderProfileChooser(fn);
}

/** Sélecteur de profil enfant (grille d'avatars, aucun texte requis). */
function renderProfileChooser(after) {
  const grid = el('div', { class: 'library', style: 'grid-template-columns:repeat(auto-fill,minmax(120px,1fr))' });
  (state.profiles || []).forEach((p) => {
    const emoji = { avatar_01: '🦁', avatar_02: '🐘', avatar_03: '🐢', avatar_04: '🦜', avatar_05: '🐆' }[p.avatar_key] || '🦁';
    grid.append(el('button', { class: 'tale-card', style: 'aspect-ratio:1;align-items:center;justify-content:center',
      onClick: async () => { await setActiveProfile(p); (typeof after === 'function' ? after : renderLibrary)(); } }, [
      el('div', { style: 'font-size:64px', text: emoji }),
      el('div', { class: 'cap', text: p.first_name }),
    ]));
  });

  mount(el('div', { class: 'kid' }, [
    el('div', { class: 'kid-header' }, [
      el('div', { style: 'width:72px' }),
      el('div', { class: 'kid-title', text: 'Qui lit aujourd\'hui ?' }),
      el('button', { class: 'parent-key', text: '👤', 'aria-label': 'Parent', onClick: () => navigate('/parent') }),
    ]),
    grid,
  ]));
}

async function setActiveProfile(p) {
  state.activeProfile = p;
  state.narrationLang = p.narration_lang || 'fr';
  await db.set('activeProfileId', p.id);
}

function renderPaymentReturn() {
  const ref = new URLSearchParams(location.search).get('ref');
  mount(el('div', { class: 'center-screen' }, [
    el('div', {}, [
      el('div', { style: 'font-size:56px', text: '⏳' }),
      el('h2', { text: 'Vérification du paiement…' }),
      el('p', { class: 'hint', text: 'Votre accès sera débloqué dès confirmation de la transaction.' }),
      el('button', { class: 'btn', text: 'Continuer', onClick: () => navigate('/parent/abonnement') }),
    ]),
  ]));
  // La confirmation réelle est faite serveur-à-serveur par le webhook ;
  // on peut interroger le statut à titre indicatif.
  if (ref) {
    import('./core/api.js').then(({ api }) => {
      api.get(`/payments/${encodeURIComponent(ref)}`).catch(() => {});
    });
  }
}

function updateOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.hidden = state.online;
}

function matchTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

boot();
