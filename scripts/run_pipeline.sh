#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# Project Kinetic-Edge — Pipeline Launcher
# Starts C++ ingestion and Python inference concurrently via ZMQ IPC.
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ── Defaults ──────────────────────────────────────────────────────────────────
CONFIG="${PROJECT_ROOT}/config/pipeline.yaml"
VIDEO=""
INGEST_BIN="${PROJECT_ROOT}/bin/ingest"
PYTHON_CMD="python3"
INFERENCE_SCRIPT="${PROJECT_ROOT}/python/inference.py"

# ── Parse Arguments ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --config)  CONFIG="$2";  shift 2 ;;
        --video)   VIDEO="$2";   shift 2 ;;
        --help|-h)
            echo "Usage: $0 --config <path> --video <path>"
            echo ""
            echo "Options:"
            echo "  --config   Path to pipeline.yaml (default: config/pipeline.yaml)"
            echo "  --video    Path to input .mp4 video file"
            exit 0
            ;;
        *) echo "Unknown argument: $1"; exit 1 ;;
    esac
done

# ── Validation ────────────────────────────────────────────────────────────────
if [[ -z "$VIDEO" ]]; then
    # Try to find a video in data/
    VIDEO=$(find "${PROJECT_ROOT}/data" -name "*.mp4" -type f | head -1)
    if [[ -z "$VIDEO" ]]; then
        echo "ERROR: No video file specified and none found in data/"
        echo "Usage: $0 --config <path> --video <path>"
        exit 1
    fi
    echo "INFO: Auto-detected video: $VIDEO"
fi

if [[ ! -f "$VIDEO" ]]; then
    echo "ERROR: Video file not found: $VIDEO"
    exit 1
fi

if [[ ! -f "$CONFIG" ]]; then
    echo "ERROR: Config file not found: $CONFIG"
    exit 1
fi

if [[ ! -x "$INGEST_BIN" ]]; then
    # Fallback: check build directory
    if [[ -x "${PROJECT_ROOT}/build/ingest" ]]; then
        INGEST_BIN="${PROJECT_ROOT}/build/ingest"
    else
        echo "ERROR: Ingest binary not found. Run 'make build-cpp' first."
        exit 1
    fi
fi

# ── Create output directory ──────────────────────────────────────────────────
mkdir -p "${PROJECT_ROOT}/output"

# ── Trap for graceful shutdown ────────────────────────────────────────────────
PIDS=()

cleanup() {
    echo ""
    echo "INFO: Shutting down pipeline..."
    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done
    wait
    echo "INFO: Pipeline stopped."
}

trap cleanup SIGINT SIGTERM EXIT

# ── Launch Pipeline ───────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "  Project Kinetic-Edge — Pipeline Start"
echo "═══════════════════════════════════════════════════════════"
echo "  Config : $CONFIG"
echo "  Video  : $VIDEO"
echo "  Ingest : $INGEST_BIN"
echo "  Python : $INFERENCE_SCRIPT"
echo "═══════════════════════════════════════════════════════════"

# Start Python inference first (it listens on ZMQ PULL socket)
echo "INFO: Starting inference process..."
$PYTHON_CMD "$INFERENCE_SCRIPT" --config "$CONFIG" &
PIDS+=($!)
sleep 1  # Allow ZMQ socket to bind

# Start C++ ingestion (pushes frames to ZMQ)
echo "INFO: Starting ingestion process..."
"$INGEST_BIN" --config "$CONFIG" --video "$VIDEO" &
PIDS+=($!)

echo "INFO: Pipeline running. Press Ctrl+C to stop."

# Wait for ingestion to finish (it exits after processing all frames)
wait "${PIDS[1]}" 2>/dev/null || true
echo "INFO: Ingestion complete. Waiting for inference to drain..."

# Give inference a few seconds to process remaining queued frames
sleep 3

# Signal inference to stop
if kill -0 "${PIDS[0]}" 2>/dev/null; then
    kill -TERM "${PIDS[0]}" 2>/dev/null || true
fi

wait
echo "INFO: Pipeline complete. Check output/ for results."
