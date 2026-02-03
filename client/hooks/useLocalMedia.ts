/**
 * useLocalMedia - Hook for accessing local camera/microphone
 */
import { createSignal, onCleanup, Accessor } from 'solid-js';

export interface LocalMediaHook {
  stream: Accessor<MediaStream | null>;
  error: Accessor<string | null>;
  isMuted: Accessor<boolean>;
  isVideoOff: Accessor<boolean>;
  getMedia: () => Promise<MediaStream | null>;
  toggleMic: () => void;
  toggleCamera: () => void;
  stopMedia: () => void;
}

export function useLocalMedia(): LocalMediaHook {
  const [stream, setStream] = createSignal<MediaStream | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [isMuted, setIsMuted] = createSignal(false);
  const [isVideoOff, setIsVideoOff] = createSignal(false);
  
  async function getMedia(): Promise<MediaStream | null> {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: true,
      };
      
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);
        setError(null);
        return mediaStream;
      } catch (e) {
        const err = e as DOMException;
        console.error('getUserMedia error:', err.name, err.message);
        
        if (err.name === 'NotAllowedError') {
          setError('Camera/microphone access was denied. Please grant permission and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera or microphone found on this device.');
        } else if (err.name === 'NotReadableError') {
          setError('Camera/microphone is already in use by another application.');
        } else if (err.name === 'OverconstrainedError') {
          // Retry with basic constraints
          console.log('Retrying with basic constraints...');
          const basicStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          setStream(basicStream);
          setError(null);
          return basicStream;
        } else {
          setError(`Camera/microphone error: ${err.name}`);
        }
        
        return null;
      }
    } catch (e) {
      const err = e as Error;
      setError(err.message);
      return null;
    }
  }
  
  function toggleMic() {
    const s = stream();
    if (!s) return;
    
    const audioTrack = s.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }
  
  function toggleCamera() {
    const s = stream();
    if (!s) return;
    
    const videoTrack = s.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  }
  
  function stopMedia() {
    const s = stream();
    if (s) {
      s.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }
  
  onCleanup(() => stopMedia());
  
  return {
    stream,
    error,
    isMuted,
    isVideoOff,
    getMedia,
    toggleMic,
    toggleCamera,
    stopMedia,
  };
}
