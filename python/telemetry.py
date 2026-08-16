"""Project Kinetic-Edge — Telemetry & Latency Logger"""
import json
import time
import logging
import os
from collections import deque
from dataclasses import dataclass, asdict

logger = logging.getLogger("kinetic.telemetry")

@dataclass
class FrameMetrics:
    frame_id: int
    ingest_timestamp_us: int
    receive_timestamp_us: int
    inference_timestamp_us: int = 0
    ipc_latency_ms: float = 0.0
    inference_latency_ms: float = 0.0
    e2e_latency_ms: float = 0.0
    detections: int = 0
    anomalies: int = 0

class TelemetryLogger:
    def __init__(self, output_path="output/telemetry.jsonl"):
        self.output_path = output_path
        self._records = []
        self._file = None
        self._start_time = None

    def start(self):
        os.makedirs(os.path.dirname(self.output_path) or ".", exist_ok=True)
        self._file = open(self.output_path, "w")
        self._start_time = time.time()

    def record_receive(self, frame_id, ingest_ts_us):
        now = int(time.time() * 1_000_000)
        return FrameMetrics(
            frame_id=frame_id, ingest_timestamp_us=ingest_ts_us,
            receive_timestamp_us=now, ipc_latency_ms=(now - ingest_ts_us) / 1000.0
        )

    def record_inference(self, metrics, detections=0, anomalies=0):
        now = int(time.time() * 1_000_000)
        metrics.inference_timestamp_us = now
        metrics.inference_latency_ms = (now - metrics.receive_timestamp_us) / 1000.0
        metrics.e2e_latency_ms = (now - metrics.ingest_timestamp_us) / 1000.0
        metrics.detections = detections
        metrics.anomalies = anomalies

        self._records.append(metrics)
        if self._file:
            self._file.write(json.dumps(asdict(metrics)) + "\n")
            self._file.flush()

        print(f"  [inference] frame {metrics.frame_id:>6d} | E2E {metrics.e2e_latency_ms:>7.1f}ms")

    def stop(self):
        if self._file:
            self._file.close()
            self._file = None
