# ══════════════════════════════════════════════════════════════════════════════
# Project Kinetic-Edge — Docker Build Environment
# Target: Ubuntu 22.04 (CPU-only)
# For GPU/CUDA support, swap base to nvidia/cuda:12.2.0-runtime-ubuntu22.04
# and add onnxruntime-gpu to requirements.txt
# ══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: Build C++ Ingest Binary ─────────────────────────────────────────
FROM ubuntu:22.04 AS cpp-builder

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    pkg-config \
    libopencv-dev \
    libzmq3-dev \
    libcppzmq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY CMakeLists.txt ./
COPY cpp/ ./cpp/

# Placeholder sources needed for cmake configure — create stubs if not present
RUN mkdir -p cpp/src cpp/include && \
    touch cpp/include/ingest.h && \
    if [ ! -f cpp/src/ingest.cpp ]; then \
        echo 'int main() { return 0; }' > cpp/src/ingest.cpp; \
    fi

RUN cmake -B build -DCMAKE_BUILD_TYPE=Release . && \
    cmake --build build --parallel $(nproc)

# ── Stage 2: Runtime Environment ─────────────────────────────────────────────
FROM ubuntu:22.04 AS runtime

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopencv-dev \
    libzmq5 \
    python3 \
    python3-pip \
    python3-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Symlink python3 → python for convenience
RUN ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Install Python dependencies first (layer caching)
COPY python/requirements.txt /app/python/requirements.txt
RUN pip3 install --no-cache-dir -r /app/python/requirements.txt

# Copy C++ binary from builder stage
COPY --from=cpp-builder /build/build/ingest /app/bin/ingest

# Copy project files
COPY config/ /app/config/
COPY python/ /app/python/
COPY scripts/ /app/scripts/
COPY data/ /app/data/

# Make scripts executable
RUN chmod +x /app/scripts/*.sh /app/bin/ingest

# Health check — verify both binaries are functional
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD /app/bin/ingest --help && python3 -c "import ultralytics; import zmq" || exit 1

ENTRYPOINT ["/app/scripts/run_pipeline.sh"]
CMD ["--config", "/app/config/pipeline.yaml"]
