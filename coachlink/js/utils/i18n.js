/* ==========================================================================
   utils/i18n.js — Internationalisation (FR par défaut) : FR · EN · ES · DE.
   Le contenu est écrit en français ; une couche de traduction parcourt le DOM
   et remplace les libellés connus dans la langue choisie (et suit les ajouts
   dynamiques : modales, toasts, navigation). Les textes non traduits restent
   en français (repli propre). Aucune dépendance ni service externe.
   ========================================================================== */
(function () {
  "use strict";
  window.CL = window.CL || {};

  const LANGUES = { fr: "Français", en: "English", es: "Español", de: "Deutsch" };
  const DRAPEAUX = { fr: "🇫🇷", en: "🇬🇧", es: "🇪🇸", de: "🇩🇪" };

  // Dictionnaire : texte source (français) → traduction, par langue.
  const T = {
    en: {
      "Accueil": "Home", "Trouver un coach": "Find a coach", "Comment ça marche": "How it works",
      "Connexion": "Log in", "S'inscrire": "Sign up", "Se connecter": "Log in", "Se déconnecter": "Log out",
      "À bientôt !": "See you soon!", "Notifications": "Notifications", "Notifs": "Alerts", "Messagerie": "Messaging",
      "Messages": "Messages", "Paramètres": "Settings", "Tableau de bord": "Dashboard",
      "Mes réservations": "My bookings", "Mes abonnements": "My subscriptions", "Mes favoris": "My favorites",
      "Mes avis": "My reviews", "Espace client": "Client area", "Espace coach": "Coach area",
      "Demandes": "Requests", "Abonnements": "Subscriptions", "Mon profil": "My profile", "Mon mur": "My wall",
      "Ma galerie": "My gallery", "Disponibilités": "Availability", "Mes disponibilités": "My availability",
      "Diplômes": "Diplomas", "Mes diplômes": "My diplomas", "Avis reçus": "Reviews received",
      "Utilisateurs": "Users", "Litiges": "Disputes", "Modération des diplômes": "Diploma moderation",
      "Le coach de confiance, à portée de clic.": "The trusted coach, one click away.",
      "Trouver mon coach": "Find my coach", "Devenir coach": "Become a coach",
      "Réserver une séance": "Book a session", "Réserver": "Book", "Abonnement mensuel": "Monthly subscription",
      "Contacter": "Contact", "Partager": "Share", "Ajouter aux favoris": "Add to favorites", "Favori": "Favorite",
      "Retiré": "Removed", "Enregistrer": "Save", "Enregistrer les modifications": "Save changes",
      "Annuler": "Cancel", "Confirmer": "Confirm", "Fermer": "Close", "Envoyer": "Send",
      "Envoyer la demande": "Send request", "Continuer": "Continue", "Accepter": "Accept", "Refuser": "Decline",
      "Payer": "Pay", "Valider": "Validate", "Modifier": "Edit", "Supprimer": "Delete", "Voir": "View",
      "Voir le coach": "View coach", "Voir mon profil public": "View my public profile", "Publier": "Publish",
      "Signaler": "Report", "Terminer": "Finish", "Marquer terminée": "Mark completed", "Tout voir": "See all",
      "Tout marquer lu": "Mark all as read", "Plus tard": "Later", "Ajouter": "Add", "Ajouter une photo": "Add a photo",
      "Ajouter un diplôme": "Add a diploma", "Prendre en charge": "Take over", "Marquer résolu": "Mark resolved",
      "Bon retour 👋": "Welcome back 👋", "Email": "Email", "Mot de passe": "Password",
      "Mot de passe oublié ?": "Forgot password?", "Se souvenir de moi": "Remember me",
      "Créer un compte": "Create an account", "Créer mon compte": "Create my account",
      "Pas encore de compte ?": "No account yet?", "Déjà inscrit ?": "Already registered?",
      "Prénom": "First name", "Nom": "Last name", "Téléphone": "Phone", "Nouveau mot de passe 🔒": "New password 🔒",
      "Réinitialiser mon mot de passe": "Reset my password", "Retour à la connexion": "Back to login",
      "Se connecter avec": "Sign in with", "ou": "or",
      "En attente": "Pending", "Confirmée": "Confirmed", "Refusée": "Declined", "Terminée": "Completed",
      "Annulée": "Cancelled", "Actif": "Active", "Confirmées": "Confirmed", "Terminées": "Completed", "Toutes": "All",
      "Rechercher": "Search", "Filtres": "Filters", "Trier": "Sort", "Note": "Rating", "Prix": "Price",
      "Commune": "District", "Ville": "City", "Quartier": "Neighborhood", "Adresse": "Address",
      "Spécialité": "Specialty", "Spécialités": "Specialties", "Langue": "Language", "Objectif": "Goal",
      "Votre objectif": "Your goal", "Fréquence": "Frequency", "Tarification": "Pricing",
      "Perte de poids": "Weight loss", "Prise de masse": "Muscle gain", "Remise en forme": "Getting back in shape",
      "Préparation physique": "Physical preparation", "Bien-être / souplesse": "Wellness / flexibility",
      "Nutrition & suivi": "Nutrition & follow-up", "Salle du coach": "Coach's gym", "À mon domicile": "At my home",
      "Salle proposée": "Suggested gym", "Je propose un prix": "I suggest a price", "Laisser le coach fixer": "Let the coach set it",
      "Utiliser ma position (GPS)": "Use my location (GPS)", "Position enregistrée ✓": "Location saved ✓",
      "Ouvrir dans Google Maps": "Open in Google Maps", "Voir le lieu sur Google Maps": "View location on Google Maps",
      "Prix par séance (FCFA)": "Price per session (FCFA)", "Payer le mois": "Pay the month",
      "Mes abonnements": "My subscriptions", "Aucun abonnement": "No subscription", "Aucune demande": "No requests",
      "Programme proposé": "Program proposed", "En attente du coach": "Awaiting the coach",
      "Préparer le programme": "Prepare the program", "Modifier le programme": "Edit the program",
      "Proposer au client": "Propose to the client", "Programme mensuel": "Monthly program",
      "Numéro": "Number", "Code": "Code", "Opérateur": "Operator", "Paiement réussi 🎉": "Payment successful 🎉",
      "Paiement refusé": "Payment declined", "Connecté": "Logged in", "Chargement…": "Loading…",
      "Aucune conversation": "No conversation", "Aucune notification": "No notification", "Aucun favori": "No favorites",
      "Aucun avis": "No reviews", "Aucune publication": "No posts", "Galerie vide": "Empty gallery",
      "Publier l'avis": "Publish review", "Laisser un avis": "Leave a review", "Évaluer": "Rate",
      "Nouvelle réservation": "New booking", "Continuer vers le paiement": "Continue to payment",
      "Objectifs": "Goals", "Suivant": "Next", "Précédent": "Previous", "Retour": "Back",
      "Bienvenue": "Welcome", "Merci": "Thank you", "Aujourd'hui": "Today", "séance": "session", "séances": "sessions",
      "Coach vérifié": "Verified coach", "Top noté": "Top rated", "Réactif": "Responsive", "Nouveau": "New",
    },
    es: {
      "Accueil": "Inicio", "Trouver un coach": "Encontrar un coach", "Comment ça marche": "Cómo funciona",
      "Connexion": "Iniciar sesión", "S'inscrire": "Registrarse", "Se connecter": "Iniciar sesión",
      "Se déconnecter": "Cerrar sesión", "À bientôt !": "¡Hasta pronto!", "Notifications": "Notificaciones",
      "Notifs": "Avisos", "Messagerie": "Mensajería", "Messages": "Mensajes", "Paramètres": "Ajustes",
      "Tableau de bord": "Panel", "Mes réservations": "Mis reservas", "Mes abonnements": "Mis suscripciones",
      "Mes favoris": "Mis favoritos", "Mes avis": "Mis reseñas", "Espace client": "Área de cliente",
      "Espace coach": "Área de coach", "Demandes": "Solicitudes", "Abonnements": "Suscripciones",
      "Mon profil": "Mi perfil", "Mon mur": "Mi muro", "Ma galerie": "Mi galería", "Disponibilités": "Disponibilidad",
      "Mes disponibilités": "Mi disponibilidad", "Diplômes": "Diplomas", "Mes diplômes": "Mis diplomas",
      "Avis reçus": "Reseñas recibidas", "Utilisateurs": "Usuarios", "Litiges": "Disputas",
      "Modération des diplômes": "Moderación de diplomas",
      "Le coach de confiance, à portée de clic.": "El coach de confianza, a un clic.",
      "Trouver mon coach": "Encontrar mi coach", "Devenir coach": "Hazte coach",
      "Réserver une séance": "Reservar una sesión", "Réserver": "Reservar", "Abonnement mensuel": "Suscripción mensual",
      "Contacter": "Contactar", "Partager": "Compartir", "Ajouter aux favoris": "Añadir a favoritos",
      "Favori": "Favorito", "Retiré": "Eliminado", "Enregistrer": "Guardar", "Enregistrer les modifications": "Guardar cambios",
      "Annuler": "Cancelar", "Confirmer": "Confirmar", "Fermer": "Cerrar", "Envoyer": "Enviar",
      "Envoyer la demande": "Enviar solicitud", "Continuer": "Continuar", "Accepter": "Aceptar", "Refuser": "Rechazar",
      "Payer": "Pagar", "Valider": "Validar", "Modifier": "Editar", "Supprimer": "Eliminar", "Voir": "Ver",
      "Voir le coach": "Ver coach", "Voir mon profil public": "Ver mi perfil público", "Publier": "Publicar",
      "Signaler": "Reportar", "Terminer": "Finalizar", "Marquer terminée": "Marcar completada", "Tout voir": "Ver todo",
      "Tout marquer lu": "Marcar todo leído", "Plus tard": "Más tarde", "Ajouter": "Añadir",
      "Ajouter une photo": "Añadir una foto", "Ajouter un diplôme": "Añadir un diploma",
      "Prendre en charge": "Encargarse", "Marquer résolu": "Marcar resuelto",
      "Bon retour 👋": "Bienvenido de nuevo 👋", "Email": "Correo", "Mot de passe": "Contraseña",
      "Mot de passe oublié ?": "¿Olvidó su contraseña?", "Se souvenir de moi": "Recuérdame",
      "Créer un compte": "Crear una cuenta", "Créer mon compte": "Crear mi cuenta",
      "Pas encore de compte ?": "¿Aún no tiene cuenta?", "Déjà inscrit ?": "¿Ya está registrado?",
      "Prénom": "Nombre", "Nom": "Apellido", "Téléphone": "Teléfono", "Nouveau mot de passe 🔒": "Nueva contraseña 🔒",
      "Réinitialiser mon mot de passe": "Restablecer mi contraseña", "Retour à la connexion": "Volver al inicio de sesión",
      "Se connecter avec": "Iniciar sesión con", "ou": "o",
      "En attente": "Pendiente", "Confirmée": "Confirmada", "Refusée": "Rechazada", "Terminée": "Completada",
      "Annulée": "Cancelada", "Actif": "Activo", "Confirmées": "Confirmadas", "Terminées": "Completadas", "Toutes": "Todas",
      "Rechercher": "Buscar", "Filtres": "Filtros", "Trier": "Ordenar", "Note": "Valoración", "Prix": "Precio",
      "Commune": "Comuna", "Ville": "Ciudad", "Quartier": "Barrio", "Adresse": "Dirección",
      "Spécialité": "Especialidad", "Spécialités": "Especialidades", "Langue": "Idioma", "Objectif": "Objetivo",
      "Votre objectif": "Su objetivo", "Fréquence": "Frecuencia", "Tarification": "Tarifas",
      "Perte de poids": "Pérdida de peso", "Prise de masse": "Ganancia muscular", "Remise en forme": "Ponerse en forma",
      "Préparation physique": "Preparación física", "Bien-être / souplesse": "Bienestar / flexibilidad",
      "Nutrition & suivi": "Nutrición y seguimiento", "Salle du coach": "Sala del coach", "À mon domicile": "En mi domicilio",
      "Salle proposée": "Sala propuesta", "Je propose un prix": "Propongo un precio", "Laisser le coach fixer": "Dejar que el coach decida",
      "Utiliser ma position (GPS)": "Usar mi ubicación (GPS)", "Position enregistrée ✓": "Ubicación guardada ✓",
      "Ouvrir dans Google Maps": "Abrir en Google Maps", "Voir le lieu sur Google Maps": "Ver el lugar en Google Maps",
      "Prix par séance (FCFA)": "Precio por sesión (FCFA)", "Payer le mois": "Pagar el mes",
      "Aucun abonnement": "Sin suscripción", "Aucune demande": "Sin solicitudes", "Programme proposé": "Programa propuesto",
      "En attente du coach": "Esperando al coach", "Préparer le programme": "Preparar el programa",
      "Modifier le programme": "Editar el programa", "Proposer au client": "Proponer al cliente",
      "Programme mensuel": "Programa mensual", "Numéro": "Número", "Code": "Código", "Opérateur": "Operador",
      "Paiement réussi 🎉": "¡Pago realizado 🎉", "Paiement refusé": "Pago rechazado", "Connecté": "Conectado",
      "Chargement…": "Cargando…", "Aucune conversation": "Sin conversaciones", "Aucune notification": "Sin notificaciones",
      "Aucun favori": "Sin favoritos", "Aucun avis": "Sin reseñas", "Aucune publication": "Sin publicaciones",
      "Galerie vide": "Galería vacía", "Publier l'avis": "Publicar reseña", "Laisser un avis": "Dejar una reseña",
      "Évaluer": "Valorar", "Continuer vers le paiement": "Continuar al pago", "Objectifs": "Objetivos",
      "Suivant": "Siguiente", "Précédent": "Anterior", "Retour": "Volver", "Bienvenue": "Bienvenido",
      "Merci": "Gracias", "Aujourd'hui": "Hoy", "séance": "sesión", "séances": "sesiones",
      "Coach vérifié": "Coach verificado", "Top noté": "Mejor valorado", "Réactif": "Reactivo", "Nouveau": "Nuevo",
    },
    de: {
      "Accueil": "Startseite", "Trouver un coach": "Coach finden", "Comment ça marche": "So funktioniert's",
      "Connexion": "Anmelden", "S'inscrire": "Registrieren", "Se connecter": "Anmelden", "Se déconnecter": "Abmelden",
      "À bientôt !": "Bis bald!", "Notifications": "Benachrichtigungen", "Notifs": "Hinweise", "Messagerie": "Nachrichten",
      "Messages": "Nachrichten", "Paramètres": "Einstellungen", "Tableau de bord": "Übersicht",
      "Mes réservations": "Meine Buchungen", "Mes abonnements": "Meine Abos", "Mes favoris": "Meine Favoriten",
      "Mes avis": "Meine Bewertungen", "Espace client": "Kundenbereich", "Espace coach": "Coach-Bereich",
      "Demandes": "Anfragen", "Abonnements": "Abonnements", "Mon profil": "Mein Profil", "Mon mur": "Meine Pinnwand",
      "Ma galerie": "Meine Galerie", "Disponibilités": "Verfügbarkeit", "Mes disponibilités": "Meine Verfügbarkeit",
      "Diplômes": "Diplome", "Mes diplômes": "Meine Diplome", "Avis reçus": "Erhaltene Bewertungen",
      "Utilisateurs": "Benutzer", "Litiges": "Streitfälle", "Modération des diplômes": "Diplom-Moderation",
      "Le coach de confiance, à portée de clic.": "Der Coach Ihres Vertrauens, nur einen Klick entfernt.",
      "Trouver mon coach": "Meinen Coach finden", "Devenir coach": "Coach werden",
      "Réserver une séance": "Sitzung buchen", "Réserver": "Buchen", "Abonnement mensuel": "Monatsabo",
      "Contacter": "Kontaktieren", "Partager": "Teilen", "Ajouter aux favoris": "Zu Favoriten", "Favori": "Favorit",
      "Retiré": "Entfernt", "Enregistrer": "Speichern", "Enregistrer les modifications": "Änderungen speichern",
      "Annuler": "Abbrechen", "Confirmer": "Bestätigen", "Fermer": "Schließen", "Envoyer": "Senden",
      "Envoyer la demande": "Anfrage senden", "Continuer": "Weiter", "Accepter": "Annehmen", "Refuser": "Ablehnen",
      "Payer": "Bezahlen", "Valider": "Bestätigen", "Modifier": "Bearbeiten", "Supprimer": "Löschen", "Voir": "Ansehen",
      "Voir le coach": "Coach ansehen", "Voir mon profil public": "Mein öffentliches Profil ansehen", "Publier": "Veröffentlichen",
      "Signaler": "Melden", "Terminer": "Beenden", "Marquer terminée": "Als beendet markieren", "Tout voir": "Alle ansehen",
      "Tout marquer lu": "Alle als gelesen", "Plus tard": "Später", "Ajouter": "Hinzufügen",
      "Ajouter une photo": "Foto hinzufügen", "Ajouter un diplôme": "Diplom hinzufügen",
      "Prendre en charge": "Übernehmen", "Marquer résolu": "Als gelöst markieren",
      "Bon retour 👋": "Willkommen zurück 👋", "Email": "E-Mail", "Mot de passe": "Passwort",
      "Mot de passe oublié ?": "Passwort vergessen?", "Se souvenir de moi": "Angemeldet bleiben",
      "Créer un compte": "Konto erstellen", "Créer mon compte": "Mein Konto erstellen",
      "Pas encore de compte ?": "Noch kein Konto?", "Déjà inscrit ?": "Bereits registriert?",
      "Prénom": "Vorname", "Nom": "Nachname", "Téléphone": "Telefon", "Nouveau mot de passe 🔒": "Neues Passwort 🔒",
      "Réinitialiser mon mot de passe": "Mein Passwort zurücksetzen", "Retour à la connexion": "Zurück zur Anmeldung",
      "Se connecter avec": "Anmelden mit", "ou": "oder",
      "En attente": "Ausstehend", "Confirmée": "Bestätigt", "Refusée": "Abgelehnt", "Terminée": "Abgeschlossen",
      "Annulée": "Storniert", "Actif": "Aktiv", "Confirmées": "Bestätigt", "Terminées": "Abgeschlossen", "Toutes": "Alle",
      "Rechercher": "Suchen", "Filtres": "Filter", "Trier": "Sortieren", "Note": "Bewertung", "Prix": "Preis",
      "Commune": "Bezirk", "Ville": "Stadt", "Quartier": "Viertel", "Adresse": "Adresse",
      "Spécialité": "Fachgebiet", "Spécialités": "Fachgebiete", "Langue": "Sprache", "Objectif": "Ziel",
      "Votre objectif": "Ihr Ziel", "Fréquence": "Häufigkeit", "Tarification": "Preisgestaltung",
      "Perte de poids": "Gewichtsverlust", "Prise de masse": "Muskelaufbau", "Remise en forme": "Wieder fit werden",
      "Préparation physique": "Körperliche Vorbereitung", "Bien-être / souplesse": "Wohlbefinden / Beweglichkeit",
      "Nutrition & suivi": "Ernährung & Betreuung", "Salle du coach": "Studio des Coaches", "À mon domicile": "Bei mir zu Hause",
      "Salle proposée": "Vorgeschlagenes Studio", "Je propose un prix": "Ich schlage einen Preis vor", "Laisser le coach fixer": "Den Coach entscheiden lassen",
      "Utiliser ma position (GPS)": "Meinen Standort verwenden (GPS)", "Position enregistrée ✓": "Standort gespeichert ✓",
      "Ouvrir dans Google Maps": "In Google Maps öffnen", "Voir le lieu sur Google Maps": "Ort in Google Maps ansehen",
      "Prix par séance (FCFA)": "Preis pro Sitzung (FCFA)", "Payer le mois": "Monat bezahlen",
      "Aucun abonnement": "Kein Abo", "Aucune demande": "Keine Anfragen", "Programme proposé": "Programm vorgeschlagen",
      "En attente du coach": "Warten auf den Coach", "Préparer le programme": "Programm vorbereiten",
      "Modifier le programme": "Programm bearbeiten", "Proposer au client": "Dem Kunden vorschlagen",
      "Programme mensuel": "Monatsprogramm", "Numéro": "Nummer", "Code": "Code", "Opérateur": "Anbieter",
      "Paiement réussi 🎉": "Zahlung erfolgreich 🎉", "Paiement refusé": "Zahlung abgelehnt", "Connecté": "Angemeldet",
      "Chargement…": "Laden…", "Aucune conversation": "Keine Unterhaltung", "Aucune notification": "Keine Benachrichtigung",
      "Aucun favori": "Keine Favoriten", "Aucun avis": "Keine Bewertungen", "Aucune publication": "Keine Beiträge",
      "Galerie vide": "Leere Galerie", "Publier l'avis": "Bewertung veröffentlichen", "Laisser un avis": "Bewertung abgeben",
      "Évaluer": "Bewerten", "Continuer vers le paiement": "Weiter zur Zahlung", "Objectifs": "Ziele",
      "Suivant": "Weiter", "Précédent": "Zurück", "Retour": "Zurück", "Bienvenue": "Willkommen",
      "Merci": "Danke", "Aujourd'hui": "Heute", "séance": "Sitzung", "séances": "Sitzungen",
      "Coach vérifié": "Verifizierter Coach", "Top noté": "Top bewertet", "Réactif": "Reaktionsschnell", "Nouveau": "Neu",
    },
  };

  let langue = "fr";
  let observer = null;
  const ATTRS = ["placeholder", "title", "aria-label", "alt"];

  /** Traduit une chaîne (repli null si aucune correspondance / langue FR). */
  function trad(txt) {
    if (langue === "fr" || typeof txt !== "string") return null;
    const map = T[langue]; if (!map) return null;
    const cle = txt.trim();
    if (cle.length < 2) return null;
    const rep = map[cle];
    if (!rep || rep === cle) return null;
    return txt.replace(cle, rep); // préserve les espaces autour
  }

  function traduireElement(root) {
    if (langue === "fr" || !root) return;
    if (root.nodeType === 3) { const t = trad(root.nodeValue); if (t !== null) root.nodeValue = t; return; }
    if (root.nodeType !== 1) return;
    // Attributs
    const cibles = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
    cibles.forEach((e) => {
      ATTRS.forEach((a) => {
        if (e.hasAttribute && e.hasAttribute(a)) { const t = trad(e.getAttribute(a)); if (t !== null) e.setAttribute(a, t); }
      });
    });
    // Nœuds texte
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const noeuds = []; let n;
    while ((n = walker.nextNode())) noeuds.push(n);
    noeuds.forEach((node) => { const t = trad(node.nodeValue); if (t !== null) node.nodeValue = t; });
  }

  function traduirePage() { traduireElement(document.body); }

  const i18n = {
    langues: Object.keys(LANGUES),
    noms: LANGUES,
    drapeaux: DRAPEAUX,
    langue() { return langue; },
    nom() { return LANGUES[langue]; },
    drapeau() { return DRAPEAUX[langue]; },

    /** Change la langue : reconstruit l'interface (source FR) puis traduit. */
    definirLangue(code) {
      if (!LANGUES[code] || code === langue) return;
      langue = code;
      try { localStorage.setItem("cl_langue", code); } catch (_) {}
      document.documentElement.lang = code;
      if (CL.layout && CL.layout.rendreEntete) CL.layout.rendreEntete();
      if (CL.router && CL.router.rendre) CL.router.rendre();
      setTimeout(traduirePage, 0);
    },

    /** Compat : renvoie le texte source (traduit ensuite par la couche DOM). */
    t(cle, remplacements) {
      let texte = cle;
      if (remplacements) for (const [k, v] of Object.entries(remplacements)) texte = texte.replace(new RegExp("{" + k + "}", "g"), v);
      return texte;
    },

    traduirePage,

    init() {
      try { const s = localStorage.getItem("cl_langue"); if (s && LANGUES[s]) langue = s; } catch (_) {}
      document.documentElement.lang = langue;
      // Suit les ajouts DOM (modales, toasts, navigation) pour les traduire.
      observer = new MutationObserver((mutations) => {
        if (langue === "fr") return;
        mutations.forEach((m) => {
          m.addedNodes && m.addedNodes.forEach((nd) => traduireElement(nd));
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
      if (langue !== "fr") setTimeout(traduirePage, 0);
    },
  };

  CL.i18n = i18n;
})();
