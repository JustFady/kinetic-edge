# Kinetic-Edge Roadmap

Technical milestones and planned enhancements for the Kinetic-Edge project.

## Current Milestones

### Phase 1: Core Pipeline & Ingestion (Completed)
- C++ video ingestion layer with OpenCV.
- ZeroMQ IPC message framing for low-latency frame passing.
- YOLOv8 object detection with ByteTrack multi-object tracking.
- Per-frame latency, FPS, and telemetry recording to JSON lines.

### Phase 2: Offline Desktop Application (Completed)
- Native desktop interface via PyWebView and FastAPI.
- Complete offline capability with cached local weights.
- Playback controls: pause, resume, 0.5x slow-motion, and frame stepping.
- Integrated basketball rules engine (possession, 24s shot clock, 3s key rule, contact heuristic).

### Phase 3: Web Showcase & Distribution (Completed)
- Browser-based interactive demonstration with real video playback.
- Custom clip upload and client-side motion tracking preview.
- Multi-stage Docker containerization and Docker Compose setup.
- Package published on PyPI and Hugging Face Spaces.

## Upcoming Milestones

### Phase 4: Edge Acceleration & Hardware Optimization
- CoreML export for hardware-accelerated Apple Neural Engine (ANE) inference.
- TensorRT FP16/INT8 compilation for NVIDIA Jetson and RTX edge hardware.
- Dynamic court calibration using automated corner and key line detection.

### Phase 5: Multi-Camera & Advanced Rules
- Camera homography to project 3D broadcast angles into a 2D court plane.
- Team classification via jersey color histogram clustering.
- Pose estimation integration for travel and carry violation detection.
- Automated match summary and referee infraction reports in PDF format.
