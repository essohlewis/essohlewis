/* =====================================================================
   main.js — Interactions de la landing page
   (compteurs animés, reveal au scroll, aperçu pronostics, FAQ,
    tarifs mensuel/annuel, menu mobile, graphique de performance)
   ===================================================================== */
(function () {
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    // Rediriger le bouton "Connexion" si déjà connecté
    if (window.PronosSession && PronosSession.isAuthed()) {
      document.querySelectorAll('[data-auth-link]').forEach((a) => {
        a.setAttribute('href', 'dashboard.html');
        if (a.dataset.authLink === 'label') a.textContent = I18N.lang === 'fr' ? 'Mon espace' : 'My dashboard';
      });
    }

    setupMobileNav();
    setupReveal();
    setupCounters();
    setupFAQ();
    setupPricingToggle();
    loadPreview();
    loadPerfChart();

    // Re-rendu de l'aperçu si la langue change
    document.addEventListener('langchange', () => { loadPreview(); });
  }

  /* --- Menu mobile --- */
  function setupMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.main-nav');
    if (!toggle || !nav) return;
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => nav.classList.remove('open')));
  }

  /* --- Animations d'apparition au scroll --- */
  function setupReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el) => io.observe(el));
  }

  /* --- Compteurs animés (déclenchés à l'entrée dans le viewport) --- */
  function setupCounters() {
    const counters = document.querySelectorAll('[data-count]');
    if (!counters.length) return;
    const animate = (el) => {
      const target = parseFloat(el.dataset.count);
      const dur = 1600, start = performance.now();
      const suffix = el.dataset.suffix || '';
      const prefix = el.dataset.prefix || '';
      const decimals = (el.dataset.count.split('.')[1] || '').length;
      function tick(now) {
        const t = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        const val = target * eased;
        el.textContent = prefix + val.toLocaleString(I18N.lang, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
        if (t < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { animate(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.6 });
    counters.forEach((c) => io.observe(c));
  }

  /* --- FAQ accordéon --- */
  function setupFAQ() {
    document.querySelectorAll('.faq-item__q').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const open = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach((i) => { i.classList.remove('open'); i.querySelector('.faq-item__q').setAttribute('aria-expanded', 'false'); });
        if (!open) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
      });
    });
  }

  /* --- Bascule tarifs mensuel / annuel --- */
  function setupPricingToggle() {
    const sw = document.querySelector('.pricing .switch');
    if (!sw) return;
    const labelM = document.querySelector('[data-price-m]');
    const labelY = document.querySelector('[data-price-y]');
    function render(yearly) {
      sw.setAttribute('aria-checked', yearly);
      labelM && labelM.classList.toggle('active', !yearly);
      labelY && labelY.classList.toggle('active', yearly);
      document.querySelectorAll('[data-monthly]').forEach((el) => {
        el.querySelector('.amount').textContent = yearly ? el.dataset.yearly : el.dataset.monthly;
        const per = el.querySelector('.per');
        if (per && !el.hasAttribute('data-free')) per.textContent = yearly ? I18N.t('plan.perYear') : I18N.t('plan.perMonth');
      });
    }
    sw.addEventListener('click', () => render(sw.getAttribute('aria-checked') !== 'true'));
    render(false);
  }

  /* --- Aperçu des pronostics du jour (3 cartes, verrouillées) --- */
  async function loadPreview() {
    const wrap = document.getElementById('preview-cards');
    if (!wrap) return;
    wrap.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    const preds = await PronosData.fetchPredictions();
    // Prendre 3 pronostics "à venir" pour l'aperçu
    const sample = preds.filter((p) => p.status === 'upcoming' || p.status === 'live').slice(0, 3);
    wrap.innerHTML = sample.map((p, i) => PronosPredictions.lockedCardHTML(p, i)).join('');
    I18N.apply(wrap);
  }

  /* --- Graphique de performance (courbe SVG animée) --- */
  async function loadPerfChart() {
    const host = document.getElementById('perf-chart');
    if (!host) return;
    const series = await PronosData.fetchPerformanceSeries();
    const w = 520, h = 200, pad = 28;
    const max = Math.max(...series.map((s) => s.value)) + 4;
    const min = Math.min(...series.map((s) => s.value)) - 4;
    const x = (i) => pad + (i * (w - pad * 2)) / (series.length - 1);
    const y = (v) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
    const pts = series.map((s, i) => `${x(i)},${y(s.value)}`).join(' ');
    const area = `M ${x(0)},${h - pad} L ` + series.map((s, i) => `${x(i)},${y(s.value)}`).join(' L ') + ` L ${x(series.length - 1)},${h - pad} Z`;

    host.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${I18N.t('proof.chart')}">
        <defs>
          <linearGradient id="areagrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(0,230,118,0.35)"/><stop offset="100%" stop-color="rgba(0,230,118,0)"/>
          </linearGradient>
          <linearGradient id="linegrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#00E676"/><stop offset="100%" stop-color="#6C5CE7"/>
          </linearGradient>
        </defs>
        ${[0, 1, 2, 3].map((g) => `<line x1="${pad}" x2="${w - pad}" y1="${pad + g * (h - pad * 2) / 3}" y2="${pad + g * (h - pad * 2) / 3}" stroke="var(--border)" stroke-width="1"/>`).join('')}
        <path d="${area}" fill="url(#areagrad)"/>
        <polyline points="${pts}" fill="none" stroke="url(#linegrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="perf-line"/>
        ${series.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.value)}" r="3.5" fill="var(--bg-2)" stroke="#00E676" stroke-width="2"/>`).join('')}
        ${series.map((s, i) => i % 2 === 0 ? `<text x="${x(i)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="var(--text-dim)">${s.label}</text>` : '').join('')}
      </svg>`;

    // Animation de tracé de la ligne
    const line = host.querySelector('.perf-line');
    if (line && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const len = line.getTotalLength();
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      requestAnimationFrame(() => {
        line.style.transition = 'stroke-dashoffset 1.8s ease';
        line.style.strokeDashoffset = '0';
      });
    }
  }
})();
