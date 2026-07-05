<?php

declare(strict_types=1);

namespace Transouscris\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Transouscris\Services\Payment\CinetPayGateway;

/**
 * La vérification de signature du webhook est la première ligne de défense :
 * un webhook non signé ou falsifié doit être rejeté avant tout traitement.
 */
final class CinetPaySignatureTest extends TestCase
{
    private const SECRET = 'secret-de-test';

    private function gateway(): CinetPayGateway
    {
        return new CinetPayGateway([
            'api_key' => 'k', 'site_id' => 's', 'secret_key' => self::SECRET,
            'base_url' => 'https://example.test', 'notify_url' => '', 'return_url' => '',
        ]);
    }

    private function signedBody(array $overrides = []): array
    {
        $fields = array_merge([
            'cpm_site_id' => 's', 'cpm_trans_id' => 'TP123', 'cpm_trans_date' => '2026-01-01',
            'cpm_amount' => '1000', 'cpm_currency' => 'XOF', 'signature' => 'sig',
            'payment_method' => 'OM', 'cel_phone_num' => '0700000000', 'cpm_phone_prefixe' => '225',
            'cpm_language' => 'fr', 'cpm_version' => 'v2', 'cpm_payment_config' => 'SINGLE',
            'cpm_page_action' => 'PAYMENT', 'cpm_custom' => '', 'cpm_designation' => 'Recharge',
            'cpm_error_message' => '',
        ], $overrides);

        $order = [
            'cpm_site_id', 'cpm_trans_id', 'cpm_trans_date', 'cpm_amount',
            'cpm_currency', 'signature', 'payment_method', 'cel_phone_num',
            'cpm_phone_prefixe', 'cpm_language', 'cpm_version', 'cpm_payment_config',
            'cpm_page_action', 'cpm_custom', 'cpm_designation', 'cpm_error_message',
        ];
        $concat = '';
        foreach ($order as $f) {
            $concat .= (string) ($fields[$f] ?? '');
        }
        $token = hash_hmac('sha256', $concat, self::SECRET);

        return ['body' => http_build_query($fields), 'token' => $token];
    }

    public function test_accepte_une_signature_valide(): void
    {
        ['body' => $body, 'token' => $token] = $this->signedBody();
        $this->assertTrue($this->gateway()->verifyWebhookSignature($body, ['x-token' => $token]));
    }

    public function test_rejette_une_signature_absente(): void
    {
        ['body' => $body] = $this->signedBody();
        $this->assertFalse($this->gateway()->verifyWebhookSignature($body, []));
    }

    public function test_rejette_un_montant_falsifie(): void
    {
        // On signe pour 1000 puis on falsifie le montant à 100000 dans le corps.
        ['token' => $token] = $this->signedBody(['cpm_amount' => '1000']);
        ['body' => $tampered] = $this->signedBody(['cpm_amount' => '100000']);
        $this->assertFalse($this->gateway()->verifyWebhookSignature($tampered, ['x-token' => $token]));
    }
}
