<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Téléversement d'images (photos d'étal, de produits).
 * Types autorisés : jpg, png, webp ; taille max ~3 Mo.
 */
trait TeleverseImage
{
    protected function televerserImage(string $champ, string $prefixe): ?string
    {
        if (empty($_FILES[$champ]['tmp_name']) || $_FILES[$champ]['error'] !== UPLOAD_ERR_OK) {
            return null;
        }
        $extensionsOk = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        $mime = mime_content_type($_FILES[$champ]['tmp_name']) ?: '';
        if (!isset($extensionsOk[$mime]) || $_FILES[$champ]['size'] > 3_000_000) {
            return null;
        }
        $nom = $prefixe . '_' . bin2hex(random_bytes(6)) . '.' . $extensionsOk[$mime];
        if (move_uploaded_file($_FILES[$champ]['tmp_name'], UPLOAD_PATH . '/' . $nom)) {
            return 'uploads/' . $nom;
        }
        return null;
    }
}
