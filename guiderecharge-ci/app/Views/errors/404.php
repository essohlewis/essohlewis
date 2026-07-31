<?php /** Fragment page 404 (injecté dans un layout). */ ?>
<section class="container error-page">
    <div class="error-code">404</div>
    <h1>Page introuvable</h1>
    <p>La page que vous cherchez n'existe pas ou a été déplacée.</p>
    <div class="error-actions">
        <a href="<?= url('/') ?>" class="btn btn-primary">Retour à l'accueil</a>
        <a href="<?= url('/forfaits') ?>" class="btn btn-outline">Voir les forfaits</a>
    </div>
</section>
