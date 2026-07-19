<?php
/**
 * api.php — Front-controller du backend de vérification (KYC), PHP pur.
 * Aucun framework : un simple routeur par ?action=.
 *
 * Lancer en local :   php -S localhost:8000 -t marketplace
 * puis le front appelle  backend/api.php?action=...
 *
 * Actions :
 *   POST ?action=submit   { vendorId, vendorName, storeId, idType, idNumber,
 *                           idImage, idImageBack?, selfie, faceDetected, consent }
 *   GET  ?action=status&vendorId=...
 *   GET  ?action=list                 (admin — X-Admin-Token)
 *   POST ?action=review  { id, decision:"approve"|"reject", reason }  (admin)
 *   GET  ?action=image&id=...&kind=id|idback|selfie                   (admin)
 *   GET  ?action=ping
 */

require_once __DIR__ . '/lib.php';
cors();

$action = $_GET['action'] ?? '';
$pdo = db();

switch ($action) {

case 'ping':
    json_out(['ok' => true, 'service' => 'kyc', 'faceMatch' => FACE_MATCH_URL !== '']);

/* -------------------- Soumission d'une vérification -------------------- */
case 'submit':
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('POST requis.', 405);
    $b = body();
    $vendorId = trim((string)($b['vendorId'] ?? ''));
    if ($vendorId === '') fail('vendorId requis.');
    if (empty($b['consent'])) fail('Le consentement est requis.');

    $id = decode_image($b['idImage'] ?? null);
    if (!$id) fail("Image de la pièce d'identité invalide ou trop lourde.");
    $selfie = decode_image($b['selfie'] ?? null);
    if (!$selfie) fail('Selfie invalide ou trop lourd.');
    $idBack = decode_image($b['idImageBack'] ?? null); // optionnel

    // Analyse serveur : qualité + similarité perceptuelle + biométrie externe.
    $quality = intval((quality_score($id[0]) + quality_score($selfie[0])) / 2);
    $ext = external_face_match($b['idImage'] ?? '', $b['selfie'] ?? '');
    $similarity = $ext ? $ext['score'] : image_similarity($id[0], $selfie[0]);
    $autoMatch = $ext ? ($ext['match'] ? 1 : 0)
                      : (($similarity >= SIMILARITY_HINT_THRESHOLD && !empty($b['faceDetected'])) ? 1 : 0);

    // Sauvegarde des images.
    $idFile = save_image($id[0], 'id', $id[1]);
    $selfieFile = save_image($selfie[0], 'selfie', $selfie[1]);
    $idBackFile = $idBack ? save_image($idBack[0], 'idback', $idBack[1]) : '';

    // Une seule vérification active par vendeur : remplace la précédente non approuvée.
    $st = $pdo->prepare('SELECT id, status FROM kyc WHERE vendor_id = ? ORDER BY created_at DESC LIMIT 1');
    $st->execute([$vendorId]);
    $prev = $st->fetch(PDO::FETCH_ASSOC);
    if ($prev && $prev['status'] !== 'approved') {
        $pdo->prepare('DELETE FROM kyc WHERE id = ?')->execute([$prev['id']]);
    } elseif ($prev && $prev['status'] === 'approved') {
        fail('Ce vendeur est déjà vérifié.', 409);
    }

    $rid = uid();
    $pdo->prepare('INSERT INTO kyc (id, vendor_id, vendor_name, store_id, id_type, id_number, id_image, id_image_back, selfie, face_detected, quality_score, similarity, auto_match, status, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,"pending",?)')
        ->execute([
            $rid, $vendorId, (string)($b['vendorName'] ?? ''), (string)($b['storeId'] ?? ''),
            (string)($b['idType'] ?? ''), (string)($b['idNumber'] ?? ''),
            $idFile, $idBackFile, $selfieFile,
            !empty($b['faceDetected']) ? 1 : 0, $quality, $similarity, $autoMatch, time(),
        ]);

    json_out(['ok' => true, 'id' => $rid, 'status' => 'pending',
              'quality' => $quality, 'similarity' => $similarity, 'autoMatch' => (bool)$autoMatch]);

/* -------------------- Statut d'un vendeur -------------------- */
case 'status':
    $vendorId = trim((string)($_GET['vendorId'] ?? ''));
    if ($vendorId === '') fail('vendorId requis.');
    $st = $pdo->prepare('SELECT id, status, reason, quality_score, similarity, auto_match, created_at, reviewed_at FROM kyc WHERE vendor_id = ? ORDER BY created_at DESC LIMIT 1');
    $st->execute([$vendorId]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) json_out(['ok' => true, 'status' => 'none']);
    json_out(['ok' => true, 'status' => $row['status'], 'reason' => $row['reason'],
              'quality' => (int)$row['quality_score'], 'similarity' => (int)$row['similarity'],
              'autoMatch' => (bool)$row['auto_match'], 'submittedAt' => (int)$row['created_at']]);

/* -------------------- Liste (admin) -------------------- */
case 'list':
    require_admin();
    $status = $_GET['status'] ?? 'pending';
    $sql = 'SELECT * FROM kyc';
    $args = [];
    if ($status !== 'all') { $sql .= ' WHERE status = ?'; $args[] = $status; }
    $sql .= ' ORDER BY created_at DESC LIMIT 200';
    $st = $pdo->prepare($sql); $st->execute($args);
    $rows = array_map(function ($r) {
        return [
            'id' => $r['id'], 'vendorId' => $r['vendor_id'], 'vendorName' => $r['vendor_name'],
            'storeId' => $r['store_id'], 'idType' => $r['id_type'], 'idNumber' => $r['id_number'],
            'faceDetected' => (bool)$r['face_detected'], 'quality' => (int)$r['quality_score'],
            'similarity' => (int)$r['similarity'], 'autoMatch' => (bool)$r['auto_match'],
            'status' => $r['status'], 'reason' => $r['reason'],
            'createdAt' => (int)$r['created_at'], 'reviewedAt' => (int)$r['reviewed_at'],
            'idImageUrl' => 'api.php?action=image&kind=id&id=' . $r['id'],
            'idBackUrl' => $r['id_image_back'] ? 'api.php?action=image&kind=idback&id=' . $r['id'] : '',
            'selfieUrl' => 'api.php?action=image&kind=selfie&id=' . $r['id'],
        ];
    }, $st->fetchAll(PDO::FETCH_ASSOC));
    json_out(['ok' => true, 'items' => $rows]);

/* -------------------- Décision (admin) -------------------- */
case 'review':
    require_admin();
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('POST requis.', 405);
    $b = body();
    $id = (string)($b['id'] ?? '');
    $decision = (string)($b['decision'] ?? '');
    if (!in_array($decision, ['approve', 'reject'], true)) fail('Décision invalide.');
    $st = $pdo->prepare('SELECT id FROM kyc WHERE id = ?'); $st->execute([$id]);
    if (!$st->fetch()) fail('Vérification introuvable.', 404);
    $pdo->prepare('UPDATE kyc SET status = ?, reason = ?, reviewed_at = ? WHERE id = ?')
        ->execute([$decision === 'approve' ? 'approved' : 'rejected', (string)($b['reason'] ?? ''), time(), $id]);
    json_out(['ok' => true, 'status' => $decision === 'approve' ? 'approved' : 'rejected']);

/* -------------------- Image (admin) -------------------- */
case 'image':
    require_admin();
    $id = (string)($_GET['id'] ?? '');
    $kind = (string)($_GET['kind'] ?? 'id');
    $col = ['id' => 'id_image', 'idback' => 'id_image_back', 'selfie' => 'selfie'][$kind] ?? 'id_image';
    $st = $pdo->prepare("SELECT $col AS f FROM kyc WHERE id = ?"); $st->execute([$id]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row || !$row['f']) { http_response_code(404); exit; }
    $path = UPLOAD_DIR . '/' . $row['f'];
    if (!is_file($path)) { http_response_code(404); exit; }
    $mime = str_ends_with($row['f'], '.png') ? 'image/png' : 'image/jpeg';
    header('Content-Type: ' . $mime);
    header('Cache-Control: private, max-age=60');
    readfile($path);
    exit;

default:
    fail('Action inconnue.', 404);
}
