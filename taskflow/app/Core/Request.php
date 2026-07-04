<?php
namespace App\Core;

class Request {
    private static $jsonCached = null;

    // Get value from $_GET query parameters
    public static function get($key = null, $default = null) {
        if ($key === null) {
            return self::sanitize($_GET);
        }
        return isset($_GET[$key]) ? self::sanitize($_GET[$key]) : $default;
    }

    // Get value from $_POST parameters
    public static function post($key = null, $default = null) {
        if ($key === null) {
            return self::sanitize($_POST);
        }
        return isset($_POST[$key]) ? self::sanitize($_POST[$key]) : $default;
    }

    // Parse and cache raw input JSON
    public static function json($key = null, $default = null) {
        if (self::$jsonCached === null) {
            $rawInput = file_get_contents('php://input');
            $decoded = json_decode($rawInput, true);
            self::$jsonCached = is_array($decoded) ? $decoded : [];
        }

        if ($key === null) {
            return self::sanitize(self::$jsonCached);
        }

        return isset(self::$jsonCached[$key]) ? self::sanitize(self::$jsonCached[$key]) : $default;
    }

    // Check if key exists in JSON payload
    public static function hasJson($key) {
        self::json();
        return isset(self::$jsonCached[$key]);
    }

    // Get uploaded file info
    public static function file($key) {
        return isset($_FILES[$key]) ? $_FILES[$key] : null;
    }

    // Get request header value (case-insensitive)
    public static function header($key) {
        $normalizedKey = strtolower($key);
        $headers = self::headers();
        return isset($headers[$normalizedKey]) ? $headers[$normalizedKey] : null;
    }

    // Retrieve all request headers
    public static function headers() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headerName = strtolower(str_replace('_', '-', substr($name, 5)));
                $headers[$headerName] = $value;
            } elseif ($name == 'CONTENT_TYPE') {
                $headers['content-type'] = $value;
            } elseif ($name == 'CONTENT_LENGTH') {
                $headers['content-length'] = $value;
            }
        }
        return $headers;
    }

    // Sanitize string/array to prevent basic XSS injections
    public static function sanitize($data) {
        if (is_array($data)) {
            $sanitized = [];
            foreach ($data as $k => $v) {
                $sanitized[$k] = self::sanitize($v);
            }
            return $sanitized;
        }

        if (is_string($data)) {
            return htmlspecialchars(trim($data), ENT_QUOTES, 'UTF-8');
        }

        return $data;
    }

    // Retrieve Client IP address
    public static function ip() {
        if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
            return $_SERVER['HTTP_CLIENT_IP'];
        } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            // Can contain multiple IPs comma-separated
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            return trim($ips[0]);
        }
        return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    }
}
