/* ==========================================================================
   services/storageService.js — Couche de persistance.
   Isole tout accès aux données : localStorage (session, préférences,
   collections) + IndexedDB (fichiers volumineux : diplômes, pièces jointes).

   >>> Point de branchement API <<<
   Lors du passage à l'API PHP MVC/PDO, remplacer le corps des méthodes
   `lire`/`ecrire` par des appels fetch() ; les pages n'ont PAS à changer.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  const PREFIXE = "cl_";
  const CLES = {
    coachs: "coachs",
    users: "users",
    session: "session",
    bookings: "bookings",
    conversations: "conversations",
    notifications: "notifications",
    favoris: "favoris",
    likes: "likes",
    litiges: "litiges",
    abonnements: "abonnements",
    prefs: "prefs",
    seedFait: "seed_ok",
  };

  /* --------------------------- localStorage --------------------------- */
  function lire(cle, defaut) {
    try {
      const brut = localStorage.getItem(PREFIXE + cle);
      return brut === null ? (defaut !== undefined ? defaut : null) : JSON.parse(brut);
    } catch (e) {
      console.warn("Lecture stockage échouée pour", cle, e);
      return defaut !== undefined ? defaut : null;
    }
  }

  function ecrire(cle, valeur) {
    try {
      localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
      return true;
    } catch (e) {
      console.error("Écriture stockage échouée pour", cle, e);
      CL.toast && CL.toast.erreur("Stockage plein", "Impossible d'enregistrer les données.");
      return false;
    }
  }

  function supprimer(cle) { localStorage.removeItem(PREFIXE + cle); }

  /* ------------------------- IndexedDB (fichiers) --------------------- */
  const IDB_NOM = "coachlink_db";
  const IDB_STORE = "fichiers";
  let idbPromesse = null;

  function ouvrirIDB() {
    if (idbPromesse) return idbPromesse;
    idbPromesse = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return resolve(null);
      const req = indexedDB.open(IDB_NOM, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { console.warn("IndexedDB indisponible"); resolve(null); };
    });
    return idbPromesse;
  }

  async function enregistrerFichier(id, donnees) {
    const db = await ouvrirIDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put({ id, donnees, date: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  }

  async function lireFichier(id) {
    const db = await ouvrirIDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => resolve(req.result ? req.result.donnees : null);
      req.onerror = () => resolve(null);
    });
  }

  /* ------------------------------ Amorçage ---------------------------- */
  function amorcer(forcer) {
    if (!forcer && lire(CLES.seedFait)) return;
    const seed = CL.SEED || { coachs: [], specialites: [], communes: [] };
    // Copie profonde pour ne pas figer les références du seed.
    ecrire(CLES.coachs, JSON.parse(JSON.stringify(seed.coachs)));
    ecrire("specialites", seed.specialites);
    ecrire("communes", seed.communes);
    if (!lire(CLES.users)) {
      // Les comptes de démo ont un mot de passe en clair : on le hache
      // pour qu'il corresponde au format attendu par authService.connecter().
      const demos = JSON.parse(JSON.stringify(CL.COMPTES_DEMO || [])).map((u) => {
        if (CL.auth && CL.auth.hacher) u.motDePasse = CL.auth.hacher(u.motDePasse);
        return u;
      });
      ecrire(CLES.users, demos);
    }
    if (!lire(CLES.bookings)) ecrire(CLES.bookings, []);
    if (!lire(CLES.conversations)) ecrire(CLES.conversations, []);
    if (!lire(CLES.notifications)) ecrire(CLES.notifications, []);
    if (!lire(CLES.favoris)) ecrire(CLES.favoris, []);
    ecrire(CLES.seedFait, true);
  }

  /** Réinitialise totalement les données de démonstration. */
  function reinitialiser() {
    Object.values(CLES).forEach(supprimer);
    supprimer("specialites");
    supprimer("communes");
    amorcer(true);
  }

  CL.storage = {
    CLES, lire, ecrire, supprimer,
    amorcer, reinitialiser,
    enregistrerFichier, lireFichier,
  };
})();
