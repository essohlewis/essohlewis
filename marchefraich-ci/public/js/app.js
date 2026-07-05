/* MarchéFraîch CI — script client léger (aucune dépendance) */

(function () {
  'use strict';

  // --- Enregistrement du service worker (PWA installable) ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').catch(function () {
        /* échec silencieux : l'app fonctionne sans le SW */
      });
    });
  }

  // --- Boutons +/- de quantité ---
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-qte]');
    if (!btn) return;
    var champ = document.getElementById(btn.getAttribute('data-cible'));
    if (!champ) return;
    var pas = btn.getAttribute('data-qte') === 'plus' ? 1 : -1;
    var val = Math.max(1, (parseInt(champ.value, 10) || 1) + pas);
    champ.value = val;
    if (champ.form && champ.dataset.autosubmit === '1') {
      champ.form.submit();
    }
  });

  // --- Confirmation avant suppression ---
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.dataset.confirmer && !window.confirm(form.dataset.confirmer)) {
      e.preventDefault();
    }
  });

  // --- Suivi de commande : rafraîchissement automatique du statut ---
  var suivi = document.querySelector('[data-suivi-url]');
  if (suivi) {
    var url = suivi.getAttribute('data-suivi-url');
    var interroger = function () {
      fetch(url, { headers: { 'X-Requested-With': 'fetch' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          var badge = document.getElementById('statut-actuel');
          if (badge && badge.dataset.statut !== data.statut) {
            location.reload(); // le statut a changé : on rafraîchit la timeline
          }
        })
        .catch(function () {});
    };
    setInterval(interroger, 15000);
  }
})();
