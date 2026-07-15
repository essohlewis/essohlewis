/* ==========================================================================
   utils/i18n.js — Structure d'internationalisation (FR par défaut).
   Préparé pour l'ajout d'autres langues sans toucher aux pages.
   Usage : CL.i18n.t("cle") — repli sur la clé si absente.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  const dictionnaires = {
    fr: {
      "app.nom": "CoachLink CI",
      "app.slogan": "Le coach de confiance, à portée de clic.",
      "nav.accueil": "Accueil",
      "nav.coachs": "Trouver un coach",
      "nav.tarifs": "Comment ça marche",
      "nav.connexion": "Connexion",
      "nav.inscription": "S'inscrire",
      "cta.trouver": "Trouver mon coach",
      "cta.devenir": "Devenir coach",
      "commun.chargement": "Chargement…",
      "commun.enregistrer": "Enregistrer",
      "commun.annuler": "Annuler",
      "commun.confirmer": "Confirmer",
      "commun.fermer": "Fermer",
    },
    en: {
      "app.nom": "CoachLink CI",
      "app.slogan": "The trusted coach, one click away.",
    },
  };

  let langueCourante = "fr";

  const i18n = {
    langues: Object.keys(dictionnaires),

    definirLangue(code) {
      if (dictionnaires[code]) {
        langueCourante = code;
        localStorage.setItem("cl_langue", code);
        document.documentElement.lang = code;
      }
    },

    langue() { return langueCourante; },

    /** Traduit une clé, repli FR puis sur la clé elle-même. */
    t(cle, remplacements) {
      let texte = (dictionnaires[langueCourante] && dictionnaires[langueCourante][cle]) ||
        dictionnaires.fr[cle] || cle;
      if (remplacements) {
        for (const [k, v] of Object.entries(remplacements)) {
          texte = texte.replace(new RegExp("{" + k + "}", "g"), v);
        }
      }
      return texte;
    },

    init() {
      const sauve = localStorage.getItem("cl_langue");
      if (sauve && dictionnaires[sauve]) langueCourante = sauve;
      document.documentElement.lang = langueCourante;
    },
  };

  CL.i18n = i18n;
})();
