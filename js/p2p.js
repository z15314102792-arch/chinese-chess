/**
 * 联机对战模块 v5
 *
 * 信令：ntfy.sh（HTTPS 443 端口，WebSocket 接收 + HTTP POST 发送）
 * WebRTC：simple-peer
 * 房间号：6 位随机数字
 *
 * v5 改进：
 * - 弃用 MQTT（8084 端口被封），改用 ntfy.sh（标准 443 端口）
 * - 双向通信：WebSocket 收 / HTTP POST 发
 * - 房间号为 ntfy topic 名的一部分
 * - API 与旧版完全兼容
 */
const P2P = (() => {
  const RELAY_HOST = 'https://ntfy.sh';
  const TOPIC_PREFIX = 'chinese-chess';

  let ws = null;
  let peer = null;
  let isHost = false;
  let isConnected = false;
  let roomId = null;
  let sessionId = null;
  let roomTopic = null;
  let signalingTimeout = null;
  let joinTimer = null;
  let pollTimer = null;

  // 回调
  let onConnected = null;
  let onDisconnected = null;
  let onMove = null;
  let onError = null;
  let onStatusChange = null;

  function init(callbacks) {
    onConnected = callbacks.onConnected || null;
    onDisconnected = callbacks.onDisconnected || null;
    onMove = callbacks.onMove || null;
    onError = callbacks.onError || null;
    onStatusChange = callbacks.onStatusChange || null;
  }

  /** 生成 6 位随机房间号 */
  function generateRoomCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  /** 通过 HTTP POST 发送消息到 ntfy */
  async function ntfyPost(message) {
    try {
      await fetch(RELAY_HOST + '/' + roomTopic, {
        method: 'POST',
        body: JSON.stringify(message),
      });
    } catch (e) {
      console.error('[P2P] HTTP POST 失败:', e);
    }
  }

  /** 打开 ntfy WebSocket 监听 */
  function ntfyListen() {
    if (ws) { try { ws.close(); } catch (e) { /* ignore */ } }

    const wsUrl = RELAY_HOST.replace('https://', 'wss://') + '/' + roomTopic + '/ws';
    console.log('[P2P] WebSocket 连接到:', wsUrl);

    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      console.error('[P2P] WebSocket 创建失败:', e);
      return false;
    }

    ws.onopen = () => {
      console.log('[P2P] WebSocket 已连接，房间:', roomId);
    };

    ws.onmessage = (e) => {
      let msg;
      try {
        const data = JSON.parse(e.data);
        // ntfy 消息格式: { id, time, event: 'message', topic, message: "..." }
        if (data.event === 'message' && data.message) {
          msg = JSON.parse(data.message);
        }
      } catch (ex) {
        return;
      }
      if (!msg || msg.s === sessionId) return;  // 过滤自己
      handleMessage(msg);
    };

    ws.onerror = () => {
      console.error('[P2P] WebSocket 错误');
    };

    ws.onclose = () => {
      console.log('[P2P] WebSocket 已断开');
      if (!isConnected) {
        // 断线重连（最多 3 次）
        if (!ws._reconnectCount) ws._reconnectCount = 0;
        if (ws._reconnectCount < 3) {
          ws._reconnectCount++;
          console.log('[P2P] 重连中…', ws._reconnectCount, '/3');
          setTimeout(() => {
            if (!isConnected) ntfyListen();
          }, 2000);
        } else if (onStatusChange) {
          onStatusChange('signaling-disconnected', roomId);
        }
      }
    };

    return true;
  }

  /** 创建房间 */
  async function createRoom() {
    destroy();
    roomId = generateRoomCode();
    sessionId = 'h_' + Math.random().toString(36).slice(2, 10);
    roomTopic = TOPIC_PREFIX + '-room-' + roomId;
    isHost = true;

    // 先发一个空消息确保 topic 存在（ntfy 自动创建 topic）
    return new Promise((resolve, reject) => {
      let resolved = false;

      // 尝试连接 WebSocket
      if (!ntfyListen()) {
        if (onError) onError('信令服务连接失败，请重试');
        reject(new Error('WebSocket 连接失败'));
        return;
      }

      // WebSocket 连上后房间即创建成功
      const checkOpen = () => {
        if (ws && ws.readyState === 1 && !resolved) {
          resolved = true;
          console.log('[P2P] 房间已创建，房间号:', roomId);
          if (onStatusChange) onStatusChange('signaling-connected', roomId);
          resolve(roomId);
        } else if (!resolved) {
          setTimeout(checkOpen, 200);
        }
      };

      // 超时
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (onError) onError('信令服务连接超时，请重试');
          reject(new Error('连接超时'));
        }
      }, 12000);

      // 重写 resolve 以清除超时
      const origResolve = resolve;
      resolve = (val) => { clearTimeout(timeout); origResolve(val); };

      checkOpen();
    });
  }

  /** 加入房间 */
  function joinRoom(code) {
    destroy();
    roomId = code;
    sessionId = 'g_' + Math.random().toString(36).slice(2, 10);
    roomTopic = TOPIC_PREFIX + '-room-' + roomId;
    isHost = false;

    return new Promise((resolve, reject) => {
      let resolved = false;

      if (!ntfyListen()) {
        if (onError) onError('信令服务连接失败，请重试');
        reject(new Error('WebSocket 连接失败'));
        return;
      }

      // 等 WebSocket 连上后发送加入请求
      const doJoin = () => {
        if (ws && ws.readyState === 1) {
          ntfyPost({ s: sessionId, t: 'join' });
          console.log('[P2P] 已发送加入请求，房间:', roomId);

          // 超时检测
          joinTimer = setTimeout(() => {
            if (!resolved && !isConnected) {
              resolved = true;
              if (onError) onError('房间里没有人，请确认：①房间号正确 ②对方已创建房间');
              reject(new Error('房间里没有人'));
            }
          }, 15000);
        } else if (!resolved) {
          setTimeout(doJoin, 300);
        }
      };

      // 连接超时
      const connTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (onError) onError('信令服务连接超时，请重试');
          reject(new Error('连接超时'));
        }
      }, 12000);

      const origReject = reject;
      reject = (val) => { clearTimeout(connTimeout); origReject(val); };

      setTimeout(doJoin, 500);
    });
  }

  /** 处理信令消息 */
  function handleMessage(msg) {
    switch (msg.t) {
      case 'join':
        if (isHost && !peer) {
          createPeer(true);
        }
        // 回应 joined
        ntfyPost({ s: sessionId, t: 'joined' });
        break;

      case 'joined':
        if (!isHost && !peer) {
          createPeer(false);
        }
        break;

      case 'signal':
        if (peer && msg.d) {
          try {
            peer.signal(JSON.parse(msg.d));
          } catch (e) {
            console.error('[P2P] 信令解析失败:', e);
          }
        } else if (!peer && !isHost && msg.d) {
          createPeer(false);
          try {
            peer.signal(JSON.parse(msg.d));
          } catch (e) {
            console.error('[P2P] 信令解析失败:', e);
          }
        }
        break;

      case 'bye':
        handlePeerClose();
        break;
    }
  }

  /** 创建 simple-peer 实例 */
  function createPeer(initiator) {
    if (peer) return;

    try {
      peer = new SimplePeer({
        initiator: initiator,
        trickle: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });
    } catch (e) {
      console.error('[P2P] 创建 Peer 失败:', e);
      if (onError) onError('WebRTC 初始化失败');
      return;
    }

    peer.on('signal', (data) => {
      ntfyPost({ s: sessionId, t: 'signal', d: JSON.stringify(data) });
    });

    peer.on('connect', () => {
      console.log('[P2P] WebRTC 连接已建立');
      isConnected = true;
      if (joinTimer) { clearTimeout(joinTimer); joinTimer = null; }
      disconnectRelay();
      if (onConnected) onConnected();
    });

    peer.on('data', (data) => {
      const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
      handlePeerData(text);
    });

    peer.on('error', (err) => {
      console.error('[P2P] Peer 错误:', err);
      if (!isConnected && onError) onError('连接失败，请重试');
    });

    peer.on('close', () => {
      handlePeerClose();
    });

    signalingTimeout = setTimeout(() => {
      if (!isConnected) {
        console.log('[P2P] WebRTC 连接超时');
        if (onError) onError('连接超时，请确认双方网络可达');
        destroy();
      }
    }, 30000);
  }

  /** 处理 DataChannel 消息 */
  function handlePeerData(text) {
    let msg;
    try { msg = JSON.parse(text); } catch (e) { return; }
    console.log('[P2P] 收到:', msg);

    if (msg.type === 'move' && onMove) {
      onMove(msg.fx, msg.fy, msg.tx, msg.ty);
    } else if (msg.type === 'restart' && onMove) {
      onMove('restart');
    } else if (msg.type === 'undo_request' && onMove) {
      onMove('undo_request');
    } else if (msg.type === 'undo_response' && onMove) {
      onMove('undo_response', msg.accept);
    } else if (msg.type === 'rematch_request' && onMove) {
      onMove('rematch_request');
    } else if (msg.type === 'rematch_response' && onMove) {
      onMove('rematch_response', msg.accept);
    }
  }

  function handlePeerClose() {
    console.log('[P2P] 连接已关闭');
    isConnected = false;
    if (peer) { try { peer.destroy(); } catch (e) { /* ignore */ } peer = null; }
    if (onDisconnected) onDisconnected();
  }

  /** 断开中继（WebRTC 建立后不再需要） */
  function disconnectRelay() {
    if (signalingTimeout) { clearTimeout(signalingTimeout); signalingTimeout = null; }
    if (ws) { try { ws.close(); } catch (e) { /* ignore */ } ws = null; }
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
  }

  // ==================== 消息发送 (DataChannel) ====================

  function sendViaPeer(msg) {
    if (!peer || !isConnected) return false;
    try {
      peer.send(JSON.stringify(msg));
      return true;
    } catch (e) {
      return false;
    }
  }

  function sendMove(fx, fy, tx, ty) {
    return sendViaPeer({ type: 'move', fx, fy, tx, ty });
  }

  function sendRestart() {
    return sendViaPeer({ type: 'restart' });
  }

  function sendUndoRequest() {
    return sendViaPeer({ type: 'undo_request' });
  }

  function sendUndoResponse(accept) {
    return sendViaPeer({ type: 'undo_response', accept });
  }

  function sendRematchRequest() {
    return sendViaPeer({ type: 'rematch_request' });
  }

  function sendRematchResponse(accept) {
    return sendViaPeer({ type: 'rematch_response', accept });
  }

  // ==================== 状态 ====================

  function getStatus() {
    return { isHost, isConnected, roomId };
  }

  function getRoomId() { return roomId; }

  function isSignalingAlive() {
    return ws && ws.readyState === 1;
  }

  function disconnect() { destroy(); }

  function destroy() {
    disconnectRelay();
    if (joinTimer) { clearTimeout(joinTimer); joinTimer = null; }
    if (peer) {
      try { peer.destroy(); } catch (e) { /* ignore */ }
      peer = null;
    }
    isConnected = false;
    isHost = false;
    roomId = null;
    sessionId = null;
    roomTopic = null;
  }

  return {
    init, createRoom, joinRoom,
    sendMove, sendRestart, sendUndoRequest, sendUndoResponse,
    sendRematchRequest, sendRematchResponse,
    getStatus, getRoomId, isSignalingAlive, disconnect,
  };
})();
