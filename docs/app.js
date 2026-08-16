// ══════════════════════════════════════════════════════════════════════════════
// Kinetic-Edge — GitHub Pages Interactive Web Showcase
// Simulates live YOLOv8 + ByteTrack detection & referee heuristics in browser
// ══════════════════════════════════════════════════════════════════════════════

const canvas = document.getElementById('demo-canvas');
const ctx = canvas.getContext('2d');

const playPauseBtn = document.getElementById('play-pause-btn');
const slowmoBtn = document.getElementById('slowmo-btn');
const restartBtn = document.getElementById('restart-btn');
const alertsList = document.getElementById('alerts-list');
const alertCountBadge = document.getElementById('alert-count-badge');
const fpsCounter = document.getElementById('fps-counter');

let isPlaying = true;
let isSlowMo = false;
let frameNumber = 0;
let alertCount = 0;
let lastTime = performance.now();

// Court dimensions in canvas space
const court = {
    x0: 50, y0: 40,
    x1: 590, y1: 440
};

// Simulated basketball players
const players = [
    { id: 1, name: "Guard", team: 1, x: 120, y: 220, vx: 2.2, vy: 1.1, history: [] },
    { id: 2, name: "Forward", team: 1, x: 260, y: 160, vx: 1.8, vy: 1.9, history: [] },
    { id: 3, name: "Center", team: 1, x: 380, y: 240, vx: 0.9, vy: 0.7, history: [] },
    { id: 4, name: "Defender", team: 2, x: 160, y: 210, vx: 2.1, vy: 1.0, history: [] },
    { id: 5, name: "Defender", team: 2, x: 290, y: 180, vx: 1.6, vy: 1.7, history: [] },
    { id: 6, name: "Defender", team: 2, x: 420, y: 260, vx: 0.8, vy: 0.9, history: [] },
    { id: 7, name: "Wing", team: 1, x: 520, y: 70, vx: 2.4, vy: -1.2, history: [] }, // steps out of bounds
];

const ball = { x: 130, y: 225, vx: 2.5, vy: 1.2, holder: 1 };

const alertEvents = [
    { frame: 45, type: "boundary", title: "⚠️ Out of Bounds", detail: "Player (Track #7) stepped over the sideline boundary" },
    { frame: 120, type: "possession", title: "🔄 Possession Change", detail: "Ball proximity shifted from Track #1 to Track #4" },
    { frame: 190, type: "foul", title: "🚩 Potential Contact / Foul", detail: "Track #4 acceleration spike (2.3σ) during drive on Track #2" },
];

function drawCourt() {
    // Dark floor
    ctx.fillStyle = "#11111a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Court boundary lines
    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(court.x0, court.y0, court.x1 - court.x0, court.y1 - court.y0);

    // Half court line
    ctx.beginPath();
    ctx.moveTo((court.x0 + court.x1) / 2, court.y0);
    ctx.lineTo((court.x0 + court.x1) / 2, court.y1);
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc((court.x0 + court.x1) / 2, (court.y0 + court.y1) / 2, 45, 0, Math.PI * 2);
    ctx.stroke();

    // Key areas / 3-point lines
    ctx.strokeStyle = "rgba(0, 212, 255, 0.4)";
    ctx.strokeRect(court.x0, 180, 110, 120);
    ctx.strokeRect(court.x1 - 110, 180, 110, 120);
}

function updatePositions() {
    frameNumber++;

    players.forEach(p => {
        p.x += p.vx * (isSlowMo ? 0.5 : 1.0);
        p.y += p.vy * (isSlowMo ? 0.5 : 1.0);

        // Record trajectory
        p.history.push({ x: p.x, y: p.y });
        if (p.history.length > 15) p.history.shift();

        // Bounce within court (except player 7 who steps out)
        if (p.id !== 7) {
            if (p.x < court.x0 + 20 || p.x > court.x1 - 20) p.vx *= -1;
            if (p.y < court.y0 + 20 || p.y > court.y1 - 20) p.vy *= -1;
        } else {
            if (p.x > court.x1 - 10 || p.x < court.x0 + 10) p.vx *= -1;
            if (p.y < court.y0 - 15 || p.y > court.y1 + 15) p.vy *= -1;
        }
    });

    // Ball movement
    ball.x += ball.vx * (isSlowMo ? 0.5 : 1.0);
    ball.y += ball.vy * (isSlowMo ? 0.5 : 1.0);
    if (ball.x < court.x0 + 20 || ball.x > court.x1 - 20) ball.vx *= -1;
    if (ball.y < court.y0 + 20 || ball.y > court.y1 - 20) ball.vy *= -1;

    // Check alerts
    alertEvents.forEach(evt => {
        if (frameNumber === evt.frame) {
            triggerAlert(evt);
        }
    });
}

function render() {
    drawCourt();

    // Draw player tracking boxes & labels
    players.forEach(p => {
        const isOutOfBounds = (p.x < court.x0 || p.x > court.x1 || p.y < court.y0 || p.y > court.y1);
        const color = isOutOfBounds ? "#ff3d5a" : (p.team === 1 ? "#00e676" : "#00d4ff");

        // Trajectory line
        if (p.history.length > 1) {
            ctx.beginPath();
            ctx.moveTo(p.history[0].x, p.history[0].y);
            p.history.forEach(pt => ctx.lineTo(pt.x, pt.y));
            ctx.strokeStyle = color + "44";
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Bounding box
        const bw = 28, bh = 44;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - bw/2, p.y - bh/2, bw, bh);

        // Label banner
        const label = `person #${p.id}`;
        ctx.fillStyle = color;
        ctx.fillRect(p.x - bw/2, p.y - bh/2 - 14, bw + 22, 14);
        ctx.fillStyle = "#06060a";
        ctx.font = "bold 9px monospace";
        ctx.fillText(label, p.x - bw/2 + 2, p.y - bh/2 - 3);
    });

    // Draw ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ff6b2b";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Frame counter
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "11px monospace";
    ctx.fillText(`FRAME: ${frameNumber} | MODEL: YOLOv8n`, 14, 24);

    if (isPlaying) {
        updatePositions();
    }

    requestAnimationFrame(render);
}

function triggerAlert(evt) {
    alertCount++;
    alertCountBadge.textContent = `${alertCount} Alerts`;

    const card = document.createElement('div');
    card.className = `alert-card ${evt.type}`;
    card.innerHTML = `
        <div class="alert-header">
            <span class="alert-type">${evt.title}</span>
            <span class="alert-time">Frame #${evt.frame}</span>
        </div>
        <div class="alert-detail">${evt.detail}</div>
    `;

    alertsList.insertBefore(card, alertsList.firstChild);
}

// Controls
playPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    playPauseBtn.textContent = isPlaying ? "⏸️ Pause" : "▶️ Resume";
    playPauseBtn.classList.toggle('active', !isPlaying);
});

slowmoBtn.addEventListener('click', () => {
    isSlowMo = !isSlowMo;
    slowmoBtn.textContent = isSlowMo ? "⚡ 1.0x Normal" : "🐢 0.5x Slow-Mo";
    slowmoBtn.classList.toggle('active', isSlowMo);
});

restartBtn.addEventListener('click', () => {
    frameNumber = 0;
    alertCount = 0;
    alertsList.innerHTML = '';
    alertCountBadge.textContent = '0 Alerts';
    isPlaying = true;
    playPauseBtn.textContent = "⏸️ Pause";
    playPauseBtn.classList.remove('active');
});

// Initial trigger
setTimeout(() => triggerAlert(alertEvents[0]), 800);

render();
