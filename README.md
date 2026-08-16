# ⚡ Project Kinetic-Edge — AI Basketball Referee Assistant

[![Live Web Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-00d4ff?style=for-the-badge&logo=github)](https://justfady.github.io/kinetic-edge/)
[![Hugging Face Space](https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-Spaces-yellow?style=for-the-badge)](huggingface/)
[![PyPI Package](https://img.shields.io/badge/PyPI-kinetic--edge-blue?style=for-the-badge&logo=pypi)](pyproject.toml)
[![Download Release v1.0.0](https://img.shields.io/badge/Download-Desktop_App_v1.0.0-ff6b2b?style=for-the-badge&logo=apple)](https://github.com/JustFady/kinetic-edge/releases/tag/v1.0.0)
[![Offline First](https://img.shields.io/badge/Offline-100%25_Local_Inference-00e676?style=for-the-badge)](REPORT.md)

**Kinetic-Edge** is an ultra-low-latency, 100% offline AI video processing pipeline and standalone referee assistant designed to track players, basketballs, and assist human referee decision-making (out-of-bounds, sudden acceleration/fouls, and possession changes) in real time.

---

## 🎮 Interactive Live Demo
Try the browser simulation directly without installing anything:
👉 **[Open Live Demo on GitHub Pages](https://justfady.github.io/kinetic-edge/)**

---

## 📦 Installation & Quickstart

### Option A: Install via pip (PyPI)
```bash
pip install kinetic-edge

# Launch standalone offline desktop app
kinetic-edge app

# Or launch local web server
kinetic-edge web --port 8000
```

### Option B: Clone & Run Locally
```bash
git clone https://github.com/JustFady/kinetic-edge.git
cd kinetic-edge

# Launch offline desktop app
make app

# Or launch web interface
make web
```

### Option C: Hugging Face Spaces Deployment
See the **[`huggingface/`](huggingface/)** directory for Docker & Space configuration.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│             Kinetic-Edge Desktop Application (.app)           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Native Window (WebKit / PyWebView)        │  │
│  │  - Drag & Drop Clip Loader                             │  │
│  │  - Live Hardware-Accelerated Canvas Rendering          │  │
│  │  - Referee Decision & Fouls Alert Feed                 │  │
│  │  - Playback Controls (Pause / Resume / Slow-Mo 0.5x)   │  │
│  └───────────────────────────▲────────────────────────────┘  │
│                              │ Local In-Memory IPC            │
│  ┌───────────────────────────▼────────────────────────────┐  │
│  │               Local Desktop Backend (Offline)          │  │
│  │  - Offline YOLOv8 Weights (cached locally)             │  │
│  │  - Kinetic Anomaly & Boundary Rule Engine              │  │
│  │  - C++ High-Throughput Video Ingestion (OpenCV)        │  │
│  │  - ZeroMQ PUSH/PULL Inter-Process Transport            │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Benchmarks & Technical Evaluation
Full SWaP-C analysis and edge throughput metrics are documented in **[REPORT.md](REPORT.md)**:
- **Throughput**: ~40.8 FPS on local CPU (sub-25ms inference latency)
- **Multi-Subject Tracking**: ~6.7 simultaneous players tracked per frame
- **Network**: Zero cloud dependency (100% offline edge execution)

---

## 🗺️ Roadmap
See **[ROADMAP.md](ROADMAP.md)** for upcoming features:
- [x] Phase 1: High-Performance C++ Ingestion & Telemetry
- [x] Phase 2: Standalone Offline Desktop Application
- [x] Phase 3: Interactive Web Showcase & GitHub Pages Live Demo
- [x] Phase 4: PyPI & Hugging Face Package Distribution
- [ ] Phase 5: Apple Neural Engine (CoreML) & TensorRT Acceleration
- [ ] Phase 6: Multi-Camera Synchronized 3D Court Re-projection

---

## 📁 Project Structure

```
kinetic-edge/
├── pyproject.toml          # PyPI package configuration
├── kinetic_edge/           # Python CLI package
├── desktop.py              # Standalone offline desktop app entrypoint
├── server.py               # Local FastAPI backend & WebSocket stream
├── huggingface/            # Hugging Face Space Dockerfile & metadata
├── docs/                   # GitHub Pages live demo showcase
├── REPORT.md               # SWaP-C and latency evaluation report
├── ROADMAP.md              # Product & engineering roadmap
├── Makefile                # Build, run, and app orchestration
├── CMakeLists.txt          # C++ build configuration
├── config/
│   └── pipeline.yaml       # Runtime config (resolution, thresholds, models)
├── cpp/
│   ├── CMakeLists.txt
│   ├── include/ingest.h    # C++ frame ingestion header
│   └── src/ingest.cpp      # High-performance OpenCV + ZMQ streamer
├── python/
│   ├── requirements.txt    # Python dependencies
│   ├── inference.py        # YOLOv8 tracking & anomaly analysis
│   ├── tracker.py          # Modular backends & anomaly heuristics
│   ├── ipc_receiver.py     # ZeroMQ frame deserializer
│   └── telemetry.py        # Latency & FPS logging
├── web/
│   ├── index.html          # Dark glassmorphic referee UI
│   ├── style.css           # Design system
│   └── app.js              # WebSocket frame renderer & alert feed
└── data/                   # Video inputs (.gitignore)
```

## 📜 License
MIT License.
