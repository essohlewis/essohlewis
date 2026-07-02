<?php

namespace App\Providers;

use App\Services\MobileMoney\MobileMoneyProvider;
use App\Services\MobileMoney\SandboxProvider;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(MobileMoneyProvider::class, function () {
            $driver = config('momo.driver', 'sandbox');

            return match ($driver) {
                // Real Orange/MTN drivers plug in here as they are implemented.
                default => new SandboxProvider(config('momo.webhook_secret')),
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
