/**
 * Join Modal Component
 * Displays when a user navigates to /s/:spaceId
 */
import { createSignal, Show, For, type JSX, type Accessor } from 'solid-js';
import { HomeIcon, ArrowRightIcon, ArrowLeftIcon, SpinnerIcon } from './Icons';

export type ParticipantsState =
  | { type: 'loading' }
  | { type: 'empty' }
  | { type: 'loaded'; names: string[] };

interface JoinModalProps {
  spaceId: Accessor<string>;
  participants: Accessor<ParticipantsState>;
  error: Accessor<string | null>;
  onJoin: (username: string) => void;
  onBack: () => void;
  savedUsername?: string;
}

export function JoinModal(props: JoinModalProps): JSX.Element {
  const [username, setUsername] = createSignal(props.savedUsername ?? '');

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const name = username().trim();
    if (name) {
      props.onJoin(name);
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

        {/* Space Info Preview */}
        <div id="space-info-preview" class="space-info-preview">
          <div class="space-name-display">
            <HomeIcon />
            <span id="space-name-label">{props.spaceId()}</span>
          </div>
          <div
            id="space-participants"
            class="space-participants"
            classList={{
              loading: props.participants().type === 'loading',
              empty: props.participants().type === 'empty',
            }}
          >
            <Show when={props.participants().type === 'loading'}>
              <SpinnerIcon />
              <span>Checking who's here...</span>
            </Show>
            <Show when={props.participants().type === 'empty'}>
              <span>No one here yet — be the first!</span>
            </Show>
            <Show when={props.participants().type === 'loaded'}>
              {(() => {
                const state = props.participants();
                if (state.type !== 'loaded') return null;
                return (
                  <>
                    <span>{state.names.length} participant{state.names.length !== 1 ? 's' : ''}</span>
                    <div class="participant-list">
                      <For each={state.names}>
                        {(name) => <span class="participant-name">{name}</span>}
                      </For>
                    </div>
                  </>
                );
              })()}
            </Show>
          </div>
        </div>

        {/* Error Message */}
        <Show when={props.error()}>
          <div id="join-error" class="join-error">
            {props.error()}
          </div>
        </Show>

        <form id="join-form" onSubmit={handleSubmit}>
          <input type="hidden" id="space-id" value={props.spaceId()} />
          <div class="form-group">
            <label for="username">Your Name</label>
            <input
              type="text"
              id="username"
              placeholder="Enter your name"
              required
              autocomplete="off"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
            />
          </div>
          <button type="submit" class="btn btn-primary">
            <span>Join Space</span>
            <ArrowRightIcon />
          </button>
        </form>

        <a href="/" class="back-link" onClick={(e) => { e.preventDefault(); props.onBack(); }}>
          <ArrowLeftIcon />
          <span>Back to home</span>
        </a>
      </div>
    </div>
  );
}
