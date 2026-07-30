<?php
declare(strict_types=1);

namespace Amoura\Core\Security;

/**
 * Validation d'entrées par règles déclaratives.
 * Ex: (new Validator($data))->require('email')->email('email')->min('password', 8)
 */
final class Validator
{
    private array $data;
    private array $errors = [];

    public function __construct(array $data)
    {
        $this->data = $data;
    }

    private function value(string $field): mixed
    {
        return $this->data[$field] ?? null;
    }

    public function require(string $field, ?string $message = null): self
    {
        $v = $this->value($field);
        if ($v === null || (is_string($v) && trim($v) === '')) {
            $this->errors[$field][] = $message ?? "Le champ « {$field} » est requis.";
        }
        return $this;
    }

    public function email(string $field): self
    {
        $v = $this->value($field);
        if ($v !== null && $v !== '' && !filter_var($v, FILTER_VALIDATE_EMAIL)) {
            $this->errors[$field][] = 'Adresse email invalide.';
        }
        return $this;
    }

    /** Numéro de téléphone : 8 à 15 chiffres après retrait des séparateurs (E.164). */
    public function phone(string $field): self
    {
        $v = $this->value($field);
        if ($v !== null && $v !== '') {
            $digits = preg_replace('/\D/', '', (string) $v) ?? '';
            if (strlen($digits) < 8 || strlen($digits) > 15) {
                $this->errors[$field][] = 'Numéro de téléphone invalide.';
            }
        }
        return $this;
    }

    public function min(string $field, int $length): self
    {
        $v = (string) $this->value($field);
        if ($v !== '' && mb_strlen($v) < $length) {
            $this->errors[$field][] = "Minimum {$length} caractères.";
        }
        return $this;
    }

    public function max(string $field, int $length): self
    {
        $v = (string) $this->value($field);
        if (mb_strlen($v) > $length) {
            $this->errors[$field][] = "Maximum {$length} caractères.";
        }
        return $this;
    }

    public function in(string $field, array $allowed): self
    {
        $v = $this->value($field);
        if ($v !== null && $v !== '' && !in_array($v, $allowed, true)) {
            $this->errors[$field][] = 'Valeur non autorisée.';
        }
        return $this;
    }

    /** Mot de passe robuste : longueur + variété de caractères. */
    public function strongPassword(string $field): self
    {
        $v = (string) $this->value($field);
        if ($v !== '') {
            if (mb_strlen($v) < 8) {
                $this->errors[$field][] = 'Le mot de passe doit contenir au moins 8 caractères.';
            }
            if (!preg_match('/[A-Za-z]/', $v) || !preg_match('/\d/', $v)) {
                $this->errors[$field][] = 'Le mot de passe doit mêler lettres et chiffres.';
            }
        }
        return $this;
    }

    /** Vérifie l'âge minimum à partir d'une date de naissance (Y-m-d). */
    public function minAge(string $field, int $minAge): self
    {
        $v = (string) $this->value($field);
        if ($v !== '') {
            $dob = \DateTime::createFromFormat('Y-m-d', $v);
            if (!$dob) {
                $this->errors[$field][] = 'Date de naissance invalide.';
            } else {
                $age = (new \DateTime())->diff($dob)->y;
                if ($age < $minAge) {
                    $this->errors[$field][] = "Vous devez avoir au moins {$minAge} ans.";
                }
            }
        }
        return $this;
    }

    public function matches(string $field, string $otherField): self
    {
        if ($this->value($field) !== $this->value($otherField)) {
            $this->errors[$field][] = 'Les valeurs ne correspondent pas.';
        }
        return $this;
    }

    public function passes(): bool { return empty($this->errors); }
    public function fails(): bool { return !$this->passes(); }
    public function errors(): array { return $this->errors; }
    public function firstError(): ?string
    {
        foreach ($this->errors as $fieldErrors) {
            return $fieldErrors[0] ?? null;
        }
        return null;
    }
}
