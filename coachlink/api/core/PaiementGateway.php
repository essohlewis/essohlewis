<?php
/* ==========================================================================
   core/PaiementGateway.php — Contrat commun des passerelles de paiement
   Mobile Money. Une implémentation par opérateur (+ un simulateur).

   Le flux Mobile Money réel est ASYNCHRONE : on « initie » le paiement, le
   client confirme sur son téléphone (PIN/USSD), puis l'opérateur confirme via
   un webhook (POST /paiements/callback) ou on interroge verifier().
   ========================================================================== */

interface PaiementGateway
{
    /**
     * Initie un paiement.
     * $tx = { referenceInterne, montant(int FCFA), operateur, numero, code?, description? }
     * @return array{statut:string, reference:?string, message:?string, lien?:?string}
     *         statut ∈ { 'reussi', 'en_attente', 'echoue' }
     */
    public function initier(array $tx): array;

    /**
     * Interroge l'état d'une transaction (polling de secours si pas de webhook).
     * @return array{statut:string, reference:string}
     */
    public function verifier(string $reference): array;
}
