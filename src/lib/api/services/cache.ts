import NodeCache from 'node-cache';
import { CacheEntry } from '../api';

export class CacheService {
  private cache: NodeCache;

  constructor() {
    // Initialize with default TTL of 15 minutes
    this.cache = new NodeCache({
      stdTTL: 15 * 60, // 15 minutes
      checkperiod: 5 * 60, // Check for expired keys every 5 minutes
      useClones: false // Better performance for read-heavy operations
    });
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    return this.cache.set(key, value, ttl || 0);
  }

  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  del(key: string): number {
    return this.cache.del(key);
  }

  flush(): void {
    this.cache.flushAll();
  }

  // Get cache statistics
  getStats() {
    return this.cache.getStats();
  }

  // Set cache with custom TTL for different data types
  setDatabaseList<T>(data: T): boolean {
    return this.set('databases:list', data, 60 * 60); // 1 hour TTL
  }

  getDatabaseList<T>(): T | undefined {
    return this.get<T>('databases:list');
  }

  setWells(databaseId: string, params: string, data: any): boolean {
    const key = `wells:${databaseId}:${params}`;
    return this.set(key, data, 10 * 60); // 10 minutes TTL
  }

  getWells(databaseId: string, params: string): any {
    const key = `wells:${databaseId}:${params}`;
    return this.get(key);
  }

  setWaterLevelData(databaseId: string, params: string, data: any): boolean {
    const key = `data:${databaseId}:${params}`;
    return this.set(key, data, 5 * 60); // 5 minutes TTL
  }

  getWaterLevelData(databaseId: string, params: string): any {
    const key = `data:${databaseId}:${params}`;
    return this.get(key);
  }

  setRechargeResults(databaseId: string, wellNumber: string, data: any): boolean {
    const key = `recharge:${databaseId}:${wellNumber}`;
    return this.set(key, data, 30 * 60); // 30 minutes TTL
  }

  getRechargeResults(databaseId: string, wellNumber: string): any {
    const key = `recharge:${databaseId}:${wellNumber}`;
    return this.get(key);
  }

  setDatabaseStats(databaseId: string, data: any): boolean {
    const key = `stats:${databaseId}`;
    return this.set(key, data, 30 * 60); // 30 minutes TTL
  }

  getDatabaseStats(databaseId: string): any {
    const key = `stats:${databaseId}`;
    return this.get(key);
  }

  // Clear cache for a specific database
  clearDatabaseCache(databaseId: string): void {
    const keys = this.cache.keys();
    const databaseKeys = keys.filter(key => 
      key.includes(`:${databaseId}:`) || key.endsWith(`:${databaseId}`)
    );
    
    databaseKeys.forEach(key => this.cache.del(key));
  }

  // Generate cache key for query parameters
  static generateParamsKey(params: Record<string, any>): string {
    return JSON.stringify(params, Object.keys(params).sort());
  }
}

// Singleton instance
export const cacheService = new CacheService();