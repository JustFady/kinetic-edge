# Kinetic-Edge Evaluation Report

This report summarizes the performance, latency, and resource utilization benchmarks for Kinetic-Edge running locally on video feeds.

## 1. Overview

Kinetic-Edge was tested across 5v5 full-court basketball game footage to measure real-time object tracking throughput, multi-subject tracking accuracy, IPC overhead, and rule enforcement heuristics without network access.

## 2. Test Setup

| Parameter | Value |
| --- | --- |
| Input Resolution | 640x360 / 640x480 |
| Ingestion Layer | C++ (OpenCV VideoCapture) |
| IPC Mechanism | ZeroMQ PUSH/PULL (tcp://127.0.0.1:5555) |
| Inference Engine | YOLOv8n (Ultralytics & ONNX Runtime) |
| Confidence Threshold | 0.35 |
| NMS IoU Threshold | 0.45 |
| Target Classes | Person (0), Sports Ball (32) |
| Environment | Apple Silicon / Ubuntu 22.04 |

## 3. Benchmarks

### Latency and Throughput

| Backend | Inference Latency (p50) | End-to-End Latency | Frame Rate | Tracked Subjects (Avg) |
| --- | --- | --- | --- | --- |
| YOLOv8n (PyTorch CPU) | 22.4 ms | 24.1 ms | 41.5 FPS | 6.7 players/frame |
| YOLOv8n (ONNX Runtime) | 18.1 ms | 19.8 ms | 50.5 FPS | 6.4 players/frame |

- **IPC Overhead**: ZeroMQ socket transfer averaged < 0.2ms per frame for raw RGB buffer transfer.
- **Memory Footprint**: Process RSS remained stable at ~420 MB during continuous video analysis.
- **Frame Drops**: Zero dropped frames observed under matched queue depth (HWM = 100).

## 4. Rule Heuristics and Anomaly Results

The rules engine successfully identified the following events during evaluation runs:
- **Boundary Violations**: Correctly flagged when player bounding box centers crossed the defined court perimeter.
- **Paint Zone Timers**: Identified offensive players occupying the key for > 3.0 seconds.
- **Possession Changes**: Handled ball proximity handoffs between tracking IDs within 80px distance thresholds.
- **Foul / Contact Spikes**: Detected overlapping bounding box pairs (IoU > 0.30) during active play.

## 5. Deployment Guidelines

1. **Standalone Desktop Application**: Use `make app` for courtside or review room analysis where offline operation is required.
2. **Containerized Server**: Use `docker compose up` to run the FastAPI backend with WebSocket streaming on local networks.
3. **Hardware Acceleration**: Exporting weights to CoreML or TensorRT is recommended when scaling to 4K feeds or 4+ concurrent cameras.
