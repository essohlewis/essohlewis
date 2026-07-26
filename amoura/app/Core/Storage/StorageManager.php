<?php
declare(strict_types=1);

namespace Amoura\Core\Storage;

use Amoura\Core\Env;

/** Fabrique le stockage selon STORAGE_DRIVER (local | s3). */
final class StorageManager
{
    private static ?Storage $disk = null;

    public static function disk(): Storage
    {
        if (self::$disk instanceof Storage) {
            return self::$disk;
        }
        if (strtolower((string) Env::get('STORAGE_DRIVER', 'local')) === 's3'
            && (string) Env::get('S3_BUCKET', '') !== '') {
            return self::$disk = new S3Storage(
                (string) Env::get('S3_KEY', ''),
                (string) Env::get('S3_SECRET', ''),
                (string) Env::get('S3_BUCKET', ''),
                (string) Env::get('S3_REGION', 'us-east-1'),
                (string) Env::get('S3_ENDPOINT', 'https://s3.amazonaws.com'),
                (string) Env::get('CDN_URL', '')
            );
        }
        return self::$disk = new LocalStorage();
    }

    public static function setDisk(?Storage $disk): void
    {
        self::$disk = $disk;
    }
}
