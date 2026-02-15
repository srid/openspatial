/**
 * Database schema types for Kysely.
 * Reuses shared types where possible.
 */
import { Generated, Selectable } from 'kysely';
import type { TextNoteState } from '../../shared/yjs-schema.js';

// Re-export shared types for DB consumers
export type { TextNoteState };

// Space table (id required, created_at has DB default)
export interface SpacesTable {
  id: string;
  created_at: Generated<string>;
}

// Text elements table — content is stored here for persistence,
// even though the CRDT uses Y.Text separately from TextNoteState metadata.
export interface TextElementsTable {
  id: string;
  spaceId: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: string;
  fontFamily: string;
  color: string;
}

// Space activity events
export type SpaceEventType = 'join_first' | 'join' | 'leave' | 'leave_last';

export interface SpaceEventsTable {
  id: Generated<number>;
  space_id: string;
  event_type: SpaceEventType;
  username: string;
  created_at: Generated<string>;
}


export interface Database {
  spaces: SpacesTable;
  text_elements: TextElementsTable;
  space_events: SpaceEventsTable;
}

export type Space = Selectable<SpacesTable>;
export type SpaceEvent = Selectable<SpaceEventsTable>;

