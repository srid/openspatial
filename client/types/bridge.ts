/**
 * ModuleBridge interface - connects Solid.js UI to imperative modules.
 * Used by App.tsx and provided by main.tsx.
 */

export interface ModuleBridge {
  handleEnterSpace: (spaceId: string) => void;
  handleJoin: (username: string) => void;
  toggleMic: () => void;
  toggleCamera: () => void;
  shareScreen: () => void;
  addNote: () => void;
  leaveSpace: () => void;
}
