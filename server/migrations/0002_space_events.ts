import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('space_events')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('space_id', 'text', (col) => col.notNull())
    .addColumn('event_type', 'text', (col) => col.notNull())
    .addColumn('username', 'text', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) =>
      col.defaultTo(sql`(datetime('now'))`).notNull()
    )
    .execute();

  await db.schema
    .createIndex('idx_space_events_space_time')
    .on('space_events')
    .columns(['space_id', 'created_at'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('space_events').execute();
}
