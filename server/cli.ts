#!/usr/bin/env node
/**
 * OpenSpatial CLI - Space management commands.
 * Usage:
 *   openspatial-cli list                    # List all spaces
 *   openspatial-cli create <id> [id2...]    # Create one or more spaces
 *   openspatial-cli delete <id>             # Delete a space
 */
import { getAllSpaces, getSpace, createSpace, deleteSpace, runMigrations } from './db.js';

function printUsage(): void {
  console.log(`
OpenSpatial CLI - Space Management

Usage:
  openspatial-cli list                    List all spaces
  openspatial-cli create <id> [id2...]    Create one or more spaces
  openspatial-cli delete <id>             Delete a space

Examples:
  openspatial-cli create demo team-alpha team-beta
  openspatial-cli delete demo
`);
}

async function listSpaces(): Promise<void> {
  const spaces = await getAllSpaces();
  if (spaces.length === 0) {
    console.log('No spaces found. Create one with: openspatial-cli create <id>');
    return;
  }
  
  console.log('\nSpaces:\n');
  console.log('  ID                    CREATED');
  console.log('  ──────────────────────────────────');
  for (const space of spaces) {
    const id = space.id.padEnd(20);
    const created = new Date(space.created_at).toLocaleDateString();
    console.log(`  ${id}  ${created}`);
  }
  console.log();
}

async function handleCreate(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    console.error('Error: At least one <id> is required');
    console.error('Usage: openspatial-cli create <id> [id2...]');
    process.exit(1);
  }
  
  for (const id of ids) {
    // Validate ID format (alphanumeric + hyphens, lowercase)
    if (!/^[a-z0-9-]+$/.test(id)) {
      console.error(`Error: Space ID "${id}" must be lowercase alphanumeric with hyphens only`);
      process.exit(1);
    }
    
    if (await getSpace(id)) {
      console.log(`Space "${id}" already exists`);
    } else {
      await createSpace(id);
      console.log(`✓ Created space: ${id}`);
    }
  }
}

async function handleDelete(id: string | undefined): Promise<void> {
  if (!id) {
    console.error('Error: <id> is required');
    console.error('Usage: openspatial-cli delete <id>');
    process.exit(1);
  }
  
  if (!await getSpace(id)) {
    console.error(`Error: Space "${id}" not found`);
    process.exit(1);
  }
  
  await deleteSpace(id);
  console.log(`✓ Deleted space: ${id}`);
}

// Main
async function main(): Promise<void> {
  // Run migrations first
  await runMigrations();
  
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'list':
      await listSpaces();
      break;
    case 'create':
      await handleCreate(args.slice(1));
      break;
    case 'delete':
      await handleDelete(args[1]);
      break;
    case '--help':
    case '-h':
    case undefined:
      printUsage();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('CLI Error:', err);
  process.exit(1);
});
