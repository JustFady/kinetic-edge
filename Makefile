# ══════════════════════════════════════════════════════════════════════════════
# Project Kinetic-Edge — Makefile
# ══════════════════════════════════════════════════════════════════════════════

IMAGE_NAME    := kinetic-edge
IMAGE_TAG     := latest
CONTAINER     := kinetic-edge-run
BUILD_DIR     := build
VIDEO         ?= data/sample.mp4
CONFIG        ?= config/pipeline.yaml

.PHONY: all docker-build docker-run run clean help

# ── Default Target ────────────────────────────────────────────────────────────
all: docker-build

# ── Docker Targets ────────────────────────────────────────────────────────────

## Build the Docker image
docker-build:
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .

## Run the pipeline inside Docker (mount local data/ for video input)
docker-run: docker-build
	docker run --rm \
		--name $(CONTAINER) \
		-v $(CURDIR)/data:/app/data:ro \
		-v $(CURDIR)/output:/app/output \
		$(IMAGE_NAME):$(IMAGE_TAG) \
		--config /app/config/pipeline.yaml \
		--video /app/data/$(notdir $(VIDEO))

## Interactive shell inside the container (for debugging)
docker-shell: docker-build
	docker run --rm -it \
		--entrypoint /bin/bash \
		-v $(CURDIR)/data:/app/data \
		-v $(CURDIR)/output:/app/output \
		$(IMAGE_NAME):$(IMAGE_TAG)

# ── Local Build Targets (require host dependencies) ──────────────────────────

## Build C++ ingest binary locally
build-cpp:
	cmake -B $(BUILD_DIR) -DCMAKE_BUILD_TYPE=Release .
	cmake --build $(BUILD_DIR) --parallel $$(nproc 2>/dev/null || sysctl -n hw.ncpu)

## Install Python dependencies locally (use a venv)
install-python:
	python3 -m venv .venv
	.venv/bin/pip install --upgrade pip
	.venv/bin/pip install -r python/requirements.txt

## Run the pipeline locally (requires both build-cpp and install-python)
run: build-cpp install-python
	bash scripts/run_pipeline.sh --config $(CONFIG) --video $(VIDEO)

# ── Utilities ─────────────────────────────────────────────────────────────────

## Download a sample basketball video
download-sample:
	bash scripts/download_sample.sh

## Remove build artifacts
clean:
	rm -rf $(BUILD_DIR) .venv output/ __pycache__
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

## Remove Docker image
docker-clean:
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG) 2>/dev/null || true

# ── Help ──────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "  Project Kinetic-Edge — Build & Run"
	@echo "  ─────────────────────────────────────────────"
	@echo "  make docker-build     Build Docker image"
	@echo "  make docker-run       Run pipeline in Docker"
	@echo "  make docker-shell     Interactive debug shell"
	@echo "  make build-cpp        Build C++ binary locally"
	@echo "  make install-python   Set up Python venv"
	@echo "  make run              Run pipeline locally"
	@echo "  make download-sample  Download sample video"
	@echo "  make clean            Remove build artifacts"
	@echo "  make docker-clean     Remove Docker image"
	@echo ""
