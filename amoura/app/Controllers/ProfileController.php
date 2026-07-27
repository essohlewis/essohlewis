<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Database;
use Amoura\Core\Request;
use Amoura\Core\Response;
use Amoura\Core\Session;
use Amoura\Core\Security\Auth;
use Amoura\Core\Security\Sanitizer;
use Amoura\Models\ActivityLog;
use Amoura\Models\Photo;
use Amoura\Models\Profile;
use Amoura\Models\Report;
use Amoura\Models\User;
use Amoura\Services\Uploader;

final class ProfileController extends Controller
{
    public function me(Request $request): void
    {
        $user = $this->requireAuth($request);
        $this->view('profile/show', [
            'profile' => (new User())->fullProfile((int) $user['id']),
            'photos' => (new Photo())->forUser((int) $user['id']),
            'own' => true,
        ]);
    }

    public function show(Request $request, array $params): void
    {
        $viewer = $this->requireAuth($request);
        $targetId = (int) $params['id'];
        $profile = (new User())->fullProfile($targetId);
        if (!$profile || $profile['status'] !== 'active') {
            http_response_code(404);
            $this->view('errors/error', ['code' => 404, 'message' => 'Profil introuvable'], null);
            return;
        }
        // Enregistre la visite (« qui a vu mon profil »), hors auto-visite.
        if ((int) $viewer['id'] !== $targetId) {
            (new \Amoura\Models\ProfileView())->record($targetId, (int) $viewer['id']);
        }

        $this->view('profile/show', [
            'profile' => $profile,
            'photos' => (new Photo())->forUser($targetId),
            'own' => (int) $viewer['id'] === $targetId,
        ]);
    }

    /** Page « qui a vu mon profil ». */
    public function visitors(Request $request): void
    {
        $user = $this->requireAuth($request);
        $uid = (int) $user['id'];
        $isPremium = (new \Amoura\Models\Subscription())->hasFeature($uid, 'see_who_liked');
        $viewers = (new \Amoura\Models\ProfileView())->viewers($uid);
        foreach ($viewers as &$v) {
            $v['age'] = age_from($v['birthdate'] ?? null);
            $v['avatar'] = avatar_url($v['avatar_path'] ?? null);
        }
        $this->view('profile/visitors', [
            'viewers' => $viewers,
            'total' => (new \Amoura\Models\ProfileView())->countFor($uid),
            'is_premium' => $isPremium,
        ]);
    }

    public function edit(Request $request): void
    {
        $user = $this->requireAuth($request);
        $profileModel = new Profile();
        $profileModel->ensureExists((int) $user['id']);
        $this->view('profile/edit', [
            'profile' => (new User())->fullProfile((int) $user['id']),
            'raw' => $profileModel->find((int) $user['id']),
            'photos' => (new Photo())->forUser((int) $user['id']),
            'privacy' => $profileModel->privacy((int) $user['id']),
        ]);
    }

    public function update(Request $request): void
    {
        $user = $this->requireAuth($request);
        $data = $request->all();

        $interests = array_filter(array_map('trim', explode(',', (string) ($data['interests'] ?? ''))));
        $languages = array_filter(array_map('trim', explode(',', (string) ($data['languages'] ?? ''))));

        (new Profile())->upsert((int) $user['id'], [
            'bio' => Sanitizer::text($data['bio'] ?? '', 1000),
            'orientation' => in_array($data['orientation'] ?? '', ['straight','gay','lesbian','bisexual','pansexual','asexual','other'], true) ? $data['orientation'] : null,
            'looking_for' => in_array($data['looking_for'] ?? '', ['male','female','everyone'], true) ? $data['looking_for'] : 'everyone',
            'country' => Sanitizer::text($data['country'] ?? '', 2),
            'city' => Sanitizer::text($data['city'] ?? '', 120),
            'job_title' => Sanitizer::text($data['job_title'] ?? '', 120),
            'education' => Sanitizer::text($data['education'] ?? '', 120),
            'interests' => json_encode(array_slice($interests, 0, 15)),
            'languages' => json_encode(array_slice($languages, 0, 10)),
            'smoking' => in_array($data['smoking'] ?? '', ['no','sometimes','yes'], true) ? $data['smoking'] : null,
            'drinking' => in_array($data['drinking'] ?? '', ['no','sometimes','yes'], true) ? $data['drinking'] : null,
            'children' => in_array($data['children'] ?? '', ['no','someday','have','have_more'], true) ? $data['children'] : null,
            'religion' => Sanitizer::text($data['religion'] ?? '', 40),
            'relationship_goal' => in_array($data['relationship_goal'] ?? '', ['casual','serious','friends','unsure'], true) ? $data['relationship_goal'] : null,
            'latitude' => is_numeric($data['latitude'] ?? null) ? (float) $data['latitude'] : null,
            'longitude' => is_numeric($data['longitude'] ?? null) ? (float) $data['longitude'] : null,
        ]);

        if ($request->wantsJson()) {
            $this->json(['ok' => true]);
        }
        Session::flash('success', 'Profil mis à jour.');
        $this->redirect('/profile');
    }

    public function uploadPhoto(Request $request): void
    {
        $user = $this->requireAuth($request);
        $photoModel = new Photo();
        if ($photoModel->countForUser((int) $user['id']) >= 9) {
            $this->json(['ok' => false, 'error' => 'Maximum 9 photos.'], 422);
        }
        $file = $request->file('photo');
        if (!$file) {
            $this->json(['ok' => false, 'error' => 'Aucun fichier.'], 422);
        }
        $up = Uploader::image($file, 'photos');
        if (!$up['ok']) {
            $this->json(['ok' => false, 'error' => $up['error']], 422);
        }
        $isFirst = $photoModel->countForUser((int) $user['id']) === 0;
        $photoId = $photoModel->create([
            'user_id' => (int) $user['id'],
            'path' => $up['path'],
            'thumb_path' => $up['thumb'],
            'width' => $up['width'],
            'height' => $up['height'],
            'is_primary' => $isFirst ? 1 : 0,
            'moderation' => 'pending',
        ]);
        if ($isFirst) {
            $photoModel->setPrimary((int) $user['id'], $photoId);
        }
        $this->json(['ok' => true, 'id' => $photoId, 'path' => '/uploads/' . $up['path'], 'thumb' => $up['thumb'] ? '/uploads/' . $up['thumb'] : null]);
    }

    public function setPrimaryPhoto(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        (new Photo())->setPrimary((int) $user['id'], (int) $params['id']);
        $this->json(['ok' => true]);
    }

    public function deletePhoto(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $photoModel = new Photo();
        $photo = $photoModel->find((int) $params['id']);
        if ($photo && (int) $photo['user_id'] === (int) $user['id']) {
            @unlink(dirname(__DIR__, 2) . '/public/uploads/' . $photo['path']);
            $photoModel->delete((int) $params['id']);
        }
        $this->json(['ok' => true]);
    }

    public function updatePrivacy(Request $request): void
    {
        $user = $this->requireAuth($request);
        $data = $request->all();
        (new Profile())->updatePrivacy((int) $user['id'], [
            'show_online' => isset($data['show_online']) ? 1 : 0,
            'show_distance' => isset($data['show_distance']) ? 1 : 0,
            'show_age' => isset($data['show_age']) ? 1 : 0,
            'show_last_active' => isset($data['show_last_active']) ? 1 : 0,
            'discoverable' => isset($data['discoverable']) ? 1 : 0,
            'read_receipts' => isset($data['read_receipts']) ? 1 : 0,
            'allow_messages_from' => in_array($data['allow_messages_from'] ?? '', ['matches','verified','everyone'], true) ? $data['allow_messages_from'] : 'matches',
        ]);
        Session::flash('success', 'Confidentialité enregistrée.');
        $this->redirect('/profile/edit');
    }

    public function requestVerification(Request $request): void
    {
        $user = $this->requireAuth($request);
        $file = $request->file('selfie');
        if (!$file) {
            $this->json(['ok' => false, 'error' => 'Selfie requis.'], 422);
        }
        $up = Uploader::image($file, 'verification');
        if (!$up['ok']) {
            $this->json(['ok' => false, 'error' => $up['error']], 422);
        }
        // Crée un « signalement » interne de type vérification pour la file de modération.
        (new ActivityLog())->record((int) $user['id'], 'verification.requested', 'user', (int) $user['id'], ['selfie' => $up['path']]);
        $this->json(['ok' => true, 'message' => 'Demande de vérification envoyée.']);
    }

    public function block(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $targetId = (int) $params['id'];
        Database::connection()->prepare(
            'INSERT IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)'
        )->execute([(int) $user['id'], $targetId]);
        $this->json(['ok' => true]);
    }

    public function report(Request $request): void
    {
        $user = $this->requireAuth($request);
        $data = $request->all();
        $types = ['user','photo','post','comment','message','story'];
        $reasons = ['fake','harassment','nudity','scam','underage','spam','other'];
        if (!in_array($data['target_type'] ?? '', $types, true) || !in_array($data['reason'] ?? '', $reasons, true)) {
            $this->json(['ok' => false, 'error' => 'Signalement invalide.'], 422);
        }
        (new Report())->file(
            (int) $user['id'],
            $data['target_type'],
            (int) ($data['target_id'] ?? 0),
            $data['reason'],
            Sanitizer::text($data['details'] ?? '', 1000)
        );
        $this->json(['ok' => true, 'message' => 'Merci, votre signalement a été transmis.']);
    }

    // ── RGPD ───────────────────────────────────────────────────────────
    public function exportData(Request $request): void
    {
        $user = $this->requireAuth($request);
        $uid = (int) $user['id'];
        // Export RGPD complet (accès & portabilité) — cf. Services\Gdpr\DataExport.
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="amoura-data-' . $uid . '.json"');
        echo \Amoura\Services\Gdpr\DataExport::toJson($uid);
        exit;
    }

    public function deleteAccount(Request $request): void
    {
        $user = $this->requireAuth($request);
        // Effacement RGPD (art. 17) : anonymisation + purge atomique des données
        // personnelles, registres financiers préservés — cf. Services\Gdpr\DataErasure.
        \Amoura\Services\Gdpr\DataErasure::erase((int) $user['id']);
        Auth::logout();
        Session::flush();
        Session::flash('success', 'Votre compte et vos données personnelles ont été supprimés.');
        $this->redirect('/');
    }

    /** Met à jour les consentements optionnels (marketing, analytics). */
    public function updateConsents(Request $request): void
    {
        $user = $this->requireAuth($request);
        $uid = (int) $user['id'];
        $consent = new \Amoura\Models\Consent();
        foreach (['marketing', 'analytics'] as $purpose) {
            $granted = (bool) $request->input($purpose, false);
            // N'enregistre une nouvelle décision que si l'état change (journal propre).
            if ($consent->has($uid, $purpose) !== $granted) {
                $consent->record($uid, $purpose, $granted, null, $request->ip());
            }
        }
        Session::flash('success', 'Vos préférences de confidentialité ont été enregistrées.');
        $this->redirect('/settings/security');
    }
}
