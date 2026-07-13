<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

final class User extends Model
{
    protected string $table = 'users';

    /** @return array<string,mixed>|null */
    public function findByPhone(string $phone): ?array
    {
        return $this->findBy('phone', $phone);
    }
}
