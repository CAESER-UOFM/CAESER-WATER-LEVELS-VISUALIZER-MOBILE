// API client for communicating with Netlify Functions
import type { 
  Well, 
  WaterLevelReading, 
  RechargeResult,
  WellsQueryParams,
  DataQueryParams,
  PaginatedResponse 
} from '@/types/database';

// Types for API responses
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: any;
}

interface DatabaseInfo {
  id: string;
  name: string;
  size: number;
  modified: string;
  wellsCount?: number;
  readingsCount?: number;
  lastUpdate?: string | null;
  wellFields?: string[];
}

class WaterLevelApiClient {
  private baseUrl: string;

  constructor() {
    // In production, this will be the same domain
    // In development, we might need to adjust this
    this.baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  }

  // Database operations
  async listDatabases(): Promise<DatabaseInfo[]> {
    const response = await fetch(`${this.baseUrl}/.netlify/functions/databases`);
    const result: ApiResponse<DatabaseInfo[]> = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch databases');
    }
    
    return result.data;
  }

  async getDatabaseInfo(databaseId: string): Promise<DatabaseInfo> {
    const response = await fetch(`${this.baseUrl}/.netlify/functions/databases/${databaseId}`);
    const result: ApiResponse<DatabaseInfo> = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch database info');
    }
    
    return result.data;
  }

  async refreshDatabaseCache(databaseId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/.netlify/functions/databases/${databaseId}/refresh`, {
      method: 'POST'
    });
    const result: ApiResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to refresh database cache');
    }
  }

  // Wells operations
  async getWells(databaseId: string, params: WellsQueryParams = {}): Promise<PaginatedResponse<Well>> {
    const queryString = new URLSearchParams();
    
    if (params.search) queryString.set('search', params.search);
    if (params.aquifer) queryString.set('aquifer', params.aquifer);
    if (params.dataType) queryString.set('dataType', params.dataType);
    if (params.page) queryString.set('page', params.page.toString());
    if (params.limit) queryString.set('limit', params.limit.toString());
    if (params.sortBy) queryString.set('sortBy', params.sortBy);
    if (params.sortOrder) queryString.set('sortOrder', params.sortOrder);

    const url = `${this.baseUrl}/.netlify/functions/wells/${databaseId}?${queryString}`;
    const response = await fetch(url);
    const result: PaginatedResponse<Well> = await response.json();
    
    if (!result.success) {
      throw new Error('Failed to fetch wells');
    }
    
    return result;
  }

  async getWell(databaseId: string, wellNumber: string): Promise<Well | null> {
    const response = await fetch(`${this.baseUrl}/.netlify/functions/wells/${databaseId}/${wellNumber}`);
    const result: ApiResponse<Well> = await response.json();
    
    if (!result.success) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(result.error || 'Failed to fetch well');
    }
    
    return result.data || null;
  }

  async getWellFields(databaseId: string): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/.netlify/functions/wells/${databaseId}/fields`);
    const result: ApiResponse<string[]> = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch well fields');
    }
    
    return result.data;
  }

  // Data operations
  async getWaterLevelData(databaseId: string, params: DataQueryParams): Promise<WaterLevelReading[]> {
    const queryString = new URLSearchParams();
    
    if (params.startDate) queryString.set('startDate', params.startDate);
    if (params.endDate) queryString.set('endDate', params.endDate);
    if (params.dataType) queryString.set('dataType', params.dataType);
    if (params.downsample !== undefined) queryString.set('downsample', params.downsample.toString());
    if (params.maxPoints) queryString.set('maxPoints', params.maxPoints.toString());

    const url = `${this.baseUrl}/.netlify/functions/data/${databaseId}/water/${params.wellNumber}?${queryString}`;
    const response = await fetch(url);
    const result: ApiResponse<WaterLevelReading[]> = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch water level data');
    }
    
    return result.data;
  }

  async getRechargeResults(databaseId: string, wellNumber: string): Promise<RechargeResult[]> {
    const response = await fetch(`${this.baseUrl}/.netlify/functions/data/${databaseId}/recharge/${wellNumber}`);
    const result: ApiResponse<RechargeResult[]> = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch recharge results');
    }
    
    return result.data;
  }

  async getDataSummary(databaseId: string, wellNumber: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/.netlify/functions/data/${databaseId}/summary/${wellNumber}`);
    const result: ApiResponse = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch data summary');
    }
    
    return result.data;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/.netlify/functions/health`);
      const result = await response.json();
      return result.success === true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const apiClient = new WaterLevelApiClient();

// Also export the types for use in components
export type { DatabaseInfo, ApiResponse };