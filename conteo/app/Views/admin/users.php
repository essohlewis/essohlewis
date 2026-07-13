<?php
use App\Helpers\Sanitize;
/** @var array $users */
?>
<h1>Utilisateurs</h1>
<table>
    <thead><tr><th>Téléphone</th><th>Nom</th><th>Enfants</th><th>Abonné</th><th>Statut</th><th>Vérifié</th><th>Inscription</th></tr></thead>
    <tbody>
    <?php foreach ($users as $u): ?>
        <tr>
            <td><?= Sanitize::html($u['phone']) ?></td>
            <td><?= Sanitize::html($u['display_name']) ?></td>
            <td><?= (int)$u['children'] ?></td>
            <td><?= (int)$u['active_subs'] > 0 ? '<span class="tag ok">oui</span>' : '—' ?></td>
            <td><?= Sanitize::html($u['status']) ?></td>
            <td><?= $u['phone_verified'] ? '✓' : '—' ?></td>
            <td><?= Sanitize::html($u['created_at']) ?></td>
        </tr>
    <?php endforeach; ?>
    <?php if (!$users): ?><tr><td colspan="7">Aucun utilisateur.</td></tr><?php endif; ?>
    </tbody>
</table>
