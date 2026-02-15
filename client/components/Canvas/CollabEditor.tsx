/**
 * CollabEditor
 * Collaborative text editor using CodeMirror 6 + y-codemirror.next.
 * Binds to a Y.Text instance for real-time collaborative editing with remote cursors.
 */
import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import { useSpace } from '@/context/SpaceContext';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { yCollab } from 'y-codemirror.next';
import * as Y from 'yjs';

// Random color palette for remote cursors
const CURSOR_COLORS = [
  { color: '#30bced', light: '#30bced33' },
  { color: '#6eeb83', light: '#6eeb8333' },
  { color: '#ffbc42', light: '#ffbc4233' },
  { color: '#ee6352', light: '#ee635233' },
  { color: '#9ac2c9', light: '#9ac2c933' },
  { color: '#8acb88', light: '#8acb8833' },
  { color: '#1be7ff', light: '#1be7ff33' },
];

interface CollabEditorProps {
  noteId: string;
  fontSize?: string;
  fontFamily?: string;
  color?: string;
}

export const CollabEditor: Component<CollabEditorProps> = (props) => {
  const ctx = useSpace();
  let containerRef: HTMLDivElement | undefined;
  let view: EditorView | undefined;

  onMount(() => {
    const doc = ctx.ydoc();
    const awareness = ctx.awareness();
    if (!doc || !awareness || !containerRef) return;

    const ytext = doc.getText('note:' + props.noteId);
    const undoManager = new Y.UndoManager(ytext);

    // Set awareness user info for remote cursor display
    const session = ctx.session();
    const username = session?.localUser.username ?? 'Anonymous';
    const userColor = CURSOR_COLORS[Math.abs(hashString(username)) % CURSOR_COLORS.length];
    awareness.setLocalStateField('user', {
      name: username,
      color: userColor.color,
      colorLight: userColor.light,
    });

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        EditorView.lineWrapping,
        yCollab(ytext, awareness, { undoManager }),
        // Minimal dark theme for sticky-note look
        EditorView.theme({
          '&': {
            backgroundColor: 'transparent',
            height: '100%',
          },
          '.cm-content': {
            caretColor: 'white',
            padding: '4px 0',
          },
          '.cm-cursor, .cm-dropCursor': {
            borderLeftColor: 'white',
          },
          '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
            backgroundColor: 'rgba(255, 255, 255, 0.15) !important',
          },
          '.cm-gutters': {
            display: 'none',
          },
          '.cm-scroller': {
            overflow: 'auto',
          },
          '&.cm-focused': {
            outline: 'none',
          },
          '.cm-activeLine': {
            backgroundColor: 'transparent',
          },
        }, { dark: true }),
      ],
    });

    view = new EditorView({ state, parent: containerRef });

    onCleanup(() => {
      view?.destroy();
      view = undefined;
    });
  });

  // Apply font styles reactively via CSS custom properties on the container
  createEffect(() => {
    if (!containerRef) return;
    const fontSize = props.fontSize || '18px';
    const fontFamily = props.fontFamily || "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
    const color = props.color || '#ffffff';

    containerRef.style.setProperty('--note-font-size', fontSize);
    containerRef.style.setProperty('--note-font-family', fontFamily);
    containerRef.style.setProperty('--note-color', color);
  });

  return (
    <div
      ref={containerRef}
      class="collab-editor"
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
};

/** Simple string hash for deterministic color selection */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return hash;
}
