window.UI = (function() {
  let toastTimer = null;

  return {
    showScreen(id) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById(id).classList.add('active');
    },

    showGameover(text) {
      document.getElementById('gameover-text').textContent = text;
      document.getElementById('gameover-overlay').classList.add('visible');
    },

    hideGameover() {
      document.getElementById('gameover-overlay').classList.remove('visible');
      document.getElementById('waiting-rematch-text').classList.add('hidden');
    },

    showToast(message, duration = 3000) {
      const toast = document.getElementById('toast');
      if (toastTimer) clearTimeout(toastTimer);
      toast.textContent = message;
      toast.classList.add('show');
      toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        toastTimer = null;
      }, duration);
    },

    setTurnIndicator(playerNum, secsLeft) {
      const timeStr = secsLeft !== undefined ? ` (${secsLeft}s)` : '';
      document.getElementById('turn-indicator').textContent = `Player ${playerNum}'s Turn${timeStr}`;
      this.highlightPlayerLabel(playerNum);
    },

    highlightPlayerLabel(playerNum) {
      document.querySelectorAll('.player-label').forEach(l => l.classList.remove('active'));
      document.getElementById(`player${playerNum}-label`).classList.add('active');
    },

    setPlayerLabels(p1name, p2name) {
      const l1 = document.getElementById('player1-label');
      const l2 = document.getElementById('player2-label');
      l1.textContent = p1name;
      l2.textContent = p2name;
      l1.classList.add('p1');
      l2.classList.add('p2');
    },

    setRoomCode(code) {
      document.getElementById('room-code-display').textContent = code;
    },

    showWaitingRematch() {
      const el = document.getElementById('waiting-rematch-text');
      el.textContent = 'Waiting for opponent...';
      el.classList.remove('hidden');
    },

    hideWaitingRematch() {
      document.getElementById('waiting-rematch-text').classList.add('hidden');
    },

    setSelectedBoardSize(size) {
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
      const btn = document.querySelector(`.size-btn[data-size="${size}"]`);
      if (btn) btn.classList.add('selected');
    },

    setSelectedDifficulty(diff) {
      document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('selected'));
      const btn = document.querySelector(`.difficulty-btn[data-difficulty="${diff}"]`);
      if (btn) btn.classList.add('selected');
    },

    showDifficultySection() {
      document.getElementById('difficulty-section').classList.remove('hidden');
    },

    hideDifficultySection() {
      document.getElementById('difficulty-section').classList.add('hidden');
    }
  };
})();
