/* =============================================================================
   ui.js — Rendu dynamique de l'outil de téléchargement
   Fonctions pures de génération de HTML + petits helpers DOM. Aucun appel
   réseau ici (voir api.js) et aucun état global (voir app.js).
   ========================================================================== */

/* --- Icônes SVG des plateformes (monochromes, couleur via currentColor) --- */
export const PLATFORM_ICONS = {
  youtube: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.5 15.5v-7l6.3 3.5-6.3 3.5Z"/></svg>`,
  tiktok: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 3c.3 2 1.5 3.7 3.5 4.2v2.7a6.9 6.9 0 0 1-3.6-1v5.9a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.8a2.8 2.8 0 1 0 1.9 2.6V3h2.9Z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z"/></svg>`,
  twitter: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.2 2.5h3.3l-7.2 8.3 8.5 11.2h-6.7l-5.2-6.9-6 6.9H1.6l7.7-8.9L1.1 2.5h6.8l4.7 6.3 5.6-6.3Zm-1.2 17.8h1.8L7.1 4.3H5.2l11.8 16Z"/></svg>`,
  vimeo: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 7.4c-.1 2.2-1.6 5.3-4.6 9.2-3.1 4.1-5.7 6.2-7.9 6.2-1.3 0-2.5-1.3-3.4-3.8L5.3 12c-.7-2.5-1.4-3.8-2.2-3.8-.2 0-.7.3-1.6 1L.5 8c1-.9 2-1.8 3-2.7 1.3-1.2 2.4-1.8 3-1.9 1.6-.2 2.6.9 3 3.3.4 2.6.7 4.2.9 4.8.5 2.3 1 3.4 1.6 3.4.5 0 1.2-.7 2.1-2.2.9-1.4 1.4-2.5 1.5-3.3.1-1.1-.3-1.6-1.2-1.6-.4 0-.9.1-1.4.3 1-3 2.7-4.5 5.3-4.4 1.9.1 2.8 1.3 2.7 3.7Z"/></svg>`,
  dailymotion: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 2h3.6v7.1A5 5 0 0 1 10.5 7.4 5.2 5.2 0 0 1 16 12.8a5.2 5.2 0 0 1-5.4 5.4 5 5 0 0 1-4-1.8V18H3V2Zm6.7 12.9a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z"/></svg>`,
  autre: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.5 2.6 3.9 6 4 9.5-.1 3.5-1.5 6.9-4 9.5-2.5-2.6-3.9-6-4-9.5.1-3.5 1.5-6.9 4-9.5Z"/></svg>`,
};

export const PLATFORM_LABELS = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'X (Twitter)',
  vimeo: 'Vimeo',
  dailymotion: 'Dailymotion',
  autre: 'Autre',
};

/* --- Détection de plateforme côté client (pour le logo instantané) --- */
export function detectPlatform(url) {
  const u = (url || '').toLowerCase();
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
  if (/tiktok\.com/.test(u)) return 'tiktok';
  if (/instagram\.com/.test(u)) return 'instagram';
  if (/facebook\.com|fb\.watch/.test(u)) return 'facebook';
  if (/twitter\.com|x\.com/.test(u)) return 'twitter';
  if (/vimeo\.com/.test(u)) return 'vimeo';
  if (/dailymotion\.com|dai\.ly/.test(u)) return 'dailymotion';
  return null;
}

/* --- Petit utilitaire d'échappement HTML (anti-XSS pour titres/auteurs) --- */
export function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* --- Icônes utilitaires --- */
const ICON_DOWNLOAD = `<svg class="fc-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const ICON_MUSIC = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
const ICON_VIDEO = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>`;

/**
 * Rendu du squelette de chargement pendant l'analyse.
 * @returns {string} HTML
 */
export function renderSkeleton() {
  return `
    <div class="glass skeleton-card" role="status" aria-live="polite">
      <span class="sr-only">Analyse en cours…</span>
      <div class="skeleton-row">
        <div class="skeleton sk-thumb"></div>
        <div class="sk-lines">
          <div class="skeleton sk-line w-80"></div>
          <div class="skeleton sk-line w-40"></div>
          <div class="skeleton sk-line w-60"></div>
        </div>
      </div>
      <div class="sk-formats">
        ${Array.from({ length: 6 }).map(() => '<div class="skeleton sk-fmt"></div>').join('')}
      </div>
    </div>`;
}

/**
 * Rendu de la carte de résultats (métadonnées + formats).
 * @param {object} data données renvoyées par /api/info
 * @returns {string} HTML
 */
export function renderResult(data) {
  const platform = data.platform || 'autre';
  const icon = PLATFORM_ICONS[platform] || PLATFORM_ICONS.autre;
  const label = PLATFORM_LABELS[platform] || 'Autre';

  const thumb = data.thumbnail
    ? `<img src="${escapeHtml(data.thumbnail)}" alt="Miniature : ${escapeHtml(data.title)}" loading="lazy" />`
    : `<div style="display:grid;place-items:center;height:100%;color:var(--text-faint)">${ICON_VIDEO}</div>`;

  const duration = data.durationLabel
    ? `<span class="result-duration">${escapeHtml(data.durationLabel)}</span>`
    : '';

  const videoCards = (data.formats.video || [])
    .map((f) => formatCard(f, data))
    .join('');
  const audioCards = (data.formats.audio || [])
    .map((f) => formatCard(f, data))
    .join('');

  const videoSection = videoCards
    ? `<div class="format-group-title">${ICON_VIDEO} Vidéo (MP4)</div>
       <div class="format-grid">${videoCards}</div>`
    : '';
  const audioSection = audioCards
    ? `<div class="format-group-title">${ICON_MUSIC} Audio seul</div>
       <div class="format-grid">${audioCards}</div>`
    : '';

  return `
    <div class="glass result-card">
      <div class="result-media">
        <div class="result-thumb">${thumb}${duration}</div>
        <div class="result-info">
          <div class="result-title">${escapeHtml(data.title)}</div>
          <div class="result-meta">
            <span class="result-platform-tag">${icon} ${escapeHtml(label)}</span>
            <span>${authorIcon()} ${escapeHtml(data.author)}</span>
          </div>
        </div>
      </div>
      ${videoSection}
      ${audioSection}
      <div class="progress-wrap hidden" data-progress></div>
      <div data-inline-error></div>
    </div>`;
}

/**
 * Génère une carte cliquable pour un format.
 * @param {object} f format normalisé
 * @param {object} data contexte (url, title)
 * @returns {string} HTML
 */
function formatCard(f, data) {
  const size = f.filesizeLabel ? `<span class="fc-size">${escapeHtml(f.filesizeLabel)}</span>` : '<span class="fc-size">—</span>';
  const badge = f.ext ? `<span class="fc-badge">${escapeHtml(f.ext.toUpperCase())}</span>` : '';
  const label = f.label || `${f.height || ''}p`;
  const downloadId = f.type === 'audio' ? f.formatId : f.mergedFormatId || f.formatId;

  return `
    <button
      class="format-card"
      type="button"
      data-format-id="${escapeHtml(downloadId)}"
      data-source-format-id="${escapeHtml(f.sourceFormatId || '')}"
      data-label="${escapeHtml(label)}"
      aria-label="Télécharger en ${escapeHtml(label)} ${escapeHtml(f.ext || '')}">
      <span class="fc-label">${escapeHtml(label)} ${badge}</span>
      ${size}
      ${ICON_DOWNLOAD}
    </button>`;
}

function authorIcon() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
}

/**
 * Rendu d'une boîte d'erreur.
 * @param {string} message message utilisateur
 * @returns {string} HTML
 */
export function renderError(message) {
  return `
    <div class="glass error-box" role="alert">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <div>
        <strong>Oups, une erreur est survenue</strong>
        <p>${escapeHtml(message)}</p>
      </div>
    </div>`;
}

/**
 * Rendu de la barre de progression avec les 3 étapes.
 * @param {'analyse'|'preparation'|'telechargement'|'termine'} phase
 * @param {string} [labelText]
 * @returns {string} HTML
 */
export function renderProgress(phase, labelText) {
  const order = ['analyse', 'preparation', 'telechargement'];
  const currentIndex = order.indexOf(phase);
  const steps = [
    { key: 'analyse', label: 'Analyse' },
    { key: 'preparation', label: 'Préparation' },
    { key: 'telechargement', label: 'Téléchargement' },
  ]
    .map((s, i) => {
      let cls = 'step';
      if (phase === 'termine' || i < currentIndex) cls += ' done';
      else if (i === currentIndex) cls += ' active';
      return `<span class="${cls}">${s.label}</span>`;
    })
    .join('');

  const barClass = phase === 'termine' ? 'progress-bar' : 'progress-bar indeterminate';
  const width = phase === 'termine' ? 'style="width:100%"' : '';
  const defaultLabel = {
    analyse: 'Analyse de la vidéo…',
    preparation: 'Préparation du fichier…',
    telechargement: 'Téléchargement en cours… (ne fermez pas cette page)',
    termine: 'Téléchargement lancé ! Vérifiez vos fichiers.',
  }[phase];

  return `
    <div class="progress-steps">${steps}</div>
    <div class="progress-track">
      <div class="${barClass}" ${width}></div>
    </div>
    <div class="progress-label">${escapeHtml(labelText || defaultLabel)}</div>`;
}
