<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Models\CodeUssd;
use App\Models\Log;
use App\Models\Operateur;

/**
 * Générateur de code USSD ⭐ (fonctionnalité phare).
 *
 * L'utilisateur saisit un numéro (détection auto de l'opérateur par
 * préfixe), choisit une action et un montant, puis obtient le code USSD
 * exact prêt à composer (lien tel: avec # encodé en %23).
 *
 * La génération finale est aussi validée côté serveur (jamais confiance
 * au seul JavaScript) et soumise à un rate-limiting.
 */
final class UssdController extends Controller
{
    /** Page du générateur. */
    public function index(): void
    {
        $operateurModel = new Operateur();
        $codeModel = new CodeUssd();

        // On expose les patterns par opérateur pour la génération côté client,
        // tout en gardant la génération serveur comme référence de sécurité.
        $operateurs = $operateurModel->actifs();
        $patterns = [];
        foreach ($operateurs as $op) {
            $patterns[$op['slug']] = $codeModel->forOperateur($op['slug']);
        }

        $this->view('ussd/index', [
            'title'      => 'Générateur de code USSD — GuideRecharge CI',
            'operateurs' => $operateurs,
            'patterns'   => $patterns,
            'montant_min' => MONTANT_MIN,
            'montant_max' => MONTANT_MAX,
        ]);
    }

    /**
     * Génère le code USSD final (POST JSON).
     *
     * Corps attendu : numero, action, montant (optionnel), code (optionnel),
     * operateur (slug optionnel — sinon détecté par préfixe).
     */
    public function generate(): void
    {
        require_once APP_PATH . '/Helpers/operator_detect.php';

        // Protection CSRF : le générateur est un formulaire POST (jeton exposé
        // via la balise meta csrf-token et envoyé par app.js).
        $this->verifyCsrf();

        // Rate-limiting basé sur l'IP (protection contre l'abus).
        $rlKey = 'ussd:' . $this->request->ip();
        if ($this->rateLimited($rlKey)) {
            $this->json(['error' => 'Trop de requêtes. Réessayez dans un instant.'], 429);
        }
        $this->rateHit($rlKey);

        $numeroRaw = trim((string) $this->request->post('numero', ''));
        $action = (string) $this->request->post('action', '');
        $montantRaw = $this->request->post('montant', '');
        $codeParam = trim((string) $this->request->post('code', ''));
        $operateurParam = (string) $this->request->post('operateur', '');

        // --- Validation du numéro (10 chiffres ivoiriens) ---
        if (!numero_valide($numeroRaw)) {
            $this->json(['error' => 'Numéro invalide. Attendu : 10 chiffres (07/05/01…).'], 422);
        }
        $numero = numero_normalise($numeroRaw);
        $slug = $operateurParam !== '' ? $operateurParam : detect_operateur_slug($numeroRaw);

        if ($slug === null) {
            $this->json(['error' => 'Opérateur non reconnu pour ce numéro.'], 422);
        }

        // --- Récupération du pattern (code racine avec placeholders) ---
        $codeModel = new CodeUssd();
        $ussd = $codeModel->byOperateurAction($slug, $action);
        if ($ussd === null) {
            $this->json(['error' => 'Action indisponible pour cet opérateur.'], 422);
        }

        $pattern = (string) $ussd['pattern'];
        $montant = null;

        // --- Validation du montant si le pattern l'exige ---
        if (str_contains($pattern, '{montant}')) {
            if ($montantRaw === '' || !ctype_digit((string) $montantRaw)) {
                $this->json(['error' => 'Montant requis (entier en FCFA).'], 422);
            }
            $montant = (int) $montantRaw;
            if ($montant < MONTANT_MIN || $montant > MONTANT_MAX) {
                $this->json([
                    'error' => sprintf('Montant hors limites (%d à %d FCFA).', MONTANT_MIN, MONTANT_MAX),
                ], 422);
            }
        }

        // --- Validation d'un code éventuel (transfert par ex.) ---
        if (str_contains($pattern, '{code}')) {
            if ($codeParam === '' || !ctype_digit($codeParam)) {
                $this->json(['error' => 'Un code numérique est requis pour cette action.'], 422);
            }
        }

        // --- Remplacement des placeholders ---
        $final = strtr($pattern, [
            '{numero}'  => $numero,
            '{montant}' => (string) ($montant ?? ''),
            '{code}'    => $codeParam,
        ]);

        // Lien tel: — le # doit être encodé en %23 pour le composeur.
        $tel = 'tel:' . str_replace('#', '%23', $final);

        // Journalisation statistique (best-effort, ne bloque jamais la réponse).
        try {
            (new Log())->logUssdGeneration($slug, $action);
        } catch (\Throwable) {
            // On ignore silencieusement toute erreur de log.
        }

        $this->json([
            'operateur' => $slug,
            'action'    => $action,
            'libelle'   => $ussd['libelle'],
            'code'      => $final,
            'tel'       => $tel,
        ]);
    }

    // -----------------------------------------------------------------------
    // Rate-limiting simple par session (fenêtre glissante à la minute)
    // -----------------------------------------------------------------------

    private function rateLimited(string $key): bool
    {
        $store = \App\Core\Session::get('_ussd_rl', []);
        $entry = $store[$key] ?? null;
        if ($entry === null || time() > $entry['reset']) {
            return false;
        }
        return $entry['count'] >= USSD_MAX_PER_MINUTE;
    }

    private function rateHit(string $key): void
    {
        $store = \App\Core\Session::get('_ussd_rl', []);
        $entry = $store[$key] ?? ['count' => 0, 'reset' => time() + 60];
        if (time() > $entry['reset']) {
            $entry = ['count' => 0, 'reset' => time() + 60];
        }
        $entry['count']++;
        $store[$key] = $entry;
        \App\Core\Session::set('_ussd_rl', $store);
    }
}
