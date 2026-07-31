<?php

declare(strict_types=1);

/**
 * Script CLI de création/mise à jour d'un administrateur.
 *
 * Usage :
 *   php database/create_admin.php "Nom" email@exemple.ci "MotDePasse"
 *
 * Si l'email existe déjà, le mot de passe est mis à jour.
 * Le mot de passe est haché en Argon2id. À exécuter en ligne de commande.
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Ce script doit être exécuté en ligne de commande.\n");
    exit(1);
}

require dirname(__DIR__) . '/config/config.php';

$nom = $argv[1] ?? null;
$email = $argv[2] ?? null;
$password = $argv[3] ?? null;

if ($nom === null || $email === null || $password === null) {
    fwrite(STDERR, "Usage : php database/create_admin.php \"Nom\" email \"MotDePasse\"\n");
    exit(1);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fwrite(STDERR, "Email invalide.\n");
    exit(1);
}
if (strlen($password) < 8) {
    fwrite(STDERR, "Le mot de passe doit contenir au moins 8 caractères.\n");
    exit(1);
}

try {
    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s', DB_HOST, DB_PORT, DB_NAME, DB_CHARSET);
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

    $hash = password_hash($password, PASSWORD_ARGON2ID);

    // Upsert basé sur l'email.
    $stmt = $pdo->prepare('SELECT id FROM admin_users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    $existing = $stmt->fetchColumn();

    if ($existing !== false) {
        $upd = $pdo->prepare('UPDATE admin_users SET nom = :nom, password_hash = :hash WHERE id = :id');
        $upd->execute(['nom' => $nom, 'hash' => $hash, 'id' => $existing]);
        echo "Administrateur mis à jour : {$email}\n";
    } else {
        $ins = $pdo->prepare(
            'INSERT INTO admin_users (nom, email, password_hash, role, created_at) '
            . 'VALUES (:nom, :email, :hash, :role, NOW())'
        );
        $ins->execute(['nom' => $nom, 'email' => $email, 'hash' => $hash, 'role' => 'admin']);
        echo "Administrateur créé : {$email}\n";
    }
} catch (PDOException $e) {
    fwrite(STDERR, 'Erreur BDD : ' . $e->getMessage() . "\n");
    exit(1);
}
