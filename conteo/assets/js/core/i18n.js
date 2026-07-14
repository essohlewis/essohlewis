/* Conteo — Chaînes d'interface (français uniquement pour le MVP).
 * Structure extensible si d'autres langues d'interface sont ajoutées. */

const fr = {
  app_name: 'Conteo',
  tap_to_start: 'Touche pour commencer',
  choose_child: 'Qui veut écouter une histoire ?',
  add_child: 'Ajouter',
  library: 'Bibliothèque',
  bedtime: 'Conte du soir',
  my_stories: 'Mes histoires',
  parent_space: 'Espace parent',
  back: 'Retour',
  play: 'Écouter',
  pause: 'Pause',
  next: 'Suivant',
  prev: 'Précédent',
  replay_sentence: 'Répéter la phrase',
  new: 'nouveau',
  already_read: 'déjà lu',
  to_download: 'à télécharger',
  locked: 'verrouillé',
  well_done: 'Bravo !',
  try_again: 'Essaie encore',
  play_again: 'Rejouer',
  continue: 'Continuer',
  see_you_tomorrow: 'À demain !',
  time_up: "C'est l'heure de se reposer. Rendez-vous demain !",
  // Parent
  dashboard: 'Tableau de bord',
  profiles: 'Profils',
  downloads: 'Téléchargements',
  shop: 'Boutique',
  settings: 'Paramètres',
  backup: 'Sauvegarde',
  screen_time: "Temps d'écran",
  tales_read: 'Contes lus',
  words_found: 'Mots découverts',
  gate_prompt: 'Réponds pour continuer',
  wrong_answer: 'Réponse incorrecte',
  free: 'Gratuit',
  buy: 'Acheter',
  redeem_code: 'Entrer un code',
  export_backup: 'Exporter mes données',
  import_backup: 'Importer des données',
  delete: 'Supprimer',
  owned: 'Débloqué'
};

const dict = { fr };
let current = 'fr';

export function t(key) { return (dict[current] && dict[current][key]) || key; }
export function setLang(code) { if (dict[code]) current = code; }
