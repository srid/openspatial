/**
 * Database schema types for Kysely.
 * Reuses shared types where possible.
 */
import { Generated, Insertable, Selectable } from 'kysely';
import type { TextNoteState } from '../../shared/yjs-schema.js';

// Re-export shared types for DB consumers
export type { TextNoteState };

// Space table (id required, created_at has DB default)
export interface SpacesTable {
  id: string;
  created_at: Generated<string>;
}

// Use shared TextNoteState and add id + spaceId for DB
export interface TextElementsTable extends TextNoteState {
  id: string;
  spaceId: string;
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

// Type aliases for common operations
export type Space = Selectable<SpacesTable>;
export type NewSpace = Insertable<SpacesTable>;
export type SpaceEvent = Selectable<SpaceEventsTable>;
