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
    themes: document.getElementById('theme-screen'),
    rules: document.getElementById('rules-screen'),
  };
  const elements = {};

  // ==================== 主题系统 ====================

  /** 棋盘主题（12套） */
  const BOARD_THEMES = [
    { id: 'classic', name: '经典木纹', emoji: '🪵',
      boardBg: '#c8a96e', boardLine: '#5c3a1e',
      pieceR: ['#ffe8c0','#f0d090','#d4a850','#b89140'],
      pieceB: ['#f8f0e0','#e8dcc8','#c8b898','#a89878'],
      pieceOuterR: '#8b2020', pieceOuterB: '#222',
      pieceInnerR: 'rgba(200,60,50,0.5)', pieceInnerB: 'rgba(80,80,80,0.45)',
      pieceTextR: '#8b1a1a', pieceTextB: '#1a1a1a' },
    { id: 'rosewood', name: '红木雅韵', emoji: '🪑',
      boardBg: '#b0723a', boardLine: '#4a2010',
      pieceR: ['#ffe0b0','#e8c080','#c89050','#a07030'],
      pieceB: ['#f5e8d0','#e0d0b0','#c0a880','#9a8060'],
      pieceOuterR: '#6b1818', pieceOuterB: '#1a1a1a',
      pieceInnerR: 'rgba(180,50,40,0.5)', pieceInnerB: 'rgba(70,70,70,0.45)',
      pieceTextR: '#7a1515', pieceTextB: '#1a1a1a' },
    { id: 'golden', name: '金丝楠木', emoji: '✨',
      boardBg: '#d4b872', boardLine: '#6b4c20',
      pieceR: ['#fff0d0','#f0d890','#d8b860','#b89840'],
      pieceB: ['#faf5e8','#e8dcc0','#c8b890','#a89868'],
      pieceOuterR: '#7a1818', pieceOuterB: '#1a1a1a',
      pieceInnerR: 'rgba(190,55,45,0.5)', pieceInnerB: 'rgba(70,70,70,0.45)',
      pieceTextR: '#7a1515', pieceTextB: '#1a1a1a' },
    { id: 'ebony', name: '黑檀木', emoji: '🖤',
      boardBg: '#6b5040', boardLine: '#3a2820',
      pieceR: ['#ffe0c0','#e8c890','#c89860','#a07840'],
      pieceB: ['#f5f0e8','#e0d8c8','#b8b098','#908878'],
      pieceOuterR: '#7a1818', pieceOuterB: '#111',
      pieceInnerR: 'rgba(180,50,40,0.5)', pieceInnerB: 'rgba(60,60,60,0.4)',
      pieceTextR: '#7a1515', pieceTextB: '#111' },
    { id: 'cherry', name: '樱桃木', emoji: '🍒',
      boardBg: '#c4956a', boardLine: '#6b3a2a',
      pieceR: ['#ffe8d0','#f0d0a0','#d8a870','#b88850'],
      pieceB: ['#faf5e8','#e8dcc8','#c8b898','#a89870'],
      pieceOuterR: '#8b2020', pieceOuterB: '#222',
      pieceInnerR: 'rgba(200,60,50,0.5)', pieceInnerB: 'rgba(80,80,80,0.45)',
      pieceTextR: '#8b1a1a', pieceTextB: '#1a1a1a' },
    { id: 'marble', name: '汉白玉', emoji: '🏛️',
      boardBg: '#f0e6d3', boardLine: '#8b7355',
      pieceR: ['#fff8f0','#f5e0c0','#ddc090','#c0a070'],
      pieceB: ['#fafaf5','#e8e0d0','#c8c0a8','#a09880'],
      pieceOuterR: '#9b3030', pieceOuterB: '#333',
      pieceInnerR: 'rgba(210,70,60,0.45)', pieceInnerB: 'rgba(90,90,90,0.4)',
      pieceTextR: '#8b1a1a', pieceTextB: '#1a1a1a' },
    { id: 'celadon', name: '天青瓷韵', emoji: '🏺',
      boardBg: '#b8ccc8', boardLine: '#5a7068',
      pieceR: ['#fff8f0','#f0e0c0','#d8c090','#b8a070'],
      pieceB: ['#fafaf5','#e8e4d8','#c8c4b0','#a0a090'],
      pieceOuterR: '#8b3030', pieceOuterB: '#222',
      pieceInnerR: 'rgba(200,60,50,0.45)', pieceInnerB: 'rgba(80,80,80,0.4)',
      pieceTextR: '#8b1a1a', pieceTextB: '#1a1a1a' },
    { id: 'bamboo', name: '翠竹清风', emoji: '🎋',
      boardBg: '#c8d6b5', boardLine: '#5a6b45',
      pieceR: ['#fff8e8','#f0e0b8','#d8c080','#b8a060'],
      pieceB: ['#fafaf0','#e8e0c8','#c8c0a0','#a09878'],
      pieceOuterR: '#7a4020', pieceOuterB: '#2a2a2a',
      pieceInnerR: 'rgba(160,80,50,0.45)', pieceInnerB: 'rgba(70,70,70,0.4)',
      pieceTextR: '#6b1810', pieceTextB: '#1a1a1a' },
    { id: 'ricepaper', name: '宣纸素白', emoji: '📜',
      boardBg: '#e8dcc8', boardLine: '#8b7b6b',
      pieceR: ['#fffaf5','#f0e0c8','#d8c098','#b8a078'],
      pieceB: ['#fafaf8','#e8e4d8','#c8c4b0','#a0a090'],
      pieceOuterR: '#9b3030', pieceOuterB: '#2a2a2a',
      pieceInnerR: 'rgba(210,70,60,0.45)', pieceInnerB: 'rgba(80,80,80,0.4)',
      pieceTextR: '#8b1a1a', pieceTextB: '#1a1a1a' },
    { id: 'ink', name: '墨韵书香', emoji: '🖌️',
      boardBg: '#c8bfb0', boardLine: '#4a4038',
      pieceR: ['#faf5f0','#e8dcd0','#c8b898','#a89878'],
      pieceB: ['#f8f4f0','#e0d8d0','#b8b0a8','#908880'],
      pieceOuterR: '#8b3030', pieceOuterB: '#1a1a1a',
      pieceInnerR: 'rgba(180,60,50,0.45)', pieceInnerB: 'rgba(60,60,60,0.4)',
      pieceTextR: '#7a1818', pieceTextB: '#1a1a1a' },
    { id: 'dark', name: '暗夜模式', emoji: '🌙',
      boardBg: '#3d3d44', boardLine: '#5e5e68',
      pieceR: ['#ffe8d0','#f0c890','#d8a060','#b88840'],
      pieceB: ['#f0ece8','#d8d4d0','#b0aca8','#888480'],
      pieceOuterR: '#c04040', pieceOuterB: '#555',
      pieceInnerR: 'rgba(220,80,70,0.5)', pieceInnerB: 'rgba(130,130,130,0.45)',
      pieceTextR: '#d04040', pieceTextB: '#ddd' },
    { id: 'ocean', name: '深海幽蓝', emoji: '🌊',
      boardBg: '#8a9aaa', boardLine: '#445566',
      pieceR: ['#fff8f0','#f0e0c0','#d8c090','#b8a070'],
      pieceB: ['#fafaf5','#e8e4d8','#c8c4b0','#a0a090'],
      pieceOuterR: '#8b3030', pieceOuterB: '#222',
      pieceInnerR: 'rgba(200,60,50,0.45)', pieceInnerB: 'rgba(80,80,80,0.4)',
      pieceTextR: '#8b1a1a', pieceTextB: '#1a1a1a' },
  ];

  /** 背景主题 */
  const BG_THEMES = [
    { id: 'bg-none',     name: '纯色深邃',    emoji: '🌑', cls: '', dynamic: false },
    { id: 'bg-stripes',  name: '流金条纹',    emoji: '📐', cls: 'bg-stripes', dynamic: true },
    { id: 'bg-ripple',   name: '涟漪扩散',    emoji: '🫧', cls: 'bg-ripple', dynamic: true },
    { id: 'bg-orbs',     name: '浮光掠影',    emoji: '🔮', cls: 'bg-orbs', dynamic: true },
    { id: 'bg-spin',     name: '几何星芒',    emoji: '✦', cls: 'bg-spin', dynamic: true },
    { id: 'bg-breath',   name: '呼吸脉冲',    emoji: '💜', cls: 'bg-breath', dynamic: true },
    { id: 'bg-scan',     name: '扫描光束',    emoji: '🔍', cls: 'bg-scan', dynamic: true },
    { id: 'bg-aurora',   name: '极光帷幕',    emoji: '🌌', cls: 'bg-aurora', dynamic: true },
    { id: 'bg-petals',   name: '樱花飘落',    emoji: '🌸', cls: 'bg-petals', dynamic: true },
    { id: 'bg-rain',     name: '细雨纷飞',    emoji: '🌧️', cls: 'bg-rain', dynamic: true },
    { id: 'bg-mesh',     name: '网格滑移',    emoji: '📊', cls: 'bg-mesh', dynamic: true },
    { id: 'bg-wave',     name: '波浪起伏',    emoji: '🌊', cls: 'bg-wave', dynamic: true },
    { id: 'bg-lava',     name: '熔岩暗涌',    emoji: '🌋', cls: 'bg-lava', dynamic: true },
    { id: 'bg-morph',    name: '液态流形',    emoji: '💧', cls: 'bg-morph', dynamic: true },
    { id: 'bg-nebula',   name: '星云幻境',    emoji: '💫', cls: 'bg-nebula', dynamic: true },
    { id: 'bg-frost',    name: '冰霜结晶',    emoji: '❄️', cls: 'bg-frost', dynamic: true },
    { id: 'bg-stars',    name: '极夜星空',    emoji: '✨', cls: 'bg-stars', dynamic: true },
    { id: 'bg-volt',     name: '雷电脉冲',    emoji: '⚡', cls: 'bg-volt', dynamic: true },
    { id: 'bg-light',    name: '晨曦微光',    emoji: '🤍', cls: 'bg-light', dynamic: true },
    { id: 'bg-particle', name: '禅意粒子',    emoji: '🧘', cls: 'bg-particle', dynamic: true },
  ];

  let currentBoardTheme = BOARD_THEMES[0];
  let currentBgTheme = BG_THEMES[0];
  const BOARD_KEY = 'cc-board-theme';
  const BG_KEY = 'cc-bg-theme';

  function getBoardTheme() { return currentBoardTheme; }
  function getBgTheme() { return currentBgTheme; }

  function setBoardTheme(id) {
    const t = BOARD_THEMES.find(th => th.id === id);
    if (!t) return;
    currentBoardTheme = t;
    try { localStorage.setItem(BOARD_KEY, id); } catch(e) {}
    draw();
  }

  function setBgTheme(id) {
    const t = BG_THEMES.find(th => th.id === id);
    if (!t) return;
    currentBgTheme = t;
    try { localStorage.setItem(BG_KEY, id); } catch(e) {}
    applyBgTheme();
  }

  function applyBgTheme() {
    // 清除所有 bg- 前缀的背景类（用 BG_THEMES 动态获取）
    BG_THEMES.forEach(t => { if (t.cls) document.body.classList.remove(t.cls); });
    // 应用新背景类
    if (currentBgTheme.cls) document.body.classList.add(currentBgTheme.cls);
    // Canvas 粒子管理
    if (currentBgTheme.id === 'bg-particle') {
      if (typeof Particles !== 'undefined') Particles.start();
    } else {
      if (typeof Particles !== 'undefined') Particles.stop();
    }
  }

  function initThemes() {
    let savedB, savedG;
    try { savedB = localStorage.getItem(BOARD_KEY); savedG = localStorage.getItem(BG_KEY); } catch(e) {}
    currentBoardTheme = BOARD_THEMES.find(t => t.id === savedB) || BOARD_THEMES[0];
    currentBgTheme = BG_THEMES.find(t => t.id === savedG) || BG_THEMES[0];
    applyBgTheme();
  }

  function getBoardThemes() { return BOARD_THEMES; }
  function getBgThemes() { return BG_THEMES; }

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
      'btn-themes','btn-rules','btn-theme-back','btn-rules-back',
      'theme-grid-board','theme-grid-bg','theme-tabs','rules-tabs',
    ];
    ids.forEach(id => { elements[id] = document.getElementById(id); });

    initThemes();
    initThemePreview();

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
    ctx.fillStyle = currentBoardTheme.boardBg;
    ctx.fillRect(0, 0, w, h);

    // 网格线
    ctx.strokeStyle = currentBoardTheme.boardLine;
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
    ctx.fillStyle = currentBoardTheme.boardLine;
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
    ctx.strokeStyle = currentBoardTheme.boardLine;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2 * s, y + 2 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 2 * s, y); ctx.lineTo(x, y + 2 * s); ctx.stroke();
  }

  function drawPieceAt(px, py, piece, isFloating) {
    const r = cellSize * 0.44;
    if (r <= 0) return;
    const color = board.getColor(piece);
    const char = board.getChar(piece);
    const isRed = color === board.RED;
    ctx.save();
    if (isFloating) ctx.globalAlpha = 0.6;

    // ★ 增强阴影：立体感的关键
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = r * 0.2;
    ctx.shadowOffsetX = 1.5;
    ctx.shadowOffsetY = 2.5;

    // ★ 径向渐变：模拟球面光照（高光在左上 35% 处）
    const grad = ctx.createRadialGradient(
      px - r * 0.3, py - r * 0.3, r * 0.05,  // 高光中心（左上偏移）
      px, py, r                                 // 棋子边缘
    );
    const pc = isRed ? currentBoardTheme.pieceR : currentBoardTheme.pieceB;
    grad.addColorStop(0, pc[0]);
    grad.addColorStop(0.4, pc[1]);
    grad.addColorStop(0.85, pc[2]);
    grad.addColorStop(1, pc[3]);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // 清除阴影后画边框（边框不需要阴影）
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // ★ 外圈粗边框
    const outerColor = isRed ? currentBoardTheme.pieceOuterR : currentBoardTheme.pieceOuterB;
    ctx.strokeStyle = outerColor;
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.stroke();

    // ★ 内圈高光环（模拟棋子凹陷感）
    if (r > 8) {
      ctx.beginPath(); ctx.arc(px, py, r - r * 0.15, 0, Math.PI * 2);
      const highlightColor = isRed ? currentBoardTheme.pieceInnerR : currentBoardTheme.pieceInnerB;
      ctx.strokeStyle = highlightColor;
      ctx.lineWidth = Math.max(1, r * 0.07);
      ctx.stroke();
    }

    // ★ 棋子文字
    const textColor = isRed ? currentBoardTheme.pieceTextR : currentBoardTheme.pieceTextB;
    ctx.fillStyle = textColor;
    // 增大字号，加粗，优化字体回退链
    ctx.font = `bold ${r * 1.3}px "STKaiti", "KaiTi", "楷体", "Noto Serif SC", "FangSong", "仿宋", "SimSun", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, px, py + r * 0.04);

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

  /**
   * 悔棋动画：棋子从终点滑回起点（300ms ease-out）
   * 调研参考：chesscanvas / TaylorPzreal/chinese-chess
   */
  function animateUndo(fromX, fromY, toX, toY, piece, onDone) {
    // 先画好上一步标记
    lastFrom = { x: toX, y: toY };
    lastTo = { x: fromX, y: fromY };
    lastMoveColor = piece ? board.getColor(piece) : null;

    animPiece = piece;
    animFromX = toX; animFromY = toY;  // 从目标位
    animToX = fromX; animToY = fromY;  // 滑回原位
    animStart = performance.now();

    function animLoop(now) {
      const elapsed = now - animStart;
      if (elapsed >= 300) {
        animPiece = null;
        draw();
        if (onDone) onDone();
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

  /** 初始化主题选择器预览 */
  function initThemePreview() {
    // 棋盘主题网格
    const boardGrid = elements['theme-grid-board'];
    if (boardGrid) {
      boardGrid.innerHTML = '';
      BOARD_THEMES.forEach(theme => {
        const card = createBoardCard(theme, boardGrid);
        boardGrid.appendChild(card);
      });
    }

    // 背景主题网格
    const bgGrid = elements['theme-grid-bg'];
    if (bgGrid) {
      bgGrid.innerHTML = '';
      BG_THEMES.forEach(theme => {
        const card = createBgCard(theme, bgGrid);
        bgGrid.appendChild(card);
      });
    }

    // 绑定 Tab 切换（确保 onclick 之外也有 JS 绑定）
    const themeTabs = elements['theme-tabs'];
    if (themeTabs) {
      themeTabs.querySelectorAll('.rules-tab').forEach(tab => {
        tab.addEventListener('click', function() {
          if (typeof switchThemeTab === 'function') switchThemeTab(this.dataset.tab, this);
        });
      });
    }
  }

  function createBoardCard(theme, grid) {
    const card = document.createElement('div');
    card.className = 'theme-card' + (theme.id === currentBoardTheme.id ? ' selected' : '');
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', theme.id === currentBoardTheme.id ? 'true' : 'false');
    card.dataset.themeId = theme.id;

    const preview = document.createElement('canvas');
    preview.width = 120; preview.height = 80;
    preview.className = 'theme-preview';
    drawBoardPreview(preview, theme);

    const label = document.createElement('span');
    label.className = 'theme-label';
    label.textContent = theme.emoji + ' ' + theme.name;

    card.appendChild(preview);
    card.appendChild(label);

    card.addEventListener('click', () => {
      setBoardTheme(theme.id);
      grid.querySelectorAll('.theme-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.themeId === theme.id);
        c.setAttribute('aria-checked', c.dataset.themeId === theme.id ? 'true' : 'false');
      });
    });

    return card;
  }

  function createBgCard(theme, grid) {
    const card = document.createElement('div');
    card.className = 'theme-card' + (theme.id === currentBgTheme.id ? ' selected' : '');
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', theme.id === currentBgTheme.id ? 'true' : 'false');
    card.dataset.bgId = theme.id;

    // 背景预览：用 div + 背景类
    const preview = document.createElement('div');
    preview.className = 'bg-preview';
    if (theme.cls) preview.classList.add(theme.cls);

    const label = document.createElement('span');
    label.className = 'theme-label';
    label.textContent = theme.emoji + ' ' + theme.name;

    card.appendChild(preview);
    card.appendChild(label);

    card.addEventListener('click', () => {
      setBgTheme(theme.id);
      grid.querySelectorAll('.theme-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.bgId === theme.id);
        c.setAttribute('aria-checked', c.dataset.bgId === theme.id ? 'true' : 'false');
      });
    });

    return card;
  }

  /** 在迷你 Canvas 上绘制棋盘预览 */
  function drawBoardPreview(canvas, theme) {
    const pc = canvas.getContext('2d');
    const pw = canvas.width, ph = canvas.height;
    const margin = 6;
    const cols = 8, rows = 9;
    const cs = Math.min((pw - margin * 2) / cols, (ph - margin * 2) / rows);
    const ox = (pw - cs * cols) / 2, oy = (ph - cs * rows) / 2;

    // 背景
    pc.fillStyle = theme.boardBg;
    pc.fillRect(0, 0, pw, ph);

    // 网格线
    pc.strokeStyle = theme.boardLine;
    pc.lineWidth = 0.5;
    for (let r = 0; r <= rows; r++) {
      pc.beginPath(); pc.moveTo(ox, oy + r * cs); pc.lineTo(ox + cols * cs, oy + r * cs); pc.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      pc.beginPath(); pc.moveTo(ox + c * cs, oy); pc.lineTo(ox + c * cs, oy + rows * cs); pc.stroke();
    }

    // 画 3 颗样本棋子（红黑各 1-2 颗）
    const samplePieces = [
      { x: 1, y: 4, isR: true, ch: '車' },
      { x: 4, y: 0, isR: false, ch: '將' },
      { x: 6, y: 8, isR: true, ch: '帥' },
    ];

    samplePieces.forEach(sp => {
      const px = ox + sp.x * cs, py = oy + sp.y * cs;
      const rr = cs * 0.42;
      if (rr <= 0) return;

      // 渐变
      const grad = pc.createRadialGradient(px - rr * 0.3, py - rr * 0.3, rr * 0.05, px, py, rr);
      const pcol = sp.isR ? theme.pieceR : theme.pieceB;
      grad.addColorStop(0, pcol[0]);
      grad.addColorStop(0.4, pcol[1]);
      grad.addColorStop(0.85, pcol[2]);
      grad.addColorStop(1, pcol[3]);
      pc.beginPath(); pc.arc(px, py, rr, 0, Math.PI * 2);
      pc.fillStyle = grad;
      pc.fill();

      // 边框
      pc.strokeStyle = sp.isR ? theme.pieceOuterR : theme.pieceOuterB;
      pc.lineWidth = Math.max(1, rr * 0.12);
      pc.stroke();

      // 文字
      pc.fillStyle = sp.isR ? theme.pieceTextR : theme.pieceTextB;
      pc.font = `bold ${rr * 1.2}px "STKaiti", "KaiTi", serif`;
      pc.textAlign = 'center';
      pc.textBaseline = 'middle';
      pc.fillText(sp.ch, px, py);
    });
  }

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
    startMoveAnimation, animateUndo,
    setCheckHighlight, clearCheckHighlight,
    setPlayerCards, updateTimerDisplay, setTimerUrgent,
    setMoveCount, setHint,
    showWin, hideWin, showRequest, hideRequest,
    showToast, showRoomInfo, hideRoomInfo, showJoinError,
    getInputRoomId, getElement, onMove,
    // 主题
    getBoardTheme, getBgTheme, setBoardTheme, setBgTheme,
    getBoardThemes, getBgThemes, initThemePreview,
  };
})();
