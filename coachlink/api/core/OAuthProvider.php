<?php
/* ==========================================================================
   core/OAuthProvider.php — Contrat d'un fournisseur de connexion sociale
   (OAuth 2.0 / OpenID Connect). Une implémentation par réseau.
   ========================================================================== */

interface OAuthProvider
{
    /** URL vers laquelle rediriger l'utilisateur pour l'autorisation. */
    public function urlAutorisation(string $state, string $redirectUri): string;

    /**
     * Échange le code d'autorisation contre le profil de l'utilisateur.
     * @return array{email:string, prenom:string, nom:string, source:string}|null
     */
    public function profil(string $code, string $redirectUri): ?array;
}
