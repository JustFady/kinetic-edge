#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Download a sample basketball video for pipeline testing.
# Source: Pexels (free to use, no attribution required)
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$(dirname "$SCRIPT_DIR")/data"
OUTPUT_FILE="${DATA_DIR}/sample.mp4"

if [[ -f "$OUTPUT_FILE" ]]; then
    echo "INFO: Sample video already exists at $OUTPUT_FILE"
    exit 0
fi

mkdir -p "$DATA_DIR"

echo "INFO: Downloading sample basketball video..."

# Pexels free stock video — basketball game footage (~10s, 1080p)
# Replace this URL with your own clip if preferred.
SAMPLE_URL="https://videos.pexels.com/video-files/3191572/3191572-uhd_2560_1440_25fps.mp4"

if command -v wget &>/dev/null; then
    wget -q --show-progress -O "$OUTPUT_FILE" "$SAMPLE_URL"
elif command -v curl &>/dev/null; then
    curl -L --progress-bar -o "$OUTPUT_FILE" "$SAMPLE_URL"
else
    echo "ERROR: Neither wget nor curl found. Please install one."
    exit 1
fi

echo "INFO: Downloaded sample video to $OUTPUT_FILE"
echo "INFO: File size: $(du -h "$OUTPUT_FILE" | cut -f1)"
