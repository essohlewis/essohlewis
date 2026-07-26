<?php /** @var array $matches */ ?>
<div class="messenger">
  <div class="conv-list">
    <div style="padding:16px"><h2>Messages</h2></div>
    <?php if (empty($matches)): ?>
      <div style="padding:24px" class="muted text-center">Aucun match pour l'instant.<br><a href="/discover" class="gradient-text">Découvrez des profils →</a></div>
    <?php endif; ?>
    <?php foreach ($matches as $m): ?>
      <a class="conv-item" href="/messages/<?= (int) $m['conversation_id'] ?>">
        <div style="position:relative">
          <img class="avatar avatar-md" src="<?= e($m['avatar']) ?>" alt="">
          <?php if (!empty($m['is_online'])): ?><span class="dot online" style="position:absolute;bottom:0;right:0;border:2px solid var(--bg-elevated)"></span><?php endif; ?>
        </div>
        <div class="info">
          <div class="name"><?= e($m['display_name']) ?>
            <?php if (!empty($m['is_verified'])): ?><span class="badge badge-verified">✓</span><?php endif; ?></div>
          <div class="preview"><?= e($m['last_message'] ?? 'Dites bonjour 👋') ?></div>
        </div>
        <?php if (!empty($m['unread'])): ?><span class="conv-unread"><?= (int) $m['unread'] ?></span><?php endif; ?>
      </a>
    <?php endforeach; ?>
  </div>
  <div class="chat-pane" style="display:grid;place-items:center">
    <div class="text-center muted"><div style="font-size:3rem">💬</div><p>Sélectionnez une conversation</p></div>
  </div>
</div>
