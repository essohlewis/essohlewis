/* =====================================================================
   dashboard.js — Logique de l'espace membre
   (garde de session, navigation vues, filtres, rendu des pronostics,
    KPI, historique, graphiques, paramètres)
   ===================================================================== */
(function () {
  document.addEventListener('DOMContentLoaded', init);

  let ALL_PREDS = []; // cache des pronostics chargés

  async function init() {
    // --- Garde d'authentification ---
    const session = window.PronosSession && PronosSession.get();
    if (!session) { window.location.href = 'auth.html'; return; }

    hydrateUser(session);
    setupNav();
    setupSidebarMobile();
    setupSettings();
    setupFilters();

    await loadData();
    renderKPIs();
    renderPredictions();
    renderHistory();
    renderBestSports();
    renderPerf();

    // Ré-appliquer les libellés dynamiques au changement de langue
    document.addEventListener('langchange', () => { renderPredictions(); renderHistory(); renderBestSports(); });
  }

  /* --- Injecte les infos utilisateur --- */
  function hydrateUser(user) {
    const initials = (user.name || 'Membre').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    document.querySelectorAll('[data-user-name]').forEach((el) => (el.textContent = user.name || 'Membre'));
    document.querySelectorAll('[data-user-email]').forEach((el) => (el.textContent = user.email || ''));
    document.querySelectorAll('[data-user-plan]').forEach((el) => (el.textContent = user.plan || 'Free'));
    document.querySelectorAll('[data-user-initials]').forEach((el) => (el.textContent = initials));
    const hour = new Date().getHours();
    const greetKey = hour < 18 ? 'dash.welcome' : 'dash.welcome';
    document.querySelectorAll('[data-greet]').forEach((el) => {
      el.textContent = I18N.t(greetKey) + ', ' + (user.name || 'Membre').split(' ')[0];
    });

    // Déconnexion
    document.querySelectorAll('[data-logout]').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        PronosSession.clear();
        window.location.href = 'index.html';
      })
    );
  }

  /* --- Navigation entre les vues --- */
  function setupNav() {
    const links = document.querySelectorAll('.side-nav a[data-view]');
    const views = document.querySelectorAll('.view');
    function show(name) {
      links.forEach((l) => l.classList.toggle('active', l.dataset.view === name));
      views.forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
      // Titre de la topbar
      const active = document.querySelector('.side-nav a[data-view=' + name + ']');
      const titleEl = document.querySelector('[data-page-title]');
      if (active && titleEl) titleEl.textContent = active.querySelector('span').textContent;
      // Fermer sidebar mobile
      document.querySelector('.sidebar').classList.remove('open');
      document.querySelector('.sidebar-overlay').classList.remove('open');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    links.forEach((l) => l.addEventListener('click', (e) => { e.preventDefault(); show(l.dataset.view); location.hash = l.dataset.view; }));
    // Boutons internes (ex. "Passer Premium" → vue abonnement)
    document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => show(b.dataset.goto)));
    // Vue initiale via hash
    const initial = location.hash.replace('#', '') || 'today';
    show(document.querySelector('.side-nav a[data-view=' + initial + ']') ? initial : 'today');
  }

  /* --- Sidebar mobile (overlay) --- */
  function setupSidebarMobile() {
    const btn = document.querySelector('.menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (!btn) return;
    btn.addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('open'); });
    overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); });
  }

  /* --- Paramètres (thème, langue, notifications) --- */
  function setupSettings() {
    // Le toggle thème est déjà branché par theme.js via [data-theme-toggle]
    // Le sélecteur de langue est branché par i18n.js via [data-lang-select]
    const notif = document.querySelector('[data-setting-notif]');
    if (notif) {
      notif.checked = localStorage.getItem('pronos-notif') === '1';
      notif.addEventListener('change', () => {
        localStorage.setItem('pronos-notif', notif.checked ? '1' : '0');
        PronosToast(notif.checked
          ? (I18N.lang === 'fr' ? 'Notifications activées' : 'Notifications enabled')
          : (I18N.lang === 'fr' ? 'Notifications désactivées' : 'Notifications disabled'));
      });
    }
  }

  /* --- Filtres --- */
  function setupFilters() {
    // Peupler le filtre ligue depuis les données
    const leagueSel = document.querySelector('[data-filter=league]');
    if (leagueSel) {
      PronosData.LEAGUES.forEach((l) => {
        const opt = document.createElement('option');
        opt.value = l.id; opt.textContent = l.name;
        leagueSel.appendChild(opt);
      });
    }
    document.querySelectorAll('[data-filter]').forEach((sel) =>
      sel.addEventListener('change', renderPredictions)
    );
  }

  /* --- Chargement des données (avec skeleton) --- */
  async function loadData() {
    const grid = document.getElementById('preds-grid');
    if (grid) grid.innerHTML = Array.from({ length: 6 }).map(() => '<div class="skeleton" style="height:320px"></div>').join('');
    ALL_PREDS = await PronosData.fetchPredictions();
  }

  /* --- Filtrage + rendu des cartes de pronostic --- */
  function renderPredictions() {
    const grid = document.getElementById('preds-grid');
    if (!grid) return;
    const fSport = val('sport'), fRegion = val('region'), fLeague = val('league'), fConf = val('conf');

    let list = ALL_PREDS.filter((p) => {
      if (fSport && p.sport !== fSport) return false;
      if (fRegion && p.region !== fRegion) return false;
      if (fLeague && p.leagueId !== fLeague) return false;
      if (fConf === 'high' && p.confidence < 80) return false;
      if (fConf === 'mid' && (p.confidence < 65 || p.confidence >= 80)) return false;
      if (fConf === 'low' && p.confidence >= 65) return false;
      return true;
    });

    const count = document.querySelector('[data-results-count]');
    if (count) count.textContent = list.length + ' ' + I18N.t('dash.results');

    if (!list.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <p>${I18N.t('dash.empty')}</p></div>`;
      return;
    }
    grid.innerHTML = list.map((p, i) => PronosPredictions.cardHTML(p, i)).join('');
    PronosPredictions.animateGauges(grid);
    PronosPredictions.bindTilt(grid);
    I18N.apply(grid);
  }
  function val(name) { const el = document.querySelector('[data-filter=' + name + ']'); return el ? el.value : ''; }

  /* --- KPIs personnels --- */
  function renderKPIs() {
    const resolved = ALL_PREDS.filter((p) => p.status === 'won' || p.status === 'lost');
    const won = resolved.filter((p) => p.status === 'won').length;
    const winRate = resolved.length ? Math.round((won / resolved.length) * 100) : 87;
    setKPI('winrate', winRate + '%');
    setKPI('tracked', ALL_PREDS.length);
    setKPI('streak', won >= 1 ? won : 3);
    setKPI('roi', '+23%');
  }
  function setKPI(name, value) {
    const el = document.querySelector('[data-kpi=' + name + ']');
    if (el) el.textContent = value;
  }

  /* --- Historique (matchs résolus + à venir) --- */
  function renderHistory() {
    const tbody = document.getElementById('history-body');
    if (!tbody) return;
    const rows = ALL_PREDS.slice().sort((a, b) => new Date(b.kickoff) - new Date(a.kickoff)).map((p) => {
      const pred = p.prediction[I18N.lang] || p.prediction.fr;
      return `<tr>
        <td><div class="team-cell">
          <span class="mini-logo" style="background:${p.homeMeta.c}">${p.homeMeta.i}</span>${p.home}
          <span style="color:var(--text-faint);margin:0 2px">v</span>
          <span class="mini-logo" style="background:${p.awayMeta.c}">${p.awayMeta.i}</span>${p.away}
        </div></td>
        <td>${p.flag} ${p.league}</td>
        <td>${pred}</td>
        <td><span class="conf-tag ${PronosPredictions.confClass(p.confidence)}">${p.confidence}%</span></td>
        <td>${p.odds}</td>
        <td>${statusBadgeSmall(p.status)}</td>
      </tr>`;
    }).join('');
    tbody.innerHTML = rows;
  }
  function statusBadgeSmall(s) {
    const map = {
      upcoming: `<span class="badge badge--upcoming">${I18N.t('status.upcoming')}</span>`,
      live: `<span class="badge badge--live"><span class="dot"></span>${I18N.t('status.live')}</span>`,
      won: `<span class="badge badge--won">✓ ${I18N.t('status.won')}</span>`,
      lost: `<span class="badge badge--lost">✕ ${I18N.t('status.lost')}</span>`,
    };
    return map[s] || '';
  }

  /* --- Meilleurs sports (graphique à barres) --- */
  function renderBestSports() {
    const host = document.getElementById('best-sports');
    if (!host) return;
    // Agréger le taux de réussite fictif par sport
    const bySport = {};
    ALL_PREDS.forEach((p) => {
      bySport[p.sport] = bySport[p.sport] || { total: 0, sum: 0 };
      bySport[p.sport].total++; bySport[p.sport].sum += p.confidence;
    });
    const labels = { football: '⚽', basketball: '🏀', cricket: '🏏' };
    const data = Object.entries(bySport).map(([s, v]) => ({ sport: s, rate: Math.round(v.sum / v.total) }));
    const max = Math.max(...data.map((d) => d.rate), 100);
    host.innerHTML = data.map((d) => `
      <div class="bar-col">
        <span class="val">${d.rate}%</span>
        <div class="bar" style="height:0" data-h="${(d.rate / max) * 100}"></div>
        <span class="lbl">${labels[d.sport] || ''} ${d.sport}</span>
      </div>`).join('');
    requestAnimationFrame(() => host.querySelectorAll('.bar').forEach((b) => (b.style.height = b.dataset.h + '%')));
  }

  /* --- Courbe de performance (réutilise le principe de main.js) --- */
  async function renderPerf() {
    const host = document.getElementById('dash-perf');
    if (!host) return;
    const series = await PronosData.fetchPerformanceSeries();
    const w = 640, h = 220, pad = 30;
    const max = Math.max(...series.map((s) => s.value)) + 4, min = Math.min(...series.map((s) => s.value)) - 4;
    const x = (i) => pad + (i * (w - pad * 2)) / (series.length - 1);
    const y = (v) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
    const pts = series.map((s, i) => `${x(i)},${y(s.value)}`).join(' ');
    const area = `M ${x(0)},${h - pad} L ` + series.map((s, i) => `${x(i)},${y(s.value)}`).join(' L ') + ` L ${x(series.length - 1)},${h - pad} Z`;
    host.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${I18N.t('dash.perfTitle')}">
        <defs>
          <linearGradient id="dareagrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="rgba(108,92,231,0.35)"/><stop offset="100%" stop-color="rgba(108,92,231,0)"/></linearGradient>
          <linearGradient id="dlinegrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#00E676"/><stop offset="100%" stop-color="#6C5CE7"/></linearGradient>
        </defs>
        ${[0, 1, 2, 3].map((g) => `<line x1="${pad}" x2="${w - pad}" y1="${pad + g * (h - pad * 2) / 3}" y2="${pad + g * (h - pad * 2) / 3}" stroke="var(--border)"/>`).join('')}
        <path d="${area}" fill="url(#dareagrad)"/>
        <polyline points="${pts}" fill="none" stroke="url(#dlinegrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ${series.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.value)}" r="3.5" fill="var(--bg-2)" stroke="#6C5CE7" stroke-width="2"/>`).join('')}
        ${series.map((s, i) => `<text x="${x(i)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="var(--text-dim)">${s.label}</text>`).join('')}
      </svg>`;
  }
})();
