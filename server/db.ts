/**
 * SQLite database operations for persistent storage.
 * Stores spaces and text notes.
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';
import type { Space, TextNoteState } from '../shared/yjs-schema.js';

// Database path from environment or default
const DATA_DIR = process.env.DATA_DIR || './data';
const DB_PATH = join(DATA_DIR, 'openspatial.db');

// Ensure data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS text_elements (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    font_size TEXT NOT NULL DEFAULT 'medium',
    font_family TEXT NOT NULL DEFAULT 'sans',
    color TEXT NOT NULL DEFAULT '#1a1a2e',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (space_id) REFERENCES spaces(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_text_elements_space_id ON text_elements(space_id);
`);

// Auto-create 'tmp' space for development/testing if it doesn't exist
const tmpSpace = db.prepare('SELECT id FROM spaces WHERE id = ?').get('tmp');
if (!tmpSpace) {
  db.prepare('INSERT INTO spaces (id, name) VALUES (?, ?)').run('tmp', 'Temporary Space');
  console.log('[DB] Created default "tmp" space');
}

// In auto-create mode (dev/testing), clear all text notes on restart for clean test runs
if (process.env.AUTO_CREATE_SPACES === 'true') {
  const deleted = db.prepare('DELETE FROM text_elements').run();
  if (deleted.changes > 0) {
    console.log(`[DB] Cleared ${deleted.changes} text notes (dev mode clean start)`);
  }
}

// === Space Operations ===

export function getAllSpaces(): Space[] {
  const stmt = db.prepare('SELECT id, name, created_at FROM spaces ORDER BY name');
  return stmt.all() as Space[];
}

export function getSpace(id: string): Space | null {
  const stmt = db.prepare('SELECT id, name, created_at FROM spaces WHERE id = ?');
  return (stmt.get(id) as Space) || null;
}

export function createSpace(id: string, name: string): void {
  const stmt = db.prepare('INSERT INTO spaces (id, name) VALUES (?, ?)');
  stmt.run(id, name);
}

export function deleteSpace(id: string): void {
  const stmt = db.prepare('DELETE FROM spaces WHERE id = ?');
  stmt.run(id);
}

// === Text Note Operations ===

export interface TextNoteRow {
  id: string;
  space_id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  font_size: string;
  font_family: string;
  color: string;
  updated_at: string;
}

export function getTextNotes(spaceId: string): TextNoteRow[] {
  const stmt = db.prepare('SELECT * FROM text_elements WHERE space_id = ?');
  return stmt.all(spaceId) as TextNoteRow[];
}

export function upsertTextNote(spaceId: string, id: string, note: TextNoteState): void {
  const stmt = db.prepare(`
    INSERT INTO text_elements (id, space_id, content, x, y, width, height, font_size, font_family, color, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      x = excluded.x,
      y = excluded.y,
      width = excluded.width,
      height = excluded.height,
      font_size = excluded.font_size,
      font_family = excluded.font_family,
      color = excluded.color,
      updated_at = datetime('now')
  `);
  stmt.run(id, spaceId, note.content, note.x, note.y, note.width, note.height, note.fontSize, note.fontFamily, note.color);
}

export function deleteTextNote(id: string): void {
  const stmt = db.prepare('DELETE FROM text_elements WHERE id = ?');
  stmt.run(id);
}

// Convert DB row to TextNoteState (for hydration)
export function rowToTextNoteState(row: TextNoteRow): TextNoteState {
  return {
    content: row.content,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    fontSize: row.font_size as TextNoteState['fontSize'],
    fontFamily: row.font_family as TextNoteState['fontFamily'],
    color: row.color,
  };
}

export { db };
