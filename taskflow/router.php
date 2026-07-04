<?php
// router.php - Used for local PHP development server: php -S localhost:3000 router.php
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

// Serve root from public/index.html
if ($uri === '/') {
    include __DIR__ . '/public/index.html';
    return;
}

// If file exists in public directory, let PHP serve it (CSS, JS, etc.)
if (file_exists(__DIR__ . '/public' . $uri) && !is_dir(__DIR__ . '/public' . $uri)) {
    return false;
}

// Route all other requests to front controller
include __DIR__ . '/index.php';
