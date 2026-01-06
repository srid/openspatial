import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { SessionRecord } from '../shared/types/session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class SessionStorage {
  private static getFilePath(spaceId: string): string {
    // Sanitize spaceId to prevent directory traversal
    const safeSpaceId = spaceId.replace(/[^a-z0-9-_]/gi, '_');
    return path.join(DATA_DIR, `${safeSpaceId}.json`);
  }

  static async getSessions(spaceId: string): Promise<SessionRecord[]> {
    const filePath = this.getFilePath(spaceId);
    try {
      // Check if file exists asynchronously
      try {
        await fsPromises.access(filePath);
      } catch {
        return [];
      }

      const data = await fsPromises.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error(`Error reading sessions for space ${spaceId}`, e);
      return [];
    }
  }

  static async saveSession(session: SessionRecord): Promise<void> {
    try {
      const sessions = await this.getSessions(session.spaceId);
      sessions.push(session);
      // Optional: Limit history size if needed in future
      await fsPromises.writeFile(this.getFilePath(session.spaceId), JSON.stringify(sessions, null, 2));
    } catch (e) {
      console.error(`Error saving session for space ${session.spaceId}`, e);
    }
  }
}
