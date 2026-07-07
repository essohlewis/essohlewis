/* =====================================================================
   SAMSON BOUTIQUE — Sécurité front ("sécurité dynamique")
   ---------------------------------------------------------------------
   Validation, sanitisation, anti-XSS, jeton anti-rejeu, masquage,
   rate-limiting. Aucun backend : ces contrôles UX ne remplacent PAS
   une vérification serveur (voir les // TODO backend).
   ===================================================================== */
(function () {
  'use strict';

  /* ---- Échappement HTML (anti-XSS lors de l'injection DOM) ---- */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---- Nettoyage d'une saisie utilisateur ---- */
  function sanitize(str, maxLen = 200) {
    if (str == null) return '';
    return String(str).trim().replace(/[<>]/g, '').slice(0, maxLen);
  }

  /* ---- Opérateurs mobiles CI selon préfixe ---- */
  const OPERATEURS = {
    '07': 'Orange', '08': 'Orange', '09': 'Orange',
    '05': 'MTN', '06': 'MTN', '04': 'MTN',
    '01': 'Moov', '02': 'Moov', '03': 'Moov'
  };

  /* ---- Validation numéro de téléphone CI ---- */
  function validerTelephone(numero) {
    // Accepte : 0700000000, +2250700000000, avec espaces
    const clean = String(numero).replace(/[\s.+-]/g, '');
    const local = clean.replace(/^225/, '');
    if (!/^0\d{9}$/.test(local)) {
      return { valide: false, message: 'Numéro invalide (10 chiffres, ex : 07 00 00 00 00)' };
    }
    const prefixe = local.slice(0, 2);
    return { valide: true, local, prefixe, operateur: OPERATEURS[prefixe] || 'Mobile' };
  }

  /* ---- Vérifie que le numéro correspond à l'opérateur du moyen de paiement ---- */
  function numeroPourMoyen(numero, moyen) {
    const v = validerTelephone(numero);
    if (!v.valide) return v;
    const attendu = { orange: 'Orange', mtn: 'MTN', moov: 'Moov' };
    if (moyen === 'wave' || moyen === 'cod') return v; // Wave accepte tout mobile CI
    if (attendu[moyen] && v.operateur !== attendu[moyen]) {
      return { valide: false, message: `Ce numéro n'est pas un numéro ${attendu[moyen]} (préfixe attendu différent).` };
    }
    return v;
  }

  /* ---- Validation email ---- */
  function validerEmail(email) {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
    return { valide: ok, message: ok ? '' : 'Adresse e-mail invalide' };
  }

  /* ---- Masquage partiel du téléphone : 07 ** ** ** 89 ---- */
  function masquerTel(numero) {
    const v = validerTelephone(numero);
    if (!v.valide) return numero;
    const n = v.local;
    return `${n.slice(0, 2)} ** ** ** ${n.slice(8)}`;
  }

  /* ---- Jeton anti-rejeu (une soumission de checkout unique) ---- */
  function genererJetonCheckout() {
    const token = 'chk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    SB.store.session.set('checkout_token', token);
    return token;
  }
  function jetonValide(token) {
    return token && SB.store.session.get('checkout_token') === token;
  }
  function consommerJeton() {
    // TODO backend : le serveur doit invalider ce jeton pour empêcher le double paiement
    SB.store.session.remove('checkout_token');
  }

  /* ---- Rate-limiting front (anti double-clic / cooldown) ---- */
  const _cooldowns = {};
  function rateLimit(cle, ms = 3000) {
    const now = Date.now();
    if (_cooldowns[cle] && now - _cooldowns[cle] < ms) {
      return { autorise: false, resteMs: ms - (now - _cooldowns[cle]) };
    }
    _cooldowns[cle] = now;
    return { autorise: true };
  }

  /* ---- ID de transaction & numéro de commande ---- */
  function genererNumeroCommande() {
    const rnd = Math.floor(1000 + Math.random() * 9000);
    return `SB-${new Date().getFullYear()}-${rnd}`;
  }
  function genererTransactionId() {
    return 'TX' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  SB.security = {
    escapeHtml, sanitize, validerTelephone, numeroPourMoyen, validerEmail,
    masquerTel, genererJetonCheckout, jetonValide, consommerJeton, rateLimit,
    genererNumeroCommande, genererTransactionId, OPERATEURS
  };
})();
