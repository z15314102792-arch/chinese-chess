/**
 * 中国象棋 AI 引擎
 *
 * 简单模式：2层Minimax + 随机噪声（≈五子棋简单）
 * 中等模式：3层Alpha-Beta + 走法排序 + 位置评估（≈五子棋中等）
 */
const AI = (() => {
  const PIECE_VALUE = {
    0: 10000,  // 帥/將
    4: 600,    // 車
    3: 300,    // 馬
    5: 300,    // 砲/炮
    2: 120,    // 相/象
    1: 120,    // 仕/士
    6: 55,     // 兵/卒(未过河)
  };
  const PAWN_CROSSED = 130;

  function getValue(piece, y) {
    const type = Board.getType(piece);
    if (type !== Board.PAWN) return PIECE_VALUE[type] || 0;
    const color = Board.getColor(piece);
    if (color === Board.RED && y <= 4) return PAWN_CROSSED;
    if (color === Board.BLACK && y >= 5) return PAWN_CROSSED;
    return PIECE_VALUE[Board.PAWN];
  }

  // 位置价值加成
  function posBonus(piece, x, y) {
    const type = Board.getType(piece);
    const color = Board.getColor(piece);
    let b = 0;

    // 中路控制
    if (x >= 3 && x <= 5) b += 2;

    // 大子过河奖励
    if (type === Board.ROOK || type === Board.HORSE || type === Board.CANNON) {
      const crossed = (color === Board.RED && y <= 4) || (color === Board.BLACK && y >= 5);
      if (crossed) b += 10;
    }

    // 兵过河中路加分
    if (type === Board.PAWN) {
      const crossed = (color === Board.RED && y <= 4) || (color === Board.BLACK && y >= 5);
      if (crossed && x >= 3 && x <= 5) b += 6;
    }

    // 帅在中间更安全
    if (type === Board.KING && x === 4) b += 5;

    return b;
  }

  function evaluate(board, aiColor) {
    let score = 0;
    for (let y = 0; y < Board.ROWS; y++) {
      for (let x = 0; x < Board.COLS; x++) {
        const p = board.get(x, y);
        if (p === Board.EMPTY) continue;
        const color = Board.getColor(p);
        const val = getValue(p, y) + posBonus(p, x, y);
        score += (color === aiColor) ? val : -val;
      }
    }
    return score;
  }

  function sortMoves(moves, board) {
    return moves.sort((a, b) => {
      const ca = board.get(a.tx, a.ty), cb = board.get(b.tx, b.ty);
      const va = ca !== Board.EMPTY ? getValue(ca, a.ty) : 0;
      const vb = cb !== Board.EMPTY ? getValue(cb, b.ty) : 0;
      return vb - va;
    });
  }

  // ==================== 简单模式：2层Minimax + 噪声 ====================

  function easyMove(board) {
    const aiColor = board.getCurrentPlayer();
    const allMoves = board.getAllLegalMoves(aiColor);
    if (allMoves.length === 0) return null;

    let bestScore = -Infinity;
    let bestMoves = [];

    for (const m of allMoves) {
      const saved = board.getState();
      board.movePiece(m.fx, m.fy, m.tx, m.ty);
      board.switchPlayer();

      // 对手最佳回应
      const oppMoves = board.getAllLegalMoves(board.getCurrentPlayer());
      let oppBest = -Infinity;
      for (const om of oppMoves.slice(0, 20)) {
        const s2 = board.getState();
        board.movePiece(om.fx, om.fy, om.tx, om.ty);
        oppBest = Math.max(oppBest, evaluate(board, aiColor));
        board.loadState(s2);
      }
      if (oppMoves.length === 0) oppBest = -99999; // 将死对方

      const netScore = evaluate(board, aiColor) - oppBest * 0.6;

      // 简单AI加随机噪声（±20），增加变化
      const finalScore = netScore + (Math.random() - 0.5) * 40;

      board.loadState(saved);

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestMoves = [m];
      } else if (Math.abs(finalScore - bestScore) < 8) {
        bestMoves.push(m);
      }
    }

    const topN = bestMoves.slice(0, Math.max(3, Math.ceil(bestMoves.length * 0.3)));
    return topN[Math.floor(Math.random() * topN.length)];
  }

  // ==================== 中等模式：3层Alpha-Beta ====================

  function mediumMove(board) {
    const aiColor = board.getCurrentPlayer();
    const allMoves = board.getAllLegalMoves(aiColor);
    if (allMoves.length === 0) return null;

    sortMoves(allMoves, board);
    const candidates = allMoves.slice(0, 35);

    let bestMove = candidates[0];
    let bestScore = -Infinity;
    const alpha = -Infinity, beta = Infinity;

    for (const m of candidates) {
      const saved = board.getState();
      board.movePiece(m.fx, m.fy, m.tx, m.ty);
      board.switchPlayer();
      const score = -negamax(board, 2, -beta, -alpha, aiColor);
      board.loadState(saved);

      if (score > bestScore) { bestScore = score; bestMove = m; }
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
    const candidates = allMoves.slice(0, 30);

    let best = -Infinity;
    for (const m of candidates) {
      const saved = board.getState();
      board.movePiece(m.fx, m.fy, m.tx, m.ty);
      board.switchPlayer();
      const score = -negamax(board, depth - 1, -beta, -alpha, aiColor);
      board.loadState(saved);

      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }

    return best;
  }

  function getMove(board, difficulty) {
    if (difficulty === 'medium') return mediumMove(board);
    return easyMove(board);
  }

  return { getMove };
})();
