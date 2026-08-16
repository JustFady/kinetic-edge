# ══════════════════════════════════════════════════════════════════════════════
# PROJECT KINETIC-EDGE — EVALUATION BRIEF
# Classification: UNCLASSIFIED // FOR OFFICIAL USE ONLY
# ══════════════════════════════════════════════════════════════════════════════

## 1. Executive Summary

| Field               | Value                                    |
|---------------------|------------------------------------------|
| **Program**         | Kinetic-Edge                             |
| **Evaluation Date** | 2026-08-16                               |
| **Lead Engineer**   | JustFady                                 |
| **Objective**       | Evaluate local AI inference models for ultra-low-latency video tracking of fast-moving subjects (basketball players / ISR targets) |
| **Platform**        | Apple Silicon (macOS) / Ubuntu Linux (Docker) |
| **Classification**  | UNCLASSIFIED                             |

### Key Findings
> YOLOv8n achieved real-time inference (~22ms per frame, >40 FPS) on local CPU hardware across full-court 5v5 basketball gameplay. The hybrid C++ ingestion and Python inference architecture demonstrated high-throughput video ingestion without frame drops under matched queue capacities. Kinetic anomaly detection flagged out-of-bounds boundary crossings and high-acceleration events with zero external network connectivity.

---

## 2. Methodology

### 2.1 Test Configuration

| Parameter             | Value                                     |
|-----------------------|-------------------------------------------|
| Video Source          | 5v5 Full-court Basketball Gameplay Clip   |
| Normalized Resolution | 640×480                                   |
| IPC Mechanism         | ZeroMQ PUSH/PULL (tcp://127.0.0.1:5555)   |
| Frame Skip            | 1 (every frame processed)                 |
| Confidence Threshold  | 0.30                                      |
| NMS IoU Threshold     | 0.45                                      |
| Target Classes        | Person (COCO 0), Sports Ball (COCO 32)    |

### 2.2 Models Evaluated

| Model         | Backend       | Parameters | Model Size | Notes               |
|---------------|---------------|------------|------------|---------------------|
| YOLOv8n       | Ultralytics   | 3.2M       | 6.2 MB     | Nano variant (Fast) |
| YOLOv8n       | ONNX Runtime  | 3.2M       | 12.4 MB    | Exported ONNX       |
| YOLOv8s       | Ultralytics   | 11.2M      | 22.5 MB    | Small variant       |

### 2.3 Hardware Configuration

| Component     | Specification                            |
|---------------|------------------------------------------|
| CPU           | Apple Silicon ARM64 / Multi-core x86     |
| RAM           | 16 GB Unified Memory                     |
| OS            | macOS / Ubuntu 22.04                     |
| Network       | 100% Offline (Local execution)           |

---

## 3. Benchmark Results

### 3.1 Latency & Throughput

| Model    | Backend     | Inference Latency (p50) | Throughput | Tracked Subjects (Avg) |
|----------|-------------|-------------------------|------------|------------------------|
| YOLOv8n  | Ultralytics | 22.8 ms                 | 40.8 FPS   | 6.7 players/frame      |
| YOLOv8n  | ONNX        | 18.5 ms                 | 48.2 FPS   | 6.4 players/frame      |

### 3.2 Anomaly & Referee Heuristics

| Metric                  | Value                  |
|-------------------------|------------------------|
| Total Frames Evaluated  | 214 frames             |
| Total Player Trackings  | 1,433 detections       |
| Out-of-Bounds Warnings  | Detected on perimeter  |
| Sudden Acceleration     | Tracked velocity spike |

---

## 4. SWaP-C Analysis (Size, Weight, Power, and Cost)

| Factor     | YOLOv8n (Ultralytics) | YOLOv8n (ONNX) | YOLOv8s (Ultralytics) |
|------------|-----------------------|----------------|-----------------------|
| Model Size | 6.2 MB                | 12.4 MB        | 22.5 MB               |
| RAM Usage  | ~450 MB               | ~380 MB        | ~820 MB               |
| Inference  | ~22 ms                | ~18 ms         | ~54 ms                |
| Suitability| Edge / Standalone App | High-Speed Edge| Server Analysis       |

---

## 5. Integration Recommendations

1. **Edge Deployment**: For constrained edge nodes or offline referee devices, YOLOv8n with ONNX Runtime provides optimal latency-to-power efficiency.
2. **Desktop / Offline Application**: The PyWebView-powered standalone desktop app enables seamless offline execution with zero cloud dependency.
3. **Multi-Camera Expansion**: ZeroMQ IPC framing allows drop-in distribution across multiple camera streams.
