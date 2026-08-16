# ══════════════════════════════════════════════════════════════════════════════
# Kinetic-Edge — Hugging Face Space Dockerfile (Port 7860)
# ══════════════════════════════════════════════════════════════════════════════

FROM python:3.10-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PORT=7860

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopencv-dev \
    libzmq3-dev \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create user for Hugging Face Spaces (UID 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Install Python requirements
COPY --chown=user:user python/requirements.txt ./python/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r python/requirements.txt

# Copy application files
COPY --chown=user:user . .

# Build C++ ingest binary
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release . && \
    cmake --build build --parallel 4 || true

EXPOSE 7860

# Launch server on Hugging Face standard port 7860
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "7860"]
