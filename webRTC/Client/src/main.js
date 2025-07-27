import './style.css'

const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // { urls: 'stun:stun.services.mozilla.com' },
    // { urls: 'stun:stun.freeswitch.org' }
  ],
};

document.querySelector('#app').innerHTML = /*html*/ `
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






function addMessage(peerId, message) {
  const div = document.createElement('div');
  div.innerHTML = `<span style="color: yellow; font-weight: bold;">${peerId}</span> ${message}`;
  domChat.appendChild(div);
  domChat.scrollTop = domChat.scrollHeight;
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