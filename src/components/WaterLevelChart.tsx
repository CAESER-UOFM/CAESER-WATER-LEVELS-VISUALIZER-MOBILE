'use client';

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { SamplingControls, downsampleData } from './SamplingControls';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import type { WaterLevelReading, PlotConfig, ChartDataPoint } from '@/types/database';
import { calculateOptimalSampling, formatSamplingInfo } from '@/utils/adaptiveSampling';

interface ChartMetadata {
  totalPoints: number;
  displayedPoints: number;
  manualReadings: number;
  dataRange: {
    start: string;
    end: string;
  } | null;
  viewStatus: string | null;
}

interface WaterLevelChartProps {
  data: WaterLevelReading[];
  config: PlotConfig;
  loading?: boolean;
  onMetadataChange?: (metadata: ChartMetadata) => void;
  currentSampling?: string;
  onSamplingChange?: (sampling: string) => void;
  onViewportChange?: (viewport: { start: Date; end: Date }) => Promise<any>;
  currentSamplingInfo?: {
    samplingRate: string;
    description: string;
    estimatedPoints: number;
    timeSpanDays: number;
    isHighRes: boolean;
  } | null;
  currentIntendedViewport?: {
    start: Date;
    end: Date;
    originalTimeSpanMs: number;
  } | null;
  getDataBoundaries?: () => {
    earliest: Date;
    latest: Date;
    totalSpanDays: number;
  } | null;
  isWithinDataBoundaries?: (start: Date, end: Date) => boolean;
}

interface SamplingState {
  selectedSampling: string;
  isLoadingSampling: boolean;
}

export function WaterLevelChart({ data, config, loading = false, onMetadataChange, currentSampling = '15min', onSamplingChange, onViewportChange, currentSamplingInfo, currentIntendedViewport, getDataBoundaries, isWithinDataBoundaries }: WaterLevelChartProps) {
  // CRITICAL: Handle early returns BEFORE any hooks to avoid Rules of Hooks violations
  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 loading-spinner mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading chart...</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Data to Display</h3>
          <p className="text-gray-600">Adjust your filters or date range to view data.</p>
        </div>
      </div>
    );
  }

  // ALL HOOKS MUST COME AFTER EARLY RETURNS
  const [viewWindow, setViewWindow] = useState<{ start: number; end: number } | null>(null);
  const [samplingState, setSamplingState] = useState<SamplingState>({
    selectedSampling: currentSampling,
    isLoadingSampling: false
  });
  const [showLoadHighResButton, setShowLoadHighResButton] = useState(false);
  const [isLoadingHighRes, setIsLoadingHighRes] = useState(false);
  
  // Prevent infinite loops with ref-based flags
  const isLoadingViewport = useRef(false);
  const lastViewportRequest = useRef<string>('');
  const currentViewportRef = useRef<{ start: Date; end: Date } | null>(null);

  // Update internal state when external sampling changes
  React.useEffect(() => {
    setSamplingState(prev => ({
      ...prev,
      selectedSampling: currentSampling
    }));
  }, [currentSampling]);

  // Handle sampling change
  const handleSamplingChange = useCallback((newSampling: string) => {
    setSamplingState(prev => ({
      ...prev,
      selectedSampling: newSampling,
      isLoadingSampling: true
    }));
    
    // Call external handler if provided
    if (onSamplingChange) {
      onSamplingChange(newSampling);
    }
    
    // Simulate processing time for large datasets
    setTimeout(() => {
      setSamplingState(prev => ({
        ...prev,
        isLoadingSampling: false
      }));
    }, newSampling === 'all' ? 1000 : 300);
  }, [onSamplingChange]);

  // Process data for chart (downsampling now handled at API level)
  const chartData = useMemo(() => {
    // Filter by date range if needed (though this might also be handled at API level)
    const filteredData = data.filter(reading => {
      if (!config.dateRange.start || !config.dateRange.end) return true;
      const readingDate = new Date(reading.timestamp_utc);
      return readingDate >= config.dateRange.start && readingDate <= config.dateRange.end;
    });

    const processedData: ChartDataPoint[] = filteredData
      .map(reading => ({
        timestamp: reading.timestamp_utc,
        date: new Date(reading.timestamp_utc),
        water_level: reading.water_level,
        temperature: reading.temperature,
        dtw: reading.dtw,
        source: reading.data_source,
        original_timestamp: reading.timestamp_utc
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return processedData;
  }, [data, config.dateRange]);

  // Process data for display - rely on progressive loading system
  const displayData = useMemo(() => {
    let finalData = chartData;
    
    // Only apply client-side filtering if we haven't loaded high-res data yet
    // The progressive loading system manages the actual data switching
    if (viewWindow && showLoadHighResButton) {
      // Phase 1: Apply view window filtering for immediate visual feedback while waiting for high-res
      const totalLength = chartData.length;
      const startIdx = Math.floor((viewWindow.start / 100) * totalLength);
      const endIdx = Math.floor((viewWindow.end / 100) * totalLength);
      finalData = chartData.slice(startIdx, endIdx + 1);
      console.log(`🎯 Using client-side filtered data: ${finalData.length} points (Phase 1 - waiting for high-res)`);
    } else {
      // Use data as provided by progressive loading system (could be overview or high-res)
      console.log(`🎯 Using progressive loading data: ${finalData.length} points`);
    }

    // Add manual indicator for styling
    const processedData = finalData.map(point => ({
      ...point,
      isManual: point.source === 'manual',
      // For manual readings, we'll use scatter plot
      manualWaterLevel: point.source === 'manual' ? point.water_level : null,
      // For continuous readings, we'll use line plot
      continuousWaterLevel: point.source !== 'manual' ? point.water_level : null
    }));
    
    console.log(`🎯 Chart data processing:`, {
      totalPoints: finalData.length,
      manualCount: finalData.filter(p => p.source === 'manual').length,
      continuousCount: finalData.filter(p => p.source !== 'manual').length,
      hasViewWindow: !!viewWindow,
      awaitingHighRes: showLoadHighResButton,
      isHighResMode: currentSamplingInfo?.isHighRes || false
    });
    
    return processedData;
  }, [chartData, viewWindow, showLoadHighResButton, currentSamplingInfo?.isHighRes]);

  const manualReadings = useMemo(() => {
    return displayData.filter(point => point.source === 'manual');
  }, [displayData]);

  const continuousData = useMemo(() => {
    return displayData.filter(point => point.source !== 'manual');
  }, [displayData]);

  // Calculate Y-axis domain
  const yAxisDomain = useMemo(() => {
    if (config.yAxisRange?.min !== undefined && config.yAxisRange?.max !== undefined) {
      return [config.yAxisRange.min, config.yAxisRange.max];
    }

    const waterLevels = chartData
      .map(d => d.water_level)
      .filter(val => val !== undefined && val !== null) as number[];
    
    if (waterLevels.length === 0) return ['auto', 'auto'];

    const min = Math.min(...waterLevels);
    const max = Math.max(...waterLevels);
    const padding = (max - min) * 0.1;
    
    return [min - padding, max + padding];
  }, [chartData, config.yAxisRange]);

  // Custom tooltip
  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const date = new Date(label);
    const isManual = payload[0]?.payload?.source === 'manual';

    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">
          {date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-700 capitalize">
                {entry.dataKey === 'water_level' 
                  ? isManual ? 'Manual Reading' : 'Water Level'
                  : entry.dataKey === 'temperature' 
                  ? 'Temperature' 
                  : entry.dataKey}
              </span>
            </div>
            <span className="text-sm font-medium text-gray-900">
              {entry.value?.toFixed(3)} {entry.dataKey === 'temperature' ? '°C' : 'ft'}
            </span>
          </div>
        ))}
        {isManual && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">Manual measurement</span>
          </div>
        )}
      </div>
    );
  }, []);

  // Format X-axis labels
  const formatXAxis = useCallback((tickItem: string) => {
    const date = new Date(tickItem);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: chartData.length > 100 ? '2-digit' : undefined
    });
  }, [chartData.length]);

  // Format Y-axis labels - use whole numbers for better readability
  const formatYAxis = useCallback((value: number) => {
    return Math.round(value).toString();
  }, []);


  // Smart navigation that maintains current sampling resolution
  const handleNavigateLeft = useCallback(async () => {
    setShowLoadHighResButton(false); // Hide button on navigation
    
    let newWindow;
    if (!viewWindow) {
      newWindow = { start: 0, end: 25 };
    } else {
      const windowSize = viewWindow.end - viewWindow.start;
      const newStart = Math.max(0, viewWindow.start - windowSize / 2);
      const newEnd = Math.min(100, newStart + windowSize);
      newWindow = { start: newStart, end: newEnd };
    }
    
    setViewWindow(newWindow);
    
    // Debug navigation state
    console.log(`🔍 Left navigation state:`, {
      hasCurrentSamplingInfo: !!currentSamplingInfo,
      isHighRes: currentSamplingInfo?.isHighRes,
      samplingRate: currentSamplingInfo?.samplingRate,
      description: currentSamplingInfo?.description,
      hasData: chartData.length > 0,
      hasViewportHandler: !!onViewportChange
    });
    
    // Smart navigation: If we have an intended viewport (high-res mode), automatically load data for new viewport
    if (currentIntendedViewport && onViewportChange) {
      // Use the intended viewport time span, not actual data timestamps
      const timeSpanMs = currentIntendedViewport.originalTimeSpanMs;
      const currentStartDate = currentIntendedViewport.start;
      const currentEndDate = currentIntendedViewport.end;
      
      // Shift the entire time span left by the same duration
      const newEndDate = new Date(currentStartDate.getTime());
      const newStartDate = new Date(newEndDate.getTime() - timeSpanMs);
      
      console.log(`🧭 Smart navigation left: shifting ${currentSamplingInfo?.description || 'time span'} left`);
      console.log(`📅 Current intended range: ${currentStartDate.toLocaleDateString()} to ${currentEndDate.toLocaleDateString()}`);
      console.log(`📅 New intended range: ${newStartDate.toLocaleDateString()} to ${newEndDate.toLocaleDateString()}`);
      console.log(`📅 Original time span: ${(timeSpanMs / (1000 * 60 * 60 * 24)).toFixed(1)} days (maintained)`);
      
      // Check boundaries before attempting to load
      if (isWithinDataBoundaries && !isWithinDataBoundaries(newStartDate, newEndDate)) {
        console.log(`🚫 Navigation blocked: new range is outside data boundaries`);
        const boundaries = getDataBoundaries?.();
        if (boundaries) {
          console.log(`📊 Available data range: ${boundaries.earliest.toLocaleDateString()} to ${boundaries.latest.toLocaleDateString()}`);
        }
        return; // Stop navigation
      }
      
      try {
        // Automatically load data for the new viewport at current resolution
        await onViewportChange({ start: newStartDate, end: newEndDate });
        
        console.log(`✅ Left navigation completed - progressive loading will update sampling info`);
        
      } catch (error) {
        console.error('Failed to load data for navigation:', error);
        // Show load button if automatic loading fails
        currentViewportRef.current = { start: newStartDate, end: newEndDate };
        setShowLoadHighResButton(true);
      }
    } else if (viewWindow && chartData.length > 0) {
      // Fallback: Client-side navigation for overview data
      console.log(`🔄 Client-side navigation left: shifting view window`);
      const windowSize = viewWindow.end - viewWindow.start;
      const newStart = Math.max(0, viewWindow.start - windowSize / 2);
      const newEnd = Math.min(100, newStart + windowSize);
      const newViewWindow = { start: newStart, end: newEnd };
      
      setViewWindow(newViewWindow);
      console.log(`📊 New view window: ${newViewWindow.start.toFixed(1)}% to ${newViewWindow.end.toFixed(1)}%`);
    }
  }, [viewWindow, currentSamplingInfo, chartData, onViewportChange, currentIntendedViewport, isWithinDataBoundaries, getDataBoundaries]);

  const handleNavigateRight = useCallback(async () => {
    setShowLoadHighResButton(false); // Hide button on navigation
    
    let newWindow;
    if (!viewWindow) {
      newWindow = { start: 75, end: 100 };
    } else {
      const windowSize = viewWindow.end - viewWindow.start;
      const newEnd = Math.min(100, viewWindow.end + windowSize / 2);
      const newStart = Math.max(0, newEnd - windowSize);
      newWindow = { start: newStart, end: newEnd };
    }
    
    setViewWindow(newWindow);
    
    // Debug navigation state
    console.log(`🔍 Right navigation state:`, {
      hasCurrentSamplingInfo: !!currentSamplingInfo,
      isHighRes: currentSamplingInfo?.isHighRes,
      samplingRate: currentSamplingInfo?.samplingRate,
      description: currentSamplingInfo?.description,
      hasData: chartData.length > 0,
      hasViewportHandler: !!onViewportChange
    });
    
    // Smart navigation: If we have an intended viewport (high-res mode), automatically load data for new viewport
    if (currentIntendedViewport && onViewportChange) {
      // Use the intended viewport time span, not actual data timestamps
      const timeSpanMs = currentIntendedViewport.originalTimeSpanMs;
      const currentStartDate = currentIntendedViewport.start;
      const currentEndDate = currentIntendedViewport.end;
      
      // Shift the entire time span right by the same duration
      const newStartDate = new Date(currentEndDate.getTime());
      const newEndDate = new Date(newStartDate.getTime() + timeSpanMs);
      
      console.log(`🧭 Smart navigation right: shifting ${currentSamplingInfo?.description || 'time span'} right`);
      console.log(`📅 Current intended range: ${currentStartDate.toLocaleDateString()} to ${currentEndDate.toLocaleDateString()}`);
      console.log(`📅 New intended range: ${newStartDate.toLocaleDateString()} to ${newEndDate.toLocaleDateString()}`);
      console.log(`📅 Original time span: ${(timeSpanMs / (1000 * 60 * 60 * 24)).toFixed(1)} days (maintained)`);
      
      // Check boundaries before attempting to load
      if (isWithinDataBoundaries && !isWithinDataBoundaries(newStartDate, newEndDate)) {
        console.log(`🚫 Navigation blocked: new range is outside data boundaries`);
        const boundaries = getDataBoundaries?.();
        if (boundaries) {
          console.log(`📊 Available data range: ${boundaries.earliest.toLocaleDateString()} to ${boundaries.latest.toLocaleDateString()}`);
        }
        return; // Stop navigation
      }
      
      try {
        // Automatically load data for the new viewport at current resolution
        await onViewportChange({ start: newStartDate, end: newEndDate });
        
        console.log(`✅ Right navigation completed - progressive loading will update sampling info`);
        
      } catch (error) {
        console.error('Failed to load data for navigation:', error);
        // Show load button if automatic loading fails
        currentViewportRef.current = { start: newStartDate, end: newEndDate };
        setShowLoadHighResButton(true);
      }
    } else if (viewWindow && chartData.length > 0) {
      // Fallback: Client-side navigation for overview data
      console.log(`🔄 Client-side navigation right: shifting view window`);
      const windowSize = viewWindow.end - viewWindow.start;
      const newEnd = Math.min(100, viewWindow.end + windowSize / 2);
      const newStart = Math.max(0, newEnd - windowSize);
      const newViewWindow = { start: newStart, end: newEnd };
      
      setViewWindow(newViewWindow);
      console.log(`📊 New view window: ${newViewWindow.start.toFixed(1)}% to ${newViewWindow.end.toFixed(1)}%`);
    }
  }, [viewWindow, currentSamplingInfo, chartData, onViewportChange, currentIntendedViewport, isWithinDataBoundaries, getDataBoundaries]);

  const handleResetView = useCallback(() => {
    setViewWindow(null);
    setShowLoadHighResButton(false);
    currentViewportRef.current = null;
  }, []);

  // Calculate optimal sampling for current viewport
  const optimalSampling = useMemo(() => {
    if (!currentViewportRef.current) return null;
    const viewport = currentViewportRef.current;
    return calculateOptimalSampling(viewport.start, viewport.end);
  }, [currentViewportRef.current]);

  // Handler for loading high-resolution data (Phase 2)
  const handleLoadHighResData = useCallback(async () => {
    if (!currentViewportRef.current || !onViewportChange) return;
    
    setIsLoadingHighRes(true);
    setShowLoadHighResButton(false);
    
    try {
      const viewport = currentViewportRef.current;
      const sampling = calculateOptimalSampling(viewport.start, viewport.end);
      console.log(`🎯 Loading adaptive sampling: ${formatSamplingInfo(sampling)}`);
      
      // Call the viewport change handler which will use adaptive sampling
      const result = await onViewportChange(viewport);
      
      console.log(`✅ Adaptive sampling completed for zoomed viewport`);
    } catch (error) {
      console.error('Failed to load adaptive sampling data:', error);
      // Keep showing the button so user can retry
      setShowLoadHighResButton(true);
    } finally {
      setIsLoadingHighRes(false);
    }
  }, [onViewportChange]);

  const handleZoomIn = useCallback(async () => {
    // Phase 1: Immediate client-side zoom for instant feedback
    let newWindow;
    if (!viewWindow) {
      newWindow = { start: 25, end: 75 };
    } else {
      const center = (viewWindow.start + viewWindow.end) / 2;
      const newSize = (viewWindow.end - viewWindow.start) / 2;
      const newStart = Math.max(0, center - newSize / 2);
      const newEnd = Math.min(100, center + newSize / 2);
      newWindow = { start: newStart, end: newEnd };
    }
    
    console.log(`🔍 Zoom in: ${newWindow.start.toFixed(1)}% to ${newWindow.end.toFixed(1)}%`);
    setViewWindow(newWindow);
    
    // Calculate viewport dates and automatically load high-res data
    if (chartData.length > 0 && onViewportChange) {
      const totalLength = chartData.length;
      const startIdx = Math.floor((newWindow.start / 100) * totalLength);
      const endIdx = Math.floor((newWindow.end / 100) * totalLength);
      const startDate = new Date(chartData[Math.max(0, startIdx)]?.timestamp);
      const endDate = new Date(chartData[Math.min(chartData.length - 1, endIdx)]?.timestamp);
      const timeSpanDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      console.log(`📅 Showing ${timeSpanDays.toFixed(1)} days: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
      
      // Automatically load high-res data for the zoomed viewport
      console.log(`🚀 Auto-loading high-res data for zoom...`);
      try {
        await onViewportChange({ start: startDate, end: endDate });
        console.log(`✅ High-res data loaded successfully for zoom`);
        // Keep the view window for manual control - don't auto-clear it
        // setViewWindow(null);
      } catch (error) {
        console.error('Failed to auto-load high-res data for zoom:', error);
        // Fallback: Store viewport and show load button
        currentViewportRef.current = { start: startDate, end: endDate };
        setShowLoadHighResButton(true);
      }
    } else if (chartData.length > 0) {
      // If no onViewportChange handler, just show the button
      const totalLength = chartData.length;
      const startIdx = Math.floor((newWindow.start / 100) * totalLength);
      const endIdx = Math.floor((newWindow.end / 100) * totalLength);
      const startDate = new Date(chartData[Math.max(0, startIdx)]?.timestamp);
      const endDate = new Date(chartData[Math.min(chartData.length - 1, endIdx)]?.timestamp);
      
      currentViewportRef.current = { start: startDate, end: endDate };
      setShowLoadHighResButton(true);
    }
  }, [viewWindow, chartData, onViewportChange]);

  const handleZoomOut = useCallback(() => {
    // Phase 1: Immediate client-side zoom out
    let newWindow = null;
    
    if (!viewWindow) {
      console.log('🔍 Already at full view');
      return;
    } else {
      const center = (viewWindow.start + viewWindow.end) / 2;
      const newSize = Math.min(100, (viewWindow.end - viewWindow.start) * 2);
      const newStart = Math.max(0, center - newSize / 2);
      const newEnd = Math.min(100, center + newSize / 2);
      
      if (newStart === 0 && newEnd === 100) {
        newWindow = null;
      } else {
        newWindow = { start: newStart, end: newEnd };
      }
    }
    
    console.log(`🔎 Zoom out: ${newWindow ? `${newWindow.start.toFixed(1)}% to ${newWindow.end.toFixed(1)}%` : 'full view'}`);
    setViewWindow(newWindow);
    
    // Calculate viewport dates and show load button for Phase 2
    if (chartData.length > 0 && newWindow) {
      const totalLength = chartData.length;
      const startIdx = Math.floor((newWindow.start / 100) * totalLength);
      const endIdx = Math.floor((newWindow.end / 100) * totalLength);
      const startDate = new Date(chartData[Math.max(0, startIdx)]?.timestamp);
      const endDate = new Date(chartData[Math.min(chartData.length - 1, endIdx)]?.timestamp);
      const timeSpanDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      console.log(`📅 Showing ${timeSpanDays.toFixed(1)} days: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
      
      // Store current viewport for background loading
      currentViewportRef.current = { start: startDate, end: endDate };
      
      // Show button to trigger Phase 2
      if (onViewportChange) {
        setShowLoadHighResButton(true);
      }
    }
  }, [viewWindow, chartData, onViewportChange]);

  // This line is now handled in the useMemo above
  // NOTE: Early returns have been moved to the top of the component to fix React Error #300

  // Send metadata to parent component
  const metadata: ChartMetadata = {
    totalPoints: chartData.length,
    displayedPoints: displayData.length,
    manualReadings: manualReadings.length,
    dataRange: displayData.length > 0 ? {
      start: displayData[0].date.toLocaleDateString(),
      end: displayData[displayData.length - 1].date.toLocaleDateString()
    } : null,
    viewStatus: viewWindow ? 'Navigated/Zoomed' : null
  };

  // Call metadata callback when metadata changes
  React.useEffect(() => {
    if (onMetadataChange) {
      onMetadataChange(metadata);
    }
  }, [onMetadataChange, chartData.length, displayData.length, manualReadings.length, viewWindow]);

  return (
    <div className="space-y-3">
      {/* Modern Chart Navigation */}
      <div className="space-y-2">
        {/* Sampling Controls */}
        <SamplingControls
          selectedSampling={samplingState.selectedSampling}
          onSamplingChange={handleSamplingChange}
          totalPoints={data.length}
          displayedPoints={chartData.length}
          isLoading={samplingState.isLoadingSampling}
        />

        {/* Consolidated Navigation and View Info */}
        <div className="bg-gray-50 rounded-lg p-3">
          {/* Single line with all navigation info */}
          <div className="flex items-center justify-between gap-2 mb-3">
            {/* Navigation Controls */}
            <div className="flex items-center space-x-1">
              <button
                onClick={handleNavigateLeft}
                className="flex items-center justify-center w-8 h-8 bg-white border border-gray-300 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors mobile-touch-target disabled:opacity-50 disabled:cursor-not-allowed"
                title="Navigate left"
                disabled={(() => {
                  // Check if navigation would go beyond boundaries
                  if (currentIntendedViewport && isWithinDataBoundaries) {
                    const timeSpanMs = currentIntendedViewport.originalTimeSpanMs;
                    const newEndDate = new Date(currentIntendedViewport.start.getTime());
                    const newStartDate = new Date(newEndDate.getTime() - timeSpanMs);
                    return !isWithinDataBoundaries(newStartDate, newEndDate);
                  }
                  return viewWindow?.start === 0;
                })()}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={handleZoomOut}
                className="flex items-center justify-center w-8 h-8 bg-white border border-gray-300 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors mobile-touch-target"
                title="Zoom out"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>

              <button
                onClick={handleResetView}
                className="flex items-center justify-center px-2 h-8 bg-primary-600 text-white rounded-md hover:bg-primary-700 active:bg-primary-800 transition-colors mobile-touch-target font-medium text-xs"
                title="Reset view"
              >
                Reset
              </button>

              <button
                onClick={handleZoomIn}
                className="flex items-center justify-center w-8 h-8 bg-white border border-gray-300 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors mobile-touch-target"
                title="Zoom in"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </button>

              <button
                onClick={handleNavigateRight}
                className="flex items-center justify-center w-8 h-8 bg-white border border-gray-300 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors mobile-touch-target disabled:opacity-50 disabled:cursor-not-allowed"
                title="Navigate right"
                disabled={(() => {
                  // Check if navigation would go beyond boundaries
                  if (currentIntendedViewport && isWithinDataBoundaries) {
                    const timeSpanMs = currentIntendedViewport.originalTimeSpanMs;
                    const newStartDate = new Date(currentIntendedViewport.end.getTime());
                    const newEndDate = new Date(newStartDate.getTime() + timeSpanMs);
                    return !isWithinDataBoundaries(newStartDate, newEndDate);
                  }
                  return viewWindow?.end === 100;
                })()}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* View Info and Points Count */}
            <div className="text-xs text-gray-600 text-right flex-1">
              <div className="flex items-center justify-end space-x-2">
                <span>Showing {displayData.length.toLocaleString()}</span>
                {config.showManualReadings && manualReadings.length > 0 && (
                  <span className="text-green-600">+{manualReadings.length} manual</span>
                )}
                {viewWindow && (
                  <span className="text-primary-600">
                    {Math.round(viewWindow.start)}-{Math.round(viewWindow.end)}%
                  </span>
                )}
              </div>
              
              {/* Current sampling rate display */}
              {currentSamplingInfo?.isHighRes && (
                <div className="text-primary-600 font-medium mt-1">
                  Resolution: {currentSamplingInfo.description}
                </div>
              )}
              
              {/* Always show current data range info */}
              {chartData.length > 0 && (
                <div className="text-gray-500 font-mono mt-1">
                  {(() => {
                    if (currentIntendedViewport) {
                      // Use intended viewport for display (high-res mode)
                      return `${currentIntendedViewport.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${currentIntendedViewport.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                    } else if (viewWindow) {
                      // Use view window calculation (client-side mode)
                      const startIdx = Math.floor((viewWindow.start / 100) * chartData.length);
                      const endIdx = Math.floor((viewWindow.end / 100) * chartData.length);
                      const startDate = new Date(chartData[Math.max(0, startIdx)]?.timestamp);
                      const endDate = new Date(chartData[Math.min(chartData.length - 1, endIdx)]?.timestamp);
                      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                    } else {
                      // Fallback: show full data range
                      const startDate = new Date(chartData[0]?.timestamp);
                      const endDate = new Date(chartData[chartData.length - 1]?.timestamp);
                      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                    }
                  })()}
                </div>
              )}
              
              {/* Data boundaries info */}
              {getDataBoundaries && (
                <div className="text-xs text-gray-400 mt-1">
                  {(() => {
                    const boundaries = getDataBoundaries();
                    if (boundaries) {
                      return `Available: ${boundaries.earliest.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${boundaries.latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                    }
                    return '';
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Progress bar - only show for client-side navigation */}
          {viewWindow && !currentIntendedViewport && (
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-primary-600 h-1.5 rounded-full transition-all duration-200"
                style={{
                  marginLeft: `${viewWindow.start}%`,
                  width: `${viewWindow.end - viewWindow.start}%`
                }}
              />
            </div>
          )}
          
          {/* Progress bar for high-res navigation - shows position within full dataset */}
          {currentIntendedViewport && getDataBoundaries && (
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              {(() => {
                const boundaries = getDataBoundaries();
                if (!boundaries) return null;
                
                const totalSpan = boundaries.latest.getTime() - boundaries.earliest.getTime();
                const viewportStart = currentIntendedViewport.start.getTime() - boundaries.earliest.getTime();
                const viewportSpan = currentIntendedViewport.end.getTime() - currentIntendedViewport.start.getTime();
                
                const startPercent = Math.max(0, (viewportStart / totalSpan) * 100);
                const widthPercent = Math.min(100 - startPercent, (viewportSpan / totalSpan) * 100);
                
                return (
                  <div 
                    className="bg-primary-600 h-1.5 rounded-full transition-all duration-200"
                    style={{
                      marginLeft: `${startPercent}%`,
                      width: `${widthPercent}%`
                    }}
                  />
                );
              })()}
            </div>
          )}
          
          {/* Load high-res data button (Phase 2) */}
          {showLoadHighResButton && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={handleLoadHighResData}
                disabled={isLoadingHighRes}
                className="px-4 py-2 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 active:bg-primary-800 transition-colors flex items-center space-x-2"
              >
                {isLoadingHighRes ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Loading {currentSamplingInfo?.description || optimalSampling?.samplingRate.description || 'data'}...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>
                      {currentSamplingInfo?.isHighRes ? (
                        `Load at ${currentSamplingInfo.description}`
                      ) : (
                        `Load ${optimalSampling?.estimatedPoints || '~4000'} points 
                        (${optimalSampling?.samplingRate.description || 'adaptive sampling'})`
                      )}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Chart */}
      <div className="h-96 w-full relative overflow-hidden" style={{ touchAction: 'pan-x pan-y' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              stroke="#6b7280"
              fontSize={12}
              angle={-45}
              textAnchor="end"
              height={60}
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={yAxisDomain}
              stroke="#6b7280"
              fontSize={12}
              tickFormatter={formatYAxis}
              label={{ 
                value: 'Water Level (ft)', 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle' }
              }}
            />
            {/* Secondary Y-axis for temperature */}
            {config.showTemperature && (
              <YAxis 
                yAxisId="temp"
                orientation="right"
                stroke="#6b7280"
                fontSize={12}
                label={{ 
                  value: 'Temperature (°C)', 
                  angle: 90, 
                  position: 'insideRight',
                  style: { textAnchor: 'middle' }
                }}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            
            {/* Water Level Line for continuous data */}
            {config.showWaterLevel && (
              <Line
                type="monotone"
                dataKey="continuousWaterLevel"
                stroke={config.colors.waterLevel}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: config.colors.waterLevel, strokeWidth: 2 }}
                name="Water Level"
                connectNulls={false}
              />
            )}
            
            {/* Temperature Line (secondary axis) */}
            {config.showTemperature && (
              <Line
                type="monotone"
                dataKey="temperature"
                stroke={config.colors.temperature}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: config.colors.temperature, strokeWidth: 2 }}
                name="Temperature"
                yAxisId="temp"
                connectNulls={false}
              />
            )}

            {/* Manual Readings as Scatter on the same chart */}
            {config.showManualReadings && (
              <Scatter
                dataKey="manualWaterLevel"
                fill={config.colors.manual}
                stroke={config.colors.manual}
                strokeWidth={2}
                name="Manual Readings"
              />
            )}

          </ComposedChart>
        </ResponsiveContainer>
      </div>


    </div>
  );
}