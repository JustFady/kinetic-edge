#!/usr/bin/env python3
"""Project Kinetic-Edge — Inference Entry Point"""
import argparse, logging, signal, yaml
from ipc_receiver import ZMQReceiver
from tracker import create_backend, KineticAnomalyDetector
from telemetry import TelemetryLogger

running = True
def signal_handler(sig, frame): global running; running = False

def load_config(path):
    with open(path) as f: return yaml.safe_load(f)

def main():
    global running
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config/pipeline.yaml")
    args = parser.parse_args()
    
    cfg = load_config(args.config)
    inf_cfg = cfg.get("inference", {})
    ipc_cfg = cfg.get("ipc", {}).get("zmq", {})
    ing_cfg = cfg.get("ingestion", {})
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    receiver = ZMQReceiver(endpoint=ipc_cfg.get("endpoint", "tcp://127.0.0.1:5555"))
    backend = create_backend(inf_cfg.get("backend", "ultralytics"))
    backend.load(inf_cfg.get("model", {}).get("ultralytics", "yolov8n.pt"))
    anomaly = KineticAnomalyDetector()
    telemetry = TelemetryLogger()
    
    receiver.start()
    telemetry.start()
    
    while running:
        header, frame = receiver.receive()
        if header is None: continue
        if header == "END": break
        
        metrics = telemetry.record_receive(header.frame_id, header.timestamp_us)
        detections = backend.predict(frame, header.frame_id)
        anomalies = anomaly.update(detections, header.timestamp_us, 640, 480)
        telemetry.record_inference(metrics, len(detections), len(anomalies))
        
    telemetry.stop()
    receiver.stop()

if __name__ == "__main__": main()
