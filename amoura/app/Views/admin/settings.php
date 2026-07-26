<?php /** @var array $grouped */
$groupLabels = ['general'=>'Général','theme'=>'Thème & apparence','compliance'=>'Conformité','auth'=>'Authentification','payments'=>'Paiements','mail'=>'Email','content'=>'Contenu'];
?>
<h1 style="margin-bottom:20px">Paramètres du site</h1>
<form method="POST" action="/admin/settings">
  <?= csrf_field() ?>
  <?php foreach ($grouped as $group => $rows): ?>
    <div class="card" style="margin-bottom:20px">
      <h3 style="margin-bottom:16px"><?= e($groupLabels[$group] ?? $group) ?></h3>
      <?php foreach ($rows as $s): ?>
        <div class="field">
          <label><?= e($s['key']) ?></label>
          <?php if ($s['type'] === 'bool'): ?>
            <select class="select" name="<?= e($s['key']) ?>">
              <option value="1" <?= $s['value']=='1'?'selected':'' ?>>Activé</option>
              <option value="0" <?= $s['value']=='0'?'selected':'' ?>>Désactivé</option>
            </select>
          <?php elseif ($s['type'] === 'secret'): ?>
            <input class="input" type="password" name="<?= e($s['key']) ?>" value="<?= e($s['value']) ?>" placeholder="••••••••" autocomplete="off">
            <div class="hint">Clé sensible — stockée côté serveur uniquement.</div>
          <?php else: ?>
            <input class="input" name="<?= e($s['key']) ?>" value="<?= e($s['value']) ?>">
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>
  <?php endforeach; ?>
  <button class="btn btn-primary btn-lg">Enregistrer tous les paramètres</button>
</form>
