// API type definitions for the water level visualizer backend

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export interface DatabaseInfo {
  id: string;
  name: string;
  size: number;
  modified: string;
  wellsCount?: number;
  readingsCount?: number;
  lastUpdate?: string | null;
  wellFields?: string[];
  downloadUrl?: string;
  mimeType?: string;
}

export interface Well {
  well_number: string;
  cae_number?: string;
  well_field?: string;
  cluster?: string;
  latitude?: number;
  longitude?: number;
  top_of_casing?: number;
  ground_elevation?: number;
  well_depth?: number;
  screen_top?: number;
  screen_bottom?: number;
  aquifer_type?: 'confined' | 'unconfined' | 'semiconfined';
  static_water_level?: number;
  notes?: string;
  last_reading_date?: string;
  total_readings?: number;
  manual_readings_count?: number;
  has_manual_readings?: boolean;
  has_transducer_data?: boolean;
  has_telemetry_data?: boolean;
}

export interface WaterLevelReading {
  id?: number;
  well_number: string;
  timestamp_utc: string;
  julian_timestamp?: number;
  water_level?: number;
  temperature?: number;
  dtw?: number;
  data_source: 'transducer' | 'telemetry' | 'manual';
  baro_flag?: string;
  level_flag?: string;
  notes?: string;
}

export interface RechargeResult {
  id?: number;
  well_number: string;
  method: 'RISE' | 'MRC' | 'ERC' | 'EMR';
  calculation_date: string;
  start_date: string;
  end_date: string;
  recharge_mm?: number;
  recharge_inches?: number;
  specific_yield?: number;
  water_table_rise?: number;
  calculation_parameters?: string | Record<string, any>;
  notes?: string;
}

export interface WellsQueryParams {
  search?: string;
  aquifer?: string;
  dataType?: string;
  page?: number;
  limit?: number;
  sortBy?: 'well_number' | 'cae_number';
  sortOrder?: 'asc' | 'desc';
}

export interface DataQueryParams {
  wellNumber: string;
  startDate?: string;
  endDate?: string;
  dataType?: 'all' | 'transducer' | 'telemetry' | 'manual';
  downsample?: boolean;
  maxPoints?: number;
  level?: 1 | 2 | 3; // Progressive loading levels: 1=Overview, 2=Medium, 3=Full (legacy)
  samplingRate?: '15min' | '30min' | '1hour' | '3hour' | '6hour' | '12hour' | '1day' | 'daily' | '3day' | '1week' | '1month'; // Adaptive sampling
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface DatabaseCache {
  filePath: string;
  fileSize: number;
  lastModified: string;
  downloadedAt: number;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  size: string;
  modifiedTime: string;
  mimeType: string;
  parents?: string[];
}