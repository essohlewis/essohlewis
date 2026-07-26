<?php
declare(strict_types=1);

namespace Amoura\Models;

use Amoura\Core\Model;

final class Plan extends Model
{
    protected string $table = 'plans';

    public function active(): array
    {
        return $this->run('SELECT * FROM plans WHERE is_active = 1 ORDER BY position ASC')->fetchAll();
    }

    public function bySlug(string $slug): ?array
    {
        return $this->findBy('slug', $slug);
    }
}
