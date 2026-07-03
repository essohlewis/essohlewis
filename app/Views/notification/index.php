<?php /** @var \Transouscris\Models\Notification[] $notifications */ ?>
<div class="space-y-4">
    <h1 class="text-xl font-bold">Notifications</h1>

    <div class="bg-white rounded-xl shadow-sm divide-y">
        <?php if (!$notifications): ?>
            <p class="p-4 text-sm text-slate-500">Aucune notification.</p>
        <?php else: foreach ($notifications as $n): ?>
            <?php $inner = '<div class="flex gap-3 p-4 ' . ($n->isRead ? '' : 'bg-teal-50/50') . '">'
                . '<span class="text-xl">' . $n->icon() . '</span>'
                . '<div class="flex-1">'
                . '<div class="font-medium">' . e($n->title) . '</div>'
                . ($n->body ? '<div class="text-sm text-slate-500">' . e($n->body) . '</div>' : '')
                . '<div class="text-xs text-slate-400 mt-1">' . e($n->createdAt) . '</div>'
                . '</div></div>'; ?>
            <?php if ($n->link): ?>
                <a href="<?= e($n->link) ?>" class="block hover:bg-slate-50"><?= $inner ?></a>
            <?php else: ?>
                <?= $inner ?>
            <?php endif; ?>
        <?php endforeach; endif; ?>
    </div>
</div>
