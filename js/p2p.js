/**
 * 联机对战模块 v4
 *
 * 信令：MQTT 3.1.1 over WebSocket (broker.emqx.io)
 * WebRTC：simple-peer
 * 房间号：6 位随机数字
 *
 * v4 核心改进：
 * - 弃用已停止服务的 0.peerjs.com，改用 EMQX 公共 MQTT Broker
 * - 6 位数字房间号，方便分享
 * - 会话 ID 过滤防止房间号碰撞串扰
 * - API 与旧版完全兼容
 */

/* ================================================================
 * 轻量 MQTT 3.1.1 客户端（内嵌，免外部依赖）
 * ================================================================ */
const MQTT = (() => {
  /**
   * 连接到 MQTT Broker
   * @param {string} url - WebSocket URL (wss://broker.emqx.io:8084/mqtt)
   * @param {object} opts - { clientId, onMessage, onConnect, onError, onClose }
   * @returns {{ publish, subscribe, disconnect, isConnected }}
   */
  function connect(url, opts) {
    const clientId = opts.clientId || 'chess-' + Math.random().toString(36).slice(2, 10);
    const onMessage = opts.onMessage || (() => {});
    const onConnect = opts.onConnect || (() => {});
    const onError = opts.onError || (() => {});
    const onClose = opts.onClose || (() => {});

    let ws = null;
    let connected = false;
    let pingTimer = null;
    let packetId = 1;

    function encodeLength(len) {
      const buf = [];
      do {
        let b = len & 0x7F;
        len >>>= 7;
        if (len > 0) b |= 0x80;
        buf.push(b);
      } while (len > 0);
      return new Uint8Array(buf);
    }

    function encodeString(str) {
      const bytes = new TextEncoder().encode(str);
      const out = new Uint8Array(2 + bytes.length);
      out[0] = (bytes.length >> 8) & 0xFF;
      out[1] = bytes.length & 0xFF;
      out.set(bytes, 2);
      return out;
    }

    function concat(...arrays) {
      const total = arrays.reduce((s, a) => s + a.length, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const a of arrays) { out.set(a, off); off += a.length; }
      return out;
    }

    function sendPacket(type, flags, variableHeader, payload) {
      if (!ws || ws.readyState !== 1) return;
      const vh = variableHeader || new Uint8Array(0);
      const pl = payload || new Uint8Array(0);
      const remaining = concat(encodeLength(vh.length + pl.length), vh, pl);
      const fixed = new Uint8Array([(type << 4) | flags]);
      ws.send(concat(fixed, remaining));
    }

    // CONNECT
    function doConnect() {
      const protoName = encodeString('MQTT');
      const protoLevel = new Uint8Array([4]);           // MQTT 3.1.1
      const flags = new Uint8Array([2]);                // Clean Session
      const keepAlive = new Uint8Array([0, 30]);        // 30s
      const cid = encodeString(clientId);
      const vh = concat(protoName, protoLevel, flags, keepAlive, cid);
      sendPacket(1, 0, vh);
    }

    // SUBSCRIBE
    function subscribe(topic) {
      const pid = new Uint8Array([(packetId >> 8) & 0xFF, packetId & 0xFF]);
      packetId = (packetId + 1) & 0xFFFF;
      const tf = encodeString(topic);
      const qos = new Uint8Array([0]);
      sendPacket(8, 2, pid, concat(tf, qos));
    }

    // PUBLISH
    function publish(topic, payload) {
      const tf = encodeString(topic);
      const pl = typeof payload === 'string'
        ? new TextEncoder().encode(payload)
        : payload;
      sendPacket(3, 0, tf, pl);
    }

    // PINGREQ
    function sendPing() {
      sendPacket(12, 0);
    }

    // DISCONNECT
    function disconnect() {
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      connected = false;
      if (ws) {
        try { sendPacket(14, 0); } catch (e) { /* ignore */ }
        try { ws.close(); } catch (e) { /* ignore */ }
        ws = null;
      }
    }

    // 解析收到的 MQTT 包
    function parsePacket(data) {
      const bytes = new Uint8Array(data);
      if (bytes.length < 2) return null;

      const type = bytes[0] >> 4;
      let multiplier = 1;
      let remaining = 0;
      let pos = 1;
      let byte;
      do {
        if (pos >= bytes.length) return null;
        byte = bytes[pos++];
        remaining += (byte & 0x7F) * multiplier;
        multiplier *= 128;
        if (multiplier > 128 * 128 * 128) break;
      } while ((byte & 0x80) !== 0);

      if (type === 2) return { type: 'connack' };                     // CONNACK
      if (type === 9) return { type: 'suback' };                      // SUBACK
      if (type === 13) return { type: 'pingresp' };                   // PINGRESP

      if (type === 3) {                                               // PUBLISH
        if (pos + 2 > bytes.length) return null;
        const topicLen = (bytes[pos] << 8) | bytes[pos + 1];
        pos += 2;
        if (pos + topicLen > bytes.length) return null;
        const topic = new TextDecoder().decode(bytes.slice(pos, pos + topicLen));
        pos += topicLen;
        const payloadLen = remaining - 2 - topicLen;
        const payload = payloadLen > 0
          ? new TextDecoder().decode(bytes.slice(pos, pos + payloadLen))
          : '';
        return { type: 'publish', topic, payload };
      }

      return { type: 'unknown' };
    }

    // 建立 WebSocket
    try {
      ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
    } catch (e) {
      onError('WebSocket 连接失败');
      return { publish: () => {}, subscribe: () => {}, disconnect: () => {}, isConnected: () => false };
    }

    ws.onopen = () => {
      doConnect();
    };

    ws.onmessage = (e) => {
      const pkt = parsePacket(e.data);
      if (!pkt) return;

      switch (pkt.type) {
        case 'connack':
          connected = true;
          onConnect();
          // 启动心跳
          pingTimer = setInterval(sendPing, 15000);
          break;
        case 'publish':
          onMessage(pkt.topic, pkt.payload);
          break;
        case 'suback':
          // 订阅确认，静默处理
          break;
        case 'pingresp':
          // PING 响应，静默处理
          break;
      }
    };

    ws.onerror = () => {
      onError('网络连接错误');
    };

    ws.onclose = () => {
      connected = false;
      if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
      onClose();
    };

    return { publish, subscribe, disconnect, isConnected: () => connected };
  }

  return { connect };
})();

/* ================================================================
 * P2P 联机模块
 * ================================================================ */
const P2P = (() => {
  const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
  const TOPIC_PREFIX = 'chinese-chess/room';

  let mqtt = null;
  let peer = null;           // simple-peer 实例
  let isHost = false;
  let isConnected = false;
  let roomId = null;
  let sessionId = null;
  let roomTopic = null;
  let signalingTimeout = null;
  let joinTimer = null;

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

  /** 创建房间 */
  function createRoom() {
    destroy();
    roomId = generateRoomCode();
    sessionId = 'h_' + Math.random().toString(36).slice(2, 10);
    roomTopic = TOPIC_PREFIX + '/' + roomId;
    isHost = true;

    return new Promise((resolve, reject) => {
      let resolved = false;

      mqtt = MQTT.connect(BROKER_URL, {
        clientId: 'chess-h-' + Math.random().toString(36).slice(2, 8),
        onConnect: () => {
          console.log('[P2P] MQTT 已连接，房间号:', roomId);
          mqtt.subscribe(roomTopic);
          if (!resolved) {
            resolved = true;
            resolve(roomId);
          }
          if (onStatusChange) onStatusChange('signaling-connected', roomId);
        },
        onMessage: (topic, payload) => {
          const msg = parseMQTTMessage(payload);
          if (!msg || msg.s === sessionId) return;  // 过滤自己发的
          if (msg.s && msg.s !== sessionId && !sessionId) return;
          handleMQTTMessage(msg);
        },
        onError: (err) => {
          console.error('[P2P] MQTT 错误:', err);
          if (!resolved) {
            resolved = true;
            if (onError) onError('信令服务连接失败，请重试');
            reject(new Error(err));
          }
        },
        onClose: () => {
          console.log('[P2P] MQTT 已断开');
          if (!isConnected && onStatusChange) onStatusChange('signaling-disconnected', roomId);
        },
      });
    });
  }

  /** 加入房间 */
  function joinRoom(code) {
    destroy();
    roomId = code;
    sessionId = 'g_' + Math.random().toString(36).slice(2, 10);
    roomTopic = TOPIC_PREFIX + '/' + roomId;
    isHost = false;

    return new Promise((resolve, reject) => {
      let resolved = false;

      mqtt = MQTT.connect(BROKER_URL, {
        clientId: 'chess-g-' + Math.random().toString(36).slice(2, 8),
        onConnect: () => {
          console.log('[P2P] MQTT 已连接，加入房间:', roomId);
          mqtt.subscribe(roomTopic);

          // 发送加入请求
          sendMQTTMessage({ s: sessionId, t: 'join' });

          // 超时检测
          joinTimer = setTimeout(() => {
            if (!resolved && !isConnected) {
              resolved = true;
              if (onError) onError('房间里没有人，请确认：①房间号正确 ②对方已创建房间');
              reject(new Error('房间里没有人'));
            }
          }, 12000);
        },
        onMessage: (topic, payload) => {
          const msg = parseMQTTMessage(payload);
          if (!msg || msg.s === sessionId) return;
          handleMQTTMessage(msg);
        },
        onError: (err) => {
          console.error('[P2P] MQTT 错误:', err);
          if (!resolved) {
            resolved = true;
            if (onError) onError('网络连接失败，请检查网络');
            reject(new Error(err));
          }
        },
        onClose: () => {
          console.log('[P2P] MQTT 已断开');
          if (!isConnected && onStatusChange) onStatusChange('signaling-disconnected', roomId);
        },
      });
    });
  }

  /** 解析 MQTT 消息 */
  function parseMQTTMessage(payload) {
    try {
      return JSON.parse(payload);
    } catch (e) {
      return null;
    }
  }

  /** 发送消息到 MQTT 话题 */
  function sendMQTTMessage(msg) {
    if (mqtt && mqtt.isConnected()) {
      mqtt.publish(roomTopic, JSON.stringify(msg));
    }
  }

  /** 处理 MQTT 信令消息 */
  function handleMQTTMessage(msg) {
    switch (msg.t) {
      case 'join':
        // 房主收到加入请求 → 创建 WebRTC 连接
        if (isHost && !peer) {
          createPeer(true);
          if (joinTimer) { clearTimeout(joinTimer); joinTimer = null; }
        }
        // 回应 joined
        sendMQTTMessage({ s: sessionId, t: 'joined' });
        break;

      case 'joined':
        // 访客收到确认 → 创建 WebRTC 连接
        if (!isHost && !peer) {
          createPeer(false);
        }
        break;

      case 'signal':
        // 收到 WebRTC 信令数据
        if (peer && msg.d) {
          try {
            peer.signal(JSON.parse(msg.d));
          } catch (e) {
            console.error('[P2P] 信令数据解析失败:', e);
          }
        } else if (!peer && !isHost && msg.d) {
          // 访客收到 signal 但还没创建 peer → 先创建再 signal
          createPeer(false);
          try {
            peer.signal(JSON.parse(msg.d));
          } catch (e) {
            console.error('[P2P] 信令数据解析失败:', e);
          }
        }
        break;

      case 'bye':
        // 对方主动断开
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
      // 通过 MQTT 发送信令数据
      sendMQTTMessage({
        s: sessionId,
        t: 'signal',
        d: JSON.stringify(data),
      });
    });

    peer.on('connect', () => {
      console.log('[P2P] WebRTC 连接已建立');
      isConnected = true;
      if (joinTimer) { clearTimeout(joinTimer); joinTimer = null; }

      // WebRTC 已建立，MQTT 可以断开以节省资源
      // （后续通信全部走 data channel）
      disconnectMQTT();

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

    // 超时保护
    signalingTimeout = setTimeout(() => {
      if (!isConnected) {
        console.log('[P2P] WebRTC 连接超时');
        if (onError) onError('连接超时，请确认双方网络可达');
        destroy();
      }
    }, 30000);
  }

  /** 处理 WebRTC DataChannel 消息 */
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

  /** 处理连接关闭 */
  function handlePeerClose() {
    console.log('[P2P] 连接已关闭');
    isConnected = false;
    if (peer) { try { peer.destroy(); } catch (e) { /* ignore */ } peer = null; }
    if (onDisconnected) onDisconnected();
  }

  /** 断开 MQTT（WebRTC 建立后） */
  function disconnectMQTT() {
    if (signalingTimeout) { clearTimeout(signalingTimeout); signalingTimeout = null; }
    if (mqtt) { mqtt.disconnect(); mqtt = null; }
  }

  // ==================== 消息发送 (DataChannel) ====================

  function sendViaPeer(msg) {
    if (!peer || !isConnected) return false;
    try {
      peer.send(JSON.stringify(msg));
      return true;
    } catch (e) {
      console.error('[P2P] 发送失败:', e);
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

  // ==================== 状态查询 ====================

  function getStatus() {
    return { isHost, isConnected, roomId };
  }

  function getRoomId() {
    return roomId;
  }

  function isSignalingAlive() {
    return mqtt && mqtt.isConnected();
  }

  function disconnect() {
    destroy();
  }

  function destroy() {
    if (signalingTimeout) { clearTimeout(signalingTimeout); signalingTimeout = null; }
    if (joinTimer) { clearTimeout(joinTimer); joinTimer = null; }
    if (peer) {
      try { peer.destroy(); } catch (e) { /* ignore */ }
      peer = null;
    }
    if (mqtt) {
      try { mqtt.disconnect(); } catch (e) { /* ignore */ }
      mqtt = null;
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
