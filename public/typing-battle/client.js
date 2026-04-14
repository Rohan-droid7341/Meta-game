/**
 * Typing Battle - Client Module
 * Handles all 2D typing game logic and socket sync
 */

const socket = io('/typing');

const targetWordEl = document.getElementById('target-word');
const inputDisplayEl = document.getElementById('input-display');
const cursorEl = document.getElementById('cursor');
const playerListEl = document.getElementById('player-list');
const wordWrapperEl = document.getElementById('word-wrapper');
const winOverlayEl = document.getElementById('win-overlay');
const winnerNameEl = document.getElementById('winner-name');
const backToLobbyBtn = document.getElementById('back-to-lobby');

let currentTarget = "";
let currentInput = "";
let isGameOver = false;

// ─── INITIALIZATION ──────────────────────────────────────

// Get room from URL or default
const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get('room') || 'default-room';
const playerName = urlParams.get('name') || `Guest-${Math.floor(Math.random() * 9999)}`;

socket.emit('joinRoom', { room, name: playerName });

// ─── SOCKET LISTENERS ────────────────────────────────────

socket.on('newWord', (data) => {
    currentTarget = data.word;
    currentInput = "";
    updateDisplay();
    wordWrapperEl.classList.remove('shake');
});

socket.on('updateLeaderboard', (players) => {
    renderLeaderboard(players);
});

socket.on('gameOver', (data) => {
    isGameOver = true;
    winnerNameEl.textContent = `${data.winnerName} Wins!`;
    winOverlayEl.classList.remove('hidden');
});

// ─── INPUT HANDLING ──────────────────────────────────────

window.addEventListener('keydown', (e) => {
    if (isGameOver) return;

    // Prevention of default browser shortcuts
    if (e.key === 'Tab' || e.key === 'Escape') e.preventDefault();

    if (e.key === 'Enter') {
        submitWord();
    } else if (e.key === 'Backspace') {
        currentInput = currentInput.slice(0, -1);
        updateDisplay();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        // Only allow typing up to target word length + a bit
        if (currentInput.length < currentTarget.length + 5) {
            currentInput += e.key;
            updateDisplay();
        }
    }
});

function submitWord() {
    if (currentInput === currentTarget) {
        socket.emit('submitWord', { room, word: currentInput });
    } else {
        // Wrong word - try again from start of this word
        currentInput = "";
        updateDisplay();
        triggerShake();
    }
}

// ─── VISUAL UPDATES ──────────────────────────────────────

function updateDisplay() {
    targetWordEl.textContent = currentTarget;

    // Create spans for characters to color them
    let html = "";
    for (let i = 0; i < currentInput.length; i++) {
        const char = currentInput[i];
        const targetChar = currentTarget[i];

        if (char === targetChar) {
            html += `<span style="color: var(--correct-color)">${char}</span>`;
        } else {
            html += `<span style="color: var(--wrong-color)">${char}</span>`;
        }
    }
    inputDisplayEl.innerHTML = html;

    // Position cursor
    const charWidth = getCharWidth();
    cursorEl.style.left = `${currentInput.length * charWidth}px`;
}

function getCharWidth() {
    // Measure a single character from the mono font including letter-spacing
    const span = document.createElement('span');
    const style = getComputedStyle(targetWordEl);
    span.style.font = style.font;
    span.style.letterSpacing = style.letterSpacing;
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.textContent = 'A';
    document.body.appendChild(span);
    const width = span.getBoundingClientRect().width;
    document.body.removeChild(span);
    return width;
}

function renderLeaderboard(players) {
    playerListEl.innerHTML = players
        .sort((a, b) => b.points - a.points)
        .map(p => `
            <div class="player-item">
                <span class="player-name">${p.name}</span>
                <span class="player-score">${p.points}</span>
            </div>
        `).join('');
}

function triggerShake() {
    wordWrapperEl.classList.remove('shake');
    void wordWrapperEl.offsetWidth; // Trigger reflow
    wordWrapperEl.classList.add('shake');
}

// ─── NAVIGATION ──────────────────────────────────────────

backToLobbyBtn.addEventListener('click', () => {
    window.location.href = '/';
});
