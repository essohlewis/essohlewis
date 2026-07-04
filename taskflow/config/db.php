<?php
// config/db.php - Database connection singleton using PDO

class DB {
    private static $pdo = null;

    public static function connect() {
        if (self::$pdo !== null) {
            return self::$pdo;
        }

        // Retrieve config from env or fallback
        $host = getenv('DB_HOST') ?: '127.0.0.1';
        $port = getenv('DB_PORT') ?: '3306';
        $user = getenv('DB_USER') ?: 'root';
        $pass = getenv('DB_PASSWORD') !== false ? getenv('DB_PASSWORD') : 'rootpassword';
        $name = getenv('DB_NAME') ?: 'taskflow';

        $dsn = "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_PERSISTENT         => true, // Persistent connection (emulates connection pool keep-alive)
        ];

        try {
            self::$pdo = new PDO($dsn, $user, $pass, $options);
            return self::$pdo;
        } catch (PDOException $e) {
            $msg = $e->getMessage();
            $hint = self::getConnectionHint($msg, $user, $host, $port, $name);
            
            // Output JSON error for API requests
            if (!headers_sent()) {
                http_response_code(500);
                header('Content-Type: application/json; charset=utf-8');
            }
            echo json_encode([
                'message' => 'Impossible de se connecter à la base de données.',
                'error' => [
                    'code' => $e->getCode(),
                    'message' => $msg,
                ],
                'hint' => $hint
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    private static function getConnectionHint($msg, $user, $host, $port, $name) {
        if (stripos($msg, 'Access denied') !== false) {
            return "Identifiants refusés : vérifiez DB_USER / DB_PASSWORD dans .env (ou config docker-compose.yml).";
        }
        if (stripos($msg, 'Unknown database') !== false) {
            return "La base '$name' n'existe pas : créez-la et importez le schéma (mysql -u $user -p < schema.sql).";
        }
        if (stripos($msg, 'Connection refused') !== false || stripos($msg, 'Can\'t connect') !== false) {
            return "Aucun serveur MySQL n'écoute sur $host:$port : MySQL est-il démarré ? DB_HOST / DB_PORT sont-ils corrects ?";
        }
        return "Veuillez vérifier la configuration DB_* de votre fichier .env ou docker-compose.yml.";
    }
}
