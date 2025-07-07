'use client';

import React, { useMemo, useRef } from 'react';
import { downsampleData } from './SamplingControls';
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
import { useViewMode } from '@/contexts/ViewModeContext';
import { ViewModeSelector } from './ViewModeSelector';
import { ViewModeNavigation } from './ViewModeNavigation';

interface WaterLevelChartViewModeProps {
  data: WaterLevelReading[];
  config: PlotConfig;
  loading?: boolean;
  onMetadataChange?: (metadata: any) => void;
}

export function WaterLevelChartViewMode({ 
  data, 
  config, 
  loading = false, 
  onMetadataChange 
}: WaterLevelChartViewModeProps) {
  const { viewMode, config: viewConfig } = useViewMode();
  const containerRef = useRef<HTMLDivElement>(null);

  // Transform data for chart rendering
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const transformed = data.map(reading => ({
      timestamp: new Date(reading.timestamp_utc).getTime(),
      value: reading.water_level_m,
      manual: reading.is_manual_reading || false,
      quality: reading.data_quality || 'good',
      displayTime: new Date(reading.timestamp_utc).toLocaleString(),
      id: reading.reading_id
    }));

    // Update metadata
    if (onMetadataChange && data.length > 0) {
      const manualCount = transformed.filter(d => d.manual).length;
      const sortedData = [...data].sort((a, b) => 
        new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime()
      );

      onMetadataChange({
        totalPoints: data.length,
        displayedPoints: transformed.length,
        manualReadings: manualCount,
        dataRange: {
          start: sortedData[0].timestamp_utc,
          end: sortedData[sortedData.length - 1].timestamp_utc
        },
        viewStatus: `${viewConfig.label} view: ${data.length} points at ${viewConfig.samplingRate} resolution`
      });
    }

    return transformed;
  }, [data, onMetadataChange, viewConfig]);

  // Separate manual and automatic readings
  const { automaticData, manualData } = useMemo(() => {
    const automatic = chartData.filter(d => !d.manual);
    const manual = chartData.filter(d => d.manual);
    return { automaticData: automatic, manualData: manual };
  }, [chartData]);

  // Custom X-axis formatter
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    if (viewMode.currentMode === 'full' || viewMode.currentMode === '1year') {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else if (viewMode.currentMode === '6month') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2 border border-gray-200 rounded shadow-sm">
          <p className="text-sm font-medium">{data.displayTime}</p>
          <p className="text-sm">
            Water Level: <span className="font-medium">{data.value.toFixed(3)} m</span>
          </p>
          {data.manual && (
            <p className="text-xs text-blue-600">Manual Reading</p>
          )}
          {data.quality !== 'good' && (
            <p className="text-xs text-orange-600">Quality: {data.quality}</p>
          )}
        </div>
      );
    }
    return null;
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <ViewModeSelector disabled />
        <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="w-8 h-8 loading-spinner mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading {viewConfig.label} view...</p>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!data || data.length === 0) {
    return (
      <div className="space-y-4">
        <ViewModeSelector />
        <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600">No data found for the selected time range.</p>
          </div>
        </div>
      </div>
    );
  }

  // Choose chart type based on config
  const renderChart = () => {
    const chartProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    const axisProps = {
      xAxis: {
        dataKey: 'timestamp',
        type: 'number' as const,
        domain: ['dataMin', 'dataMax'],
        tickFormatter: formatXAxis
      },
      yAxis: {
        label: { value: 'Water Level (m)', angle: -90, position: 'insideLeft' }
      }
    };

    if (config.type === 'scatter') {
      return (
        <ScatterChart {...chartProps}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis {...axisProps.xAxis} />
          <YAxis {...axisProps.yAxis} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {!config.hideAutomaticReadings && (
            <Scatter
              name="Automatic Readings"
              data={automaticData}
              fill={config.automaticColor || '#3B82F6'}
            />
          )}
          {!config.hideManualReadings && (
            <Scatter
              name="Manual Readings"
              data={manualData}
              fill={config.manualColor || '#EF4444'}
            />
          )}
        </ScatterChart>
      );
    }

    if (config.type === 'combined') {
      return (
        <ComposedChart {...chartProps}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis {...axisProps.xAxis} />
          <YAxis {...axisProps.yAxis} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {!config.hideAutomaticReadings && (
            <Line
              type="monotone"
              dataKey="value"
              data={automaticData}
              stroke={config.automaticColor || '#3B82F6'}
              dot={false}
              name="Automatic Readings"
            />
          )}
          {!config.hideManualReadings && (
            <Scatter
              name="Manual Readings"
              data={manualData}
              fill={config.manualColor || '#EF4444'}
            />
          )}
          {config.showAverage && (
            <ReferenceLine
              y={chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length}
              stroke="#10B981"
              strokeDasharray="5 5"
              label="Average"
            />
          )}
        </ComposedChart>
      );
    }

    // Default to line chart
    return (
      <LineChart {...chartProps}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis {...axisProps.xAxis} />
        <YAxis {...axisProps.yAxis} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        {!config.hideAutomaticReadings && automaticData.length > 0 && (
          <Line
            type="monotone"
            dataKey="value"
            data={automaticData}
            stroke={config.automaticColor || '#3B82F6'}
            strokeWidth={2}
            dot={false}
            name="Automatic Readings"
          />
        )}
        {!config.hideManualReadings && manualData.length > 0 && (
          <Line
            type="monotone"
            dataKey="value"
            data={manualData}
            stroke={config.manualColor || '#EF4444'}
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Manual Readings"
          />
        )}
      </LineChart>
    );
  };

  return (
    <div className="space-y-4" ref={containerRef}>
      {/* View mode selector */}
      <ViewModeSelector />
      
      {/* Navigation controls */}
      <ViewModeNavigation />
      
      {/* Chart */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data summary */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="font-medium">Total Points:</span> {chartData.length}
          </div>
          <div>
            <span className="font-medium">Resolution:</span> {viewConfig.samplingRate}
          </div>
          <div>
            <span className="font-medium">Manual Readings:</span> {manualData.length}
          </div>
          <div>
            <span className="font-medium">View Mode:</span> {viewConfig.label}
          </div>
        </div>
      </div>
    </div>
  );
}