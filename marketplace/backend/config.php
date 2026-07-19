<?php
/**
 * config.php — Configuration du backend de vérification (KYC).
 * Backend PHP « pur » (aucun framework). PHP 8+ requis (PDO SQLite + GD).
 */

// Répertoire des données (base SQLite + images téléversées).
define('DATA_DIR', __DIR__ . '/data');
define('UPLOAD_DIR', DATA_DIR . '/uploads');
define('DB_PATH', DATA_DIR . '/kyc.sqlite');

// Jeton d'administration (à changer en production).
// Le front l'envoie dans l'en-tête X-Admin-Token pour les actions admin.
define('ADMIN_TOKEN', getenv('KYC_ADMIN_TOKEN') ?: 'admin-demo-token');

// Taille maximale d'une image reçue (base64 décodé), en octets.
define('MAX_IMAGE_BYTES', 3 * 1024 * 1024); // 3 Mo

// Service externe OPTIONNEL de reconnaissance faciale (biométrie réelle).
// Laisser vide => la comparaison automatique se limite à une heuristique
// d'assistance et la décision finale revient à l'administrateur.
// S'il est défini, le backend POST {idImage, selfie} en JSON et attend
// une réponse JSON { "match": true|false, "score": 0..100 }.
define('FACE_MATCH_URL', getenv('KYC_FACE_MATCH_URL') ?: '');

// Seuil de similarité (heuristique) au-dessus duquel on considère la
// vérification « probable » (indicatif — n'auto-valide jamais seul).
define('SIMILARITY_HINT_THRESHOLD', 62);
