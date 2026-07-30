<?php
declare(strict_types=1);

/**
 * index.php — contrôleur frontal (routeur) de l'API PHP de Marché CI.
 * Vanilla PHP + PDO, aucun framework. Sert l'API sous /api/shop/… (le même
 * contrat que le backend Node), afin que le front SPA existant fonctionne tel quel.
 *
 * Lancement (dev) :  php -S localhost:8000 -t public public/index.php
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');

require __DIR__ . '/../src/Db.php';
require __DIR__ . '/../src/Http.php';
require __DIR__ . '/../src/Auth.php';
require __DIR__ . '/../src/Shop.php';

$reqMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$reqPath   = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// Sert la marketplace front (statique) pour tout ce qui n'est pas l'API : un
// seul `php -S` fait tourner le front ET le backend (pratique en développement).
$MARKET = realpath(__DIR__ . '/../..');
if ($reqMethod === 'GET' && $MARKET && !str_starts_with($reqPath, '/api/')) {
    $rel  = $reqPath === '/' ? '/index.html' : $reqPath;
    $file = realpath($MARKET . $rel);
    if ($file && str_starts_with($file, $MARKET) && is_file($file)) {
        $ext   = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $types = ['html' => 'text/html', 'js' => 'application/javascript', 'mjs' => 'application/javascript',
                  'css' => 'text/css', 'json' => 'application/json', 'svg' => 'image/svg+xml', 'png' => 'image/png',
                  'jpg' => 'image/jpeg', 'webmanifest' => 'application/manifest+json', 'ico' => 'image/x-icon'];
        header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream') . '; charset=utf-8');
        readfile($file);
        exit;
    }
}

Http::cors();

set_exception_handler(function (Throwable $e): void {
    Http::json(['ok' => false, 'error' => 'Erreur interne du serveur.'], 500);
});

// Initialise la base (schéma + amorçage) au besoin.
Db::pdo();
Shop::seedIfEmpty();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path   = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// Versionnement : /api/v1/shop/* est un alias de /api/shop/*.
$path = preg_replace('#^/api/v1/#', '/api/', $path);
// KYC : état du service (reconnaissance faciale non incluse dans ce socle PHP ;
// le front retombe alors sur une revue manuelle / le mode local).
if ($path === '/api/kyc/health') {
    Http::json(['ok' => true, 'service' => 'kyc-php', 'face' => false, 'liveness' => false]);
}
// On ne router que le préfixe /api/shop.
if (!str_starts_with($path, '/api/shop')) {
    Http::error('Ressource introuvable.', 404);
}
$route = rtrim(substr($path, strlen('/api/shop')), '/');
if ($route === '') { $route = '/'; }

/** Correspondance simple méthode + motif (segments :param). */
function match_route(string $method, string $wantMethod, string $route, string $pattern, array &$params): bool
{
    if ($method !== $wantMethod) { return false; }
    $rp = explode('/', trim($route, '/'));
    $pp = explode('/', trim($pattern, '/'));
    if (count($rp) !== count($pp)) { return false; }
    $params = [];
    foreach ($pp as $i => $seg) {
        if (str_starts_with($seg, ':')) { $params[substr($seg, 1)] = urldecode($rp[$i]); }
        elseif ($seg !== $rp[$i]) { return false; }
    }
    return true;
}

$p = [];

/* --------------------------------- Système --------------------------------- */
if (match_route($method, 'GET', $route, '/health', $p)) {
    Http::json(['ok' => true, 'service' => 'shop-php', 'db' => true, 'products' => Shop::countProducts()]);
}

/* ------------------------------ Authentification --------------------------- */
if (match_route($method, 'POST', $route, '/register', $p)) { Http::json(Auth::register(Http::body())); }
if (match_route($method, 'POST', $route, '/login', $p))    { Http::json(Auth::login(Http::body())); }
if (match_route($method, 'POST', $route, '/logout', $p))   { Auth::logout(); Http::ok(); }
if (match_route($method, 'GET', $route, '/me', $p)) {
    $u = Auth::requireUser();
    Http::json(['ok' => true, 'user' => Auth::publicUser($u)]);
}

/* --------------------------------- Catalogue ------------------------------- */
if (match_route($method, 'GET', $route, '/products', $p)) {
    Http::json(['ok' => true] + Http::page(Shop::listProducts(Http::query('category'), Http::query('q'), Http::query('storeId'), 1000)));
}
if (match_route($method, 'GET', $route, '/products/search', $p)) {
    Http::json(['ok' => true, 'q' => Http::query('q', '')] + Http::page(Shop::search((string) Http::query('q', ''), Http::query('category'), Http::query('storeId'), 500)));
}
if (match_route($method, 'GET', $route, '/products/facets', $p)) {
    Http::json(['ok' => true] + Shop::facets(Http::query('q'), Http::query('storeId')));
}
if (match_route($method, 'GET', $route, '/categories', $p)) {
    Http::json(['ok' => true, 'items' => Shop::categories(), 'tree' => Shop::categoryTree()]);
}
if (match_route($method, 'GET', $route, '/products/:id', $p)) {
    $prod = Shop::getProduct($p['id']);
    $prod ? Http::json(['ok' => true, 'product' => $prod]) : Http::error('Produit introuvable.', 404);
}
if (match_route($method, 'POST', $route, '/products', $p)) {
    Auth::requireAdmin();
    $body = Http::body();
    $list = is_array($body['products'] ?? null) ? $body['products'] : (isset($body['id']) || isset($body['name']) ? [$body] : []);
    Http::json(['ok' => true, 'count' => Shop::upsertProducts($list)]);
}

/* ---------------------------------- Panier --------------------------------- */
if (match_route($method, 'GET', $route, '/cart', $p)) {
    $u = Auth::requireUser();
    Http::json(['ok' => true, 'items' => Shop::getCart($u['id'])]);
}
if (match_route($method, 'PUT', $route, '/cart', $p)) {
    $u = Auth::requireUser();
    $items = Http::body()['items'] ?? [];
    Shop::setCart($u['id'], is_array($items) ? $items : []);
    Http::ok(['items' => Shop::getCart($u['id'])]);
}

/* -------------------------------- Commandes -------------------------------- */
if (match_route($method, 'POST', $route, '/orders', $p)) {
    $u = Auth::current();
    $res = Shop::createOrder($u['id'] ?? null, Http::body());
    isset($res['error']) ? Http::error($res['error']) : Http::json(['ok' => true, 'order' => $res['order']]);
}
if (match_route($method, 'GET', $route, '/orders', $p)) {
    $u = Auth::requireUser();
    Http::json(['ok' => true] + Http::page(Shop::listOrders($u['id'])));
}
if (match_route($method, 'GET', $route, '/orders/:id', $p)) {
    $u = Auth::requireUser();
    $o = Shop::getOrder($p['id']);
    (!$o || $o['userId'] !== $u['id']) ? Http::error('Commande introuvable.', 404) : Http::json(['ok' => true, 'order' => $o]);
}

/* ---------------------------------- Avis ----------------------------------- */
if (match_route($method, 'POST', $route, '/reviews', $p)) {
    $u = Auth::requireUser();
    $b = Http::body(); $b['authorName'] = $u['name'] ?: ($b['authorName'] ?? 'Client');
    $r = Shop::addReview($u['id'], $b);
    isset($r['error']) ? Http::error($r['error']) : Http::json($r);
}
if (match_route($method, 'GET', $route, '/reviews', $p)) {
    $tt = Http::query('targetType'); $ti = Http::query('targetId');
    Http::json(['ok' => true] + Http::page(Shop::listReviews($tt, $ti)) + ['rating' => $ti ? Shop::ratingFor($tt ?: 'product', $ti) : null]);
}

/* -------------- Collections synchronisées (favoris, souhaits…) ------------- */
if (match_route($method, 'GET', $route, '/data', $p)) {
    $u = Auth::requireUser();
    Http::json(['ok' => true, 'collections' => Shop::getAllDocs($u['id'])]);
}
if (match_route($method, 'GET', $route, '/data/meta', $p)) {
    $u = Auth::requireUser();
    Http::json(['ok' => true, 'meta' => Shop::getDocsMeta($u['id'])]);
}
if (match_route($method, 'GET', $route, '/data/:collection', $p)) {
    $u = Auth::requireUser();
    if (!Shop::isSyncCollection($p['collection'])) { Http::error('Collection inconnue.'); }
    $d = Shop::getDocWithMeta($u['id'], $p['collection']);
    Http::json(['ok' => true, 'data' => $d['data'], 'updatedAt' => $d['updatedAt']]);
}
if (match_route($method, 'PUT', $route, '/data/:collection', $p)) {
    $u = Auth::requireUser();
    $r = Shop::putDoc($u['id'], $p['collection'], Http::body()['data'] ?? null);
    isset($r['error']) ? Http::error($r['error']) : Http::json($r);
}

/* -------------------------------- Paiements -------------------------------- */
if (match_route($method, 'GET', $route, '/payments/methods', $p)) {
    // Socle : paiement à la livraison (COD). Mobile money/carte : à brancher.
    Http::json(['ok' => true, 'live' => false, 'methods' => [
        ['id' => 'cod', 'label' => 'Paiement à la livraison', 'icon' => '💵', 'kind' => 'cod', 'live' => true],
    ]]);
}

/* ------------------------------ Administration ----------------------------- */
if (match_route($method, 'GET', $route, '/admin/orders', $p)) {
    Auth::requireAdmin();
    Http::json(['ok' => true] + Http::page(Shop::listOrders(null, Http::query('status'))));
}
if (match_route($method, 'POST', $route, '/admin/orders/:id/status', $p)) {
    Auth::requireAdmin();
    $o = Shop::setOrderStatus($p['id'], (string) (Http::body()['status'] ?? ''));
    $o ? Http::json(['ok' => true, 'order' => $o]) : Http::error('Statut invalide ou commande introuvable.');
}
if (match_route($method, 'GET', $route, '/admin/stats', $p)) {
    Auth::requireAdmin();
    Http::json(['ok' => true, 'stats' => Shop::stats()]);
}

Http::error('Route inconnue : ' . $method . ' ' . $route, 404);
