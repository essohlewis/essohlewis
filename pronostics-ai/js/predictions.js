/* =====================================================================
   predictions.js — Rendu dynamique des cartes de pronostic
   Utilisé par la landing (aperçu) et le dashboard (liste complète).
   ===================================================================== */
(function () {
  /* --- Helpers de formatage --- */
  function fmtTime(iso) {
    const d = new Date(iso);
    const opts = { hour: '2-digit', minute: '2-digit' };
    const day = d.toDateString() === new Date().toDateString();
    const dateStr = day ? '' : d.toLocaleDateString(I18N.lang, { day: '2-digit', month: 'short' }) + ' · ';
    return dateStr + d.toLocaleTimeString(I18N.lang, opts);
  }

  function confClass(c) { return c >= 80 ? 'high' : c >= 65 ? 'mid' : 'low'; }
  function confLabel(c) {
    if (c >= 80) return I18N.lang === 'fr' ? 'Élevée' : 'High';
    if (c >= 65) return I18N.lang === 'fr' ? 'Moyenne' : 'Medium';
    return I18N.lang === 'fr' ? 'Faible' : 'Low';
  }

  function logo(meta, cls) {
    return `<span class="${cls}" style="background:${meta.c}">${meta.i}</span>`;
  }

  function statusBadge(status) {
    const map = {
      upcoming: `<span class="badge badge--upcoming">${I18N.t('status.upcoming')}</span>`,
      live: `<span class="badge badge--live"><span class="dot"></span>${I18N.t('status.live')}</span>`,
      won: `<span class="badge badge--won">✓ ${I18N.t('status.won')}</span>`,
      lost: `<span class="badge badge--lost">✕ ${I18N.t('status.lost')}</span>`,
    };
    return map[status] || '';
  }

  /* Jauge circulaire SVG (confiance IA). id unique requis pour le dégradé. */
  function gauge(conf, uid) {
    const dash = 176; // 2πr avec r=28
    const offset = dash - (dash * conf) / 100;
    return `
      <div class="gauge" data-gauge="${conf}">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <defs>
            <linearGradient id="gaugegrad${uid}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#00E676"/><stop offset="100%" stop-color="#6C5CE7"/>
            </linearGradient>
          </defs>
          <circle class="track" cx="32" cy="32" r="28"/>
          <circle class="prog" cx="32" cy="32" r="28" style="stroke:url(#gaugegrad${uid});stroke-dashoffset:${offset}"/>
        </svg>
        <span class="gauge__val">${conf}%</span>
      </div>`;
  }

  /* --- Carte détaillée (dashboard) --- */
  function cardHTML(p, i) {
    const pred = p.prediction[I18N.lang] || p.prediction.fr;
    const analysis = p.analysis[I18N.lang] || p.analysis.fr;
    return `
    <article class="pred-card tilt" tabindex="0" aria-label="${p.home} vs ${p.away}">
      <div class="pred-card__head">
        <span class="pred-card__league"><span aria-hidden="true">${p.flag}</span> ${p.league}</span>
        ${statusBadge(p.status)}
      </div>
      <div class="match-row">
        <div class="match-team">${logo(p.homeMeta, 'match-logo')}<span>${p.home}</span></div>
        <div class="match-mid"><span class="vs">VS</span><span class="time">${fmtTime(p.kickoff)}</span></div>
        <div class="match-team">${logo(p.awayMeta, 'match-logo')}<span>${p.away}</span></div>
      </div>
      <div class="pred-card__pred">
        <span class="lbl">${I18N.lang === 'fr' ? 'Prédiction IA' : 'AI prediction'}</span>
        <span class="val"><strong>${pred}</strong><span class="odds">${I18N.lang === 'fr' ? 'Cote' : 'Odds'} ${p.odds}</span></span>
      </div>
      <p class="pred-card__analysis">${analysis}</p>
      <div class="pred-card__foot">
        ${gauge(p.confidence, i)}
        <div class="pred-card__conf">
          <div class="conf__row"><span>${I18N.t('conf.ai')}</span><span class="conf-tag ${confClass(p.confidence)}">${confLabel(p.confidence)}</span></div>
          <div class="conf__bar"><span class="conf__fill" style="width:0" data-w="${p.confidence}"></span></div>
        </div>
      </div>
    </article>`;
  }

  /* --- Carte "verrouillée" pour l'aperçu landing (incitation à l'inscription) --- */
  function lockedCardHTML(p, i) {
    return `
    <article class="pred-card locked">
      <div class="pred-card__head">
        <span class="pred-card__league"><span aria-hidden="true">${p.flag}</span> ${p.league}</span>
        ${statusBadge('upcoming')}
      </div>
      <div class="match-row">
        <div class="match-team">${logo(p.homeMeta, 'match-logo')}<span>${p.home}</span></div>
        <div class="match-mid"><span class="vs">VS</span><span class="time">${fmtTime(p.kickoff)}</span></div>
        <div class="match-team">${logo(p.awayMeta, 'match-logo')}<span>${p.away}</span></div>
      </div>
      <div class="pred-card__pred"><span class="lbl">${I18N.lang === 'fr' ? 'Prédiction IA' : 'AI prediction'}</span>
        <span class="val"><strong>••••••</strong><span class="odds">•••</span></span></div>
      <div class="locked__overlay">
        <svg class="lock-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <b data-i18n="preview.locked">${I18N.t('preview.locked')}</b>
        <a class="btn btn-primary" href="auth.html#signup" data-i18n="preview.unlock">${I18N.t('preview.unlock')}</a>
      </div>
    </article>`;
  }

  /* Anime les jauges/barres visibles (appelé après rendu). */
  function animateGauges(container) {
    requestAnimationFrame(() => {
      container.querySelectorAll('.conf__fill').forEach((el) => { el.style.width = el.dataset.w + '%'; });
      // Les jauges circulaires ont déjà leur offset inline ; on force un léger reflow d'anim
      container.querySelectorAll('.gauge .prog').forEach((el) => {
        const val = el.closest('.gauge').dataset.gauge;
        el.style.strokeDashoffset = 176 - (176 * val) / 100;
      });
    });
  }

  /* Effet tilt 3D léger au survol (désactivé si reduced-motion). */
  function bindTilt(container) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    container.querySelectorAll('.tilt').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(800px) rotateX(${-py * 5}deg) rotateY(${px * 5}deg) translateY(-3px)`;
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  // Exposition
  window.PronosPredictions = { cardHTML, lockedCardHTML, animateGauges, bindTilt, fmtTime, confClass };
})();
