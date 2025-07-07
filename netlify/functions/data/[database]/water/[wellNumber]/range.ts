import { Handler } from '@netlify/functions';
import { getDatabase } from '@/lib/db/connections';

export const handler: Handler = async (event, context) => {
  const { database, wellNumber } = event.path.match(/\/data\/(?<database>[^/]+)\/water\/(?<wellNumber>[^/]+)\/range/)?.groups || {};

  if (!database || !wellNumber) {
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, error: 'Invalid request path' })
    };
  }

  try {
    const db = getDatabase(database);
    
    // Get the date range for this well
    const result = await db.query(`
      SELECT 
        MIN(timestamp_utc) as start_date,
        MAX(timestamp_utc) as end_date,
        COUNT(*) as total_readings
      FROM water_level_readings
      WHERE well_number = $1
    `, [wellNumber]);

    if (result.rows.length === 0 || !result.rows[0].start_date) {
      return {
        statusCode: 404,
        body: JSON.stringify({ 
          success: false, 
          error: 'No data found for this well' 
        })
      };
    }

    const { start_date, end_date, total_readings } = result.rows[0];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      },
      body: JSON.stringify({
        success: true,
        data: {
          wellNumber,
          startDate: start_date,
          endDate: end_date,
          totalReadings: parseInt(total_readings),
          spanDays: Math.ceil((new Date(end_date).getTime() - new Date(start_date).getTime()) / (1000 * 60 * 60 * 24))
        }
      })
    };

  } catch (error) {
    console.error('Error fetching data range:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch data range' 
      })
    };
  }
};