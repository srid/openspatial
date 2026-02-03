/**
 * Migration: Add notification_log table
 * 
 * Tracks when Slack (and other) notifications were sent per space.
 * This decouples notification cooldown from space event tracking.
 */
import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('notification_log')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('space_id', 'text', (col) => col.notNull())
    .addColumn('username', 'text', (col) => col.notNull())
    .addColumn('sent_at', 'text', (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
    .execute();
    
  await db.schema
    .createIndex('idx_notification_log_space')
    .on('notification_log')
    .columns(['space_id', 'sent_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('notification_log').execute();
}
