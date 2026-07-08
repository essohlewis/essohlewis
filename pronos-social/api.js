/* =============================================================================
 *  api.js — Couche d'accès aux données (FACTICE / MOCK)
 * =============================================================================
 *  Ce fichier simule un backend. Toutes les fonctions sont `async` et renvoient
 *  des Promesses afin de reproduire le comportement d'appels réseau réels.
 *
 *  >>> POINT D'INTÉGRATION BACKEND <<<
 *  À terme, ces fonctions seront branchées sur une API REST développée en
 *  PHP 8.2+ suivant une architecture MVC (PDO / MySQL) :
 *     - Authentification par token (Bearer JWT ou token opaque en base).
 *     - Endpoints REST : GET /api/feed, GET /api/users/{id},
 *       GET /api/users/{id}/predictions?filter=..., POST /api/predictions,
 *       POST /api/users/{id}/follow, POST /api/predictions/{id}/like,
 *       GET /api/leaderboard?period=week|month
 *     - Paiement Mobile Money (CinetPay / PayDunya) pour les fonctions premium
 *       (Mode confiance, coups sûrs vérifiés, abonnements « Copie »).
 *
 *  Pour brancher le vrai backend : remplacer le corps de chaque fonction par un
 *  `fetch()` vers l'endpoint correspondant, en conservant la même signature et
 *  la même forme de données de retour.
 * ============================================================================= */

/* -----------------------------------------------------------------------------
 *  Utilitaires de simulation
 * --------------------------------------------------------------------------- */

// Simule la latence réseau (ms) pour rendre l'UI réaliste (spinners, etc.).
const NETWORK_DELAY = 120;
const wait = (ms = NETWORK_DELAY) => new Promise((r) => setTimeout(r, ms));

// Génère un identifiant unique simple (remplacé côté serveur par un AUTO_INCREMENT / UUID).
let _idCounter = 1000;
const nextId = (prefix) => `${prefix}_${++_idCounter}`;

/* -----------------------------------------------------------------------------
 *  DONNÉES DE DÉMONSTRATION (mockData)
 *  Persistance « en mémoire » uniquement — AUCUN localStorage/sessionStorage.
 *  Les mutations (follow, like, nouveau pronostic…) modifient directement cet
 *  objet, ce qui suffit pour l'aperçu front-end.
 * --------------------------------------------------------------------------- */

const mockData = {
  // Identifiant de l'utilisateur connecté (session courante simulée).
  currentUserId: "u_moi",

  /* ---- UTILISATEURS ------------------------------------------------------ */
  users: [
    {
      id: "u_moi",
      pseudo: "toi_le_pro",
      nom: "Mon Compte",
      avatar: "🧑🏾‍💻",
      couleur: "#00C853",
      banniere: "linear-gradient(135deg,#0b3d2e,#00C853)",
      bio: "Passionné de foot 🇨🇮 — je partage mes analyses, pas des paris. #Ligue1 #CAN",
      sports: ["Football"],
      inscription: "2024-01-15",
      abonnes: ["u_kader", "u_awa"],
      abonnements: ["u_kader", "u_awa", "u_serge"],
      badge: "Pro",
    },
    {
      id: "u_kader",
      pseudo: "kader_analyste",
      nom: "Kader Traoré",
      avatar: "🦁",
      couleur: "#FFB300",
      banniere: "linear-gradient(135deg,#3d2f00,#FFB300)",
      bio: "Analyste football ⚽ Abidjan. Spécialiste Premier League & LDC. Discipline > émotion.",
      sports: ["Football", "Basket"],
      inscription: "2023-08-02",
      abonnes: ["u_moi", "u_awa", "u_serge", "u_binta", "u_yao"],
      abonnements: ["u_awa", "u_serge"],
      badge: "Vérifié",
    },
    {
      id: "u_awa",
      pseudo: "awa_pronos",
      nom: "Awa Koné",
      avatar: "👑",
      couleur: "#FF3D00",
      banniere: "linear-gradient(135deg,#3d0f00,#FF3D00)",
      bio: "Reine des cotes 👑 Value betting only. CAN 2025, je suis prête. #TeamÉléphants",
      sports: ["Football"],
      inscription: "2023-11-20",
      abonnes: ["u_moi", "u_kader", "u_yao"],
      abonnements: ["u_kader"],
      badge: "Étoile montante",
    },
    {
      id: "u_serge",
      pseudo: "serge_stats",
      nom: "Serge N'Guessan",
      avatar: "📊",
      couleur: "#2979FF",
      banniere: "linear-gradient(135deg,#00204d,#2979FF)",
      bio: "Data + intuition. Over/Under & BTTS mon terrain de jeu. Yamoussoukro.",
      sports: ["Football", "Tennis"],
      inscription: "2024-03-10",
      abonnes: ["u_moi", "u_kader", "u_binta"],
      abonnements: ["u_kader", "u_awa"],
      badge: "Pro",
    },
    {
      id: "u_binta",
      pseudo: "binta_ldc",
      nom: "Binta Diallo",
      avatar: "🌟",
      couleur: "#AA00FF",
      banniere: "linear-gradient(135deg,#2a004d,#AA00FF)",
      bio: "Ligue des Champions = ma spécialité. Débutante mais affamée 🔥",
      sports: ["Football"],
      inscription: "2025-01-05",
      abonnes: ["u_serge"],
      abonnements: ["u_kader", "u_awa", "u_serge"],
      badge: "Étoile montante",
    },
    {
      id: "u_yao",
      pseudo: "yao_le_sage",
      nom: "Yao Kouassi",
      avatar: "🧙🏾",
      couleur: "#00BFA5",
      banniere: "linear-gradient(135deg,#00332c,#00BFA5)",
      bio: "15 ans d'observation du foot ivoirien. Patience et cotes sûres. #Éléphants",
      sports: ["Football"],
      inscription: "2022-05-18",
      abonnes: ["u_awa", "u_kader"],
      abonnements: ["u_kader"],
      badge: "Vérifié",
    },
  ],

  /* ---- PRONOSTICS -------------------------------------------------------- */
  // statut : 'en_cours' | 'gagne' | 'perdu' | 'annule'
  predictions: [
    {
      id: "p_001",
      auteurId: "u_kader",
      match: { equipeA: "Man City", logoA: "🔵", equipeB: "Arsenal", logoB: "🔴", ligue: "Premier League", hashtag: "PremierLeague", date: "2026-07-10T18:30:00" },
      typePari: "1N2",
      choix: "1 (Man City gagne)",
      cote: 1.85,
      confiance: 4,
      premium: true,
      analyse: "City intraitable à domicile cette saison (9 victoires sur 10). Arsenal joue sans son défenseur central titulaire, ce qui fragilise l'axe. Le milieu citizen devrait dominer la possession et créer les décalages. Value correcte sur le 1 sec.",
      statut: "en_cours",
      likes: ["u_moi", "u_awa"],
      reposts: ["u_serge"],
      sauvegardes: ["u_moi"],
      commentaires: [
        { id: "c1", auteurId: "u_awa", texte: "D'accord, mais attention aux contres d'Arsenal 👀", date: "2026-07-08T09:12:00" },
        { id: "c2", auteurId: "u_serge", texte: "Les stats de possession te donnent raison. Je suis.", date: "2026-07-08T10:02:00" },
      ],
      date: "2026-07-08T08:00:00",
    },
    {
      id: "p_002",
      auteurId: "u_awa",
      match: { equipeA: "Côte d'Ivoire", logoA: "🇨🇮", equipeB: "Sénégal", logoB: "🇸🇳", ligue: "CAN", hashtag: "CAN", date: "2026-07-12T20:00:00" },
      typePari: "Over/Under",
      choix: "Over 2.5 buts",
      cote: 2.10,
      confiance: 5,
      premium: true,
      analyse: "Choc au sommet ! Deux attaques de feu, deux défenses qui aiment jouer haut. Les confrontations récentes ont livré du spectacle (moyenne 3.2 buts). Je vise le Over 2.5 avec confiance maximale. Coup sûr de la journée.",
      statut: "en_cours",
      likes: ["u_moi", "u_kader", "u_yao", "u_serge"],
      reposts: ["u_moi", "u_binta"],
      sauvegardes: ["u_moi", "u_kader"],
      commentaires: [
        { id: "c3", auteurId: "u_yao", texte: "Le derby ouest-africain, ça va chauffer 🔥🔥", date: "2026-07-08T11:00:00" },
      ],
      date: "2026-07-08T07:30:00",
    },
    {
      id: "p_003",
      auteurId: "u_serge",
      match: { equipeA: "Real Madrid", logoA: "⚪", equipeB: "Bayern", logoB: "🔴", ligue: "Champions League", hashtag: "ChampionsLeague", date: "2026-07-09T21:00:00" },
      typePari: "BTTS",
      choix: "Les deux équipes marquent — Oui",
      cote: 1.55,
      confiance: 4,
      premium: false,
      analyse: "Deux machines offensives, historique de matchs ouverts. Le BTTS tombe presque systématiquement dans ce duel (7 des 8 dernières). Cote basse mais quasi automatique.",
      statut: "en_cours",
      likes: ["u_binta", "u_kader"],
      reposts: [],
      sauvegardes: ["u_binta"],
      commentaires: [],
      date: "2026-07-07T19:45:00",
    },
    {
      id: "p_004",
      auteurId: "u_kader",
      match: { equipeA: "Liverpool", logoA: "🔴", equipeB: "Chelsea", logoB: "🔵", ligue: "Premier League", hashtag: "PremierLeague", date: "2026-07-05T17:00:00", score: "2-1" },
      typePari: "1N2",
      choix: "1 (Liverpool gagne)",
      cote: 1.95,
      confiance: 4,
      premium: false,
      analyse: "Anfield reste une forteresse. Chelsea irrégulier à l'extérieur. Je prends le 1.",
      statut: "gagne",
      likes: ["u_moi", "u_awa", "u_serge", "u_yao"],
      reposts: ["u_awa"],
      sauvegardes: [],
      commentaires: [{ id: "c4", auteurId: "u_moi", texte: "Encore juste, chapeau 🎩", date: "2026-07-05T19:10:00" }],
      date: "2026-07-05T09:00:00",
    },
    {
      id: "p_005",
      auteurId: "u_kader",
      match: { equipeA: "PSG", logoA: "🔵", equipeB: "Marseille", logoB: "⚪", ligue: "Ligue 1", hashtag: "Ligue1", date: "2026-07-04T20:45:00", score: "3-0" },
      typePari: "Over/Under",
      choix: "Over 2.5 buts",
      cote: 1.70,
      confiance: 3,
      premium: false,
      analyse: "Le Classique livre presque toujours des buts. PSG en forme offensive.",
      statut: "gagne",
      likes: ["u_moi", "u_serge"],
      reposts: [],
      sauvegardes: [],
      commentaires: [],
      date: "2026-07-04T10:00:00",
    },
    {
      id: "p_006",
      auteurId: "u_kader",
      match: { equipeA: "Tottenham", logoA: "⚪", equipeB: "Man United", logoB: "🔴", ligue: "Premier League", hashtag: "PremierLeague", date: "2026-07-02T18:00:00", score: "1-1" },
      typePari: "1N2",
      choix: "2 (Man United gagne)",
      cote: 2.40,
      confiance: 3,
      premium: false,
      analyse: "United en confiance, Tottenham fragile défensivement.",
      statut: "perdu",
      likes: ["u_binta"],
      reposts: [],
      sauvegardes: [],
      commentaires: [],
      date: "2026-07-02T09:30:00",
    },
    {
      id: "p_007",
      auteurId: "u_awa",
      match: { equipeA: "Barcelone", logoA: "🔵", equipeB: "Atlético", logoB: "🔴", ligue: "Champions League", hashtag: "ChampionsLeague", date: "2026-07-03T21:00:00", score: "2-2" },
      typePari: "BTTS",
      choix: "Les deux équipes marquent — Oui",
      cote: 1.80,
      confiance: 4,
      premium: false,
      analyse: "Match ouvert attendu, les deux attaques sont en forme.",
      statut: "gagne",
      likes: ["u_moi", "u_kader", "u_serge"],
      reposts: ["u_kader"],
      sauvegardes: ["u_moi"],
      commentaires: [],
      date: "2026-07-03T11:00:00",
    },
    {
      id: "p_008",
      auteurId: "u_awa",
      match: { equipeA: "Nigeria", logoA: "🇳🇬", equipeB: "Égypte", logoB: "🇪🇬", ligue: "CAN", hashtag: "CAN", date: "2026-07-01T20:00:00", score: "1-0" },
      typePari: "1N2",
      choix: "1 (Nigeria gagne)",
      cote: 2.05,
      confiance: 4,
      premium: false,
      analyse: "Les Super Eagles à domicile, très solides en ce moment.",
      statut: "gagne",
      likes: ["u_yao", "u_kader"],
      reposts: [],
      sauvegardes: [],
      commentaires: [],
      date: "2026-07-01T08:00:00",
    },
    {
      id: "p_009",
      auteurId: "u_awa",
      match: { equipeA: "Lyon", logoA: "🔴", equipeB: "Monaco", logoB: "🔴", ligue: "Ligue 1", hashtag: "Ligue1", date: "2026-06-28T20:45:00", score: "0-1" },
      typePari: "Over/Under",
      choix: "Over 2.5 buts",
      cote: 1.90,
      confiance: 3,
      premium: false,
      analyse: "Deux équipes offensives, je table sur du spectacle.",
      statut: "perdu",
      likes: [],
      reposts: [],
      sauvegardes: [],
      commentaires: [],
      date: "2026-06-28T10:00:00",
    },
    {
      id: "p_010",
      auteurId: "u_serge",
      match: { equipeA: "Inter", logoA: "🔵", equipeB: "Juventus", logoB: "⚪", ligue: "Champions League", hashtag: "ChampionsLeague", date: "2026-07-06T20:45:00", score: "2-0" },
      typePari: "Under/Over",
      choix: "Under 3.5 buts",
      cote: 1.45,
      confiance: 4,
      premium: false,
      analyse: "Derby d'Italie = prudence tactique. Peu de buts attendus.",
      statut: "gagne",
      likes: ["u_moi", "u_binta"],
      reposts: [],
      sauvegardes: [],
      commentaires: [],
      date: "2026-07-06T09:00:00",
    },
    {
      id: "p_011",
      auteurId: "u_serge",
      match: { equipeA: "Napoli", logoA: "🔵", equipeB: "Roma", logoB: "🔴", ligue: "Champions League", hashtag: "ChampionsLeague", date: "2026-07-07T20:45:00", score: "1-1" },
      typePari: "BTTS",
      choix: "Les deux équipes marquent — Oui",
      cote: 1.75,
      confiance: 3,
      premium: false,
      analyse: "Deux formations qui marquent mais encaissent aussi.",
      statut: "gagne",
      likes: ["u_kader"],
      reposts: [],
      sauvegardes: [],
      commentaires: [],
      date: "2026-07-07T09:00:00",
    },
    {
      id: "p_012",
      auteurId: "u_serge",
      match: { equipeA: "Djokovic", logoA: "🎾", equipeB: "Alcaraz", logoB: "🎾", ligue: "Tennis ATP", hashtag: "Tennis", date: "2026-07-11T14:00:00" },
      typePari: "Vainqueur",
      choix: "Alcaraz gagne",
      cote: 1.65,
      confiance: 3,
      premium: false,
      analyse: "Sur surface rapide, la fraîcheur d'Alcaraz fait la différence face à un Djokovic en fin de saison.",
      statut: "en_cours",
      likes: ["u_moi"],
      reposts: [],
      sauvegardes: [],
      commentaires: [],
      date: "2026-07-08T06:00:00",
    },
    {
      id: "p_013",
      auteurId: "u_binta",
      match: { equipeA: "Dortmund", logoA: "🟡", equipeB: "Leipzig", logoB: "⚪", ligue: "Champions League", hashtag: "ChampionsLeague", date: "2026-07-04T18:30:00", score: "3-2" },
      typePari: "Over/Under",
      choix: "Over 2.5 buts",
      cote: 1.60,
      confiance: 4,
      premium: false,
      analyse: "Deux attaques allemandes explosives, du lourd attendu.",
      statut: "gagne",
      likes: ["u_serge", "u_awa"],
      reposts: [],
      sauvegardes: [],
      commentaires: [],
      date: "2026-07-04T08:00:00",
    },
    {
      id: "p_014",
      auteurId: "u_binta",
      match: { equipeA: "Milan", logoA: "🔴", equipeB: "Porto", logoB: "🔵", ligue: "Champions League", hashtag: "ChampionsLeague", date: "2026-07-05T20:45:00", score: "0-0" },
      typePari: "1N2",
      choix: "1 (Milan gagne)",
      cote: 1.70,
      confiance: 3,
      premium: false,
      analyse: "Milan favori à San Siro, Porto en difficulté à l'extérieur.",
      statut: "perdu",
      likes: [],
      reposts: [],
      sauvegardes: [],
      commentaires: [],
      date: "2026-07-05T08:00:00",
    },
    {
      id: "p_015",
      auteurId: "u_yao",
      match: { equipeA: "Maroc", logoA: "🇲🇦", equipeB: "Cameroun", logoB: "🇨🇲", ligue: "CAN", hashtag: "CAN", date: "2026-07-13T17:00:00" },
      typePari: "1N2",
      choix: "1 (Maroc gagne)",
      cote: 1.90,
      confiance: 4,
      premium: true,
      analyse: "Les Lions de l'Atlas, demi-finalistes en titre, dominent le jeu de position. Cameroun combatif mais moins collectif. Le Maroc devrait imposer son rythme. Coup sûr de mon week-end.",
      statut: "en_cours",
      likes: ["u_kader", "u_awa"],
      reposts: [],
      sauvegardes: ["u_moi"],
      commentaires: [],
      date: "2026-07-08T05:30:00",
    },
    {
      id: "p_016",
      auteurId: "u_yao",
      match: { equipeA: "Séville", logoA: "🔴", equipeB: "Valence", logoB: "🟠", ligue: "Ligue 1", hashtag: "Ligue1", date: "2026-06-30T20:00:00", score: "2-1" },
      typePari: "1N2",
      choix: "1 (Séville gagne)",
      cote: 1.80,
      confiance: 3,
      premium: false,
      analyse: "Séville solide à domicile en fin de saison.",
      statut: "gagne",
      likes: ["u_kader"],
      reposts: [],
      sauvegardes: [],
      commentaires: [],
      date: "2026-06-30T09:00:00",
    },
    {
      id: "p_017",
      auteurId: "u_yao",
      match: { equipeA: "Ghana", logoA: "🇬🇭", equipeB: "Algérie", logoB: "🇩🇿", ligue: "CAN", hashtag: "CAN", date: "2026-06-27T20:00:00", score: "1-2" },
      typePari: "Double chance",
      choix: "1X (Ghana ou nul)",
      cote: 1.50,
      confiance: 3,
      premium: false,
      analyse: "Le Ghana joue à domicile, la double chance sécurise.",
      statut: "perdu",
      likes: [],
      reposts: [],
      sauvegardes: [],
      commentaires: [],
      date: "2026-06-27T08:00:00",
    },
    {
      id: "p_018",
      auteurId: "u_moi",
      match: { equipeA: "Atalanta", logoA: "🔵", equipeB: "Fiorentina", logoB: "🟣", ligue: "Champions League", hashtag: "ChampionsLeague", date: "2026-07-09T18:30:00" },
      typePari: "Over/Under",
      choix: "Over 2.5 buts",
      cote: 1.75,
      confiance: 3,
      premium: false,
      analyse: "L'Atalanta joue toujours l'offensive à outrance. Match à buts probable.",
      statut: "en_cours",
      likes: ["u_kader"],
      reposts: [],
      sauvegardes: [],
      commentaires: [],
      date: "2026-07-08T04:00:00",
    },
    {
      id: "p_019",
      auteurId: "u_moi",
      match: { equipeA: "Metz", logoA: "🔴", equipeB: "Lille", logoB: "🔴", ligue: "Ligue 1", hashtag: "Ligue1", date: "2026-06-29T15:00:00", score: "1-3" },
      typePari: "1N2",
      choix: "2 (Lille gagne)",
      cote: 1.85,
      confiance: 4,
      premium: false,
      analyse: "Lille bien supérieur sur le papier, Metz en difficulté.",
      statut: "gagne",
      likes: ["u_kader", "u_awa"],
      reposts: [],
      sauvegardes: [],
      commentaires: [],
      date: "2026-06-29T09:00:00",
    },
    {
      id: "p_020",
      auteurId: "u_moi",
      match: { equipeA: "Brest", logoA: "🔴", equipeB: "Nice", logoB: "🔴", ligue: "Ligue 1", hashtag: "Ligue1", date: "2026-06-26T20:00:00", score: "0-2" },
      typePari: "BTTS",
      choix: "Les deux équipes marquent — Oui",
      cote: 1.90,
      confiance: 2,
      premium: false,
      analyse: "Pari un peu risqué sur les deux qui marquent.",
      statut: "perdu",
      likes: [],
      reposts: [],
      sauvegardes: [],
      commentaires: [],
      date: "2026-06-26T09:00:00",
    },
  ],

  /* ---- NOTIFICATIONS ----------------------------------------------------- */
  notifications: [
    { id: "n1", type: "like", acteurId: "u_awa", cibleId: "p_018", texte: "a aimé votre pronostic", lu: false, date: "2026-07-08T09:30:00" },
    { id: "n2", type: "follow", acteurId: "u_kader", cibleId: null, texte: "a commencé à vous suivre", lu: false, date: "2026-07-08T08:45:00" },
    { id: "n3", type: "comment", acteurId: "u_serge", cibleId: "p_018", texte: "a commenté votre pronostic", lu: false, date: "2026-07-08T07:15:00" },
    { id: "n4", type: "gagne", acteurId: null, cibleId: "p_019", texte: "Votre pronostic Metz–Lille est GAGNÉ ! 🟢", lu: true, date: "2026-06-29T17:00:00" },
    { id: "n5", type: "repost", acteurId: "u_awa", cibleId: "p_019", texte: "a reposté votre pronostic", lu: true, date: "2026-06-29T18:00:00" },
    { id: "n6", type: "badge", acteurId: null, cibleId: null, texte: "Vous avez atteint le badge Argent 🥈 !", lu: true, date: "2026-06-25T12:00:00" },
  ],

  /* ---- TENDANCES (hashtags) --------------------------------------------- */
  tendances: [
    { tag: "CAN", posts: 1240, contexte: "Football • Afrique" },
    { tag: "Ligue1", posts: 860, contexte: "Football • France" },
    { tag: "ChampionsLeague", posts: 2130, contexte: "Football • Europe" },
    { tag: "PremierLeague", posts: 1780, contexte: "Football • Angleterre" },
    { tag: "Éléphants", posts: 540, contexte: "Côte d'Ivoire 🇨🇮" },
  ],

  /* ---- DÉFIS / BATTLES --------------------------------------------------- */
  battles: [
    { id: "b1", aId: "u_kader", bId: "u_awa", journee: "Journée CAN", scoreA: 3, scoreB: 2, statut: "en_cours" },
    { id: "b2", aId: "u_serge", bId: "u_yao", journee: "Multi-ligues", scoreA: 4, scoreB: 4, statut: "en_cours" },
  ],
};

/* -----------------------------------------------------------------------------
 *  FONCTIONS API FACTICES (async)
 *  >>> Chacune correspondra à un endpoint REST PHP. <<<
 * --------------------------------------------------------------------------- */

/**
 * GET /api/feed
 * Renvoie le fil de pronostics des comptes suivis + le compte courant,
 * trié du plus récent au plus ancien.
 */
async function getFeed() {
  await wait();
  const me = getCurrentUserSync();
  const visibles = new Set([me.id, ...me.abonnements]);
  return mockData.predictions
    .filter((p) => visibles.has(p.auteurId))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * GET /api/feed/all — Fil « Exploration » (tous les pronostics publics).
 */
async function getAllPredictions() {
  await wait();
  return [...mockData.predictions].sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * GET /api/users/{id}
 */
async function getUser(id) {
  await wait();
  return mockData.users.find((u) => u.id === id) || null;
}

/**
 * GET /api/users — tous les utilisateurs (pour recherche / classement).
 */
async function getAllUsers() {
  await wait();
  return [...mockData.users];
}

/**
 * GET /api/users/{id}/predictions?filter=tous|en_cours|gagne|perdu|analyses|likes
 */
async function getUserPredictions(id, filter = "tous") {
  await wait();
  let list = mockData.predictions.filter((p) => p.auteurId === id);
  switch (filter) {
    case "en_cours":
      list = list.filter((p) => p.statut === "en_cours");
      break;
    case "gagne":
      list = list.filter((p) => p.statut === "gagne");
      break;
    case "perdu":
      list = list.filter((p) => p.statut === "perdu");
      break;
    case "analyses":
      // Les « analyses » : pronostics avec un argumentaire fourni (> 120 caractères).
      list = list.filter((p) => (p.analyse || "").length > 120);
      break;
    case "likes":
      // Pronostics likés par l'utilisateur (tous auteurs confondus).
      list = mockData.predictions.filter((p) => p.likes.includes(id));
      break;
    default:
      break; // 'tous'
  }
  return list.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * GET /api/predictions/{id}
 */
async function getPrediction(id) {
  await wait();
  return mockData.predictions.find((p) => p.id === id) || null;
}

/**
 * POST /api/predictions
 * Crée un pronostic et l'insère en tête de liste.
 */
async function createPrediction(data) {
  await wait();
  const pred = {
    id: nextId("p"),
    auteurId: mockData.currentUserId,
    match: data.match,
    typePari: data.typePari,
    choix: data.choix,
    cote: data.cote,
    confiance: data.confiance,
    premium: !!data.premium,
    analyse: data.analyse,
    statut: "en_cours",
    likes: [],
    reposts: [],
    sauvegardes: [],
    commentaires: [],
    date: new Date().toISOString(),
  };
  mockData.predictions.unshift(pred);
  return pred;
}

/**
 * POST /api/users/{id}/follow — bascule suivre / ne plus suivre.
 * Renvoie le nouvel état (suivi: bool).
 */
async function toggleFollow(id) {
  await wait(60);
  const me = getCurrentUserSync();
  const cible = mockData.users.find((u) => u.id === id);
  if (!cible || id === me.id) return { suivi: false };
  const i = me.abonnements.indexOf(id);
  if (i >= 0) {
    me.abonnements.splice(i, 1);
    const j = cible.abonnes.indexOf(me.id);
    if (j >= 0) cible.abonnes.splice(j, 1);
    return { suivi: false };
  } else {
    me.abonnements.push(id);
    cible.abonnes.push(me.id);
    return { suivi: true };
  }
}

/**
 * POST /api/predictions/{id}/like — bascule le like.
 */
async function likePrediction(id) {
  await wait(50);
  const p = mockData.predictions.find((x) => x.id === id);
  if (!p) return null;
  const me = mockData.currentUserId;
  const i = p.likes.indexOf(me);
  if (i >= 0) p.likes.splice(i, 1);
  else p.likes.push(me);
  return p;
}

/**
 * POST /api/predictions/{id}/repost — bascule le repost.
 */
async function repostPrediction(id) {
  await wait(50);
  const p = mockData.predictions.find((x) => x.id === id);
  if (!p) return null;
  const me = mockData.currentUserId;
  const i = p.reposts.indexOf(me);
  if (i >= 0) p.reposts.splice(i, 1);
  else p.reposts.push(me);
  return p;
}

/**
 * POST /api/predictions/{id}/save — bascule la sauvegarde (signet).
 */
async function savePrediction(id) {
  await wait(50);
  const p = mockData.predictions.find((x) => x.id === id);
  if (!p) return null;
  const me = mockData.currentUserId;
  const i = p.sauvegardes.indexOf(me);
  if (i >= 0) p.sauvegardes.splice(i, 1);
  else p.sauvegardes.push(me);
  return p;
}

/**
 * POST /api/predictions/{id}/comments
 */
async function addComment(id, texte) {
  await wait(60);
  const p = mockData.predictions.find((x) => x.id === id);
  if (!p) return null;
  const c = { id: nextId("c"), auteurId: mockData.currentUserId, texte, date: new Date().toISOString() };
  p.commentaires.push(c);
  return c;
}

/**
 * PATCH /api/predictions/{id}/resolve — résolution simulée (démo).
 * Côté serveur : géré par un job / résultat officiel du match.
 */
async function resolvePrediction(id, resultat) {
  await wait(60);
  const p = mockData.predictions.find((x) => x.id === id);
  if (!p) return null;
  p.statut = resultat; // 'gagne' | 'perdu' | 'annule'
  return p;
}

/**
 * GET /api/leaderboard?period=week|month
 * Le tri par TrustScore est calculé côté client (voir app.js) car il dépend de
 * l'algorithme. En production, le score serait pré-calculé et stocké en base.
 */
async function getLeaderboard(period = "week") {
  await wait();
  // On renvoie simplement les utilisateurs ; app.js calcule et trie par TrustScore.
  return { period, users: [...mockData.users] };
}

/**
 * GET /api/notifications
 */
async function getNotifications() {
  await wait();
  return [...mockData.notifications].sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * GET /api/battles — défis en cours.
 */
async function getBattles() {
  await wait();
  return [...mockData.battles];
}

/**
 * GET /api/trends — tendances / hashtags.
 */
async function getTrends() {
  await wait();
  return [...mockData.tendances];
}

/* -----------------------------------------------------------------------------
 *  Helpers synchrones (utilitaires internes, non exposés comme endpoints).
 * --------------------------------------------------------------------------- */
function getCurrentUserSync() {
  return mockData.users.find((u) => u.id === mockData.currentUserId);
}

// Expose l'ensemble de l'« API » sur window pour app.js (pas de bundler).
window.API = {
  mockData,
  getFeed,
  getAllPredictions,
  getUser,
  getAllUsers,
  getUserPredictions,
  getPrediction,
  createPrediction,
  toggleFollow,
  likePrediction,
  repostPrediction,
  savePrediction,
  addComment,
  resolvePrediction,
  getLeaderboard,
  getNotifications,
  getBattles,
  getTrends,
  getCurrentUserSync,
};
