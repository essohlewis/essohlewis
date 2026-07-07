/* =====================================================================
   SAMSON BOUTIQUE — Tunnel de commande multi-étapes
   ---------------------------------------------------------------------
   Étapes : 1) Coordonnées  2) Livraison  3) Paiement  4) Confirmation
   Utilise SB.payment.processPayment() (module isolé, prêt pour la prod).
   ===================================================================== */
(function () {
  'use strict';

  const esc = s => SB.security.escapeHtml(s);
  let etape = 1;
  let data = { nom: '', tel: '', email: '', zone: '', adresse: '', repere: '', moyen: null, telPay: '' };
  let jeton = null;

  const $ = id => document.getElementById(id);

  function goStep(n) {
    etape = n;
    document.querySelectorAll('.checkout-step').forEach(s => s.classList.remove('active'));
    const el = $('step-' + n); if (el) el.classList.add('active');
    document.querySelectorAll('.step-chip').forEach((c, i) => {
      c.classList.toggle('active', i + 1 === n);
      c.classList.toggle('done', i + 1 < n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderSummary();
  }

  /* ---- Récapitulatif (colonne de droite) ---- */
  function renderSummary() {
    const box = $('order-summary-body');
    if (!box) return;
    const items = SB.cart.items();
    const t = SB.cart.totaux(data.zone || null);
    box.innerHTML =
      items.map(l => {
        const p = SB.getProduit(l.id); if (!p) return '';
        const vl = SB.cart.varLabel(l.variante);
        return `<div class="os-line">
          <img src="${SB.produitImage(p)}" alt="">
          <div><div class="os-nom">${esc(p.nom)}</div><div class="os-q">${vl ? esc(vl) + ' · ' : ''}Qté ${l.qty}</div></div>
          <div class="os-p">${SB.formatPrix(SB.prixEffectif(p) * l.qty)}</div>
        </div>`;
      }).join('') +
      `<div class="os-totals">
         <div class="l"><span>Sous-total</span><span>${SB.formatPrix(t.sousTotal)}</span></div>
         ${t.remise ? `<div class="l" style="color:var(--succes)"><span>Remise</span><span>−${SB.formatPrix(t.remise)}</span></div>` : ''}
         <div class="l"><span>Livraison ${data.zone ? '(' + esc(window.SB_DATA.livraison.zones[data.zone].label) + ')' : ''}</span><span>${t.livraisonOfferte ? 'Offerte' : (data.zone ? SB.formatPrix(t.livraison) : '—')}</span></div>
         <div class="l grand"><span>Total</span><span class="prix-actuel">${SB.formatPrix(t.total)}</span></div>
       </div>`;
  }

  /* ---- Validation d'un champ ---- */
  function setError(fieldId, msg) {
    const f = $(fieldId)?.closest('.field');
    if (!f) return;
    f.classList.toggle('error', !!msg);
    const em = f.querySelector('.err-msg'); if (em && msg) em.textContent = msg;
    const inp = $(fieldId); if (inp) inp.classList.toggle('invalid', !!msg);
  }

  /* ---- Étape 1 : coordonnées ---- */
  function validerEtape1() {
    let ok = true;
    const nom = SB.security.sanitize($('c-nom').value, 60);
    if (nom.length < 3) { setError('c-nom', 'Nom trop court'); ok = false; } else setError('c-nom', '');
    const vt = SB.security.validerTelephone($('c-tel').value);
    if (!vt.valide) { setError('c-tel', vt.message); ok = false; } else setError('c-tel', '');
    const email = $('c-email').value.trim();
    if (email) { const ve = SB.security.validerEmail(email); if (!ve.valide) { setError('c-email', ve.message); ok = false; } else setError('c-email', ''); }
    if (ok) {
      data.nom = nom; data.tel = vt.local; data.email = SB.security.sanitize(email, 80);
      goStep(2);
    }
  }

  /* ---- Étape 2 : livraison ---- */
  function validerEtape2() {
    let ok = true;
    const zone = $('c-zone').value;
    if (!zone) { setError('c-zone', 'Sélectionnez une zone'); ok = false; } else setError('c-zone', '');
    const adresse = SB.security.sanitize($('c-adresse').value, 160);
    if (adresse.length < 4) { setError('c-adresse', 'Adresse / point de repère requis'); ok = false; } else setError('c-adresse', '');
    if (ok) {
      data.zone = zone; data.adresse = adresse; data.repere = SB.security.sanitize($('c-repere').value, 120);
      renderSummary();
      goStep(3);
    }
  }

  /* ---- Étape 3 : paiement ---- */
  function renderMoyens() {
    const box = $('pay-methods');
    if (!box) return;
    const M = SB.payment.MOYENS;
    box.innerHTML = Object.keys(M).map(k => {
      const m = M[k];
      return `<div class="pay-method" data-moyen="${k}" role="radio" tabindex="0" aria-checked="false">
        <div class="pm-logo ${m.cls}">${esc(m.logo)}</div>
        <div class="pm-info"><div class="pm-nom">${esc(m.nom)}</div><div class="pm-desc">${esc(m.desc)}</div></div>
        <div class="pm-radio"></div>
      </div>`;
    }).join('');
    box.querySelectorAll('.pay-method').forEach(pm => {
      const choisir = () => {
        box.querySelectorAll('.pay-method').forEach(x => { x.classList.remove('selected'); x.setAttribute('aria-checked', 'false'); });
        pm.classList.add('selected'); pm.setAttribute('aria-checked', 'true');
        data.moyen = pm.dataset.moyen;
        renderPayDetails();
      };
      pm.addEventListener('click', choisir);
      pm.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choisir(); } });
    });
  }

  function renderPayDetails() {
    const box = $('pay-details');
    if (!box) return;
    const m = SB.payment.MOYENS[data.moyen];
    if (!m) { box.innerHTML = ''; return; }
    if (data.moyen === 'cod') {
      box.innerHTML = `<p>💵 Vous paierez <strong>en espèces</strong> à la livraison. Préparez l'appoint si possible.</p>`;
      return;
    }
    const prefixHint = { orange: '07…', mtn: '05…', moov: '01…', wave: 'votre numéro mobile' }[data.moyen];
    box.innerHTML =
      `<div class="field">
         <label for="c-telpay">Numéro ${esc(m.nom)} <span class="req">*</span></label>
         <input class="input" id="c-telpay" inputmode="tel" placeholder="ex : ${esc(prefixHint)}" value="${esc(data.telPay || data.tel)}">
         <div class="err-msg"></div>
         <div class="hint">🔒 ${esc(m.instruction)}</div>
       </div>`;
  }

  function payer() {
    // Rate-limiting front (anti double-clic)
    const rl = SB.security.rateLimit('pay', 4000);
    if (!rl.autorise) { SB.toastInfo('Veuillez patienter…'); return; }
    if (!data.moyen) { SB.toastErreur('Choisissez un moyen de paiement'); return; }

    // Jeton anti-rejeu
    if (!SB.security.jetonValide(jeton)) { SB.toastErreur('Session expirée, veuillez recharger.'); return; }

    let telPay = data.tel;
    if (data.moyen !== 'cod') {
      telPay = $('c-telpay') ? $('c-telpay').value : '';
      const v = SB.security.numeroPourMoyen(telPay, data.moyen);
      if (!v.valide) { setError('c-telpay', v.message); return; }
      setError('c-telpay', '');
      data.telPay = SB.security.validerTelephone(telPay).local;
    }

    const btn = $('btn-payer');
    if (btn) btn.disabled = true;

    const t = SB.cart.totaux(data.zone);
    const overlay = $('pay-processing');
    const m = SB.payment.MOYENS[data.moyen];
    montrerTraitement(m);

    SB.payment.processPayment(data.moyen, {
      montant: t.total, telephone: telPay,
      commande: { items: SB.cart.items(), client: { nom: data.nom, tel: data.tel } }
    })
    .then(res => {
      SB.security.consommerJeton(); // le jeton ne peut plus resservir
      const commande = enregistrerCommande(res, t);
      montrerSucces(commande, res);
    })
    .catch(err => {
      overlay && overlay.classList.remove('show');
      if (btn) btn.disabled = false;
      jeton = SB.security.genererJetonCheckout(); // nouveau jeton pour réessayer
      SB.toastErreur(err.message || 'Le paiement a échoué');
    });
  }

  function montrerTraitement(m) {
    const overlay = $('pay-processing');
    if (!overlay) return;
    overlay.querySelector('.box').innerHTML =
      `<div class="spinner"></div>
       <h3>Traitement du paiement…</h3>
       <p class="muted">${esc(m.nom)}</p>
       ${m.ussd ? `<div class="ussd">${esc(m.ussd)}</div><p class="muted" style="font-size:.82rem">${esc(m.instruction)}</p>`
                 : `<p class="muted" style="font-size:.85rem;margin-top:8px">${esc(m.instruction)}</p>`}
       <div class="trust-row" style="justify-content:center;margin-top:16px"><span class="trust-chip secure">🔒 Connexion sécurisée</span></div>`;
    overlay.classList.add('show');
  }

  function enregistrerCommande(res, t) {
    const commande = {
      numero: SB.security.genererNumeroCommande(),
      transactionId: res.transactionId,
      date: new Date().toISOString(),
      statut: data.moyen === 'cod' ? 'confirmee' : 'confirmee',
      client: { nom: data.nom, tel: data.tel, email: data.email },
      livraison: { zone: data.zone, zoneLabel: window.SB_DATA.livraison.zones[data.zone]?.label, adresse: data.adresse, repere: data.repere },
      paiement: { moyen: res.moyen, method: res.method },
      items: SB.cart.items().map(l => {
        const p = SB.getProduit(l.id);
        return { id: l.id, nom: p?.nom, prix: SB.prixEffectif(p), qty: l.qty, variante: l.variante };
      }),
      totaux: t
    };
    // Historique local des commandes
    const hist = SB.store.get('commandes', []);
    hist.unshift(commande);
    SB.store.set('commandes', hist);
    SB.cart.vider();
    return commande;
  }

  function montrerSucces(commande, res) {
    const overlay = $('pay-processing');
    if (overlay) {
      overlay.querySelector('.box').innerHTML =
        `<div class="pay-success-ico">✓</div>
         <h3>Paiement confirmé !</h3>
         <p class="muted">Transaction ${esc(res.transactionId)}</p>
         <button class="btn btn-primary btn-block" style="margin-top:20px" onclick="SB.checkout.voirConfirmation()">Voir ma commande</button>`;
    }
    window._sbDerniereCommande = commande;
    setTimeout(voirConfirmation, 1400);
  }

  function voirConfirmation() {
    const c = window._sbDerniereCommande;
    if (!c) return;
    $('pay-processing')?.classList.remove('show');
    document.querySelectorAll('.checkout-step').forEach(s => s.classList.remove('active'));
    $('steps-bar')?.classList.add('hidden');
    const conf = $('step-confirm');
    conf.classList.add('active');
    const waLink = construireLienWhatsApp(c);
    conf.innerHTML =
      `<div class="confirm-card" data-reveal>
         <div class="pay-success-ico" style="margin:0 auto 18px">✓</div>
         <h2>Merci pour votre commande, ${esc(c.client.nom.split(' ')[0])} !</h2>
         <p class="muted">Votre commande a bien été enregistrée. Un conseiller SAMSON vous contactera au ${esc(SB.security.masquerTel(c.client.tel))}.</p>
         <div style="margin:20px 0"><div class="muted" style="font-size:.82rem">Numéro de commande</div><div class="order-num">${esc(c.numero)}</div></div>
         <div class="receipt">
           <div class="r-line"><span>Transaction</span><span>${esc(c.transactionId)}</span></div>
           <div class="r-line"><span>Paiement</span><span>${esc(c.paiement.moyen)}</span></div>
           <div class="r-line"><span>Livraison</span><span>${esc(c.livraison.zoneLabel || '')}</span></div>
           <div class="r-line"><span>Articles</span><span>${c.items.reduce((s, i) => s + i.qty, 0)}</span></div>
           <div class="r-line"><span>Sous-total</span><span>${SB.formatPrix(c.totaux.sousTotal)}</span></div>
           ${c.totaux.remise ? `<div class="r-line"><span>Remise</span><span>−${SB.formatPrix(c.totaux.remise)}</span></div>` : ''}
           <div class="r-line"><span>Frais de livraison</span><span>${c.totaux.livraisonOfferte ? 'Offerte' : SB.formatPrix(c.totaux.livraison)}</span></div>
           <div class="r-line total"><span>Total payé</span><span>${SB.formatPrix(c.totaux.total)}</span></div>
         </div>
         <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
           <button class="btn btn-primary" onclick="SB.checkout.telechargerRecu()">📄 Télécharger le reçu</button>
           <a class="btn btn-dark" href="${waLink}" target="_blank" rel="noopener">📱 Partager sur WhatsApp</a>
           <a class="btn btn-ghost" href="suivi.html?num=${encodeURIComponent(c.numero)}">Suivre ma commande</a>
         </div>
         <a href="catalogue.html" class="btn btn-outline" style="margin-top:14px">Continuer mes achats</a>
       </div>`;
    SB.observeReveal && SB.observeReveal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function construireLienWhatsApp(c) {
    const lignes = c.items.map(i => `• ${i.nom} x${i.qty}`).join('\n');
    const txt = `🏋️ *SAMSON Boutique* — Commande ${c.numero}\n\n${lignes}\n\nTotal : ${SB.formatPrix(c.totaux.total)}\nLivraison : ${c.livraison.zoneLabel}\nPaiement : ${c.paiement.moyen}\n\nMerci !`;
    return `https://wa.me/${SB.WHATSAPP}?text=${encodeURIComponent(txt)}`;
  }

  function telechargerRecu() {
    const c = window._sbDerniereCommande;
    if (!c) return;
    const l = c.items.map(i => `  - ${i.nom} x${i.qty} .......... ${SB.formatPrix(SB.prixEffectif(SB.getProduit(i.id)) * i.qty)}`).join('\n');
    const contenu =
`====================================
        SAMSON BOUTIQUE
     Matériel de sport & fitness
     Cocody Angré, Abidjan - CI
====================================

REÇU DE COMMANDE
Commande   : ${c.numero}
Transaction: ${c.transactionId}
Date       : ${new Date(c.date).toLocaleString('fr-FR')}

CLIENT
Nom     : ${c.client.nom}
Tél     : ${SB.security.masquerTel(c.client.tel)}
Livraison: ${c.livraison.zoneLabel} - ${c.livraison.adresse}

ARTICLES
${l}

------------------------------------
Sous-total : ${SB.formatPrix(c.totaux.sousTotal)}
${c.totaux.remise ? 'Remise     : -' + SB.formatPrix(c.totaux.remise) + '\n' : ''}Livraison  : ${c.totaux.livraisonOfferte ? 'Offerte' : SB.formatPrix(c.totaux.livraison)}
TOTAL      : ${SB.formatPrix(c.totaux.total)}
Paiement   : ${c.paiement.moyen}
====================================
      Merci de votre confiance !
   Support 7j/7 - +225 07 00 00 00 00
====================================`;
    const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `recu-${c.numero}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function remplirZones() {
    const sel = $('c-zone');
    if (!sel) return;
    const Z = window.SB_DATA.livraison.zones;
    sel.innerHTML = `<option value="">— Choisir une commune / zone —</option>` +
      Object.keys(Z).map(k => `<option value="${k}">${esc(Z[k].label)} (${SB.formatPrix(Z[k].prix)})</option>`).join('');
    sel.addEventListener('change', () => { data.zone = sel.value; renderSummary(); });
  }

  function init() {
    if (!document.getElementById('checkout-layout')) return;
    if (!SB.cart.count()) {
      document.getElementById('checkout-layout').innerHTML =
        `<div class="no-results" style="grid-column:1/-1;text-align:center">
           <div class="big">🛒</div><h3>Votre panier est vide</h3>
           <a href="catalogue.html" class="btn btn-primary" style="margin-top:16px">Découvrir la boutique</a>
         </div>`;
      return;
    }
    jeton = SB.security.genererJetonCheckout();
    remplirZones();
    renderMoyens();
    renderSummary();

    $('btn-etape1')?.addEventListener('click', validerEtape1);
    $('btn-etape2')?.addEventListener('click', validerEtape2);
    $('btn-retour2')?.addEventListener('click', () => goStep(1));
    $('btn-retour3')?.addEventListener('click', () => goStep(2));
    $('btn-payer')?.addEventListener('click', payer);
  }

  SB.checkout = { init, goStep, payer, voirConfirmation, telechargerRecu };
  document.addEventListener('DOMContentLoaded', init);
})();
