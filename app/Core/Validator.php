<?php

declare(strict_types=1);

namespace Transouscris\Core;

use Transouscris\Core\Exceptions\ValidationException;

/**
 * Validateur simple orienté règles. Lève une ValidationException à l'échec.
 *
 * Règles supportées : required, string, int, numeric, email, min:n, max:n,
 * between:a,b, in:a,b,c, regex:/.../ , phone_ci, amount (entier positif).
 */
final class Validator
{
    private array $errors = [];

    public function __construct(private array $data) {}

    public static function make(array $data): self
    {
        return new self($data);
    }

    /**
     * @param array<string, string> $rules  ['field' => 'required|int|min:1']
     * @return array validated data
     */
    public function validate(array $rules): array
    {
        foreach ($rules as $field => $ruleString) {
            $value = $this->data[$field] ?? null;
            foreach (explode('|', $ruleString) as $rule) {
                $this->apply($field, $value, $rule);
            }
        }

        if ($this->errors) {
            throw new ValidationException($this->errors);
        }

        return array_intersect_key($this->data, $rules);
    }

    private function apply(string $field, mixed $value, string $rule): void
    {
        [$name, $param] = array_pad(explode(':', $rule, 2), 2, null);
        $present = $value !== null && $value !== '';

        switch ($name) {
            case 'required':
                if (!$present) {
                    $this->fail($field, 'Le champ %s est requis.');
                }
                break;
            case 'string':
                if ($present && !is_string($value)) {
                    $this->fail($field, 'Le champ %s doit être une chaîne.');
                }
                break;
            case 'int':
                if ($present && filter_var($value, FILTER_VALIDATE_INT) === false) {
                    $this->fail($field, 'Le champ %s doit être un entier.');
                }
                break;
            case 'numeric':
                if ($present && !is_numeric($value)) {
                    $this->fail($field, 'Le champ %s doit être numérique.');
                }
                break;
            case 'email':
                if ($present && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                    $this->fail($field, 'Le champ %s doit être un e-mail valide.');
                }
                break;
            case 'min':
                if ($present && (float) $value < (float) $param) {
                    $this->fail($field, "Le champ %s doit être ≥ $param.");
                }
                break;
            case 'max':
                if ($present && (float) $value > (float) $param) {
                    $this->fail($field, "Le champ %s doit être ≤ $param.");
                }
                break;
            case 'between':
                [$a, $b] = explode(',', (string) $param);
                if ($present && ((float) $value < (float) $a || (float) $value > (float) $b)) {
                    $this->fail($field, "Le champ %s doit être entre $a et $b.");
                }
                break;
            case 'in':
                $allowed = explode(',', (string) $param);
                if ($present && !in_array((string) $value, $allowed, true)) {
                    $this->fail($field, 'La valeur du champ %s est invalide.');
                }
                break;
            case 'amount':
                // Montant en unité mineure (XOF entier), strictement positif.
                if ($present && (filter_var($value, FILTER_VALIDATE_INT) === false || (int) $value <= 0)) {
                    $this->fail($field, 'Le montant %s doit être un entier positif.');
                }
                break;
            case 'phone_ci':
                if ($present && !preg_match('/^(?:\+?225)?0[157]\d{8}$/', (string) $value)) {
                    $this->fail($field, 'Le numéro %s est invalide (format ivoirien attendu).');
                }
                break;
            case 'regex':
                if ($present && !preg_match((string) $param, (string) $value)) {
                    $this->fail($field, 'Le champ %s a un format invalide.');
                }
                break;
        }
    }

    private function fail(string $field, string $template): void
    {
        $this->errors[$field][] = sprintf($template, $field);
    }
}
