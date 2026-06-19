window.AI = {
  getBestMove(board, aiPlayer, difficulty) {
    if (difficulty === 'easy') {
      const cols = Game.getValidCols(board);
      return cols[Math.floor(Math.random() * cols.length)];
    }

    const opponent = aiPlayer === 1 ? 2 : 1;
    const WIN_SCORE = 100000;
    const searchDepth = difficulty === 'hard' ? 7 : 4;
    const useAB = difficulty === 'hard';
    const centerCol = Math.floor(board.cols / 2);

    function orderedCols(b) {
      return Game.getValidCols(b).sort(
        (a, b) => Math.abs(a - centerCol) - Math.abs(b - centerCol)
      );
    }

    function scoreWindow(aiCount, oppCount) {
      if (aiCount > 0 && oppCount > 0) return 0;
      if (aiCount === 5) return WIN_SCORE;
      if (aiCount === 4) return 1000;
      if (aiCount === 3) return 100;
      if (aiCount === 2) return 10;
      if (aiCount === 1) return 1;
      if (oppCount === 5) return -WIN_SCORE;
      if (oppCount === 4) return -900;
      if (oppCount === 3) return -80;
      if (oppCount === 2) return -8;
      if (oppCount === 1) return -1;
      return 0;
    }

    function evaluate(b) {
      let total = 0;
      const { rows, cols, cells } = b;
      const ctr = Math.floor(cols / 2);

      function checkWindow(r0, c0, dr, dc) {
        let ai = 0, opp = 0;
        for (let i = 0; i < 5; i++) {
          const v = cells[(r0 + dr * i) * cols + (c0 + dc * i)];
          if (v === aiPlayer) ai++;
          else if (v === opponent) opp++;
        }
        total += scoreWindow(ai, opp);
      }

      for (let r = 0; r < rows; r++)
        for (let c = 0; c <= cols - 5; c++) checkWindow(r, c, 0, 1);

      for (let c = 0; c < cols; c++)
        for (let r = 0; r <= rows - 5; r++) checkWindow(r, c, 1, 0);

      for (let r = 0; r <= rows - 5; r++)
        for (let c = 0; c <= cols - 5; c++) checkWindow(r, c, 1, 1);

      for (let r = 0; r <= rows - 5; r++)
        for (let c = 4; c < cols; c++) checkWindow(r, c, 1, -1);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = cells[r * cols + c];
          const bonus = Math.max(0, 3 - Math.abs(c - ctr));
          if (v === aiPlayer) total += bonus;
          else if (v === opponent) total -= bonus;
        }
      }

      return total;
    }

    function minimax(b, depth, isMax, alpha, beta) {
      const cols = orderedCols(b);
      if (depth === 0 || cols.length === 0) return evaluate(b);

      if (isMax) {
        let best = -Infinity;
        for (const col of cols) {
          const res = Game.applyMove(b, col, aiPlayer);
          if (!res) continue;
          const { row } = res;
          if (Game.checkWin(b, row, col, aiPlayer)) {
            Game.undoMove(b, col, row);
            return WIN_SCORE * (depth + 1);
          }
          const val = minimax(b, depth - 1, false, alpha, beta);
          Game.undoMove(b, col, row);
          if (val > best) best = val;
          if (useAB) {
            if (val > alpha) alpha = val;
            if (beta <= alpha) break;
          }
        }
        return best;
      } else {
        let best = Infinity;
        for (const col of cols) {
          const res = Game.applyMove(b, col, opponent);
          if (!res) continue;
          const { row } = res;
          if (Game.checkWin(b, row, col, opponent)) {
            Game.undoMove(b, col, row);
            return -WIN_SCORE * (depth + 1);
          }
          const val = minimax(b, depth - 1, true, alpha, beta);
          Game.undoMove(b, col, row);
          if (val < best) best = val;
          if (useAB) {
            if (val < beta) beta = val;
            if (beta <= alpha) break;
          }
        }
        return best;
      }
    }

    const cols = orderedCols(board);
    let bestCol = cols[0];
    let bestScore = -Infinity;

    for (const col of cols) {
      const res = Game.applyMove(board, col, aiPlayer);
      if (!res) continue;
      const { row } = res;
      if (Game.checkWin(board, row, col, aiPlayer)) {
        Game.undoMove(board, col, row);
        return col;
      }
      const val = minimax(board, searchDepth - 1, false, -Infinity, Infinity);
      Game.undoMove(board, col, row);
      if (val > bestScore) {
        bestScore = val;
        bestCol = col;
      }
    }

    return bestCol;
  }
};
