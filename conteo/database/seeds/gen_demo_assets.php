<?php
/**
 * Génère des illustrations SVG de démonstration pour le conte
 * « Kacou Ananzè et le baobab » (placeholders viewables, style bogolan).
 *
 * Usage : php database/seeds/gen_demo_assets.php
 * Les vraies illustrations (.webp/.avif) et l'audio (.opus) sont fournis par
 * l'équipe artistique et le CDN en production.
 */

declare(strict_types=1);

$base = dirname(__DIR__, 2) . '/public/media/tales/kacou-baobab';
$sfx  = dirname(__DIR__, 2) . '/public/media';

$palette = ['#F2A73B', '#A94E2A', '#2E7D5B', '#2B3A67', '#F5EDE0'];

/** Fabrique un SVG décoratif avec un motif + une légende + un emoji focal. */
function svg(int $w, int $h, string $bg, string $accent, string $emoji, string $caption): string
{
    $c = htmlspecialchars($caption, ENT_QUOTES);
    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="$w" height="$h" viewBox="0 0 $w $h">
  <defs>
    <pattern id="bogolan" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" fill="$bg"/>
      <path d="M0 20 H40 M20 0 V40" stroke="$accent" stroke-width="2" opacity="0.15"/>
      <circle cx="20" cy="20" r="4" fill="$accent" opacity="0.2"/>
    </pattern>
  </defs>
  <rect width="$w" height="$h" fill="url(#bogolan)"/>
  <rect x="16" y="16" width="${w}" height="${h}" fill="none"/>
  <text x="50%" y="42%" font-size="140" text-anchor="middle" dominant-baseline="middle">$emoji</text>
  <rect x="0" y="${h}" width="$w" height="70" fill="$accent" opacity="0.85" transform="translate(0,-70)"/>
  <text x="50%" y="${h}" dy="-26" font-family="sans-serif" font-size="26" font-weight="700"
        fill="#fff" text-anchor="middle">$c</text>
</svg>
SVG;
}

$write = function (string $path, string $content): void {
    @mkdir(dirname($path), 0775, true);
    file_put_contents($path, $content);
    echo "  écrit : $path\n";
};

// ── Couverture ──
$write("$base/cover.svg", svg(600, 800, $palette[4], $palette[1], '🕷️🌳', 'Kacou Ananzè et le baobab'));

// ── Pages par niveau ──
$scenes = [
    ['🌳', 'Un grand baobab'],
    ['🕷️', 'Kacou Ananzè l\'araignée'],
    ['🐦', 'L\'oiseau chante'],
    ['🌾', 'Le travail des champs'],
];

foreach (['n1', 'n2', 'n3'] as $li => $level) {
    foreach ($scenes as $i => $scene) {
        $n = str_pad((string)($i + 1), 2, '0', STR_PAD_LEFT);
        $bg = $palette[$i % count($palette)];
        $write("$base/$level/p$n.svg", svg(1200, 800, $palette[4], $bg === $palette[4] ? $palette[1] : $bg, $scene[0], $scene[1]));
    }
}

// ── Images de quiz ──
$quiz = [
    'oiseau'  => ['🐦', 'oiseau'],
    'lion'    => ['🦁', 'lion'],
    'tortue'  => ['🐢', 'tortue'],
    'serpent' => ['🐍', 'serpent'],
    'kb-s1'   => ['🌳', 'scène 1'],
    'kb-s2'   => ['🕷️', 'scène 2'],
    'kb-s3'   => ['🐦', 'scène 3'],
    'kb-s4'   => ['🌾', 'scène 4'],
];
foreach ($quiz as $key => $q) {
    $write(dirname(__DIR__, 2) . "/public/media/quiz/$key.svg", svg(400, 400, $palette[4], $palette[2], $q[0], $q[1]));
}

echo "Assets de démonstration générés.\n";
