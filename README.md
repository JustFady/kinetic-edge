# Project Kinetic-Edge — Basketball Referee Assistant

**Kinetic-Edge** is an ultra-low-latency, 100% offline AI video processing pipeline and standalone desktop assistant designed to track players, basketballs, and assist referee decision-making (out-of-bounds, fouls, and rapid kinetic anomalies).

![Kinetic-Edge Architecture](https://img.shields.io/badge/Architecture-C%2B%2B%20%2B%20Python%20%2B%20ZMQ-blue)
![Offline Ready](https://img.shields.io/badge/Offline-100%25%20Local-green)
![AI Model](https://img.shields.io/badge/Model-YOLOv8%20%2B%20ByteTrack-orange)

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
│  │  - Playback Controls (Pause / Resume / Slow-Mo)        │  │
│  └───────────────────────────▲────────────────────────────┘  │
│                              │ Local In-Memory WebSocket      │
│  ┌───────────────────────────▼────────────────────────────┐  │
│  │               Local Desktop Backend (Offline)          │  │
│  │  - Offline YOLOv8 Weights (cached locally)             │  │
│  │  - Kinetic Anomaly & Boundary Rule Engine              │  │
│  │  - C++ High-Throughput Video Ingestion                 │  │
│  │  - ZeroMQ IPC Transport                                │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## ⚡ Quick Start

### 1. Launch Offline Desktop App (Recommended)
```bash
make app
```
*(Or directly run `.venv/bin/python3 desktop.py`)*

### 2. Launch Local Web Interface
```bash
make web
```
Open `http://localhost:8000` in your browser.

### 3. Run CLI Pipeline with C++ Ingestion
```bash
make run VIDEO=data/nba_gameplay.mp4
```

---

## 📁 Project Structure

```
kinetic-edge/
├── desktop.py              # Standalone offline desktop app entrypoint
├── server.py               # Local FastAPI backend & WebSocket stream
├── REPORT.md               # SWaP-C and latency evaluation report
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

---

## 📊 Evaluation Report
See [REPORT.md](REPORT.md) for detailed latency benchmarks, SWaP-C analysis, and deployment recommendations.
