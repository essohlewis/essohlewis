<?php
declare(strict_types=1);

namespace Amoura\Tests\Integration;

use Amoura\Models\Post;
use Amoura\Services\Moderation\ContentModerator;

/**
 * Vérifie que la modération automatique route correctement les publications
 * (approuvé / en attente de revue) au niveau du stockage.
 */
final class PostModerationTest extends IntegrationTestCase
{
    public function testCleanPostIsApprovedAndAppearsInFeed(): void
    {
        $u = $this->makeUser('author@test.io');
        $verdict = (new ContentModerator())->analyze('Belle journée pour une randonnée !');
        $moderation = $verdict['action'] === 'review' ? 'pending' : 'approved';
        $id = (new Post())->createWithMedia($u, 'Belle journée pour une randonnée !', 'public', [], $moderation);

        $status = $this->db->query("SELECT moderation FROM posts WHERE id = {$id}")->fetchColumn();
        $this->assertSame('approved', $status);

        $feed = (new Post())->feed($u);
        $this->assertContains($id, array_column($feed, 'id'));
    }

    public function testFlaggedPostIsPendingAndHiddenFromFeed(): void
    {
        $u = $this->makeUser('spammer@test.io');
        $body = 'Contacte-moi au 07 07 08 09 10';
        $verdict = (new ContentModerator())->analyze($body);
        $this->assertSame('review', $verdict['action']);

        $id = (new Post())->createWithMedia($u, $body, 'public', [], 'pending');
        $status = $this->db->query("SELECT moderation FROM posts WHERE id = {$id}")->fetchColumn();
        $this->assertSame('pending', $status);

        // Le fil n'affiche que le contenu approuvé.
        $feed = (new Post())->feed($u);
        $this->assertNotContains($id, array_column($feed, 'id'));
    }
}
