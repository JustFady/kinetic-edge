#!/usr/bin/env python3
"""
Kinetic-Edge Referee Assistant — FastAPI Server

Serves the web UI and manages the video analysis pipeline.
Provides REST endpoints for upload, export, and WebSocket streams for
live annotated frames and referee alerts.
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
import yaml
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles

# Add python/ to path so we can import pipeline modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "python"))

from tracker import create_backend, KineticAnomalyDetector, Detection
from ipc_receiver import ZMQReceiver
from rules import BasketballRulesEngine, RuleViolation

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("kinetic.server")

app = FastAPI(title="Kinetic-Edge Referee Assistant")

@app.get("/health")
async def health():
    return {"status": "ok", "service": "kinetic-edge"}

# Serve static files (CSS, JS)
STATIC_DIR = os.path.join(os.path.dirname(__file__), "web")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# ── Configuration ─────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config", "pipeline.yaml")
INGEST_BIN = None

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

def load_config():
    with open(CONFIG_PATH) as f:
        return yaml.safe_load(f)

# ── Job State ─────────────────────────────────────────────────────────────────
jobs = {}

class Job:
    def __init__(self, job_id: str, video_path: str, total_frames: int):
        self.job_id = job_id
        self.video_path = video_path
        self.total_frames = total_frames
        self.status = "queued"
        self.current_frame = 0
        self.output_path = os.path.join(OUTPUT_DIR, f"{job_id}_annotated.mp4")
        self.feed_clients: list[WebSocket] = []
        self.alert_clients: list[WebSocket] = []
        self.task: Optional[asyncio.Task] = None

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.post("/api/upload")
async def upload_video(video: UploadFile = File(...)):
    """Accept a video upload and start analysis."""
    job_id = str(uuid.uuid4())[:8]
    filename = f"{job_id}_{video.filename}"
    video_path = os.path.join(DATA_DIR, filename)

    # Save uploaded file
    with open(video_path, "wb") as f:
        content = await video.read()
        f.write(content)

    logger.info("Uploaded %s (%d bytes) as job %s", video.filename, len(content), job_id)

    # Get video info
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    job = Job(job_id, video_path, total_frames)
    jobs[job_id] = job

    # Start processing in background
    job.task = asyncio.create_task(run_pipeline(job))

    return {
        "job_id": job_id,
        "filename": video.filename,
        "total_frames": total_frames,
        "fps": fps,
        "resolution": f"{width}x{height}",
    }

@app.get("/api/download/{job_id}")
async def download_annotated(job_id: str):
    """Download or open the annotated referee video."""
    job = jobs.get(job_id)
    if not job or not os.path.exists(job.output_path):
        return {"error": "Annotated clip not found or still processing"}
    return FileResponse(
        job.output_path,
        media_type="video/mp4",
        filename=f"referee_annotated_{job_id}.mp4"
    )

@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        return {"error": "Job not found"}
    return {
        "job_id": job.job_id,
        "status": job.status,
        "current_frame": job.current_frame,
        "total_frames": job.total_frames,
    }

@app.websocket("/ws/feed/{job_id}")
async def ws_feed(websocket: WebSocket, job_id: str):
    """Stream annotated JPEG frames to the desktop UI."""
    await websocket.accept()
    job = jobs.get(job_id)
    if not job:
        await websocket.close(code=4004, reason="Job not found")
        return

    job.feed_clients.append(websocket)
    logger.info("Feed client connected for job %s", job_id)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in job.feed_clients:
            job.feed_clients.remove(websocket)

@app.websocket("/ws/alerts/{job_id}")
async def ws_alerts(websocket: WebSocket, job_id: str):
    """Stream referee alerts to the desktop UI."""
    await websocket.accept()
    job = jobs.get(job_id)
    if not job:
        await websocket.close(code=4004, reason="Job not found")
        return

    job.alert_clients.append(websocket)
    logger.info("Alert client connected for job %s", job_id)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in job.alert_clients:
            job.alert_clients.remove(websocket)

# ── Pipeline Execution ────────────────────────────────────────────────────────

async def broadcast_frame(job: Job, jpeg_bytes: bytes, meta: dict):
    disconnected = []
    for ws in job.feed_clients:
        try:
            await ws.send_text(json.dumps(meta))
            await ws.send_bytes(jpeg_bytes)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        job.feed_clients.remove(ws)

async def broadcast_alert(job: Job, alert: dict):
    disconnected = []
    for ws in job.alert_clients:
        try:
            await ws.send_text(json.dumps(alert))
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        job.alert_clients.remove(ws)

async def run_pipeline(job: Job):
    job.status = "processing"
    logger.info("Starting pipeline for job %s: %s", job.job_id, job.video_path)

    cfg = load_config()
    inf_cfg = cfg.get("inference", {})
    trk_cfg = cfg.get("tracking", {})
    anomaly_cfg = trk_cfg.get("anomaly", {})
    ing_cfg = cfg.get("ingestion", {})
    resolution = ing_cfg.get("resolution", {})
    frame_w = resolution.get("width", 640)
    frame_h = resolution.get("height", 480)

    # Initialize model
    backend = create_backend(inf_cfg.get("backend", "ultralytics"))
    backend.load(
        model_path=inf_cfg.get("model", {}).get("ultralytics", "yolov8n.pt"),
        confidence=inf_cfg.get("confidence", 0.35),
        iou_threshold=inf_cfg.get("iou_threshold", 0.45),
        target_classes=inf_cfg.get("target_classes", [0, 32]),
    )

    court_boundary = tuple(anomaly_cfg.get("court_boundary", [0.05, 0.05, 0.95, 0.95]))
    anomaly_detector = KineticAnomalyDetector(court_boundary=court_boundary)

    # Basketball rules engine
    rules_cfg = cfg.get("rules", {})
    rules_engine = BasketballRulesEngine(court_cfg=anomaly_cfg, rules_cfg=rules_cfg)

    cap = cv2.VideoCapture(job.video_path)
    if not cap.isOpened():
        job.status = "error"
        logger.error("Cannot open video: %s", job.video_path)
        return

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(job.output_path, fourcc, 25.0, (frame_w, frame_h))

    frame_id = 0

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_id += 1
            job.current_frame = frame_id

            resized = cv2.resize(frame, (frame_w, frame_h))

            detections = backend.predict(resized, frame_id)
            timestamp_us = int(time.time() * 1_000_000)
            anomalies = anomaly_detector.update(detections, timestamp_us, frame_w, frame_h)
            rule_violations = rules_engine.update(detections, frame_id, timestamp_us, frame_w, frame_h)

            annotated = annotate_frame(resized, detections, anomalies, court_boundary, frame_w, frame_h,
                                       rule_violations=rule_violations, rules_engine=rules_engine)

            writer.write(annotated)

            _, jpeg = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
            jpeg_bytes = jpeg.tobytes()

            pinfo = rules_engine.possession_info
            meta = {
                "type": "frame_meta",
                "frame_id": frame_id,
                "detections": len(detections),
                "anomalies": len(anomalies),
                "rule_violations": len(rule_violations),
                "possession": pinfo,
            }
            await broadcast_frame(job, jpeg_bytes, meta)

            for a in anomalies:
                alert_msg = {
                    "type": a.get("type", "unknown"),
                    "frame_id": frame_id,
                    "title": format_alert_title(a),
                    "detail": format_alert_detail(a),
                    "severity": map_severity(a.get("type", "")),
                }
                await broadcast_alert(job, alert_msg)

            # Broadcast rule-based violations as alerts too
            for rv in rule_violations:
                alert_msg = {
                    "type": rv.rule,
                    "frame_id": frame_id,
                    "title": rv.title,
                    "detail": rv.detail,
                    "severity": rv.severity,
                }
                await broadcast_alert(job, alert_msg)

            if frame_id % 2 == 0:
                await asyncio.sleep(0)

    except Exception as e:
        logger.error("Pipeline error: %s", e)
        job.status = "error"
    finally:
        cap.release()
        writer.release()

    done_msg = json.dumps({"type": "done"})
    for ws in job.feed_clients:
        try:
            await ws.send_text(done_msg)
        except Exception:
            pass
    for ws in job.alert_clients:
        try:
            await ws.send_text(done_msg)
        except Exception:
            pass

    job.status = "done"
    logger.info("Pipeline complete for job %s: %d frames processed", job.job_id, frame_id)


def annotate_frame(frame, detections, anomalies, court_boundary, frame_w, frame_h,
                   rule_violations=None, rules_engine=None):
    annotated = frame.copy()
    rule_violations = rule_violations or []

    # Court boundary line
    bx0, by0, bx1, by1 = court_boundary
    x0, y0 = int(bx0 * frame_w), int(by0 * frame_h)
    x1, y1 = int(bx1 * frame_w), int(by1 * frame_h)
    cv2.rectangle(annotated, (x0, y0), (x1, y1), (0, 255, 255), 1)

    # Draw paint zones and half-court if rules engine available
    if rules_engine is not None:
        court = rules_engine.court
        for paint in (court.left_paint, court.right_paint):
            px0, py0 = int(paint[0] * frame_w), int(paint[1] * frame_h)
            px1, py1 = int(paint[2] * frame_w), int(paint[3] * frame_h)
            overlay = annotated.copy()
            cv2.rectangle(overlay, (px0, py0), (px1, py1), (180, 100, 255), -1)
            cv2.addWeighted(overlay, 0.15, annotated, 0.85, 0, annotated)
            cv2.rectangle(annotated, (px0, py0), (px1, py1), (180, 100, 255), 1)

        # Half-court line
        hc_x = int(court.half_court_x * frame_w)
        cv2.line(annotated, (hc_x, y0), (hc_x, y1), (200, 200, 200), 1, cv2.LINE_AA)

    # Collect flagged track IDs from both anomalies and rule violations
    anomaly_track_ids = {a.get("track_id") for a in anomalies}
    violation_track_ids = {v.track_id for v in rule_violations}
    flagged_ids = anomaly_track_ids | violation_track_ids

    for det in detections:
        bbox = [int(v) for v in det.bbox]
        is_flagged = det.track_id in flagged_ids

        if is_flagged:
            color = (0, 0, 255)
            thickness = 3
        elif det.class_name == "sports ball":
            color = (0, 165, 255)
            thickness = 2
        else:
            color = (0, 255, 100)
            thickness = 2

        cv2.rectangle(annotated, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, thickness)

        label = f"{det.class_name}"
        if det.track_id >= 0:
            label += f" #{det.track_id}"
        label += f" {det.confidence:.0%}"

        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        cv2.rectangle(annotated, (bbox[0], bbox[1] - th - 8), (bbox[0] + tw + 6, bbox[1]), color, -1)
        cv2.putText(annotated, label, (bbox[0] + 3, bbox[1] - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

    # Possession + shot clock HUD at bottom
    if rules_engine is not None:
        pinfo = rules_engine.possession_info
        if pinfo["possessing_track"] is not None:
            shot_text = f"Possession: #{pinfo['possessing_track']}  Shot Clock: {pinfo['shot_clock_remaining']:.1f}s"
            cv2.rectangle(annotated, (0, frame_h - 28), (frame_w, frame_h), (0, 0, 0), -1)
            cv2.putText(annotated, shot_text, (10, frame_h - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

    # Top banner for violations
    total_alerts = len(anomalies) + len(rule_violations)
    if rule_violations:
        cv2.rectangle(annotated, (0, 0), (frame_w, 32), (0, 0, 180), -1)
        titles = [v.title for v in rule_violations]
        banner = " | ".join(titles[:3])
        if total_alerts > 3:
            banner += f" (+{total_alerts - 3} more)"
        cv2.putText(annotated, banner, (10, 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
    elif anomalies:
        cv2.rectangle(annotated, (0, 0), (frame_w, 32), (0, 0, 180), -1)
        cv2.putText(annotated, f"ALERT: {len(anomalies)} anomal{'y' if len(anomalies)==1 else 'ies'} detected",
                    (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)

    return annotated


def format_alert_title(anomaly):
    titles = {
        "boundary_violation": "⚠️ Out of Bounds",
        "boundary": "⚠️ Out of Bounds",
        "sudden_acceleration": "🚩 Potential Foul",
        "possession_change": "🔄 Possession Change",
    }
    return titles.get(anomaly.get("type", ""), f"ℹ️ {anomaly.get('type', 'Alert')}")


def format_alert_detail(anomaly):
    atype = anomaly.get("type", "")
    if atype in ("boundary_violation", "boundary"):
        cls = anomaly.get("class", "object")
        tid = anomaly.get("track_id", "?")
        return f"{cls} (Track #{tid}) stepped out of bounds"
    elif atype == "sudden_acceleration":
        vel = anomaly.get("velocity_px_s", 0)
        sigma = anomaly.get("sigma", 0)
        return f"Track #{anomaly.get('track_id','?')} — velocity spike {vel:.0f}px/s ({sigma:.1f}σ above average)"
    elif atype == "possession_change":
        return f"Ball possession changed"
    return json.dumps(anomaly)


def map_severity(alert_type):
    mapping = {
        "boundary_violation": "boundary",
        "boundary": "boundary",
        "sudden_acceleration": "foul",
        "possession_change": "possession",
    }
    return mapping.get(alert_type, "info")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False, log_level="info")
