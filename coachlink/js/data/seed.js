/* ==========================================================================
   data/seed.js — Catalogue simulé (source de vérité hors-ligne).
   Utilisé pour amorcer le "stockage" au premier lancement, afin que
   l'application fonctionne en ouvrant simplement index.html (file://),
   sans serveur ni requête réseau. Miroir des fichiers /data/*.json.

   NB : lors du branchement à l'API PHP MVC, la couche services/ ira chercher
   ces mêmes structures via fetch() — le format ne change pas.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  // Créneaux hebdomadaires : liste d'heures LIBRES par jour court.
  const dispoType = (jours) => jours; // simple passe-plat, lisibilité

  const heuresMatin = ["08:00", "09:00", "10:00", "11:00"];
  const heuresSoir = ["16:00", "17:00", "18:00", "19:00"];

  const coachs = [
    {
      id: "c1", prenom: "Koffi", nom: "Aka", genre: "h",
      titre: "Coach sportif & préparateur physique",
      specialites: ["sport", "nutrition"], categorie: "Sportif",
      langues: ["Français", "Baoulé", "Anglais"],
      commune: "Cocody", ville: "Abidjan",
      bio: "Ancien athlète national, j'accompagne depuis 8 ans particuliers et entreprises vers une meilleure forme physique. Programmes personnalisés, remise en forme, perte de poids et préparation aux compétitions.",
      tarifs: [
        { id: "t1", nom: "Séance individuelle", type: "seance", prix: 15000, duree: 60, description: "Coaching one-to-one à domicile ou en salle." },
        { id: "t2", nom: "Pack 10 séances", type: "pack", prix: 130000, duree: 60, description: "10 séances à utiliser sur 2 mois, suivi nutritionnel inclus." },
        { id: "t3", nom: "Abonnement mensuel", type: "abonnement", prix: 60000, duree: 60, description: "8 séances / mois + plan alimentaire." }
      ],
      diplomes: [
        { id: "d1", titre: "BEES Éducateur sportif", ecole: "INJS Abidjan", annee: 2015, statut: "verifie" },
        { id: "d2", titre: "Certification Nutrition du sport", ecole: "IFBB", annee: 2019, statut: "verifie" }
      ],
      note: 4.8, nbAvis: 42, nbSeances: 320, ancienneteMois: 30, tauxReponse: 95,
      disponibilites: { Lun: heuresMatin, Mar: heuresSoir, Mer: heuresMatin, Jeu: heuresSoir, Ven: heuresMatin, Sam: ["09:00", "10:00", "11:00"], Dim: [] },
      reseaux: { facebook: "koffi.aka.coach", linkedin: "koffi-aka", instagram: "koffiaka_fit" },
      email: "koffi.aka@coachlink.ci", telephone: "0701020304",
      couleur: "#1b4dcc"
    },
    {
      id: "c2", prenom: "Aya", nom: "Kouassi", genre: "f",
      titre: "Coach en nutrition & bien-être",
      specialites: ["nutrition", "devperso"], categorie: "Bien-être",
      langues: ["Français", "Anglais"],
      commune: "Marcory", ville: "Abidjan",
      bio: "Diététicienne passionnée, je vous aide à retrouver équilibre alimentaire et énergie au quotidien, avec des recettes locales et accessibles.",
      tarifs: [
        { id: "t1", nom: "Bilan nutritionnel", type: "seance", prix: 20000, duree: 90, description: "Analyse complète + plan personnalisé." },
        { id: "t2", nom: "Suivi mensuel", type: "abonnement", prix: 45000, duree: 45, description: "4 consultations de suivi par mois." }
      ],
      diplomes: [
        { id: "d1", titre: "Licence Diététique", ecole: "Université FHB", annee: 2017, statut: "verifie" }
      ],
      note: 4.9, nbAvis: 58, nbSeances: 410, ancienneteMois: 42, tauxReponse: 98,
      disponibilites: { Lun: heuresMatin, Mar: heuresMatin, Mer: [], Jeu: heuresSoir, Ven: heuresSoir, Sam: heuresMatin, Dim: [] },
      reseaux: { facebook: "aya.nutrition", linkedin: "aya-kouassi", instagram: "aya_bienetre" },
      email: "aya.kouassi@coachlink.ci", telephone: "0505060708",
      couleur: "#12a150"
    },
    {
      id: "c3", prenom: "Ismaël", nom: "Traoré", genre: "h",
      titre: "Coach business & entrepreneuriat",
      specialites: ["business", "finance"], categorie: "Professionnel",
      langues: ["Français", "Anglais", "Dioula"],
      commune: "Plateau", ville: "Abidjan",
      bio: "Consultant et mentor, j'accompagne les porteurs de projets et PME à structurer leur business model, lever des fonds et scaler en Afrique de l'Ouest.",
      tarifs: [
        { id: "t1", nom: "Session stratégie", type: "seance", prix: 35000, duree: 90, description: "Diagnostic et feuille de route." },
        { id: "t2", nom: "Accompagnement 3 mois", type: "pack", prix: 300000, duree: 90, description: "Mentorat intensif, 2 sessions / semaine." }
      ],
      diplomes: [
        { id: "d1", titre: "MBA Entrepreneuriat", ecole: "HEC Paris", annee: 2014, statut: "verifie" },
        { id: "d2", titre: "Certification Design Thinking", ecole: "IDEO U", annee: 2020, statut: "en_attente" }
      ],
      note: 4.7, nbAvis: 31, nbSeances: 180, ancienneteMois: 24, tauxReponse: 90,
      disponibilites: { Lun: heuresSoir, Mar: heuresSoir, Mer: heuresSoir, Jeu: heuresSoir, Ven: heuresMatin, Sam: [], Dim: [] },
      reseaux: { facebook: "ismael.traore.biz", linkedin: "ismael-traore", instagram: "" },
      email: "ismael.traore@coachlink.ci", telephone: "0102030405",
      couleur: "#123a9e"
    },
    {
      id: "c4", prenom: "Fatou", nom: "Diallo", genre: "f",
      titre: "Professeure de yoga & sophrologie",
      specialites: ["yoga", "mental"], categorie: "Bien-être",
      langues: ["Français", "Anglais"],
      commune: "Cocody", ville: "Abidjan",
      bio: "Je propose des séances de yoga et de relaxation pour gérer le stress, améliorer la posture et retrouver la sérénité, en groupe ou en individuel.",
      tarifs: [
        { id: "t1", nom: "Cours individuel", type: "seance", prix: 12000, duree: 60, description: "Yoga adapté à votre niveau." },
        { id: "t2", nom: "Pack découverte 5 cours", type: "pack", prix: 50000, duree: 60, description: "Idéal pour débuter en douceur." }
      ],
      diplomes: [
        { id: "d1", titre: "Yoga Alliance RYT-200", ecole: "Yoga Alliance", annee: 2018, statut: "verifie" }
      ],
      note: 4.9, nbAvis: 67, nbSeances: 500, ancienneteMois: 48, tauxReponse: 97,
      disponibilites: { Lun: heuresMatin, Mar: heuresMatin, Mer: heuresMatin, Jeu: heuresMatin, Ven: [], Sam: heuresMatin, Dim: heuresMatin },
      reseaux: { facebook: "fatou.yoga.ci", linkedin: "", instagram: "fatou_yoga" },
      email: "fatou.diallo@coachlink.ci", telephone: "0708091011",
      couleur: "#8b3ff0"
    },
    {
      id: "c5", prenom: "Serge", nom: "N'Guessan", genre: "h",
      titre: "Coach carrière & développement pro",
      specialites: ["carriere", "prisedeparole"], categorie: "Professionnel",
      langues: ["Français", "Anglais"],
      commune: "Plateau", ville: "Abidjan",
      bio: "RH de formation, je prépare les candidats aux entretiens, optimise CV et LinkedIn et coache la prise de parole en public.",
      tarifs: [
        { id: "t1", nom: "Coaching entretien", type: "seance", prix: 18000, duree: 60, description: "Simulation d'entretien + feedback." },
        { id: "t2", nom: "Pack recherche d'emploi", type: "pack", prix: 75000, duree: 60, description: "CV + LinkedIn + 3 simulations." }
      ],
      diplomes: [
        { id: "d1", titre: "Master Ressources Humaines", ecole: "INP-HB", annee: 2013, statut: "verifie" }
      ],
      note: 4.6, nbAvis: 24, nbSeances: 150, ancienneteMois: 18, tauxReponse: 88,
      disponibilites: { Lun: heuresSoir, Mar: heuresSoir, Mer: [], Jeu: heuresSoir, Ven: heuresSoir, Sam: heuresMatin, Dim: [] },
      reseaux: { facebook: "", linkedin: "serge-nguessan", instagram: "" },
      email: "serge.nguessan@coachlink.ci", telephone: "0712131415",
      couleur: "#1b4dcc"
    },
    {
      id: "c6", prenom: "Mariam", nom: "Bamba", genre: "f",
      titre: "Coach en développement personnel",
      specialites: ["devperso", "mental"], categorie: "Bien-être",
      langues: ["Français"],
      commune: "Yopougon", ville: "Abidjan",
      bio: "J'aide mes clients à reprendre confiance, définir des objectifs de vie clairs et dépasser leurs blocages grâce à des outils concrets.",
      tarifs: [
        { id: "t1", nom: "Séance de coaching", type: "seance", prix: 14000, duree: 60, description: "Objectifs, confiance, motivation." },
        { id: "t2", nom: "Programme transformation", type: "pack", prix: 120000, duree: 60, description: "10 séances sur 3 mois." }
      ],
      diplomes: [
        { id: "d1", titre: "Certification Coach ICF", ecole: "ICF", annee: 2021, statut: "en_attente" }
      ],
      note: 4.5, nbAvis: 15, nbSeances: 90, ancienneteMois: 8, tauxReponse: 85,
      disponibilites: { Lun: heuresSoir, Mar: heuresMatin, Mer: heuresSoir, Jeu: [], Ven: heuresSoir, Sam: heuresMatin, Dim: [] },
      reseaux: { facebook: "mariam.devperso", linkedin: "", instagram: "mariam_coach" },
      email: "mariam.bamba@coachlink.ci", telephone: "0716171819",
      couleur: "#ff7a1a"
    },
    {
      id: "c7", prenom: "Jean-Marc", nom: "Yao", genre: "h",
      titre: "Professeur de mathématiques & physique",
      specialites: ["scolaire"], categorie: "Scolaire",
      langues: ["Français"],
      commune: "Abobo", ville: "Abidjan",
      bio: "Enseignant certifié, je donne des cours de soutien de la 6e à la Terminale (maths, physique-chimie) avec un taux de réussite élevé au BAC.",
      tarifs: [
        { id: "t1", nom: "Cours particulier", type: "seance", prix: 8000, duree: 90, description: "À domicile, du collège au lycée." },
        { id: "t2", nom: "Abonnement mensuel", type: "abonnement", prix: 55000, duree: 90, description: "8 cours / mois." }
      ],
      diplomes: [
        { id: "d1", titre: "CAPES Mathématiques", ecole: "ENS Abidjan", annee: 2012, statut: "verifie" }
      ],
      note: 4.8, nbAvis: 39, nbSeances: 620, ancienneteMois: 60, tauxReponse: 92,
      disponibilites: { Lun: heuresSoir, Mar: heuresSoir, Mer: heuresMatin, Jeu: heuresSoir, Ven: heuresSoir, Sam: heuresMatin, Dim: [] },
      reseaux: { facebook: "jm.yao.cours", linkedin: "", instagram: "" },
      email: "jm.yao@coachlink.ci", telephone: "0720212223",
      couleur: "#12a150"
    },
    {
      id: "c8", prenom: "Clarisse", nom: "Gnahoré", genre: "f",
      titre: "Coach en langues (Anglais & Espagnol)",
      specialites: ["langues"], categorie: "Scolaire",
      langues: ["Français", "Anglais", "Espagnol"],
      commune: "Treichville", ville: "Abidjan",
      bio: "Cours d'anglais et d'espagnol pour tous niveaux : conversation, business english, préparation TOEFL/IELTS. Méthode immersive et ludique.",
      tarifs: [
        { id: "t1", nom: "Cours de conversation", type: "seance", prix: 10000, duree: 60, description: "Pratique orale intensive." },
        { id: "t2", nom: "Pack TOEFL", type: "pack", prix: 90000, duree: 60, description: "10 séances de préparation." }
      ],
      diplomes: [
        { id: "d1", titre: "Master Langues étrangères", ecole: "Université FHB", annee: 2016, statut: "verifie" },
        { id: "d2", titre: "Certification TEFL", ecole: "TEFL Org", annee: 2019, statut: "verifie" }
      ],
      note: 4.7, nbAvis: 28, nbSeances: 240, ancienneteMois: 26, tauxReponse: 94,
      disponibilites: { Lun: heuresMatin, Mar: heuresSoir, Mer: heuresMatin, Jeu: heuresSoir, Ven: heuresMatin, Sam: [], Dim: [] },
      reseaux: { facebook: "", linkedin: "clarisse-gnahore", instagram: "clarisse_langues" },
      email: "clarisse.gnahore@coachlink.ci", telephone: "0724252627",
      couleur: "#1b4dcc"
    },
    {
      id: "c9", prenom: "Bakary", nom: "Coulibaly", genre: "h",
      titre: "Professeur de guitare & piano",
      specialites: ["musique"], categorie: "Artistique",
      langues: ["Français", "Dioula"],
      commune: "Adjamé", ville: "Abidjan",
      bio: "Musicien professionnel, j'enseigne la guitare et le piano aux enfants comme aux adultes, du solfège à l'improvisation.",
      tarifs: [
        { id: "t1", nom: "Cours de guitare", type: "seance", prix: 9000, duree: 60, description: "Débutant à avancé." },
        { id: "t2", nom: "Pack 8 cours", type: "pack", prix: 64000, duree: 60, description: "Progression garantie." }
      ],
      diplomes: [
        { id: "d1", titre: "Diplôme Conservatoire", ecole: "INSAAC", annee: 2011, statut: "verifie" }
      ],
      note: 4.6, nbAvis: 19, nbSeances: 200, ancienneteMois: 36, tauxReponse: 80,
      disponibilites: { Lun: heuresSoir, Mar: [], Mer: heuresSoir, Jeu: heuresSoir, Ven: heuresSoir, Sam: heuresMatin, Dim: heuresMatin },
      reseaux: { facebook: "bakary.music", linkedin: "", instagram: "bakary_guitare" },
      email: "bakary.coulibaly@coachlink.ci", telephone: "0728293031",
      couleur: "#8b3ff0"
    },
    {
      id: "c10", prenom: "Prisca", nom: "Adjoua", genre: "f",
      titre: "Coach de danse (Afro & moderne)",
      specialites: ["danse", "sport"], categorie: "Artistique",
      langues: ["Français", "Anglais"],
      commune: "Cocody", ville: "Abidjan",
      bio: "Danseuse et chorégraphe, je propose des cours d'Afrodance, danse moderne et fitness dansé pour tous les âges. Ambiance garantie !",
      tarifs: [
        { id: "t1", nom: "Cours collectif", type: "seance", prix: 7000, duree: 75, description: "En groupe, tous niveaux." },
        { id: "t2", nom: "Cours privé", type: "seance", prix: 16000, duree: 60, description: "Chorégraphie personnalisée." }
      ],
      diplomes: [
        { id: "d1", titre: "Formation Chorégraphie", ecole: "INSAAC", annee: 2017, statut: "verifie" }
      ],
      note: 5.0, nbAvis: 12, nbSeances: 80, ancienneteMois: 5, tauxReponse: 99,
      disponibilites: { Lun: heuresSoir, Mar: heuresSoir, Mer: heuresSoir, Jeu: heuresSoir, Ven: heuresSoir, Sam: heuresMatin, Dim: [] },
      reseaux: { facebook: "prisca.dance", linkedin: "", instagram: "prisca_afrodance" },
      email: "prisca.adjoua@coachlink.ci", telephone: "0732333435",
      couleur: "#ff7a1a"
    },
    {
      id: "c11", prenom: "Emmanuel", nom: "Kouadio", genre: "h",
      titre: "Coach finance personnelle & investissement",
      specialites: ["finance", "business"], categorie: "Professionnel",
      langues: ["Français", "Anglais"],
      commune: "Plateau", ville: "Abidjan",
      bio: "Conseiller financier, j'aide les particuliers à mieux gérer leur budget, épargner intelligemment et investir en bourse et immobilier.",
      tarifs: [
        { id: "t1", nom: "Consultation budget", type: "seance", prix: 22000, duree: 75, description: "Audit et plan d'épargne." },
        { id: "t2", nom: "Suivi patrimoine", type: "abonnement", prix: 80000, duree: 60, description: "Accompagnement mensuel." }
      ],
      diplomes: [
        { id: "d1", titre: "Master Finance", ecole: "ESCA", annee: 2015, statut: "verifie" }
      ],
      note: 4.4, nbAvis: 11, nbSeances: 70, ancienneteMois: 14, tauxReponse: 82,
      disponibilites: { Lun: heuresSoir, Mar: heuresSoir, Mer: [], Jeu: heuresSoir, Ven: heuresMatin, Sam: [], Dim: [] },
      reseaux: { facebook: "", linkedin: "emmanuel-kouadio", instagram: "" },
      email: "emmanuel.kouadio@coachlink.ci", telephone: "0736373839",
      couleur: "#123a9e"
    },
    {
      id: "c12", prenom: "Rachelle", nom: "Boni", genre: "f",
      titre: "Coach parentalité & petite enfance",
      specialites: ["parentalite", "devperso"], categorie: "Bien-être",
      langues: ["Français"],
      commune: "Bingerville", ville: "Abidjan",
      bio: "Éducatrice spécialisée, j'accompagne les parents dans l'éducation positive, la gestion des émotions de l'enfant et l'équilibre familial.",
      tarifs: [
        { id: "t1", nom: "Séance parentalité", type: "seance", prix: 13000, duree: 60, description: "Conseils personnalisés." },
        { id: "t2", nom: "Pack sérénité familiale", type: "pack", prix: 100000, duree: 60, description: "8 séances de suivi." }
      ],
      diplomes: [
        { id: "d1", titre: "Diplôme Éducateur de jeunes enfants", ecole: "INFS", annee: 2016, statut: "verifie" }
      ],
      note: 4.8, nbAvis: 21, nbSeances: 130, ancienneteMois: 20, tauxReponse: 91,
      disponibilites: { Lun: heuresMatin, Mar: heuresMatin, Mer: [], Jeu: heuresMatin, Ven: heuresMatin, Sam: heuresMatin, Dim: [] },
      reseaux: { facebook: "rachelle.parentalite", linkedin: "", instagram: "rachelle_parents" },
      email: "rachelle.boni@coachlink.ci", telephone: "0740414243",
      couleur: "#12a150"
    }
  ];

  // Avis pré-remplis pour quelques coachs (démo du carrousel d'avis).
  const avisSeed = {
    c1: [
      { id: "a1", auteur: "Yannick D.", note: 5, texte: "Koffi est exigeant mais bienveillant. J'ai perdu 8 kg en 3 mois !", date: "2026-05-12", reponse: "Merci Yannick, continue comme ça 💪" },
      { id: "a2", auteur: "Sandra K.", note: 5, texte: "Programme au top, très professionnel.", date: "2026-06-02", reponse: null },
      { id: "a3", auteur: "Olivier T.", note: 4, texte: "Bon coach, parfois un peu en retard.", date: "2026-06-20", reponse: null }
    ],
    c2: [
      { id: "a1", auteur: "Awa S.", note: 5, texte: "Aya a changé ma relation à la nourriture. Recettes locales géniales !", date: "2026-04-18", reponse: "Un plaisir de t'accompagner Awa 🌸" },
      { id: "a2", auteur: "Marc B.", note: 5, texte: "Très à l'écoute et compétente.", date: "2026-05-30", reponse: null }
    ],
    c4: [
      { id: "a1", auteur: "Nadia F.", note: 5, texte: "Séances apaisantes, je dors beaucoup mieux.", date: "2026-05-01", reponse: null },
      { id: "a2", auteur: "Éric M.", note: 5, texte: "Fatou est une excellente pédagogue.", date: "2026-06-11", reponse: "Merci Éric 🙏" }
    ]
  };

  // Posts (mur public) pour quelques coachs.
  const postsSeed = {
    c1: [
      { id: "p1", texte: "Séance de groupe ce matin à la Riviera 🏃‍♂️ Bravo à tous pour l'énergie !", image: null, date: "2026-07-10", likes: 24 },
      { id: "p2", texte: "Rappel : l'hydratation est la clé de la performance. Buvez avant d'avoir soif 💧", image: null, date: "2026-07-05", likes: 15 }
    ],
    c4: [
      { id: "p1", texte: "Nouvelle session de yoga au lever du soleil chaque samedi 🧘‍♀️ Places limitées.", image: null, date: "2026-07-08", likes: 31 }
    ],
    c10: [
      { id: "p1", texte: "Répétition pour le prochain showcase Afrodance 💃🔥 Qui vient danser ?", image: null, date: "2026-07-12", likes: 42 }
    ]
  };

  // Attache avis et posts aux coachs.
  coachs.forEach((c) => {
    c.avis = avisSeed[c.id] || [];
    c.posts = postsSeed[c.id] || [];
  });

  CL.SEED = {
    coachs,
    specialites: [
      { id: "sport", nom: "Sport & Fitness", emoji: "🏋️", categorie: "Sportif" },
      { id: "nutrition", nom: "Nutrition & Diététique", emoji: "🥗", categorie: "Bien-être" },
      { id: "yoga", nom: "Yoga & Relaxation", emoji: "🧘", categorie: "Bien-être" },
      { id: "business", nom: "Business & Entrepreneuriat", emoji: "💼", categorie: "Professionnel" },
      { id: "carriere", nom: "Carrière & Emploi", emoji: "📈", categorie: "Professionnel" },
      { id: "devperso", nom: "Développement personnel", emoji: "🌱", categorie: "Bien-être" },
      { id: "scolaire", nom: "Soutien scolaire", emoji: "📚", categorie: "Scolaire" },
      { id: "langues", nom: "Langues", emoji: "🗣️", categorie: "Scolaire" },
      { id: "musique", nom: "Musique", emoji: "🎵", categorie: "Artistique" },
      { id: "danse", nom: "Danse", emoji: "💃", categorie: "Artistique" },
      { id: "finance", nom: "Finance personnelle", emoji: "💰", categorie: "Professionnel" },
      { id: "prisedeparole", nom: "Prise de parole", emoji: "🎤", categorie: "Professionnel" },
      { id: "parentalite", nom: "Parentalité", emoji: "👨‍👩‍👧", categorie: "Bien-être" },
      { id: "mental", nom: "Coaching mental", emoji: "🧠", categorie: "Bien-être" }
    ],
    communes: ["Cocody", "Plateau", "Yopougon", "Marcory", "Treichville", "Adjamé", "Abobo", "Koumassi", "Port-Bouët", "Attécoubé", "Bingerville", "Songon", "Anyama", "Grand-Bassam"]
  };

  // Compte de démonstration admin (pour tester la modération).
  CL.COMPTES_DEMO = [
    { id: "u_admin", role: "admin", prenom: "Admin", nom: "CoachLink", email: "admin@coachlink.ci", motDePasse: "admin123", telephone: "0700000000" }
  ];
})();
