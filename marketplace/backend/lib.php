<?php
/**
 * lib.php — Fonctions utilitaires du backend KYC (PHP pur).
 * Base de données (PDO SQLite), réponses JSON, CORS, sauvegarde et
 * analyse d'images (GD), heuristique de similarité, appel biométrie externe.
 */

require_once __DIR__ . '/config.php';

/* ------------------------------------------------------------------ */
/*  Réponses HTTP / CORS                                               */
/* ------------------------------------------------------------------ */
function cors(): void {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
}

function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $msg, int $code = 400): void { json_out(['ok' => false, 'error' => $msg], $code); }

/** Corps JSON de la requête. */
function body(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '[]', true);
    return is_array($data) ? $data : [];
}

/** Vérifie le jeton d'administration (en-tête X-Admin-Token ou ?token= pour les <img>). */
function require_admin(): void {
    $tok = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ($_GET['token'] ?? '');
    if (!hash_equals(ADMIN_TOKEN, (string)$tok)) fail('Accès administrateur requis.', 401);
}

/* ------------------------------------------------------------------ */
/*  Base de données                                                    */
/* ------------------------------------------------------------------ */
function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0775, true);
    if (!is_dir(UPLOAD_DIR)) @mkdir(UPLOAD_DIR, 0775, true);
    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('CREATE TABLE IF NOT EXISTS kyc (
        id TEXT PRIMARY KEY,
        vendor_id TEXT NOT NULL,
        vendor_name TEXT,
        store_id TEXT,
        id_type TEXT,
        id_number TEXT,
        id_image TEXT,
        id_image_back TEXT,
        selfie TEXT,
        face_detected INTEGER DEFAULT 0,
        quality_score INTEGER DEFAULT 0,
        similarity INTEGER DEFAULT 0,
        auto_match INTEGER DEFAULT 0,
        status TEXT DEFAULT "pending",
        reason TEXT DEFAULT "",
        created_at INTEGER,
        reviewed_at INTEGER
    )');
    return $pdo;
}

function uid(string $p = 'kyc'): string { return $p . '_' . bin2hex(random_bytes(6)); }

/* ------------------------------------------------------------------ */
/*  Images                                                             */
/* ------------------------------------------------------------------ */
/** Décode une image data-URL / base64 ; renvoie [binaire, extension] ou null. */
function decode_image(?string $dataUrl): ?array {
    if (!$dataUrl) return null;
    $ext = 'jpg';
    if (preg_match('#^data:image/(\w+);base64,#i', $dataUrl, $m)) {
        $ext = strtolower($m[1]) === 'png' ? 'png' : 'jpg';
        $dataUrl = substr($dataUrl, strpos($dataUrl, ',') + 1);
    }
    $bin = base64_decode($dataUrl, true);
    if ($bin === false || strlen($bin) === 0) return null;
    if (strlen($bin) > MAX_IMAGE_BYTES) return null;
    $info = @getimagesizefromstring($bin);
    if ($info === false) return null; // pas une vraie image
    return [$bin, $ext];
}

/** Sauvegarde une image binaire, renvoie le nom de fichier relatif. */
function save_image(string $bin, string $prefix, string $ext): string {
    $name = $prefix . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
    file_put_contents(UPLOAD_DIR . '/' . $name, $bin);
    return $name;
}

/** Ressource GD depuis un binaire (ou null). */
function gd_from(string $bin) {
    $im = @imagecreatefromstring($bin);
    return $im ?: null;
}

/**
 * Score de qualité d'une image (0–100) : résolution, luminosité, netteté.
 * Sert à écarter les captures floues / trop sombres.
 */
function quality_score(string $bin): int {
    $im = gd_from($bin);
    if (!$im) return 0;
    $w = imagesx($im); $h = imagesy($im);
    $score = 0;
    // Résolution.
    $score += min(30, intval(($w * $h) / 20000));
    // Échantillonne luminosité + variance (netteté approx.).
    $sx = max(1, intval($w / 48)); $sy = max(1, intval($h / 48));
    $vals = [];
    for ($x = 0; $x < $w; $x += $sx) {
        for ($y = 0; $y < $h; $y += $sy) {
            $c = imagecolorat($im, $x, $y);
            $r = ($c >> 16) & 0xFF; $g = ($c >> 8) & 0xFF; $b = $c & 0xFF;
            $vals[] = ($r * 0.299 + $g * 0.587 + $b * 0.114);
        }
    }
    imagedestroy($im);
    if (!$vals) return $score;
    $mean = array_sum($vals) / count($vals);
    // Luminosité correcte (ni trop sombre ni cramée).
    if ($mean > 40 && $mean < 225) $score += 30;
    // Variance (contraste / netteté).
    $var = 0; foreach ($vals as $v) $var += ($v - $mean) ** 2; $var /= count($vals);
    $score += min(40, intval($var / 30));
    return max(0, min(100, $score));
}

/** Empreinte perceptuelle (aHash 8x8) d'une image → chaîne de 64 bits. */
function ahash(string $bin): ?string {
    $im = gd_from($bin);
    if (!$im) return null;
    $small = imagecreatetruecolor(8, 8);
    imagecopyresampled($small, $im, 0, 0, 0, 0, 8, 8, imagesx($im), imagesy($im));
    imagedestroy($im);
    $vals = []; $sum = 0;
    for ($y = 0; $y < 8; $y++) for ($x = 0; $x < 8; $x++) {
        $c = imagecolorat($small, $x, $y);
        $g = (($c >> 16 & 0xFF) * 0.299 + ($c >> 8 & 0xFF) * 0.587 + ($c & 0xFF) * 0.114);
        $vals[] = $g; $sum += $g;
    }
    imagedestroy($small);
    $avg = $sum / 64; $bits = '';
    foreach ($vals as $v) $bits .= ($v >= $avg ? '1' : '0');
    return $bits;
}

/**
 * Similarité perceptuelle grossière entre deux images (0–100).
 * NB : ce n'est PAS de la biométrie — juste une aide (détecte des images
 * identiques/manipulées). La vraie comparaison de visages passe par
 * FACE_MATCH_URL ou la revue humaine.
 */
function image_similarity(string $a, string $b): int {
    $ha = ahash($a); $hb = ahash($b);
    if (!$ha || !$hb) return 0;
    $same = 0;
    for ($i = 0; $i < 64; $i++) if ($ha[$i] === $hb[$i]) $same++;
    return intval($same / 64 * 100);
}

/**
 * Appelle un service biométrique externe si configuré (FACE_MATCH_URL).
 * Renvoie ['match'=>bool,'score'=>int] ou null si non configuré / échec.
 */
function external_face_match(string $idImage, string $selfie): ?array {
    if (FACE_MATCH_URL === '') return null;
    $payload = json_encode(['idImage' => $idImage, 'selfie' => $selfie]);
    $ch = curl_init(FACE_MATCH_URL);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    $res = curl_exec($ch); curl_close($ch);
    if ($res === false) return null;
    $j = json_decode($res, true);
    if (!is_array($j) || !isset($j['score'])) return null;
    return ['match' => !empty($j['match']), 'score' => intval($j['score'])];
}
