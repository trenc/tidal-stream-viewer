<?php

declare(strict_types=1);

// Proxy for api-maree.fr: the API key stays on the server, requests are validated,
// day-aligned and cached so many users share one account quota.
// URL: /api/tides.php/{sites|tide-extrema|water-levels}?...

// Warnings must never end up in the JSON answer (or leak server paths): log them instead.
ini_set('display_errors', '0');
ini_set('log_errors', '1');

const UPSTREAM = 'https://api-maree.fr';
const HOURLY_BUDGET = 300;
const IP_HOURLY_BUDGET = 30;
const MAX_LEVELS = 1500;
const STEPS = [1, 5, 10, 15, 20, 30, 60];
const TTL = ['sites' => 604800, 'tide-extrema' => 86400, 'water-levels' => 86400];

// How long files stay in the cache folder before the hourly cleanup removes them.
const ANSWER_KEEP_SECONDS = 8 * 86400;  // longest validity (7 days) plus a day
const COUNTER_KEEP_SECONDS = 2 * 3600;  // a usage counter only matters during its own hour
const LEFTOVER_KEEP_SECONDS = 3600;     // temporary files of interrupted writes
const CLEANUP_INTERVAL_SECONDS = 3600;

main();

function main(): void
{
    guardRequest();

    $endpoint = ltrim($_SERVER['PATH_INFO'] ?? '', '/');
    if (!isset(TTL[$endpoint])) {
        fail(404, 'Unknown endpoint');
    }

    $params = validated($endpoint, $_GET);

    if ($endpoint !== 'sites') {
        requireKnownSite($params['site']);
    }

    [$status, $body, $cache] = fetchThroughCache($endpoint, $params);
    respond($status, $body, $cache);
}

// Access rules

// Read-only API, only for this site's own pages.
// Browsers state where a request comes from in Sec-Fetch-Site, and page scripts cannot change it.
// A missing header (curl, very old browsers) is allowed; the quotas below still apply to it.
function guardRequest(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        header('Allow: GET');
        fail(405, 'Method not allowed');
    }

    $origin = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    if ($origin !== '' && !in_array($origin, ['same-origin', 'none'], true)) {
        fail(403, 'Cross-site requests are not allowed');
    }
}

// Only real api-maree.fr sites reach the upstream API, so invented ids cannot use up the quota.
function requireKnownSite(string $site): void
{
    [$status, $body] = fetchThroughCache('sites', []);

    $data = $status === 200 ? json_decode($body, true) : null;
    if (!is_array($data)) {
        fail(502, 'Tide service unavailable');
    }

    $known = array_map('strval', array_column($data['sites'] ?? [], 'site_id'));
    if (!in_array($site, $known, true)) {
        fail(404, 'Unknown site');
    }
}

// Request validation

function validated(string $endpoint, array $q): array
{
    if ($endpoint === 'sites') {
        return [];
    }

    $site = $q['site'] ?? '';
    if (!is_string($site) || !preg_match('/^[A-Za-z0-9_-]{1,64}$/', $site)) {
        fail(400, 'Invalid site');
    }

    if ($endpoint === 'tide-extrema') {
        $tz = $q['tz'] ?? 'UTC';
        if (!in_array($tz, ['UTC', 'Europe/Paris'], true)) {
            fail(400, 'Invalid tz');
        }

        return [
            'site' => $site,
            'from' => parseDate($q['from'] ?? '', 'Y-m-d')->format('Y-m-d'),
            'to' => parseDate($q['to'] ?? '', 'Y-m-d')->format('Y-m-d'),
            'tz' => $tz,
        ];
    }

    return validatedLevels($site, $q);
}

function validatedLevels(string $site, array $q): array
{
    $step = (int) ($q['step'] ?? 0);
    if (!in_array($step, STEPS, true)) {
        fail(400, 'Invalid step');
    }
    if (($q['tz'] ?? 'UTC') !== 'UTC') {
        fail(400, 'Only tz=UTC is supported');
    }

    $from = parseDate($q['from'] ?? '', 'Y-m-d\TH:i');
    $to = parseDate($q['to'] ?? '', 'Y-m-d\TH:i');

    // Whole UTC days, so different users ask for (and share) the same cached window.
    $from = $from->setTime(0, 0);
    $toDay = $to->setTime(0, 0);
    $to = $toDay < $to ? $toDay->modify('+1 day') : $toDay;

    if ($to <= $from) {
        fail(400, 'to must be after from');
    }

    $count = intdiv($to->getTimestamp() - $from->getTimestamp(), 60 * $step);
    if ($count > MAX_LEVELS) {
        fail(400, 'Too many heights requested (max ' . MAX_LEVELS . ')');
    }

    return [
        'site' => $site,
        'from' => $from->format('Y-m-d\TH:i'),
        'to' => $to->format('Y-m-d\TH:i'),
        'step' => $step,
        'tz' => 'UTC',
    ];
}

function parseDate(mixed $value, string $format): DateTimeImmutable
{
    $date = is_string($value)
        ? DateTimeImmutable::createFromFormat('!' . $format, $value, new DateTimeZone('UTC'))
        : false;

    if ($date === false || $date->format($format) !== $value) {
        fail(400, 'Invalid date');
    }

    // The API accepts about J-30 to J+30; the exact limit is enforced upstream.
    $today = new DateTimeImmutable('today', new DateTimeZone('UTC'));
    if ($date < $today->modify('-32 days') || $date > $today->modify('+32 days')) {
        fail(400, 'Date outside the supported window (about 30 days either side of today)');
    }

    return $date;
}

// Cache and quota

/** @return array{0:int,1:string,2:string} status, body, cache state */
function fetchThroughCache(string $endpoint, array $params): array
{
    collectGarbage();

    $file = cachePath($endpoint, $params);

    $cached = readCache($file, TTL[$endpoint]);
    if ($cached !== null) {
        return [200, $cached, 'HIT'];
    }

    if (!takeBudget(clientKey(), IP_HOURLY_BUDGET)) {
        fail(429, 'Too many tide requests from your address. Try again later.');
    }
    if (!takeBudget('global', HOURLY_BUDGET)) {
        fail(429, 'The tide quota for this hour is used up. Try again later.');
    }

    [$status, $body] = fetchUpstream($endpoint, $params, apiKey());
    if ($status === 200) {
        writeCache($file, $body);
    }

    $out = $status === 200 ? 200 : ($status >= 400 && $status < 500 ? $status : 502);
    return [$out, $body, 'MISS'];
}

function cacheDir(): string
{
    $dir = getenv('TIDE_CACHE_DIR') ?: sys_get_temp_dir() . '/tide-cache';
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }

    return $dir;
}

function cachePath(string $endpoint, array $params): string
{
    ksort($params);
    return cacheDir() . '/' . sha1($endpoint . '?' . http_build_query($params)) . '.json';
}

function readCache(string $file, int $ttl): ?string
{
    if (!is_file($file) || time() - filemtime($file) >= $ttl) {
        return null;
    }

    $body = file_get_contents($file);
    return $body === false ? null : $body;
}

function writeCache(string $file, string $body): void
{
    $tmp = $file . '.' . getmypid() . '.tmp';
    file_put_contents($tmp, $body);
    rename($tmp, $file);
}

// Removes old files from the cache folder, at most once an hour.
// The marker file (a dotfile, so the cleanup never lists it) remembers when it last ran.
function collectGarbage(): void
{
    $dir = cacheDir();
    $marker = $dir . '/.last-cleanup';

    if (is_file($marker) && time() - filemtime($marker) < CLEANUP_INTERVAL_SECONDS) {
        return;
    }

    touch($marker);

    foreach (glob($dir . '/*') ?: [] as $file) {
        if (is_file($file) && time() - filemtime($file) > keepSeconds($file)) {
            @unlink($file);
        }
    }
}

function keepSeconds(string $file): int
{
    $name = basename($file);

    if (str_ends_with($name, '.tmp')) {
        return LEFTOVER_KEEP_SECONDS;
    }

    return str_starts_with($name, 'budget-') ? COUNTER_KEEP_SECONDS : ANSWER_KEEP_SECONDS;
}

// Who is counted in the usage limits: a scrambled form of the address, never the address itself.
// IPv6 users get a whole /64 network, so the network is counted, not the single address.
function clientKey(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    if (str_contains($ip, ':')) {
        $packed = @inet_pton($ip);
        if ($packed !== false) {
            $ip = bin2hex(substr($packed, 0, 8));
        }
    }

    return 'ip-' . substr(hash_hmac('sha256', $ip, apiKey()), 0, 24);
}

// Counts upstream calls per name and UTC hour, so no address and not the account exceeds its quota.
function takeBudget(string $name, int $limit): bool
{
    $handle = fopen(cacheDir() . '/budget-' . $name . '-' . gmdate('YmdH'), 'c+');
    if ($handle === false) {
        return false;
    }

    flock($handle, LOCK_EX);
    $used = (int) stream_get_contents($handle);
    $allowed = $used < $limit;

    if ($allowed) {
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, (string) ($used + 1));
    }

    flock($handle, LOCK_UN);
    fclose($handle);

    return $allowed;
}

// Upstream

function apiKey(): string
{
    $key = getenv('MAREE_API_KEY') ?: '';
    $file = getenv('MAREE_API_KEY_FILE');

    if ($key === '' && $file) {
        $key = trim((string) @file_get_contents($file));
    }
    if ($key === '') {
        fail(500, 'Tide service is not configured');
    }

    return $key;
}

/** @return array{0:int,1:string} */
function fetchUpstream(string $endpoint, array $params, string $key): array
{
    $url = UPSTREAM . '/' . $endpoint . '?' . http_build_query($params + ['key' => $key]);

    // The handle is released when it goes out of scope; curl_close() is deprecated since PHP 8.5.
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    ]);

    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);

    if (!is_string($body)) {
        return [0, json_encode(['error' => 'Tide service unreachable'])];
    }

    return [$status, str_replace($key, '***', $body)];
}

// Output

function respond(int $status, string $body, string $cache): never
{
    http_response_code($status);
    header('Content-Type: application/json');
    header('X-Content-Type-Options: nosniff');
    header('X-Cache: ' . $cache);
    header($status === 200 ? 'Cache-Control: public, max-age=3600' : 'Cache-Control: no-store');
    echo $body;
    exit;
}

function fail(int $status, string $message): never
{
    respond($status, json_encode(['error' => $message]), 'NONE');
}
