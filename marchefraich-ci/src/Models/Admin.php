<?php

declare(strict_types=1);

namespace App\Models;

class Admin extends Model
{
    public function parEmail(string $email): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM admins WHERE email = ?');
        $stmt->execute([$email]);
        return $stmt->fetch() ?: null;
    }
}
