<?php /** @var array $requests */ ?>
<h1 style="margin-bottom:8px">Vérifications de profil</h1>
<p class="muted" style="margin-bottom:20px">Demandes en attente (<?= count($requests) ?>) —
  <span style="font-size:.9rem">triées par score automatique décroissant. Le score est un pré-filtre : validez visuellement.</span></p>

<?php if (empty($requests)): ?>
  <div class="card"><p class="muted" style="margin:0">Aucune demande en attente. 🎉</p></div>
<?php else: ?>
  <div class="grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px">
    <?php foreach ($requests as $v): ?>
      <div class="card stack">
        <img src="/uploads/<?= e($v['selfie_path']) ?>" alt="selfie"
             style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;background:#f0eef5">
        <div>
          <strong><?= e($v['display_name']) ?></strong>
          <div class="muted" style="font-size:.85rem"><?= e($v['email'] ?? '') ?></div>
        </div>
        <div class="row between" style="align-items:center">
          <?php $score = (int) ($v['auto_score'] ?? 0);
                $color = $score >= 55 ? '#0b7a4b' : ($score >= 40 ? '#d97706' : '#b91c1c'); ?>
          <span class="badge" style="background:<?= $color ?>1a;color:<?= $color ?>">Score auto : <?= $score ?></span>
          <span class="muted" style="font-size:.8rem"><?= e(date('d/m H:i', strtotime((string) $v['created_at']))) ?></span>
        </div>
        <div class="row" style="gap:8px">
          <form method="POST" action="/admin/verification/<?= (int) $v['id'] ?>/approve" style="flex:1">
            <?= csrf_field() ?>
            <button class="btn btn-primary btn-block">✅ Approuver</button>
          </form>
          <form method="POST" action="/admin/verification/<?= (int) $v['id'] ?>/reject" style="flex:1"
                data-confirm="Rejeter cette demande ?">
            <?= csrf_field() ?>
            <button class="btn btn-ghost btn-block">Rejeter</button>
          </form>
        </div>
      </div>
    <?php endforeach; ?>
  </div>
<?php endif; ?>
