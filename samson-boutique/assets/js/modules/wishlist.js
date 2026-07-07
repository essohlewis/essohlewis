/* =====================================================================
   SAMSON BOUTIQUE — Wishlist (favoris) persistée localStorage
   ===================================================================== */
(function () {
  'use strict';
  const KEY = 'wishlist';

  let items = SB.store.get(KEY, []); // tableau d'ids produit

  function persister() { SB.store.set(KEY, items); SB.bus.emit('wishlist:change', items); }

  function contient(id) { return items.includes(id); }
  function count() { return items.length; }
  function tous() { return items.slice(); }

  function toggle(id) {
    const p = SB.getProduit(id);
    if (contient(id)) {
      items = items.filter(x => x !== id);
      persister();
      SB.toastInfo((p ? p.nom : 'Produit') + ' retiré des favoris');
      return false;
    }
    items.push(id);
    persister();
    SB.toastSucces((p ? p.nom : 'Produit') + ' ajouté aux favoris ❤️');
    return true;
  }

  function retirer(id) { items = items.filter(x => x !== id); persister(); }

  SB.wishlist = { contient, count, tous, toggle, retirer };
})();
