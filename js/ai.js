/**
 * 中国象棋 AI 引擎
 *
 * 简单模式：贪心搜索（评估所有走法，选最高分）
 * 中等模式：MiniMax + Alpha-Beta 剪枝（深度 2-3）
 *
 * 棋子价值参考王骄(2005)遗传算法优化权重
 */
const AI = (() => {
  // 棋子基础价值
  const PIECE_VALUE = {
    0: 10000,  // 帥/將
    4: 600,    // 車
    5: 400,    // 砲/炮
    3: 300,    // 馬
    2: 120,    // 相/象
    1: 120,    // 仕/士
    6: 60,     // 兵/卒(未过河)
  };

  // 兵过河后价值翻倍
  const PAWN_CROSSED = 120;

  /** 获取棋子动态价值 */
  function getValue(piece, y) {
    const type = Board.getType(piece);
    const color = Board.getColor(piece);
    if (type !== Board.PAWN) return PIECE_VALUE[type] || 0;

    // 兵/卒：过河后价值提升
    if (color === Board.RED && y <= 4) return PAWN_CROSSED;
    if (color === Board.BLACK && y >= 5) return PAWN_CROSSED;
    return PIECE_VALUE[Board.PAWN];
  }

  // ==================== 评估函数 ====================

  /** 评估局面得分（从 AI 方视角，正数利于 AI） */
  function evaluate(board, aiColor) {
    const opponent = aiColor === Board.RED ? Board.BLACK : Board.RED;
    let score = 0;

    for (let y = 0; y < Board.ROWS; y++) {
      for (let x = 0; x < Board.COLS; x++) {
        const p = board.get(x, y);
        if (p === Board.EMPTY) continue;
        const color = Board.getColor(p);
        const val = getValue(p, y);
        if (color === aiColor) {
          score += val;
        } else {
          score -= val;
        }
      }
    }

    return score;
  }

  // ==================== 走法排序（提升 Alpha-Beta 剪枝效率） ====================

  /** MVV-LVA：被吃子价值 - 攻击子价值，高分优先 */
  function sortMoves(moves, board) {
    return moves.sort((a, b) => {
      const capA = board.get(a.tx, a.ty);
      const capB = board.get(b.tx, b.ty);
      const valA = capA !== Board.EMPTY ? getValue(capA, a.ty) : 0;
      const valB = capB !== Board.EMPTY ? getValue(capB, b.ty) : 0;
      return valB - valA;  // 吃子价值高的优先
    });
  }

  // ==================== 简单模式：贪心搜索 ====================

  function easyMove(board) {
    const aiColor = board.getCurrentPlayer();
    const allMoves = board.getAllLegalMoves(aiColor);
    if (allMoves.length === 0) return null;

    let bestScore = -Infinity;
    let bestMoves = [];

    for (const m of allMoves) {
      const saved = board.getState();
      board.movePiece(m.fx, m.fy, m.tx, m.ty);
      const score = evaluate(board, aiColor);
      board.loadState(saved);

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [m];
      } else if (score === bestScore) {
        bestMoves.push(m);
      }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // ==================== 中等模式：Alpha-Beta ====================

  function mediumMove(board) {
    const aiColor = board.getCurrentPlayer();
    const allMoves = board.getAllLegalMoves(aiColor);
    if (allMoves.length === 0) return null;

    sortMoves(allMoves, board);

    let bestMove = allMoves[0];
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    for (const m of allMoves) {
      const saved = board.getState();
      board.movePiece(m.fx, m.fy, m.tx, m.ty);
      const score = -negamax(board, 2, -beta, -alpha, aiColor);
      board.loadState(saved);

      if (score > bestScore) {
        bestScore = score;
        bestMove = m;
      }
      if (score > alpha) alpha = score;
    }

    return bestMove;
  }

  /**
   * Negamax 搜索
   * @param {object} board   Board 模块
   * @param {number} depth   剩余搜索深度
   * @param {number} alpha   Alpha 边界
   * @param {number} beta    Beta 边界
   * @param {number} aiColor AI 的颜色（用于评估符号）
   */
  function negamax(board, depth, alpha, beta, aiColor) {
    const currentColor = board.getCurrentPlayer();

    // 叶节点：评估
    if (depth === 0) {
      return evaluate(board, aiColor) * (currentColor === aiColor ? 1 : -1);
    }

    const allMoves = board.getAllLegalMoves(currentColor);

    // 无走法：将死或困毙
    if (allMoves.length === 0) {
      // 对当前走子方不利
      return -99999 + (3 - depth) * 100;  // 越晚被将死越好
    }

    sortMoves(allMoves, board);

    let best = -Infinity;
    for (const m of allMoves) {
      const saved = board.getState();
      board.movePiece(m.fx, m.fy, m.tx, m.ty);
      const score = -negamax(board, depth - 1, -beta, -alpha, aiColor);
      board.loadState(saved);

      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;  // Beta 剪枝
    }

    return best;
  }

  // ==================== 公共接口 ====================

  /**
   * 获取 AI 最佳走法
   * @param {string} difficulty  'easy' | 'medium'
   * @returns {{fx, fy, tx, ty} | null}
   */
  function getMove(board, difficulty) {
    if (difficulty === 'medium') {
      return mediumMove(board);
    }
    return easyMove(board);
  }

  return { getMove };
})();
