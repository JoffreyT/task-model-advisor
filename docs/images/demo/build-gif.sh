#!/usr/bin/env bash
# Rebuilds docs/images/demo.gif from demo.html (macOS, needs Google Chrome + ffmpeg).
# Usage: bash docs/images/demo/build-gif.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/../demo.gif"
MEDIA_OUT="$(cd "$HERE/../../.." && pwd)/media/demo.gif"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Seconds each frame stays on screen (index = ?f=N in demo.html).
DURATIONS=(1.6 1.6 1.4 2.2 2.2 1.6 2.8)

: >"$TMP/list.txt"
for i in "${!DURATIONS[@]}"; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=960,540 \
    --screenshot="$TMP/f$i.png" "file://$HERE/demo.html?f=$i" >/dev/null 2>&1
  printf "file '%s'\nduration %s\n" "$TMP/f$i.png" "${DURATIONS[$i]}" >>"$TMP/list.txt"
done
# concat demuxer needs the last file repeated without duration
last=$((${#DURATIONS[@]} - 1))
printf "file '%s'\n" "$TMP/f$last.png" >>"$TMP/list.txt"

ffmpeg -y -loglevel error -f concat -safe 0 -i "$TMP/list.txt" \
  -vf "fps=15,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" \
  -loop 0 "$OUT"

cp "$OUT" "$MEDIA_OUT"
echo "Wrote $OUT and $MEDIA_OUT ($(du -h "$OUT" | cut -f1))"
