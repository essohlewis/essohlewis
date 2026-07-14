/* Conteo — Lecteur de conte : pagination, narration, karaoké, hotspots.
 * Renvoie une fonction de nettoyage (arrêt audio + rAF) au routeur. */

import { el, mount, clear, toast } from '../../core/dom.js';
import { navigate } from '../../core/router.js';
import { store } from '../../core/store.js';
import { loadCatalog, getTale } from '../../content/catalog.js';
import { loadManifest, loadTimings, resolveAudio } from '../../content/manifest.js';
import { Narrator } from '../../audio/narrator.js';
import { SpeechNarrator, speechAvailable, tokenize } from '../../audio/speech.js';
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

  // Narration de repli (synthèse vocale) — le texte des contes est en français.
  const speech = speechAvailable() ? new SpeechNarrator('fr-FR') : null;
  // On bascule en synthèse vocale si l'audio enregistré est absent/illisible.
  let useTTS = !audioSrc?.primary;

  let pageIndex = 0;
  let speedIdx = 1;
  let narrationOn = true;
  let wantPlaying = false;   // intention utilisateur (lecture en cours souhaitée)

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
    renderCaption(page);
    renderDots();
    prevBtn.disabled = pageIndex === 0;
  }

  function renderDots() {
    clear(dots);
    pages.forEach((_, i) => dots.append(el('i', { class: i === pageIndex ? 'on' : '' })));
  }

  // Rend le texte de la page en mots karaoké.
  // - Mode audio (timings présents) : indices alignés sur les timings.
  // - Mode synthèse vocale : découpe par caractère (data-cs = index de début).
  function renderCaption(page) {
    if (level === 'N1') { caption.textContent = ''; return; }
    clear(caption);
    const pageWords = !useTTS ? words.filter((w) => w.p === page.index) : [];
    if (pageWords.length) {
      pageWords.forEach((w) => {
        const globalIdx = words.indexOf(w);
        const span = el('span', { class: 'kw', text: w.w + ' ' });
        span.dataset.gi = globalIdx;
        caption.append(span);
      });
    } else if (page.text) {
      // Découpe caractère par caractère pour la synthèse vocale (ou repli sans timings).
      tokenize(page.text).forEach((tk) => {
        const span = el('span', { class: 'kw', text: tk.word + ' ' });
        span.dataset.cs = tk.start;
        span.dataset.ce = tk.end;
        caption.append(span);
      });
    }
  }

  // ---- Synchronisation karaoké (mode audio, par index de mot) ----
  narrator.onWord = (i) => {
    if (level === 'N1') return;
    caption.querySelectorAll('.kw').forEach((s) => {
      const gi = Number(s.dataset.gi);
      s.classList.toggle('kw--read', gi < i);
      s.classList.toggle('kw--active', gi === i);
    });
  };

  // ---- Surlignage (mode synthèse vocale, par index de caractère) ----
  function highlightByChar(charIndex) {
    if (level === 'N1') return;
    caption.querySelectorAll('.kw').forEach((s) => {
      const cs = Number(s.dataset.cs), ce = Number(s.dataset.ce);
      s.classList.toggle('kw--read', ce <= charIndex);
      s.classList.toggle('kw--active', cs <= charIndex && charIndex < ce);
    });
  }
  narrator.onPage = (p) => {
    const idx = pages.findIndex((pg) => pg.index === p);
    if (idx >= 0 && idx !== pageIndex) { pageIndex = idx; renderPage(); }
  };
  narrator.onEnd = () => finishNarration();

  // Détection : si l'audio enregistré échoue à charger (404, format), on bascule
  // en synthèse vocale — automatiquement, y compris si la lecture est en cours.
  if (audioSrc?.primary) {
    narrator.load(audioSrc, timings);
    narrator.audio.addEventListener('error', () => {
      if (useTTS) return;
      useTTS = true;
      renderCaption(pages[pageIndex]);
      if (wantPlaying && narrationOn) startTTS(pageIndex);   // reprise transparente
    });
  }
  if (speech) { speech.setVolume(store.volume ?? 0.8); speech.onWord = highlightByChar; }

  // ---- Moteur synthèse vocale ----
  function startTTS(fromIndex) {
    if (!speech) { toast('Narration vocale indisponible ici', ''); wantPlaying = false; playBtn.textContent = '▶️'; return; }
    useTTS = true;
    wantPlaying = true;
    playBtn.textContent = '⏸️';
    speakPage(fromIndex);
  }
  function speakPage(idx) {
    if (idx >= pages.length) { finishNarration(); return; }
    if (idx !== pageIndex) { pageIndex = idx; renderPage(); } else { renderCaption(pages[idx]); }
    speech.setRate(SPEEDS[speedIdx]);
    speech.onWord = highlightByChar;
    speech.onEnd = () => { if (wantPlaying && !speech.paused) speakPage(pageIndex + 1); };
    speech.speak(pages[idx].text || '');
  }

  function finishNarration() {
    wantPlaying = false;
    playBtn.textContent = '▶️';
    saveProgress(true);
    if ((manifest.games || []).length && level !== 'N1') setTimeout(() => showGames(), 600);
  }

  // ---- Contrôles unifiés (audio OU synthèse vocale) ----
  function togglePlay() {
    if (!narrationOn) { toast('Narration désactivée', ''); return; }
    const audioBroken = useTTS || narrator.audio.error || narrator.audio.networkState === 3;

    if (audioBroken) {
      if (wantPlaying) { wantPlaying = false; speech?.pause(); playBtn.textContent = '▶️'; }
      else if (speech?.paused) { wantPlaying = true; speech.resume(); playBtn.textContent = '⏸️'; }
      else startTTS(pageIndex);
      return;
    }
    // Mode audio enregistré.
    wantPlaying = !narrator.paused ? false : true;
    const playing = narrator.toggle();
    wantPlaying = playing;
    playBtn.textContent = playing ? '⏸️' : '▶️';
  }

  playBtn.addEventListener('pointerup', () => { uiTone('tap'); togglePlay(); });
  prevBtn.addEventListener('pointerup', () => { if (pageIndex > 0) goToPage(pageIndex - 1); });
  nextBtn.addEventListener('pointerup', () => {
    if (pageIndex < pages.length - 1) goToPage(pageIndex + 1);
    else finishNarration();
  });
  replayBtn.addEventListener('pointerup', () => {
    uiTone('tap');
    if (useTTS) startTTS(pageIndex);
    else { narrator.replaySentence(); wantPlaying = true; playBtn.textContent = '⏸️'; }
  });
  speedBtn.addEventListener('pointerup', () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    narrator.setRate(SPEEDS[speedIdx]);
    speech?.setRate(SPEEDS[speedIdx]);
    speedBtn.textContent = SPEEDS[speedIdx] + '×';
    if (useTTS && wantPlaying) startTTS(pageIndex);   // la vitesse s'applique au prochain énoncé
  });
  narrBtn.addEventListener('pointerup', () => {
    narrationOn = !narrationOn;
    narrBtn.textContent = narrationOn ? '🔊' : '🔇';
    if (!narrationOn) { stopNarration(); playBtn.textContent = '▶️'; }
  });

  // Change de page en respectant le moteur courant.
  function goToPage(idx) {
    pageIndex = idx;
    renderPage();
    if (useTTS) { if (wantPlaying) startTTS(idx); }
    else { seekToPage(); }
  }
  function stopNarration() {
    wantPlaying = false;
    if (!narrator.paused) narrator.pause();
    speech?.cancel();
  }

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
  function cleanup() { speech?.cancel(); narrator.destroy(); saveProgress(false); }

  renderPage();
  // Reprise à la dernière page lue.
  const prevProg = await get('progress', [profile.id, tale.slug]);
  if (prevProg?.last_page && prevProg.last_page <= pages.length && !prevProg.completed) {
    pageIndex = prevProg.last_page - 1; renderPage();
  }

  mount(root);
  return cleanup;   // le routeur l'appellera à la navigation suivante
}
