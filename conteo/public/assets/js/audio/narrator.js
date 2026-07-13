/**
 * CONTEO — Narrateur : lecture audio + surlignage karaoké mot-à-mot.
 *
 * Utilise <audio> HTML5 (fiable hors-ligne via Cache API) et un fichier de
 * timings JSON (word-level) pour synchroniser le surlignage. Prend en charge
 * le repli iOS (.m4a) et la vitesse ajustable.
 */

export class Narrator {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.timings = null;         // { words: [{w,start,end,page}] }
    this.wordEls = [];           // éléments DOM des mots de la page courante
    this.currentPage = 1;
    this.onPageWordUpdate = null;
    this.onEnded = null;
    this._raf = null;

    this.audio.addEventListener('ended', () => {
      this._stopLoop();
      if (this.onEnded) this.onEnded();
    });
  }

  /**
   * Charge une piste. Choisit .m4a sur iOS/Safari si l'opus n'est pas supporté.
   */
  async load(audioUrl, audioUrlFb, timingsUrl) {
    const canOpus = this.audio.canPlayType('audio/ogg; codecs="opus"') !== '';
    this.audio.src = canOpus ? audioUrl : (audioUrlFb || audioUrl);
    try {
      const res = await fetch(timingsUrl);
      this.timings = await res.json();
    } catch {
      this.timings = { words: [] };
    }
  }

  setRate(rate) { this.audio.playbackRate = rate; }

  /** Associe les éléments-mots DOM d'une page pour le surlignage. */
  bindPageWords(page, wordEls) {
    this.currentPage = page;
    this.wordEls = wordEls;
  }

  play() {
    const p = this.audio.play();
    this._startLoop();
    return p;
  }

  pause() {
    this.audio.pause();
    this._stopLoop();
  }

  get paused() { return this.audio.paused; }

  /** Rejoue la phrase courante (recule au début du 1er mot de la page). */
  replaySentence() {
    const first = (this.timings?.words || []).find((w) => w.page === this.currentPage);
    if (first) this.audio.currentTime = first.start;
    this.play();
  }

  /** Positionne la lecture au début d'une page (via timings). */
  seekToPage(page) {
    const first = (this.timings?.words || []).find((w) => w.page === page);
    this.audio.currentTime = first ? first.start : 0;
  }

  _startLoop() {
    this._stopLoop();
    const tick = () => {
      this._highlight();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _stopLoop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  _highlight() {
    if (!this.timings || !this.wordEls.length) return;
    const t = this.audio.currentTime;
    const pageWords = this.timings.words.filter((w) => w.page === this.currentPage);
    let activeIndex = -1;
    for (let i = 0; i < pageWords.length; i++) {
      if (t >= pageWords[i].start && t < pageWords[i].end) { activeIndex = i; break; }
    }
    this.wordEls.forEach((elm, i) => elm.classList.toggle('active', i === activeIndex));
  }

  destroy() {
    this._stopLoop();
    this.audio.pause();
    this.audio.src = '';
  }
}
