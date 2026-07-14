/* Conteo — Narration <audio> + synchronisation karaoké.
 * Piloté par requestAnimationFrame sur audio.currentTime ; recherche
 * dichotomique du mot courant (un conte N3 peut dépasser 1500 mots).
 * Ne JAMAIS utiliser setInterval pour la synchro. */

export class Narrator {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.timings = null;       // { words: [{w,s,e,p}] }
    this.currentIndex = -1;
    this.rafId = 0;
    this.onWord = null;        // (index, word) => void
    this.onPage = null;        // (pageNumber) => void
    this.onEnd = null;
    this._lastPage = -1;
    this.audio.addEventListener('ended', () => { this._stopLoop(); this.onEnd?.(); });
  }

  /* Charge une source avec fallback (.m4a iOS). */
  load({ primary, fallback, preferFallback }, timings) {
    this.timings = timings;
    this.currentIndex = -1;
    this._lastPage = -1;
    const src = preferFallback && fallback ? fallback : primary;
    this.audio.src = src || '';
    if (fallback && src !== fallback) {
      this.audio.onerror = () => {
        if (this.audio.src !== new URL(fallback, location.href).href) {
          this.audio.src = fallback;
        }
      };
    }
    this.audio.load();
  }

  play() {
    const p = this.audio.play();
    if (p?.catch) p.catch(() => {/* geste requis / source absente */});
    this._startLoop();
  }
  pause() { this.audio.pause(); this._stopLoop(); }
  toggle() { return this.audio.paused ? (this.play(), true) : (this.pause(), false); }
  get paused() { return this.audio.paused; }

  seek(t) { try { this.audio.currentTime = Math.max(0, t); } catch {} }
  setRate(r) { this.audio.playbackRate = r; }
  setVolume(v) { this.audio.volume = v; }

  /* Rejoue la phrase courante = revient au début du mot courant. */
  replaySentence() {
    if (!this.timings?.words?.length) { this.seek(Math.max(0, this.audio.currentTime - 3)); this.play(); return; }
    const page = this._pageAt(this.audio.currentTime);
    const first = this.timings.words.find((w) => w.p === page);
    if (first) { this.seek(first.s); this.play(); }
  }

  _pageAt(t) {
    if (!this.timings?.words?.length) return 1;
    const i = binarySearch(this.timings.words, t);
    return this.timings.words[Math.max(0, i)]?.p ?? 1;
  }

  _startLoop() {
    cancelAnimationFrame(this.rafId);
    const loop = () => {
      const t = this.audio.currentTime;
      if (this.timings?.words?.length) {
        const i = binarySearch(this.timings.words, t);
        if (i !== this.currentIndex) {
          this.currentIndex = i;
          const w = this.timings.words[i];
          this.onWord?.(i, w);
          if (w && w.p !== this._lastPage) { this._lastPage = w.p; this.onPage?.(w.p); }
        }
      }
      if (!this.audio.paused) this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }
  _stopLoop() { cancelAnimationFrame(this.rafId); this.rafId = 0; }

  destroy() {
    this._stopLoop();
    this.audio.pause();
    this.audio.src = '';
    this.audio.load();
  }
}

/* Recherche dichotomique : plus grand index tel que word.s <= t. */
export function binarySearch(words, t) {
  let lo = 0, hi = words.length - 1, res = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].s <= t) { res = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return res;
}
