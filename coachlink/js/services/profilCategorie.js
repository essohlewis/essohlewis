/* ==========================================================================
   services/profilCategorie.js — Modèle d'accompagnement PAR CATÉGORIE.
   Chaque métier du coaching a ses réalités :
     • un coach sportif propose un abonnement mensuel (salle / domicile /
       salle de sport de proximité) avec un programme hebdomadaire ;
     • un(e) nutritionniste reçoit sur rendez-vous ponctuel, en cabinet /
       bureau / immeuble (pas dans une salle de sport, pas forcément un abo) ;
     • un professeur de soutien scolaire enseigne au domicile de l'élève,
       chaque semaine ; un coach carrière échange en bureau ou en visio ; etc.
   Ce module centralise, pour chaque profil métier : les LIEUX pertinents,
   les OBJECTIFS, le VOCABULAIRE (séance / consultation / cours / session)
   et l'OFFRE proposée (rendez-vous ponctuel et/ou abonnement mensuel).
   Aucune dépendance : simple table de configuration.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  // Catalogue des lieux possibles.
  //   adresse : un champ de localisation (GPS + adresse) est requis ;
  //   nomLieu : on demande le nom du lieu (salle, immeuble, établissement…) ;
  //   enLigne : séance à distance, aucun lieu physique.
  const LIEUX = {
    salle_coach:    { label: "Salle du coach",             adresse: false, nomLieu: false },
    studio_coach:   { label: "Studio du coach",            adresse: false, nomLieu: false },
    cabinet_coach:  { label: "Cabinet / bureau du coach",  adresse: false, nomLieu: false },
    chez_coach:     { label: "Chez le coach",              adresse: false, nomLieu: false },
    domicile:       { label: "À mon domicile",             adresse: true,  nomLieu: false },
    salle_proposee: { label: "Salle de sport proposée",    adresse: true,  nomLieu: true  },
    lieu_pro:       { label: "Bureau / immeuble convenu",  adresse: true,  nomLieu: true  },
    etablissement:  { label: "Établissement (école…)",     adresse: true,  nomLieu: true  },
    en_ligne:       { label: "En ligne (visioconférence)", adresse: false, nomLieu: false, enLigne: true },
  };

  // Profils métier. `abonnement` : l'abonnement mensuel est-il pertinent ?
  //   Sinon → uniquement des rendez-vous ponctuels (ex. nutrition, carrière).
  const PROFILS = {
    sportif: {
      libelle: "Coaching sportif",
      lieux: ["salle_coach", "domicile", "salle_proposee"], salle: true,
      objectifs: ["Perte de poids", "Prise de masse", "Remise en forme", "Préparation physique", "Endurance / cardio", "Bien-être / souplesse"],
      abonnement: true, terme: "séance", termePluriel: "séances",
      reserver: "Réserver une séance", questionLieu: "Où se dérouleront les séances ?",
      accroche: "Passez à un accompagnement suivi : votre coach vous prépare un programme mensuel selon vos objectifs et vos disponibilités.",
    },
    nutrition: {
      libelle: "Nutrition & diététique",
      lieux: ["cabinet_coach", "domicile", "en_ligne"], salle: false,
      objectifs: ["Rééquilibrage alimentaire", "Perte de poids", "Prise de masse", "Nutrition sportive", "Suivi grossesse / post-partum", "Suivi d'une pathologie"],
      abonnement: false, terme: "consultation", termePluriel: "consultations",
      reserver: "Prendre rendez-vous", questionLieu: "Où se déroulera la consultation ?",
      accroche: "Le/la nutritionniste vous reçoit sur rendez-vous et fixe le lieu de consultation : son cabinet / bureau, votre domicile ou une visioconférence.",
    },
    bienetre: {
      libelle: "Bien-être & relaxation",
      lieux: ["studio_coach", "domicile", "en_ligne"], salle: false,
      objectifs: ["Relaxation / anti-stress", "Souplesse / mobilité", "Yoga / méditation", "Sommeil", "Équilibre de vie"],
      abonnement: true, terme: "séance", termePluriel: "séances",
      reserver: "Réserver une séance", questionLieu: "Où se dérouleront les séances ?",
      accroche: "Programmez un accompagnement régulier : des séances hebdomadaires au studio, à votre domicile ou en ligne.",
    },
    sante: {
      libelle: "Sport santé & réathlétisation",
      lieux: ["domicile", "cabinet_coach", "salle_coach"], salle: false,
      objectifs: ["Reprise après blessure", "Sport santé seniors", "Perte de poids encadrée", "Renforcement doux", "Mobilité & posture", "Remise en forme progressive"],
      abonnement: true, terme: "séance", termePluriel: "séances",
      reserver: "Réserver une séance", questionLieu: "Où se dérouleront les séances ?",
      accroche: "Reprenez le sport en toute sécurité : votre coach santé bâtit un programme progressif et encadré selon votre condition physique.",
    },
  };

  // Spécialité (voir seed.js) → profil métier. 100 % sport & santé physique.
  const PAR_SPECIALITE = {
    sport: "sportif", prepaphysique: "sportif", crossfit: "sportif", course: "sportif",
    natation: "sportif", artsmartiaux: "sportif", cardiodanse: "sportif",
    yoga: "bienetre", pilates: "bienetre",
    nutrition: "nutrition",
    reeducation: "sante", sportsante: "sante",
  };

  // Catégorie (voir seed.js) → profil de repli (si la spécialité est inconnue).
  const PAR_CATEGORIE = {
    "Sportif": "sportif", "Bien-être physique": "bienetre", "Nutrition": "nutrition", "Santé": "sante",
  };

  function resoudre(coach) {
    if (coach && Array.isArray(coach.specialites)) {
      for (const s of coach.specialites) if (PAR_SPECIALITE[s]) return PAR_SPECIALITE[s];
    }
    if (coach && coach.categorie && PAR_CATEGORIE[coach.categorie]) return PAR_CATEGORIE[coach.categorie];
    return "sportif";
  }

  CL.profilCat = {
    LIEUX,
    /** Config d'un lieu (repli sûr si clé inconnue). */
    lieu(key) { return LIEUX[key] || { label: key, adresse: true, nomLieu: false }; },
    /** Profil métier résolu pour un coach (avec sa clé). */
    pour(coach) {
      const cle = resoudre(coach);
      return Object.assign({ cle }, PROFILS[cle] || PROFILS.sportif);
    },
    profil(cle) { return PROFILS[cle] || PROFILS.sportif; },
  };
})();
