// ══════════════════════════════════════════════════════════════════════════════
// Kinetic-Edge Referee Assistant — Frontend App
// WebSocket client, drag-drop upload, canvas renderer, alert feed
// ══════════════════════════════════════════════════════════════════════════════

const API_BASE = window.location.origin;
const WS_BASE = `ws://${window.location.host}`;

// ── DOM Elements ─────────────────────────────────────────────────────────────
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const videoSection = document.getElementById('video-section');
const videoContainer = document.getElementById('video-container');
const canvas = document.getElementById('video-canvas');
const ctx = canvas.getContext('2d');
const progressFill = document.getElementById('progress-fill');
const alertsList = document.getElementById('alerts-list');
const clearAlertsBtn = document.getElementById('clear-alerts');
const statusBadge = document.getElementById('status-badge');
const statusText = statusBadge.querySelector('.status-text');

// Stats
const statFps = document.querySelector('#stat-fps .stat-value');
const statPlayers = document.querySelector('#stat-players .stat-value');
const statAlerts = document.querySelector('#stat-alerts .stat-value');
const statFrames = document.querySelector('#stat-frames .stat-value');

// ── State ────────────────────────────────────────────────────────────────────
let currentJobId = null;
let feedWs = null;
let alertWs = null;
let alertCount = 0;
let frameCount = 0;
let totalFrames = 0;
let fpsCounter = { frames: 0, lastTime: performance.now(), fps: 0 };

// ── Status Updates ───────────────────────────────────────────────────────────
function setStatus(state, text) {
    statusBadge.className = `status-badge ${state}`;
    statusText.textContent = text;
}

function updateFps() {
    fpsCounter.frames++;
    const now = performance.now();
    const elapsed = now - fpsCounter.lastTime;
    if (elapsed >= 1000) {
        fpsCounter.fps = Math.round((fpsCounter.frames * 1000) / elapsed);
        fpsCounter.frames = 0;
        fpsCounter.lastTime = now;
        statFps.textContent = fpsCounter.fps;
    }
}

// ── Drag & Drop ──────────────────────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());
browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) uploadFile(e.target.files[0]);
});

['dragenter', 'dragover'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
});

['dragleave', 'drop'].forEach(evt => {
    dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });
});

dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) uploadFile(files[0]);
});

// ── File Upload ──────────────────────────────────────────────────────────────
async function uploadFile(file) {
    if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|avi|mkv)$/i)) {
        addAlert('error', 'Invalid File', 'Please upload a video file (MP4, MOV, AVI, MKV)');
        return;
    }

    setStatus('processing', 'Uploading...');
    dropZone.classList.add('uploading');

    const formData = new FormData();
    formData.append('video', file);

    try {
        const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);

        const data = await response.json();
        currentJobId = data.job_id;
        totalFrames = data.total_frames || 0;
        frameCount = 0;

        // Switch to video view
        dropZone.classList.add('hidden');
        dropZone.classList.remove('uploading');
        videoContainer.classList.remove('hidden');

        setStatus('processing', 'Analyzing...');
        statFrames.textContent = `0 / ${totalFrames}`;

        // Connect WebSockets
        connectFeedWs(currentJobId);
        connectAlertWs(currentJobId);
    } catch (err) {
        console.error('Upload error:', err);
        setStatus('error', 'Upload Failed');
        dropZone.classList.remove('uploading');
        addAlert('error', 'Upload Error', err.message);
    }
}

// ── WebSocket: Video Feed ────────────────────────────────────────────────────
function connectFeedWs(jobId) {
    if (feedWs) feedWs.close();

    feedWs = new WebSocket(`${WS_BASE}/ws/feed/${jobId}`);
    feedWs.binaryType = 'blob';

    feedWs.onmessage = (event) => {
        if (typeof event.data === 'string') {
            // JSON metadata message
            try {
                const meta = JSON.parse(event.data);
                if (meta.type === 'done') {
                    setStatus('done', 'Analysis Complete');
                    return;
                }
                if (meta.type === 'frame_meta') {
                    frameCount = meta.frame_id;
                    statFrames.textContent = `${frameCount} / ${totalFrames}`;
                    statPlayers.textContent = meta.detections || 0;
                    if (totalFrames > 0) {
                        progressFill.style.width = `${(frameCount / totalFrames) * 100}%`;
                    }
                }
            } catch (e) { /* ignore */ }
            return;
        }

        // Binary: JPEG frame
        const blob = event.data;
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(img.src);
            updateFps();
        };
        img.src = URL.createObjectURL(blob);
    };

    feedWs.onclose = () => {
        if (frameCount >= totalFrames && totalFrames > 0) {
            setStatus('done', 'Analysis Complete');
            progressFill.style.width = '100%';
        }
    };

    feedWs.onerror = () => setStatus('error', 'Connection Lost');
}

// ── WebSocket: Alerts ────────────────────────────────────────────────────────
function connectAlertWs(jobId) {
    if (alertWs) alertWs.close();

    alertWs = new WebSocket(`${WS_BASE}/ws/alerts/${jobId}`);

    alertWs.onmessage = (event) => {
        try {
            const alert = JSON.parse(event.data);
            if (alert.type === 'done') return;
            addAlert(
                alert.severity || mapAlertType(alert.type),
                alert.title || formatAlertType(alert.type),
                alert.detail || alert.message || JSON.stringify(alert),
                alert.frame_id
            );
        } catch (e) { /* ignore */ }
    };
}

function mapAlertType(type) {
    const map = {
        'boundary_violation': 'boundary',
        'out_of_bounds': 'boundary',
        'potential_foul': 'foul',
        'sudden_acceleration': 'foul',
        'possession_change': 'possession',
    };
    return map[type] || 'info';
}

function formatAlertType(type) {
    const map = {
        'boundary_violation': '⚠️ Out of Bounds',
        'out_of_bounds': '⚠️ Out of Bounds',
        'potential_foul': '🚩 Potential Foul',
        'sudden_acceleration': '💨 Sudden Acceleration',
        'possession_change': '🔄 Possession Change',
    };
    return map[type] || `ℹ️ ${type}`;
}

// ── Alert Rendering ──────────────────────────────────────────────────────────
function addAlert(severity, title, detail, frameId) {
    // Remove empty state
    const emptyState = alertsList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    alertCount++;
    statAlerts.textContent = alertCount;

    const card = document.createElement('div');
    card.className = `alert-card ${severity}`;

    const timeStr = frameId ? `Frame ${frameId}` : new Date().toLocaleTimeString();

    card.innerHTML = `
        <div class="alert-header">
            <span class="alert-type">${title}</span>
            <span class="alert-time">${timeStr}</span>
        </div>
        <div class="alert-detail">${detail}</div>
    `;

    // Prepend (newest on top)
    alertsList.insertBefore(card, alertsList.firstChild);

    // Keep max 200 alerts
    while (alertsList.children.length > 200) {
        alertsList.removeChild(alertsList.lastChild);
    }
}

// ── Clear Alerts ─────────────────────────────────────────────────────────────
clearAlertsBtn.addEventListener('click', () => {
    alertsList.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">📋</div>
            <p>No alerts yet</p>
            <span>Upload a game clip to start analysis</span>
        </div>
    `;
    alertCount = 0;
    statAlerts.textContent = '0';
});

// ── Init ─────────────────────────────────────────────────────────────────────
setStatus('ready', 'Ready');
