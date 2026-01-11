import type { SocketHandler } from './socket.js';
import type { AvatarManager } from './avatar.js';
import type { ScreenShareManager } from './screenshare.js';
import type { SpatialAudio } from './spatial-audio.js';
import type { PeerData, Position, SignalEvent } from '../../shared/types/events.js';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface PendingShareInfo {
  shareId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AppState {
  peerId: string | null;
  localStream: MediaStream | null;
  screenStreams: Map<string, MediaStream>;
  pendingShareIds: Map<string, (string | PendingShareInfo)[]>;
  peers: Map<string, PeerData>;
}

export class WebRTCManager {
  private socket: SocketHandler;
  private state: AppState;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private screenSenders = new Map<string, Map<string, RTCRtpSender[]>>();
  private webcamStreams = new Map<string, string>();
  private screenShareStreams = new Map<string, string>();
  private makingOffer = new Map<string, boolean>();
  
  private avatars: AvatarManager | null = null;
  private screenShare: ScreenShareManager | null = null;
  private spatialAudio: SpatialAudio | null = null;

  constructor(socket: SocketHandler, state: AppState) {
    this.socket = socket;
    this.state = state;
  }

  setManagers(avatars: AvatarManager, screenShare: ScreenShareManager, spatialAudio: SpatialAudio): void {
    this.avatars = avatars;
    this.screenShare = screenShare;
    this.spatialAudio = spatialAudio;
  }

  createPeerConnection(peerId: string, initiator = false): RTCPeerConnection {
    if (this.peerConnections.has(peerId)) {
      const existingPc = this.peerConnections.get(peerId)!;
      if (initiator) {
        this.createOffer(peerId, existingPc);
      }
      return existingPc;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peerConnections.set(peerId, pc);

    if (this.state.localStream) {
      this.state.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.state.localStream!);
      });
    }

    this.state.screenStreams.forEach((stream, shareId) => {
      stream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, stream);
        if (!this.screenSenders.has(shareId)) {
          this.screenSenders.set(shareId, new Map());
        }
        const shareSenders = this.screenSenders.get(shareId)!;
        if (!shareSenders.has(peerId)) {
          shareSenders.set(peerId, []);
        }
        shareSenders.get(peerId)!.push(sender);
      });
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('signal', {
          to: peerId,
          from: this.state.peerId!,
          signal: {
            type: 'candidate',
            candidate: event.candidate,
          },
        });
      }
    };

    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer.set(peerId, true);
        await pc.setLocalDescription();
        this.socket.emit('signal', {
          to: peerId,
          from: this.state.peerId!,
          signal: {
            type: 'offer',
            sdp: pc.localDescription!,
          },
        });
      } catch (error) {
        console.error('Negotiation error:', error);
      } finally {
        this.makingOffer.set(peerId, false);
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;

      console.log(`Received track kind=${event.track.kind} from ${peerId}, stream=${stream.id}`);

      if (event.track.kind === 'video') {
        const knownWebcamId = this.webcamStreams.get(peerId);

        if (!knownWebcamId) {
          console.log(`First video stream from ${peerId}, treating as webcam`);
          this.webcamStreams.set(peerId, stream.id);
          this.handleVideoTrack(peerId, stream);
        } else if (stream.id === knownWebcamId) {
          console.log(`Same webcam stream from ${peerId}, updating`);
          this.handleVideoTrack(peerId, stream);
        } else {
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

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.closePeerConnection(peerId);
      }
    };

    if (initiator) {
      this.createOffer(peerId, pc);
    }

    return pc;
  }

  private async createOffer(peerId: string, pc: RTCPeerConnection): Promise<void> {
    try {
      this.makingOffer.set(peerId, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.socket.emit('signal', {
        to: peerId,
        from: this.state.peerId!,
        signal: {
          type: 'offer',
          sdp: offer,
        },
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    } finally {
      this.makingOffer.set(peerId, false);
    }
  }

  async handleSignal(data: SignalEvent): Promise<void> {
    const { from, signal } = data;

    let pc = this.peerConnections.get(from);

    if (signal.type === 'offer') {
      const isPolite = this.state.peerId! < from;
      const offerCollision =
        this.makingOffer.get(from) || (pc && pc.signalingState !== 'stable');

      if (!isPolite && offerCollision) {
        console.log(`Ignoring offer from ${from} due to glare (we have priority)`);
        return;
      }

      if (!pc) {
        pc = this.createPeerConnection(from, false);
      }

      try {
        if (offerCollision && isPolite) {
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(new RTCSessionDescription(signal.sdp as RTCSessionDescriptionInit)),
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp as RTCSessionDescriptionInit));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.socket.emit('signal', {
          to: from,
          from: this.state.peerId!,
          signal: {
            type: 'answer',
            sdp: answer,
          },
        });
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    } else if (signal.type === 'answer') {
      if (pc && pc.signalingState === 'have-local-offer') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp as RTCSessionDescriptionInit));
        } catch (error) {
          console.error('Error setting answer:', error);
        }
      }
    } else if (signal.type === 'candidate') {
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate as RTCIceCandidateInit));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      }
    }
  }

  private handleVideoTrack(peerId: string, stream: MediaStream): void {
    this.avatars?.setRemoteStream(peerId, stream);
    this.spatialAudio?.addPeer(peerId, stream);
    // NOTE: Media state (isMuted, isVideoOff) is now managed by CRDT observers.
    // Previously, we re-applied state from this.state.peers here, but that data
    // comes from Socket.io which no longer tracks media state updates.
    // The CRDT observer will apply the correct state.
  }

  private handleScreenTrack(peerId: string, stream: MediaStream): void {
    const peer = this.state.peers.get(peerId);
    const username = peer?.username || 'Unknown';
    const avatarPos = this.avatars?.getPosition(peerId) || { x: 2000, y: 2000 };

    // Default position near the avatar
    const x = avatarPos.x + 150;
    const y = avatarPos.y;

    // Get shareId from pending list (set by screen-share-started event)
    let shareId: string;
    const pendingIds = this.state.pendingShareIds?.get(peerId);
    if (pendingIds && pendingIds.length > 0) {
      const pending = pendingIds.shift()!;
      // pendingShareIds can be string (just shareId) or object (legacy, but we only use shareId)
      shareId = typeof pending === 'object' ? pending.shareId : pending;
    } else {
      shareId = `${peerId}-${stream.id}`;
      console.warn('No pending shareId for screen track, using fallback');
    }

    // Create screen share at default position
    // CRDT pending state mechanism will apply correct position/size
    this.screenShare?.createScreenShare(shareId, peerId, username, stream, x, y);
  }

  addScreenTrack(shareId: string, screenStream: MediaStream): void {
    const shareSenders = new Map<string, RTCRtpSender[]>();

    screenStream.getTracks().forEach((track) => {
      this.peerConnections.forEach((pc, peerId) => {
        const sender = pc.addTrack(track, screenStream);
        if (!shareSenders.has(peerId)) {
          shareSenders.set(peerId, []);
        }
        shareSenders.get(peerId)!.push(sender);
      });
    });

    this.screenSenders.set(shareId, shareSenders);
  }

  removeScreenTrack(shareId: string): void {
    const shareSenders = this.screenSenders.get(shareId);
    if (shareSenders) {
      shareSenders.forEach((senders, peerId) => {
        const pc = this.peerConnections.get(peerId);
        if (pc) {
          senders.forEach((sender) => {
            try {
              pc.removeTrack(sender);
            } catch {
              // Track may already be removed
            }
          });
        }
      });
      this.screenSenders.delete(shareId);
    }
  }

  closePeerConnection(peerId: string): void {
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

  closeAllConnections(): void {
    this.peerConnections.forEach((pc) => {
      pc.close();
    });
    this.peerConnections.clear();
    this.screenSenders.clear();
    this.webcamStreams.clear();
    this.screenShareStreams.clear();
    this.makingOffer.clear();
  }
}
