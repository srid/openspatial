/**
 * Migration: Add live_messages table
 *
 * Persists active Slack notification state so that on server restart,
 * orphaned LIVE messages can be updated to ENDED.
 */
import { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('live_messages')
    .addColumn('space_id', 'text', (col) => col.primaryKey())
    .addColumn('message_id', 'text', (col) => col.notNull())
    .addColumn('username', 'text', (col) => col.notNull())
    .addColumn('join_url', 'text', (col) => col.notNull())
    .addColumn('started_at', 'integer', (col) => col.notNull())
    .addColumn('backend', 'text', (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('live_messages').execute();
}
