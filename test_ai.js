/**
 * AI + Board 联调测试
 * 运行: node test_ai.js
 */
const fs = require('fs');
const path = require('path');

// 加载模块：用 Function 构造器避免 eval 作用域问题
const baseDir = __dirname;
const Board = new Function(fs.readFileSync(path.join(baseDir, 'js/board.js'), 'utf-8') + '; return Board;')();
globalThis.Board = Board;

const AI = new Function(fs.readFileSync(path.join(baseDir, 'js/ai.js'), 'utf-8') + '; return AI;')();
globalThis.AI = AI;

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { failed++; console.error(`  ✗ ${name}: ${e.message}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

console.log('=== AI 联调测试 ===\n');

test('简单AI — 返回合法走法', () => {
  Board.init();
  const move = AI.getMove(Board, 'easy');
  assert(move !== null, '应返回走法');
  const legal = Board.getLegalMoves(move.fx, move.fy);
  assert(legal.some(m => m.x === move.tx && m.y === move.ty), '走法应在合法列表中');
});

test('中等AI — 返回合法走法', () => {
  Board.init();
  const move = AI.getMove(Board, 'medium');
  assert(move !== null, '应返回走法');
  const legal = Board.getLegalMoves(move.fx, move.fy);
  assert(legal.some(m => m.x === move.tx && m.y === move.ty), '走法应在合法列表中');
});

test('简单AI — 互下10步不崩溃', () => {
  Board.init();
  for (let i = 0; i < 10; i++) {
    const move = AI.getMove(Board, 'easy');
    if (!move) break;
    Board.movePiece(move.fx, move.fy, move.tx, move.ty);
    Board.switchPlayer();
  }
  assert(Board.getMoveCount() === 10, `应为 10 步, 实际 ${Board.getMoveCount()}`);
});

test('中等AI — 互下4步不崩溃（搜索较慢）', () => {
  Board.init();
  for (let i = 0; i < 4; i++) {
    const move = AI.getMove(Board, 'medium');
    if (!move) break;
    Board.movePiece(move.fx, move.fy, move.tx, move.ty);
    Board.switchPlayer();
  }
  assert(Board.getMoveCount() === 4, `应为 4 步, 实际 ${Board.getMoveCount()}`);
});

test('AI 执行后棋盘状态不变（getState/loadState 正确）', () => {
  Board.init();
  const s1 = Board.getState();
  AI.getMove(Board, 'easy');
  const s2 = Board.getState();
  assert(s2.currentPlayer === s1.currentPlayer, '回合不应变');
  assert(s2.moveCount === s1.moveCount, '步数不应变');
});

test('开局红方有合法走法', () => {
  Board.init();
  const moves = Board.getAllLegalMoves(Board.RED);
  assert(moves.length > 0, `红方应有走法, 实际 ${moves.length}`);
});

test('开局无将军', () => {
  Board.init();
  assert(!Board.isInCheck(Board.RED));
  assert(!Board.isInCheck(Board.BLACK));
});

console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
