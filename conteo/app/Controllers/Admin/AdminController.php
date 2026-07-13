<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Request;
use App\Helpers\Auth;
use App\Helpers\Csrf;
use App\Models\User;

/**
 * Base des contrôleurs admin. Authentification par session PHP (formulaire),
 * réservée aux comptes is_admin = 1. Protège les vues et applique le CSRF.
 */
abstract class AdminController
{
    protected function startSession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
    }

    /** Redirige vers le login si non authentifié admin. */
    protected function requireAdmin(): array
    {
        $this->startSession();
        $userId = $_SESSION['admin_user_id'] ?? null;
        if (!$userId) {
            $this->redirect('/admin/login');
        }
        $user = (new User())->find((int) $userId);
        if (!$user || (int) $user['is_admin'] !== 1) {
            unset($_SESSION['admin_user_id']);
            $this->redirect('/admin/login');
        }
        return $user;
    }

    protected function verifyCsrf(Request $request): bool
    {
        return Csrf::verify($_POST['_csrf'] ?? null);
    }

    protected function redirect(string $path): never
    {
        header('Location: ' . $path);
        exit;
    }

    /** Rend une vue PHP depuis app/Views/admin. */
    protected function view(string $name, array $data = []): void
    {
        extract($data, EXTR_SKIP);
        $file = dirname(__DIR__, 2) . '/Views/admin/' . $name . '.php';
        header('Content-Type: text/html; charset=utf-8');
        require dirname(__DIR__, 2) . '/Views/admin/_header.php';
        require $file;
        require dirname(__DIR__, 2) . '/Views/admin/_footer.php';
    }
}
