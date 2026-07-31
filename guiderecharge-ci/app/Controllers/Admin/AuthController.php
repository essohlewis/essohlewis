<?php

declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Auth;
use App\Core\Controller;
use App\Core\Session;

/**
 * Authentification de l'espace admin : affichage + traitement du login,
 * déconnexion. Rate-limiting anti-force-brute et CSRF.
 */
final class AuthController extends Controller
{
    /** Affiche le formulaire de connexion. */
    public function showLogin(): void
    {
        if (Auth::check()) {
            $this->redirect('/admin');
        }
        $this->view('admin/auth/login', [
            'title' => 'Connexion — Administration',
        ], 'auth');
    }

    /** Traite la soumission du formulaire de connexion. */
    public function login(): void
    {
        $this->verifyCsrf();

        $email = trim((string) $this->request->post('email', ''));
        $password = (string) $this->request->post('password', '');
        $rlKey = 'login:' . $this->request->ip();

        // Rate-limiting : bloque après trop d'échecs.
        if (Auth::tooManyAttempts($rlKey)) {
            $seconds = Auth::availableIn($rlKey);
            Session::flash('error', "Trop de tentatives. Réessayez dans {$seconds} s.");
            $this->redirect('/admin/login');
        }

        if ($email === '' || $password === '') {
            Auth::hit($rlKey);
            Session::flash('error', 'Email et mot de passe requis.');
            $this->redirect('/admin/login');
        }

        if (Auth::attempt($email, $password)) {
            Auth::clearAttempts($rlKey);
            Session::flash('success', 'Bienvenue, ' . (Auth::user()['nom'] ?? 'admin') . ' !');
            $this->redirect('/admin');
        }

        Auth::hit($rlKey);
        Session::flash('error', 'Identifiants incorrects.');
        $this->redirect('/admin/login');
    }

    /** Déconnexion. */
    public function logout(): void
    {
        $this->verifyCsrf();
        Auth::logout();
        Session::flash('success', 'Vous êtes déconnecté.');
        $this->redirect('/admin/login');
    }
}
