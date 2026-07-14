/* Conteo — Point d'entrée. Initialise la base, l'état, l'audio, le routeur. */

import * as router from './core/router.js';
import { store } from './core/store.js';
import { getAll, getSetting, setSetting } from './core/db.js';
import { loadCatalog } from './content/catalog.js';
import { loadEntitlements, revalidate } from './billing/entitlements.js';
import { resolveLevel } from './content/level.js';
import { installUnlockOnce } from './audio/unlock.js';
import { installLifecycleHooks, onLimitReached, startScreenTimer, pauseScreenTimer } from './utils/screen-time.js';
import { el, mount } from './core/dom.js';
import { t } from './core/i18n.js';
import { initPWA } from './utils/pwa.js';

// Vues
import { splashView } from './views/kid/splash.js';
import { pickProfileView } from './views/kid/pick-profile.js';
import { libraryView } from './views/kid/library.js';
import { readerView } from './views/kid/reader.js';
import { bedtimeView } from './views/kid/bedtime.js';
import { myStoriesView } from './views/kid/my-stories.js';
import { gateView, gatePassed } from './views/parent/gate.js';
import { dashboardView } from './views/parent/dashboard.js';
import { profilesView } from './views/parent/profiles.js';
import { downloadsView } from './views/parent/downloads.js';
import { storeView } from './views/parent/store.js';
import { backupView } from './views/parent/backup.js';
import { settingsView } from './views/parent/settings.js';

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
}

/* Écran de verrouillage « À demain ! » quand la limite quotidienne est atteinte. */
function showTimeUpLock() {
  const node = el('section', { class: 'kid center', style: { flex: '1', gap: '24px', padding: '32px', background: 'var(--c-indigo)', color: '#EDE7FF' } }, [
    el('div', { 'aria-hidden': 'true', style: { fontSize: '96px' }, text: '🌙' }),
    el('h1', { class: 'section-title', text: t('see_you_tomorrow') }),
    el('p', { text: t('time_up'), style: { maxWidth: '22rem' } }),
    el('button', { class: 'icon-btn', 'aria-label': t('parent_space'), text: '⚙️',
      onpointerup: () => router.navigate('/parent') })
  ]);
  mount(node);
}

async function boot() {
  applyTheme('light');

  // État persistant.
  const [theme, volume, activeChild] = await Promise.all([
    getSetting('theme', 'light'),
    getSetting('volume', 0.8),
    getSetting('active_child', null)
  ]);
  store.theme = theme; applyTheme(theme);
  store.volume = Number(volume);

  store.profiles = await getAll('profiles');
  if (activeChild != null) {
    const p = store.profiles.find((x) => x.id === activeChild);
    if (p) { store.activeProfileId = p.id; store.activeProfile = { ...p, reading_level: resolveLevel(p) }; }
  }

  // Catalogue + droits (tolère l'offline).
  try { await loadCatalog(); } catch { /* le SW servira une copie si dispo */ }
  await loadEntitlements();
  revalidate();   // revalidation IAP native en tâche de fond

  // Audio + cycle de vie + limite d'écran.
  installUnlockOnce();
  installLifecycleHooks();
  onLimitReached(showTimeUpLock);
  initPWA();   // invite d'installation + bannière hors-ligne

  // Suivi du temps d'écran uniquement dans l'espace enfant.
  window.addEventListener('conteo:route', (e) => {
    const path = e.detail?.path || '';
    const inKid = path.startsWith('/library') || path.startsWith('/reader') ||
                  path.startsWith('/bedtime') || path.startsWith('/my-stories');
    if (inKid && store.activeProfile) startScreenTimer();
    else pauseScreenTimer();
  });

  defineRoutes();
  router.start();
}

function defineRoutes() {
  const guard = (view) => (params, query) => {
    // store.route.path est renseigné par le routeur avant l'appel du handler.
    if (!gatePassed()) return gateView(store.route.path);
    return view(params, query);
  };

  router.add('/', splashView);
  router.add('/pick', pickProfileView);
  router.add('/library', libraryView);
  router.add('/reader/:slug', readerView);
  router.add('/bedtime', bedtimeView);
  router.add('/my-stories', myStoriesView);

  router.add('/parent', () => gateView('/parent/dashboard'));
  router.add('/parent/dashboard', guard(dashboardView));
  router.add('/parent/profiles', guard(profilesView));
  router.add('/parent/downloads', guard(downloadsView));
  router.add('/parent/store', guard(storeView));
  router.add('/parent/backup', guard(backupView));
  router.add('/parent/settings', guard(settingsView));

  router.setNotFound(splashView);
}

// Enregistrement du Service Worker (PWA / offline).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {/* dev sans HTTPS */});
  });
}

boot();
