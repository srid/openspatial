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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS text_elements (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    x REAL NOT NULL,
    y REAL NOT NULL,
    width REAL NOT NULL,
    height REAL NOT NULL,
    fontSize TEXT NOT NULL DEFAULT 'medium',
    fontFamily TEXT NOT NULL DEFAULT 'sans',
    color TEXT NOT NULL DEFAULT '#1a1a2e',
    FOREIGN KEY (spaceId) REFERENCES spaces(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_text_elements_spaceId ON text_elements(spaceId);
`);

// Auto-create 'demo' space for development/testing if it doesn't exist
const demoSpace = db.prepare('SELECT id FROM spaces WHERE id = ?').get('demo');
if (!demoSpace) {
  db.prepare('INSERT INTO spaces (id) VALUES (?)').run('demo');
  console.log('[DB] Created default "demo" space');
} else if (process.env.AUTO_CREATE_SPACES === 'true') {
  // Only clear the demo space on restart for clean E2E runs (preserve other spaces)
  const deleted = db.prepare('DELETE FROM text_elements WHERE spaceId = ?').run('demo');
  if (deleted.changes > 0) {
    console.log(`[DB] Cleared ${deleted.changes} text notes from "demo" space`);
  }
}

// === Space Operations ===

export function getAllSpaces(): Space[] {
  const stmt = db.prepare('SELECT id, created_at FROM spaces ORDER BY id');
  return stmt.all() as Space[];
}

export function getSpace(id: string): Space | null {
  const stmt = db.prepare('SELECT id, created_at FROM spaces WHERE id = ?');
  return (stmt.get(id) as Space) || null;
}

export function createSpace(id: string): void {
  const stmt = db.prepare('INSERT INTO spaces (id) VALUES (?)');
  stmt.run(id);
}

export function deleteSpace(id: string): void {
  const stmt = db.prepare('DELETE FROM spaces WHERE id = ?');
  stmt.run(id);
}

// === Text Note Operations ===

export function getTextNotes(spaceId: string): (TextNoteState & { id: string })[] {
  const stmt = db.prepare('SELECT id, content, x, y, width, height, fontSize, fontFamily, color FROM text_elements WHERE spaceId = ?');
  return stmt.all(spaceId) as (TextNoteState & { id: string })[];
}

export function upsertTextNote(spaceId: string, id: string, note: TextNoteState): void {
  const stmt = db.prepare(`
    INSERT INTO text_elements (id, spaceId, content, x, y, width, height, fontSize, fontFamily, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      x = excluded.x,
      y = excluded.y,
      width = excluded.width,
      height = excluded.height,
      fontSize = excluded.fontSize,
      fontFamily = excluded.fontFamily,
      color = excluded.color
  `);
  stmt.run(id, spaceId, note.content, note.x, note.y, note.width, note.height, note.fontSize, note.fontFamily, note.color);
}

export function deleteTextNote(id: string): void {
  const stmt = db.prepare('DELETE FROM text_elements WHERE id = ?');
  stmt.run(id);
}

export { db };
