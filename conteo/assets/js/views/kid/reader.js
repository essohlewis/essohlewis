/* Conteo — Lecteur de conte : pagination, narration, karaoké, hotspots.
 * Renvoie une fonction de nettoyage (arrêt audio + rAF) au routeur. */

import { el, mount, clear, toast } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { store } from '../../core/store.js';
import { loadCatalog, getTale } from '../../content/catalog.js';
import { loadManifest, loadTimings, resolveAudio } from '../../content/manifest.js';
import { Narrator } from '../../audio/narrator.js';
import { buildHotspotOverlay } from './hotspots.js';
import { coverImg } from './library.js';
import { preload as preloadSfx, uiTone } from '../../audio/sfx.js';
import { get, put } from '../../core/db.js';
import { t } from '../../core/i18n.js';
import { gamesView } from './games.js';

const SPEEDS = [0.75, 1, 1.25];

export async function readerView({ slug }) {
  const profile = store.activeProfile;
  if (!profile) return navigate('/pick', { replace: true });

  const catalog = await loadCatalog();
  const tale = getTale(catalog, slug);
  if (!tale) { toast('Conte introuvable', 'err'); return navigate('/library', { replace: true }); }

  const level = profile.reading_level;
  const lang = profile.narration_lang || 'fr';

  let manifest;
  try { manifest = await loadManifest(tale, level); }
  catch { toast('Ce conte n’est pas encore disponible hors-ligne.', 'err'); return navigate('/library', { replace: true }); }

  const pages = manifest.pages || [];
  const narrator = new Narrator();
  narrator.setVolume(store.volume ?? 0.8);
  const audioSrc = resolveAudio(manifest, lang);
  const timings = await loadTimings(manifest, lang);
  const words = timings?.words || [];
  const discovered = new Set();

  let pageIndex = 0;
  let speedIdx = 1;
  let narrationOn = true;

  // Précharge les SFX de la page courante.
  const preloadPageSfx = (p) => preloadSfx((p.hotspots || []).map((h) => h.sfx));

  // DOM
  const stage = el('div', { class: 'reader__stage' });
  const caption = el('p', { class: 'reader__caption' });
  const dots = el('div', { class: 'reader__page-dots', 'aria-hidden': 'true' });

  const playBtn = el('button', { class: 'icon-btn icon-btn--play', 'aria-label': t('play'), text: '▶️' });
  const prevBtn = el('button', { class: 'icon-btn', 'aria-label': t('prev'), text: '⏮️' });
  const nextBtn = el('button', { class: 'icon-btn', 'aria-label': t('next'), text: '⏭️' });
  const replayBtn = el('button', { class: 'icon-btn', 'aria-label': t('replay_sentence'), text: '🔁' });
  const speedBtn = el('button', { class: 'speed-pill', 'aria-label': 'Vitesse', text: '1×' });
  const narrBtn = el('button', { class: 'icon-btn', 'aria-label': 'Narration', text: '🔊' });

  const root = el('section', {
    class: 'kid reader' + (level === 'N1' ? ' reader--n1' : '')
  }, [
    el('div', { class: 'reader__topbar' }, [
      el('button', { class: 'icon-btn', 'aria-label': t('back'), text: '←',
        onpointerup: () => navigate('/library') }),
      el('strong', { style: { flex: '1' }, text: tale.title }),
      dots
    ]),
    stage,
    caption,
    el('div', { class: 'reader__bar' }, [prevBtn, replayBtn, playBtn, narrBtn, nextBtn, speedBtn])
  ]);

  // ---- Rendu d'une page ----
  function renderPage() {
    const page = pages[pageIndex];
    clear(stage);
    const img = coverImg(page.image, 'reader__img');
    stage.append(img);
    stage.append(buildHotspotOverlay(page, {
      lang,
      onDiscover: (id) => {
        const label = (page.hotspots.find((h) => h.id === id)?.label || id).replace(/^l[ea']\s*/i, '');
        discovered.add(label.trim());
      }
    }));
    preloadPageSfx(page);
    renderCaption(page, -1);
    renderDots();
    prevBtn.disabled = pageIndex === 0;
  }

  function renderDots() {
    clear(dots);
    pages.forEach((_, i) => dots.append(el('i', { class: i === pageIndex ? 'on' : '' })));
  }

  // Découpe le texte en mots pour le karaoké (indices alignés sur les timings de la page).
  function renderCaption(page, activeWordIdx) {
    if (level === 'N1') { caption.textContent = ''; return; }
    clear(caption);
    const pageWords = words.filter((w) => w.p === (page.index));
    if (pageWords.length) {
      // On mappe l'index global du mot actif vers l'index local de la page.
      pageWords.forEach((w, i) => {
        const globalIdx = words.indexOf(w);
        const span = el('span', { class: 'kw', text: w.w + ' ' });
        if (globalIdx < activeWordIdx) span.classList.add('kw--read');
        if (globalIdx === activeWordIdx) span.classList.add('kw--active');
        span.dataset.gi = globalIdx;
        caption.append(span);
      });
    } else {
      caption.textContent = page.text || '';
    }
  }

  // ---- Synchronisation karaoké ----
  narrator.onWord = (i) => {
    if (level === 'N1') return;
    const spans = caption.querySelectorAll('.kw');
    spans.forEach((s) => {
      const gi = Number(s.dataset.gi);
      s.classList.toggle('kw--read', gi < i);
      s.classList.toggle('kw--active', gi === i);
    });
  };
  narrator.onPage = (p) => {
    const idx = pages.findIndex((pg) => pg.index === p);
    if (idx >= 0 && idx !== pageIndex) { pageIndex = idx; renderPage(); }
  };
  narrator.onEnd = () => {
    playBtn.textContent = '▶️';
    saveProgress(true);
    if ((manifest.games || []).length && level !== 'N1') {
      setTimeout(() => showGames(), 600);
    }
  };

  // ---- Contrôles ----
  function togglePlay() {
    if (!narrationOn) { toast('Narration désactivée', ''); return; }
    if (!audioSrc?.primary) { toast('Audio indisponible ici', ''); return; }
    if (narrator.audio.readyState === 0 && !narrator.audio.src) {
      narrator.load(audioSrc, timings);
    }
    const playing = narrator.toggle();
    playBtn.textContent = playing ? '⏸️' : '▶️';
  }

  playBtn.addEventListener('pointerup', () => { uiTone('tap'); togglePlay(); });
  prevBtn.addEventListener('pointerup', () => { if (pageIndex > 0) { pageIndex--; renderPage(); seekToPage(); } });
  nextBtn.addEventListener('pointerup', () => {
    if (pageIndex < pages.length - 1) { pageIndex++; renderPage(); seekToPage(); }
    else { saveProgress(true); if ((manifest.games || []).length && level !== 'N1') showGames(); }
  });
  replayBtn.addEventListener('pointerup', () => { uiTone('tap'); narrator.replaySentence(); playBtn.textContent = '⏸️'; });
  speedBtn.addEventListener('pointerup', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    narrator.setRate(SPEEDS[speedIdx]);
    speedBtn.textContent = SPEEDS[speedIdx] + '×';
  });
  narrBtn.addEventListener('pointerup', () => {
    narrationOn = !narrationOn;
    narrBtn.textContent = narrationOn ? '🔊' : '🔇';
    if (!narrationOn && !narrator.paused) { narrator.pause(); playBtn.textContent = '▶️'; }
  });

  function seekToPage() {
    const page = pages[pageIndex];
    const first = words.find((w) => w.p === page.index);
    if (first) narrator.seek(first.s);
  }

  async function saveProgress(completed) {
    const key = [profile.id, tale.slug];
    const prev = await get('progress', key);
    await put('progress', {
      profile_id: profile.id, tale_slug: tale.slug, level,
      last_page: pageIndex + 1,
      completed: completed || prev?.completed || false,
      completed_count: (prev?.completed_count || 0) + (completed ? 1 : 0),
      quiz_score: prev?.quiz_score || 0,
      words_discovered: [...new Set([...(prev?.words_discovered || []), ...discovered])],
      last_read_at: Date.now()
    });
  }

  function showGames() {
    cleanup();
    gamesView({ tale, manifest, level, profile });
  }

  // ---- Cycle de vie ----
  function cleanup() { narrator.destroy(); saveProgress(false); }

  renderPage();
  // Reprise à la dernière page lue.
  const prevProg = await get('progress', [profile.id, tale.slug]);
  if (prevProg?.last_page && prevProg.last_page <= pages.length && !prevProg.completed) {
    pageIndex = prevProg.last_page - 1; renderPage();
  }

  mount(root);
  return cleanup;   // le routeur l'appellera à la navigation suivante
}
