/**
 * Database connections for serverless functions
 */

import { Database } from 'sql.js';

export interface DatabaseConnection {
  id: string;
  database: Database;
  metadata: {
    name: string;
    size: number;
    lastModified: Date;
    tables: string[];
  };
}

// In-memory database store (for serverless functions)
const databases = new Map<string, DatabaseConnection>();

export async function getDatabase(id: string): Promise<DatabaseConnection | null> {
  return databases.get(id) || null;
}

export async function addDatabase(id: string, database: Database, metadata: any): Promise<void> {
  databases.set(id, {
    id,
    database,
    metadata: {
      name: metadata.name || id,
      size: metadata.size || 0,
      lastModified: new Date(),
      tables: metadata.tables || []
    }
  });
}

export async function removeDatabase(id: string): Promise<void> {
  databases.delete(id);
}

export async function listDatabases(): Promise<string[]> {
  return Array.from(databases.keys());
}

export async function getDatabaseMetadata(id: string): Promise<any | null> {
  const connection = databases.get(id);
  return connection ? connection.metadata : null;
}