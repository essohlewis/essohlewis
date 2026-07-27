<?php
declare(strict_types=1);

namespace Amoura\Services\Sms;

/**
 * Contrat d'une passerelle SMS (Phase 1, Sprint +7).
 * Implémentations : LogSmsGateway (dev), HttpSmsGateway (prestataire REST).
 */
interface SmsGateway
{
    /**
     * Envoie un SMS.
     * @return array{ok:bool, ref?:string, error?:string}
     */
    public function send(string $to, string $message): array;
}
