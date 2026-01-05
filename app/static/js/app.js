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
        
        // Add video event listeners
        this.remoteVideo.onloadedmetadata = () => {
            console.log('Remote video metadata loaded');
            this.remoteVideo.play().catch(e => console.error('Error playing remote video:', e));
        };
        
        this.remoteVideo.onplaying = () => {
            console.log('Remote video started playing');
            this.remotePlaceholder.classList.add('hidden');
        };
        
        this.remoteVideo.onerror = (e) => {
            console.error('Remote video error:', e);
            this.addSystemMessage('Video playback error. Please try refreshing.');
        };
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
                console.log('Requesting camera and microphone access...');
                this.localStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 30 }
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true
                    }
                });
                
                console.log('Got local stream:', this.localStream);
                this.localVideo.srcObject = this.localStream;
                
                // Ensure video is playing
                this.localVideo.onloadedmetadata = () => {
                    console.log('Local video metadata loaded');
                    this.localVideo.play().catch(e => console.error('Error playing local video:', e));
                };
                
            } catch (err) {
                console.error('Media access error:', err);
                let errorMsg = 'Camera/microphone access is required for video chat.';
                
                if (err.name === 'NotAllowedError') {
                    errorMsg = 'Camera/microphone access was denied. Please allow access and try again.';
                } else if (err.name === 'NotFoundError') {
                    errorMsg = 'No camera or microphone found. Please check your devices.';
                } else if (err.name === 'NotReadableError') {
                    errorMsg = 'Camera/microphone is being used by another application.';
                }
                
                alert(errorMsg);
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
        
        const chatMain = document.querySelector('.chat-main');
        
        if (this.mode === 'video') {
            this.videoContainer.classList.remove('hidden');
            chatMain.classList.remove('text-only-mode');
        } else {
            this.videoContainer.classList.add('hidden');
            chatMain.classList.add('text-only-mode');
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
        this.messagesList.innerHTML = '';
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
        try {
            this.peerConnection = new RTCPeerConnection(this.iceServers);
            
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    console.log('Sending ICE candidate:', event.candidate);
                    this.ws.send(JSON.stringify({
                        type: 'ice_candidate',
                        candidate: event.candidate
                    }));
                }
            };
            
            this.peerConnection.ontrack = (event) => {
                console.log('Received remote track:', event);
                if (event.streams && event.streams[0]) {
                    this.remoteVideo.srcObject = event.streams[0];
                    this.remotePlaceholder.classList.add('hidden');
                    console.log('Remote video stream set successfully');
                } else {
                    console.error('No streams in track event');
                }
            };
            
            this.peerConnection.onconnectionstatechange = () => {
                console.log('Connection state:', this.peerConnection.connectionState);
                if (this.peerConnection.connectionState === 'failed') {
                    console.error('WebRTC connection failed');
                    this.addSystemMessage('Video connection failed. Try refreshing or switching to text mode.');
                }
            };
            
            this.peerConnection.oniceconnectionstatechange = () => {
                console.log('ICE connection state:', this.peerConnection.iceConnectionState);
            };
            
            if (this.localStream) {
                console.log('Adding local stream tracks to peer connection');
                this.localStream.getTracks().forEach(track => {
                    console.log('Adding track:', track.kind, track.enabled);
                    this.peerConnection.addTrack(track, this.localStream);
                });
            } else {
                console.error('No local stream available when creating peer connection');
            }
        } catch (error) {
            console.error('Error creating peer connection:', error);
            this.addSystemMessage('Failed to set up video connection. Please try again.');
        }
    }
    
    async createOffer() {
        try {
            console.log('Creating WebRTC offer...');
            await this.createPeerConnection();
            
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            console.log('Created offer:', offer);
            
            await this.peerConnection.setLocalDescription(offer);
            console.log('Set local description (offer)');
            
            this.ws.send(JSON.stringify({
                type: 'offer',
                sdp: offer
            }));
            console.log('Sent offer to partner');
        } catch (error) {
            console.error('Error creating offer:', error);
            this.addSystemMessage('Failed to initiate video call. Please try again.');
        }
    }
    
    async handleOffer(data) {
        try {
            console.log('Handling WebRTC offer:', data);
            await this.createPeerConnection();
            
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            console.log('Set remote description (offer)');
            
            const answer = await this.peerConnection.createAnswer();
            console.log('Created answer:', answer);
            
            await this.peerConnection.setLocalDescription(answer);
            console.log('Set local description (answer)');
            
            this.ws.send(JSON.stringify({
                type: 'answer',
                sdp: answer
            }));
            console.log('Sent answer to partner');
        } catch (error) {
            console.error('Error handling offer:', error);
            this.addSystemMessage('Failed to accept video call. Please try again.');
        }
    }
    
    async handleAnswer(data) {
        try {
            console.log('Handling WebRTC answer:', data);
            if (this.peerConnection) {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
                console.log('Set remote description (answer)');
            } else {
                console.error('No peer connection when handling answer');
            }
        } catch (error) {
            console.error('Error handling answer:', error);
            this.addSystemMessage('Video connection error. Please try refreshing.');
        }
    }
    
    async handleIceCandidate(data) {
        try {
            console.log('Handling ICE candidate:', data);
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log('Added ICE candidate');
            } else {
                console.warn('Cannot add ICE candidate - no peer connection or remote description');
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }
    
    closePeerConnection() {
        if (this.peerConnection) {
            console.log('Closing peer connection');
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        // Reset remote video
        if (this.remoteVideo.srcObject) {
            const tracks = this.remoteVideo.srcObject.getTracks();
            tracks.forEach(track => track.stop());
            this.remoteVideo.srcObject = null;
        }
        
        this.remotePlaceholder.classList.remove('hidden');
        console.log('Peer connection closed and remote video reset');
    }
    
    stopLocalStream() {
        if (this.localStream) {
            console.log('Stopping local stream');
            this.localStream.getTracks().forEach(track => {
                console.log('Stopping track:', track.kind);
                track.stop();
            });
            this.localStream = null;
        }
        
        if (this.localVideo.srcObject) {
            this.localVideo.srcObject = null;
        }
        console.log('Local stream stopped');
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
