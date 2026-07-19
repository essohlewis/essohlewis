/* =========================================================================
   security.js — Algorithme anti-fraude & confiance (100 % front, heuristique).
   Fournit : score de confiance des boutiques, détection d'arnaque sur les
   annonces et messages, détection de faux comptes / faux avis, politique de
   mot de passe, anti-force brute, journal de sécurité.
   NB : sans back-end, ces contrôles sont des heuristiques côté navigateur —
   utiles pour alerter/bloquer, mais contournables. En production, doubler
   d'une validation serveur.
   ========================================================================= */

window.MP = window.MP || {};

(function () {
  "use strict";

  const DB = window.MP.DB;
  const DAY = 86400000;

  /* ------------------------------------------------------------------ */
  /*  Dictionnaires de détection (contexte Côte d'Ivoire / français)     */
  /* ------------------------------------------------------------------ */
  // Sollicitation de paiement / arnaque à l'avance (interdit : paiement à la livraison).
  const PAYMENT_PATTERNS = [
    "western union", "moneygram", "money gram", "mandat", "transfert d'argent", "transfert argent",
    "payer d'avance", "payez d'avance", "paiement anticip", "payer avant", "payez avant", "acompte obligatoire",
    "frais de dossier", "frais d'avance", "caution obligatoire", "avance obligatoire", "50% d'avance", "50 % d'avance",
    "orange money", "mtn money", "moov money", "wave", "envoyez l'argent", "envoyer l'argent", "envoyez de l'argent",
    "code de retrait", "code de transfert", "bitcoin", "usdt", "crypto", "ria transfert",
  ];
  // Appâts « trop beau pour être vrai ».
  const BAIT_PATTERNS = ["100% gratuit", "totalement gratuit", "gagnez", "vous avez gagné", "loterie", "héritage", "prix exceptionnel garanti", "argent facile", "devenez riche"];
  // Liens externes (hors de la plateforme).
  const LINK_RE = /(https?:\/\/|www\.|bit\.ly|tinyurl|t\.me\/|wa\.me\/\d)/i;
  // Domaines d'e-mails jetables courants.
  const DISPOSABLE_DOMAINS = ["mailinator.com", "yopmail.com", "tempmail.com", "temp-mail.org", "guerrillamail.com", "10minutemail.com", "trashmail.com", "getnada.com", "sharklasers.com", "throwawaymail.com", "fakeinbox.com", "maildrop.cc", "dispostable.com", "jetable.org"];

  function _low(s) { return String(s || "").toLowerCase(); }

  /* ------------------------------------------------------------------ */
  /*  A8 — Robustesse des mots de passe                                  */
  /* ------------------------------------------------------------------ */
  const COMMON_PW = ["1234", "12345", "123456", "password", "azerty", "qwerty", "0000", "1111", "admin", "motdepasse"];
  function passwordStrength(pw) {
    pw = String(pw || "");
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (COMMON_PW.includes(pw.toLowerCase())) score = 0;
    const labels = ["Très faible", "Faible", "Moyen", "Bon", "Fort", "Excellent"];
    return { score, label: labels[Math.min(score, 5)], strong: score >= 3 };
  }
  /** Politique minimale exigée à l'inscription / au changement. */
  function passwordPolicyError(pw) {
    pw = String(pw || "");
    if (pw.length < 6) return "Le mot de passe doit contenir au moins 6 caractères.";
    if (COMMON_PW.includes(pw.toLowerCase())) return "Ce mot de passe est trop courant. Choisissez-en un autre.";
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Le mot de passe doit mêler lettres et chiffres.";
    return null;
  }

  /* ------------------------------------------------------------------ */
  /*  A8 — Anti-force brute (verrouillage après échecs)                  */
  /* ------------------------------------------------------------------ */
  const MAX_FAILS = 5, LOCK_MS = 5 * 60000;
  function _attempts() { return DB.get(DB.KEYS.loginAttempts, {}) || {}; }
  function loginLockRemaining(email) {
    const a = _attempts()[_low(email)];
    if (!a || !a.lockedUntil) return 0;
    return Math.max(0, a.lockedUntil - Date.now());
  }
  function recordLoginFail(email) {
    const map = _attempts(); const k = _low(email);
    const a = map[k] || { fails: 0, lockedUntil: 0 };
    a.fails = (a.fails || 0) + 1; a.last = Date.now();
    if (a.fails >= MAX_FAILS) { a.lockedUntil = Date.now() + LOCK_MS; a.fails = 0; }
    map[k] = a; DB.set(DB.KEYS.loginAttempts, map);
    return a.lockedUntil && a.lockedUntil > Date.now();
  }
  function clearLoginFails(email) {
    const map = _attempts(); delete map[_low(email)]; DB.set(DB.KEYS.loginAttempts, map);
  }

  /* ------------------------------------------------------------------ */
  /*  A5 — Faux comptes                                                  */
  /* ------------------------------------------------------------------ */
  function isDisposableEmail(email) {
    const dom = _low(email).split("@")[1] || "";
    return DISPOSABLE_DOMAINS.includes(dom);
  }
  /** Comptes partageant le même téléphone (hors compte courant). */
  function duplicatePhoneAccounts(phone, exceptId) {
    const digits = String(phone || "").replace(/\D/g, "");
    if (digits.length < 8) return [];
    return DB.all(DB.KEYS.users).filter((u) => u.id !== exceptId && String(u.phone || "").replace(/\D/g, "") === digits);
  }
  const REG_WINDOW = 10 * 60000, REG_MAX = 3;
  function registrationRateLimited() {
    const log = (DB.get(DB.KEYS.regLog, []) || []).filter((t) => Date.now() - t < REG_WINDOW);
    return log.length >= REG_MAX;
  }
  function recordRegistration() {
    const log = (DB.get(DB.KEYS.regLog, []) || []).filter((t) => Date.now() - t < REG_WINDOW);
    log.push(Date.now()); DB.set(DB.KEYS.regLog, log);
  }
  /** Signaux de risque pour un compte utilisateur. */
  function accountSignals(user) {
    const flags = [];
    if (isDisposableEmail(user.email)) flags.push({ level: "high", msg: "E-mail jetable/temporaire." });
    const dupPhone = duplicatePhoneAccounts(user.phone, user.id);
    if (dupPhone.length) flags.push({ level: "medium", msg: `Téléphone partagé avec ${dupPhone.length} autre(s) compte(s).` });
    // Même nom exact que d'autres comptes.
    const sameName = DB.all(DB.KEYS.users).filter((u) => u.id !== user.id && _low(u.name) === _low(user.name));
    if (sameName.length) flags.push({ level: "low", msg: `Nom identique à ${sameName.length} autre(s) compte(s).` });
    if (!user.phone) flags.push({ level: "low", msg: "Aucun numéro de téléphone renseigné." });
    return flags;
  }

  /* ------------------------------------------------------------------ */
  /*  A2 / A3 — Scan de texte (annonces & messages)                      */
  /* ------------------------------------------------------------------ */
  /** Analyse un texte libre ; renvoie une liste de signaux. */
  function scanText(text) {
    const low = _low(text); const flags = [];
    const pay = PAYMENT_PATTERNS.find((p) => low.includes(p));
    if (pay) flags.push({ level: "high", code: "paiement", msg: `Sollicitation de paiement à l'avance (« ${pay} »).` });
    const bait = BAIT_PATTERNS.find((p) => low.includes(p));
    if (bait) flags.push({ level: "medium", code: "appat", msg: `Formulation d'appât suspecte (« ${bait} »).` });
    if (LINK_RE.test(text)) flags.push({ level: "medium", code: "lien", msg: "Contient un lien externe." });
    return flags;
  }

  /* ------------------------------------------------------------------ */
  /*  A2 — Analyse d'une annonce                                         */
  /* ------------------------------------------------------------------ */
  /** Prix médian des articles publiés d'une catégorie. */
  function categoryMedianPrice(category, exceptId) {
    const prices = DB.all(DB.KEYS.products)
      .filter((p) => p.category === category && p.status === "published" && p.id !== exceptId && p.price > 0)
      .map((p) => p.price).sort((a, b) => a - b);
    if (prices.length < 3) return 0;
    const mid = Math.floor(prices.length / 2);
    return prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  }
  /** Renvoie les signaux de risque d'un article (annonce). */
  function scanProduct(product) {
    const flags = scanText((product.title || "") + " " + (product.description || ""));
    // Prix anormalement bas par rapport à la catégorie (appât fréquent).
    const median = categoryMedianPrice(product.category, product.id);
    if (median && product.price > 0 && product.price < median * 0.15) {
      flags.push({ level: "medium", code: "prix", msg: `Prix très bas (${window.MP.UI.fcfa(product.price)}) vs médiane catégorie (${window.MP.UI.fcfa(Math.round(median))}).` });
    }
    // Description trop courte pour un article crédible.
    if ((product.description || "").trim().length < 15) flags.push({ level: "low", code: "desc", msg: "Description quasi absente." });
    // Aucune image.
    if (!(product.images || []).length) flags.push({ level: "low", code: "img", msg: "Aucune photo." });
    // Doublon de contenu avec une autre boutique.
    const key = _low((product.title || "") + (product.description || "")).replace(/\s+/g, " ").trim();
    if (key.length > 20) {
      const dup = DB.all(DB.KEYS.products).find((p) => p.id !== product.id && p.storeId !== product.storeId && _low((p.title || "") + (p.description || "")).replace(/\s+/g, " ").trim() === key);
      if (dup) flags.push({ level: "medium", code: "doublon", msg: "Contenu identique à une annonce d'une autre boutique." });
    }
    return flags;
  }

  /* ------------------------------------------------------------------ */
  /*  A6 — Faux avis                                                     */
  /* ------------------------------------------------------------------ */
  /** Renvoie les avis suspects avec leur motif. */
  function fakeReviewSignals() {
    const reviews = DB.all(DB.KEYS.reviews);
    const orders = DB.all(DB.KEYS.orders);
    const out = [];
    // Regroupe par auteur pour détecter les rafales.
    const byUser = {};
    reviews.forEach((r) => { (byUser[r.userId] = byUser[r.userId] || []).push(r); });
    const textSeen = {};
    reviews.forEach((r) => {
      const reasons = [];
      // Rafale : >3 avis en moins de 10 min par le même auteur.
      const mine = (byUser[r.userId] || []).filter((x) => Math.abs(x.createdAt - r.createdAt) < 10 * 60000);
      if (mine.length > 3) reasons.push("Rafale d'avis du même auteur");
      // Texte dupliqué.
      const t = _low(r.comment || "").trim();
      if (t.length > 12) { if (textSeen[t] && textSeen[t] !== r.userId) reasons.push("Commentaire dupliqué"); textSeen[t] = r.userId; }
      // Note extrême sans achat livré correspondant.
      if ((r.rating === 5 || r.rating === 1)) {
        const bought = orders.some((o) => o.buyerId === r.userId && o.status === "livree" && ((r.targetType === "store" && o.storeId === r.targetId) || (r.targetType === "product" && (o.items || []).some((it) => it.productId === r.targetId))));
        if (!bought) reasons.push("Note extrême sans achat vérifié");
      }
      if (reasons.length) out.push({ review: r, reasons });
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /*  A1 — Score de confiance d'une boutique                             */
  /* ------------------------------------------------------------------ */
  function trustScore(store) {
    if (!store) return { score: 0, level: "low", factors: [] };
    if (store.suspended) return { score: 0, level: "low", factors: [{ delta: 0, msg: "Boutique suspendue" }] };
    const factors = [];
    let score = 50; const add = (d, msg) => { score += d; factors.push({ delta: d, msg }); };
    // Vérification & KYC.
    if (store.verified) add(15, "Boutique vérifiée");
    if (store.kyc && store.kyc.status === "approved") add(10, "Identité vérifiée (KYC)");
    else if (!store.kyc || store.kyc.status !== "approved") add(-5, "Identité non vérifiée");
    // Ancienneté.
    const months = Math.floor((Date.now() - (store.createdAt || Date.now())) / (30 * DAY));
    if (months > 0) add(Math.min(10, months), `Ancienneté : ${months} mois`);
    // Complétude de la vitrine.
    if (store.logo && store.banner && (store.description || "").length > 20) add(5, "Vitrine complète");
    // Avis.
    const rating = window.MP.Store.rating(store.id);
    if (rating.count > 0) {
      if (rating.avg >= 4) add(10, `Bons avis (${rating.avg.toFixed(1)}/5)`);
      else if (rating.avg < 3) add(-10, `Avis médiocres (${rating.avg.toFixed(1)}/5)`);
    }
    // Commandes : taux d'annulation & litiges.
    const orders = window.MP.Orders.byStore(store.id);
    if (orders.length >= 4) {
      const cx = orders.filter((o) => o.status === "annulee").length / orders.length;
      if (cx >= 0.3) add(-Math.min(20, Math.round(cx * 40)), `Taux d'annulation élevé (${Math.round(cx * 100)}%)`);
    }
    const litiges = orders.filter((o) => o.problem && !o.problem.resolved).length;
    if (litiges) add(-Math.min(20, litiges * 8), `${litiges} litige(s) ouvert(s)`);
    // Annonces à risque.
    const risky = DB.all(DB.KEYS.products).filter((p) => p.storeId === store.id && (p.riskFlags || []).some((f) => f.level === "high")).length;
    if (risky) add(-Math.min(15, risky * 5), `${risky} annonce(s) à risque`);
    score = Math.max(0, Math.min(100, Math.round(score)));
    const level = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
    return { score, level, factors };
  }
  function trustLabel(level) {
    return { high: "Fiable", medium: "À surveiller", low: "Risque élevé" }[level] || "—";
  }

  /* ------------------------------------------------------------------ */
  /*  A11 — Journal de sécurité                                          */
  /* ------------------------------------------------------------------ */
  function log(event, detail, opts) {
    opts = opts || {};
    const u = window.MP.Auth ? window.MP.Auth.current() : null;
    const entry = {
      id: DB.uid("sec"),
      userId: opts.userId || (u ? u.id : ""),
      userName: opts.userName || (u ? u.name : ""),
      event, detail: detail || "", level: opts.level || "info", at: Date.now(),
    };
    const list = DB.all(DB.KEYS.securityLog);
    list.push(entry);
    // Borne la taille du journal.
    DB.set(DB.KEYS.securityLog, list.slice(-500));
    return entry;
  }
  function logsFor(userId) {
    return DB.all(DB.KEYS.securityLog).filter((e) => e.userId === userId).sort((a, b) => b.at - a.at);
  }

  /* ------------------------------------------------------------------ */
  /*  A4 — Agrégation des signaux (tableau de bord anti-fraude)          */
  /* ------------------------------------------------------------------ */
  function fraudSignals() {
    const stores = window.MP.Store.all().map((s) => ({ store: s, trust: trustScore(s) }))
      .filter((x) => x.trust.level === "low" && !x.store.suspended)
      .sort((a, b) => a.trust.score - b.trust.score);
    const products = DB.all(DB.KEYS.products)
      .map((p) => ({ product: p, flags: (p.riskFlags && p.riskFlags.length ? p.riskFlags : scanProduct(p)) }))
      .filter((x) => x.flags.length)
      .sort((a, b) => severity(b.flags) - severity(a.flags));
    const messages = DB.all(DB.KEYS.messages).filter((m) => m.flagged).sort((a, b) => b.createdAt - a.createdAt);
    const accounts = DB.all(DB.KEYS.users).map((u) => ({ user: u, flags: accountSignals(u) }))
      .filter((x) => x.flags.length).sort((a, b) => severity(b.flags) - severity(a.flags));
    const reviews = fakeReviewSignals();
    return { stores, products, messages, accounts, reviews, total: stores.length + products.length + messages.length + accounts.length + reviews.length };
  }
  function severity(flags) { return (flags || []).reduce((s, f) => s + (f.level === "high" ? 3 : f.level === "medium" ? 2 : 1), 0); }

  window.MP.Security = {
    passwordStrength, passwordPolicyError,
    loginLockRemaining, recordLoginFail, clearLoginFails,
    isDisposableEmail, duplicatePhoneAccounts, registrationRateLimited, recordRegistration, accountSignals,
    scanText, scanProduct, categoryMedianPrice, fakeReviewSignals,
    trustScore, trustLabel,
    log, logsFor, fraudSignals, severity,
  };
})();
