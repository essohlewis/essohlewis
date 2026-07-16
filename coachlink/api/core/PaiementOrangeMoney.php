<?php
/* ==========================================================================
   core/PaiementOrangeMoney.php — Passerelle Orange Money (CI).
   Squelette prêt pour la production : la structure des appels suit l'API
   Orange Money (OAuth client_credentials + Web/Push Payment). Activez-la en
   renseignant les identifiants marchands dans config.php → paiement.orange.

   Réf. : portail développeur Orange Money (les URLs/champs exacts peuvent
   varier selon votre contrat marchand ; ajustez base_url et le mapping).
   ========================================================================== */

class PaiementOrangeMoney implements PaiementGateway
{
    public function __construct(private array $cfg) {}

    public function initier(array $tx): array
    {
        $token = $this->jeton();
        if ($token === '') {
            return ['statut' => 'echoue', 'reference' => null, 'message' => 'Authentification Orange Money impossible.'];
        }

        $rep = HttpClient::postJson(
            rtrim($this->cfg['base_url'] ?? '', '/') . '/omcoreapis/1.0.2/mp/pay',
            [
                'subscriberMsisdn' => $tx['numero'],
                'amount'           => (int) $tx['montant'],
                'orderId'          => (string) $tx['referenceInterne'],
                'description'      => $tx['description'] ?? 'CoachLink CI',
                'notifUrl'         => App::config('paiement', [])['callback_url'] ?? '',
            ],
            [
                'Authorization: Bearer ' . $token,
                'X-AUTH-TOKEN: ' . ($this->cfg['x_auth_token'] ?? ''),
            ]
        );

        $ok = ($rep['status'] >= 200 && $rep['status'] < 300);
        if ($ok) {
            // Paiement poussé sur le téléphone du client : en attente de confirmation.
            return [
                'statut'    => 'en_attente',
                'reference' => $rep['json']['payToken'] ?? ('OM' . time()),
                'message'   => 'Validez le paiement sur votre téléphone (Orange Money).',
            ];
        }
        return ['statut' => 'echoue', 'reference' => null, 'message' => 'Initiation refusée par Orange Money.'];
    }

    public function verifier(string $reference): array
    {
        $token = $this->jeton();
        $rep = HttpClient::get(
            rtrim($this->cfg['base_url'] ?? '', '/') . '/omcoreapis/1.0.2/mp/paymentstatus/' . rawurlencode($reference),
            ['Authorization: Bearer ' . $token]
        );
        $statut = strtolower((string) ($rep['json']['status'] ?? 'pending'));
        $map = ['successful' => 'reussi', 'success' => 'reussi', 'failed' => 'echoue'];
        return ['statut' => $map[$statut] ?? 'en_attente', 'reference' => $reference];
    }

    /** Jeton OAuth (client_credentials) auprès d'Orange. */
    private function jeton(): string
    {
        $rep = HttpClient::postForm(
            rtrim($this->cfg['base_url'] ?? '', '/') . '/oauth/v3/token',
            ['grant_type' => 'client_credentials'],
            ['Authorization: Basic ' . base64_encode(($this->cfg['client_id'] ?? '') . ':' . ($this->cfg['client_secret'] ?? ''))]
        );
        return (string) ($rep['json']['access_token'] ?? '');
    }
}
