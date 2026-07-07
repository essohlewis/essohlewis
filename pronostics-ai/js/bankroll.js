/* =====================================================================
   bankroll.js — Portefeuille virtuel & paris fictifs
   ---------------------------------------------------------------------
   Aucun argent réel : le solde et les paris sont stockés dans
   localStorage. L'utilisateur "mise" sur un pronostic ; le pari est
   réglé automatiquement quand le match est résolu (via l'événement
   'resolved' du moteur live, ou à la validation manuelle).
   ===================================================================== */
(function () {
  const KEY = 'pronos-bankroll';
  const START_BALANCE = 10000; // solde virtuel de départ (FCFA)

  const Bankroll = {
    _subs: [],
    on(cb) { this._subs.push(cb); return this; },
    emit() { const s = this.stats(); this._subs.forEach((cb) => { try { cb(s); } catch (e) {} }); },

    state() {
      let s;
      try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
      if (!s) { s = { balance: START_BALANCE, start: START_BALANCE, bets: [] }; this._save(s); }
      return s;
    },
    _save(s) { localStorage.setItem(KEY, JSON.stringify(s)); },

    balance() { return this.state().balance; },
    hasBetOn(predId) { return this.state().bets.some((b) => b.predId === predId && b.status === 'open'); },

    /* Placer un pari : déduit la mise, crée un pari ouvert. */
    placeBet(pred, stake, odds) {
      const s = this.state();
      stake = Math.round(stake);
      if (stake <= 0 || stake > s.balance) return { ok: false, reason: 'balance' };
      s.balance -= stake;
      s.bets.unshift({
        id: 'b' + Date.now(),
        predId: pred.id,
        home: pred.home, away: pred.away,
        homeMeta: pred.homeMeta, awayMeta: pred.awayMeta,
        league: pred.league, flag: pred.flag,
        prediction: pred.prediction, // {key, fr, en}
        odds: parseFloat(odds),
        stake,
        potential: Math.round(stake * parseFloat(odds)),
        status: pred.status === 'won' || pred.status === 'lost' ? 'settle-now' : 'open',
        ts: Date.now(),
      });
      // Si le match est déjà résolu (pari sur historique), régler immédiatement
      const justAdded = s.bets[0];
      if (justAdded.status === 'settle-now') {
        justAdded.status = 'open';
        this._save(s);
        this.settle(pred.id, pred.status === 'won');
      } else {
        this._save(s);
        this.emit();
      }
      return { ok: true };
    },

    /* Régler tous les paris ouverts sur un match. */
    settle(predId, won) {
      const s = this.state();
      let changed = false;
      s.bets.forEach((b) => {
        if (b.predId === predId && b.status === 'open') {
          b.status = won ? 'won' : 'lost';
          b.settledTs = Date.now();
          if (won) { b.payout = Math.round(b.stake * b.odds); s.balance += b.payout; }
          else { b.payout = 0; }
          changed = true;
        }
      });
      if (changed) { this._save(s); this.emit(); }
      return changed;
    },

    stats() {
      const s = this.state();
      const settled = s.bets.filter((b) => b.status === 'won' || b.status === 'lost');
      const won = settled.filter((b) => b.status === 'won');
      const staked = settled.reduce((t, b) => t + b.stake, 0);
      const returned = won.reduce((t, b) => t + (b.payout || 0), 0);
      const openStake = s.bets.filter((b) => b.status === 'open').reduce((t, b) => t + b.stake, 0);
      return {
        balance: s.balance,
        start: s.start,
        profit: s.balance + openStake - s.start,
        roi: staked ? Math.round(((returned - staked) / staked) * 100) : 0,
        winRate: settled.length ? Math.round((won.length / settled.length) * 100) : 0,
        open: s.bets.filter((b) => b.status === 'open').length,
        settledCount: settled.length,
        wonCount: won.length,
        bets: s.bets,
      };
    },

    reset() { localStorage.removeItem(KEY); this.emit(); },
  };

  /* --- Modale de placement de pari ------------------------------------ */
  function money(n) { return Math.round(n).toLocaleString(I18N.lang) + ' FCFA'; }

  function openBetModal(pred) {
    const st = Bankroll.stats();
    const odds = parseFloat(pred.odds);
    const predLabel = pred.prediction[I18N.lang] || pred.prediction.fr;
    const fr = I18N.lang === 'fr';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${fr ? 'Placer un pari' : 'Place a bet'}">
        <button class="modal__close" aria-label="${fr ? 'Fermer' : 'Close'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <span class="modal__eyebrow">${pred.flag} ${pred.league}</span>
        <h3 class="modal__title">${pred.home} <span style="color:var(--text-faint)">vs</span> ${pred.away}</h3>
        <div class="bet-pred"><span>${fr ? 'Pronostic IA' : 'AI pick'}</span><b>${predLabel}</b><span class="odds">${fr ? 'Cote' : 'Odds'} ${odds}</span></div>

        <label class="bet-label">${fr ? 'Votre mise (virtuelle)' : 'Your stake (virtual)'}</label>
        <div class="bet-input-row">
          <input type="number" class="bet-stake" min="100" step="100" value="1000" />
          <span class="bet-cur">FCFA</span>
        </div>
        <div class="bet-chips">
          <button data-chip="500">500</button><button data-chip="1000">1 000</button>
          <button data-chip="2500">2 500</button><button data-chip="5000">5 000</button>
          <button data-chip="max">Max</button>
        </div>

        <div class="bet-summary">
          <div><span>${fr ? 'Solde disponible' : 'Available balance'}</span><b class="bal">${money(st.balance)}</b></div>
          <div><span>${fr ? 'Gain potentiel' : 'Potential payout'}</span><b class="payout" style="color:var(--brand-green)">—</b></div>
        </div>

        <button class="btn btn-primary btn-block btn-lg bet-confirm">${fr ? 'Valider le pari' : 'Confirm bet'}</button>
        <p class="bet-warn">18+ · ${fr ? 'Paris virtuels sans argent réel. Jouez de manière responsable.' : 'Virtual bets, no real money. Gamble responsibly.'}</p>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const stakeInput = overlay.querySelector('.bet-stake');
    const payoutEl = overlay.querySelector('.payout');
    const close = () => { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 250); };

    function refresh() {
      const v = parseFloat(stakeInput.value) || 0;
      payoutEl.textContent = v > 0 ? money(v * odds) : '—';
      overlay.querySelector('.bet-confirm').disabled = v <= 0 || v > st.balance;
    }
    stakeInput.addEventListener('input', refresh);
    overlay.querySelectorAll('.bet-chips button').forEach((b) =>
      b.addEventListener('click', () => {
        stakeInput.value = b.dataset.chip === 'max' ? st.balance : b.dataset.chip;
        refresh();
      })
    );
    overlay.querySelector('.modal__close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });

    overlay.querySelector('.bet-confirm').addEventListener('click', () => {
      const v = parseFloat(stakeInput.value) || 0;
      const res = Bankroll.placeBet(pred, v, odds);
      if (res.ok) {
        PronosToast(fr ? `Pari placé : ${money(v)} sur ${predLabel}` : `Bet placed: ${money(v)} on ${predLabel}`, 'ok');
        if (window.PronosNotifications) PronosNotifications.push(
          fr ? 'Pari enregistré' : 'Bet placed',
          `${pred.home} v ${pred.away} · ${money(v)}`, 'bet'
        );
        close();
      } else {
        PronosToast(fr ? 'Solde insuffisant.' : 'Insufficient balance.', 'err');
      }
    });
    refresh();
  }

  Bankroll.openBetModal = openBetModal;
  window.PronosBankroll = Bankroll;
})();
