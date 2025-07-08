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

interface DatabaseConfig {
  id: string;
  name: string;
  description: string;
  url: string;
  token: string;
}

export class MultiTursoService {
  private databases: Map<string, DatabaseConfig>;

  constructor() {
    this.databases = new Map();
    this.initializeDatabases();
  }

  private initializeDatabases() {
    // Database configurations from environment variables
    const dbConfigs = [
      {
        id: 'caeser-water-monitoring',
        name: 'CAESER Water Monitoring Database',
        description: 'Original CAESER water monitoring data',
        url: process.env.TURSO_DATABASE_URL || '',
        token: process.env.TURSO_AUTH_TOKEN || ''
      },
      {
        id: 'sandy-creek',
        name: 'Sandy Creek Monitoring',
        description: 'Sandy Creek water level monitoring data',
        url: process.env.SANDY_CREEK_URL || '',
        token: process.env.SANDY_CREEK_TOKEN || ''
      },
      {
        id: 'megasite',
        name: 'Megasite Monitoring',
        description: 'Megasite water level monitoring data',
        url: process.env.MEGASITE_URL || '',
        token: process.env.MEGASITE_TOKEN || ''
      },
      {
        id: 'caeser-general',
        name: 'CAESER General Monitoring',
        description: 'CAESER general water monitoring database',
        url: process.env.CAESER_GENERAL_URL || '',
        token: process.env.CAESER_GENERAL_TOKEN || ''
      }
    ];

    // Only add databases that have valid credentials
    dbConfigs.forEach(config => {
      if (config.url && config.token) {
        this.databases.set(config.id, config);
      }
    });

    if (this.databases.size === 0) {
      throw new Error('No valid database configurations found. Please check environment variables.');
    }
  }

  private async execute(databaseId: string, sql: string, args: any[] = [], timeout: number = 5000): Promise<{ columns: string[]; rows: any[] }> {
    const dbConfig = this.databases.get(databaseId);
    if (!dbConfig) {
      throw new Error(`Database '${databaseId}' not found`);
    }

    // Convert Turso database URL to HTTP API URL
    const apiUrl = dbConfig.url.replace('libsql://', 'https://') + '/v2/pipeline';
    
    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${dbConfig.token}`,
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
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Turso API Error:', {
          database: databaseId,
          status: response.status,
          statusText: response.statusText,
          errorText,
          apiUrl,
          sql
        });
        throw new Error(`Turso API error for ${databaseId}: ${response.status} ${response.statusText} - ${errorText}`);
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
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Database query timeout for ${databaseId} (${timeout}ms)`);
      }
      throw error;
    }
  }

  // Get list of available databases
  async listDatabases(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    size: number;
    modified: string;
    wellsCount: number;
    readingsCount: number;
    lastUpdate: string | null;
    wellFields: string[];
  }>> {
    // Process databases in parallel with timeout
    const databasePromises = Array.from(this.databases.entries()).map(async ([id, config]) => {
      try {
        // Use a shorter timeout for individual database operations
        const timeout = 3000; // 3 second timeout per database
        
        // Execute queries in parallel for each database
        const [wellsResult, readingsResult] = await Promise.all([
          this.execute(id, 'SELECT COUNT(*) as count FROM wells', [], timeout),
          this.execute(id, 'SELECT COUNT(*) as count FROM water_level_readings', [], timeout)
        ]);

        const wellsCount = parseInt(wellsResult.rows[0][0]) || 0;
        const readingsCount = parseInt(readingsResult.rows[0][0]) || 0;

        // Get last update and well fields with separate timeout handling
        let lastUpdate: string | null = null;
        let wellFields: string[] = [];
        
        try {
          const [lastUpdateResult, fieldsResult] = await Promise.all([
            this.execute(id, 'SELECT MAX(timestamp_utc) as last_update FROM water_level_readings', [], timeout),
            this.execute(id, 'SELECT DISTINCT well_field FROM wells WHERE well_field IS NOT NULL AND well_field != ""', [], timeout)
          ]);
          
          lastUpdate = lastUpdateResult.rows[0][0] || null;
          wellFields = fieldsResult.rows.map(row => row[0]).filter(Boolean);
        } catch (error) {
          console.warn(`Could not get additional info for ${id}:`, error);
        }

        return {
          id,
          name: config.name,
          description: config.description,
          size: 0,
          modified: new Date().toISOString(),
          wellsCount,
          readingsCount,
          lastUpdate,
          wellFields
        };
      } catch (error) {
        console.error(`Failed to get stats for database ${id}:`, error);
        // Still return the database but with zero stats
        return {
          id,
          name: config.name,
          description: config.description,
          size: 0,
          modified: new Date().toISOString(),
          wellsCount: 0,
          readingsCount: 0,
          lastUpdate: null,
          wellFields: []
        };
      }
    });

    // Wait for all databases to complete (or timeout)
    const databases = await Promise.all(databasePromises);
    return databases;
  }

  // Get wells for a specific database
  async getWells(databaseId: string, params: WellsQueryParams = {}): Promise<PaginatedResponse<Well>> {
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

      // Build WHERE conditions
      if (search) {
        whereConditions.push(`(well_number LIKE ? OR cae_number LIKE ? OR well_field LIKE ?)`);
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
      }

      if (aquifer) {
        whereConditions.push(`aquifer = ?`);
        queryParams.push(aquifer);
      }

      // Skip dataType filtering for now since megasite doesn't have these columns
      // if (dataType) {
      //   if (dataType === 'transducer') {
      //     whereConditions.push(`has_transducer_data = 1`);
      //   } else if (dataType === 'telemetry') {
      //     whereConditions.push(`has_telemetry_data = 1`);
      //   } else if (dataType === 'manual') {
      //     whereConditions.push(`has_manual_readings = 1`);
      //   }
      // }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM wells ${whereClause}`;
      const countResult = await this.execute(databaseId, countQuery, queryParams);
      const total = parseInt(countResult.rows[0][0]) || 0;

      // Get paginated results
      const offset = (page - 1) * limit;
      const dataQuery = `
        SELECT 
          well_number, cae_number, well_field, 
          latitude, longitude, aquifer as aquifer_type
        FROM wells 
        ${whereClause} 
        ${orderClause} 
        LIMIT ? OFFSET ?
      `;

      console.log(`Executing wells query for ${databaseId}:`, dataQuery, [...queryParams, limit, offset]);
      
      const result = await this.execute(databaseId, dataQuery, [...queryParams, limit, offset]);
      
      console.log(`Wells query result for ${databaseId}:`, {
        columns: result.columns,
        rowCount: result.rows.length,
        firstRow: result.rows[0]
      });
      
      const wells: Well[] = result.rows.map(row => {
        const well: any = {};
        result.columns.forEach((col, index) => {
          well[col] = row[index];
        });
        
        // Convert string values to appropriate types
        well.latitude = parseFloat(well.latitude) || 0;
        well.longitude = parseFloat(well.longitude) || 0;
        well.total_readings = 0;
        well.has_manual_readings = false;
        well.has_transducer_data = false;
        well.has_telemetry_data = false;
        well.manual_readings_count = 0;
        
        return well as Well;
      });

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
      console.error(`Failed to get wells for database ${databaseId}:`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        databaseId,
        params
      });
      throw new Error(`Failed to retrieve wells data from ${databaseId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get specific well from a database
  async getWell(databaseId: string, wellNumber: string): Promise<Well | null> {
    try {
      const query = `
        SELECT 
          well_number, cae_number, well_field,
          latitude, longitude, aquifer as aquifer_type
        FROM wells 
        WHERE well_number = ?
      `;

      const result = await this.execute(databaseId, query, [wellNumber]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const well: any = {};
      result.columns.forEach((col, index) => {
        well[col] = row[index];
      });
      
      // Convert string values to appropriate types
      well.latitude = parseFloat(well.latitude) || 0;
      well.longitude = parseFloat(well.longitude) || 0;
      well.total_readings = 0;
      well.has_manual_readings = false;
      well.has_transducer_data = false;
      well.has_telemetry_data = false;
      well.manual_readings_count = 0;
      
      return well as Well;
    } catch (error) {
      console.error(`Failed to get well ${wellNumber} from database ${databaseId}:`, error);
      throw new Error(`Failed to retrieve well data from ${databaseId}`);
    }
  }

  // Get water level data for a specific well in a database
  async getWaterLevelData(databaseId: string, params: DataQueryParams): Promise<WaterLevelReading[]> {
    const {
      wellNumber,
      startDate,
      endDate,
      dataType = 'all',
      downsample = false,
      maxPoints = 2000
    } = params;

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

      if (dataType !== 'all') {
        whereConditions.push('data_source = ?');
        queryParams.push(dataType);
      }

      const whereClause = whereConditions.join(' AND ');

      let query = `
        SELECT 
          id, well_number, timestamp_utc, julian_timestamp,
          water_level, temperature, dtw, data_source,
          baro_flag, level_flag, notes
        FROM water_level_readings 
        WHERE ${whereClause}
        ORDER BY timestamp_utc ASC
      `;

      // Apply downsampling if requested and data is large
      if (downsample) {
        const countQuery = `SELECT COUNT(*) as total FROM water_level_readings WHERE ${whereClause}`;
        const countResult = await this.execute(databaseId, countQuery, queryParams);
        const total = parseInt(countResult.rows[0][0]) || 0;
        
        if (total > maxPoints) {
          const skipFactor = Math.ceil(total / maxPoints);
          query = `
            SELECT * FROM (
              SELECT 
                id, well_number, timestamp_utc, julian_timestamp,
                water_level, temperature, dtw, data_source,
                baro_flag, level_flag, notes,
                ROW_NUMBER() OVER (ORDER BY timestamp_utc) as row_num
              FROM water_level_readings 
              WHERE ${whereClause}
            ) WHERE row_num % ${skipFactor} = 1
            ORDER BY timestamp_utc ASC
          `;
        }
      }

      const result = await this.execute(databaseId, query, queryParams);
      
      const readings: WaterLevelReading[] = result.rows.map(row => {
        const reading: any = {};
        result.columns.forEach((col, index) => {
          reading[col] = row[index];
        });
        
        // Convert string values to appropriate types
        reading.id = parseInt(reading.id) || 0;
        reading.julian_timestamp = parseFloat(reading.julian_timestamp) || null;
        reading.water_level = parseFloat(reading.water_level) || null;
        reading.temperature = parseFloat(reading.temperature) || null;
        reading.dtw = parseFloat(reading.dtw) || null;
        
        return reading as WaterLevelReading;
      });

      return readings;
    } catch (error) {
      console.error(`Failed to get water level data for well ${wellNumber} from database ${databaseId}:`, error);
      throw new Error(`Failed to retrieve water level data from ${databaseId}`);
    }
  }

  // Get recharge results for a specific well in a database
  async getRechargeResults(databaseId: string, wellNumber: string): Promise<RechargeResult[]> {
    try {
      const tables = ['rise_results', 'mrc_results', 'emr_results'];
      let allResults: RechargeResult[] = [];

      for (const table of tables) {
        try {
          // Check if table exists
          const tableExistsResult = await this.execute(databaseId, `
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name=?
          `, [table]);
          
          if (tableExistsResult.rows.length > 0) {
            const method = table.split('_')[0].toUpperCase() as 'RISE' | 'MRC' | 'EMR';
            
            const query = `
              SELECT 
                id, well_number, calculation_date, start_date, end_date,
                recharge_mm, recharge_inches, specific_yield, water_table_rise,
                calculation_parameters, notes
              FROM ${table}
              WHERE well_number = ?
              ORDER BY calculation_date DESC
            `;

            const result = await this.execute(databaseId, query, [wellNumber]);
            
            for (const row of result.rows) {
              const rechargeResult: any = {};
              result.columns.forEach((col, index) => {
                rechargeResult[col] = row[index];
              });
              
              rechargeResult.method = method;
              rechargeResult.id = parseInt(rechargeResult.id) || 0;
              rechargeResult.recharge_mm = parseFloat(rechargeResult.recharge_mm) || null;
              rechargeResult.recharge_inches = parseFloat(rechargeResult.recharge_inches) || null;
              rechargeResult.specific_yield = parseFloat(rechargeResult.specific_yield) || null;
              rechargeResult.water_table_rise = parseFloat(rechargeResult.water_table_rise) || null;
              
              if (rechargeResult.calculation_parameters) {
                try {
                  rechargeResult.calculation_parameters = JSON.parse(rechargeResult.calculation_parameters);
                } catch {
                  // Keep as string if JSON parsing fails
                }
              }
              
              allResults.push(rechargeResult as RechargeResult);
            }
          }
        } catch (error) {
          console.warn(`Error querying ${table} in database ${databaseId}:`, error);
          // Continue with other tables if one fails
        }
      }

      return allResults.sort((a, b) => 
        new Date(b.calculation_date).getTime() - new Date(a.calculation_date).getTime()
      );
    } catch (error) {
      console.error(`Failed to get recharge results for well ${wellNumber} from database ${databaseId}:`, error);
      throw new Error(`Failed to retrieve recharge results from ${databaseId}`);
    }
  }

  // Get well fields for a specific database
  async getWellFields(databaseId: string): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT well_field 
        FROM wells 
        WHERE well_field IS NOT NULL AND well_field != ''
        ORDER BY well_field
      `;

      const result = await this.execute(databaseId, query);
      return result.rows.map(row => String(row[0]));
    } catch (error) {
      console.error(`Failed to get well fields for database ${databaseId}:`, error);
      throw new Error(`Failed to retrieve well fields from ${databaseId}`);
    }
  }

  // Get aquifer types for a specific database
  async getAquiferTypes(databaseId: string): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT aquifer 
        FROM wells 
        WHERE aquifer IS NOT NULL AND aquifer != ''
        ORDER BY aquifer
      `;

      const result = await this.execute(databaseId, query);
      return result.rows.map(row => String(row[0]));
    } catch (error) {
      console.error(`Failed to get aquifer types for database ${databaseId}:`, error);
      // Return fallback aquifer types if query fails
      return ['MEM', 'confined', 'unconfined', 'semiconfined'];
    }
  }

  // Check if database exists and is accessible
  async testConnection(databaseId: string): Promise<boolean> {
    try {
      await this.execute(databaseId, 'SELECT 1');
      return true;
    } catch (error) {
      console.error(`Connection test failed for database ${databaseId}:`, error);
      return false;
    }
  }
}

// Create singleton instance
export const multiTursoService = new MultiTursoService();