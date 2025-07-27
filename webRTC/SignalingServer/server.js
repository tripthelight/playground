import dotenv from 'dotenv';
dotenv.config();
import { WebSocketServer } from "ws";

const host = process.env.HOST;
const port = process.env.PORT || 8080; 
const wss = new WebSocketServer({ host, port });
// key: 클라이언트의 ID / value: 클라이언트의 Socket 객체
const clients = new Map();

console.log(`WebSocket signaling server running on ws://${host}:${port}`);

// 메시지를 발신자를 제외한 모든 클라이언트에게 전송하는 함수
function broadcast(message, senderId) {
  const messageStr = JSON.stringify(message);
  clients.forEach((clientWs, clientId) => {
    if (clientId !== senderId && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(messageStr);
    };
  });
};

wss.on('connection', (ws) => {
  let userId = null;

  // 클라이언트로부터 메시지 수신
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const { type, from, to } = data;

      if (type === 'new-peer') {
        userId = from;
        clients.set(userId, ws);
        console.log(`New peer connected : ${userId}`);
        broadcast({ type: 'new-peer', from: userId }, userId);
      } else if (['offer', 'answer', 'candidate'].includes(type)) {
        if (to && clients.has(to)) {
          const targetWs = clients.get(to); // TODO: 이게 왜 socket이 되지?
          if (targetWs.readyState === WebSocket.OPEN) {
            targetWs.send(JSON.stringify(data));
            console.log(`Forwarded ${type} from ${from} to ${to}`);
          };
        };
      };
    } catch (err) {
      console.error('Error processing message : ', err);
    };
  });

  // 클라이언트 연결 종료
  ws.on('close', () => {
    if (userId) {
      clients.delete(userId);
      console.log(`Peer disconnected : ${userId}`);
      broadcast({ type: 'peer-disconnected', from: userId }, userId);
    };
  });

  // 에러 처리
  ws.on('error', (err) => {
    console.error(`WebSocket error for ${userId} : `, err);
  });
});