<?php
declare(strict_types=1);

namespace Amoura\Core\Storage;

/**
 * Stockage objet compatible S3 (AWS S3, MinIO, Scaleway, Wasabi…) — Sprint +6.
 * Signature AWS Signature V4, sans SDK (cURL). Sert de base au déport CDN :
 * `url()` renvoie directement l'URL CDN si CDN_URL est configuré.
 *
 * Configuration (.env) : S3_KEY, S3_SECRET, S3_BUCKET, S3_REGION, S3_ENDPOINT, CDN_URL.
 */
final class S3Storage implements Storage
{
    public function __construct(
        private string $key,
        private string $secret,
        private string $bucket,
        private string $region = 'us-east-1',
        private string $endpoint = 'https://s3.amazonaws.com',
        private string $cdnUrl = ''
    ) {}

    public function put(string $relativePath, string $contents): string
    {
        $this->request('PUT', ltrim($relativePath, '/'), $contents);
        return ltrim($relativePath, '/');
    }

    public function putFile(string $relativePath, string $sourcePath): string
    {
        return $this->put($relativePath, (string) file_get_contents($sourcePath));
    }

    public function url(string $relativePath): string
    {
        $path = ltrim($relativePath, '/');
        if ($this->cdnUrl !== '') {
            return rtrim($this->cdnUrl, '/') . '/' . $path;
        }
        return rtrim($this->endpoint, '/') . '/' . $this->bucket . '/' . $path;
    }

    public function delete(string $relativePath): bool
    {
        $status = $this->request('DELETE', ltrim($relativePath, '/'), '');
        return $status >= 200 && $status < 300;
    }

    public function exists(string $relativePath): bool
    {
        return $this->request('HEAD', ltrim($relativePath, '/'), '') === 200;
    }

    /** Requête S3 signée SigV4 (implémentation compacte). */
    private function request(string $method, string $key, string $body): int
    {
        $host = parse_url($this->endpoint, PHP_URL_HOST) ?: 's3.amazonaws.com';
        $uri = '/' . $this->bucket . '/' . $key;
        $now = gmdate('Ymd\THis\Z');
        $date = gmdate('Ymd');
        $payloadHash = hash('sha256', $body);

        $canonicalHeaders = "host:{$host}\nx-amz-content-sha256:{$payloadHash}\nx-amz-date:{$now}\n";
        $signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
        $canonicalRequest = "{$method}\n{$uri}\n\n{$canonicalHeaders}\n{$signedHeaders}\n{$payloadHash}";

        $scope = "{$date}/{$this->region}/s3/aws4_request";
        $stringToSign = "AWS4-HMAC-SHA256\n{$now}\n{$scope}\n" . hash('sha256', $canonicalRequest);

        $kDate = hash_hmac('sha256', $date, 'AWS4' . $this->secret, true);
        $kRegion = hash_hmac('sha256', $this->region, $kDate, true);
        $kService = hash_hmac('sha256', 's3', $kRegion, true);
        $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
        $signature = hash_hmac('sha256', $stringToSign, $kSigning);

        $authorization = "AWS4-HMAC-SHA256 Credential={$this->key}/{$scope}, "
            . "SignedHeaders={$signedHeaders}, Signature={$signature}";

        $ch = curl_init(rtrim($this->endpoint, '/') . $uri);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_NOBODY => $method === 'HEAD',
            CURLOPT_POSTFIELDS => in_array($method, ['PUT', 'POST'], true) ? $body : null,
            CURLOPT_HTTPHEADER => [
                "Host: {$host}",
                "x-amz-content-sha256: {$payloadHash}",
                "x-amz-date: {$now}",
                "Authorization: {$authorization}",
            ],
            CURLOPT_TIMEOUT => 20,
        ]);
        curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $status;
    }
}
