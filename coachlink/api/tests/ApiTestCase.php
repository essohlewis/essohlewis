<?php
/* ==========================================================================
   tests/ApiTestCase.php — Classe de base : réinitialise les tables avant
   chaque test pour garantir l'isolation.
   ========================================================================== */

use PHPUnit\Framework\TestCase;

abstract class ApiTestCase extends TestCase
{
    protected function setUp(): void
    {
        $pdo = Database::connexion();
        $tables = [
            'resets', 'litiges', 'post_likes', 'favoris', 'notifications', 'messages',
            'conversations', 'reservations', 'posts', 'galerie', 'avis', 'disponibilites',
            'diplomes', 'tarifs', 'coach_langues', 'coach_specialites', 'coachs', 'users',
        ];
        foreach ($tables as $t) {
            $pdo->exec("DELETE FROM $t");
        }
    }

    /** Insère un coach minimal (avec une spécialité) et retourne son id. */
    protected function creerCoach(string $id = 'c_test', string $specialite = 'musculation'): string
    {
        $pdo = Database::connexion();
        $pdo->prepare("INSERT INTO coachs (id, prenom, nom, categorie, commune, note) VALUES (?,?,?,?,?,?)")
            ->execute([$id, 'Koffi', 'Aka', 'sport', 'Cocody', 4.5]);
        $pdo->prepare("INSERT INTO coach_specialites (coach_id, specialite) VALUES (?,?)")
            ->execute([$id, $specialite]);
        return $id;
    }
}
