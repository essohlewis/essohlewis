/* =====================================================================
   SAMSON BOUTIQUE — Catalogue produits (données statiques)
   ---------------------------------------------------------------------
   100% front-end : ce fichier tient lieu de "base de données".
   Chaque produit suit un schéma stable, prêt à être servi par une API.
   Les visuels sont générés en SVG (voir SB.image) → aucune dépendance
   externe, fonctionne hors-ligne (PWA).
   ===================================================================== */

/* Barème de livraison par zone (paramétrable) — en FCFA */
const SB_LIVRAISON = {
  seuilGratuit: 50000, // livraison offerte au-delà de ce montant
  zones: {
    'cocody':      { label: 'Cocody',      prix: 1000 },
    'plateau':     { label: 'Plateau',     prix: 1000 },
    'marcory':     { label: 'Marcory',     prix: 1000 },
    'yopougon':    { label: 'Yopougon',    prix: 1500 },
    'treichville': { label: 'Treichville', prix: 1500 },
    'abobo':       { label: 'Abobo',       prix: 1500 },
    'koumassi':    { label: 'Koumassi',    prix: 1500 },
    'port-bouet':  { label: 'Port-Bouët',  prix: 1500 },
    'adjame':      { label: 'Adjamé',      prix: 1500 },
    'attecoube':   { label: 'Attécoubé',   prix: 1500 },
    'bingerville': { label: 'Bingerville', prix: 1500 },
    'interieur':   { label: 'Intérieur du pays', prix: 2500 }
  }
};

/* Codes promo validés côté front */
const SB_PROMOS = {
  'SAMSON10':   { type: 'pourcentage', valeur: 10, label: '-10% sur votre commande' },
  'BIENVENUE':  { type: 'pourcentage', valeur: 15, label: '-15% première commande' },
  'LIVRAISON0': { type: 'livraison',   valeur: 0,  label: 'Livraison offerte' }
};

/* Catégories (clé, libellé, icône SVG, dégradé) */
const SB_CATEGORIES = [
  { id: 'musculation', nom: 'Musculation',            icone: '🏋️', grad: ['#FF6B00', '#E65100'] },
  { id: 'cardio',      nom: 'Cardio',                 icone: '🏃', grad: ['#FF8A3D', '#FF6B00'] },
  { id: 'fitness',     nom: 'Fitness / Yoga',         icone: '🧘', grad: ['#FFA05C', '#E65100'] },
  { id: 'accessoires', nom: 'Accessoires',            icone: '🎒', grad: ['#FF6B00', '#C43E00'] },
  { id: 'nutrition',   nom: 'Nutrition',              icone: '🥤', grad: ['#FF7A1A', '#E65100'] },
  { id: 'vetements',   nom: 'Vêtements & Textile',    icone: '👕', grad: ['#FF9142', '#E65100'] },
  { id: 'equipement',  nom: 'Équipement de salle',    icone: '🏗️', grad: ['#FF6B00', '#B33800'] }
];

/* Jeu de produits (24) réparti dans toutes les catégories */
const SB_PRODUITS = [
  {
    id: 'sb-001', nom: 'Haltères ajustables 20 kg', categorie: 'musculation', marque: 'SAMSON',
    prix: 45000, prixPromo: 39000, note: 4.7, avisCount: 34, stock: 12,
    badges: ['Meilleure vente'], emoji: '🏋️', couleurs: ['Noir', 'Gris'], tailles: [],
    description: "Une paire d'haltères ajustables de 2 à 20 kg par côté, idéale pour l'entraînement à domicile. Le système de réglage rapide permet de changer de charge en quelques secondes.",
    caracteristiques: ['Poids ajustable 2 à 20 kg', 'Revêtement anti-choc', 'Molette de réglage rapide', 'Compact et gain de place']
  },
  {
    id: 'sb-002', nom: 'Barre olympique 20 kg', categorie: 'musculation', marque: 'IRONFORCE',
    prix: 85000, prixPromo: null, note: 4.9, avisCount: 21, stock: 6,
    badges: ['Pro'], emoji: '🏋️', couleurs: ['Chrome'], tailles: ['2,2 m'],
    description: "Barre olympique professionnelle en acier chromé, capacité 300 kg. Roulements à aiguilles pour une rotation fluide.",
    caracteristiques: ['Acier chromé haute résistance', 'Capacité 300 kg', 'Diamètre 28 mm', 'Roulements à aiguilles']
  },
  {
    id: 'sb-003', nom: 'Kettlebell 16 kg', categorie: 'musculation', marque: 'SAMSON',
    prix: 22000, prixPromo: 18500, note: 4.6, avisCount: 48, stock: 20,
    badges: ['Promo'], emoji: '🔔', couleurs: ['Noir'], tailles: ['8 kg', '12 kg', '16 kg', '24 kg'],
    description: "Kettlebell en fonte revêtue, poignée large et lisse pour les mouvements balistiques. Base plate anti-roulement.",
    caracteristiques: ['Fonte pleine revêtue', 'Poignée ergonomique', 'Base plate stable', 'Marquage du poids']
  },
  {
    id: 'sb-004', nom: 'Banc de musculation inclinable', categorie: 'musculation', marque: 'SAMSON',
    prix: 120000, prixPromo: 99000, note: 4.8, avisCount: 17, stock: 4,
    badges: ['Meilleure vente', 'Stock limité'], emoji: '🛋️', couleurs: ['Noir/Orange'], tailles: [],
    description: "Banc réglable 7 positions (décliné à incliné), structure acier renforcée. Parfait pour développé couché, incliné et exercices d'isolation.",
    caracteristiques: ['7 positions de dossier', 'Structure acier renforcée', 'Charge max 300 kg', 'Mousse haute densité']
  },
  {
    id: 'sb-005', nom: 'Disques olympiques 2 × 10 kg', categorie: 'musculation', marque: 'IRONFORCE',
    prix: 38000, prixPromo: null, note: 4.5, avisCount: 12, stock: 15,
    badges: [], emoji: '⚫', couleurs: ['Noir'], tailles: ['2×5 kg', '2×10 kg', '2×20 kg'],
    description: "Paire de disques olympiques bumper en caoutchouc, alésage 50 mm. Rebond contrôlé pour l'haltérophilie.",
    caracteristiques: ['Caoutchouc bumper', 'Alésage 50 mm', 'Rebond contrôlé', 'Vendus par paire']
  },
  {
    id: 'sb-006', nom: 'Tapis de course pliable', categorie: 'cardio', marque: 'RUNMAX',
    prix: 320000, prixPromo: 289000, note: 4.4, avisCount: 9, stock: 3,
    badges: ['Nouveau', 'Stock limité'], emoji: '🏃', couleurs: ['Noir'], tailles: [],
    description: "Tapis de course motorisé pliable, vitesse jusqu'à 14 km/h, 12 programmes d'entraînement et écran LCD.",
    caracteristiques: ['Moteur 2,5 CV', 'Vitesse 1 à 14 km/h', '12 programmes', 'Pliable, roulettes de transport']
  },
  {
    id: 'sb-007', nom: 'Vélo d\'appartement magnétique', categorie: 'cardio', marque: 'RUNMAX',
    prix: 175000, prixPromo: null, note: 4.6, avisCount: 14, stock: 7,
    badges: [], emoji: '🚲', couleurs: ['Noir/Orange'], tailles: [],
    description: "Vélo d'appartement à résistance magnétique 8 niveaux, selle réglable et ordinateur de bord.",
    caracteristiques: ['Résistance magnétique 8 niveaux', 'Volant d\'inertie 6 kg', 'Selle réglable', 'Capteur de pouls']
  },
  {
    id: 'sb-008', nom: 'Corde à sauter lestée', categorie: 'cardio', marque: 'SAMSON',
    prix: 8000, prixPromo: 6500, note: 4.7, avisCount: 62, stock: 40,
    badges: ['Promo', 'Meilleure vente'], emoji: '🪢', couleurs: ['Noir', 'Orange'], tailles: [],
    description: "Corde à sauter avec poignées lestées amovibles et câble en acier gainé. Roulements à billes pour une rotation rapide.",
    caracteristiques: ['Poignées lestées amovibles', 'Câble acier gainé', 'Roulements à billes', 'Longueur ajustable']
  },
  {
    id: 'sb-009', nom: 'Rameur pliable', categorie: 'cardio', marque: 'RUNMAX',
    prix: 245000, prixPromo: 219000, note: 4.5, avisCount: 8, stock: 5,
    badges: ['Nouveau'], emoji: '🚣', couleurs: ['Noir'], tailles: [],
    description: "Rameur à résistance hydraulique, 12 niveaux, écran multifonction. Se plie pour un rangement facile.",
    caracteristiques: ['Résistance hydraulique 12 niveaux', 'Écran multifonction', 'Pliable', 'Siège coulissant confortable']
  },
  {
    id: 'sb-010', nom: 'Tapis de yoga premium', categorie: 'fitness', marque: 'SAMSON',
    prix: 15000, prixPromo: 12000, note: 4.8, avisCount: 55, stock: 30,
    badges: ['Promo'], emoji: '🧘', couleurs: ['Violet', 'Noir', 'Turquoise'], tailles: ['6 mm'],
    description: "Tapis de yoga antidérapant 6 mm en TPE écologique. Double face texturée, sangle de transport incluse.",
    caracteristiques: ['TPE écologique', 'Épaisseur 6 mm', 'Antidérapant double face', 'Sangle de transport']
  },
  {
    id: 'sb-011', nom: 'Bandes élastiques (set de 5)', categorie: 'fitness', marque: 'SAMSON',
    prix: 12000, prixPromo: null, note: 4.6, avisCount: 41, stock: 25,
    badges: ['Meilleure vente'], emoji: '➰', couleurs: ['Multicolore'], tailles: [],
    description: "Set de 5 bandes de résistance (5 à 25 kg) en latex naturel, avec poignées, ancrage de porte et sac.",
    caracteristiques: ['5 niveaux de résistance', 'Latex naturel', 'Poignées + ancrage porte', 'Sac de rangement']
  },
  {
    id: 'sb-012', nom: 'Swiss ball 65 cm', categorie: 'fitness', marque: 'SAMSON',
    prix: 10000, prixPromo: 8000, note: 4.5, avisCount: 33, stock: 18,
    badges: ['Promo'], emoji: '⚪', couleurs: ['Gris', 'Orange'], tailles: ['55 cm', '65 cm', '75 cm'],
    description: "Ballon de gym anti-éclatement 65 cm, charge 300 kg. Pompe à main incluse.",
    caracteristiques: ['Anti-éclatement', 'Charge 300 kg', 'Surface antidérapante', 'Pompe incluse']
  },
  {
    id: 'sb-013', nom: 'Roue abdominale double', categorie: 'fitness', marque: 'SAMSON',
    prix: 9000, prixPromo: null, note: 4.4, avisCount: 27, stock: 22,
    badges: [], emoji: '⚙️', couleurs: ['Noir/Orange'], tailles: [],
    description: "Roue abdominale à double roulette pour un gainage stable. Poignées antidérapantes, tapis genoux inclus.",
    caracteristiques: ['Double roue stable', 'Poignées antidérapantes', 'Tapis genoux inclus', 'Renforce le core']
  },
  {
    id: 'sb-014', nom: 'Gants de musculation', categorie: 'accessoires', marque: 'SAMSON',
    prix: 7000, prixPromo: 5500, note: 4.6, avisCount: 58, stock: 35,
    badges: ['Promo'], emoji: '🧤', couleurs: ['Noir', 'Orange'], tailles: ['S', 'M', 'L', 'XL'],
    description: "Gants de musculation avec sangles de poignet, paume renforcée et dos respirant. Protègent des ampoules.",
    caracteristiques: ['Sangles de poignet', 'Paume renforcée', 'Dos respirant', 'Bonne accroche']
  },
  {
    id: 'sb-015', nom: 'Ceinture de force cuir', categorie: 'accessoires', marque: 'IRONFORCE',
    prix: 25000, prixPromo: null, note: 4.8, avisCount: 19, stock: 10,
    badges: ['Pro'], emoji: '🥋', couleurs: ['Marron', 'Noir'], tailles: ['M', 'L', 'XL'],
    description: "Ceinture de force en cuir véritable 10 mm, boucle double ardillon. Maintien lombaire optimal pour les charges lourdes.",
    caracteristiques: ['Cuir véritable 10 mm', 'Boucle double ardillon', 'Largeur 10 cm', 'Maintien lombaire']
  },
  {
    id: 'sb-016', nom: 'Gourde isotherme 1 L', categorie: 'accessoires', marque: 'SAMSON',
    prix: 9000, prixPromo: 7500, note: 4.7, avisCount: 44, stock: 50,
    badges: ['Promo'], emoji: '🧴', couleurs: ['Noir', 'Orange', 'Blanc'], tailles: ['750 ml', '1 L'],
    description: "Gourde isotherme inox double paroi, garde le froid 24 h et le chaud 12 h. Bouchon anti-fuite.",
    caracteristiques: ['Inox double paroi', 'Froid 24 h / chaud 12 h', 'Bouchon anti-fuite', 'Sans BPA']
  },
  {
    id: 'sb-017', nom: 'Sac de sport SAMSON', categorie: 'accessoires', marque: 'SAMSON',
    prix: 28000, prixPromo: 22000, note: 4.6, avisCount: 23, stock: 14,
    badges: ['Nouveau', 'Promo'], emoji: '🎒', couleurs: ['Noir', 'Orange'], tailles: [],
    description: "Sac de sport 45 L avec compartiment chaussures ventilé, poche humide et bandoulière ajustable.",
    caracteristiques: ['Volume 45 L', 'Compartiment chaussures', 'Poche humide séparée', 'Tissu résistant à l\'eau']
  },
  {
    id: 'sb-018', nom: 'Whey protéine 2 kg — Vanille', categorie: 'nutrition', marque: 'SAMSON NUTRITION',
    prix: 35000, prixPromo: 29900, note: 4.8, avisCount: 76, stock: 28,
    badges: ['Meilleure vente', 'Promo'], emoji: '🥛', couleurs: [], tailles: ['1 kg', '2 kg'],
    saveurs: ['Vanille', 'Chocolat', 'Fraise'],
    description: "Whey protéine concentrée 24 g de protéines par dose, faible en sucre. Idéale après l'entraînement.",
    caracteristiques: ['24 g de protéines / dose', 'Faible en sucre', 'Bonne solubilité', '~66 portions (2 kg)']
  },
  {
    id: 'sb-019', nom: 'BCAA 2:1:1 — 300 g', categorie: 'nutrition', marque: 'SAMSON NUTRITION',
    prix: 22000, prixPromo: null, note: 4.5, avisCount: 31, stock: 20,
    badges: [], emoji: '💊', couleurs: [], tailles: ['300 g'], saveurs: ['Citron', 'Pastèque'],
    description: "Acides aminés BCAA ratio 2:1:1 pour soutenir la récupération et limiter le catabolisme musculaire.",
    caracteristiques: ['Ratio 2:1:1', 'Récupération musculaire', 'Se dissout facilement', '~30 portions']
  },
  {
    id: 'sb-020', nom: 'Shaker 700 ml', categorie: 'nutrition', marque: 'SAMSON',
    prix: 5000, prixPromo: 3500, note: 4.6, avisCount: 89, stock: 60,
    badges: ['Promo', 'Meilleure vente'], emoji: '🥤', couleurs: ['Noir', 'Orange', 'Transparent'], tailles: ['700 ml'],
    description: "Shaker avec bille mélangeuse inox et graduations. Sans BPA, couvercle anti-fuite à vis.",
    caracteristiques: ['Bille mélangeuse inox', 'Sans BPA', 'Couvercle anti-fuite', 'Graduations claires']
  },
  {
    id: 'sb-021', nom: 'T-shirt technique SAMSON', categorie: 'vetements', marque: 'SAMSON',
    prix: 12000, prixPromo: 9000, note: 4.7, avisCount: 52, stock: 45,
    badges: ['Promo'], emoji: '👕', couleurs: ['Noir', 'Orange', 'Blanc'], tailles: ['S', 'M', 'L', 'XL', 'XXL'],
    description: "T-shirt de sport respirant à séchage rapide, coupe ajustée et logo SAMSON. Tissu anti-transpirant.",
    caracteristiques: ['Tissu respirant', 'Séchage rapide', 'Coupe ajustée', 'Logo SAMSON floqué']
  },
  {
    id: 'sb-022', nom: 'Brassière de sport', categorie: 'vetements', marque: 'SAMSON',
    prix: 14000, prixPromo: null, note: 4.6, avisCount: 38, stock: 26,
    badges: ['Nouveau'], emoji: '🎽', couleurs: ['Noir', 'Orange', 'Rose'], tailles: ['S', 'M', 'L', 'XL'],
    description: "Brassière de sport maintien moyen, tissu extensible et coutures plates. Idéale fitness et cardio.",
    caracteristiques: ['Maintien moyen', 'Tissu extensible', 'Coutures plates', 'Sans armature']
  },
  {
    id: 'sb-023', nom: 'Short de training', categorie: 'vetements', marque: 'SAMSON',
    prix: 13000, prixPromo: 10500, note: 4.5, avisCount: 29, stock: 33,
    badges: ['Promo'], emoji: '🩳', couleurs: ['Noir', 'Gris', 'Orange'], tailles: ['S', 'M', 'L', 'XL'],
    description: "Short de training léger avec poches zippées et taille élastique. Liberté de mouvement optimale.",
    caracteristiques: ['Tissu léger', 'Poches zippées', 'Taille élastique', 'Doublure intégrée']
  },
  {
    id: 'sb-024', nom: 'Rack à squat + station traction', categorie: 'equipement', marque: 'IRONFORCE',
    prix: 380000, prixPromo: 349000, note: 4.9, avisCount: 11, stock: 2,
    badges: ['Pro', 'Stock limité'], emoji: '🏗️', couleurs: ['Noir'], tailles: [],
    description: "Cage à squat robuste avec barre de traction, supports J réglables et sécurités. Base d'une home gym complète.",
    caracteristiques: ['Acier 50×50 mm', 'Barre de traction intégrée', 'Supports J + sécurités', 'Charge max 400 kg']
  }
];

/* Exposition globale (pas de bundler) */
window.SB_DATA = {
  produits: SB_PRODUITS,
  categories: SB_CATEGORIES,
  livraison: SB_LIVRAISON,
  promos: SB_PROMOS
};
