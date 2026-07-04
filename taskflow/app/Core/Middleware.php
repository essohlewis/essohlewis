<?php
namespace App\Core;

abstract class Middleware {
    // Process parameter variables and trigger subsequent chain callback
    abstract public function handle($params, $next);
}
