/* =====================================================================
   SAMSON BOUTIQUE — app.js (orchestration commune + pages diverses)
   ===================================================================== */
(function () {
  'use strict';
  const esc = s => SB.security.escapeHtml(s);

  /* ---------- Carte produit réutilisable (top-level : dispo partout) ---------- */
  SB.renderCard = function (p) {
    const enPromo = p.prixPromo != null;
    const enWish = SB.wishlist.contient(p.id);
    const badges = (p.badges || []).map(b => {
      const map = { 'Nouveau': 'nouveau', 'Promo': 'promo', 'Meilleure vente': 'vente', 'Stock limité': 'stock', 'Pro': 'pro' };
      return `<span class="badge badge-${map[b] || 'vente'}">${esc(b)}</span>`;
    }).join('');
    const cat = window.SB_DATA.categories.find(c => c.id === p.categorie);
    const rupture = p.stock <= 0;
    const etoiles = '★'.repeat(Math.round(p.note)) + '☆'.repeat(5 - Math.round(p.note));
    return `<article class="produit-card ${rupture ? 'rupture' : ''}" data-reveal>
      <div class="media">
        <div class="badges-wrap">${badges}</div>
        <button class="wish-btn ${enWish ? 'active' : ''}" data-wish="${p.id}" aria-label="Ajouter aux favoris">${enWish ? '❤️' : '🤍'}</button>
        <a href="produit.html?id=${p.id}" aria-label="${esc(p.nom)}">
          <img src="${SB.produitImage(p)}" alt="${esc(p.nom)}" loading="lazy">
        </a>
      </div>
      <div class="infos">
        <span class="cat-mini">${esc(cat ? cat.nom : '')}</span>
        <h3 class="nom"><a href="produit.html?id=${p.id}">${esc(p.nom)}</a></h3>
        <div class="stars">${etoiles} <span class="count">(${p.avisCount})</span></div>
        <div class="prix-row">
          <span class="prix-actuel">${SB.formatPrix(SB.prixEffectif(p))}</span>
          ${enPromo ? `<span class="prix-barre">${SB.formatPrix(p.prix)}</span>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn btn-primary btn-sm" data-add="${p.id}" ${rupture ? 'disabled' : ''}>
            ${rupture ? 'Rupture' : '🛒 Ajouter'}
          </button>
        </div>
      </div>
    </article>`;
  };

  /* Délégation : boutons "Ajouter" & wishlist sur toutes les cartes */
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add && !add.disabled) { SB.cart.ajouter(add.dataset.add, 1, {}); }
    const wish = e.target.closest('[data-wish]');
    if (wish) {
      const on = SB.wishlist.toggle(wish.dataset.wish);
      wish.classList.toggle('active', on); wish.innerHTML = on ? '❤️' : '🤍';
    }
  });

  /* ---------- Scroll reveal (IntersectionObserver) ---------- */
  let _io;
  SB.observeReveal = function () {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('in'));
      return;
    }
    if (!_io) {
      _io = new IntersectionObserver((entries) => {
        entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); _io.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    }
    document.querySelectorAll('[data-reveal]:not(.in)').forEach(el => _io.observe(el));
  };

  /* ---------- Compteurs animés ---------- */
  function animerCompteurs() {
    const els = document.querySelectorAll('[data-count]');
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target, cible = parseFloat(el.dataset.count), suffixe = el.dataset.suffix || '';
        const debut = performance.now(), duree = 1600;
        function tick(now) {
          const prog = Math.min(1, (now - debut) / duree);
          const eased = 1 - Math.pow(1 - prog, 3);
          el.textContent = Math.round(cible * eased).toLocaleString('fr-FR') + suffixe;
          if (prog < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    els.forEach(el => io.observe(el));
  }

  /* ---------- Header : scroll, menu mobile, recherche, thème ---------- */
  function initHeader() {
    const header = document.querySelector('.site-header');
    if (header) {
      const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
      window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    }
    // Recherche desktop + suggestions
    SB.search.brancher(document.getElementById('nav-search-input'), document.getElementById('search-suggest'));

    // Menu mobile
    const burger = document.getElementById('burger');
    const mm = document.getElementById('mobile-menu');
    if (burger && mm) {
      burger.addEventListener('click', () => { mm.classList.add('open'); document.body.classList.add('no-scroll'); });
      mm.querySelectorAll('a, .mm-close').forEach(a => a.addEventListener('click', () => { mm.classList.remove('open'); document.body.classList.remove('no-scroll'); }));
    }
    // Panier
    document.querySelectorAll('[data-open-cart]').forEach(b => b.addEventListener('click', () => SB.cart.ouvrir()));
    document.getElementById('cart-close')?.addEventListener('click', () => SB.cart.fermer());
    document.getElementById('overlay')?.addEventListener('click', () => {
      SB.cart.fermer();
      document.getElementById('filters')?.classList.remove('open');
      document.getElementById('overlay').classList.remove('show');
    });
    // Marquer le lien actif
    const page = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
      if (a.getAttribute('href') === page) a.classList.add('active');
    });
  }

  /* ---------- Cookie banner ---------- */
  function initCookies() {
    if (SB.store.get('cookies_ok')) return;
    const b = document.getElementById('cookie-banner');
    if (!b) return;
    setTimeout(() => b.classList.add('show'), 1200);
    b.querySelector('[data-cookie-accept]')?.addEventListener('click', () => { SB.store.set('cookies_ok', true); b.classList.remove('show'); });
    b.querySelector('[data-cookie-refuse]')?.addEventListener('click', () => { SB.store.set('cookies_ok', 'refuse'); b.classList.remove('show'); });
  }

  /* ---------- Carrousels (boutons prev/next) ---------- */
  function initCarousels() {
    document.querySelectorAll('[data-carousel]').forEach(car => {
      const track = car.querySelector('.carousel-track');
      car.querySelector('[data-car-prev]')?.addEventListener('click', () => track.scrollBy({ left: -280, behavior: 'smooth' }));
      car.querySelector('[data-car-next]')?.addEventListener('click', () => track.scrollBy({ left: 280, behavior: 'smooth' }));
    });
  }

  /* ---------- PAGE ACCUEIL ---------- */
  function initHome() {
    const catBox = document.getElementById('home-categories');
    if (catBox) {
      catBox.innerHTML = window.SB_DATA.categories.map(c => {
        const n = window.SB_DATA.produits.filter(p => p.categorie === c.id).length;
        return `<a href="catalogue.html?cat=${c.id}" class="cat-tile" data-reveal style="background:linear-gradient(150deg,${c.grad[0]},${c.grad[1]})">
          <span class="c-ico">${c.icone}</span>
          <h3>${esc(c.nom)}</h3><span class="c-count">${n} produit${n > 1 ? 's' : ''}</span>
        </a>`;
      }).join('');
    }
    const vedettes = document.getElementById('home-vedettes');
    if (vedettes) {
      const v = window.SB_DATA.produits.filter(p => (p.badges || []).includes('Meilleure vente')).slice(0, 8);
      vedettes.innerHTML = v.map(SB.renderCard).join('');
    }
    const nouv = document.getElementById('home-nouveautes');
    if (nouv) {
      const n = window.SB_DATA.produits.filter(p => (p.badges || []).includes('Nouveau'));
      const extra = window.SB_DATA.produits.filter(p => p.prixPromo != null).slice(0, 4);
      nouv.innerHTML = [...n, ...extra].slice(0, 4).map(SB.renderCard).join('');
    }
    const promos = document.getElementById('home-promos');
    if (promos) {
      const pr = window.SB_DATA.produits.filter(p => p.prixPromo != null).slice(0, 4);
      promos.innerHTML = pr.map(SB.renderCard).join('');
    }
    // Témoignages auto-rotatifs
    const temoins = document.getElementById('home-temoins');
    if (temoins) initTemoins(temoins);
  }

  function initTemoins(box) {
    const data = [
      { n: 'Koffi Assamoi', loc: 'Cocody, Abidjan', t: "Matériel de qualité et livraison en 24h ! J'ai équipé mon home gym entièrement chez SAMSON.", a: 'K' },
      { n: 'Aïcha Diallo', loc: 'Marcory, Abidjan', t: "Paiement Wave super simple, produits authentiques. Le service client répond vite sur WhatsApp.", a: 'A' },
      { n: 'Yao Kouassi', loc: 'Yopougon, Abidjan', t: "Les meilleurs prix d'Abidjan pour la nutrition sportive. Je commande chaque mois, jamais déçu.", a: 'Y' },
      { n: 'Mariam Touré', loc: 'Bingerville', t: "Livraison même en dehors du centre ! Brassières et tapis de yoga au top. Merci SAMSON.", a: 'M' }
    ];
    let i = 0;
    function render() {
      const d = data[i];
      box.innerHTML = `<div class="temoin-card" data-reveal>
        <div class="quote">“</div>
        <p>${esc(d.t)}</p>
        <div class="who"><div class="avatar">${esc(d.a)}</div><div><div class="n">${esc(d.n)}</div><div class="loc">${esc(d.loc)}</div></div></div>
      </div>`;
      SB.observeReveal();
    }
    render();
    setInterval(() => { i = (i + 1) % data.length; render(); }, 5000);
  }

  /* ---------- PAGE COMPTE ---------- */
  function initCompte() {
    const layout = document.getElementById('account-layout');
    if (!layout) return;
    // Navigation onglets
    document.querySelectorAll('.account-nav button').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.account-nav button').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.account-panel').forEach(p => p.classList.remove('active'));
        b.classList.add('active');
        document.getElementById(b.dataset.panel).classList.add('active');
      });
    });
    // Historique commandes
    const hist = SB.store.get('commandes', []);
    const box = document.getElementById('panel-commandes');
    if (box) {
      box.innerHTML = hist.length ? hist.map(c => `
        <div class="order-hist-card">
          <div class="oh-head">
            <div><strong>${esc(c.numero)}</strong><div class="muted" style="font-size:.8rem">${new Date(c.date).toLocaleDateString('fr-FR')}</div></div>
            <span class="order-status ${c.statut}">${esc(c.statut)}</span>
          </div>
          <div class="muted" style="font-size:.85rem;margin-bottom:8px">${c.items.reduce((s, i) => s + i.qty, 0)} article(s) · ${esc(c.paiement.moyen)} · Livraison ${esc(c.livraison.zoneLabel || '')}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong class="accent">${SB.formatPrix(c.totaux.total)}</strong>
            <a href="suivi.html?num=${encodeURIComponent(c.numero)}" class="btn btn-ghost btn-sm">Suivre</a>
          </div>
        </div>`).join('')
        : `<div class="no-results"><div class="big">📦</div><p>Aucune commande pour le moment.</p><a href="catalogue.html" class="btn btn-primary" style="margin-top:12px">Commencer mes achats</a></div>`;
    }
    // Wishlist
    const wbox = document.getElementById('panel-wishlist');
    if (wbox) {
      const ids = SB.wishlist.tous();
      const prods = ids.map(SB.getProduit).filter(Boolean);
      const render = () => {
        wbox.innerHTML = prods.length
          ? `<div class="produits-grid">${SB.wishlist.tous().map(SB.getProduit).filter(Boolean).map(SB.renderCard).join('')}</div>`
          : `<div class="no-results"><div class="big">🤍</div><p>Votre liste de favoris est vide.</p></div>`;
      };
      render();
      SB.bus.on('wishlist:change', () => { const ps = SB.wishlist.tous().map(SB.getProduit).filter(Boolean); wbox.innerHTML = ps.length ? `<div class="produits-grid">${ps.map(SB.renderCard).join('')}</div>` : `<div class="no-results"><div class="big">🤍</div><p>Votre liste de favoris est vide.</p></div>`; });
    }
  }

  /* ---------- PAGE SUIVI ---------- */
  function initSuivi() {
    const host = document.getElementById('tracking-result');
    if (!host) return;
    const form = document.getElementById('tracking-form');
    function chercher(num) {
      num = String(num || '').trim().toUpperCase();
      const hist = SB.store.get('commandes', []);
      const c = hist.find(x => x.numero.toUpperCase() === num);
      if (!c) {
        host.innerHTML = `<div class="no-results"><div class="big">❓</div><p>Aucune commande trouvée pour « ${esc(num)} ».</p><p class="muted" style="font-size:.85rem">Vérifiez le numéro (format SB-2026-XXXX).</p></div>`;
        return;
      }
      // Simulation d'avancement selon l'ancienneté
      const heures = (Date.now() - new Date(c.date)) / 3600000;
      let etapeActuelle = 0;
      if (heures > 0.05) etapeActuelle = 1;
      if (heures > 3) etapeActuelle = 2;
      if (heures > 24) etapeActuelle = 3;
      const etapes = [
        { t: 'Commande confirmée', d: 'Votre paiement a été validé', ic: '✓' },
        { t: 'En préparation', d: 'Nous préparons votre colis', ic: '📦' },
        { t: 'En cours de livraison', d: 'Le livreur est en route', ic: '🛵' },
        { t: 'Livrée', d: 'Colis remis au client', ic: '🏠' }
      ];
      host.innerHTML = `
        <div class="order-hist-card">
          <div class="oh-head"><div><strong>${esc(c.numero)}</strong><div class="muted" style="font-size:.8rem">Commandé le ${new Date(c.date).toLocaleString('fr-FR')}</div></div>
          <span class="order-status ${etapeActuelle >= 3 ? 'livree' : etapeActuelle >= 1 ? 'preparation' : 'confirmee'}">${etapes[etapeActuelle].t}</span></div>
          <div class="tracking-timeline">
            ${etapes.map((e, i) => `<div class="tl-step ${i < etapeActuelle ? 'done' : ''} ${i === etapeActuelle ? 'current' : ''}">
              <div class="tl-dot">${i <= etapeActuelle ? e.ic : i + 1}</div>
              <div><div class="tl-title">${esc(e.t)}</div><div class="tl-date">${esc(e.d)}</div></div>
            </div>`).join('')}
          </div>
          <div style="margin-top:10px" class="muted">📍 Livraison : ${esc(c.livraison.zoneLabel || '')} — ${esc(c.livraison.adresse || '')}</div>
        </div>`;
    }
    form?.addEventListener('submit', (e) => { e.preventDefault(); chercher(document.getElementById('tracking-num').value); });
    const pre = new URLSearchParams(location.search).get('num');
    if (pre) { document.getElementById('tracking-num').value = pre; chercher(pre); }
  }

  /* ---------- Formulaires simples (contact, newsletter) ---------- */
  function initFormsSimples() {
    document.querySelectorAll('[data-fake-form]').forEach(f => {
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = f.dataset.fakeForm || 'Message envoyé ! Nous vous répondrons rapidement.';
        SB.toastSucces(msg);
        f.reset();
      });
    });
  }

  /* ---------- PWA : Service Worker ---------- */
  function initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {/* offline ok si échec */});
      });
    }
  }

  /* ---------- Chrome partagé (header, footer, drawer…) injecté ---------- */
  const NAV = [
    ['index.html', 'Accueil'], ['catalogue.html', 'Boutique'],
    ['a-propos.html', 'À propos'], ['contact.html', 'Contact']
  ];
  function renderChrome() {
    const wa = `https://wa.me/${SB.WHATSAPP}?text=${encodeURIComponent('Bonjour SAMSON Boutique 👋, je souhaite un renseignement.')}`;
    const navLinks = NAV.map(([h, l]) => `<a href="${h}">${l}</a>`).join('');

    const headerHost = document.getElementById('sb-header');
    if (headerHost) headerHost.outerHTML = `
      <div class="topbar">🚚 Livraison <strong>offerte</strong> dès 50 000 FCFA à Abidjan · Paiement Wave, Orange, MTN & Moov Money</div>
      <header class="site-header">
        <div class="container nav">
          <a href="index.html" class="brand" aria-label="SAMSON Boutique - Accueil">
            <span class="logo-mark"><span>🏋️</span></span>
            <span>SAMSON<small>BOUTIQUE</small></span>
          </a>
          <nav class="nav-links" aria-label="Navigation principale">${navLinks}</nav>
          <div class="nav-search">
            <span class="s-ico">🔍</span>
            <input id="nav-search-input" type="search" placeholder="Rechercher un produit…" aria-label="Rechercher">
            <div class="search-suggest" id="search-suggest"></div>
          </div>
          <div class="nav-actions">
            <button class="icon-btn theme-toggle" data-theme-toggle aria-label="Changer de thème">🌙</button>
            <a class="icon-btn" href="compte.html" aria-label="Mon compte">👤<span class="count" data-wish-count data-n="0"></span></a>
            <button class="icon-btn" data-open-cart aria-label="Ouvrir le panier">🛒<span class="count" data-cart-count data-n="0"></span></button>
            <button class="icon-btn burger" id="burger" aria-label="Menu">☰</button>
          </div>
        </div>
      </header>`;

    // Éléments flottants + drawers (ajoutés à la fin du body)
    const extra = document.createElement('div');
    extra.innerHTML = `
      <div class="mobile-menu" id="mobile-menu">
        <div class="mm-head"><span class="brand"><span class="logo-mark"><span>🏋️</span></span>SAMSON</span><button class="icon-btn mm-close" aria-label="Fermer">✕</button></div>
        ${NAV.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}
        <a href="compte.html">Mon compte</a><a href="suivi.html">Suivi de commande</a>
      </div>
      <div class="overlay" id="overlay"></div>
      <aside class="cart-drawer" id="cart-drawer" aria-label="Panier">
        <div class="cart-head"><h3>🛒 Mon panier</h3><button class="icon-btn" id="cart-close" aria-label="Fermer">✕</button></div>
        <div class="cart-items" id="cart-items"></div>
        <div class="cart-foot" id="cart-foot"></div>
      </aside>
      <a class="fab-whatsapp" href="${wa}" target="_blank" rel="noopener" aria-label="Nous contacter sur WhatsApp">💬</a>
      <div class="cookie-banner" id="cookie-banner">
        <div class="inner">
          <p>🍪 Nous utilisons des cookies pour améliorer votre expérience et mémoriser votre panier. <a href="confidentialite.html" class="accent">En savoir plus</a>.</p>
          <button class="btn btn-ghost btn-sm" data-cookie-refuse>Refuser</button>
          <button class="btn btn-primary btn-sm" data-cookie-accept>Accepter</button>
        </div>
      </div>
      <div id="toast-zone" aria-live="polite"></div>`;
    document.body.appendChild(extra);

    const footerHost = document.getElementById('sb-footer');
    if (footerHost) footerHost.outerHTML = `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-brand">
              <span class="brand" style="color:#fff"><span class="logo-mark"><span>🏋️</span></span>SAMSON<small>BOUTIQUE</small></span>
              <p style="margin-top:14px">L'extension digitale de SAMSON GYM. Votre spécialiste du matériel de sport et fitness à Abidjan. Produits authentiques, livraison rapide, paiement Mobile Money sécurisé.</p>
              <div class="footer-pay">
                <span class="pay-chip">Wave</span><span class="pay-chip">Orange Money</span><span class="pay-chip">MTN MoMo</span><span class="pay-chip">Moov Money</span>
              </div>
              <div class="footer-social">
                <a href="#" aria-label="Facebook">f</a><a href="#" aria-label="Instagram">📷</a><a href="${wa}" target="_blank" rel="noopener" aria-label="WhatsApp">💬</a>
              </div>
            </div>
            <div><h4>Boutique</h4>
              <a href="catalogue.html?cat=musculation">Musculation</a><a href="catalogue.html?cat=cardio">Cardio</a>
              <a href="catalogue.html?cat=nutrition">Nutrition</a><a href="catalogue.html?cat=vetements">Vêtements</a><a href="catalogue.html">Tout voir</a>
            </div>
            <div><h4>Aide</h4>
              <a href="suivi.html">Suivi de commande</a><a href="contact.html">Contact</a>
              <a href="cgv.html">Livraison & retours</a><a href="cgv.html">CGV</a>
            </div>
            <div><h4>À propos</h4>
              <a href="a-propos.html">Notre histoire</a><a href="confidentialite.html">Confidentialité</a>
              <a href="cgv.html">Mentions légales</a><a href="compte.html">Mon compte</a>
            </div>
          </div>
          <div class="footer-bottom">© <span data-year>2026</span> SAMSON Boutique — Cocody Angré, Abidjan · Conçu par Essoh Lath Lewis · Tous droits réservés</div>
        </div>
      </footer>`;
  }

  /* ---------- Init global ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    renderChrome();
    SB.theme.init();
    SB.attachRipple();
    initHeader();
    initCookies();
    initCarousels();
    animerCompteurs();
    initHome();
    initCompte();
    initSuivi();
    initFormsSimples();
    SB.cart.majBadges();
    SB.observeReveal();
    initPWA();
    // Année dans le footer
    document.querySelectorAll('[data-year]').forEach(e => e.textContent = new Date().getFullYear());
  });
})();
