import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('spaces')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('created_at', 'text', (col) =>
      col.defaultTo(sql`(datetime('now'))`).notNull()
    )
    .execute();

  await db.schema
    .createTable('text_elements')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('spaceId', 'text', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull()
    )
    .addColumn('content', 'text', (col) => col.defaultTo('').notNull())
    .addColumn('x', 'real', (col) => col.notNull())
    .addColumn('y', 'real', (col) => col.notNull())
    .addColumn('width', 'real', (col) => col.notNull())
    .addColumn('height', 'real', (col) => col.notNull())
    .addColumn('fontSize', 'text', (col) => col.defaultTo('medium').notNull())
    .addColumn('fontFamily', 'text', (col) => col.defaultTo('sans').notNull())
    .addColumn('color', 'text', (col) => col.defaultTo('#1a1a2e').notNull())
    .execute();

  await db.schema
    .createIndex('idx_text_elements_spaceId')
    .on('text_elements')
    .column('spaceId')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('text_elements').execute();
  await db.schema.dropTable('spaces').execute();
}
