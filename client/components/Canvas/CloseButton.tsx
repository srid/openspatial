/**
 * CloseButton Component
 * Inline two-step delete confirmation: × → Cancel / Delete.
 * Reused by TextNote and ScreenShare.
 */
import { Component, Show, createSignal } from 'solid-js';

interface CloseButtonProps {
  /** CSS class for the initial × button (used by E2E selectors) */
  closeClass: string;
  /** CSS class for the confirm-delete button */
  confirmClass: string;
  /** CSS class for the cancel-delete button */
  cancelClass: string;
  /** Tooltip for the × button */
  title?: string;
  /** Called when deletion is confirmed */
  onConfirm: () => void;
}

export const CloseButton: Component<CloseButtonProps> = (props) => {
  const [confirming, setConfirming] = createSignal(false);

  return (
    <Show
      when={confirming()}
      fallback={
        <button
          class={`${props.closeClass} flex items-center justify-center w-6 h-6 bg-transparent border-none rounded-sm text-text-muted cursor-pointer transition-all duration-(--transition-fast) hover:bg-danger/20 hover:text-danger`}
          onClick={() => setConfirming(true)}
          title={props.title ?? 'Delete'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      }
    >
      <button
        class={`${props.cancelClass} flex items-center justify-center px-1.5 h-6 bg-transparent border border-border rounded-sm text-text-muted cursor-pointer text-xs transition-all duration-(--transition-fast) hover:bg-surface-hover hover:text-text-primary`}
        onClick={() => setConfirming(false)}
        title="Cancel"
      >
        Cancel
      </button>
      <button
        class={`${props.confirmClass} flex items-center justify-center px-1.5 h-6 bg-danger/20 border border-danger/40 rounded-sm text-danger cursor-pointer text-xs font-medium transition-all duration-(--transition-fast) hover:bg-danger/30`}
        onClick={() => props.onConfirm()}
        title="Confirm delete"
      >
        Delete
      </button>
    </Show>
  );
};
