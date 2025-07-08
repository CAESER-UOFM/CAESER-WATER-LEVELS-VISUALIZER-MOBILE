import { Handler } from '@netlify/functions';
import { multiTursoService } from '../../src/lib/api/services/multiTurso';

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    // Test if megasite database is configured
    console.log('Testing megasite database...');
    
    // Try to list databases first
    const databases = await multiTursoService.listDatabases();
    console.log('Available databases:', databases.map(db => db.id));
    
    // Check if megasite exists
    const megasiteDb = databases.find(db => db.id === 'megasite');
    if (!megasiteDb) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Megasite database not found in configured databases',
          availableDatabases: databases.map(db => db.id),
          envVars: {
            MEGASITE_URL: !!process.env.MEGASITE_URL,
            MEGASITE_TOKEN: !!process.env.MEGASITE_TOKEN
          }
        }),
      };
    }
    
    // Try a simple query
    const wellsCount = await multiTursoService.testConnection('megasite');
    console.log('Megasite connection test:', wellsCount);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          databases: databases.map(db => ({ id: db.id, wellsCount: db.wellsCount })),
          megasiteConnection: wellsCount
        }
      }),
    };
  } catch (error) {
    console.error('Debug error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
    };
  }
};