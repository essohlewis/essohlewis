/* =====================================================================
 * BookingCI — main.js
 * Comportements partagés à toutes les pages :
 *   - Navigation mobile (burger)
 *   - Révélations au scroll (Intersection Observer)
 *   - Système de toasts
 *   - Recherche rapide du hero (page d'accueil)
 *   - Rendu des cartes établissement réutilisables
 *   - Gestion des favoris (sessionStorage) partagée
 *
 * Logique métier / manipulation du DOM sont volontairement séparées :
 * les fonctions "pures" (calculs, filtres) vivent dans filtres.js et
 * reservation.js ; ici on gère surtout l'UI transverse.
 * ===================================================================== */

(function () {
  'use strict';

  const BCI = window.BookingCI;

  /* ---------------------------------------------------------------
   * Utilitaires DOM
   * ------------------------------------------------------------- */
  const $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  const $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---------------------------------------------------------------
   * Navigation mobile
   * ------------------------------------------------------------- */
  function initNav() {
    const burger = $('.burger');
    const menu = $('.mobile-menu');
    if (!burger || !menu) return;
    burger.addEventListener('click', function () {
      const open = burger.classList.toggle('is-open');
      menu.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
    });
    // Ferme le menu au clic sur un lien
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () {
        burger.classList.remove('is-open');
        menu.classList.remove('is-open');
      });
    });
  }

  /* ---------------------------------------------------------------
   * Révélations au scroll
   * ------------------------------------------------------------- */
  function initReveal() {
    const els = $$('.reveal');
    if (!els.length || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------
   * Toasts (notifications éphémères)
   * ------------------------------------------------------------- */
  function toast(message, type) {
    let zone = $('.toast-zone');
    if (!zone) {
      zone = document.createElement('div');
      zone.className = 'toast-zone';
      zone.setAttribute('role', 'status');
      zone.setAttribute('aria-live', 'polite');
      document.body.appendChild(zone);
    }
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'ok' ? ' toast--ok' : '');
    t.innerHTML = (type === 'ok' ? '✅ ' : 'ℹ️ ') + '<span>' + message + '</span>';
    zone.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = '0';
      t.style.transform = 'translateY(10px)';
      setTimeout(function () { t.remove(); }, 300);
    }, 3200);
  }

  /* ---------------------------------------------------------------
   * Favoris (partagés — sessionStorage)
   * En prod : POST /api/favoris. sessionStorage évite la persistance
   * indésirable et fonctionne dans un environnement web standard.
   * ------------------------------------------------------------- */
  const FAV_KEY = 'bookingci_favoris';

  function getFavoris() {
    try { return JSON.parse(sessionStorage.getItem(FAV_KEY)) || []; }
    catch (e) { return []; }
  }
  function toggleFavori(id) {
    const favs = getFavoris();
    const idx = favs.indexOf(id);
    let added;
    if (idx === -1) { favs.push(id); added = true; }
    else { favs.splice(idx, 1); added = false; }
    try { sessionStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch (e) {}
    return added;
  }

  /* ---------------------------------------------------------------
   * Rendu d'une carte établissement (réutilisée listing + accueil)
   * ------------------------------------------------------------- */
  function carteEtablissement(e) {
    const favs = getFavoris();
    const isFav = favs.indexOf(e.id) !== -1;
    const img = BCI.placeholder(e.nom, hash(e.id), e.icone);
    const tag = e.type === 'restaurant'
      ? (e.cuisine || 'Restaurant')
      : (e.categorie || 'Résidence');
    const sousInfo = e.type === 'restaurant'
      ? 'Repas dès'
      : 'Par nuit';

    const art = document.createElement('article');
    art.className = 'card reveal';
    art.innerHTML =
      '<div class="card__media">' +
        '<span class="card__tag">' + tag + '</span>' +
        '<button class="card__fav' + (isFav ? ' is-active' : '') + '" ' +
          'aria-label="Ajouter aux favoris" data-fav="' + e.id + '">' + (isFav ? '❤' : '♡') + '</button>' +
        '<img src="' + img + '" alt="Photo de ' + escapeHtml(e.nom) + ', ' + tag + ' à ' + escapeHtml(e.commune) + '" loading="lazy">' +
      '</div>' +
      '<div class="card__body">' +
        '<div class="rating"><span class="stars" aria-hidden="true">' + BCI.etoiles(e.note) + '</span>' +
          '<span>' + e.note.toFixed(1) + '</span> <small>(' + e.avis + ' avis)</small></div>' +
        '<h3 class="card__title">' + escapeHtml(e.nom) + '</h3>' +
        '<p class="card__meta">📍 ' + escapeHtml(e.commune) + ', ' + escapeHtml(e.ville) + '</p>' +
        '<div class="card__foot">' +
          '<span class="card__price"><small>' + sousInfo + '</small>' + BCI.formatFCFA(e.prix) + '</span>' +
          '<a class="btn btn--primary btn--sm" href="fiche-etablissement.html?id=' + e.id + '">Voir</a>' +
        '</div>' +
      '</div>';

    // Lien "Voir" relatif : depuis l'accueil, le préfixe pages/ est ajouté
    if (document.body.dataset.root === '1') {
      const link = art.querySelector('a.btn');
      link.setAttribute('href', 'pages/fiche-etablissement.html?id=' + e.id);
    }

    // Gestion favori
    const favBtn = art.querySelector('[data-fav]');
    favBtn.addEventListener('click', function (ev) {
      ev.preventDefault();
      const added = toggleFavori(e.id);
      favBtn.classList.toggle('is-active', added);
      favBtn.textContent = added ? '❤' : '♡';
      toast(added ? '« ' + e.nom +' » ajouté à vos favoris' : 'Retiré de vos favoris', added ? 'ok' : null);
    });

    return art;
  }

  // Petit hash stable pour choisir une palette d'image
  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return h;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------------------------------------------------------
   * Recherche rapide du hero (page d'accueil)
   * ------------------------------------------------------------- */
  function initQuickSearch() {
    const form = $('#quick-search');
    if (!form) return;

    // Segments restaurant / résidence
    let type = 'restaurant';
    $$('.seg button', form).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.seg button', form).forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        type = b.dataset.type;
        // Adapte le libellé du champ date
        const dateLabel = $('#qs-date-label');
        if (dateLabel) dateLabel.textContent = type === 'restaurant' ? 'Date & heure' : "Date d'arrivée";
      });
    });

    // Remplit le select des villes
    const villeSel = $('#qs-ville');
    if (villeSel) {
      BCI.VILLES.forEach(function (v) {
        const opt = document.createElement('option');
        opt.value = v.nom; opt.textContent = v.nom;
        villeSel.appendChild(opt);
      });
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const ville = villeSel ? villeSel.value : '';
      const page = type === 'restaurant' ? 'pages/restaurants.html' : 'pages/residences.html';
      const params = new URLSearchParams();
      if (ville) params.set('ville', ville);
      window.location.href = page + (params.toString() ? '?' + params.toString() : '');
    });
  }

  /* ---------------------------------------------------------------
   * Sections dynamiques de l'accueil (top établissements + témoignages)
   * ------------------------------------------------------------- */
  function initHomeSections() {
    const topResto = $('#top-restaurants');
    if (topResto) {
      const tri = BCI.RESTAURANTS.slice().sort(function (a, b) { return b.populaire - a.populaire; }).slice(0, 3);
      tri.forEach(function (e) { topResto.appendChild(carteEtablissement(e)); });
    }
    const topResid = $('#top-residences');
    if (topResid) {
      const tri = BCI.RESIDENCES.slice().sort(function (a, b) { return b.populaire - a.populaire; }).slice(0, 3);
      tri.forEach(function (e) { topResid.appendChild(carteEtablissement(e)); });
    }
    const temoins = $('#temoignages');
    if (temoins) {
      BCI.TEMOIGNAGES.forEach(function (t) {
        const el = document.createElement('article');
        el.className = 'testimonial reveal';
        el.innerHTML =
          '<div class="stars" aria-label="Note ' + t.note + ' sur 5">' + BCI.etoiles(t.note) + '</div>' +
          '<p>« ' + escapeHtml(t.texte) + ' »</p>' +
          '<div class="testimonial__author">' +
            '<span class="avatar" aria-hidden="true">' + t.nom.charAt(0) + '</span>' +
            '<span><b>' + escapeHtml(t.nom) + '</b><small>' + escapeHtml(t.ville) + '</small></span>' +
          '</div>';
        temoins.appendChild(el);
      });
    }
    // Re-scan des reveal ajoutés dynamiquement
    initReveal();
  }

  /* ---------------------------------------------------------------
   * Onglets génériques (tableau de bord, bascule connexion/inscription)
   * Container = [data-tabs] ; boutons = [data-tab="cible"] ; panneaux = #cible
   * ------------------------------------------------------------- */
  function initTabs() {
    $$('[data-tabs]').forEach(function (group) {
      const btns = $$('[data-tab]', group);
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          const cible = btn.dataset.tab;
          btns.forEach(function (b) { b.classList.toggle('is-active', b === btn); });
          const scope = group.dataset.tabsScope ? document.querySelector(group.dataset.tabsScope) : document;
          $$('.dash-panel, .auth-panel', scope).forEach(function (p) {
            p.classList.toggle('is-active', p.id === cible);
          });
        });
      });
    });
  }

  /* ---------------------------------------------------------------
   * Formulaire partenaire (inscription établissement)
   * ------------------------------------------------------------- */
  function initPartnerForm() {
    const form = $('#partner-form');
    if (!form) return;

    // Remplit le select des villes
    const villeSel = $('#p-ville');
    if (villeSel) {
      BCI.VILLES.forEach(function (v) {
        const o = document.createElement('option'); o.value = v.nom; o.textContent = v.nom; villeSel.appendChild(o);
      });
    }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!window.BCValidation.validerFormulaire(form)) {
        toast('Merci de corriger les champs en rouge.');
        return;
      }
      // En prod : POST /api/etablissements (multipart pour les photos)
      const btn = $('#p-submit');
      btn.disabled = true; btn.textContent = 'Envoi…';
      setTimeout(function () {
        btn.disabled = false; btn.textContent = 'Publier mon établissement';
        form.reset();
        const ok = $('#partner-success');
        if (ok) { ok.classList.remove('hidden'); ok.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        toast('Établissement soumis ! Notre équipe le validera sous 24h.', 'ok');
      }, 900);
    });
  }

  /* ---------------------------------------------------------------
   * Espace client — favoris + historique (démo)
   * ------------------------------------------------------------- */
  function initClientSpace() {
    const favWrap = $('#client-favoris');
    if (favWrap) {
      const ids = getFavoris();
      const all = BCI.RESTAURANTS.concat(BCI.RESIDENCES);
      const favs = all.filter(function (e) { return ids.indexOf(e.id) !== -1; });
      if (!favs.length) {
        favWrap.innerHTML = '<div class="empty-state"><div class="emoji">🤍</div><p class="muted">Aucun favori pour le moment. Parcourez les établissements et cliquez sur le cœur.</p></div>';
      } else {
        favs.forEach(function (e) { favWrap.appendChild(carteEtablissement(e)); });
        initReveal();
      }
    }

    const histoBody = $('#client-historique');
    if (histoBody) {
      let panier = [];
      try { panier = JSON.parse(sessionStorage.getItem('bookingci_panier')) || []; } catch (e) {}
      if (!panier.length) {
        histoBody.innerHTML = '<tr><td colspan="4" class="muted" style="text-align:center;padding:2rem">Aucune réservation. Vos réservations récentes apparaîtront ici.</td></tr>';
      } else {
        histoBody.innerHTML = panier.slice().reverse().map(function (r) {
          const quand = r.type === 'residence' ? (r.debut + ' → ' + r.fin) : (r.debut + ' à ' + (r.heure || ''));
          return '<tr><td><strong>' + escapeHtml(r.etablissement) + '</strong></td>' +
            '<td>' + quand + '</td>' +
            '<td>' + BCI.formatFCFA(r.montant) + '</td>' +
            '<td><span class="status status--ok">Confirmée</span></td></tr>';
        }).join('');
      }
    }
  }

  /* ---------------------------------------------------------------
   * Auth (connexion / inscription) — soumission de démo
   * ------------------------------------------------------------- */
  function initAuth() {
    $$('form[data-auth]').forEach(function (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (!window.BCValidation.validerFormulaire(form)) return;
        // En prod : POST /api/auth/login ou /api/auth/register
        toast(form.dataset.auth === 'register' ? 'Compte créé ! Bienvenue sur BookingCI.' : 'Connexion réussie ✅', 'ok');
        const space = $('#client-space');
        if (space) {
          space.classList.remove('hidden');
          initClientSpace();
          space.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  /* ---------------------------------------------------------------
   * Année dynamique dans le footer
   * ------------------------------------------------------------- */
  function initFooterYear() {
    const y = $('#year');
    if (y) y.textContent = new Date().getFullYear();
  }

  /* ---------------------------------------------------------------
   * Validation de formulaires (réutilisable — inscription, contact…)
   *
   * Règles déclaratives via attributs data-* / HTML5 :
   *   required, type=email, type=tel, minlength, data-match="#autreChamp"
   * Renvoie true si le formulaire est valide, sinon affiche les erreurs.
   * ------------------------------------------------------------- */
  const REGEX = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    // Numéros ivoiriens : +225 suivi de 10 chiffres, ou 10 chiffres locaux
    tel: /^(\+?225)?\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/
  };

  function messageErreur(champ) {
    if (champ.validity && champ.value === '' && champ.hasAttribute('required')) return 'Ce champ est requis.';
    if (champ.type === 'email') return 'Adresse e-mail invalide.';
    if (champ.dataset.type === 'tel' || champ.type === 'tel') return 'Numéro de téléphone invalide (ex. +225 07 00 00 00 00).';
    if (champ.hasAttribute('minlength')) return 'Trop court (min. ' + champ.getAttribute('minlength') + ' caractères).';
    if (champ.dataset.match) return 'Les deux valeurs ne correspondent pas.';
    return 'Valeur invalide.';
  }

  function validerChamp(champ) {
    let valide = true;
    const val = (champ.value || '').trim();
    if (champ.hasAttribute('required') && !val) valide = false;
    else if (val) {
      if (champ.type === 'email' && !REGEX.email.test(val)) valide = false;
      if ((champ.type === 'tel' || champ.dataset.type === 'tel') && !REGEX.tel.test(val)) valide = false;
      if (champ.hasAttribute('minlength') && val.length < parseInt(champ.getAttribute('minlength'), 10)) valide = false;
      if (champ.dataset.match) {
        const autre = document.querySelector(champ.dataset.match);
        if (autre && autre.value !== champ.value) valide = false;
      }
    }
    const field = champ.closest('.field') || champ.parentElement;
    if (field) {
      field.classList.toggle('has-error', !valide);
      let err = field.querySelector('.field-error');
      if (!valide) {
        if (!err) { err = document.createElement('small'); err.className = 'field-error'; field.appendChild(err); }
        err.textContent = messageErreur(champ);
      }
    }
    return valide;
  }

  function validerFormulaire(form) {
    let ok = true;
    $$('input, select, textarea', form).forEach(function (champ) {
      if (champ.type === 'hidden' || champ.disabled) return;
      if (champ.hasAttribute('required') || champ.value) {
        if (!validerChamp(champ)) ok = false;
      }
    });
    if (!ok) {
      const first = $('.has-error', form);
      if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
    return ok;
  }

  // Validation en direct au blur
  function initValidationLive() {
    $$('form[data-validate]').forEach(function (form) {
      $$('input, select, textarea', form).forEach(function (champ) {
        champ.addEventListener('blur', function () {
          if (champ.hasAttribute('required') || champ.value) validerChamp(champ);
        });
      });
    });
  }

  window.BCValidation = {
    validerFormulaire: validerFormulaire,
    validerChamp: validerChamp
  };

  /* ---------------------------------------------------------------
   * Exposition de quelques helpers pour les autres modules
   * ------------------------------------------------------------- */
  window.BCUI = {
    $: $, $$: $$,
    toast: toast,
    carteEtablissement: carteEtablissement,
    getFavoris: getFavoris,
    toggleFavori: toggleFavori,
    initReveal: initReveal,
    escapeHtml: escapeHtml,
    hash: hash
  };

  /* ---------------------------------------------------------------
   * Initialisation
   * ------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    initReveal();
    initFooterYear();
    initQuickSearch();
    initHomeSections();
    initValidationLive();
    initTabs();
    initPartnerForm();
    initAuth();
    initClientSpace();
  });

})();
