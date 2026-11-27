#!/bin/bash
# Screenshot slides.  tools/shot.sh 1 2 3  (last step)   or   STEP=4 tools/shot.sh 9   (a given step)  ->  /tmp/rl-shots/N[-sS].png
# Chrome is started per shot with a throwaway profile and waited on by PID.
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT=/tmp/rl-shots; mkdir -p "$OUT"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for n in "$@"; do
  PROF=$(mktemp -d)
  "$CHROME" --headless=new --disable-gpu --no-first-run --hide-scrollbars --user-data-dir="$PROF" \
    --window-size=1920,1080 --virtual-time-budget=${WAIT:-6000} --screenshot="$OUT/$n${STEP:+-s$STEP}.png" "file://$ROOT/index.html?${STEP:+step=$STEP&static}${STEP:-all}#$n" >/dev/null 2>&1 &
  PID=$!; wait $PID; rm -rf "$PROF"
done
echo "$OUT"
