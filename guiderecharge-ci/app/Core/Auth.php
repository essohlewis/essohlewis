<?php

declare(strict_types=1);

namespace App\Core;

use App\Models\AdminUser;

/**
 * Authentification de l'espace administration.
 *
 * Gère la connexion (vérification Argon2id), l'état de session de
 * l'administrateur et le rate-limiting anti-force-brute basé sur l'IP.
 */
final class Auth
{
    private const SESSION_KEY = 'admin_user';

    /**
     * Tente de connecter un administrateur.
     * Retourne true en cas de succès (session ouverte), false sinon.
     */
    public static function attempt(string $email, string $password): bool
    {
        $model = new AdminUser();
        $user = $model->findByEmail($email);

        // On vérifie le hash même si l'utilisateur n'existe pas, afin de
        // limiter les attaques temporelles (timing).
        $hash = $user['password_hash'] ?? '$argon2id$v=19$m=65536,t=4,p=1$aW52YWxpZHNhbHQ$aW52YWxpZA';

        if (!password_verify($password, $hash) || $user === null) {
            return false;
        }

        // Réhachage si les paramètres Argon2id ont évolué.
        if (password_needs_rehash($hash, PASSWORD_ARGON2ID)) {
            $model->updatePassword((int) $user['id'], $password);
        }

        Session::regenerate();
        Session::set(self::SESSION_KEY, [
            'id'    => (int) $user['id'],
            'nom'   => $user['nom'],
            'email' => $user['email'],
            'role'  => $user['role'],
        ]);
        return true;
    }

    /** Déconnecte l'administrateur courant. */
    public static function logout(): void
    {
        Session::forget(self::SESSION_KEY);
        Session::regenerate();
    }

    /** Vrai si un administrateur est connecté. */
    public static function check(): bool
    {
        return Session::has(self::SESSION_KEY);
    }

    /**
     * Retourne l'administrateur connecté, ou null.
     *
     * @return array<string, mixed>|null
     */
    public static function user(): ?array
    {
        return Session::get(self::SESSION_KEY);
    }

    /**
     * Exige une session admin ; redirige vers la connexion sinon.
     */
    public static function requireAdmin(): void
    {
        if (!self::check()) {
            Session::flash('error', 'Veuillez vous connecter.');
            Response::redirect('/admin/login');
        }
    }

    // -----------------------------------------------------------------------
    // Rate-limiting anti-force-brute (stocké en session serveur)
    // -----------------------------------------------------------------------

    /**
     * Vrai si l'IP a dépassé le quota de tentatives de connexion.
     */
    public static function tooManyAttempts(string $key): bool
    {
        $store = Session::get('_throttle', []);
        $entry = $store[$key] ?? null;
        if ($entry === null) {
            return false;
        }
        // Réinitialise si la fenêtre est écoulée.
        if (time() > $entry['reset']) {
            unset($store[$key]);
            Session::set('_throttle', $store);
            return false;
        }
        return $entry['count'] >= LOGIN_MAX_ATTEMPTS;
    }

    /** Incrémente le compteur de tentatives pour une clé donnée. */
    public static function hit(string $key): void
    {
        $store = Session::get('_throttle', []);
        $entry = $store[$key] ?? ['count' => 0, 'reset' => time() + LOGIN_DECAY_SECONDS];
        if (time() > $entry['reset']) {
            $entry = ['count' => 0, 'reset' => time() + LOGIN_DECAY_SECONDS];
        }
        $entry['count']++;
        $store[$key] = $entry;
        Session::set('_throttle', $store);
    }

    /** Réinitialise le compteur (après connexion réussie). */
    public static function clearAttempts(string $key): void
    {
        $store = Session::get('_throttle', []);
        unset($store[$key]);
        Session::set('_throttle', $store);
    }

    /** Secondes restantes avant réinitialisation du quota. */
    public static function availableIn(string $key): int
    {
        $store = Session::get('_throttle', []);
        $entry = $store[$key] ?? null;
        return $entry ? max(0, $entry['reset'] - time()) : 0;
    }
}
