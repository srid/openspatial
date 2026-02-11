/**
 * Landing Page Component
 * Matches the existing HTML structure in index.html for E2E compatibility.
 */
import { Component, createSignal, Show, onMount } from 'solid-js';

export const Landing: Component = () => {
  const [showBrowserWarning, setShowBrowserWarning] = createSignal(false);
  
  onMount(() => {
    // Check if browser is Chrome
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
    <div id="landing-page" class="fixed inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,#1a1a2e_0%,#0a0a0f_70%)] bg-bg-primary z-[1000] overflow-y-auto p-8">
      <Show when={showBrowserWarning()}>
        <div class="browser-warning fixed top-0 left-0 right-0 bg-warning text-black text-center py-2 px-10 z-[9999] font-bold text-sm shadow-md flex items-center justify-center">
          <span>Warning: This application is tested on Chrome only. You may experience issues on other browsers.</span>
          <button class="browser-warning-close absolute right-4 top-1/2 -translate-y-1/2 bg-transparent border-none text-black text-xl leading-none cursor-pointer opacity-60 hover:opacity-100 transition-opacity duration-(--transition-fast)" onClick={() => setShowBrowserWarning(false)}>×</button>
        </div>
      </Show>
      <div class="max-w-[600px] w-full text-center animate-fade-in">
        {/* Hero Section */}
        <div class="mb-10">
          <div class="flex items-center justify-center gap-3 mb-4">
            <img src="/logo.svg" alt="OpenSpatial" class="w-16 h-16" />
            <h1 class="text-[2rem] font-bold bg-[linear-gradient(135deg,#6366f1_0%,#8b5cf6_50%,#a855f7_100%)] bg-clip-text text-transparent">OpenSpatial</h1>
          </div>
          <p class="text-xl font-semibold text-text-primary mb-3">A virtual space where distance disappears</p>
          <p class="text-base text-text-secondary leading-relaxed">
            Spatial audio and shared canvas for gatherings of any kind — teams, friends, or communities.
          </p>
        </div>

        {/* Features */}
        <div class="grid grid-cols-2 gap-4 mb-10 max-[480px]:grid-cols-1">
          <div class="flex items-center gap-3 p-4 bg-surface border border-border rounded-lg transition-all duration-(--transition-fast) hover:bg-surface-hover hover:border-accent hover:-translate-y-0.5">
            <svg class="text-accent shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span class="font-medium text-text-primary">Spatial Audio</span>
          </div>
          <div class="flex items-center gap-3 p-4 bg-surface border border-border rounded-lg transition-all duration-(--transition-fast) hover:bg-surface-hover hover:border-accent hover:-translate-y-0.5">
            <svg class="text-accent shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <span class="font-medium text-text-primary">Video Avatars</span>
          </div>
          <div class="flex items-center gap-3 p-4 bg-surface border border-border rounded-lg transition-all duration-(--transition-fast) hover:bg-surface-hover hover:border-accent hover:-translate-y-0.5">
            <svg class="text-accent shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span class="font-medium text-text-primary">Screen Sharing</span>
          </div>
          <div class="flex items-center gap-3 p-4 bg-surface border border-border rounded-lg transition-all duration-(--transition-fast) hover:bg-surface-hover hover:border-accent hover:-translate-y-0.5">
            <svg class="text-accent shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span class="font-medium text-text-primary">Shared Notes</span>
          </div>
        </div>

        {/* Space Entry */}
        <div class="mb-8">
          <form id="landing-space-form" class="flex gap-3 max-w-[480px] mx-auto" onSubmit={handleSubmit}>
            <input
              type="text"
              id="landing-space-input"
              placeholder="demo"
              autocomplete="off"
              class="flex-[2] min-w-[200px] p-4 bg-surface border border-border rounded-lg text-text-primary text-base font-[inherit] transition-all duration-(--transition-fast) placeholder:text-text-muted focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
            />
            <button type="submit" class="btn-primary inline-flex items-center justify-center gap-2 py-3 px-6 font-[inherit] text-base font-semibold border-none rounded-lg cursor-pointer transition-all duration-(--transition-fast) w-full p-4 bg-[linear-gradient(135deg,#6366f1_0%,#8b5cf6_50%,#a855f7_100%)] text-white shadow-[var(--shadow-md),0_0_20px_var(--color-accent-glow)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg),0_0_30px_var(--color-accent-glow)] active:translate-y-0 whitespace-nowrap">
              <span>Enter Space</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>
          <p class="mt-2 text-xs text-text-muted">Leave empty for demo space</p>
        </div>

        {/* Links */}
        <div class="mb-6">
          <a href="https://github.com/srid/openspatial" target="_blank" class="inline-flex items-center gap-2 text-text-muted text-sm no-underline transition-colors duration-(--transition-fast) hover:text-text-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span>View on GitHub</span>
          </a>
        </div>

        {/* Footer */}
        <p class="text-sm text-text-muted">Open source • Self-hostable • WebRTC-powered</p>
      </div>
    </div>
  );
};
