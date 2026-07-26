<?php
declare(strict_types=1);

namespace Amoura\Core;

use PDO;
use PDOException;

/**
 * Singleton PDO. Toutes les requêtes de l'application passent par cette
 * connexion unique. Requêtes préparées uniquement (voir Model).
 */
final class Database
{
    private static ?PDO $instance = null;

    private function __construct() {}

    public static function connection(): PDO
    {
        if (self::$instance instanceof PDO) {
            return self::$instance;
        }

        $host    = (string) Env::get('DB_HOST', '127.0.0.1');
        $port    = (string) Env::get('DB_PORT', '3306');
        $name    = (string) Env::get('DB_NAME', 'amoura');
        $charset = (string) Env::get('DB_CHARSET', 'utf8mb4');

        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";

        try {
            self::$instance = new PDO(
                $dsn,
                (string) Env::get('DB_USER', 'root'),
                (string) Env::get('DB_PASS', ''),
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    // false => vraies requêtes préparées côté serveur (anti-injection robuste).
                    PDO::ATTR_EMULATE_PREPARES   => false,
                    PDO::ATTR_STRINGIFY_FETCHES  => false,
                ]
            );
        } catch (PDOException $e) {
            self::renderConnectionError($e, $host, $port, $name);
        }

        return self::$instance;
    }

    /**
     * Affiche un guide d'installation clair au lieu d'un stack trace brut
     * lorsque la connexion échoue (accès refusé, base absente, MySQL arrêté…).
     */
    private static function renderConnectionError(PDOException $e, string $host, string $port, string $name): never
    {
        $user  = (string) Env::get('DB_USER', 'root');
        $code  = (int) $e->getCode();
        $debug = Env::bool('APP_DEBUG');

        // Diagnostic ciblé selon l'erreur MySQL.
        [$titre, $cause] = match ($code) {
            1045    => ['Accès refusé à MySQL', "L'utilisateur « {$user} » n'existe pas ou le mot de passe est incorrect."],
            1049    => ['Base de données introuvable', "La base « {$name} » n'existe pas encore."],
            2002    => ['Serveur MySQL injoignable', "Aucun serveur MySQL ne répond sur {$host}:{$port} (démarrez MySQL dans XAMPP)."],
            default => ['Erreur de connexion à la base de données', $e->getMessage()],
        };

        // En CLI (scripts/migrate.php…), message texte.
        if (PHP_SAPI === 'cli') {
            fwrite(STDERR, "❌ {$titre}\n   {$cause}\n\n"
                . "Vérifiez le fichier .env (DB_HOST, DB_NAME, DB_USER, DB_PASS)\n"
                . "puis créez la base : importez database/install.sql dans phpMyAdmin,\n"
                . "ou lancez : php scripts/migrate.php --fresh\n");
            exit(1);
        }

        http_response_code(503);
        header('Content-Type: text/html; charset=utf-8');
        $rawMessage = $debug ? '<p style="color:#b91c1c"><code>' . htmlspecialchars($e->getMessage()) . '</code></p>' : '';
        echo <<<HTML
<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Configuration requise · Amoura</title>
<style>
 body{font-family:Inter,system-ui,Arial,sans-serif;background:#fbfafc;color:#1c1626;margin:0;padding:40px 16px;line-height:1.6}
 .box{max-width:680px;margin:0 auto;background:#fff;border:1px solid #e8e4ee;border-radius:16px;padding:32px;box-shadow:0 8px 24px rgba(28,22,38,.08)}
 h1{margin:0 0 4px;font-size:1.5rem}.brand{background:linear-gradient(135deg,#ff5a7e,#8b5cf6);-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:800}
 .alert{background:#fef2f2;color:#b91c1c;border-radius:10px;padding:12px 16px;margin:16px 0;font-weight:600}
 ol{padding-left:20px}li{margin:10px 0}
 code,pre{background:#f4f2f7;border-radius:8px;padding:2px 6px;font-family:ui-monospace,Menlo,monospace;font-size:.9em}
 pre{padding:14px;overflow:auto;white-space:pre-wrap}
 .muted{color:#6b6577;font-size:.9rem}
</style></head><body><div class="box">
 <h1>💞 <span class="brand">Amoura</span> — configuration requise</h1>
 <p class="muted">L'application est bien installée, il reste à connecter la base de données.</p>
 <div class="alert">⚠️ {$titre} — {$cause}</div>
 {$rawMessage}
 <h3>Comment corriger (XAMPP / WAMP)</h3>
 <ol>
  <li>Démarrez <b>Apache</b> et <b>MySQL</b> dans le panneau XAMPP.</li>
  <li>Ouvrez <a href="http://localhost/phpmyadmin" target="_blank">phpMyAdmin</a> → onglet <b>Importer</b> → choisissez
      le fichier <code>database/install.sql</code> (crée la base <code>{$name}</code> + l'utilisateur + le schéma + les données en une fois).</li>
  <li>Vérifiez votre fichier <code>.env</code>. Par défaut sous XAMPP :
      <pre>DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=amoura
DB_USER=root
DB_PASS=</pre>
      (l'utilisateur <code>root</code> de XAMPP n'a <b>pas de mot de passe</b> par défaut).</li>
  <li>Créez un compte administrateur :
      <pre>php scripts/make_admin.php admin@amoura.example "Admin@1234"</pre></li>
  <li>Rechargez cette page.</li>
 </ol>
 <p class="muted">Alternative en ligne de commande : <code>php scripts/migrate.php --fresh</code></p>
</div></body></html>
HTML;
        exit;
    }

    /** Injection d'une connexion (tests). */
    public static function setConnection(PDO $pdo): void
    {
        self::$instance = $pdo;
    }

    private static ?PDO $reader = null;

    /**
     * Connexion en lecture (réplica). Utilise DB_READ_HOST si défini, sinon la
     * connexion primaire. Sépare la charge de lecture des écritures (Sprint +6).
     */
    public static function read(): PDO
    {
        $readHost = (string) Env::get('DB_READ_HOST', '');
        if ($readHost === '') {
            return self::connection(); // pas de réplica → primaire
        }
        if (self::$reader instanceof PDO) {
            return self::$reader;
        }
        $port = (string) Env::get('DB_READ_PORT', Env::get('DB_PORT', '3306'));
        $name = (string) Env::get('DB_NAME', 'amoura');
        $charset = (string) Env::get('DB_CHARSET', 'utf8mb4');
        try {
            self::$reader = new PDO(
                "mysql:host={$readHost};port={$port};dbname={$name};charset={$charset}",
                (string) Env::get('DB_READ_USER', Env::get('DB_USER', 'root')),
                (string) Env::get('DB_READ_PASS', Env::get('DB_PASS', '')),
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
            return self::$reader;
        } catch (PDOException $e) {
            // Réplica indisponible → repli sur le primaire (résilience).
            return self::connection();
        }
    }
}
