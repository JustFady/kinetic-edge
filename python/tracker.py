"""Project Kinetic-Edge — Tracker & Anomaly Detection"""
from collections import defaultdict, deque
from dataclasses import dataclass, field
import math
import numpy as np
import logging

logger = logging.getLogger("kinetic.tracker")

@dataclass
class Detection:
    track_id: int
    class_id: int
    class_name: str
    confidence: float
    bbox: tuple
    center: tuple = field(init=False)
    def __post_init__(self):
        self.center = ((self.bbox[0]+self.bbox[2])/2, (self.bbox[1]+self.bbox[3])/2)

class KineticAnomalyDetector:
    def __init__(self, acceleration_sigma=2.0, velocity_window=15, court_boundary=(0.0,0.0,1.0,1.0)):
        self.accel_sigma = acceleration_sigma
        self.vel_window = velocity_window
        self.court_boundary = court_boundary
        self._history = defaultdict(lambda: deque(maxlen=velocity_window + 1))

    def update(self, detections, timestamp_us, frame_w, frame_h):
        anomalies = []
        for det in detections:
            if det.track_id < 0: continue
            cx, cy = det.center
            self._history[det.track_id].append((cx, cy, timestamp_us))

            nx, ny = cx / frame_w, cy / frame_h
            bx0, by0, bx1, by1 = self.court_boundary
            if nx < bx0 or nx > bx1 or ny < by0 or ny > by1:
                anomalies.append({"type": "boundary", "track_id": det.track_id})
        return anomalies

class ModelBackend:
    def load(self, model_path, confidence, iou_threshold, target_classes): pass
    def predict(self, frame, frame_id): pass

class UltralyticsBackend(ModelBackend):
    def __init__(self):
        self._model = None
        self._conf = 0.35
        self._iou = 0.45
        self._targets = []

    def load(self, model_path, confidence=0.35, iou_threshold=0.45, target_classes=None):
        from ultralytics import YOLO
        self._model = YOLO(model_path)
        self._conf = confidence
        self._iou = iou_threshold
        self._targets = target_classes or []

    def predict(self, frame, frame_id):
        results = self._model.track(frame, persist=True, conf=self._conf, iou=self._iou, classes=self._targets, verbose=False, tracker="bytetrack.yaml")
        detections = []
        if results and results[0].boxes is not None:
            for box in results[0].boxes:
                tid = int(box.id[0]) if box.id is not None else -1
                cid = int(box.cls[0])
                cname = self._model.names.get(cid, str(cid))
                detections.append(Detection(tid, cid, cname, float(box.conf[0]), tuple(box.xyxy[0].tolist())))
        return detections

def create_backend(backend_name):
    if backend_name == "ultralytics": return UltralyticsBackend()
    raise ValueError("Unknown backend")
