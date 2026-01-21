/**
 * SVG Icon components for Solid.js UI.
 * Library-less icons as functional TSX components.
 */

import type { Component, JSX } from 'solid-js';

interface IconProps {
  size?: number;
  class?: string;
}

type IconComponent = Component<IconProps>;

const defaultProps = { size: 24 };

// ==================== Feature Icons ====================

export const UsersIcon: IconComponent = (props) => (
  <svg width={props.size ?? defaultProps.size} height={props.size ?? defaultProps.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={props.class}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const VideoIcon: IconComponent = (props) => (
  <svg width={props.size ?? defaultProps.size} height={props.size ?? defaultProps.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={props.class}>
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

export const VideoOffIcon: IconComponent = (props) => (
  <svg width={props.size ?? defaultProps.size} height={props.size ?? defaultProps.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={props.class}>
    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export const ScreenIcon: IconComponent = (props) => (
  <svg width={props.size ?? defaultProps.size} height={props.size ?? defaultProps.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={props.class}>
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

export const PenIcon: IconComponent = (props) => (
  <svg width={props.size ?? defaultProps.size} height={props.size ?? defaultProps.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={props.class}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

export const ArrowRightIcon: IconComponent = (props) => (
  <svg width={props.size ?? defaultProps.size} height={props.size ?? defaultProps.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={props.class}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export const ArrowLeftIcon: IconComponent = (props) => (
  <svg width={props.size ?? defaultProps.size} height={props.size ?? defaultProps.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={props.class}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

export const GitHubIcon: IconComponent = (props) => (
  <svg width={props.size ?? defaultProps.size} height={props.size ?? defaultProps.size} viewBox="0 0 24 24" fill="currentColor" class={props.class}>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

export const HomeIcon: IconComponent = (props) => (
  <svg width={props.size ?? defaultProps.size} height={props.size ?? defaultProps.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={props.class}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

export const SpinnerIcon: IconComponent = (props) => (
  <svg width={props.size ?? defaultProps.size} height={props.size ?? defaultProps.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={`spin ${props.class ?? ''}`}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

// ==================== Control Bar Icons ====================

export const MicIcon: IconComponent = (props) => (
  <svg width={props.size ?? defaultProps.size} height={props.size ?? defaultProps.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={props.class}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

export const MicOffIcon: IconComponent = (props) => (
  <svg width={props.size ?? defaultProps.size} height={props.size ?? defaultProps.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={props.class}>
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .74-.11 1.46-.32 2.14" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

export const LogOutIcon: IconComponent = (props) => (
  <svg width={props.size ?? defaultProps.size} height={props.size ?? defaultProps.size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class={props.class}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
