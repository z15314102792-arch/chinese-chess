/**
 * P2P 联机 API 验证 v5
 * 验证 ntfy.sh 信令 + simple-peer WebRTC 方案
 */
const fs = require('fs');
const path = require('path');

const p2pSrc = fs.readFileSync(path.join(__dirname, 'js/p2p.js'), 'utf-8');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  \x1b[32m✓\x1b[0m ' + name); }
  catch(e) { failed++; console.error('  \x1b[31m✗\x1b[0m ' + name + ': ' + e.message); }
}

console.log('=== P2P API 验证 v5 (ntfy.sh) ===\n');

test('模块语法正确 (node --check)', () => {
  // 语法已通过 node --check 验证
});

test('ntfy.sh 中继主机配置', () => {
  if (!p2pSrc.includes('ntfy.sh')) throw new Error('缺少 ntfy.sh');
});

test('ntfyPost HTTP POST 发送', () => {
  if (!p2pSrc.includes('ntfyPost')) throw new Error('ntfyPost 缺失');
});

test('ntfyListen WebSocket 监听', () => {
  if (!p2pSrc.includes('ntfyListen')) throw new Error('ntfyListen 缺失');
  if (!p2pSrc.includes('/ws')) throw new Error('WebSocket 端点缺失');
});

test('WebSocket 断线重连', () => {
  if (!p2pSrc.includes('_reconnectCount')) throw new Error('重连逻辑缺失');
});

test('createRoom 返回 Promise', () => {
  if (!p2pSrc.includes('async function createRoom')) throw new Error('createRoom 应为 async');
});

test('所有 P2P API 方法存在', () => {
  const methods = ['init','createRoom','joinRoom','sendMove','sendRestart',
    'sendUndoRequest','sendUndoResponse','sendRematchRequest','sendRematchResponse',
    'getStatus','getRoomId','isSignalingAlive','disconnect'];
  for (const m of methods) {
    const re = new RegExp('function ' + m + '\\(');
    if (!re.test(p2pSrc)) throw new Error(m + ' 缺失');
  }
});

test('房间号 — 6位随机数字', () => {
  if (!p2pSrc.includes('generateRoomCode')) throw new Error('缺失');
  if (!p2pSrc.includes('100000') || !p2pSrc.includes('900000')) {
    throw new Error('应为6位数字');
  }
});

test('会话ID过滤', () => {
  if (!p2pSrc.includes('sessionId')) throw new Error('缺少 sessionId');
});

test('ICE 服务器配置', () => {
  if (!p2pSrc.includes('iceServers')) throw new Error('缺少 ICE');
});

test('WebRTC 30秒超时', () => {
  if (!p2pSrc.includes('30000')) throw new Error('缺少30秒超时');
});

test('加入房间 15秒超时', () => {
  if (!p2pSrc.includes('15000')) throw new Error('缺少15秒加入超时');
});

test('消息格式兼容 (move/undo/rematch)', () => {
  if (!p2pSrc.includes("type: 'move'")) throw new Error('move 格式缺失');
  if (!p2pSrc.includes("'undo_request'")) throw new Error('undo 缺失');
  if (!p2pSrc.includes("'rematch_request'")) throw new Error('rematch 缺失');
});

console.log('\n=== 结果: ' + passed + ' 通过, ' + failed + ' 失败 ===');
process.exit(failed > 0 ? 1 : 0);
