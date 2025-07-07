// Database operations for SQLite in the browser using sql.js
// Ported from the existing Python visualizer SimpleDatabaseManager

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import type { 
  Well, 
  WaterLevelReading, 
  ManualReading, 
  RechargeResult,
  Transducer,
  Barologger,
  WellsQueryParams,
  DataQueryParams,
  PaginatedResponse 
} from '@/types/database';

let SQL: SqlJsStatic | null = null;

// Initialize sql.js
export async function initDatabase(): Promise<void> {
  if (SQL) return;
  
  try {
    SQL = await initSqlJs({
      // Load sql.js wasm file from CDN for faster loading
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`
    });
  } catch (error) {
    console.error('Failed to initialize sql.js:', error);
    throw new Error('Database initialization failed');
  }
}

export class WaterLevelDatabase {
  private db: Database | null = null;
  private initialized = false;

  constructor(private arrayBuffer: ArrayBuffer) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await initDatabase();
    if (!SQL) throw new Error('SQL.js not initialized');

    try {
      this.db = new SQL.Database(new Uint8Array(this.arrayBuffer));
      this.initialized = true;
      
      // Verify database structure
      await this.validateSchema();
    } catch (error) {
      console.error('Failed to open database:', error);
      throw new Error('Invalid database file');
    }
  }

  private async validateSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const requiredTables = ['wells', 'water_level_readings'];
    const stmt = this.db.prepare('SELECT name FROM sqlite_master WHERE type="table"');
    
    const tables: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      tables.push(row.name as string);
    }
    stmt.free();

    for (const table of requiredTables) {
      if (!tables.includes(table)) {
        throw new Error(`Required table '${table}' not found in database`);
      }
    }
  }

  // Wells operations
  async getWells(params: WellsQueryParams = {}): Promise<PaginatedResponse<Well>> {
    if (!this.db) throw new Error('Database not initialized');

    const {
      search = '',
      aquifer = '',
      dataType = undefined,
      page = 1,
      limit = 50,
      sortBy = 'well_number',
      sortOrder = 'asc'
    } = params;

    let query = `
      SELECT 
        w.*,
        COUNT(wlr.id) as total_readings,
        MAX(wlr.timestamp_utc) as last_reading_date,
        CASE WHEN COUNT(mr.id) > 0 THEN 1 ELSE 0 END as has_manual_readings,
        CASE WHEN COUNT(wlr.id) > 0 THEN 1 ELSE 0 END as has_transducer_data
      FROM wells w
      LEFT JOIN water_level_readings wlr ON w.well_number = wlr.well_number
      LEFT JOIN manual_readings mr ON w.well_number = mr.well_number
      WHERE 1=1
    `;

    const params_values: any[] = [];

    // Add search filter
    if (search) {
      query += ` AND (w.well_number LIKE ? OR w.cae_number LIKE ? OR w.well_field LIKE ?)`;
      const searchPattern = `%${search}%`;
      params_values.push(searchPattern, searchPattern, searchPattern);
    }

    // Add aquifer filter
    if (aquifer) {
      query += ` AND w.aquifer_type = ?`;
      params_values.push(aquifer);
    }

    // Add data type filter will be handled post-query since it requires data analysis

    query += ` GROUP BY w.well_number`;

    // Add sorting
    const validSortColumns = ['well_number', 'cae_number', 'last_reading_date'];
    if (validSortColumns.includes(sortBy)) {
      query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
    }

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT ? OFFSET ?`;
    params_values.push(limit, offset);

    try {
      const stmt = this.db.prepare(query);
      const result = stmt.bind(params_values);
      
      const wells: Well[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        wells.push(this.mapRowToWell(row));
      }
      stmt.free();

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(DISTINCT w.well_number) as total
        FROM wells w
        LEFT JOIN water_level_readings wlr ON w.well_number = wlr.well_number
        WHERE 1=1
      `;

      const countParams: any[] = [];
      if (search) {
        countQuery += ` AND (w.well_number LIKE ? OR w.cae_number LIKE ? OR w.well_field LIKE ?)`;
        const searchPattern = `%${search}%`;
        countParams.push(searchPattern, searchPattern, searchPattern);
      }
      if (aquifer) {
        countQuery += ` AND w.aquifer_type = ?`;
        countParams.push(aquifer);
      }

      const countStmt = this.db.prepare(countQuery);
      countStmt.bind(countParams);
      countStmt.step();
      const countRow = countStmt.getAsObject();
      const total = countRow.total as number;
      countStmt.free();

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
      console.error('Error fetching wells:', error);
      throw new Error('Failed to fetch wells data');
    }
  }

  async getWell(wellNumber: string): Promise<Well | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT 
        w.*,
        COUNT(wlr.id) as total_readings,
        MAX(wlr.timestamp_utc) as last_reading_date,
        CASE WHEN COUNT(mr.id) > 0 THEN 1 ELSE 0 END as has_manual_readings,
        CASE WHEN COUNT(wlr.id) > 0 THEN 1 ELSE 0 END as has_transducer_data
      FROM wells w
      LEFT JOIN water_level_readings wlr ON w.well_number = wlr.well_number
      LEFT JOIN manual_readings mr ON w.well_number = mr.well_number
      WHERE w.well_number = ?
      GROUP BY w.well_number
    `);

    stmt.bind([wellNumber]);
    
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return this.mapRowToWell(row);
    }
    
    stmt.free();
    return null;
  }

  // Water level readings operations
  async getWaterLevelData(params: DataQueryParams): Promise<WaterLevelReading[]> {
    if (!this.db) throw new Error('Database not initialized');

    const {
      wellNumber,
      startDate,
      endDate,
      dataType = 'all',
      downsample = false,
      maxPoints = 1000
    } = params;

    let query = `
      SELECT 
        id,
        well_number,
        timestamp_utc,
        julian_timestamp,
        water_level,
        temperature,
        dtw,
        'transducer' as data_source,
        baro_flag,
        level_flag
      FROM water_level_readings
      WHERE well_number = ?
    `;

    const queryParams: any[] = [wellNumber];

    // Add date range filters
    if (startDate) {
      query += ` AND timestamp_utc >= ?`;
      queryParams.push(startDate);
    }
    if (endDate) {
      query += ` AND timestamp_utc <= ?`;
      queryParams.push(endDate);
    }

    // Add manual readings if requested
    if (dataType === 'all' || dataType === 'manual') {
      query += ` UNION ALL
        SELECT 
          id,
          well_number,
          timestamp_utc,
          julian_timestamp,
          water_level,
          NULL as temperature,
          dtw,
          'manual' as data_source,
          NULL as baro_flag,
          NULL as level_flag
        FROM manual_readings
        WHERE well_number = ?
      `;
      queryParams.push(wellNumber);

      if (startDate) {
        query += ` AND timestamp_utc >= ?`;
        queryParams.push(startDate);
      }
      if (endDate) {
        query += ` AND timestamp_utc <= ?`;
        queryParams.push(endDate);
      }
    }

    query += ` ORDER BY timestamp_utc`;

    try {
      const stmt = this.db.prepare(query);
      stmt.bind(queryParams);

      const readings: WaterLevelReading[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        readings.push(this.mapRowToReading(row));
      }
      stmt.free();

      // Apply downsampling if requested and data is large
      if (downsample && readings.length > maxPoints) {
        return this.downsampleData(readings, maxPoints);
      }

      return readings;
    } catch (error) {
      console.error('Error fetching water level data:', error);
      throw new Error('Failed to fetch water level data');
    }
  }

  // Recharge results operations
  async getRechargeResults(wellNumber: string): Promise<RechargeResult[]> {
    if (!this.db) throw new Error('Database not initialized');

    // Check if recharge tables exist
    const tableStmt = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('rise_results', 'mrc_results', 'emr_results')
    `);

    const tables: string[] = [];
    while (tableStmt.step()) {
      const row = tableStmt.getAsObject();
      tables.push(row.name as string);
    }
    tableStmt.free();

    if (tables.length === 0) {
      return [];
    }

    const results: RechargeResult[] = [];

    // Query each recharge method table that exists
    for (const table of tables) {
      const method = table.replace('_results', '').toUpperCase() as 'RISE' | 'MRC' | 'EMR';
      
      try {
        const stmt = this.db.prepare(`
          SELECT * FROM ${table}
          WHERE well_number = ?
          ORDER BY calculation_date DESC
        `);
        
        stmt.bind([wellNumber]);
        
        while (stmt.step()) {
          const row = stmt.getAsObject();
          results.push({
            ...row,
            method,
            calculation_parameters: row.calculation_parameters ? 
              JSON.parse(row.calculation_parameters as string) : undefined
          } as RechargeResult);
        }
        stmt.free();
      } catch (error) {
        console.error(`Error querying ${table}:`, error);
        // Continue with other tables if one fails
      }
    }

    return results;
  }

  // Utility methods
  private mapRowToWell(row: any): Well {
    return {
      well_number: row.well_number,
      cae_number: row.cae_number,
      well_field: row.well_field,
      cluster: row.cluster,
      latitude: row.latitude,
      longitude: row.longitude,
      top_of_casing: row.top_of_casing,
      ground_elevation: row.ground_elevation,
      well_depth: row.well_depth,
      screen_top: row.screen_top,
      screen_bottom: row.screen_bottom,
      aquifer_type: row.aquifer_type,
      static_water_level: row.static_water_level,
      notes: row.notes,
      last_reading_date: row.last_reading_date,
      total_readings: row.total_readings || 0,
      has_manual_readings: Boolean(row.has_manual_readings),
      has_transducer_data: Boolean(row.has_transducer_data),
      has_telemetry_data: Boolean(row.has_telemetry_data)
    };
  }

  private mapRowToReading(row: any): WaterLevelReading {
    return {
      id: row.id,
      well_number: row.well_number,
      timestamp_utc: row.timestamp_utc,
      julian_timestamp: row.julian_timestamp,
      water_level: row.water_level,
      temperature: row.temperature,
      dtw: row.dtw,
      data_source: row.data_source,
      baro_flag: row.baro_flag,
      level_flag: row.level_flag,
      notes: row.notes
    };
  }

  private downsampleData(data: WaterLevelReading[], targetPoints: number): WaterLevelReading[] {
    if (data.length <= targetPoints) return data;

    const step = Math.floor(data.length / targetPoints);
    const downsampled: WaterLevelReading[] = [];

    for (let i = 0; i < data.length; i += step) {
      downsampled.push(data[i]);
    }

    // Always include the last point
    if (downsampled[downsampled.length - 1] !== data[data.length - 1]) {
      downsampled.push(data[data.length - 1]);
    }

    return downsampled;
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}

// Database manager for handling multiple databases
export class DatabaseManager {
  private databases = new Map<string, WaterLevelDatabase>();

  async loadDatabase(databaseId: string, arrayBuffer: ArrayBuffer): Promise<WaterLevelDatabase> {
    const db = new WaterLevelDatabase(arrayBuffer);
    await db.initialize();
    
    this.databases.set(databaseId, db);
    return db;
  }

  getDatabase(databaseId: string): WaterLevelDatabase | null {
    return this.databases.get(databaseId) || null;
  }

  closeDatabase(databaseId: string): void {
    const db = this.databases.get(databaseId);
    if (db) {
      db.close();
      this.databases.delete(databaseId);
    }
  }

  closeAllDatabases(): void {
    for (const [id, db] of this.databases) {
      db.close();
    }
    this.databases.clear();
  }
}

// Singleton instance
export const databaseManager = new DatabaseManager();