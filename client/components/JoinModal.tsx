/**
 * JoinModal Component - Shown when navigating to /s/:spaceId
 */
import { Component, Show, For, createSignal } from 'solid-js';
import { ArrowRightIcon, ArrowLeftIcon, HomeIcon, AlertIcon, SpinnerIcon } from './Icons';

interface JoinModalProps {
  spaceId: string;
  participants: string[];
  isLoadingParticipants: boolean;
  error: string | null;
  savedUsername: string;
  onJoin: (username: string) => void;
  onBack: () => void;
}

export const JoinModal: Component<JoinModalProps> = (props) => {
  const [username, setUsername] = createSignal(props.savedUsername);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const name = username().trim();
    if (name) {
      props.onJoin(name);
    }
  };

  const isDisabled = () => !!props.error;

  return (
    <div class="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-[1000] animate-fadeIn">
      <div class="bg-slate-900/80 border border-white/10 rounded-3xl p-10 w-full max-w-[420px] backdrop-blur-xl shadow-xl animate-slideUp">
        {/* Header */}
        <div class="text-center mb-8">
          <div class="flex items-center justify-center gap-3 mb-2">
            <img src="/client/assets/logo.svg" alt="OpenSpatial" class="w-12 h-12 animate-float" />
            <h1 class="text-3xl font-bold bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 bg-clip-text text-transparent">
              OpenSpatial
            </h1>
          </div>
          <p class="text-sm text-white/70">A virtual space where distance disappears</p>
        </div>

        {/* Space Info Preview */}
        <div class="mb-6 p-4 bg-white/5 border border-white/10 rounded-lg">
          <div class="flex items-center gap-2 text-lg font-semibold text-white mb-3">
            <HomeIcon />
            <span>{props.spaceId}</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-white/70">
            <Show when={props.isLoadingParticipants}>
              <SpinnerIcon />
              <span>Checking who's here...</span>
            </Show>
            <Show when={!props.isLoadingParticipants && !props.error}>
              <Show when={props.participants.length === 0}>
                <span>No one here yet — be the first!</span>
              </Show>
              <Show when={props.participants.length > 0}>
                <div class="flex flex-col gap-1">
                  <span>{props.participants.length === 1 ? 'Here now:' : `${props.participants.length} people here:`}</span>
                  <div class="flex flex-wrap gap-1 mt-1">
                    <For each={props.participants}>
                      {(name) => (
                        <span class="px-2 py-1 bg-indigo-500 rounded text-xs font-medium text-white">
                          {name}
                        </span>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </Show>
          </div>
        </div>

        {/* Error Message */}
        <Show when={props.error}>
          <div class="mb-4 p-3 px-4 bg-red-500/15 border border-red-500/50 rounded-md text-red-500 text-sm flex items-center gap-2">
            <AlertIcon />
            <span>{props.error}</span>
          </div>
        </Show>

        {/* Join Form */}
        <form onSubmit={handleSubmit}>
          <div class="mb-5">
            <label for="username" class="block text-sm font-medium text-white/70 mb-2">
              Your Name
            </label>
            <input
              type="text"
              id="username"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              placeholder="Enter your name"
              required
              autocomplete="off"
              class="w-full py-3 px-4 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 transition-all duration-150 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
          <button
            type="submit"
            disabled={isDisabled()}
            class="w-full inline-flex items-center justify-center gap-2 py-4 px-6 font-semibold rounded-lg text-white bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500 shadow-md shadow-indigo-500/40 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <span>Join Space</span>
            <ArrowRightIcon />
          </button>
        </form>

        {/* Back Link */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            props.onBack();
          }}
          class="flex items-center justify-center gap-2 mt-4 text-white/40 text-sm hover:text-white transition-colors duration-150"
        >
          <ArrowLeftIcon />
          <span>Back to home</span>
        </a>
      </div>
    </div>
  );
};
