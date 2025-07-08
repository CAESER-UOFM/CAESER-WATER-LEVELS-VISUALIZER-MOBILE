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

    console.log(`Getting well locations for database: ${databaseId}`);

    // Use the existing multiTursoService getWells method which is already working
    const wellsResponse = await multiTursoService.getWells(databaseId, {
      limit: 100 // Get all wells for location data
    });

    if (!wellsResponse.success) {
      throw new Error('Failed to get wells data');
    }

    console.log(`Got ${wellsResponse.data.length} wells from getWells`);

    // Transform wells data to location format, filtering only wells with coordinates
    const validWells = wellsResponse.data
      .filter(well => well.latitude !== 0 && well.longitude !== 0)
      .map(well => ({
        well_number: well.well_number,
        cae_number: well.cae_number || '',
        latitude: well.latitude,
        longitude: well.longitude,
        aquifer: well.aquifer_type || 'unknown',
        well_field: well.well_field || '',
        cluster: '',
        ground_elevation: undefined,
        well_depth: undefined,
        static_water_level: undefined,
        last_reading_date: undefined,
        total_readings: well.total_readings,
        data_status: well.has_transducer_data ? 'transducer' : 
                    well.has_manual_readings ? 'manual' : 'no_data' as 'transducer' | 'telemetry' | 'manual' | 'no_data',
        status: well.total_readings > 0 ? 'has_data' : 'no_data' as 'has_data' | 'limited_data' | 'no_data',
        has_manual_readings: well.has_manual_readings,
        has_transducer_data: well.has_transducer_data,
        has_telemetry_data: well.has_telemetry_data,
        notes: ''
      })) as WellLocation[];

    console.log(`Filtered to ${validWells.length} wells with valid coordinates`);

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