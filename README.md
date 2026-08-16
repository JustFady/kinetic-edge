# Kinetic-Edge

Local Video AI Pipeline & Offline Basketball Referee Assistant

Kinetic-Edge is an offline video processing pipeline and standalone desktop tool designed to evaluate local computer vision models on fast-moving subjects. It tracks basketball players and the ball in real time, flags out-of-bounds boundary violations, detects rapid acceleration spikes (potential fouls), and monitors possession changes.

---

## Live Demo & Links

- **Interactive Web Demo**: [https://justfady.github.io/kinetic-edge/](https://justfady.github.io/kinetic-edge/)
- **Latest Release**: [v1.0.0 Desktop App](https://github.com/JustFady/kinetic-edge/releases/tag/v1.0.0)
- **Technical Report**: [REPORT.md](REPORT.md)
- **Product Roadmap**: [ROADMAP.md](ROADMAP.md)

---

## Architecture

```
+--------------------------------------------------------------+
|             Kinetic-Edge Desktop Application                 |
|                                                              |
|  +--------------------------------------------------------+  |
|  |              Native Window (WebKit / PyWebView)        |  |
|  |  - Drag & Drop Clip Loader                             |  |
|  |  - Hardware-Accelerated Canvas Rendering               |  |
|  |  - Referee Decision & Alerts Feed                      |  |
|  |  - Playback Controls (Pause / Resume / Slow-Mo 0.5x)   |  |
|  +---------------------------+----------------------------+  |
|                              | Local In-Memory IPC           |
|  +---------------------------v----------------------------+  |
|  |               Local Desktop Backend (Offline)          |  |
|  |  - Offline YOLOv8 Weights (cached locally)             |  |
|  |  - Kinetic Anomaly & Boundary Rule Engine              |  |
|  |  - C++ High-Throughput Video Ingestion (OpenCV)        |  |
|  |  - ZeroMQ PUSH/PULL Inter-Process Transport            |  |
|  +--------------------------------------------------------+  |
+--------------------------------------------------------------+
```

---

## Quick Start

### 1. Run Offline Desktop App
```bash
git clone https://github.com/JustFady/kinetic-edge.git
cd kinetic-edge
make app
```
*(or run `.venv/bin/python3 desktop.py`)*

### 2. Run Local Web Interface
```bash
make web
```
Open `http://localhost:8000` in your browser.

### 3. Run CLI Pipeline directly with C++ Ingestion
```bash
make run VIDEO=data/nba_gameplay.mp4
```

### 4. Install via Python Package
```bash
pip install -e .
kinetic-edge app
```

---

## Performance & Evaluation

Tested on 5v5 full-court basketball footage on local CPU:
- **Inference Speed**: ~40.8 FPS (~22ms per frame on local CPU)
- **Multi-Subject Tracking**: ~6.7 simultaneous players tracked per frame
- **Network**: 100% offline, zero cloud dependency

Detailed SWaP-C analysis and benchmarks can be found in [REPORT.md](REPORT.md).

---

## Project Structure

```
kinetic-edge/
├── desktop.py              # Standalone offline desktop app entrypoint
├── server.py               # Local FastAPI backend and WebSocket streamer
├── pyproject.toml          # Package configuration
├── kinetic_edge/           # Python CLI package
├── huggingface/            # Hugging Face Space Dockerfile and config
├── docs/                   # GitHub Pages web showcase
├── REPORT.md               # SWaP-C and latency evaluation report
├── ROADMAP.md              # Technical and product roadmap
├── Makefile                # Build and orchestration targets
├── CMakeLists.txt          # C++ build configuration
├── config/
│   └── pipeline.yaml       # Runtime config (resolution, thresholds, models)
├── cpp/
│   ├── include/ingest.h    # C++ frame ingestion header
│   └── src/ingest.cpp      # OpenCV and ZeroMQ video streamer
├── python/
│   ├── requirements.txt    # Python dependencies
│   ├── inference.py        # YOLOv8 tracking and anomaly logic
│   ├── tracker.py          # Detection backends and boundary heuristics
│   ├── ipc_receiver.py     # ZeroMQ frame deserializer
│   └── telemetry.py        # Latency and FPS logging
├── web/
│   ├── index.html          # Dark-mode referee UI
│   ├── style.css           # UI styles
│   └── app.js              # WebSocket frame renderer and alert feed
└── data/                   # Video inputs (git-ignored)
```

---

## License

MIT License.
