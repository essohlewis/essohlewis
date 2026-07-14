/* Conteo — Achats in-app natifs (Capacitor).
 * En PWA (navigateur), le plugin natif est absent : l'IAP est indisponible et
 * on se rabat sur les codes d'activation. Sur Android/iOS, Capacitor injecte
 * le plugin ; le reçu est stocké et revalidé au lancement. */

let plugin = null;

export function iapAvailable() {
  const cap = window.Capacitor;
  return !!(cap?.isNativePlatform?.() && cap.Plugins?.InAppPurchases);
}

async function getPlugin() {
  if (plugin) return plugin;
  if (!iapAvailable()) throw new Error('Achats in-app disponibles uniquement dans l’app mobile.');
  plugin = window.Capacitor.Plugins.InAppPurchases;
  return plugin;
}

export async function getProducts(productIds = []) {
  const p = await getPlugin();
  const { products } = await p.getProducts({ productIdentifiers: productIds });
  return products || [];
}

/* Lance l'achat ; renvoie le reçu à stocker dans entitlements. */
export async function purchase(productId) {
  const p = await getPlugin();
  const result = await p.purchase({ productIdentifier: productId });
  return {
    productId,
    receipt: result?.transactionReceipt || result?.receipt || '',
    transactionId: result?.transactionId || ''
  };
}

/* Revalidation des reçus au lancement (anti-remboursement/anti-fraude natif). */
export async function restore() {
  if (!iapAvailable()) return [];
  const p = await getPlugin();
  const { transactions } = await p.restorePurchases();
  return transactions || [];
}
