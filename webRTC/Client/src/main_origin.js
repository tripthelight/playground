import './style.css'

const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // { urls: 'stun:stun.services.mozilla.com' },
    // { urls: 'stun:stun.freeswitch.org' }
  ],
};

document.querySelector('#app').innerHTML = `
  <h2>WebRTC Multi-Peer Chat</h2>
  <div class="chat-layout">
    <div id="chat"></div>
    <div>
      <span class="user-id">test</span>
      <input type="text" id="message" placeholder="Type a message..." />
      <button id="send">Send</button>
    </div>
  </div>
`;

const ws = new WebSocket('ws://210.124.202.71:8080');
// key: peer의 Id, value: DataChannel 객체
const peers = {};

const userId = Math.random().toString(36).substring(2, 10);

const domChat = document.getElementById('chat');
const domUserId = document.querySelector('.user-id');
const domMessageInput = document.getElementById('message');
const domSendButton = document.getElementById('send');

domUserId.textContent = userId;

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'new-peer', from: userId }));
};

ws.onmessage = async (event) => {
  const data = JSON.parse(event.data);
  /*
    - type : 메시지 타입(new-peer, offer, answer, dandidate)
    - to : 메시지를 전달 받을 피어의 ID
    - from : 메시지를 전달한 피어의 ID
    - sdp : P2P 연결을 위한 SDP 정보
    - candidate : P2P 연결을 위한 ICE 후보 정보
  */
  const { type, from, to, sdp, candidate } = data;

  if (type !== 'new-peer' && to !== userId) return;

  if (type === 'new-peer') {
    console.log(`TRACK: new-peer@ws.onmessage(${from}->${to})`, Date.now());
    createPeerConnection(from);
  } else if (type === 'offer') {
    console.log(`TRACK: offer@ws.onmessage(${from}->${to})`, Date.now());
    await handleOffer(from, sdp);
  } else if (type === 'answer') {
    console.log(`TRACK: answer@ws.onmessage(${from}->${to})`, Date.now());
    await handleAnswer(from, sdp);
  } else if (type === 'candidate') {
    console.log(`TRACK: candidate@ws.onmessage(${from}->${to})`, Date.now());
    await handleCandidate(from, candidate);
  }
};

// 첫번째 접속한 peer가 받는 함수
// 두번째 접속한 peer가 첫번째 접속한 peer에게 'new-peer' 받음
function createPeerConnection(peerId) {
  /*
    * STUN 서버의 역할
      - 공인 IP와 포트 정보 제공해 줌
      - ICE 후보 생성해서 전달해 줌
      - NAT 트래버셜 지원을 통해 최적의 통신 경로를 찾음
  */
  const pc = new RTCPeerConnection(servers);

  const dataChannel = pc.createDataChannel('chat');

  peers[peerId] = { pc, dataChannel };

  dataChannel.onopen = () => console.log(`Data channel with ${peerId} opened`);

  dataChannel.onmessage = (event) => {
    addMessage(peerId, event.data);
  };

  pc.createOffer()
    .then(offer => pc.setLocalDescription(offer))
    .then(() => {
      ws.send(JSON.stringify({
        type: 'offer',
        sdp: pc.localDescription,
        from: userId,
        to: peerId
      }));
    })
    .catch(err => console.error('offer creation failed : ', err));

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({
        type: 'candidate',
        candidate: event.candidate,
        from: userId,
        to: peerId
      }));
    };
  };

  pc.oniceconnectionstatechange = (event) => {
    if (event.target.iceConnectionState === 'disconnected') {
      if (peers[peerId]) {
        console.log(`ICE 연결 끊김으로 peers에서 ${peerId} 제거함`);
        delete peers[peerId];
      };
    };
  };
};

function addMessage(peerId, message) {
  const div = document.createElement('div');
  div.innerHTML = `<span style="color: yellow; font-weight: bold;">${peerId}</span> ${message}`;
  domChat.appendChild(div);
  domChat.scrollTop = domChat.scrollHeight;
};

// 두번째 접속한 peer가 받는 함수
// 내가 상대 peer에게 offer 받음
async function handleOffer(peerId, sdp) {
  // 새로운 peer일 경우,
  if (!peers[peerId]) {
    const pc = new RTCPeerConnection(servers);
    peers[peerId] = { pc, dataChannel: null };
    pc.ondatachannel = (event) => {
      peers[peerId].dataChannel = event.channel;
      event.channel.onmessage = (e) => {
        addMessage(peerId, e.data);
      };
    };

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    ws.send(JSON.stringify({
      type: 'answer',
      sdp: pc.localDescription,
      from: userId,
      to: peerId
    }));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        ws.send(JSON.stringify({
          type: 'candidate',
          candidate: event.candidate,
          from: userId,
          to: peerId
        }));
      };
    };

    pc.oniceconnectionstatechange = (event) => {
      if (event.target.iceConnectionState === 'disconnected') {
        if (peers[peerId]) {
          console.log(`ICE 연결 끊김으로 peers에서 ${peerId} 제거함`);
          delete peers[peerId];
        };
      };
    };
  };
};

// 첫번째 접속한 peer가 받는 함수
// 내가 상대 peer에게 answer 받음
async function handleAnswer(peerId, sdp) {
  const pc = peers[peerId].pc;
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
};

async function handleCandidate(peerId, candidate) {
  const pc = peers[peerId].pc;
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
};

domSendButton.onclick = () => {
  const message = domMessageInput.value;
  if (!message) return;
  addMessage('You', message);

  Object.values(peers).forEach(peer => {
    if (peer.dataChannel && peer.dataChannel.readyState === 'open') {
      peer.dataChannel.send(message);
    };
  });

  domMessageInput.value = '';
};