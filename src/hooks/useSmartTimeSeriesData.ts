'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { WaterLevelReading } from '@/lib/api/api';
import type { SamplingRate } from '@/utils/smartSampling';
import { smartCache } from '@/lib/cache/SmartTimeSeriesCache';
import { calculateBestSampling } from '@/utils/smartSampling';

export interface SmartTimeSeriesState {
  data: WaterLevelReading[];
  isLoading: boolean;
  error: string | null;
  currentSamplingRate: SamplingRate;
  totalDataSpanDays: number;
  cacheStats: {
    dailyOverviewCached: boolean;
    highResSegmentsCached: number;
  };
}

export interface UseSmartTimeSeriesDataOptions {
  databaseId: string;
  wellNumber: string;
  onError?: (error: string) => void;
}

export function useSmartTimeSeriesData({
  databaseId,
  wellNumber,
  onError
}: UseSmartTimeSeriesDataOptions) {
  const [state, setState] = useState<SmartTimeSeriesState>({
    data: [],
    isLoading: false,
    error: null,
    currentSamplingRate: 'daily',
    totalDataSpanDays: 0,
    cacheStats: {
      dailyOverviewCached: false,
      highResSegmentsCached: 0
    }
  });

  const [cacheInitialized, setCacheInitialized] = useState(false);

  // Initialize cache
  useEffect(() => {
    smartCache.initialize()
      .then(() => {
        setCacheInitialized(true);
      })
      .catch(error => {
        console.error('Failed to initialize cache:', error);
        setCacheInitialized(true); // Allow to proceed without cache
      });
  }, []);

  // Fetch data from API
  const fetchData = useCallback(async (
    samplingRate: SamplingRate,
    startDate?: Date,
    endDate?: Date
  ): Promise<WaterLevelReading[]> => {
    const params = new URLSearchParams({
      samplingRate,
      ...(startDate && { startDate: startDate.toISOString() }),
      ...(endDate && { endDate: endDate.toISOString() })
    });

    const response = await fetch(
      `/.netlify/functions/data/${databaseId}/water/${wellNumber}?${params}`,
      { signal: AbortSignal.timeout(30000) }
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'API request failed');
    }

    return result.data || [];
  }, [databaseId, wellNumber]);

  // Load daily overview data
  const loadDailyOverview = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check cache first (only if cache is available)
      let cachedData: WaterLevelReading[] | null = null;
      if (cacheInitialized) {
        try {
          cachedData = await smartCache.getDailyOverview(wellNumber);
        } catch (error) {
          console.warn('Cache access failed, skipping cache lookup:', error);
        }
      } else {
        console.log('⏳ Cache not ready, loading from API...');
      }
      
      if (cachedData && cachedData.length > 0) {
        console.log(`📋 Using cached daily overview: ${cachedData.length} points`);
        
        // Calculate total span
        const timeSpan = calculateTimeSpan(cachedData);
        
        setState(prev => ({
          ...prev,
          data: cachedData,
          currentSamplingRate: 'daily',
          totalDataSpanDays: timeSpan,
          isLoading: false,
          cacheStats: {
            ...prev.cacheStats,
            dailyOverviewCached: true
          }
        }));
        
        return cachedData;
      }

      // Fetch from API
      console.log('🚀 Fetching daily overview from API...');
      const data = await fetchData('daily');
      
      // Calculate total span and cache
      const timeSpan = calculateTimeSpan(data);
      
      // Store in cache (with error handling)
      try {
        await smartCache.storeDailyOverview(wellNumber, data);
      } catch (error) {
        console.warn('Failed to store data in cache:', error);
      }
      
      setState(prev => ({
        ...prev,
        data,
        currentSamplingRate: 'daily',
        totalDataSpanDays: timeSpan,
        isLoading: false,
        cacheStats: {
          ...prev.cacheStats,
          dailyOverviewCached: true
        }
      }));

      console.log(`✅ Daily overview loaded: ${data.length} points, ${timeSpan.toFixed(1)} days`);
      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load daily overview';
      console.error('Daily overview loading error:', errorMessage);
      
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
  }, [wellNumber, fetchData, onError, cacheInitialized]);

  // Load high-resolution data for a specific range
  const loadHighResolution = useCallback(async (
    startDate: Date,
    endDate: Date,
    samplingRate: SamplingRate
  ) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Check cache first (with error handling)
      let cachedData: WaterLevelReading[] | null = null;
      try {
        cachedData = await smartCache.getHighResSegment(
          wellNumber, 
          startDate, 
          endDate, 
          samplingRate
        );
      } catch (error) {
        console.warn('Cache access failed for high-res data:', error);
      }
      
      if (cachedData && cachedData.length > 0) {
        console.log(`📋 Using cached high-res data: ${cachedData.length} points`);
        
        setState(prev => ({
          ...prev,
          data: cachedData,
          currentSamplingRate: samplingRate,
          isLoading: false
        }));
        
        return cachedData;
      }

      // Fetch from API
      console.log(`🚀 Fetching ${samplingRate} data for range:`, {
        start: startDate.toLocaleDateString(),
        end: endDate.toLocaleDateString()
      });
      
      const data = await fetchData(samplingRate, startDate, endDate);
      
      // Cache the segment (with error handling)
      try {
        await smartCache.storeHighResSegment(
          wellNumber,
          startDate,
          endDate,
          samplingRate,
          data
        );
      } catch (error) {
        console.warn('Failed to store high-res data in cache:', error);
      }
      
      setState(prev => ({
        ...prev,
        data,
        currentSamplingRate: samplingRate,
        isLoading: false,
        cacheStats: {
          ...prev.cacheStats,
          highResSegmentsCached: prev.cacheStats.highResSegmentsCached + 1
        }
      }));

      console.log(`✅ High-res data loaded: ${data.length} points (${samplingRate})`);
      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load high-resolution data';
      console.error('High-res loading error:', errorMessage);
      
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
  }, [wellNumber, fetchData, onError]);

  // Switch back to daily overview
  const switchToDailyOverview = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      let cachedData: WaterLevelReading[] | null = null;
      try {
        cachedData = await smartCache.getDailyOverview(wellNumber);
      } catch (error) {
        console.warn('Cache access failed in switchToDailyOverview:', error);
      }
      
      if (cachedData && cachedData.length > 0) {
        setState(prev => ({
          ...prev,
          data: cachedData,
          currentSamplingRate: 'daily',
          isLoading: false
        }));
        
        return cachedData;
      } else {
        // Fallback to loading from API
        return await loadDailyOverview();
      }
    } catch (error) {
      // Fallback to loading from API
      return await loadDailyOverview();
    }
  }, [wellNumber, loadDailyOverview]);

  // Get smart sampling recommendation for a time range
  const getSamplingRecommendation = useCallback((startDate: Date, endDate: Date) => {
    return calculateBestSampling(startDate, endDate, 1500);
  }, []);

  // Check if high-res data is available for a range
  const checkHighResAvailability = useCallback(async (
    startDate: Date,
    endDate: Date,
    samplingRate: SamplingRate
  ) => {
    try {
      return await smartCache.hasHighResData(wellNumber, startDate, endDate, samplingRate);
    } catch (error) {
      console.warn('Cache availability check failed:', error);
      return false;
    }
  }, [wellNumber]);

  // Get cache statistics
  const getCacheStats = useCallback(async () => {
    try {
      return await smartCache.getCacheStats();
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return {
        totalSegments: 0,
        totalSizeBytes: 0,
        totalSizeMB: 0,
        dailyOverviewSegments: 0,
        highResSegments: 0,
        cacheUtilization: 0
      };
    }
  }, []);

  // Clear cache
  const clearCache = useCallback(async () => {
    try {
      await smartCache.clearCache();
      setState(prev => ({
        ...prev,
        cacheStats: {
          dailyOverviewCached: false,
          highResSegmentsCached: 0
        }
      }));
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }, []);

  // Calculate time span from data
  function calculateTimeSpan(data: WaterLevelReading[]): number {
    if (data.length === 0) return 0;
    
    const sortedData = [...data].sort((a, b) => 
      new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime()
    );
    
    const firstDate = new Date(sortedData[0].timestamp_utc);
    const lastDate = new Date(sortedData[sortedData.length - 1].timestamp_utc);
    
    return Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Get data boundaries for navigation
  const dataBoundaries = useMemo(() => {
    if (state.data.length === 0) return null;
    
    const sortedData = [...state.data].sort((a, b) => 
      new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime()
    );
    
    return {
      earliest: new Date(sortedData[0].timestamp_utc),
      latest: new Date(sortedData[sortedData.length - 1].timestamp_utc),
      totalPoints: state.data.length
    };
  }, [state.data]);

  return {
    // State
    ...state,
    dataBoundaries,
    
    // Actions
    loadDailyOverview,
    loadHighResolution,
    switchToDailyOverview,
    
    // Utilities
    getSamplingRecommendation,
    checkHighResAvailability,
    getCacheStats,
    clearCache
  };
}