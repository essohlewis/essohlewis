<?php
declare(strict_types=1);

/**
 * Génère une paire de clés VAPID pour les notifications Web Push.
 * Collez les valeurs dans l'admin (Paramètres → push) ou dans settings.
 *
 *   php scripts/gen_vapid.php
 */

require __DIR__ . '/../vendor/autoload.php';

if (!class_exists(\Minishlink\WebPush\VAPID::class)) {
    fwrite(STDERR, "Installez d'abord la librairie : composer require minishlink/web-push\n");
    exit(1);
}

$keys = \Minishlink\WebPush\VAPID::createVapidKeys();
echo "vapid_public_key  = {$keys['publicKey']}\n";
echo "vapid_private_key = {$keys['privateKey']}\n";
echo "\nRenseignez ces valeurs dans l'espace admin (Paramètres → push).\n";
