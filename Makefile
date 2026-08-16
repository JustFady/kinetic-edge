# ══════════════════════════════════════════════════════════════════════════════
# Project Kinetic-Edge — Makefile
# ══════════════════════════════════════════════════════════════════════════════

IMAGE_NAME    := kinetic-edge
IMAGE_TAG     := latest
CONTAINER     := kinetic-edge-run
BUILD_DIR     := build
VIDEO         ?= data/sample.mp4
CONFIG        ?= config/pipeline.yaml

.PHONY: all app web build-cpp install-python build-package publish-pypi run clean help

# ── Default Target ────────────────────────────────────────────────────────────
all: app

# ── Desktop App (Offline Native Window) ───────────────────────────────────────
## Launch the 100% offline standalone desktop app window
app: install-python build-cpp
	.venv/bin/python3 desktop.py

# ── Web Server ────────────────────────────────────────────────────────────────
## Launch local web server (accessible via browser at localhost:8000)
web: install-python build-cpp
	.venv/bin/python3 server.py

# ── Packaging & Distribution (PyPI & Hugging Face) ───────────────────────────
## Build standard wheel & source distribution for PyPI
build-package: install-python
	.venv/bin/pip install --upgrade build twine -q
	.venv/bin/python3 -m build

## Upload package to PyPI (requires PyPI token)
publish-pypi: build-package
	.venv/bin/twine upload dist/*

# ── Local Build Targets ───────────────────────────────────────────────────────
## Build C++ ingest binary locally
build-cpp:
	cmake -B $(BUILD_DIR) -DCMAKE_BUILD_TYPE=Release .
	cmake --build $(BUILD_DIR) --parallel $$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 4)

## Install Python dependencies locally (use a venv)
install-python:
	python3 -m venv .venv
	.venv/bin/pip install --upgrade pip -q
	.venv/bin/pip install -r python/requirements.txt -q
	.venv/bin/pip install -e . -q

## Run the CLI pipeline locally
run: build-cpp install-python
	bash scripts/run_pipeline.sh --config $(CONFIG) --video $(VIDEO)

# ── Utilities ─────────────────────────────────────────────────────────────────
## Download a sample basketball video
download-sample:
	bash scripts/download_sample.sh

## Remove build artifacts
clean:
	rm -rf $(BUILD_DIR) .venv output/ dist/ *.egg-info __pycache__
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

# ── Help ──────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Project Kinetic-Edge — Offline Referee Assistant"
	@echo "  ─────────────────────────────────────────────────"
	@echo "  make app              Launch standalone offline desktop app"
	@echo "  make web              Run local web server UI (localhost:8000)"
	@echo "  make build-package    Build Python package (.whl & tar.gz) for PyPI"
	@echo "  make publish-pypi     Publish distribution to PyPI (twine)"
	@echo "  make build-cpp        Build C++ binary locally"
	@echo "  make install-python   Set up Python venv with offline deps"
	@echo "  make run              Run CLI pipeline locally"
	@echo "  make clean            Remove build artifacts"
	@echo ""
