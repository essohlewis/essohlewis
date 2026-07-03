// Cache mémoire très simple, par utilisateur, pour l'endpoint /api/tasks/stats.
//
// Pourquoi : les statistiques (agrégat COUNT/SUM sur toutes les tâches) sont
// recalculées à chaque chargement du tableau. Tant que l'utilisateur ne modifie
// aucune tâche, le résultat est identique. On garde donc la dernière valeur
// calculée pendant une courte durée (TTL) et on l'invalide dès qu'une tâche
// est créée, modifiée ou supprimée.
//
// C'est volontairement un cache en mémoire de processus (pas de Redis) : zéro
// dépendance, parfait pour une instance unique. Pour un déploiement multi-instances,
// remplacer la Map par un store partagé.

const TTL_MS = 30 * 1000; // 30 secondes : assez pour absorber les rafales de lectures

const store = new Map(); // userId -> { value, expiresAt }

function get(userId) {
  const entry = store.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(userId);
    return null;
  }
  return entry.value;
}

function set(userId, value) {
  store.set(userId, { value, expiresAt: Date.now() + TTL_MS });
}

// Appelé après toute écriture (create/update/delete/bulk) pour forcer un recalcul.
function invalidate(userId) {
  store.delete(userId);
}

module.exports = { get, set, invalidate };
