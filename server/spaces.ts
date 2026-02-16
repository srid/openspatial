/**
 * Space management - API helpers for querying spaces.
 */
import { getAllSpaces as dbGetAllSpaces, getSpace as dbGetSpace } from './db.js';
import type { Space } from '../shared/yjs-schema.js';

/**
 * Get all spaces from the database
 */
export async function getAllSpaces(): Promise<Space[]> {
  return await dbGetAllSpaces();
}

/**
 * Get a single space by ID
 */
export async function getSpace(id: string): Promise<Space | null> {
  return await dbGetSpace(id);
}

