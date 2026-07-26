<?php
declare(strict_types=1);

namespace Amoura\Core;

/**
 * Moteur de vues PHP natif avec layouts et échappement automatique.
 * Les vues vivent dans app/Views ; e() échappe toute sortie utilisateur (anti-XSS).
 */
final class View
{
    private static string $basePath = __DIR__ . '/../Views/';

    /**
     * Rend une vue dans un layout.
     * @param string      $view    ex: "auth/login"
     * @param array       $data    variables exposées à la vue
     * @param string|null $layout  ex: "layouts/app" ; null = pas de layout
     */
    public static function render(string $view, array $data = [], ?string $layout = 'layouts/app'): void
    {
        echo self::capture($view, $data, $layout);
    }

    public static function capture(string $view, array $data = [], ?string $layout = 'layouts/app'): string
    {
        $content = self::renderPartial($view, $data);

        if ($layout === null) {
            return $content;
        }
        // Le layout reçoit $content (le corps déjà rendu) + les mêmes données.
        return self::renderPartial($layout, array_merge($data, ['content' => $content]));
    }

    public static function renderPartial(string $view, array $data = []): string
    {
        $file = self::$basePath . str_replace('.', '/', $view) . '.php';
        if (!is_file($file)) {
            throw new \RuntimeException("Vue introuvable : {$view}");
        }
        extract($data, EXTR_SKIP);
        ob_start();
        include $file;
        return (string) ob_get_clean();
    }
}
