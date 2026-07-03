<?php

declare(strict_types=1);

namespace Transouscris\Core;

/**
 * Réponse HTTP. Fournit des helpers JSON, redirection et rendu de vue.
 */
final class Response
{
    private int $status = 200;
    private array $headers = [];
    private string $body = '';

    public function status(int $code): self
    {
        $this->status = $code;
        return $this;
    }

    public function header(string $name, string $value): self
    {
        $this->headers[$name] = $value;
        return $this;
    }

    public function json(array $data, int $status = 200): self
    {
        $this->status = $status;
        $this->headers['Content-Type'] = 'application/json; charset=utf-8';
        $this->body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return $this;
    }

    public function html(string $html, int $status = 200): self
    {
        $this->status = $status;
        $this->headers['Content-Type'] = 'text/html; charset=utf-8';
        $this->body = $html;
        return $this;
    }

    /** Réponse de téléchargement de fichier (CSV, etc.). */
    public function download(string $content, string $filename, string $contentType = 'application/octet-stream'): self
    {
        $this->status = 200;
        $this->body = $content;
        $this->headers['Content-Type'] = $contentType;
        $this->headers['Content-Disposition'] = 'attachment; filename="' . $filename . '"';
        return $this;
    }

    public function redirect(string $url, int $status = 302): self
    {
        $this->status = $status;
        $this->headers['Location'] = $url;
        return $this;
    }

    public function send(): void
    {
        if (!headers_sent()) {
            http_response_code($this->status);
            // En-têtes de sécurité par défaut.
            $defaults = [
                'X-Content-Type-Options' => 'nosniff',
                'X-Frame-Options'        => 'DENY',
                'Referrer-Policy'        => 'strict-origin-when-cross-origin',
            ];
            // Les en-têtes explicites de la réponse priment sur les valeurs par défaut.
            foreach (array_merge($defaults, $this->headers) as $name => $value) {
                header($name . ': ' . $value, true);
            }
        }
        echo $this->body;
    }
}
