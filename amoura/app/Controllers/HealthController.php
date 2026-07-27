<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Env;
use Amoura\Core\Observability\HealthCheck;
use Amoura\Core\Observability\Metrics;
use Amoura\Core\Observability\RequestContext;
use Amoura\Core\Request;

/**
 * Points de terminaison d'observabilité (Phase 6, Sprint +13) :
 *  - /healthz        liveness (aucune dépendance)
 *  - /healthz/ready  readiness (BDD, cache, disque)
 *  - /metrics        exposition Prometheus (protégée par jeton)
 */
final class HealthController
{
    /** Liveness : le process répond. Toujours 200 si PHP tourne. */
    public function live(): void
    {
        $this->emitJson(200, ['status' => 'ok', 'request_id' => RequestContext::id()]);
    }

    /** Readiness : dépendances joignables. 503 si une dépendance critique tombe. */
    public function ready(): void
    {
        $report = HealthCheck::run(true);
        $report['request_id'] = RequestContext::id();
        $this->emitJson($report['status'] === 'unhealthy' ? 503 : 200, $report);
    }

    /** Métriques Prometheus (text/plain), protégées par METRICS_TOKEN. */
    public function metrics(Request $request): void
    {
        $token = (string) Env::get('METRICS_TOKEN', '');
        $provided = $this->bearer($request);
        if ($token === '' || !hash_equals($token, $provided)) {
            http_response_code(403);
            header('Content-Type: text/plain; charset=utf-8');
            echo "403 metrics token requis\n";
            return;
        }

        Metrics::collectAppGauges();
        Metrics::gauge('amoura_up', 1, [], 'La application répond');
        http_response_code(200);
        header('Content-Type: text/plain; version=0.0.4; charset=utf-8');
        echo Metrics::render();
    }

    /** Jeton porteur depuis l'en-tête Authorization ou ?token=. */
    private function bearer(Request $request): string
    {
        $auth = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
        if (stripos($auth, 'bearer ') === 0) {
            return trim(substr($auth, 7));
        }
        return (string) $request->query('token', '');
    }

    private function emitJson(int $status, array $body): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }
}
