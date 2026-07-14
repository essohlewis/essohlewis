/* Conteo — Persistance & estimation du stockage.
 * navigator.storage.persist() demande à l'OS de ne pas purger nos données. */

export async function requestPersistence() {
  if (!navigator.storage?.persist) return { supported: false, granted: false };
  const already = await navigator.storage.persisted?.();
  if (already) return { supported: true, granted: true };
  const granted = await navigator.storage.persist();
  return { supported: true, granted };
}

export async function estimate() {
  if (!navigator.storage?.estimate) return { usage: 0, quota: 0, supported: false };
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota, supported: true, ratio: quota ? usage / quota : 0 };
}
