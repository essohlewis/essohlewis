<?php
/* ==========================================================================
   models/Message.php — Messagerie : conversations + messages.
   (Deux tables : on utilise du SQL explicite pour éviter toute ambiguïté.)
   ========================================================================== */

class Message extends Model
{
    protected string $table = 'messages';

    /** Conversations d'un utilisateur (avec messages). */
    public function conversationsDe(int $userId): array
    {
        $convs = $this->requete(
            "SELECT * FROM conversations WHERE user_a = ? OR user_b = ? ORDER BY maj_le DESC",
            [$userId, $userId]
        );
        foreach ($convs as &$c) {
            $c['messages'] = $this->requete("SELECT * FROM messages WHERE conversation_id = ? ORDER BY date ASC", [$c['id']]);
        }
        return $convs;
    }

    public function conversation(int $id): ?array
    {
        $r = $this->requete("SELECT * FROM conversations WHERE id = ?", [$id]);
        if (!$r) return null;
        $c = $r[0];
        $c['messages'] = $this->requete("SELECT * FROM messages WHERE conversation_id = ? ORDER BY date ASC", [$id]);
        return $c;
    }

    /** Ouvre (ou récupère) une conversation entre deux utilisateurs. */
    public function ouvrir(int $a, string $aNom, int $b, string $bNom): array
    {
        [$min, $max] = $a < $b ? [$a, $b] : [$b, $a];
        [$nomMin, $nomMax] = $a < $b ? [$aNom, $bNom] : [$bNom, $aNom];

        $existe = $this->requete("SELECT * FROM conversations WHERE user_a = ? AND user_b = ?", [$min, $max]);
        if ($existe) return $this->conversation((int) $existe[0]['id']);

        $stmt = $this->pdo()->prepare(
            "INSERT INTO conversations (user_a, user_b, nom_a, nom_b, maj_le) VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->execute([$min, $max, $nomMin, $nomMax, date('c')]);
        return $this->conversation((int) $this->pdo()->lastInsertId());
    }

    public function envoyer(int $convId, int $de, string $texte, string $image = ''): array
    {
        $id = (int) $this->inserer([
            'conversation_id' => $convId,
            'de'    => $de,
            'texte' => $texte,
            'image' => $image,
            'lu'    => 0,
            'date'  => date('c'),
        ]);
        $stmt = $this->pdo()->prepare("UPDATE conversations SET maj_le = ? WHERE id = ?");
        $stmt->execute([date('c'), $convId]);
        return $this->trouver($id);
    }

    public function marquerLu(int $convId, int $userId): void
    {
        $stmt = $this->pdo()->prepare("UPDATE messages SET lu = 1 WHERE conversation_id = ? AND de <> ?");
        $stmt->execute([$convId, $userId]);
    }
}
