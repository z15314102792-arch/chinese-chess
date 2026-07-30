/**
 * UI 界面管理模块
 * 负责 Canvas 棋盘绘制、选中交互、屏幕切换、玩家卡片、计时显示、弹窗
 */
const UI = (() => {
  let canvas, ctx, board;
  const screens = {
    menu: document.getElementById('menu-screen'),
    game: document.getElementById('game-screen'),
    online: document.getElementById('online-screen'),
  };
  const elements = {};

  // 绘制参数
  let cellSize = 36, padding = 40, boardPixelW = 0, boardPixelH = 0;

  // 交互状态
  let selectedPos = null;       // {x, y} 当前选中的棋子
  let legalMoves = [];          // [{x, y}, ...] 合法目标位置
  let lastFrom = null;          // {x, y} 上一步起点
  let lastTo = null;            // {x, y} 上一步终点
  let lastMoveColor = null;     // 上一步走子方颜色（红/黑）
  let checkKingPos = null;      // {x, y} 被将军的帅/将位置
  let checkFlash = 0;           // 将军闪烁计数器
  let checkIsDefender = true;   // 当前玩家是被将方还是进攻方

  // 移动动画
  let animPiece = null;         // 正在动画的棋子编码
  let animFromX = 0, animFromY = 0;
  let animToX = 0, animToY = 0;
  let animStart = 0;
  const ANIM_DURATION = 220;    // 毫秒

  /** 初始化 */
  function init(boardModule) {
    board = boardModule;
    canvas = document.getElementById('board-canvas');
    ctx = canvas.getContext('2d');

    // 缓存 DOM 元素
    const ids = [
      'btn-local','btn-ai-easy','btn-ai-medium','btn-online',
      'btn-back','btn-undo','btn-restart','btn-online-back',
      'btn-create-room','btn-join-room','btn-copy-room','btn-paste-room',
      'btn-play-again','btn-to-menu','btn-request-accept','btn-request-reject',
      'red-name','red-timer','black-name','black-timer',
      'red-card','black-card','move-count',
      'room-id-display','room-info','input-room-id',
      'join-error','win-modal','win-text','request-modal','request-text',
      'toast','game-hint',
    ];
    ids.forEach(id => { elements[id] = document.getElementById(id); });

    window.addEventListener('resize', () => {
      if (screens.game.classList.contains('active')) resizeCanvas();
    });

    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', handleCanvasTouch, { passive: false });

    registerSW();
  }

  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  /** 调整 Canvas 尺寸 */
  function resizeCanvas() {
    const wrapper = canvas.parentElement;
    // 中国象棋棋盘 9:10 比例
    const maxW = Math.min(wrapper.clientWidth - 16, 450);
    const maxH = Math.min(window.innerHeight - 160, 550);

    // 保持 9:10 比例
    let w, h;
    if (maxW / maxH > 0.9) {
      h = maxH;
      w = h * 0.9;
    } else {
      w = maxW;
      h = w / 0.9;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    boardPixelW = w;
    boardPixelH = h;

    // 棋盘 9x10, cellSize 按行数计算
    cellSize = (h - padding * 2) / (board.ROWS - 1);
    // 水平居中棋盘（可能两边多一些 padding）
    const boardWidth = cellSize * (board.COLS - 1);
    padding = (w - boardWidth) / 2;

    draw();
  }

  /** 切换屏幕 */
  function showScreen(name) {
    Object.keys(screens).forEach(k => screens[k].classList.toggle('active', k === name));
  }

  // ==================== Canvas 绘制 ====================

  function draw() {
    if (!ctx || !canvas || cellSize <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const w = boardPixelW, h = boardPixelH, s = cellSize, p = padding;

    // 棋盘背景
    ctx.fillStyle = '#c8a96e';
    ctx.fillRect(0, 0, w, h);

    // 网格线
    ctx.strokeStyle = '#5c3a1e';
    ctx.lineWidth = 1;

    // 横线 10 条
    for (let r = 0; r < board.ROWS; r++) {
      const y = p + r * s;
      ctx.beginPath(); ctx.moveTo(p, y); ctx.lineTo(p + (board.COLS - 1) * s, y); ctx.stroke();
    }

    // 纵线 9 条（河界处断开）
    for (let c = 0; c < board.COLS; c++) {
      const x = p + c * s;
      if (c === 0 || c === board.COLS - 1) {
        // 边线贯通
        ctx.beginPath(); ctx.moveTo(x, p); ctx.lineTo(x, p + (board.ROWS - 1) * s); ctx.stroke();
      } else {
        // 中间线河界处断开
        ctx.beginPath(); ctx.moveTo(x, p); ctx.lineTo(x, p + 4 * s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, p + 5 * s); ctx.lineTo(x, p + 9 * s); ctx.stroke();
      }
    }

    // 九宫斜线
    ctx.lineWidth = 0.8;
    drawPalace(p + 3 * s, p, s);           // 黑方九宫 (上)
    drawPalace(p + 3 * s, p + 7 * s, s);   // 红方九宫 (下)

    // 河界文字
    ctx.fillStyle = '#5c3a1e';
    ctx.font = `${s * 0.55}px KaiTi, STKaiti, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const riverY = p + 4.5 * s;
    ctx.fillText('楚  河', p + 2 * s, riverY);
    ctx.fillText('汉  界', p + 6 * s, riverY);

    // 棋子
    for (let y = 0; y < board.ROWS; y++) {
      for (let x = 0; x < board.COLS; x++) {
        const piece = board.get(x, y);
        if (piece === board.EMPTY) continue;
        // 动画中的棋子：跳过原位和目标位，画在插值位置
        if (animPiece && (
          (x === animFromX && y === animFromY) ||
          (x === animToX && y === animToY && board.get(animToX, animToY) === animPiece)
        )) continue;
        drawPiece(x, y, piece, false);
      }
    }

    // 动画棋子画在插值位置
    if (animPiece) {
      const elapsed = performance.now() - animStart;
      const t = Math.min(elapsed / ANIM_DURATION, 1);
      // ease-out: 1 - (1-t)^2
      const ease = 1 - (1 - t) * (1 - t);
      const ax = animFromX + (animToX - animFromX) * ease;
      const ay = animFromY + (animToY - animFromY) * ease;
      drawPieceAt(ax, ay, animPiece, false);
    }

    // 合法走法提示
    for (const m of legalMoves) {
      const mx = p + m.x * s, my = p + m.y * s;
      if (board.get(m.x, m.y) !== board.EMPTY) {
        // ★ 可吃子位置 — 红色粗环 + 红色填充高亮敌棋
        ctx.fillStyle = 'rgba(255,50,50,0.25)';
        ctx.beginPath(); ctx.arc(mx, my, s * 0.44, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,30,30,0.85)';
        ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(mx, my, s * 0.46, 0, Math.PI * 2); ctx.stroke();
        // 外环
        ctx.strokeStyle = 'rgba(255,60,60,0.4)';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(mx, my, s * 0.50, 0, Math.PI * 2); ctx.stroke();
      } else {
        // 空位 — 绿色半透明圆点
        ctx.fillStyle = 'rgba(0,160,0,0.45)';
        ctx.beginPath(); ctx.arc(mx, my, s * 0.18, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ★ 选中高亮（绿色光晕 + 轻微放大效果）
    if (selectedPos) {
      const sx = p + selectedPos.x * s, sy = p + selectedPos.y * s;
      // 绿色光晕外圈
      ctx.strokeStyle = 'rgba(0,200,80,0.7)';
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(sx, sy, s * 0.46, 0, Math.PI * 2); ctx.stroke();
      // 外层柔光
      ctx.strokeStyle = 'rgba(0,200,80,0.3)';
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(sx, sy, s * 0.46, 0, Math.PI * 2); ctx.stroke();
    }

    // ★ 最后一步标记（红方红底、黑方灰底，区分谁走的）
    if (lastFrom && lastTo) {
      const isRed = lastMoveColor === board.RED;
      const fillColor = isRed ? 'rgba(220,80,80,0.4)' : 'rgba(80,80,100,0.45)';
      const strokeColor = isRed ? 'rgba(220,80,80,0.7)' : 'rgba(80,80,100,0.7)';
      [lastFrom, lastTo].forEach(pos => {
        const cx = p + pos.x * s, cy = p + pos.y * s;
        ctx.fillStyle = fillColor;
        ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2); ctx.stroke();
      });
    }

    // ★ 将军高亮
    if (checkKingPos) {
      const kx = p + checkKingPos.x * s, ky = p + checkKingPos.y * s;
      const phase = checkFlash * 0.1;
      if (checkIsDefender) {
        // 被将方：红色脉冲（危险警告）
        const alpha = 0.4 + 0.6 * Math.abs(Math.sin(phase));
        ctx.strokeStyle = `rgba(255,0,0,${alpha})`;
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(kx, ky, s * 0.52, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,40,40,${alpha * 0.5})`;
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(kx, ky, s * 0.57, 0, Math.PI * 2); ctx.stroke();
      } else {
        // 进攻方：金色光环（宣告将军）
        const alpha = 0.3 + 0.3 * Math.sin(phase);
        ctx.strokeStyle = `rgba(255,200,40,${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(kx, ky, s * 0.50, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  function drawPalace(x, y, s) {
    ctx.strokeStyle = '#5c3a1e';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2 * s, y + 2 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 2 * s, y); ctx.lineTo(x, y + 2 * s); ctx.stroke();
  }

  function drawPieceAt(px, py, piece, isFloating) {
    const r = cellSize * 0.44;
    if (r <= 0) return;
    const color = board.getColor(piece);
    const char = board.getChar(piece);
    ctx.save();
    if (isFloating) ctx.globalAlpha = 0.6;
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 3; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fillStyle = '#f5deb3'; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = color === board.RED ? '#b03030' : '#1a1a1a'; ctx.lineWidth = 2.5; ctx.stroke();
    if (r > 6) {
      ctx.beginPath(); ctx.arc(px, py, r - 4, 0, Math.PI * 2);
      ctx.strokeStyle = color === board.RED ? '#c0392b' : '#333'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.fillStyle = color === board.RED ? '#c0392b' : '#1a1a1a';
    ctx.font = `bold ${r * 1.15}px "KaiTi", "STKaiti", "楷体", "SimSun", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(char, px, py + 1);
    ctx.restore();
  }

  function drawPiece(x, y, piece, isFloating) {
    const px = padding + x * cellSize, py = padding + y * cellSize;
    drawPieceAt(px, py, piece, isFloating);
  }

  // ==================== 交互处理 ====================

  function handleCanvasClick(e) { processTap(e); }
  function handleCanvasTouch(e) { e.preventDefault(); processTap(e.touches[0]); }

  function processTap(e) {
    const p = getGridPos(e);
    if (!p) {
      // 点击棋盘外 → 取消选中
      clearSelection();
      return;
    }

    const piece = board.get(p.x, p.y);

    if (selectedPos === null) {
      // 未选中 → 尝试选中己方棋子
      if (piece !== board.EMPTY && board.getColor(piece) === board.getCurrentPlayer()) {
        selectPiece(p.x, p.y);
      }
    } else if (selectedPos.x === p.x && selectedPos.y === p.y) {
      // 再次点同一棋子 → 取消选中
      clearSelection();
    } else if (legalMoves.some(m => m.x === p.x && m.y === p.y)) {
      // 点击合法目标 → 执行走子
      const from = { x: selectedPos.x, y: selectedPos.y };
      clearSelection();
      handleMove(from.x, from.y, p.x, p.y);
    } else if (piece !== board.EMPTY && board.getColor(piece) === board.getCurrentPlayer()) {
      // 点击另一个己方棋子 → 切换选中
      selectPiece(p.x, p.y);
    } else {
      // 无效位置 → 取消选中
      clearSelection();
    }
  }

  function selectPiece(x, y) {
    selectedPos = { x, y };
    legalMoves = board.getLegalMoves(x, y);
    // 将军时选中的棋子无法应将 → 提示
    if (legalMoves.length === 0 && board.isInCheck(board.getCurrentPlayer())) {
      showToast('必须应将！请选择能解除将军的棋子', 1500);
    }
    draw();
  }

  function clearSelection() {
    selectedPos = null;
    legalMoves = [];
    draw();
  }

  function getGridPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = boardPixelW / rect.width, scaleY = boardPixelH / rect.height;
    const mx = (e.clientX - rect.left) * scaleX, my = (e.clientY - rect.top) * scaleY;
    const col = Math.round((mx - padding) / cellSize), row = Math.round((my - padding) / cellSize);
    if (col < 0 || col >= board.COLS || row < 0 || row >= board.ROWS) return null;
    const px = padding + col * cellSize, py = padding + row * cellSize;
    if (Math.hypot(mx - px, my - py) > cellSize * 0.45) return null;
    return { x: col, y: row };
  }

  let onMoveCallback = null;
  function onMove(cb) { onMoveCallback = cb; }
  function handleMove(fx, fy, tx, ty) { if (onMoveCallback) onMoveCallback(fx, fy, tx, ty); }

  // ==================== 高亮与标记 ====================

  // ==================== 移动动画 ====================

  let animRAF = null;

  function startMoveAnimation(fx, fy, tx, ty, piece) {
    animPiece = piece;
    animFromX = fx; animFromY = fy;
    animToX = tx; animToY = ty;
    animStart = performance.now();

    lastFrom = { x: fx, y: fy };
    lastTo = { x: tx, y: ty };
    lastMoveColor = board.getColor(piece);

    function animLoop(now) {
      const elapsed = now - animStart;
      if (elapsed >= ANIM_DURATION) {
        animPiece = null;
        animRAF = null;
        draw();
        return;
      }
      draw();
      animRAF = requestAnimationFrame(animLoop);
    }
    if (animRAF) cancelAnimationFrame(animRAF);
    animRAF = requestAnimationFrame(animLoop);
  }

  function setLastMove(fx, fy, tx, ty, piece) {
    lastFrom = { x: fx, y: fy };
    lastTo = { x: tx, y: ty };
    lastMoveColor = piece ? board.getColor(piece) : null;
    if (!animPiece) draw();
  }

  function clearLastMove() {
    lastFrom = null;
    lastTo = null;
    lastMoveColor = null;
  }

  function clearAll() {
    clearSelection();
    clearLastMove();
    clearCheckHighlight();
    draw();
  }

  // ==================== 将军提醒 ====================

  let checkFlashTimer = null;

  function setCheckHighlight(color, isDefender) {
    checkKingPos = Board.findKing(color);
    checkIsDefender = isDefender !== false;  // 默认为被将方
    checkFlash = 0;
    draw();
    if (checkFlashTimer) clearInterval(checkFlashTimer);
    checkFlashTimer = setInterval(() => {
      checkFlash++;
      draw();
    }, 100);
  }

  function clearCheckHighlight() {
    checkKingPos = null;
    checkFlash = 0;
    if (checkFlashTimer) { clearInterval(checkFlashTimer); checkFlashTimer = null; }
  }

  // ==================== 玩家卡片 ====================

  function setPlayerCards(rName, rTimer, bName, bTimer, activePlayer) {
    elements['red-name'].textContent = rName;
    elements['red-timer'].textContent = rTimer;
    elements['black-name'].textContent = bName;
    elements['black-timer'].textContent = bTimer;

    const rCard = elements['red-card'], bCard = elements['black-card'];
    rCard.classList.toggle('active', activePlayer === board.RED);
    bCard.classList.toggle('active', activePlayer === board.BLACK);
  }

  function updateTimerDisplay(player, timeStr) {
    const el = player === board.RED ? elements['red-timer'] : elements['black-timer'];
    el.textContent = timeStr;
  }

  function setTimerUrgent(player, urgent) {
    const el = player === board.RED ? elements['red-timer'] : elements['black-timer'];
    el.classList.toggle('urgent', urgent);
  }

  // ==================== 其他 UI ====================

  function setMoveCount(n) { elements['move-count'].textContent = '第 ' + n + ' 手'; }
  function setHint(text) { elements['game-hint'].textContent = text || ''; }

  /** 胜利弹窗 */
  function showWin(player, isOnline) {
    let text;
    if (player === board.RED) text = '🔴 红方获胜！';
    else if (player === board.BLACK) text = '⚫ 黑方获胜！';
    else text = '🤝 平局！';
    elements['win-text'].textContent = text;
    elements['win-modal'].classList.remove('hidden');
    const playAgainBtn = elements['btn-play-again'];
    playAgainBtn.textContent = isOnline ? '申请重来' : '再来一局';
  }

  function hideWin() { elements['win-modal'].classList.add('hidden'); }

  function showRequest(text) {
    elements['request-text'].textContent = text;
    elements['request-modal'].classList.remove('hidden');
  }
  function hideRequest() { elements['request-modal'].classList.add('hidden'); }

  function showToast(msg, dur = 2000) {
    const t = elements['toast'];
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.classList.add('hidden'), dur);
  }

  function showRoomInfo(roomId) {
    elements['room-id-display'].textContent = roomId;
    elements['room-info'].classList.remove('hidden');
  }

  function hideRoomInfo() {
    elements['room-info'].classList.add('hidden');
    elements['qr-code'].innerHTML = '';
  }

  function showJoinError(msg) {
    const el = elements['join-error'];
    el.textContent = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
  }

  function getInputRoomId() { return elements['input-room-id'].value.trim(); }
  function getElement(id) { return elements[id]; }

  return {
    init, draw, showScreen, resizeCanvas,
    selectPiece, clearSelection, setLastMove, clearLastMove, clearAll,
    startMoveAnimation,
    setCheckHighlight, clearCheckHighlight,
    setPlayerCards, updateTimerDisplay, setTimerUrgent,
    setMoveCount, setHint,
    showWin, hideWin, showRequest, hideRequest,
    showToast, showRoomInfo, hideRoomInfo, showJoinError,
    getInputRoomId, getElement, onMove,
  };
})();
