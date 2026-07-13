/**
 * CONTEO — Abonnement & paiements.
 * Plans (mensuel/annuel), packs à l'unité, choix du canal (Wave/OM/MoMo/Moov),
 * initiation du paiement. Le crédit effectif dépend de la re-vérification
 * serveur-à-serveur côté webhook (jamais côté client).
 */

import { el, toast } from '../../utils/dom.js';
import { api } from '../../core/api.js';
import { parentShell } from './shell.js';

const CHANNELS = [
  { id: 'wave', label: 'Wave', icon: '🌊' },
  { id: 'orange_money', label: 'Orange Money', icon: '🟠' },
  { id: 'mtn_momo', label: 'MTN MoMo', icon: '🟡' },
  { id: 'moov_money', label: 'Moov Money', icon: '🔵' },
];

export async function renderBilling() {
  const body = el('div');
  parentShell('billing', body);

  let plans = [];
  try { plans = (await api.get('/plans')).plans || []; } catch { /* offline */ }

  let selectedChannel = 'wave';
  let selectedProvider = 'cinetpay';

  // Sélecteur de canal.
  const channelGrid = el('div', { class: 'channels' }, CHANNELS.map((c) => {
    const node = el('button', { class: 'channel' + (c.id === selectedChannel ? ' on' : ''), text: `${c.icon} ${c.label}` });
    node.addEventListener('click', () => {
      selectedChannel = c.id;
      channelGrid.querySelectorAll('.channel').forEach((n) => n.classList.remove('on'));
      node.classList.add('on');
    });
    return node;
  }));

  body.append(el('h2', { text: 'Choisir un abonnement' }));

  plans.forEach((plan) => {
    body.append(el('div', { class: 'plan-card' + (plan.id === 'yearly' ? ' featured' : '') }, [
      el('h3', { text: plan.label }),
      el('div', { class: 'price', text: `${plan.price_fcfa.toLocaleString('fr-FR')} FCFA` }),
      el('p', { class: 'hint', text: 'Accès à tout le catalogue, toutes les langues, nouveaux contes mensuels.' }),
      el('button', { class: 'btn block', text: 'S\'abonner',
        onClick: () => pay('subscription', plan.id, selectedProvider, selectedChannel) }),
    ]));
  });

  // Packs à l'unité.
  body.append(el('h2', { text: 'Ou acheter un pack (accès à vie)' }));
  try {
    const packs = (await api.get('/packs')).packs || [];
    packs.filter((p) => !p.owned).forEach((pack) => {
      body.append(el('div', { class: 'plan-card' }, [
        el('h3', { text: pack.title }),
        el('div', { class: 'price', text: `${pack.price_fcfa.toLocaleString('fr-FR')} FCFA` }),
        el('p', { class: 'hint', text: `${pack.tale_count} contes · accès permanent` }),
        el('button', { class: 'btn block secondary', text: 'Acheter ce pack',
          onClick: () => pay('pack', String(pack.id), selectedProvider, selectedChannel) }),
      ]));
    });
  } catch { /* offline */ }

  body.append(el('h3', { text: 'Moyen de paiement' }));
  body.append(channelGrid);
  body.append(el('p', { class: 'hint', text: 'Paiement sécurisé via CinetPay / PayDunya. Aucun accès n\'est débloqué avant confirmation de la transaction par notre serveur.' }));

  async function pay(purpose, purposeId, provider, channel) {
    try {
      const res = await api.post('/payments/initiate', { purpose, purpose_id: purposeId, provider, channel });
      if (res.payment_url) {
        toast('Redirection vers le paiement…');
        // Enregistre la référence pour vérifier le statut au retour.
        sessionStorage.setItem('conteo_last_ref', res.reference);
        location.href = res.payment_url;
      }
    } catch (e) {
      toast(e.message || 'Paiement indisponible pour le moment.');
    }
  }
}
