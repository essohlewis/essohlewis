/* =====================================================================
   live.js — Moteur de matchs en direct (simulation temps réel)
   ---------------------------------------------------------------------
   Fait avancer les matchs "live" : minute de jeu, buts aléatoires, puis
   résolution automatique du pronostic (gagné/perdu) à la fin du match.
   Émet des événements (pub/sub) écoutés par le dashboard, le bankroll et
   les notifications.
   👉 POINT DE BRANCHEMENT : remplacer le `tick()` simulé par un flux réel
      (WebSocket / Server-Sent Events / polling d'une API de scores live).
   ===================================================================== */
(function () {
  const TICK_MS = 4000;      // cadence de rafraîchissement
  const MIN_PER_TICK = 2;    // minutes de jeu ajoutées par tick (accéléré)
  const GOAL_CHANCE = 0.14;  // probabilité d'un but par tick et par match
  const FULL_TIME = 90;

  const Live = {
    _subs: {},
    _preds: [],
    _timer: null,

    on(evt, cb) { (this._subs[evt] = this._subs[evt] || []).push(cb); return this; },
    emit(evt, data) { (this._subs[evt] || []).forEach((cb) => { try { cb(data); } catch (e) { /* noop */ } }); },

    /* Démarre le moteur sur la liste de pronostics fournie (référence partagée). */
    init(predictions) {
      this._preds = predictions;
      this.stop();
      // Ne ticker que s'il reste des matchs en direct
      if (predictions.some((p) => p.status === 'live')) {
        this._timer = setInterval(() => this.tick(), TICK_MS);
      }
    },

    stop() { if (this._timer) { clearInterval(this._timer); this._timer = null; } },

    /* Détermine si le pronostic est gagné selon le score final. */
    evaluate(p) {
      const s = p.live || p.score || { homeScore: 0, awayScore: 0 };
      const h = s.homeScore, a = s.awayScore, total = h + a;
      switch (p.prediction.key) {
        case 'home_win': return h > a;
        case 'away_win': return a > h;
        case 'draw': return h === a;
        case 'over25': return total >= 3;
        case 'over_pts': return total >= 3;   // proxy pour la démo
        case 'btts': return h > 0 && a > 0;
        default: return h >= a;
      }
    },

    tick() {
      let anyLive = false;
      this._preds.forEach((p) => {
        if (p.status !== 'live' || !p.live) return;
        anyLive = true;

        p.live.minute = Math.min(FULL_TIME, p.live.minute + MIN_PER_TICK);

        // But ?
        if (Math.random() < GOAL_CHANCE && p.live.minute < FULL_TIME) {
          const homeGoal = Math.random() < 0.55; // léger avantage domicile
          if (homeGoal) p.live.homeScore++; else p.live.awayScore++;
          this.emit('goal', { pred: p, home: homeGoal });
        }

        // Fin du match → résolution
        if (p.live.minute >= FULL_TIME) {
          const won = this.evaluate(p);
          p.status = won ? 'won' : 'lost';
          p.score = { home: p.live.homeScore, away: p.live.awayScore };
          this.emit('resolved', { pred: p, won });
        }

        this.emit('update', { pred: p });
      });

      if (!anyLive) this.stop();
    },
  };

  window.PronosLive = Live;
})();
