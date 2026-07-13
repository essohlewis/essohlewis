/**
 * CONTEO — Lecteur de conte.
 *
 * Illustration plein écran + texte (masqué en N1) + narration audio avec
 * surlignage karaoké, hotspots tap-to-explore, contrôles tactiles ≥72px,
 * vitesse ajustable, mode narration off. Enregistre la progression (locale +
 * file de synchronisation).
 */

import { el, mount, clear, toast } from '../../utils/dom.js';
import { api } from '../../core/api.js';
import { db } from '../../core/db.js';
import { state } from '../../core/store.js';
import { navigate } from '../../core/router.js';
import { Narrator } from '../../audio/narrator.js';
import { renderHotspots } from './hotspots.js';
import { queueWrite } from '../../utils/sync.js';
import { blip, unlockAudio } from '../../audio/sfx.js';
import { renderGames } from './games.js';

export async function renderReader(slug) {
  unlockAudio();
  const profile = state.activeProfile;
  const level = profile?.reading_level || 'N2';
  const lang = profile?.narration_lang || 'fr';

  mount(el('div', { class: 'center-screen' }, [el('div', { class: 'spinner' })]));

  let detail, manifest;
  try {
    detail = await api.get(`/tales/${encodeURIComponent(slug)}?level=${level}&lang=${lang}`);
    const res = await fetch(detail.version.manifest_url);
    manifest = await res.json();
    await db.set(`manifest:${slug}:${level}`, manifest);
    await db.set(`detail:${slug}:${level}`, detail);
  } catch (err) {
    manifest = await db.get(`manifest:${slug}:${level}`);
    detail = await db.get(`detail:${slug}:${level}`);
    if (!manifest || !detail) {
      toast('Conte indisponible hors-ligne.');
      navigate('/');
      return;
    }
  }

  new ReaderView(detail, manifest, profile, lang).start();
}

class ReaderView {
  constructor(detail, manifest, profile, lang) {
    this.detail = detail;
    this.manifest = manifest;
    this.profile = profile;
    this.lang = lang;
    this.level = manifest.level || 'N2';
    this.pages = manifest.pages || [];
    this.index = 0;
    this.narrationOn = this.level !== 'N1' ? true : true;
    this.narrator = new Narrator();
  }

  async start() {
    const audio = this.detail.audio;
    if (audio) {
      await this.narrator.load(audio.audio_url, audio.audio_url_fb, audio.timings_url);
    }
    this.narrator.onEnded = () => this.finishTale();
    this.buildLayout();
    this.showPage(0);
  }

  buildLayout() {
    this.stage = el('div', { class: 'reader-stage' });
    this.textBar = el('div', { class: 'reader-text' });

    const btn = (cls, label, icon, on) =>
      el('button', { class: `rc-btn ${cls}`, 'aria-label': label, text: icon, onClick: on });

    this.playBtn = btn('play', 'Lecture/Pause', '⏸', () => this.togglePlay());

    this.controls = el('div', { class: 'reader-controls' }, [
      btn('', 'Quitter', '🏠', () => this.quit()),
      btn('', 'Page précédente', '◀', () => this.prev()),
      this.playBtn,
      btn('', 'Rejouer la phrase', '🔁', () => { blip(); this.narrator.replaySentence(); }),
      btn('', 'Page suivante', '▶', () => this.next()),
    ]);

    // Réglage vitesse + narration on/off
    this.speedBtn = btn('', 'Vitesse', '1×', () => this.cycleSpeed());
    const topbar = el('div', { class: 'reader-controls', style: 'justify-content:flex-end;background:transparent;position:absolute;top:0;right:0;left:0;z-index:5' }, [
      this.speedBtn,
      btn('', 'Narration', '🔊', () => this.toggleNarration()),
    ]);

    this.root = el('div', { class: 'reader' }, [
      el('div', { style: 'position:relative;flex:1;display:flex;flex-direction:column' }, [topbar, this.stage]),
      this.level === 'N1' ? null : this.textBar,
      this.controls,
    ]);
    mount(this.root);
  }

  showPage(i) {
    if (i < 0 || i >= this.pages.length) return;
    this.index = i;
    const page = this.pages[i];

    clear(this.stage);
    // <picture> avec AVIF prioritaire, repli WebP.
    const pic = el('picture');
    if (page.image_avif) pic.append(el('source', { srcset: page.image_avif, type: 'image/avif' }));
    pic.append(el('img', { class: 'page-img', alt: '', src: page.image }));
    this.stage.append(pic);

    // Texte + mots pour karaoké (N2/N3).
    if (this.level !== 'N1') {
      clear(this.textBar);
      const words = (page.text || '').split(/\s+/).filter(Boolean);
      const wordEls = words.map((w) => el('span', { class: 'w', text: w + ' ' }));
      wordEls.forEach((wEl) => this.textBar.append(wEl));
      this.narrator.bindPageWords(page.index, wordEls);
    } else {
      this.narrator.bindPageWords(page.index, []);
    }

    // Hotspots.
    renderHotspots(this.stage, page.hotspots, this.lang);

    // Narration : caler l'audio sur la page.
    if (this.detail.audio && this.narrationOn) {
      this.narrator.seekToPage(page.index);
      this.narrator.play().catch(() => {});
      this.playBtn.textContent = '⏸';
    }

    this.saveProgress(false);
  }

  togglePlay() {
    blip();
    if (this.narrator.paused) { this.narrator.play(); this.playBtn.textContent = '⏸'; }
    else { this.narrator.pause(); this.playBtn.textContent = '▶'; }
  }

  toggleNarration() {
    this.narrationOn = !this.narrationOn;
    if (!this.narrationOn) this.narrator.pause();
    else { this.narrator.seekToPage(this.pages[this.index].index); this.narrator.play(); }
    toast(this.narrationOn ? 'Narration activée' : 'Le parent lit');
  }

  cycleSpeed() {
    const speeds = [1, 1.25, 0.75];
    this._s = ((this._s ?? 0) + 1) % speeds.length;
    const rate = speeds[this._s];
    this.narrator.setRate(rate);
    this.speedBtn.textContent = `${rate}×`;
  }

  next() {
    blip();
    if (this.index < this.pages.length - 1) this.showPage(this.index + 1);
    else this.finishTale();
  }

  prev() { blip(); if (this.index > 0) this.showPage(this.index - 1); }

  async finishTale() {
    this.narrator.pause();
    await this.saveProgress(true);
    const games = this.manifest.games || [];
    if (games.length && this.level !== 'N1') {
      renderGames(this.manifest, this.profile, () => this.quit());
    } else {
      this.quit();
    }
  }

  async saveProgress(completed) {
    if (!this.profile) return;
    const payload = {
      child_id: this.profile.id,
      tale_id: this.detail.tale.id,
      level: this.level,
      last_page: this.pages[this.index]?.index || 0,
      completed,
      last_read_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    // Écriture locale d'abord, puis file de synchronisation.
    await db.saveProgress(this.profile.id, this.detail.tale.id, payload);
    await queueWrite('POST', '/progress', payload);
  }

  quit() {
    this.narrator.destroy();
    navigate('/');
  }
}
