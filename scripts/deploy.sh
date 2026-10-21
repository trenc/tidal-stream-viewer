#!/usr/bin/env bash
# FTP deployment for the Tidal Stream Viewer (needs lftp: sudo apt install lftp).
#
#   scripts/deploy.sh [app|api|atlas|all] [--dry-run] [--no-build] [--prune] [--yes]
#
#   app    build the app (npm run build) and upload dist/ to the site root
#   api    upload public_html/api (tide proxy) to api/
#   atlas  upload public_html/atlas (converted data) to atlas/
#
# Settings come from .env.deploy (copy .env.deploy.example). Nothing is uploaded without a
# confirmation, unless you pass --yes. Try --dry-run first: it only prints what would happen.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${DEPLOY_ENV:-.env.deploy}"
BUILD_DIR="${BUILD_DIR:-dist}"
API_DIR="${API_DIR:-public_html/api}"
ATLAS_DIR="${ATLAS_DIR:-public_html/atlas}"

want_app=0 want_api=0 want_atlas=0
dry=0 build=1 assume_yes=0 prune=0

die() { echo "deploy: $*" >&2; exit 1; }

usage() {
  sed -n '2,11p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  cat <<'EOF'

  --dry-run   show what would be uploaded or deleted, change nothing
  --no-build  upload the existing dist/ without building first
  --prune     also delete remote files that no longer exist locally in api/ and atlas/
              (the app always removes outdated files; api/ and atlas/ are only added to by default)
  --yes       do not ask for confirmation
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    app) want_app=1 ;;
    api) want_api=1 ;;
    atlas) want_atlas=1 ;;
    all) want_app=1 want_api=1 want_atlas=1 ;;
    -n|--dry-run) dry=1 ;;
    --no-build) build=0 ;;
    --prune) prune=1 ;;
    -y|--yes) assume_yes=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1 (see --help)" ;;
  esac
  shift
done
if (( want_app + want_api + want_atlas == 0 )); then want_app=1; fi

command -v lftp >/dev/null || die "lftp is missing: sudo apt install lftp"
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE not found. Copy .env.deploy.example to $ENV_FILE and fill it in."

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

for name in FTP_HOST FTP_USER FTP_PASS FTP_REMOTE_DIR; do
  [[ -n "${!name:-}" ]] || die "$name is not set in $ENV_FILE"
done
FTP_PORT="${FTP_PORT:-21}"
FTP_PROTOCOL="${FTP_PROTOCOL:-ftp}"        # ftp = explicit TLS on the normal port, ftps = implicit TLS (port 990)
FTP_TLS="${FTP_TLS:-yes}"                  # yes = refuse unencrypted logins
FTP_VERIFY_CERT="${FTP_VERIFY_CERT:-yes}"  # no only as a last resort, it allows man-in-the-middle attacks
FTP_CA_FILE="${FTP_CA_FILE:-}"
FTP_KEEP="${FTP_KEEP:-}"                   # extra top-level names on the server that must never be deleted

(( want_app )) && [[ $build -eq 1 ]] && { echo "==> npm run build"; npm run build; }
(( want_app )) && [[ ! -f "$BUILD_DIR/index.html" ]] && die "$BUILD_DIR/index.html not found. Run the build first."
(( want_api )) && [[ ! -d "$API_DIR" ]] && die "$API_DIR not found"
(( want_atlas )) && [[ ! -f "$ATLAS_DIR/index.json" ]] && die "$ATLAS_DIR/index.json not found. Run: make convert"

# Quote a value for an lftp script.
lq() { local s=${1//\\/\\\\}; s=${s//\"/\\\"}; printf '"%s"' "$s"; }

# Top-level names that the "remove outdated files" step must leave alone.
keep_args=()
for name in api atlas cache cgi-bin .well-known .htaccess .htpasswd $FTP_KEEP; do
  rx=${name//./[.]}
  keep_args+=(-x "\"^${rx}(/|\$)\"")
done

mirror_opts="-R --parallel=3"
(( dry )) && mirror_opts="$mirror_opts --dry-run"
delete_opt=""
(( prune )) && delete_opt="--delete"

script="$(umask 077; mktemp)"
trap 'rm -f "$script"' EXIT

{
  echo "set cmd:fail-exit yes"
  echo "set net:timeout 20"
  echo "set net:max-retries 3"
  echo "set net:reconnect-interval-base 5"
  echo "set ftp:passive-mode yes"
  if [[ "$FTP_TLS" == "yes" ]]; then
    echo "set ftp:ssl-allow yes"
    echo "set ftp:ssl-force yes"
    echo "set ftp:ssl-protect-data yes"
  else
    echo "set ftp:ssl-allow no"
  fi
  echo "set ssl:verify-certificate $FTP_VERIFY_CERT"
  [[ -n "$FTP_CA_FILE" ]] && echo "set ssl:ca-file $(lq "$FTP_CA_FILE")"
  echo "open -u $(lq "$FTP_USER,$FTP_PASS") -p $FTP_PORT $FTP_PROTOCOL://$FTP_HOST"
  echo "cd $(lq "$FTP_REMOTE_DIR")"

  if (( want_app )); then
    echo "echo '--- app: new files first, entry points last, then remove outdated files'"
    echo "mirror $mirror_opts --transfer-all -x \"^index[.]html\$\" -x \"^sw[.]js\$\" -x \"^registerSW[.]js\$\" -x \"^manifest[.]webmanifest\$\" $(lq "$BUILD_DIR") ."
    echo "mirror $mirror_opts --transfer-all -i \"^index[.]html\$\" -i \"^sw[.]js\$\" -i \"^registerSW[.]js\$\" -i \"^manifest[.]webmanifest\$\" $(lq "$BUILD_DIR") ."
    echo "mirror $mirror_opts --delete --only-missing ${keep_args[*]} $(lq "$BUILD_DIR") ."
  fi

  if (( want_api )); then
    echo "echo '--- api'"
    echo "mirror $mirror_opts $delete_opt -x \"^[.]env\" -x \"^cache/\" -x \"[.]local[.]php\$\" $(lq "$API_DIR") api"
  fi

  if (( want_atlas )); then
    echo "echo '--- atlas: data first, index.json last'"
    echo "mirror $mirror_opts --continue $delete_opt -x \"^index[.]json\$\" $(lq "$ATLAS_DIR") atlas"
    echo "mirror $mirror_opts -i \"^index[.]json\$\" $(lq "$ATLAS_DIR") atlas"
  fi
  echo "bye"
} > "$script"

targets=()
(( want_app )) && targets+=(app)
(( want_api )) && targets+=(api)
(( want_atlas )) && targets+=(atlas)

echo "==> Target : $FTP_PROTOCOL://$FTP_USER@$FTP_HOST:$FTP_PORT$FTP_REMOTE_DIR"
echo "==> Upload : ${targets[*]}$( (( dry )) && echo ' (dry run)')"

if (( ! dry && ! assume_yes )); then
  [[ -t 0 ]] || die "no terminal for the confirmation. Use --yes."
  read -r -p "Continue? [y/N] " answer
  [[ "$answer" =~ ^[Yy]$ ]] || die "cancelled"
fi

lftp -f "$script"

if (( dry )); then
  echo "==> Dry run finished. Nothing was changed."
else
  echo "==> Done. Check the site, then reload it twice so the new service worker takes over."
fi
