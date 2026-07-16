<?php
/* ==========================================================================
   core/Router.php — Routeur : associe méthode+chemin à un contrôleur.
   Supporte les paramètres nommés : "/coachs/:id".
   ========================================================================== */

class Router
{
    private array $routes = [];

    public function get(string $motif, $action): void    { $this->ajouter('GET', $motif, $action); }
    public function post(string $motif, $action): void   { $this->ajouter('POST', $motif, $action); }
    public function patch(string $motif, $action): void  { $this->ajouter('PATCH', $motif, $action); }
    public function put(string $motif, $action): void    { $this->ajouter('PUT', $motif, $action); }
    public function delete(string $motif, $action): void { $this->ajouter('DELETE', $motif, $action); }

    private function ajouter(string $methode, string $motif, $action): void
    {
        // Convertit "/coachs/:id" en expression régulière avec groupes nommés.
        $regex = preg_replace('#:([\w]+)#', '(?<$1>[^/]+)', $motif);
        $this->routes[] = [
            'methode' => $methode,
            'regex'   => '#^' . $regex . '$#',
            'action'  => $action,
        ];
    }

    /** Traite la requête courante. */
    public function dispatch(): void
    {
        $methode = Request::methode();
        $chemin  = Request::chemin();

        foreach ($this->routes as $route) {
            if ($route['methode'] !== $methode) {
                continue;
            }
            if (preg_match($route['regex'], $chemin, $m)) {
                // Paramètres nommés uniquement.
                $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);
                [$classe, $method] = $route['action'];
                $controleur = new $classe();
                $controleur->$method($params);
                return;
            }
        }
        Response::erreur('Route introuvable : ' . $methode . ' ' . $chemin, 404);
    }
}
