<?php

declare(strict_types=1);

namespace Transouscris\Core\Exceptions;

use RuntimeException;

/**
 * Exception portant un code de statut HTTP, capturée par le noyau pour
 * rendre la page d'erreur appropriée.
 */
class HttpException extends RuntimeException
{
    public function __construct(
        private readonly int $statusCode = 500,
        string $message = '',
        ?\Throwable $previous = null
    ) {
        parent::__construct($message ?: self::defaultMessage($statusCode), 0, $previous);
    }

    public function statusCode(): int
    {
        return $this->statusCode;
    }

    private static function defaultMessage(int $code): string
    {
        return match ($code) {
            400 => 'Requête invalide.',
            401 => 'Authentification requise.',
            403 => 'Accès refusé.',
            404 => 'Ressource introuvable.',
            405 => 'Méthode non autorisée.',
            419 => 'Jeton de session expiré.',
            422 => 'Données non valides.',
            429 => 'Trop de requêtes.',
            default => 'Erreur serveur.',
        };
    }
}
