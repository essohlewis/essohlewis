<?php

declare(strict_types=1);

namespace Transouscris\Services\Payment;

use InvalidArgumentException;

/**
 * Fabrique de passerelles de paiement. Point d'enregistrement unique : pour
 * ajouter un fournisseur, on l'inscrit ici et il devient utilisable partout
 * via son nom, sans modifier le code métier (Open/Closed).
 */
final class PaymentGatewayFactory
{
    /** @var array<string, class-string<PaymentGatewayInterface>> */
    private static array $registry = [
        'cinetpay' => CinetPayGateway::class,
        'paydunya' => PayDunyaGateway::class,
        'wave'     => WaveGateway::class,
    ];

    /** @var array<string, PaymentGatewayInterface> cache d'instances */
    private static array $instances = [];

    public static function make(string $name): PaymentGatewayInterface
    {
        $name = strtolower($name);
        if (!isset(self::$registry[$name])) {
            throw new InvalidArgumentException("Passerelle de paiement inconnue : $name");
        }
        return self::$instances[$name] ??= new self::$registry[$name]();
    }

    /** Permet l'injection d'une passerelle factice en tests. */
    public static function register(string $name, PaymentGatewayInterface $instance): void
    {
        $name = strtolower($name);
        self::$instances[$name] = $instance;
    }

    /** @return string[] liste des fournisseurs disponibles */
    public static function available(): array
    {
        return array_keys(self::$registry);
    }
}
