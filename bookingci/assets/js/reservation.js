/* =====================================================================
 * BookingCI — reservation.js
 * Logique de la fiche établissement :
 *   - Chargement de l'établissement (?id=…)
 *   - Galerie / carousel photo (sans dépendance externe)
 *   - Calendrier interactif + simulateur de disponibilité
 *   - Widget de réservation (calcul du prix, validation, panier)
 *   - Panier de réservation en mémoire + sessionStorage
 *   - Points d'intégration fetch() vers la future API
 *
 * Séparation métier / DOM : les calculs (prix, dates, validation) sont
 * isolés dans des fonctions pures ; le rendu DOM est regroupé à part.
 * ===================================================================== */

(function () {
  'use strict';

  const BCI = window.BookingCI;
  const UI = window.BCUI;
  const $ = UI.$, $$ = UI.$$;

  if (!document.body.dataset.page || document.body.dataset.page !== 'fiche') return;

  let etab = null;               // établissement courant
  let indisponibles = [];        // dates bloquées (YYYY-MM-DD)
  const selection = { debut: null, fin: null, heure: null };

  /* =============================================================
   * 1. Fonctions métier PURES (facilement testables)
   * =========================================================== */

  // Nombre de nuits entre deux dates ISO
  function nbNuits(debutISO, finISO) {
    if (!debutISO || !finISO) return 0;
    const d1 = new Date(debutISO), d2 = new Date(finISO);
    return Math.max(0, Math.round((d2 - d1) / 86400000));
  }

  // Calcul du montant total selon le type d'établissement
  function calculerMontant(e, sel, personnes) {
    if (!e) return { base: 0, frais: 0, total: 0, detail: '' };
    let base, detail;
    if (e.type === 'residence') {
      const nuits = nbNuits(sel.debut, sel.fin);
      base = e.prix * nuits;
      detail = nuits + ' nuit' + (nuits > 1 ? 's' : '') + ' × ' + BCI.formatFCFA(e.prix);
    } else {
      // Restaurant : acompte forfaitaire par personne pour garantir la table
      const nb = personnes || 1;
      base = e.prix * nb;
      detail = nb + ' couvert' + (nb > 1 ? 's' : '') + ' × ' + BCI.formatFCFA(e.prix);
    }
    const frais = 0; // « sans frais cachés »
    return { base: base, frais: frais, total: base + frais, detail: detail };
  }

  // Validation métier de la sélection
  function validerReservation(e, sel, personnes) {
    const erreurs = [];
    if (!personnes || personnes < 1) erreurs.push('Indiquez le nombre de personnes.');
    if (e.type === 'residence') {
      if (!sel.debut) erreurs.push("Choisissez une date d'arrivée.");
      if (!sel.fin) erreurs.push('Choisissez une date de départ.');
      if (sel.debut && sel.fin && nbNuits(sel.debut, sel.fin) < 1) erreurs.push('Le départ doit être après l\'arrivée.');
    } else {
      if (!sel.debut) erreurs.push('Choisissez une date.');
      if (!sel.heure) erreurs.push('Choisissez une heure.');
    }
    return erreurs;
  }

  /* =============================================================
   * 2. Panier de réservation (sessionStorage)
   *    En prod : POST /api/reservations
   * =========================================================== */
  const PANIER_KEY = 'bookingci_panier';

  function lirePanier() {
    try { return JSON.parse(sessionStorage.getItem(PANIER_KEY)) || []; }
    catch (e) { return []; }
  }
  function ajouterAuPanier(resa) {
    const panier = lirePanier();
    panier.push(resa);
    try { sessionStorage.setItem(PANIER_KEY, JSON.stringify(panier)); } catch (e) {}
    return panier;
  }

  /* =============================================================
   * 3. Chargement des données (fetch simulé)
   * =========================================================== */
  function getId() {
    return new URLSearchParams(window.location.search).get('id');
  }

  function charger() {
    const id = getId();
    // En prod : fetch('/api/etablissements/' + id).then(r => r.json())
    BCI.api.getEtablissement(id).then(function (data) {
      if (!data) { afficherIntrouvable(); return; }
      etab = data;
      return BCI.api.getDisponibilites(id);
    }).then(function (dispo) {
      if (dispo) indisponibles = dispo.indisponibles || [];
      if (etab) rendreFiche();
    });
  }

  function afficherIntrouvable() {
    const main = $('#fiche-root');
    if (main) {
      main.innerHTML =
        '<div class="empty-state"><div class="emoji">🏚️</div>' +
        '<h2>Établissement introuvable</h2>' +
        '<p class="muted">Ce lien est peut-être expiré.</p>' +
        '<a class="btn btn--primary" href="restaurants.html">Voir les restaurants</a></div>';
    }
  }

  /* =============================================================
   * 4. Rendu de la fiche
   * =========================================================== */
  function rendreFiche() {
    document.title = etab.nom + ' — BookingCI';

    // Fil d'ariane + titre
    const typeLabel = etab.type === 'restaurant' ? 'Restaurants' : 'Résidences';
    const typeHref = etab.type === 'restaurant' ? 'restaurants.html' : 'residences.html';
    $('#bc-type').textContent = typeLabel;
    $('#bc-type').setAttribute('href', typeHref);
    $('#bc-nom').textContent = etab.nom;

    $('#fiche-titre').textContent = etab.nom;
    $('#fiche-note').innerHTML =
      '<span class="stars" aria-hidden="true">' + BCI.etoiles(etab.note) + '</span> ' +
      '<strong>' + etab.note.toFixed(1) + '</strong> <span class="muted">(' + etab.avis + ' avis)</span>';
    $('#fiche-lieu').textContent = '📍 ' + etab.adresse;
    $('#fiche-tag').textContent = etab.type === 'restaurant' ? (etab.cuisine + ' · Restaurant') : (etab.categorie + ' · ' + etab.chambres + ' ch.');

    rendreGalerie();
    $('#fiche-description').textContent = etab.description;
    rendreSpecs();
    rendreEquipements();
    rendreCarte();
    rendreAvis();
    initWidget();
  }

  // --- Galerie / carousel ---
  function rendreGalerie() {
    const track = $('#gallery-track');
    const dots = $('#gallery-dots');
    // Génère 4 « photos » placeholder cohérentes
    const slides = [0, 1, 2, 3].map(function (i) {
      return BCI.placeholder(etab.nom + ' — vue ' + (i + 1), UI.hash(etab.id) + i * 7, etab.icone);
    });
    track.innerHTML = slides.map(function (src, i) {
      return '<div class="gallery__slide"><img src="' + src + '" alt="' + UI.escapeHtml(etab.nom) + ' — photo ' + (i + 1) + '"></div>';
    }).join('');
    dots.innerHTML = slides.map(function (_, i) {
      return '<button aria-label="Photo ' + (i + 1) + '" data-slide="' + i + '"' + (i === 0 ? ' class="is-active"' : '') + '></button>';
    }).join('');

    let index = 0;
    const total = slides.length;
    function aller(i) {
      index = (i + total) % total;
      track.style.transform = 'translateX(-' + (index * 100) + '%)';
      $$('#gallery-dots button').forEach(function (d, di) { d.classList.toggle('is-active', di === index); });
    }
    $('#gallery-prev').addEventListener('click', function () { aller(index - 1); });
    $('#gallery-next').addEventListener('click', function () { aller(index + 1); });
    $$('#gallery-dots button').forEach(function (d) {
      d.addEventListener('click', function () { aller(parseInt(d.dataset.slide, 10)); });
    });
    // Navigation clavier
    const gal = $('#gallery');
    gal.setAttribute('tabindex', '0');
    gal.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowLeft') aller(index - 1);
      if (ev.key === 'ArrowRight') aller(index + 1);
    });
  }

  // --- Caractéristiques ---
  function rendreSpecs() {
    const wrap = $('#fiche-specs');
    let specs = [];
    if (etab.type === 'residence') {
      specs = [
        { ico: '🛏️', txt: etab.chambres + ' chambre' + (etab.chambres > 1 ? 's' : '') },
        { ico: '👥', txt: "Jusqu'à " + etab.capacite + ' pers.' },
        { ico: '📐', txt: etab.surface + ' m²' },
        { ico: '🏷️', txt: etab.categorie }
      ];
    } else {
      specs = [
        { ico: '🍴', txt: etab.cuisine },
        { ico: '👥', txt: etab.capacite + ' couverts' },
        { ico: '🕒', txt: etab.horaires },
        { ico: '💳', txt: 'Mobile Money' }
      ];
    }
    wrap.innerHTML = specs.map(function (s) {
      return '<div class="spec"><span class="ico">' + s.ico + '</span><span>' + UI.escapeHtml(s.txt) + '</span></div>';
    }).join('');
  }

  function rendreEquipements() {
    const ul = $('#fiche-equipements');
    ul.innerHTML = (etab.equipements || []).map(function (eq) {
      return '<li>✓ ' + UI.escapeHtml(eq) + '</li>';
    }).join('');
  }

  function rendreCarte() {
    $('#fiche-carte-txt').textContent = etab.adresse;
  }

  function rendreAvis() {
    // Avis de démonstration générés (en prod : GET /api/etablissements/:id/avis)
    const noms = ['Aminata', 'Yao', 'Grace', 'Ibrahim', 'Chantal'];
    const textes = [
      'Accueil chaleureux et service rapide, je recommande vivement.',
      'Très bon rapport qualité-prix, conforme aux photos.',
      'Cadre agréable et propre. Nous reviendrons avec plaisir.',
      'Réservation simple et confirmation immédiate. Parfait.'
    ];
    const wrap = $('#fiche-avis');
    const n = 3;
    let html = '';
    for (let i = 0; i < n; i++) {
      const note = 4 + (i % 2);
      html +=
        '<article class="review">' +
          '<div class="review__head">' +
            '<span class="avatar" aria-hidden="true">' + noms[i].charAt(0) + '</span>' +
            '<div><b>' + noms[i] + '</b><br><span class="stars">' + BCI.etoiles(note) + '</span></div>' +
          '</div>' +
          '<p>' + textes[i % textes.length] + '</p>' +
        '</article>';
    }
    wrap.innerHTML = html;
  }

  /* =============================================================
   * 5. Widget de réservation
   * =========================================================== */
  function initWidget() {
    const isResidence = etab.type === 'residence';

    // Libellé prix
    $('#w-prix').textContent = BCI.formatFCFA(etab.prix);
    $('#w-prix-unite').textContent = isResidence ? '/ nuit' : '/ couvert';

    // Champs conditionnels
    $('#w-heure-field').classList.toggle('hidden', isResidence);
    $('#w-date2-field').classList.toggle('hidden', !isResidence);
    $('#w-date1-label').textContent = isResidence ? 'Arrivée' : 'Date';

    // Calendrier
    buildCalendar();

    // Personnes
    const persInput = $('#w-personnes');
    persInput.addEventListener('input', majResume);

    // Heure (restaurant)
    if (!isResidence) {
      const heureSel = $('#w-heure');
      ['12:00', '12:30', '13:00', '19:00', '19:30', '20:00', '20:30', '21:00'].forEach(function (h) {
        const o = document.createElement('option'); o.value = h; o.textContent = h; heureSel.appendChild(o);
      });
      heureSel.addEventListener('change', function () { selection.heure = heureSel.value; majResume(); });
    }

    // Moyens de paiement
    const payWrap = $('#w-paiement');
    BCI.MOYENS_PAIEMENT.forEach(function (m, i) {
      const id = 'pay-' + m.id;
      payWrap.insertAdjacentHTML('beforeend',
        '<label><input type="radio" name="paiement" value="' + m.id + '"' + (i === 0 ? ' checked' : '') + '>' +
        '<span>' + m.nom + '</span></label>');
    });

    // Soumission
    $('#w-form').addEventListener('submit', soumettre);
    majResume();
  }

  function majResume() {
    const personnes = parseInt($('#w-personnes').value, 10) || 0;
    const montant = calculerMontant(etab, selection, personnes);
    const box = $('#w-resume');
    if (!montant.total) {
      box.innerHTML = '<p class="muted" style="margin:0">Sélectionnez vos dates pour voir le total.</p>';
      return;
    }
    box.innerHTML =
      '<div class="row"><span>' + montant.detail + '</span><span>' + BCI.formatFCFA(montant.base) + '</span></div>' +
      '<div class="row"><span>Frais de service</span><span>' + BCI.formatFCFA(montant.frais) + ' 🎉</span></div>' +
      '<div class="row total"><span>Total à régler</span><span>' + BCI.formatFCFA(montant.total) + '</span></div>';
  }

  function soumettre(ev) {
    ev.preventDefault();
    const personnes = parseInt($('#w-personnes').value, 10) || 0;
    const erreurs = validerReservation(etab, selection, personnes);
    if (erreurs.length) { UI.toast(erreurs[0]); return; }

    const montant = calculerMontant(etab, selection, personnes);
    const paiement = (document.querySelector('input[name="paiement"]:checked') || {}).value;
    const resa = {
      etablissementId: etab.id,
      etablissement: etab.nom,
      type: etab.type,
      debut: selection.debut,
      fin: selection.fin,
      heure: selection.heure,
      personnes: personnes,
      montant: montant.total,
      paiement: paiement,
      creeLe: new Date().toISOString()
    };

    // En prod :
    // fetch('/api/reservations', { method:'POST',
    //   headers:{'Content-Type':'application/json'},
    //   body: JSON.stringify(resa) }).then(...)
    ajouterAuPanier(resa);

    const btn = $('#w-submit');
    btn.disabled = true; btn.textContent = 'Traitement…';
    setTimeout(function () {
      btn.disabled = false; btn.textContent = 'Réserver maintenant';
      const rec = etab.type === 'residence'
        ? selection.debut + ' → ' + selection.fin
        : selection.debut + ' à ' + selection.heure;
      UI.toast('Réservation enregistrée · ' + rec + ' · ' + BCI.formatFCFA(montant.total), 'ok');
      $('#w-confirm').classList.remove('hidden');
      $('#w-confirm').innerHTML =
        '<div class="alert alert--ok">✅ Demande envoyée à <strong>' + UI.escapeHtml(etab.nom) +
        '</strong>. Vous recevrez une confirmation par SMS. Paiement prévu via ' +
        UI.escapeHtml(nomPaiement(paiement)) + '.</div>';
    }, 900);
  }

  function nomPaiement(id) {
    const m = BCI.MOYENS_PAIEMENT.find(function (x) { return x.id === id; });
    return m ? m.nom : 'Mobile Money';
  }

  /* =============================================================
   * 6. Calendrier interactif (mois courant + suivant navigables)
   * =========================================================== */
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
    'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const JOURS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

  let calRef = new Date();
  calRef.setDate(1);

  function buildCalendar() {
    const cal = $('#w-calendar');
    cal.innerHTML =
      '<div class="calendar__head">' +
        '<button type="button" id="cal-prev" aria-label="Mois précédent">‹</button>' +
        '<span class="calendar__title" id="cal-title"></span>' +
        '<button type="button" id="cal-next" aria-label="Mois suivant">›</button>' +
      '</div>' +
      '<div class="calendar__grid" id="cal-grid"></div>';
    $('#cal-prev').addEventListener('click', function () { changerMois(-1); });
    $('#cal-next').addEventListener('click', function () { changerMois(1); });
    dessinerMois();
  }

  function changerMois(delta) {
    const debutMoisCourant = new Date();
    debutMoisCourant.setDate(1);
    debutMoisCourant.setHours(0, 0, 0, 0);
    const cible = new Date(calRef);
    cible.setMonth(cible.getMonth() + delta);
    // Empêche de remonter avant le mois courant
    if (cible < debutMoisCourant) return;
    calRef = cible;
    dessinerMois();
  }

  function iso(d) { return d.toISOString().slice(0, 10); }

  function dessinerMois() {
    $('#cal-title').textContent = MOIS[calRef.getMonth()] + ' ' + calRef.getFullYear();
    const grid = $('#cal-grid');
    let html = JOURS.map(function (j) { return '<div class="calendar__dow">' + j + '</div>'; }).join('');

    const premier = new Date(calRef.getFullYear(), calRef.getMonth(), 1);
    // Lundi = 0
    let decalage = (premier.getDay() + 6) % 7;
    for (let i = 0; i < decalage; i++) html += '<div class="calendar__day is-empty"></div>';

    const nbJours = new Date(calRef.getFullYear(), calRef.getMonth() + 1, 0).getDate();
    const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);

    for (let j = 1; j <= nbJours; j++) {
      const d = new Date(calRef.getFullYear(), calRef.getMonth(), j);
      const dISO = iso(d);
      const passe = d < aujourdhui;
      const bloque = indisponibles.indexOf(dISO) !== -1;
      const cls = ['calendar__day'];
      if (dISO === iso(aujourdhui)) cls.push('is-today');
      if (selection.debut === dISO || selection.fin === dISO) cls.push('is-selected');
      else if (dansRange(dISO)) cls.push('is-range');
      html += '<button type="button" class="' + cls.join(' ') + '" data-date="' + dISO + '"' +
        ((passe || bloque) ? ' disabled' : '') + '>' + j + '</button>';
    }
    grid.innerHTML = html;
    $$('#cal-grid .calendar__day[data-date]').forEach(function (btn) {
      btn.addEventListener('click', function () { choisirDate(btn.dataset.date); });
    });
  }

  function dansRange(dISO) {
    if (etab.type !== 'residence' || !selection.debut || !selection.fin) return false;
    return dISO > selection.debut && dISO < selection.fin;
  }

  function choisirDate(dISO) {
    if (etab.type === 'residence') {
      // Sélection d'une plage arrivée -> départ
      if (!selection.debut || (selection.debut && selection.fin)) {
        selection.debut = dISO; selection.fin = null;
      } else if (dISO > selection.debut) {
        selection.fin = dISO;
      } else {
        selection.debut = dISO; selection.fin = null;
      }
    } else {
      selection.debut = dISO; // date unique
    }
    // Met à jour les libellés lisibles
    $('#w-date1-val').textContent = selection.debut ? formatDateFr(selection.debut) : '—';
    if ($('#w-date2-val')) $('#w-date2-val').textContent = selection.fin ? formatDateFr(selection.fin) : '—';
    dessinerMois();
    majResume();
  }

  function formatDateFr(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /* =============================================================
   * 7. Formulaire de contact établissement
   * =========================================================== */
  function initContact() {
    const form = $('#contact-form');
    if (!form) return;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!window.BCValidation || window.BCValidation.validerFormulaire(form)) {
        UI.toast('Message envoyé à l\'établissement ✅', 'ok');
        form.reset();
      }
    });
  }

  /* =============================================================
   * Démarrage
   * =========================================================== */
  charger();
  document.addEventListener('DOMContentLoaded', initContact);

  // Exposition pour tests
  window.BCReservation = {
    nbNuits: nbNuits,
    calculerMontant: calculerMontant,
    validerReservation: validerReservation
  };

})();
