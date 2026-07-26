<?php
declare(strict_types=1);

namespace Amoura\Services;

use Amoura\Models\PushSubscription;
use Amoura\Models\Setting;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/**
 * Envoi de notifications Web Push (Sprint +2).
 * Dégrade proprement : si les clés VAPID ne sont pas configurées ou si la
 * librairie est absente, l'envoi est ignoré (aucune erreur bloquante).
 */
final class PushService
{
    public function __construct(
        private Setting $settings = new Setting(),
        private PushSubscription $subs = new PushSubscription()
    ) {}

    public function isConfigured(): bool
    {
        return class_exists(WebPush::class)
            && (string) $this->settings->get('vapid_public_key', '') !== ''
            && (string) $this->settings->get('vapid_private_key', '') !== '';
    }

    public function publicKey(): string
    {
        return (string) $this->settings->get('vapid_public_key', '');
    }

    /**
     * Envoie une notification à toutes les souscriptions d'un utilisateur.
     * @param array $payload {title, body, url, icon?, tag?}
     * @return array{sent:int, failed:int, skipped:bool}
     */
    public function sendToUser(int $userId, array $payload): array
    {
        if (!$this->isConfigured()) {
            Logger::debug('push.skipped_unconfigured', ['user_id' => $userId]);
            return ['sent' => 0, 'failed' => 0, 'skipped' => true];
        }

        $subscriptions = $this->subs->forUser($userId);
        if (!$subscriptions) {
            return ['sent' => 0, 'failed' => 0, 'skipped' => false];
        }

        $auth = ['VAPID' => [
            'subject'    => (string) $this->settings->get('vapid_subject', 'mailto:no-reply@amoura.example'),
            'publicKey'  => (string) $this->settings->get('vapid_public_key', ''),
            'privateKey' => (string) $this->settings->get('vapid_private_key', ''),
        ]];

        // Défensif : un envoi push ne doit JAMAIS faire échouer la requête appelante
        // (ex. envoi de message). Toute erreur est journalisée et ignorée.
        try {
            $webPush = new WebPush($auth);
            $body = json_encode($payload, JSON_UNESCAPED_UNICODE);

            foreach ($subscriptions as $s) {
                $webPush->queueNotification(
                    Subscription::create([
                        'endpoint' => $s['endpoint'],
                        'keys' => ['p256dh' => $s['p256dh'], 'auth' => $s['auth']],
                    ]),
                    $body
                );
            }

            $sent = 0;
            $failed = 0;
            foreach ($webPush->flush() as $report) {
                if ($report->isSuccess()) {
                    $sent++;
                } else {
                    $failed++;
                    // Souscription expirée/invalide → on la supprime (404/410).
                    $status = $report->getResponse()?->getStatusCode();
                    if (in_array($status, [404, 410], true)) {
                        $this->subs->deleteByEndpoint($report->getEndpoint());
                    }
                }
            }

            Logger::info('push.sent', ['user_id' => $userId, 'sent' => $sent, 'failed' => $failed]);
            return ['sent' => $sent, 'failed' => $failed, 'skipped' => false];
        } catch (\Throwable $e) {
            Logger::error('push.failed', ['user_id' => $userId, 'error' => $e->getMessage()]);
            return ['sent' => 0, 'failed' => count($subscriptions), 'skipped' => false];
        }
    }
}
