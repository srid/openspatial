/**
 * SpaceNotFound Component
 * Styled 404 page for non-existent spaces — matches the landing page aesthetic.
 */
import { Component } from 'solid-js';
import { getSpaceIdFromUrl } from '@/context/SpaceContext';

export const SpaceNotFound: Component = () => {
  const spaceId = getSpaceIdFromUrl() || 'unknown';

  return (
    <div id="space-not-found" class="fixed inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#f0f0ff_0%,#e8e0f0_40%,#ddeeff_100%)] z-[1000] overflow-y-auto p-8">
      {/* Decorative gradient orbs */}
      <div class="fixed rounded-full pointer-events-none blur-[80px] w-[400px] h-[400px] bg-[rgba(99,102,241,0.15)] -top-[100px] -left-[100px] animate-float" />
      <div class="fixed rounded-full pointer-events-none blur-[80px] w-[350px] h-[350px] bg-[rgba(168,85,247,0.12)] -bottom-[80px] -right-[80px] animate-float [animation-delay:2s] [animation-duration:10s]" />

      <div class="max-w-[480px] w-full text-center animate-fade-in relative z-[1]">
        {/* Logo + Heading */}
        <div class="mb-8">
          <div class="flex items-center justify-center gap-3 mb-4">
            <img src="/logo.svg" alt="OpenSpatial" class="w-14 h-14" />
            <h1 class="text-4xl font-extrabold bg-[linear-gradient(135deg,#6366f1_0%,#8b5cf6_50%,#a855f7_100%)] bg-clip-text text-transparent">OpenSpatial</h1>
          </div>
        </div>

        {/* Error Card */}
        <div class="p-8 bg-white/65 backdrop-blur-[12px] border border-white/80 rounded-2xl shadow-[0_2px_12px_rgba(99,102,241,0.06)] mb-8">
          {/* 404 Icon */}
          <div class="mb-4">
            <svg class="mx-auto text-[#6366f1] opacity-60" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
              <line x1="9" y1="9" x2="9.01" y2="9" stroke-width="3" stroke-linecap="round" />
              <line x1="15" y1="9" x2="15.01" y2="9" stroke-width="3" stroke-linecap="round" />
            </svg>
          </div>

          <h2 class="text-xl font-bold text-[#1e1b4b] mb-2">Space not found</h2>
          <p class="text-base text-[#6b7280] mb-4">
            The space <span class="font-semibold text-[#1e1b4b]">"{spaceId}"</span> doesn't exist.
          </p>
          <p class="text-sm text-[#9ca3af]">
            Contact your administrator to create this space.
          </p>
        </div>

        {/* Back to Home */}
        <a
          href="/"
          class="inline-flex items-center justify-center gap-2 py-3.5 px-6 font-semibold text-base border-none rounded-xl cursor-pointer bg-[linear-gradient(135deg,#6366f1_0%,#8b5cf6_50%,#a855f7_100%)] text-white shadow-[0_4px_14px_rgba(99,102,241,0.3)] transition-all duration-(--transition-fast) hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(99,102,241,0.4)] active:translate-y-0 no-underline"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Go Home</span>
        </a>
      </div>
    </div>
  );
};
