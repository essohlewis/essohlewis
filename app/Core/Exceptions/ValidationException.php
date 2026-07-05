<?php

declare(strict_types=1);

namespace Transouscris\Core\Exceptions;

/**
 * Levée lorsqu'une validation échoue. Porte le détail des erreurs par champ.
 */
final class ValidationException extends HttpException
{
    /** @param array<string, string[]> $errors */
    public function __construct(private readonly array $errors, string $message = 'Données non valides.')
    {
        parent::__construct(422, $message);
    }

    /** @return array<string, string[]> */
    public function errors(): array
    {
        return $this->errors;
    }
}
