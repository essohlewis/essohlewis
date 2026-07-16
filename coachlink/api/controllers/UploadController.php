<?php
/* ==========================================================================
   controllers/UploadController.php — Téléversement de fichiers (multipart).
   Remplace le stockage data-URL du front par de vrais fichiers servis par URL.
   ========================================================================== */

class UploadController
{
    private const TYPES = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
        'application/pdf' => 'pdf', // pour les diplômes
    ];

    /** POST /uploads  (champ "fichier", multipart/form-data) — auth requise. */
    public function televerser(array $params): void
    {
        Auth::exiger();

        if (empty($_FILES['fichier']) || $_FILES['fichier']['error'] !== UPLOAD_ERR_OK) {
            Response::erreur('Aucun fichier reçu (champ "fichier").', 422);
        }
        $f = $_FILES['fichier'];

        if ($f['size'] > App::config('max_upload')) {
            Response::erreur('Fichier trop lourd.', 422);
        }

        // Détecte le vrai type MIME (ne pas se fier au nom).
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
        if (!isset(self::TYPES[$mime])) {
            Response::erreur('Type de fichier non autorisé (' . $mime . ').', 422);
        }

        $ext = self::TYPES[$mime];
        $nom = bin2hex(random_bytes(16)) . '.' . $ext;
        $dossier = rtrim(App::config('uploads_dir'), '/');
        if (!is_dir($dossier)) {
            mkdir($dossier, 0775, true);
        }
        $cible = $dossier . '/' . $nom;

        if (!move_uploaded_file($f['tmp_name'], $cible)) {
            // Repli pour environnements de test (serveur intégré).
            if (!rename($f['tmp_name'], $cible)) {
                Response::erreur('Échec de l\'enregistrement du fichier.', 500);
            }
        }

        $url = rtrim(App::config('uploads_url'), '/') . '/' . $nom;
        Response::ok(['url' => $url, 'nom' => $nom, 'mime' => $mime], 201);
    }
}
