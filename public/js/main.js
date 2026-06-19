const VERSION = '0.0.0';

document.addEventListener('DOMContentLoaded', () => {
  let gameMode = null;
  let boardSizeKey = '9x9';
  let difficulty = 'medium';
  let board = null;
  let myPlayer = null;
  let currentPlayer = 1;
  let gameOver = false;
  let currentRoomCode = '';
  let onlineAction = null;
  let countdownInterval = null;

  // ── Game start ────────────────────────────────────────────────────────────

  function startLocalOrAIGame() {
    const size = Game.BOARD_SIZES[boardSizeKey];
    board = Game.createBoard(size.rows, size.cols);
    currentPlayer = 1;
    gameOver = false;
    myPlayer = null;

    UI.setTurnIndicator(1);
    UI.hideGameover();
    UI.showScreen('screen-game');

    if (gameMode === 'ai') {
      UI.setPlayerLabels('You (Red)', 'Computer (Yellow)');
    } else {
      UI.setPlayerLabels('Player 1 (Red)', 'Player 2 (Yellow)');
    }

    Renderer.init(board);
    Renderer.currentPlayer = 1;
    Renderer.myPlayer = null;
    Renderer.gameMode = gameMode;
    Renderer.onColumnClick = handleColumnClick;
  }

  function startCountdown(deadline) {
    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      const secsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      UI.setTurnIndicator(currentPlayer, secsLeft, myPlayer);
      if (secsLeft <= 0 || gameOver) clearInterval(countdownInterval);
    }, 1000);
  }

  // ── Move handling ─────────────────────────────────────────────────────────

  function handleColumnClick(col) {
    if (gameOver || Renderer.animating) return;
    if (gameMode === 'online' && currentPlayer !== myPlayer) return;

    const row = board.colHeights[col];
    if (row < 0) return;

    if (gameMode === 'online') {
      SocketClient.makeMove(col);
      return;
    }

    doLocalMove(col, row, currentPlayer);
  }

  function doLocalMove(col, row, player) {
    Sound.playDrop();
    Renderer.animateDrop(board, col, row, player, () => {
      Game.applyMove(board, col, player);
      Renderer.drawBoard(board);
      afterMove(row, col, player);
    });
  }

  function afterMove(row, col, player) {
    const winResult = Game.checkWin(board, row, col, player);
    if (winResult) {
      gameOver = true;
      Sound.playWin();
      Renderer.drawWinLine(board, winResult.winLine, () => {
        UI.showGameover(player === 1 ? 'Red Wins!' : 'Yellow Wins!');
      });
      return;
    }

    if (Game.isDraw(board)) {
      gameOver = true;
      Sound.playDraw();
      UI.showGameover("It's a Draw!");
      return;
    }

    currentPlayer = player === 1 ? 2 : 1;
    Renderer.currentPlayer = currentPlayer;
    UI.setTurnIndicator(currentPlayer);

    if (gameMode === 'ai' && currentPlayer === 2) {
      Renderer.clearHover();
      setTimeout(() => {
        const aiCol = AI.getBestMove(board, 2, difficulty);
        doLocalMove(aiCol, board.colHeights[aiCol], 2);
      }, 200);
    }
  }

  // ── Home screen ───────────────────────────────────────────────────────────

  document.getElementById('btn-vs-ai').addEventListener('click', () => {
    gameMode = 'ai';
    UI.showDifficultySection();
    UI.showScreen('screen-setup');
  });

  document.getElementById('btn-vs-local').addEventListener('click', () => {
    gameMode = 'local';
    UI.hideDifficultySection();
    UI.showScreen('screen-setup');
  });

  document.getElementById('btn-vs-online').addEventListener('click', () => {
    gameMode = 'online';
    UI.showScreen('screen-online-lobby');
  });

  // ── Setup screen ──────────────────────────────────────────────────────────

  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      boardSizeKey = btn.dataset.size;
      UI.setSelectedBoardSize(boardSizeKey);
    });
  });

  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      difficulty = btn.dataset.difficulty;
      UI.setSelectedDifficulty(difficulty);
    });
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    if (gameMode === 'online') {
      if (onlineAction === 'create') {
        SocketClient.createRoom(boardSizeKey);
      } else {
        SocketClient.joinQueue(boardSizeKey);
        UI.showScreen('screen-matchmaking');
      }
    } else {
      startLocalOrAIGame();
    }
  });

  document.getElementById('btn-setup-back').addEventListener('click', () => {
    UI.showScreen(gameMode === 'online' ? 'screen-online-lobby' : 'screen-home');
  });

  // ── Online lobby ──────────────────────────────────────────────────────────

  document.getElementById('btn-create-room').addEventListener('click', () => {
    onlineAction = 'create';
    UI.hideDifficultySection();
    UI.showScreen('screen-setup');
  });

  document.getElementById('btn-copy-code').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(currentRoomCode);
      UI.showToast('Code copied!');
    } catch {
      UI.showToast(currentRoomCode);
    }
  });

  document.getElementById('btn-join-room').addEventListener('click', () => {
    const code = document.getElementById('room-code-input').value.trim();
    if (!code) {
      UI.showToast('Please enter a room code.');
      return;
    }
    SocketClient.joinRoom(code);
  });

  document.getElementById('room-code-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-join-room').click();
  });

  document.getElementById('btn-find-opponent').addEventListener('click', () => {
    onlineAction = 'find';
    UI.hideDifficultySection();
    UI.showScreen('screen-setup');
  });

  document.getElementById('btn-lobby-back').addEventListener('click', () => {
    UI.showScreen('screen-home');
  });

  document.getElementById('btn-cancel-queue').addEventListener('click', () => {
    SocketClient.leaveQueue();
    UI.showScreen('screen-online-lobby');
  });

  document.getElementById('btn-cancel-waiting').addEventListener('click', () => {
    SocketClient.cancelRoom();
    UI.showScreen('screen-online-lobby');
  });

  // ── Gameover actions ──────────────────────────────────────────────────────

  document.getElementById('btn-play-again').addEventListener('click', () => {
    if (gameMode === 'online') {
      SocketClient.requestRematch();
      UI.showWaitingRematch();
      document.getElementById('btn-play-again').disabled = true;
    } else {
      startLocalOrAIGame();
    }
  });

  document.getElementById('btn-main-menu').addEventListener('click', () => {
    gameOver = true;
    UI.showScreen('screen-home');
  });

  document.getElementById('btn-quit-game').addEventListener('click', () => {
    gameOver = true;
    UI.showScreen('screen-home');
  });

  document.getElementById('btn-mute').addEventListener('click', () => {
    const muted = Sound.toggleMute();
    document.getElementById('btn-mute').textContent = muted ? '🔇' : '🔊';
  });

  // ── Socket events ─────────────────────────────────────────────────────────

  SocketClient.on('room_created', (data) => {
    currentRoomCode = data.code;
    myPlayer = data.player;
    UI.setRoomCode(data.code);
    UI.showScreen('screen-waiting-room');
  });

  SocketClient.on('game_start', (data) => {
    myPlayer = data.yourPlayer;
    board = Game.createBoard(data.rows, data.cols);
    currentPlayer = data.currentPlayer;
    gameOver = false;

    UI.setPlayerLabels(
      myPlayer === 1 ? 'Red (You)' : 'Red (Opp)',
      myPlayer === 2 ? 'Yellow (You)' : 'Yellow (Opp)'
    );
    UI.setTurnIndicator(currentPlayer, undefined, myPlayer);
    if (gameMode === 'online' && data.turnDeadline) startCountdown(data.turnDeadline);
    UI.hideGameover();
    UI.showScreen('screen-game');

    Renderer.init(board);
    Renderer.currentPlayer = currentPlayer;
    Renderer.myPlayer = myPlayer;
    Renderer.gameMode = 'online';
    Renderer.onColumnClick = handleColumnClick;
  });

  SocketClient.on('move_result', (data) => {
    const { col, row, player, nextPlayer, winner, winLine, draw } = data;
    Sound.playDrop();
    Renderer.animateDrop(board, col, row, player, () => {
      Game.applyMove(board, col, player);
      Renderer.drawBoard(board);
      if (winner) {
        gameOver = true;
        clearInterval(countdownInterval);
        Sound.playWin();
        Renderer.drawWinLine(board, winLine, () => {
          UI.showGameover(winner === myPlayer ? 'You Win!' : 'You Lose.');
        });
      } else if (draw) {
        gameOver = true;
        clearInterval(countdownInterval);
        Sound.playDraw();
        UI.showGameover("It's a Draw!");
      } else {
        currentPlayer = nextPlayer;
        Renderer.currentPlayer = currentPlayer;
        UI.setTurnIndicator(currentPlayer, undefined, myPlayer);
        if (gameMode === 'online' && data.turnDeadline) startCountdown(data.turnDeadline);
      }
    });
  });

  SocketClient.on('opponent_disconnected', () => {
    clearInterval(countdownInterval);
    gameOver = true;
    UI.showGameover('Opponent disconnected.');
  });

  SocketClient.on('opponent_wants_rematch', () => {
    UI.showToast('Opponent wants a rematch!');
  });

  SocketClient.on('rematch_start', (data) => {
    myPlayer = data.yourPlayer;
    board = Game.createBoard(board.rows, board.cols);
    currentPlayer = data.currentPlayer;
    gameOver = false;
    document.getElementById('btn-play-again').disabled = false;

    Renderer.init(board);
    Renderer.currentPlayer = currentPlayer;
    Renderer.onColumnClick = handleColumnClick;
    UI.setTurnIndicator(currentPlayer);
    if (gameMode === 'online' && data.turnDeadline) startCountdown(data.turnDeadline);
    UI.hideGameover();
  });

  SocketClient.on('error', (data) => {
    UI.showToast(data.message);
  });

  SocketClient.on('turn_timeout', ({ losingPlayer }) => {
    clearInterval(countdownInterval);
    gameOver = true;
    UI.showGameover(losingPlayer === myPlayer ? 'Time ran out. You lose.' : 'Opponent timed out. You win!');
  });

  SocketClient.on('connection_status', ({ state }) => {
    if (gameMode !== 'online') return;
    const banner = document.getElementById('connection-banner');
    const bannerText = document.getElementById('connection-banner-text');
    switch (state) {
      case 'connected':
        banner.classList.add('hidden');
        banner.classList.remove('error');
        break;
      case 'disconnected':
      case 'reconnecting':
        bannerText.textContent = 'Connection lost — reconnecting…';
        banner.classList.remove('hidden', 'error');
        break;
      case 'failed':
        bannerText.textContent = 'Connection lost — please refresh the page.';
        banner.classList.remove('hidden');
        banner.classList.add('error');
        if (document.getElementById('screen-game').classList.contains('active')) {
          gameOver = true;
          UI.showScreen('screen-home');
        }
        break;
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────────

  UI.setSelectedBoardSize('9x9');
  UI.setSelectedDifficulty('medium');
});
