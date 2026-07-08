/* =============================================================================
 *  app.js — Logique SPA de PronoStars
 *  ---------------------------------------------------------------------------
 *  Sommaire :
 *    1.  Constantes & état applicatif
 *    2.  ALGORITHME TrustScore + statistiques dérivées (le cœur métier)
 *    3.  Utilitaires (formatage, échappement, DOM, toasts)
 *    4.  Composants réutilisables (carte de pronostic, avatar, etc.)
 *    5.  Vues (Feed, Profil, Détail, Explorer, Classement, Création, etc.)
 *    6.  Actions interactives (like, follow, repost, commentaires, résolution)
 *    7.  Routeur par hash + amorçage (bootstrap)
 * ============================================================================= */

const API = window.API;

/* -----------------------------------------------------------------------------
 *  1. Constantes & état
 * --------------------------------------------------------------------------- */

// Libellés des types de pari (pour affichage propre).
const LIBELLE_STATUT = {
  en_cours: "🟡 EN COURS",
  gagne: "🟢 GAGNÉ",
  perdu: "🔴 PERDU",
  annule: "⚪ ANNULÉ",
};

// Seuils des badges de réputation évolutifs (TrustScore).
// Bronze → Argent → Or → Légende (une série chaude fait aussi grimper).
const PALIERS_BADGE = [
  { nom: "Légende", min: 85, emoji: "👑" },
  { nom: "Or", min: 70, emoji: "🥇" },
  { nom: "Argent", min: 55, emoji: "🥈" },
  { nom: "Bronze", min: 0, emoji: "🥉" },
];

// État global léger (thème, cache de calculs).
const state = {
  theme: "dark",
  // Couleur d'accent personnalisable (Paramètres).
  accent: "orange",
  // Préférences de notifications (filtrent le fil de notifications).
  notifPrefs: { like: true, follow: true, comment: true, gagne: true, repost: true, badge: true },
  // Historique de navigation pour le bouton « retour » mobile.
  history: [],
};

// Accents disponibles : { clé → couleur + dégradé }.
const ACCENTS = {
  orange: { c: "#ffb300", grad: "linear-gradient(135deg,#ffb300,#ff8f00)", label: "Doré" },
  vert:   { c: "#00c853", grad: "linear-gradient(135deg,#00c853,#00bfa5)", label: "Vert" },
  bleu:   { c: "#2979ff", grad: "linear-gradient(135deg,#2979ff,#00b0ff)", label: "Bleu" },
  violet: { c: "#aa00ff", grad: "linear-gradient(135deg,#aa00ff,#7c4dff)", label: "Violet" },
  rose:   { c: "#ff4081", grad: "linear-gradient(135deg,#ff4081,#f50057)", label: "Rose" },
};

// Mise fictive (FCFA) par pronostic pour la cagnotte virtuelle.
const MISE_VIRTUELLE = 1000;
const CAGNOTTE_DEPART = 10000;

/* =============================================================================
 *  2. ALGORITHME TrustScore  ⭐ (fonctionnalité différenciante)
 * =============================================================================
 *  Le TrustScore (0–100) mesure la CRÉDIBILITÉ d'un pronostiqueur. Il ne se
 *  limite pas au simple taux de réussite : un joueur qui gagne des cotes faibles
 *  ne vaut pas celui qui touche juste sur des cotes difficiles.
 *
 *  FORMULE (pondérée) — appliquée aux pronostics DÉJÀ RÉSOLUS (gagné/perdu) :
 *
 *    TrustScore = 100 * (
 *        0.42 * Réussite        // taux de victoires (récence sur-pondérée)
 *      + 0.24 * Difficulté      // qualité des cotes gagnées (cote haute = +)
 *      + 0.18 * Régularité      // faible variance = confiance (anti-« coup de bol »)
 *      + 0.16 * Volume          // maturité de l'échantillon (log, plafonné)
 *    ) * BonusSérie             // multiplicateur lié au streak en cours
 *
 *  Détails de chaque composante (toutes normalisées entre 0 et 1) :
 *   • Réussite : moyenne pondérée des résultats, les pronostics RÉCENTS comptant
 *     davantage (poids décroissant). Un bon passé lointain compte moins qu'une
 *     bonne forme actuelle.
 *   • Difficulté : moyenne des cotes des paris GAGNÉS, ramenée sur [0,1] via une
 *     cote de référence (3.0). Gagner à 2.50 rapporte plus que gagner à 1.30.
 *   • Régularité : 1 - écart-type normalisé des résultats. Récompense la
 *     constance, pénalise l'irrégularité (alternance gagné/perdu).
 *   • Volume : log10(n+1) / log10(31), plafonné à 1 (≈ 30 pronostics = maturité).
 *     Empêche un 3/3 chanceux d'écraser un 40/60 solide.
 *   • BonusSérie : 1.00 base, +0.02 par victoire consécutive (streak), plafonné
 *     à 1.10 ; une série de défaites applique un léger malus (min 0.94).
 *
 *  >>> En production, ce calcul sera fait côté serveur (PHP) et le score stocké
 *  en base pour le classement, mais la formule reste la même. <<<
 * ========================================================================== */

/**
 * Calcule le TrustScore et un paquet complet de statistiques pour un utilisateur.
 * @param {string} userId
 * @returns {object} stats détaillées
 */
function computeStats(userId) {
  const all = API.mockData.predictions.filter((p) => p.auteurId === userId);
  // On ne garde que les pronostics résolus, du plus ancien au plus récent.
  const resolus = all
    .filter((p) => p.statut === "gagne" || p.statut === "perdu")
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const gagnes = resolus.filter((p) => p.statut === "gagne");
  const perdus = resolus.filter((p) => p.statut === "perdu");
  const enCours = all.filter((p) => p.statut === "en_cours");

  const nbResolus = resolus.length;
  const nbGagnes = gagnes.length;
  const nbPerdus = perdus.length;

  // -- Cas sans historique : score neutre bas.
  if (nbResolus === 0) {
    return {
      trustScore: 0,
      tauxReussite: 0,
      total: all.length, nbGagnes: 0, nbPerdus: 0, nbEnCours: enCours.length,
      streak: 0, streakType: null,
      roi: 0, coteMoyenneGagnee: 0, cagnotte: CAGNOTTE_DEPART,
      forme: [], // sparkline
      parLigue: [],
      sportFavori: "—",
      badge: PALIERS_BADGE[PALIERS_BADGE.length - 1],
      composantes: null,
    };
  }

  // --- Composante RÉUSSITE (pondérée par récence) ---
  // Poids linéaire croissant : le i-ème pronostic (récent) pèse (i+1).
  let sommePoids = 0, sommeGagne = 0;
  resolus.forEach((p, i) => {
    const poids = i + 1; // plus récent = poids plus élevé
    sommePoids += poids;
    if (p.statut === "gagne") sommeGagne += poids;
  });
  const reussite = sommeGagne / sommePoids; // [0,1]

  // Taux de réussite « brut » (affiché), non pondéré.
  const tauxReussite = Math.round((nbGagnes / nbResolus) * 100);

  // --- Composante DIFFICULTÉ (qualité des cotes gagnées) ---
  const COTE_REF = 3.0;
  const coteMoyenneGagnee = nbGagnes
    ? gagnes.reduce((s, p) => s + p.cote, 0) / nbGagnes
    : 0;
  const difficulte = Math.min(1, coteMoyenneGagnee / COTE_REF);

  // --- Composante RÉGULARITÉ (1 - variance normalisée) ---
  const suite = resolus.map((p) => (p.statut === "gagne" ? 1 : 0));
  const moyenne = suite.reduce((a, b) => a + b, 0) / suite.length;
  const variance = suite.reduce((s, v) => s + (v - moyenne) ** 2, 0) / suite.length;
  // La variance max d'une variable binaire est 0.25 (à 50/50) → normalisation.
  const regularite = 1 - Math.min(1, variance / 0.25);

  // --- Composante VOLUME (maturité de l'échantillon) ---
  const volume = Math.min(1, Math.log10(nbResolus + 1) / Math.log10(31));

  // --- Série en cours (streak) sur les résolus récents ---
  const { streak, streakType } = calcStreak(resolus);

  // --- Bonus/malus de série ---
  let bonusSerie = 1.0;
  if (streakType === "gagne") bonusSerie = Math.min(1.1, 1 + 0.02 * streak);
  else if (streakType === "perdu") bonusSerie = Math.max(0.94, 1 - 0.015 * streak);

  // --- Agrégation finale ---
  const brut =
    0.42 * reussite +
    0.24 * difficulte +
    0.18 * regularite +
    0.16 * volume;
  const trustScore = Math.max(0, Math.min(100, Math.round(brut * 100 * bonusSerie)));

  // --- ROI théorique : mise fictive de 1 unité par pronostic résolu ---
  // Gain = cote (si gagné), 0 sinon ; ROI = (gains - mises) / mises.
  const gains = gagnes.reduce((s, p) => s + p.cote, 0);
  const roi = Math.round(((gains - nbResolus) / nbResolus) * 100);

  // --- Cagnotte virtuelle (FCFA) : mise fixe par pronostic résolu ---
  // Départ 10 000 FCFA ; chaque pari gagné rapporte cote×mise, sinon on perd la mise.
  const cagnotte = Math.round(CAGNOTTE_DEPART + gains * MISE_VIRTUELLE - nbResolus * MISE_VIRTUELLE);

  // --- Sparkline « forme » : 12 derniers résolus (récent à droite) ---
  const forme = resolus.slice(-12).map((p) => (p.statut === "gagne" ? "g" : "p"));

  // --- Fiabilité par ligue ---
  const parLigue = computeParLigue(resolus);

  // --- Sport favori (le plus fréquent) ---
  const sportFavori = (API.mockData.users.find((u) => u.id === userId)?.sports || ["—"])[0];

  // --- Badge de réputation ---
  const badge = PALIERS_BADGE.find((b) => trustScore >= b.min);

  return {
    trustScore, tauxReussite,
    total: all.length, nbGagnes, nbPerdus, nbEnCours: enCours.length, nbResolus,
    streak, streakType,
    roi, coteMoyenneGagnee: coteMoyenneGagnee || 0, cagnotte,
    forme, parLigue, sportFavori, badge,
    // Décomposition détaillée pour le modal de transparence du TrustScore.
    composantes: {
      reussite: { valeur: reussite, poids: 0.42, contribution: 0.42 * reussite },
      difficulte: { valeur: difficulte, poids: 0.24, contribution: 0.24 * difficulte },
      regularite: { valeur: regularite, poids: 0.18, contribution: 0.18 * regularite },
      volume: { valeur: volume, poids: 0.16, contribution: 0.16 * volume },
      bonusSerie,
    },
  };
}

/** Calcule la série en cours (nb + type) à partir des résolus récents. */
function calcStreak(resolus) {
  if (!resolus.length) return { streak: 0, streakType: null };
  const dernier = resolus[resolus.length - 1].statut; // 'gagne' | 'perdu'
  let streak = 0;
  for (let i = resolus.length - 1; i >= 0; i--) {
    if (resolus[i].statut === dernier) streak++;
    else break;
  }
  return { streak, streakType: dernier };
}

/** Fiabilité (taux de réussite) regroupée par ligue. */
function computeParLigue(resolus) {
  const map = {};
  resolus.forEach((p) => {
    const lg = p.match.ligue;
    if (!map[lg]) map[lg] = { total: 0, gagnes: 0 };
    map[lg].total++;
    if (p.statut === "gagne") map[lg].gagnes++;
  });
  return Object.entries(map)
    .map(([ligue, v]) => ({ ligue, total: v.total, pct: Math.round((v.gagnes / v.total) * 100) }))
    .sort((a, b) => b.pct - a.pct || b.total - a.total)
    .slice(0, 4);
}

/* -----------------------------------------------------------------------------
 *  3. Utilitaires
 * --------------------------------------------------------------------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Échappe le HTML pour éviter toute injection depuis les textes utilisateurs. */
function esc(str = "") {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Transforme les #hashtags en liens cliquables (après échappement).
 *  Le « # » doit être en début de texte ou précédé d'un caractère non-mot ET
 *  non-« & », afin de NE PAS matcher les entités HTML comme &#39; (apostrophe). */
function linkifyHashtags(txt) {
  return esc(txt).replace(/(^|[^&\w])#(\w+)/g,
    (m, pre, tag) => `${pre}<a href="#/hashtag/${tag}" style="color:var(--accent);font-weight:600">#${tag}</a>`);
}

/** Formatage FCFA / cote. */
function fmtCote(c) { return Number(c).toFixed(2); }

/** Formate un montant en FCFA (ex. 12 500 FCFA). */
function fmtFCFA(n) { return Math.round(n).toLocaleString("fr-FR") + " FCFA"; }

/* --- Catalogue des championnats : index synchrone { nom → championnat } --- */
// Ordre d'affichage des régions (barre de filtres + menu de création).
const ORDRE_REGIONS = ["Afrique", "Europe", "Amériques", "Asie & Moyen-Orient", "International", "Autres sports"];
const CHAMP_INDEX = {};
function buildChampIndex() {
  API.mockData.championnats.forEach((c) => { CHAMP_INDEX[c.nom] = c; });
}
/** Emoji/drapeau d'un championnat à partir de son nom (défaut : 🏆). */
function ligueEmoji(nom) { return (CHAMP_INDEX[nom] || {}).emoji || "🏆"; }

/** Sport d'un championnat (football par défaut). */
function champSport(nom) { return (CHAMP_INDEX[nom] || {}).sport || "Football"; }

/** Emoji représentatif d'un sport (pour le filtre par sport). */
const SPORT_EMOJI = { Football: "⚽", Basket: "🏀", Tennis: "🎾", "Formule 1": "🏎️", Rugby: "🏉", MMA: "🥊" };
function sportEmoji(sport) { return SPORT_EMOJI[sport] || "🏅"; }

/** Options <optgroup> du sélecteur de championnat, groupées par région. */
function champOptionsHTML() {
  const regions = {};
  API.mockData.championnats.forEach((c) => {
    (regions[c.region] = regions[c.region] || []).push(c);
  });
  let html = "";
  ORDRE_REGIONS.forEach((r) => {
    if (!regions[r]) return;
    html += `<optgroup label="${esc(r)}">` +
      regions[r].map((c) => `<option value="${esc(c.nom)}">${c.emoji} ${esc(c.nom)} (${esc(c.pays)})</option>`).join("") +
      `</optgroup>`;
  });
  html += `<optgroup label="Autre"><option value="Autre">🏟️ Autre compétition</option></optgroup>`;
  return html;
}

/** Distance temporelle « il y a … » en français. */
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  const j = Math.floor(diff / 86400);
  if (j < 7) return `${j} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Date de match lisible (ex. « jeu. 10 juil. · 18:30 »). */
function fmtMatchDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) +
    " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Date d'inscription (« Inscrit depuis janvier 2024 »). */
function fmtInscription(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

/** Étoiles de confiance (pleines + vides). */
function starsHTML(n) {
  let s = "";
  for (let i = 1; i <= 5; i++) s += `<span class="${i <= n ? "" : "off"}">★</span>`;
  return `<span class="stars" title="Confiance ${n}/5">${s}</span>`;
}

/** Badge de vérification (petit) à côté du pseudo. */
function verifHTML(badge) {
  if (!badge) return "";
  const cls = esc(badge);
  const ico = badge === "Vérifié" ? "✓" : badge === "Pro" ? "★" : "↗";
  return `<span class="badge-verif ${cls}" title="${cls}">${ico}</span>`;
}

/** Affiche un toast. type : '', 'ok', 'err'. */
function toast(msg, type = "") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = msg;
  $("#toastWrap").appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s, transform .3s";
    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

/** Skeleton de chargement. */
function loaderHTML() {
  return `<div class="loader"><div class="spinner"></div></div>`;
}

/* -----------------------------------------------------------------------------
 *  4. Composants réutilisables
 * --------------------------------------------------------------------------- */

/** Avatar coloré (emoji). */
function avatarHTML(user, taille = "sm") {
  const bg = user.couleur ? `background:${user.couleur}22;border-color:${user.couleur}66` : "";
  return `<div class="avatar ${taille}" style="${bg}" data-nav="#/profile/${user.id}">${user.avatar}</div>`;
}

// Palette de réactions rapides.
const EMOJIS_REACT = ["❤️", "🔥", "😮", "👏", "😂", "💯"];

/** Barre de réactions emoji (pronostics et messages). kind : 'pred' | 'msg'. */
function reactionsHTML(reactions, kind, id) {
  reactions = reactions || {};
  const me = API.mockData.currentUserId;
  const chips = Object.entries(reactions)
    .filter(([, arr]) => arr.length)
    .map(([e, arr]) => `<button class="react-chip ${arr.includes(me) ? "on" : ""}" data-react="${kind}:${id}" data-emoji="${e}">${e} <span>${arr.length}</span></button>`)
    .join("");
  return `<div class="reactions" id="react-${kind}-${id}">
    ${chips}
    <div class="react-add-wrap">
      <button class="react-add" data-reactadd title="Réagir">🙂<b>+</b></button>
      <div class="react-palette">${EMOJIS_REACT.map((e) => `<button data-react="${kind}:${id}" data-emoji="${e}">${e}</button>`).join("")}</div>
    </div>
  </div>`;
}

/**
 * CARTE DE PRONOSTIC — composant central, réutilisé dans le feed, le profil,
 * l'exploration, etc.
 * @param {object} p pronostic
 * @param {object} opts { clampAnalyse: bool }
 */
function predictionCardHTML(p, opts = {}) {
  const auteur = API.mockData.users.find((u) => u.id === p.auteurId);
  const me = API.mockData.currentUserId;
  const m = p.match;
  const liked = p.likes.includes(me);
  const reposted = p.reposts.includes(me);
  const saved = p.sauvegardes.includes(me);
  const clamp = opts.clampAnalyse !== false;
  const scoreBadge = m.score
    ? `<span class="score">${esc(m.score)}</span>`
    : `<span class="vs-label">VS</span>`;

  // Bouton de résolution démo (uniquement pour mes pronostics en cours).
  const resolveBtn = (p.auteurId === me && p.statut === "en_cours")
    ? `<button class="resolve-demo" data-resolve="${p.id}" title="Simuler le résultat (démo)">⚡ Résoudre (démo)</button>`
    : "";

  return `
  <article class="card" data-card="${p.id}">
    <div class="card-head">
      ${avatarHTML(auteur, "sm")}
      <div class="who">
        <div class="line1">
          <span class="name" data-nav="#/profile/${auteur.id}">${esc(auteur.nom)}</span>
          ${verifHTML(auteur.badge)}
          <span class="handle">@${esc(auteur.pseudo)}</span>
          <span class="time">${timeAgo(p.date)}</span>
        </div>
      </div>
      ${p.premium ? `<span class="premium-tag" title="Coup sûr / Mode confiance">🔒 Coup sûr</span>` : `<button class="card-menu">···</button>`}
    </div>

    <div class="match-box" data-nav="#/prediction/${p.id}">
      <div class="match-league">
        <span class="lg" data-nav="#/championnat/${encodeURIComponent(m.ligue)}">${ligueEmoji(m.ligue)} ${esc(m.ligue)}</span>
        <span>${fmtMatchDate(m.date)}</span>
      </div>
      <div class="match-teams">
        <div class="team">
          <div class="tlogo">${m.logoA}</div>
          <div class="tname">${esc(m.equipeA)}</div>
        </div>
        <div class="vs">${scoreBadge}</div>
        <div class="team">
          <div class="tlogo">${m.logoB}</div>
          <div class="tname">${esc(m.equipeB)}</div>
        </div>
      </div>
    </div>

    <div class="bet-box">
      <span class="bet-type">${esc(p.typePari)}</span>
      <span class="bet-choice">${esc(p.choix)}</span>
      ${starsHTML(p.confiance)}
      <span class="bet-cote">${fmtCote(p.cote)}<small>${p.bookmaker ? esc(p.bookmaker) : "COTE"}</small></span>
    </div>

    <p class="analyse ${clamp ? "clamp" : ""}" data-analyse>${linkifyHashtags(p.analyse)}</p>
    ${clamp && p.analyse.length > 150 ? `<button class="voir-plus" data-voirplus>Voir plus</button>` : ""}

    <div class="statut-banner statut-${p.statut}">
      <span>${LIBELLE_STATUT[p.statut]}</span>
      ${resolveBtn}
    </div>

    ${reactionsHTML(p.reactions, "pred", p.id)}

    <div class="actions">
      <button class="action like ${liked ? "on" : ""}" data-like="${p.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/></svg>
        <span data-count>${p.likes.length}</span>
      </button>
      <button class="action comment" data-nav="#/prediction/${p.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 9 9 0 01-4-.9L3 21l1.9-4.5A8.4 8.4 0 0121 11.5z"/></svg>
        <span>${p.commentaires.length}</span>
      </button>
      <button class="action repost ${reposted ? "on" : ""}" data-repost="${p.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 2l4 4-4 4"/><path d="M3 12V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 12v3a4 4 0 01-4 4H3"/></svg>
        <span data-count>${p.reposts.length}</span>
      </button>
      <button class="action save ${saved ? "on" : ""}" data-save="${p.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
      </button>
      <button class="action share" data-share="${p.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>
      </button>
    </div>
  </article>`;
}

/* ---- Statut dérivé d'un coupon combiné (perdu > en_cours > gagné) ---- */
function couponStatut(c) {
  if (c.selections.some((s) => s.statut === "perdu")) return "perdu";
  if (c.selections.every((s) => s.statut === "gagne")) return "gagne";
  return "en_cours";
}

/** CARTE DE COUPON COMBINÉ (innovation « le combiné »). */
function couponCardHTML(c) {
  const auteur = API.mockData.users.find((u) => u.id === c.auteurId);
  const me = API.mockData.currentUserId;
  const coteTotale = c.selections.reduce((acc, s) => acc * s.cote, 1);
  const statut = couponStatut(c);
  const liked = c.likes.includes(me);
  const nbGagnes = c.selections.filter((s) => s.statut === "gagne").length;

  const selsHTML = c.selections.map((s) => {
    const ico = s.statut === "gagne" ? "🟢" : s.statut === "perdu" ? "🔴" : "🟡";
    return `
      <div class="cp-sel">
        <span class="cp-sel-ico">${ico}</span>
        <div class="cp-sel-main">
          <div class="cp-sel-match">${esc(s.equipeA)} <span class="cp-vs">vs</span> ${esc(s.equipeB)}</div>
          <div class="cp-sel-choix">${ligueEmoji(s.ligue)} ${esc(s.ligue)} · <b>${esc(s.choix)}</b></div>
        </div>
        <span class="cp-sel-cote">${fmtCote(s.cote)}</span>
      </div>`;
  }).join("");

  return `
  <article class="card coupon-card" data-card="${c.id}">
    <div class="card-head">
      ${avatarHTML(auteur, "sm")}
      <div class="who">
        <div class="line1">
          <span class="name" data-nav="#/profile/${auteur.id}">${esc(auteur.nom)}</span>
          ${verifHTML(auteur.badge)}
          <span class="handle">@${esc(auteur.pseudo)}</span>
          <span class="time">${timeAgo(c.date)}</span>
        </div>
      </div>
      <span class="coupon-tag">🎟️ Combiné ×${c.selections.length}</span>
    </div>

    <div class="coupon-title">${esc(c.titre)} ${c.premium ? '<span class="premium-tag">🔒 Coup sûr</span>' : ""}</div>

    <div class="coupon-body">${selsHTML}</div>

    <div class="coupon-foot">
      <div class="cp-progress">
        <span>${nbGagnes}/${c.selections.length} validées</span>
        <div class="cp-track"><div class="cp-fill" style="width:${(nbGagnes / c.selections.length) * 100}%"></div></div>
      </div>
      <div class="cp-total">
        <span class="cp-total-lbl">Cote totale</span>
        <span class="cp-total-val">${fmtCote(coteTotale)}</span>
      </div>
    </div>

    <div class="statut-banner statut-${statut}" style="margin-top:10px">
      <span>${LIBELLE_STATUT[statut]}</span>
    </div>

    <div class="actions">
      <button class="action like ${liked ? "on" : ""}" data-couponlike="${c.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z"/></svg>
        <span data-count>${c.likes.length}</span>
      </button>
      <button class="action repost">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 2l4 4-4 4"/><path d="M3 12V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 12v3a4 4 0 01-4 4H3"/></svg>
        <span>${c.reposts.length}</span>
      </button>
      <button class="action save" data-share="${c.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>
      </button>
    </div>
  </article>`;
}

/** SONDAGE COMMUNAUTAIRE (barres de vote animées). */
function pollHTML(p) {
  const s = p.sondage;
  if (!s) return "";
  const me = API.mockData.currentUserId;
  const aVote = s.votants.includes(me);
  const total = s.options.reduce((acc, o) => acc + o.votes, 0) || 1;
  const maxVotes = Math.max(...s.options.map((o) => o.votes));

  const opts = s.options.map((o, i) => {
    const pct = Math.round((o.votes / total) * 100);
    const lead = aVote && o.votes === maxVotes ? "lead" : "";
    return `
      <button class="poll-opt ${aVote ? "voted" : ""} ${lead}" data-vote="${p.id}" data-optindex="${i}" ${aVote ? "disabled" : ""}>
        <span class="poll-fill" style="width:${aVote ? pct : 0}%"></span>
        <span class="poll-label">${esc(o.label)}</span>
        <span class="poll-pct">${aVote ? pct + "%" : ""}</span>
      </button>`;
  }).join("");

  return `
    <div class="poll" data-poll="${p.id}">
      <div class="poll-q">📊 ${esc(s.question)}</div>
      <div class="poll-opts">${opts}</div>
      <div class="poll-total">${total.toLocaleString("fr-FR")} vote${total > 1 ? "s" : ""} ${aVote ? "· Merci pour ton vote !" : "· Clique pour voter"}</div>
    </div>`;
}

/**
 * COACH IA — analyse simulée (heuristique 100 % front, aucune donnée externe).
 * Combine la fiabilité de l'auteur (TrustScore), sa réussite sur la ligue du
 * match et la cote proposée pour rendre un « indice de confiance IA » + verdict.
 * >>> Point d'intégration : remplacer par un appel au service d'analyse. <<<
 */
function coachIA(p) {
  const s = computeStats(p.auteurId);
  // Fiabilité de l'auteur sur cette ligue précise (sinon réussite globale).
  const lg = s.parLigue.find((l) => l.ligue === p.match.ligue);
  const fiabLigue = lg ? lg.pct : s.tauxReussite;
  // Score IA pondéré : 45% TrustScore, 35% fiabilité ligue, 20% « raison » de la cote.
  // Une cote entre 1.4 et 2.2 est jugée « raisonnable » (bonus), très haute = risque.
  const coteScore = p.cote <= 1.35 ? 55 : p.cote <= 2.2 ? 90 : p.cote <= 3 ? 65 : 40;
  const indice = Math.round(0.45 * s.trustScore + 0.35 * fiabLigue + 0.20 * coteScore);

  let verdict, couleur, emoji;
  if (indice >= 72) { verdict = "Pronostic solide — l'historique et la cote sont cohérents."; couleur = "var(--vert)"; emoji = "✅"; }
  else if (indice >= 55) { verdict = "Pronostic correct — à jouer avec mesure."; couleur = "var(--jaune)"; emoji = "🟡"; }
  else { verdict = "Prudence — profil ou cote à risque sur ce pari."; couleur = "var(--rouge)"; emoji = "⚠️"; }

  return { indice, verdict, couleur, emoji, fiabLigue, trust: s.trustScore };
}

function coachIAHTML(p) {
  const ia = coachIA(p);
  return `
    <div class="coach-ia" style="--ia:${ia.couleur}">
      <div class="ia-head">
        <span class="ia-badge">🤖 Coach IA</span>
        <span class="ia-indice">${ia.indice}<small>/100</small></span>
      </div>
      <div class="ia-bar"><div class="ia-bar-fill" style="width:${ia.indice}%"></div></div>
      <div class="ia-verdict">${ia.emoji} ${esc(ia.verdict)}</div>
      <div class="ia-detail">
        Basé sur : TrustScore auteur <b>${ia.trust}</b> · fiabilité ${esc(p.match.ligue)} <b>${ia.fiabLigue}%</b> · cote <b>${fmtCote(p.cote)}</b>.
        <span class="ia-note">Analyse simulée à titre indicatif — pas un conseil de pari.</span>
      </div>
    </div>`;
}

/** Comparateur de cotes affiché sur le détail d'un pronostic. */
function comparatorHTML(p) {
  // Cotes enregistrées à la création, sinon générées autour de la cote retenue.
  let cotes, best;
  if (p.cotesComparees && p.cotesComparees.length) {
    cotes = p.cotesComparees.map((c) => {
      const bk = API.mockData.bookmakers.find((b) => b.nom === c.nom) || { nom: c.nom, c: "#888" };
      return { bookmaker: bk, cote: c.cote };
    });
    best = Math.max(...cotes.map((c) => c.cote));
  } else {
    const gen = API.oddsAround(p.cote, p.id);
    cotes = gen.cotes; best = gen.best;
  }
  const rows = cotes.slice().sort((a, b) => b.cote - a.cote).map((c) => `
    <div class="comp-row ${c.cote === best ? "best" : ""} ${c.bookmaker.nom === p.bookmaker ? "chosen" : ""}">
      <span class="comp-bk"><i style="background:${c.bookmaker.c}"></i>${esc(c.bookmaker.nom)}</span>
      <span class="comp-cote">${fmtCote(c.cote)}</span>
      ${c.cote === best ? `<span class="comp-best">⭐ Meilleure</span>` : (c.bookmaker.nom === p.bookmaker ? `<span class="comp-pick">Retenue</span>` : "")}
    </div>`).join("");
  return `<div class="comparator detail">
    <div class="comp-title">💰 Cotes comparées — <b>${esc(p.choix)}</b></div>
    ${rows}
    <div class="comp-note">Cotes indicatives et simulées${p.bookmaker ? ` · pronostic pris chez <b>${esc(p.bookmaker)}</b>` : ""}.</div>
  </div>`;
}

/** Ticker de matchs en direct (mis à jour par un timer). */
function liveTickerHTML(matchs) {
  if (!matchs.length) return "";
  const items = matchs.map((m) => `
    <div class="live-item" data-live="${m.id}">
      <span class="live-dot"></span>
      <span class="live-min" data-min>${m.minute}'</span>
      <span class="live-team">${m.logoA} ${esc(m.equipeA)}</span>
      <span class="live-score" data-score>${m.scoreA}-${m.scoreB}</span>
      <span class="live-team">${esc(m.equipeB)} ${m.logoB}</span>
      <span class="live-lg">${esc(m.ligue)}</span>
    </div>`).join("");
  return `
    <div class="live-ticker">
      <div class="live-badge"><span class="live-dot"></span> EN DIRECT</div>
      <div class="live-track">${items}${items}</div>
    </div>`;
}

/* -----------------------------------------------------------------------------
 *  5. Vues
 * --------------------------------------------------------------------------- */

const view = () => $("#view");

function setTop(title, sub = "") {
  $("#topTitle").textContent = title;
  $("#topSub").textContent = sub;
}

/* ---- 5.1 FEED (accueil) ---- */
async function renderFeed() {
  setTop("Accueil", "Fil des comptes suivis");
  view().innerHTML = loaderHTML();
  const [preds, live] = await Promise.all([API.getFeed(), API.getLive()]);
  if (!preds.length) {
    view().innerHTML = liveTickerHTML(live) + emptyHTML("📭", "Ton fil est vide", "Suis des pronostiqueurs pour voir leurs analyses ici.");
    startLiveTicker();
    return;
  }
  view().innerHTML = liveTickerHTML(live) + `<div class="feed">${preds.map((p) => predictionCardHTML(p)).join("")}</div>`;
  startLiveTicker();
  observeReveal();
}

/* Timer du ticker « en direct » : fait progresser minute et score (simulation). */
let liveTimer = null;
function startLiveTicker() {
  clearInterval(liveTimer);
  liveTimer = setInterval(() => {
    // Si le ticker n'est plus à l'écran, on arrête le timer (économie).
    if (!document.querySelector(".live-ticker")) { clearInterval(liveTimer); return; }
    API.mockData.liveMatches.forEach((m) => {
      if (m.minute < 90) m.minute += 1;
      // ~4 % de chance de but à chaque tick pour animer les scores.
      if (Math.random() < 0.04) { Math.random() < 0.5 ? m.scoreA++ : m.scoreB++; }
    });
    // Reflet dans le DOM (tous les items, y compris la copie dupliquée du défilé).
    $$(".live-item").forEach((el) => {
      const m = API.mockData.liveMatches.find((x) => x.id === el.dataset.live);
      if (!m) return;
      const min = el.querySelector("[data-min]");
      const sc = el.querySelector("[data-score]");
      if (min) min.textContent = m.minute + "'";
      if (sc) sc.textContent = `${m.scoreA}-${m.scoreB}`;
    });
  }, 3000);
}

/* ---- 5.2 EXPLORER (sport + championnats du monde + filtre) ---- */
// Filtres courants (sport + championnat) + données mises en cache pour le re-rendu.
let exploreSport = "tous";
let exploreFilter = "tous";
let exploreData = { preds: [], coupons: [], champs: [] };

async function renderExplore(preselect = null) {
  setTop("Explorer", "Championnats du monde entier 🌍");
  view().innerHTML = loaderHTML();
  const [preds, coupons, champs] = await Promise.all([
    API.getAllPredictions(), API.getCoupons(), API.getChampionnats(),
  ]);
  exploreData = { preds, coupons, champs };
  if (preselect) { exploreFilter = preselect; exploreSport = champSport(preselect); }

  view().innerHTML = `
    <div class="sport-bar" id="sportBar">${sportBarHTML()}</div>
    <div class="champ-bar" id="champBar">${champBarHTML()}</div>
    <div id="exploreList"></div>`;
  renderExploreList();
}

/** Barre de filtres par SPORT (niveau supérieur). */
function sportBarHTML() {
  const { preds } = exploreData;
  // Compte des pronostics par sport (via le championnat de chaque pronostic).
  const counts = {};
  preds.forEach((p) => { const s = champSport(p.match.ligue); counts[s] = (counts[s] || 0) + 1; });
  const sports = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

  let chips = `<button class="sport-chip ${exploreSport === "tous" ? "active" : ""}" data-sport="tous">🌍 Tous les sports</button>`;
  chips += sports.map((s) =>
    `<button class="sport-chip ${exploreSport === s ? "active" : ""}" data-sport="${esc(s)}">${sportEmoji(s)} ${esc(s)} <span class="cc-n">${counts[s]}</span></button>`
  ).join("");
  return chips;
}

/** Barre de filtres par championnat (filtrée par sport, groupée par région). */
function champBarHTML() {
  const { preds, champs } = exploreData;
  const counts = {};
  preds.forEach((p) => { counts[p.match.ligue] = (counts[p.match.ligue] || 0) + 1; });

  // Championnats ayant au moins un pronostic, filtrés par le sport sélectionné.
  const actifs = champs.filter((c) => counts[c.nom] &&
    (exploreSport === "tous" || champSport(c.nom) === exploreSport));
  const totalSport = exploreSport === "tous"
    ? preds.length
    : preds.filter((p) => champSport(p.match.ligue) === exploreSport).length;
  const tous = `<button class="champ-chip ${exploreFilter === "tous" ? "active" : ""}" data-champ="tous">🌐 Tous <span class="cc-n">${totalSport}</span></button>`;

  // On groupe visuellement par région (séparateurs).
  let chips = tous;
  ORDRE_REGIONS.forEach((region) => {
    const dansRegion = actifs.filter((c) => c.region === region);
    if (!dansRegion.length) return;
    chips += `<span class="champ-sep">${region}</span>`;
    chips += dansRegion.map((c) =>
      `<button class="champ-chip ${exploreFilter === c.nom ? "active" : ""}" data-champ="${esc(c.nom)}">${c.emoji} ${esc(c.nom)} <span class="cc-n">${counts[c.nom]}</span></button>`
    ).join("");
  });
  return chips;
}

/** Rendu de la liste filtrée par sport puis par championnat. */
function renderExploreList() {
  const box = $("#exploreList");
  if (!box) return;
  const { preds, coupons } = exploreData;
  const f = exploreFilter;

  // Filtrage : championnat précis > sinon sport > sinon tout.
  let fp;
  if (f !== "tous") fp = preds.filter((p) => p.match.ligue === f);
  else if (exploreSport !== "tous") fp = preds.filter((p) => champSport(p.match.ligue) === exploreSport);
  else fp = preds;

  // Les coupons couvrent plusieurs championnats : affichés seulement en vue « Tous / Tous sports ».
  const fc = (f === "tous" && exploreSport === "tous") ? coupons : [];

  let html = "";
  if (fc.length) {
    html += `<div class="section-title">🎟️ Coupons combinés à la une</div>
      <div class="feed">${fc.map((c) => couponCardHTML(c)).join("")}</div>`;
  }
  let titre;
  if (f !== "tous") titre = `${ligueEmoji(f)} ${esc(f)} — ${fp.length} pronostic${fp.length > 1 ? "s" : ""}`;
  else if (exploreSport !== "tous") titre = `${sportEmoji(exploreSport)} ${esc(exploreSport)} — ${fp.length} pronostic${fp.length > 1 ? "s" : ""}`;
  else titre = "🔥 Pronostics du moment";
  html += `<div class="section-title">${titre}</div>`;
  html += fp.length
    ? `<div class="feed">${fp.map((p) => predictionCardHTML(p)).join("")}</div>`
    : emptyHTML("🗒️", "Aucun pronostic", "Rien ici pour l'instant.");
  box.innerHTML = html;
  observeReveal();
}

/* ---- 5.2b PAGE DÉDIÉE D'UN CHAMPIONNAT (en-tête + classement + pronostics) ---- */
async function renderChampionnatPage(nom) {
  const champ = CHAMP_INDEX[nom];
  setTop(nom, champ ? `${champ.pays} · ${champSport(nom)}` : "Championnat");
  view().innerHTML = loaderHTML();
  const preds = await API.getAllPredictions();
  const list = preds.filter((p) => p.match.ligue === nom);

  // Statistiques communautaires du championnat.
  const resolus = list.filter((p) => p.statut === "gagne" || p.statut === "perdu");
  const gagnes = resolus.filter((p) => p.statut === "gagne").length;
  const enCours = list.filter((p) => p.statut === "en_cours").length;
  const tauxComm = resolus.length ? Math.round((gagnes / resolus.length) * 100) : 0;

  // Classement des pronostiqueurs SUR CE championnat (réussite puis volume).
  const parUser = {};
  list.forEach((p) => {
    const u = (parUser[p.auteurId] = parUser[p.auteurId] || { total: 0, gagnes: 0, resolus: 0 });
    u.total++;
    if (p.statut === "gagne") { u.gagnes++; u.resolus++; }
    else if (p.statut === "perdu") u.resolus++;
  });
  const classement = Object.entries(parUser)
    .map(([id, v]) => ({ u: API.mockData.users.find((x) => x.id === id), v, pct: v.resolus ? Math.round((v.gagnes / v.resolus) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct || b.v.total - a.v.total)
    .slice(0, 5);

  const emoji = ligueEmoji(nom);
  // Méta : pays · région · sport, en évitant de répéter pays == région (ex. CAN).
  let meta = "";
  if (champ) {
    const lieu = champ.pays === champ.region ? esc(champ.region) : `${esc(champ.pays)} · ${esc(champ.region)}`;
    meta = `${lieu} · ${sportEmoji(champSport(nom))} ${esc(champSport(nom))}`;
  }

  view().innerHTML = `
    <div class="champ-hero">
      <div class="champ-hero-emoji">${emoji}</div>
      <div class="champ-hero-info">
        <div class="champ-hero-name">${esc(nom)}</div>
        <div class="champ-hero-meta">${meta}</div>
      </div>
    </div>

    <div class="champ-stats">
      <div class="cs-cell"><div class="v">${list.length}</div><div class="l">Pronostics</div></div>
      <div class="cs-cell"><div class="v live">${enCours}</div><div class="l">En cours</div></div>
      <div class="cs-cell"><div class="v">${resolus.length}</div><div class="l">Résolus</div></div>
      <div class="cs-cell"><div class="v win">${tauxComm}%</div><div class="l">Réussite comm.</div></div>
    </div>

    ${classement.length ? `
      <div class="section-title">🏆 Meilleurs pronostiqueurs sur ${esc(nom)}</div>
      ${classement.map(({ u, v, pct }, i) => `
        <div class="lb-row" data-nav="#/profile/${u.id}">
          <div class="lb-rank ${i < 3 ? "top" + (i + 1) : ""}">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</div>
          ${avatarHTML(u, "md")}
          <div class="lb-info">
            <div class="n">${esc(u.nom)} ${verifHTML(u.badge)}</div>
            <div class="h">@${esc(u.pseudo)} · ${v.total} prono${v.total > 1 ? "s" : ""} · ${v.gagnes}/${v.resolus} gagnés</div>
          </div>
          <div class="lb-score"><div class="s">${pct}%</div><div class="ss">réussite</div></div>
        </div>`).join("")}
    ` : ""}

    <div class="section-title">${emoji} Tous les pronostics — ${list.length}</div>
    ${list.length
      ? `<div class="feed">${list.map((p) => predictionCardHTML(p)).join("")}</div>`
      : emptyHTML("🗒️", "Aucun pronostic", "Personne n'a encore publié sur ce championnat.")}
  `;
  observeReveal();
}

/* ---- 5.3 PROFIL (cœur du produit) ---- */
async function renderProfile(userId, tab = "tous") {
  const u = await API.getUser(userId);
  if (!u) { view().innerHTML = emptyHTML("🤷🏾", "Profil introuvable", ""); return; }
  setTop(u.nom, `@${u.pseudo}`);

  const me = API.mockData.currentUserId;
  const isMe = userId === me;
  const suit = API.getCurrentUserSync().abonnements.includes(userId);
  const stats = computeStats(userId);

  // -- En-tête + bloc de stats de performance --
  view().innerHTML = `
    <div class="profile-banner" style="background:${u.banniere}"></div>
    <div class="profile-head">
      <div class="profile-avatar-row">
        ${avatarHTML(u, "xl")}
        <div class="profile-actions">
          ${isMe
            ? `<button class="btn" data-editprofile>✏️ Modifier le profil</button>`
            : `<button class="btn btn-icon" data-battle="${u.id}" title="Défier ${esc(u.pseudo)}">⚔️</button>
               <button class="btn btn-icon" data-msg="${u.id}" title="Envoyer un message"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 9 9 0 01-4-.9L3 21l1.9-4.5A8.4 8.4 0 0121 11.5z"/></svg></button>
               <button class="btn btn-follow ${suit ? "on" : ""}" data-follow="${u.id}"></button>`}
        </div>
      </div>

      <div class="profile-id">
        <div class="pname">${esc(u.nom)} ${verifHTML(u.badge)}
          <span class="rep-badge rep-${stats.badge.nom}">${stats.badge.emoji} ${stats.badge.nom}</span>
        </div>
        <div class="phandle">@${esc(u.pseudo)}</div>
      </div>

      <p class="profile-bio">${linkifyHashtags(u.bio)}</p>

      <div class="profile-meta">
        <span>⚽ ${u.sports.map(esc).join(", ")}</span>
        <span>📅 Inscrit depuis ${fmtInscription(u.inscription)}</span>
        <span>🏆 Spécialité : ${esc(stats.sportFavori)}</span>
      </div>

      <div class="profile-follows">
        <span data-nav="#/profile/${u.id}"><b>${u.abonnements.length}</b> abonnements</span>
        <span><b id="followerCount">${u.abonnes.length}</b> abonnés</span>
      </div>
    </div>

    ${perfBlockHTML(stats, userId)}

    <div class="tabs" id="profileTabs">
      ${["tous:Pronostics", "en_cours:En cours", "gagne:Gagnés", "perdu:Perdus", "analyses:Analyses", "likes:Likes"]
        .map((t) => { const [k, l] = t.split(":"); return `<button class="tab ${k === tab ? "active" : ""}" data-tab="${k}">${l}</button>`; })
        .join("")}
    </div>
    <div id="profileList">${loaderHTML()}</div>
  `;

  // Animer la jauge et les barres après insertion dans le DOM.
  requestAnimationFrame(() => animatePerf(stats));

  // Charger la liste des pronostics de l'onglet courant.
  loadProfileTab(userId, tab);
}

/** Bloc statistiques de performance (jauge, tuiles, streak, sparkline, ligues). */
function perfBlockHTML(s, userId = "") {
  const roiCls = s.roi >= 0 ? "pos" : "neg";
  const streakTxt = s.streak > 1 && s.streakType
    ? (s.streakType === "gagne"
        ? `${s.streak} victoires d'affilée 🔥`
        : `${s.streak} revers d'affilée — ça va remonter 💪`)
    : "Pas de série en cours";

  const sparkDots = s.forme.length
    ? s.forme.map((f) => `<div class="sl-dot ${f}" title="${f === "g" ? "Gagné" : "Perdu"}">${f === "g" ? "V" : "D"}</div>`).join("")
    : `<span style="color:var(--text-faint);font-size:.82rem">Aucun pronostic résolu pour l'instant.</span>`;

  const ligues = s.parLigue.length
    ? s.parLigue.map((l) => `
        <div class="bl-row">
          <span class="bl-name">${esc(l.ligue)}</span>
          <span class="bl-track"><span class="bl-fill" data-w="${l.pct}" style="width:0"></span></span>
          <span class="bl-pct">${l.pct}%</span>
        </div>`).join("")
    : `<div style="color:var(--text-faint);font-size:.82rem">Données par ligue bientôt disponibles.</div>`;

  const totalVD = s.nbGagnes + s.nbPerdus;
  const pctVictoire = totalVD ? (s.nbGagnes / totalVD) * 100 : 0;

  return `
  <section class="perf">
    <div class="perf-header">
      📈 Performances
      <span class="rep-badge rep-${s.badge.nom}">${s.badge.emoji} ${s.badge.nom}</span>
    </div>

    <div class="perf-grid">
      <div class="gauge" id="gauge" ${s.composantes ? `data-trustdetail="${userId}" role="button" tabindex="0" title="Voir le détail du TrustScore"` : ""}>
        <svg viewBox="0 0 120 120">
          <circle class="bg-ring" cx="60" cy="60" r="52"></circle>
          <circle class="fg-ring" cx="60" cy="60" r="52" id="gaugeFg"
            stroke="url(#gaugeGrad)" stroke-dasharray="326.7" stroke-dashoffset="326.7"></circle>
          <defs>
            <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#00c853"/>
              <stop offset="100%" stop-color="#ffb300"/>
            </linearGradient>
          </defs>
        </svg>
        <div class="center">
          <div class="val" id="gaugeVal">0</div>
          <div class="lbl">TrustScore</div>
        </div>
      </div>

      <div class="stat-tiles">
        <div class="tile"><div class="tv">${s.total}</div><div class="tl">Pronostics</div></div>
        <div class="tile win"><div class="tv">${s.nbGagnes}</div><div class="tl">Gagnés</div></div>
        <div class="tile lose"><div class="tv">${s.nbPerdus}</div><div class="tl">Perdus</div></div>
        <div class="tile live"><div class="tv">${s.nbEnCours}</div><div class="tl">En cours</div></div>
      </div>
    </div>

    <div class="wl-bar-wrap">
      <div class="wl-head">
        <span class="w">✅ ${s.tauxReussite}% de réussite</span>
        <span class="l">${s.nbGagnes} V – ${s.nbPerdus} D</span>
      </div>
      <div class="wl-bar"><div class="fill" id="wlFill" data-w="${pctVictoire}" style="width:0"></div></div>
    </div>

    <div class="perf-extra">
      <div class="cell"><div class="v ${roiCls}">${s.roi >= 0 ? "+" : ""}${s.roi}%</div><div class="l">ROI théorique</div></div>
      <div class="cell"><div class="v">${fmtCote(s.coteMoyenneGagnee)}</div><div class="l">Cote moy. gagnée</div></div>
      <div class="cell"><div class="v">${s.nbResolus || 0}</div><div class="l">Pronos résolus</div></div>
    </div>

    <div class="streak-line">
      <span class="flame">${s.streakType === "gagne" && s.streak > 1 ? "🔥" : "📊"}</span>
      <span>${streakTxt}</span>
    </div>

    <div class="cagnotte-line ${s.cagnotte >= CAGNOTTE_DEPART ? "up" : "down"}">
      <div class="cg-left">💰 Cagnotte virtuelle de saison</div>
      <div class="cg-right">
        <span class="cg-val">${fmtFCFA(s.cagnotte)}</span>
        <span class="cg-delta">${s.cagnotte >= CAGNOTTE_DEPART ? "▲" : "▼"} ${fmtFCFA(Math.abs(s.cagnotte - CAGNOTTE_DEPART))}</span>
      </div>
    </div>

    <div class="sparkline">
      <div class="sl-title"><span>Forme (12 derniers)</span><span>Récent →</span></div>
      <div class="sl-dots">${sparkDots}</div>
    </div>

    <div class="by-league">
      <div class="bl-title">🎯 Fiabilité par ligue</div>
      ${ligues}
    </div>
  </section>`;
}

/** Anime la jauge circulaire + barres au chargement du profil. */
function animatePerf(s) {
  const R = 52;
  const CIRC = 2 * Math.PI * R; // ≈ 326.7
  const fg = $("#gaugeFg");
  const valEl = $("#gaugeVal");
  if (fg) {
    const offset = CIRC * (1 - s.trustScore / 100);
    fg.style.strokeDasharray = CIRC.toFixed(1);
    // Forcer un reflow avant d'appliquer l'offset (déclenche la transition CSS).
    fg.getBoundingClientRect();
    fg.style.strokeDashoffset = offset.toFixed(1);
  }
  // Compteur animé du TrustScore (0 → valeur).
  if (valEl) animateNumber(valEl, 0, s.trustScore, 1300);

  // Barres V/D et par ligue.
  requestAnimationFrame(() => {
    const wl = $("#wlFill"); if (wl) wl.style.width = wl.dataset.w + "%";
    $$(".bl-fill").forEach((el) => { el.style.width = el.dataset.w + "%"; });
  });
}

/** Compteur numérique animé. */
function animateNumber(el, from, to, duration) {
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    // easeOutCubic
    const e = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/**
 * MODAL DE TRANSPARENCE DU TRUSTSCORE (innovation).
 * Décompose le score en ses 4 composantes pondérées + bonus de série, avec des
 * barres et l'explication de chaque critère.
 */
function openTrustModal(userId) {
  const s = computeStats(userId);
  if (!s.composantes) return;
  const c = s.composantes;
  const u = API.mockData.users.find((x) => x.id === userId);

  const lignes = [
    { k: "Réussite récente", d: "Taux de victoires, les pronostics récents comptant davantage.", v: c.reussite },
    { k: "Difficulté des cotes", d: "Gagner des cotes élevées rapporte plus de crédibilité.", v: c.difficulte },
    { k: "Régularité", d: "La constance est récompensée, l'irrégularité pénalisée.", v: c.regularite },
    { k: "Volume", d: "Un échantillon mûr fiabilise le score (plafonné ~30 pronos).", v: c.volume },
  ].map((l) => `
    <div class="trust-row">
      <div class="trust-row-head">
        <span class="trust-k">${l.k}</span>
        <span class="trust-w">poids ${Math.round(l.v.poids * 100)}%</span>
      </div>
      <div class="trust-track"><div class="trust-fill" style="width:${Math.round(l.v.valeur * 100)}%"></div></div>
      <div class="trust-d">${l.d} <b>+${Math.round(l.v.contribution * 100)} pts</b></div>
    </div>`).join("");

  const bonusTxt = c.bonusSerie > 1 ? `Bonus de série ×${c.bonusSerie.toFixed(2)} 🔥`
    : c.bonusSerie < 1 ? `Malus de série ×${c.bonusSerie.toFixed(2)}`
    : "Pas de bonus de série";

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <div class="modal-title">🔬 TrustScore de ${esc(u.nom)}</div>
          <div class="modal-sub">Comment ce score de crédibilité est calculé</div>
        </div>
        <button class="modal-x" data-modalclose>✕</button>
      </div>
      <div class="modal-score">
        <div class="modal-score-val">${s.trustScore}</div>
        <div class="modal-score-lbl">/ 100 · ${s.badge.emoji} ${s.badge.nom}</div>
      </div>
      <div class="modal-body">${lignes}
        <div class="trust-bonus">${bonusTxt}</div>
        <p class="trust-formula">TrustScore = 100 × (0,42·Réussite + 0,24·Difficulté + 0,18·Régularité + 0,16·Volume) × BonusSérie</p>
      </div>
    </div>`;
  document.body.appendChild(modal);
  // Animer les barres.
  requestAnimationFrame(() => $$(".trust-fill").forEach((f) => (f.style.width = f.style.width)));
}

/** Charge et affiche la liste des pronostics d'un onglet de profil. */
async function loadProfileTab(userId, filter) {
  const list = $("#profileList");
  if (!list) return;
  list.innerHTML = loaderHTML();
  const preds = await API.getUserPredictions(userId, filter);

  // Onglet « Pronostics » : on met en avant les coupons combinés de l'auteur.
  let couponsHTML = "";
  if (filter === "tous") {
    const coupons = await API.getUserCoupons(userId);
    if (coupons.length) {
      couponsHTML = `<div class="section-title" style="padding-top:8px">🎟️ Coupons combinés</div>
        <div class="feed">${coupons.map((c) => couponCardHTML(c)).join("")}</div>
        <div class="section-title" style="padding-top:8px">🎯 Pronostics simples</div>`;
    }
  }

  if (!preds.length && !couponsHTML) {
    const msg = {
      en_cours: "Aucun pronostic en cours.",
      gagne: "Aucun pronostic gagné pour l'instant.",
      perdu: "Aucun pronostic perdu — impressionnant !",
      analyses: "Aucune analyse détaillée publiée.",
      likes: "Aucun pronostic aimé.",
      tous: "Aucun pronostic publié.",
    }[filter] || "Rien à afficher.";
    list.innerHTML = emptyHTML("🗒️", "C'est vide ici", msg);
    return;
  }
  list.innerHTML = couponsHTML + `<div class="feed">${preds.map((p) => predictionCardHTML(p)).join("")}</div>`;
  observeReveal();
}

/* ---- 5.4 DÉTAIL D'UN PRONOSTIC + commentaires ---- */
async function renderPredictionDetail(id) {
  setTop("Pronostic", "");
  view().innerHTML = loaderHTML();
  const p = await API.getPrediction(id);
  if (!p) { view().innerHTML = emptyHTML("🔍", "Pronostic introuvable", ""); return; }
  const auteur = API.mockData.users.find((u) => u.id === p.auteurId);

  view().innerHTML = `
    <div class="detail-author">
      ${avatarHTML(auteur, "md")}
      <div class="who">
        <div class="line1" style="display:flex;align-items:center;gap:5px">
          <span class="name" data-nav="#/profile/${auteur.id}" style="font-weight:700">${esc(auteur.nom)}</span>
          ${verifHTML(auteur.badge)}
        </div>
        <div class="handle" style="color:var(--text-dim)">@${esc(auteur.pseudo)}</div>
      </div>
      ${p.auteurId !== API.mockData.currentUserId
        ? `<button class="btn btn-follow ${API.getCurrentUserSync().abonnements.includes(auteur.id) ? "on" : ""}" data-follow="${auteur.id}"></button>`
        : ""}
    </div>

    ${predictionCardHTML(p, { clampAnalyse: false })}

    <div style="padding:0 16px">${coachIAHTML(p)}</div>

    <div style="padding:14px 16px 0">${comparatorHTML(p)}</div>

    ${p.sondage ? `<div style="padding:14px 16px 0">${pollHTML(p)}</div>` : ""}

    <div class="section-title">💬 Commentaires (${p.commentaires.length})</div>
    <div class="comment-form">
      ${avatarHTML(API.getCurrentUserSync(), "sm")}
      <textarea id="commentInput" placeholder="Ajoute ton analyse…" rows="1"></textarea>
      <button class="btn btn-primary" id="commentSend">Envoyer</button>
    </div>
    <div id="commentList">${commentsHTML(p.commentaires)}</div>
  `;
  observeReveal();

  // Envoi de commentaire.
  $("#commentSend").addEventListener("click", async () => {
    const input = $("#commentInput");
    const txt = input.value.trim();
    if (!txt) return;
    await API.addComment(id, txt);
    input.value = "";
    const fresh = await API.getPrediction(id);
    $("#commentList").innerHTML = commentsHTML(fresh.commentaires);
    $(".section-title").textContent = `💬 Commentaires (${fresh.commentaires.length})`;
    toast("Commentaire publié 💬", "ok");
  });
}

function commentsHTML(comments) {
  if (!comments.length) return emptyHTML("💭", "Aucun commentaire", "Sois le premier à réagir !");
  return comments
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((c) => {
      const a = API.mockData.users.find((u) => u.id === c.auteurId) || { nom: "?", avatar: "❓", pseudo: "?" };
      return `
      <div class="comment">
        ${avatarHTML(a, "sm")}
        <div class="c-body">
          <div class="c-head">
            <span class="cn" data-nav="#/profile/${a.id}">${esc(a.nom)}</span>
            ${verifHTML(a.badge)}
            <span class="ch">@${esc(a.pseudo)} · ${timeAgo(c.date)}</span>
          </div>
          <div class="c-text">${linkifyHashtags(c.texte)}</div>
        </div>
      </div>`;
    }).join("");
}

/* ---- 5.5 CLASSEMENT (leaderboard) ---- */
async function renderLeaderboard(period = "week") {
  setTop("Classement", "Top pronostiqueurs par TrustScore");
  view().innerHTML = loaderHTML();
  const { users } = await API.getLeaderboard(period);

  // Calcul du TrustScore côté client puis tri décroissant.
  const ranked = users
    .map((u) => ({ u, s: computeStats(u.id) }))
    .sort((a, b) => b.s.trustScore - a.s.trustScore);

  view().innerHTML = `
    <div class="seg" id="lbSeg">
      <button class="${period === "week" ? "active" : ""}" data-period="week">🗓️ Cette semaine</button>
      <button class="${period === "month" ? "active" : ""}" data-period="month">📆 Ce mois</button>
    </div>
    ${ranked.map(({ u, s }, i) => {
      const rank = i + 1;
      const rankCls = rank <= 3 ? `top${rank}` : "";
      const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
      const spark = s.forme.slice(-6).map((f) => `<i class="${f}"></i>`).join("");
      return `
      <div class="lb-row" data-nav="#/profile/${u.id}">
        <div class="lb-rank ${rankCls}">${medal}</div>
        ${avatarHTML(u, "md")}
        <div class="lb-info">
          <div class="n">${esc(u.nom)} ${verifHTML(u.badge)}
            <span class="rep-badge rep-${s.badge.nom}" style="font-size:.62rem;padding:1px 6px">${s.badge.emoji}</span>
          </div>
          <div class="h">@${esc(u.pseudo)} · ${s.tauxReussite}% réussite · ${s.total} pronos</div>
          <div class="lb-spark">${spark}</div>
        </div>
        <div class="lb-score">
          <div class="s">${s.trustScore}</div>
          <div class="ss">TrustScore</div>
        </div>
      </div>`;
    }).join("")}
  `;
}

/* ---- 5.6 CRÉATION D'UN PRONOSTIC ---- */
function renderCreate() {
  setTop("Nouveau pronostic", "Choisis le match, compare les cotes 📊");
  view().innerHTML = `
    <form class="form" id="createForm">
      <div class="field">
        <label>1️⃣ Championnat / compétition</label>
        <select id="fLigue">${champOptionsHTML()}</select>
      </div>

      <div id="teamFields"><!-- équipes selon le championnat --></div>

      <div class="field">
        <label>📅 Date & heure du match</label>
        <input id="fDate" type="datetime-local" required />
      </div>

      <div class="field">
        <label>2️⃣ Type de pari</label>
        <select id="fType"></select>
      </div>

      <div id="oddsBox" class="odds-box"><!-- issues + comparateur de cotes --></div>

      <div class="field">
        <label>Mise de confiance</label>
        <div class="confiance-picker" id="fConfiance">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}">★</button>`).join("")}
        </div>
      </div>

      <div class="field">
        <label>Analyse / argumentaire</label>
        <textarea id="fAnalyse" placeholder="Explique ton raisonnement : forme, absences, historique… #Ligue1"></textarea>
      </div>

      <div class="premium-switch">
        <div>
          <div style="font-weight:700">🔒 Marquer comme « Coup sûr »</div>
          <div class="switch-desc">Mode confiance — ton pronostic premium mis en avant.</div>
        </div>
        <div class="toggle-sw" id="fPremium"></div>
      </div>

      <button type="submit" class="nav-cta" style="margin:6px 0 0">Publier le pronostic 🎯</button>
      <p class="form-preview-note">Cotes indicatives et simulées — comparées entre plusieurs plateformes.</p>
    </form>`;

  // --- État du formulaire ---
  let confiance = 3, premium = false;
  let teamA = null, teamB = null;      // { n, l }
  let currentOdds = [];                // issues + cotes par bookmaker
  let selIdx = -1;                     // issue sélectionnée
  let selectedCote = null, selectedBk = null, selectedChoix = null;

  const TYPES_FOOT = ["1N2", "Over/Under", "BTTS", "Double chance", "Vainqueur"];

  // Étoiles de confiance.
  const paintStars = () => $$("#fConfiance button").forEach((b) => b.classList.toggle("on", +b.dataset.star <= confiance));
  $("#fConfiance").addEventListener("click", (e) => { const b = e.target.closest("[data-star]"); if (b) { confiance = +b.dataset.star; paintStars(); } });
  paintStars();

  // Toggle premium.
  $("#fPremium").addEventListener("click", () => { premium = !premium; $("#fPremium").classList.toggle("on", premium); });

  // Options de type de pari selon le sport.
  function refreshTypeOptions() {
    const sport = champSport($("#fLigue").value);
    const types = sport === "Football" ? TYPES_FOOT : ["Vainqueur"];
    $("#fType").innerHTML = types.map((t) => `<option>${t}</option>`).join("");
  }

  // Champs équipes : liste déroulante si un effectif existe, sinon saisie libre.
  function refreshTeamFields() {
    const nom = $("#fLigue").value;
    const roster = API.mockData.equipes[nom] || [];
    const box = $("#teamFields");
    if (roster.length) {
      const opts = () => `<option value="" disabled selected>Choisir…</option>` +
        roster.map((e) => `<option value="${esc(e.n)}" data-logo="${e.l}">${e.l} ${esc(e.n)}</option>`).join("");
      box.innerHTML = `<div class="field row2">
        <div class="field"><label>Équipe / Joueur A</label><select id="fEquipeA" required>${opts()}</select></div>
        <div class="field"><label>Équipe / Joueur B</label><select id="fEquipeB" required>${opts()}</select></div>
      </div>`;
    } else {
      box.innerHTML = `<div class="field row2">
        <div class="field"><label>Équipe / Joueur A</label><input id="fEquipeA" placeholder="Ex. Équipe A" required /></div>
        <div class="field"><label>Équipe / Joueur B</label><input id="fEquipeB" placeholder="Ex. Équipe B" required /></div>
      </div>`;
    }
    ["#fEquipeA", "#fEquipeB"].forEach((id) => {
      const el = $(id);
      el.addEventListener("change", refreshOdds);
      if (el.tagName === "INPUT") el.addEventListener("input", refreshOdds);
    });
    refreshOdds();
  }

  function readTeam(id) {
    const el = $(id); if (!el) return null;
    if (el.tagName === "SELECT") {
      const opt = el.selectedOptions[0];
      return opt && opt.value ? { n: opt.value, l: opt.dataset.logo || "⚽" } : null;
    }
    const v = el.value.trim();
    return v ? { n: v, l: "⚽" } : null;
  }

  // Recharge le comparateur de cotes en fonction des équipes + type.
  async function refreshOdds() {
    teamA = readTeam("#fEquipeA"); teamB = readTeam("#fEquipeB");
    selIdx = -1; selectedCote = null; selectedBk = null; selectedChoix = null;
    const box = $("#oddsBox");
    if (!teamA || !teamB) { box.innerHTML = `<div class="odds-hint">📊 Choisis les deux équipes pour comparer les cotes des bookmakers.</div>`; return; }
    if (teamA.n === teamB.n) { box.innerHTML = `<div class="odds-hint err">Choisis deux équipes différentes.</div>`; return; }
    box.innerHTML = `<div class="odds-hint">Chargement des cotes…</div>`;
    currentOdds = await API.getMatchOdds(teamA.n, teamB.n, $("#fType").value);
    renderOddsBox();
  }

  function renderOddsBox() {
    const box = $("#oddsBox");
    const outcomes = currentOdds.map((o, i) =>
      `<button type="button" class="outcome-pill ${i === selIdx ? "on" : ""}" data-outcome="${i}">${esc(o.label)}</button>`).join("");

    let comp = "";
    if (selIdx >= 0) {
      const o = currentOdds[selIdx];
      const rows = o.cotes.slice().sort((a, b) => b.cote - a.cote).map((c) => `
        <button type="button" class="comp-row ${c.cote === o.best ? "best" : ""} ${selectedBk && selectedBk.id === c.bookmaker.id ? "chosen" : ""}" data-bk="${c.bookmaker.id}" data-cote="${c.cote}">
          <span class="comp-bk"><i style="background:${c.bookmaker.c}"></i>${esc(c.bookmaker.nom)}</span>
          <span class="comp-cote">${c.cote.toFixed(2)}</span>
          ${c.cote === o.best ? `<span class="comp-best">⭐ Meilleure</span>` : `<span class="comp-pick">Choisir</span>`}
        </button>`).join("");
      comp = `<div class="comparator">
        <div class="comp-title">💰 Cotes comparées — <b>${esc(o.label)}</b></div>
        ${rows}
        <div class="comp-note">Sélectionne la plateforme dont tu prends la cote.</div>
      </div>`;
    }

    box.innerHTML = `
      <div class="field"><label>3️⃣ Ton pronostic (issue)</label><div class="outcomes">${outcomes}</div></div>
      ${comp}
      ${selectedCote ? `<div class="odds-selected">✅ Cote retenue : <b>${selectedCote.toFixed(2)}</b> · ${esc(selectedBk.nom)}<br><span>« ${esc(selectedChoix)} »</span></div>` : ""}`;
  }

  // Clics dans le comparateur (délégation locale).
  $("#oddsBox").addEventListener("click", (e) => {
    const op = e.target.closest("[data-outcome]");
    if (op) { selIdx = +op.dataset.outcome; selectedBk = null; selectedCote = null; selectedChoix = null; renderOddsBox(); return; }
    const cr = e.target.closest("[data-bk]");
    if (cr && selIdx >= 0) {
      selectedBk = API.mockData.bookmakers.find((b) => b.id === cr.dataset.bk);
      selectedCote = parseFloat(cr.dataset.cote);
      selectedChoix = currentOdds[selIdx].label;
      renderOddsBox();
    }
  });

  $("#fType").addEventListener("change", refreshOdds);
  $("#fLigue").addEventListener("change", () => { refreshTypeOptions(); refreshTeamFields(); });

  // Initialisation.
  refreshTypeOptions();
  refreshTeamFields();

  // Soumission.
  $("#createForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!teamA || !teamB) { toast("Choisis les deux équipes.", "err"); return; }
    if (teamA.n === teamB.n) { toast("Choisis deux équipes différentes.", "err"); return; }
    if (!selectedCote || !selectedChoix) { toast("Sélectionne une issue et une cote.", "err"); return; }

    const ligue = $("#fLigue").value;
    const dateVal = $("#fDate").value;
    const analyse = $("#fAnalyse").value.trim() || "Pas d'analyse détaillée.";
    const o = currentOdds[selIdx];

    await API.createPrediction({
      match: {
        equipeA: teamA.n, equipeB: teamB.n, ligue,
        logoA: teamA.l, logoB: teamB.l,
        hashtag: (CHAMP_INDEX[ligue] || {}).hashtag || ligue.replace(/\s+/g, ""),
        date: dateVal ? new Date(dateVal).toISOString() : new Date().toISOString(),
      },
      typePari: $("#fType").value,
      choix: selectedChoix, cote: selectedCote, confiance, premium, analyse,
      bookmaker: selectedBk.nom,
      cotesComparees: o.cotes.map((c) => ({ nom: c.bookmaker.nom, cote: c.cote })),
    });

    toast("Pronostic publié ! 🎯 Il apparaît dans ton fil.", "ok");
    location.hash = "#/feed";
  });

  // Pré-remplir la date avec « maintenant + 3 h ».
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  d.setMinutes(0);
  $("#fDate").value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/* ---- 5.7 NOTIFICATIONS ---- */
async function renderNotifications() {
  setTop("Notifications", "");
  view().innerHTML = loaderHTML();
  let notifs = await API.getNotifications();
  // Respecte les préférences de notifications (Paramètres).
  notifs = notifs.filter((n) => state.notifPrefs[n.type] !== false);
  const ico = { like: "❤️", follow: "➕", comment: "💬", gagne: "🟢", repost: "🔁", badge: "🏅" };
  if (!notifs.length) {
    view().innerHTML = emptyHTML("🔕", "Aucune notification", "Ajuste tes préférences dans les Paramètres.");
    API.mockData.notifications.forEach((n) => (n.lu = true));
    updateNotifBadge();
    return;
  }
  view().innerHTML = notifs.map((n) => {
    const acteur = n.acteurId ? API.mockData.users.find((u) => u.id === n.acteurId) : null;
    const nav = n.cibleId && n.cibleId.startsWith("p_") ? `data-nav="#/prediction/${n.cibleId}"` :
      acteur ? `data-nav="#/profile/${acteur.id}"` : "";
    const texte = acteur ? `<b>${esc(acteur.nom)}</b> ${esc(n.texte)}` : esc(n.texte);
    return `
      <div class="notif ${n.lu ? "" : "unread"}" ${nav}>
        <div class="n-ico">${ico[n.type] || "🔔"}</div>
        <div class="n-body">
          <div class="n-text">${texte}</div>
          <div class="n-time">${timeAgo(n.date)}</div>
        </div>
      </div>`;
  }).join("");

  // Marquer comme lues (met à jour le badge de nav).
  API.mockData.notifications.forEach((n) => (n.lu = true));
  updateNotifBadge();
}

/* ---- 5.7b MESSAGERIE : liste des conversations ---- */
async function renderMessages() {
  setTop("Messages", "Tes conversations");
  view().innerHTML = loaderHTML();
  const convs = await API.getConversations();
  if (!convs.length) {
    view().innerHTML = emptyHTML("💬", "Aucun message", "Va sur un profil et clique sur « Message » pour démarrer une conversation.");
    return;
  }
  view().innerHTML = convs.map((c) => `
    <div class="conv-row ${c.nonLus ? "unread" : ""}" data-nav="#/messages/${c.user.id}">
      ${avatarHTML(c.user, "md")}
      <div class="conv-main">
        <div class="conv-top">
          <span class="conv-name">${esc(c.user.nom)} ${verifHTML(c.user.badge)}</span>
          <span class="conv-time">${timeAgo(c.lastDate)}</span>
        </div>
        <div class="conv-last">${esc(c.dernier)}</div>
      </div>
      ${c.nonLus ? `<span class="conv-badge">${c.nonLus}</span>` : ""}
    </div>`).join("");
  updateMsgBadge();
}

/* ---- 5.7c MESSAGERIE : fil de discussion ---- */
async function renderThread(autreId) {
  const autre = await API.getUser(autreId);
  if (!autre) { view().innerHTML = emptyHTML("🤷🏾", "Utilisateur introuvable", ""); return; }
  setTop(autre.nom, `@${autre.pseudo}`);
  view().innerHTML = loaderHTML();
  const msgs = await API.getThread(autreId);
  const me = API.mockData.currentUserId;

  view().innerHTML = `
    <div class="thread-head" data-nav="#/profile/${autre.id}">
      ${avatarHTML(autre, "sm")}
      <div><div class="th-name">${esc(autre.nom)} ${verifHTML(autre.badge)}</div>
        <div class="th-handle">@${esc(autre.pseudo)}</div></div>
    </div>
    <div class="thread-body" id="threadBody">${threadBubblesHTML(msgs, me)}</div>
    <div class="thread-input">
      <input id="msgInput" placeholder="Écris un message…" autocomplete="off" />
      <button class="btn btn-primary" id="msgSend">Envoyer</button>
    </div>`;

  const body = $("#threadBody");
  body.scrollTop = body.scrollHeight;
  updateMsgBadge();

  const envoyer = async () => {
    const input = $("#msgInput");
    const txt = input.value.trim();
    if (!txt) return;
    await API.sendMessage(autreId, txt);
    input.value = "";
    const fresh = await API.getThread(autreId);
    body.innerHTML = threadBubblesHTML(fresh, me);
    body.scrollTop = body.scrollHeight;
  };
  $("#msgSend").addEventListener("click", envoyer);
  $("#msgInput").addEventListener("keydown", (e) => { if (e.key === "Enter") envoyer(); });
  $("#msgInput").focus();
}

function threadBubblesHTML(msgs, me) {
  if (!msgs.length) return `<div class="empty" style="padding:30px"><span>Envoie le premier message 👋</span></div>`;
  return msgs.map((m) => {
    const contenu = m.predId
      ? sharedPredCardHTML(m.predId) + `<span class="bubble-time">${timeAgo(m.date)}</span>`
      : `${linkifyHashtags(m.texte)}<span class="bubble-time">${timeAgo(m.date)}</span>`;
    return `
    <div class="bubble-row ${m.deId === me ? "mine" : "theirs"}">
      <div class="bubble-wrap">
        <div class="bubble ${m.predId ? "has-pred" : ""}">${contenu}</div>
        ${reactionsHTML(m.reactions, "msg", m.id)}
      </div>
    </div>`;
  }).join("");
}

/** Mini-carte d'un pronostic partagé dans une conversation. */
function sharedPredCardHTML(predId) {
  const p = API.mockData.predictions.find((x) => x.id === predId);
  if (!p) return `<i style="opacity:.7">Pronostic indisponible</i>`;
  const auteur = API.mockData.users.find((u) => u.id === p.auteurId);
  return `
    <div class="shared-pred" data-nav="#/prediction/${p.id}">
      <div class="sp-top">${ligueEmoji(p.match.ligue)} ${esc(p.match.ligue)} · ${LIBELLE_STATUT[p.statut]}</div>
      <div class="sp-teams">${p.match.logoA} ${esc(p.match.equipeA)} <span>vs</span> ${esc(p.match.equipeB)} ${p.match.logoB}</div>
      <div class="sp-bet">${esc(p.choix)} · <b>${fmtCote(p.cote)}</b> ${starsHTML(p.confiance)}</div>
      <div class="sp-auth">🎯 par @${esc(auteur.pseudo)}</div>
    </div>`;
}

/** Modal de partage d'un pronostic vers une conversation. */
async function openShareModal(predId) {
  const me = API.getCurrentUserSync();
  const convs = await API.getConversations();
  const convUsers = convs.map((c) => c.user);
  // Complète avec les comptes suivis (hors conversations existantes).
  const suivis = API.mockData.users.filter(
    (u) => me.abonnements.includes(u.id) && !convUsers.some((c) => c.id === u.id)
  );
  const dest = [...convUsers, ...suivis];

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div><div class="modal-title">📤 Partager le pronostic</div>
          <div class="modal-sub">Envoie-le dans une conversation</div></div>
        <button class="modal-x" data-modalclose>✕</button>
      </div>
      <div class="modal-body">
        ${dest.length ? dest.map((u) => `
          <button class="share-dest" data-shareto="${u.id}" data-sharepred="${predId}">
            ${avatarHTML(u, "sm")}
            <div class="sd-info"><b>${esc(u.nom)}</b> ${verifHTML(u.badge)}<div class="sd-h">@${esc(u.pseudo)}</div></div>
            <span class="sd-send">Envoyer</span>
          </button>`).join("") : `<p class="set-desc">Suis des pronostiqueurs ou démarre une conversation pour pouvoir partager.</p>`}
        <button class="acc-item" data-copylink style="margin-top:6px">🔗 Copier le lien</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector("[data-copylink]")?.addEventListener("click", () => {
    modal.remove(); toast("Lien copié ! 🔗", "ok");
  });
}

/* ---- 5.9 PARAMÈTRES ---- */
function renderSettings() {
  setTop("Paramètres", "Personnalise ton expérience");
  const me = API.getCurrentUserSync();
  const prefs = state.notifPrefs;
  const prefLabels = { like: "❤️ J'aime", follow: "➕ Nouveaux abonnés", comment: "💬 Commentaires", gagne: "🟢 Pronostics résolus", repost: "🔁 Reposts", badge: "🏅 Badges" };

  view().innerHTML = `
    <div class="settings">
      <div class="set-group">
        <div class="set-title">🎨 Apparence</div>
        <div class="set-row">
          <div><b>Thème</b><div class="set-desc">Clair ou sombre</div></div>
          <button class="btn" id="setTheme">${state.theme === "dark" ? "🌙 Sombre" : "☀️ Clair"}</button>
        </div>
        <div class="set-row">
          <div><b>Couleur d'accent</b><div class="set-desc">La couleur des boutons et surbrillances</div></div>
          <div class="accent-picker" id="accentPicker">
            ${Object.entries(ACCENTS).map(([k, a]) => `<button class="acc-dot ${state.accent === k ? "on" : ""}" data-accent="${k}" title="${a.label}" style="background:${a.grad}"></button>`).join("")}
          </div>
        </div>
      </div>

      <div class="set-group">
        <div class="set-title">🔔 Notifications</div>
        ${Object.keys(prefLabels).map((k) => `
          <div class="set-row">
            <div>${prefLabels[k]}</div>
            <div class="toggle-sw ${prefs[k] ? "on" : ""}" data-pref="${k}"></div>
          </div>`).join("")}
      </div>

      <div class="set-group">
        <div class="set-title">🔐 Compte</div>
        <div class="set-row"><div><b>Pseudo</b></div><span class="set-desc">@${esc(me.pseudo)}</span></div>
        <div class="set-row"><div><b>Email</b></div><span class="set-desc">${esc(me.email)}</span></div>
        <form class="set-pw" id="pwForm">
          <div class="set-title" style="font-size:.85rem">Changer le mot de passe</div>
          <input id="pwOld" type="password" placeholder="Mot de passe actuel" />
          <input id="pwNew" type="password" placeholder="Nouveau mot de passe (6 car. min.)" />
          <div class="auth-error" id="pwError"></div>
          <button type="submit" class="btn btn-primary">Mettre à jour</button>
        </form>
      </div>

      <div class="set-group">
        <div class="set-title">ℹ️ À propos</div>
        <p class="set-desc" style="padding:4px 0">PronoStars — réseau social de partage d'analyses sportives (démo).
          Aucun pari, aucun argent de jeu. Fait avec ❤️ pour la communauté ivoirienne 🇨🇮.</p>
        <button class="btn" id="setLogout" style="color:var(--rouge)">🚪 Se déconnecter</button>
      </div>
    </div>`;

  // Thème.
  $("#setTheme").addEventListener("click", () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
    $("#setTheme").textContent = state.theme === "dark" ? "🌙 Sombre" : "☀️ Clair";
  });
  // Accent.
  $("#accentPicker").addEventListener("click", (e) => {
    const b = e.target.closest("[data-accent]"); if (!b) return;
    applyAccent(b.dataset.accent);
    $$("#accentPicker .acc-dot").forEach((d) => d.classList.toggle("on", d === b));
  });
  // Préférences de notifications.
  $$("[data-pref]").forEach((t) => t.addEventListener("click", () => {
    const k = t.dataset.pref;
    state.notifPrefs[k] = !state.notifPrefs[k];
    t.classList.toggle("on", state.notifPrefs[k]);
    updateNotifBadge();
  }));
  // Changement de mot de passe.
  $("#pwForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const r = await API.changePassword($("#pwOld").value, $("#pwNew").value);
    if (!r.ok) { $("#pwError").textContent = r.error; return; }
    $("#pwOld").value = ""; $("#pwNew").value = ""; $("#pwError").textContent = "";
    toast("Mot de passe mis à jour ✅", "ok");
  });
  // Déconnexion.
  $("#setLogout").addEventListener("click", () => { API.logout(); toast("Déconnecté 👋", ""); showAuthGate(); });
}

/** Applique une couleur d'accent (variables CSS globales). */
function applyAccent(key) {
  state.accent = key;
  const a = ACCENTS[key] || ACCENTS.orange;
  document.documentElement.style.setProperty("--accent", a.c);
  document.documentElement.style.setProperty("--accent-grad", a.grad);
}

/* ---- 5.10 STATISTIQUES DE LA PLATEFORME (tableau de bord) ---- */
function renderStats() {
  setTop("Statistiques", "Le pouls de la communauté PronoStars");
  const preds = API.mockData.predictions;
  const users = API.mockData.users;
  const champs = API.mockData.championnats;

  const resolus = preds.filter((p) => p.statut === "gagne" || p.statut === "perdu");
  const gagnes = preds.filter((p) => p.statut === "gagne").length;
  const perdus = preds.filter((p) => p.statut === "perdu").length;
  const enCours = preds.filter((p) => p.statut === "en_cours").length;
  const tauxComm = resolus.length ? Math.round((gagnes / resolus.length) * 100) : 0;

  // Agrégations.
  const parSport = agrege(preds, (p) => champSport(p.match.ligue));
  const parRegion = agrege(preds, (p) => (CHAMP_INDEX[p.match.ligue] || {}).region || "Autre");
  const parLigue = agrege(preds, (p) => p.match.ligue);
  const topLigues = Object.entries(parLigue).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const totalLikes = preds.reduce((s, p) => s + p.likes.length, 0);
  const totalComs = preds.reduce((s, p) => s + p.commentaires.length, 0);
  const coteMoy = preds.reduce((s, p) => s + p.cote, 0) / preds.length;

  // Barre de répartition des statuts (segments étiquetés = encodage secondaire).
  const totStatut = gagnes + perdus + enCours || 1;
  const statutBar = `
    <div class="stat-splitbar">
      <div class="ssb-seg g" style="width:${(gagnes / totStatut) * 100}%" title="Gagnés : ${gagnes}"></div>
      <div class="ssb-seg p" style="width:${(perdus / totStatut) * 100}%" title="Perdus : ${perdus}"></div>
      <div class="ssb-seg e" style="width:${(enCours / totStatut) * 100}%" title="En cours : ${enCours}"></div>
    </div>
    <div class="ssb-legend">
      <span><i class="dot g"></i> Gagnés <b>${gagnes}</b></span>
      <span><i class="dot p"></i> Perdus <b>${perdus}</b></span>
      <span><i class="dot e"></i> En cours <b>${enCours}</b></span>
    </div>`;

  view().innerHTML = `
    <div class="stats-page">
      <div class="stat-hero">
        ${statTile("🎯", preds.length, "Pronostics publiés")}
        ${statTile("✅", tauxComm + "%", "Réussite communautaire")}
        ${statTile("👥", users.length, "Pronostiqueurs")}
        ${statTile("🌍", champs.length, "Compétitions")}
      </div>

      <div class="stat-card">
        <div class="stat-card-t">📊 Répartition des pronostics</div>
        ${statutBar}
      </div>

      <div class="stat-card">
        <div class="stat-card-t">🏅 Pronostics par sport</div>
        ${barsHTML(Object.entries(parSport).sort((a, b) => b[1] - a[1]).map(([k, v]) => [`${sportEmoji(k)} ${k}`, v]))}
      </div>

      <div class="stat-card">
        <div class="stat-card-t">🏆 Top championnats</div>
        ${barsHTML(topLigues.map(([k, v]) => [`${ligueEmoji(k)} ${k}`, v]))}
      </div>

      <div class="stat-card">
        <div class="stat-card-t">🗺️ Pronostics par région</div>
        ${barsHTML(Object.entries(parRegion).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]))}
      </div>

      <div class="stat-card">
        <div class="stat-card-t">💬 Engagement de la communauté</div>
        <div class="stat-hero" style="margin:0">
          ${statTile("❤️", totalLikes.toLocaleString("fr-FR"), "J'aime")}
          ${statTile("💬", totalComs, "Commentaires")}
          ${statTile("🎟️", API.mockData.coupons.length, "Coupons")}
          ${statTile("📈", fmtCote(coteMoy), "Cote moyenne")}
        </div>
      </div>

      <p class="set-desc" style="text-align:center;padding:8px 16px 20px">
        Données agrégées sur l'ensemble des pronostics de la plateforme (démo).
      </p>
    </div>`;

  // Animer les barres.
  requestAnimationFrame(() => $$(".bar-fill, .ssb-seg").forEach((el) => {
    const w = el.dataset.w; if (w != null) el.style.width = w + "%";
  }));
}

function agrege(arr, keyFn) {
  const m = {};
  arr.forEach((x) => { const k = keyFn(x); m[k] = (m[k] || 0) + 1; });
  return m;
}

function statTile(ico, val, label) {
  return `<div class="stat-tile"><div class="st-ico">${ico}</div><div class="st-val">${val}</div><div class="st-lbl">${esc(label)}</div></div>`;
}

/** Barres horizontales à hue unique (magnitude), étiquetées. */
function barsHTML(pairs) {
  const max = Math.max(1, ...pairs.map((p) => p[1]));
  return `<div class="bars">${pairs.map(([label, v]) => `
    <div class="bar-row" title="${esc(label)} : ${v}">
      <span class="bar-label">${esc(label)}</span>
      <span class="bar-track"><span class="bar-fill" data-w="${(v / max) * 100}" style="width:0"></span></span>
      <span class="bar-val">${v}</span>
    </div>`).join("")}</div>`;
}

/* ---- 5.11 BATTLES : liste + création ---- */
async function renderBattles() {
  setTop("Battles", "Défie les autres pronostiqueurs ⚔️");
  view().innerHTML = loaderHTML();
  const me = API.mockData.currentUserId;
  const battles = await API.getUserBattles(me);
  const autres = await API.getBattles();
  const communaute = autres.filter((b) => b.aId !== me && b.bId !== me);

  view().innerHTML = `
    <div class="section-title">⚔️ Mes défis</div>
    ${battles.length ? battles.map((b) => battleRowHTML(b, me)).join("") : emptyHTML("🤝", "Aucun défi", "Va sur un profil et clique sur « Défier » pour lancer un battle.")}
    ${communaute.length ? `<div class="section-title">🌍 Défis de la communauté</div>${communaute.map((b) => battleRowHTML(b, me)).join("")}` : ""}
  `;
}

function battleRowHTML(b, me) {
  const a = API.mockData.users.find((u) => u.id === b.aId);
  const bb = API.mockData.users.find((u) => u.id === b.bId);
  if (!a || !bb) return "";
  const statutLabel = b.statut === "propose" ? "🟡 En attente" : b.statut === "termine" ? "⚪ Terminé" : "🟢 En cours";
  const gagnant = b.statut === "termine" ? (b.scoreA > b.scoreB ? a : b.scoreB > b.scoreA ? bb : null) : null;
  return `
    <div class="battle-row" data-nav="#/battle/${b.id}">
      <div class="br-players">
        <span class="br-side ${gagnant === a ? "win" : ""}">${a.avatar} ${esc(a.pseudo)}</span>
        <span class="br-score">${b.scoreA} – ${b.scoreB}</span>
        <span class="br-side ${gagnant === bb ? "win" : ""}">${esc(bb.pseudo)} ${bb.avatar}</span>
      </div>
      <div class="br-foot">
        <span class="br-journee">${esc(b.journee)}</span>
        <span class="br-statut">${statutLabel}</span>
      </div>
    </div>`;
}

/* ---- 5.12 BATTLE : détail ---- */
async function renderBattleDetail(id) {
  setTop("Battle", "");
  view().innerHTML = loaderHTML();
  const b = await API.getBattle(id);
  if (!b) { view().innerHTML = emptyHTML("⚔️", "Défi introuvable", ""); return; }
  const a = API.mockData.users.find((u) => u.id === b.aId);
  const bb = API.mockData.users.find((u) => u.id === b.bId);
  const me = API.mockData.currentUserId;
  const suisImplique = b.aId === me || b.bId === me;
  const proposeAMoi = b.statut === "propose" && b.bId === me;
  const peutAvancer = b.statut === "en_cours" && suisImplique;
  const gagnant = b.statut === "termine" ? (b.scoreA > b.scoreB ? a : b.scoreB > b.scoreA ? bb : null) : null;

  view().innerHTML = `
    <div class="battle-detail">
      <div class="bd-vs">
        <div class="bd-player ${gagnant === a ? "win" : ""}" data-nav="#/profile/${a.id}">
          ${avatarHTML(a, "lg")}
          <div class="bd-name">${esc(a.nom)} ${verifHTML(a.badge)}</div>
          <div class="bd-score">${b.scoreA}</div>
        </div>
        <div class="bd-mid">
          <div class="bd-vs-lbl">VS</div>
          <div class="bd-journee">${esc(b.journee)}</div>
        </div>
        <div class="bd-player ${gagnant === bb ? "win" : ""}" data-nav="#/profile/${bb.id}">
          ${avatarHTML(bb, "lg")}
          <div class="bd-name">${esc(bb.nom)} ${verifHTML(bb.badge)}</div>
          <div class="bd-score">${b.scoreB}</div>
        </div>
      </div>

      ${gagnant ? `<div class="bd-winner">🏆 Vainqueur : ${esc(gagnant.nom)} !</div>`
        : b.statut === "termine" ? `<div class="bd-winner draw">🤝 Match nul !</div>` : ""}

      <div class="bd-actions">
        ${proposeAMoi ? `
          <button class="btn btn-primary" data-battleaccept="${b.id}">✅ Accepter le défi</button>
          <button class="btn" data-battledecline="${b.id}">✖️ Refuser</button>` : ""}
        ${peutAvancer ? `
          <button class="btn" data-battleadvance="${b.id}">⚡ Simuler une journée</button>
          <button class="btn btn-primary" data-battlefinish="${b.id}">🏁 Terminer le défi</button>` : ""}
        ${b.statut === "propose" && b.proposePar === me ? `<div class="set-desc">En attente de la réponse de ${esc(bb.nom)}…</div>` : ""}
      </div>
    </div>`;
}

/* ---- 5.8 RECHERCHE ---- */
async function renderSearch(query = "") {
  setTop("Recherche", "Pronostiqueurs, matchs, #hashtags");
  view().innerHTML = `
    <div style="padding:14px 16px">
      <div class="search-box" style="background:var(--bg-elev)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
        <input id="searchInput" placeholder="Rechercher…" value="${esc(query)}" />
      </div>
    </div>
    <div id="searchResults"></div>`;

  const input = $("#searchInput");
  input.focus();
  const run = () => doSearch(input.value.trim());
  input.addEventListener("input", run);
  run();
}

async function doSearch(q) {
  const box = $("#searchResults");
  if (!box) return;
  const users = await API.getAllUsers();
  const preds = await API.getAllPredictions();
  const trends = await API.getTrends();

  if (!q) {
    box.innerHTML = `
      <div class="section-title"># Tendances</div>
      ${trends.map((t) => `
        <div class="widget-item" data-nav="#/hashtag/${t.tag}">
          <div class="t2">#${esc(t.tag)}</div>
          <div class="t3">${t.posts.toLocaleString("fr-FR")} publications · ${esc(t.contexte)}</div>
        </div>`).join("")}
      <div class="section-title">👥 Pronostiqueurs à découvrir</div>
      ${users.filter((u) => u.id !== API.mockData.currentUserId).map(userRowHTML).join("")}`;
    return;
  }

  const ql = q.toLowerCase().replace(/^#/, "");
  const uMatch = users.filter((u) =>
    u.nom.toLowerCase().includes(ql) || u.pseudo.toLowerCase().includes(ql));
  const pMatch = preds.filter((p) =>
    p.match.equipeA.toLowerCase().includes(ql) ||
    p.match.equipeB.toLowerCase().includes(ql) ||
    p.match.ligue.toLowerCase().includes(ql) ||
    (p.match.hashtag || "").toLowerCase().includes(ql) ||
    p.analyse.toLowerCase().includes(ql));

  box.innerHTML = `
    ${uMatch.length ? `<div class="section-title">👥 Pronostiqueurs</div>${uMatch.map(userRowHTML).join("")}` : ""}
    ${pMatch.length ? `<div class="section-title">🎯 Pronostics & matchs</div><div class="feed">${pMatch.map((p) => predictionCardHTML(p)).join("")}</div>` : ""}
    ${(!uMatch.length && !pMatch.length) ? emptyHTML("🔍", "Aucun résultat", `Rien trouvé pour « ${esc(q)} ».`) : ""}
  `;
}

/** Vue hashtag. */
async function renderHashtag(tag) {
  setTop(`#${tag}`, "Pronostics associés");
  view().innerHTML = loaderHTML();
  const preds = await API.getAllPredictions();
  const matched = preds.filter((p) =>
    (p.match.hashtag || "").toLowerCase() === tag.toLowerCase() ||
    p.analyse.toLowerCase().includes("#" + tag.toLowerCase()));
  view().innerHTML = matched.length
    ? `<div class="feed">${matched.map((p) => predictionCardHTML(p)).join("")}</div>`
    : emptyHTML("🏷️", `Aucun pronostic #${esc(tag)}`, "Reviens plus tard !");
  observeReveal();
}

/** Ligne utilisateur réutilisable (avec bouton suivre). */
function userRowHTML(u) {
  const suit = API.getCurrentUserSync().abonnements.includes(u.id);
  const s = computeStats(u.id);
  return `
    <div class="lb-row">
      ${avatarHTML(u, "md")}
      <div class="lb-info" data-nav="#/profile/${u.id}">
        <div class="n">${esc(u.nom)} ${verifHTML(u.badge)}</div>
        <div class="h">@${esc(u.pseudo)} · TrustScore ${s.trustScore} · ${s.tauxReussite}%</div>
      </div>
      <button class="btn btn-follow ${suit ? "on" : ""}" data-follow="${u.id}" style="padding:7px 14px"></button>
    </div>`;
}

/** Bloc « état vide » générique. */
function emptyHTML(ico, titre, sous) {
  return `<div class="empty"><div class="em-ico">${ico}</div><b>${esc(titre)}</b><span>${esc(sous)}</span></div>`;
}

/* -----------------------------------------------------------------------------
 *  6. Actions interactives (délégation d'événements globale)
 * --------------------------------------------------------------------------- */

document.addEventListener("click", async (e) => {
  // -- Menu « Mon compte » (bloc en bas de la nav de gauche) --
  if (e.target.closest("#navMe")) { openAccountMenu(); return; }

  // -- Éditer le profil (bouton sur son propre profil) --
  if (e.target.closest("[data-editprofile]")) { openEditProfile(); return; }

  // -- Navigation par data-nav (éléments non-<a>) --
  const nav = e.target.closest("[data-nav]");
  if (nav && !e.target.closest("a")) {
    location.hash = nav.dataset.nav;
    return;
  }

  // -- Like --
  const likeBtn = e.target.closest("[data-like]");
  if (likeBtn) {
    e.stopPropagation();
    const p = await API.likePrediction(likeBtn.dataset.like);
    const on = p.likes.includes(API.mockData.currentUserId);
    likeBtn.classList.toggle("on", on);
    likeBtn.querySelector("[data-count]").textContent = p.likes.length;
    return;
  }

  // -- Like d'un coupon combiné --
  const cpLike = e.target.closest("[data-couponlike]");
  if (cpLike) {
    e.stopPropagation();
    const c = API.mockData.coupons.find((x) => x.id === cpLike.dataset.couponlike);
    if (c) {
      const meId = API.mockData.currentUserId;
      const i = c.likes.indexOf(meId);
      if (i >= 0) c.likes.splice(i, 1); else c.likes.push(meId);
      cpLike.classList.toggle("on", i < 0);
      cpLike.querySelector("[data-count]").textContent = c.likes.length;
    }
    return;
  }

  // -- Vote à un sondage communautaire --
  const voteBtn = e.target.closest("[data-vote]");
  if (voteBtn && !voteBtn.disabled) {
    e.stopPropagation();
    const predId = voteBtn.dataset.vote;
    await API.voteSondage(predId, +voteBtn.dataset.optindex);
    const fresh = await API.getPrediction(predId);
    const pollEl = voteBtn.closest(".poll");
    if (pollEl) {
      pollEl.outerHTML = pollHTML(fresh);
      // Forcer l'animation des barres depuis 0 → pourcentage.
      const np = document.querySelector(`.poll[data-poll="${predId}"]`);
      if (np) np.querySelectorAll(".poll-fill").forEach((f) => {
        const w = f.style.width; f.style.width = "0"; f.getBoundingClientRect(); f.style.width = w;
      });
    }
    toast("Vote enregistré 🗳️", "ok");
    return;
  }

  // -- Ouvrir le détail du TrustScore (gauge cliquable) --
  const trustGauge = e.target.closest("[data-trustdetail]");
  if (trustGauge) {
    openTrustModal(trustGauge.dataset.trustdetail);
    return;
  }

  // -- Fermer le modal --
  if (e.target.closest("[data-modalclose]") || e.target.classList.contains("modal-backdrop")) {
    const m = $(".modal-backdrop"); if (m) m.remove();
    return;
  }

  // -- Repost --
  const repostBtn = e.target.closest("[data-repost]");
  if (repostBtn) {
    e.stopPropagation();
    const p = await API.repostPrediction(repostBtn.dataset.repost);
    const on = p.reposts.includes(API.mockData.currentUserId);
    repostBtn.classList.toggle("on", on);
    repostBtn.querySelector("[data-count]").textContent = p.reposts.length;
    toast(on ? "Reposté 🔁" : "Repost retiré", on ? "ok" : "");
    return;
  }

  // -- Sauvegarder --
  const saveBtn = e.target.closest("[data-save]");
  if (saveBtn) {
    e.stopPropagation();
    const p = await API.savePrediction(saveBtn.dataset.save);
    const on = p.sauvegardes.includes(API.mockData.currentUserId);
    saveBtn.classList.toggle("on", on);
    toast(on ? "Enregistré dans tes signets 🔖" : "Retiré des signets", on ? "ok" : "");
    return;
  }

  // -- Partager : pronostic → modal de partage ; coupon → lien copié --
  const shareBtn = e.target.closest("[data-share]");
  if (shareBtn) {
    e.stopPropagation();
    const sid = shareBtn.dataset.share;
    if (sid.startsWith("p_")) openShareModal(sid);
    else toast("Lien copié ! 🔗", "ok");
    return;
  }

  // -- Réactions emoji (ouvrir la palette) --
  const reactAdd = e.target.closest("[data-reactadd]");
  if (reactAdd) {
    e.stopPropagation();
    const wrap = reactAdd.closest(".react-add-wrap");
    const wasOpen = wrap.classList.contains("open");
    $$(".react-add-wrap.open").forEach((w) => w.classList.remove("open"));
    wrap.classList.toggle("open", !wasOpen);
    return;
  }

  // -- Réactions emoji (choisir / basculer) --
  const reactBtn = e.target.closest("[data-react]");
  if (reactBtn) {
    e.stopPropagation();
    const [kind, id] = reactBtn.dataset.react.split(":");
    const emoji = reactBtn.dataset.emoji;
    const reactions = kind === "pred" ? await API.reactPrediction(id, emoji) : await API.reactMessage(id, emoji);
    const cont = document.getElementById(`react-${kind}-${id}`);
    if (cont) cont.outerHTML = reactionsHTML(reactions, kind, id);
    return;
  }

  // -- Envoyer un pronostic partagé dans une conversation --
  const shareTo = e.target.closest("[data-shareto]");
  if (shareTo) {
    await API.sharePrediction(shareTo.dataset.shareto, shareTo.dataset.sharepred);
    $(".modal-backdrop")?.remove();
    toast("Pronostic partagé 📤", "ok");
    updateMsgBadge();
    return;
  }

  // -- Suivre / ne plus suivre --
  const followBtn = e.target.closest("[data-follow]");
  if (followBtn) {
    e.stopPropagation();
    const { suivi } = await API.toggleFollow(followBtn.dataset.follow);
    followBtn.classList.toggle("on", suivi);
    toast(suivi ? "Abonnement ajouté ✅" : "Désabonné", suivi ? "ok" : "");
    // Mettre à jour le compteur d'abonnés s'il est affiché (page profil).
    const fc = $("#followerCount");
    const cible = API.mockData.users.find((u) => u.id === followBtn.dataset.follow);
    if (fc && cible) fc.textContent = cible.abonnes.length;
    updateSuggestions();
    return;
  }

  // -- Ouvrir une conversation --
  const msgBtn = e.target.closest("[data-msg]");
  if (msgBtn) {
    location.hash = `#/messages/${msgBtn.dataset.msg}`;
    return;
  }

  // -- Lancer un défi (battle) --
  const battleBtn = e.target.closest("[data-battle]");
  if (battleBtn) {
    const r = await API.createBattle(battleBtn.dataset.battle, "Défi de la journée");
    if (!r.ok) { toast(r.error, "err"); return; }
    toast("Défi lancé ⚔️ En attente de la réponse.", "ok");
    location.hash = `#/battle/${r.battle.id}`;
    return;
  }

  // -- Accepter / refuser / avancer / terminer un défi --
  const accBtn = e.target.closest("[data-battleaccept]");
  if (accBtn) { await API.acceptBattle(accBtn.dataset.battleaccept); toast("Défi accepté ! ⚔️", "ok"); router(); return; }
  const decBtn = e.target.closest("[data-battledecline]");
  if (decBtn) { await API.declineBattle(decBtn.dataset.battledecline); toast("Défi refusé.", ""); location.hash = "#/battles"; return; }
  const advBtn = e.target.closest("[data-battleadvance]");
  if (advBtn) { await API.advanceBattle(advBtn.dataset.battleadvance, false); router(); return; }
  const finBtn = e.target.closest("[data-battlefinish]");
  if (finBtn) { await API.advanceBattle(finBtn.dataset.battlefinish, true); toast("Défi terminé 🏁", "ok"); router(); return; }

  // -- Voir plus (analyse) --
  const vp = e.target.closest("[data-voirplus]");
  if (vp) {
    const card = vp.closest(".card");
    card.querySelector("[data-analyse]").classList.remove("clamp");
    vp.remove();
    return;
  }

  // -- Résolution démo (gagné/perdu aléatoire pondéré) --
  const resBtn = e.target.closest("[data-resolve]");
  if (resBtn) {
    e.stopPropagation();
    const id = resBtn.dataset.resolve;
    // 60% de chances de gagner pour une démo agréable.
    const resultat = Math.random() < 0.6 ? "gagne" : "perdu";
    await API.resolvePrediction(id, resultat);
    toast(resultat === "gagne" ? "Pronostic résolu : GAGNÉ ! 🟢" : "Pronostic résolu : perdu 🔴",
      resultat === "gagne" ? "ok" : "err");
    // Recharger la vue courante pour recalculer TOUTES les stats en temps réel.
    router();
    return;
  }

  // -- Onglets du profil --
  const tab = e.target.closest("[data-tab]");
  if (tab) {
    $$("#profileTabs .tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const userId = location.hash.split("/")[2];
    loadProfileTab(userId, tab.dataset.tab);
    return;
  }

  // -- Segments du leaderboard --
  const seg = e.target.closest("[data-period]");
  if (seg) {
    renderLeaderboard(seg.dataset.period);
    return;
  }

  // -- Filtre par sport (barre supérieure de l'Explorateur) --
  const sportChip = e.target.closest("[data-sport]");
  if (sportChip) {
    exploreSport = sportChip.dataset.sport;
    exploreFilter = "tous"; // on repart de « tous les championnats » du sport choisi
    $$("#sportBar .sport-chip").forEach((c) => c.classList.toggle("active", c === sportChip));
    const cb = $("#champBar");
    if (cb) cb.innerHTML = champBarHTML(); // régénère les puces de championnat du sport
    renderExploreList();
    return;
  }

  // -- Filtre par championnat (chips de l'Explorateur) --
  const champChip = e.target.closest("[data-champ]");
  if (champChip) {
    exploreFilter = champChip.dataset.champ;
    $$("#champBar .champ-chip").forEach((c) => c.classList.toggle("active", c === champChip));
    renderExploreList();
    // Faire remonter la liste sous la barre de filtres.
    const list = $("#exploreList");
    if (list) list.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
});

// Ferme toute palette de réactions ouverte dès qu'on clique en dehors.
document.addEventListener("click", (e) => {
  if (!e.target.closest(".react-add-wrap")) {
    $$(".react-add-wrap.open").forEach((w) => w.classList.remove("open"));
  }
});

/* -----------------------------------------------------------------------------
 *  7. Colonne latérale (widgets) + badges
 * --------------------------------------------------------------------------- */

async function renderAside() {
  // Tendances.
  const trends = await API.getTrends();
  $("#widgetTrends").innerHTML = `
    <h3>🔥 Tendances</h3>
    ${trends.slice(0, 5).map((t) => `
      <div class="widget-item" data-nav="#/hashtag/${t.tag}">
        <div class="t1">${esc(t.contexte)}</div>
        <div class="t2">#${esc(t.tag)}</div>
        <div class="t3">${t.posts.toLocaleString("fr-FR")} publications</div>
      </div>`).join("")}
    <div class="widget-more" data-nav="#/explore">Voir plus</div>`;

  // Défi de la saison : classement par cagnotte virtuelle.
  const saison = API.mockData.users
    .map((u) => ({ u, s: computeStats(u.id) }))
    .sort((a, b) => b.s.cagnotte - a.s.cagnotte)
    .slice(0, 4);
  $("#widgetSeason").innerHTML = `
    <h3>💰 Défi de la saison</h3>
    ${saison.map(({ u, s }, i) => `
      <div class="widget-item" data-nav="#/profile/${u.id}" style="display:flex;align-items:center;gap:10px">
        <span style="width:20px;font-weight:800;color:var(--text-dim)">${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
        <span>${avatarHTML(u, "sm")}</span>
        <div style="flex:1;min-width:0">
          <div class="t2" style="display:flex;align-items:center;gap:4px">${esc(u.pseudo)} ${verifHTML(u.badge)}</div>
          <div class="t3">${fmtFCFA(s.cagnotte)}</div>
        </div>
      </div>`).join("")}
    <div class="widget-more" data-nav="#/leaderboard">Voir le classement</div>`;

  updateSuggestions();

  // Battles.
  const battles = (await API.getBattles()).filter((b) => b.statut !== "propose").slice(0, 3);
  $("#widgetBattles").innerHTML = `
    <h3>⚔️ Battles en cours</h3>
    ${battles.map((b) => {
      const a = API.mockData.users.find((u) => u.id === b.aId);
      const bb = API.mockData.users.find((u) => u.id === b.bId);
      if (!a || !bb) return "";
      return `
      <div class="widget-item" data-nav="#/battle/${b.id}">
        <div class="t1">${esc(b.journee)}</div>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;margin-top:6px">
          <span style="display:flex;align-items:center;gap:5px;min-width:0"><span>${a.avatar}</span><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem">${esc(a.pseudo)}</b></span>
          <span style="font-weight:800;color:var(--accent);white-space:nowrap">${b.scoreA} – ${b.scoreB}</span>
          <span style="display:flex;align-items:center;gap:5px;min-width:0;justify-content:flex-end"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem">${esc(bb.pseudo)}</b><span>${bb.avatar}</span></span>
        </div>
      </div>`;
    }).join("")}
    <div class="widget-more" data-nav="#/battles">Voir tous les défis</div>`;
}

/** Suggestions « À suivre » : comptes non suivis, triés par TrustScore. */
async function updateSuggestions() {
  const me = API.getCurrentUserSync();
  const users = await API.getAllUsers();
  const suggestions = users
    .filter((u) => u.id !== me.id && !me.abonnements.includes(u.id))
    .map((u) => ({ u, s: computeStats(u.id) }))
    .sort((a, b) => b.s.trustScore - a.s.trustScore)
    .slice(0, 3);

  const el = $("#widgetSuggest");
  if (!el) return;
  if (!suggestions.length) {
    el.innerHTML = `<h3>✨ À suivre</h3><div class="widget-item"><div class="t3">Tu suis déjà tout le monde 🎉</div></div>`;
    return;
  }
  el.innerHTML = `
    <h3>✨ Suggestions</h3>
    ${suggestions.map(({ u, s }) => `
      <div class="widget-item" style="display:flex;align-items:center;gap:10px">
        <div style="cursor:pointer" data-nav="#/profile/${u.id}">${avatarHTML(u, "sm")}</div>
        <div style="flex:1;min-width:0" data-nav="#/profile/${u.id}">
          <div class="t2" style="display:flex;align-items:center;gap:4px">${esc(u.nom)} ${verifHTML(u.badge)}</div>
          <div class="t3">TrustScore ${s.trustScore} ${s.badge.emoji}</div>
        </div>
        <button class="btn btn-follow" data-follow="${u.id}" style="padding:6px 14px;font-size:.82rem"></button>
      </div>`).join("")}`;
}

/** Bloc « nav-me » (compte courant en bas de la nav gauche). */
function renderNavMe() {
  const me = API.getCurrentUserSync();
  $("#navMe").innerHTML = `
    ${avatarHTML(me, "sm")}
    <div class="who">
      <b>${esc(me.nom)}</b>
      <span>@${esc(me.pseudo)}</span>
    </div>`;
}

/** Met à jour la pastille de notifications non lues (nav + mobile). */
function updateNotifBadge() {
  const n = API.mockData.notifications.filter((x) => !x.lu && state.notifPrefs[x.type] !== false).length;
  [["#navNotifBadge"], ["#mobileNotifBadge"]].forEach(([sel]) => {
    const el = $(sel);
    if (!el) return;
    el.style.display = n ? "grid" : "none";
    el.textContent = n;
  });
}

/** Met à jour la pastille de messages non lus. */
function updateMsgBadge() {
  const n = API.countUnreadMessages();
  const el = $("#navMsgBadge");
  if (el) { el.style.display = n ? "grid" : "none"; el.textContent = n; }
}

/* -----------------------------------------------------------------------------
 *  8. Reveal au scroll (micro-animation d'apparition)
 * --------------------------------------------------------------------------- */
let revealObserver;
function observeReveal() {
  if (!("IntersectionObserver" in window)) return;
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); revealObserver.unobserve(en.target); } });
    }, { threshold: 0.08 });
  }
  // On applique un léger reveal aux cartes au-delà de l'écran initial.
  $$(".card").forEach((c, i) => { if (i > 2) { c.classList.add("reveal"); revealObserver.observe(c); } });
}

/* -----------------------------------------------------------------------------
 *  9. Thème clair / sombre (en mémoire, pas de storage)
 * --------------------------------------------------------------------------- */
function applyTheme(t) {
  state.theme = t;
  document.documentElement.setAttribute("data-theme", t);
  $("#themeLabel").textContent = t === "dark" ? "🌙 Mode sombre" : "☀️ Mode clair";
  $('meta[name="theme-color"]').setAttribute("content", t === "dark" ? "#0a0e14" : "#f2f4f8");
}
$("#themeToggle").addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark"));

/* -----------------------------------------------------------------------------
 *  10. Routeur par hash (#/...)
 * --------------------------------------------------------------------------- */
function setActiveNav(route) {
  $$(".nav-link, .mobile-nav a").forEach((a) => a.classList.toggle("active", a.dataset.route === route));
}

async function router() {
  // Garde : aucune vue n'est rendue tant que l'utilisateur n'est pas connecté.
  if (!API.mockData.currentUserId) return;
  const hash = location.hash || "#/feed";
  const parts = hash.slice(2).split("/"); // ex. ["profile","u_kader"]
  const route = parts[0] || "feed";

  // Remonter en haut pour chaque changement de vue.
  window.scrollTo({ top: 0 });

  // Bouton retour mobile : visible dès qu'on n'est pas sur une vue racine.
  const racines = ["feed", "explore", "leaderboard", "notifications", "search", "create", "messages", "battles"];
  // La liste des messages est une racine, mais un fil de discussion ne l'est pas.
  const estRacine = racines.includes(route) && !(route === "messages" && parts[1]);
  $("#backBtn").classList.toggle("show", !estRacine);

  switch (route) {
    case "feed": setActiveNav("feed"); await renderFeed(); break;
    case "explore": setActiveNav("explore"); exploreSport = "tous"; exploreFilter = "tous"; await renderExplore(); break;
    case "profile": setActiveNav(parts[1] === API.mockData.currentUserId ? "profile" : ""); await renderProfile(parts[1] || "u_moi"); break;
    case "prediction": setActiveNav(""); await renderPredictionDetail(parts[1]); break;
    case "leaderboard": setActiveNav("leaderboard"); await renderLeaderboard(); break;
    case "create": setActiveNav("create"); renderCreate(); break;
    case "notifications": setActiveNav("notifications"); await renderNotifications(); break;
    case "search": setActiveNav("search"); await renderSearch(decodeURIComponent(parts[1] || "")); break;
    case "hashtag": setActiveNav(""); await renderHashtag(decodeURIComponent(parts[1] || "")); break;
    case "championnat": setActiveNav("explore"); await renderChampionnatPage(decodeURIComponent(parts[1] || "")); break;
    case "messages":
      setActiveNav("messages");
      if (parts[1]) await renderThread(parts[1]); else await renderMessages();
      break;
    case "settings": setActiveNav(""); renderSettings(); break;
    case "stats": setActiveNav(""); renderStats(); break;
    case "battles": setActiveNav(""); await renderBattles(); break;
    case "battle": setActiveNav(""); await renderBattleDetail(parts[1]); break;
    default: setActiveNav("feed"); await renderFeed();
  }
}

// Bouton retour.
$("#backBtn").addEventListener("click", () => history.back());

// Recherche depuis la colonne latérale.
$("#asideSearch").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    location.hash = "#/search/" + encodeURIComponent(e.target.value.trim());
  }
});

/* =============================================================================
 *  11. AUTHENTIFICATION — connexion / inscription / compte
 * ========================================================================== */

// Palette d'avatars (emoji) proposés à l'inscription et à l'édition de profil.
const AVATARS = ["🙂", "🦁", "👑", "📊", "🌟", "🧙🏾", "⚽", "🔥", "🎯", "🐘", "🚀", "💎", "🥅", "🏆", "😎", "🧠"];
// Bannières prédéfinies (dégradé + couleur d'accent associée).
const BANNIERES = [
  { grad: "linear-gradient(135deg,#0b3d2e,#00C853)", c: "#00C853" },
  { grad: "linear-gradient(135deg,#3d2f00,#FFB300)", c: "#FFB300" },
  { grad: "linear-gradient(135deg,#3d0f00,#FF3D00)", c: "#FF3D00" },
  { grad: "linear-gradient(135deg,#00204d,#2979FF)", c: "#2979FF" },
  { grad: "linear-gradient(135deg,#2a004d,#AA00FF)", c: "#AA00FF" },
  { grad: "linear-gradient(135deg,#00332c,#00BFA5)", c: "#00BFA5" },
];
const SPORTS_DISPO = ["Football", "Basket", "Tennis", "Rugby", "MMA", "Formule 1"];

let appStarted = false;

/** Affiche le portail d'authentification et masque l'application. */
function showAuthGate() {
  stopLiveNotifs();
  document.getElementById("appRoot").hidden = true;
  document.getElementById("mobileNav").hidden = true;
  const gate = document.getElementById("authGate");
  gate.hidden = false;
  renderAuthGate();
}

/* -----------------------------------------------------------------------------
 *  Notifications en temps réel (simulation) : de l'activité arrive en direct.
 *  >>> En production : flux serveur via WebSocket / Server-Sent Events. <<<
 * --------------------------------------------------------------------------- */
let liveNotifTimer = null;
function startLiveNotifs() {
  stopLiveNotifs();
  liveNotifTimer = setInterval(() => {
    if (!API.mockData.currentUserId) return;
    const me = API.getCurrentUserSync();
    const autres = API.mockData.users.filter((u) => u.id !== me.id);
    if (!autres.length) return;
    const acteur = autres[Math.floor(Math.random() * autres.length)];
    const mesPreds = API.mockData.predictions.filter((p) => p.auteurId === me.id);
    // Pondération : plus de likes/commentaires que de follows.
    const types = mesPreds.length ? ["like", "like", "comment", "follow"] : ["follow"];
    const type = types[Math.floor(Math.random() * types.length)];
    const cible = mesPreds.length ? mesPreds[Math.floor(Math.random() * mesPreds.length)].id : null;

    let texte, toastMsg;
    if (type === "follow") { texte = "a commencé à vous suivre"; toastMsg = `➕ @${acteur.pseudo} vous suit !`; }
    else if (type === "like") { texte = "a aimé votre pronostic"; toastMsg = `❤️ @${acteur.pseudo} a aimé ton pronostic`; }
    else { texte = "a commenté votre pronostic"; toastMsg = `💬 @${acteur.pseudo} a commenté`; }

    API.pushNotification({ type, acteurId: acteur.id, cibleId: type === "follow" ? null : cible, texte });
    updateNotifBadge();
    // Toast uniquement si ce type de notification est activé dans les Paramètres.
    if (state.notifPrefs[type] !== false) toast(toastMsg, "");
    // Rafraîchir la vue Notifications si elle est ouverte.
    if ((location.hash || "").startsWith("#/notifications")) renderNotifications();
  }, 16000);
}
function stopLiveNotifs() { clearInterval(liveNotifTimer); liveNotifTimer = null; }

/** Révèle l'application après connexion et initialise les vues. */
function enterApp() {
  document.getElementById("authGate").hidden = true;
  document.getElementById("appRoot").hidden = false;
  document.getElementById("mobileNav").hidden = false;
  renderNavMe();
  renderAside();
  updateNotifBadge();
  updateMsgBadge();
  startLiveNotifs();
  if (!appStarted) { window.addEventListener("hashchange", router); appStarted = true; }
  if (!location.hash || location.hash === "#" || location.hash === "#/") {
    location.hash = "#/feed";
  }
  router();
}

/** Construit l'écran de connexion / inscription. */
function renderAuthGate(mode = "login") {
  const gate = document.getElementById("authGate");
  const demoUsers = API.mockData.users.slice(0, 6);

  gate.innerHTML = `
    <div class="auth-hero">
      <div class="auth-brand"><span class="logo">🎯</span> Prono<span>Stars</span></div>
      <h1 class="auth-title">Le réseau social des pronostiqueurs 🇨🇮</h1>
      <p class="auth-sub">Partage tes analyses, gagne en crédibilité avec ton <b>TrustScore</b>,
        suis les meilleurs experts et grimpe au classement. Football, basket, tennis, F1…</p>
      <ul class="auth-feats">
        <li>📈 Ton TrustScore et tes stats de performance en direct</li>
        <li>🎟️ Coupons combinés & 🤖 Coach IA sur chaque pronostic</li>
        <li>🌍 Championnats du monde entier, multi-sports</li>
      </ul>
      <p class="auth-warn">⚠️ Réseau social de partage d'analyses — aucun pari, aucun argent de jeu.</p>
    </div>

    <div class="auth-card">
      <div class="auth-tabs">
        <button class="auth-tab ${mode === "login" ? "active" : ""}" data-authtab="login">Connexion</button>
        <button class="auth-tab ${mode === "signup" ? "active" : ""}" data-authtab="signup">Inscription</button>
      </div>
      <div id="authFormBox">${mode === "login" ? loginFormHTML() : signupFormHTML()}</div>

      <div class="auth-demo">
        <div class="auth-demo-t">⚡ Ou explore avec un compte de démo :</div>
        <div class="auth-demo-list">
          ${demoUsers.map((u) => `
            <button class="auth-demo-chip" data-demologin="${u.id}" title="Se connecter en tant que ${esc(u.nom)}">
              <span class="ad-av" style="background:${u.couleur}22;border-color:${u.couleur}66">${u.avatar}</span>
              <span>@${esc(u.pseudo)}</span>
            </button>`).join("")}
        </div>
      </div>
    </div>`;

  wireAuthEvents();
}

function loginFormHTML() {
  return `
    <form class="auth-form" id="loginForm">
      <div class="field">
        <label>Pseudo ou email</label>
        <input id="liId" placeholder="kader_analyste" autocomplete="username" required />
      </div>
      <div class="field">
        <label>Mot de passe</label>
        <input id="liPw" type="password" placeholder="••••••••" autocomplete="current-password" required />
      </div>
      <div class="auth-error" id="authError"></div>
      <button type="submit" class="auth-submit">Se connecter</button>
      <p class="auth-hint">💡 Comptes de démo : mot de passe <b>demo1234</b></p>
    </form>`;
}

function signupFormHTML() {
  return `
    <form class="auth-form" id="signupForm">
      <div class="field">
        <label>Choisis ton avatar</label>
        <div class="avatar-picker" id="suAvatar">
          ${AVATARS.map((a, i) => `<button type="button" class="ap-item ${i === 0 ? "on" : ""}" data-av="${a}">${a}</button>`).join("")}
        </div>
      </div>
      <div class="field row2">
        <div class="field"><label>Pseudo</label><input id="suPseudo" placeholder="mon_pseudo" required /></div>
        <div class="field"><label>Nom affiché</label><input id="suNom" placeholder="Ton nom" /></div>
      </div>
      <div class="field"><label>Email</label><input id="suEmail" type="email" placeholder="toi@exemple.ci" /></div>
      <div class="field"><label>Mot de passe (6 car. min.)</label><input id="suPw" type="password" placeholder="••••••••" required /></div>
      <div class="field">
        <label>Sports favoris</label>
        <div class="sports-picker" id="suSports">
          ${SPORTS_DISPO.map((s, i) => `<button type="button" class="sp-item ${i === 0 ? "on" : ""}" data-sport="${s}">${sportEmoji(s)} ${s}</button>`).join("")}
        </div>
      </div>
      <div class="field">
        <label>Couleur de bannière</label>
        <div class="banner-picker" id="suBanner">
          ${BANNIERES.map((b, i) => `<button type="button" class="bp-item ${i === 0 ? "on" : ""}" data-grad="${b.grad}" data-c="${b.c}" style="background:${b.grad}"></button>`).join("")}
        </div>
      </div>
      <div class="auth-error" id="authError"></div>
      <button type="submit" class="auth-submit">Créer mon compte 🎯</button>
    </form>`;
}

/** Attache les événements de l'écran d'authentification. */
function wireAuthEvents() {
  // Bascule connexion / inscription.
  $$("[data-authtab]").forEach((b) => b.addEventListener("click", () => renderAuthGate(b.dataset.authtab)));

  // Connexion démo en un clic.
  $$("[data-demologin]").forEach((b) => b.addEventListener("click", async () => {
    const r = await API.switchAccount(b.dataset.demologin);
    if (r.ok) { toast(`Bienvenue @${r.user.pseudo} 👋`, "ok"); enterApp(); }
  }));

  // Formulaire de connexion.
  const lf = $("#loginForm");
  if (lf) lf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const r = await API.login($("#liId").value, $("#liPw").value);
    if (!r.ok) { $("#authError").textContent = r.error; return; }
    toast(`Content de te revoir, ${esc(r.user.nom)} 👋`, "ok");
    enterApp();
  });

  // Sélecteurs (avatar / sports / bannière) du formulaire d'inscription.
  let avatar = AVATARS[0];
  const sports = new Set([SPORTS_DISPO[0]]);
  let banniere = BANNIERES[0].grad, couleur = BANNIERES[0].c;

  const su = $("#signupForm");
  if (su) {
    $("#suAvatar").addEventListener("click", (e) => {
      const it = e.target.closest("[data-av]"); if (!it) return;
      avatar = it.dataset.av;
      $$("#suAvatar .ap-item").forEach((x) => x.classList.toggle("on", x === it));
    });
    $("#suSports").addEventListener("click", (e) => {
      const it = e.target.closest("[data-sport]"); if (!it) return;
      const s = it.dataset.sport;
      if (sports.has(s)) { if (sports.size > 1) sports.delete(s); } else sports.add(s);
      $$("#suSports .sp-item").forEach((x) => x.classList.toggle("on", sports.has(x.dataset.sport)));
    });
    $("#suBanner").addEventListener("click", (e) => {
      const it = e.target.closest("[data-grad]"); if (!it) return;
      banniere = it.dataset.grad; couleur = it.dataset.c;
      $$("#suBanner .bp-item").forEach((x) => x.classList.toggle("on", x === it));
    });

    su.addEventListener("submit", async (e) => {
      e.preventDefault();
      const r = await API.signup({
        pseudo: $("#suPseudo").value, nom: $("#suNom").value, email: $("#suEmail").value,
        motDePasse: $("#suPw").value, avatar, couleur, banniere, sports: [...sports],
      });
      if (!r.ok) { $("#authError").textContent = r.error; return; }
      toast(`Compte créé — bienvenue @${r.user.pseudo} ! 🎉`, "ok");
      enterApp();
      openOnboarding(); // suggestion : suivre des experts
    });
  }
}

/* -----------------------------------------------------------------------------
 *  Menu de compte + édition de profil + onboarding
 * --------------------------------------------------------------------------- */

/** Menu « Mon compte » (modal) : profil, édition, changement de compte, déconnexion. */
function openAccountMenu() {
  const me = API.getCurrentUserSync();
  const autres = API.mockData.users.filter((u) => u.id !== me.id).slice(0, 6);
  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div style="display:flex;align-items:center;gap:10px">
          ${avatarHTML(me, "md")}
          <div>
            <div class="modal-title" style="font-size:1rem">${esc(me.nom)}</div>
            <div class="modal-sub">@${esc(me.pseudo)}</div>
          </div>
        </div>
        <button class="modal-x" data-modalclose>✕</button>
      </div>
      <div class="modal-body">
        <button class="acc-item" data-acc="profile">👤 Voir mon profil</button>
        <button class="acc-item" data-acc="edit">✏️ Modifier le profil</button>
        <button class="acc-item" data-acc="messages">💬 Messages</button>
        <button class="acc-item" data-acc="battles">⚔️ Mes battles</button>
        <button class="acc-item" data-acc="stats">📊 Statistiques</button>
        <button class="acc-item" data-acc="settings">⚙️ Paramètres</button>
        <div class="acc-sep">Changer de compte (démo)</div>
        <div class="acc-switch">
          ${autres.map((u) => `
            <button class="acc-switch-chip" data-switch="${u.id}">
              <span class="ad-av" style="background:${u.couleur}22;border-color:${u.couleur}66">${u.avatar}</span>
              <span>@${esc(u.pseudo)}</span>
            </button>`).join("")}
        </div>
        <button class="acc-item danger" data-acc="logout">🚪 Se déconnecter</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener("click", async (e) => {
    const acc = e.target.closest("[data-acc]");
    const sw = e.target.closest("[data-switch]");
    if (sw) {
      const r = await API.switchAccount(sw.dataset.switch);
      if (r.ok) { modal.remove(); renderNavMe(); renderAside(); updateNotifBadge(); updateMsgBadge(); toast(`Compte : @${r.user.pseudo}`, "ok"); location.hash = "#/feed"; router(); }
      return;
    }
    if (!acc) return;
    if (acc.dataset.acc === "profile") { modal.remove(); location.hash = `#/profile/${me.id}`; }
    else if (acc.dataset.acc === "edit") { modal.remove(); openEditProfile(); }
    else if (acc.dataset.acc === "messages") { modal.remove(); location.hash = "#/messages"; }
    else if (acc.dataset.acc === "battles") { modal.remove(); location.hash = "#/battles"; }
    else if (acc.dataset.acc === "stats") { modal.remove(); location.hash = "#/stats"; }
    else if (acc.dataset.acc === "settings") { modal.remove(); location.hash = "#/settings"; }
    else if (acc.dataset.acc === "logout") {
      modal.remove(); API.logout(); toast("Déconnecté. À bientôt 👋", ""); showAuthGate();
    }
  });
}

/** Modal d'édition du profil de l'utilisateur connecté. */
function openEditProfile() {
  const me = API.getCurrentUserSync();
  const sportsSel = new Set(me.sports);
  let avatar = me.avatar, banniere = me.banniere, couleur = me.couleur;

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div><div class="modal-title">✏️ Modifier le profil</div><div class="modal-sub">@${esc(me.pseudo)}</div></div>
        <button class="modal-x" data-modalclose>✕</button>
      </div>
      <div class="modal-body">
        <form id="editForm" class="auth-form">
          <div class="field">
            <label>Avatar</label>
            <div class="avatar-picker" id="edAvatar">
              ${AVATARS.map((a) => `<button type="button" class="ap-item ${a === avatar ? "on" : ""}" data-av="${a}">${a}</button>`).join("")}
            </div>
          </div>
          <div class="field"><label>Nom affiché</label><input id="edNom" value="${esc(me.nom)}" /></div>
          <div class="field"><label>Bio</label><textarea id="edBio" rows="3">${esc(me.bio)}</textarea></div>
          <div class="field">
            <label>Sports favoris</label>
            <div class="sports-picker" id="edSports">
              ${SPORTS_DISPO.map((s) => `<button type="button" class="sp-item ${sportsSel.has(s) ? "on" : ""}" data-sport="${s}">${sportEmoji(s)} ${s}</button>`).join("")}
            </div>
          </div>
          <div class="field">
            <label>Bannière</label>
            <div class="banner-picker" id="edBanner">
              ${BANNIERES.map((b) => `<button type="button" class="bp-item ${b.grad === banniere ? "on" : ""}" data-grad="${b.grad}" data-c="${b.c}" style="background:${b.grad}"></button>`).join("")}
            </div>
          </div>
          <button type="submit" class="auth-submit">💾 Enregistrer</button>
        </form>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector("#edAvatar").addEventListener("click", (e) => {
    const it = e.target.closest("[data-av]"); if (!it) return;
    avatar = it.dataset.av;
    modal.querySelectorAll("#edAvatar .ap-item").forEach((x) => x.classList.toggle("on", x === it));
  });
  modal.querySelector("#edSports").addEventListener("click", (e) => {
    const it = e.target.closest("[data-sport]"); if (!it) return;
    const s = it.dataset.sport;
    if (sportsSel.has(s)) { if (sportsSel.size > 1) sportsSel.delete(s); } else sportsSel.add(s);
    modal.querySelectorAll("#edSports .sp-item").forEach((x) => x.classList.toggle("on", sportsSel.has(x.dataset.sport)));
  });
  modal.querySelector("#edBanner").addEventListener("click", (e) => {
    const it = e.target.closest("[data-grad]"); if (!it) return;
    banniere = it.dataset.grad; couleur = it.dataset.c;
    modal.querySelectorAll("#edBanner .bp-item").forEach((x) => x.classList.toggle("on", x === it));
  });
  modal.querySelector("#editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await API.updateProfile({
      nom: modal.querySelector("#edNom").value.trim(),
      bio: modal.querySelector("#edBio").value.trim(),
      avatar, banniere, couleur, sports: [...sportsSel],
    });
    modal.remove();
    renderNavMe();
    toast("Profil mis à jour ✅", "ok");
    router(); // rafraîchit la page profil si affichée
  });
}

/** Onboarding après inscription : proposer de suivre des experts. */
async function openOnboarding() {
  const me = API.getCurrentUserSync();
  const experts = API.mockData.users
    .filter((u) => u.id !== me.id)
    .map((u) => ({ u, s: computeStats(u.id) }))
    .sort((a, b) => b.s.trustScore - a.s.trustScore)
    .slice(0, 4);

  const modal = document.createElement("div");
  modal.className = "modal-backdrop";
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div><div class="modal-title">🎉 Bienvenue sur PronoStars !</div>
          <div class="modal-sub">Suis quelques experts pour démarrer ton fil</div></div>
        <button class="modal-x" data-modalclose>✕</button>
      </div>
      <div class="modal-body">
        ${experts.map(({ u, s }) => `
          <div class="lb-row" style="border:none;padding:8px 0">
            ${avatarHTML(u, "md")}
            <div class="lb-info">
              <div class="n">${esc(u.nom)} ${verifHTML(u.badge)}</div>
              <div class="h">@${esc(u.pseudo)} · TrustScore ${s.trustScore} ${s.badge.emoji}</div>
            </div>
            <button class="btn btn-follow" data-follow="${u.id}" style="padding:7px 14px"></button>
          </div>`).join("")}
        <button class="auth-submit" data-modalclose style="margin-top:10px">Commencer 🚀</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

/* -----------------------------------------------------------------------------
 *  12. Amorçage (bootstrap)
 * --------------------------------------------------------------------------- */
function boot() {
  applyTheme("dark");
  buildChampIndex();
  // L'application n'est révélée qu'après authentification.
  if (API.mockData.currentUserId) enterApp();
  else showAuthGate();
  console.log("%c🎯 PronoStars", "font-size:16px;font-weight:800;color:#00c853", "— prêt. Réseau social de pronostics (démo front).");
}

boot();
