<?php
namespace App\Middleware;

use App\Core\Middleware;

class CorsMiddleware extends Middleware {
    public function handle($params, $next) {
        header("Access-Control-Allow-Origin: *");
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS");
        header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Tenant-Slug");
        header("Access-Control-Allow-Credentials: true");

        // Handle preflight request
        if (strtoupper($_SERVER['REQUEST_METHOD']) === 'OPTIONS') {
            http_response_code(200);
            exit;
        }

        return $next();
    }
}
