<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Validateur simple à règles. Accumule les erreurs par champ.
 *
 * Règles : required, string, int, min:n, max:n, in:a,b,c, phone, email,
 *          digits:n, bool.
 */
final class Validator
{
    /** @var array<string,string[]> */
    private array $errors = [];

    /**
     * @param array<string,mixed>  $data
     * @param array<string,string> $rules  ex : ['phone' => 'required|phone']
     */
    public function __construct(private array $data, private array $rules)
    {
    }

    public function passes(): bool
    {
        foreach ($this->rules as $field => $ruleset) {
            $value = $this->data[$field] ?? null;
            foreach (explode('|', $ruleset) as $rule) {
                $this->applyRule($field, $value, $rule);
            }
        }
        return $this->errors === [];
    }

    public function fails(): bool
    {
        return !$this->passes();
    }

    /** @return array<string,string[]> */
    public function errors(): array
    {
        return $this->errors;
    }

    private function applyRule(string $field, mixed $value, string $rule): void
    {
        [$name, $arg] = array_pad(explode(':', $rule, 2), 2, null);
        $present = $value !== null && $value !== '';

        switch ($name) {
            case 'required':
                if (!$present) {
                    $this->add($field, 'Ce champ est requis.');
                }
                break;
            case 'string':
                if ($present && !is_string($value)) {
                    $this->add($field, 'Doit être une chaîne.');
                }
                break;
            case 'int':
                if ($present && filter_var($value, FILTER_VALIDATE_INT) === false) {
                    $this->add($field, 'Doit être un entier.');
                }
                break;
            case 'bool':
                if ($present && !is_bool($value) && !in_array($value, [0, 1, '0', '1'], true)) {
                    $this->add($field, 'Doit être un booléen.');
                }
                break;
            case 'min':
                if ($present && mb_strlen((string) $value) < (int) $arg) {
                    $this->add($field, "Minimum {$arg} caractères.");
                }
                break;
            case 'max':
                if ($present && mb_strlen((string) $value) > (int) $arg) {
                    $this->add($field, "Maximum {$arg} caractères.");
                }
                break;
            case 'between':
                if ($present) {
                    [$lo, $hi] = explode(',', (string) $arg);
                    $n = (int) $value;
                    if ($n < (int) $lo || $n > (int) $hi) {
                        $this->add($field, "Doit être entre {$lo} et {$hi}.");
                    }
                }
                break;
            case 'in':
                if ($present && !in_array((string) $value, explode(',', (string) $arg), true)) {
                    $this->add($field, 'Valeur non autorisée.');
                }
                break;
            case 'digits':
                if ($present && !preg_match('/^\d{' . (int) $arg . '}$/', (string) $value)) {
                    $this->add($field, "Doit contenir {$arg} chiffres.");
                }
                break;
            case 'phone':
                // E.164 : + suivi de 8 à 15 chiffres
                if ($present && !preg_match('/^\+\d{8,15}$/', (string) $value)) {
                    $this->add($field, 'Numéro invalide (format +225...).');
                }
                break;
            case 'email':
                if ($present && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $this->add($field, 'Adresse e-mail invalide.');
                }
                break;
        }
    }

    private function add(string $field, string $message): void
    {
        $this->errors[$field][] = $message;
    }
}
