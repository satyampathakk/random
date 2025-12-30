class RandomChat {
    constructor() {
        this.ws = null;
        this.nickname = '';
        this.mode = 'text';
        this.partnerId = null;
        this.partnerNickname = null;
        this.localStream = null;
        this.peerConnection = null;
        this.typingTimeout = null;
        this.isTyping = false;
        this.onlineCountInterval = null;
        
        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.initElements();
        this.initEventListeners();
        this.startOnlineCounter();
    }
    
    initElements() {
        // Landing
        this.landingScreen = document.getElementById('landing-screen');
        this.chatScreen = document.getElementById('chat-screen');
        this.nicknameInput = document.getElementById('nickname-input');
        this.modeBtns = document.querySelectorAll('.tab');
        this.startBtn = document.getElementById('start-btn');
        this.onlineCountEl = document.getElementById('online-count');
        
        // Chat
        this.backBtn = document.getElementById('back-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.partnerAvatar = document.getElementById('partner-avatar');
        this.partnerName = document.getElementById('partner-name');
        this.partnerStatus = document.getElementById('partner-status');
        this.messagesList = document.getElementById('messages-list');
        this.messageInput = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-btn');
        this.typingIndicator = document.getElementById('typing-indicator');
        
        // Video
        this.videoContainer = document.getElementById('video-container');
        this.localVideo = document.getElementById('local-video');
        this.remoteVideo = document.getElementById('remote-video');
        this.remotePlaceholder = document.getElementById('remote-placeholder');
        this.toggleMicBtn = document.getElementById('toggle-mic');
        this.toggleCameraBtn = document.getElementById('toggle-camera');
    }
    
    initEventListeners() {
        this.nicknameInput.addEventListener('input', () => this.validateForm());
        
        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.mode = btn.dataset.mode;
            });
        });
        
        this.startBtn.addEventListener('click', () => this.startChat());
        this.backBtn.addEventListener('click', () => this.leaveChat());
        this.nextBtn.addEventListener('click', () => this.findNext());
        
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.messageInput.addEventListener('input', () => this.handleTyping());
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        
        this.toggleMicBtn.addEventListener('click', () => this.toggleMic());
        this.toggleCameraBtn.addEventListener('click', () => this.toggleCamera());
    }
    
    validateForm() {
        const valid = this.nicknameInput.value.trim().length >= 2;
        this.startBtn.disabled = !valid;
    }
    
    async startChat() {
        this.nickname = this.nicknameInput.value.trim();
        
        if (this.mode === 'video') {
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                this.localVideo.srcObject = this.localStream;
            } catch (err) {
                alert('Camera/microphone access is required for video chat. Please allow access and try again.');
                return;
            }
        }
        
        this.connect();
    }
    
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${encodeURIComponent(this.nickname)}/${this.mode}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.showChatScreen();
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };
        
        this.ws.onclose = () => {
            this.addSystemMessage('Connection lost. Please refresh to reconnect.');
            this.disableChat();
        };
        
        this.ws.onerror = () => {
            alert('Connection error. Please try again.');
        };
    }
    
    handleMessage(data) {
        switch (data.type) {
            case 'connected':
                this.addSystemMessage(data.message);
                break;
                
            case 'searching':
                this.resetPartner();
                this.addSystemMessage(data.message);
                break;
                
            case 'partner_found':
                this.partnerNickname = data.partner_nickname;
                this.setPartnerConnected();
                this.addSystemMessage(`Connected with ${data.partner_nickname}! Say hi 👋`);
                
                if (this.mode === 'video' && data.initiator) {
                    this.createOffer();
                }
                break;
                
            case 'partner_disconnected':
                this.addSystemMessage('Partner disconnected. Click "Next" to find someone new.');
                this.resetPartner();
                this.closePeerConnection();
                break;
                
            case 'chat_message':
                this.addMessage(data.message, data.nickname, false);
                break;
                
            case 'typing':
                this.showTypingIndicator();
                break;
                
            case 'stop_typing':
                this.hideTypingIndicator();
                break;
                
            case 'offer':
                this.handleOffer(data);
                break;
                
            case 'answer':
                this.handleAnswer(data);
                break;
                
            case 'ice_candidate':
                this.handleIceCandidate(data);
                break;
        }
    }
    
    showChatScreen() {
        this.landingScreen.classList.remove('active');
        this.chatScreen.classList.add('active');
        
        if (this.mode === 'video') {
            this.videoContainer.classList.remove('hidden');
        } else {
            this.videoContainer.classList.add('hidden');
        }
        
        this.messagesList.innerHTML = '';
    }
    
    setPartnerConnected() {
        this.partnerAvatar.textContent = this.partnerNickname.charAt(0).toUpperCase();
        this.partnerName.textContent = this.partnerNickname;
        this.partnerStatus.textContent = 'Online';
        this.partnerStatus.classList.add('online');
        this.enableChat();
    }
    
    resetPartner() {
        this.partnerNickname = null;
        this.partnerAvatar.textContent = '?';
        this.partnerName.textContent = 'Searching...';
        this.partnerStatus.textContent = 'Looking for partner';
        this.partnerStatus.classList.remove('online');
        this.disableChat();
        this.hideTypingIndicator();
        this.remotePlaceholder.classList.remove('hidden');
    }
    
    enableChat() {
        this.messageInput.disabled = false;
        this.sendBtn.disabled = false;
        this.nextBtn.disabled = false;
        this.messageInput.focus();
    }
    
    disableChat() {
        this.messageInput.disabled = true;
        this.sendBtn.disabled = true;
    }
    
    addMessage(text, sender, isSent) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
        
        if (!isSent) {
            const senderEl = document.createElement('div');
            senderEl.className = 'sender';
            senderEl.textContent = sender;
            messageEl.appendChild(senderEl);
        }
        
        const textEl = document.createElement('div');
        textEl.textContent = text;
        messageEl.appendChild(textEl);
        
        this.messagesList.appendChild(messageEl);
        this.scrollToBottom();
    }
    
    addSystemMessage(text) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message system';
        messageEl.textContent = text;
        this.messagesList.appendChild(messageEl);
        this.scrollToBottom();
    }
    
    scrollToBottom() {
        this.messagesList.scrollTop = this.messagesList.scrollHeight;
    }
    
    sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text || !this.partnerNickname) return;
        
        this.ws.send(JSON.stringify({
            type: 'chat_message',
            message: text
        }));
        
        this.addMessage(text, this.nickname, true);
        this.messageInput.value = '';
        this.sendTypingStop();
    }
    
    handleTyping() {
        if (!this.partnerNickname) return;
        
        if (!this.isTyping) {
            this.isTyping = true;
            this.ws.send(JSON.stringify({ type: 'typing' }));
        }
        
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => this.sendTypingStop(), 1000);
    }
    
    sendTypingStop() {
        if (this.isTyping) {
            this.isTyping = false;
            this.ws.send(JSON.stringify({ type: 'stop_typing' }));
        }
    }
    
    showTypingIndicator() {
        this.typingIndicator.classList.remove('hidden');
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        this.typingIndicator.classList.add('hidden');
    }
    
    findNext() {
        this.closePeerConnection();
        this.ws.send(JSON.stringify({ type: 'next' }));
    }
    
    leaveChat() {
        if (this.ws) {
            this.ws.close();
        }
        this.closePeerConnection();
        this.stopLocalStream();
        
        this.chatScreen.classList.remove('active');
        this.landingScreen.classList.add('active');
        this.messagesList.innerHTML = '';
        this.resetPartner();
        this.nextBtn.disabled = true;
    }
    
    // WebRTC Methods
    async createPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.iceServers);
        
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.ws.send(JSON.stringify({
                    type: 'ice_candidate',
                    candidate: event.candidate
                }));
            }
        };
        
        this.peerConnection.ontrack = (event) => {
            this.remoteVideo.srcObject = event.streams[0];
            this.remotePlaceholder.classList.add('hidden');
        };
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }
    }
    
    async createOffer() {
        await this.createPeerConnection();
        
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        
        this.ws.send(JSON.stringify({
            type: 'offer',
            sdp: offer
        }));
    }
    
    async handleOffer(data) {
        await this.createPeerConnection();
        
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        this.ws.send(JSON.stringify({
            type: 'answer',
            sdp: answer
        }));
    }
    
    async handleAnswer(data) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
    }
    
    async handleIceCandidate(data) {
        if (this.peerConnection) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    }
    
    closePeerConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        this.remoteVideo.srcObject = null;
        this.remotePlaceholder.classList.remove('hidden');
    }
    
    stopLocalStream() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        this.localVideo.srcObject = null;
    }
    
    toggleMic() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.toggleMicBtn.classList.toggle('active', audioTrack.enabled);
            }
        }
    }
    
    toggleCamera() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.toggleCameraBtn.classList.toggle('active', videoTrack.enabled);
            }
        }
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new RandomChat();
});

RandomChat.prototype.startOnlineCounter = function() {
    const el = this.onlineCountEl;
    if (!el) return;
    
    const updateCount = async () => {
        try {
            const res = await fetch('/api/online-count');
            const data = await res.json();
            const baseCount = Math.floor(Math.random() * 1500) + 500;
            const total = (data.count || 0) + baseCount;
            el.textContent = total.toLocaleString();
        } catch (e) {
            const random = Math.floor(Math.random() * 2000) + 800;
            el.textContent = random.toLocaleString();
        }
    };
    
    updateCount();
    this.onlineCountInterval = setInterval(updateCount, 10000);
};
