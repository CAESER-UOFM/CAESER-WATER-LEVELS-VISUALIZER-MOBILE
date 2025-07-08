import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        environment: {
          hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
          hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
          tursoUrl: process.env.TURSO_DATABASE_URL ? 
            process.env.TURSO_DATABASE_URL.substring(0, 20) + '...' : 'undefined',
          allTursoVars: Object.keys(process.env).filter(k => k.startsWith('TURSO')),
          nodeVersion: process.version,
          platform: process.platform
        }
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};