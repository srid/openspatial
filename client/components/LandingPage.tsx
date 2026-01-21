/**
 * LandingPage Component - Home page shown at /
 */
import { Component } from 'solid-js';
import { UsersIcon, VideoIcon, ScreenShareIcon, NoteIcon, ArrowRightIcon, GitHubIcon } from './Icons';

interface LandingPageProps {
  onEnterSpace: (spaceName: string) => void;
}

export const LandingPage: Component<LandingPageProps> = (props) => {
  let inputRef: HTMLInputElement | undefined;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const spaceName = inputRef?.value.trim() || 'demo';
    props.onEnterSpace(spaceName);
  };

  return (
    <div class="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 z-[1000] overflow-y-auto p-8">
      <div class="max-w-[600px] w-full text-center animate-fadeIn">
        {/* Hero Section */}
        <div class="mb-10">
          <div class="flex items-center justify-center gap-3 mb-2">
            <img src="/client/assets/logo.svg" alt="OpenSpatial" class="w-16 h-16 animate-float" />
            <h1 class="text-3xl font-bold bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 bg-clip-text text-transparent">
              OpenSpatial
            </h1>
          </div>
          <p class="text-xl font-semibold text-white mb-3">
            A virtual space where distance disappears
          </p>
          <p class="text-base text-white/70 leading-relaxed">
            Spatial audio and shared canvas for gatherings of any kind — teams, friends, or communities.
          </p>
        </div>

        {/* Features */}
        <div class="grid grid-cols-2 gap-4 mb-10 max-sm:grid-cols-1">
          <div class="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-lg transition-all duration-150 hover:bg-white/10 hover:border-indigo-500 hover:-translate-y-0.5">
            <UsersIcon class="text-indigo-500 flex-shrink-0" />
            <span class="font-medium text-white">Spatial Audio</span>
          </div>
          <div class="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-lg transition-all duration-150 hover:bg-white/10 hover:border-indigo-500 hover:-translate-y-0.5">
            <VideoIcon class="text-indigo-500 flex-shrink-0" />
            <span class="font-medium text-white">Video Avatars</span>
          </div>
          <div class="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-lg transition-all duration-150 hover:bg-white/10 hover:border-indigo-500 hover:-translate-y-0.5">
            <ScreenShareIcon class="text-indigo-500 flex-shrink-0" />
            <span class="font-medium text-white">Screen Sharing</span>
          </div>
          <div class="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-lg transition-all duration-150 hover:bg-white/10 hover:border-indigo-500 hover:-translate-y-0.5">
            <NoteIcon class="text-indigo-500 flex-shrink-0" />
            <span class="font-medium text-white">Shared Notes</span>
          </div>
        </div>

        {/* Space Entry */}
        <div class="mb-8">
          <form onSubmit={handleSubmit} class="flex gap-3 max-w-[480px] mx-auto">
            <input
              ref={inputRef}
              type="text"
              placeholder="demo"
              autocomplete="off"
              class="flex-[2] min-w-[200px] p-4 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 transition-all duration-150 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
            />
            <button
              type="submit"
              class="inline-flex items-center justify-center gap-2 px-6 py-4 font-semibold rounded-lg text-white bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500 shadow-md shadow-indigo-500/40 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg whitespace-nowrap"
            >
              <span>Enter Space</span>
              <ArrowRightIcon />
            </button>
          </form>
          <p class="mt-2 text-xs text-white/40">Leave empty for demo space</p>
        </div>

        {/* Links */}
        <div class="mb-6">
          <a
            href="https://github.com/srid/openspatial"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-2 text-white/40 text-sm hover:text-white transition-colors duration-150"
          >
            <GitHubIcon />
            <span>View on GitHub</span>
          </a>
        </div>

        {/* Footer */}
        <p class="text-sm text-white/40">Open source • Self-hostable • WebRTC-powered</p>
      </div>
    </div>
  );
};
