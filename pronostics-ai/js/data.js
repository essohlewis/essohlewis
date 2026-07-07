/* =====================================================================
   data.js — Couche de données (simulation IA)
   ---------------------------------------------------------------------
   ⚠️  POINT DE BRANCHEMENT API RÉELLE ⚠️
   Cette couche est volontairement isolée. Pour brancher un vrai backend
   ou une API de données sportives + moteur d'IA, il suffit de remplacer
   le contenu de `fetchPredictions()` par un vrai `fetch()` (voir plus bas)
   en conservant la même forme d'objet retourné.
   ===================================================================== */

/* Métadonnées des équipes (couleur de logo + initiales).
   Dans une vraie intégration, remplacer par des URLs de logos réels. */
const TEAM_META = {
  // Europe
  'Manchester City': { c: '#6CABDD', i: 'MCI' }, 'Arsenal': { c: '#EF0107', i: 'ARS' },
  'Liverpool': { c: '#C8102E', i: 'LIV' }, 'Chelsea': { c: '#034694', i: 'CHE' },
  'Real Madrid': { c: '#FEBE10', i: 'RMA' }, 'FC Barcelone': { c: '#A50044', i: 'BAR' },
  'Atlético Madrid': { c: '#CB3524', i: 'ATM' }, 'Paris SG': { c: '#004170', i: 'PSG' },
  'Marseille': { c: '#2FAEE0', i: 'OM' }, 'Inter Milan': { c: '#010E80', i: 'INT' },
  'Juventus': { c: '#000000', i: 'JUV' }, 'AC Milan': { c: '#FB090B', i: 'MIL' },
  'Bayern Munich': { c: '#DC052D', i: 'BAY' }, 'Dortmund': { c: '#FDE100', i: 'BVB' },
  // Afrique
  'Al Ahly': { c: '#C8102E', i: 'AHL' }, 'Espérance Tunis': { c: '#D4141C', i: 'EST' },
  'Mamelodi Sundowns': { c: '#F9D616', i: 'SUN' }, 'Wydad Casablanca': { c: '#E30613', i: 'WAC' },
  'TP Mazembe': { c: '#000000', i: 'TPM' }, 'ASEC Mimosas': { c: '#FCD116', i: 'ASE' },
  // Amérique
  'Boca Juniors': { c: '#0A2472', i: 'BOC' }, 'River Plate': { c: '#E2231A', i: 'RIV' },
  'Flamengo': { c: '#C52613', i: 'FLA' }, 'Palmeiras': { c: '#006437', i: 'PAL' },
  'LA Lakers': { c: '#552583', i: 'LAL' }, 'Boston Celtics': { c: '#007A33', i: 'BOS' },
  'Golden State': { c: '#1D428A', i: 'GSW' }, 'Miami Heat': { c: '#98002E', i: 'MIA' },
  // Asie
  'Al Hilal': { c: '#0B4EA2', i: 'HIL' }, 'Al Nassr': { c: '#F9D616', i: 'NAS' },
  'Urawa Reds': { c: '#E60012', i: 'URA' }, 'Kawasaki': { c: '#0A5AA0', i: 'KAW' },
  'Mumbai Indians': { c: '#004BA0', i: 'MI' }, 'Chennai SK': { c: '#FDB913', i: 'CSK' },
};

/* Compétitions par région (drapeau en emoji-svg simplifié via couleur) */
const LEAGUES = [
  { id: 'pl', name: 'Premier League', region: 'europe', sport: 'football', flag: '🏴' },
  { id: 'liga', name: 'La Liga', region: 'europe', sport: 'football', flag: '🇪🇸' },
  { id: 'l1', name: 'Ligue 1', region: 'europe', sport: 'football', flag: '🇫🇷' },
  { id: 'seriea', name: 'Serie A', region: 'europe', sport: 'football', flag: '🇮🇹' },
  { id: 'bundes', name: 'Bundesliga', region: 'europe', sport: 'football', flag: '🇩🇪' },
  { id: 'caf', name: 'CAF Champions League', region: 'afrique', sport: 'football', flag: '🌍' },
  { id: 'libertadores', name: 'Copa Libertadores', region: 'amerique', sport: 'football', flag: '🌎' },
  { id: 'nba', name: 'NBA', region: 'amerique', sport: 'basketball', flag: '🇺🇸' },
  { id: 'saudi', name: 'Saudi Pro League', region: 'asie', sport: 'football', flag: '🇸🇦' },
  { id: 'jleague', name: 'J-League', region: 'asie', sport: 'football', flag: '🇯🇵' },
  { id: 'ipl', name: 'Indian Premier League', region: 'asie', sport: 'cricket', flag: '🇮🇳' },
];

/* Modèle brut des matchs — l'"IA" en dérive des pronostics. */
const FIXTURES = [
  { league: 'pl', home: 'Manchester City', away: 'Arsenal' },
  { league: 'pl', home: 'Liverpool', away: 'Chelsea' },
  { league: 'liga', home: 'Real Madrid', away: 'FC Barcelone' },
  { league: 'liga', home: 'Atlético Madrid', away: 'FC Barcelone' },
  { league: 'l1', home: 'Paris SG', away: 'Marseille' },
  { league: 'seriea', home: 'Inter Milan', away: 'Juventus' },
  { league: 'seriea', home: 'AC Milan', away: 'Juventus' },
  { league: 'bundes', home: 'Bayern Munich', away: 'Dortmund' },
  { league: 'caf', home: 'Al Ahly', away: 'Espérance Tunis' },
  { league: 'caf', home: 'Mamelodi Sundowns', away: 'Wydad Casablanca' },
  { league: 'caf', home: 'TP Mazembe', away: 'ASEC Mimosas' },
  { league: 'libertadores', home: 'Boca Juniors', away: 'River Plate' },
  { league: 'libertadores', home: 'Flamengo', away: 'Palmeiras' },
  { league: 'nba', home: 'LA Lakers', away: 'Boston Celtics' },
  { league: 'nba', home: 'Golden State', away: 'Miami Heat' },
  { league: 'saudi', home: 'Al Hilal', away: 'Al Nassr' },
  { league: 'jleague', home: 'Urawa Reds', away: 'Kawasaki' },
  { league: 'ipl', home: 'Mumbai Indians', away: 'Chennai SK' },
];

/* Types de prédiction possibles selon le sport (l'"IA" en choisit un). */
const PRED_TYPES = {
  football: [
    { key: 'home_win', fr: 'Victoire à domicile', en: 'Home win' },
    { key: 'away_win', fr: 'Victoire extérieure', en: 'Away win' },
    { key: 'over25', fr: 'Plus de 2,5 buts', en: 'Over 2.5 goals' },
    { key: 'btts', fr: 'Les deux marquent', en: 'Both teams to score' },
    { key: 'draw', fr: 'Match nul', en: 'Draw' },
  ],
  basketball: [
    { key: 'home_win', fr: 'Victoire domicile', en: 'Home win' },
    { key: 'away_win', fr: 'Victoire extérieure', en: 'Away win' },
    { key: 'over_pts', fr: 'Plus de 220,5 points', en: 'Over 220.5 points' },
  ],
  cricket: [
    { key: 'home_win', fr: 'Victoire domicile', en: 'Home win' },
    { key: 'away_win', fr: 'Victoire extérieure', en: 'Away win' },
  ],
};

/* Fragments d'analyse "IA" — recomposés dynamiquement. */
const ANALYSIS_BITS = {
  fr: [
    'Forme récente solide (4 victoires sur 5).',
    'Avantage historique lors des confrontations directes.',
    'Attaque en feu : 2,4 buts marqués en moyenne.',
    'Défense adverse fragilisée par les absences.',
    'Facteur domicile déterminant cette saison.',
    'Cote sous-évaluée selon notre modèle probabiliste.',
    'Momentum offensif confirmé par les données xG.',
    'Rotation d\'effectif favorable au repos.',
  ],
  en: [
    'Strong recent form (4 wins in 5).',
    'Historical edge in head-to-head meetings.',
    'Attack on fire: 2.4 goals scored on average.',
    'Opponent defence weakened by absences.',
    'Home advantage decisive this season.',
    'Odds undervalued per our probabilistic model.',
    'Offensive momentum confirmed by xG data.',
    'Favourable squad rotation and rest.',
  ],
};

/* --- Helpers pseudo-aléatoires déterministes par jour ---
   On seed avec la date pour que les "pronostics du jour" restent
   stables sur une même journée (comportement réaliste). */
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function dateSeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function leagueById(id) { return LEAGUES.find((l) => l.id === id); }
function teamMeta(name) { return TEAM_META[name] || { c: '#6C5CE7', i: name.slice(0, 3).toUpperCase() }; }

/* Génère la liste complète des pronostics du jour. */
function generatePredictions() {
  const rand = seededRandom(dateSeed());
  const now = Date.now();

  return FIXTURES.map((fx, idx) => {
    const league = leagueById(fx.league);
    const types = PRED_TYPES[league.sport] || PRED_TYPES.football;
    const type = types[Math.floor(rand() * types.length)];

    // Niveau de confiance IA : 58–96 %
    const confidence = Math.round(58 + rand() * 38);
    // Cote estimée corrélée (confiance haute => cote basse)
    const odds = (1.35 + (100 - confidence) / 42 + rand() * 0.4).toFixed(2);

    // Heure de coup d'envoi répartie sur la journée
    const kickoff = new Date();
    kickoff.setHours(13 + Math.floor(rand() * 9), Math.floor(rand() * 6) * 10, 0, 0);

    // Statut : quelques matchs passés (résolus), un LIVE, le reste à venir
    let status = 'upcoming';
    if (idx < 5) {
      status = rand() > (confidence / 100) ? 'lost' : 'won'; // résolus selon la confiance
      kickoff.setDate(kickoff.getDate() - (idx % 3) - 1);
    } else if (idx === 5) {
      status = 'live';
      kickoff.setHours(new Date().getHours(), 0, 0, 0);
    }

    // Analyse composée de 2 fragments
    const bitsFr = ANALYSIS_BITS.fr, bitsEn = ANALYSIS_BITS.en;
    const a1 = Math.floor(rand() * bitsFr.length);
    let a2 = Math.floor(rand() * bitsFr.length); if (a2 === a1) a2 = (a2 + 1) % bitsFr.length;

    return {
      id: 'p' + idx,
      league: league.name,
      leagueId: league.id,
      region: league.region,
      sport: league.sport,
      flag: league.flag,
      home: fx.home,
      away: fx.away,
      homeMeta: teamMeta(fx.home),
      awayMeta: teamMeta(fx.away),
      kickoff: kickoff.toISOString(),
      prediction: type,          // { key, fr, en }
      confidence,
      odds,
      analysis: { fr: `${bitsFr[a1]} ${bitsFr[a2]}`, en: `${bitsEn[a1]} ${bitsEn[a2]}` },
      status,                    // upcoming | live | won | lost
      premium: confidence > 80 && idx > 2, // pronostics à forte confiance = premium
    };
  }).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
}

/* ---------------------------------------------------------------------
   fetchPredictions() — Promise simulant un appel réseau.
   👉 Pour brancher une vraie API, remplacer par :
      return fetch('https://api.votre-backend.com/predictions')
               .then(r => r.json());
   en s'assurant que la réponse respecte la même forme d'objet ci-dessus.
   --------------------------------------------------------------------- */
function fetchPredictions() {
  return new Promise((resolve) => {
    // Latence réseau simulée (400–900 ms)
    const delay = 400 + Math.random() * 500;
    setTimeout(() => resolve(generatePredictions()), delay);
  });
}

/* Statistiques agrégées de la plateforme (pour la landing / dashboard).
   👉 À remplacer par un endpoint /stats réel. */
function fetchPlatformStats() {
  return Promise.resolve({
    winRate: 87,
    predictionsPerDay: 42,
    activeMembers: 12840,
    monthlyRoi: 23,
  });
}

/* Historique de performance (12 derniers points) pour le graphique. */
function fetchPerformanceSeries() {
  const rand = seededRandom(dateSeed() + 7);
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  return Promise.resolve(
    months.map((m, i) => ({ label: m, value: Math.round(72 + rand() * 20 + i * 0.4) }))
  );
}

// Exposition globale (pas de bundler → variables globales contrôlées)
window.PronosData = { fetchPredictions, fetchPlatformStats, fetchPerformanceSeries, LEAGUES };
