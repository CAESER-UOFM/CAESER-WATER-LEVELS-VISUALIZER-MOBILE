'use client';

import React, { useState } from 'react';
import type { PlotConfig } from '@/types/database';

interface ChartControlsPanelProps {
  config: PlotConfig;
  onConfigChange: (config: PlotConfig) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function ChartControlsPanel({ 
  config, 
  onConfigChange, 
  isCollapsed = false,
  onToggleCollapse 
}: ChartControlsPanelProps) {
  const [localConfig, setLocalConfig] = useState(config);

  const handleConfigChange = (updates: Partial<PlotConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleColorChange = (colorType: keyof PlotConfig['colors'], color: string) => {
    const newColors = { ...localConfig.colors, [colorType]: color };
    handleConfigChange({ colors: newColors });
  };

  const handleDateRangeChange = (field: 'start' | 'end', date: string) => {
    const newDateRange = {
      ...localConfig.dateRange,
      [field]: date ? new Date(date) : undefined
    };
    handleConfigChange({ dateRange: newDateRange });
  };

  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Chart Controls</h3>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors mobile-touch-target"
            title={isCollapsed ? 'Expand controls' : 'Collapse controls'}
          >
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="mt-4 space-y-6">
          {/* Data Display Options */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Data Display</h4>
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={localConfig.showWaterLevel}
                  onChange={(e) => handleConfigChange({ showWaterLevel: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Show Water Level</span>
                <div 
                  className="w-4 h-2 rounded-sm border border-gray-300"
                  style={{ backgroundColor: localConfig.colors.waterLevel }}
                />
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={localConfig.showTemperature}
                  onChange={(e) => handleConfigChange({ showTemperature: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Show Temperature</span>
                <div 
                  className="w-4 h-2 rounded-sm border border-gray-300"
                  style={{ backgroundColor: localConfig.colors.temperature }}
                />
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={localConfig.showManualReadings}
                  onChange={(e) => handleConfigChange({ showManualReadings: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Show Manual Readings</span>
                <div 
                  className="w-2 h-2 rounded-full border border-gray-300"
                  style={{ backgroundColor: localConfig.colors.manual }}
                />
              </label>
            </div>
          </div>

          {/* Color Customization */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Colors</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-600">Water Level</label>
                <input
                  type="color"
                  value={localConfig.colors.waterLevel}
                  onChange={(e) => handleColorChange('waterLevel', e.target.value)}
                  className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-600">Temperature</label>
                <input
                  type="color"
                  value={localConfig.colors.temperature}
                  onChange={(e) => handleColorChange('temperature', e.target.value)}
                  className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                />
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-600">Manual</label>
                <input
                  type="color"
                  value={localConfig.colors.manual}
                  onChange={(e) => handleColorChange('manual', e.target.value)}
                  className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Date Range Filter */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Date Range Filter</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={formatDateForInput(localConfig.dateRange.start)}
                  onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={formatDateForInput(localConfig.dateRange.end)}
                  onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            {(localConfig.dateRange.start || localConfig.dateRange.end) && (
              <div className="mt-2">
                <button
                  onClick={() => handleConfigChange({ dateRange: {} })}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Clear date filter
                </button>
              </div>
            )}
          </div>

          {/* Y-Axis Range */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Y-Axis Range</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Min (ft)</label>
                <input
                  type="number"
                  step="0.1"
                  value={localConfig.yAxisRange?.min || ''}
                  onChange={(e) => handleConfigChange({ 
                    yAxisRange: { 
                      ...localConfig.yAxisRange, 
                      min: e.target.value ? parseFloat(e.target.value) : undefined 
                    } 
                  })}
                  placeholder="Auto"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Max (ft)</label>
                <input
                  type="number"
                  step="0.1"
                  value={localConfig.yAxisRange?.max || ''}
                  onChange={(e) => handleConfigChange({ 
                    yAxisRange: { 
                      ...localConfig.yAxisRange, 
                      max: e.target.value ? parseFloat(e.target.value) : undefined 
                    } 
                  })}
                  placeholder="Auto"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            {(localConfig.yAxisRange?.min !== undefined || localConfig.yAxisRange?.max !== undefined) && (
              <div className="mt-2">
                <button
                  onClick={() => handleConfigChange({ yAxisRange: undefined })}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Reset to auto-scale
                </button>
              </div>
            )}
          </div>

          {/* Quick Presets */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Presets</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => handleConfigChange({
                  showWaterLevel: true,
                  showTemperature: false,
                  showManualReadings: true,
                  colors: {
                    waterLevel: '#3b82f6',
                    temperature: '#ef4444',
                    manual: '#10b981'
                  }
                })}
                className="px-3 py-2 text-xs bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors mobile-touch-target"
              >
                Water Only
              </button>
              <button
                onClick={() => handleConfigChange({
                  showWaterLevel: true,
                  showTemperature: true,
                  showManualReadings: true
                })}
                className="px-3 py-2 text-xs bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors mobile-touch-target"
              >
                Show All
              </button>
              <button
                onClick={() => handleConfigChange({
                  showWaterLevel: true,
                  showTemperature: false,
                  showManualReadings: false
                })}
                className="px-3 py-2 text-xs bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors mobile-touch-target"
              >
                Minimal
              </button>
              <button
                onClick={() => handleConfigChange({
                  colors: {
                    waterLevel: '#1f2937',
                    temperature: '#991b1b',
                    manual: '#059669'
                  }
                })}
                className="px-3 py-2 text-xs bg-purple-100 text-purple-800 rounded-md hover:bg-purple-200 transition-colors mobile-touch-target"
              >
                Dark Theme
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}