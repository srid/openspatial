#!/usr/bin/env node
/**
 * OpenSpatial CLI - Space management commands.
 * Usage:
 *   openspatial-cli list                 # List all spaces
 *   openspatial-cli create <id> <name>   # Create a new space
 *   openspatial-cli delete <id>          # Delete a space
 */
import { getAllSpaces, getSpace, createSpace, deleteSpace } from './db.js';

function printUsage(): void {
  console.log(`
OpenSpatial CLI - Space Management

Usage:
  openspatial-cli list                 List all spaces
  openspatial-cli create <id> <name>   Create a new space
  openspatial-cli delete <id>          Delete a space

Examples:
  openspatial-cli create main "Main Office"
  openspatial-cli create team-alpha "Team Alpha Workspace"
  openspatial-cli delete main
`);
}

function listSpaces(): void {
  const spaces = getAllSpaces();
  if (spaces.length === 0) {
    console.log('No spaces found. Create one with: openspatial-cli create <id> <name>');
    return;
  }
  
  console.log('\nSpaces:\n');
  console.log('  ID                    NAME                           CREATED');
  console.log('  ─────────────────────────────────────────────────────────────');
  for (const space of spaces) {
    const id = space.id.padEnd(20);
    const name = space.name.padEnd(30);
    const created = new Date(space.created_at).toLocaleDateString();
    console.log(`  ${id}  ${name}  ${created}`);
  }
  console.log();
}

function handleCreate(id: string | undefined, name: string | undefined): void {
  if (!id || !name) {
    console.error('Error: Both <id> and <name> are required');
    console.error('Usage: openspatial-cli create <id> <name>');
    process.exit(1);
  }
  
  // Validate ID format (alphanumeric + hyphens, lowercase)
  if (!/^[a-z0-9-]+$/.test(id)) {
    console.error('Error: Space ID must be lowercase alphanumeric with hyphens only');
    process.exit(1);
  }
  
  if (getSpace(id)) {
    console.error(`Error: Space "${id}" already exists`);
    process.exit(1);
  }
  
  createSpace(id, name);
  console.log(`✓ Created space: ${id} ("${name}")`);
}

function handleDelete(id: string | undefined): void {
  if (!id) {
    console.error('Error: <id> is required');
    console.error('Usage: openspatial-cli delete <id>');
    process.exit(1);
  }
  
  if (!getSpace(id)) {
    console.error(`Error: Space "${id}" not found`);
    process.exit(1);
  }
  
  deleteSpace(id);
  console.log(`✓ Deleted space: ${id}`);
}

// Main
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'list':
    listSpaces();
    break;
  case 'create':
    handleCreate(args[1], args.slice(2).join(' ') || args[2]);
    break;
  case 'delete':
    handleDelete(args[1]);
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
