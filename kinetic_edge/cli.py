#!/usr/bin/env python3
"""
Kinetic-Edge CLI — Universal Command Line Interface

Usage:
  kinetic-edge app                  Launch standalone offline desktop app window
  kinetic-edge web [--port 8000]    Launch local web server UI
  kinetic-edge run --video <path>   Run CLI inference pipeline on a video clip
"""

import argparse
import os
import sys
import subprocess

def main():
    parser = argparse.ArgumentParser(
        prog="kinetic-edge",
        description="⚡ Kinetic-Edge — Offline AI Basketball Referee Assistant"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Subcommand: app (default)
    app_parser = subparsers.add_parser("app", help="Launch standalone offline desktop app (default)")

    # Subcommand: web
    web_parser = subparsers.add_parser("web", help="Launch local web server interface")
    web_parser.add_argument("--host", default="127.0.0.1", help="Host address (default: 127.0.0.1)")
    web_parser.add_argument("--port", type=int, default=8000, help="Port to listen on (default: 8000)")

    # Subcommand: run
    run_parser = subparsers.add_parser("run", help="Run local CLI inference pipeline")
    run_parser.add_argument("--video", required=True, help="Path to input video file")
    run_parser.add_argument("--config", default="config/pipeline.yaml", help="Path to pipeline YAML config")

    args = parser.parse_args()

    # Default to desktop app if no subcommand given
    if not args.command or args.command == "app":
        import desktop
        desktop.main()

    elif args.command == "web":
        import uvicorn
        from server import app as fastapi_app
        print(f"⚡ Starting Kinetic-Edge Web UI at http://{args.host}:{args.port}")
        uvicorn.run(fastapi_app, host=args.host, port=args.port, log_level="info")

    elif args.command == "run":
        from inference import main as run_inference
        sys.argv = ["inference.py", "--config", args.config]
        run_inference()

if __name__ == "__main__":
    main()
