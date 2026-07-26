<?php /** @var array $page */ ?>
<article class="container" style="max-width:760px;padding:48px 0">
  <h1><?= e($page['title']) ?></h1>
  <div class="stack" style="margin-top:24px;line-height:1.7">
    <?= $page['content'] /* contenu déjà assaini via Sanitizer::richText à l'enregistrement */ ?>
  </div>
</article>
