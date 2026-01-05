import { avatars, screenShare, spatialAudio } from '../main.js';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
];

export class WebRTCManager {
    constructor(socket, state) {
        this.socket = socket;
        this.state = state;
        this.peerConnections = new Map();
        this.screenSenders = new Map();
        // Track known webcam stream IDs per peer
        this.webcamStreams = new Map();
        // Track known screen share stream IDs per peer
        this.screenShareStreams = new Map();
        // Track if we're in the middle of making an offer (for glare handling)
        this.makingOffer = new Map();
    }
    
    createPeerConnection(peerId, initiator = false) {
        if (this.peerConnections.has(peerId)) {
            // If connection exists, just return it
            const existingPc = this.peerConnections.get(peerId);
            if (initiator) {
                // But if we need to initiate, do a renegotiation
                this.createOffer(peerId, existingPc);
            }
            return existingPc;
        }
        
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        this.peerConnections.set(peerId, pc);
        
        // Add local tracks
        if (this.state.localStream) {
            this.state.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.state.localStream);
            });
        }
        
        // Add all active screen share tracks
        this.state.screenStreams.forEach((stream, shareId) => {
            stream.getTracks().forEach(track => {
                const sender = pc.addTrack(track, stream);
                if (!this.screenSenders.has(shareId)) {
                    this.screenSenders.set(shareId, new Map());
                }
                const shareSenders = this.screenSenders.get(shareId);
                if (!shareSenders.has(peerId)) {
                    shareSenders.set(peerId, []);
                }
                shareSenders.get(peerId).push(sender);
            });
        });
        
        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('signal', {
                    to: peerId,
                    from: this.state.peerId,
                    signal: {
                        type: 'candidate',
                        candidate: event.candidate
                    }
                });
            }
        };
        
        // Handle negotiation needed (for adding tracks mid-session)
        pc.onnegotiationneeded = async () => {
            try {
                this.makingOffer.set(peerId, true);
                await pc.setLocalDescription();
                this.socket.emit('signal', {
                    to: peerId,
                    from: this.state.peerId,
                    signal: {
                        type: 'offer',
                        sdp: pc.localDescription
                    }
                });
            } catch (error) {
                console.error('Negotiation error:', error);
            } finally {
                this.makingOffer.set(peerId, false);
            }
        };
        
        // Handle incoming tracks
        pc.ontrack = (event) => {
            const stream = event.streams[0];
            if (!stream) return;
            
            console.log(`Received track kind=${event.track.kind} from ${peerId}, stream=${stream.id}`);
            
            if (event.track.kind === 'video') {
                const knownWebcamId = this.webcamStreams.get(peerId);
                
                if (!knownWebcamId) {
                    // First video stream from this peer = webcam
                    console.log(`First video stream from ${peerId}, treating as webcam`);
                    this.webcamStreams.set(peerId, stream.id);
                    this.handleVideoTrack(peerId, stream);
                } else if (stream.id === knownWebcamId) {
                    // Same stream = webcam update (renegotiation)
                    console.log(`Same webcam stream from ${peerId}, updating`);
                    this.handleVideoTrack(peerId, stream);
                } else {
                    // Different stream = screen share
                    const knownScreenId = this.screenShareStreams.get(peerId);
                    if (stream.id !== knownScreenId) {
                        console.log(`New screen share stream from ${peerId}`);
                        this.screenShareStreams.set(peerId, stream.id);
                        this.handleScreenTrack(peerId, stream);
                    } else {
                        console.log(`Same screen share stream from ${peerId}, skipping recreation`);
                    }
                }
            }
        };
        
        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            console.log(`Connection state with ${peerId}:`, pc.connectionState);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                this.closePeerConnection(peerId);
            }
        };
        
        // If initiator, create and send offer
        if (initiator) {
            this.createOffer(peerId, pc);
        }
        
        return pc;
    }
    
    async createOffer(peerId, pc) {
        try {
            this.makingOffer.set(peerId, true);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            this.socket.emit('signal', {
                to: peerId,
                from: this.state.peerId,
                signal: {
                    type: 'offer',
                    sdp: offer
                }
            });
        } catch (error) {
            console.error('Error creating offer:', error);
        } finally {
            this.makingOffer.set(peerId, false);
        }
    }
    
    async handleSignal(data) {
        const { from, signal } = data;
        
        let pc = this.peerConnections.get(from);
        
        if (signal.type === 'offer') {
            // Handle glare (both sides sending offers)
            // Use "polite peer" pattern: peer with lower ID is polite (drops their offer)
            const isPolite = this.state.peerId < from;
            const offerCollision = this.makingOffer.get(from) || 
                                   (pc && pc.signalingState !== 'stable');
            
            if (!isPolite && offerCollision) {
                console.log(`Ignoring offer from ${from} due to glare (we have priority)`);
                return;
            }
            
            // Create connection if it doesn't exist
            if (!pc) {
                pc = this.createPeerConnection(from, false);
            }
            
            try {
                // If we're polite and there's a collision, rollback
                if (offerCollision && isPolite) {
                    await Promise.all([
                        pc.setLocalDescription({ type: 'rollback' }),
                        pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
                    ]);
                } else {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                }
                
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                
                this.socket.emit('signal', {
                    to: from,
                    from: this.state.peerId,
                    signal: {
                        type: 'answer',
                        sdp: answer
                    }
                });
            } catch (error) {
                console.error('Error handling offer:', error);
            }
            
        } else if (signal.type === 'answer') {
            if (pc && pc.signalingState === 'have-local-offer') {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                } catch (error) {
                    console.error('Error setting answer:', error);
                }
            }
            
        } else if (signal.type === 'candidate') {
            if (pc) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                } catch (error) {
                    console.error('Error adding ICE candidate:', error);
                }
            }
        }
    }
    
    handleVideoTrack(peerId, stream) {
        // Update avatar with remote stream
        avatars.setRemoteStream(peerId, stream);
        
        // Setup audio analysis for speaking detection
        spatialAudio.addPeer(peerId, stream);
    }
    
    handleScreenTrack(peerId, stream) {
        const peer = this.state.peers.get(peerId);
        const username = peer?.username || 'Unknown';
        const position = avatars.getPosition(peerId);
        
        // Use shareId from signaling (queued in pendingShareIds), or fallback to stream.id
        let shareId;
        const pendingIds = this.state.pendingShareIds?.get(peerId);
        if (pendingIds && pendingIds.length > 0) {
            shareId = pendingIds.shift(); // Use the queued ID from signaling
        } else {
            // Fallback if signaling arrived after track (shouldn't happen normally)
            shareId = `${peerId}-${stream.id}`;
            console.warn('No pending shareId for screen track, using fallback');
        }
        
        screenShare.createScreenShare(
            shareId,
            peerId,
            username,
            stream,
            position.x + 150,
            position.y
        );
    }
    
    addScreenTrack(shareId, screenStream) {
        // Track senders per shareId per peer
        const shareSenders = new Map();
        
        screenStream.getTracks().forEach(track => {
            this.peerConnections.forEach((pc, peerId) => {
                const sender = pc.addTrack(track, screenStream);
                if (!shareSenders.has(peerId)) {
                    shareSenders.set(peerId, []);
                }
                shareSenders.get(peerId).push(sender);
            });
        });
        
        this.screenSenders.set(shareId, shareSenders);
        // onnegotiationneeded will fire and trigger renegotiation
    }
    
    removeScreenTrack(shareId) {
        const shareSenders = this.screenSenders.get(shareId);
        if (shareSenders) {
            shareSenders.forEach((senders, peerId) => {
                const pc = this.peerConnections.get(peerId);
                if (pc) {
                    senders.forEach(sender => {
                        try {
                            pc.removeTrack(sender);
                        } catch (e) {
                            // Track may already be removed
                        }
                    });
                }
            });
            this.screenSenders.delete(shareId);
        }
    }
    
    closePeerConnection(peerId) {
        const pc = this.peerConnections.get(peerId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(peerId);
        }
        this.screenSenders.delete(peerId);
        this.webcamStreams.delete(peerId);
        this.screenShareStreams.delete(peerId);
        this.makingOffer.delete(peerId);
    }
    
    closeAllConnections() {
        this.peerConnections.forEach((pc, peerId) => {
            pc.close();
        });
        this.peerConnections.clear();
        this.screenSenders.clear();
        this.webcamStreams.clear();
        this.screenShareStreams.clear();
        this.makingOffer.clear();
    }
}
