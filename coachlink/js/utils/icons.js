/* ==========================================================================
   utils/icons.js — Bibliothèque d'icônes SVG inline (aucune dépendance CDN).
   Usage : CL.icon("nom", 20) → chaîne SVG. Trait stroke = currentColor.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  // Chaque icône est le contenu interne d'un <svg> (viewBox 0 0 24 24).
  const chemins = {
    recherche: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    coeur: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    etoile: '<path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/>',
    verifie: '<path d="M9 12l2 2 4-4"/><path d="M12 3l2.2 1.5 2.6-.3 1 2.4 2.2 1.4-.6 2.6L21 15l-1.6 2-.4 2.6-2.6.2L14 22l-2-1.7L10 22l-2.4-2.2-2.6-.2-.4-2.6L3 15l1.6-2.4-.6-2.6L6.2 6.6l1-2.4 2.6.3z"/>',
    calendrier: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    localisation: '<path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    cloche: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    utilisateur: '<circle cx="12" cy="8" r="4"/><path d="M6 21v-1a6 6 0 0 1 12 0v1"/>',
    utilisateurs: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21v-1a6 6 0 0 1 12 0v1"/><path d="M16 5.2a3.5 3.5 0 0 1 0 5.6M22 21v-1a6 6 0 0 0-4-5.6"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    fermer: '<path d="M6 6l12 12M18 6L6 18"/>',
    fleche_droite: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    fleche_gauche: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    lune: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    portefeuille: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
    diplome: '<path d="M12 2l9 4-9 4-9-4z"/><path d="M6 9v5c0 1.7 2.7 3 6 3s6-1.3 6-3V9"/>',
    graphique: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    parametres: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2 2M17 17l2 2M19.1 4.9l-2 2M6.9 17l-2 2"/>',
    deconnexion: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    envoyer: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
    trombone: '<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.3 3.3 0 0 1 4.7 4.7L10 17.5a1.7 1.7 0 0 1-2.3-2.3l8-8"/>',
    pouce: '<path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zM7 10l4-7a2 2 0 0 1 2 2v3h5a2 2 0 0 1 2 2l-1.5 7a2 2 0 0 1-2 1.5H7"/>',
    partager: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    bouclier: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    eclair: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    filtre: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    poubelle: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    crayon: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    oeil: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    telephone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/>',
    cadenas: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    facebook: '<path d="M14 9h3V6h-3a4 4 0 0 0-4 4v2H8v3h2v6h3v-6h3l1-3h-4v-2a1 1 0 0 1 1-1z"/>',
    linkedin: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 17v-7" stroke-width="2"/>',
    whatsapp: '<path d="M3 21l1.6-4.8A8 8 0 1 1 8 19.5z"/><path d="M9 10c0 3 2 5 5 5l1.5-1.5-2-1-1 .8c-1-.4-1.8-1.2-2.2-2.2l.8-1-1-2z" fill="currentColor" stroke="none"/>',
    x_twitter: '<path d="M4 4l16 16M20 4L4 20" stroke-width="1.6"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>',
    tiktok: '<path d="M15 3v9.5a3.5 3.5 0 1 1-3-3.46M15 3c.5 2.5 2 4 4.5 4.2"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
    document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    lecture: '<path d="M5 3l14 9-14 9z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"/>',
  };

  /**
   * Retourne une chaîne SVG pour l'icône demandée.
   * @param {string} nom  clé dans `chemins`
   * @param {number} taille  px (défaut 20)
   * @param {object} opts  { fill:false, largeurTrait:1.8, classe:"" }
   */
  CL.icon = function (nom, taille, opts) {
    opts = opts || {};
    const t = taille || 20;
    const contenu = chemins[nom] || "";
    const fill = opts.fill ? "currentColor" : "none";
    const stroke = opts.fill ? "none" : "currentColor";
    const lw = opts.largeurTrait || 1.8;
    const cls = opts.classe ? ` class="${opts.classe}"` : "";
    return `<svg${cls} width="${t}" height="${t}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${contenu}</svg>`;
  };

  CL.iconExiste = function (nom) { return !!chemins[nom]; };
})();
