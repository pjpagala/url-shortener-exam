#!/usr/bin/env bash
# integration-test.sh — end-to-end tests against the live server
# Usage: ./integration-test.sh [BASE_URL]
# Defaults to http://localhost:3000

set -euo pipefail

BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0
SERVER_PID=""

# ─── Helpers ──────────────────────────────────────────────────────────

green()  { printf '\033[0;32m✔ %s\033[0m\n' "$*"; }
red()    { printf '\033[0;31m✗ %s\033[0m\n' "$*"; }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    green "$label"
    PASS=$((PASS+1))
  else
    red "$label (expected: $expected, got: $actual)"
    FAIL=$((FAIL+1))
  fi
}

assert_contains() {
  local label="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -q "$needle"; then
    green "$label"
    PASS=$((PASS+1))
  else
    red "$label (expected to contain: $needle, got: $haystack)"
    FAIL=$((FAIL+1))
  fi
}

# Start local server if not already running
start_server() {
  if curl -sf "$BASE/health" > /dev/null 2>&1; then
    echo "Server already running at $BASE"
    return
  fi

  echo "Starting server..."
  cd "$(dirname "$0")/src"
  npm run build > /dev/null 2>&1
  node dist/index.js &
  SERVER_PID=$!
  cd - > /dev/null

  # Wait up to 10s for server to be ready
  for i in $(seq 1 20); do
    if curl -sf "$BASE/health" > /dev/null 2>&1; then
      echo "Server ready."
      return
    fi
    sleep 0.5
  done
  echo "Server failed to start."
  exit 1
}

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ─── Tests ────────────────────────────────────────────────────────────

start_server

echo ""
echo "Running integration tests against $BASE"
echo "────────────────────────────────────────"

# ── Health Check ─────────────────────────────────────────────────────

echo ""
echo "[ Health Check ]"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")
assert_eq "GET /health → 200" "200" "$STATUS"

BODY=$(curl -s "$BASE/health")
assert_contains "GET /health body contains status:ok" '"status":"ok"' "$BODY"

# ── POST /shorten ─────────────────────────────────────────────────────

echo ""
echo "[ POST /shorten ]"

# Valid URL
RESPONSE=$(curl -s -w '\n%{http_code}' -X POST "$BASE/shorten" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.example.com/some/long/path"}')
STATUS=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)
assert_eq  "POST /shorten valid URL → 201"            "201"  "$STATUS"
assert_contains "POST /shorten response has short_code"  "short_code" "$BODY"
assert_contains "POST /shorten response has short_url"   "short_url"  "$BODY"
assert_contains "POST /shorten response has original_url" "original_url" "$BODY"

# Extract short_code for reuse in later tests
SHORT_CODE=$(echo "$BODY" | grep -o '"short_code":"[^"]*"' | cut -d'"' -f4)
echo "  (captured short_code: $SHORT_CODE)"

# Missing URL field
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/shorten" \
  -H 'Content-Type: application/json' \
  -d '{}')
assert_eq "POST /shorten missing url → 400" "400" "$STATUS"

# Malformed URL
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/shorten" \
  -H 'Content-Type: application/json' \
  -d '{"url":"not-a-valid-url"}')
assert_eq "POST /shorten malformed url → 400" "400" "$STATUS"

# Non-string URL
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/shorten" \
  -H 'Content-Type: application/json' \
  -d '{"url":12345}')
assert_eq "POST /shorten non-string url → 400" "400" "$STATUS"

# ── GET /:code ────────────────────────────────────────────────────────

echo ""
echo "[ GET /:code ]"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/$SHORT_CODE")
assert_eq "GET /:code valid code → 302" "302" "$STATUS"

LOCATION=$(curl -s -o /dev/null -w "%{redirect_url}" "$BASE/$SHORT_CODE")
assert_contains "GET /:code redirects to original URL" "example.com" "$LOCATION"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/doesnotexist000")
assert_eq "GET /:code unknown code → 404" "404" "$STATUS"

# ── GET /stats/:code ──────────────────────────────────────────────────

echo ""
echo "[ GET /stats/:code ]"

RESPONSE=$(curl -s -w '\n%{http_code}' "$BASE/stats/$SHORT_CODE")
STATUS=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)
assert_eq "GET /stats/:code valid code → 200" "200" "$STATUS"
assert_contains "GET /stats/:code has visit_count"   "visit_count"   "$BODY"
assert_contains "GET /stats/:code has original_url"  "original_url"  "$BODY"
assert_contains "GET /stats/:code has created_at"    "created_at"    "$BODY"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/stats/doesnotexist000")
assert_eq "GET /stats/:code unknown code → 404" "404" "$STATUS"

# ── visit_count increments ────────────────────────────────────────────

echo ""
echo "[ Visit tracking ]"

BEFORE=$(curl -s "$BASE/stats/$SHORT_CODE" | grep -o '"visit_count":[0-9]*' | cut -d: -f2)
curl -s -o /dev/null "$BASE/$SHORT_CODE"
curl -s -o /dev/null "$BASE/$SHORT_CODE"
AFTER=$(curl -s "$BASE/stats/$SHORT_CODE" | grep -o '"visit_count":[0-9]*' | cut -d: -f2)
assert_eq "visit_count increments by 2 after 2 redirects" "$((BEFORE + 2))" "$AFTER"

LAST_VISITED=$(curl -s "$BASE/stats/$SHORT_CODE" | grep -o '"last_visited_at":"[^"]*"' | cut -d'"' -f4)
if [ -n "$LAST_VISITED" ] && [ "$LAST_VISITED" != "null" ]; then
  green "last_visited_at is set after redirect"
  PASS=$((PASS+1))
else
  red "last_visited_at should be set after redirect (got: $LAST_VISITED)"
  FAIL=$((FAIL+1))
fi

# ── GET /admin/top ────────────────────────────────────────────────────

echo ""
echo "[ GET /admin/top ]"

RESPONSE=$(curl -s -w '\n%{http_code}' "$BASE/admin/top")
STATUS=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)
assert_eq "GET /admin/top → 200" "200" "$STATUS"
assert_contains "GET /admin/top has top_urls array" "top_urls" "$BODY"

# ── Rate Limiting ─────────────────────────────────────────────────────

echo ""
echo "[ Rate Limiting (POST /shorten) ]"
echo "  Sending 11 requests from the same IP..."

LAST_STATUS=""
for i in $(seq 1 11); do
  LAST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/shorten" \
    -H 'Content-Type: application/json' \
    -d '{"url":"https://rate-limit-test.com"}')
done
assert_eq "11th POST /shorten → 429" "429" "$LAST_STATUS"

BODY=$(curl -s -X POST "$BASE/shorten" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://rate-limit-test.com"}')
assert_contains "429 body has retry_after_seconds" "retry_after_seconds" "$BODY"
assert_contains "429 body has correct error message" "Rate limit exceeded" "$BODY"

# ─── Summary ──────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "════════════════════════════════════════"

[ "$FAIL" -eq 0 ]
