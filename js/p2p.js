/**
 * 联机对战模块
 * 基于 PeerJS WebRTC 实现 P2P 连接
 * 消息协议与五子棋版一致，仅 move 格式改为 {fx,fy,tx,ty}
 */
const P2P = (() => {
  let peer = null;
  let connection = null;
  let isHost = false;
  let isConnected = false;
  let roomId = null;

  let onConnected = null;
  let onDisconnected = null;
  let onMove = null;
  let onError = null;

  // ICE 服务器配置（STUN 辅助 NAT 穿透）
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
  }

  function createRoom() {
    destroy();
    peer = new Peer({ debug: 0, config: ICE_SERVERS });

    return new Promise((resolve, reject) => {
      peer.on('open', (id) => {
        roomId = id;
        isHost = true;
        console.log('[P2P] 房间已创建:', id);
        resolve(id);  // ★ 立即返回，不等连接

        peer.on('connection', (conn) => {
          if (connection) { conn.close(); return; }
          setupConnection(conn);
        });
      });

      peer.on('error', (err) => {
        console.error('[P2P] 信令服务器错误:', err);
        if (onError) onError('信令服务连接失败，请检查网络');
        reject(err);
      });
    });
  }

  function joinRoom(remoteId) {
    destroy();
    peer = new Peer({ debug: 0, config: ICE_SERVERS });

    return new Promise((resolve, reject) => {
      peer.on('open', () => {
        isHost = false;
        console.log('[P2P] 正在连接到:', remoteId);

        const conn = peer.connect(remoteId, { reliable: true });
        connection = conn;

        const timeout = setTimeout(() => {
          if (!isConnected) {
            reject(new Error('连接超时——请确认房间号正确且双方网络可达'));
          }
        }, 15000);

        conn.on('open', () => {
          clearTimeout(timeout);
          isConnected = true;
          console.log('[P2P] 连接已建立');
          resolve(remoteId);
          if (onConnected) onConnected();
        });

        conn.on('data', handleData);
        conn.on('close', handleClose);
        conn.on('error', (err) => {
          console.error('[P2P] DataChannel 错误:', err);
          if (onError) onError('数据通道错误，请重试');
        });
      });

      peer.on('error', (err) => {
        console.error('[P2P] PeerJS 错误:', err);
        // 根据错误类型给出具体提示
        if (err.type === 'peer-unavailable') {
          if (onError) onError('房间不存在或对方已离线');
        } else if (err.type === 'network' || err.type === 'socket-error') {
          if (onError) onError('网络连接失败，请检查网络');
        } else {
          if (onError) onError('连接失败: ' + (err.message || '未知错误'));
        }
        reject(err);
      });
    });
  }

  function setupConnection(conn) {
    connection = conn;
    isConnected = true;
    console.log('[P2P] 连接已建立');
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

  function disconnect() { destroy(); }

  function destroy() {
    if (connection) { connection.close(); connection = null; }
    if (peer) { peer.destroy(); peer = null; }
    isConnected = false;
    isHost = false;
    roomId = null;
  }

  return {
    init, createRoom, joinRoom,
    sendMove, sendRestart, sendUndoRequest, sendUndoResponse,
    sendRematchRequest, sendRematchResponse,
    getStatus, getRoomId, disconnect,
  };
})();
