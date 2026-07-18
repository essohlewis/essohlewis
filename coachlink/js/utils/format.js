/* ==========================================================================
   utils/format.js — Formatage : montants FCFA, dates, temps relatif, notes.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const JOURS_COURTS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

  const format = {
    JOURS, JOURS_COURTS, MOIS,

    /** Formate un montant en FCFA avec séparateur d'espaces. Ex: 25 000 FCFA */
    fcfa(montant) {
      const n = Number(montant) || 0;
      return n.toLocaleString("fr-FR").replace(/ /g, " ") + " FCFA";
    },

    /** Date lisible : 15 juillet 2026 */
    date(valeur) {
      const d = new Date(valeur);
      if (isNaN(d)) return "";
      return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
    },

    /** Date + heure : 15 juil. 2026 à 14:30 */
    dateHeure(valeur) {
      const d = new Date(valeur);
      if (isNaN(d)) return "";
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      return `${d.getDate()} ${MOIS[d.getMonth()].slice(0, 4)}. ${d.getFullYear()} à ${h}:${m}`;
    },

    /** Heure seule : 14:30 */
    heure(valeur) {
      const d = new Date(valeur);
      if (isNaN(d)) return "";
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    },

    /** Temps relatif : "il y a 3 min", "il y a 2 h", "hier"… */
    tempsRelatif(valeur) {
      const d = new Date(valeur);
      const diff = Date.now() - d.getTime();
      const sec = Math.floor(diff / 1000);
      if (sec < 60) return "à l'instant";
      const min = Math.floor(sec / 60);
      if (min < 60) return `il y a ${min} min`;
      const h = Math.floor(min / 60);
      if (h < 24) return `il y a ${h} h`;
      const j = Math.floor(h / 24);
      if (j === 1) return "hier";
      if (j < 7) return `il y a ${j} j`;
      return format.date(valeur);
    },

    /** Note formatée à 1 décimale */
    note(valeur) {
      return (Math.round((Number(valeur) || 0) * 10) / 10).toFixed(1);
    },

    /** Initiales d'un nom pour avatar de secours */
    initiales(nom) {
      return (nom || "?")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((m) => m[0].toUpperCase())
        .join("");
    },

    /** Tronque un texte */
    tronquer(texte, max) {
      texte = String(texte || "");
      return texte.length > max ? texte.slice(0, max - 1) + "…" : texte;
    },
  };

  CL.format = format;
})();
