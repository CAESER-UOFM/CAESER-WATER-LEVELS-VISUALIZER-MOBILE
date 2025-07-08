import { Handler } from '@netlify/functions';
import { multiTursoService } from '../../src/lib/api/services/multiTurso';

interface WellLocation {
  well_number: string;
  cae_number: string;
  latitude: number;
  longitude: number;
  aquifer: string;
  well_field: string;
  cluster: string;
  ground_elevation?: number;
  well_depth?: number;
  static_water_level?: number;
  last_reading_date?: string;
  total_readings: number;
  data_status: 'transducer' | 'telemetry' | 'manual' | 'no_data';
  status: 'has_data' | 'limited_data' | 'no_data';
  has_manual_readings: boolean;
  has_transducer_data: boolean;
  has_telemetry_data: boolean;
  notes: string;
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

    // Query wells with location data (filter out wells without coordinates)
    const wellsQuery = `
      SELECT 
        well_number,
        cae_number,
        latitude,
        longitude,
        aquifer,
        well_field
      FROM wells
      WHERE latitude IS NOT NULL 
        AND longitude IS NOT NULL
        AND latitude != 0 
        AND longitude != 0
      ORDER BY well_number
    `;

    const result = await multiTursoService.execute(databaseId, wellsQuery);
    
    // Process results with basic reading counts
    const wellsWithStatus = await Promise.all(result.rows.map(async row => {
      const well: any = {};
      result.columns.forEach((col, index) => {
        well[col] = row[index];
      });

      const lat = parseFloat(well.latitude || '0');
      const lng = parseFloat(well.longitude || '0');
      
      // Skip wells with invalid coordinates
      if (lat === 0 || lng === 0) {
        return null;
      }

      // Get basic reading counts (simplified)
      let totalReadings = 0;
      let hasTransducer = false;
      let hasManual = false;
      let hasTelemetry = false;

      try {
        // Quick count queries - only query existing tables
        const [transducerResult, manualResult] = await Promise.all([
          multiTursoService.execute(databaseId, `SELECT COUNT(*) FROM water_level_readings WHERE well_number = ?`, [well.well_number]),
          multiTursoService.execute(databaseId, `SELECT COUNT(*) FROM manual_level_readings WHERE well_number = ?`, [well.well_number])
        ]);

        const transducerCount = Number(transducerResult.rows[0][0]);
        const manualCount = Number(manualResult.rows[0][0]);
        const telemetryCount = 0; // No telemetry table in current schema
        
        totalReadings = transducerCount + manualCount + telemetryCount;
        hasTransducer = transducerCount > 0;
        hasManual = manualCount > 0;
        hasTelemetry = telemetryCount > 0;
      } catch (error) {
        console.error(`Error getting counts for ${well.well_number}:`, error);
      }

      // Determine status
      let dataStatus: 'transducer' | 'telemetry' | 'manual' | 'no_data' = 'no_data';
      let status: 'has_data' | 'limited_data' | 'no_data' = 'no_data';

      if (hasTransducer) {
        dataStatus = 'transducer';
        status = 'has_data';
      } else if (hasTelemetry) {
        dataStatus = 'telemetry';
        status = 'has_data';
      } else if (hasManual) {
        dataStatus = 'manual';
        status = totalReadings > 5 ? 'has_data' : 'limited_data';
      }

      return {
        well_number: well.well_number,
        cae_number: well.cae_number || '',
        latitude: lat,
        longitude: lng,
        aquifer: well.aquifer || 'unknown',
        well_field: well.well_field || '',
        cluster: '',
        ground_elevation: undefined,
        well_depth: undefined,
        static_water_level: undefined,
        last_reading_date: undefined,
        total_readings: totalReadings,
        data_status: dataStatus,
        status: status,
        has_manual_readings: hasManual,
        has_transducer_data: hasTransducer,
        has_telemetry_data: hasTelemetry,
        notes: ''
      };
    }));

    // Filter out null results
    const validWells = wellsWithStatus.filter(w => w !== null) as WellLocation[];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: validWells,
        count: validWells.length
      })
    };

  } catch (error) {
    console.error('Error fetching well locations:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch well locations',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};