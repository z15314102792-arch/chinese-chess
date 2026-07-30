/**
 * 中国象棋 AI 引擎
 *
 * 简单模式：贪心搜索 + 随机噪声（模拟初学者水平）
 * 中等模式：MiniMax + Alpha-Beta 剪枝（深度 3）+ 位置评估
 */
const AI = (() => {
  // 棋子基础价值（调整：炮略低于马，减少激进炮换马）
  const PIECE_VALUE = {
    0: 10000,  // 帥/將
    4: 600,    // 車
    3: 350,    // 馬
    5: 320,    // 砲/炮（降权，减少开局炮换马）
    2: 120,    // 相/象
    1: 120,    // 仕/士
    6: 55,     // 兵/卒(未过河)
  };

  const PAWN_CROSSED = 120;

  function getValue(piece, y) {
    const type = Board.getType(piece);
    if (type !== Board.PAWN) return PIECE_VALUE[type] || 0;
    const color = Board.getColor(piece);
    if (color === Board.RED && y <= 4) return PAWN_CROSSED;
    if (color === Board.BLACK && y >= 5) return PAWN_CROSSED;
    return PIECE_VALUE[Board.PAWN];
  }

  // ==================== 位置价值加成 ====================

  /** 简单位置加分：中路 + 过河 + 前线 */
  function positionBonus(piece, x, y) {
    const type = Board.getType(piece);
    const color = Board.getColor(piece);
    let bonus = 0;

    // 中路控制（列 3-5）
    if (x >= 3 && x <= 5) bonus += 3;

    if (type === Board.ROOK || type === Board.HORSE || type === Board.CANNON) {
      // 鼓励大子过河
      if (color === Board.RED && y <= 4) bonus += 8;
      if (color === Board.BLACK && y >= 5) bonus += 8;
    }

    if (type === Board.PAWN) {
      // 兵过河后中路加分更多
      const crossed = (color === Board.RED && y <= 4) || (color === Board.BLACK && y >= 5);
      if (crossed && x >= 3 && x <= 5) bonus += 5;
    }

    if (type === Board.KING) {
      // 将/帅靠边不安全，中间更好
      if (x === 4) bonus += 5;
    }

    return bonus;
  }

  // ==================== 评估函数 ====================

  function evaluate(board, aiColor) {
    let score = 0;

    for (let y = 0; y < Board.ROWS; y++) {
      for (let x = 0; x < Board.COLS; x++) {
        const p = board.get(x, y);
        if (p === Board.EMPTY) continue;
        const color = Board.getColor(p);
        const val = getValue(p, y) + positionBonus(p, x, y);
        score += (color === aiColor) ? val : -val;
      }
    }

    return score;
  }

  // ==================== 走法排序 ====================

  function sortMoves(moves, board) {
    return moves.sort((a, b) => {
      const capA = board.get(a.tx, a.ty);
      const capB = board.get(b.tx, b.ty);
      const valA = capA !== Board.EMPTY ? getValue(capA, a.ty) : 0;
      const valB = capB !== Board.EMPTY ? getValue(capB, b.ty) : 0;
      return valB - valA;
    });
  }

  // ==================== 简单模式：贪心搜索 + 噪声 ====================

  function easyMove(board) {
    const aiColor = board.getCurrentPlayer();
    const allMoves = board.getAllLegalMoves(aiColor);
    if (allMoves.length === 0) return null;

    let bestScore = -Infinity;
    let bestMoves = [];

    for (const m of allMoves) {
      const saved = board.getState();
      board.movePiece(m.fx, m.fy, m.tx, m.ty);

      let score = evaluate(board, aiColor);

      // ★ 吃子时加入交易惩罚（模拟可能被反吃的风险）
      const captured = board.get(m.tx, m.ty);
      if (captured !== Board.EMPTY) {
        const attackerVal = getValue(saved.grid[m.fy][m.fx], m.fy);
        const capturedVal = getValue(captured, m.ty);
        // 净收益 = 吃子价值 - 攻击子风险（30%概率被反吃）
        const netGain = capturedVal - attackerVal * 0.3;
        // 添加到分数（正数表示赚了，负数表示亏了）
        score += netGain * 0.5;
      }

      // ★ 简单 AI 加轻微随机噪声 (-15 ~ +15)，不那么机械
      score += (Math.random() - 0.5) * 30;

      board.loadState(saved);

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [m];
      } else if (Math.abs(score - bestScore) < 5) {
        // 分数接近时也加入候选
        bestMoves.push(m);
      }
    }

    // 从最优的几个中随机选（增加变化性）
    const topN = bestMoves.slice(0, Math.max(3, bestMoves.length));
    return topN[Math.floor(Math.random() * topN.length)];
  }

  // ==================== 中等模式：Alpha-Beta ====================

  function mediumMove(board) {
    const aiColor = board.getCurrentPlayer();
    const allMoves = board.getAllLegalMoves(aiColor);
    if (allMoves.length === 0) return null;

    sortMoves(allMoves, board);

    // 限制走法数（性能优化，只搜索前 30 个最优候选）
    const candidates = allMoves.slice(0, 30);

    let bestMove = candidates[0];
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    for (const m of candidates) {
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

  function negamax(board, depth, alpha, beta, aiColor) {
    const currentColor = board.getCurrentPlayer();

    if (depth === 0) {
      return evaluate(board, aiColor) * (currentColor === aiColor ? 1 : -1);
    }

    const allMoves = board.getAllLegalMoves(currentColor);

    if (allMoves.length === 0) {
      return -99999 + (3 - depth) * 100;
    }

    sortMoves(allMoves, board);
    const candidates = allMoves.slice(0, 25);

    let best = -Infinity;
    for (const m of candidates) {
      const saved = board.getState();
      board.movePiece(m.fx, m.fy, m.tx, m.ty);
      const score = -negamax(board, depth - 1, -beta, -alpha, aiColor);
      board.loadState(saved);

      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }

    return best;
  }

  // ==================== 公共接口 ====================

  function getMove(board, difficulty) {
    if (difficulty === 'medium') {
      return mediumMove(board);
    }
    return easyMove(board);
  }

  return { getMove };
})();
