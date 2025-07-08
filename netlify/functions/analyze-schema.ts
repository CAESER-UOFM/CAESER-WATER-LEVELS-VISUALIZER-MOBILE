import { Handler } from '@netlify/functions';
import { multiTursoService } from '../../src/lib/api/services/multiTurso';

export const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { databaseId = 'megasite' } = event.queryStringParameters || {};
    
    console.log(`Analyzing schema for database: ${databaseId}`);
    
    // Get all tables
    const tablesQuery = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
    const tablesResult = await multiTursoService.execute(databaseId, tablesQuery);
    
    console.log('Tables found:', tablesResult.rows);
    
    const tables = tablesResult.rows.map(row => row[0]);
    const schema = {};
    
    // Get schema for each table
    for (const table of tables) {
      try {
        const schemaQuery = `PRAGMA table_info(${table})`;
        const schemaResult = await multiTursoService.execute(databaseId, schemaQuery);
        
        schema[table] = {
          columns: schemaResult.rows.map(row => ({
            name: row[1],
            type: row[2],
            notNull: row[3] === 1,
            defaultValue: row[4],
            primaryKey: row[5] === 1
          })),
          columnNames: schemaResult.rows.map(row => row[1])
        };
        
        // Get sample data for key tables
        if (['wells', 'water_level_readings', 'manual_level_readings', 'well_statistics'].includes(table)) {
          try {
            const sampleQuery = `SELECT * FROM ${table} LIMIT 3`;
            const sampleResult = await multiTursoService.execute(databaseId, sampleQuery);
            schema[table].sampleData = {
              columns: sampleResult.columns,
              rows: sampleResult.rows
            };
          } catch (sampleError) {
            schema[table].sampleError = sampleError.message;
          }
        }
        
      } catch (error) {
        schema[table] = { error: error.message };
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        databaseId,
        tables,
        schema,
        analysis: {
          hasWells: tables.includes('wells'),
          hasWaterLevelReadings: tables.includes('water_level_readings'),
          hasManualReadings: tables.includes('manual_level_readings'),
          hasWellStatistics: tables.includes('well_statistics'),
          expectedTables: ['wells', 'water_level_readings'],
          missingTables: ['wells', 'water_level_readings'].filter(t => !tables.includes(t))
        }
      }, null, 2)
    };

  } catch (error) {
    console.error('Schema analysis error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to analyze schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};