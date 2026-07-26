<?php
declare(strict_types=1);

namespace Amoura\Core\Security;

/**
 * Nonce CSP par requête (feuille de route — Sprint +1, durcissement).
 * Une seule valeur aléatoire est générée par requête : elle est injectée à la
 * fois dans l'en-tête Content-Security-Policy et dans chaque balise <script>
 * inline autorisée, permettant de supprimer 'unsafe-inline'.
 */
final class Nonce
{
    private static ?string $value = null;

    public static function get(): string
    {
        if (self::$value === null) {
            self::$value = base64_encode(random_bytes(16));
        }
        return self::$value;
    }

    /** Attribut prêt à insérer : nonce="..." */
    public static function attr(): string
    {
        return 'nonce="' . htmlspecialchars(self::get(), ENT_QUOTES) . '"';
    }
}
