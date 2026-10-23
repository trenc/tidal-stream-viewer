<?php

declare(strict_types=1);

require __DIR__ . '/env.php';

// First-party proxy for Plausible Analytics: the script and the events come from this site.
//   GET  /api/m.php/s   the tracking script (copied from Plausible, kept for a day)
//   POST /api/m.php/e   forwards a pageview to Plausible with the visitor's address and browser
//
// Settings (.env file above the document root):
//   PLAUSIBLE_DOMAIN       the site name exactly as added in Plausible, e.g. tidal-streams.sailingpathways.com
//   PLAUSIBLE_SCRIPT_URL   your personal script address from Plausible, https://plausible.io/js/pa-XXXXX.js
//   PLAUSIBLE_DEBUG=1      optional, makes /e show Plausible's answer (switch off again)

ini_set('display_errors', '0');
ini_set('log_errors', '1');

const EVENT_URL = 'https://plausible.io/api/event';
const SCRIPT_PREFIX = 'https://plausible.io/js/';
const SCRIPT_TTL = 86400;
const MAX_BODY_BYTES = 4096;
const EVENTS_PER_HOUR = 200; // per visitor network, protects your Plausible event quota

main();

function main(): void
{
    $route = ltrim($_SERVER['PATH_INFO'] ?? '', '/');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($route === 's' && $method === 'GET') {
        serveScript();
    }

    if ($route === 'e' && $method === 'POST') {
        forwardEvent();
    }

    reply(404);
}

function reply(int $status, string $body = '', string $type = 'text/plain'): never
{
    http_response_code($status);
    header('Content-Type: ' . $type);
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store');
    echo $body;
    exit;
}

// The script

function serveScript(): never
{
    $url = env_value('PLAUSIBLE_SCRIPT_URL') ?? '';
    if (!str_starts_with($url, SCRIPT_PREFIX)) {
        // Not configured (for example on a development machine): serve an empty script.
        http_response_code(200);
        header('Content-Type: application/javascript; charset=utf-8');
        header('Cache-Control: no-store');
        echo '// Analytics are switched off.';
        exit;
    }

    $file = cacheDir() . '/plausible-' . sha1($url) . '.js';
    $js = null;

    if (is_file($file) && time() - filemtime($file) < SCRIPT_TTL) {
        $js = file_get_contents($file) ?: null;
    }

    if ($js === null) {
        [$status, $body] = request('GET', $url, null, []);

        if ($status === 200 && $body !== '') {
            $js = $body;
            $tmp = $file . '.' . getmypid() . '.tmp';
            file_put_contents($tmp, $body);
            rename($tmp, $file);
        } elseif (is_file($file)) {
            $js = file_get_contents($file) ?: null; // an old copy is better than none
        }
    }

    if ($js === null) {
        reply(502);
    }

    http_response_code(200);
    header('Content-Type: application/javascript; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: public, max-age=86400');
    echo $js;
    exit;
}

// The events

function forwardEvent(): never
{
    $site = env_value('PLAUSIBLE_DOMAIN') ?? '';
    if ($site === '') {
        reply(404);
    }

    // Only this site's own pages may send events. A missing header (old browsers) is allowed.
    $origin = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    if ($origin !== '' && !in_array($origin, ['same-origin', 'none'], true)) {
        reply(403);
    }

    $raw = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
    $event = is_string($raw) && strlen($raw) <= MAX_BODY_BYTES ? json_decode($raw, true) : null;
    if (!is_array($event) || !is_string($event['name'] ?? null) || !is_string($event['url'] ?? null)) {
        reply(400);
    }

    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if ($ip === '' || !takeEvent($ip, $site)) {
        reply(429);
    }

    // The site name always comes from the settings, never from the browser.
    $event['domain'] = $site;

    $headers = [
        'Content-Type: application/json',
        'User-Agent: ' . ($_SERVER['HTTP_USER_AGENT'] ?? ''),
        'X-Forwarded-For: ' . $ip, // Plausible drops events that arrive without the visitor's address
    ];

    $debug = env_value('PLAUSIBLE_DEBUG') === '1';
    if ($debug) {
        $headers[] = 'X-Debug-Request: true';
    }

    [$status, $response] = request('POST', EVENT_URL, (string) json_encode($event), $headers);

    if ($debug) {
        reply(200, 'Plausible answered ' . $status . ': ' . $response);
    }

    reply(202);
}

// Counts events per visitor network and UTC hour. The file names start with "budget-",
// so the hourly cleanup in tides.php removes them after two hours.
function takeEvent(string $ip, string $site): bool
{
    if (str_contains($ip, ':')) {
        $packed = @inet_pton($ip);
        if ($packed !== false) {
            $ip = bin2hex(substr($packed, 0, 8));
        }
    }

    $key = substr(hash_hmac('sha256', $ip, $site), 0, 24);
    $handle = fopen(cacheDir() . '/budget-events-' . $key . '-' . gmdate('YmdH'), 'c+');
    if ($handle === false) {
        return true; // a broken counter must not stop the app
    }

    flock($handle, LOCK_EX);
    $used = (int) stream_get_contents($handle);
    $allowed = $used < EVENTS_PER_HOUR;

    if ($allowed) {
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, (string) ($used + 1));
    }

    flock($handle, LOCK_UN);
    fclose($handle);

    return $allowed;
}

// Helpers

/** @return array{0:int,1:string} status, body */
function request(string $method, string $url, ?string $body, array $headers): array
{
    $curl = curl_init($url);
    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_HTTPHEADER => $headers,
    ];

    if ($method === 'POST') {
        $options[CURLOPT_POST] = true;
        $options[CURLOPT_POSTFIELDS] = $body ?? '';
    }

    curl_setopt_array($curl, $options);

    $response = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);

    return is_string($response) ? [$status, $response] : [0, ''];
}

// Same cache folder as the tide proxy; a relative TIDE_CACHE_DIR is resolved from the folder above the document root.
function cacheDir(): string
{
    $dir = env_value('TIDE_CACHE_DIR') ?: sys_get_temp_dir() . '/tide-cache';

    if (!str_starts_with($dir, '/') && preg_match('~^[A-Za-z]:[\\\\/]~', $dir) !== 1) {
        $dir = dirname(__DIR__, 2) . '/' . preg_replace('#^\\./#', '', $dir);
    }

    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }

    return $dir;
}
