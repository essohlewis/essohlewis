<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

final class TaleAudio extends Model
{
    protected string $table = 'tale_audio';

    /**
     * Piste audio pour une version + langue. Repli sur 'fr' si la langue
     * demandée n'existe pas.
     * @return array<string,mixed>|null
     */
    public function forVersionLang(int $versionId, string $lang): ?array
    {
        $stmt = $this->db()->prepare(
            'SELECT * FROM tale_audio WHERE version_id = ? AND lang = ? LIMIT 1'
        );
        $stmt->execute([$versionId, $lang]);
        $row = $stmt->fetch();
        if ($row) {
            return $row;
        }
        if ($lang !== 'fr') {
            return $this->forVersionLang($versionId, 'fr');
        }
        return null;
    }

    /** Langues disponibles pour une version. @return string[] */
    public function langsForVersion(int $versionId): array
    {
        $stmt = $this->db()->prepare('SELECT lang FROM tale_audio WHERE version_id = ?');
        $stmt->execute([$versionId]);
        return array_column($stmt->fetchAll(), 'lang');
    }
}
