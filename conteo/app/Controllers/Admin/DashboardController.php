<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Database;
use App\Core\Request;
use App\Helpers\Auth;
use App\Helpers\Csrf;
use App\Models\User;

final class DashboardController extends AdminController
{
    /** GET /admin/login */
    public function loginForm(Request $request): void
    {
        $this->startSession();
        header('Content-Type: text/html; charset=utf-8');
        $csrf = Csrf::field();
        $error = $_SESSION['admin_error'] ?? '';
        unset($_SESSION['admin_error']);
        echo <<<HTML
        <!doctype html><html lang="fr"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>CONTEO Admin — Connexion</title>
        <style>body{font-family:system-ui,sans-serif;background:#2B3A67;display:grid;place-items:center;height:100vh;margin:0}
        form{background:#fff;padding:32px;border-radius:16px;width:320px;box-shadow:0 10px 40px rgba(0,0,0,.3)}
        h1{color:#A94E2A;margin-top:0}input{width:100%;padding:12px;margin:8px 0;border:1px solid #ccc;border-radius:8px;box-sizing:border-box}
        button{width:100%;padding:12px;background:#F2A73B;border:0;border-radius:8px;font-weight:700;cursor:pointer}
        .err{color:#c0392b;font-size:14px}</style></head><body>
        <form method="post" action="/admin/login">{$csrf}
        <h1>CONTEO Admin</h1>
        <p class="err">{$error}</p>
        <input name="phone" placeholder="+225..." required>
        <input name="password" type="password" placeholder="Mot de passe" required>
        <button type="submit">Se connecter</button>
        </form></body></html>
        HTML;
    }

    /** POST /admin/login */
    public function login(Request $request): void
    {
        $this->startSession();
        if (!Csrf::verify($_POST['_csrf'] ?? null)) {
            $_SESSION['admin_error'] = 'Session expirée, réessayez.';
            $this->redirect('/admin/login');
        }
        $phone = trim((string) ($_POST['phone'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        $user = (new User())->findByPhone($phone);
        if (!$user || (int) $user['is_admin'] !== 1 || !Auth::verifyPassword($password, (string) $user['password_hash'])) {
            $_SESSION['admin_error'] = 'Identifiants invalides.';
            $this->redirect('/admin/login');
        }
        $_SESSION['admin_user_id'] = (int) $user['id'];
        $this->redirect('/admin');
    }

    /** GET /admin/logout */
    public function logout(Request $request): void
    {
        $this->startSession();
        unset($_SESSION['admin_user_id']);
        $this->redirect('/admin/login');
    }

    /** GET /admin */
    public function index(Request $request): void
    {
        $this->requireAdmin();
        $db = Database::connection();
        $stats = [
            'users'        => (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn(),
            'children'     => (int) $db->query('SELECT COUNT(*) FROM child_profiles')->fetchColumn(),
            'tales'        => (int) $db->query('SELECT COUNT(*) FROM tales')->fetchColumn(),
            'subs_active'  => (int) $db->query('SELECT COUNT(*) FROM subscriptions WHERE status="active"')->fetchColumn(),
            'revenue'      => (int) $db->query('SELECT COALESCE(SUM(amount_fcfa),0) FROM payments WHERE status="success"')->fetchColumn(),
            'pay_pending'  => (int) $db->query('SELECT COUNT(*) FROM payments WHERE status="pending"')->fetchColumn(),
        ];
        $recent = $db->query(
            'SELECT reference, provider, amount_fcfa, status, verified_at, created_at
             FROM payments ORDER BY created_at DESC LIMIT 15'
        )->fetchAll();
        $this->view('dashboard', ['stats' => $stats, 'recent' => $recent, 'active' => 'dashboard']);
    }
}
