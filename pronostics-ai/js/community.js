/* =====================================================================
   community.js — Classement, gamification (badges) & comparateur de cotes
   ===================================================================== */
(function () {
  /* --- Catalogue de badges (débloqués selon l'activité bankroll) --- */
  const BADGES = [
    { id: 'firstbet', emoji: '🎟️', fr: 'Premier pari', en: 'First bet', descFr: 'Placer votre premier pari', descEn: 'Place your first bet', test: (s) => s.bets.length >= 1 },
    { id: 'streak3', emoji: '🔥', fr: 'Série de 3', en: '3-win streak', descFr: '3 paris gagnés', descEn: '3 winning bets', test: (s) => s.wonCount >= 3 },
    { id: 'profit', emoji: '📈', fr: 'Rentable', en: 'Profitable', descFr: 'ROI positif', descEn: 'Positive ROI', test: (s) => s.roi > 0 && s.settledCount >= 2 },
    { id: 'highroller', emoji: '💎', fr: 'Gros joueur', en: 'High roller', descFr: 'Solde > 15 000', descEn: 'Balance > 15,000', test: (s) => s.balance > 15000 },
    { id: 'active', emoji: '⚡', fr: 'Actif', en: 'Active', descFr: '10 paris placés', descEn: '10 bets placed', test: (s) => s.bets.length >= 10 },
    { id: 'sharp', emoji: '🎯', fr: 'Fin limier', en: 'Sharp', descFr: 'Taux de réussite ≥ 70%', descEn: 'Win rate ≥ 70%', test: (s) => s.winRate >= 70 && s.settledCount >= 3 },
  ];

  function earnedBadges() {
    const s = PronosBankroll.stats();
    return BADGES.map((b) => ({ ...b, earned: b.test(s) }));
  }

  function renderBadges(host) {
    if (!host) return;
    const fr = I18N.lang === 'fr';
    host.innerHTML = earnedBadges().map((b) => `
      <div class="badge-card ${b.earned ? 'earned' : 'locked'}" title="${fr ? b.descFr : b.descEn}">
        <span class="badge-emoji">${b.emoji}</span>
        <b>${fr ? b.fr : b.en}</b>
        <span class="badge-desc">${fr ? b.descFr : b.descEn}</span>
        ${b.earned ? `<span class="badge-check">✓</span>` : ''}
      </div>`).join('');
  }

  /* --- Classement (leaderboard) --- */
  async function renderLeaderboard(host) {
    if (!host) return;
    const fr = I18N.lang === 'fr';
    const members = await PronosData.fetchLeaderboard();
    const session = PronosSession.get() || { name: 'Vous', email: '' };
    const st = PronosBankroll.stats();

    // Insérer l'utilisateur courant
    const me = {
      id: 'me', name: (fr ? 'Vous' : 'You') + ' · ' + (session.name || '').split(' ')[0],
      country: '—', color: 'linear-gradient(135deg,#00E676,#6C5CE7)',
      initials: (session.name || 'V').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2),
      winRate: st.winRate, roi: st.roi, balance: st.balance, bets: st.bets.length, me: true,
    };
    const all = [...members, me].sort((a, b) => b.roi - a.roi);
    const medal = ['🥇', '🥈', '🥉'];

    host.innerHTML = `
      <div class="lb-head">
        <span>#</span><span>${fr ? 'Membre' : 'Member'}</span>
        <span class="num">${fr ? 'Réussite' : 'Win'}</span><span class="num">ROI</span><span class="num">${fr ? 'Solde' : 'Balance'}</span>
      </div>
      ${all.map((m, i) => `
        <div class="lb-row ${m.me ? 'me' : ''}">
          <span class="lb-rank">${medal[i] || (i + 1)}</span>
          <span class="lb-member">
            <span class="lb-avatar" style="background:${m.color}">${m.initials}</span>
            <span class="lb-name"><b>${m.name}</b><small>${m.country}</small></span>
          </span>
          <span class="num">${m.winRate}%</span>
          <span class="num ${m.roi >= 0 ? 'pos' : 'neg'}">${m.roi >= 0 ? '+' : ''}${m.roi}%</span>
          <span class="num">${m.balance.toLocaleString(I18N.lang)}</span>
        </div>`).join('')}`;
  }

  /* --- Comparateur de cotes (par pronostic) --- */
  function renderOdds(pred) {
    if (!pred.bookmakers || !pred.bookmakers.length) return '';
    const fr = I18N.lang === 'fr';
    const best = Math.max(...pred.bookmakers.map((b) => parseFloat(b.odds)));
    return `
      <div class="odds-compare">
        <div class="odds-compare__head">${fr ? 'Comparateur de cotes' : 'Odds comparison'}</div>
        ${pred.bookmakers.map((b) => {
          const isBest = parseFloat(b.odds) === best;
          return `<div class="odds-row ${isBest ? 'best' : ''}">
            <span class="bk">${b.name}</span>
            <span class="ov">${b.odds}${isBest ? ` <em>${fr ? 'meilleure' : 'best'}</em>` : ''}</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  window.PronosCommunity = { renderBadges, renderLeaderboard, renderOdds, earnedBadges };
})();
