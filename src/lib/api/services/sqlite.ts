import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { Well, WaterLevelReading, RechargeResult, WellsQueryParams, DataQueryParams, PaginatedResponse } from '../api';

export class SQLiteService {
  private db: sqlite3.Database | null = null;
  private currentFilePath: string | null = null;

  async openDatabase(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Close existing connection if any
      this.closeDatabase();

      // Open database in read-only mode
      this.db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, async (err) => {
        if (err) {
          reject(new Error(`Failed to open database: ${err.message}`));
          return;
        }

        this.currentFilePath = filePath;
        
        try {
          // Verify database structure
          await this.verifyDatabaseStructure();
          console.log(`Database opened successfully: ${filePath}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  closeDatabase(): void {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        }
      });
      this.db = null;
      this.currentFilePath = null;
    }
  }

  private dbGet(query: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }
      
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  private dbAll(query: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }
      
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async getWells(params: WellsQueryParams = {}): Promise<PaginatedResponse<Well>> {
    if (!this.db) throw new Error('Database not connected');

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
        whereConditions.push(`aquifer_type = ?`);
        queryParams.push(aquifer);
      }

      if (dataType) {
        if (dataType === 'transducer') {
          whereConditions.push(`has_transducer_data = 1`);
        } else if (dataType === 'telemetry') {
          whereConditions.push(`has_telemetry_data = 1`);
        } else if (dataType === 'manual') {
          whereConditions.push(`has_manual_readings = 1`);
        }
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM wells ${whereClause}`;
      const countResult = await this.dbGet(countQuery, queryParams) as { total: number };
      const total = countResult.total;

      // Get paginated results
      const offset = (page - 1) * limit;
      const dataQuery = `
        SELECT 
          well_number, cae_number, well_field, cluster,
          latitude, longitude, top_of_casing, ground_elevation,
          well_depth, screen_top, screen_bottom, aquifer_type,
          static_water_level, notes, last_reading_date, total_readings,
          has_manual_readings, has_transducer_data, has_telemetry_data
        FROM wells 
        ${whereClause} 
        ${orderClause} 
        LIMIT ? OFFSET ?
      `;

      const wells = await this.dbAll(dataQuery, [...queryParams, limit, offset]) as Well[];

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
      console.error('Failed to get wells:', error);
      throw new Error('Failed to retrieve wells data');
    }
  }

  async getWell(wellNumber: string): Promise<Well | null> {
    if (!this.db) throw new Error('Database not connected');

    try {
      const query = `
        SELECT 
          well_number, cae_number, well_field, cluster,
          latitude, longitude, top_of_casing, ground_elevation,
          well_depth, screen_top, screen_bottom, aquifer_type,
          static_water_level, notes, last_reading_date, total_readings,
          has_manual_readings, has_transducer_data, has_telemetry_data
        FROM wells 
        WHERE well_number = ?
      `;

      const well = await this.dbGet(query, [wellNumber]) as Well | undefined;
      return well || null;
    } catch (error) {
      console.error(`Failed to get well ${wellNumber}:`, error);
      throw new Error('Failed to retrieve well data');
    }
  }

  async getWaterLevelData(params: DataQueryParams): Promise<WaterLevelReading[]> {
    if (!this.db) throw new Error('Database not connected');

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
        const countResult = await this.dbGet(countQuery, queryParams) as { total: number };
        
        if (countResult.total > maxPoints) {
          const skipFactor = Math.ceil(countResult.total / maxPoints);
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

      const readings = await this.dbAll(query, queryParams) as WaterLevelReading[];
      return readings;
    } catch (error) {
      console.error(`Failed to get water level data for well ${wellNumber}:`, error);
      throw new Error('Failed to retrieve water level data');
    }
  }

  async getRechargeResults(wellNumber: string): Promise<RechargeResult[]> {
    if (!this.db) throw new Error('Database not connected');

    try {
      const tables = ['rise_results', 'mrc_results', 'emr_results'];
      let allResults: RechargeResult[] = [];

      for (const table of tables) {
        // Check if table exists
        const tableExists = await this.dbGet(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name=?
        `, [table]);

        if (tableExists) {
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

          const results = await this.dbAll(query, [wellNumber]) as Omit<RechargeResult, 'method'>[];
          
          // Add method to each result
          const methodResults = results.map(result => ({
            ...result,
            method
          }));

          allResults = allResults.concat(methodResults);
        }
      }

      return allResults.sort((a, b) => 
        new Date(b.calculation_date).getTime() - new Date(a.calculation_date).getTime()
      );
    } catch (error) {
      console.error(`Failed to get recharge results for well ${wellNumber}:`, error);
      throw new Error('Failed to retrieve recharge results');
    }
  }

  async getWellFields(): Promise<string[]> {
    if (!this.db) throw new Error('Database not connected');

    try {
      const query = `
        SELECT DISTINCT well_field 
        FROM wells 
        WHERE well_field IS NOT NULL AND well_field != ''
        ORDER BY well_field
      `;

      const results = await this.dbAll(query) as { well_field: string }[];
      return results.map(r => r.well_field);
    } catch (error) {
      console.error('Failed to get well fields:', error);
      throw new Error('Failed to retrieve well fields');
    }
  }

  async getDatabaseStats(): Promise<{ wellsCount: number; readingsCount: number; lastUpdate: string | null }> {
    if (!this.db) throw new Error('Database not connected');

    try {
      const wellsCount = await this.dbGet('SELECT COUNT(*) as count FROM wells') as { count: number };
      
      const readingsCount = await this.dbGet('SELECT COUNT(*) as count FROM water_level_readings') as { count: number };
      
      const lastUpdate = await this.dbGet(`
        SELECT MAX(timestamp_utc) as last_update 
        FROM water_level_readings
      `) as { last_update: string | null };

      return {
        wellsCount: wellsCount.count,
        readingsCount: readingsCount.count,
        lastUpdate: lastUpdate.last_update
      };
    } catch (error) {
      console.error('Failed to get database stats:', error);
      throw new Error('Failed to retrieve database statistics');
    }
  }

  private async verifyDatabaseStructure(): Promise<void> {
    if (!this.db) throw new Error('Database not connected');

    const requiredTables = ['wells', 'water_level_readings'];
    
    for (const table of requiredTables) {
      const tableExists = await this.dbGet(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `, [table]);

      if (!tableExists) {
        throw new Error(`Required table '${table}' not found in database`);
      }
    }
  }
}