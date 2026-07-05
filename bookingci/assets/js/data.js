/* =====================================================================
 * BookingCI — data.js
 * Couche de données de démonstration + helpers partagés.
 *
 * En production, ces jeux de données seront remplacés par des appels
 * fetch() vers l'API backend (voir README.md, section "Intégration
 * backend"). On expose ici un namespace global `BookingCI` pour éviter
 * de polluer le scope global et faciliter la future migration.
 * ===================================================================== */

(function (global) {
  'use strict';

  /* ---------------------------------------------------------------
   * 1. Référentiels géographiques & catégories (Côte d'Ivoire)
   * ------------------------------------------------------------- */

  // Communes d'Abidjan + grandes villes de l'intérieur.
  const VILLES = [
    {
      id: 'abidjan',
      nom: 'Abidjan',
      communes: [
        'Cocody', 'Plateau', 'Marcory', 'Yopougon', 'Treichville',
        'Adjamé', 'Koumassi', 'Port-Bouët', 'Abobo', 'Attécoubé',
        'Riviera', 'Angré', 'Deux-Plateaux'
      ]
    },
    { id: 'bouake', nom: 'Bouaké', communes: ['Centre-ville', 'Air France', 'Belleville'] },
    { id: 'yamoussoukro', nom: 'Yamoussoukro', communes: ['Habitat', 'Millionnaire', 'Kokrenou'] },
    { id: 'san-pedro', nom: 'San-Pédro', communes: ['Balmer', 'Cité', 'Séweke'] }
  ];

  const TYPES_CUISINE = [
    'Ivoirienne', 'Maquis', 'Fast-food', 'Grillades', 'Fruits de mer',
    'Libanaise', 'Française', 'Asiatique', 'Végétarienne', 'Pâtisserie'
  ];

  const EQUIPEMENTS_RESIDENCE = [
    'Climatisation', 'Wi-Fi', 'Piscine', 'Parking', 'Groupe électrogène',
    'Cuisine équipée', 'Sécurité 24/7', 'Télévision', 'Balcon', 'Ascenseur'
  ];

  const MOYENS_PAIEMENT = [
    { id: 'orange', nom: 'Orange Money', couleur: '#FF6600' },
    { id: 'mtn', nom: 'MTN MoMo', couleur: '#FFCC00' },
    { id: 'moov', nom: 'Moov Money', couleur: '#0066B3' },
    { id: 'wave', nom: 'Wave', couleur: '#1DC8FF' }
  ];

  /* ---------------------------------------------------------------
   * 2. Générateur d'images placeholder (SVG data-URI)
   *
   * Objectif : un livrable 100% autonome (aucune dépendance réseau).
   * Les vraies photos des établissements seront déposées dans
   * /assets/images/ et servies par le backend. En attendant, on génère
   * une vignette dégradée cohérente avec la charte graphique.
   * ------------------------------------------------------------- */

  const PALETTES_IMG = [
    ['#E2603B', '#F2994A'], // terracotta -> orange
    ['#1F8A55', '#57B894'], // vert
    ['#C24E2E', '#E8A87C'], // brique
    ['#2A6F8E', '#6BB8C9'], // bleu lagune
    ['#B7791F', '#E9C46A']  // ocre
  ];

  function placeholder(label, seed, icone) {
    seed = seed || 0;
    const p = PALETTES_IMG[Math.abs(seed) % PALETTES_IMG.length];
    const txt = (label || 'BookingCI').slice(0, 22);
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + p[0] + '"/>' +
      '<stop offset="1" stop-color="' + p[1] + '"/></linearGradient></defs>' +
      '<rect width="640" height="420" fill="url(#g)"/>' +
      '<text x="40" y="360" font-family="Poppins,Arial,sans-serif" font-size="120" ' +
      'fill="rgba(255,255,255,0.28)" font-weight="700">' + (icone || '◍') + '</text>' +
      '<text x="40" y="230" font-family="Poppins,Arial,sans-serif" font-size="34" ' +
      'fill="#ffffff" font-weight="700">' + escapeXml(txt) + '</text>' +
      '<text x="40" y="270" font-family="Inter,Arial,sans-serif" font-size="20" ' +
      'fill="rgba(255,255,255,0.85)">BookingCI · Côte d\'Ivoire</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function escapeXml(s) {
    return String(s).replace(/[<>&'"]/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c];
    });
  }

  /* ---------------------------------------------------------------
   * 3. Jeux de données de démonstration
   * ------------------------------------------------------------- */

  const RESTAURANTS = [
    {
      id: 'r1', type: 'restaurant', nom: 'Le Maquis du Val',
      ville: 'Abidjan', commune: 'Cocody', cuisine: 'Ivoirienne',
      prix: 8000, note: 4.7, avis: 214, populaire: 96,
      description: "Le Maquis du Val revisite la cuisine ivoirienne traditionnelle dans un cadre verdoyant à Cocody. Attiéké poisson, kedjenou et alloco maison à l'honneur.",
      icone: '🍽️',
      equipements: ['Terrasse', 'Wi-Fi', 'Parking', 'Climatisation', 'Musique live'],
      horaires: '11h00 – 23h30', capacite: 80,
      adresse: 'Rue des Jardins, Cocody, Abidjan'
    },
    {
      id: 'r2', type: 'restaurant', nom: 'Chez Ama Grillades',
      ville: 'Abidjan', commune: 'Marcory', cuisine: 'Grillades',
      prix: 6500, note: 4.5, avis: 158, populaire: 88,
      description: "Braisé de poulet, poisson braisé et brochettes préparés au feu de bois. L'adresse incontournable des amateurs de grillades à Marcory.",
      icone: '🔥',
      equipements: ['Terrasse', 'Parking', 'Plats à emporter'],
      horaires: '17h00 – 01h00', capacite: 60,
      adresse: 'Boulevard du Cameroun, Marcory, Abidjan'
    },
    {
      id: 'r3', type: 'restaurant', nom: 'Océan Lagune',
      ville: 'Abidjan', commune: 'Plateau', cuisine: 'Fruits de mer',
      prix: 15000, note: 4.8, avis: 302, populaire: 99,
      description: "Restaurant gastronomique de fruits de mer avec vue sur la lagune Ébrié. Plateaux de fruits de mer, langoustes et cave à vins soignée.",
      icone: '🦞',
      equipements: ['Vue lagune', 'Climatisation', 'Voiturier', 'Bar', 'Wi-Fi'],
      horaires: '12h00 – 23h00', capacite: 120,
      adresse: 'Avenue Chardy, Plateau, Abidjan'
    },
    {
      id: 'r4', type: 'restaurant', nom: 'Beirut Café',
      ville: 'Abidjan', commune: 'Riviera', cuisine: 'Libanaise',
      prix: 12000, note: 4.6, avis: 176, populaire: 84,
      description: "Mezzés, chawarmas et pâtisseries orientales dans une ambiance chaleureuse à la Riviera. Terrasse ombragée et service soigné.",
      icone: '🥙',
      equipements: ['Terrasse', 'Climatisation', 'Wi-Fi', 'Narguilé'],
      horaires: '11h30 – 00h00', capacite: 70,
      adresse: 'Riviera Golf, Cocody, Abidjan'
    },
    {
      id: 'r5', type: 'restaurant', nom: 'Yopougon Street Food',
      ville: 'Abidjan', commune: 'Yopougon', cuisine: 'Fast-food',
      prix: 3500, note: 4.2, avis: 421, populaire: 79,
      description: "Le meilleur du street food ivoirien : garba, tchep, sandwichs et jus naturels à petits prix au cœur de Yopougon.",
      icone: '🍟',
      equipements: ['Plats à emporter', 'Livraison', 'Wi-Fi'],
      horaires: '10h00 – 22h00', capacite: 40,
      adresse: 'Siporex, Yopougon, Abidjan'
    },
    {
      id: 'r6', type: 'restaurant', nom: 'Jardin d\'Asie',
      ville: 'Abidjan', commune: 'Deux-Plateaux', cuisine: 'Asiatique',
      prix: 11000, note: 4.4, avis: 133, populaire: 72,
      description: "Cuisine thaïe et vietnamienne authentique aux Deux-Plateaux. Woks, currys et rouleaux de printemps faits maison.",
      icone: '🥢',
      equipements: ['Climatisation', 'Parking', 'Salle privée', 'Livraison'],
      horaires: '12h00 – 22h30', capacite: 55,
      adresse: 'Deux-Plateaux Vallon, Cocody, Abidjan'
    },
    {
      id: 'r7', type: 'restaurant', nom: 'La Table de Yamoussoukro',
      ville: 'Yamoussoukro', commune: 'Habitat', cuisine: 'Française',
      prix: 14000, note: 4.5, avis: 91, populaire: 68,
      description: "Bistronomie française au cœur de la capitale politique. Produits frais et menu du marché renouvelé chaque semaine.",
      icone: '🍷',
      equipements: ['Climatisation', 'Parking', 'Bar', 'Wi-Fi'],
      horaires: '12h00 – 22h00', capacite: 50,
      adresse: 'Quartier Habitat, Yamoussoukro'
    },
    {
      id: 'r8', type: 'restaurant', nom: 'Douceurs de Bouaké',
      ville: 'Bouaké', commune: 'Centre-ville', cuisine: 'Pâtisserie',
      prix: 4000, note: 4.3, avis: 64, populaire: 61,
      description: "Salon de thé et pâtisserie fine à Bouaké. Viennoiseries, gâteaux sur commande et petit-déjeuner continental.",
      icone: '🧁',
      equipements: ['Climatisation', 'Wi-Fi', 'Plats à emporter'],
      horaires: '07h00 – 20h00', capacite: 35,
      adresse: 'Commerce, Centre-ville, Bouaké'
    }
  ];

  const RESIDENCES = [
    {
      id: 'h1', type: 'residence', nom: 'Villa Palmeraie',
      ville: 'Abidjan', commune: 'Cocody', chambres: 4, categorie: 'Villa',
      prix: 85000, note: 4.9, avis: 78, populaire: 97,
      description: "Somptueuse villa 4 chambres avec piscine privée à Cocody Ambassades. Idéale pour familles ou séjours d'affaires haut de gamme.",
      icone: '🏡',
      equipements: ['Climatisation', 'Wi-Fi', 'Piscine', 'Parking', 'Groupe électrogène', 'Sécurité 24/7', 'Cuisine équipée'],
      surface: 320, capacite: 8,
      adresse: 'Cocody Ambassades, Abidjan'
    },
    {
      id: 'h2', type: 'residence', nom: 'Appart Plateau Business',
      ville: 'Abidjan', commune: 'Plateau', chambres: 2, categorie: 'Appartement',
      prix: 45000, note: 4.6, avis: 112, populaire: 90,
      description: "Appartement moderne 2 chambres en plein Plateau, quartier des affaires. Parfait pour voyages professionnels courts et moyens séjours.",
      icone: '🏢',
      equipements: ['Climatisation', 'Wi-Fi', 'Ascenseur', 'Sécurité 24/7', 'Cuisine équipée', 'Télévision'],
      surface: 95, capacite: 4,
      adresse: 'Rue du Commerce, Plateau, Abidjan'
    },
    {
      id: 'h3', type: 'residence', nom: 'Studio Cosy Marcory',
      ville: 'Abidjan', commune: 'Marcory', chambres: 1, categorie: 'Studio',
      prix: 22000, note: 4.4, avis: 96, populaire: 82,
      description: "Studio meublé cosy et lumineux à Marcory Zone 4. Tout équipé, idéal pour un séjour solo ou en couple.",
      icone: '🛏️',
      equipements: ['Climatisation', 'Wi-Fi', 'Cuisine équipée', 'Télévision', 'Parking'],
      surface: 38, capacite: 2,
      adresse: 'Zone 4, Marcory, Abidjan'
    },
    {
      id: 'h4', type: 'residence', nom: 'Résidence Angré Prestige',
      ville: 'Abidjan', commune: 'Angré', chambres: 3, categorie: 'Appartement',
      prix: 60000, note: 4.7, avis: 54, populaire: 85,
      description: "Grand appartement 3 chambres dans une résidence sécurisée à Angré 8e tranche. Piscine commune et espace de coworking.",
      icone: '🏬',
      equipements: ['Climatisation', 'Wi-Fi', 'Piscine', 'Parking', 'Ascenseur', 'Sécurité 24/7', 'Groupe électrogène'],
      surface: 140, capacite: 6,
      adresse: 'Angré 8e tranche, Cocody, Abidjan'
    },
    {
      id: 'h5', type: 'residence', nom: 'Villa Bord de Mer',
      ville: 'San-Pédro', commune: 'Balmer', chambres: 5, categorie: 'Villa',
      prix: 120000, note: 4.9, avis: 41, populaire: 93,
      description: "Villa pieds dans l'eau à San-Pédro avec accès plage privée. 5 chambres, terrasse panoramique et personnel de maison sur demande.",
      icone: '🏖️',
      equipements: ['Climatisation', 'Wi-Fi', 'Piscine', 'Parking', 'Groupe électrogène', 'Sécurité 24/7', 'Balcon'],
      surface: 400, capacite: 10,
      adresse: 'Plage de Balmer, San-Pédro'
    },
    {
      id: 'h6', type: 'residence', nom: 'Duplex Riviera',
      ville: 'Abidjan', commune: 'Riviera', chambres: 3, categorie: 'Duplex',
      prix: 70000, note: 4.6, avis: 63, populaire: 80,
      description: "Duplex élégant 3 chambres à la Riviera Palmeraie. Grand salon, terrasse et quartier calme proche des commerces.",
      icone: '🏘️',
      equipements: ['Climatisation', 'Wi-Fi', 'Parking', 'Balcon', 'Cuisine équipée', 'Sécurité 24/7'],
      surface: 160, capacite: 6,
      adresse: 'Riviera Palmeraie, Cocody, Abidjan'
    },
    {
      id: 'h7', type: 'residence', nom: 'Appart Yamoussoukro Centre',
      ville: 'Yamoussoukro', commune: 'Millionnaire', chambres: 2, categorie: 'Appartement',
      prix: 38000, note: 4.3, avis: 29, populaire: 66,
      description: "Appartement 2 chambres bien situé à Yamoussoukro, proche de la basilique. Confortable pour séjours touristiques et professionnels.",
      icone: '🏢',
      equipements: ['Climatisation', 'Wi-Fi', 'Parking', 'Télévision', 'Cuisine équipée'],
      surface: 80, capacite: 4,
      adresse: 'Quartier Millionnaire, Yamoussoukro'
    },
    {
      id: 'h8', type: 'residence', nom: 'Studio Étudiant Bouaké',
      ville: 'Bouaké', commune: 'Air France', chambres: 1, categorie: 'Studio',
      prix: 18000, note: 4.1, avis: 47, populaire: 58,
      description: "Studio meublé abordable à Bouaké, quartier Air France. Solution pratique pour courts séjours et mobilité professionnelle.",
      icone: '🛏️',
      equipements: ['Climatisation', 'Wi-Fi', 'Cuisine équipée', 'Sécurité 24/7'],
      surface: 32, capacite: 2,
      adresse: 'Air France, Bouaké'
    }
  ];

  const TEMOIGNAGES = [
    { nom: 'Aïcha K.', ville: 'Cocody', texte: "Réservation en 2 minutes pour un dîner d'anniversaire. Table prête à notre arrivée, aucune surprise. Je recommande !", note: 5 },
    { nom: 'Serge B.', ville: 'Plateau', texte: "J'ai loué un appartement pour une mission d'une semaine. Photos fidèles, paiement Wave rapide et sécurisé. Parfait.", note: 5 },
    { nom: 'Fatou D.', ville: 'Marcory', texte: "Enfin une plateforme locale qui affiche les prix en FCFA sans frais cachés. L'interface est simple même sur mon téléphone.", note: 4 },
    { nom: 'Kouassi N.', ville: 'Riviera', texte: "En tant que restaurateur, BookingCI m'a apporté de nouveaux clients chaque semaine. Le tableau de bord est très clair.", note: 5 }
  ];

  /* ---------------------------------------------------------------
   * 4. API interne (accès aux données + helpers)
   *
   * Ces fonctions simulent des endpoints REST. Chacune renvoie une
   * Promise afin que le remplacement par de vrais appels fetch() soit
   * transparent (voir README.md). Un léger délai imite la latence.
   * ------------------------------------------------------------- */

  function simulate(data, delay) {
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(JSON.parse(JSON.stringify(data))); }, delay || 120);
    });
  }

  const api = {
    // GET /api/etablissements?type=restaurant|residence
    getEtablissements: function (type) {
      let all = RESTAURANTS.concat(RESIDENCES);
      if (type) all = all.filter(function (e) { return e.type === type; });
      return simulate(all);
    },
    // GET /api/etablissements/:id
    getEtablissement: function (id) {
      const all = RESTAURANTS.concat(RESIDENCES);
      const found = all.find(function (e) { return e.id === id; });
      return simulate(found || null);
    },
    // GET /api/disponibilites/:id  (démo : quelques créneaux indisponibles)
    getDisponibilites: function (id) {
      // Renvoie une liste de dates (YYYY-MM-DD) indisponibles pour la démo.
      const today = new Date();
      const indispo = [];
      [3, 4, 9, 15, 16, 22].forEach(function (offset) {
        const d = new Date(today);
        d.setDate(d.getDate() + offset);
        indispo.push(d.toISOString().slice(0, 10));
      });
      return simulate({ etablissement: id, indisponibles: indispo });
    }
  };

  /* ---------------------------------------------------------------
   * 5. Helpers de formatage
   * ------------------------------------------------------------- */

  function formatFCFA(montant) {
    return new Intl.NumberFormat('fr-FR').format(Math.round(montant)) + ' FCFA';
  }

  function etoiles(note) {
    const pleines = Math.round(note);
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= pleines ? '★' : '☆';
    return s;
  }

  /* ---------------------------------------------------------------
   * 6. Export du namespace
   * ------------------------------------------------------------- */

  global.BookingCI = {
    VILLES: VILLES,
    TYPES_CUISINE: TYPES_CUISINE,
    EQUIPEMENTS_RESIDENCE: EQUIPEMENTS_RESIDENCE,
    MOYENS_PAIEMENT: MOYENS_PAIEMENT,
    RESTAURANTS: RESTAURANTS,
    RESIDENCES: RESIDENCES,
    TEMOIGNAGES: TEMOIGNAGES,
    api: api,
    placeholder: placeholder,
    formatFCFA: formatFCFA,
    etoiles: etoiles
  };

})(window);
