<?php
/** @var int $status */
/** @var string $message */
/** @var array $errors */
?>
<div class="max-w-md mx-auto bg-white rounded-2xl shadow p-8 text-center mt-10">
    <div class="text-5xl font-black text-teal-700"><?= (int) $status ?></div>
    <p class="mt-3 text-slate-600"><?= e($message) ?></p>
    <?php if (!empty($errors)): ?>
        <ul class="mt-3 text-sm text-rose-600 text-left inline-block">
            <?php foreach ($errors as $field => $msgs): foreach ((array) $msgs as $m): ?>
                <li>• <?= e($m) ?></li>
            <?php endforeach; endforeach; ?>
        </ul>
    <?php endif; ?>
    <a href="/" class="inline-block mt-6 text-teal-700 underline">Retour à l'accueil</a>
</div>
