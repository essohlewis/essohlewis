/* ==========================================================================
   js/config.example.js — Configuration de déploiement du front.

   EN PRODUCTION : copiez ce fichier en « js/config.js » et chargez-le dans
   index.html AVANT js/services/apiService.js :

     <script src="js/config.js"></script>

   Il active l'API et fixe son URL de base. Sans ce fichier, l'application
   fonctionne en mode démonstration (hors-ligne, localStorage).
   `js/config.js` est ignoré par git (spécifique à chaque déploiement).
   ========================================================================== */
window.CL_CONFIG = {
  // URL de base de l'API. Si le front et l'API sont sur le même domaine
  // (recommandé), laissez "/api". Sinon, mettez l'URL absolue de l'API,
  // ex : "https://api.coachlink.ci".
  apiBase: "/api",

  // true = l'application utilise le backend ; false = mode démonstration.
  apiActif: true,
};
