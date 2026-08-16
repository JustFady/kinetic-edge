"""Project Kinetic-Edge — ZMQ Frame Receiver"""
import struct
import logging
import numpy as np
import zmq

logger = logging.getLogger("kinetic.ipc")
HEADER_FORMAT = "<QIIIi"
HEADER_SIZE = struct.calcsize(HEADER_FORMAT)

class FrameHeader:
    __slots__ = ("timestamp_us", "frame_id", "width", "height", "channels")
    def __init__(self, timestamp_us, frame_id, width, height, channels):
        self.timestamp_us = timestamp_us
        self.frame_id = frame_id
        self.width = width
        self.height = height
        self.channels = channels

class ZMQReceiver:
    def __init__(self, endpoint="tcp://127.0.0.1:5555", recv_hwm=100, recv_timeout_ms=5000):
        self.endpoint = endpoint
        self.recv_hwm = recv_hwm
        self.recv_timeout_ms = recv_timeout_ms
        self._ctx = None
        self._socket = None

    def start(self):
        self._ctx = zmq.Context()
        self._socket = self._ctx.socket(zmq.PULL)
        self._socket.setsockopt(zmq.RCVHWM, self.recv_hwm)
        self._socket.setsockopt(zmq.RCVTIMEO, self.recv_timeout_ms)
        self._socket.bind(self.endpoint)

    def receive(self):
        try:
            msg = self._socket.recv()
        except zmq.Again:
            return None, None

        if len(msg) <= 10:
            try:
                if msg.decode("utf-8") == "END": return "END", None
            except UnicodeDecodeError:
                pass
        
        if len(msg) < HEADER_SIZE: return None, None
        
        ts, fid, w, h, ch = struct.unpack(HEADER_FORMAT, msg[:HEADER_SIZE])
        header = FrameHeader(ts, fid, w, h, ch)
        
        pixel_data = msg[HEADER_SIZE:]
        if len(pixel_data) != w * h * ch: return None, None
        
        frame = np.frombuffer(pixel_data, dtype=np.uint8).reshape((h, w, ch))
        return header, frame

    def stop(self):
        if self._socket: self._socket.close(); self._socket = None
        if self._ctx: self._ctx.term(); self._ctx = None
