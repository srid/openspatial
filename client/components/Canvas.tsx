/**
 * Canvas Component
 * Renders all participants, screen shares, and notes from store.
 * Handles pan/zoom. Pure render - no DOM manipulation.
 */
import { type JSX, For, createSignal, onMount, onCleanup } from 'solid-js';
import { Avatar } from './Avatar';
import { 
  spaceState, 
  participantList,
  updateParticipantPosition,
} from '../store/space';
import { broadcastPosition, broadcastStatus } from '../store/crdt-bridge';

interface CanvasProps {
  width?: number;
  height?: number;
}

export function Canvas(props: CanvasProps): JSX.Element {
  const canvasWidth = props.width ?? 4000;
  const canvasHeight = props.height ?? 4000;
  
  let containerRef: HTMLDivElement | undefined;
  
  const [scale, setScale] = createSignal(1);
  const [offset, setOffset] = createSignal({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = createSignal(false);

  // Center on initial load
  onMount(() => {
    if (containerRef) {
      const rect = containerRef.getBoundingClientRect();
      setOffset({
        x: rect.width / 2 - canvasWidth / 2,
        y: rect.height / 2 - canvasHeight / 2,
      });
    }
  });

  // Handle wheel zoom
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.25, Math.min(2, scale() * delta));
    setScale(newScale);
  };

  // Handle pan
  const handleMouseDown = (e: MouseEvent) => {
    // Only pan with middle mouse button or when not clicking on an avatar
    if (e.button === 1 || (e.target === containerRef || e.target === containerRef?.firstElementChild)) {
      e.preventDefault();
      setIsPanning(true);
      
      const startX = e.clientX - offset().x;
      const startY = e.clientY - offset().y;
      
      const handleMouseMove = (e: MouseEvent) => {
        setOffset({
          x: e.clientX - startX,
          y: e.clientY - startY,
        });
      };
      
      const handleMouseUp = () => {
        setIsPanning(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
  };

  // Handle avatar drag
  const handleAvatarDrag = (id: string, x: number, y: number) => {
    updateParticipantPosition(id, x, y);
  };

  // Handle status change
  const handleStatusChange = (status: string) => {
    broadcastStatus(status);
  };

  // Center on a specific position
  const centerOn = (x: number, y: number) => {
    if (containerRef) {
      const rect = containerRef.getBoundingClientRect();
      setOffset({
        x: rect.width / 2 - x * scale(),
        y: rect.height / 2 - y * scale(),
      });
    }
  };

  return (
    <div
      ref={containerRef}
      id="canvas-container"
      class="canvas-container"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      style={{ cursor: isPanning() ? 'grabbing' : 'default' }}
    >
      <div
        id="space"
        class="space"
        style={{
          width: `${canvasWidth}px`,
          height: `${canvasHeight}px`,
          transform: `translate(${offset().x}px, ${offset().y}px) scale(${scale()})`,
          'transform-origin': '0 0',
        }}
      >
        {/* Render all participants */}
        <For each={participantList()}>
          {(participant) => (
            <Avatar
              participant={participant}
              onDrag={handleAvatarDrag}
              onStatusChange={handleStatusChange}
            />
          )}
        </For>

        {/* TODO: Render screen shares */}
        {/* <For each={Object.values(spaceState.screenShares)}>
          {(share) => <ScreenShare share={share} />}
        </For> */}

        {/* TODO: Render text notes */}
        {/* <For each={Object.values(spaceState.textNotes)}>
          {(note) => <TextNote note={note} />}
        </For> */}
      </div>
    </div>
  );
}
