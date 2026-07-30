/**
 * 联机对战模块
 * 基于 PeerJS WebRTC 实现 P2P 连接
 * 消息协议：move 格式 {fx,fy,tx,ty}
 *
 * v3 改进：
 * - 处理信令服务器断线/重连
 * - ICE 服务器辅助 NAT 穿透
 * - 细化错误提示
 */
const P2P = (() => {
  let peer = null;
  let connection = null;
  let isHost = false;
  let isConnected = false;
  let roomId = null;
  let reconnectAttempts = 0;

  let onConnected = null;
  let onDisconnected = null;
  let onMove = null;
  let onError = null;
  let onStatusChange = null;  // 信令连接状态变化回调

  // ICE 服务器配置（Google STUN 辅助 NAT 穿透）
  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  function init(callbacks) {
    onConnected = callbacks.onConnected || null;
    onDisconnected = callbacks.onDisconnected || null;
    onMove = callbacks.onMove || null;
    onError = callbacks.onError || null;
    onStatusChange = callbacks.onStatusChange || null;
  }

  /** 创建房间 */
  function createRoom() {
    destroy();
    reconnectAttempts = 0;
    peer = new Peer({ debug: 0, config: ICE_SERVERS });

    return new Promise((resolve, reject) => {
      let resolved = false;

      peer.on('open', (id) => {
        if (!resolved) {
          // 首次连接
          roomId = id;
          isHost = true;
          resolved = true;
          console.log('[P2P] 房间已创建:', id);
          resolve(id);
        } else {
          // ★ 断线重连：ID 已变化，更新房间号并告知用户
          const oldId = roomId;
          roomId = id;
          console.log('[P2P] 已重新连接到信令服务器，新ID:', id, '(旧:', oldId, ')');
          if (onStatusChange) onStatusChange('reconnected', id, oldId);
        }
        if (onStatusChange) onStatusChange('signaling-connected', id);
      });

      peer.on('connection', (conn) => {
        if (connection) { conn.close(); return; }
        setupConnection(conn);
      });

      // ★ 信令服务器断线
      peer.on('disconnected', () => {
        console.log('[P2P] 与信令服务器断开，正在尝试重连…');
        if (onStatusChange) onStatusChange('signaling-disconnected', roomId);
        if (onError) onError('与服务器断开，正在自动重连…');
      });

      // ★ peer 完全关闭
      peer.on('close', () => {
        console.log('[P2P] PeerJS 连接已关闭');
        if (!isConnected && onStatusChange) onStatusChange('closed');
      });

      peer.on('error', (err) => {
        console.error('[P2P] 信令服务器错误:', err);
        if (!resolved) {
          if (onError) onError('信令服务连接失败，请检查网络');
          reject(err);
        } else {
          // 已创建房间后的错误（如断线）
          if (err.type === 'network' || err.type === 'socket-error' || err.type === 'socket-closed') {
            // 自动重连中，给个轻提示
            console.log('[P2P] 网络波动，等待自动重连…');
          }
        }
      });
    });
  }

  /** 加入房间（带重试） */
  function joinRoom(remoteId, retryCount) {
    const maxRetries = (typeof retryCount === 'number') ? retryCount : 2;

    return _tryJoin(remoteId, maxRetries);
  }

  function _tryJoin(remoteId, remainingRetries) {
    destroy();
    peer = new Peer({ debug: 0, config: ICE_SERVERS });

    return new Promise((resolve, reject) => {
      let resolved = false;

      peer.on('open', () => {
        isHost = false;
        console.log('[P2P] 正在连接到:', remoteId);

        const conn = peer.connect(remoteId, { reliable: true });
        connection = conn;

        const timeout = setTimeout(() => {
          if (!isConnected && !resolved) {
            resolved = true;
            if (remainingRetries > 0) {
              console.log('[P2P] 连接超时，重试中…剩余', remainingRetries, '次');
              _retryJoin(remoteId, remainingRetries, resolve, reject);
            } else {
              reject(new Error('连接超时——请确认房间号正确且双方网络可达'));
            }
          }
        }, 15000);

        conn.on('open', () => {
          clearTimeout(timeout);
          resolved = true;
          isConnected = true;
          console.log('[P2P] 连接已建立');
          resolve(remoteId);
          if (onConnected) onConnected();
        });

        conn.on('data', handleData);
        conn.on('close', handleClose);
        conn.on('error', (err) => {
          console.error('[P2P] DataChannel 错误:', err);
          if (!resolved && onError) onError('数据通道错误，请重试');
        });
      });

      peer.on('error', (err) => {
        if (resolved) return;
        console.error('[P2P] PeerJS 错误:', err);

        if (err.type === 'peer-unavailable') {
          // 对方 peer 不在服务器上——如果是重试中，静默重试
          if (remainingRetries > 0) {
            console.log('[P2P] 对方不在线，重试中…剩余', remainingRetries, '次');
            resolved = true;
            _retryJoin(remoteId, remainingRetries, resolve, reject);
            return;
          }
          if (onError) onError('房间不存在或对方已离线\n请确认：①房间号正确 ②对方仍在房间页面');
        } else if (err.type === 'network' || err.type === 'socket-error') {
          if (onError) onError('网络连接失败，请检查网络');
        } else {
          if (onError) onError('连接失败: ' + (err.message || '未知错误'));
        }
        resolved = true;
        reject(err);
      });
    });
  }

  /** 重试加入（延时后重新尝试） */
  function _retryJoin(remoteId, remainingRetries, originalResolve, originalReject) {
    destroy();
    setTimeout(() => {
      _tryJoin(remoteId, remainingRetries - 1)
        .then(originalResolve)
        .catch(originalReject);
    }, 2000);  // 2 秒后重试
  }

  /** 设置 DataChannel（房主侧，对方连接已建立） */
  function setupConnection(conn) {
    connection = conn;
    isConnected = true;
    console.log('[P2P] 对方已加入房间');
    conn.on('data', handleData);
    conn.on('close', handleClose);
    conn.on('error', (err) => { console.error('[P2P] DataChannel 错误:', err); });
    if (onConnected) onConnected();
  }

  function handleData(data) {
    console.log('[P2P] 收到数据:', data);
    if (data.type === 'move' && onMove) {
      onMove(data.fx, data.fy, data.tx, data.ty);
    } else if (data.type === 'restart' && onMove) {
      onMove('restart');
    } else if (data.type === 'undo_request' && onMove) {
      onMove('undo_request');
    } else if (data.type === 'undo_response' && onMove) {
      onMove('undo_response', data.accept);
    } else if (data.type === 'rematch_request' && onMove) {
      onMove('rematch_request');
    } else if (data.type === 'rematch_response' && onMove) {
      onMove('rematch_response', data.accept);
    }
  }

  function handleClose() {
    console.log('[P2P] 连接已关闭');
    isConnected = false;
    connection = null;
    if (onDisconnected) onDisconnected();
  }

  function sendMove(fx, fy, tx, ty) {
    if (!connection || !isConnected) return false;
    connection.send({ type: 'move', fx, fy, tx, ty });
    return true;
  }

  function sendRestart() {
    if (!connection || !isConnected) return false;
    connection.send({ type: 'restart' });
    return true;
  }

  function sendUndoRequest() {
    if (!connection || !isConnected) return false;
    connection.send({ type: 'undo_request' });
    return true;
  }

  function sendUndoResponse(accept) {
    if (!connection || !isConnected) return false;
    connection.send({ type: 'undo_response', accept });
    return true;
  }

  function sendRematchRequest() {
    if (!connection || !isConnected) return false;
    connection.send({ type: 'rematch_request' });
    return true;
  }

  function sendRematchResponse(accept) {
    if (!connection || !isConnected) return false;
    connection.send({ type: 'rematch_response', accept });
    return true;
  }

  function getStatus() {
    return { isHost, isConnected, roomId };
  }

  function getRoomId() { return roomId; }

  /** 信令服务器连接是否存活 */
  function isSignalingAlive() {
    return !!(peer && !peer.destroyed && peer.id !== null);
  }

  function disconnect() { destroy(); }

  function destroy() {
    if (connection) { connection.close(); connection = null; }
    if (peer) { peer.destroy(); peer = null; }
    isConnected = false;
    isHost = false;
    roomId = null;
    reconnectAttempts = 0;
  }

  return {
    init, createRoom, joinRoom,
    sendMove, sendRestart, sendUndoRequest, sendUndoResponse,
    sendRematchRequest, sendRematchResponse,
    getStatus, getRoomId, isSignalingAlive, disconnect,
  };
})();
