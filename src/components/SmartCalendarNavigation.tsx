'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { ResolutionMode, NavigationState } from '@/types/database';
import { 
  getResolutionConfig, 
  calculateNavigationState, 
  calculateNextNavigationRange,
  getDefaultDateRange 
} from '@/utils/resolutionConfig';

interface SmartCalendarNavigationProps {
  currentResolution: ResolutionMode;
  currentDateRange: { start: Date; end: Date };
  availableDataRange: { start: Date; end: Date };
  onDateRangeChange: (startDate: Date, endDate: Date) => void;
  onResolutionChange?: (resolution: ResolutionMode) => void;
  isLoading?: boolean;
  className?: string;
}

export function SmartCalendarNavigation({
  currentResolution,
  currentDateRange,
  availableDataRange,
  onDateRangeChange,
  onResolutionChange,
  isLoading = false,
  className = ''
}: SmartCalendarNavigationProps) {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customRange, setCustomRange] = useState({
    start: '',
    end: ''
  });

  // Calculate navigation state
  const navigationState = useMemo(() => 
    calculateNavigationState(currentResolution, currentDateRange, availableDataRange),
    [currentResolution, currentDateRange, availableDataRange]
  );

  const resolutionConfig = getResolutionConfig(currentResolution);

  // Smart date presets based on resolution mode
  const smartPresets = useMemo(() => {
    const presets = [];
    const now = new Date();
    
    switch (currentResolution) {
      case '1month':
        presets.push(
          { label: 'Today', range: { days: 1, hours: 0 } },
          { label: 'Last 3 Days', range: { days: 3, hours: 0 } },
          { label: 'Last Week', range: { days: 7, hours: 0 } },
          { label: 'Last 2 Weeks', range: { days: 14, hours: 0 } },
          { label: 'Last Month', range: { days: 30, hours: 0 } }
        );
        break;
      case '6months':
        presets.push(
          { label: 'Last Week', range: { days: 7, hours: 0 } },
          { label: 'Last Month', range: { days: 30, hours: 0 } },
          { label: 'Last 3 Months', range: { days: 90, hours: 0 } },
          { label: 'Last 6 Months', range: { days: 180, hours: 0 } }
        );
        break;
      case '1year':
        presets.push(
          { label: 'Last Month', range: { days: 30, hours: 0 } },
          { label: 'Last 3 Months', range: { days: 90, hours: 0 } },
          { label: 'Last 6 Months', range: { days: 180, hours: 0 } },
          { label: 'Last Year', range: { days: 365, hours: 0 } }
        );
        break;
      case 'full':
        presets.push(
          { label: 'Last 6 Months', range: { days: 180, hours: 0 } },
          { label: 'Last Year', range: { days: 365, hours: 0 } },
          { label: 'Last 2 Years', range: { days: 730, hours: 0 } },
          { label: 'All Available', range: null }
        );
        break;
    }
    
    return presets;
  }, [currentResolution]);

  // Handle preset selection
  const handlePresetChange = useCallback((preset: any) => {
    if (preset.range === null) {
      // All available data
      onDateRangeChange(availableDataRange.start, availableDataRange.end);
    } else {
      const endDate = new Date();
      const startDate = new Date();
      
      if (preset.range.days) {
        startDate.setDate(startDate.getDate() - preset.range.days);
      }
      if (preset.range.hours) {
        startDate.setHours(startDate.getHours() - preset.range.hours);
      }
      
      // Ensure we don't go beyond available data
      const constrainedStart = new Date(Math.max(startDate.getTime(), availableDataRange.start.getTime()));
      const constrainedEnd = new Date(Math.min(endDate.getTime(), availableDataRange.end.getTime()));
      
      onDateRangeChange(constrainedStart, constrainedEnd);
    }
  }, [availableDataRange, onDateRangeChange]);

  // Handle navigation (pan left/right)
  const handleNavigation = useCallback((direction: 'left' | 'right') => {
    const nextRange = calculateNextNavigationRange(
      currentResolution,
      currentDateRange,
      direction,
      availableDataRange,
      0.1 // 10% overlap
    );
    
    onDateRangeChange(nextRange.start, nextRange.end);
  }, [currentResolution, currentDateRange, availableDataRange, onDateRangeChange]);

  // Handle custom date range
  const handleCustomDateRange = useCallback(() => {
    if (customRange.start && customRange.end) {
      const startDate = new Date(customRange.start);
      const endDate = new Date(customRange.end);
      
      if (startDate <= endDate) {
        // Ensure dates are within available range
        const constrainedStart = new Date(Math.max(startDate.getTime(), availableDataRange.start.getTime()));
        const constrainedEnd = new Date(Math.min(endDate.getTime(), availableDataRange.end.getTime()));
        
        onDateRangeChange(constrainedStart, constrainedEnd);
        setShowCustomPicker(false);
        setCustomRange({ start: '', end: '' });
      } else {
        alert('Start date must be before end date');
      }
    }
  }, [customRange, availableDataRange, onDateRangeChange]);

  // Quick jump to specific positions
  const handleQuickJump = useCallback((position: 'start' | 'end' | 'middle') => {
    const config = getResolutionConfig(currentResolution);
    const maxTimeSpan = config.maxTimeSpan || 
      Math.ceil((availableDataRange.end.getTime() - availableDataRange.start.getTime()) / (1000 * 60 * 60 * 24));
    
    let newRange;
    
    switch (position) {
      case 'start':
        newRange = getDefaultDateRange(currentResolution, availableDataRange, false);
        break;
      case 'end':
        newRange = getDefaultDateRange(currentResolution, availableDataRange, true);
        break;
      case 'middle':
        const totalSpan = availableDataRange.end.getTime() - availableDataRange.start.getTime();
        const midPoint = new Date(availableDataRange.start.getTime() + totalSpan / 2);
        const halfSpan = Math.min(maxTimeSpan, Math.ceil(totalSpan / (1000 * 60 * 60 * 24))) / 2;
        newRange = {
          start: new Date(midPoint.getTime() - halfSpan * 24 * 60 * 60 * 1000),
          end: new Date(midPoint.getTime() + halfSpan * 24 * 60 * 60 * 1000)
        };
        break;
    }
    
    onDateRangeChange(newRange.start, newRange.end);
  }, [currentResolution, availableDataRange, onDateRangeChange]);

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const formatTimeSpan = (days: number): string => {
    if (days < 1) {
      return `${Math.round(days * 24)} hours`;
    } else if (days < 30) {
      return `${Math.round(days)} days`;
    } else if (days < 365) {
      return `${Math.round(days / 30)} months`;
    } else {
      return `${Math.round(days / 365 * 10) / 10} years`;
    }
  };

  const currentTimeSpanDays = (currentDateRange.end.getTime() - currentDateRange.start.getTime()) / (1000 * 60 * 60 * 24);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 space-y-4 ${className}`}>
      {/* Header with current resolution info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-lg">{resolutionConfig.icon}</div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {resolutionConfig.name} Navigation
            </h3>
            <p className="text-xs text-gray-500">
              {formatTimeSpan(currentTimeSpanDays)} • {resolutionConfig.description}
            </p>
          </div>
        </div>
        
        {/* Progress indicator */}
        <div className="flex items-center space-x-2">
          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${navigationState.position * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">
            {Math.round(navigationState.position * 100)}%
          </span>
        </div>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => handleNavigation('left')}
          disabled={!navigationState.canNavigateLeft || isLoading}
          className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors mobile-touch-target"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Earlier</span>
        </button>

        {/* Quick jump buttons */}
        <div className="flex space-x-1">
          <button
            onClick={() => handleQuickJump('start')}
            disabled={isLoading}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded mobile-touch-target"
            title="Jump to start of data"
          >
            Start
          </button>
          <button
            onClick={() => handleQuickJump('middle')}
            disabled={isLoading}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded mobile-touch-target"
            title="Jump to middle"
          >
            Mid
          </button>
          <button
            onClick={() => handleQuickJump('end')}
            disabled={isLoading}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded mobile-touch-target"
            title="Jump to latest data"
          >
            Latest
          </button>
        </div>

        <button
          onClick={() => handleNavigation('right')}
          disabled={!navigationState.canNavigateRight || isLoading}
          className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors mobile-touch-target"
        >
          <span>Later</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Smart presets */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Ranges</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {smartPresets.map((preset, index) => (
            <button
              key={index}
              onClick={() => handlePresetChange(preset)}
              disabled={isLoading}
              className="px-3 py-2 text-xs border border-gray-300 bg-white hover:bg-gray-50 rounded-md transition-colors mobile-touch-target disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom date picker toggle */}
      <div>
        <button
          onClick={() => setShowCustomPicker(!showCustomPicker)}
          className="flex items-center space-x-2 text-sm text-primary-600 hover:text-primary-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{showCustomPicker ? 'Hide' : 'Show'} Custom Date Range</span>
        </button>

        {showCustomPicker && (
          <div className="mt-3 p-3 bg-gray-50 rounded-md">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={customRange.start}
                  min={formatDateForInput(availableDataRange.start)}
                  max={formatDateForInput(availableDataRange.end)}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={customRange.end}
                  min={formatDateForInput(availableDataRange.start)}
                  max={formatDateForInput(availableDataRange.end)}
                  onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleCustomDateRange}
                  disabled={!customRange.start || !customRange.end || isLoading}
                  className="w-full px-3 py-2 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mobile-touch-target"
                >
                  Apply Range
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Current range display */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-blue-900">Current View:</span>
            </div>
            <p className="text-sm text-blue-700">
              {currentDateRange.start.toLocaleDateString()} to {currentDateRange.end.toLocaleDateString()}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {formatTimeSpan(currentTimeSpanDays)} total span
            </p>
          </div>
          
          {isLoading && (
            <div className="flex items-center space-x-2 text-blue-600">
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-xs">Loading...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}