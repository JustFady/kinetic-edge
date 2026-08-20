# Kinetic-Edge Development Progress Log

A continuous record of technical implementations, architecture decisions, bug fixes, and milestones.

---

## Timeline

### Phase 1: Pipeline Core & Architecture
- Built C++ video ingestion engine (`cpp/src/ingest.cpp`) with OpenCV VideoCapture and ZeroMQ PUSH socket.
- Built Python inference engine (`python/inference.py`) with YOLOv8 detection, ByteTrack tracking, and telemetry logging (`python/telemetry.py`).
- Configured IPC message passing with binary struct headers (`<QIIIi`) for frame synchronization.
- Resolved OpenCV 5 API differences and patched include paths.

### Phase 2: Desktop & Web Interfaces
- Implemented `desktop.py` wrapping the local UI via PyWebView for offline execution without an external browser.
- Created FastAPI backend (`server.py`) supporting asynchronous video job dispatch and WebSocket streaming for both JPEG frames and referee alert payloads.
- Added playback controls (pause, slow-motion 0.5x, frame step) and real-time alert filters.

### Phase 3: Packaging & Distribution
- Configured Python package distribution in `pyproject.toml` with `kinetic-edge` CLI entrypoint (`kinetic_edge/cli.py`).
- Published package to PyPI and configured Hugging Face Space for live project visibility.
- Set up GitHub Actions workflow (`publish-package.yml`) for container deployment.

### Phase 4: Basketball Rules Engine
- Implemented `python/rules.py` with `BasketballRulesEngine` to classify real basketball game violations:
  - Ball possession assignment via Euclidean distance tracking.
  - 24-second shot clock countdown with automated possession change resets.
  - 3-second offensive key/paint occupancy timer.
  - Backcourt violation detection across half-court plane.
  - Player contact / charging heuristic based on bounding box IoU and velocity changes.
  - Court boundary enforcement.
- Integrated rules engine into both the CLI pipeline and web/desktop server with HUD overlays and WebSocket broadcasts.

### Phase 5: Web Demonstration Rebuild & DevOps
- Rebuilt the web demo (`docs/` and `web/`) from a simulated 2D wireframe into a full computer vision showcase:
  - Synchronized HTML5 video playback of real basketball match clips (`sample.mp4` and `gameplay.mp4`).
  - Overlay canvas rendering dynamic bounding boxes, player roles, speed vectors, paint zone overlays, and glowing ball trajectories.
  - 2D Court Radar (minimap) rendering tactical top-down positions.
  - Interactive decision feed with frame seek buttons.
  - Custom clip upload mode with client-side motion tracking and court safety boundary visualization.
  - Telemetry log export in `.jsonl` format.
- Dockerized the pipeline with a multi-stage `Dockerfile` (`cli` and `web` targets), `docker-compose.yml`, `.dockerignore`, and a `/health` endpoint.
- Cleaned documentation across the repository (`README.md`, `REPORT.md`, `ROADMAP.md`) to remove artificial formatting and maintain a clear, natural engineering voice.

---

## Issue Resolution History

| Issue | Root Cause | Solution |
| --- | --- | --- |
| OpenCV 5 incompatibility | API naming changes in VideoCapture flags | Updated headers and accessors for OpenCV 5 compatibility |
| Module import resolution | Working directory variance during CLI invocation | Added explicit sys.path resolution in inference.py and cli.py |
| Hugging Face space tier | Docker space requires paid tier | Deployed static showcase space for public demo access |
| Wireframe demo appearance | Initial demo lacked actual video integration | Rebuilt demo around real video feeds with canvas overlay tracking and file upload |
| Docker web startup | Missing web server dependencies in container | Multi-staged runtime container with uvicorn, fastapi, and health checks |

---

## Planned Work

- [ ] CoreML export for Apple Silicon Neural Engine acceleration.
- [ ] TensorRT compilation for NVIDIA Jetson platforms.
- [ ] Automated court perspective homography calibration.
- [ ] Jersey color k-means clustering for automated team assignment.
- [ ] PDF match summary report generation.
