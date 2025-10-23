#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_ANON_KEY:-}" ]]; then
  echo "SUPABASE_URL and SUPABASE_ANON_KEY must be set" >&2
  exit 1
fi

game_id="${1:-${GAME_ID:-}}"
if [[ -z "$game_id" ]]; then
  echo "Usage: GAME_ID=<uuid> $0 [game-id]" >&2
  exit 1
fi

post_json() {
  local url="$1"
  local payload="$2"
  curl -sS -X POST "$url" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

echo "== Publish game =="
post_json "$SUPABASE_URL/functions/v1/publish-game" '{"gameId":"'"$game_id"'"}' | jq

echo "== Fetch published view =="
curl -sS "$SUPABASE_URL/rest/v1/v_published_game?slug=eq.test-city-run" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" | jq

echo "== Geofence check =="
post_json "$SUPABASE_URL/functions/v1/geofence-check" '{"gameId":"'"$game_id"'","lat":44.9778,"lng":-93.2650}' | jq

echo "== Record tap event =="
post_json "$SUPABASE_URL/functions/v1/events-record" '{"gameId":"'"$game_id"'","eventType":"tap","payload":{"note":"cli smoke"}}' | jq
