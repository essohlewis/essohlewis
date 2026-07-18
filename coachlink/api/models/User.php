<?php
/* ==========================================================================
   models/User.php — Comptes utilisateurs (client / coach / admin).
   ========================================================================== */

class User extends Model
{
    protected string $table = 'users';

    public function parEmail(string $email): ?array
    {
        return $this->parColonne('email', strtolower(trim($email)));
    }

    /** Crée un utilisateur avec mot de passe haché (bcrypt). */
    public function creer(array $d): int
    {
        return (int) $this->inserer([
            'role'        => $d['role'],
            'prenom'      => $d['prenom'],
            'nom'         => $d['nom'],
            'email'       => strtolower(trim($d['email'])),
            'telephone'   => $d['telephone'] ?? '',
            'mot_de_passe'=> password_hash($d['motDePasse'], PASSWORD_DEFAULT),
            'source'      => $d['source'] ?? 'email',
            'cree_le'     => date('c'),
        ]);
    }

    /** Vérifie un mot de passe en clair contre le hash stocké. */
    public function verifierMotDePasse(array $user, string $clair): bool
    {
        return password_verify($clair, $user['mot_de_passe']);
    }

    /** Représentation publique (sans le hash du mot de passe). */
    public static function public(array $user): array
    {
        unset($user['mot_de_passe']);
        return $user;
    }

    /** Code de parrainage stable dérivé de l'identifiant. */
    public static function codeParrainage(array $user): string
    {
        $suffixe = strtoupper(str_pad(substr((string) $user['id'], -4), 4, 'X', STR_PAD_LEFT));
        return 'PARRAIN-' . $suffixe;
    }
}
