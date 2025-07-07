import { Handler, HandlerEvent } from '@netlify/functions';
import { TursoService } from '../../src/lib/api/services/turso';
import { cacheService } from '../../src/lib/api/services/cache';
import { ApiResponse, DatabaseInfo } from '../../src/lib/api/api';

const tursoService = new TursoService();

export const handler: Handler = async (event: HandlerEvent) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Parse the path to determine action
  const path = event.path.replace('/.netlify/functions/databases', '');
  const pathParts = path.split('/').filter(p => p);

  try {
    // GET /databases - List all databases
    if (event.httpMethod === 'GET' && pathParts.length === 0) {
      return await listDatabases();
    }

    // GET /databases/:id - Get database info
    if (event.httpMethod === 'GET' && pathParts.length === 1) {
      const databaseId = pathParts[0];
      return await getDatabaseInfo(databaseId);
    }

    // POST /databases/:id/refresh - Refresh database cache
    if (event.httpMethod === 'POST' && pathParts.length === 2 && pathParts[1] === 'refresh') {
      const databaseId = pathParts[0];
      return await refreshDatabaseCache(databaseId);
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Not found'
      } as ApiResponse),
    };

  } catch (error) {
    console.error('Database function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      } as ApiResponse),
    };
  }
};

async function listDatabases() {
  // Check cache first
  const cachedDatabases = cacheService.getDatabaseList<DatabaseInfo[]>();
  if (cachedDatabases) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        data: cachedDatabases
      } as ApiResponse<DatabaseInfo[]>),
    };
  }

  // Since we're using a single Turso database, return static info
  const stats = await tursoService.getDatabaseStats();
  const wellFields = await tursoService.getWellFields();
  
  const databases: DatabaseInfo[] = [{
    id: 'caeser-water-monitoring',
    name: 'CAESER Water Monitoring Database',
    size: 0, // Size not applicable for Turso
    modified: new Date().toISOString(),
    wellsCount: stats.wellsCount,
    readingsCount: stats.readingsCount,
    lastUpdate: stats.lastUpdate,
    wellFields
  }];

  // Cache the result
  cacheService.setDatabaseList(databases);

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success: true,
      data: databases
    } as ApiResponse<DatabaseInfo[]>),
  };
}

async function getDatabaseInfo(id: string) {
  // Check cache first
  const cachedStats = cacheService.getDatabaseStats(id);
  if (cachedStats) {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        data: cachedStats
      } as ApiResponse),
    };
  }

  // Only support our single Turso database
  if (id !== 'caeser-water-monitoring') {
    return {
      statusCode: 404,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'Database not found'
      } as ApiResponse),
    };
  }

  // Get stats from Turso
  const stats = await tursoService.getDatabaseStats();
  const wellFields = await tursoService.getWellFields();
  
  const databaseInfo = {
    id: 'caeser-water-monitoring',
    name: 'CAESER Water Monitoring Database',
    size: 0, // Size not applicable for Turso
    modified: new Date().toISOString(),
    wellsCount: stats.wellsCount,
    readingsCount: stats.readingsCount,
    lastUpdate: stats.lastUpdate,
    wellFields
  };

  // Cache the stats
  cacheService.setDatabaseStats(id, databaseInfo);

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success: true,
      data: databaseInfo
    } as ApiResponse),
  };
}

async function refreshDatabaseCache(id: string) {
  // Clear cache for this database
  cacheService.clearDatabaseCache(id);
  
  // Clear database list cache to force refresh
  cacheService.del('databases:list');

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success: true,
      message: 'Database cache refreshed successfully'
    } as ApiResponse),
  };
}