/**
 * Landing Page Component
 * Displays the home page with space entry form.
 */
import { createSignal, type JSX } from 'solid-js';
import { UsersIcon, VideoIcon, MonitorIcon, EditIcon, ArrowRightIcon, GitHubIcon } from './Icons';

interface LandingProps {
  onEnterSpace: (spaceId: string) => void;
}

export function Landing(props: LandingProps): JSX.Element {
  const [spaceInput, setSpaceInput] = createSignal('');

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const spaceId = spaceInput().trim() || 'demo';
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
            <UsersIcon />
            <span>Spatial Audio</span>
          </div>
          <div class="feature">
            <VideoIcon />
            <span>Video Avatars</span>
          </div>
          <div class="feature">
            <MonitorIcon />
            <span>Screen Sharing</span>
          </div>
          <div class="feature">
            <EditIcon />
            <span>Shared Notes</span>
          </div>
        </div>

        {/* Space Entry */}
        <div class="landing-space-entry">
          <form id="landing-space-form" class="landing-space-form" onSubmit={handleSubmit}>
            <input
              type="text"
              id="landing-space-input"
              placeholder="demo"
              autocomplete="off"
              value={spaceInput()}
              onInput={(e) => setSpaceInput(e.currentTarget.value)}
            />
            <button type="submit" class="btn btn-primary">
              <span>Enter Space</span>
              <ArrowRightIcon />
            </button>
          </form>
          <p class="landing-space-hint">Leave empty for demo space</p>
        </div>

        {/* Links */}
        <div class="landing-links">
          <a href="https://github.com/srid/openspatial" target="_blank" class="landing-link">
            <GitHubIcon />
            <span>View on GitHub</span>
          </a>
        </div>

        {/* Footer */}
        <p class="landing-footer">Open source • Self-hostable • WebRTC-powered</p>
      </div>
    </div>
  );
}
