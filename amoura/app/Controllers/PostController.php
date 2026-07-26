<?php
declare(strict_types=1);

namespace Amoura\Controllers;

use Amoura\Core\Controller;
use Amoura\Core\Request;
use Amoura\Core\Security\Sanitizer;
use Amoura\Models\Comment;
use Amoura\Models\Notification;
use Amoura\Models\Post;
use Amoura\Services\Uploader;

final class PostController extends Controller
{
    public function index(Request $request): void
    {
        $this->requireAuth($request);
        $this->view('social/feed', []);
    }

    public function feed(Request $request): void
    {
        $user = $this->requireAuth($request);
        $before = (int) $request->query('before', 0);
        $posts = (new Post())->feed((int) $user['id'], $before);
        foreach ($posts as &$p) {
            $p['avatar'] = avatar_url($p['avatar_path'] ?? null);
            $p['liked'] = (bool) $p['liked'];
            $p['ago'] = time_ago($p['created_at']);
            foreach ($p['media'] as &$m) {
                $m['url'] = '/uploads/' . $m['path'];
                $m['thumb_url'] = $m['thumb_path'] ? '/uploads/' . $m['thumb_path'] : $m['url'];
            }
        }
        $this->json(['ok' => true, 'posts' => $posts]);
    }

    public function create(Request $request): void
    {
        $user = $this->requireAuth($request);
        $body = Sanitizer::richText((string) $request->input('body'), 3000);
        $visibility = in_array($request->input('visibility'), ['public', 'matches', 'private'], true)
            ? (string) $request->input('visibility') : 'public';

        // Médias : jusqu'à 4 images.
        $mediaPaths = [];
        if (!empty($_FILES['media'])) {
            $files = $this->normalizeFiles($_FILES['media']);
            foreach (array_slice($files, 0, 4) as $file) {
                $up = Uploader::image($file, 'posts');
                if ($up['ok']) {
                    $mediaPaths[] = $up['path'];
                }
            }
        }

        if ($body === '' && empty($mediaPaths)) {
            $this->json(['ok' => false, 'error' => 'Publication vide.'], 422);
        }

        // Modération automatique (v1) : bloque le contenu à haut risque,
        // met en file de revue le contenu douteux, publie le reste.
        $verdict = (new \Amoura\Services\Moderation\ContentModerator())->analyze($body);
        if ($verdict['action'] === 'block') {
            (new \Amoura\Models\ActivityLog())->record((int) $user['id'], 'post.blocked', 'user', (int) $user['id'], ['flags' => $verdict['flags'], 'score' => $verdict['score']], $request->ip());
            $this->json(['ok' => false, 'error' => 'Votre publication enfreint nos règles (contenu bloqué).'], 422);
        }
        $moderation = $verdict['action'] === 'review' ? 'pending' : 'approved';

        $postId = (new Post())->createWithMedia((int) $user['id'], $body, $visibility, $mediaPaths, $moderation);

        // Contenu douteux : trace pour la file de modération.
        if ($moderation === 'pending') {
            (new \Amoura\Models\Report())->file((int) $user['id'], 'post', $postId, 'spam',
                'Auto-modération: ' . implode(', ', $verdict['flags']) . ' (score ' . $verdict['score'] . ')');
        }

        $this->json(['ok' => true, 'post_id' => $postId, 'pending' => $moderation === 'pending']);
    }

    public function like(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $postId = (int) $params['id'];
        $result = (new Post())->toggleLike($postId, (int) $user['id']);

        if ($result['liked']) {
            $post = (new Post())->find($postId);
            if ($post && (int) $post['user_id'] !== (int) $user['id']) {
                (new Notification())->push((int) $post['user_id'], 'post_like', (int) $user['id'], [], 'post', $postId);
            }
        }
        $this->json(['ok' => true] + $result);
    }

    public function comments(Request $request, array $params): void
    {
        $this->requireAuth($request);
        $comments = (new Comment())->forPost((int) $params['id']);
        foreach ($comments as &$c) {
            $c['avatar'] = avatar_url($c['avatar_path'] ?? null);
            $c['ago'] = time_ago($c['created_at']);
        }
        $this->json(['ok' => true, 'comments' => $comments]);
    }

    public function comment(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $postId = (int) $params['id'];
        $body = Sanitizer::text((string) $request->input('body'), 1500);
        if ($body === '') {
            $this->json(['ok' => false, 'error' => 'Commentaire vide.'], 422);
        }
        $commentId = (new Comment())->add($postId, (int) $user['id'], $body);
        $post = (new Post())->find($postId);
        if ($post && (int) $post['user_id'] !== (int) $user['id']) {
            (new Notification())->push((int) $post['user_id'], 'comment', (int) $user['id'], [], 'post', $postId);
        }
        $this->json(['ok' => true, 'comment_id' => $commentId]);
    }

    public function delete(Request $request, array $params): void
    {
        $user = $this->requireAuth($request);
        $post = (new Post())->find((int) $params['id']);
        if ($post && (int) $post['user_id'] === (int) $user['id']) {
            (new Post())->update((int) $params['id'], ['deleted_at' => date('Y-m-d H:i:s')]);
        }
        $this->json(['ok' => true]);
    }

    /** Normalise la structure $_FILES pour un champ multiple (media[]). */
    private function normalizeFiles(array $files): array
    {
        if (!is_array($files['name'])) {
            return [$files];
        }
        $out = [];
        foreach ($files['name'] as $i => $name) {
            $out[] = [
                'name' => $name,
                'type' => $files['type'][$i],
                'tmp_name' => $files['tmp_name'][$i],
                'error' => $files['error'][$i],
                'size' => $files['size'][$i],
            ];
        }
        return $out;
    }
}
