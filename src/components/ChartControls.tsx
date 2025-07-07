'use client';

import { useState, useCallback } from 'react';
import type { PlotConfig, Well } from '@/types/database';

interface ChartControlsProps {
  config: PlotConfig;
  onConfigChange: (config: Partial<PlotConfig>) => void;
  onDateRangeChange: (startDate?: Date, endDate?: Date) => void;
  well: Well;
  dataCount: number;
}

export function ChartControls({ 
  config, 
  onConfigChange, 
  onDateRangeChange, 
  well, 
  dataCount 
}: ChartControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    start: '',
    end: ''
  });

  // Date range presets
  const datePresets = [
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 3 Months', days: 90 },
    { label: 'Last 6 Months', days: 180 },
    { label: 'Last Year', days: 365 },
    { label: 'All Data', days: null }
  ];

  const handlePresetChange = useCallback((days: number | null) => {
    if (days === null) {
      // All data
      onDateRangeChange(undefined, undefined);
    } else {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      onDateRangeChange(startDate, endDate);
    }
  }, [onDateRangeChange]);

  const handleCustomDateRange = useCallback(() => {
    if (customDateRange.start && customDateRange.end) {
      const startDate = new Date(customDateRange.start);
      const endDate = new Date(customDateRange.end);
      
      if (startDate <= endDate) {
        onDateRangeChange(startDate, endDate);
      } else {
        alert('Start date must be before end date');
      }
    }
  }, [customDateRange, onDateRangeChange]);

  const handleDataTypeToggle = useCallback((type: 'waterLevel' | 'temperature' | 'manual') => {
    switch (type) {
      case 'waterLevel':
        onConfigChange({ showWaterLevel: !config.showWaterLevel });
        break;
      case 'temperature':
        onConfigChange({ showTemperature: !config.showTemperature });
        break;
      case 'manual':
        onConfigChange({ showManualReadings: !config.showManualReadings });
        break;
    }
  }, [config, onConfigChange]);

  const formatDateForInput = (date?: Date): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Chart Controls</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 text-gray-500 hover:text-gray-700 transition-colors mobile-touch-target md:hidden"
        >
          <svg 
            className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <div className={`space-y-6 ${isExpanded ? 'block' : 'hidden md:block'}`}>
        {/* Data Type Toggles */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Data Types</h4>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.showWaterLevel}
                onChange={() => handleDataTypeToggle('waterLevel')}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Water Level</span>
              <div 
                className="w-4 h-2 rounded"
                style={{ backgroundColor: config.colors.waterLevel }}
              />
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.showTemperature}
                onChange={() => handleDataTypeToggle('temperature')}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Temperature</span>
              <div 
                className="w-4 h-2 rounded"
                style={{ backgroundColor: config.colors.temperature }}
              />
            </label>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.showManualReadings}
                onChange={() => handleDataTypeToggle('manual')}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Manual Readings</span>
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: config.colors.manual }}
              />
            </label>
          </div>
        </div>

        {/* Date Range Presets */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Date Range</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {datePresets.map((preset, index) => (
              <button
                key={index}
                onClick={() => handlePresetChange(preset.days)}
                className="btn-outline text-sm py-2 px-3"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Custom Date Range</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Start Date</label>
              <input
                type="date"
                value={customDateRange.start}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                value={customDateRange.end}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="input-field text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCustomDateRange}
                disabled={!customDateRange.start || !customDateRange.end}
                className="btn-primary text-sm w-full mobile-touch-target disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>

        {/* Current Range Display */}
        {config.dateRange.start && config.dateRange.end && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-blue-900">Current Range:</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              {config.dateRange.start.toLocaleDateString()} to {config.dateRange.end.toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Data Summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Total Points:</span>
              <p className="text-gray-900">{dataCount}</p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Well Number:</span>
              <p className="text-gray-900">{well.well_number}</p>
            </div>
            {well.cae_number && (
              <div>
                <span className="font-medium text-gray-700">CAE:</span>
                <p className="text-gray-900">{well.cae_number}</p>
              </div>
            )}
            {well.well_field && (
              <div>
                <span className="font-medium text-gray-700">Field:</span>
                <p className="text-gray-900">{well.well_field}</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}