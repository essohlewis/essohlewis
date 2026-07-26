<?php
declare(strict_types=1);

/**
 * Crée/actualise un compte super-administrateur avec un hash Argon2id valide.
 * Usage : php scripts/make_admin.php <email> <mot_de_passe> [nom]
 */

require __DIR__ . '/../app/Core/Autoloader.php';

use Amoura\Core\Autoloader;
use Amoura\Core\Database;
use Amoura\Core\Env;
use Amoura\Core\Security\Auth;

$al = new Autoloader();
$al->addNamespace('Amoura', __DIR__ . '/../app');
$al->register();
require __DIR__ . '/../app/Helpers/functions.php';
Env::load(__DIR__ . '/../.env');

$email = $argv[1] ?? null;
$password = $argv[2] ?? null;
$name = $argv[3] ?? 'Administrateur';

if (!$email || !$password) {
    fwrite(STDERR, "Usage : php scripts/make_admin.php <email> <mot_de_passe> [nom]\n");
    exit(1);
}

$db = Database::connection();
$hash = Auth::hash($password);

$existing = $db->prepare('SELECT id FROM users WHERE email = ?');
$existing->execute([$email]);
$id = $existing->fetchColumn();

if ($id) {
    $db->prepare('UPDATE users SET password_hash = ?, role_id = 1, status = "active", is_verified = 1 WHERE id = ?')
       ->execute([$hash, $id]);
    echo "Admin mis à jour (#{$id}) : {$email}\n";
} else {
    $db->prepare(
        'INSERT INTO users (role_id, email, password_hash, display_name, birthdate, gender, status, email_verified_at, is_verified, gdpr_consent_at)
         VALUES (1, ?, ?, ?, "1990-01-01", "other", "active", NOW(), 1, NOW())'
    )->execute([$email, $hash, $name]);
    echo "Admin créé : {$email}\n";
}
echo "Mot de passe défini avec succès.\n";
