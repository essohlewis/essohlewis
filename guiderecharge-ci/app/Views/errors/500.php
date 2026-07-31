<?php /** Fragment page 500 (injecté dans un layout). */ ?>
<section class="container error-page">
    <div class="error-code">500</div>
    <h1>Une erreur est survenue</h1>
    <p>Le service rencontre un problème temporaire. Merci de réessayer dans un instant.</p>
    <div class="error-actions">
        <a href="<?= url('/') ?>" class="btn btn-primary">Retour à l'accueil</a>
    </div>
</section>
