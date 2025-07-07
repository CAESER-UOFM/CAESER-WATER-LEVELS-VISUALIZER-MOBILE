const { TursoService } = require('../../src/lib/api/services/turso.js');

exports.handler = async (event, context) => {
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
    
    // Query wells with location data and statistics
    const wellsQuery = `
      SELECT 
        w.well_number,
        w.cae_number,
        w.latitude,
        w.longitude,
        w.aquifer_type as aquifer,
        w.well_field,
        w.cluster,
        w.ground_elevation,
        w.well_depth,
        w.static_water_level,
        w.last_reading_date,
        w.total_readings,
        w.has_manual_readings,
        w.has_transducer_data,
        w.has_telemetry_data,
        w.notes
      FROM wells w
      WHERE w.latitude IS NOT NULL 
        AND w.longitude IS NOT NULL
        AND w.latitude != 0 
        AND w.longitude != 0
      ORDER BY w.well_number
    `;

    const result = await tursoService.execute(wellsQuery);
    
    // Process results to determine data status
    const wellsWithStatus = result.rows.map(row => {
      const well = {};
      result.columns.forEach((col, index) => {
        well[col] = row[index];
      });

      // Determine data status based on available data types
      let dataStatus = 'no_data';
      let hasData = false;

      if (well.has_transducer_data === 1 || well.has_transducer_data === true) {
        dataStatus = 'transducer';
        hasData = true;
      } else if (well.has_telemetry_data === 1 || well.has_telemetry_data === true) {
        dataStatus = 'telemetry';
        hasData = true;
      } else if (well.has_manual_readings === 1 || well.has_manual_readings === true) {
        dataStatus = 'manual';
        hasData = true;
      }

      // Determine overall status for marker color
      let status = 'no_data';
      if (hasData) {
        if (well.total_readings && well.total_readings > 0) {
          status = 'has_data';
        } else {
          status = 'limited_data';
        }
      }

      return {
        well_number: well.well_number,
        cae_number: well.cae_number || '',
        latitude: parseFloat(well.latitude),
        longitude: parseFloat(well.longitude),
        aquifer: well.aquifer || 'unknown',
        well_field: well.well_field || '',
        cluster: well.cluster || '',
        ground_elevation: well.ground_elevation,
        well_depth: well.well_depth,
        static_water_level: well.static_water_level,
        last_reading_date: well.last_reading_date,
        total_readings: well.total_readings || 0,
        data_status: dataStatus,
        status: status,
        has_manual_readings: well.has_manual_readings === 1 || well.has_manual_readings === true,
        has_transducer_data: well.has_transducer_data === 1 || well.has_transducer_data === true,
        has_telemetry_data: well.has_telemetry_data === 1 || well.has_telemetry_data === true,
        notes: well.notes || ''
      };
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: wellsWithStatus,
        count: wellsWithStatus.length
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
        details: error.message
      })
    };
  }
};