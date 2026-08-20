# ══════════════════════════════════════════════════════════════════════════════
# Project Kinetic-Edge — Multi-stage Docker Build
#
# Targets:
#   docker build -t kinetic-edge .                   # Full image (web server)
#   docker build --target cli -t kinetic-edge-cli .  # CLI-only image
#
# Usage:
#   docker run -p 8000:8000 kinetic-edge                          # Web UI
#   docker run -v ./data:/app/data kinetic-edge-cli --video /app/data/game.mp4
#
# For GPU support, swap the base image:
#   FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04
# ══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: Build C++ ingest binary ─────────────────────────────────────────
FROM ubuntu:22.04 AS cpp-builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake pkg-config \
    libopencv-dev libzmq3-dev libcppzmq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY CMakeLists.txt ./
COPY cpp/ ./cpp/

RUN cmake -B build -DCMAKE_BUILD_TYPE=Release . && \
    cmake --build build --parallel $(nproc)

# ── Stage 2: Python base (shared between CLI and web) ────────────────────────
FROM ubuntu:22.04 AS python-base

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libopencv-dev libzmq5 \
    python3 python3-pip python3-dev \
    ffmpeg libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Install Python deps (cached layer)
COPY python/requirements.txt /app/python/requirements.txt
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir -r /app/python/requirements.txt && \
    pip3 install --no-cache-dir uvicorn fastapi python-multipart

# Copy C++ binary from builder
COPY --from=cpp-builder /build/build/ingest /app/bin/ingest
RUN chmod +x /app/bin/ingest

# Copy project source
COPY config/ /app/config/
COPY python/ /app/python/
COPY scripts/ /app/scripts/
COPY server.py /app/server.py
COPY web/ /app/web/
COPY yolov8n.pt /app/yolov8n.pt
COPY kinetic_edge/ /app/kinetic_edge/
COPY pyproject.toml /app/pyproject.toml

RUN chmod +x /app/scripts/*.sh

# Pre-download model weights into the image so first run is instant
RUN python3 -c "from ultralytics import YOLO; YOLO('yolov8n.pt')" 2>/dev/null || true

# ── Stage 3: CLI target ──────────────────────────────────────────────────────
FROM python-base AS cli

# Mount your video files into /app/data at runtime
VOLUME ["/app/data", "/app/output"]

ENTRYPOINT ["/app/scripts/run_pipeline.sh"]
CMD ["--config", "/app/config/pipeline.yaml"]

# ── Stage 4: Web server target (default) ─────────────────────────────────────
FROM python-base AS web

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["python3", "server.py"]
