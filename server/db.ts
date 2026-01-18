/**
 * SQLite database operations using Kysely.
 * Provides type-safe queries and embedded migrations.
 */
import { Kysely, SqliteDialect, Migrator } from 'kysely';
import BetterSqlite3 from 'better-sqlite3';
import { join, dirname } from 'path';
import { mkdirSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import type { Database, Space, TextNoteState } from './database/types.js';

// Database path from environment or default
const DATA_DIR = process.env.DATA_DIR || './data';
const DB_PATH = join(DATA_DIR, 'openspatial.db');

// Ensure data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

// Create better-sqlite3 instance
const sqliteDb = new BetterSqlite3(DB_PATH);
sqliteDb.pragma('journal_mode = WAL');

// Create Kysely instance
export const db = new Kysely<Database>({
  dialect: new SqliteDialect({
    database: sqliteDb,
  }),
});

// Migration provider that loads migrations dynamically
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getMigrations(): Promise<Record<string, { up: (db: Kysely<unknown>) => Promise<void>; down: (db: Kysely<unknown>) => Promise<void> }>> {
  const migrationsDir = join(__dirname, 'migrations');
  const migrations: Record<string, { up: (db: Kysely<unknown>) => Promise<void>; down: (db: Kysely<unknown>) => Promise<void> }> = {};
  
  try {
    const files = readdirSync(migrationsDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    for (const file of files) {
      const name = file.replace(/\.(ts|js)$/, '');
      const migration = await import(join(migrationsDir, file));
      migrations[name] = migration;
    }
  } catch (e) {
    // Migrations directory might not exist in some environments
  }
  
  return migrations;
}

// Run migrations on startup
export async function runMigrations(): Promise<void> {
  const migrations = await getMigrations();
  
  const migrator = new Migrator({
    db,
    provider: {
      getMigrations: async () => migrations,
    },
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`[DB] Migration "${it.migrationName}" executed successfully`);
    } else if (it.status === 'Error') {
      console.error(`[DB] Migration "${it.migrationName}" failed`);
    }
  });

  if (error) {
    console.error('[DB] Migration failed:', error);
    throw error;
  }
}

// === Space Operations ===

export async function getAllSpaces(): Promise<Space[]> {
  const rows = await db
    .selectFrom('spaces')
    .select(['id', 'created_at'])
    .orderBy('id')
    .execute();
  return rows;
}

export async function getSpace(id: string): Promise<Space | null> {
  const row = await db
    .selectFrom('spaces')
    .select(['id', 'created_at'])
    .where('id', '=', id)
    .executeTakeFirst();
  return row ?? null;
}

export async function createSpace(id: string): Promise<void> {
  await db
    .insertInto('spaces')
    .values({ id })
    .execute();
}

export async function deleteSpace(id: string): Promise<void> {
  await db
    .deleteFrom('spaces')
    .where('id', '=', id)
    .execute();
}

// === Text Note Operations ===

export async function getTextNotes(spaceId: string): Promise<(TextNoteState & { id: string })[]> {
  const rows = await db
    .selectFrom('text_elements')
    .select(['id', 'content', 'x', 'y', 'width', 'height', 'fontSize', 'fontFamily', 'color'])
    .where('spaceId', '=', spaceId)
    .execute();
  return rows as (TextNoteState & { id: string })[];
}

export async function upsertTextNote(spaceId: string, id: string, note: TextNoteState): Promise<void> {
  await db
    .insertInto('text_elements')
    .values({
      id,
      spaceId,
      content: note.content,
      x: note.x,
      y: note.y,
      width: note.width,
      height: note.height,
      fontSize: note.fontSize,
      fontFamily: note.fontFamily,
      color: note.color,
    })
    .onConflict((oc) =>
      oc.column('id').doUpdateSet({
        content: note.content,
        x: note.x,
        y: note.y,
        width: note.width,
        height: note.height,
        fontSize: note.fontSize,
        fontFamily: note.fontFamily,
        color: note.color,
      })
    )
    .execute();
}

export async function deleteTextNote(id: string): Promise<void> {
  await db
    .deleteFrom('text_elements')
    .where('id', '=', id)
    .execute();
}

/**
 * Clear all text notes from all spaces (dev mode only).
 * This ensures clean E2E test runs since notes now persist correctly.
 */
export async function clearAllTextNotes(): Promise<void> {
  const result = await db
    .deleteFrom('text_elements')
    .executeTakeFirst();
  if (result.numDeletedRows > 0n) {
    console.log(`[DB] Cleared ${result.numDeletedRows} text notes from all spaces`);
  }
}

export async function ensureDemoSpace(): Promise<void> {
  const demoSpace = await getSpace('demo');
  if (!demoSpace) {
    await createSpace('demo');
    console.log('[DB] Created default "demo" space');
  }
  // In dev mode (AUTO_CREATE_SPACES=true), clear all notes for clean E2E tests
  if (process.env.AUTO_CREATE_SPACES === 'true') {
    await clearAllTextNotes();
  }
}
