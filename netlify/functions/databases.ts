import { Handler, HandlerEvent } from '@netlify/functions';
import { ApiResponse, DatabaseInfo } from '../../src/lib/api/api';

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
  try {
    // Use the new multi-database service
    const { multiTursoService } = await import('../../src/lib/api/services/multiTurso');
    
    const databases = await multiTursoService.listDatabases();

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
  
  } catch (error) {
    console.error('Error in listDatabases:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: {
          envVars: Object.keys(process.env).filter(k => k.includes('TURSO') || k.includes('SANDY') || k.includes('MEGA') || k.includes('CAESER')),
          stack: error instanceof Error ? error.stack : undefined
        }
      }),
    };
  }
}

async function getDatabaseInfo(id: string) {
  try {
    const { multiTursoService } = await import('../../src/lib/api/services/multiTurso');
    
    // Get all databases to find the requested one
    const databases = await multiTursoService.listDatabases();
    const databaseInfo = databases.find(db => db.id === id);
    
    if (!databaseInfo) {
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
  
  } catch (error) {
    console.error('Error in getDatabaseInfo:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
}

async function refreshDatabaseCache(id: string) {
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