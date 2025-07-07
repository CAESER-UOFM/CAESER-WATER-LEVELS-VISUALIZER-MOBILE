import { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      success: true,
      message: 'Water Level Visualizer API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }),
  };
};