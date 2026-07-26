<?php
declare(strict_types=1);

/**
 * Amorçage de la suite de tests.
 * Charge l'autoloader Composer (qui inclut le PSR-4 Amoura\ + les helpers).
 */
require dirname(__DIR__) . '/vendor/autoload.php';

// Fournit un $_SESSION en mémoire pour les classes qui s'en servent (Csrf).
if (!isset($_SESSION)) {
    $_SESSION = [];
}
