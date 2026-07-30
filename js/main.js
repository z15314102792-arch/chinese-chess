/**
 * 主控制器 —— 游戏流程、计时器、悔棋、重来
 *
 * 计时规则：每步 60 秒，超时判负。最后 20 秒红闪警告。
 * 使用 Date.now() 计算实际流逝时间，避免 setInterval 漂移。
 *
 * 中国象棋规则：红方先行。将死或困毙判负。
 */
const Main = (() => {
  const MOVE_TIME = 60;

  const MODE = {
    LOCAL: 'local',
    AI_EASY: 'ai-easy',
    AI_MEDIUM: 'ai-medium',
    ONLINE: 'online',
  };

  let currentMode = null;
  let gameOver = false;
  let isMyTurn = true;
  let onlinePlayerColor = null;
  let aiThinking = false;

  // 计时器
  let timerDeadline = 0;
  let timerInterval = null;
  let timerPlayer = null;

  // 联机请求状态
  let pendingRequest = null;

  // Wake Lock
  let wakeLock = null;
  let wakeLockSupported = false;

  /** 初始化 */
  function init() {
    UI.init(Board);
    UI.onMove(handlePlayerMove);
    bindButtons();
    UI.getElement('btn-play-again').addEventListener('click', handlePlayAgain);
    UI.getElement('btn-to-menu').addEventListener('click', goToMenu);
    UI.getElement('btn-request-accept').addEventListener('click', () => acceptRequest());
    UI.getElement('btn-request-reject').addEventListener('click', () => rejectRequest());

    wakeLockSupported = 'wakeLock' in navigator;
    document.addEventListener('visibilitychange', onVisibilityChange);

    checkURLParams();
    UI.showScreen('menu');
    console.log('[Main] 中国象棋已就绪');
  }

  // ==================== 防后台断线 ====================

  async function requestWakeLock() {
    if (!wakeLockSupported || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('[Main] Wake Lock 已激活');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) { /* 静默 */ }
  }

  async function releaseWakeLock() {
    if (wakeLock) {
      try { await wakeLock.release(); } catch (e) { /* ignore */ }
      wakeLock = null;
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (currentMode === MODE.ONLINE && !gameOver) {
        UI.showToast('⚠️ 已切到后台，请尽快返回以免断线', 4000);
      }
      releaseWakeLock();
    } else {
      if (currentMode === MODE.ONLINE && !gameOver) {
        requestWakeLock();
        if (!P2P.getStatus().isConnected) {
          UI.showToast('连接已断开，请重新开始', 4000);
          gameOver = true;
          stopTimer();
        }
      }
    }
  }

  function bindButtons() {
    UI.getElement('btn-local').addEventListener('click', () => startGame(MODE.LOCAL));
    UI.getElement('btn-ai-easy').addEventListener('click', () => startGame(MODE.AI_EASY));
    UI.getElement('btn-ai-medium').addEventListener('click', () => startGame(MODE.AI_MEDIUM));
    UI.getElement('btn-online').addEventListener('click', showOnlineScreen);
    UI.getElement('btn-back').addEventListener('click', confirmBack);
    UI.getElement('btn-undo').addEventListener('click', handleUndo);
    UI.getElement('btn-restart').addEventListener('click', handleRestart);
    UI.getElement('btn-online-back').addEventListener('click', () => { P2P.disconnect(); UI.showScreen('menu'); });
    UI.getElement('btn-create-room').addEventListener('click', handleCreateRoom);
    UI.getElement('btn-join-room').addEventListener('click', handleJoinRoom);
    UI.getElement('btn-copy-room').addEventListener('click', handleCopyRoom);
    UI.getElement('btn-paste-room').addEventListener('click', handlePasteRoom);
  }

  // ==================== 计时器 ====================

  function startTimer(player) {
    stopTimer();
    timerPlayer = player;
    timerDeadline = Date.now() + MOVE_TIME * 1000;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
      const min = Math.floor(remaining / 60);
      const sec = remaining % 60;
      const str = min + ':' + String(sec).padStart(2, '0');
      UI.updateTimerDisplay(player, str);
      UI.setTimerUrgent(player, remaining <= 20 && remaining > 0);

      if (remaining <= 0) handleTimeout(player);
    }, 200);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerPlayer = null;
    UI.setTimerUrgent(Board.RED, false);
    UI.setTimerUrgent(Board.BLACK, false);
  }

  function updateTimerDisplay() {
    if (!timerPlayer) return;
    const remaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    UI.updateTimerDisplay(timerPlayer, min + ':' + String(sec).padStart(2, '0'));
  }

  function handleTimeout(player) {
    stopTimer();
    gameOver = true;
    const winner = player === Board.RED ? Board.BLACK : Board.RED;
    UI.setHint('⏰ ' + (player === Board.RED ? '红方' : '黑方') + '超时！');
    setTimeout(() => UI.showWin(winner, currentMode === MODE.ONLINE), 400);
  }

  // ==================== 游戏流程 ====================

  function startGame(mode) {
    currentMode = mode;
    gameOver = false;
    aiThinking = false;
    pendingRequest = null;
    Board.reset();
    UI.hideWin();
    UI.hideRequest();
    UI.setHint('');
    // ★ 先 showScreen 再 resizeCanvas（避免 display:none → clientWidth=0）
    UI.showScreen('game');
    UI.resizeCanvas();
    UI.clearAll();

    // 红方先行
    if (currentMode === MODE.ONLINE) {
      isMyTurn = (onlinePlayerColor === Board.RED);
    } else {
      isMyTurn = true;
    }
    updatePlayerCards();
    UI.setMoveCount(1);

    // 人机不计时
    if (currentMode !== MODE.AI_EASY && currentMode !== MODE.AI_MEDIUM) {
      startTimer(Board.RED);
    }

    if (currentMode === MODE.ONLINE) {
      requestWakeLock();
    }
  }

  function updatePlayerCards() {
    const rName = getPlayerName(Board.RED);
    const bName = getPlayerName(Board.BLACK);
    const activePlayer = gameOver ? null : Board.getCurrentPlayer();
    UI.setPlayerCards(rName, formatTime(MOVE_TIME), bName, formatTime(MOVE_TIME), activePlayer);

    const historyLen = Board.getHistoryLength();
    const canUndo = !gameOver && !aiThinking && historyLen > 0;
    if (currentMode === MODE.ONLINE) {
      UI.getElement('btn-undo').disabled = !(canUndo && isMyTurn);
    } else if (currentMode === MODE.AI_EASY || currentMode === MODE.AI_MEDIUM) {
      UI.getElement('btn-undo').disabled = !(canUndo && historyLen >= 2);
    } else {
      UI.getElement('btn-undo').disabled = !canUndo;
    }
  }

  function getPlayerName(player) {
    if (currentMode === MODE.LOCAL) {
      return player === Board.RED ? '红方' : '黑方';
    }
    if (currentMode === MODE.AI_EASY || currentMode === MODE.AI_MEDIUM) {
      return player === Board.RED ? '你' : 'AI';
    }
    if (currentMode === MODE.ONLINE) {
      if (player === onlinePlayerColor) return '你';
      return '对手';
    }
    return player === Board.RED ? '红方' : '黑方';
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  /** 将军提醒体系：横幅+棋盘高亮+红框（双方不同显示） */
  function showCheckStatus() {
    const current = Board.getCurrentPlayer();
    const banner = document.getElementById('check-banner');

    if (Board.isInCheck(current)) {
      // 当前走子方被将军
      banner.textContent = '⚠ 你被将军！必须应将';
      banner.className = 'check-banner defender';
      UI.setCheckHighlight(current);
      UI.setHint('');

      // 被将方卡片红框
      const cardId = current === Board.RED ? 'red-card' : 'black-card';
      document.getElementById(cardId).classList.add('timeout');
    } else {
      // 检查是否上将（当前方刚刚将军了对方）
      const opponent = current === Board.RED ? Board.BLACK : Board.RED;
      if (Board.isInCheck(opponent)) {
        banner.textContent = '⚔ 将军！对方必须应将';
        banner.className = 'check-banner attacker';
        UI.setCheckHighlight(opponent);
        UI.setHint('');
        // 被将方卡片红框
        const cardId = opponent === Board.RED ? 'red-card' : 'black-card';
        document.getElementById(cardId).classList.add('timeout');
      } else {
        banner.className = 'check-banner hidden';
        UI.clearCheckHighlight();
        UI.setHint('');
        // 清除卡片红框
        document.getElementById('red-card').classList.remove('timeout');
        document.getElementById('black-card').classList.remove('timeout');
      }
    }
  }

  // ==================== 走子处理 ====================

  function handlePlayerMove(fx, fy, tx, ty) {
    if (gameOver || aiThinking) return;
    if (currentMode === MODE.ONLINE && !isMyTurn) {
      UI.showToast('等待对手落子…');
      return;
    }
    if (!tryMovePiece(fx, fy, tx, ty)) return;
    if (currentMode === MODE.ONLINE) P2P.sendMove(fx, fy, tx, ty);
  }

  function tryMovePiece(fx, fy, tx, ty) {
    // 合法性校验
    const legal = Board.getLegalMoves(fx, fy);
    if (!legal.some(m => m.x === tx && m.y === ty)) return false;

    if (!Board.movePiece(fx, fy, tx, ty)) return false;

    UI.startMoveAnimation(fx, fy, tx, ty, Board.get(tx, ty));
    UI.setMoveCount(Board.getMoveCount());

    // 检查将军喊将
    const nextPlayer = Board.getCurrentPlayer(); // 还没 switch，走子方仍是当前
    Board.switchPlayer();
    const opponent = Board.getCurrentPlayer();

    // 检测将死/困毙/将军
    if (Board.isCheckmate(opponent)) {
      gameOver = true;
      stopTimer();
      updatePlayerCards();
      UI.setHint('将死！');
      // 把当前玩家切换回胜方用于显示
      setTimeout(() => UI.showWin(nextPlayer, currentMode === MODE.ONLINE), 800);
      return true;
    }

    if (Board.isStalemate(opponent)) {
      gameOver = true;
      stopTimer();
      updatePlayerCards();
      UI.setHint('困毙！');
      setTimeout(() => UI.showWin(nextPlayer, currentMode === MODE.ONLINE), 800);
      return true;
    }

    // ★ 将军提醒体系
    showCheckStatus();

    updatePlayerCards();

    // 重启计时器（人机不计时）
    const isAI = (currentMode === MODE.AI_EASY || currentMode === MODE.AI_MEDIUM);
    if (!gameOver && !isAI) startTimer(Board.getCurrentPlayer());

    // AI 模式
    if (!gameOver && isAI) {
      aiThinking = true;
      const diffLabel = currentMode === MODE.AI_EASY ? '简单' : '中等';
      UI.setHint('AI 思考中（' + diffLabel + '）…');
      const thinkTime = 800 + Math.random() * 2200;
      setTimeout(() => {
        const move = AI.getMove(Board, currentMode === MODE.AI_EASY ? 'easy' : 'medium');
        if (move) {
          Board.movePiece(move.fx, move.fy, move.tx, move.ty);
          UI.startMoveAnimation(move.fx, move.fy, move.tx, move.ty, Board.get(move.tx, move.ty));
          UI.setMoveCount(Board.getMoveCount());
          Board.switchPlayer();

          if (Board.isCheckmate(Board.RED)) {
            gameOver = true;
            stopTimer();
            updatePlayerCards();
            UI.setHint('将死！');
            setTimeout(() => UI.showWin(Board.BLACK, false), 800);
          } else if (Board.isStalemate(Board.RED)) {
            gameOver = true;
            stopTimer();
            updatePlayerCards();
            UI.setHint('困毙！');
            setTimeout(() => UI.showWin(Board.BLACK, false), 800);
          } else {
            updatePlayerCards();
            showCheckStatus();
          }
        }
        aiThinking = false;
      }, thinkTime);
    }

    // 联机：等对方走
    if (currentMode === MODE.ONLINE && !gameOver) {
      isMyTurn = false;
    }

    return true;
  }

  // ==================== 悔棋 ====================

  function handleUndo() {
    if (gameOver || aiThinking) return;
    if (Board.getHistoryLength() === 0) {
      UI.showToast('没有可悔的棋');
      return;
    }

    if (currentMode === MODE.LOCAL) {
      doLocalUndo();
    } else if (currentMode === MODE.AI_EASY || currentMode === MODE.AI_MEDIUM) {
      doAiUndo();
    } else if (currentMode === MODE.ONLINE) {
      if (!isMyTurn) { UI.showToast('只有你的回合才能申请悔棋'); return; }
      if (pendingRequest) { UI.showToast('已有待处理请求'); return; }
      P2P.sendUndoRequest();
      pendingRequest = 'undo';
      UI.showToast('已发送悔棋申请，等待回复…', 5000);
    }
  }

  function doLocalUndo() {
    stopTimer();
    Board.undoOne();
    UI.clearAll();
    UI.setMoveCount(Board.getMoveCount());
    updatePlayerCards();
    UI.setHint('已悔棋');
    setTimeout(() => UI.setHint(''), 2000);
    if (!gameOver) startTimer(Board.getCurrentPlayer());
  }

  function doAiUndo() {
    stopTimer();
    Board.undo();
    UI.clearAll();
    UI.setMoveCount(Board.getMoveCount());
    updatePlayerCards();
    UI.setHint('已悔棋');
    setTimeout(() => UI.setHint(''), 2000);
    if (!gameOver) startTimer(Board.getCurrentPlayer());
  }

  function doOnlineUndo() {
    stopTimer();
    Board.undo();
    isMyTurn = true;
    UI.clearAll();
    UI.setMoveCount(Board.getMoveCount());
    updatePlayerCards();
    UI.setHint('已悔棋');
    setTimeout(() => UI.setHint(''), 2000);
    if (!gameOver) startTimer(Board.getCurrentPlayer());
  }

  // ==================== 重新开始 ====================

  function handleRestart() {
    if (gameOver) {
      if (currentMode === MODE.ONLINE) {
        P2P.sendRematchRequest();
        pendingRequest = 'rematch';
        UI.showToast('已发送重来申请，等待回复…', 5000);
      } else {
        startGame(currentMode);
      }
      return;
    }

    if (currentMode === MODE.LOCAL || currentMode === MODE.AI_EASY || currentMode === MODE.AI_MEDIUM) {
      startGame(currentMode);
    } else if (currentMode === MODE.ONLINE) {
      if (pendingRequest) { UI.showToast('已有待处理请求'); return; }
      P2P.sendRematchRequest();
      pendingRequest = 'rematch';
      UI.showToast('已发送重来申请，等待回复…', 5000);
    }
  }

  function handlePlayAgain() {
    if (currentMode === MODE.ONLINE) {
      if (pendingRequest === 'rematch_request_received') {
        acceptRequest();
        return;
      }
      if (pendingRequest === 'rematch') {
        UI.showToast('已发送重来申请，等待回复…');
        return;
      }
      P2P.sendRematchRequest();
      pendingRequest = 'rematch';
      UI.hideWin();
      UI.showToast('已发送重来申请，等待回复…', 5000);
    } else {
      startGame(currentMode);
    }
  }

  // ==================== 联机 ====================

  function showOnlineScreen() {
    UI.hideRoomInfo();
    UI.showScreen('online');
    UI.getElement('input-room-id').value = '';
    UI.getElement('join-error').classList.add('hidden');
    UI.getElement('btn-create-room').disabled = false;
    UI.getElement('btn-create-room').textContent = '创建房间';
    UI.getElement('btn-join-room').disabled = false;
    UI.getElement('btn-join-room').textContent = '加入';
    P2P.init({
      onConnected: onP2PConnected,
      onDisconnected: onP2PDisconnected,
      onMove: onP2PMove,
      onError: onP2PError,
    });
  }

  async function handleCreateRoom() {
    try {
      const btn = UI.getElement('btn-create-room');
      btn.disabled = true; btn.textContent = '创建中…';
      await P2P.createRoom();
      UI.showRoomInfo(P2P.getRoomId());
      btn.textContent = '房间已创建';
    } catch (err) {
      UI.showToast('创建房间失败，请重试');
      UI.getElement('btn-create-room').disabled = false;
      UI.getElement('btn-create-room').textContent = '创建房间';
    }
  }

  async function handleJoinRoom() {
    const roomId = UI.getInputRoomId();
    if (!roomId) { UI.showJoinError('请输入房间号'); return; }
    try {
      const btn = UI.getElement('btn-join-room');
      btn.disabled = true; btn.textContent = '连接中…';
      await P2P.joinRoom(roomId);
      btn.textContent = '已连接';
    } catch (err) {
      UI.showJoinError(err.message || '加入房间失败');
      UI.getElement('btn-join-room').disabled = false;
      UI.getElement('btn-join-room').textContent = '加入';
    }
  }

  function handleCopyRoom() {
    const roomId = P2P.getRoomId();
    if (roomId && navigator.clipboard) {
      navigator.clipboard.writeText(roomId).then(() => UI.showToast('房间号已复制！'))
        .catch(() => UI.showToast('房间号：' + roomId));
    }
  }

  async function handlePasteRoom() {
    try {
      if (!navigator.clipboard) { UI.showToast('当前浏览器不支持剪贴板'); return; }
      const text = await navigator.clipboard.readText();
      if (text) { UI.getElement('input-room-id').value = text.trim(); UI.showToast('已粘贴！'); }
      else UI.showToast('剪贴板为空');
    } catch { UI.showToast('无法读取剪贴板，请手动长按粘贴'); }
  }

  function onP2PConnected() {
    const { isHost } = P2P.getStatus();
    onlinePlayerColor = isHost ? Board.RED : Board.BLACK;
    isMyTurn = (onlinePlayerColor === Board.RED);
    currentMode = MODE.ONLINE;
    gameOver = false;
    pendingRequest = null;
    Board.reset();
    UI.hideWin();
    UI.hideRequest();
    UI.setHint('');
    document.getElementById('check-banner').className = 'check-banner hidden';
    document.getElementById('red-card').classList.remove('timeout');
    document.getElementById('black-card').classList.remove('timeout');
    UI.showScreen('game');
    UI.resizeCanvas();
    UI.clearAll();
    updatePlayerCards();
    UI.setMoveCount(1);
    UI.showToast('连接成功！' + (isHost ? '你执红先行' : '你执黑，等待对手'));
    startTimer(Board.RED);  // 红先
    requestWakeLock();
  }

  function onP2PDisconnected() {
    releaseWakeLock();
    if (currentMode === MODE.ONLINE && !gameOver) {
      UI.showToast('对手已断开连接', 3000);
      gameOver = true;
      stopTimer();
    }
  }

  function onP2PMove(type, arg1, arg2, arg3) {
    if (type === 'restart') return;

    // 悔棋申请
    if (type === 'undo_request') {
      if (gameOver) { P2P.sendUndoResponse(false); return; }
      UI.showRequest('对手申请悔棋，是否同意？');
      pendingRequest = 'undo_request_received';
      return;
    }

    // 悔棋响应
    if (type === 'undo_response') {
      pendingRequest = null;
      if (arg1) {  // arg1 = accept
        doOnlineUndo();
        UI.showToast('对手同意了悔棋');
      } else {
        UI.showToast('对手拒绝了悔棋');
      }
      return;
    }

    // 重来申请
    if (type === 'rematch_request') {
      if (pendingRequest === 'rematch') {
        // ★ 双方同时申请 → 自动同意
        P2P.sendRematchResponse(true);
        onlinePlayerColor = onlinePlayerColor === Board.RED ? Board.BLACK : Board.RED;
        UI.showToast('双方都想重来，游戏重新开始！');
        startGame(MODE.ONLINE);
        pendingRequest = null;
        return;
      }
      if (gameOver) {
        UI.showRequest('对手申请重新开始，是否同意？');
        pendingRequest = 'rematch_request_received';
      } else {
        P2P.sendRematchResponse(true);
      }
      return;
    }

    // 重来响应
    if (type === 'rematch_response') {
      if (arg1 && pendingRequest === 'rematch') {
        onlinePlayerColor = onlinePlayerColor === Board.RED ? Board.BLACK : Board.RED;
        UI.showToast('对手同意了，游戏重新开始！');
        startGame(MODE.ONLINE);
      } else if (!arg1) {
        UI.showToast('对手拒绝了重来请求');
      }
      pendingRequest = null;
      return;
    }

    // 普通走子: type=fx, arg1=fy, arg2=tx, arg3=ty
    const fx = type, fy = arg1, tx = arg2, ty = arg3;
    if (gameOver || typeof fx !== 'number') return;
    if (!Board.movePiece(fx, fy, tx, ty)) return;

    UI.startMoveAnimation(fx, fy, tx, ty, Board.get(tx, ty));
    UI.setMoveCount(Board.getMoveCount());
    Board.switchPlayer();

    const me = onlinePlayerColor;
    const opponent = me === Board.RED ? Board.BLACK : Board.RED;

    if (Board.isCheckmate(me)) {
      gameOver = true;
      stopTimer();
      updatePlayerCards();
      setTimeout(() => UI.showWin(opponent, true), 800);
      return;
    }
    if (Board.isStalemate(me)) {
      gameOver = true;
      stopTimer();
      updatePlayerCards();
      setTimeout(() => UI.showWin(opponent, true), 800);
      return;
    }

    showCheckStatus();
    isMyTurn = true;
    updatePlayerCards();
    startTimer(Board.getCurrentPlayer());
  }

  function onP2PError(msg) { UI.showToast(msg, 4000); }

  function acceptRequest() {
    UI.hideRequest();
    if (pendingRequest === 'undo_request_received') {
      P2P.sendUndoResponse(true);
      doOnlineUndo();
      pendingRequest = null;
    } else if (pendingRequest === 'rematch_request_received') {
      P2P.sendRematchResponse(true);
      pendingRequest = null;
      onlinePlayerColor = onlinePlayerColor === Board.RED ? Board.BLACK : Board.RED;
      startGame(MODE.ONLINE);
    }
  }

  function rejectRequest() {
    UI.hideRequest();
    if (pendingRequest === 'undo_request_received') {
      P2P.sendUndoResponse(false);
    } else if (pendingRequest === 'rematch_request_received') {
      P2P.sendRematchResponse(false);
    }
    pendingRequest = null;
  }

  // ==================== 其他 ====================

  function confirmBack() {
    if (!gameOver && Board.getHistoryLength() > 0) {
      if (!confirm('确定要退出当前对局吗？')) return;
    }
    stopTimer();
    releaseWakeLock();
    if (currentMode === MODE.ONLINE) P2P.disconnect();
    gameOver = false; aiThinking = false;
    Board.reset(); UI.clearAll(); UI.hideWin(); UI.hideRequest();
    UI.showScreen('menu');
  }

  function goToMenu() {
    stopTimer();
    releaseWakeLock();
    if (currentMode === MODE.ONLINE) P2P.disconnect();
    gameOver = false; aiThinking = false;
    Board.reset(); UI.clearAll(); UI.hideWin(); UI.hideRequest();
    UI.showScreen('menu');
  }

  function checkURLParams() {
    const room = new URLSearchParams(location.search).get('room');
    if (room) {
      UI.getElement('input-room-id').value = room;
      showOnlineScreen();
      setTimeout(() => handleJoinRoom(), 500);
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => Main.init());
