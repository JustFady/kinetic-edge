# Project Kinetic-Edge

**Local Video AI Evaluation Pipeline** — A proof-of-concept system for evaluating the latency and accuracy of local AI inference models (YOLOv8) on fast-moving subjects.

## Architecture

```
┌─────────────────┐     ZMQ PUSH/PULL      ┌──────────────────────┐
│  C++ Ingestion   │ ──────────────────────▶ │  Python Inference     │
│  (ingest.cpp)    │   tcp://127.0.0.1:5555  │  (inference.py)       │
│                  │                         │                       │
│  • Read .mp4     │   Frame Wire Format:    │  • YOLOv8 Detection   │
│  • Resize frames │   [ts|id|w|h|c|pixels]  │  • ByteTrack Tracking │
│  • Timestamp     │                         │  • Anomaly Heuristics │
│  • Serialize     │                         │  • Latency Telemetry  │
└─────────────────┘                         └──────────────────────┘
                                                       │
                                                       ▼
                                              output/telemetry.jsonl
```

## Quick Start

### Docker (Recommended)

```bash
# 1. Place your .mp4 video in data/
cp /path/to/basketball.mp4 data/sample.mp4

# 2. Build and run
make docker-build
make docker-run

# Or download a sample video first
make download-sample
make docker-run
```

### Local Build

```bash
# Prerequisites: cmake, opencv4, libzmq, python3
make build-cpp
make install-python
make run VIDEO=data/sample.mp4
```

## Configuration

Edit `config/pipeline.yaml` to configure:
- **Resolution**: Target frame size for normalization
- **Model backend**: `ultralytics` (native PyTorch) or `onnx` (ONNX Runtime)
- **Model size**: `yolov8n.pt`, `yolov8s.pt`, `yolov8m.pt`
- **Anomaly thresholds**: Acceleration sigma, court boundaries
- **Telemetry**: Log level, output format

## Project Structure

```
kinetic-edge/
├── CMakeLists.txt          # Top-level CMake config
├── Dockerfile              # Ubuntu 22.04 build environment
├── Makefile                # Build/run orchestration
├── config/pipeline.yaml    # Runtime configuration
├── cpp/                    # C++ video ingestion module
├── python/                 # Python inference + tracking
├── scripts/                # Pipeline launcher & utilities
├── data/                   # Video input directory
└── output/                 # Telemetry & results
```

## License

Internal use — Evaluation prototype.
