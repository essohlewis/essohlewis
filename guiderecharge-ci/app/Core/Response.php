<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Aide à la construction des réponses HTTP (statut, en-têtes, JSON, redirection).
 */
final class Response
{
    /** Envoie les en-têtes de sécurité communs à toutes les réponses. */
    public static function securityHeaders(): void
    {
        header('X-Frame-Options: DENY');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        // CSP de base : ressources locales uniquement, styles/inline autorisés
        // pour le thème et les micro-interactions, images data: pour les icônes.
        header(
            "Content-Security-Policy: default-src 'self'; "
            . "img-src 'self' data:; "
            . "style-src 'self' 'unsafe-inline'; "
            . "script-src 'self'; "
            . "connect-src 'self'; "
            . "base-uri 'self'; "
            . "form-action 'self'"
        );
    }

    /** Définit le code de statut HTTP. */
    public static function status(int $code): void
    {
        http_response_code($code);
    }

    /**
     * Émet une réponse JSON puis termine le script.
     *
     * @param array<string, mixed>|list<mixed> $data
     */
    public static function json(array $data, int $status = 200): never
    {
        self::status($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /** Redirige vers un chemin interne (préfixé par BASE_URL). */
    public static function redirect(string $path): never
    {
        $location = str_starts_with($path, 'http') ? $path : BASE_URL . $path;
        header('Location: ' . $location);
        exit;
    }
}
