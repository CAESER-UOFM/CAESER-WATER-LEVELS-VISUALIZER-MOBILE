'use client';

import React, { useState, useEffect } from 'react';
import { indexedDBCache } from '@/lib/cache/IndexedDBCache';
import { formatDistanceToNow } from 'date-fns';

interface CacheManagementProps {
  wellNumber: string;
  onCacheCleared?: () => void;
}

export function CacheManagement({ wellNumber, onCacheCleared }: CacheManagementProps) {
  const [stats, setStats] = useState<any>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const loadCacheInfo = async () => {
    try {
      setLoading(true);
      const [cacheStats, wellSegments] = await Promise.all([
        indexedDBCache.getCacheStats(),
        indexedDBCache.getByWellNumber(wellNumber)
      ]);
      
      setStats(cacheStats);
      setSegments(wellSegments);
    } catch (error) {
      console.error('Error loading cache info:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCacheInfo();
  }, [wellNumber]);

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear the cache for this well?')) {
      return;
    }

    setClearing(true);
    try {
      for (const segment of segments) {
        await indexedDBCache.delete(segment.id);
      }
      await loadCacheInfo();
      if (onCacheCleared) {
        onCacheCleared();
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  const handleClearAllCache = async () => {
    if (!confirm('Are you sure you want to clear ALL cached data? This will affect all wells.')) {
      return;
    }

    setClearing(true);
    try {
      await indexedDBCache.clear();
      await loadCacheInfo();
      if (onCacheCleared) {
        onCacheCleared();
      }
    } catch (error) {
      console.error('Error clearing all cache:', error);
      alert('Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cache Management</h3>
        
        {/* Global cache stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded p-3">
            <p className="text-sm text-gray-600">Total Size</p>
            <p className="text-xl font-semibold text-gray-900">
              {stats?.totalSizeMB.toFixed(2)} MB
            </p>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <p className="text-sm text-gray-600">Utilization</p>
            <p className="text-xl font-semibold text-gray-900">
              {stats?.cacheUtilization.toFixed(1)}%
            </p>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <p className="text-sm text-gray-600">Total Segments</p>
            <p className="text-xl font-semibold text-gray-900">
              {stats?.segmentCount || 0}
            </p>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <p className="text-sm text-gray-600">This Well</p>
            <p className="text-xl font-semibold text-gray-900">
              {segments.length} segments
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Cache Usage</span>
            <span>{stats?.totalSizeMB.toFixed(2)} / 50 MB</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(stats?.cacheUtilization || 0, 100)}%` }}
            />
          </div>
        </div>

        {/* Cached segments for this well */}
        {segments.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Cached Time Ranges</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {segments.map((segment, index) => (
                <div key={segment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                  <div className="flex-1">
                    <span className="font-medium">{segment.samplingRate}</span>
                    <span className="text-gray-600 ml-2">
                      {new Date(segment.startDate).toLocaleDateString()} - {new Date(segment.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-right text-gray-500">
                    <div>{(segment.sizeBytes / 1024).toFixed(1)} KB</div>
                    <div className="text-xs">
                      {formatDistanceToNow(new Date(segment.cachedAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleClearCache}
            disabled={clearing || segments.length === 0}
            className={`
              flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${clearing || segments.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              }
            `}
          >
            {clearing ? 'Clearing...' : `Clear Cache for Well ${wellNumber}`}
          </button>
          
          <button
            onClick={handleClearAllCache}
            disabled={clearing || stats?.segmentCount === 0}
            className={`
              flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${clearing || stats?.segmentCount === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-red-100 text-red-700 hover:bg-red-200'
              }
            `}
          >
            {clearing ? 'Clearing...' : 'Clear All Cache'}
          </button>
        </div>
      </div>

      {/* Info text */}
      <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-700">
        <p className="font-medium mb-1">About Cache</p>
        <p>
          Data is automatically cached to improve loading performance. The cache uses up to 50MB of browser storage
          and automatically removes old data when full. Cached data expires after 7 days.
        </p>
      </div>
    </div>
  );
}