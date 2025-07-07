'use client';

import React from 'react';
import { ResolutionMode, ResolutionConfig, ResolutionCalculation } from '@/types/database';
import { getAvailableResolutions, formatResolutionInfo, isResolutionSuitable } from '@/utils/resolutionConfig';

interface ResolutionModeSelectorProps {
  selectedResolution: ResolutionMode;
  onResolutionChange: (resolution: ResolutionMode) => void;
  resolutionCalculation?: ResolutionCalculation;
  totalDataPoints?: number;
  displayedPoints: number;
  timeSpanDays?: number;
  isLoading?: boolean;
  className?: string;
}

export function ResolutionModeSelector({ 
  selectedResolution, 
  onResolutionChange, 
  resolutionCalculation,
  totalDataPoints,
  displayedPoints,
  timeSpanDays,
  isLoading = false,
  className = ''
}: ResolutionModeSelectorProps) {
  const availableResolutions = getAvailableResolutions();

  return (
    <div className={`bg-gray-50 rounded-lg p-3 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Resolution Mode
        </label>
        <div className="text-xs text-gray-500">
          {displayedPoints.toLocaleString()} points displayed
          {totalDataPoints && (
            <span className="ml-1">
              / {totalDataPoints.toLocaleString()} total
            </span>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {availableResolutions.map((config) => {
          const isSuitable = timeSpanDays ? isResolutionSuitable(config.id, timeSpanDays) : true;
          const isSelected = selectedResolution === config.id;
          
          return (
            <button
              key={config.id}
              onClick={() => onResolutionChange(config.id)}
              disabled={isLoading || !isSuitable}
              className={`px-3 py-2 text-xs rounded-md border transition-all mobile-touch-target relative ${
                isSelected
                  ? 'bg-primary-600 text-white border-primary-600'
                  : isSuitable
                  ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 active:bg-gray-100'
                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={`${config.description}${!isSuitable ? ' (Not suitable for current time span)' : ''}`}
            >
              <div className="flex flex-col items-center space-y-1">
                {config.icon && (
                  <span className="text-sm">{config.icon}</span>
                )}
                <span className="font-medium">{config.name}</span>
              </div>
              
              {!isSuitable && (
                <div className="absolute top-0 right-0 w-2 h-2 bg-yellow-400 rounded-full transform translate-x-1 -translate-y-1" />
              )}
            </button>
          );
        })}
      </div>
      
      {/* Resolution info display */}
      {resolutionCalculation && (
        <div className="text-xs text-gray-600 text-center bg-white rounded px-3 py-2 border">
          <div className="font-medium text-gray-700 mb-1">
            Current Resolution: {formatResolutionInfo(resolutionCalculation)}
          </div>
          {timeSpanDays && (
            <div className="text-gray-500">
              Time Span: {timeSpanDays} days
              {timeSpanDays > 365 && (
                <span className="ml-2 text-amber-600">
                  ⚠️ Large time span - consider using Full View
                </span>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="text-xs text-center text-primary-600 flex items-center justify-center space-x-2">
          <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
          <span>Loading resolution data...</span>
        </div>
      )}
      
      {/* Resolution recommendations */}
      {timeSpanDays && (
        <div className="text-xs text-gray-500 space-y-1">
          <div className="font-medium">Recommended for your time span:</div>
          <div className="flex flex-wrap gap-1">
            {availableResolutions
              .filter(config => isResolutionSuitable(config.id, timeSpanDays))
              .map(config => (
                <span 
                  key={config.id}
                  className={`px-2 py-1 rounded text-xs ${
                    config.id === selectedResolution
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {config.name}
                </span>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// Export types for backward compatibility
export interface ResolutionOption {
  id: ResolutionMode;
  name: string;
  description: string;
  samplingInterval: number;
  targetPoints: number;
}

// Helper function to convert resolution config to option format
export function resolutionConfigToOption(config: ResolutionConfig): ResolutionOption {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    samplingInterval: config.samplingInterval,
    targetPoints: config.targetPoints
  };
}

// Utility function for downsampling with new resolution system
export function downsampleDataByResolution<T extends { timestamp_utc: string; water_level?: number }>(
  data: T[],
  resolutionMode: ResolutionMode,
  targetPoints?: number
): T[] {
  if (resolutionMode === 'full' && !targetPoints) {
    // For full mode without target, return as-is (will be handled by adaptive sampling)
    return data;
  }
  
  if (data.length === 0) {
    return data;
  }
  
  const target = targetPoints || 5000;
  const skipRatio = Math.max(1, Math.ceil(data.length / target));
  
  if (skipRatio === 1) {
    return data; // No downsampling needed
  }
  
  // Simple uniform downsampling - take every nth point
  const result: T[] = [];
  for (let i = 0; i < data.length; i += skipRatio) {
    result.push(data[i]);
  }
  
  // Always include the last point to maintain data continuity
  if (result[result.length - 1] !== data[data.length - 1]) {
    result.push(data[data.length - 1]);
  }
  
  return result;
}