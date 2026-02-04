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
    <div id="landing-page" class="landing-page">
      <Show when={showBrowserWarning()}>
        <div class="browser-warning">
          <span>Warning: This application is tested on Chrome only. You may experience issues on other browsers.</span>
          <button class="browser-warning-close" onClick={() => setShowBrowserWarning(false)}>×</button>
        </div>
      </Show>
      <div class="landing-content">
        {/* Hero Section */}
        <div class="landing-hero">
          <div class="logo">
            <img src="/logo.svg" alt="OpenSpatial" class="logo-icon" />
            <h1>OpenSpatial</h1>
          </div>
          <p class="landing-tagline">A virtual space where distance disappears</p>
          <p class="landing-subtitle">
            Spatial audio and shared canvas for gatherings of any kind — teams, friends, or communities.
          </p>
        </div>

        {/* Features */}
        <div class="landing-features">
          <div class="feature">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Spatial Audio</span>
          </div>
          <div class="feature">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <span>Video Avatars</span>
          </div>
          <div class="feature">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>Screen Sharing</span>
          </div>
          <div class="feature">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            <span>Shared Notes</span>
          </div>
        </div>

        {/* Space Entry */}
        <div class="landing-space-entry">
          <form id="landing-space-form" class="landing-space-form" onSubmit={handleSubmit}>
            <input type="text" id="landing-space-input" placeholder="demo" autocomplete="off" />
            <button type="submit" class="btn btn-primary">
              <span>Enter Space</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>
          <p class="landing-space-hint">Leave empty for demo space</p>
        </div>

        {/* Links */}
        <div class="landing-links">
          <a href="https://github.com/srid/openspatial" target="_blank" class="landing-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span>View on GitHub</span>
          </a>
        </div>

        {/* Footer */}
        <p class="landing-footer">Open source • Self-hostable • WebRTC-powered</p>
      </div>
    </div>
  );
};
