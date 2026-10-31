#!/usr/bin/env bash
# Deploy Coupon Wallet to Vercel (production).
#
# Usage:
#   GAS_WEB_APP_URL='https://script.google.com/macros/s/xxx/exec' \
#   GAS_SHARED_SECRET='...' \
#   ./scripts/deploy.sh
#
# Optional: NEXT_PUBLIC_NEAR_EXPIRY_DAYS=3

set -euo pipefail

: "${GAS_WEB_APP_URL:?ต้องตั้ง GAS_WEB_APP_URL ก่อน}"
: "${GAS_SHARED_SECRET:?ต้องตั้ง GAS_SHARED_SECRET ก่อน}"

VERCEL="npx --yes vercel@latest"
PROJECT="coupon"

echo "==> Login"
$VERCEL login

echo "==> Link project: $PROJECT"
$VERCEL link --yes --project "$PROJECT"

set_env() {
  local name="$1" value="$2"
  for target in production preview development; do
    $VERCEL env rm "$name" "$target" -y >/dev/null 2>&1 || true
    printf '%s' "$value" | $VERCEL env add "$name" "$target" >/dev/null
    echo "    set $name ($target)"
  done
}

echo "==> Environment variables"
set_env GAS_WEB_APP_URL "$GAS_WEB_APP_URL"
set_env GAS_SHARED_SECRET "$GAS_SHARED_SECRET"
if [[ -n "${NEXT_PUBLIC_NEAR_EXPIRY_DAYS:-}" ]]; then
  set_env NEXT_PUBLIC_NEAR_EXPIRY_DAYS "$NEXT_PUBLIC_NEAR_EXPIRY_DAYS"
fi

echo "==> Deploy"
$VERCEL --prod --yes
