'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ResolutionMode, ResolutionCalculation } from '@/types/database';
import type { WaterLevelReading } from '@/lib/api/api';
import { calculateOptimalSampling, formatSamplingInfo, type AdaptiveSamplingResult, calculateResolutionSampling } from '@/utils/adaptiveSampling';
import { smartDataFetcher, type DataFetchRequest, type DataFetchResult } from '@/lib/services/SmartDataFetcher';

export interface LoadedDataSegment {
  level: 1 | 2 | 3;
  data: WaterLevelReading[];
  startDate?: string;
  endDate?: string;
  loadedAt: Date;
  viewport?: {
    start: Date;
    end: Date;
  };
  // Enhanced resolution information
  resolution?: ResolutionMode;
  resolutionCalculation?: ResolutionCalculation;
  fetchResult?: DataFetchResult;
  samplingInfo?: {
    samplingRate: string;
    description: string;
    estimatedPoints: number;
    timeSpanDays: number;
    isHighRes: boolean;
  };
  // Track the intended viewport vs actual data availability
  intendedViewport?: {
    start: Date;
    end: Date;
    originalTimeSpanMs: number;
  };
}

export interface ProgressiveLoadingState {
  segments: LoadedDataSegment[];
  currentLevel: 1 | 2 | 3;
  isLoading: boolean;
  error: string | null;
  totalDataPoints: number;
}

export interface UseProgressiveLoadingOptions {
  databaseId: string;
  wellNumber: string;
  onError?: (error: string) => void;
  // New resolution-aware options
  defaultResolution?: ResolutionMode;
  enableSmartCaching?: boolean;
}

export function useProgressiveLoading({
  databaseId,
  wellNumber,
  onError,
  defaultResolution = 'full',
  enableSmartCaching = true
}: UseProgressiveLoadingOptions) {
  const [state, setState] = useState<ProgressiveLoadingState>({
    segments: [],
    currentLevel: 1,
    isLoading: false,
    error: null,
    totalDataPoints: 0
  });

  // Cache for loaded segments to avoid re-requests
  const [cache] = useState(new Map<string, LoadedDataSegment>());

  // Generate cache key for a data request
  const getCacheKey = useCallback((level: 1 | 2 | 3, startDate?: string, endDate?: string) => {
    return `${level}-${startDate || 'all'}-${endDate || 'all'}`;
  }, []);

  // Load data for a specific level
  const loadDataLevel = useCallback(async (
    level: 1 | 2 | 3,
    startDate?: string,
    endDate?: string,
    viewport?: { start: Date; end: Date },
    backgroundMode = false // If true, don't update current state
  ) => {
    const cacheKey = getCacheKey(level, startDate, endDate);
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`📋 Using cached data for level ${level}`);
      return cached.data;
    }

    // Check if already loading this specific request
    const loadingKey = `loading-${cacheKey}`;
    if (cache.has(loadingKey)) {
      console.log(`⏳ Already loading ${cacheKey}, skipping duplicate request`);
      return [];
    }
    
    // Mark as loading
    cache.set(loadingKey, { data: [], loadedAt: new Date(), level } as any);

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const params = new URLSearchParams({
        level: level.toString(),
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        // Add cache buster to force fresh API calls
        v: Date.now().toString()
      });

      const response = await fetch(`/.netlify/functions/data/${databaseId}/water/${wellNumber}?${params}`, {
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        if (response.status === 502 || response.status === 504) {
          throw new Error(`Server timeout for level ${level} - try a smaller date range`);
        }
        throw new Error(`Failed to load level ${level}: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || `Failed to load level ${level} data`);
      }

      const data = result.data as WaterLevelReading[];
      console.log(`📊 Loaded level ${level}: ${data.length} points (expected: ${level === 1 ? '~5000' : level === 2 ? '~12000' : '~25000'})`);

      // Create segment with basic sampling info
      const segment: LoadedDataSegment = {
        level,
        data,
        startDate,
        endDate,
        loadedAt: new Date(),
        viewport,
        samplingInfo: {
          samplingRate: level === 1 ? 'Overview' : `Level ${level}`,
          description: level === 1 ? 'Overview data' : `Level ${level} detail`,
          estimatedPoints: data.length,
          timeSpanDays: viewport ? (viewport.end.getTime() - viewport.start.getTime()) / (1000 * 60 * 60 * 24) : 0,
          isHighRes: false
        }
      };

      // Cache the segment and clear loading flag
      cache.set(cacheKey, segment);
      cache.delete(`loading-${cacheKey}`);

      // Update state only if not in background mode
      if (!backgroundMode) {
        setState(prev => {
          const existingSegments = prev.segments.filter(s => !(s.level === level && s.startDate === startDate && s.endDate === endDate));
          return {
            ...prev,
            segments: [...existingSegments, segment],
            currentLevel: level,
            totalDataPoints: existingSegments.reduce((sum, s) => sum + s.data.length, 0) + data.length,
            isLoading: false
          };
        });
      } else {
        // In background mode, just clear loading state but don't update segments
        setState(prev => ({ ...prev, isLoading: false }));
      }

      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to load level ${level} data`;
      console.error('Progressive loading error:', errorMessage);
      
      // Clear loading flag on error
      cache.delete(`loading-${cacheKey}`);
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      
      if (onError) {
        onError(errorMessage);
      }
      
      throw err;
    }
  }, [databaseId, wellNumber, cache, getCacheKey, onError]);

  // Get current best data for display
  const getCurrentData = useCallback(() => {
    if (state.segments.length === 0) return [];

    // Prioritize the most recently loaded data for best user experience
    // This ensures adaptive sampling data takes precedence over overview data
    const sortedSegments = [...state.segments].sort((a, b) => {
      // First priority: Most recent loadedAt time
      const timeDiff = new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      
      // Second priority: Highest level (more detailed data)
      return b.level - a.level;
    });
    
    const currentSegment = sortedSegments[0];
    console.log(`📊 getCurrentData: Using segment loaded at ${currentSegment?.loadedAt} with ${currentSegment?.data.length} points`);
    return currentSegment?.data || [];
  }, [state.segments]);

  // Get current sampling information
  const getCurrentSamplingInfo = useCallback(() => {
    if (state.segments.length === 0) return null;

    // Use the same logic as getCurrentData to find the current segment
    const sortedSegments = [...state.segments].sort((a, b) => {
      const timeDiff = new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.level - a.level;
    });
    
    const currentSegment = sortedSegments[0];
    return currentSegment?.samplingInfo || null;
  }, [state.segments]);

  // Get current intended viewport (for navigation)
  const getCurrentIntendedViewport = useCallback(() => {
    if (state.segments.length === 0) return null;

    // Use the same logic as getCurrentData to find the current segment
    const sortedSegments = [...state.segments].sort((a, b) => {
      const timeDiff = new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.level - a.level;
    });
    
    const currentSegment = sortedSegments[0];
    return currentSegment?.intendedViewport || null;
  }, [state.segments]);

  // Get the actual data boundaries from all loaded segments
  const getDataBoundaries = useCallback((): { earliest: Date; latest: Date; totalSpanDays: number } | null => {
    if (state.segments.length === 0) return null;

    // Find the earliest and latest timestamps across all segments
    const timestamps: Date[] = [];

    state.segments.forEach(segment => {
      if (segment.data.length === 0) return;

      timestamps.push(new Date(segment.data[0].timestamp_utc));
      timestamps.push(new Date(segment.data[segment.data.length - 1].timestamp_utc));
    });

    if (timestamps.length === 0) return null;

    const earliest = new Date(Math.min(...timestamps.map(d => d.getTime())));
    const latest = new Date(Math.max(...timestamps.map(d => d.getTime())));

    return {
      earliest,
      latest,
      totalSpanDays: (latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)
    };
  }, [state.segments]);

  // Check if a proposed viewport would be within data boundaries
  const isWithinDataBoundaries = useCallback((proposedStart: Date, proposedEnd: Date) => {
    const boundaries = getDataBoundaries();
    if (!boundaries) return true; // Allow if no data loaded yet

    // Use strict boundaries - no buffer to prevent loading empty data
    const bufferMs = 0; // No buffer
    const allowedStart = new Date(boundaries.earliest.getTime() - bufferMs);
    const allowedEnd = new Date(boundaries.latest.getTime() + bufferMs);

    // Require BOTH start and end to be fully within boundaries
    const isStartValid = proposedStart >= allowedStart;
    const isEndValid = proposedEnd <= allowedEnd;
    
    // Extra check: make sure the entire range has data
    const rangeOverlaps = proposedStart < boundaries.latest && proposedEnd > boundaries.earliest;

    const withinBounds = isStartValid && isEndValid && rangeOverlaps;

    console.log(`🔍 Boundary check:`, {
      proposedRange: `${proposedStart.toLocaleDateString()} to ${proposedEnd.toLocaleDateString()}`,
      dataRange: `${boundaries.earliest.toLocaleDateString()} to ${boundaries.latest.toLocaleDateString()}`,
      isStartValid,
      isEndValid,
      rangeOverlaps,
      withinBounds
    });

    return withinBounds;
  }, [getDataBoundaries]);

  // Load initial overview data (full dataset)
  const loadOverview = useCallback(async () => {
    console.log('🚀 Loading overview - expecting ~5000 points for full dataset');
    return loadDataLevel(1);
  }, [loadDataLevel]);

  // Load data for specific time range (always ~5000 points)
  const loadForTimeRange = useCallback(async (startDate: string, endDate: string) => {
    const viewport = { start: new Date(startDate), end: new Date(endDate) };
    const timeSpanDays = (viewport.end.getTime() - viewport.start.getTime()) / (1000 * 60 * 60 * 24);
    console.log(`🚀 Loading ${timeSpanDays.toFixed(1)} days - expecting ~5000 points for time range`);
    return loadDataLevel(1, startDate, endDate, viewport);
  }, [loadDataLevel]);

  // NEW: Resolution-aware data loading with smart caching
  const loadWithResolution = useCallback(async (
    resolution: ResolutionMode,
    startDate: Date,
    endDate: Date,
    priority: 'high' | 'medium' | 'low' = 'high'
  ) => {
    if (!enableSmartCaching) {
      // Fallback to legacy loading
      return loadForTimeRange(startDate.toISOString(), endDate.toISOString());
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log(`🎯 Loading with resolution: ${resolution}`);
      
      // Use the smart data fetcher
      const fetchRequest: DataFetchRequest = {
        wellNumber,
        resolution,
        startDate,
        endDate,
        priority,
        useCache: true
      };

      const result = await smartDataFetcher.fetchData(fetchRequest);
      
      console.log(`✅ Smart fetch complete: ${result.totalPoints} points, ${(result.cacheHitRatio * 100).toFixed(1)}% cache hit`);

      // Create segment with enhanced resolution information
      const segment: LoadedDataSegment = {
        level: 1,
        data: result.data,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        loadedAt: new Date(),
        viewport: { start: startDate, end: endDate },
        resolution,
        resolutionCalculation: result.resolution,
        fetchResult: result,
        samplingInfo: {
          samplingRate: resolution,
          description: `${resolution} mode (${result.resolution.samplingInterval}min intervals)`,
          estimatedPoints: result.resolution.estimatedPoints,
          timeSpanDays: result.resolution.actualTimeSpan,
          isHighRes: true
        },
        intendedViewport: {
          start: startDate,
          end: endDate,
          originalTimeSpanMs: endDate.getTime() - startDate.getTime()
        }
      };

      // Update state with new segment
      setState(prev => {
        const existingSegments = prev.segments.filter(s => 
          !(s.resolution === resolution && s.startDate === startDate.toISOString() && s.endDate === endDate.toISOString())
        );
        
        return {
          ...prev,
          segments: [...existingSegments, segment],
          currentLevel: 1,
          totalDataPoints: existingSegments.reduce((sum, s) => sum + s.data.length, 0) + result.totalPoints,
          isLoading: false
        };
      });

      // Trigger background prefetching for adjacent data
      if (result.missingSegments.length === 0) {
        // Only prefetch if we got a complete cache hit
        smartDataFetcher.prefetchAdjacentData(wellNumber, resolution, startDate, endDate, 'both')
          .catch(error => console.debug('Background prefetch failed:', error));
      }

      return result.data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Resolution loading failed';
      console.error('Resolution loading error:', errorMessage);
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      
      if (onError) {
        onError(errorMessage);
      }
      
      throw error;
    }
  }, [wellNumber, enableSmartCaching, loadForTimeRange, onError]);

  // Load data with specific sampling rate (background only - no state updates)
  const loadDataWithSampling = useCallback(async (
    samplingRate: string,
    startDate: string,
    endDate: string,
    viewport: { start: Date; end: Date }
  ) => {
    const cacheKey = `adaptive-${samplingRate}-${startDate}-${endDate}`;
    
    // Check if already loading this specific request
    const loadingKey = `loading-${cacheKey}`;
    if (cache.has(loadingKey)) {
      console.log(`⏳ Already loading ${samplingRate} data, skipping duplicate request`);
      return [];
    }
    
    // Mark as loading
    cache.set(loadingKey, { data: [], loadedAt: new Date(), level: 1 } as any);

    // Only update loading state (minimal state change)
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const params = new URLSearchParams({
        samplingRate,
        startDate,
        endDate,
        // Add cache buster to force fresh API calls
        v: Date.now().toString()
      });

      const response = await fetch(`/.netlify/functions/data/${databaseId}/water/${wellNumber}?${params}`, {
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        if (response.status === 502 || response.status === 504) {
          throw new Error(`Server timeout for ${samplingRate} sampling - try a smaller date range`);
        }
        throw new Error(`Failed to load ${samplingRate} data: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || `Failed to load ${samplingRate} data`);
      }

      const data = result.data as WaterLevelReading[];
      console.log(`📊 Loaded ${samplingRate}: ${data.length} points`);

      // Create segment with sampling info
      const timeSpanDays = (viewport.end.getTime() - viewport.start.getTime()) / (1000 * 60 * 60 * 24);
      const segment: LoadedDataSegment = {
        level: 1,
        data,
        startDate,
        endDate,
        loadedAt: new Date(),
        viewport,
        samplingInfo: {
          samplingRate: samplingRate,
          description: `${samplingRate} sampling`,
          estimatedPoints: data.length,
          timeSpanDays: timeSpanDays,
          isHighRes: true
        }
      };

      // ONLY cache the data - DO NOT update React state to prevent infinite loops
      cache.set(cacheKey, segment);
      cache.delete(`loading-${cacheKey}`);

      // Only clear loading state (no data updates)
      setState(prev => ({ ...prev, isLoading: false }));

      console.log(`💾 Data cached but not applied - avoiding React loops`);
      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to load ${samplingRate} data`;
      console.error('Adaptive sampling error:', errorMessage);
      
      // Clear loading flag on error
      cache.delete(`loading-${cacheKey}`);
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage 
      }));
      
      if (onError) {
        onError(errorMessage);
      }
      
      throw err;
    }
  }, [databaseId, wellNumber, cache, onError]);

  // Apply cached data to current view (manual trigger)
  const applyCachedData = useCallback((samplingRate: string, startDate: string, endDate: string, viewport: { start: Date; end: Date }) => {
    const cacheKey = `adaptive-${samplingRate}-${startDate}-${endDate}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log(`🎯 Applying cached ${samplingRate} data: ${cached.data.length} points`);
      
      // Create a fresh segment with current timestamp to ensure it takes precedence
      const freshSegment: LoadedDataSegment = {
        ...cached,
        loadedAt: new Date() // Update timestamp to make it the most recent
      };
      
      // Update state with cached data
      setState(prev => {
        const existingSegments = prev.segments.filter(s => !(s.level === 1 && s.startDate === startDate && s.endDate === endDate));
        const newSegments = [...existingSegments, freshSegment];
        
        console.log(`📊 State update: ${newSegments.length} segments, newest has ${freshSegment.data.length} points`);
        
        return {
          ...prev,
          segments: newSegments,
          currentLevel: 1,
          totalDataPoints: existingSegments.reduce((sum, s) => sum + s.data.length, 0) + freshSegment.data.length
        };
      });
      
      return cached.data;
    }
    
    return [];
  }, [cache]);

  // Viewport loading with adaptive sampling - background loading only
  const loadForViewport = useCallback(async (viewport: { start: Date; end: Date }) => {
    const timeSpanMs = viewport.end.getTime() - viewport.start.getTime();
    const timeSpanDays = timeSpanMs / (1000 * 60 * 60 * 24);
    
    // Calculate optimal sampling rate for this time range
    const sampling = calculateOptimalSampling(viewport.start, viewport.end);
    const samplingInfo = formatSamplingInfo(sampling);
    
    const startDate = viewport.start.toISOString();
    const endDate = viewport.end.toISOString();
    
    // Use sampling rate in cache key for better caching
    const cacheKey = `adaptive-${sampling.samplingRate.name}-${startDate}-${endDate}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log(`📋 Smart cache hit: ${samplingInfo}`);
      // Apply cached data immediately since it's already loaded
      return applyCachedData(sampling.samplingRate.name, startDate, endDate, viewport);
    }
    
    console.log(`🎯 Adaptive sampling requested: ${samplingInfo}`);
    console.log(`🚀 ${sampling.recommendation}`);

    // Load fresh data using adaptive sampling (background only)
    // Inline the sampling logic to avoid circular dependencies
    const samplingCacheKey = `adaptive-${sampling.samplingRate.name}-${startDate}-${endDate}`;
    const loadingKey = `loading-${samplingCacheKey}`;
    
    try {
      
      if (cache.has(loadingKey)) {
        console.log(`⏳ Already loading ${sampling.samplingRate.name} data, skipping duplicate request`);
        return [];
      }
      
      // Mark as loading
      cache.set(loadingKey, { data: [], loadedAt: new Date(), level: 1 } as any);
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const params = new URLSearchParams({
        samplingRate: sampling.samplingRate.name,
        startDate,
        endDate,
        v: Date.now().toString()
      });

      const response = await fetch(`/.netlify/functions/data/${databaseId}/water/${wellNumber}?${params}`, {
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        if (response.status === 502 || response.status === 504) {
          throw new Error(`Server timeout for ${sampling.samplingRate.name} sampling - try a smaller date range`);
        }
        throw new Error(`Failed to load ${sampling.samplingRate.name} data: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || `Failed to load ${sampling.samplingRate.name} data`);
      }

      const data = result.data as WaterLevelReading[];
      console.log(`📊 Loaded ${sampling.samplingRate.name}: ${data.length} points`);

      // Create segment with sampling info and intended viewport
      const originalTimeSpanMs = viewport.end.getTime() - viewport.start.getTime();
      const segment: LoadedDataSegment = {
        level: 1,
        data,
        startDate,
        endDate,
        loadedAt: new Date(),
        viewport,
        samplingInfo: {
          samplingRate: sampling.samplingRate.name,
          description: sampling.samplingRate.description,
          estimatedPoints: sampling.estimatedPoints,
          timeSpanDays: sampling.timeSpanDays,
          isHighRes: true
        },
        intendedViewport: {
          start: viewport.start,
          end: viewport.end,
          originalTimeSpanMs: originalTimeSpanMs
        }
      };

      // Cache the data and clear loading flag
      cache.set(samplingCacheKey, segment);
      cache.delete(loadingKey);
      setState(prev => ({ ...prev, isLoading: false }));
      
      console.log(`💾 Data loaded and cached: ${data.length} points with ${sampling.samplingRate.description}`);
      
      // Now apply the data to avoid React loops
      return applyCachedData(sampling.samplingRate.name, startDate, endDate, viewport);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Loading failed';
      console.error('Adaptive sampling failed:', err);
      
      // Clean up loading state
      cache.delete(loadingKey);
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      
      if (onError) {
        onError(errorMessage);
      }
      
      throw err; // Re-throw so button can show again
    }
  }, [cache, applyCachedData, databaseId, wellNumber, onError]);

  // Clear cache and reset
  const reset = useCallback(() => {
    console.log('🗑️ Clearing progressive loading cache and resetting state');
    cache.clear();
    setState({
      segments: [],
      currentLevel: 1,
      isLoading: false,
      error: null,
      totalDataPoints: 0
    });
  }, [cache]);

  // Get loading statistics
  const stats = useMemo(() => {
    const totalSegments = state.segments.length;
    const levelCounts = state.segments.reduce((acc, segment) => {
      acc[segment.level] = (acc[segment.level] || 0) + 1;
      return acc;
    }, {} as Record<1 | 2 | 3, number>);

    return {
      totalSegments,
      levelCounts,
      currentLevel: state.currentLevel,
      totalDataPoints: state.totalDataPoints,
      cacheSize: cache.size
    };
  }, [state.segments, state.currentLevel, state.totalDataPoints, cache.size]);

  return {
    // Data
    currentData: getCurrentData(),
    currentSamplingInfo: getCurrentSamplingInfo(),
    currentIntendedViewport: getCurrentIntendedViewport(),
    segments: state.segments,
    
    // State
    currentLevel: state.currentLevel,
    isLoading: state.isLoading,
    error: state.error,
    stats,
    
    // Boundary functions
    getDataBoundaries,
    isWithinDataBoundaries,
    
    // Actions
    loadOverview,
    loadForTimeRange,
    loadForViewport,
    loadWithResolution, // NEW: Resolution-aware loading
    applyCachedData,
    reset
  };
}