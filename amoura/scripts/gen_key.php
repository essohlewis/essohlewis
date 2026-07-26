<?php
/**
 * Génère une clé applicative (APP_KEY) à copier dans .env.
 * Usage : php scripts/gen_key.php
 */
echo "APP_KEY=" . bin2hex(random_bytes(32)) . PHP_EOL;
