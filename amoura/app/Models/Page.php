<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/** Pages statiques éditables (CGU, confidentialité, à propos, FAQ). */
final class Page extends Model
{
    protected string $table = 'pages';

    public function bySlug(string $slug): ?array
    {
        $row = $this->run('SELECT * FROM pages WHERE slug = ? AND is_published = 1 LIMIT 1', [$slug])->fetch();
        return $row ?: null;
    }

    public function allForAdmin(): array
    {
        return $this->db->query('SELECT * FROM pages ORDER BY slug')->fetchAll();
    }

    public function save(string $slug, string $title, string $content, bool $published): void
    {
        $this->run(
            'INSERT INTO pages (slug, title, content, is_published) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content), is_published = VALUES(is_published)',
            [$slug, $title, $content, $published ? 1 : 0]
        );
    }
}
