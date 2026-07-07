/* =====================================================================
   SAMSON BOUTIQUE — Module de paiement (simulation Côte d'Ivoire)
   ---------------------------------------------------------------------
   ⚠️ ARCHITECTURE PRÊTE POUR LA PROD
   Toute la logique de paiement est isolée ici. `processPayment(method,
   payload)` retourne une Promise. Aujourd'hui elle résout une simulation ;
   demain, remplacez le corps par un appel à CinetPay / PayDunya / API
   opérateur SANS toucher au reste du code (checkout.js).
   ===================================================================== */
(function () {
  'use strict';

  const MOYENS = {
    wave:   { nom: 'Wave',         cls: 'wave',   logo: 'Wave',   desc: 'Payez avec votre application Wave', ussd: null,      instruction: 'Ouvrez votre application Wave et confirmez le paiement.' },
    orange: { nom: 'Orange Money', cls: 'orange', logo: 'Orange', desc: 'Numéros commençant par 07',         ussd: '#144#',   instruction: 'Composez #144# puis validez avec votre code Orange Money.' },
    mtn:    { nom: 'MTN MoMo',     cls: 'mtn',    logo: 'MTN',    desc: 'Numéros commençant par 05',         ussd: null,      instruction: 'Une demande de paiement a été envoyée sur votre téléphone. Validez-la.' },
    moov:   { nom: 'Moov Money',   cls: 'moov',   logo: 'Moov',   desc: 'Numéros commençant par 01',         ussd: '*155#',   instruction: 'Composez *155# puis validez avec votre code Moov Money.' },
    cod:    { nom: 'Paiement à la livraison', cls: 'cod', logo: 'Cash', desc: 'Payez en espèces à la réception', ussd: null, instruction: 'Vous réglerez votre commande en espèces au livreur.' }
  };

  /**
   * processPayment(method, payload) → Promise<{ success, transactionId, ... }>
   * @param {string} method  wave|orange|mtn|moov|cod
   * @param {object} payload { montant, telephone, commande }
   *
   * TODO backend : remplacer la simulation ci-dessous par :
   *   const res = await fetch('/api/payments', { method:'POST', body: JSON.stringify(payload) });
   *   → l'API opérateur renverra un statut réel + webhook de confirmation.
   */
  function processPayment(method, payload) {
    return new Promise((resolve, reject) => {
      const moyen = MOYENS[method];
      if (!moyen) return reject(new Error('Moyen de paiement inconnu'));

      // Paiement à la livraison : validation immédiate
      if (method === 'cod') {
        return setTimeout(() => resolve(finTransaction(method)), 900);
      }

      // Validation du numéro selon l'opérateur (sécurité front)
      const v = SB.security.numeroPourMoyen(payload.telephone, method);
      if (!v.valide) return reject(new Error(v.message));

      // Simulation d'un délai réseau opérateur (2 à 3 s)
      const delai = 2000 + Math.random() * 1200;
      setTimeout(() => {
        // Simulation : 97% de réussite (démo). Le vrai statut viendra de l'API.
        if (Math.random() < 0.97) resolve(finTransaction(method, v));
        else reject(new Error('Paiement refusé par l\'opérateur. Vérifiez votre solde et réessayez.'));
      }, delai);
    });
  }

  function finTransaction(method, v) {
    return {
      success: true,
      method,
      moyen: MOYENS[method].nom,
      transactionId: SB.security.genererTransactionId(),
      operateur: v ? v.operateur : null,
      horodatage: new Date().toISOString()
    };
  }

  SB.payment = { processPayment, MOYENS };
})();
