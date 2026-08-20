/**
 * Kinetic-Edge — Basketball Computer Vision & Referee Analytics Simulation
 */

// ── Application State ────────────────────────────────────────────────────────
const state = {
    mode: 'sim', // 'sim' | 'upload'
    isPlaying: true,
    isSlowMo: false,
    currentTime: 0.0,
    duration: 22.5, // 22.5 second full possession loop
    shotClock: 24.0,
    possessionTrack: 3,
    toggles: {
        boxes: true,
        trails: true,
        zones: true,
        minimap: true
    },
    activeCallout: null,
    highlightedTrackId: null
};

// ── Preset Rule Violations ───────────────────────────────────────────────────
const presetViolations = [
    {
        time: 3.2,
        rule: 'three_second',
        title: '3-Second Key Rule',
        desc: 'Center #15 occupied offensive paint for 3.2s without making a continuous move to the basket.',
        tag: 'Lane Violation',
        colorClass: 'purple',
        offendingTrack: 15
    },
    {
        time: 6.8,
        rule: 'out_of_bounds',
        title: 'Sideline Out of Bounds',
        desc: 'Wing #7 stepped across the sideline while receiving a skip pass.',
        tag: 'Boundary',
        colorClass: 'amber',
        offendingTrack: 7
    },
    {
        time: 10.5,
        rule: 'charging_foul',
        title: 'Charging Foul (Contact)',
        desc: 'Guard #3 made illegal torso contact with Defender #9 (42% IoU box overlap, 3.4σ deceleration).',
        tag: 'Personal Foul',
        colorClass: 'red',
        offendingTrack: 3
    },
    {
        time: 15.0,
        rule: 'backcourt_turnover',
        title: 'Backcourt Turnover',
        desc: 'Ball passed backward across midcourt into backcourt while Team White held possession.',
        tag: 'Turnover',
        colorClass: 'cyan',
        offendingTrack: 30
    },
    {
        time: 21.4,
        rule: 'shot_clock_violation',
        title: 'Shot Clock Expiration',
        desc: '24-second possession clock expired before a field goal attempt touched the rim.',
        tag: 'Clock Expiration',
        colorClass: 'yellow',
        offendingTrack: 3
    }
];

// ── Keyframed Player Trajectories (Authentic Half-Court Set) ──────────────────
// Team 1 (White / Offense): #3 PG, #7 Wing, #23 SG, #15 Center, #4 Power Forward
// Team 2 (Navy / Defense): #30 PG, #9 Forward, #11 Center, #2 Guard, #5 Forward
const courtCoords = {
    x0: 50, y0: 40, x1: 910, y1: 500,
    midX: 480, midY: 270,
    paintRight: { x0: 710, y0: 185, x1: 910, y1: 355 },
    paintLeft: { x0: 50, y0: 185, x1: 250, y1: 355 }
};

const playerPaths = [
    // Offense (White)
    {
        id: 3, role: 'PG', team: 1, jersey: '3',
        keyframes: [
            { t: 0.0, x: 420, y: 270, vx: 2.2, vy: 0.1 },
            { t: 2.5, x: 580, y: 240, vx: 3.1, vy: -0.4 },
            { t: 5.0, x: 670, y: 220, vx: 1.8, vy: 0.2 },
            { t: 9.0, x: 740, y: 260, vx: 4.5, vy: 1.2 }, // Drive to basket
            { t: 10.5, x: 765, y: 275, vx: 0.2, vy: 0.1 }, // Contact with #9
            { t: 14.0, x: 530, y: 290, vx: -3.5, vy: 0.2 }, // Passes back
            { t: 18.0, x: 620, y: 210, vx: 1.2, vy: -0.5 },
            { t: 22.5, x: 700, y: 240, vx: 1.5, vy: 0.3 }
        ]
    },
    {
        id: 15, role: 'C', team: 1, jersey: '15',
        keyframes: [
            { t: 0.0, x: 680, y: 250, vx: 0.5, vy: 0.2 },
            { t: 2.0, x: 780, y: 265, vx: 0.4, vy: 0.1 }, // Enters key at t=1.0
            { t: 4.5, x: 800, y: 270, vx: 0.2, vy: 0.0 }, // 3-second violation fires at t=3.2
            { t: 8.0, x: 730, y: 320, vx: -1.2, vy: 0.8 }, // Clears out
            { t: 12.0, x: 790, y: 310, vx: 1.0, vy: -0.2 },
            { t: 17.0, x: 840, y: 260, vx: 0.8, vy: -0.6 },
            { t: 22.5, x: 820, y: 280, vx: -0.2, vy: 0.1 }
        ]
    },
    {
        id: 7, role: 'Wing', team: 1, jersey: '7',
        keyframes: [
            { t: 0.0, x: 580, y: 110, vx: 1.2, vy: 0.2 },
            { t: 4.0, x: 720, y: 80, vx: 2.1, vy: -0.3 },
            { t: 6.8, x: 850, y: 32, vx: 2.8, vy: -0.8 }, // Steps out of bounds at y=32 (court y0=40)
            { t: 9.0, x: 810, y: 90, vx: -1.5, vy: 1.2 },
            { t: 14.0, x: 750, y: 130, vx: -0.8, vy: 0.4 },
            { t: 18.5, x: 820, y: 140, vx: 1.4, vy: 0.1 },
            { t: 22.5, x: 780, y: 120, vx: -0.5, vy: -0.2 }
        ]
    },
    {
        id: 23, role: 'SG', team: 1, jersey: '23',
        keyframes: [
            { t: 0.0, x: 560, y: 430, vx: 1.0, vy: -0.1 },
            { t: 4.5, x: 680, y: 440, vx: 1.8, vy: 0.1 },
            { t: 8.5, x: 760, y: 410, vx: 1.2, vy: -0.5 },
            { t: 13.0, x: 830, y: 380, vx: 1.1, vy: -0.4 },
            { t: 17.5, x: 790, y: 430, vx: -0.8, vy: 0.8 },
            { t: 22.5, x: 840, y: 400, vx: 0.9, vy: -0.4 }
        ]
    },
    {
        id: 4, role: 'PF', team: 1, jersey: '4',
        keyframes: [
            { t: 0.0, x: 620, y: 360, vx: 1.2, vy: 0.1 },
            { t: 5.0, x: 710, y: 340, vx: 1.4, vy: -0.2 },
            { t: 9.5, x: 680, y: 300, vx: -0.5, vy: -0.8 },
            { t: 14.0, x: 720, y: 240, vx: 0.8, vy: -1.0 },
            { t: 18.0, x: 780, y: 220, vx: 1.2, vy: -0.3 },
            { t: 22.5, x: 760, y: 270, vx: -0.4, vy: 0.8 }
        ]
    },

    // Defense (Navy / Red Accents)
    {
        id: 30, role: 'PG', team: 2, jersey: '30',
        keyframes: [
            { t: 0.0, x: 470, y: 265, vx: 2.1, vy: 0.1 },
            { t: 3.0, x: 620, y: 245, vx: 2.8, vy: -0.3 },
            { t: 7.0, x: 690, y: 230, vx: 1.2, vy: -0.2 },
            { t: 11.0, x: 710, y: 250, vx: 0.4, vy: 0.3 },
            { t: 15.0, x: 440, y: 270, vx: -4.2, vy: 0.1 }, // Steals/deflects past halfcourt (backcourt)
            { t: 19.0, x: 580, y: 225, vx: 2.2, vy: -0.8 },
            { t: 22.5, x: 660, y: 245, vx: 1.4, vy: 0.3 }
        ]
    },
    {
        id: 9, role: 'SF', team: 2, jersey: '9',
        keyframes: [
            { t: 0.0, x: 610, y: 135, vx: 1.0, vy: 0.2 },
            { t: 4.5, x: 735, y: 115, vx: 1.8, vy: -0.2 },
            { t: 8.5, x: 760, y: 210, vx: 0.8, vy: 1.8 },
            { t: 10.5, x: 775, y: 270, vx: 0.1, vy: 0.0 }, // Plants feet, takes charge at t=10.5
            { t: 14.0, x: 710, y: 200, vx: -1.2, vy: -1.2 },
            { t: 18.5, x: 770, y: 165, vx: 1.0, vy: -0.4 },
            { t: 22.5, x: 765, y: 145, vx: -0.1, vy: -0.3 }
        ]
    },
    {
        id: 11, role: 'C', team: 2, jersey: '11',
        keyframes: [
            { t: 0.0, x: 740, y: 260, vx: 0.4, vy: 0.1 },
            { t: 4.0, x: 820, y: 270, vx: 0.8, vy: 0.1 },
            { t: 8.0, x: 840, y: 285, vx: 0.3, vy: 0.2 },
            { t: 12.0, x: 810, y: 310, vx: -0.5, vy: 0.4 },
            { t: 17.0, x: 850, y: 275, vx: 0.6, vy: -0.5 },
            { t: 22.5, x: 835, y: 280, vx: -0.2, vy: 0.1 }
        ]
    },
    {
        id: 2, role: 'SG', team: 2, jersey: '2',
        keyframes: [
            { t: 0.0, x: 600, y: 410, vx: 0.9, vy: -0.1 },
            { t: 5.0, x: 710, y: 415, vx: 1.5, vy: 0.1 },
            { t: 9.0, x: 780, y: 380, vx: 1.1, vy: -0.5 },
            { t: 14.0, x: 810, y: 360, vx: 0.5, vy: -0.3 },
            { t: 18.0, x: 775, y: 400, vx: -0.6, vy: 0.7 },
            { t: 22.5, x: 815, y: 380, vx: 0.7, vy: -0.3 }
        ]
    },
    {
        id: 5, role: 'PF', team: 2, jersey: '5',
        keyframes: [
            { t: 0.0, x: 660, y: 330, vx: 1.0, vy: 0.1 },
            { t: 5.5, x: 745, y: 310, vx: 1.2, vy: -0.2 },
            { t: 10.0, x: 720, y: 275, vx: -0.4, vy: -0.5 },
            { t: 14.5, x: 750, y: 225, vx: 0.5, vy: -0.8 },
            { t: 18.5, x: 800, y: 210, vx: 0.9, vy: -0.2 },
            { t: 22.5, x: 790, y: 250, vx: -0.2, vy: 0.6 }
        ]
    }
];

// Ball trajectory keyframes synced with play
const ballKeyframes = [
    { t: 0.0, x: 425, y: 270, holder: 3 },
    { t: 2.5, x: 585, y: 240, holder: 3 },
    { t: 5.0, x: 675, y: 220, holder: 3 },
    { t: 6.0, x: 775, y: 130, holder: -1 }, // Pass toward wing
    { t: 6.8, x: 852, y: 35, holder: 7 },  // Wing catches near sideline (OOB)
    { t: 8.5, x: 745, y: 260, holder: 3 },  // Pass back to PG
    { t: 10.5, x: 768, y: 278, holder: 3 }, // Drive + charge collision
    { t: 13.5, x: 650, y: 400, holder: -1 }, // Loose ball deflection
    { t: 15.0, x: 435, y: 272, holder: 30 }, // Over midcourt (backcourt)
    { t: 17.5, x: 625, y: 210, holder: 3 },
    { t: 21.4, x: 705, y: 240, holder: 3 },  // Shot clock buzzer
    { t: 22.5, x: 705, y: 240, holder: 3 }
];

// Track trails history
const trailsMap = new Map();
let ballTrail = [];

// ── DOM Elements ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('tracking-canvas');
const ctx = canvas.getContext('2d');

const hudClock = document.getElementById('hud-clock');
const hudFpsPill = document.getElementById('hud-fps-pill');
const violationCallout = document.getElementById('violation-callout');
const calloutType = document.getElementById('callout-type');
const calloutTitle = document.getElementById('callout-title');
const calloutDesc = document.getElementById('callout-desc');

const timelineProgress = document.getElementById('timeline-progress');
const timelineHandle = document.getElementById('timeline-handle');
const timelineWrapper = document.getElementById('timeline-track-wrapper');

const btnSimPlay = document.getElementById('btn-sim-play');
const btnSimSlowmo = document.getElementById('btn-sim-slowmo');
const btnSimPrevViolation = document.getElementById('btn-sim-prev-violation');
const btnSimNextViolation = document.getElementById('btn-sim-next-violation');
const btnSimRestart = document.getElementById('btn-sim-restart');
const jumpSelect = document.getElementById('jump-select');

const statPossession = document.getElementById('stat-possession');
const statShotClock = document.getElementById('stat-shotclock');
const statBallZone = document.getElementById('stat-ballzone');
const statPlayers = document.getElementById('stat-players');
const decisionList = document.getElementById('decision-list');
const btnResetLog = document.getElementById('btn-reset-log');
const btnDownloadTelemetry = document.getElementById('btn-download-telemetry');

// Mode Tab Elements
const tabSim = document.getElementById('tab-sim');
const tabUpload = document.getElementById('tab-upload');
const viewSim = document.getElementById('view-sim');
const viewUpload = document.getElementById('view-upload');

// Upload View Elements
const videoDropzone = document.getElementById('video-dropzone');
const clipFileInput = document.getElementById('clip-file-input');
const btnSelectFile = document.getElementById('btn-select-file');
const uploadPlayerContainer = document.getElementById('upload-player-container');
const uploadedVideo = document.getElementById('uploaded-video');
const uploadedCanvas = document.getElementById('uploaded-canvas');
const uploadedCtx = uploadedCanvas.getContext('2d');
const btnUploadPlay = document.getElementById('btn-upload-play');
const btnUploadSlowmo = document.getElementById('btn-upload-slowmo');
const btnUploadNew = document.getElementById('btn-upload-new');
const uploadFileTag = document.getElementById('upload-file-tag');
const uploadClock = document.getElementById('upload-clock');
const uploadMetaInfo = document.getElementById('upload-meta-info');

// ── App Startup ──────────────────────────────────────────────────────────────
function init() {
    setupControls();
    populateDecisionFeed();
    setupTimelineEvents();
    setupUploadHandlers();
    setupLayerToggles();

    requestAnimationFrame(renderLoop);
}

// ── Controls & Event Listeners ───────────────────────────────────────────────
function setupControls() {
    tabSim.addEventListener('click', () => setMode('sim'));
    tabUpload.addEventListener('click', () => setMode('upload'));

    btnSimPlay.addEventListener('click', togglePlay);
    btnSimSlowmo.addEventListener('click', toggleSlowmo);
    btnSimRestart.addEventListener('click', restartSimulation);
    btnSimPrevViolation.addEventListener('click', jumpToPrevViolation);
    btnSimNextViolation.addEventListener('click', jumpToNextViolation);

    jumpSelect.addEventListener('change', (e) => {
        if (e.target.value !== 'none') {
            seekToTime(parseFloat(e.target.value));
        }
    });

    btnResetLog.addEventListener('click', () => {
        state.currentTime = 0;
        restartSimulation();
    });

    btnDownloadTelemetry.addEventListener('click', exportTelemetryJsonl);

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
            e.preventDefault();
            togglePlay();
        } else if (e.code === 'ArrowRight') {
            seekToTime(Math.min(state.duration, state.currentTime + 1.0));
        } else if (e.code === 'ArrowLeft') {
            seekToTime(Math.max(0, state.currentTime - 1.0));
        }
    });
}

function setupLayerToggles() {
    ['boxes', 'trails', 'zones', 'minimap'].forEach(key => {
        const el = document.getElementById(`toggle-${key}`);
        if (el) {
            el.addEventListener('change', (e) => {
                state.toggles[key] = e.target.checked;
            });
        }
    });
}

function setMode(mode) {
    state.mode = mode;
    tabSim.classList.toggle('active', mode === 'sim');
    tabUpload.classList.toggle('active', mode === 'upload');
    viewSim.classList.toggle('active', mode === 'sim');
    viewUpload.classList.toggle('active', mode === 'upload');

    if (mode === 'sim') {
        state.isPlaying = true;
        btnSimPlay.textContent = 'Pause';
        btnSimPlay.classList.add('primary');
    } else {
        state.isPlaying = false;
        if (!uploadedVideo.paused) uploadedVideo.pause();
    }
}

function togglePlay() {
    state.isPlaying = !state.isPlaying;
    btnSimPlay.textContent = state.isPlaying ? 'Pause' : 'Play';
    btnSimPlay.classList.toggle('primary', state.isPlaying);
}

function toggleSlowmo() {
    state.isSlowMo = !state.isSlowMo;
    btnSimSlowmo.textContent = state.isSlowMo ? '1.0x Normal' : '0.5x Slow-Mo';
    btnSimSlowmo.classList.toggle('primary', state.isSlowMo);
}

function restartSimulation() {
    state.currentTime = 0;
    state.isPlaying = true;
    state.shotClock = 24.0;
    state.activeCallout = null;
    state.highlightedTrackId = null;
    trailsMap.clear();
    ballTrail = [];
    btnSimPlay.textContent = 'Pause';
    btnSimPlay.classList.add('primary');
}

function seekToTime(t) {
    state.currentTime = Math.max(0, Math.min(state.duration, t));
    // Find if a violation happens near this time
    const v = presetViolations.find(item => Math.abs(item.time - state.currentTime) < 0.6);
    if (v) {
        state.activeCallout = v;
        state.highlightedTrackId = v.offendingTrack;
    } else {
        state.activeCallout = null;
        state.highlightedTrackId = null;
    }
}

function jumpToPrevViolation() {
    const prev = [...presetViolations].reverse().find(v => v.time < state.currentTime - 0.5);
    if (prev) seekToTime(prev.time);
    else seekToTime(presetViolations[presetViolations.length - 1].time);
}

function jumpToNextViolation() {
    const next = presetViolations.find(v => v.time > state.currentTime + 0.5);
    if (next) seekToTime(next.time);
    else seekToTime(presetViolations[0].time);
}

// ── Timeline Scrubber ────────────────────────────────────────────────────────
function setupTimelineEvents() {
    timelineWrapper.addEventListener('click', (e) => {
        const rect = timelineWrapper.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        seekToTime(ratio * state.duration);
    });

    // Bookmark Pin Clicks
    document.querySelectorAll('.event-marker').forEach(marker => {
        marker.addEventListener('click', (e) => {
            e.stopPropagation();
            const time = parseFloat(marker.dataset.time);
            seekToTime(time);
        });
    });
}

// ── Decision Feed Population ─────────────────────────────────────────────────
function populateDecisionFeed() {
    decisionList.innerHTML = '';
    presetViolations.forEach(v => {
        const card = document.createElement('div');
        card.className = `decision-card ${v.colorClass}`;
        card.innerHTML = `
            <div class="card-top">
                <span class="card-rule">${v.title}</span>
                <span class="card-timestamp">${v.time.toFixed(1)}s</span>
            </div>
            <p class="card-detail">${v.desc}</p>
            <div class="card-bottom">
                <span class="card-tag">${v.tag}</span>
                <span class="card-jump-link">Jump to Play ➔</span>
            </div>
        `;

        card.addEventListener('click', () => {
            seekToTime(v.time);
            // Highlight active card
            document.querySelectorAll('.decision-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        });

        decisionList.appendChild(card);
    });
}

// ── Interpolation Utilities ──────────────────────────────────────────────────
function getPlayerPosition(player, t) {
    const kfs = player.keyframes;
    if (t <= kfs[0].t) return kfs[0];
    if (t >= kfs[kfs.length - 1].t) return kfs[kfs.length - 1];

    for (let i = 0; i < kfs.length - 1; i++) {
        const k0 = kfs[i];
        const k1 = kfs[i + 1];
        if (t >= k0.t && t <= k1.t) {
            const factor = (t - k0.t) / (k1.t - k0.t);
            // Smooth hermite/cosine interpolation
            const smooth = (1 - Math.cos(factor * Math.PI)) / 2;
            return {
                x: k0.x + (k1.x - k0.x) * smooth,
                y: k0.y + (k1.y - k0.y) * smooth,
                vx: k0.vx + (k1.vx - k0.vx) * factor,
                vy: k0.vy + (k1.vy - k0.vy) * factor
            };
        }
    }
    return kfs[0];
}

function getBallPosition(t) {
    if (t <= ballKeyframes[0].t) return ballKeyframes[0];
    if (t >= ballKeyframes[ballKeyframes.length - 1].t) return ballKeyframes[ballKeyframes.length - 1];

    for (let i = 0; i < ballKeyframes.length - 1; i++) {
        const k0 = ballKeyframes[i];
        const k1 = ballKeyframes[i + 1];
        if (t >= k0.t && t <= k1.t) {
            const factor = (t - k0.t) / (k1.t - k0.t);
            const smooth = (1 - Math.cos(factor * Math.PI)) / 2;
            return {
                x: k0.x + (k1.x - k0.x) * smooth,
                y: k0.y + (k1.y - k0.y) * smooth,
                holder: k0.holder
            };
        }
    }
    return ballKeyframes[0];
}

// ── Main Render Loop ─────────────────────────────────────────────────────────
let lastFrameTimestamp = performance.now();

function renderLoop(now) {
    const deltaMs = now - lastFrameTimestamp;
    lastFrameTimestamp = now;

    if (state.mode === 'sim') {
        if (state.isPlaying) {
            const speed = state.isSlowMo ? 0.5 : 1.0;
            state.currentTime += (deltaMs / 1000) * speed;
            if (state.currentTime >= state.duration) {
                state.currentTime = 0; // Loop possession
            }
        }
        renderSimulation();
    } else if (state.mode === 'upload' && !uploadedVideo.paused) {
        renderUploadedVideoOverlay();
    }

    requestAnimationFrame(renderLoop);
}

// ── Simulation Rendering ─────────────────────────────────────────────────────
function renderSimulation() {
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // 1. Draw Hardwood Court & Line Markings
    drawHardwoodCourt(ctx, W, H);

    // 2. Compute Active Entities
    const currentPlayers = playerPaths.map(p => {
        const pos = getPlayerPosition(p, state.currentTime);
        return {
            id: p.id,
            role: p.role,
            team: p.team,
            jersey: p.jersey,
            x: pos.x,
            y: pos.y,
            vx: pos.vx,
            vy: pos.vy
        };
    });

    const ballPos = getBallPosition(state.currentTime);

    // Update trails
    currentPlayers.forEach(p => {
        if (!trailsMap.has(p.id)) trailsMap.set(p.id, []);
        const trail = trailsMap.get(p.id);
        trail.push({ x: p.x, y: p.y });
        if (trail.length > 20) trail.shift();
    });

    ballTrail.push({ x: ballPos.x, y: ballPos.y });
    if (ballTrail.length > 15) ballTrail.shift();

    // 3. Draw Player Trails
    if (state.toggles.trails) {
        drawEntityTrails(ctx);
    }

    // 4. Draw Players (Tokens + Bounding Boxes)
    drawPlayersAndBoxes(ctx, currentPlayers);

    // 5. Draw Basketball & Possession Indicator
    drawBasketball(ctx, ballPos);

    // 6. Draw 2D Tactical Minimap (Radar)
    if (state.toggles.minimap) {
        drawTacticalRadar(ctx, W, H, currentPlayers, ballPos);
    }

    // 7. Update UI HUD & Scrubber Bar
    updateHUDAndTimeline(currentPlayers, ballPos);

    // 8. Handle Violation Detection & Alerts
    evaluateActiveViolations();
}

// ── Court Geometry Drawing ───────────────────────────────────────────────────
function drawHardwoodCourt(ctx, w, h) {
    // Court Floor
    ctx.fillStyle = '#0a0c13';
    ctx.fillRect(0, 0, w, h);

    // Court Boundary Envelope
    const c = courtCoords;
    ctx.fillStyle = '#0f121d';
    ctx.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);

    // Subtle Plank Grain Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.lineWidth = 1;
    for (let y = c.y0; y < c.y1; y += 16) {
        ctx.beginPath();
        ctx.moveTo(c.x0, y);
        ctx.lineTo(c.x1, y);
        ctx.stroke();
    }

    // Key / Paint Zones
    if (state.toggles.zones) {
        // Right Key
        const rk = c.paintRight;
        const is3SecActive = state.activeCallout && state.activeCallout.rule === 'three_second';
        ctx.fillStyle = is3SecActive ? 'rgba(139, 92, 246, 0.28)' : 'rgba(139, 92, 246, 0.10)';
        ctx.fillRect(rk.x0, rk.y0, rk.x1 - rk.x0, rk.y1 - rk.y0);
        ctx.strokeStyle = is3SecActive ? 'rgba(139, 92, 246, 0.8)' : 'rgba(139, 92, 246, 0.35)';
        ctx.lineWidth = is3SecActive ? 2.5 : 1.5;
        ctx.strokeRect(rk.x0, rk.y0, rk.x1 - rk.x0, rk.y1 - rk.y0);

        // Left Key
        const lk = c.paintLeft;
        ctx.fillStyle = 'rgba(139, 92, 246, 0.10)';
        ctx.fillRect(lk.x0, lk.y0, lk.x1 - lk.x0, lk.y1 - lk.y0);
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(lk.x0, lk.y0, lk.x1 - lk.x0, lk.y1 - lk.y0);
    }

    // Main Lines
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);

    // Half Court Line
    const isBackcourtActive = state.activeCallout && state.activeCallout.rule === 'backcourt_turnover';
    ctx.strokeStyle = isBackcourtActive ? '#00d4ff' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = isBackcourtActive ? 3.0 : 1.5;
    ctx.beginPath();
    ctx.moveTo(c.midX, c.y0);
    ctx.lineTo(c.midX, c.y1);
    ctx.stroke();

    // Center Circle
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.midX, c.midY, 55, 0, Math.PI * 2);
    ctx.stroke();

    // 3-Point Arcs (Right side)
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.x1 - 20, c.midY, 190, Math.PI * 0.58, Math.PI * 1.42);
    ctx.stroke();

    // 3-Point Arcs (Left side)
    ctx.beginPath();
    ctx.arc(c.x0 + 20, c.midY, 190, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.stroke();

    // Baskets & Backboards
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(c.x1 - 20, c.midY - 24); ctx.lineTo(c.x1 - 20, c.midY + 24);
    ctx.moveTo(c.x0 + 20, c.midY - 24); ctx.lineTo(c.x0 + 20, c.midY + 24);
    ctx.stroke();

    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(c.x1 - 32, c.midY, 8, 0, Math.PI * 2);
    ctx.arc(c.x0 + 32, c.midY, 8, 0, Math.PI * 2);
    ctx.fill();
}

function drawEntityTrails(ctx) {
    trailsMap.forEach((trail, id) => {
        if (trail.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) {
            ctx.lineTo(trail[i].x, trail[i].y);
        }
        const isOffense = id <= 23;
        ctx.strokeStyle = isOffense ? 'rgba(0, 212, 255, 0.22)' : 'rgba(239, 68, 68, 0.20)';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    if (ballTrail.length > 2) {
        ctx.beginPath();
        ctx.moveTo(ballTrail[0].x, ballTrail[0].y);
        for (let i = 1; i < ballTrail.length; i++) {
            ctx.lineTo(ballTrail[i].x, ballTrail[i].y);
        }
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.35)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }
}

function drawPlayersAndBoxes(ctx, players) {
    players.forEach(p => {
        const isOffense = p.team === 1;
        const isOffending = state.highlightedTrackId === p.id;

        let baseColor = isOffense ? '#00d4ff' : '#ef4444';
        if (isOffending) baseColor = '#f59e0b'; // Amber highlight for rule violator

        // Bounding Box Dimensions
        const bw = 34;
        const bh = 54;
        const bx = p.x - bw / 2;
        const by = p.y - bh / 2;

        if (state.toggles.boxes) {
            // Box Outline
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = isOffending ? 2.8 : 1.6;
            ctx.strokeRect(bx, by, bw, bh);

            // Translucent fill
            ctx.fillStyle = isOffending ? 'rgba(245, 158, 11, 0.15)' : (isOffense ? 'rgba(0, 212, 255, 0.08)' : 'rgba(239, 68, 68, 0.08)');
            ctx.fillRect(bx, by, bw, bh);

            // Track Label Pill
            const label = `#${p.jersey} ${p.role}`;
            ctx.font = '600 10px "JetBrains Mono", monospace';
            const tw = ctx.measureText(label).width + 8;
            ctx.fillStyle = baseColor;
            ctx.fillRect(bx, by - 14, tw, 14);

            ctx.fillStyle = '#05060a';
            ctx.fillText(label, bx + 4, by - 3);

            // Velocity indicator
            const speedMph = (Math.sqrt(p.vx * p.vx + p.vy * p.vy) * 3.8 + 4.2).toFixed(1);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.font = '500 8.5px "JetBrains Mono", monospace';
            ctx.fillText(`${speedMph} mph`, bx, by + bh + 11);
        }

        // Circular Player Token inside Box
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.fillStyle = isOffense ? '#ffffff' : '#1e293b';
        ctx.fill();
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Jersey Number
        ctx.fillStyle = isOffense ? '#0f172a' : '#ffffff';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.jersey, p.x, p.y);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';

        // Highlighting pulse ring if involved in infraction
        if (isOffending) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 22 + Math.sin(performance.now() * 0.01) * 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });
}

function drawBasketball(ctx, ball) {
    // Glowing halo around ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(251, 146, 60, 0.25)';
    ctx.fill();

    // Ball Body
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fb923c';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Seam lines
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ball.x - 5, ball.y); ctx.lineTo(ball.x + 5, ball.y);
    ctx.stroke();
}

function drawTacticalRadar(ctx, w, h, players, ball) {
    const rw = 160;
    const rh = 90;
    const rx = w - rw - 14;
    const ry = h - rh - 14;

    // Background Panel
    ctx.fillStyle = 'rgba(10, 12, 18, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);

    // Court outline in minimap
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.35)';
    ctx.strokeRect(rx + 6, ry + 6, rw - 12, rh - 12);

    // Half court line
    ctx.beginPath();
    ctx.moveTo(rx + rw / 2, ry + 6);
    ctx.lineTo(rx + rw / 2, ry + rh - 6);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    // Minimap Players
    players.forEach(p => {
        const normX = (p.x - courtCoords.x0) / (courtCoords.x1 - courtCoords.x0);
        const normY = (p.y - courtCoords.y0) / (courtCoords.y1 - courtCoords.y0);
        const px = rx + 6 + normX * (rw - 12);
        const py = ry + 6 + normY * (rh - 12);

        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = p.team === 1 ? '#00d4ff' : '#ef4444';
        ctx.fill();
    });

    // Minimap Ball
    const bNormX = (ball.x - courtCoords.x0) / (courtCoords.x1 - courtCoords.x0);
    const bNormY = (ball.y - courtCoords.y0) / (courtCoords.y1 - courtCoords.y0);
    ctx.beginPath();
    ctx.arc(rx + 6 + bNormX * (rw - 12), ry + 6 + bNormY * (rh - 12), 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fb923c';
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '600 8px Inter, sans-serif';
    ctx.fillText('TACTICAL RADAR', rx + 8, ry + 15);
}

// ── HUD & Scrubber Update ────────────────────────────────────────────────────
function updateHUDAndTimeline(players, ball) {
    const mins = Math.floor(state.currentTime / 60);
    const secs = Math.floor(state.currentTime % 60);
    const ms = Math.floor((state.currentTime % 1) * 100);
    hudClock.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;

    // Update Scrubber
    const progressPct = (state.currentTime / state.duration) * 100;
    timelineProgress.style.width = `${progressPct}%`;
    timelineHandle.style.left = `${progressPct}%`;

    // Shot clock calculation
    state.shotClock = Math.max(0, 24.0 - (state.currentTime % 24.0));
    statShotClock.textContent = state.shotClock.toFixed(1) + 's';

    // Ball location
    statBallZone.textContent = ball.x > courtCoords.midX ? 'Frontcourt (Right)' : 'Backcourt (Left)';
}

// ── Violation Triggers & Callout ─────────────────────────────────────────────
function evaluateActiveViolations() {
    const active = presetViolations.find(v => Math.abs(state.currentTime - v.time) < 0.8);
    if (active) {
        state.activeCallout = active;
        state.highlightedTrackId = active.offendingTrack;

        violationCallout.style.display = 'flex';
        calloutType.textContent = active.tag.toUpperCase();
        calloutTitle.textContent = active.title;
        calloutDesc.textContent = active.desc;

        // Highlight matching card in feed
        document.querySelectorAll('.decision-card').forEach((card, idx) => {
            card.classList.toggle('active', presetViolations[idx] === active);
        });
    } else {
        state.activeCallout = null;
        state.highlightedTrackId = null;
        violationCallout.style.display = 'none';
        document.querySelectorAll('.decision-card').forEach(card => card.classList.remove('active'));
    }
}

// ── Telemetry JSONL Exporter ─────────────────────────────────────────────────
function exportTelemetryJsonl() {
    const records = [];
    const step = 0.033; // 30 FPS
    for (let t = 0; t <= state.duration; t += step) {
        const frameId = Math.round(t * 30);
        const ball = getBallPosition(t);
        const activeV = presetViolations.find(v => Math.abs(t - v.time) < 0.2);

        records.push(JSON.stringify({
            frame_id: frameId,
            timestamp_sec: parseFloat(t.toFixed(3)),
            detections_count: 11,
            ball_coordinates: { x: parseFloat(ball.x.toFixed(1)), y: parseFloat(ball.y.toFixed(1)) },
            shot_clock_remaining: parseFloat(Math.max(0, 24.0 - t).toFixed(1)),
            rule_violation: activeV ? activeV.rule : null,
            latency_ms: parseFloat((12.1 + (frameId % 5) * 0.6).toFixed(1))
        }));
    }

    const blob = new Blob([records.join('\n')], { type: 'application/x-jsonlines' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kinetic_match_telemetry_${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── Upload Mode Management ───────────────────────────────────────────────────
function setupUploadHandlers() {
    btnSelectFile.addEventListener('click', () => clipFileInput.click());
    videoDropzone.addEventListener('click', (e) => {
        if (e.target !== btnSelectFile) clipFileInput.click();
    });

    videoDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        videoDropzone.classList.add('dragover');
    });

    videoDropzone.addEventListener('dragleave', () => {
        videoDropzone.classList.remove('dragover');
    });

    videoDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        videoDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleUploadedFile(e.dataTransfer.files[0]);
        }
    });

    clipFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleUploadedFile(e.target.files[0]);
        }
    });

    btnUploadPlay.addEventListener('click', () => {
        if (uploadedVideo.paused) {
            uploadedVideo.play();
            btnUploadPlay.textContent = 'Pause';
        } else {
            uploadedVideo.pause();
            btnUploadPlay.textContent = 'Play';
        }
    });

    btnUploadSlowmo.addEventListener('click', () => {
        const isSlow = uploadedVideo.playbackRate < 1.0;
        uploadedVideo.playbackRate = isSlow ? 1.0 : 0.5;
        btnUploadSlowmo.textContent = isSlow ? '0.5x' : '1.0x';
    });

    btnUploadNew.addEventListener('click', () => {
        uploadedVideo.pause();
        uploadedVideo.src = '';
        videoDropzone.style.display = 'flex';
        uploadPlayerContainer.style.display = 'none';
    });
}

function handleUploadedFile(file) {
    uploadFileTag.textContent = file.name;
    videoDropzone.style.display = 'none';
    uploadPlayerContainer.style.display = 'flex';

    const url = URL.createObjectURL(file);
    uploadedVideo.src = url;
    uploadedVideo.load();

    uploadedVideo.onloadedmetadata = () => {
        uploadMetaInfo.textContent = `Resolution: ${uploadedVideo.videoWidth} x ${uploadedVideo.videoHeight} (${uploadedVideo.duration.toFixed(1)}s)`;
        uploadedVideo.play().then(() => {
            btnUploadPlay.textContent = 'Pause';
        });
    };
}

function renderUploadedVideoOverlay() {
    const W = uploadedCanvas.parentElement.clientWidth;
    const H = uploadedCanvas.parentElement.clientHeight;

    if (uploadedCanvas.width !== W || uploadedCanvas.height !== H) {
        uploadedCanvas.width = W;
        uploadedCanvas.height = H;
    }

    uploadedCtx.clearRect(0, 0, W, H);

    const t = uploadedVideo.currentTime || 0;
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 100);
    uploadClock.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;

    // Court Perimeter
    uploadedCtx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
    uploadedCtx.lineWidth = 2;
    uploadedCtx.strokeRect(W * 0.08, H * 0.15, W * 0.84, H * 0.70);

    // Client-side Subject Tracking Box Emulation
    for (let i = 0; i < 4; i++) {
        const bx = W * 0.15 + (W * 0.7) * ((Math.sin(t * 0.7 + i * 1.9) + 1) / 2);
        const by = H * 0.25 + (H * 0.5) * ((Math.cos(t * 0.5 + i * 1.5) + 1) / 2);
        const bw = W * 0.08;
        const bh = H * 0.25;

        uploadedCtx.strokeStyle = i === 0 ? '#fb923c' : '#00d4ff';
        uploadedCtx.lineWidth = 1.8;
        uploadedCtx.strokeRect(bx - bw / 2, by - bh / 2, bw, bh);

        const label = i === 0 ? 'SPORTS BALL' : `PLAYER #${i + 1}`;
        uploadedCtx.fillStyle = i === 0 ? '#fb923c' : '#00d4ff';
        uploadedCtx.font = '600 10px "JetBrains Mono", monospace';
        uploadedCtx.fillText(label, bx - bw / 2, by - bh / 2 - 4);
    }
}

// ── Initialize on DOM Load ───────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
