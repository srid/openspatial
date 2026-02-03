/**
 * SpaceInfo Component
 * Top-left badge showing space name and participant count.
 */
import type { JSX, Accessor } from 'solid-js';

interface SpaceInfoProps {
  spaceName: Accessor<string>;
  participantCount: Accessor<number>;
}

export function SpaceInfo(props: SpaceInfoProps): JSX.Element {
  return (
    <div id="space-info">
      <span id="space-name">{props.spaceName()}</span>
      <span id="participant-count">
        {props.participantCount()} participant{props.participantCount() !== 1 ? 's' : ''}
      </span>
    </div>
  );
}
