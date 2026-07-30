<?php
declare(strict_types=1);

namespace Amoura\Services\WhatsApp;

use Amoura\Core\Env;
use Amoura\Models\Setting;
use Amoura\Services\Payment\Http;

/**
 * Envoi de codes OTP par WhatsApp (Cloud API officielle de Meta).
 *
 * Deux pilotes (WHATSAPP_DRIVER) :
 *   - "log"   (défaut) : écrit le code dans storage/logs/whatsapp.log — aucun
 *              envoi réel, idéal en développement (XAMPP).
 *   - "cloud" : envoi via WhatsApp Cloud API (graph.facebook.com).
 *
 * Configuration (.env prioritaire, sinon réglages CMS `whatsapp_*`) :
 *   WHATSAPP_DRIVER      = log | cloud
 *   WHATSAPP_TOKEN       = jeton d'accès permanent (Meta)
 *   WHATSAPP_PHONE_ID    = identifiant du numéro expéditeur (phone_number_id)
 *   WHATSAPP_TEMPLATE    = nom du modèle d'authentification approuvé (recommandé)
 *   WHATSAPP_LANG        = code langue du modèle (ex. fr, fr_FR, en_US)
 *   WHATSAPP_DEFAULT_CC  = indicatif pays par défaut pour les numéros locaux (ex. 225)
 *   WHATSAPP_VERSION     = version de l'API (défaut v21.0)
 *
 * NB : pour envoyer un OTP à un utilisateur qui ne vous a pas écrit dans les
 * dernières 24 h, WhatsApp exige un MODÈLE approuvé (renseignez WHATSAPP_TEMPLATE).
 * En l'absence de modèle, un message texte est tenté (utile en bac à sable).
 */
final class WhatsAppService
{
    /** Pilote effectif (log par défaut). */
    public static function driver(): string
    {
        $d = strtolower(self::config('WHATSAPP_DRIVER', 'whatsapp_driver', 'log'));
        return $d !== '' ? $d : 'log';
    }

    /** Vrai si aucun message réel n'est envoyé (mode log/dev). */
    public static function isLoggedOnly(): bool
    {
        return self::driver() !== 'cloud';
    }

    /**
     * Envoie un code OTP au numéro donné.
     * @return array{ok:bool, ref?:string, error?:string}
     */
    public static function sendOtp(string $phone, string $code): array
    {
        $to = self::normalizePhone($phone);
        if ($to === '') {
            return ['ok' => false, 'error' => 'Numéro WhatsApp invalide.'];
        }

        if (self::isLoggedOnly()) {
            self::log($to, $code);
            return ['ok' => true, 'ref' => 'log'];
        }

        $token = self::config('WHATSAPP_TOKEN', 'whatsapp_token');
        $phoneId = self::config('WHATSAPP_PHONE_ID', 'whatsapp_phone_id');
        if ($token === '' || $phoneId === '') {
            return ['ok' => false, 'error' => 'WhatsApp non configuré (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID).'];
        }
        $version = self::config('WHATSAPP_VERSION', 'whatsapp_version', 'v21.0');
        $template = self::config('WHATSAPP_TEMPLATE', 'whatsapp_template');
        $lang = self::config('WHATSAPP_LANG', 'whatsapp_lang', 'fr');

        $res = Http::post(
            "https://graph.facebook.com/{$version}/{$phoneId}/messages",
            self::payload($to, $code, $template, $lang),
            ['Authorization: Bearer ' . $token]
        );

        $ok = $res['status'] >= 200 && $res['status'] < 300;
        if (!$ok) {
            return ['ok' => false, 'error' => $res['body']['error']['message'] ?? ('WhatsApp HTTP ' . $res['status'])];
        }
        $ref = $res['body']['messages'][0]['id'] ?? null;
        return ['ok' => true, 'ref' => is_string($ref) ? $ref : 'wa'];
    }

    /**
     * Construit le corps de l'API Cloud (méthode pure, testable).
     * Modèle approuvé si `$template` est fourni (le code est le paramètre {{1}}),
     * sinon repli en message texte.
     *
     * @return array<string,mixed>
     */
    public static function payload(string $to, string $code, string $template, string $lang): array
    {
        if ($template !== '') {
            return [
                'messaging_product' => 'whatsapp',
                'to'                => $to,
                'type'              => 'template',
                'template'          => [
                    'name'       => $template,
                    'language'   => ['code' => $lang !== '' ? $lang : 'fr'],
                    'components' => [[
                        'type'       => 'body',
                        'parameters' => [['type' => 'text', 'text' => $code]],
                    ]],
                ],
            ];
        }

        return [
            'messaging_product' => 'whatsapp',
            'to'                => $to,
            'type'              => 'text',
            'text'              => ['body' => "Votre code de vérification Amoura : {$code}\nIl expire dans 10 minutes."],
        ];
    }

    /**
     * Normalise un numéro au format attendu par WhatsApp (chiffres, indicatif
     * pays sans « + »). Si un numéro local commence par 0 et qu'un indicatif par
     * défaut est configuré, le 0 est remplacé par cet indicatif.
     */
    public static function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone) ?? '';
        if ($digits === '') {
            return '';
        }
        $cc = preg_replace('/\D/', '', self::config('WHATSAPP_DEFAULT_CC', 'whatsapp_default_cc', '')) ?? '';
        if ($cc !== '' && str_starts_with($digits, '0')) {
            $digits = $cc . substr($digits, 1);
        }
        return $digits;
    }

    /** Lit un réglage : .env prioritaire, puis réglage CMS, puis défaut. */
    private static function config(string $envKey, string $settingKey, string $default = ''): string
    {
        $v = (string) Env::get($envKey, '');
        if ($v !== '') {
            return $v;
        }
        try {
            $v = (string) (new Setting())->get($settingKey, '');
        } catch (\Throwable) {
            $v = '';
        }
        return $v !== '' ? $v : $default;
    }

    private static function log(string $to, string $code): void
    {
        $line = sprintf("[%s] WhatsApp → %s | Code : %s\n", date('c'), $to, $code);
        $dir = dirname(__DIR__, 3) . '/storage/logs';
        @mkdir($dir, 0775, true);
        file_put_contents($dir . '/whatsapp.log', $line, FILE_APPEND);
    }
}
