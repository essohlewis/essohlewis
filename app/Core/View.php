<?php

declare(strict_types=1);

namespace Transouscris\Core;

use RuntimeException;

/**
 * Moteur de rendu basé sur des templates PHP natifs, avec échappement par
 * défaut via le helper e(). Les vues vivent dans app/Views.
 */
final class View
{
    private static string $viewPath = '';

    public static function configure(string $viewPath): void
    {
        self::$viewPath = rtrim($viewPath, '/');
    }

    /**
     * Rend une vue en l'enveloppant optionnellement dans un layout.
     */
    public static function render(string $template, array $data = [], ?string $layout = 'layouts/app'): string
    {
        $content = self::renderPartial($template, $data);

        if ($layout !== null) {
            return self::renderPartial($layout, array_merge($data, ['content' => $content]));
        }

        return $content;
    }

    public static function renderPartial(string $template, array $data = []): string
    {
        $file = self::$viewPath . '/' . str_replace('.', '/', $template) . '.php';
        if (!is_file($file)) {
            throw new RuntimeException("Vue introuvable : $template");
        }

        extract($data, EXTR_SKIP);
        ob_start();
        require $file;
        return (string) ob_get_clean();
    }

    /** Échappement HTML pour usage dans les templates : <?= e($x) ?> */
    public static function e(mixed $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
