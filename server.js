const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Connect 5 server running on http://localhost:${PORT}`));

const rooms = new Map();
const socketRooms = new Map();
const queue = [];
const TURN_TIMEOUT_MS = 60_000;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function parseBoardSize(sizeStr) {
  const parts = (sizeStr || '9x9').split('x').map(Number);
  const validSizes = { '7x8': true, '9x9': true, '10x10': true };
  if (validSizes[sizeStr]) return { rows: parts[0], cols: parts[1] };
  return { rows: 9, cols: 9 };
}

function createBoardState(rows, cols) {
  return {
    cells: new Uint8Array(rows * cols),
    colHeights: new Int8Array(cols).fill(rows - 1),
    rows,
    cols,
    moveCount: 0
  };
}

function applyMove(b, col, player) {
  if (b.colHeights[col] < 0) return null;
  const row = b.colHeights[col];
  b.cells[row * b.cols + col] = player;
  b.colHeights[col]--;
  b.moveCount++;
  return row;
}

function checkWin(b, lastRow, lastCol, player) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of directions) {
    const cells = [{ row: lastRow, col: lastCol }];

    for (let step = 1; step <= 4; step++) {
      const r = lastRow + dr * step;
      const c = lastCol + dc * step;
      if (r < 0 || r >= b.rows || c < 0 || c >= b.cols) break;
      if (b.cells[r * b.cols + c] !== player) break;
      cells.push({ row: r, col: c });
    }

    for (let step = 1; step <= 4; step++) {
      const r = lastRow - dr * step;
      const c = lastCol - dc * step;
      if (r < 0 || r >= b.rows || c < 0 || c >= b.cols) break;
      if (b.cells[r * b.cols + c] !== player) break;
      cells.push({ row: r, col: c });
    }

    if (cells.length >= 5) return { winner: player, winLine: cells.slice(0, 5) };
  }
  return null;
}

function isDraw(b) {
  return b.moveCount >= b.rows * b.cols;
}

function resetRoom(room) {
  const { rows, cols } = room.board;
  room.board = createBoardState(rows, cols);
  room.currentPlayer = 1;
  room.phase = 'playing';
  room.rematchVotes.clear();
}

function createRoom(hostId, rows, cols) {
  const code = generateRoomCode();
  const room = {
    code,
    hostId,
    guestId: null,
    board: createBoardState(rows, cols),
    currentPlayer: 1,
    phase: 'waiting',
    playerMap: { [hostId]: 1 },
    rematchVotes: new Set(),
    createdAt: Date.now(),
    turnTimer: null
  };
  rooms.set(code, room);
  socketRooms.set(hostId, code);
  return room;
}

function startTurnTimer(room) {
  if (room.turnTimer) clearTimeout(room.turnTimer);
  room.turnTimer = setTimeout(() => {
    room.phase = 'gameover';
    const losingPlayer = room.currentPlayer;
    const winningPlayer = losingPlayer === 1 ? 2 : 1;
    io.to(room.code).emit('turn_timeout', { losingPlayer, winningPlayer });
  }, TURN_TIMEOUT_MS);
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ boardSize }) => {
    const { rows, cols } = parseBoardSize(boardSize);
    const room = createRoom(socket.id, rows, cols);
    socket.join(room.code);
    socket.emit('room_created', { code: room.code, player: 1 });
  });

  socket.on('join_room', ({ code }) => {
    const room = rooms.get(code ? code.toUpperCase() : '');
    if (!room) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found.' });
      return;
    }
    if (room.phase !== 'waiting') {
      socket.emit('error', { code: 'ROOM_FULL', message: 'Room is already full.' });
      return;
    }
    if (socket.id === room.hostId) {
      socket.emit('error', { code: 'ROOM_FULL', message: 'Cannot join your own room.' });
      return;
    }

    room.guestId = socket.id;
    room.playerMap[socket.id] = 2;
    room.phase = 'playing';
    socket.join(room.code);
    socketRooms.set(socket.id, room.code);

    const gameData = { rows: room.board.rows, cols: room.board.cols, currentPlayer: 1, turnDeadline: Date.now() + TURN_TIMEOUT_MS };
    socket.emit('game_start', { ...gameData, yourPlayer: 2 });
    io.to(room.hostId).emit('game_start', { ...gameData, yourPlayer: 1 });
    startTurnTimer(room);
  });

  socket.on('join_queue', ({ boardSize }) => {
    const sizeKey = parseBoardSize(boardSize);
    const sizeStr = `${sizeKey.rows}x${sizeKey.cols}`;

    // Remove any existing queue entry for this socket
    const existing = queue.findIndex(q => q.socketId === socket.id);
    if (existing !== -1) queue.splice(existing, 1);

    // Look for a waiting player with the same board size
    const matchIdx = queue.findIndex(q => q.boardSize === sizeStr);
    if (matchIdx !== -1) {
      const matched = queue.splice(matchIdx, 1)[0];
      const { rows, cols } = sizeKey;
      const room = createRoom(matched.socketId, rows, cols);
      room.guestId = socket.id;
      room.playerMap[socket.id] = 2;
      room.phase = 'playing';
      socketRooms.set(socket.id, room.code);

      // Both sockets must join the socket.io room for io.to(code) broadcasts
      const matchedSocket = io.sockets.sockets.get(matched.socketId);
      if (matchedSocket) matchedSocket.join(room.code);
      socket.join(room.code);

      const deadline = Date.now() + TURN_TIMEOUT_MS;
      io.to(matched.socketId).emit('game_start', { rows, cols, currentPlayer: 1, yourPlayer: 1, turnDeadline: deadline });
      socket.emit('game_start', { rows, cols, currentPlayer: 1, yourPlayer: 2, turnDeadline: deadline });
      startTurnTimer(room);
    } else {
      queue.push({ socketId: socket.id, boardSize: sizeStr, enqueuedAt: Date.now() });
    }
  });

  socket.on('leave_queue', () => {
    const idx = queue.findIndex(q => q.socketId === socket.id);
    if (idx !== -1) queue.splice(idx, 1);
  });

  socket.on('make_move', ({ col }) => {
    const code = socketRooms.get(socket.id);
    const room = rooms.get(code);

    if (!room || room.phase !== 'playing') {
      socket.emit('error', { code: 'GAME_NOT_ACTIVE', message: 'No active game.' });
      return;
    }
    if (room.playerMap[socket.id] !== room.currentPlayer) {
      socket.emit('error', { code: 'NOT_YOUR_TURN', message: 'Not your turn.' });
      return;
    }
    if (col < 0 || col >= room.board.cols || room.board.colHeights[col] < 0) {
      socket.emit('error', { code: 'INVALID_COLUMN', message: 'Invalid column.' });
      return;
    }

    const movedPlayer = room.currentPlayer;
    const row = applyMove(room.board, col, movedPlayer);
    const winResult = checkWin(room.board, row, col, movedPlayer);
    const drawResult = isDraw(room.board);

    if (winResult || drawResult) room.phase = 'gameover';

    const nextPlayer = movedPlayer === 1 ? 2 : 1;
    room.currentPlayer = nextPlayer;

    if (!winResult && !drawResult) {
      startTurnTimer(room);
    } else {
      clearTimeout(room.turnTimer);
    }

    io.to(code).emit('move_result', {
      col,
      row,
      player: movedPlayer,
      nextPlayer,
      winner: winResult ? winResult.winner : 0,
      winLine: winResult ? winResult.winLine : null,
      draw: drawResult,
      ...(!winResult && !drawResult && { turnDeadline: Date.now() + TURN_TIMEOUT_MS })
    });
  });

  socket.on('request_rematch', () => {
    const code = socketRooms.get(socket.id);
    const room = rooms.get(code);
    if (!room || room.phase !== 'gameover') return;

    room.rematchVotes.add(socket.id);

    if (room.rematchVotes.size >= 2) {
      resetRoom(room);
      const p1 = room.hostId;
      const p2 = room.guestId;
      const rematchDeadline = Date.now() + TURN_TIMEOUT_MS;
      io.to(p1).emit('rematch_start', { rows: room.board.rows, cols: room.board.cols, currentPlayer: 1, yourPlayer: room.playerMap[p1], turnDeadline: rematchDeadline });
      io.to(p2).emit('rematch_start', { rows: room.board.rows, cols: room.board.cols, currentPlayer: 1, yourPlayer: room.playerMap[p2], turnDeadline: rematchDeadline });
      startTurnTimer(room);
    } else {
      const opponentId = socket.id === room.hostId ? room.guestId : room.hostId;
      if (opponentId) io.to(opponentId).emit('opponent_wants_rematch');
    }
  });

  socket.on('cancel_room', () => {
    const code = socketRooms.get(socket.id);
    const room = rooms.get(code);
    if (room && room.phase === 'waiting' && room.hostId === socket.id) {
      clearTimeout(room.turnTimer);
      rooms.delete(code);
      socketRooms.delete(socket.id);
      socket.leave(code);
    }
  });

  socket.on('disconnect', () => {
    const idx = queue.findIndex(q => q.socketId === socket.id);
    if (idx !== -1) queue.splice(idx, 1);

    const code = socketRooms.get(socket.id);
    socketRooms.delete(socket.id);

    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    const opponentId = socket.id === room.hostId ? room.guestId : room.hostId;
    if (opponentId && (room.phase === 'playing' || room.phase === 'waiting')) {
      io.to(opponentId).emit('opponent_disconnected', { message: 'Your opponent disconnected.' });
    }

    clearTimeout(room.turnTimer);
    rooms.delete(code);
    if (opponentId) socketRooms.delete(opponentId);
  });
});

// Clean up stale waiting rooms
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (room.phase === 'waiting' && room.createdAt < cutoff) {
      rooms.delete(code);
      socketRooms.delete(room.hostId);
    }
  }
}, 60_000);
