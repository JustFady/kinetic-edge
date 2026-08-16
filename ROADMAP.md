# 🗺️ Project Kinetic-Edge — Product & Technical Roadmap

A structured roadmap for the **Kinetic-Edge Offline AI Referee Assistant & Edge Video Processing Pipeline**.

---

## 📍 Progress & Milestones

```
  [x] Phase 1: High-Performance C++ Ingestion & Telemetry (Completed)
  [x] Phase 2: Offline Standalone Desktop Application (Completed)
  [x] Phase 3: Interactive Web Showcase & GitHub Pages Live Demo (Completed)
  [ ] Phase 4: Hardware Acceleration (Apple Neural Engine / CoreML / TensorRT)
  [ ] Phase 5: Multi-Camera Synchronized 3D Court Re-projection
```

---

## 🚀 Phase Details

### ✅ Phase 1: Ingestion & Evaluation Pipeline
- [x] C++17 OpenCV video ingestion module with zero memory leakage.
- [x] ZeroMQ IPC transport (PUSH/PULL socket topology).
- [x] Modular Python backend support (Ultralytics YOLOv8 & ONNX Runtime).
- [x] Per-frame latency, FPS, and IPC telemetry logging.
- [x] Defense/ISR SWaP-C evaluation brief (`REPORT.md`).

### ✅ Phase 2: Standalone Offline Desktop Application
- [x] Native macOS/Linux desktop app wrapper (`desktop.py` with PyWebView).
- [x] 100% offline execution with pre-cached YOLOv8 weights.
- [x] Dark glassmorphic referee dashboard with drag-and-drop clip loading.
- [x] Referee review controls: Pause, 0.5x Slow-Motion replay, and frame stepping.
- [x] Real-time anomaly detection (out-of-bounds boundary violations, acceleration spikes).

### ✅ Phase 3: Web Distribution & GitHub Pages
- [x] Interactive browser showcase hosted on GitHub Pages (`docs/`).
- [x] Standalone browser replay player with simulated AI referee feeds.
- [x] Direct release binary and docker container download links.
- [x] Automated GitHub Actions container publishing (`ghcr.io/justfady/kinetic-edge`).

### ⏳ Phase 4: Edge Hardware Acceleration
- [ ] **Apple CoreML / Neural Engine (ANE) Export**: Export YOLOv8 to CoreML format for sub-10ms inference on Apple Silicon.
- [ ] **NVIDIA TensorRT Engine (FP16 / INT8)**: Optimize ONNX models for Jetson Orin Nano / RTX embedded edge devices.
- [ ] **Dynamic Anomaly Thresholds**: Self-calibrating camera perspective adjustment for varying arena dimensions.

### ⏳ Phase 5: Multi-Camera & Advanced Rules
- [ ] **3D Court Homography**: Real-time perspective warp mapping player coordinates to a 2D top-down tactical court minimap.
- [ ] **Automated Shot Clock & Lane Violation Tracker**: Tracking 3-second key violations and goaltending.
- [ ] **Multi-Angle Synchronized Replay**: Synchronizing up to 4 camera streams over local ZMQ broadcast.
