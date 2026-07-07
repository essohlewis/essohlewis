/* =====================================================================
   i18n.js — Multilingue (FR par défaut + EN), extensible
   ---------------------------------------------------------------------
   Ajouter une langue = ajouter une clé (ex. `es`) dans STRINGS.
   Les éléments HTML portent un attribut `data-i18n="clé"`.
   Pour les attributs : `data-i18n-attr="placeholder:clé"`.
   ===================================================================== */

const STRINGS = {
  fr: {
    // Nav
    'nav.home': 'Accueil', 'nav.predictions': 'Pronostics', 'nav.sports': 'Sports',
    'nav.pricing': 'Tarifs', 'nav.login': 'Connexion', 'nav.signup': "S'inscrire",
    // Hero
    'hero.badge': 'Propulsé par l\'IA · Mis à jour chaque jour',
    'hero.title1': "L'IA qui prédit ", 'hero.titleHi': 'vos victoires',
    'hero.lead': "Des pronostics sportifs quotidiens de haute précision sur les plus grandes compétitions d'Europe, d'Afrique, d'Asie et d'Amérique — générés par notre moteur d'intelligence artificielle.",
    'hero.cta1': 'Recevoir mes pronostics du jour', 'hero.cta2': 'Voir comment ça marche',
    'stat.winrate': 'Taux de réussite', 'stat.perday': 'Pronostics / jour', 'stat.members': 'Membres actifs',
    // Preview
    'preview.badge': 'Aperçu du jour', 'preview.title': 'Les pronostics du jour',
    'preview.sub': "Un échantillon de ce que notre IA génère chaque matin. Inscrivez-vous pour tout débloquer.",
    'preview.locked': 'Débloquez ce pronostic', 'preview.unlock': 'Créer un compte gratuit',
    // Sports
    'sports.badge': 'Couverture mondiale', 'sports.title': 'Tous les sports, toutes les régions',
    'sports.sub': "Football, basketball, cricket… nous couvrons les compétitions les plus populaires des quatre continents.",
    // How
    'how.badge': 'Simple et rapide', 'how.title': 'Comment ça marche',
    'how.sub': "Quatre étapes pour transformer la donnée en décisions éclairées.",
    'how.s1t': 'Inscription', 'how.s1d': 'Créez votre compte gratuit en moins de 30 secondes.',
    'how.s2t': "L'IA analyse", 'how.s2d': 'Notre moteur traite des milliers de données par match.',
    'how.s3t': 'Réception quotidienne', 'how.s3d': 'Recevez vos pronostics chaque matin sur votre tableau de bord.',
    'how.s4t': 'Suivi des résultats', 'how.s4d': 'Suivez vos performances et votre taux de réussite en temps réel.',
    // Why
    'why.badge': 'Notre technologie', 'why.title': 'Pourquoi notre IA fait la différence',
    'why.sub': "Un moteur nourri de données, entraîné à repérer la valeur là où d'autres voient du hasard.",
    'why.f1t': 'Analyse de données massives', 'why.f1d': 'Des millions de statistiques traitées : forme, historiques, blessures, météo.',
    'why.f2t': 'Modèle probabiliste', 'why.f2d': 'Chaque pronostic est assorti d\'un niveau de confiance calculé.',
    'why.f3t': 'Détection de valeur', 'why.f3d': 'Nous identifions les cotes sous-évaluées par les bookmakers.',
    'why.f4t': 'Apprentissage continu', 'why.f4d': 'Le modèle s\'améliore à chaque résultat pour affiner ses prédictions.',
    // Proof
    'proof.badge': 'Preuve sociale', 'proof.title': 'Des résultats qui parlent',
    'proof.chart': "Taux de réussite sur 12 mois",
    // Pricing
    'pricing.badge': 'Tarifs', 'pricing.title': 'Choisissez votre plan',
    'pricing.sub': 'Commencez gratuitement, passez au niveau supérieur quand vous êtes prêt.',
    'pricing.monthly': 'Mensuel', 'pricing.yearly': 'Annuel', 'pricing.save': '-20%',
    'plan.free': 'Gratuit', 'plan.premium': 'Premium', 'plan.vip': 'VIP', 'plan.popular': 'Le plus populaire',
    'plan.freeDesc': 'Pour découvrir la plateforme.', 'plan.premiumDesc': 'Pour les parieurs réguliers.',
    'plan.vipDesc': 'Accès total, sans limite.',
    'plan.choose': 'Choisir ce plan', 'plan.current': 'Plan actuel', 'plan.perMonth': '/mois', 'plan.perYear': '/an', 'plan.free0': 'Gratuit',
    // FAQ
    'faq.badge': 'Questions', 'faq.title': 'Questions fréquentes',
    // CTA
    'cta.title': 'Prêt à passer au niveau supérieur ?', 'cta.sub': "Rejoignez des milliers de membres qui font confiance à notre IA chaque jour.",
    'cta.btn': 'Commencer gratuitement',
    // Footer
    'footer.tagline': "L'intelligence artificielle au service de vos pronostics sportifs.",
    'footer.product': 'Produit', 'footer.company': 'Entreprise', 'footer.legal': 'Légal',
    'footer.responsible': 'Les paris comportent des risques.', 'footer.responsible2': 'Interdit aux moins de 18 ans. Jouez de manière responsable.',
    'footer.rights': 'Tous droits réservés.',
    // Auth
    'auth.asideTitle': "Rejoignez l'élite des pronostics IA",
    'auth.asideLead': "Accédez chaque jour à des analyses générées par notre moteur d'intelligence artificielle.",
    'auth.login': 'Connexion', 'auth.signup': 'Inscription', 'auth.back': "Retour à l'accueil",
    'auth.name': 'Nom complet', 'auth.email': 'Adresse e-mail', 'auth.password': 'Mot de passe',
    'auth.confirm': 'Confirmer le mot de passe', 'auth.remember': 'Se souvenir de moi', 'auth.forgot': 'Mot de passe oublié ?',
    'auth.loginBtn': 'Se connecter', 'auth.signupBtn': 'Créer mon compte',
    'auth.namePh': 'Jean Dupont', 'auth.emailPh': 'vous@exemple.com', 'auth.pwPh': '••••••••',
    'auth.terms': "En vous inscrivant, vous acceptez nos conditions. Réservé aux 18+.",
    // Dashboard
    'dash.today': 'Pronostics du jour', 'dash.sports': 'Sports', 'dash.history': 'Historique',
    'dash.stats': 'Statistiques', 'dash.subscription': 'Abonnement', 'dash.settings': 'Paramètres',
    'dash.welcome': 'Bonjour', 'dash.todaySub': 'Voici les pronostics générés par l\'IA aujourd\'hui.',
    'dash.filterSport': 'Tous les sports', 'dash.filterRegion': 'Toutes les régions',
    'dash.filterLeague': 'Toutes les ligues', 'dash.filterConf': 'Toute confiance',
    'dash.confHigh': 'Confiance élevée (80%+)', 'dash.confMid': 'Confiance moyenne (65-80%)', 'dash.confLow': 'Confiance faible (<65%)',
    'dash.results': 'pronostics', 'dash.loading': 'Chargement des pronostics…',
    'dash.empty': 'Aucun pronostic ne correspond à ces filtres.',
    'dash.kpiWinrate': 'Taux de réussite', 'dash.kpiTracked': 'Pronostics suivis', 'dash.kpiStreak': 'Série en cours', 'dash.kpiRoi': 'ROI mensuel',
    'dash.perfTitle': 'Évolution du taux de réussite', 'dash.bestSports': 'Meilleurs sports',
    'dash.histTitle': 'Historique des pronostics', 'dash.upgrade': 'Passer Premium',
    'dash.upsellTitle': 'Débloquez tout', 'dash.upsellText': 'Accédez à 100% des pronostics VIP.',
    'dash.currentPlan': 'Votre abonnement', 'dash.planActive': 'Actif · renouvellement le 07/08/2026',
    'dash.logout': 'Déconnexion', 'dash.settingsTitle': 'Préférences',
    'dash.setTheme': 'Thème sombre', 'dash.setThemeD': 'Basculer entre le mode clair et sombre.',
    'dash.setNotif': 'Notifications', 'dash.setNotifD': 'Recevoir les pronostics par notification.',
    'dash.setLang': 'Langue', 'dash.setLangD': 'Langue de l\'interface.',
    'col.match': 'Match', 'col.league': 'Ligue', 'col.pred': 'Pronostic', 'col.conf': 'Confiance', 'col.odds': 'Cote', 'col.result': 'Résultat',
    'status.upcoming': 'À venir', 'status.live': 'En direct', 'status.won': 'Gagné', 'status.lost': 'Perdu',
    'conf.ai': 'Confiance IA',
  },
  en: {
    'nav.home': 'Home', 'nav.predictions': 'Predictions', 'nav.sports': 'Sports',
    'nav.pricing': 'Pricing', 'nav.login': 'Log in', 'nav.signup': 'Sign up',
    'hero.badge': 'AI-powered · Updated daily',
    'hero.title1': 'The AI that predicts ', 'hero.titleHi': 'your wins',
    'hero.lead': "High-accuracy daily sports predictions across the biggest competitions in Europe, Africa, Asia and America — generated by our artificial-intelligence engine.",
    'hero.cta1': 'Get my picks of the day', 'hero.cta2': 'See how it works',
    'stat.winrate': 'Win rate', 'stat.perday': 'Predictions / day', 'stat.members': 'Active members',
    'preview.badge': "Today's preview", 'preview.title': "Today's predictions",
    'preview.sub': 'A sample of what our AI generates every morning. Sign up to unlock everything.',
    'preview.locked': 'Unlock this prediction', 'preview.unlock': 'Create a free account',
    'sports.badge': 'Global coverage', 'sports.title': 'Every sport, every region',
    'sports.sub': 'Football, basketball, cricket… we cover the most popular competitions across four continents.',
    'how.badge': 'Simple and fast', 'how.title': 'How it works',
    'how.sub': 'Four steps to turn data into informed decisions.',
    'how.s1t': 'Sign up', 'how.s1d': 'Create your free account in under 30 seconds.',
    'how.s2t': 'AI analyses', 'how.s2d': 'Our engine processes thousands of data points per match.',
    'how.s3t': 'Daily delivery', 'how.s3d': 'Get your predictions every morning on your dashboard.',
    'how.s4t': 'Track results', 'how.s4d': 'Follow your performance and win rate in real time.',
    'why.badge': 'Our technology', 'why.title': 'Why our AI makes the difference',
    'why.sub': 'An engine fed by data, trained to spot value where others see randomness.',
    'why.f1t': 'Massive data analysis', 'why.f1d': 'Millions of stats processed: form, history, injuries, weather.',
    'why.f2t': 'Probabilistic model', 'why.f2d': 'Every prediction comes with a calculated confidence level.',
    'why.f3t': 'Value detection', 'why.f3d': 'We identify odds undervalued by bookmakers.',
    'why.f4t': 'Continuous learning', 'why.f4d': 'The model improves with every result to sharpen its predictions.',
    'proof.badge': 'Social proof', 'proof.title': 'Results that speak',
    'proof.chart': 'Win rate over 12 months',
    'pricing.badge': 'Pricing', 'pricing.title': 'Choose your plan',
    'pricing.sub': 'Start free, level up when you are ready.',
    'pricing.monthly': 'Monthly', 'pricing.yearly': 'Yearly', 'pricing.save': '-20%',
    'plan.free': 'Free', 'plan.premium': 'Premium', 'plan.vip': 'VIP', 'plan.popular': 'Most popular',
    'plan.freeDesc': 'To discover the platform.', 'plan.premiumDesc': 'For regular bettors.',
    'plan.vipDesc': 'Full access, no limits.',
    'plan.choose': 'Choose this plan', 'plan.current': 'Current plan', 'plan.perMonth': '/mo', 'plan.perYear': '/yr', 'plan.free0': 'Free',
    'faq.badge': 'Questions', 'faq.title': 'Frequently asked questions',
    'cta.title': 'Ready to level up?', 'cta.sub': 'Join thousands of members who trust our AI every day.',
    'cta.btn': 'Start for free',
    'footer.tagline': 'Artificial intelligence at the service of your sports predictions.',
    'footer.product': 'Product', 'footer.company': 'Company', 'footer.legal': 'Legal',
    'footer.responsible': 'Betting involves risk.', 'footer.responsible2': 'Not for under-18s. Please gamble responsibly.',
    'footer.rights': 'All rights reserved.',
    'auth.asideTitle': 'Join the elite of AI predictions',
    'auth.asideLead': 'Access daily analysis generated by our artificial-intelligence engine.',
    'auth.login': 'Log in', 'auth.signup': 'Sign up', 'auth.back': 'Back to home',
    'auth.name': 'Full name', 'auth.email': 'Email address', 'auth.password': 'Password',
    'auth.confirm': 'Confirm password', 'auth.remember': 'Remember me', 'auth.forgot': 'Forgot password?',
    'auth.loginBtn': 'Log in', 'auth.signupBtn': 'Create my account',
    'auth.namePh': 'John Doe', 'auth.emailPh': 'you@example.com', 'auth.pwPh': '••••••••',
    'auth.terms': 'By signing up, you accept our terms. 18+ only.',
    'dash.today': "Today's picks", 'dash.sports': 'Sports', 'dash.history': 'History',
    'dash.stats': 'Statistics', 'dash.subscription': 'Subscription', 'dash.settings': 'Settings',
    'dash.welcome': 'Hello', 'dash.todaySub': "Here are today's AI-generated predictions.",
    'dash.filterSport': 'All sports', 'dash.filterRegion': 'All regions',
    'dash.filterLeague': 'All leagues', 'dash.filterConf': 'Any confidence',
    'dash.confHigh': 'High confidence (80%+)', 'dash.confMid': 'Medium confidence (65-80%)', 'dash.confLow': 'Low confidence (<65%)',
    'dash.results': 'predictions', 'dash.loading': 'Loading predictions…',
    'dash.empty': 'No prediction matches these filters.',
    'dash.kpiWinrate': 'Win rate', 'dash.kpiTracked': 'Tracked picks', 'dash.kpiStreak': 'Current streak', 'dash.kpiRoi': 'Monthly ROI',
    'dash.perfTitle': 'Win rate evolution', 'dash.bestSports': 'Best sports',
    'dash.histTitle': 'Predictions history', 'dash.upgrade': 'Go Premium',
    'dash.upsellTitle': 'Unlock everything', 'dash.upsellText': 'Access 100% of VIP predictions.',
    'dash.currentPlan': 'Your subscription', 'dash.planActive': 'Active · renews 07/08/2026',
    'dash.logout': 'Log out', 'dash.settingsTitle': 'Preferences',
    'dash.setTheme': 'Dark theme', 'dash.setThemeD': 'Toggle between light and dark mode.',
    'dash.setNotif': 'Notifications', 'dash.setNotifD': 'Receive predictions by notification.',
    'dash.setLang': 'Language', 'dash.setLangD': 'Interface language.',
    'col.match': 'Match', 'col.league': 'League', 'col.pred': 'Prediction', 'col.conf': 'Confidence', 'col.odds': 'Odds', 'col.result': 'Result',
    'status.upcoming': 'Upcoming', 'status.live': 'Live', 'status.won': 'Won', 'status.lost': 'Lost',
    'conf.ai': 'AI confidence',
  },
};

const I18N = {
  lang: 'fr',

  init() {
    this.lang = localStorage.getItem('pronos-lang') || 'fr';
    document.documentElement.lang = this.lang;
    this.apply();
    // Synchroniser tous les sélecteurs de langue de la page
    document.querySelectorAll('[data-lang-select]').forEach((sel) => {
      sel.value = this.lang;
      sel.addEventListener('change', (e) => this.set(e.target.value));
    });
  },

  t(key) {
    return (STRINGS[this.lang] && STRINGS[this.lang][key]) || STRINGS.fr[key] || key;
  },

  set(lang) {
    if (!STRINGS[lang]) return;
    this.lang = lang;
    localStorage.setItem('pronos-lang', lang);
    document.documentElement.lang = lang;
    this.apply();
    document.querySelectorAll('[data-lang-select]').forEach((s) => (s.value = lang));
    // Notifier les modules dynamiques (ex. re-rendu des cartes)
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  },

  apply(root = document) {
    // Texte
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = this.t(el.getAttribute('data-i18n'));
    });
    // Attributs : data-i18n-attr="placeholder:auth.emailPh"
    root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.getAttribute('data-i18n-attr').split(',').forEach((pair) => {
        const [attr, key] = pair.split(':');
        if (attr && key) el.setAttribute(attr.trim(), this.t(key.trim()));
      });
    });
  },
};

window.I18N = I18N;
document.addEventListener('DOMContentLoaded', () => I18N.init());
