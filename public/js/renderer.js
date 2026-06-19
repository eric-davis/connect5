window.Renderer = {
  onColumnClick: null,
  animating: false,
  currentPlayer: 1,
  _board: null,
  _canvas: null,
  _ctx: null,
  _cellSize: 0,
  _offsetX: 0,
  _offsetY: 0,
  _hoveredCol: -1,

  init(board) {
    this._board = board;
    this._canvas = document.getElementById('game-canvas');
    this._ctx = this._canvas.getContext('2d');
    this._resizeCanvas();
    this._canvas.addEventListener('click', this._handleClick.bind(this));
    this._canvas.addEventListener('mousemove', this._handleMouseMove.bind(this));
    this._canvas.addEventListener('mouseleave', () => {
      this._hoveredCol = -1;
      this.drawBoard(this._board);
    });
    window.addEventListener('resize', () => this._resizeCanvas());
  },

  _resizeCanvas() {
    const container = document.querySelector('.canvas-container');
    const availW = container.clientWidth - 20;
    const availH = container.clientHeight - 20;
    const b = this._board;
    const cs = Math.min(Math.floor(availW / b.cols), Math.floor(availH / b.rows), 80);
    this._cellSize = cs;
    this._canvas.width = b.cols * cs;
    this._canvas.height = b.rows * cs;
    this._offsetX = 0;
    this._offsetY = 0;
    this.drawBoard(b);
  },

  _cx(col) { return col * this._cellSize + this._cellSize / 2; },
  _cy(row) { return row * this._cellSize + this._cellSize / 2; },

  _colFromEvent(e) {
    const rect = this._canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    return Math.floor(x / this._cellSize);
  },

  _handleClick(e) {
    if (this.animating) return;
    const col = this._colFromEvent(e);
    if (col >= 0 && col < this._board.cols && this.onColumnClick) {
      this._hoveredCol = -1;
      this.onColumnClick(col);
    }
  },

  _handleMouseMove(e) {
    if (this.animating) return;
    const col = this._colFromEvent(e);
    const newHover = (col >= 0 && col < this._board.cols) ? col : -1;
    if (newHover !== this._hoveredCol) {
      this._hoveredCol = newHover;
      this.drawBoard(this._board);
    }
  },

  _pieceColor(player) {
    return player === 1 ? '#ef4444' : '#eab308';
  },

  _hoverColor(player) {
    return player === 1 ? 'rgba(239,68,68,0.4)' : 'rgba(234,179,8,0.4)';
  },

  _drawCircle(x, y, r, color, alpha) {
    const ctx = this._ctx;
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (alpha !== undefined) ctx.globalAlpha = 1;
  },

  _drawHole(x, y, r) {
    const ctx = this._ctx;

    // Base: dark void behind the board
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#07090d';
    ctx.fill();

    // Inner bevel shadow — darkens the rim of the punched hole
    const rimGrad = ctx.createRadialGradient(x, y, r * 0.72, x, y, r);
    rimGrad.addColorStop(0, 'rgba(0,0,0,0)');
    rimGrad.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = rimGrad;
    ctx.fill();

    // Subtle blue bounce-light at bottom of hole from board material — clipped to hole arc
    const bounceGrad = ctx.createRadialGradient(x, y + r * 0.65, 0, x, y + r * 0.65, r * 0.5);
    bounceGrad.addColorStop(0, 'rgba(96,165,250,0.35)');
    bounceGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = bounceGrad;
    ctx.fill();
  },

  _drawPiece(x, y, r, player, alpha) {
    const ctx = this._ctx;
    if (alpha !== undefined) ctx.globalAlpha = alpha;

    // Flat drop shadow — set before fill so it casts on the disc face
    ctx.shadowBlur    = r * 0.25;
    ctx.shadowOffsetY = r * 0.08;
    ctx.shadowColor   = 'rgba(0, 0, 0, 0.55)';

    // Linear gradient top-to-bottom — flat disc under overhead light, not a sphere
    const grad = ctx.createLinearGradient(x, y - r, x, y + r);
    if (player === 1) {
      grad.addColorStop(0,   '#f87171');
      grad.addColorStop(0.5, '#ef4444');
      grad.addColorStop(1,   '#b91c1c');
    } else {
      grad.addColorStop(0,   '#fde047');
      grad.addColorStop(0.5, '#eab308');
      grad.addColorStop(1,   '#a16207');
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.shadowBlur    = 0;
    ctx.shadowOffsetY = 0;

    // Dark outer rim — moulded plastic edge
    ctx.strokeStyle = player === 1 ? 'rgba(120, 0, 0, 0.85)' : 'rgba(120, 60, 0, 0.85)';
    ctx.lineWidth   = Math.max(2, r * 0.1);
    ctx.stroke();

    // Thin highlight arc at top rim — light catching the edge of the flat disc
    ctx.beginPath();
    ctx.arc(x, y, r * 0.88, Math.PI * 1.15, Math.PI * 1.85);
    ctx.strokeStyle = player === 1 ? 'rgba(255, 190, 190, 0.75)' : 'rgba(255, 248, 180, 0.75)';
    ctx.lineWidth   = Math.max(1, r * 0.07);
    ctx.stroke();

    if (alpha !== undefined) ctx.globalAlpha = 1;
  },

  drawBoard(board) {
    this._board = board;
    const ctx = this._ctx;
    const cs = this._cellSize;
    const pieceR = cs * 0.42;
    const holeR  = cs * 0.44;

    // Classic blue plastic frame
    const bgGrad = ctx.createLinearGradient(0, 0, 0, this._canvas.height);
    bgGrad.addColorStop(0, '#2563eb');
    bgGrad.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

    // Top edge catching light
    ctx.fillStyle = 'rgba(147, 197, 253, 0.5)';
    ctx.fillRect(0, 0, this._canvas.width, 3);

    // Bottom shadow underside
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, this._canvas.height - 3, this._canvas.width, 3);

    // Frame border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, this._canvas.width - 1.5, this._canvas.height - 1.5);

    for (let r = 0; r < board.rows; r++) {
      for (let c = 0; c < board.cols; c++) {
        const x = this._cx(c);
        const y = this._cy(r);
        this._drawHole(x, y, holeR);
        const cell = board.cells[r * board.cols + c];
        if (cell > 0) {
          this._drawPiece(x, y, pieceR, cell);
        }
      }
    }

    if (this._hoveredCol >= 0) {
      const col = this._hoveredCol;
      const nextRow = board.colHeights[col];
      if (nextRow >= 0) {
        this._drawPiece(this._cx(col), this._cy(nextRow), pieceR, this.currentPlayer, 0.5);
      }
    }
  },

  animateDrop(board, col, row, player, onComplete) {
    this.animating = true;
    const endY = this._cy(row);
    let currentY = -this._cellSize / 2;
    const speed = this._cellSize * 22;
    const x = this._cx(col);
    const pieceR = this._cellSize * 0.42;
    const self = this;
    let lastTs = null;

    function frame(ts) {
      if (!lastTs) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      currentY = Math.min(currentY + speed * dt, endY);

      self.drawBoard(board);
      self._drawPiece(x, currentY, pieceR, player);

      if (currentY >= endY) {
        self.animating = false;
        onComplete();
      } else {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);
  },

  drawWinLine(board, winLine, onComplete) {
    const ctx = this._ctx;
    const pieceR = this._cellSize * 0.42;
    const startX = this._cx(winLine[0].col);
    const startY = this._cy(winLine[0].row);
    const endX = this._cx(winLine[winLine.length - 1].col);
    const endY = this._cy(winLine[winLine.length - 1].row);
    let startTimestamp = null;
    const self = this;

    const drawDimOverlay = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, self._canvas.width, self._canvas.height);
    };

    const drawGoldLine = (progress) => {
      const curX = startX + (endX - startX) * progress;
      const curY = startY + (endY - startY) * progress;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(curX, curY);
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#fbbf24';
      ctx.stroke();
    };

    // _drawPiece resets its own shadow internally, so win glow is a separate pass after
    const drawWinPieces = (pulseScale, glow) => {
      for (const cell of winLine) {
        const x = self._cx(cell.col);
        const y = self._cy(cell.row);
        const player = board.cells[cell.row * board.cols + cell.col];
        self._drawPiece(x, y, pieceR * pulseScale, player);
        if (glow) {
          ctx.shadowBlur   = glow;
          ctx.shadowColor  = '#fbbf24';
          ctx.beginPath();
          ctx.arc(x, y, pieceR * pulseScale, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
          ctx.fill();
          ctx.shadowBlur  = 0;
          ctx.shadowColor = 'transparent';
        }
      }
    };

    function frame(ts) {
      if (!startTimestamp) startTimestamp = ts;
      const elapsed = ts - startTimestamp;

      self.drawBoard(board);
      drawDimOverlay();

      if (elapsed < 350) {
        drawGoldLine(Math.min(elapsed / 350, 1));
        drawWinPieces(1, 0);
      } else if (elapsed < 900) {
        const t = (elapsed - 350) / 550;
        drawGoldLine(1);
        drawWinPieces(
          1 + 0.35 * Math.sin(t * Math.PI * 4),
          20 + 15 * Math.abs(Math.sin(t * Math.PI * 4))
        );
      } else {
        drawGoldLine(1);
        drawWinPieces(1, 0);
        if (onComplete) onComplete();
        return;
      }

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  },

  clearHover() {
    this._hoveredCol = -1;
    if (this._board) this.drawBoard(this._board);
  }
};
