<?php
declare(strict_types=1);

// Settings for the tide proxy.
// 1. A real environment variable wins (this is how Docker passes your .env).
// 2. Otherwise a .env file one folder ABOVE the document root is read, for example
//    /home/you/.env when the site lives in /home/you/httpdocs.
// Set APP_ENV_FILE to use another location.

function env_file_values(): array
{
    static $values = null;
    if ($values !== null) {
        return $values;
    }

    $values = [];
    $file = getenv('APP_ENV_FILE') ?: dirname(__DIR__, 2) . '/.env';
    if (!is_readable($file)) {
        return $values;
    }

    $content = file_get_contents($file);
    if ($content === false) {
        return $values;
    }

    // A byte-order mark (added by some Windows editors) would spoil the first name.
    if (str_starts_with($content, "\xEF\xBB\xBF")) {
        $content = substr($content, 3);
    }

    foreach (preg_split('/\R/', $content) ?: [] as $line) {
        $line = trim($line);
        if (str_starts_with($line, 'export ')) {
            $line = ltrim(substr($line, 7));
        }
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
            continue;
        }

        [$name, $value] = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);

        $quote = $value[0] ?? '';
        if (strlen($value) >= 2 && ($quote === '"' || $quote === "'") && substr($value, -1) === $quote) {
            $value = substr($value, 1, -1);
        }

        $values[$name] = $value;
    }

    return $values;
}

function env_value(string $name, ?string $default = null): ?string
{
    $real = getenv($name);
    if ($real !== false && $real !== '') {
        return $real;
    }

    return env_file_values()[$name] ?? $default;
}
