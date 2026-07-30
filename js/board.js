/**
 * 中国象棋棋盘逻辑
 * 9列×10行，红方（RED）先手，黑方（BLACK）后手
 *
 * 棋子编码规则：(类型+1) + 红方?0:7
 *   红方 1-7: 帥(1) 仕(2) 相(3) 馬(4) 車(5) 砲(6) 兵(7)
 *   黑方 8-14: 將(8) 士(9) 象(10) 馬(11) 車(12) 炮(13) 卒(14)
 */
const Board = (() => {
  const COLS = 9;
  const ROWS = 10;

  // 基本常量
  const EMPTY = 0;
  const RED = 1;
  const BLACK = 2;

  // 棋子类型
  const KING    = 0;
  const ADVISOR = 1;
  const ELEPHANT = 2;
  const HORSE   = 3;
  const ROOK    = 4;
  const CANNON  = 5;
  const PAWN    = 6;

  // 类型→汉字映射
  const RED_CHARS  = ['帥','仕','相','馬','車','砲','兵'];
  const BLACK_CHARS = ['將','士','象','馬','車','炮','卒'];

  let grid = [];
  let currentPlayer = RED;  // 红先
  let history = [];         // [{fx, fy, tx, ty, piece, captured}]
  let moveCount = 0;

  /** 初始化棋盘 */
  function init() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));

    // 黑方底线 (row 0)
    grid[0][0] = makePiece(ROOK,    BLACK);   // 車
    grid[0][1] = makePiece(HORSE,   BLACK);   // 馬
    grid[0][2] = makePiece(ELEPHANT,BLACK);  // 象
    grid[0][3] = makePiece(ADVISOR, BLACK);  // 士
    grid[0][4] = makePiece(KING,    BLACK);  // 將
    grid[0][5] = makePiece(ADVISOR, BLACK);  // 士
    grid[0][6] = makePiece(ELEPHANT,BLACK);  // 象
    grid[0][7] = makePiece(HORSE,   BLACK);  // 馬
    grid[0][8] = makePiece(ROOK,    BLACK);  // 車

    // 黑方炮 (row 2)
    grid[2][1] = makePiece(CANNON, BLACK);
    grid[2][7] = makePiece(CANNON, BLACK);

    // 黑方卒 (row 3)
    for (let c = 0; c <= 8; c += 2) { grid[3][c] = makePiece(PAWN, BLACK); }

    // 红方兵 (row 6)
    for (let c = 0; c <= 8; c += 2) { grid[6][c] = makePiece(PAWN, RED); }

    // 红方炮 (row 7)
    grid[7][1] = makePiece(CANNON, RED);
    grid[7][7] = makePiece(CANNON, RED);

    // 红方底线 (row 9)
    grid[9][0] = makePiece(ROOK,    RED);
    grid[9][1] = makePiece(HORSE,   RED);
    grid[9][2] = makePiece(ELEPHANT,RED);
    grid[9][3] = makePiece(ADVISOR, RED);
    grid[9][4] = makePiece(KING,    RED);
    grid[9][5] = makePiece(ADVISOR, RED);
    grid[9][6] = makePiece(ELEPHANT,RED);
    grid[9][7] = makePiece(HORSE,   RED);
    grid[9][8] = makePiece(ROOK,    RED);

    history = [];
    currentPlayer = RED;
    moveCount = 0;
  }

  /** 构造棋子编码 */
  function makePiece(type, color) {
    return (type + 1) + (color === RED ? 0 : 7);
  }

  // ==================== 解码 ====================

  function getColor(p) {
    if (p === EMPTY) return null;
    return p <= 7 ? RED : BLACK;
  }

  function getType(p) {
    if (p === EMPTY) return null;
    return (p - 1) % 7;
  }

  function getChar(p) {
    if (p === EMPTY) return '';
    const c = getColor(p);
    const t = getType(p);
    return c === RED ? RED_CHARS[t] : BLACK_CHARS[t];
  }

  function isRed(p)   { return p >= 1 && p <= 7; }
  function isBlack(p) { return p >= 8 && p <= 14; }

  /** 两子同色 */
  function sameSide(a, b) {
    if (a === EMPTY || b === EMPTY) return false;
    return isRed(a) === isRed(b);
  }

  // ==================== 基础 API ====================

  function getSize() { return { cols: COLS, rows: ROWS }; }
  function getCurrentPlayer() { return currentPlayer; }

  function get(x, y) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return null;
    return grid[y][x];
  }

  function inBounds(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS;
  }

  // ==================== 九宫判断 ====================

  function inPalace(x, y, color) {
    if (color === RED)  return x >= 3 && x <= 5 && y >= 7 && y <= 9;
    if (color === BLACK) return x >= 3 && x <= 5 && y >= 0 && y <= 2;
    return false;
  }

  /** 是否在己方半场（象不过河） */
  function inOwnHalf(y, color) {
    if (color === RED)  return y >= 5;
    if (color === BLACK) return y <= 4;
    return false;
  }

  // ==================== 走法生成 ====================

  /** 获取某位置棋子的原始走法（不含自将过滤） */
  function getRawMoves(x, y) {
    const piece = grid[y][x];
    if (piece === EMPTY) return [];

    const color = getColor(piece);
    const type  = getType(piece);

    switch (type) {
      case KING:     return kingMoves(x, y, color);
      case ADVISOR:  return advisorMoves(x, y, color);
      case ELEPHANT: return elephantMoves(x, y, color);
      case HORSE:    return horseMoves(x, y, color);
      case ROOK:     return rookMoves(x, y, color);
      case CANNON:   return cannonMoves(x, y, color);
      case PAWN:     return pawnMoves(x, y, color);
      default: return [];
    }
  }

  /** 获取合法走法（过滤自将） */
  function getLegalMoves(x, y) {
    const piece = grid[y][x];
    if (piece === EMPTY) return [];
    if (getColor(piece) !== currentPlayer) return [];

    const raw = getRawMoves(x, y);
    const color = getColor(piece);
    const legal = [];

    for (const { x: tx, y: ty } of raw) {
      // 模拟走子
      const saved = tinySave(x, y, tx, ty);
      doMoveOnGrid(x, y, tx, ty);
      if (!isInCheck(color)) {
        legal.push({ x: tx, y: ty });
      }
      tinyRestore(saved);
    }

    return legal;
  }

  /** 获取某方全部合法走法 */
  function getAllLegalMoves(color) {
    const all = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const p = grid[y][x];
        if (p !== EMPTY && getColor(p) === color) {
          const moves = getLegalMoves(x, y);
          for (const m of moves) {
            all.push({ fx: x, fy: y, tx: m.x, ty: m.y });
          }
        }
      }
    }
    return all;
  }

  // ---- 各棋子走法生成 ----

  function kingMoves(x, y, color) {
    const moves = [];
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx,dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (inBounds(nx, ny) && inPalace(nx, ny, color)
          && !sameSide(grid[y][x], grid[ny][nx])) {
        moves.push({ x: nx, y: ny });
      }
    }
    return moves;
  }

  function advisorMoves(x, y, color) {
    const moves = [];
    const dirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dx,dy] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (inBounds(nx, ny) && inPalace(nx, ny, color)
          && !sameSide(grid[y][x], grid[ny][nx])) {
        moves.push({ x: nx, y: ny });
      }
    }
    return moves;
  }

  function elephantMoves(x, y, color) {
    const moves = [];
    // [dx, dy, eyeX_offset, eyeY_offset]
    const steps = [
      [ 2,  2,  1,  1],
      [ 2, -2,  1, -1],
      [-2,  2, -1,  1],
      [-2, -2, -1, -1],
    ];
    for (const [dx, dy, ex, ey] of steps) {
      const nx = x + dx, ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      if (!inOwnHalf(ny, color)) continue;             // 不能过河
      if (grid[y + ey][x + ex] !== EMPTY) continue;    // 塞象眼
      if (sameSide(grid[y][x], grid[ny][nx])) continue;
      moves.push({ x: nx, y: ny });
    }
    return moves;
  }

  function horseMoves(x, y, color) {
    const moves = [];
    // [dx, dy, legX_offset, legY_offset]
    const steps = [
      [ 1, -2,  0, -1], [ 2, -1,  1,  0],
      [ 2,  1,  1,  0], [ 1,  2,  0,  1],
      [-1,  2,  0,  1], [-2,  1, -1,  0],
      [-2, -1, -1,  0], [-1, -2,  0, -1],
    ];
    for (const [dx, dy, lx, ly] of steps) {
      const nx = x + dx, ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      if (grid[y + ly][x + lx] !== EMPTY) continue;    // 蹩马脚
      if (sameSide(grid[y][x], grid[ny][nx])) continue;
      moves.push({ x: nx, y: ny });
    }
    return moves;
  }

  function rookMoves(x, y, color) {
    const moves = [];
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx,dy] of dirs) {
      for (let s = 1; ; s++) {
        const nx = x + dx * s, ny = y + dy * s;
        if (!inBounds(nx, ny)) break;
        if (grid[ny][nx] === EMPTY) {
          moves.push({ x: nx, y: ny });
        } else {
          if (!sameSide(grid[y][x], grid[ny][nx])) {
            moves.push({ x: nx, y: ny });  // 吃子
          }
          break;
        }
      }
    }
    return moves;
  }

  function cannonMoves(x, y, color) {
    const moves = [];
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx,dy] of dirs) {
      // 走子阶段（遇子停）
      for (let s = 1; ; s++) {
        const nx = x + dx * s, ny = y + dy * s;
        if (!inBounds(nx, ny)) break;
        if (grid[ny][nx] === EMPTY) {
          moves.push({ x: nx, y: ny });
        } else {
          // 找到炮架，开始找目标
          for (let s2 = s + 1; ; s2++) {
            const nx2 = x + dx * s2, ny2 = y + dy * s2;
            if (!inBounds(nx2, ny2)) break;
            if (grid[ny2][nx2] !== EMPTY) {
              if (!sameSide(grid[y][x], grid[ny2][nx2])) {
                moves.push({ x: nx2, y: ny2 });  // 翻山吃子
              }
              break;  // 只吃一个
            }
          }
          break;  // 炮架后面不能再走子
        }
      }
    }
    return moves;
  }

  function pawnMoves(x, y, color) {
    const moves = [];
    if (color === RED) {
      // 红兵向上（y 减小）
      const forward = y - 1;
      const crossed = y <= 4;  // 已过河

      if (inBounds(x, forward) && !sameSide(grid[y][x], grid[forward][x])) {
        moves.push({ x, y: forward });
      }
      if (crossed) {
        for (const sx of [x - 1, x + 1]) {
          if (inBounds(sx, y) && !sameSide(grid[y][x], grid[y][sx])) {
            moves.push({ x: sx, y });
          }
        }
      }
    } else {
      // 黑卒向下（y 增大）
      const forward = y + 1;
      const crossed = y >= 5;

      if (inBounds(x, forward) && !sameSide(grid[y][x], grid[forward][x])) {
        moves.push({ x, y: forward });
      }
      if (crossed) {
        for (const sx of [x - 1, x + 1]) {
          if (inBounds(sx, y) && !sameSide(grid[y][x], grid[y][sx])) {
            moves.push({ x: sx, y });
          }
        }
      }
    }
    return moves;
  }

  // ==================== 将军检测 ====================

  /** color 方的帅/将是否被将军 */
  function isInCheck(color) {
    const kingPos = findKing(color);
    if (!kingPos) return true;  // 将被吃了，视为被将（不应出现）

    const opponent = color === RED ? BLACK : RED;

    // 1. 检查对方所有棋子是否能攻击到帅/将
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const p = grid[y][x];
        if (p === EMPTY || getColor(p) !== opponent) continue;
        const raw = getRawMoves(x, y);
        for (const m of raw) {
          if (m.x === kingPos.x && m.y === kingPos.y) return true;
        }
      }
    }

    // 2. 飞将检测（双方帅将在同一列且无遮挡）
    if (flyingKingCheck()) return true;

    return false;
  }

  function findKing(color) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const p = grid[y][x];
        if (p !== EMPTY && getType(p) === KING && getColor(p) === color) {
          return { x, y };
        }
      }
    }
    return null;
  }

  function flyingKingCheck() {
    const rk = findKing(RED);
    const bk = findKing(BLACK);
    if (!rk || !bk) return false;
    if (rk.x !== bk.x) return false;

    // 同列，检查中间是否有棋子
    const minY = Math.min(rk.y, bk.y);
    const maxY = Math.max(rk.y, bk.y);
    for (let y = minY + 1; y < maxY; y++) {
      if (grid[y][rk.x] !== EMPTY) return false;
    }
    return true;  // 无遮挡 → 飞将
  }

  /** 将死：被将军且无合法走法 */
  function isCheckmate(color) {
    return isInCheck(color) && getAllLegalMoves(color).length === 0;
  }

  /** 困毙：未被将军但无合法走法 */
  function isStalemate(color) {
    return !isInCheck(color) && getAllLegalMoves(color).length === 0;
  }

  // ==================== 走子操作 ====================

  /**
   * 执行走子，返回 true 表示成功
   * 不检查合法性（由调用方通过 getLegalMoves 先确认）
   */
  function movePiece(fx, fy, tx, ty) {
    if (!inBounds(fx, fy) || !inBounds(tx, ty)) return false;
    const piece = grid[fy][fx];
    if (piece === EMPTY) return false;

    const captured = grid[ty][tx];

    // 记录历史
    history.push({ fx, fy, tx, ty, piece, captured });

    // 执行
    grid[ty][tx] = piece;
    grid[fy][fx] = EMPTY;
    moveCount++;

    return true;
  }

  /** 切换回合 */
  function switchPlayer() {
    currentPlayer = currentPlayer === RED ? BLACK : RED;
  }

  /** 悔棋：撤回一手 */
  function undoOne() {
    if (history.length === 0) return null;
    const last = history.pop();
    grid[last.fy][last.fx] = last.piece;
    grid[last.ty][last.tx] = last.captured;
    currentPlayer = getColor(last.piece);
    moveCount--;
    return last;
  }

  /** 悔棋：撤回双方各一手（AI 模式用） */
  function undo() {
    if (history.length === 0) return null;
    const last = undoOne();  // 撤 AI 的棋
    if (history.length > 0 && getColor(history[history.length - 1].piece) !== getColor(last.piece)) {
      undoOne();  // 撤玩家的棋
    }
    return last;
  }

  // ==================== 状态序列化（AI 用） ====================

  function getState() {
    return {
      grid: grid.map(row => [...row]),
      currentPlayer,
      history: history.map(h => ({ ...h })),
      moveCount,
    };
  }

  function loadState(state) {
    grid = state.grid.map(row => [...row]);
    currentPlayer = state.currentPlayer;
    history = state.history.map(h => ({ ...h }));
    moveCount = state.moveCount;
  }

  // ==================== 原子操作（用于自将过滤） ====================

  /** 保存被替换的一格 */
  function tinySave(fx, fy, tx, ty) {
    return {
      fx, fy, tx, ty,
      piece: grid[fy][fx],
      captured: grid[ty][tx],
    };
  }

  function tinyRestore(s) {
    grid[s.fy][s.fx] = s.piece;
    grid[s.ty][s.tx] = s.captured;
  }

  function doMoveOnGrid(fx, fy, tx, ty) {
    grid[ty][tx] = grid[fy][fx];
    grid[fy][fx] = EMPTY;
  }

  // ==================== 工具 ====================

  function reset() { init(); }
  function getMoveCount() { return moveCount; }
  function getHistoryLength() { return history.length; }

  init();

  return {
    // 常量
    COLS, ROWS, EMPTY, RED, BLACK,
    KING, ADVISOR, ELEPHANT, HORSE, ROOK, CANNON, PAWN,
    // 解码
    getColor, getType, getChar, isRed, isBlack, sameSide,
    // 基础
    init, getSize, get, getCurrentPlayer, switchPlayer,
    // 走法
    getLegalMoves, getAllLegalMoves, getRawMoves,
    // 将军/胜负
    isInCheck, isCheckmate, isStalemate,
    findKing, flyingKingCheck,
    // 走子
    movePiece, inPalace, inOwnHalf, inBounds,
    // 悔棋
    undo, undoOne,
    // 状态
    getState, loadState, reset,
    getMoveCount, getHistoryLength,
  };
})();
