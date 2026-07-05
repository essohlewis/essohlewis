<?php

declare(strict_types=1);

namespace Transouscris\Middleware;

use Transouscris\Core\Request;
use Transouscris\Core\Response;

/**
 * Contrat de middleware : traite la requête puis passe au maillon suivant.
 */
interface Middleware
{
    /**
     * @param callable(Request):Response $next
     */
    public function handle(Request $request, callable $next): Response;
}
