<?php
/** Formulaire de connexion admin. */

use App\Core\Csrf;
?>
<div class="auth-card">
    <div class="auth-brand">
        <span class="brand-mark" aria-hidden="true">📶</span>
        <span>GuideRecharge <strong>Admin</strong></span>
    </div>
    <h1>Connexion</h1>
    <p class="auth-sub">Accès réservé à l'administration.</p>

    <form action="<?= url('/admin/login') ?>" method="post" autocomplete="off">
        <?= Csrf::field() ?>
        <div class="field">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required autofocus placeholder="admin@guiderecharge.ci">
        </div>
        <div class="field">
            <label for="password">Mot de passe</label>
            <input type="password" id="password" name="password" required placeholder="••••••••">
        </div>
        <button type="submit" class="btn btn-primary btn-block btn-lg">Se connecter</button>
    </form>

    <a class="auth-back" href="<?= url('/') ?>">← Retour au site</a>
</div>
