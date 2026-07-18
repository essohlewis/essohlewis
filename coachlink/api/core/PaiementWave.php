<?php
/* ==========================================================================
   core/PaiementWave.php — Passerelle Wave (CI).
   Squelette prêt pour la production : suit l'API Wave Checkout
   (POST /v1/checkout/sessions → l'utilisateur confirme dans l'app Wave, puis
   Wave notifie via webhook). Activez-la en renseignant l'api_key marchande
   dans config.php → paiement.wave.
   ========================================================================== */

class PaiementWave implements PaiementGateway
{
    public function __construct(private array $cfg) {}

    public function initier(array $tx): array
    {
        $rep = HttpClient::postJson(
            rtrim($this->cfg['base_url'] ?? 'https://api.wave.com', '/') . '/v1/checkout/sessions',
            [
                'amount'           => (string) ((int) $tx['montant']),
                'currency'         => 'XOF',
                'client_reference' => (string) $tx['referenceInterne'],
                'success_url'      => $this->cfg['success_url'] ?? '',
                'error_url'        => $this->cfg['error_url'] ?? '',
            ],
            ['Authorization: Bearer ' . ($this->cfg['api_key'] ?? '')]
        );

        if (in_array($rep['status'], [200, 201], true)) {
            return [
                'statut'    => 'en_attente',
                'reference' => $rep['json']['id'] ?? ('WAVE' . time()),
                'message'   => 'Ouvrez Wave pour valider le paiement.',
                'lien'      => $rep['json']['wave_launch_url'] ?? null, // redirection app Wave
            ];
        }
        return ['statut' => 'echoue', 'reference' => null, 'message' => 'Session de paiement Wave non créée.'];
    }

    public function verifier(string $reference): array
    {
        $rep = HttpClient::get(
            rtrim($this->cfg['base_url'] ?? 'https://api.wave.com', '/') . '/v1/checkout/sessions/' . rawurlencode($reference),
            ['Authorization: Bearer ' . ($this->cfg['api_key'] ?? '')]
        );
        $statut = strtolower((string) ($rep['json']['payment_status'] ?? 'processing'));
        $map = ['succeeded' => 'reussi', 'complete' => 'reussi', 'failed' => 'echoue', 'expired' => 'echoue'];
        return ['statut' => $map[$statut] ?? 'en_attente', 'reference' => $reference];
    }
}
