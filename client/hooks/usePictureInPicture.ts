/**
 * usePictureInPicture Hook
 *
 * Manual Document Picture-in-Picture for video conferencing.
 * Opens a floating always-on-top window showing peer webcams and media controls
 * when the user clicks the PiP button in the ControlBar.
 *
 * NOTE: PiP window is a separate Document — Tailwind doesn't work there.
 * All styling uses inline styles.
 */
import { createEffect, onCleanup } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import { avatarGradient } from '@/lib/avatarColor';

// Design tokens (match base.css)
const COLORS = {
  bgPrimary: '#0a0a0f',
  bgTertiary: '#1a1a24',
  surface: 'rgba(255,255,255,0.05)',
  surfaceHover: 'rgba(255,255,255,0.1)',
  border: 'rgba(255,255,255,0.1)',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.7)',
  accent: '#6366f1',
  danger: '#ef4444',
  gradientPrimary: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
};

/** Build a circular avatar element for a peer */
function createAvatarEl(
  username: string,
  isVideoOff: boolean,
  isMuted: boolean,
  stream: MediaStream | null,
): HTMLDivElement {
  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  });

  const circle = document.createElement('div');
  Object.assign(circle.style, {
    position: 'relative',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    overflow: 'hidden',
    border: `2px solid ${COLORS.accent}`,
    backgroundColor: COLORS.bgTertiary,
    boxShadow: '0 10px 15px rgba(0,0,0,0.5)',
  });

  if (!isVideoOff && stream) {
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;
    Object.assign(video.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transform: 'scaleX(-1)',
    });
    circle.appendChild(video);
  } else {
    const initials = document.createElement('div');
    Object.assign(initials.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      fontSize: '18px',
      fontWeight: '700',
      color: COLORS.textPrimary,
      background: avatarGradient(username),
    });
    initials.textContent = username.charAt(0).toUpperCase();
    circle.appendChild(initials);
  }

  if (isMuted) {
    const muted = document.createElement('div');
    Object.assign(muted.style, {
      position: 'absolute',
      top: '-4px',
      right: '-4px',
      width: '20px',
      height: '20px',
      backgroundColor: 'rgba(239,68,68,0.9)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    muted.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    circle.appendChild(muted);
  }

  wrapper.appendChild(circle);

  const name = document.createElement('span');
  Object.assign(name.style, {
    fontSize: '11px',
    color: COLORS.textSecondary,
    fontWeight: '500',
    maxWidth: '72px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  });
  name.textContent = username;
  wrapper.appendChild(name);

  return wrapper;
}

const MIC_ON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
const MIC_OFF = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .74-.11 1.46-.32 2.14"/></svg>`;
const CAM_ON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
const CAM_OFF = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function createControlButton(id: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = id;
  btn.title = title;
  Object.assign(btn.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    cursor: 'pointer',
    transition: 'all 150ms ease',
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.backgroundColor = COLORS.surfaceHover;
  });
  btn.addEventListener('mouseleave', () => {
    const isDanger = btn.dataset.danger === 'true';
    btn.style.backgroundColor = isDanger ? 'rgba(239,68,68,0.2)' : COLORS.surface;
  });
  return btn;
}

function setButtonDanger(btn: HTMLButtonElement, danger: boolean) {
  btn.dataset.danger = String(danger);
  if (danger) {
    btn.style.backgroundColor = 'rgba(239,68,68,0.2)';
    btn.style.borderColor = COLORS.danger;
    btn.style.color = COLORS.danger;
  } else {
    btn.style.backgroundColor = COLORS.surface;
    btn.style.borderColor = COLORS.border;
    btn.style.color = COLORS.textPrimary;
  }
}

export function usePictureInPicture() {
  const ctx = useSpace();
  let pipWindow: Window | null = null;

  function buildPipContent(pipWin: Window) {
    const body = pipWin.document.body;
    Object.assign(body.style, {
      margin: '0',
      overflow: 'hidden',
      backgroundColor: COLORS.bgPrimary,
      color: COLORS.textPrimary,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    });

    const container = document.createElement('div');
    container.id = 'pip-root';
    Object.assign(container.style, {
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '12px',
      gap: '12px',
      boxSizing: 'border-box',
    });

    const grid = document.createElement('div');
    grid.id = 'pip-grid';
    Object.assign(grid.style, {
      flex: '1',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      alignContent: 'center',
      gap: '12px',
    });
    container.appendChild(grid);

    const controls = document.createElement('div');
    Object.assign(controls.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      paddingBottom: '4px',
    });

    const micBtn = createControlButton('pip-mic', 'Toggle Microphone');
    const { isMuted } = ctx.localMediaState();
    micBtn.innerHTML = isMuted ? MIC_OFF : MIC_ON;
    setButtonDanger(micBtn, isMuted);
    micBtn.addEventListener('click', () => {
      ctx.toggleMic();
    });
    controls.appendChild(micBtn);

    const camBtn = createControlButton('pip-cam', 'Toggle Camera');
    const { isVideoOff } = ctx.localMediaState();
    camBtn.innerHTML = isVideoOff ? CAM_OFF : CAM_ON;
    setButtonDanger(camBtn, isVideoOff);
    camBtn.addEventListener('click', () => {
      ctx.toggleCamera();
    });
    controls.appendChild(camBtn);

    container.appendChild(controls);
    body.appendChild(container);
  }

  function refreshPeerGrid() {
    if (!pipWindow) return;
    const grid = pipWindow.document.getElementById('pip-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const peers = ctx.peers();
    const peerStreams = ctx.peerStreams();
    const session = ctx.session();

    for (const [peerId, peer] of peers) {
      const stream = peerId === session?.localUser.peerId
        ? session.localUser.stream
        : peerStreams.get(peerId) ?? null;
      grid.appendChild(createAvatarEl(peer.username, peer.isVideoOff, peer.isMuted, stream));
    }
  }

  async function openPip() {
    if (pipWindow) {
      pipWindow.close();
      pipWindow = null;
      return; // Toggle behavior — close if already open
    }

    if (!('documentPictureInPicture' in window)) {
      console.log('[PiP] Document Picture-in-Picture not supported');
      return;
    }

    try {
      const peerCount = Math.max(ctx.peers().size, 1);
      const cols = peerCount <= 2 ? peerCount : Math.min(3, Math.ceil(Math.sqrt(peerCount)));
      const rows = Math.ceil(peerCount / cols);
      const width = Math.min(500, Math.max(240, cols * 100 + 40));
      const height = Math.min(400, Math.max(200, rows * 100 + 80));

      pipWindow = await (window as any).documentPictureInPicture.requestWindow({
        width,
        height,
      });
      if (!pipWindow) return;

      buildPipContent(pipWindow);
      refreshPeerGrid();

      pipWindow.addEventListener('pagehide', () => {
        pipWindow = null;
      });
    } catch (e) {
      console.error('[PiP] Failed to open:', e);
      pipWindow = null;
    }
  }

  // Reactively update the peer grid and control buttons when state changes
  createEffect(() => {
    ctx.peers();
    ctx.peerStreams();
    ctx.session();
    refreshPeerGrid();
  });
  
  // Reactively update PiP control button states from CRDT
  createEffect(() => {
    if (!pipWindow) return;
    const { isMuted, isVideoOff } = ctx.localMediaState();
    
    const micBtn = pipWindow.document.getElementById('pip-mic') as HTMLButtonElement | null;
    if (micBtn) {
      micBtn.innerHTML = isMuted ? MIC_OFF : MIC_ON;
      setButtonDanger(micBtn, isMuted);
    }
    
    const camBtn = pipWindow.document.getElementById('pip-cam') as HTMLButtonElement | null;
    if (camBtn) {
      camBtn.innerHTML = isVideoOff ? CAM_OFF : CAM_ON;
      setButtonDanger(camBtn, isVideoOff);
    }
  });

  onCleanup(() => {
    pipWindow?.close();
    pipWindow = null;
  });

  return { openPip };
}
