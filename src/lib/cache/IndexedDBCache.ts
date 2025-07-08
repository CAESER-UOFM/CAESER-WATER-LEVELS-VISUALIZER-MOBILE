/**
 * IndexedDB cache implementation for water level data
 */

interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  ttl: number;
}

export class IndexedDBCache {
  private dbName: string;
  private storeName: string;
  private version: number;
  private db: IDBDatabase | null = null;

  constructor(dbName: string = 'WaterLevelCache', storeName: string = 'cache', version: number = 1) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.version = version;
  }

  protected async openDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  async set(key: string, data: any, ttl: number = 3600000): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      ttl
    };
    
    return new Promise((resolve, reject) => {
      const request = store.put(entry);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async get(key: string): Promise<any> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry;
        if (!entry) {
          resolve(null);
          return;
        }
        
        // Check if expired
        if (Date.now() > entry.timestamp + entry.ttl) {
          this.delete(key);
          resolve(null);
          return;
        }
        
        resolve(entry.data);
      };
    });
  }

  async delete(key: string): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getAllKeys(): Promise<string[]> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAllKeys();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }

  async size(): Promise<number> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getCacheStats(): Promise<any> {
    const size = await this.size();
    const keys = await this.getAllKeys();
    return {
      size,
      keys: keys.length,
      lastAccessed: new Date().toISOString()
    };
  }

  async getByWellNumber(wellNumber: string): Promise<any[]> {
    const keys = await this.getAllKeys();
    const wellKeys = keys.filter(key => key.includes(wellNumber));
    const results = [];
    
    for (const key of wellKeys) {
      const data = await this.get(key);
      if (data) {
        results.push({ key, data });
      }
    }
    
    return results;
  }

  // Methods needed for daily overview caching
  async storeDailyOverview(databaseId: string, wellNumber: string, data: any): Promise<void> {
    const key = `daily_overview:${databaseId}:${wellNumber}`;
    return this.set(key, data, 15 * 60 * 1000); // 15 minutes TTL
  }

  async getDailyOverview(databaseId: string, wellNumber: string): Promise<any> {
    const key = `daily_overview:${databaseId}:${wellNumber}`;
    return this.get(key);
  }

  // Methods for well statistics caching  
  async storeWellStatistics(databaseId: string, wellNumber: string, data: any): Promise<void> {
    const key = `well_stats:${databaseId}:${wellNumber}`;
    return this.set(key, data, 30 * 60 * 1000); // 30 minutes TTL
  }

  async getWellStatistics(databaseId: string, wellNumber: string): Promise<any> {
    const key = `well_stats:${databaseId}:${wellNumber}`;
    return this.get(key);
  }

  // Methods for wells locations caching
  async storeWellsLocations(databaseId: string, data: any): Promise<void> {
    const key = `wells_locations:${databaseId}`;
    return this.set(key, data, 20 * 60 * 1000); // 20 minutes TTL
  }

  async getWellsLocations(databaseId: string): Promise<any> {
    const key = `wells_locations:${databaseId}`;
    return this.get(key);
  }
}

export default IndexedDBCache;

// Create singleton instance
export const indexedDBCache = new IndexedDBCache();