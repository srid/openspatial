/**
 * Landing Page Component
 * Bright theme with spatial-focused feature cards.
 */
import { Component, createSignal, Show, onMount, JSX } from 'solid-js';

const features: { title: string; description: string; icon: JSX.Element }[] = [
  {
    title: 'Spatial Audio',
    description: 'Voices get louder as you move closer, just like a real room. Walk up to someone to chat, or drift away for quiet focus.',
    icon: (
      <svg class="shrink-0" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" opacity="0.5" />
        <path d="M17.66 6.34a8 8 0 0 1 0 11.31" opacity="0.3" />
      </svg>
    ),
  },
  {
    title: 'Screen Sharing',
    description: 'Share your screen as a resizable, draggable window on the canvas — and everyone can do it at once. Multiple people, multiple shares, all visible simultaneously.',
    icon: (
      <svg class="shrink-0" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
        <rect x="6" y="6" width="5" height="4" rx="0.5" opacity="0.4" />
        <rect x="13" y="8" width="5" height="4" rx="0.5" opacity="0.4" />
      </svg>
    ),
  },
  {
    title: 'Shared Canvas',
    description: 'Drag your avatar around an infinite surface and drop notes — everyone sees and interacts with the same space in real time.',
    icon: (
      <svg class="shrink-0" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8" cy="8" r="1" fill="currentColor" opacity="0.4" />
        <circle cx="12" cy="8" r="1" fill="currentColor" opacity="0.4" />
        <circle cx="16" cy="8" r="1" fill="currentColor" opacity="0.4" />
        <circle cx="8" cy="12" r="1" fill="currentColor" opacity="0.4" />
        <circle cx="12" cy="12" r="1" fill="currentColor" opacity="0.4" />
        <circle cx="16" cy="12" r="1" fill="currentColor" opacity="0.4" />
        <circle cx="8" cy="16" r="1" fill="currentColor" opacity="0.4" />
        <circle cx="12" cy="16" r="1" fill="currentColor" opacity="0.4" />
        <circle cx="16" cy="16" r="1" fill="currentColor" opacity="0.4" />
        <path d="M4 14l-2 2 2 2" opacity="0.6" />
        <path d="M20 10l2-2-2-2" opacity="0.6" />
      </svg>
    ),
  },
  {
    title: 'Real-Time Collaboration',
    description: 'Rich Markdown notes with syntax-highlighted code blocks, co-edited by everyone in the space with live cursors.',
    icon: (
      <svg class="shrink-0" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        <path d="M14 14l2.5-2.5" opacity="0.4" stroke-dasharray="2 2" />
      </svg>
    ),
  },
];

export const Landing: Component = () => {
  const [showBrowserWarning, setShowBrowserWarning] = createSignal(false);
  
  onMount(() => {
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge|Edg/.test(navigator.userAgent);
    if (!isChrome) {
      setShowBrowserWarning(true);
    }
  });
  
  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const input = document.getElementById('landing-space-input') as HTMLInputElement;
    const spaceName = input.value.trim() || 'demo';
    window.location.href = `/s/${encodeURIComponent(spaceName)}`;
  };
  
  return (
    <div id="landing-page" class="fixed inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#f0f0ff_0%,#e8e0f0_40%,#ddeeff_100%)] z-[1000] overflow-y-auto p-8">
      <Show when={showBrowserWarning()}>
        <div class="browser-warning fixed top-0 left-0 right-0 bg-warning text-black text-center py-2 px-10 z-[9999] font-bold text-sm shadow-md flex items-center justify-center">
          <span>Warning: This application is tested on Chrome only. You may experience issues on other browsers.</span>
          <button class="browser-warning-close absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none text-black text-xl leading-none cursor-pointer opacity-60 hover:opacity-100 transition-opacity duration-(--transition-fast)" onClick={() => setShowBrowserWarning(false)}>×</button>
        </div>
      </Show>

      {/* Decorative gradient orbs */}
      <div class="fixed rounded-full pointer-events-none blur-[80px] w-[400px] h-[400px] bg-[rgba(99,102,241,0.15)] -top-[100px] -left-[100px] animate-float" />
      <div class="fixed rounded-full pointer-events-none blur-[80px] w-[350px] h-[350px] bg-[rgba(168,85,247,0.12)] -bottom-[80px] -right-[80px] animate-float [animation-delay:2s] [animation-duration:10s]" />
      <div class="fixed rounded-full pointer-events-none blur-[80px] w-[250px] h-[250px] bg-[rgba(129,140,248,0.1)] top-[30%] right-[10%] animate-float [animation-delay:4s] [animation-duration:12s]" />

      <div class="max-w-[560px] w-full text-center animate-fade-in relative z-[1]">
        {/* Hero */}
        <div class="mb-10">
          <div class="flex items-center justify-center gap-3 mb-3">
            <img src="/logo.svg" alt="OpenSpatial" class="w-14 h-14" />
            <h1 class="text-4xl font-extrabold bg-[linear-gradient(135deg,#6366f1_0%,#8b5cf6_50%,#a855f7_100%)] bg-clip-text text-transparent">OpenSpatial</h1>
          </div>
          <p class="text-xl font-semibold text-[#1e1b4b] mb-2">A virtual space where distance disappears</p>
          <p class="text-base text-[#6b7280] leading-relaxed">
            Spatial audio and a shared infinite canvas for teams, friends, or communities.
          </p>
        </div>

        {/* Features */}
        <div class="flex flex-col gap-3.5 mb-10">
          {features.map((f) => (
            <div class="flex items-start gap-4 p-5 bg-white/65 backdrop-blur-[12px] border border-white/80 rounded-2xl shadow-[0_2px_12px_rgba(99,102,241,0.06)] text-left transition-all duration-(--transition-fast) hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(99,102,241,0.12)]">
              <div class="text-accent pt-0.5">{f.icon}</div>
              <div>
                <div class="text-base font-bold text-[#1e1b4b] mb-1">{f.title}</div>
                <div class="text-sm text-[#6b7280] leading-normal">{f.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Space Entry */}
        <div class="mb-6">
          <form id="landing-space-form" class="flex gap-3 max-w-[480px] mx-auto max-[480px]:flex-col" onSubmit={handleSubmit}>
            <input
              type="text"
              id="landing-space-input"
              placeholder="demo"
              autocomplete="off"
              class="flex-[2] min-w-[180px] py-3.5 px-4 bg-white/70 backdrop-blur-[8px] border border-[rgba(99,102,241,0.2)] rounded-xl text-[#1e1b4b] text-base font-[inherit] transition-all duration-(--transition-fast) placeholder:text-[#a5b4fc] focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] max-[480px]:min-w-0"
            />
            <button type="submit" class="btn-primary inline-flex items-center justify-center gap-2 py-3.5 px-6 font-[inherit] text-base font-semibold border-none rounded-xl cursor-pointer bg-[linear-gradient(135deg,#6366f1_0%,#8b5cf6_50%,#a855f7_100%)] text-white whitespace-nowrap shadow-[0_4px_14px_rgba(99,102,241,0.3)] transition-all duration-(--transition-fast) hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(99,102,241,0.4)] active:translate-y-0">
              <span>Enter Space</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>
          <p class="mt-2 text-xs text-[#9ca3af]">Leave empty for demo space</p>
        </div>

        {/* Links */}
        <div class="mb-4">
          <a href="https://github.com/srid/openspatial" target="_blank" class="inline-flex items-center gap-2 text-[#6b7280] text-sm no-underline transition-colors duration-(--transition-fast) hover:text-[#1e1b4b]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span>View on GitHub</span>
          </a>
        </div>

        {/* Footer */}
        <p class="text-sm text-[#9ca3af]">Open source · Self-hostable · WebRTC-powered</p>
      </div>
    </div>
  );
};
