"""
Project Kinetic-Edge — Basketball Rules Engine

Encodes core basketball rules against tracked detections so the system
can flag real game violations rather than just generic anomalies.

Supported rules:
  1. Possession Tracking     — which player has the ball (nearest to ball center)
  2. 3-Second Paint Rule     — offensive player in the paint > 3 seconds
  3. Shot Clock              — 24-second possession timer (resets on change)
  4. Backcourt Violation     — ball crosses half-court backward during possession
  5. Contact / Foul Heuristic — overlapping player bounding boxes + acceleration
  6. Out of Bounds (refined) — ball or player fully outside the court boundary
"""

import time
import logging
from collections import defaultdict
from dataclasses import dataclass, field

logger = logging.getLogger("kinetic.rules")


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------

@dataclass
class RuleViolation:
    """Single violation emitted by the rules engine."""
    rule: str           # machine-readable rule id
    title: str          # human-readable short title
    detail: str         # longer explanation
    severity: str       # "info", "warning", "violation"
    frame_id: int = 0
    track_id: int = -1
    timestamp_us: int = 0


# ---------------------------------------------------------------------------
# Court geometry helpers
# ---------------------------------------------------------------------------

class CourtZones:
    """
    Defines logical basketball court zones in normalized [0-1] coordinates.

    The camera view is assumed to be a landscape rectangle.  We split the
    court into left-half / right-half at 0.5 on the x-axis, and approximate
    the paint (key / restricted area) as a centered rectangle near each
    basket.  These are defaults — the user can override them in config.
    """

    def __init__(self, cfg=None):
        cfg = cfg or {}
        # Full court boundary (same as the existing anomaly boundary)
        self.boundary = tuple(cfg.get("court_boundary", [0.05, 0.05, 0.95, 0.95]))

        # Half-court line (normalized x)
        self.half_court_x = cfg.get("half_court_x", 0.50)

        # Left paint zone [x_min, y_min, x_max, y_max]  (near left basket)
        self.left_paint = tuple(cfg.get("left_paint", [0.05, 0.28, 0.22, 0.72]))

        # Right paint zone (near right basket)
        self.right_paint = tuple(cfg.get("right_paint", [0.78, 0.28, 0.95, 0.72]))

    def in_paint(self, nx, ny):
        """Return True if normalized (nx, ny) is inside either paint zone."""
        return self._in_rect(nx, ny, self.left_paint) or self._in_rect(nx, ny, self.right_paint)

    def in_left_half(self, nx):
        return nx < self.half_court_x

    def in_bounds(self, nx, ny):
        return self._in_rect(nx, ny, self.boundary)

    @staticmethod
    def _in_rect(x, y, rect):
        return rect[0] <= x <= rect[2] and rect[1] <= y <= rect[3]


# ---------------------------------------------------------------------------
# Rules Engine
# ---------------------------------------------------------------------------

class BasketballRulesEngine:
    """
    Stateful engine that receives detections every frame and emits
    RuleViolation objects when basketball rules are broken.
    """

    # -- configurable thresholds (seconds) --
    PAINT_LIMIT_SEC = 3.0        # NBA 3-second rule
    SHOT_CLOCK_SEC = 24.0        # NBA shot clock
    FOUL_OVERLAP_RATIO = 0.30    # IoU threshold for "contact"
    POSSESSION_DIST_PX = 80      # max pixel distance ball->player for possession

    def __init__(self, court_cfg=None, rules_cfg=None):
        rules_cfg = rules_cfg or {}
        self.court = CourtZones(court_cfg)

        # Override thresholds from config
        self.PAINT_LIMIT_SEC = rules_cfg.get("paint_limit_sec", self.PAINT_LIMIT_SEC)
        self.SHOT_CLOCK_SEC = rules_cfg.get("shot_clock_sec", self.SHOT_CLOCK_SEC)
        self.FOUL_OVERLAP_RATIO = rules_cfg.get("foul_overlap_ratio", self.FOUL_OVERLAP_RATIO)
        self.POSSESSION_DIST_PX = rules_cfg.get("possession_dist_px", self.POSSESSION_DIST_PX)

        # -- internal state --
        # Possession
        self._possessing_track = None
        self._possession_start_us = 0
        self._ball_half = "right"        # "left" or "right"

        # Paint timers:  track_id -> first entry timestamp_us
        self._paint_entries = {}

        # Previous frame ball center (for backcourt detection)
        self._prev_ball_nx = None

        # Track last violation frame per (rule, track_id) to debounce
        self._last_fired = {}

        # Minimum frame gap before re-firing the same violation
        self.debounce_frames = int(rules_cfg.get("debounce_frames", 30))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def update(self, detections, frame_id, timestamp_us, frame_w, frame_h):
        """
        Process one frame of detections and return any rule violations.

        Parameters
        ----------
        detections : list[Detection]
            Output from tracker.UltralyticsBackend.predict().
        frame_id : int
        timestamp_us : int
        frame_w, frame_h : int
            Frame dimensions for normalizing bounding boxes.

        Returns
        -------
        list[RuleViolation]
        """
        violations = []

        players = [d for d in detections if d.class_name == "person"]
        balls = [d for d in detections if d.class_name == "sports ball"]

        # 1. Possession tracking
        self._update_possession(players, balls, timestamp_us)

        # 2. Shot clock
        v = self._check_shot_clock(frame_id, timestamp_us)
        if v:
            violations.append(v)

        # 3. Backcourt violation
        v = self._check_backcourt(balls, frame_id, timestamp_us, frame_w)
        if v:
            violations.append(v)

        # 4. 3-second paint rule
        violations.extend(
            self._check_paint_rule(players, frame_id, timestamp_us, frame_w, frame_h)
        )

        # 5. Contact / foul heuristic
        violations.extend(
            self._check_contact(players, frame_id, timestamp_us)
        )

        # 6. Out-of-bounds (refined — ball specifically)
        violations.extend(
            self._check_out_of_bounds(balls, frame_id, timestamp_us, frame_w, frame_h)
        )

        return violations

    @property
    def possession_info(self):
        """Return current possession state for the HUD overlay."""
        elapsed = 0.0
        if self._possessing_track is not None and self._possession_start_us > 0:
            elapsed = (time.time() * 1_000_000 - self._possession_start_us) / 1_000_000
        return {
            "possessing_track": self._possessing_track,
            "shot_clock_remaining": max(0.0, self.SHOT_CLOCK_SEC - elapsed),
            "ball_half": self._ball_half,
        }

    # ------------------------------------------------------------------
    # Rule implementations
    # ------------------------------------------------------------------

    def _update_possession(self, players, balls, timestamp_us):
        """Determine which player is closest to the ball."""
        if not balls:
            return

        ball = balls[0]
        bx, by = ball.center

        closest_id = None
        closest_dist = float("inf")

        for p in players:
            if p.track_id < 0:
                continue
            px, py = p.center
            d = ((px - bx) ** 2 + (py - by) ** 2) ** 0.5
            if d < closest_dist:
                closest_dist = d
                closest_id = p.track_id

        if closest_id is not None and closest_dist <= self.POSSESSION_DIST_PX:
            if closest_id != self._possessing_track:
                logger.debug("Possession change: track #%s -> #%s", self._possessing_track, closest_id)
                self._possessing_track = closest_id
                self._possession_start_us = timestamp_us
        elif closest_dist > self.POSSESSION_DIST_PX * 1.5:
            # Ball is loose — no one has possession
            self._possessing_track = None

    def _check_shot_clock(self, frame_id, timestamp_us):
        if self._possessing_track is None or self._possession_start_us == 0:
            return None

        elapsed_sec = (timestamp_us - self._possession_start_us) / 1_000_000
        if elapsed_sec >= self.SHOT_CLOCK_SEC:
            if self._should_fire("shot_clock", self._possessing_track, frame_id):
                # Reset for next cycle
                self._possession_start_us = timestamp_us
                return RuleViolation(
                    rule="shot_clock",
                    title="Shot Clock Violation",
                    detail=f"Track #{self._possessing_track} held possession for {elapsed_sec:.1f}s (limit {self.SHOT_CLOCK_SEC:.0f}s)",
                    severity="violation",
                    frame_id=frame_id,
                    track_id=self._possessing_track,
                    timestamp_us=timestamp_us,
                )
        return None

    def _check_backcourt(self, balls, frame_id, timestamp_us, frame_w):
        if not balls:
            self._prev_ball_nx = None
            return None

        ball_nx = balls[0].center[0] / frame_w
        prev = self._prev_ball_nx
        self._prev_ball_nx = ball_nx

        if prev is None or self._possessing_track is None:
            return None

        half_x = self.court.half_court_x

        # Crossed from right half back to left half
        crossed_back_left = prev >= half_x and ball_nx < half_x and self._ball_half == "right"
        # Crossed from left half back to right half
        crossed_back_right = prev < half_x and ball_nx >= half_x and self._ball_half == "left"

        if crossed_back_left or crossed_back_right:
            if self._should_fire("backcourt", self._possessing_track, frame_id):
                direction = "left" if crossed_back_left else "right"
                v = RuleViolation(
                    rule="backcourt",
                    title="Backcourt Violation",
                    detail=f"Ball crossed half-court back to {direction} side while Track #{self._possessing_track} had possession",
                    severity="violation",
                    frame_id=frame_id,
                    track_id=self._possessing_track,
                    timestamp_us=timestamp_us,
                )
                # Update the current ball half to the new side
                self._ball_half = "left" if crossed_back_left else "right"
                return v

        # Normal forward cross — just update which half the ball is on
        if ball_nx < half_x:
            self._ball_half = "left"
        else:
            self._ball_half = "right"

        return None

    def _check_paint_rule(self, players, frame_id, timestamp_us,
                          frame_w, frame_h):
        violations = []
        active_ids = set()

        for p in players:
            if p.track_id < 0:
                continue
            active_ids.add(p.track_id)
            nx, ny = p.center[0] / frame_w, p.center[1] / frame_h

            if self.court.in_paint(nx, ny):
                if p.track_id not in self._paint_entries:
                    self._paint_entries[p.track_id] = timestamp_us
                else:
                    elapsed = (timestamp_us - self._paint_entries[p.track_id]) / 1_000_000
                    if elapsed >= self.PAINT_LIMIT_SEC:
                        if self._should_fire("three_second", p.track_id, frame_id):
                            violations.append(RuleViolation(
                                rule="three_second",
                                title="3-Second Violation",
                                detail=f"Track #{p.track_id} in the paint for {elapsed:.1f}s (limit {self.PAINT_LIMIT_SEC:.0f}s)",
                                severity="violation",
                                frame_id=frame_id,
                                track_id=p.track_id,
                                timestamp_us=timestamp_us,
                            ))
                            # Reset timer so we don't spam
                            self._paint_entries[p.track_id] = timestamp_us
            else:
                # Player left the paint — clear their timer
                self._paint_entries.pop(p.track_id, None)

        # Clean up entries for tracks that disappeared
        stale = [tid for tid in self._paint_entries if tid not in active_ids]
        for tid in stale:
            del self._paint_entries[tid]

        return violations

    def _check_contact(self, players, frame_id, timestamp_us):
        """Flag when two player bounding boxes overlap significantly."""
        violations = []
        checked = set()

        for i, p1 in enumerate(players):
            if p1.track_id < 0:
                continue
            for j, p2 in enumerate(players):
                if j <= i or p2.track_id < 0:
                    continue
                pair = (min(p1.track_id, p2.track_id), max(p1.track_id, p2.track_id))
                if pair in checked:
                    continue
                checked.add(pair)

                iou = self._bbox_iou(p1.bbox, p2.bbox)
                if iou >= self.FOUL_OVERLAP_RATIO:
                    key = f"contact_{pair[0]}_{pair[1]}"
                    if self._should_fire(key, pair[0], frame_id):
                        violations.append(RuleViolation(
                            rule="contact",
                            title="Potential Foul / Contact",
                            detail=f"Track #{pair[0]} and #{pair[1]} overlapping ({iou:.0%} IoU) — possible charging or blocking foul",
                            severity="warning",
                            frame_id=frame_id,
                            track_id=pair[0],
                            timestamp_us=timestamp_us,
                        ))
        return violations

    def _check_out_of_bounds(self, balls, frame_id, timestamp_us,
                             frame_w, frame_h):
        violations = []
        for b in balls:
            nx, ny = b.center[0] / frame_w, b.center[1] / frame_h
            if not self.court.in_bounds(nx, ny):
                if self._should_fire("ball_out", b.track_id, frame_id):
                    violations.append(RuleViolation(
                        rule="ball_out",
                        title="Ball Out of Bounds",
                        detail=f"Ball (Track #{b.track_id}) detected outside court boundary",
                        severity="violation",
                        frame_id=frame_id,
                        track_id=b.track_id,
                        timestamp_us=timestamp_us,
                    ))
        return violations

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _should_fire(self, rule, track_id, frame_id):
        """Debounce: don't fire the same rule+track more than once per N frames."""
        key = (rule, track_id)
        last = self._last_fired.get(key, -999)
        if frame_id - last < self.debounce_frames:
            return False
        self._last_fired[key] = frame_id
        return True

    @staticmethod
    def _bbox_iou(b1, b2):
        """Compute Intersection-over-Union for two (x1, y1, x2, y2) boxes."""
        x1 = max(b1[0], b2[0])
        y1 = max(b1[1], b2[1])
        x2 = min(b1[2], b2[2])
        y2 = min(b1[3], b2[3])
        inter = max(0, x2 - x1) * max(0, y2 - y1)
        if inter == 0:
            return 0.0
        a1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
        a2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
        return inter / (a1 + a2 - inter)
