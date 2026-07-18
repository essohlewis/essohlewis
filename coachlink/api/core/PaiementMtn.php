<?php
/* ==========================================================================
   core/PaiementMtn.php — Passerelle MTN MoMo (Collections « RequestToPay »).
   Squelette prêt pour la production : suit l'API MTN MoMo (jeton OAuth +
   requesttopay asynchrone). Activez-la via config.php → paiement.mtn
   (api_user, api_key, subscription_key, environnement, base_url).
   ========================================================================== */

class PaiementMtn implements PaiementGateway
{
    public function __construct(private array $cfg) {}

    public function initier(array $tx): array
    {
        $token = $this->jeton();
        if ($token === '') {
            return ['statut' => 'echoue', 'reference' => null, 'message' => 'Authentification MTN MoMo impossible.'];
        }
        $refId = $this->uuid(); // X-Reference-Id : identifiant unique de la transaction

        $rep = HttpClient::postJson(
            rtrim($this->cfg['base_url'] ?? '', '/') . '/collection/v1_0/requesttopay',
            [
                'amount'       => (string) ((int) $tx['montant']),
                'currency'     => $this->cfg['devise'] ?? 'XOF',
                'externalId'   => (string) $tx['referenceInterne'],
                'payer'        => ['partyIdType' => 'MSISDN', 'partyId' => preg_replace('/\D/', '', (string) $tx['numero'])],
                'payerMessage' => $tx['description'] ?? 'CoachLink CI',
                'payeeNote'    => 'CoachLink CI',
            ],
            [
                'Authorization: Bearer ' . $token,
                'X-Reference-Id: ' . $refId,
                'X-Target-Environment: ' . ($this->cfg['environnement'] ?? 'sandbox'),
                'Ocp-Apim-Subscription-Key: ' . ($this->cfg['subscription_key'] ?? ''),
            ]
        );

        if ($rep['status'] === 202) {
            return ['statut' => 'en_attente', 'reference' => $refId,
                    'message' => 'Validez le paiement sur votre téléphone (MTN MoMo).'];
        }
        return ['statut' => 'echoue', 'reference' => null, 'message' => 'Initiation refusée par MTN MoMo.'];
    }

    public function verifier(string $reference): array
    {
        $token = $this->jeton();
        $rep = HttpClient::get(
            rtrim($this->cfg['base_url'] ?? '', '/') . '/collection/v1_0/requesttopay/' . rawurlencode($reference),
            [
                'Authorization: Bearer ' . $token,
                'X-Target-Environment: ' . ($this->cfg['environnement'] ?? 'sandbox'),
                'Ocp-Apim-Subscription-Key: ' . ($this->cfg['subscription_key'] ?? ''),
            ]
        );
        $s = strtoupper((string) ($rep['json']['status'] ?? 'PENDING'));
        $map = ['SUCCESSFUL' => 'reussi', 'FAILED' => 'echoue'];
        return ['statut' => $map[$s] ?? 'en_attente', 'reference' => $reference];
    }

    private function jeton(): string
    {
        $rep = HttpClient::postForm(
            rtrim($this->cfg['base_url'] ?? '', '/') . '/collection/token/',
            [],
            [
                'Authorization: Basic ' . base64_encode(($this->cfg['api_user'] ?? '') . ':' . ($this->cfg['api_key'] ?? '')),
                'Ocp-Apim-Subscription-Key: ' . ($this->cfg['subscription_key'] ?? ''),
            ]
        );
        return (string) ($rep['json']['access_token'] ?? '');
    }

    /** UUID v4 pour l'en-tête X-Reference-Id. */
    private function uuid(): string
    {
        $d = random_bytes(16);
        $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
        $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
    }
}
