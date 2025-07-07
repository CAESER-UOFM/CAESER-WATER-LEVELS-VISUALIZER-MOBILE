import { Handler } from '@netlify/functions';
import { TursoService } from '../../src/lib/api/services/turso';

interface WaterLevelStats {
  totalWells: number;
  totalReadings: number;
  overallStats: {
    minLevel: number;
    maxLevel: number;
    avgLevel: number;
    minDate: string;
    maxDate: string;
  };
  wellStats: Array<{
    wellNumber: string;
    caeNumber: string;
    aquifer: string;
    totalReadings: number;
    minLevel: number;
    maxLevel: number;
    avgLevel: number;
    trend: {
      slope: number;
      direction: 'rising' | 'falling' | 'stable';
      confidence: number;
    };
    seasonalPattern: {
      highestMonth: number;
      lowestMonth: number;
      seasonalVariation: number;
    };
    recentActivity: {
      lastReading: string;
      last30Days: number;
      last90Days: number;
    };
  }>;
  monthlyStats: Array<{
    month: number;
    monthName: string;
    avgLevel: number;
    readingCount: number;
  }>;
  yearlyStats: Array<{
    year: number;
    avgLevel: number;
    minLevel: number;
    maxLevel: number;
    readingCount: number;
    trend: number;
  }>;
}

export const handler: Handler = async (event, context) => {
  try {
    const { databaseId } = event.queryStringParameters || {};
    
    if (!databaseId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: 'Database ID is required'
        })
      };
    }

    const tursoService = new TursoService();

    // Get overall statistics
    const overallStatsQuery = `
      SELECT 
        COUNT(DISTINCT well_number) as total_wells,
        COUNT(*) as total_readings,
        MIN(water_level) as min_level,
        MAX(water_level) as max_level,
        AVG(water_level) as avg_level,
        MIN(reading_date) as min_date,
        MAX(reading_date) as max_date
      FROM water_level_readings 
      WHERE water_level IS NOT NULL
    `;
    
    const overallResult = await tursoService.executeQuery(overallStatsQuery);
    const overallData = overallResult.rows[0];

    // Get per-well statistics
    const wellStatsQuery = `
      SELECT 
        w.well_number,
        w.cae_number,
        w.aquifer,
        COUNT(wlr.water_level) as reading_count,
        MIN(wlr.water_level) as min_level,
        MAX(wlr.water_level) as max_level,
        AVG(wlr.water_level) as avg_level,
        MAX(wlr.reading_date) as last_reading
      FROM wells w
      LEFT JOIN water_level_readings wlr ON w.well_number = wlr.well_number
      WHERE wlr.water_level IS NOT NULL
      GROUP BY w.well_number, w.cae_number, w.aquifer
      HAVING COUNT(wlr.water_level) > 10
      ORDER BY reading_count DESC
    `;

    const wellStatsResult = await tursoService.executeQuery(wellStatsQuery);

    // Get monthly statistics
    const monthlyStatsQuery = `
      SELECT 
        CAST(strftime('%m', reading_date) AS INTEGER) as month,
        AVG(water_level) as avg_level,
        COUNT(*) as reading_count
      FROM water_level_readings
      WHERE water_level IS NOT NULL
      GROUP BY strftime('%m', reading_date)
      ORDER BY month
    `;

    const monthlyResult = await tursoService.executeQuery(monthlyStatsQuery);

    // Get yearly statistics
    const yearlyStatsQuery = `
      SELECT 
        CAST(strftime('%Y', reading_date) AS INTEGER) as year,
        AVG(water_level) as avg_level,
        MIN(water_level) as min_level,
        MAX(water_level) as max_level,
        COUNT(*) as reading_count
      FROM water_level_readings
      WHERE water_level IS NOT NULL
      GROUP BY strftime('%Y', reading_date)
      ORDER BY year
    `;

    const yearlyResult = await tursoService.executeQuery(yearlyStatsQuery);

    // Calculate trends for each well
    const wellStats = await Promise.all(wellStatsResult.rows.map(async (row: any) => {
      const wellData: any = {};
      wellStatsResult.columns.forEach((col, index) => {
        wellData[col] = row[index];
      });

      // Get trend data for this well
      const trendQuery = `
        SELECT 
          reading_date,
          water_level,
          julianday(reading_date) - julianday('2020-01-01') as days_since_start
        FROM water_level_readings 
        WHERE well_number = ? AND water_level IS NOT NULL
        ORDER BY reading_date
      `;

      const trendResult = await tursoService.executeQuery(trendQuery, [wellData.well_number]);
      
      // Calculate linear regression for trend
      let trend: { slope: number; direction: 'rising' | 'falling' | 'stable'; confidence: number } = { 
        slope: 0, 
        direction: 'stable', 
        confidence: 0 
      };
      
      if (trendResult.rows.length > 2) {
        const points = trendResult.rows.map((r: any) => ({
          x: Number(r[2]), // days_since_start
          y: Number(r[1])  // water_level
        }));

        // Simple linear regression
        const n = points.length;
        const sumX = points.reduce((sum, p) => sum + p.x, 0);
        const sumY = points.reduce((sum, p) => sum + p.y, 0);
        const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
        const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const confidence = Math.min(Math.abs(slope) * 1000, 1); // Rough confidence metric

        trend = {
          slope: slope,
          direction: slope > 0.001 ? 'rising' : slope < -0.001 ? 'falling' : 'stable',
          confidence: confidence
        };
      }

      // Get seasonal patterns
      const seasonalQuery = `
        SELECT 
          CAST(strftime('%m', reading_date) AS INTEGER) as month,
          AVG(water_level) as avg_level
        FROM water_level_readings 
        WHERE well_number = ? AND water_level IS NOT NULL
        GROUP BY strftime('%m', reading_date)
        ORDER BY avg_level DESC
      `;

      const seasonalResult = await tursoService.executeQuery(seasonalQuery, [wellData.well_number]);
      
      let seasonalPattern = { highestMonth: 1, lowestMonth: 1, seasonalVariation: 0 };
      if (seasonalResult.rows.length > 0) {
        const highest = seasonalResult.rows[0];
        const lowest = seasonalResult.rows[seasonalResult.rows.length - 1];
        seasonalPattern = {
          highestMonth: Number(highest[0]),
          lowestMonth: Number(lowest[0]),
          seasonalVariation: Number(highest[1]) - Number(lowest[1])
        };
      }

      // Get recent activity
      const recentQuery = `
        SELECT 
          COUNT(CASE WHEN julianday('now') - julianday(reading_date) <= 30 THEN 1 END) as last_30_days,
          COUNT(CASE WHEN julianday('now') - julianday(reading_date) <= 90 THEN 1 END) as last_90_days
        FROM water_level_readings 
        WHERE well_number = ? AND water_level IS NOT NULL
      `;

      const recentResult = await tursoService.executeQuery(recentQuery, [wellData.well_number]);
      const recentData = recentResult.rows[0];

      return {
        wellNumber: wellData.well_number,
        caeNumber: wellData.cae_number || '',
        aquifer: wellData.aquifer || 'Unknown',
        totalReadings: Number(wellData.reading_count),
        minLevel: Number(wellData.min_level),
        maxLevel: Number(wellData.max_level),
        avgLevel: Number(wellData.avg_level),
        trend,
        seasonalPattern,
        recentActivity: {
          lastReading: wellData.last_reading || '',
          last30Days: Number(recentData[0]),
          last90Days: Number(recentData[1])
        }
      };
    }));

    // Process monthly stats
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const monthlyStats = monthlyResult.rows.map((row: any) => ({
      month: Number(row[0]),
      monthName: monthNames[Number(row[0]) - 1],
      avgLevel: Number(row[1]),
      readingCount: Number(row[2])
    }));

    // Process yearly stats with trend calculation
    const yearlyStats = yearlyResult.rows.map((row: any, index: number) => {
      const currentYear = {
        year: Number(row[0]),
        avgLevel: Number(row[1]),
        minLevel: Number(row[2]),
        maxLevel: Number(row[3]),
        readingCount: Number(row[4]),
        trend: 0
      };

      // Calculate year-over-year trend
      if (index > 0) {
        const prevYear = Number(yearlyResult.rows[index - 1][1]);
        currentYear.trend = ((currentYear.avgLevel - prevYear) / prevYear) * 100;
      }

      return currentYear;
    });

    const statistics: WaterLevelStats = {
      totalWells: Number(overallData[0]),
      totalReadings: Number(overallData[1]),
      overallStats: {
        minLevel: Number(overallData[2]),
        maxLevel: Number(overallData[3]),
        avgLevel: Number(overallData[4]),
        minDate: overallData[5],
        maxDate: overallData[6]
      },
      wellStats: wellStats.slice(0, 20), // Top 20 wells by reading count
      monthlyStats,
      yearlyStats
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: statistics
      })
    };

  } catch (error) {
    console.error('Error generating statistics:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to generate statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};