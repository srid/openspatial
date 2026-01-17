/**
 * Space management - validation middleware and API helpers.
 */
import type { Request, Response, NextFunction } from 'express';
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

/**
 * Express middleware to validate that a space exists.
 * Responds with 404 if the space is not found.
 */
export async function validateSpace(req: Request, res: Response, next: NextFunction): Promise<void> {
  const spaceId = req.params.spaceId;
  
  if (!spaceId) {
    res.status(400).send('Space ID required');
    return;
  }
  
  const space = await dbGetSpace(spaceId);
  if (!space) {
    res.status(404).send(`Space "${spaceId}" not found`);
    return;
  }
  
  next();
}
