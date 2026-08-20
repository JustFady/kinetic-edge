#!/usr/bin/env python3
"""Project Kinetic-Edge — Inference Entry Point with Live GUI and Video Saving"""
import argparse
import logging
import signal
import sys
import os
import yaml
import cv2

# Ensure module and project root paths are in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
for p in (SCRIPT_DIR, PROJECT_ROOT):
    if p not in sys.path:
        sys.path.insert(0, p)

from ipc_receiver import ZMQReceiver
from tracker import create_backend, KineticAnomalyDetector
from telemetry import TelemetryLogger
from rules import BasketballRulesEngine

running = True
def signal_handler(sig, frame):
    global running
    running = False

def load_config(path):
    with open(path) as f:
        return yaml.safe_load(f)

def main():
    global running
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config/pipeline.yaml")
    parser.add_argument("--show", action="store_true", default=True, help="Show live OpenCV window")
    parser.add_argument("--no-show", action="store_false", dest="show", help="Do not show live OpenCV window")
    parser.add_argument("--save", action="store_true", default=True, help="Save annotated video to output/annotated.mp4")
    parser.add_argument("--no-save", action="store_false", dest="save", help="Do not save annotated video")
    args = parser.parse_args()
    
    cfg = load_config(args.config)
    inf_cfg = cfg.get("inference", {})
    ipc_cfg = cfg.get("ipc", {}).get("zmq", {})
    ing_cfg = cfg.get("ingestion", {})
    trk_cfg = cfg.get("tracking", {})
    anomaly_cfg = trk_cfg.get("anomaly", {})
    
    resolution = ing_cfg.get("resolution", {})
    frame_w = resolution.get("width", 640)
    frame_h = resolution.get("height", 480)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    receiver = ZMQReceiver(endpoint=ipc_cfg.get("endpoint", "tcp://127.0.0.1:5555"))
    backend = create_backend(inf_cfg.get("backend", "ultralytics"))
    
    # Load backend passing configurations from config/pipeline.yaml
    backend.load(
        model_path=inf_cfg.get("model", {}).get("ultralytics", "yolov8n.pt"),
        confidence=inf_cfg.get("confidence", 0.35),
        iou_threshold=inf_cfg.get("iou_threshold", 0.45),
        target_classes=inf_cfg.get("target_classes", [0, 32])
    )
    
    # Boundary box
    court_boundary = tuple(anomaly_cfg.get("court_boundary", [0.05, 0.05, 0.95, 0.95]))
    anomaly = KineticAnomalyDetector(court_boundary=court_boundary)
    telemetry = TelemetryLogger()

    # Basketball rules engine
    rules_cfg = cfg.get("rules", {})
    rules_engine = BasketballRulesEngine(court_cfg=anomaly_cfg, rules_cfg=rules_cfg)
    
    receiver.start()
    telemetry.start()
    
    # Video Writer
    video_writer = None
    if args.save:
        os.makedirs("output", exist_ok=True)
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        video_writer = cv2.VideoWriter("output/annotated.mp4", fourcc, 25.0, (frame_w, frame_h))
        print("INFO: Saving output video to output/annotated.mp4")

    print("INFO: Processing frames. Press Ctrl+C or 'q' in GUI to stop.")
    
    gui_failed = False
    timeout_count = 0
    max_timeouts = 3 # 3 consecutive timeouts (15 seconds total) means sender is done
    
    while running:
        header, frame = receiver.receive()
        if header is None:
            timeout_count += 1
            if timeout_count >= max_timeouts:
                print("INFO: Timeout waiting for frames. Exiting.")
                break
            continue
            
        timeout_count = 0
        if header == "END":
            break
        
        metrics = telemetry.record_receive(header.frame_id, header.timestamp_us)
        detections = backend.predict(frame, header.frame_id)
        anomalies = anomaly.update(detections, header.timestamp_us, frame_w, frame_h)
        rule_violations = rules_engine.update(detections, header.frame_id, header.timestamp_us, frame_w, frame_h)
        
        # Draw on frame
        annotated_frame = frame.copy()
        
        # Draw court boundary
        bx0, by0, bx1, by1 = court_boundary
        x0, y0 = int(bx0 * frame_w), int(by0 * frame_h)
        x1, y1 = int(bx1 * frame_w), int(by1 * frame_h)
        cv2.rectangle(annotated_frame, (x0, y0), (x1, y1), (255, 255, 0), 2)
        cv2.putText(annotated_frame, "Court Boundary", (x0 + 10, y0 + 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)

        # Draw paint zones
        court = rules_engine.court
        for paint in (court.left_paint, court.right_paint):
            px0, py0 = int(paint[0] * frame_w), int(paint[1] * frame_h)
            px1, py1 = int(paint[2] * frame_w), int(paint[3] * frame_h)
            overlay = annotated_frame.copy()
            cv2.rectangle(overlay, (px0, py0), (px1, py1), (180, 100, 255), -1)
            cv2.addWeighted(overlay, 0.15, annotated_frame, 0.85, 0, annotated_frame)
            cv2.rectangle(annotated_frame, (px0, py0), (px1, py1), (180, 100, 255), 1)

        # Draw half-court line
        hc_x = int(court.half_court_x * frame_w)
        cv2.line(annotated_frame, (hc_x, y0), (hc_x, y1), (200, 200, 200), 1, cv2.LINE_AA)

        # Collect track IDs involved in any violation for color coding
        violation_track_ids = {v.track_id for v in rule_violations}
        anomaly_track_ids = {a.get("track_id") for a in anomalies}
        flagged_ids = violation_track_ids | anomaly_track_ids

        # Draw detections
        for det in detections:
            bbox = [int(v) for v in det.bbox]
            is_flagged = det.track_id in flagged_ids
            
            if det.class_name == "sports ball":
                color = (0, 165, 255)  # orange for ball
            elif is_flagged:
                color = (0, 0, 255)    # red for flagged players
            else:
                color = (0, 255, 100)  # green for normal players
            
            cv2.rectangle(annotated_frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 2)
            label = f"{det.class_name} #{det.track_id} ({det.confidence:.2f})"
            cv2.putText(annotated_frame, label, (bbox[0], bbox[1] - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        # Draw possession + shot clock HUD
        pinfo = rules_engine.possession_info
        if pinfo["possessing_track"] is not None:
            shot_text = f"Possession: #{pinfo['possessing_track']}  Shot Clock: {pinfo['shot_clock_remaining']:.1f}s"
            cv2.putText(annotated_frame, shot_text, (10, frame_h - 15),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

        # Draw rule violations banner
        if rule_violations:
            # Red banner at top
            cv2.rectangle(annotated_frame, (0, 0), (frame_w, 28), (0, 0, 180), -1)
            titles = [v.title for v in rule_violations]
            banner = " | ".join(titles[:3])
            cv2.putText(annotated_frame, banner, (10, 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
        elif anomalies:
            cv2.putText(annotated_frame, "ANOMALY DETECTED!", (20, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        
        # Save to video file
        if video_writer is not None:
            video_writer.write(annotated_frame)
            
        # Show live GUI
        if args.show and not gui_failed:
            try:
                cv2.imshow("Kinetic Edge Live Processing", annotated_frame)
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q"):
                    running = False
            except Exception as e:
                print(f"WARNING: Failed to show GUI window: {e}. Running in headless mode.")
                gui_failed = True
                
        telemetry.record_inference(metrics, len(detections), len(anomalies) + len(rule_violations))
        
    if video_writer is not None:
        video_writer.release()
        print("INFO: Video release completed.")
        
    if args.show and not gui_failed:
        cv2.destroyAllWindows()
        
    telemetry.stop()
    receiver.stop()

if __name__ == "__main__":
    main()
