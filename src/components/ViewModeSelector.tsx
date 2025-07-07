'use client';

import React from 'react';
import { useViewMode } from '@/contexts/ViewModeContext';
import { VIEW_MODES, ViewModeType } from '@/types/viewModes';
import { formatDistanceToNow } from 'date-fns';

interface ViewModeSelectorProps {
  className?: string;
  disabled?: boolean;
}

export function ViewModeSelector({ className = '', disabled = false }: ViewModeSelectorProps) {
  const { viewMode, config, setViewMode } = useViewMode();

  const handleViewModeChange = (mode: ViewModeType) => {
    if (mode !== viewMode.currentMode && !disabled) {
      setViewMode(mode);
    }
  };

  return (
    <div className={`view-mode-selector ${className}`}>
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-sm font-medium text-gray-700">View Mode:</span>
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          {Object.entries(VIEW_MODES).map(([key, mode]) => {
            const isActive = viewMode.currentMode === key;
            return (
              <button
                key={key}
                onClick={() => handleViewModeChange(key as ViewModeType)}
                disabled={disabled || viewMode.isLoading}
                className={`
                  px-4 py-2 rounded-md text-sm font-medium transition-all
                  ${isActive 
                    ? 'bg-blue-500 text-white shadow-sm' 
                    : 'text-gray-700 hover:bg-gray-200'
                  }
                  ${disabled || viewMode.isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                title={mode.description}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Current view information */}
      <div className="text-sm text-gray-600 space-y-1">
        <div className="flex items-center space-x-2">
          <span className="font-medium">Resolution:</span>
          <span>{config.samplingRate === 'adaptive' 
            ? 'Adaptive (up to 5000 points)' 
            : `${config.samplingRate} intervals`
          }</span>
        </div>
        
        {viewMode.currentMode !== 'full' && (
          <div className="flex items-center space-x-2">
            <span className="font-medium">Center Date:</span>
            <span>{viewMode.centerDate.toLocaleDateString()}</span>
            <span className="text-gray-400">
              ({formatDistanceToNow(viewMode.centerDate, { addSuffix: true })})
            </span>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <span className="font-medium">Date Range:</span>
          <span>
            {viewMode.dateRange.start.toLocaleDateString()} - {viewMode.dateRange.end.toLocaleDateString()}
          </span>
        </div>

        {/* Cache status indicator */}
        {viewMode.cacheStatus && (
          <div className="flex items-center space-x-2">
            <span className="font-medium">Cache:</span>
            {viewMode.cacheStatus.isCached && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Cached
              </span>
            )}
            {viewMode.cacheStatus.isPreloading && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Preloading
              </span>
            )}
            {!viewMode.cacheStatus.isCached && !viewMode.cacheStatus.isPreloading && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                Not cached
              </span>
            )}
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {viewMode.isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <div className="w-8 h-8 loading-spinner mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading view...</p>
          </div>
        </div>
      )}
    </div>
  );
}