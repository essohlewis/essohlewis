/* =============================================================================
   app.js — Logique principale de MediaGrab CI
   Orchestration : saisie d'URL, détection de plateforme, analyse, rendu des
   résultats, téléchargement, historique, thème, navigation, FAQ, animations.
   ========================================================================== */

import { fetchInfo, buildDownloadUrl } from './api.js';
import {
  renderSkeleton,
  renderResult,
  renderError,
  renderProgress,
  detectPlatform,
  PLATFORM_ICONS,
} from './ui.js';
import { getHistory, addHistory, clearHistory } from './history.js';

/* --- Références DOM --- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const urlInput = $('#url-input');
const platformIcon = $('#url-platform-icon');
const btnAnalyze = $('#btn-analyze');
const btnPaste = $('#btn-paste');
const resultsEl = $('#results');

let lastAnalyzedUrl = null;

/* =============================================================================
   1. THÈME (clair / sombre) — persisté dans localStorage
   ========================================================================== */
function initTheme() {
  const saved = safeGet('mediagrab_theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', theme);

  const toggle = $('#theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      safeSet('mediagrab_theme', next);
    });
  }
}

/* =============================================================================
   2. NAVIGATION MOBILE (hamburger)
   ========================================================================== */
function initNav() {
  const hamburger = $('#hamburger');
  const navLinks = $('#nav-links');
  if (!hamburger || !navLinks) return;

  hamburger.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(open));
  });
  // Ferme le menu au clic sur un lien.
  $$('a', navLinks).forEach((a) =>
    a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    })
  );
}

/* =============================================================================
   3. DÉTECTION DE PLATEFORME EN TEMPS RÉEL
   ========================================================================== */
function updatePlatformIcon() {
  const platform = detectPlatform(urlInput.value.trim());
  if (platform) {
    platformIcon.innerHTML = PLATFORM_ICONS[platform];
    platformIcon.classList.add('visible');
    urlInput.classList.add('has-platform');
  } else {
    platformIcon.classList.remove('visible');
    urlInput.classList.remove('has-platform');
  }
}

/* =============================================================================
   4. COLLER DEPUIS LE PRESSE-PAPIERS
   ========================================================================== */
async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      urlInput.value = text.trim();
      updatePlatformIcon();
      urlInput.focus();
    }
  } catch (_e) {
    // Permission refusée / non supporté : on invite à coller manuellement.
    urlInput.focus();
    flashHint("Autorisez l'accès au presse-papiers ou collez manuellement (Ctrl/Cmd + V).");
  }
}

/* =============================================================================
   5. ANALYSE (POST /api/info)
   ========================================================================== */
async function handleAnalyze() {
  const url = urlInput.value.trim();
  if (!url) {
    resultsEl.innerHTML = renderError('Veuillez coller une URL de vidéo avant de lancer l’analyse.');
    urlInput.focus();
    return;
  }

  setAnalyzing(true);
  resultsEl.innerHTML = renderSkeleton();
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const data = await fetchInfo(url);
    lastAnalyzedUrl = data.webpageUrl || url;
    resultsEl.innerHTML = renderResult(data);
    wireFormatButtons(data);

    // Historique de session.
    addHistory({
      url: lastAnalyzedUrl,
      title: data.title,
      thumbnail: data.thumbnail,
      platform: data.platform,
    });
    renderHistory();
  } catch (err) {
    const message = err.userMessage || "Une erreur est survenue. Réessayez plus tard.";
    resultsEl.innerHTML = renderError(message);
  } finally {
    setAnalyzing(false);
  }
}

function setAnalyzing(isLoading) {
  btnAnalyze.disabled = isLoading;
  urlInput.disabled = isLoading;
  btnAnalyze.innerHTML = isLoading
    ? `<span class="spinner" aria-hidden="true"></span> Analyse…`
    : `Analyser`;
}

/* =============================================================================
   6. TÉLÉCHARGEMENT (GET /api/download via lien)
   ========================================================================== */
function wireFormatButtons(data) {
  const progressEl = $('[data-progress]', resultsEl);
  const inlineError = $('[data-inline-error]', resultsEl);

  $$('.format-card', resultsEl).forEach((btn) => {
    btn.addEventListener('click', () => {
      const formatId = btn.dataset.formatId;
      const sourceFormatId = btn.dataset.sourceFormatId || undefined;
      const label = btn.dataset.label || '';

      // Feedback : désactive les boutons + progression.
      $$('.format-card', resultsEl).forEach((b) => (b.disabled = true));
      if (inlineError) inlineError.innerHTML = '';
      progressEl.classList.remove('hidden');
      progressEl.innerHTML = renderProgress('preparation', `Préparation du format ${label}…`);

      const href = buildDownloadUrl({
        url: lastAnalyzedUrl,
        formatId,
        title: data.title,
        sourceFormatId,
      });

      // Déclenche le téléchargement via un lien caché (UX navigateur native).
      triggerDownload(href);

      // On simule une progression (le flux réel se fait dans le navigateur).
      setTimeout(() => {
        progressEl.innerHTML = renderProgress('telechargement');
      }, 900);
      setTimeout(() => {
        progressEl.innerHTML = renderProgress('termine');
        $$('.format-card', resultsEl).forEach((b) => (b.disabled = false));
      }, 2600);
    });
  });
}

function triggerDownload(href) {
  const a = document.createElement('a');
  a.href = href;
  a.setAttribute('download', '');
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* =============================================================================
   7. HISTORIQUE
   ========================================================================== */
function renderHistory() {
  const section = $('#history');
  const grid = $('#history-grid');
  if (!grid || !section) return;

  const items = getHistory();
  if (!items.length) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  grid.innerHTML = items
    .map((h) => {
      const thumb = h.thumbnail
        ? `<img src="${escapeAttr(h.thumbnail)}" alt="" loading="lazy" />`
        : '';
      return `
        <button class="glass history-item" type="button" data-url="${escapeAttr(h.url)}" title="${escapeAttr(h.title)}">
          <div class="history-thumb">${thumb}</div>
          <h4>${escapeAttr(h.title)}</h4>
          <small>${escapeAttr(h.platform)}</small>
        </button>`;
    })
    .join('');

  $$('.history-item', grid).forEach((item) =>
    item.addEventListener('click', () => {
      urlInput.value = item.dataset.url;
      updatePlatformIcon();
      urlInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      handleAnalyze();
    })
  );
}

function initHistoryControls() {
  const btnClear = $('#btn-clear-history');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      clearHistory();
      renderHistory();
    });
  }
}

/* =============================================================================
   8. FAQ (accordéon)
   ========================================================================== */
function initFaq() {
  $$('.faq-item').forEach((item) => {
    const btn = $('.faq-question', item);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      // Ferme les autres (comportement accordéon).
      $$('.faq-item').forEach((other) => {
        other.classList.remove('open');
        $('.faq-question', other)?.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/* =============================================================================
   9. ANIMATIONS À L'APPARITION (IntersectionObserver)
   ========================================================================== */
function initReveal() {
  const els = $$('.reveal');
  if (!('IntersectionObserver' in window) || !els.length) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          obs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((el) => obs.observe(el));
}

/* =============================================================================
   10. ANNÉE DYNAMIQUE (footer)
   ========================================================================== */
function initYear() {
  const y = $('#year');
  if (y) y.textContent = String(new Date().getFullYear());
}

/* =============================================================================
   Helpers
   ========================================================================== */
function flashHint(msg) {
  const hint = $('#tool-hint-text');
  if (!hint) return;
  const original = hint.textContent;
  hint.textContent = msg;
  setTimeout(() => {
    hint.textContent = original;
  }, 4000);
}

function escapeAttr(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (_e) {
    return null;
  }
}
function safeSet(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch (_e) {
    /* ignore */
  }
}

/* =============================================================================
   INITIALISATION
   ========================================================================== */
function init() {
  initTheme();
  initNav();
  initFaq();
  initReveal();
  initYear();
  initHistoryControls();
  renderHistory();

  if (urlInput) {
    urlInput.addEventListener('input', updatePlatformIcon);
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleAnalyze();
    });
  }
  if (btnAnalyze) btnAnalyze.addEventListener('click', handleAnalyze);
  if (btnPaste) btnPaste.addEventListener('click', handlePaste);
}

document.addEventListener('DOMContentLoaded', init);
