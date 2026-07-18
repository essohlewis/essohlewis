<?php
/* ==========================================================================
   core/Validator.php — Validation des entrées (règles simples et lisibles).
   Inclut la validation du téléphone ivoirien (07/05/01).
   ========================================================================== */

class Validator
{
    private array $donnees;
    private array $erreurs = [];

    public function __construct(array $donnees)
    {
        $this->donnees = $donnees;
    }

    public function requis(string $champ, string $message = 'Champ requis'): self
    {
        $v = $this->donnees[$champ] ?? '';
        if (is_string($v) ? trim($v) === '' : empty($v)) {
            $this->erreurs[$champ] = $message;
        }
        return $this;
    }

    public function email(string $champ, string $message = 'Email invalide'): self
    {
        $v = $this->donnees[$champ] ?? '';
        if ($v !== '' && !filter_var($v, FILTER_VALIDATE_EMAIL)) {
            $this->erreurs[$champ] = $message;
        }
        return $this;
    }

    public function telephoneCI(string $champ, string $message = 'Téléphone CI invalide (07/05/01)'): self
    {
        $v = preg_replace('/[\s.\-]/', '', (string) ($this->donnees[$champ] ?? ''));
        $v = preg_replace('/^\+225/', '', $v);
        if ($v !== '' && !preg_match('/^(07|05|01)\d{8}$/', $v)) {
            $this->erreurs[$champ] = $message;
        }
        return $this;
    }

    public function min(string $champ, int $longueur, ?string $message = null): self
    {
        $v = (string) ($this->donnees[$champ] ?? '');
        if (mb_strlen($v) < $longueur) {
            $this->erreurs[$champ] = $message ?? "Minimum $longueur caractères";
        }
        return $this;
    }

    public function dansListe(string $champ, array $valeurs, string $message = 'Valeur non autorisée'): self
    {
        $v = $this->donnees[$champ] ?? null;
        if ($v !== null && !in_array($v, $valeurs, true)) {
            $this->erreurs[$champ] = $message;
        }
        return $this;
    }

    public function valide(): bool { return empty($this->erreurs); }
    public function erreurs(): array { return $this->erreurs; }

    /** Répond 422 avec les erreurs si invalide. */
    public function ouEchouer(): void
    {
        if (!$this->valide()) {
            Response::erreur('Données invalides.', 422, $this->erreurs);
        }
    }
}
