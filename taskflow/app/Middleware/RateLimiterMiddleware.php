<?php
namespace App\Middleware;

use App\Core\Middleware;
use App\Core\Request;
use App\Core\Response;

class RateLimiterMiddleware extends Middleware {
    public function handle($params, $next) {
        $ip = Request::ip();
        
        // Configure thresholds: tighter limits for authentication endpoints
        $uri = $_SERVER['REQUEST_URI'] ?? '';
        $isAuth = (stripos($uri, '/api/auth') !== false);
        
        $maxRequests = $isAuth ? 20 : 150; // Tighter brute force control on auth
        $windowSeconds = 60; // 1 minute window
        
        // Store rate limiting info in system temp directory to be extremely fast
        $cacheDir = sys_get_temp_dir() . '/taskflow_rate_limit';
        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0777, true);
        }
        
        $keyFile = $cacheDir . '/rate_' . md5($ip . ($isAuth ? '_auth' : '_api'));
        $now = time();
        
        $timestamps = [];
        if (file_exists($keyFile)) {
            $data = @file_get_contents($keyFile);
            $timestamps = json_decode($data, true) ?: [];
        }
        
        // Remove expired entries
        $timestamps = array_filter($timestamps, function($ts) use ($now, $windowSeconds) {
            return ($now - $ts) < $windowSeconds;
        });
        
        // Check threshold
        if (count($timestamps) >= $maxRequests) {
            Response::json([
                'message' => 'Trop de requêtes. Veuillez patienter une minute avant de réessayer.'
            ], 429);
        }
        
        // Register current hit
        $timestamps[] = $now;
        @file_put_contents($keyFile, json_encode(array_values($timestamps)));
        
        return $next();
    }
}
