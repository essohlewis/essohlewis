/* Conteo — Narration de repli par synthèse vocale (Web Speech API).
 *
 * Prend le relais quand la narration audio enregistrée (.opus/.m4a) n'est pas
 * disponible (fichier absent, hors-ligne sans pack, 404 en dev). Fonctionne
 * hors-ligne avec les voix embarquées du système. Le surlignage karaoké est
 * piloté par l'événement `boundary` (position du caractère dans le texte).
 *
 * Note : la disponibilité et la qualité des voix dépendent de l'OS/navigateur.
 * `boundary` n'est pas garanti partout — en son absence, on estime la
 * progression mot à mot par une horloge (rAF) calée sur la durée de l'énoncé. */

export function speechAvailable() {
  return typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof window.SpeechSynthesisUtterance !== 'undefined';
}

export class SpeechNarrator {
  constructor(lang = 'fr-FR') {
    this.lang = lang;
    this.rate = 1;
    this.volume = 1;
    this.onWord = null;   // (charIndex:number) => void
    this.onEnd = null;    // () => void  (énoncé terminé, non annulé)
    this.voice = null;
    this._utter = null;
    this._paused = false;
    this._cancelled = false;
    this._ended = false;
    this._rafId = 0;
    this._endTimer = 0;
    this._pickVoice();
    if (speechAvailable()) {
      // Les voix peuvent se charger de façon asynchrone.
      window.speechSynthesis.onvoiceschanged = () => this._pickVoice();
    }
  }

  _pickVoice() {
    if (!speechAvailable()) return;
    const voices = window.speechSynthesis.getVoices() || [];
    const code = this.lang.slice(0, 2).toLowerCase();
    this.voice =
      voices.find((v) => v.lang?.toLowerCase().startsWith(this.lang.toLowerCase())) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith(code)) ||
      voices[0] || null;
  }

  setRate(r) { this.rate = r; }
  setVolume(v) { this.volume = v; }
  get paused() { return this._paused; }
  get speaking() { return speechAvailable() && window.speechSynthesis.speaking; }

  /* Lit un texte. Émet onWord(charIndex) puis onEnd() une seule fois. */
  speak(text) {
    if (!speechAvailable() || !text) { this.onEnd?.(); return false; }
    const synth = window.speechSynthesis;
    synth.cancel();
    this._stopClock();
    clearTimeout(this._endTimer);
    this._cancelled = false;
    this._paused = false;
    this._ended = false;

    const start = performance.now();
    const estTotal = estimatedMs(text, this.rate);

    // finalize(fromClock) : termine l'énoncé une seule fois. Un `onend` natif
    // implausiblement précoce (voix absente/cassée qui « termine » en 0 ms) est
    // ignoré — l'horloge estimée assure alors un rythme de lecture correct.
    const finalize = (fromClock = false) => {
      if (this._ended || this._cancelled) return;
      if (!fromClock && (performance.now() - start) < estTotal * 0.5) return;
      this._ended = true;
      this._stopClock();
      clearTimeout(this._endTimer);
      this.onWord?.(text.length);
      this.onEnd?.();
    };

    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = this.lang;
    if (this.voice) u.voice = this.voice;
    u.rate = this.rate;
    u.volume = this.volume;
    u.pitch = 1.05;         // voix légèrement plus douce pour les enfants

    let gotBoundary = false;
    u.onboundary = (e) => {
      if (e.name && e.name !== 'word') return;
      gotBoundary = true;
      this._stopClock();     // on a de vrais événements : pas besoin de l'estimation
      if (typeof e.charIndex === 'number') this.onWord?.(e.charIndex);
    };
    u.onend = () => finalize(false);
    u.onerror = () => { if (!this._cancelled) finalize(false); };

    this._utter = u;
    // Certaines plateformes lèvent une exception si aucune voix n'est chargée :
    // on ne bloque jamais le lecteur — l'horloge de secours prend le relais.
    try { synth.speak(u); } catch { /* repli sur l'horloge */ }

    // Repli : estimation du surlignage + garantie de fin même si `onend`/`boundary`
    // ne se déclenchent pas (Safari, certaines voix mobiles, environnements headless).
    this._startClock(text, estTotal, () => gotBoundary, finalize);
    return true;
  }

  /* Horloge de secours : avance le surlignage à vitesse ~ constante et garantit
     la fin de l'énoncé si les événements natifs ne se déclenchent pas. */
  _startClock(text, total, boundarySeen, finalize) {
    const words = tokenize(text);
    if (!words.length) return;
    const start = performance.now();
    let pausedMs = 0, pauseStart = 0;
    const tick = () => {
      if (this._cancelled) return;
      if (this._paused) { if (!pauseStart) pauseStart = performance.now(); this._rafId = requestAnimationFrame(tick); return; }
      if (pauseStart) { pausedMs += performance.now() - pauseStart; pauseStart = 0; }
      const elapsed = performance.now() - start - pausedMs;
      const ratio = Math.min(1, elapsed / total);
      if (!boundarySeen()) {
        const idx = Math.min(words.length - 1, Math.floor(ratio * words.length));
        this.onWord?.(words[idx].start);
      }
      if (ratio < 1) this._rafId = requestAnimationFrame(tick);
      else {
        // Fin estimée atteinte : si `onend` n'est pas déjà arrivé, on finalise
        // après un court délai de grâce (évite un blocage sur la page).
        this._endTimer = setTimeout(() => { if (!this.speaking) finalize?.(true); }, 500);
      }
    };
    this._rafId = requestAnimationFrame(tick);
  }
  _stopClock() { cancelAnimationFrame(this._rafId); this._rafId = 0; }

  pause() {
    if (!speechAvailable()) return;
    this._paused = true;
    try { window.speechSynthesis.pause(); } catch {}
  }
  resume() {
    if (!speechAvailable()) return;
    this._paused = false;
    try { window.speechSynthesis.resume(); } catch {}
  }
  cancel() {
    this._cancelled = true;
    this._paused = false;
    this._stopClock();
    clearTimeout(this._endTimer);
    if (speechAvailable()) { try { window.speechSynthesis.cancel(); } catch {} }
  }
}

/* Prononce un court texte, sans suivi (hotspots, mots isolés).
   Utilisé en repli quand l'audio du mot n'est pas disponible. */
export function speakOnce(text, { lang = 'fr-FR', volume = 1, rate = 1 } = {}) {
  if (!speechAvailable() || !text) return false;
  try {
    const synth = window.speechSynthesis;
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = lang; u.volume = volume; u.rate = rate; u.pitch = 1.05;
    const voices = synth.getVoices() || [];
    u.voice = voices.find((v) => v.lang?.toLowerCase().startsWith(lang.slice(0, 2))) || null;
    synth.speak(u);
    return true;
  } catch { return false; }
}

/* Durée estimée d'un énoncé (ms) — sert de rythme de secours. */
export function estimatedMs(text, rate = 1) {
  const n = tokenize(text).length;
  const wpm = 165 * rate;                         // mots/minute approx.
  return Math.max(700, (n / wpm) * 60 * 1000);    // plancher : jamais instantané
}

/* Découpe un texte en mots avec leur index de caractère de début. */
export function tokenize(text) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text)) !== null) out.push({ word: m[0], start: m.index, end: m.index + m[0].length });
  return out;
}
