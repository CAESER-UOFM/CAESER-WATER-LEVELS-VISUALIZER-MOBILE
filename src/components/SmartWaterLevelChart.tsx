'use client';

import React, { useEffect, useCallback, useState, useImperativeHandle, useRef } from 'react';
import { ChartJSTimeSeriesChart } from './ChartJSTimeSeriesChart';
import { useSmartTimeSeriesData } from '@/hooks/useSmartTimeSeriesData';
import type { SamplingRate } from '@/utils/smartSampling';

export interface SmartWaterLevelChartProps {
  databaseId: string;
  wellNumber: string;
  title?: string;
  height?: number;
  className?: string;
  onError?: (error: string) => void;
  onInfoUpdate?: (info: {
    totalPoints: number;
    displayedPoints: number;
    samplingRate: string;
    dataRange: { start: string; end: string } | null;
    isHighRes: boolean;
    zoomedRange?: { start: string; end: string } | null;
    currentData?: any[];
  }) => void;
}

export const SmartWaterLevelChart = React.forwardRef<
  { switchToDailyOverview: () => void; resetZoom: () => void; isZoomed: boolean },
  SmartWaterLevelChartProps
>(({ 
  databaseId,
  wellNumber,
  title,
  height = 400,
  className = '',
  onError,
  onInfoUpdate
}, ref) => {
  const {
    data,
    isLoading,
    error,
    currentSamplingRate,
    totalDataSpanDays,
    dataBoundaries,
    loadDailyOverview,
    loadHighResolution,
    switchToDailyOverview,
    getSamplingRecommendation
  } = useSmartTimeSeriesData({
    databaseId,
    wellNumber,
    onError
  });

  const [isZoomed, setIsZoomed] = useState(false);
  const [currentZoomRange, setCurrentZoomRange] = useState<{ start: Date; end: Date } | null>(null);
  const chartResetRef = useRef<(() => void) | null>(null);

  // Load initial daily overview - only once on mount
  useEffect(() => {
    loadDailyOverview().catch(error => {
      console.error('Failed to load initial data:', error);
    });
  }, []); // Empty deps - only run once on mount

  // Handle zoom changes
  const handleZoomChange = useCallback((startDate: Date, endDate: Date) => {
    console.log('Zoom changed:', { 
      start: startDate.toLocaleDateString(), 
      end: endDate.toLocaleDateString() 
    });
    
    // Calculate how much of the total range this represents
    const zoomSpanDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const zoomPercentage = totalDataSpanDays > 0 ? (zoomSpanDays / totalDataSpanDays) * 100 : 0;
    
    console.log(`Zoomed to ${zoomSpanDays.toFixed(1)} days (${zoomPercentage.toFixed(1)}% of total)`);
    setIsZoomed(true);
    setCurrentZoomRange({ start: startDate, end: endDate });
  }, [totalDataSpanDays]);

  // Handle high-resolution requests
  const handleHighResRequest = useCallback(async (
    startDate: Date, 
    endDate: Date, 
    samplingRate: SamplingRate
  ) => {
    console.log('High-res requested:', { 
      start: startDate.toLocaleDateString(), 
      end: endDate.toLocaleDateString(),
      samplingRate 
    });
    
    try {
      await loadHighResolution(startDate, endDate, samplingRate);
    } catch (error) {
      console.error('Failed to load high-resolution data:', error);
    }
  }, [loadHighResolution]);

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Update parent with chart info when data changes
  useEffect(() => {
    if (onInfoUpdate && data.length > 0) {
      const sortedData = [...data].sort((a, b) => 
        new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime()
      );
      
      const samplingLabel = currentSamplingRate === 'daily' ? 'Daily' :
                           currentSamplingRate === '6hour' ? '6 Hours' :
                           currentSamplingRate === '1hour' ? 'Hourly' :
                           currentSamplingRate === '15min' ? '15 Minutes' :
                           currentSamplingRate;
      
      onInfoUpdate({
        totalPoints: totalDataSpanDays || 0,
        displayedPoints: data.length,
        samplingRate: `${samplingLabel} sampling`,
        dataRange: {
          start: sortedData[0].timestamp_utc,
          end: sortedData[sortedData.length - 1].timestamp_utc
        },
        isHighRes: currentSamplingRate !== 'daily',
        currentData: sortedData.map(reading => ({
          timestamp: reading.timestamp_utc,
          water_level: reading.water_level,
          temperature: reading.temperature,
          reading_type: reading.data_source === 'manual' ? 'manual' : 'transducer'
        }))
      });
    }
  }, [data.length, currentSamplingRate, totalDataSpanDays]); // Removed onInfoUpdate to prevent loops

  // Custom reset zoom function
  const resetZoom = useCallback(() => {
    if ((window as any).chartResetZoom) {
      (window as any).chartResetZoom();
      setIsZoomed(false);
      setCurrentZoomRange(null);
    }
  }, []);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    switchToDailyOverview,
    resetZoom,
    isZoomed
  }), [switchToDailyOverview, resetZoom, isZoomed]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-red-900">Error Loading Data</span>
          </div>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <button
            onClick={() => loadDailyOverview()}
            className="mt-2 px-3 py-1 bg-red-100 text-red-800 text-sm rounded hover:bg-red-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Chart */}
      <ChartJSTimeSeriesChart
        data={data}
        wellNumber={wellNumber}
        title={title}
        height={height}
        onZoomChange={handleZoomChange}
        onHighResRequest={handleHighResRequest}
        isLoading={isLoading}
        currentSamplingRate={currentSamplingRate}
        totalDataSpanDays={totalDataSpanDays}
      />

      {/* Current Display Info */}
      <div className="mt-3 space-y-2">
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-sm font-medium text-gray-700 mb-3">Currently Loaded</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Points Loaded:</span>
              <p className="text-green-600 font-semibold">{data.length.toLocaleString()}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Sampling Rate:</span>
              <p className="text-purple-600 font-semibold">{currentSamplingRate}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Time Range:</span>
              {currentZoomRange ? (
                <p className="text-gray-900 font-semibold">
                  {currentZoomRange.start.toLocaleDateString()} to {currentZoomRange.end.toLocaleDateString()}
                </p>
              ) : dataBoundaries ? (
                <p className="text-gray-900 font-semibold">
                  {dataBoundaries.earliest.toLocaleDateString()} to {dataBoundaries.latest.toLocaleDateString()}
                </p>
              ) : (
                <p className="text-gray-500">Loading...</p>
              )}
            </div>
            <div>
              <span className="font-medium text-gray-700">Days Shown:</span>
              <p className="text-orange-600 font-semibold">
                {currentZoomRange ? 
                  `${Math.ceil((currentZoomRange.end.getTime() - currentZoomRange.start.getTime()) / (1000 * 60 * 60 * 24))} days`
                  : totalDataSpanDays > 0 ? `${totalDataSpanDays.toFixed(0)} days` : 'Unknown'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="flex items-center justify-center">
          <div className="text-xs text-gray-600">
            💡 Drag to pan • Scroll to zoom • Zoom in for higher resolution
          </div>
        </div>
      </div>
    </div>
  );
});

SmartWaterLevelChart.displayName = 'SmartWaterLevelChart';