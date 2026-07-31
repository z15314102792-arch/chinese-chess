/**
 * 中国象棋 AI 引擎 v2
 *
 * 简单模式：2层Minimax + 将军奖励 + 随机多样性
 * 中等模式：3层Alpha-Beta + 将军延伸 + 威胁评估 + 走法排序
 *
 * 核心改进：
 *  - 将军奖励：走子后将军对方 +80分
 *  - 威胁评估：攻击对方棋子加分，己方被攻击扣分
 *  - 灵活度奖励：可走位置越多越好
 *  - 将军延伸：搜索叶节点遇将军自动加深
 */
const AI = (() => {
  // 子力价值
  const V = { K:10000, R:500, C:280, H:280, E:110, A:110, P:50 };
  const PAWN_CROSSED = 120;

  function getValue(piece, y) {
    const t = Board.getType(piece);
    if (t === Board.KING) return V.K;
    if (t === Board.ROOK) return V.R;
    if (t === Board.CANNON) return V.C;
    if (t === Board.HORSE) return V.H;
    if (t === Board.ELEPHANT) return V.E;
    if (t === Board.ADVISOR) return V.A;
    if (t === Board.PAWN) {
      const c = Board.getColor(piece);
      return (c === Board.RED && y <= 4) || (c === Board.BLACK && y >= 5) ? PAWN_CROSSED : V.P;
    }
    return 0;
  }

  // 位置加分
  function posBonus(piece, x, y) {
    const t = Board.getType(piece), c = Board.getColor(piece);
    let b = 0;
    if (x >= 3 && x <= 5) b += 2;
    const crossed = (c === Board.RED && y <= 4) || (c === Board.BLACK && y >= 5);
    if ((t === Board.ROOK || t === Board.HORSE || t === Board.CANNON) && crossed) b += 10;
    if (t === Board.PAWN && crossed && x >= 3 && x <= 5) b += 6;
    if (t === Board.KING) b += (x === 4 ? 5 : 0);
    return b;
  }

  // ========= 评估函数 v2 =========

  function evaluate(board, aiColor) {
    const opp = aiColor === Board.RED ? Board.BLACK : Board.RED;
    let score = 0;

    for (let y = 0; y < Board.ROWS; y++) {
      for (let x = 0; x < Board.COLS; x++) {
        const p = board.get(x, y);
        if (p === Board.EMPTY) continue;
        const val = getValue(p, y) + posBonus(p, x, y);
        score += (Board.getColor(p) === aiColor) ? val : -val;
      }
    }

    // ★ 灵活度奖励（鼓励子力活跃）
    score += board.getAllLegalMoves(aiColor).length * 1.5;
    score -= board.getAllLegalMoves(opp).length * 1.0;

    // ★ 将军奖励
    if (board.isInCheck(opp)) score += 80;
    if (board.isInCheck(aiColor)) score -= 120;

    // ★ 威胁评估：攻击对方大子加分
    const aiMoves = board.getAllLegalMoves(aiColor);
    for (const m of aiMoves) {
      const target = board.get(m.tx, m.ty);
      if (target !== Board.EMPTY && Board.getColor(target) === opp) {
        score += getValue(target, m.ty) * 0.15;
      }
    }

    return score;
  }

  // 快速评估（不用 getAllLegalMoves，更快）
  function evaluateFast(board, aiColor) {
    const opp = aiColor === Board.RED ? Board.BLACK : Board.RED;
    let score = 0;
    for (let y = 0; y < Board.ROWS; y++) {
      for (let x = 0; x < Board.COLS; x++) {
        const p = board.get(x, y);
        if (p === Board.EMPTY) continue;
        const val = getValue(p, y) + posBonus(p, x, y);
        score += (Board.getColor(p) === aiColor) ? val : -val;
      }
    }
    if (board.isInCheck(opp)) score += 80;
    if (board.isInCheck(aiColor)) score -= 120;
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

    const scored = [];
    for (const m of allMoves) {
      const saved = board.getState();
      board.movePiece(m.fx, m.fy, m.tx, m.ty);
      board.switchPlayer();

      // 对手最佳回应（采样15个）
      const oppMoves = board.getAllLegalMoves(board.getCurrentPlayer());
      let oppBest = -Infinity;
      const sampleN = Math.min(oppMoves.length, 15);
      for (let i = 0; i < sampleN; i++) {
        const om = oppMoves[Math.floor(Math.random() * oppMoves.length)];
        const s2 = board.getState();
        board.movePiece(om.fx, om.fy, om.tx, om.ty);
        oppBest = Math.max(oppBest, evaluateFast(board, aiColor));
        board.loadState(s2);
      }
      if (oppMoves.length === 0) oppBest = -99999;

      let score = evaluateFast(board, aiColor) - oppBest * 0.55;

      // ★ 吃子额外加分（确保不吃子漏洞）
      if (saved.grid[m.fy][m.fx] !== Board.EMPTY) {
        const captured = board.get(m.tx, m.ty);
        if (captured !== Board.EMPTY && Board.getColor(captured) !== aiColor) {
          score += getValue(captured, m.ty) * 0.25;
        }
      }

      board.loadState(saved);
      scored.push({ move: m, score });
    }

    scored.sort((a, b) => b.score - a.score);

    // 吃子走法强制入池
    const captures = scored.filter(s => board.get(s.move.tx, s.move.ty) !== Board.EMPTY);
    const topCount = Math.max(5, Math.ceil(scored.length * 0.35));
    const topN = scored.slice(0, topCount);
    const poolMap = new Map();
    topN.forEach(s => poolMap.set(`${s.move.fx},${s.move.fy},${s.move.tx},${s.move.ty}`, s));
    captures.forEach(s => poolMap.set(`${s.move.fx},${s.move.fy},${s.move.tx},${s.move.ty}`, s));
    const pool = [...poolMap.values()];

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
    const topCount = Math.max(2, Math.ceil(scored.length * 0.25));
    const pool = scored.slice(0, topCount);
    const noisy = pool.map(m => ({ ...m, noise: m.score + (Math.random() - 0.5) * 12 }));
    noisy.sort((a, b) => b.noise - a.noise);
    return noisy[0].move;
  }

  /**
   * Negamax + 将军延伸
   */
  function negamax(board, depth, alpha, beta, aiColor) {
    const currentColor = board.getCurrentPlayer();

    // ★ 将军延伸：叶节点遇将军，加深一层
    if (depth === 0) {
      if (board.isInCheck(currentColor)) depth = 1;
      else return evaluateFast(board, aiColor) * (currentColor === aiColor ? 1 : -1);
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

  /**
   * 地狱模式（娱乐模式）—— "会下棋但会犯错"的AI
   *
   * 策略：
   *  1. 浅搜索评分所有走法（depth=1）
   *  2. 添加±30%随机噪声打乱排序
   *  3. 85%概率从前40%走法中随机选（看起来合理）
   *  4. 15%概率从后50%走法中随机选（"眼瞎"）
   *  5. 被将军时绝不眼瞎，但可能选非最优应将
   */
  function hellMove(board) {
    const aiColor = board.getCurrentPlayer();
    const allMoves = board.getAllLegalMoves(aiColor);
    if (allMoves.length === 0) return null;

    const inCheck = board.isInCheck(aiColor);

    // 评分所有走法
    const scored = [];
    for (const m of allMoves) {
      const saved = board.getState();
      const captured = board.get(m.tx, m.ty);
      board.movePiece(m.fx, m.fy, m.tx, m.ty);
      board.switchPlayer();
      const opp = aiColor === Board.RED ? Board.BLACK : Board.RED;
      let score = evaluateFast(board, aiColor);
      const gaveCheck = board.isInCheck(opp);
      const mobility = board.getAllLegalMoves(aiColor).length;
      board.loadState(saved);

      // 吃子奖励（攻击性）
      if (captured !== Board.EMPTY) score += getValue(captured, m.ty) * 0.35;
      // 将军奖励（给用户刺激感）
      if (gaveCheck) score += 60;
      // 灵活度微调
      score += mobility * 0.8;

      scored.push({ move: m, score });
    }

    // 按评分排序
    scored.sort((a, b) => b.score - a.score);

    // 眼瞎概率：不被将时 18%，被将时 0%（必须应将）
    const blindChance = inCheck ? 0 : 0.18;

    if (Math.random() < blindChance) {
      // 从后半截随机选（但不能选最差的几个）
      const start = Math.floor(scored.length * 0.45);
      const end = Math.max(start + 2, scored.length - 1);
      const pool = scored.slice(start, end);
      if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)].move;
    }

    // 正常情况：从前40%随机选（至少3步），加±25%噪声
    const topN = Math.max(3, Math.ceil(scored.length * 0.4));
    const pool = scored.slice(0, topN).map(s => ({
      move: s.move,
      noise: s.score * (0.75 + Math.random() * 0.5), // 0.75 ~ 1.25 倍
    }));
    pool.sort((a, b) => b.noise - a.noise);

    // 从前30%随机选一个（不总是最好的）
    const pickN = Math.max(2, Math.ceil(pool.length * 0.3));
    const finalPool = pool.slice(0, pickN);
    return finalPool[Math.floor(Math.random() * finalPool.length)].move;
  }

  function getMove(board, difficulty) {
    if (difficulty === 'medium') return mediumMove(board);
    if (difficulty === 'hell') return hellMove(board);
    return easyMove(board);
  }

  return { getMove };
})();
