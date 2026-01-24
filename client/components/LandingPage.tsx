/**
 * Landing page component — shown at /
 */

import { Component } from 'solid-js';
import { UsersIcon, VideoIcon, ScreenIcon, PenIcon, ArrowRightIcon, GitHubIcon } from './Icons';

interface LandingPageProps {
  onEnterSpace: (spaceId: string) => void;
}

export const LandingPage: Component<LandingPageProps> = (props) => {
  let inputRef: HTMLInputElement | undefined;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const spaceId = inputRef?.value.trim() || 'demo';
    props.onEnterSpace(spaceId);
  };

  return (
    <div id="landing-page" class="landing-page">
      <div class="landing-content">
        {/* Hero Section */}
        <div class="landing-hero">
          <div class="logo">
            <img src="/client/assets/logo.svg" alt="OpenSpatial" class="logo-icon" />
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
            <UsersIcon size={24} />
            <span>Spatial Audio</span>
          </div>
          <div class="feature">
            <VideoIcon size={24} />
            <span>Video Avatars</span>
          </div>
          <div class="feature">
            <ScreenIcon size={24} />
            <span>Screen Sharing</span>
          </div>
          <div class="feature">
            <PenIcon size={24} />
            <span>Shared Notes</span>
          </div>
        </div>

        {/* Space Entry */}
        <div class="landing-space-entry">
          <form id="landing-space-form" class="landing-space-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              id="landing-space-input"
              placeholder="demo"
              autocomplete="off"
            />
            <button type="submit" class="btn btn-primary">
              <span>Enter Space</span>
              <ArrowRightIcon size={20} />
            </button>
          </form>
          <p class="landing-space-hint">Leave empty for demo space</p>
        </div>

        {/* Links */}
        <div class="landing-links">
          <a href="https://github.com/srid/openspatial" target="_blank" class="landing-link">
            <GitHubIcon size={18} />
            <span>View on GitHub</span>
          </a>
        </div>

        {/* Footer */}
        <p class="landing-footer">Open source • Self-hostable • WebRTC-powered</p>
      </div>
    </div>
  );
};
