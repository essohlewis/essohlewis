<?php
/** Pied de page commun du front. */
?>
<footer class="site-footer">
    <div class="container footer-grid">
        <div class="footer-col">
            <span class="brand"><span class="brand-mark" aria-hidden="true">📶</span> GuideRecharge<span class="brand-ci">CI</span></span>
            <p class="footer-tagline">Le portail des recharges et forfaits mobiles en Côte d'Ivoire. Comparez, générez votre code USSD, composez.</p>
        </div>
        <div class="footer-col">
            <h4>Navigation</h4>
            <a href="<?= url('/forfaits') ?>">Catalogue des forfaits</a>
            <a href="<?= url('/comparer') ?>">Comparateur</a>
            <a href="<?= url('/generateur') ?>">Générateur de code</a>
            <a href="<?= url('/guides') ?>">Guides & procédures</a>
        </div>
        <div class="footer-col">
            <h4>Opérateurs</h4>
            <a href="<?= url('/forfaits?operateur=orange') ?>">Orange CI</a>
            <a href="<?= url('/forfaits?operateur=mtn') ?>">MTN CI</a>
            <a href="<?= url('/forfaits?operateur=moov') ?>">Moov Africa</a>
        </div>
        <div class="footer-col">
            <h4>Infos</h4>
            <p class="footer-note">Aucun paiement en ligne. GuideRecharge CI est un comparateur et un guide pratique indépendant.</p>
        </div>
    </div>
    <div class="container footer-bottom">
        <span>© <?= date('Y') ?> GuideRecharge CI — Côte d'Ivoire</span>
        <a href="<?= url('/admin') ?>" class="footer-admin-link">Espace admin</a>
    </div>
</footer>
