# Kinetic-Edge — Project Progress Log

This document tracks the development history of Kinetic-Edge from day one. It covers what was built, when, what broke, what got fixed, and where things are headed. Updated as work continues.

---

## Day 1 — August 16, 2026

### Initial Build (morning)

Started the project from a detailed spec: build an offline, edge-first video AI pipeline that could track basketball players and the ball in real time using YOLOv8 + ByteTrack, with a C++ video ingestion layer connected to a Python inference backend over ZeroMQ.

**What was built:**
- Full project scaffolding — CMakeLists, Makefile, Dockerfile, pipeline.yaml config, shell scripts
- C++ video ingestion module (`cpp/src/ingest.cpp`) that reads .mp4 files, resizes frames, and pushes them over ZMQ
- Python inference pipeline (`python/inference.py`) with YOLOv8 model loading, ByteTrack-based object tracking, and a custom anomaly detector (`python/tracker.py`)
- ZMQ IPC receiver (`python/ipc_receiver.py`) for deserializing raw frame data from the C++ side
- Telemetry logger (`python/telemetry.py`) that writes per-frame latency stats to `output/telemetry.jsonl`
- Pushed everything to GitHub at `github.com/JustFady/kinetic-edge`

**Challenges:**
- OpenCV 5 compatibility — the initial build assumed OpenCV 4 APIs. Had to patch header includes and `VideoCapture` usage for cv2 5.x.
- The first sample video (`data/sample.mp4`) had nothing to do with basketball. It was a generic test clip, which made the whole thing feel disconnected from its purpose.
- `yt-dlp` failed in the environment due to missing system runtimes, so downloading real NBA footage programmatically didn't work on the first attempt. Switched to using stable direct URLs.

### Web UI + Desktop App (midday)

The terminal-only output wasn't enough to demo this thing properly. Built two interfaces on top of the existing pipeline:

- **Web referee assistant** (`server.py` + `web/`) — a FastAPI server with WebSocket streams for live annotated frames and real-time referee alerts, styled with a dark theme and glassmorphism
- **Standalone desktop app** (`desktop.py`) — uses `pywebview` to wrap the web UI in a native macOS window, fully offline, no browser needed

Also added `REPORT.md` with evaluation results from running the pipeline on sample footage.

### Distribution + Packaging (afternoon)

The goal shifted to making this accessible to other people, not just a local project:

- **GitHub Pages** — deployed an interactive browser-based demo at `justfady.github.io/kinetic-edge/` using the `docs/` folder (static HTML/CSS/JS with a simulated canvas-based referee visualization)
- **GitHub Actions** — added `.github/workflows/publish-package.yml` for automatic Docker container publishing to `ghcr.io`
- **GitHub Release** — created official v1.0.0 release with download links
- **PyPI packaging** — created `pyproject.toml`, `kinetic_edge/__init__.py`, and `kinetic_edge/cli.py` so the project installs via `pip install kinetic-edge` with a `kinetic-edge` CLI entry point
- **Hugging Face Space** — initially tried deploying as a Docker space, but the free tier requires a Pro subscription for Docker SDK spaces. Fell back to a static space hosting the interactive web showcase instead.

**Challenges:**
- PyPI upload via `twine` blocked on API token auth. Required manual token generation at pypi.org and using `__token__` as the username.
- Hugging Face Docker spaces returned a 402 Payment Required error on the free plan. The workaround was deploying as a static space, which worked fine for the showcase but means the actual inference pipeline doesn't run server-side on HF.

### README Cleanup

Stripped out all the emojis and the roadmap section. Made the tone more natural and direct — clear about what the project does without looking like a marketing page.

---

## Day 2 — August 17, 2026

### Hugging Face Deployment

Completed the Hugging Face Space setup:
- Created the space at `huggingface.co/spaces/JustFady/kinetic-edge`
- Uploaded the static web showcase (index.html, style.css, app.js)
- Authenticated the local environment with the HF write token
- Updated `README.md` with links to the HF Space and PyPI package, pushed to GitHub

---

## Day 3 — August 18, 2026

### Bug Fixes

Ran into import resolution issues — `inference.py` and `cli.py` would fail to find sibling modules (`ipc_receiver`, `tracker`, `telemetry`) depending on where you launched them from (project root vs. inside `python/` vs. via the `kinetic-edge` CLI).

**Fix:** Added explicit `sys.path` resolution at the top of both `inference.py` and `cli.py` so they always resolve the `python/` directory and project root regardless of working directory. Verified all modules import cleanly and the YOLOv8 backend loads without errors.

---

## Day 4 — August 19, 2026

### Basketball Rules Engine

The anomaly detector up to this point was extremely generic — it could tell you if something left a bounding box or moved fast, but it had zero understanding of basketball as a sport. This was the biggest gap in the project.

**Built `python/rules.py`** — a stateful `BasketballRulesEngine` class that processes detections every frame and flags actual basketball rule violations:

| Rule | What it detects |
|---|---|
| Possession Tracking | Which player has the ball (nearest to ball center within threshold) |
| Shot Clock (24s) | Time since last possession change exceeded 24 seconds |
| 3-Second Paint Rule | Player standing in the paint zone longer than 3 seconds |
| Backcourt Violation | Ball crossing half-court in the wrong direction during possession |
| Contact / Foul | Two player bounding boxes overlapping significantly (IoU > 30%) |
| Ball Out of Bounds | Ball detected outside the court boundary |

**Integration:**
- Wired the rules engine into both `inference.py` (CLI pipeline) and `server.py` (web/desktop pipeline)
- Added visual overlays: semi-transparent purple paint zones, half-court line, possession + shot clock HUD at the bottom of the frame, and a red violation banner at the top
- Added a `rules:` config section to `pipeline.yaml` so all thresholds (shot clock duration, paint limit, foul overlap ratio, possession distance, debounce frames, court zone coordinates) are tunable without touching code
- Violations from the rules engine are broadcast over WebSocket alongside the existing anomaly alerts

**Tested:** Ran a synthetic integration test — a player detection placed inside the paint zone for 4 simulated seconds correctly triggered a 3-Second Violation. Possession tracking correctly assigned the ball to the nearest player.

---

## Challenges & Errors (Running List)

| Date | Issue | Status |
|---|---|---|
| Aug 16 | OpenCV 5 API incompatibility with initial code | Fixed |
| Aug 16 | Sample video unrelated to basketball | Replaced with NBA clips |
| Aug 16 | `yt-dlp` failed due to missing system runtimes | Worked around with direct URLs |
| Aug 16 | Hugging Face Docker space requires Pro subscription | Deployed as static space instead |
| Aug 16 | PyPI `twine` upload blocked on auth | Resolved with API token |
| Aug 18 | Module import failures depending on launch directory | Fixed with explicit sys.path resolution |

---

## Architecture Overview

```
[Video File / Live Feed]
         |
   C++ Ingestion (ingest.cpp)
   - Reads frames, resizes, pushes over ZMQ
         |
      ZeroMQ IPC
         |
   Python Inference (inference.py)
   - YOLOv8 detection + ByteTrack tracking
   - KineticAnomalyDetector (generic)
   - BasketballRulesEngine (game-aware)
   - Telemetry logging
         |
   +-----+------+
   |             |
Desktop App   Web Server
(pywebview)   (FastAPI + WebSocket)
   |             |
Native Window  Browser UI
```

---

## Future Plans & Ideas

These are things that would meaningfully improve the project but haven't been started yet:

- **Pose estimation integration** — Adding a lightweight pose model (MoveNet or MediaPipe Pose) would enable detecting travels (player moving without dribbling), carrying violations, and more accurate foul classification based on body contact rather than just bounding box overlap.

- **Team classification** — Right now every player is just "person." Using jersey color clustering (k-means on the dominant color inside each player bounding box) would let the engine distinguish Team A from Team B, which is necessary for rules like backcourt to work properly (you need to know which team has possession to know which direction is "forward").

- **Court homography** — Mapping the camera perspective to a top-down court view using corner detection or manual calibration. This would make the paint zones and boundary detection much more accurate, especially for angled or broadcast camera angles where the current normalized-coordinate approach is an approximation.

- **Real-time audio cues** — Playing a whistle sound or alert tone when a violation is detected, so a referee using the app doesn't have to watch the screen constantly.

- **Multi-camera support** — Stitching feeds from multiple camera angles to reduce occlusion and improve tracking continuity.

- **Game state machine** — Tracking whether the game is in play, in a dead ball situation, during a free throw, etc. Many rules only apply during live play, and the engine currently has no concept of game state.

- **Export referee report** — At the end of a game or clip, generate a structured PDF or JSON report summarizing all violations detected, with timestamps and frame captures.

- **Model fine-tuning** — Fine-tuning YOLOv8 on a basketball-specific dataset (players, ball, hoop, backboard, court lines) rather than relying on generic COCO classes would significantly improve detection accuracy and reduce false positives.

- **Mobile companion app** — A lightweight iOS/Android app that connects to the desktop server over local WiFi for courtside use.

- **Hugging Face Docker deployment** — Revisit once a Pro plan or free Docker tier becomes available, to run the actual inference pipeline server-side for users without local GPU/CPU resources.
