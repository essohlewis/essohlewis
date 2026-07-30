<?php
declare(strict_types=1);

/** Auth — comptes, sessions par jeton porteur, hachage de mot de passe (PDO). */
final class Auth
{
    private const TTL = 7 * 24 * 3600; // 7 jours

    public static function now(): int { return (int) (microtime(true) * 1000); }

    public static function uid(string $prefix = 'usr'): string
    {
        return $prefix . '_' . bin2hex(random_bytes(7));
    }

    /** Liste des e-mails administrateurs (ADMIN_EMAILS, séparés par des virgules). */
    private static function adminEmails(): array
    {
        return array_filter(array_map(fn ($s) => strtolower(trim($s)), explode(',', getenv('ADMIN_EMAILS') ?: '')));
    }

    public static function publicUser(array $u): array
    {
        return [
            'id'    => $u['id'],
            'name'  => $u['name'],
            'email' => $u['email'],
            'phone' => $u['phone'],
            'role'  => $u['role'],
            'emailVerified' => (bool) ($u['emailVerified'] ?? 0),
        ];
    }

    public static function register(array $b): array
    {
        $pdo   = Db::pdo();
        $email = strtolower(trim((string) ($b['email'] ?? '')));
        $pass  = (string) ($b['password'] ?? '');
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Http::error('E-mail invalide.');
        }
        if (strlen($pass) < 6) {
            Http::error('Mot de passe trop court (6 caractères minimum).');
        }
        $exists = $pdo->prepare('SELECT id FROM users WHERE email=?');
        $exists->execute([$email]);
        if ($exists->fetch()) {
            Http::error('Un compte existe déjà avec cet e-mail.', 409);
        }
        $role = in_array($email, self::adminEmails(), true) ? 'admin' : 'client';
        $u = [
            'id'    => self::uid(),
            'name'  => trim((string) ($b['name'] ?? '')),
            'email' => $email,
            'phone' => trim((string) ($b['phone'] ?? '')),
            'passHash' => password_hash($pass, PASSWORD_DEFAULT),
            'role'  => $role,
            'createdAt' => self::now(),
        ];
        $pdo->prepare('INSERT INTO users (id,name,email,phone,passHash,role,emailVerified,createdAt)
            VALUES (:id,:name,:email,:phone,:passHash,:role,0,:createdAt)')->execute($u);
        return self::withSession($u);
    }

    public static function login(array $b): array
    {
        $pdo   = Db::pdo();
        $email = strtolower(trim((string) ($b['email'] ?? '')));
        $st = $pdo->prepare('SELECT * FROM users WHERE email=?');
        $st->execute([$email]);
        $u = $st->fetch();
        if (!$u || !password_verify((string) ($b['password'] ?? ''), (string) $u['passHash'])) {
            Http::error('Identifiants incorrects.', 401);
        }
        return self::withSession($u);
    }

    private static function withSession(array $u): array
    {
        $token = bin2hex(random_bytes(32));
        $now   = self::now();
        Db::pdo()->prepare('INSERT INTO sessions (token,userId,createdAt,expiresAt) VALUES (?,?,?,?)')
            ->execute([$token, $u['id'], $now, $now + self::TTL * 1000]);
        return ['ok' => true, 'token' => $token, 'user' => self::publicUser($u)];
    }

    /** Utilisateur courant d'après le jeton porteur, ou null. */
    public static function current(): ?array
    {
        $token = Http::bearer();
        if ($token === '') {
            return null;
        }
        $pdo = Db::pdo();
        $st  = $pdo->prepare('SELECT userId, expiresAt FROM sessions WHERE token=?');
        $st->execute([$token]);
        $s = $st->fetch();
        if (!$s || (int) $s['expiresAt'] < self::now()) {
            return null;
        }
        $u = $pdo->prepare('SELECT * FROM users WHERE id=?');
        $u->execute([$s['userId']]);
        return $u->fetch() ?: null;
    }

    public static function logout(): void
    {
        $token = Http::bearer();
        if ($token !== '') {
            Db::pdo()->prepare('DELETE FROM sessions WHERE token=?')->execute([$token]);
        }
    }

    public static function requireUser(): array
    {
        $u = self::current();
        if (!$u) {
            Http::error('Connexion requise.', 401);
        }
        return $u;
    }

    public static function isAdmin(): bool
    {
        if (Http::adminToken() !== '' && Http::adminToken() === (getenv('ADMIN_TOKEN') ?: 'admin-demo-token')) {
            return true;
        }
        $u = self::current();
        return $u !== null && ($u['role'] ?? '') === 'admin';
    }

    public static function requireAdmin(): void
    {
        if (!self::isAdmin()) {
            Http::error('Accès administrateur requis.', 401);
        }
    }
}
