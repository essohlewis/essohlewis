<?php
/**
 * Routeur minimaliste (front controller).
 *
 * Les routes sont déclarées explicitement. Chaque route associe une
 * méthode HTTP + un motif à un couple [Contrôleur, méthode]. Les segments
 * dynamiques sont notés {nom} et transmis en arguments.
 *
 * Ex : $router->get('/client/commande/{id}', [ClientController::class, 'commande']);
 */

declare(strict_types=1);

namespace App\Core;

class Router
{
    /** @var array<int,array{methode:string,motif:string,cible:array}> */
    private array $routes = [];

    private array $config;

    public function __construct(array $config)
    {
        $this->config = $config;
    }

    public function get(string $motif, array $cible): void
    {
        $this->ajouter('GET', $motif, $cible);
    }

    public function post(string $motif, array $cible): void
    {
        $this->ajouter('POST', $motif, $cible);
    }

    private function ajouter(string $methode, string $motif, array $cible): void
    {
        $this->routes[] = ['methode' => $methode, 'motif' => $motif, 'cible' => $cible];
    }

    /** Résout l'URI courante et exécute le contrôleur correspondant. */
    public function dispatch(): void
    {
        $methode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $uri     = $this->uriCourante();

        foreach ($this->routes as $route) {
            if ($route['methode'] !== $methode) {
                continue;
            }

            $regex = $this->motifVersRegex($route['motif']);
            if (preg_match($regex, $uri, $params)) {
                // Ne garder que les groupes nommés (arguments).
                $args = array_filter(
                    $params,
                    static fn($cle) => is_string($cle),
                    ARRAY_FILTER_USE_KEY
                );

                [$classe, $action] = $route['cible'];
                $controleur = new $classe($this->config);
                $controleur->{$action}(...array_values($args));
                return;
            }
        }

        $this->page404();
    }

    private function uriCourante(): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

        // Retire le préfixe base_url si l'app n'est pas à la racine du domaine.
        $base = rtrim($this->config['app']['base_url'], '/');
        if ($base !== '' && str_starts_with($uri, $base)) {
            $uri = substr($uri, strlen($base));
        }

        $uri = '/' . trim($uri, '/');
        return $uri === '/' ? '/' : rtrim($uri, '/');
    }

    /** Transforme "/client/commande/{id}" en expression régulière. */
    private function motifVersRegex(string $motif): string
    {
        $motif = rtrim($motif, '/');
        if ($motif === '') {
            $motif = '/';
        }
        $regex = preg_replace('#\{(\w+)\}#', '(?<$1>[^/]+)', $motif);
        return '#^' . $regex . '$#';
    }

    private function page404(): void
    {
        http_response_code(404);
        echo '<!doctype html><html lang="fr"><meta charset="utf-8">'
           . '<title>Page introuvable</title>'
           . '<body style="font-family:sans-serif;text-align:center;padding:3rem">'
           . '<h1>404</h1><p>Cette page n\'existe pas.</p>'
           . '<p><a href="' . htmlspecialchars($this->config['app']['base_url'] ?: '/') . '">Retour à l\'accueil</a></p>'
           . '</body></html>';
    }
}
