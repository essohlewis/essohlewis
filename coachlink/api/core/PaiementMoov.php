<?php
/* ==========================================================================
   core/PaiementMoov.php — Passerelle Moov Money (Moov Africa).
   Squelette prêt pour la production : jeton OAuth (client_credentials) +
   initiation de paiement asynchrone. Les chemins/champs exacts dépendent de
   votre contrat marchand / agrégateur — ajustez base_url et le mapping.
   Activez-la via config.php → paiement.moov (client_id, client_secret, base_url).
   ========================================================================== */

class PaiementMoov implements PaiementGateway
{
    public function __construct(private array $cfg) {}

    public function initier(array $tx): array
    {
        $token = $this->jeton();
        if ($token === '') {
            return ['statut' => 'echoue', 'reference' => null, 'message' => 'Authentification Moov Money impossible.'];
        }

        $rep = HttpClient::postJson(
            rtrim($this->cfg['base_url'] ?? '', '/') . '/v1/payments',
            [
                'amount'       => (int) $tx['montant'],
                'currency'     => 'XOF',
                'msisdn'       => preg_replace('/\D/', '', (string) $tx['numero']),
                'reference'    => (string) $tx['referenceInterne'],
                'description'  => $tx['description'] ?? 'CoachLink CI',
                'callback_url' => App::config('paiement', [])['callback_url'] ?? '',
            ],
            ['Authorization: Bearer ' . $token]
        );

        if (in_array($rep['status'], [200, 201, 202], true)) {
            return ['statut' => 'en_attente',
                    'reference' => $rep['json']['transaction_id'] ?? ('MOOV' . time()),
                    'message' => 'Validez le paiement sur votre téléphone (Moov Money).'];
        }
        return ['statut' => 'echoue', 'reference' => null, 'message' => 'Initiation refusée par Moov Money.'];
    }

    public function verifier(string $reference): array
    {
        $rep = HttpClient::get(
            rtrim($this->cfg['base_url'] ?? '', '/') . '/v1/payments/' . rawurlencode($reference),
            ['Authorization: Bearer ' . $this->jeton()]
        );
        $s = strtolower((string) ($rep['json']['status'] ?? 'pending'));
        $map = ['success' => 'reussi', 'successful' => 'reussi', 'failed' => 'echoue'];
        return ['statut' => $map[$s] ?? 'en_attente', 'reference' => $reference];
    }

    private function jeton(): string
    {
        $rep = HttpClient::postForm(
            rtrim($this->cfg['base_url'] ?? '', '/') . '/oauth/token',
            ['grant_type' => 'client_credentials'],
            ['Authorization: Basic ' . base64_encode(($this->cfg['client_id'] ?? '') . ':' . ($this->cfg['client_secret'] ?? ''))]
        );
        return (string) ($rep['json']['access_token'] ?? '');
    }
}
