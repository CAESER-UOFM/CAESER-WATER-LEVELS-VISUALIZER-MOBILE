// TypeScript interfaces for water level monitoring database entities
// Based on the existing visualizer database schema

export interface DatabaseInfo {
  id: string;
  name: string;
  uploadDate: string;
  wellsCount: number;
  size: number;
  url?: string;
  filename: string;
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
  has_manual_readings?: boolean;
  has_transducer_data?: boolean;
  has_telemetry_data?: boolean;
}

export interface WaterLevelReading {
  id?: number;
  well_number: string;
  timestamp_utc: string;
  julian_timestamp: number;
  water_level: number;
  temperature?: number;
  dtw?: number; // depth to water
  data_source: 'transducer' | 'telemetry' | 'manual';
  baro_flag?: string;
  level_flag?: string;
  notes?: string;
}

export interface ManualReading {
  id?: number;
  well_number: string;
  timestamp_utc: string;
  julian_timestamp: number;
  water_level: number;
  dtw?: number;
  measured_by?: string;
  method?: string;
  notes?: string;
}

export interface Transducer {
  serial_number: string;
  well_number?: string;
  model?: string;
  manufacturer?: string;
  installation_date?: string;
  removal_date?: string;
  depth_below_toc?: number;
  cable_length?: number;
  notes?: string;
}

export interface Barologger {
  serial_number: string;
  location?: string;
  model?: string;
  manufacturer?: string;
  installation_date?: string;
  removal_date?: string;
  latitude?: number;
  longitude?: number;
  elevation?: number;
  notes?: string;
}

export interface RechargeResult {
  id?: number;
  well_number: string;
  method: 'RISE' | 'MRC' | 'EMR';
  calculation_date: string;
  start_date: string;
  end_date: string;
  recharge_mm?: number;
  recharge_inches?: number;
  specific_yield?: number;
  water_table_rise?: number;
  calculation_parameters?: Record<string, any>;
  notes?: string;
}

// Enhanced interfaces based on desktop implementation

// RISE Method Results
export interface RISECalculationResult {
  id: number;
  well_number: string;
  calculation_date: string;
  parameters: {
    specific_yield: number;
    rise_threshold: number;
    water_year_start_month: number;
    water_year_start_day: number;
    downsample_rule?: string;
    downsample_method?: string;
    filter_type?: string;
    filter_window?: number;
  };
  events_data: RISEEvent[];
  yearly_summary: RISEYearlySummary[];
  total_recharge: number;
  total_events: number;
  annual_rate: number;
  notes?: string;
}

export interface RISEEvent {
  event_date: string;
  water_year: number;
  water_level: number;
  rise_magnitude: number;
  recharge_value: number;
}

export interface RISEYearlySummary {
  water_year: number;
  total_recharge: number;
  num_events: number;
  annual_rate: number;
  max_rise: number;
  avg_rise: number;
}

// MRC Method Results
export interface MRCCalculationResult {
  id: number;
  curve_id: number;
  well_number: string;
  well_name: string;
  calculation_date: string;
  specific_yield: number;
  deviation_threshold: number;
  water_year_start_month: number;
  water_year_start_day: number;
  downsample_rule?: string;
  downsample_method?: string;
  filter_type?: string;
  filter_window?: number;
  total_recharge: number;
  annual_rate: number;
  data_start_date?: string;
  data_end_date?: string;
  recharge_events: MRCRechargeEvent[];
  yearly_summaries: MRCYearlySummary[];
  curve_info?: MRCCurveInfo;
  notes?: string;
}

export interface MRCRechargeEvent {
  event_date: string;
  water_year: number;
  water_level: number;
  predicted_level: number;
  deviation: number;
  recharge_value: number;
}

export interface MRCYearlySummary {
  water_year: number;
  total_recharge: number;
  num_events: number;
  annual_rate: number;
  max_deviation: number;
  avg_deviation: number;
}

export interface MRCCurveInfo {
  curve_type: string;
  curve_parameters: Record<string, any>;
  r_squared: number;
  creation_date: string;
  version: number;
}

// Unified summary interface for API responses
export interface RechargeCalculationSummary {
  id: number;
  well_number: string;
  method: 'RISE' | 'MRC';
  calculation_date: string;
  total_recharge: number;
  annual_rate: number;
  total_events: number;
  specific_yield: number;
  data_start_date?: string;
  data_end_date?: string;
  notes?: string;
  details?: any; // Contains method-specific detailed data
}

// API Response types
export interface ApiResponse<T> {
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

// Query parameters
export interface WellsQueryParams {
  search?: string;
  aquifer?: string;
  dataType?: string;
  page?: number;
  limit?: number;
  sortBy?: 'well_number' | 'cae_number' | 'last_reading_date';
  sortOrder?: 'asc' | 'desc';
}

export interface DataQueryParams {
  wellNumber: string;
  startDate?: string;
  endDate?: string;
  dataType?: 'all' | 'transducer' | 'telemetry' | 'manual';
  downsample?: boolean;
  maxPoints?: number;
  level?: 1 | 2 | 3; // Progressive loading levels: 1=Overview, 2=Medium, 3=Full
  samplingRate?: '15min' | '30min' | '1hour' | '3hour' | '6hour' | '12hour' | '1day' | 'daily' | '3day' | '1week' | '1month';
}

// Chart data types
export interface ChartDataPoint {
  timestamp: string;
  date: Date;
  water_level?: number;
  temperature?: number;
  dtw?: number;
  source: string;
  original_timestamp?: string;
}

export interface PlotConfig {
  showWaterLevel: boolean;
  showTemperature: boolean;
  showManualReadings: boolean;
  dateRange: {
    start?: Date;
    end?: Date;
  };
  yAxisRange?: {
    min?: number;
    max?: number;
  };
  colors: {
    waterLevel: string;
    temperature: string;
    manual: string;
  };
}


// Export data types
export interface ExportConfig {
  wellNumber: string;
  startDate?: string;
  endDate?: string;
  format: 'csv' | 'json';
  includeMetadata: boolean;
  dataTypes: string[];
  downsample?: boolean;
  maxPoints?: number;
}

export interface ExportData {
  metadata: {
    well: Well;
    exportDate: string;
    dateRange: {
      start: string;
      end: string;
    };
    totalPoints: number;
    dataTypes: string[];
  };
  data: WaterLevelReading[];
}