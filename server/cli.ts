#!/usr/bin/env node
/**
 * OpenSpatial CLI - Space management commands.
 * Usage:
 *   openspatial-cli list           # List all spaces
 *   openspatial-cli create <id>    # Create a new space
 *   openspatial-cli delete <id>    # Delete a space
 */
import { getAllSpaces, getSpace, createSpace, deleteSpace } from './db.js';

function printUsage(): void {
  console.log(`
OpenSpatial CLI - Space Management

Usage:
  openspatial-cli list           List all spaces
  openspatial-cli create <id>    Create a new space
  openspatial-cli delete <id>    Delete a space

Examples:
  openspatial-cli create main
  openspatial-cli create team-alpha
  openspatial-cli delete main
`);
}

function listSpaces(): void {
  const spaces = getAllSpaces();
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

function handleCreate(id: string | undefined): void {
  if (!id) {
    console.error('Error: <id> is required');
    console.error('Usage: openspatial-cli create <id>');
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
  
  createSpace(id);
  console.log(`✓ Created space: ${id}`);
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
    handleCreate(args[1]);
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
