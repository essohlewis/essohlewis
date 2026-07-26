<?php /** @var array $roles */ /** @var array $permissions */ ?>
<h1 style="margin-bottom:20px">Rôles & permissions</h1>
<?php foreach ($roles as $role):
  $rolePerms = json_decode($role['permissions'] ?? '[]', true) ?: [];
  $isSuper = in_array('*', $rolePerms, true); ?>
  <div class="card" style="margin-bottom:16px">
    <div class="row between">
      <h3><?= e($role['name']) ?> <span class="muted">(<?= e($role['slug']) ?>)</span></h3>
      <?php if ($role['is_staff']): ?><span class="badge badge-premium">Staff</span><?php endif; ?>
    </div>
    <?php if ($isSuper): ?>
      <p class="muted" style="margin-top:12px">👑 Toutes les permissions (super-administrateur).</p>
    <?php else: ?>
      <form method="POST" action="/admin/roles/<?= (int) $role['id'] ?>" style="margin-top:12px">
        <?= csrf_field() ?>
        <div class="row wrap">
          <?php foreach ($permissions as $perm): ?>
            <label class="checkbox" style="min-width:220px">
              <input type="checkbox" name="permissions[]" value="<?= e($perm) ?>" <?= in_array($perm, $rolePerms, true) ? 'checked' : '' ?>>
              <?= e($perm) ?>
            </label>
          <?php endforeach; ?>
        </div>
        <button class="btn btn-primary" style="margin-top:12px">Enregistrer</button>
      </form>
    <?php endif; ?>
  </div>
<?php endforeach; ?>
