<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Env;
use Amoura\Core\Request;
use Amoura\Core\Security\Auth;
use Amoura\Models\Page;
use Amoura\Models\Plan;
use Amoura\Models\Setting;

final class HomeController extends Controller
{
    public function landing(Request $request): void
    {
        if (Auth::check()) {
            $this->redirect('/app');
        }
        $this->view('home', [
            'plans' => (new Plan())->active(),
            'settings' => (new Setting())->values(),
        ], 'layouts/public');
    }

    public function page(Request $request, array $params): void
    {
        $page = (new Page())->bySlug((string) $params['slug']);
        if (!$page) {
            http_response_code(404);
            $this->view('errors/error', ['code' => 404, 'message' => 'Page introuvable'], 'layouts/public');
            return;
        }
        $this->view('page', [
            'page' => $page,
            'seo' => ['title' => $page['title'], 'type' => 'article'],
        ], 'layouts/public');
    }

    /** Page publique et partageable d'un événement (SEO + Open Graph + JSON-LD). */
    public function event(Request $request, array $params): void
    {
        $event = (new \Amoura\Models\Event())->bySlug((string) $params['slug']);
        if (!$event || $event['status'] !== 'published') {
            http_response_code(404);
            $this->view('errors/error', ['code' => 404, 'message' => 'Événement introuvable'], 'layouts/public');
            return;
        }

        $base = rtrim((string) Env::get('APP_URL', ''), '/');
        $desc = mb_substr(trim((string) ($event['description'] ?? 'Un événement Amoura à ne pas manquer.')), 0, 200);
        $jsonld = [
            '@context' => 'https://schema.org',
            '@type' => 'Event',
            'name' => $event['title'],
            'startDate' => date('c', strtotime((string) $event['starts_at'])),
            'eventAttendanceMode' => !empty($event['is_online'])
                ? 'https://schema.org/OnlineEventAttendanceMode'
                : 'https://schema.org/OfflineEventAttendanceMode',
            'eventStatus' => 'https://schema.org/EventScheduled',
            'description' => $desc,
            'url' => $base . '/e/' . $event['slug'],
        ];
        if (!empty($event['ends_at'])) {
            $jsonld['endDate'] = date('c', strtotime((string) $event['ends_at']));
        }
        if (!empty($event['location'])) {
            $jsonld['location'] = ['@type' => 'Place', 'name' => $event['location']];
        }

        $this->view('public/event', [
            'event' => $event,
            'seo' => [
                'title' => $event['title'],
                'description' => $desc,
                'type' => 'article',
                'jsonld' => $jsonld,
            ],
        ], 'layouts/public');
    }

    /** Plan de site XML (pages publiques + événements publiés). */
    public function sitemap(Request $request): void
    {
        $base = rtrim((string) Env::get('APP_URL', ''), '/');
        $urls = [['loc' => $base . '/', 'priority' => '1.0']];
        foreach ((new Page())->allForAdmin() as $p) {
            if (!empty($p['is_published'])) {
                $urls[] = ['loc' => $base . '/p/' . $p['slug'], 'priority' => '0.5'];
            }
        }
        foreach ((new \Amoura\Models\Event())->upcoming(200) as $ev) {
            $urls[] = ['loc' => $base . '/e/' . $ev['slug'], 'priority' => '0.7',
                       'lastmod' => date('Y-m-d', strtotime((string) ($ev['updated_at'] ?? $ev['created_at'] ?? 'now')))];
        }

        header('Content-Type: application/xml; charset=utf-8');
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n"
            . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        foreach ($urls as $u) {
            $xml .= '  <url><loc>' . htmlspecialchars($u['loc'], ENT_QUOTES) . '</loc>'
                . (isset($u['lastmod']) ? '<lastmod>' . $u['lastmod'] . '</lastmod>' : '')
                . '<priority>' . $u['priority'] . '</priority></url>' . "\n";
        }
        echo $xml . '</urlset>';
    }

    /** robots.txt : indexe le public, protège l'app et l'admin. */
    public function robots(Request $request): void
    {
        $base = rtrim((string) Env::get('APP_URL', ''), '/');
        header('Content-Type: text/plain; charset=utf-8');
        echo "User-agent: *\n"
            . "Allow: /$\n"
            . "Allow: /p/\n"
            . "Allow: /e/\n"
            . "Disallow: /app\n"
            . "Disallow: /admin\n"
            . "Disallow: /api\n"
            . "Disallow: /settings\n"
            . "Disallow: /messages\n"
            . "Disallow: /premium\n"
            . "Disallow: /discover\n"
            . ($base !== '' ? "Sitemap: {$base}/sitemap.xml\n" : '');
    }
}
