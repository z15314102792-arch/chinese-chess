/**
 * P2P 联机 API 验证
 */
const fs = require('fs');
const path = require('path');

const p2pSrc = fs.readFileSync(path.join(__dirname, 'js/p2p.js'), 'utf-8');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch(e) { failed++; console.error('  ✗ ' + name + ': ' + e.message); }
}

console.log('=== P2P API 验证 ===\n');

test('模块语法正确', () => {
  new Function(p2pSrc + '; return P2P;');
});

test('所有 API 方法存在', () => {
  const P2P = new Function(p2pSrc + '; return P2P;')();
  const methods = ['init','createRoom','joinRoom','sendMove','sendRestart',
    'sendUndoRequest','sendUndoResponse','sendRematchRequest','sendRematchResponse',
    'getStatus','getRoomId','isSignalingAlive','disconnect'];
  for (const m of methods) {
    if (typeof P2P[m] !== 'function') throw new Error(m + ' 缺失');
  }
});

test('init 注册回调不抛错', () => {
  const P2P = new Function(p2pSrc + '; return P2P;')();
  P2P.init({ onConnected: ()=>{}, onDisconnected: ()=>{}, onMove: ()=>{}, onError: ()=>{} });
});

test('getStatus 初始状态正确', () => {
  const P2P = new Function(p2pSrc + '; return P2P;')();
  const s = P2P.getStatus();
  if (s.isHost !== false) throw new Error('isHost 应为 false');
  if (s.isConnected !== false) throw new Error('isConnected 应为 false');
  if (s.roomId !== null) throw new Error('roomId 应为 null');
});

test('sendMove 无连接返回 false', () => {
  const P2P = new Function(p2pSrc + '; return P2P;')();
  P2P.init({ onMove: ()=>{}, onError: ()=>{} });
  if (P2P.sendMove(0,6,0,5) !== false) throw new Error('应返回 false');
});

test('消息格式 — move 使用 fx,fy,tx,ty', () => {
  const src = fs.readFileSync(path.join(__dirname, 'js/p2p.js'), 'utf-8');
  if (!src.includes('type: \'move\', fx, fy, tx, ty')) throw new Error('move 格式不正确');
});

test('isSignalingAlive 无连接返回 false', () => {
  const P2P = new Function(p2pSrc + '; return P2P;')();
  P2P.init({ onMove: ()=>{}, onError: ()=>{} });
  if (P2P.isSignalingAlive() !== false) throw new Error('应返回 false');
});

test('joinRoom 支持重试次数参数', () => {
  const src = fs.readFileSync(path.join(__dirname, 'js/p2p.js'), 'utf-8');
  if (!src.includes('remainingRetries')) throw new Error('缺少重试逻辑');
});

test('信令断线/重连事件已处理', () => {
  const src = fs.readFileSync(path.join(__dirname, 'js/p2p.js'), 'utf-8');
  if (!src.includes('disconnected')) throw new Error('缺少 disconnected 事件处理');
  if (!src.includes('reconnected')) throw new Error('缺少 reconnected 事件处理');
});

console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
process.exit(failed > 0 ? 1 : 0);
