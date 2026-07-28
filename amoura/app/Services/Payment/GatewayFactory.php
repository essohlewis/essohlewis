<?php
declare(strict_types=1);

namespace Amoura\Services\Payment;

/** Fabrique la passerelle correspondant à l'identifiant demandé. */
final class GatewayFactory
{
    public static function make(string $gateway): PaymentGateway
    {
        return match ($gateway) {
            'stripe'      => new StripeGateway(),
            'paypal'      => new PaypalGateway(),
            'cinetpay'    => new CinetPayGateway(),
            'paydunya'    => new PayDunyaGateway(),
            'flutterwave' => new FlutterwaveGateway(),
            'wave'        => new WaveGateway(),
            default       => throw new \InvalidArgumentException("Passerelle inconnue : {$gateway}"),
        };
    }

    /** @return string[] passerelles disponibles (configurées). */
    public static function available(): array
    {
        return ['stripe', 'paypal', 'cinetpay', 'paydunya', 'flutterwave', 'wave'];
    }
}
