<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Core\Security\Sanitizer;
use Amoura\Models\Story;
use Amoura\Services\Uploader;

final class StoryController extends Controller
{
    public function feed(Request $request): void
    {
        $user = $this->requireAuth($request);
        $stories = (new Story())->activeFeed((int) $user['id']);

        // Regroupe par auteur pour l'affichage « anneaux de stories ».
        $groups = [];
        foreach ($stories as $s) {
            $s['avatar'] = avatar_url($s['avatar_path'] ?? null);
            $s['media_url'] = $s['media_path'] ? '/uploads/' . $s['media_path'] : null;
            $s['seen'] = (bool) $s['seen'];
            $groups[$s['user_id']]['user'] = ['id' => $s['user_id'], 'name' => $s['display_name'], 'avatar' => $s['avatar']];
            $groups[$s['user_id']]['stories'][] = $s;
            $groups[$s['user_id']]['all_seen'] = ($groups[$s['user_id']]['all_seen'] ?? true) && $s['seen'];
        }
        $this->json(['ok' => true, 'groups' => array_values($groups)]);
    }

    public function create(Request $request): void
    {
        $user = $this->requireAuth($request);
        $type = (string) $request->input('type', 'image');
        $data = ['type' => $type, 'caption' => Sanitizer::text((string) $request->input('caption'), 500)];

        if ($type === 'text') {
            $data['background'] = Sanitizer::text((string) $request->input('background'), 30);
            if (($data['caption'] ?? '') === '') {
                $this->json(['ok' => false, 'error' => 'Texte requis.'], 422);
            }
        } else {
            $file = $request->file('media');
            if (!$file) {
                $this->json(['ok' => false, 'error' => 'Média requis.'], 422);
            }
            $up = Uploader::image($file, 'stories');
            if (!$up['ok']) {
                $this->json(['ok' => false, 'error' => $up['error']], 422);
            }
            $data['media_path'] = $up['path'];
        }

        $storyId = (new Story())->publish((int) $user['id'], $data);
        $this->json(['ok' => true, 'story_id' => $storyId]);
    }

    public function view(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        (new Story())->markViewed((int) $params['id'], (int) $user['id']);
        $this->json(['ok' => true]);
    }
}
