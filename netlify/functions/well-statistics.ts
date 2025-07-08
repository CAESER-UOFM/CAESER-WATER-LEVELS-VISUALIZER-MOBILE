import { Handler } from '@netlify/functions';
import { multiTursoService } from '../../src/lib/api/services/multiTurso';

interface WellStatistics {
  wellNumber: string;
  totalReadings: number;
  dataRange: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  levels: {
    min: number;
    max: number;
    average: number;
    range: number;
    minDate: string;
    maxDate: string;
  };
  trend: {
    direction: 'rising' | 'falling' | 'stable';
    slope: number;
    changePerYear: number;
    confidence: number;
  };
  seasonal: {
    highestMonth: string;
    lowestMonth: string;
    seasonalVariation: number;
    monthlyAverages: Array<{
      month: string;
      average: number;
      readings: number;
    }>;
  };
  recent: {
    last30Days: number;
    last90Days: number;
    lastReading: string;
    recentTrend: 'rising' | 'falling' | 'stable';
  };
}

export const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const { wellNumber, databaseId = 'megasite' } = event.queryStringParameters || {};
    
    if (!wellNumber) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Well number is required'
        })
      };
    }

    console.log('Getting well statistics for:', wellNumber, 'from database:', databaseId);
    
    // Query the well_statistics table directly
    const query = `
      SELECT 
        well_number, num_points as total_readings, 
        min_timestamp as data_start_date, max_timestamp as data_end_date,
        last_update as last_reading_date
      FROM well_statistics 
      WHERE well_number = ?
    `;
    
    const result = await multiTursoService.execute(databaseId, query, [wellNumber]);
    
    let statsData: any = {};
    
    if (result.rows.length === 0) {
      // If no entry in well_statistics table, try to calculate basic stats from water_level_readings
      console.log(`No well_statistics entry for ${wellNumber}, calculating basic stats...`);
      
      // Try to get basic stats from water_level_readings first
      const basicStatsQuery = `
        SELECT 
          COUNT(*) as total_readings,
          MIN(timestamp_utc) as data_start_date,
          MAX(timestamp_utc) as data_end_date,
          MAX(timestamp_utc) as last_reading_date
        FROM water_level_readings 
        WHERE well_number = ?
      `;
      
      const basicResult = await multiTursoService.execute(databaseId, basicStatsQuery, [wellNumber]);
      
      if (basicResult.rows.length === 0 || parseInt(basicResult.rows[0][0]) === 0) {
        // Still no data found - well might not exist
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'No data found for this well'
          })
        };
      }
      
      // Build stats data from basic query
      basicResult.columns.forEach((col, index) => {
        statsData[col] = basicResult.rows[0][index];
      });
      statsData.well_number = wellNumber;
    } else {
      // Use data from well_statistics table
      const row = result.rows[0];
      result.columns.forEach((col, index) => {
        statsData[col] = row[index];
      });
    }

    console.log('Statistics data retrieved:', statsData);

    const statistics: WellStatistics = {
      wellNumber: statsData.well_number,
      totalReadings: parseInt(statsData.total_readings) || 0,
      dataRange: {
        startDate: statsData.data_start_date || '',
        endDate: statsData.data_end_date || '',
        totalDays: 0 // Calculate if needed
      },
      levels: {
        min: 0, // Not available in simple schema
        max: 0, // Not available in simple schema
        average: 0, // Not available in simple schema
        range: 0,
        minDate: '',
        maxDate: ''
      },
      trend: {
        direction: 'stable' as const,
        slope: 0,
        changePerYear: 0,
        confidence: 0
      },
      seasonal: {
        highestMonth: '',
        lowestMonth: '',
        seasonalVariation: 0,
        monthlyAverages: []
      },
      recent: {
        last30Days: 0,
        last90Days: 0,
        lastReading: statsData.last_reading_date || '',
        recentTrend: 'stable' as const
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: statistics
      })
    };

  } catch (error) {
    console.error('Error generating well statistics:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to generate well statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};