/**
 * Join modal component — shown at /s/:spaceId before joining
 */

import { Component, Show } from 'solid-js';
import { ui, spaceInfo, user } from '../stores/app';
import { HomeIcon, ArrowRightIcon, SpinnerIcon } from './Icons';

interface JoinModalProps {
  onJoin: (username: string) => void;
}

export const JoinModal: Component<JoinModalProps> = (props) => {
  let usernameRef: HTMLInputElement | undefined;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const username = usernameRef?.value.trim();
    if (username) {
      props.onJoin(username);
    }
  };

  return (
    <div id="join-modal" class="modal">
      <div class="modal-content">
        <div class="modal-header">
          <div class="logo">
            <img src="/client/assets/logo.svg" alt="OpenSpatial" class="logo-icon" />
            <h1>OpenSpatial</h1>
          </div>
          <p class="tagline">A virtual space where distance disappears</p>
        </div>

        {/* Space Info */}
        <div id="space-info-preview" class="space-info-preview">
          <div class="space-name-display">
            <HomeIcon size={16} />
            <span id="space-name-label">{spaceInfo.name() || 'Loading...'}</span>
          </div>
          <div id="space-participants" class="space-participants">
            <Show
              when={spaceInfo.participants().length > 0}
              fallback={
                <>
                  <SpinnerIcon size={14} />
                  <span>Checking who's here...</span>
                </>
              }
            >
              <span>
                {spaceInfo.participants().length === 0
                  ? 'No one here yet'
                  : `${spaceInfo.participants().join(', ')} here`}
              </span>
            </Show>
          </div>
        </div>

        {/* Error Message */}
        <Show when={ui.joinError()}>
          <div id="join-error" class="join-error">
            {ui.joinError()}
          </div>
        </Show>

        <form id="join-form" onSubmit={handleSubmit}>
          <input type="hidden" id="space-id" value={user.spaceId()} />
          <div class="form-group">
            <label for="username">Your Name</label>
            <input
              ref={usernameRef}
              type="text"
              id="username"
              placeholder="Enter your name"
              value={user.username()}
              required
              autocomplete="off"
            />
          </div>
          <button type="submit" class="btn btn-primary">
            <span>Join Space</span>
            <ArrowRightIcon size={20} />
          </button>
        </form>
        <a href="/" class="back-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Back to home</span>
        </a>
      </div>
    </div>
  );
};
