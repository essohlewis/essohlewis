/* Conteo — Boutique. Achat in-app (mobile) OU code d'activation (local). */

import { el, toast, modal } from '../../core/dom.js';
import { loadCatalog } from '../../content/catalog.js';
import { parentShell } from './shell.js';
import { isPackUnlocked, buyPack, redeemCode, loadEntitlements } from '../../billing/entitlements.js';
import { iapAvailable } from '../../billing/iap.js';
import { fcfa } from '../../utils/format.js';
import { t } from '../../core/i18n.js';

export async function storeView() {
  const catalog = await loadCatalog();
  await loadEntitlements();
  const body = el('div', { class: 'stack' });

  body.append(el('div', { class: 'note', text: iapAvailable()
    ? 'Paiement via Google Play / App Store (Orange Money & MTN MoMo acceptés en Côte d’Ivoire).'
    : 'Version web : débloque un pack avec un code d’activation acheté en boutique. L’achat in-app est disponible dans l’application mobile.' }));

  // Bouton « entrer un code »
  body.append(el('button', { class: 'btn btn--leaf btn--block', text: '🎟️ ' + t('redeem_code'), onpointerup: openCodeModal }));

  const list = el('div', { class: 'plist' });
  for (const pack of (catalog.packs || []).filter((p) => !p.is_free)) {
    const owned = isPackUnlocked(catalog, pack);
    const buyBtn = el('button', { class: owned ? 'btn btn--ghost' : 'btn',
      disabled: owned, text: owned ? '✓ ' + t('owned') : t('buy') });
    buyBtn.addEventListener('pointerup', async () => {
      if (owned) return;
      if (iapAvailable()) {
        buyBtn.disabled = true;
        const res = await buyPack(pack.id).catch(() => ({ ok: false }));
        buyBtn.disabled = false;
        if (res.ok) { toast('Pack débloqué !', 'ok'); refresh(); }
        else toast('Achat annulé', 'err');
      } else {
        openCodeModal(pack.id);
      }
    });

    list.append(el('div', { class: 'pitem shop-item', style: { flexWrap: 'wrap' } }, [
      el('span', { 'aria-hidden': 'true', style: { fontSize: '30px' }, text: owned ? '✅' : '📦' }),
      el('div', { class: 'grow' }, [
        el('h3', { text: pack.title }),
        el('p', { text: `${pack.tales.length} contes · ${pack.size_mb} Mo` }),
        el('span', { class: 'price', text: fcfa(pack.price_fcfa) })
      ]),
      buyBtn
    ]));
  }
  body.append(list);

  function refresh() { storeView().then(() => {}); }

  function openCodeModal(prefillPack) {
    const input = el('input', { type: 'text', placeholder: 'CONT-SAGE-4F2A-9B71', style: { textTransform: 'uppercase', letterSpacing: '1px' } });
    const msg = el('p', { class: 'text-muted', style: { minHeight: '20px' } });
    const form = el('div', { class: 'stack' }, [
      el('h2', { text: t('redeem_code') }),
      el('p', { class: 'text-muted', text: 'Entre le code figurant sur ta carte ou ton reçu.' }),
      input, msg,
      el('div', { class: 'row' }, [
        el('button', { class: 'btn btn--ghost', text: 'Fermer', onpointerup: () => close() }),
        el('button', { class: 'btn spacer', text: 'Valider', onpointerup: validate })
      ])
    ]);
    const close = modal(form);
    input.focus();

    async function validate() {
      const res = await redeemCode(input.value);
      if (res.ok) { close(); toast('Pack débloqué avec le code !', 'ok'); refresh(); }
      else {
        const reasons = { format: 'Format de code invalide.', pack: 'Pack inconnu.', signature: 'Code non reconnu.' };
        msg.textContent = reasons[res.reason] || 'Code invalide.';
        msg.style.color = 'var(--c-danger)';
      }
    }
  }

  return parentShell('shop', body);
}
