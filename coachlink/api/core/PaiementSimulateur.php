<?php
/* ==========================================================================
   core/PaiementSimulateur.php — Passerelle de démonstration (par défaut).
   Aucun appel réseau : un code de confirmation à 4 chiffres = succès immédiat.
   Utilisée tant qu'aucun opérateur réel n'est configuré (voir PaiementService).
   ========================================================================== */

class PaiementSimulateur implements PaiementGateway
{
    public function initier(array $tx): array
    {
        $code = (string) ($tx['code'] ?? '');
        if (!preg_match('/^\d{4}$/', $code)) {
            return ['statut' => 'echoue', 'reference' => null, 'message' => 'Code de confirmation invalide (4 chiffres attendus).'];
        }
        $ref = 'SIM' . substr((string) (time() . random_int(100, 999)), -9);
        return ['statut' => 'reussi', 'reference' => $ref, 'message' => null];
    }

    public function verifier(string $reference): array
    {
        return ['statut' => 'reussi', 'reference' => $reference];
    }
}
