<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

/** Catalogue des consommables (Boost, Super Like, Reveal) — Sprint +5. */
final class Product extends Model
{
    protected string $table = 'products';

    public function active(): array
    {
        return $this->run('SELECT * FROM products WHERE is_active = 1 ORDER BY position ASC')->fetchAll();
    }

    public function bySlug(string $slug): ?array
    {
        return $this->findBy('slug', $slug);
    }
}
