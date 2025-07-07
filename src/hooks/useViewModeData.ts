'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useViewMode } from '@/contexts/ViewModeContext';
import { indexedDBCache, type CachedDataSegment } from '@/lib/cache/IndexedDBCache';
import type { WaterLevelReading } from '@/lib/api/api';
import { differenceInDays } from 'date-fns';

interface UseViewModeDataOptions {
  databaseId: string;
  wellNumber: string;
  onError?: (error: string) => void;
}

interface DataState {
  data: WaterLevelReading[];
  isLoading: boolean;
  error: string | null;
  cacheHit: boolean;
  metadata: {
    totalPoints: number;
    dateRange: {
      start: Date;
      end: Date;
    } | null;
    cacheStatus: {
      hit: boolean;
      preloaded: boolean;
      cachedSegments: number;
    };
  };
}

export function useViewModeData({
  databaseId,
  wellNumber,
  onError
}: UseViewModeDataOptions) {
  const { viewMode, config, getDateRange } = useViewMode();
  
  const [state, setState] = useState<DataState>({
    data: [],
    isLoading: false,
    error: null,
    cacheHit: false,
    metadata: {
      totalPoints: 0,
      dateRange: null,
      cacheStatus: {
        hit: false,
        preloaded: false,
        cachedSegments: 0
      }
    }
  });

  // Initialize cache on mount
  useEffect(() => {
    indexedDBCache.initialize().catch(err => {
      console.error('Failed to initialize IndexedDB cache:', err);
    });
  }, []);

  // Calculate appropriate sampling rate for full view
  const calculateFullViewSampling = useCallback(async (): Promise<string> => {
    try {
      // First, get the data range from the API
      const response = await fetch(`/.netlify/functions/data/${databaseId}/water/${wellNumber}/range`);
      if (!response.ok) {
        throw new Error('Failed to fetch data range');
      }
      
      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error('Invalid data range response');
      }

      const { startDate, endDate } = result.data;
      const start = new Date(startDate);
      const end = new Date(endDate);
      const totalDays = differenceInDays(end, start);
      
      // Calculate sampling to get ~5000 points
      const targetPoints = config.targetPoints;
      const totalMinutes = totalDays * 24 * 60;
      const minutesPerPoint = Math.ceil(totalMinutes / targetPoints);
      
      // Round to standard intervals
      if (minutesPerPoint <= 15) return '15min';
      if (minutesPerPoint <= 30) return '30min';
      if (minutesPerPoint <= 60) return '1hour';
      if (minutesPerPoint <= 180) return '3hour';
      if (minutesPerPoint <= 360) return '6hour';
      if (minutesPerPoint <= 720) return '12hour';
      if (minutesPerPoint <= 1440) return '1day';
      if (minutesPerPoint <= 2880) return '2day';
      return '1week';
      
    } catch (err) {
      console.error('Failed to calculate full view sampling:', err);
      return '1day'; // Fallback
    }
  }, [databaseId, wellNumber, config.targetPoints]);

  // Load data for current view mode
  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const dateRange = getDateRange();
      const startDate = dateRange.start.toISOString();
      const endDate = dateRange.end.toISOString();
      
      // Determine sampling rate
      let samplingRate = config.samplingRate;
      if (samplingRate === 'adaptive') {
        samplingRate = await calculateFullViewSampling();
      }

      // Generate cache key
      const cacheKey = indexedDBCache.generateCacheKey(
        wellNumber,
        samplingRate,
        startDate,
        endDate
      );

      // Check cache first
      let cachedSegment = await indexedDBCache.get(cacheKey);
      
      if (cachedSegment) {
        console.log(`🎯 Cache hit for ${config.label} view`);
        setState(prev => ({
          ...prev,
          data: cachedSegment!.data,
          isLoading: false,
          cacheHit: true,
          metadata: {
            totalPoints: cachedSegment!.data.length,
            dateRange: {
              start: new Date(cachedSegment!.startDate),
              end: new Date(cachedSegment!.endDate)
            },
            cacheStatus: {
              hit: true,
              preloaded: false,
              cachedSegments: 1
            }
          }
        }));
        
        // Preload adjacent ranges in background
        preloadAdjacentRanges(samplingRate);
        return;
      }

      // Fetch from API
      console.log(`📡 Loading ${config.label} view from API`);
      const params = new URLSearchParams({
        samplingRate,
        startDate,
        endDate
      });

      const response = await fetch(
        `/.netlify/functions/data/${databaseId}/water/${wellNumber}?${params}`,
        { signal: AbortSignal.timeout(30000) }
      );

      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to load data');
      }

      const data = result.data as WaterLevelReading[];
      
      // Cache the data
      const segment: CachedDataSegment = {
        id: cacheKey,
        wellNumber,
        samplingRate,
        startDate,
        endDate,
        data,
        cachedAt: new Date(),
        lastAccessed: new Date(),
        sizeBytes: 0 // Will be calculated by cache
      };
      
      await indexedDBCache.put(segment);
      
      setState(prev => ({
        ...prev,
        data,
        isLoading: false,
        cacheHit: false,
        metadata: {
          totalPoints: data.length,
          dateRange: {
            start: new Date(startDate),
            end: new Date(endDate)
          },
          cacheStatus: {
            hit: false,
            preloaded: false,
            cachedSegments: 1
          }
        }
      }));

      // Preload adjacent ranges
      preloadAdjacentRanges(samplingRate);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      console.error('Error loading view mode data:', err);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      
      if (onError) {
        onError(errorMessage);
      }
    }
  }, [viewMode, config, getDateRange, wellNumber, databaseId, calculateFullViewSampling, onError]);

  // Preload adjacent time ranges based on view mode config
  const preloadAdjacentRanges = useCallback(async (samplingRate: string) => {
    if (viewMode.currentMode === 'full') return; // No preloading for full view
    
    const preloadOffsets = config.preloadStrategy;
    const dateRange = getDateRange();
    
    for (const offset of preloadOffsets) {
      if (offset === 0) continue; // Skip current range
      
      // Calculate offset dates based on navigation step
      let offsetStart: Date;
      let offsetEnd: Date;
      
      const step = config.navigationStep;
      const monthsToAdd = step.unit === 'month' ? step.value * offset : 0;
      const yearsToAdd = step.unit === 'year' ? step.value * offset : 0;
      
      if (monthsToAdd !== 0) {
        offsetStart = new Date(dateRange.start);
        offsetEnd = new Date(dateRange.end);
        offsetStart.setMonth(offsetStart.getMonth() + monthsToAdd);
        offsetEnd.setMonth(offsetEnd.getMonth() + monthsToAdd);
      } else if (yearsToAdd !== 0) {
        offsetStart = new Date(dateRange.start);
        offsetEnd = new Date(dateRange.end);
        offsetStart.setFullYear(offsetStart.getFullYear() + yearsToAdd);
        offsetEnd.setFullYear(offsetEnd.getFullYear() + yearsToAdd);
      } else {
        continue;
      }
      
      const cacheKey = indexedDBCache.generateCacheKey(
        wellNumber,
        samplingRate,
        offsetStart.toISOString(),
        offsetEnd.toISOString()
      );
      
      // Check if already cached
      const existing = await indexedDBCache.get(cacheKey);
      if (existing) continue;
      
      // Preload in background
      console.log(`🔄 Preloading ${offset > 0 ? 'next' : 'previous'} ${step.value} ${step.unit}(s)`);
      
      fetch(
        `/.netlify/functions/data/${databaseId}/water/${wellNumber}?` +
        new URLSearchParams({
          samplingRate,
          startDate: offsetStart.toISOString(),
          endDate: offsetEnd.toISOString()
        })
      )
      .then(async response => {
        if (!response.ok) return;
        const result = await response.json();
        if (result.success && result.data) {
          const segment: CachedDataSegment = {
            id: cacheKey,
            wellNumber,
            samplingRate,
            startDate: offsetStart.toISOString(),
            endDate: offsetEnd.toISOString(),
            data: result.data,
            cachedAt: new Date(),
            lastAccessed: new Date(),
            sizeBytes: 0
          };
          await indexedDBCache.put(segment);
          console.log(`✅ Preloaded ${offset > 0 ? 'next' : 'previous'} range`);
        }
      })
      .catch(err => {
        console.warn('Preload failed:', err);
      });
    }
  }, [viewMode.currentMode, config, getDateRange, wellNumber, databaseId]);

  // Reload data when view mode or date range changes
  useEffect(() => {
    loadData();
  }, [viewMode.currentMode, viewMode.centerDate]);

  // Get cache statistics
  const getCacheStats = useCallback(async () => {
    return await indexedDBCache.getCacheStats();
  }, []);

  // Clear cache for this well
  const clearCache = useCallback(async () => {
    const segments = await indexedDBCache.getByWellNumber(wellNumber);
    for (const segment of segments) {
      await indexedDBCache.delete(segment.id);
    }
    console.log(`🗑️ Cleared cache for well ${wellNumber}`);
  }, [wellNumber]);

  return {
    // Data
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    metadata: state.metadata,
    
    // Cache info
    cacheHit: state.cacheHit,
    getCacheStats,
    clearCache,
    
    // Actions
    reload: loadData
  };
}