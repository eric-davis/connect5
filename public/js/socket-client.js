window.SocketClient = {
  _socket: null,
  _handlers: {},

  connect() {
    if (this._socket) return;
    this._socket = io({
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000
    });
    const events = [
      'room_created', 'game_start', 'move_result', 'opponent_disconnected',
      'opponent_wants_rematch', 'rematch_start', 'error', 'turn_timeout'
    ];
    for (const ev of events) {
      this._socket.on(ev, (data) => this._emit(ev, data));
    }
    this._socket.on('disconnect', () => this._emit('connection_status', { state: 'disconnected' }));
    this._socket.on('reconnect_attempt', () => this._emit('connection_status', { state: 'reconnecting' }));
    this._socket.on('reconnect', () => this._emit('connection_status', { state: 'connected' }));
    this._socket.on('reconnect_failed', () => this._emit('connection_status', { state: 'failed' }));
  },

  on(event, handler) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(handler);
  },

  off(event, handler) {
    if (!this._handlers[event]) return;
    this._handlers[event] = this._handlers[event].filter(h => h !== handler);
  },

  _emit(event, data) {
    (this._handlers[event] || []).forEach(h => h(data));
  },

  createRoom(boardSize) { this.connect(); this._socket.emit('create_room', { boardSize }); },
  joinRoom(code) { this.connect(); this._socket.emit('join_room', { code: code.toUpperCase() }); },
  joinQueue(boardSize) { this.connect(); this._socket.emit('join_queue', { boardSize }); },
  leaveQueue() { if (this._socket) this._socket.emit('leave_queue', {}); },
  cancelRoom() { if (this._socket) this._socket.emit('cancel_room', {}); },
  makeMove(col) { if (this._socket) this._socket.emit('make_move', { col }); },
  requestRematch() { if (this._socket) this._socket.emit('request_rematch', {}); }
};
