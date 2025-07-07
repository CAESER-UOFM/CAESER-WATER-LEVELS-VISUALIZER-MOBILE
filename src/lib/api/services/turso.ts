import type { 
  Well, 
  WaterLevelReading, 
  RechargeResult,
  WellsQueryParams,
  DataQueryParams,
  PaginatedResponse 
} from '../api';

interface TursoResponse {
  results: Array<{
    type: string;
    response: {
      type: string;
      result: {
        cols: Array<{ name: string; decltype: string | null }>;
        rows: Array<Array<{ type: string; value: string }>>;
      };
    };
  }>;
}

export class TursoService {
  private databaseUrl: string;
  private authToken: string;

  constructor() {
    // Get environment variables from Netlify
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    // Remove debug logging

    if (!url || !authToken) {
      throw new Error('Missing Turso database credentials. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.');
    }

    this.databaseUrl = url;
    this.authToken = authToken;
  }

  private async execute(sql: string, args: any[] = []): Promise<{ columns: string[]; rows: any[] }> {
    // Convert Turso database URL to HTTP API URL  
    // From: libsql://caeser-water-monitoring-benjaled.aws-us-east-1.turso.io
    // To: https://caeser-water-monitoring-benjaled.aws-us-east-1.turso.io/v2/pipeline
    const apiUrl = this.databaseUrl.replace('libsql://', 'https://') + '/v2/pipeline';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          type: 'execute',
          stmt: {
            sql,
            args: args.length > 0 ? args.map(arg => {
              if (typeof arg === 'number') {
                return { type: 'integer', value: String(arg) };
              } else if (typeof arg === 'string') {
                return { type: 'text', value: arg };
              } else if (arg === null) {
                return { type: 'null' };
              } else {
                return { type: 'text', value: String(arg) };
              }
            }) : undefined
          }
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Turso API Error:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        apiUrl,
        sql
      });
      throw new Error(`Turso API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: TursoResponse = await response.json();
    
    if (!data.results || !data.results[0] || !data.results[0].response) {
      console.error('Unexpected Turso response:', data);
      throw new Error('Unexpected response from Turso API');
    }
    
    const result = data.results[0].response.result;
    
    // Convert Turso format to our expected format
    return {
      columns: result.cols.map(col => col.name),
      rows: result.rows.map(row => row.map(cell => cell.value))
    };
  }

  public async executeQuery(sql: string, args: any[] = []): Promise<{ columns: string[]; rows: any[] }> {
    return this.execute(sql, args);
  }

  private rowToObject(columns: string[], row: any[]): Record<string, any> {
    const obj: Record<string, any> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  }

  private getSamplingIntervalMinutes(samplingRate: string): number {
    const intervals: Record<string, number> = {
      '15min': 15,
      '30min': 30,
      '1hour': 60,
      '3hour': 180,
      '6hour': 360,
      '12hour': 720,
      '1day': 1440,
      'daily': 1440,  // Add mapping for 'daily' -> 1440 minutes (24 hours)
      '3day': 4320,
      '1week': 10080,
      '1month': 43200
    };
    return intervals[samplingRate] || 15; // Default to 15 minutes
  }

  async getWells(params: WellsQueryParams = {}): Promise<PaginatedResponse<Well>> {
    const {
      search = '',
      aquifer = '',
      dataType,
      page = 1,
      limit = 50,
      sortBy = 'well_number',
      sortOrder = 'asc'
    } = params;

    try {
      let whereConditions: string[] = [];
      let queryParams: any[] = [];

      // Build WHERE conditions - simplified
      if (search) {
        whereConditions.push(`(well_number LIKE ? OR cae_number LIKE ? OR well_field LIKE ?)`);
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
      }

      if (aquifer) {
        whereConditions.push(`aquifer = ?`);
        queryParams.push(aquifer);
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

      // Get total count - simplified
      const countQuery = `SELECT COUNT(*) as total FROM wells ${whereClause}`;
      const countResult = await this.execute(countQuery, queryParams);
      const total = Number(countResult.rows[0][0]);

      // Simplified query first - just get basic well info
      const offset = (page - 1) * limit;
      const dataQuery = `
        SELECT 
          well_number, cae_number, well_field, cluster,
          latitude, longitude, top_of_casing, aquifer
        FROM wells
        ${whereClause.replace(/w\./g, '').replace(/wlr\./g, '')}
        ${orderClause.replace(/w\./g, '')}
        LIMIT ? OFFSET ?
      `;

      const result = await this.execute(dataQuery, [...queryParams, limit, offset]);

      const wellPromises = result.rows.map(async row => {
        const obj = this.rowToObject(result.columns, row);
        const wellBase = this.mapRowToWell(obj);
        
        // Get reading counts for this well from different tables
        try {
          const transducerCountQuery = `SELECT COUNT(*) as count FROM water_level_readings WHERE well_number = ?`;
          const transducerResult = await this.execute(transducerCountQuery, [wellBase.well_number]);
          const transducerCount = Number(transducerResult.rows[0][0]);

          const manualCountQuery = `SELECT COUNT(*) as count FROM manual_level_readings WHERE well_number = ?`;
          const manualResult = await this.execute(manualCountQuery, [wellBase.well_number]);
          const manualCount = Number(manualResult.rows[0][0]);

          const telemetryCountQuery = `SELECT COUNT(*) as count FROM telemetry_level_readings WHERE well_number = ?`;
          const telemetryResult = await this.execute(telemetryCountQuery, [wellBase.well_number]);
          const telemetryCount = Number(telemetryResult.rows[0][0]);
          
          const wellWithCounts = {
            ...wellBase,
            total_readings: transducerCount + manualCount + telemetryCount,
            manual_readings_count: manualCount,
            has_manual_readings: manualCount > 0,
            has_transducer_data: transducerCount > 0,
            has_telemetry_data: telemetryCount > 0
          };

          // Apply dataType filter
          if (dataType) {
            if (dataType === 'transducer' && !wellWithCounts.has_transducer_data) {
              return null; // Filter out this well
            }
            if (dataType === 'telemetry' && !wellWithCounts.has_telemetry_data) {
              return null; // Filter out this well
            }
            if (dataType === 'manual' && !wellWithCounts.has_manual_readings) {
              return null; // Filter out this well
            }
          }

          return wellWithCounts;
        } catch (err) {
          // If count fails, return well with 0 readings
          const wellWithCounts = {
            ...wellBase,
            total_readings: 0,
            manual_readings_count: 0,
            has_manual_readings: false,
            has_transducer_data: false,
            has_telemetry_data: false
          };

          // Apply dataType filter for wells with no data
          if (dataType) {
            return null; // Filter out wells with no data when dataType is specified
          }

          return wellWithCounts;
        }
      });
      
      const allWells = await Promise.all(wellPromises);
      // Filter out null values (wells that didn't match dataType filter)
      const wells = allWells.filter(well => well !== null) as Well[];

      return {
        success: true,
        data: wells,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Failed to get wells:', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        params,
        databaseUrl: this.databaseUrl,
        hasAuthToken: !!this.authToken
      });
      throw new Error(`Failed to retrieve wells data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getWell(wellNumber: string): Promise<Well | null> {
    try {
      const query = `
        SELECT 
          well_number, cae_number, well_field, cluster,
          latitude, longitude, top_of_casing, aquifer
        FROM wells
        WHERE well_number = ?
      `;

      const result = await this.execute(query, [wellNumber]);

      if (result.rows.length === 0) {
        return null;
      }

      const obj = this.rowToObject(result.columns, result.rows[0]);
      const wellBase = this.mapRowToWell(obj);
      
      // Get reading counts for this well from different tables
      try {
        const transducerCountQuery = `SELECT COUNT(*) as count FROM water_level_readings WHERE well_number = ?`;
        const transducerResult = await this.execute(transducerCountQuery, [wellBase.well_number]);
        const transducerCount = Number(transducerResult.rows[0][0]);

        const manualCountQuery = `SELECT COUNT(*) as count FROM manual_level_readings WHERE well_number = ?`;
        const manualResult = await this.execute(manualCountQuery, [wellBase.well_number]);
        const manualCount = Number(manualResult.rows[0][0]);

        const telemetryCountQuery = `SELECT COUNT(*) as count FROM telemetry_level_readings WHERE well_number = ?`;
        const telemetryResult = await this.execute(telemetryCountQuery, [wellBase.well_number]);
        const telemetryCount = Number(telemetryResult.rows[0][0]);
        
        return {
          ...wellBase,
          total_readings: transducerCount + manualCount + telemetryCount,
          manual_readings_count: manualCount,
          has_manual_readings: manualCount > 0,
          has_transducer_data: transducerCount > 0,
          has_telemetry_data: telemetryCount > 0
        };
      } catch (err) {
        return {
          ...wellBase,
          total_readings: 0,
          manual_readings_count: 0,
          has_manual_readings: false,
          has_transducer_data: false,
          has_telemetry_data: false
        };
      }
    } catch (error) {
      console.error(`Failed to get well ${wellNumber}:`, error);
      throw new Error('Failed to retrieve well data');
    }
  }

  async getWaterLevelData(params: DataQueryParams): Promise<WaterLevelReading[]> {
    const {
      wellNumber,
      startDate,
      endDate,
      dataType = 'all',
      downsample = false,
      maxPoints = 2000,
      level,
      samplingRate
    } = params;

    // Determine sampling strategy
    let actualMaxPoints = maxPoints;
    let actualDownsample = downsample;
    let actualSamplingRate: string | undefined = samplingRate;
    
    // Adaptive sampling approach: use natural time intervals
    if (samplingRate) {
      // New approach: use specific sampling rates instead of arbitrary point counts
      actualDownsample = true;
      actualSamplingRate = samplingRate;
      console.log(`🎯 Using adaptive sampling: ${samplingRate}`);
    } else if (level) {
      // Legacy approach: fixed points (fallback)
      actualMaxPoints = 4500; // Slightly reduced for better performance
      actualDownsample = true;
      console.log(`📊 Using legacy level-based sampling: level ${level} (${actualMaxPoints} points)`);
    }

    try {
      let allReadings: WaterLevelReading[] = [];

      // Query transducer data if needed
      if (dataType === 'all' || dataType === 'transducer') {
        const transducerReadings = await this.getTransducerData(wellNumber, startDate, endDate, actualDownsample, actualMaxPoints, actualSamplingRate);
        allReadings = allReadings.concat(transducerReadings);
      }

      // Query manual data if needed  
      if (dataType === 'all' || dataType === 'manual') {
        const manualReadings = await this.getManualData(wellNumber, startDate, endDate);
        allReadings = allReadings.concat(manualReadings);
      }

      // Query telemetry data if needed
      if (dataType === 'all' || dataType === 'telemetry') {
        const telemetryReadings = await this.getTelemetryData(wellNumber, startDate, endDate);
        allReadings = allReadings.concat(telemetryReadings);
      }

      // Sort by timestamp
      allReadings.sort((a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime());

      return allReadings;
    } catch (error) {
      console.error(`Failed to get water level data for well ${wellNumber}:`, error);
      throw new Error('Failed to retrieve water level data');
    }
  }

  private async getTransducerData(wellNumber: string, startDate?: string, endDate?: string, downsample = false, maxPoints = 2000, samplingRate?: string): Promise<WaterLevelReading[]> {
    try {
      let whereConditions = ['well_number = ?'];
      let queryParams: any[] = [wellNumber];

      if (startDate) {
        whereConditions.push('reading_date >= ?');
        queryParams.push(startDate);
      }

      if (endDate) {
        whereConditions.push('reading_date <= ?');
        queryParams.push(endDate);
      }

      const whereClause = whereConditions.join(' AND ');

      let query = `
        SELECT 
          well_number, reading_date as timestamp_utc, 
          water_level, temperature
        FROM water_level_readings 
        WHERE ${whereClause}
        ORDER BY reading_date ASC
      `;

      // Apply downsampling if requested
      if (downsample) {
        if (samplingRate) {
          // Use adaptive sampling with time intervals
          const intervalMinutes = this.getSamplingIntervalMinutes(samplingRate);
          console.log(`🎯 Applying ${samplingRate} sampling (${intervalMinutes} minute intervals)`);
          
          query = `
            WITH time_intervals AS (
              SELECT 
                well_number, reading_date, 
                water_level, temperature,
                -- Group readings into time intervals
                (CAST((julianday(reading_date) - julianday('1970-01-01')) * 24 * 60 AS INTEGER) / ${intervalMinutes}) * ${intervalMinutes} as interval_group
              FROM water_level_readings 
              WHERE ${whereClause}
            ),
            aggregated AS (
              SELECT 
                well_number,
                datetime(julianday('1970-01-01') + (interval_group / (24.0 * 60))) as timestamp_utc,
                AVG(water_level) as water_level,
                AVG(temperature) as temperature
              FROM time_intervals
              GROUP BY well_number, interval_group
            )
            SELECT * FROM aggregated
            ORDER BY timestamp_utc ASC
          `;
        } else {
          // Legacy point-based downsampling
          const countQuery = `SELECT COUNT(*) as total FROM water_level_readings WHERE ${whereClause}`;
          const countResult = await this.execute(countQuery, queryParams);
          
          const totalCount = Number(countResult.rows[0][0]);
          if (totalCount > maxPoints) {
            const skipFactor = Math.ceil(totalCount / maxPoints);
            console.log(`📊 Legacy downsampling: ${totalCount} → ~${Math.floor(totalCount / skipFactor)} points`);
            
            query = `
              SELECT * FROM (
                SELECT 
                  well_number, reading_date as timestamp_utc,
                  water_level, temperature,
                  ROW_NUMBER() OVER (ORDER BY reading_date) as row_num
                FROM water_level_readings 
                WHERE ${whereClause}
              ) WHERE row_num % ${skipFactor} = 1
              ORDER BY timestamp_utc ASC
            `;
          }
        }
      }

      const result = await this.execute(query, queryParams);

      return result.rows.map(row => {
        const obj = this.rowToObject(result.columns, row);
        return {
          ...this.mapRowToReading(obj),
          data_source: 'transducer' // Explicitly set for transducer data
        };
      });
    } catch (error) {
      console.error(`Failed to get transducer data for well ${wellNumber}:`, error);
      return [];
    }
  }

  private async getManualData(wellNumber: string, startDate?: string, endDate?: string): Promise<WaterLevelReading[]> {
    try {
      let whereConditions = ['well_number = ?'];
      let queryParams: any[] = [wellNumber];

      if (startDate) {
        whereConditions.push('measurement_date_utc >= ?');
        queryParams.push(startDate);
      }

      if (endDate) {
        whereConditions.push('measurement_date_utc <= ?');
        queryParams.push(endDate);
      }

      const whereClause = whereConditions.join(' AND ');

      const query = `
        SELECT 
          well_number, measurement_date_utc, dtw_avg, water_level,
          comments, data_source
        FROM manual_level_readings 
        WHERE ${whereClause}
        ORDER BY measurement_date_utc ASC
      `;

      console.log(`🔍 Manual data query for well ${wellNumber}:`, query, queryParams);
      const result = await this.execute(query, queryParams);
      console.log(`📊 Manual data result for well ${wellNumber}:`, {
        columns: result.columns,
        rowCount: result.rows.length,
        firstRow: result.rows[0]
      });

      const manualReadings = result.rows.map((row, index) => {
        const obj = this.rowToObject(result.columns, row);
        const reading = {
          id: Date.now() + index, // Generate unique ID since table doesn't have one
          well_number: String(obj.well_number),
          timestamp_utc: String(obj.measurement_date_utc), // Map measurement_date_utc to timestamp_utc
          julian_timestamp: undefined,
          water_level: obj.water_level ? Number(obj.water_level) : undefined,
          temperature: undefined, // Manual readings don't have temperature
          dtw: obj.dtw_avg ? Number(obj.dtw_avg) : undefined,
          data_source: 'manual' as const, // Explicitly set for manual data
          baro_flag: undefined,
          level_flag: undefined,
          notes: obj.comments ? String(obj.comments) : undefined
        };
        return reading;
      });

      console.log(`✅ Processed ${manualReadings.length} manual readings for well ${wellNumber}`);
      return manualReadings;
    } catch (error) {
      console.error(`❌ Failed to get manual data for well ${wellNumber}:`, error);
      return [];
    }
  }

  private async getTelemetryData(wellNumber: string, startDate?: string, endDate?: string): Promise<WaterLevelReading[]> {
    try {
      let whereConditions = ['well_number = ?'];
      let queryParams: any[] = [wellNumber];

      if (startDate) {
        whereConditions.push('timestamp_utc >= ?');
        queryParams.push(startDate);
      }

      if (endDate) {
        whereConditions.push('timestamp_utc <= ?');
        queryParams.push(endDate);
      }

      const whereClause = whereConditions.join(' AND ');

      const query = `
        SELECT 
          well_number, timestamp_utc, water_level, temperature
        FROM telemetry_level_readings 
        WHERE ${whereClause}
        ORDER BY timestamp_utc ASC
      `;

      const result = await this.execute(query, queryParams);

      return result.rows.map((row, index) => {
        const obj = this.rowToObject(result.columns, row);
        return {
          id: Date.now() + index, // Generate unique ID since table doesn't have one
          well_number: String(obj.well_number),
          timestamp_utc: String(obj.timestamp_utc),
          julian_timestamp: undefined,
          water_level: obj.water_level ? Number(obj.water_level) : undefined,
          temperature: obj.temperature ? Number(obj.temperature) : undefined,
          dtw: undefined,
          data_source: 'telemetry', // Explicitly set for telemetry data
          baro_flag: undefined,
          level_flag: undefined,
          notes: undefined
        };
      });
    } catch (error) {
      console.error(`Failed to get telemetry data for well ${wellNumber}:`, error);
      return [];
    }
  }

  async getRechargeResults(wellNumber: string): Promise<any[]> {
    try {
      let allResults: any[] = [];

      // Get RISE results
      const riseResults = await this.getRISEResults(wellNumber);
      allResults = allResults.concat(riseResults);

      // Get MRC results  
      const mrcResults = await this.getMRCResults(wellNumber);
      allResults = allResults.concat(mrcResults);

      // Sort by calculation date (most recent first)
      allResults.sort((a, b) => new Date(b.calculation_date).getTime() - new Date(a.calculation_date).getTime());

      return allResults;
    } catch (error) {
      console.error(`Failed to get recharge results for well ${wellNumber}:`, error);
      return [];
    }
  }

  private async getRISEResults(wellNumber: string): Promise<any[]> {
    try {
      // Check if RISE table exists
      const tableExistsResult = await this.execute(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='rise_calculations'`,
        []
      );

      if (tableExistsResult.rows.length === 0) {
        return [];
      }

      const query = `
        SELECT 
          id,
          well_number,
          calculation_date,
          parameters,
          events_data,
          yearly_summary,
          total_recharge,
          total_events,
          annual_rate,
          notes
        FROM rise_calculations 
        WHERE well_number = ?
        ORDER BY calculation_date DESC
      `;
      
      const result = await this.execute(query, [wellNumber]);
      
      return result.rows.map(row => {
        const obj = this.rowToObject(result.columns, row);
        let parameters: any = {};
        let events_data: any[] = [];
        let yearly_summary: any[] = [];
        
        try {
          parameters = JSON.parse(obj.parameters || '{}');
          events_data = JSON.parse(obj.events_data || '[]');
          yearly_summary = JSON.parse(obj.yearly_summary || '[]');
        } catch (e) {
          console.warn('Error parsing JSON fields for RISE calculation:', e);
        }
        
        return {
          id: Number(obj.id),
          well_number: obj.well_number,
          method: 'RISE' as const,
          calculation_date: obj.calculation_date,
          total_recharge: Number(obj.total_recharge),
          annual_rate: Number(obj.annual_rate),
          total_events: Number(obj.total_events),
          specific_yield: parameters.specific_yield || null,
          data_start_date: null,
          data_end_date: null,
          notes: obj.notes,
          details: {
            parameters,
            events_data,
            yearly_summary
          }
        };
      });
    } catch (error) {
      console.error('Error fetching RISE results:', error);
      return [];
    }
  }

  private async getMRCResults(wellNumber: string): Promise<any[]> {
    try {
      // Check if MRC tables exist
      const calcTableExists = await this.execute(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='mrc_calculations'`,
        []
      );

      if (calcTableExists.rows.length === 0) {
        return [];
      }

      const query = `
        SELECT 
          calc.id,
          calc.curve_id,
          calc.well_number,
          calc.well_name,
          calc.calculation_date,
          calc.specific_yield,
          calc.deviation_threshold,
          calc.water_year_start_month,
          calc.water_year_start_day,
          calc.downsample_rule,
          calc.downsample_method,
          calc.filter_type,
          calc.filter_window,
          calc.total_recharge,
          calc.annual_rate,
          calc.data_start_date,
          calc.data_end_date,
          calc.notes,
          curve.curve_type,
          curve.curve_parameters,
          curve.r_squared,
          curve.creation_date as curve_creation_date,
          curve.version as curve_version
        FROM mrc_calculations calc
        LEFT JOIN mrc_curves curve ON calc.curve_id = curve.id
        WHERE calc.well_number = ?
        ORDER BY calc.calculation_date DESC
      `;
      
      const result = await this.execute(query, [wellNumber]);
      
      // Get events and yearly summaries for each calculation
      const enrichedResults = await Promise.all(result.rows.map(async row => {
        const obj = this.rowToObject(result.columns, row);
        
        try {
          // Get recharge events
          const eventsQuery = `
            SELECT event_date, water_year, water_level, predicted_level, deviation, recharge_value
            FROM mrc_recharge_events 
            WHERE calculation_id = ?
            ORDER BY event_date
          `;
          const eventsResult = await this.execute(eventsQuery, [obj.id]);
          const events = eventsResult.rows.map(eventRow => this.rowToObject(eventsResult.columns, eventRow));
          
          // Get yearly summaries
          const summariesQuery = `
            SELECT water_year, total_recharge, num_events, annual_rate, max_deviation, avg_deviation
            FROM mrc_yearly_summaries 
            WHERE calculation_id = ?
            ORDER BY water_year
          `;
          const summariesResult = await this.execute(summariesQuery, [obj.id]);
          const summaries = summariesResult.rows.map(summaryRow => this.rowToObject(summariesResult.columns, summaryRow));
          
          let curve_parameters: any = {};
          try {
            curve_parameters = JSON.parse(obj.curve_parameters || '{}');
          } catch (e) {
            console.warn('Error parsing curve parameters:', e);
          }
          
          return {
            id: Number(obj.id),
            well_number: obj.well_number,
            method: 'MRC' as const,
            calculation_date: obj.calculation_date,
            total_recharge: Number(obj.total_recharge),
            annual_rate: Number(obj.annual_rate),
            total_events: events.length,
            specific_yield: Number(obj.specific_yield),
            data_start_date: obj.data_start_date,
            data_end_date: obj.data_end_date,
            notes: obj.notes,
            details: {
              curve_id: Number(obj.curve_id),
              well_name: obj.well_name,
              deviation_threshold: Number(obj.deviation_threshold),
              water_year_start_month: Number(obj.water_year_start_month),
              water_year_start_day: Number(obj.water_year_start_day),
              downsample_rule: obj.downsample_rule,
              downsample_method: obj.downsample_method,
              filter_type: obj.filter_type,
              filter_window: obj.filter_window ? Number(obj.filter_window) : null,
              recharge_events: events,
              yearly_summaries: summaries,
              curve_info: {
                curve_type: obj.curve_type,
                curve_parameters,
                r_squared: obj.r_squared ? Number(obj.r_squared) : null,
                creation_date: obj.curve_creation_date,
                version: obj.curve_version ? Number(obj.curve_version) : null
              }
            }
          };
        } catch (error) {
          console.error('Error enriching MRC result:', error);
          // Return basic result without details if enrichment fails
          return {
            id: Number(obj.id),
            well_number: obj.well_number,
            method: 'MRC' as const,
            calculation_date: obj.calculation_date,
            total_recharge: Number(obj.total_recharge),
            annual_rate: Number(obj.annual_rate),
            total_events: 0,
            specific_yield: Number(obj.specific_yield),
            data_start_date: obj.data_start_date,
            data_end_date: obj.data_end_date,
            notes: obj.notes
          };
        }
      }));
      
      return enrichedResults;
    } catch (error) {
      console.error('Error fetching MRC results:', error);
      return [];
    }
  }

  async getWellFields(): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT well_field 
        FROM wells 
        WHERE well_field IS NOT NULL AND well_field != ''
        ORDER BY well_field
      `;

      const result = await this.execute(query);
      return result.rows.map(row => String(row[0]));
    } catch (error) {
      console.error('Failed to get well fields:', error);
      throw new Error('Failed to retrieve well fields');
    }
  }

  async getAquiferTypes(): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT aquifer 
        FROM wells 
        WHERE aquifer IS NOT NULL AND aquifer != ''
        ORDER BY aquifer
      `;

      const result = await this.execute(query);
      return result.rows.map(row => String(row[0]));
    } catch (error) {
      console.error('Failed to get aquifer types:', error);
      // Return fallback aquifer types if query fails
      return ['confined', 'unconfined', 'semiconfined'];
    }
  }

  async getWellStatistics(wellNumber: string): Promise<any | null> {
    try {
      const query = `
        SELECT 
          well_number, total_readings, data_start_date, data_end_date,
          total_days, min_water_level, max_water_level, avg_water_level,
          min_level_date, max_level_date, trend_direction, trend_change_per_year,
          highest_month, lowest_month, readings_last_30_days, last_reading_date
        FROM well_statistics 
        WHERE well_number = ?
      `;

      const result = await this.execute(query, [wellNumber]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = this.rowToObject(result.columns, result.rows[0]);
      return {
        well_number: row.well_number,
        total_readings: row.total_readings ? Number(row.total_readings) : 0,
        data_start_date: row.data_start_date,
        data_end_date: row.data_end_date,
        total_days: row.total_days ? Number(row.total_days) : 0,
        min_water_level: row.min_water_level ? Number(row.min_water_level) : 0,
        max_water_level: row.max_water_level ? Number(row.max_water_level) : 0,
        avg_water_level: row.avg_water_level ? Number(row.avg_water_level) : 0,
        min_level_date: row.min_level_date,
        max_level_date: row.max_level_date,
        trend_direction: row.trend_direction,
        trend_change_per_year: row.trend_change_per_year ? Number(row.trend_change_per_year) : 0,
        highest_month: row.highest_month,
        lowest_month: row.lowest_month,
        readings_last_30_days: row.readings_last_30_days ? Number(row.readings_last_30_days) : 0,
        last_reading_date: row.last_reading_date
      };
    } catch (error) {
      console.error(`Failed to get well statistics for ${wellNumber}:`, error);
      return null;
    }
  }

  async getDatabaseStats(): Promise<{ wellsCount: number; readingsCount: number; lastUpdate: string | null }> {
    try {
      // Use fast queries instead of counting millions of rows
      const wellsResult = await this.execute('SELECT COUNT(*) as count FROM wells');
      
      // Get total readings from the statistics table (much faster)
      const readingsResult = await this.execute('SELECT SUM(total_readings) as total FROM well_statistics');
      const totalReadings = Number(readingsResult.rows[0][0]) || 0;
      
      // Get last update from statistics table
      const lastUpdateResult = await this.execute('SELECT MAX(last_reading_date) as last_update FROM well_statistics');
      const lastUpdate = lastUpdateResult.rows[0][0] ? String(lastUpdateResult.rows[0][0]) : null;

      return {
        wellsCount: Number(wellsResult.rows[0][0]),
        readingsCount: totalReadings,
        lastUpdate
      };
    } catch (error) {
      console.error('Failed to get database stats:', error);
      throw new Error('Failed to retrieve database statistics');
    }
  }

  // Helper methods to map database rows to typed objects
  private mapRowToWell(row: any): Well {
    return {
      well_number: String(row.well_number),
      cae_number: row.cae_number ? String(row.cae_number) : undefined,
      well_field: row.well_field ? String(row.well_field) : undefined,
      cluster: row.cluster ? String(row.cluster) : undefined,
      latitude: row.latitude ? Number(row.latitude) : undefined,
      longitude: row.longitude ? Number(row.longitude) : undefined,
      top_of_casing: row.top_of_casing ? Number(row.top_of_casing) : undefined,
      ground_elevation: undefined, // Not in this schema
      well_depth: undefined, // Not in this schema
      screen_top: undefined, // Not in this schema
      screen_bottom: undefined, // Not in this schema
      aquifer_type: row.aquifer ? String(row.aquifer) as 'confined' | 'unconfined' | 'semiconfined' : undefined,
      static_water_level: undefined, // Not in this schema
      notes: undefined, // Not in this schema
      last_reading_date: row.last_reading_date ? String(row.last_reading_date) : undefined,
      total_readings: row.total_readings ? Number(row.total_readings) : 0,
      has_manual_readings: Boolean(row.has_manual_readings),
      has_transducer_data: Boolean(row.has_transducer_data),
      has_telemetry_data: Boolean(row.has_telemetry_data)
    };
  }

  private mapRowToReading(row: any): WaterLevelReading {
    return {
      id: row.id ? Number(row.id) : Date.now(), // Use timestamp as fallback ID
      well_number: String(row.well_number),
      timestamp_utc: String(row.timestamp_utc),
      julian_timestamp: row.julian_timestamp ? Number(row.julian_timestamp) : undefined,
      water_level: row.water_level ? Number(row.water_level) : undefined,
      temperature: row.temperature ? Number(row.temperature) : undefined,
      dtw: undefined, // Not in this schema
      data_source: row.data_source ? String(row.data_source) as 'transducer' | 'telemetry' | 'manual' : 'transducer', // Use database value
      baro_flag: row.baro_flag ? String(row.baro_flag) : undefined,
      level_flag: row.level_flag ? String(row.level_flag) : undefined,
      notes: undefined // Not in this schema
    };
  }

  private mapRowToRechargeResult(row: any): Omit<RechargeResult, 'method'> {
    return {
      id: Number(row.id),
      well_number: String(row.well_number),
      calculation_date: String(row.calculation_date),
      start_date: String(row.start_date),
      end_date: String(row.end_date),
      recharge_mm: row.recharge_mm ? Number(row.recharge_mm) : undefined,
      recharge_inches: row.recharge_inches ? Number(row.recharge_inches) : undefined,
      specific_yield: row.specific_yield ? Number(row.specific_yield) : undefined,
      water_table_rise: row.water_table_rise ? Number(row.water_table_rise) : undefined,
      calculation_parameters: row.calculation_parameters ? String(row.calculation_parameters) : undefined,
      notes: row.notes ? String(row.notes) : undefined
    };
  }
}