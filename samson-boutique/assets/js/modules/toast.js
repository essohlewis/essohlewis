/* =====================================================================
   SAMSON BOUTIQUE — Système de toasts réutilisable
   ===================================================================== */
(function () {
  'use strict';

  function zone() {
    let z = document.getElementById('toast-zone');
    if (!z) {
      z = document.createElement('div');
      z.id = 'toast-zone';
      z.setAttribute('aria-live', 'polite');
      z.setAttribute('aria-atomic', 'false');
      document.body.appendChild(z);
    }
    return z;
  }

  const ICONS = { succes: '✅', erreur: '⛔', info: 'ℹ️' };

  function toast(message, type = 'succes', titre = null, duree = 3600) {
    const esc = SB.security.escapeHtml;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.setAttribute('role', 'status');
    const titres = { succes: 'Succès', erreur: 'Erreur', info: 'Info' };
    el.innerHTML =
      `<div class="t-ico">${ICONS[type] || 'ℹ️'}</div>
       <div class="t-body">
         <div class="t-title">${esc(titre || titres[type])}</div>
         <div class="t-msg">${esc(message)}</div>
       </div>
       <button class="t-close" aria-label="Fermer">&times;</button>`;
    zone().appendChild(el);

    const close = () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    };
    el.querySelector('.t-close').addEventListener('click', close);
    if (duree > 0) setTimeout(close, duree);
    return el;
  }

  SB.toast = toast;
  SB.toastSucces = (m, t) => toast(m, 'succes', t);
  SB.toastErreur = (m, t) => toast(m, 'erreur', t);
  SB.toastInfo   = (m, t) => toast(m, 'info', t);
})();
