<?php
/**
 * Passerelle de paiement CinetPay (Orange Money / MTN Money / Wave).
 *
 * En MVP, l'intégration réelle est encapsulée ici. Si les clés API ne sont
 * pas configurées (mode "simulation"), le service simule un paiement réussi
 * afin que le parcours de commande soit testable de bout en bout sans compte
 * marchand. Le passage en production ne change que la configuration, pas le
 * reste de l'application.
 */

declare(strict_types=1);

namespace App\Services;

class CinetPay
{
    /** @var array<string,mixed> */
    private array $config;

    public function __construct(array $config)
    {
        $this->config = $config;
    }

    public function estSimulation(): bool
    {
        return $this->config['mode'] !== 'production'
            || $this->config['api_key'] === ''
            || $this->config['site_id'] === '';
    }

    /**
     * Initialise un paiement pour une commande.
     *
     * @return array{succes:bool,reference:string,message:string,url_paiement:?string}
     */
    public function initier(string $referenceCommande, int $montantXof, string $methode, array $client): array
    {
        if ($this->estSimulation()) {
            // Paiement simulé : réussite immédiate avec une pseudo-référence.
            return [
                'succes'       => true,
                'reference'    => 'SIM-' . strtoupper(bin2hex(random_bytes(4))),
                'message'      => 'Paiement simulé accepté (mode démonstration).',
                'url_paiement' => null,
            ];
        }

        // --- Intégration réelle CinetPay ---
        // Le endpoint /v2/payment renvoie une URL de paiement vers laquelle
        // rediriger le client. La confirmation définitive arrive via notify_url.
        $charge = [
            'apikey'          => $this->config['api_key'],
            'site_id'         => $this->config['site_id'],
            'transaction_id'  => $referenceCommande,
            'amount'          => $montantXof,
            'currency'        => 'XOF',
            'description'     => 'Commande MarchéFraîch ' . $referenceCommande,
            'notify_url'      => $this->config['notify_url'],
            'customer_name'   => $client['nom'] ?? '',
            'customer_phone_number' => $client['telephone'] ?? '',
            'channels'        => $this->canal($methode),
        ];

        $reponse = $this->appelApi('https://api-checkout.cinetpay.com/v2/payment', $charge);

        if (($reponse['code'] ?? null) === '201' && isset($reponse['data']['payment_url'])) {
            return [
                'succes'       => true,
                'reference'    => $referenceCommande,
                'message'      => 'Redirection vers le paiement Mobile Money.',
                'url_paiement' => $reponse['data']['payment_url'],
            ];
        }

        return [
            'succes'       => false,
            'reference'    => $referenceCommande,
            'message'      => $reponse['message'] ?? 'Échec de l\'initialisation du paiement.',
            'url_paiement' => null,
        ];
    }

    /** Associe une méthode interne au canal CinetPay. */
    private function canal(string $methode): string
    {
        // CinetPay regroupe les opérateurs mobiles sous "MOBILE_MONEY".
        return 'MOBILE_MONEY';
    }

    /**
     * Appel HTTP POST JSON vers l'API. Retourne le tableau décodé.
     * @param array<string,mixed> $charge
     * @return array<string,mixed>
     */
    private function appelApi(string $url, array $charge): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode($charge, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT        => 20,
        ]);
        $brut = curl_exec($ch);
        curl_close($ch);

        if (!is_string($brut)) {
            return ['code' => 'error', 'message' => 'Aucune réponse de la passerelle.'];
        }
        $decode = json_decode($brut, true);
        return is_array($decode) ? $decode : ['code' => 'error', 'message' => 'Réponse invalide.'];
    }
}
