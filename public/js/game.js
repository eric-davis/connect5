window.Game = {};

Game.BOARD_SIZES = {
  '7x8':   { rows: 7,  cols: 8,  label: '7×8'   },
  '9x9':   { rows: 9,  cols: 9,  label: '9×9'   },
  '10x10': { rows: 10, cols: 10, label: '10×10' }
};

Game.createBoard = function(rows, cols) {
  const cells = new Uint8Array(rows * cols);
  const colHeights = new Int8Array(cols).fill(rows - 1);
  return { cells, rows, cols, colHeights, moveCount: 0, lastMove: null };
};

Game.applyMove = function(board, col, player) {
  if (board.colHeights[col] < 0) return null;
  const row = board.colHeights[col];
  board.cells[row * board.cols + col] = player;
  board.colHeights[col]--;
  board.moveCount++;
  board.lastMove = { row, col, player };
  return { row };
};

Game.undoMove = function(board, col, row) {
  board.cells[row * board.cols + col] = 0;
  board.colHeights[col]++;
  board.moveCount--;
  board.lastMove = null;
};

Game.checkWin = function(board, lastRow, lastCol, player) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of directions) {
    const cells = [{ row: lastRow, col: lastCol }];

    for (let step = 1; step <= 4; step++) {
      const r = lastRow + dr * step;
      const c = lastCol + dc * step;
      if (r < 0 || r >= board.rows || c < 0 || c >= board.cols) break;
      if (board.cells[r * board.cols + c] !== player) break;
      cells.push({ row: r, col: c });
    }

    for (let step = 1; step <= 4; step++) {
      const r = lastRow - dr * step;
      const c = lastCol - dc * step;
      if (r < 0 || r >= board.rows || c < 0 || c >= board.cols) break;
      if (board.cells[r * board.cols + c] !== player) break;
      cells.push({ row: r, col: c });
    }

    if (cells.length >= 5) return { winner: player, winLine: cells.slice(0, 5) };
  }
  return null;
};

Game.isDraw = function(board) {
  return board.moveCount >= board.rows * board.cols;
};

Game.getValidCols = function(board) {
  const valid = [];
  for (let col = 0; col < board.cols; col++) {
    if (board.colHeights[col] >= 0) valid.push(col);
  }
  return valid;
};

Game.clone = function(board) {
  return {
    cells:      new Uint8Array(board.cells),
    colHeights: new Int8Array(board.colHeights),
    rows:       board.rows,
    cols:       board.cols,
    moveCount:  board.moveCount,
    lastMove:   board.lastMove ? { ...board.lastMove } : null
  };
};
