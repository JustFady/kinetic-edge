#!/usr/bin/env python3
"""
Kinetic-Edge — Standalone Offline Desktop Application

Launches the local inference backend and opens a native macOS/Linux
desktop window with zero internet or browser dependency.
"""

import os
import sys
import threading
import time
import socket
import uvicorn
import webview

# Add python/ directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "python"))

def find_free_port(default_port=8000):
    """Check if default port is free, otherwise find an available one."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("127.0.0.1", default_port))
        sock.close()
        return default_port
    except OSError:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
        sock.close()
        return port

def run_backend(port):
    """Run the local FastAPI server in a background thread."""
    from server import app
    config = uvicorn.Config(
        app=app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        access_log=False
    )
    server = uvicorn.Server(config)
    server.run()

def main():
    port = find_free_port()
    
    # Start backend thread
    server_thread = threading.Thread(target=run_backend, args=(port,), daemon=True)
    server_thread.start()
    
    # Small pause to allow local server startup
    time.sleep(0.6)
    
    app_url = f"http://127.0.0.1:{port}"
    print(f"⚡ Kinetic-Edge Desktop launched on {app_url}")
    
    # Create native window
    window = webview.create_window(
        title="Kinetic-Edge — Basketball Referee Assistant",
        url=app_url,
        width=1280,
        height=840,
        min_size=(1000, 650),
        background_color="#06060a",
        text_select=False
    )
    
    # Start native desktop app event loop
    webview.start(debug=False)

if __name__ == "__main__":
    main()
