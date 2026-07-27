<?php
/** @var array $matches */ /** @var int $conversationId */ /** @var array|null $other */ /** @var array $messages */
$scripts = ['chat.js'];
$meId = $auth['id'] ?? 0;
$fmtTime = fn($dt) => date('H:i', strtotime($dt));
?>
<div class="messenger thread-open">
  <div class="conv-list">
    <div style="padding:16px"><a href="/messages" class="nav-link">← Conversations</a></div>
    <?php foreach ($matches as $m): ?>
      <a class="conv-item <?= (int) $m['conversation_id'] === $conversationId ? 'active' : '' ?>" href="/messages/<?= (int) $m['conversation_id'] ?>">
        <img class="avatar avatar-md" src="<?= e($m['avatar']) ?>" alt="">
        <div class="info"><div class="name"><?= e($m['display_name']) ?></div>
          <div class="preview"><?= e($m['last_message'] ?? '…') ?></div></div>
        <?php if (!empty($m['unread'])): ?><span class="conv-unread"><?= (int) $m['unread'] ?></span><?php endif; ?>
      </a>
    <?php endforeach; ?>
  </div>

  <div class="chat-pane" id="chatPane"
       data-conversation-id="<?= $conversationId ?>"
       data-other-id="<?= (int) ($other['id'] ?? 0) ?>"
       data-me-id="<?= (int) $meId ?>">
    <div class="chat-head">
      <a href="/messages" class="btn btn-icon btn-ghost" style="display:none" id="backBtn">←</a>
      <img class="avatar avatar-sm" src="<?= e(avatar_url($other['avatar_path'] ?? null)) ?>" alt="">
      <div>
        <div style="font-weight:700"><a href="/u/<?= (int) ($other['id'] ?? 0) ?>"><?= e($other['display_name'] ?? 'Conversation') ?></a></div>
        <div class="subtle" style="font-size:.8rem"><?= !empty($other['is_online']) ? 'En ligne' : 'Hors ligne' ?></div>
      </div>
      <div class="actions">
        <button class="btn btn-icon btn-ghost" data-call-start="audio" data-peer="<?= (int) ($other['id'] ?? 0) ?>" title="Appel audio">📞</button>
        <button class="btn btn-icon btn-ghost" data-call-start="video" data-peer="<?= (int) ($other['id'] ?? 0) ?>" title="Appel vidéo">📹</button>
      </div>
    </div>

    <div class="chat-scroll" id="chatScroll">
      <?php foreach ($messages as $msg): $mine = (int) $msg['sender_id'] === (int) $meId; ?>
        <div class="bubble <?= $mine ? 'me' : 'them' ?>" data-id="<?= (int) $msg['id'] ?>">
          <?php if ($msg['type'] === 'image'): ?>
            <img src="<?= e('/uploads/' . $msg['media_path']) ?>" data-lightbox data-full="<?= e('/uploads/' . $msg['media_path']) ?>" style="max-width:220px" alt="">
          <?php elseif ($msg['type'] === 'voice'): ?>
            🎤 Message vocal
          <?php else: ?>
            <?= nl2br(e($msg['body'])) ?>
          <?php endif; ?>
          <span class="time"><?= $fmtTime($msg['created_at']) ?><?= $mine ? '<span class="ticks' . ($msg['read_at'] ? ' read' : '') . '">✓✓</span>' : '' ?></span>
        </div>
      <?php endforeach; ?>
      <div class="typing-indicator" id="typingIndicator"><span></span><span></span><span></span></div>
    </div>

    <!-- Brise-glaces IA : suggestions d'accroche quand la conversation est vide. -->
    <div id="icebreakers" class="icebreakers"
         data-empty="<?= empty($messages) ? '1' : '0' ?>"
         data-other-id="<?= (int) ($other['id'] ?? 0) ?>"
         style="display:none;gap:8px;padding:8px 12px;flex-wrap:wrap"></div>

    <form class="chat-input" id="chatForm">
      <label class="btn btn-icon btn-ghost" title="Image">🖼️<input type="file" id="chatImage" accept="image/*" hidden></label>
      <button type="button" class="btn btn-icon btn-ghost" id="recordBtn" title="Message vocal">🎤</button>
      <input class="input grow" id="chatInput" placeholder="Votre message…" autocomplete="off" maxlength="4000">
      <button class="btn btn-primary btn-icon" title="Envoyer">➤</button>
    </form>
  </div>
</div>

<script <?= \Amoura\Core\Security\Nonce::attr() ?>>
  (function () {
    const box = document.getElementById('icebreakers');
    const input = document.getElementById('chatInput');
    if (!box || !input || box.dataset.empty !== '1') return;
    const otherId = parseInt(box.dataset.otherId, 10);
    if (!otherId) return;

    fetch('/api/icebreakers/' + otherId, { headers: { 'Accept': 'application/json' } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !data.ok || !data.suggestions || !data.suggestions.length) return;
        box.style.display = 'flex';
        const hint = document.createElement('span');
        hint.className = 'subtle';
        hint.style.cssText = 'width:100%;font-size:.75rem';
        hint.textContent = '💡 Suggestions pour briser la glace :';
        box.appendChild(hint);
        data.suggestions.forEach(text => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'btn btn-ghost btn-sm';
          chip.style.cssText = 'text-align:left;white-space:normal';
          chip.textContent = text;
          chip.addEventListener('click', () => {
            input.value = text;
            input.focus();
            box.style.display = 'none';
          });
          box.appendChild(chip);
        });
      })
      .catch(() => {});
  })();
</script>
