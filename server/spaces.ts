/**
 * Space management - validation middleware and API helpers.
 */
import type { Request, Response, NextFunction } from 'express';
import { getAllSpaces as dbGetAllSpaces, getSpace as dbGetSpace } from './db.js';
import type { Space } from '../shared/yjs-schema.js';

/**
 * Get all spaces from the database
 */
export function getAllSpaces(): Space[] {
  return dbGetAllSpaces();
}

/**
 * Get a single space by ID
 */
export function getSpace(id: string): Space | null {
  return dbGetSpace(id);
}

/**
 * Express middleware to validate that a space exists.
 * Responds with 404 if the space is not found.
 */
export function validateSpace(req: Request, res: Response, next: NextFunction): void {
  const spaceId = req.params.spaceId;
  
  if (!spaceId) {
    res.status(400).send('Space ID required');
    return;
  }
  
  const space = dbGetSpace(spaceId);
  if (!space) {
    res.status(404).send(`Space "${spaceId}" not found`);
    return;
  }
  
  next();
}
