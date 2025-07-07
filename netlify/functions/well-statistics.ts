import { Handler } from '@netlify/functions';
import { TursoService } from '../../src/lib/api/services/turso';

let tursoService: TursoService;

try {
  tursoService = new TursoService();
} catch (initError) {
  console.error('Failed to initialize TursoService:', initError);
  tursoService = null as any;
}

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

  if (!tursoService) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Database service not available'
      })
    };
  }

  try {
    const { wellNumber } = event.queryStringParameters || {};
    
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

    console.log('Getting well statistics for:', wellNumber);
    const statsData = await tursoService.getWellStatistics(wellNumber);
    
    if (!statsData) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'No statistics found for this well'
        })
      };
    }

    console.log('Statistics data retrieved:', statsData);

    const statistics: WellStatistics = {
      wellNumber: statsData.well_number,
      totalReadings: statsData.total_readings,
      dataRange: {
        startDate: statsData.data_start_date,
        endDate: statsData.data_end_date,
        totalDays: statsData.total_days
      },
      levels: {
        min: statsData.min_water_level,
        max: statsData.max_water_level,
        average: statsData.avg_water_level,
        range: statsData.max_water_level - statsData.min_water_level,
        minDate: statsData.min_level_date,
        maxDate: statsData.max_level_date
      },
      trend: {
        direction: statsData.trend_direction as 'rising' | 'falling' | 'stable',
        slope: 0, // Not stored in current schema
        changePerYear: statsData.trend_change_per_year,
        confidence: 0 // Not stored in current schema
      },
      seasonal: {
        highestMonth: statsData.highest_month,
        lowestMonth: statsData.lowest_month,
        seasonalVariation: 0, // Not stored in current schema
        monthlyAverages: [] // Not stored in current schema
      },
      recent: {
        last30Days: statsData.readings_last_30_days,
        last90Days: 0, // Not stored in current schema
        lastReading: statsData.last_reading_date,
        recentTrend: 'stable' as const // Not stored in current schema
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