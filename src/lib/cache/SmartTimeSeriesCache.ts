/**
 * Smart caching for time series data with adaptive sampling
 */

import { IndexedDBCache } from './IndexedDBCache';

export interface TimeSeriesData {
  timestamp: number;
  value: number;
  wellNumber: string;
  metadata?: Record<string, any>;
}

export interface CacheStats {
  hitRate: number;
  totalRequests: number;
  totalHits: number;
  cacheSize: number;
  avgResponseTime: number;
}

export class SmartTimeSeriesCache extends IndexedDBCache {
  private stats: CacheStats = {
    hitRate: 0,
    totalRequests: 0,
    totalHits: 0,
    cacheSize: 0,
    avgResponseTime: 0
  };

  constructor() {
    super('SmartTimeSeriesCache', 'timeseries', 1);
  }

  async initialize(): Promise<void> {
    // Initialize the IndexedDB database
    try {
      await this.openDB();
    } catch (error) {
      console.error('Failed to initialize SmartTimeSeriesCache:', error);
      throw error;
    }
  }

  async cacheTimeSeriesData(
    key: string,
    data: TimeSeriesData[],
    ttl: number = 3600000
  ): Promise<void> {
    await this.set(key, data, ttl);
    this.stats.cacheSize = await this.size();
  }

  async getTimeSeriesData(key: string): Promise<TimeSeriesData[] | null> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    const data = await this.get(key);
    
    if (data) {
      this.stats.totalHits++;
    }

    this.stats.hitRate = (this.stats.totalHits / this.stats.totalRequests) * 100;
    this.stats.avgResponseTime = ((this.stats.avgResponseTime * (this.stats.totalRequests - 1)) + 
      (Date.now() - startTime)) / this.stats.totalRequests;

    return data;
  }

  async getDataRange(
    wellNumber: string,
    startDate: Date,
    endDate: Date,
    resolution: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<TimeSeriesData[] | null> {
    const key = `${wellNumber}-${startDate.toISOString()}-${endDate.toISOString()}-${resolution}`;
    return this.getTimeSeriesData(key);
  }

  async cacheDataRange(
    wellNumber: string,
    startDate: Date,
    endDate: Date,
    data: TimeSeriesData[],
    resolution: 'high' | 'medium' | 'low' = 'medium',
    ttl: number = 3600000
  ): Promise<void> {
    const key = `${wellNumber}-${startDate.toISOString()}-${endDate.toISOString()}-${resolution}`;
    await this.cacheTimeSeriesData(key, data, ttl);
  }

  async invalidateWellData(wellNumber: string): Promise<void> {
    const allKeys = await this.getAllKeys();
    const wellKeys = allKeys.filter(key => key.startsWith(`${wellNumber}-`));
    
    for (const key of wellKeys) {
      await this.delete(key);
    }
    
    this.stats.cacheSize = await this.size();
  }

  async getStats(): Promise<CacheStats> {
    this.stats.cacheSize = await this.size();
    return { ...this.stats };
  }

  async clearStats(): Promise<void> {
    this.stats = {
      hitRate: 0,
      totalRequests: 0,
      totalHits: 0,
      cacheSize: await this.size(),
      avgResponseTime: 0
    };
  }

  async optimizeCache(): Promise<void> {
    // Remove expired entries and optimize storage
    const allKeys = await this.getAllKeys();
    const now = Date.now();
    
    for (const key of allKeys) {
      const data = await this.get(key);
      if (!data) {
        // Entry was expired during get, already removed
        continue;
      }
    }
    
    this.stats.cacheSize = await this.size();
  }

  async preloadData(
    wellNumber: string,
    dateRanges: { start: Date; end: Date }[],
    resolution: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<void> {
    // Preload commonly accessed data ranges
    for (const range of dateRanges) {
      const key = `${wellNumber}-${range.start.toISOString()}-${range.end.toISOString()}-${resolution}`;
      
      // Check if already cached
      const existing = await this.get(key);
      if (!existing) {
        // Mark as preloading (you would implement actual data fetching here)
        await this.set(`${key}-preloading`, true, 300000); // 5 min TTL
      }
    }
  }
}

export default SmartTimeSeriesCache;

// Create singleton instance
export const smartCache = new SmartTimeSeriesCache();