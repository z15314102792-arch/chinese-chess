/**
 * 中国象棋 AI 引擎
 *
 * 简单模式：2层Minimax + 大量随机性（模拟初学者）
 * 中等模式：3层Alpha-Beta + 位置评估 + 适度随机（模拟业余棋手）
 *
 * 设计原则：
 *  - 不过度追求子力优势，重视局面平衡
 *  - 加入随机性避免模板化走棋
 *  - 两个难度有明显棋力差距
 */
const AI = (() => {
  const PIECE_VALUE = {
    0: 10000,  // 帥/將
    4: 500,    // 車（降权，减少激进兑子）
    3: 280,    // 馬
    5: 280,    // 砲/炮
    2: 110,    // 相/象
    1: 110,    // 仕/士
    6: 50,     // 兵/卒(未过河)
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

  // 位置价值
  function posBonus(piece, x, y) {
    const type = Board.getType(piece);
    const color = Board.getColor(piece);
    let b = 0;
    if (x >= 3 && x <= 5) b += 2;
    const crossed = (color === Board.RED && y <= 4) || (color === Board.BLACK && y >= 5);
    if ((type === Board.ROOK || type === Board.HORSE || type === Board.CANNON) && crossed) b += 8;
    if (type === Board.PAWN && crossed && x >= 3 && x <= 5) b += 5;
    if (type === Board.KING) b += (x === 4 ? 5 : 0) + (color === Board.RED ? (9 - y) : y) * 0.5;
    return b;
  }

  // 移动性奖励
  function mobilityBonus(board, color) {
    const moves = board.getAllLegalMoves(color);
    return Math.min(moves.length * 2, 60);
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
    // 移动性加分（鼓励活跃，减少龟缩）
    score += mobilityBonus(board, aiColor) * 0.5;
    const opponent = aiColor === Board.RED ? Board.BLACK : Board.RED;
    score -= mobilityBonus(board, opponent) * 0.3;
    return score;
  }

  function sortMoves(moves, board) {
    return moves.sort((a, b) => {
      const ca = board.get(a.tx, a.ty), cb = board.get(b.tx, b.ty);
      return (cb !== Board.EMPTY ? getValue(cb, b.ty) : 0) - (ca !== Board.EMPTY ? getValue(ca, a.ty) : 0);
    });
  }

  // ==================== 简单模式 ====================

  function easyMove(board) {
    const aiColor = board.getCurrentPlayer();
    const allMoves = board.getAllLegalMoves(aiColor);
    if (allMoves.length === 0) return null;

    // 对每个走法打分（2层Minimax）
    const scored = [];
    for (const m of allMoves) {
      const saved = board.getState();
      board.movePiece(m.fx, m.fy, m.tx, m.ty);
      board.switchPlayer();

      // 对手最佳回应
      const oppMoves = board.getAllLegalMoves(board.getCurrentPlayer());
      let oppBest = -Infinity;
      const sampleN = Math.min(oppMoves.length, 15);
      for (let i = 0; i < sampleN; i++) {
        const om = oppMoves[Math.floor(Math.random() * oppMoves.length)];
        const s2 = board.getState();
        board.movePiece(om.fx, om.fy, om.tx, om.ty);
        oppBest = Math.max(oppBest, evaluate(board, aiColor));
        board.loadState(s2);
      }
      if (oppMoves.length === 0) oppBest = -99999;

      const netScore = evaluate(board, aiColor) - oppBest * 0.6;
      board.loadState(saved);
      scored.push({ move: m, score: netScore });
    }

    // ★ 简单AI：吃子走法加分，确保不错过明显吃子机会
    scored.forEach(s => {
      const captured = Board.get(s.move.tx, s.move.ty);
      if (captured !== Board.EMPTY) s.score += getValue(captured, s.move.ty) * 0.4;
    });

    scored.sort((a, b) => b.score - a.score);

    // 确保吃子走法不被遗漏：提取所有吃子走法 + Top-40%
    const captures = scored.filter(s => Board.get(s.move.tx, s.move.ty) !== Board.EMPTY);
    const topCount = Math.max(5, Math.ceil(scored.length * 0.35));
    const topN = scored.slice(0, topCount);
    // 合并去重
    const poolMap = new Map();
    topN.forEach(s => poolMap.set(`${s.move.fx},${s.move.fy},${s.move.tx},${s.move.ty}`, s));
    captures.forEach(s => poolMap.set(`${s.move.fx},${s.move.fy},${s.move.tx},${s.move.ty}`, s));
    const pool = [...poolMap.values()];

    // 加权随机
    const totalWeight = pool.reduce((s, m, i) => s + (pool.length - i), 0);
    let r = Math.random() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
      r -= (pool.length - i);
      if (r <= 0) return pool[i].move;
    }
    return pool[pool.length - 1].move;
  }

  // ==================== 中等模式 ====================

  function mediumMove(board) {
    const aiColor = board.getCurrentPlayer();
    const allMoves = board.getAllLegalMoves(aiColor);
    if (allMoves.length === 0) return null;

    sortMoves(allMoves, board);
    const candidates = allMoves.slice(0, 35);

    // Alpha-Beta 深度3
    const scored = [];
    for (const m of candidates) {
      const saved = board.getState();
      board.movePiece(m.fx, m.fy, m.tx, m.ty);
      board.switchPlayer();
      const score = -negamax(board, 2, -Infinity, Infinity, aiColor);
      board.loadState(saved);
      scored.push({ move: m, score });
    }

    scored.sort((a, b) => b.score - a.score);

    // ★ 中等AI：从Top-25%随机选（有棋力但不模板化）
    const topCount = Math.max(2, Math.ceil(scored.length * 0.25));
    const pool = scored.slice(0, topCount);
    // 加入少量随机噪声扰动排序
    const noisy = pool.map((m, i) => ({ ...m, noise: m.score + (Math.random() - 0.5) * 15 }));
    noisy.sort((a, b) => b.noise - a.noise);
    return noisy[0].move;
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
