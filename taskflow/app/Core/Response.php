<?php
namespace App\Core;

class Response {
    // Send a JSON response with status code, gzip, and security headers
    public static function json($data, $statusCode = 200, $headers = []) {
        // Run ob_start with ob_gzhandler if it isn't already compressed
        if (!in_array('ob_gzhandler', ob_list_handlers()) && !headers_sent()) {
            @ob_start('ob_gzhandler');
        }

        // Set status code
        http_response_code($statusCode);

        // Default JSON headers
        header('Content-Type: application/json; charset=utf-8');

        // Security headers (Helmet equivalents)
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('X-XSS-Protection: 1; mode=block');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('X-Download-Options: noopen');

        // Custom headers
        foreach ($headers as $key => $value) {
            header("$key: $value");
        }

        // Output JSON payload
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // Send simple HTML/text or download response
    public static function send($content, $statusCode = 200, $headers = []) {
        if (!in_array('ob_gzhandler', ob_list_handlers()) && !headers_sent()) {
            @ob_start('ob_gzhandler');
        }

        http_response_code($statusCode);

        // Set security headers
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('X-XSS-Protection: 1; mode=block');

        foreach ($headers as $key => $value) {
            header("$key: $value");
        }

        echo $content;
        exit;
    }

    // Serve file download securely
    public static function download($filePath, $originalName, $mimeType = 'application/octet-stream') {
        if (!file_exists($filePath)) {
            self::json(['message' => 'Fichier introuvable.'], 404);
        }

        if (!headers_sent()) {
            header('Content-Description: File Transfer');
            header('Content-Type: ' . $mimeType);
            header('Content-Disposition: attachment; filename="' . basename($originalName) . '"');
            header('Expires: 0');
            header('Cache-Control: must-revalidate');
            header('Pragma: public');
            header('Content-Length: ' . filesize($filePath));
        }

        readfile($filePath);
        exit;
    }
}
