/**
 * Typing Battle - Server-side Module
 */

const WORD_LIST = [
    "antigravity", "multiplayer", "visualization", "synchronization", 
    "performance", "experience", "interactive", "architecture",
    "developer", "algorithm", "parameter", "framework",
    "javascript", "express", "socket-io", "minecraft",
    "adventure", "competition", "leaderboard", "keyboard",
    "interface", "modular", "environment", "simulation", "networking",
    "connection", "broadcast", "validation", "aesthetics", "typography",
    "repository", "optimization", "engineering", "abstraction", "component",
    "deployment", "encryption", "initialize", "middleware", "persistence",
    "prototype", "rendering", "scalability", "transition", "versatile",
    "bytecode", "compiler", "debugger", "ethernet", "firewall",
    "gigabyte", "hardware", "internet", "joystick", "mainframe",
    "database", "protocol", "bandwidth", "frontend", "backend",
    "software", "firmware", "terminal", "console", "variable",
    "function", "iteration", "recursion", "boolean", "integer",
    "floating", "character", "security", "firewall", "gateway"
];

const rooms = new Map();

export function initTypingServer(io) {
    const typingIo = io.of('/typing');

    typingIo.on('connection', (socket) => {
        console.log(`[Typing] Connected: ${socket.id}`);

        socket.on('joinRoom', ({ room, name }) => {
            socket.join(room);
            
            if (!rooms.has(room)) {
                rooms.set(room, {
                    players: new Map(),
                    currentWord: getRandomWord(),
                    winner: null
                });
            }

            const roomData = rooms.get(room);
            roomData.players.set(socket.id, {
                id: socket.id,
                name: name,
                points: 0
            });

            // Send initial state
            socket.emit('newWord', { word: roomData.currentWord });
            typingIo.to(room).emit('updateLeaderboard', Array.from(roomData.players.values()));
        });

        socket.on('submitWord', ({ room, word }) => {
            const roomData = rooms.get(room);
            if (!roomData || roomData.winner) return;

            if (word === roomData.currentWord) {
                const player = roomData.players.get(socket.id);
                if (player) {
                    player.points += 1;
                    
                    if (player.points >= 5) {
                        roomData.winner = player.id;
                        typingIo.to(room).emit('gameOver', { winnerName: player.name });
                    } else {
                        roomData.currentWord = getRandomWord();
                        typingIo.to(room).emit('newWord', { word: roomData.currentWord });
                        typingIo.to(room).emit('updateLeaderboard', Array.from(roomData.players.values()));
                    }
                }
            }
        });

        socket.on('disconnect', () => {
            rooms.forEach((roomData, roomName) => {
                if (roomData.players.has(socket.id)) {
                    roomData.players.delete(socket.id);
                    if (roomData.players.size === 0) {
                        rooms.delete(roomName);
                    } else {
                        typingIo.to(roomName).emit('updateLeaderboard', Array.from(roomData.players.values()));
                    }
                }
            });
        });
    });
}

function getRandomWord() {
    return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
}
