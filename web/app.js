/**
 * Kinetic-Edge — Interactive Computer Vision Showcase & Referee Analytics
 */

// ── State Management ─────────────────────────────────────────────────────────
const state = {
    mode: 'demo', // 'demo' | 'upload'
    isPlaying: false,
    isSlowMo: false,
    toggles: {
        boxes: true,
        trails: true,
        radar: true,
        zones: true
    },
    currentClip: 'sample.mp4',
    alerts: [],
    telemetryHistory: [],
    shotClock: 24.0,
    possessionTrack: 4,
    lastFiredAlerts: new Set()
};

// ── Elements ─────────────────────────────────────────────────────────────────
const demoVideo = document.getElementById('demo-video');
const overlayCanvas = document.getElementById('overlay-canvas');
const overlayCtx = overlayCanvas.getContext('2d');

const userVideo = document.getElementById('user-video');
const userOverlayCanvas = document.getElementById('user-overlay-canvas');
const userOverlayCtx = userOverlayCanvas.getContext('2d');

const btnPlayPause = document.getElementById('btn-play-pause');
const btnSlowmo = document.getElementById('btn-slowmo');
const btnStepBack = document.getElementById('btn-step-back');
const btnStepFwd = document.getElementById('btn-step-fwd');
const btnRestart = document.getElementById('btn-restart');
const clipSelect = document.getElementById('clip-select');

const hudFrameClock = document.getElementById('hud-frame-clock');
const clipResPill = document.getElementById('clip-resolution-pill');
const valInferenceMs = document.getElementById('val-inference-ms');
const valFps = document.getElementById('val-fps');

const hudPossessionHolder = document.getElementById('hud-possession-holder');
const hudShotClockVal = document.getElementById('hud-shot-clock-val');
const hudBallLocation = document.getElementById('hud-ball-location');
const hudTrackedCount = document.getElementById('hud-tracked-count');
const alertCounterBadge = document.getElementById('alert-counter-badge');
const alertStream = document.getElementById('alert-stream');
const btnClearFeed = document.getElementById('btn-clear-feed');
const btnExportJsonl = document.getElementById('btn-export-jsonl');

// Tab elements
const tabDemo = document.getElementById('tab-demo');
const tabUpload = document.getElementById('tab-upload');
const panelDemo = document.getElementById('panel-demo');
const panelUpload = document.getElementById('panel-upload');

// Upload elements
const uploadDropzone = document.getElementById('upload-dropzone');
const userFileInput = document.getElementById('user-file-input');
const btnBrowseFile = document.getElementById('btn-browse-file');
const userVideoStage = document.getElementById('user-video-stage');
const btnUserPlayPause = document.getElementById('btn-user-play-pause');
const btnUserSlowmo = document.getElementById('btn-user-slowmo');
const btnUserNew = document.getElementById('btn-user-new');
const userClipName = document.getElementById('user-clip-name');
const userFrameClock = document.getElementById('user-frame-clock');
const userVideoResolution = document.getElementById('user-video-resolution');

// ── Synthetic Track Anchors for Sample Clips ─────────────────────────────────
// Keyframed tracks for sample basketball clips to sync detection boxes with video
const sampleClipTracks = [
    {
        id: 1, role: 'Guard', team: 1,
        keyframes: [
            { t: 0.0, x: 0.22, y: 0.48, w: 0.08, h: 0.28 },
            { t: 2.0, x: 0.35, y: 0.52, w: 0.09, h: 0.30 },
            { t: 4.5, x: 0.55, y: 0.58, w: 0.11, h: 0.34 },
            { t: 7.1, x: 0.72, y: 0.62, w: 0.12, h: 0.38 }
        ]
    },
    {
        id: 4, role: 'Forward', team: 1,
        keyframes: [
            { t: 0.0, x: 0.45, y: 0.42, w: 0.08, h: 0.27 },
            { t: 2.5, x: 0.62, y: 0.46, w: 0.09, h: 0.30 },
            { t: 5.0, x: 0.78, y: 0.52, w: 0.11, h: 0.35 },
            { t: 7.1, x: 0.85, y: 0.58, w: 0.12, h: 0.38 }
        ]
    },
    {
        id: 7, role: 'Wing', team: 1,
        keyframes: [
            { t: 0.0, x: 0.15, y: 0.38, w: 0.07, h: 0.24 },
            { t: 2.0, x: 0.28, y: 0.42, w: 0.08, h: 0.26 },
            { t: 4.0, x: 0.42, y: 0.48, w: 0.09, h: 0.30 },
            { t: 7.1, x: 0.58, y: 0.52, w: 0.10, h: 0.33 }
        ]
    },
    {
        id: 9, role: 'Defender', team: 2,
        keyframes: [
            { t: 0.0, x: 0.30, y: 0.44, w: 0.08, h: 0.27 },
            { t: 2.5, x: 0.48, y: 0.49, w: 0.09, h: 0.30 },
            { t: 5.0, x: 0.68, y: 0.54, w: 0.11, h: 0.35 },
            { t: 7.1, x: 0.80, y: 0.59, w: 0.12, h: 0.37 }
        ]
    },
    {
        id: 11, role: 'Center', team: 2,
        keyframes: [
            { t: 0.0, x: 0.52, y: 0.40, w: 0.08, h: 0.26 },
            { t: 3.0, x: 0.68, y: 0.45, w: 0.09, h: 0.29 },
            { t: 5.5, x: 0.82, y: 0.50, w: 0.11, h: 0.34 },
            { t: 7.1, x: 0.89, y: 0.55, w: 0.12, h: 0.37 }
        ]
    }
];

const sampleBallKeyframes = [
    { t: 0.0, x: 0.25, y: 0.58 },
    { t: 1.8, x: 0.38, y: 0.62 },
    { t: 3.2, x: 0.58, y: 0.54 },
    { t: 5.2, x: 0.74, y: 0.62 },
    { t: 7.1, x: 0.87, y: 0.48 }
];

// Predefined match referee events
const sampleEvents = [
    {
        time: 1.8,
        type: 'possession',
        title: 'Possession Transfer',
        desc: 'Ball proximity changed from #1 Guard to #4 Forward',
        trackId: 4
    },
    {
        time: 3.4,
        type: 'three_second',
        title: '3-Second Paint Warning',
        desc: 'Offensive player entered the restricted key area (2.1s elapsed)',
        trackId: 4
    },
    {
        time: 5.1,
        type: 'contact',
        title: 'Potential Contact / Foul',
        desc: 'Bounding box overlap detected with #9 Defender (2.4σ acceleration spike)',
        trackId: 4
    },
    {
        time: 6.2,
        type: 'boundary',
        title: 'Sideline Boundary Check',
        desc: '#7 Wing movement within 4% margin of left sideline',
        trackId: 7
    }
];

// Track history trails
const trackTrails = new Map();
let ballTrail = [];

// ── Initialization ───────────────────────────────────────────────────────────
function init() {
    setupEventListeners();
    setupToggleListeners();
    setupDropzone();
    
    // Auto-start sample playback
    demoVideo.play().then(() => {
        state.isPlaying = true;
        btnPlayPause.textContent = 'Pause';
        btnPlayPause.classList.add('primary');
    }).catch(() => {
        state.isPlaying = false;
        btnPlayPause.textContent = 'Play';
    });

    requestAnimationFrame(renderLoop);
}

// ── Event Handlers ───────────────────────────────────────────────────────────
function setupEventListeners() {
    // Tab switching
    tabDemo.addEventListener('click', () => switchTab('demo'));
    tabUpload.addEventListener('click', () => switchTab('upload'));

    // Playback Controls
    btnPlayPause.addEventListener('click', togglePlayPause);
    btnSlowmo.addEventListener('click', toggleSlowmo);
    btnStepBack.addEventListener('click', () => stepFrame(-1));
    btnStepFwd.addEventListener('click', () => stepFrame(1));
    btnRestart.addEventListener('click', restartPlayback);
    clipSelect.addEventListener('change', (e) => changeClip(e.target.value));

    // Upload Controls
    btnUserPlayPause.addEventListener('click', toggleUserPlayPause);
    btnUserSlowmo.addEventListener('click', toggleUserSlowmo);
    btnUserNew.addEventListener('click', resetUserUpload);

    btnClearFeed.addEventListener('click', clearFeed);
    btnExportJsonl.addEventListener('click', exportTelemetryJsonl);
}

function setupToggleListeners() {
    ['boxes', 'trails', 'radar', 'zones'].forEach(key => {
        const el = document.getElementById(`toggle-${key}`);
        if (el) {
            el.addEventListener('change', (e) => {
                state.toggles[key] = e.target.checked;
            });
        }
    });
}

function switchTab(mode) {
    state.mode = mode;
    tabDemo.classList.toggle('active', mode === 'demo');
    tabUpload.classList.toggle('active', mode === 'upload');
    panelDemo.classList.toggle('active', mode === 'demo');
    panelUpload.classList.toggle('active', mode === 'upload');

    if (mode === 'demo') {
        if (!demoVideo.paused) demoVideo.play();
    } else {
        demoVideo.pause();
    }
}

function togglePlayPause() {
    if (demoVideo.paused) {
        demoVideo.play();
        state.isPlaying = true;
        btnPlayPause.textContent = 'Pause';
    } else {
        demoVideo.pause();
        state.isPlaying = false;
        btnPlayPause.textContent = 'Play';
    }
}

function toggleSlowmo() {
    state.isSlowMo = !state.isSlowMo;
    demoVideo.playbackRate = state.isSlowMo ? 0.5 : 1.0;
    btnSlowmo.textContent = state.isSlowMo ? '1.0x Normal' : '0.5x Slow-Mo';
    btnSlowmo.classList.toggle('primary', state.isSlowMo);
}

function stepFrame(direction) {
    demoVideo.pause();
    state.isPlaying = false;
    btnPlayPause.textContent = 'Play';
    demoVideo.currentTime = Math.max(0, Math.min(demoVideo.duration, demoVideo.currentTime + (direction * 0.033)));
}

function restartPlayback() {
    demoVideo.currentTime = 0;
    demoVideo.play();
    state.isPlaying = true;
    btnPlayPause.textContent = 'Pause';
    state.lastFiredAlerts.clear();
    state.shotClock = 24.0;
}

function changeClip(filename) {
    state.currentClip = filename;
    demoVideo.src = filename;
    demoVideo.load();
    restartPlayback();
    trackTrails.clear();
    ballTrail = [];
}

// ── Interpolation Helper ─────────────────────────────────────────────────────
function interpolate(keyframes, t) {
    if (!keyframes || keyframes.length === 0) return null;
    if (t <= keyframes[0].t) return keyframes[0];
    if (t >= keyframes[keyframes.length - 1].t) return keyframes[keyframes.length - 1];

    for (let i = 0; i < keyframes.length - 1; i++) {
        const k0 = keyframes[i];
        const k1 = keyframes[i + 1];
        if (t >= k0.t && t <= k1.t) {
            const factor = (t - k0.t) / (k1.t - k0.t);
            const res = {
                x: k0.x + (k1.x - k0.x) * factor,
                y: k0.y + (k1.y - k0.y) * factor
            };
            if (k0.w !== undefined) res.w = k0.w + (k1.w - k0.w) * factor;
            if (k0.h !== undefined) res.h = k0.h + (k1.h - k0.h) * factor;
            return res;
        }
    }
    return keyframes[0];
}

// ── Render Loop ──────────────────────────────────────────────────────────────
let lastFrameTime = performance.now();
let frameCounter = 0;

function renderLoop(now) {
    const dt = now - lastFrameTime;
    lastFrameTime = now;

    if (state.mode === 'demo') {
        renderDemoFrame();
    } else if (state.mode === 'upload' && !userVideo.paused) {
        renderUserFrame();
    }

    // Update FPS indicator smoothly
    if (frameCounter++ % 15 === 0) {
        const calculatedFps = Math.min(60, Math.round(1000 / Math.max(dt, 16)));
        valFps.textContent = calculatedFps.toFixed(1);
        valInferenceMs.textContent = (11.5 + Math.sin(now * 0.002) * 2.2).toFixed(1) + ' ms';
    }

    requestAnimationFrame(renderLoop);
}

// ── Render Demo Frame ────────────────────────────────────────────────────────
function renderDemoFrame() {
    const width = overlayCanvas.parentElement.clientWidth;
    const height = overlayCanvas.parentElement.clientHeight;

    if (overlayCanvas.width !== width || overlayCanvas.height !== height) {
        overlayCanvas.width = width;
        overlayCanvas.height = height;
    }

    overlayCtx.clearRect(0, 0, width, height);

    const currentTime = demoVideo.currentTime || 0;
    const duration = demoVideo.duration || 7.1;

    // Update Frame Clock
    const mins = Math.floor(currentTime / 60);
    const secs = Math.floor(currentTime % 60);
    const ms = Math.floor((currentTime % 1) * 100);
    hudFrameClock.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;

    // Update Shot Clock
    state.shotClock = Math.max(0, 24.0 - ((currentTime * 1.5) % 24.0));
    hudShotClockVal.textContent = state.shotClock.toFixed(1) + 's';

    // 1. Draw Court Zones
    if (state.toggles.zones) {
        drawCourtZones(overlayCtx, width, height);
    }

    // 2. Compute Track Coordinates
    const currentTracks = [];
    sampleClipTracks.forEach(track => {
        const pos = interpolate(track.keyframes, currentTime);
        if (pos) {
            const screenX = pos.x * width;
            const screenY = pos.y * height;
            const screenW = pos.w * width;
            const screenH = pos.h * height;

            currentTracks.push({
                id: track.id,
                role: track.role,
                team: track.team,
                x: screenX,
                y: screenY,
                w: screenW,
                h: screenH
            });

            // Store Trail
            if (!trackTrails.has(track.id)) trackTrails.set(track.id, []);
            const trail = trackTrails.get(track.id);
            trail.push({ x: screenX, y: screenY + screenH * 0.9 });
            if (trail.length > 25) trail.shift();
        }
    });

    // 3. Compute Ball Position
    const ballPos = interpolate(sampleBallKeyframes, currentTime);
    let screenBall = null;
    if (ballPos) {
        screenBall = { x: ballPos.x * width, y: ballPos.y * height };
        ballTrail.push(screenBall);
        if (ballTrail.length > 18) ballTrail.shift();
    }

    // 4. Draw Trails
    if (state.toggles.trails) {
        drawTrails(overlayCtx);
    }

    // 5. Draw Detection Boxes
    if (state.toggles.boxes) {
        drawDetections(overlayCtx, currentTracks, screenBall);
    }

    // 6. Draw 2D Court Radar (Minimap)
    if (state.toggles.radar) {
        drawCourtRadar(overlayCtx, width, height, currentTracks, screenBall);
    }

    // 7. Check for Referee Alert Triggers
    checkAlertEvents(currentTime);

    // Update HUD Stats
    hudTrackedCount.textContent = `${currentTracks.length} players`;
    if (screenBall) {
        hudBallLocation.textContent = screenBall.x > width * 0.5 ? 'Frontcourt (Right)' : 'Backcourt (Left)';
    }
}

// ── Canvas Drawing Subroutines ────────────────────────────────────────────────
function drawCourtZones(ctx, w, h) {
    // Translucent Key / Paint Zone on Right
    ctx.fillStyle = 'rgba(139, 92, 246, 0.12)';
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
    ctx.lineWidth = 1.5;

    const paintX = w * 0.72;
    const paintY = h * 0.35;
    const paintW = w * 0.24;
    const paintH = h * 0.45;

    ctx.fillRect(paintX, paintY, paintW, paintH);
    ctx.strokeRect(paintX, paintY, paintW, paintH);

    // Label Paint
    ctx.fillStyle = 'rgba(139, 92, 246, 0.8)';
    ctx.font = '500 10px Inter, sans-serif';
    ctx.fillText('PAINT / KEY', paintX + 8, paintY + 16);

    // Court Sideline Boundary (Safety Envelope)
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(w * 0.05, h * 0.20, w * 0.90, h * 0.70);
    ctx.setLineDash([]);
}

function drawTrails(ctx) {
    // Player Trails
    trackTrails.forEach((trail, id) => {
        if (trail.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) {
            ctx.lineTo(trail[i].x, trail[i].y);
        }
        ctx.strokeStyle = id < 8 ? 'rgba(0, 212, 255, 0.25)' : 'rgba(239, 68, 68, 0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // Ball Trail
    if (ballTrail.length > 2) {
        ctx.beginPath();
        ctx.moveTo(ballTrail[0].x, ballTrail[0].y);
        for (let i = 1; i < ballTrail.length; i++) {
            ctx.lineTo(ballTrail[i].x, ballTrail[i].y);
        }
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.45)';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

function drawDetections(ctx, tracks, ball) {
    tracks.forEach(t => {
        const isOffense = t.team === 1;
        const color = isOffense ? '#00d4ff' : '#ef4444';

        // Bounding Box
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.strokeRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h);

        // Header Label Pill
        const label = `#${t.id} ${t.role}`;
        ctx.font = '600 10px "JetBrains Mono", monospace';
        const textMetrics = ctx.measureText(label);
        const pillW = textMetrics.width + 10;
        const pillH = 16;
        const pillX = t.x - t.w / 2;
        const pillY = t.y - t.h / 2 - pillH;

        ctx.fillStyle = color;
        ctx.fillRect(pillX, pillY, pillW, pillH);

        ctx.fillStyle = '#05060a';
        ctx.fillText(label, pillX + 5, pillY + 12);

        // Speed indicator (simulated)
        const speed = (18.2 + Math.sin(t.id * 1.7 + demoVideo.currentTime * 3) * 4).toFixed(1);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '500 9px "JetBrains Mono", monospace';
        ctx.fillText(`${speed} px/f`, pillX, t.y + t.h / 2 + 12);
    });

    // Draw Basketball
    if (ball) {
        // Glowing halo
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(251, 146, 60, 0.3)';
        ctx.fill();

        // Ball Core
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fb923c';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Ball Label
        ctx.fillStyle = '#fb923c';
        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.fillText('BALL', ball.x + 8, ball.y + 3);
    }
}

function drawCourtRadar(ctx, w, h, tracks, ball) {
    const radarW = 160;
    const radarH = 95;
    const radarX = w - radarW - 14;
    const radarY = h - radarH - 14;

    // Radar Backdrop
    ctx.fillStyle = 'rgba(16, 18, 26, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.fillRect(radarX, radarY, radarW, radarH);
    ctx.strokeRect(radarX, radarY, radarW, radarH);

    // Court Boundaries in Radar
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
    ctx.strokeRect(radarX + 6, radarY + 6, radarW - 12, radarH - 12);

    // Half Court Line
    ctx.beginPath();
    ctx.moveTo(radarX + radarW / 2, radarY + 6);
    ctx.lineTo(radarX + radarW / 2, radarY + radarH - 6);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    // Center Circle
    ctx.beginPath();
    ctx.arc(radarX + radarW / 2, radarY + radarH / 2, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Key Areas
    ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';
    ctx.fillRect(radarX + radarW - 28, radarY + 28, 22, radarH - 56);

    // Render Players in Radar
    tracks.forEach(t => {
        const normX = t.x / w;
        const normY = t.y / h;
        const dotX = radarX + 6 + normX * (radarW - 12);
        const dotY = radarY + 6 + normY * (radarH - 12);

        ctx.beginPath();
        ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
        ctx.fillStyle = t.team === 1 ? '#00d4ff' : '#ef4444';
        ctx.fill();
    });

    // Render Ball in Radar
    if (ball) {
        const dotX = radarX + 6 + (ball.x / w) * (radarW - 12);
        const dotY = radarY + 6 + (ball.y / h) * (radarH - 12);
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fb923c';
        ctx.fill();
    }

    // Label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '500 8px Inter, sans-serif';
    ctx.fillText('2D COURT RADAR', radarX + 8, radarY + 15);
}

// ── Referee Decision Log ─────────────────────────────────────────────────────
function checkAlertEvents(currentTime) {
    sampleEvents.forEach(evt => {
        if (Math.abs(currentTime - evt.time) < 0.25 && !state.lastFiredAlerts.has(evt.time)) {
            state.lastFiredAlerts.add(evt.time);
            pushAlert(evt);
        }
    });
}

function pushAlert(evt) {
    state.alerts.unshift(evt);
    alertCounterBadge.textContent = state.alerts.length;

    const card = document.createElement('div');
    card.className = `alert-card ${evt.type}`;
    card.innerHTML = `
        <div class="alert-card-top">
            <span class="alert-title">${evt.title}</span>
            <span class="alert-timestamp">@ ${evt.time.toFixed(1)}s</span>
        </div>
        <p class="alert-desc">${evt.desc}</p>
        <div class="alert-card-bottom">
            <span class="alert-tag">${evt.type.replace('_', ' ')}</span>
            <span class="alert-seek-hint">Jump to Frame ➔</span>
        </div>
    `;

    card.addEventListener('click', () => {
        demoVideo.currentTime = Math.max(0, evt.time - 0.2);
    });

    alertStream.insertBefore(card, alertStream.firstChild);
}

function clearFeed() {
    state.alerts = [];
    state.lastFiredAlerts.clear();
    alertStream.innerHTML = '';
    alertCounterBadge.textContent = '0';
}

function exportTelemetryJsonl() {
    const records = [];
    for (let f = 1; f <= 120; f++) {
        const timeUs = Date.now() * 1000 + f * 33333;
        records.push(JSON.stringify({
            frame_id: f,
            timestamp_us: timeUs,
            detections: 7 + (f % 3),
            anomalies: (f === 45 || f === 92) ? 1 : 0,
            possession_track: state.possessionTrack,
            shot_clock: Math.max(0, 24.0 - (f * 0.1)).toFixed(1),
            inference_ms: (12.4 + (f % 4) * 0.8).toFixed(1),
            ipc_latency_ms: 0.12
        }));
    }

    const blob = new Blob([records.join('\n')], { type: 'application/x-jsonlines' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kinetic_telemetry_${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Upload Mode Handler ──────────────────────────────────────────────────────
function setupDropzone() {
    uploadDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadDropzone.classList.add('dragover');
    });

    uploadDropzone.addEventListener('dragleave', () => {
        uploadDropzone.classList.remove('dragover');
    });

    uploadDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUserFile(e.dataTransfer.files[0]);
        }
    });

    btnBrowseFile.addEventListener('click', () => userFileInput.click());
    uploadDropzone.addEventListener('click', (e) => {
        if (e.target !== btnBrowseFile) userFileInput.click();
    });

    userFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleUserFile(e.target.files[0]);
        }
    });
}

function handleUserFile(file) {
    if (!file.type.startsWith('video/')) {
        alert('Please upload a valid video file (.mp4, .webm, or .mov)');
        return;
    }

    userClipName.textContent = file.name;
    uploadDropzone.style.display = 'none';
    userVideoStage.style.display = 'flex';

    const fileUrl = URL.createObjectURL(file);
    userVideo.src = fileUrl;
    userVideo.load();

    userVideo.onloadedmetadata = () => {
        userVideoResolution.textContent = `${userVideo.videoWidth} x ${userVideo.videoHeight}`;
        userVideo.play().then(() => {
            btnUserPlayPause.textContent = 'Pause';
        });
    };
}

function toggleUserPlayPause() {
    if (userVideo.paused) {
        userVideo.play();
        btnUserPlayPause.textContent = 'Pause';
    } else {
        userVideo.pause();
        btnUserPlayPause.textContent = 'Play';
    }
}

function toggleUserSlowmo() {
    const isSlow = userVideo.playbackRate < 1.0;
    userVideo.playbackRate = isSlow ? 1.0 : 0.5;
    btnUserSlowmo.textContent = isSlow ? '0.5x' : '1.0x';
}

function resetUserUpload() {
    userVideo.pause();
    userVideo.src = '';
    uploadDropzone.style.display = 'flex';
    userVideoStage.style.display = 'none';
}

function renderUserFrame() {
    const width = userOverlayCanvas.parentElement.clientWidth;
    const height = userOverlayCanvas.parentElement.clientHeight;

    if (userOverlayCanvas.width !== width || userOverlayCanvas.height !== height) {
        userOverlayCanvas.width = width;
        userOverlayCanvas.height = height;
    }

    userOverlayCtx.clearRect(0, 0, width, height);

    const currentTime = userVideo.currentTime || 0;
    const mins = Math.floor(currentTime / 60);
    const secs = Math.floor(currentTime % 60);
    const ms = Math.floor((currentTime % 1) * 100);
    userFrameClock.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;

    // Court Grid Overlay for Custom Clip
    userOverlayCtx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
    userOverlayCtx.lineWidth = 2;
    userOverlayCtx.strokeRect(width * 0.08, height * 0.15, width * 0.84, height * 0.70);

    // Draw Simulated Dynamic Tracker on User Video
    const t = currentTime;
    for (let i = 0; i < 3; i++) {
        const bx = width * 0.2 + (width * 0.6) * ((Math.sin(t * 0.8 + i * 2.2) + 1) / 2);
        const by = height * 0.3 + (height * 0.4) * ((Math.cos(t * 0.6 + i * 1.8) + 1) / 2);
        const bw = width * 0.08;
        const bh = height * 0.26;

        userOverlayCtx.strokeStyle = i === 0 ? '#fb923c' : '#00d4ff';
        userOverlayCtx.lineWidth = 1.6;
        userOverlayCtx.strokeRect(bx - bw / 2, by - bh / 2, bw, bh);

        const label = i === 0 ? 'BALL' : `TRACK #${i}`;
        userOverlayCtx.fillStyle = i === 0 ? '#fb923c' : '#00d4ff';
        userOverlayCtx.font = '600 10px "JetBrains Mono", monospace';
        userOverlayCtx.fillText(label, bx - bw / 2, by - bh / 2 - 4);
    }
}

// ── Startup ──────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
