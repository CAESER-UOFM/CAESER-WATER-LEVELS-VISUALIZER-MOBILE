'use client';

import React, { useState } from 'react';
import { useViewMode } from '@/contexts/ViewModeContext';
import { format, addMonths, subMonths } from 'date-fns';
import { DateRangePicker } from './DateRangePicker';

interface ViewModeNavigationProps {
  className?: string;
  disabled?: boolean;
}

export function ViewModeNavigation({ className = '', disabled = false }: ViewModeNavigationProps) {
  const { 
    viewMode, 
    config, 
    navigatePrevious, 
    navigateNext, 
    navigateToDate,
    canNavigatePrevious,
    canNavigateNext,
    getDateRange
  } = useViewMode();

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(viewMode.centerDate);

  const handlePrevious = () => {
    if (!disabled && canNavigatePrevious()) {
      navigatePrevious();
    }
  };

  const handleNext = () => {
    if (!disabled && canNavigateNext()) {
      navigateNext();
    }
  };

  const handleDateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateToDate(selectedDate);
    setShowDatePicker(false);
  };

  const dateRange = getDateRange();
  const navigationStep = config.navigationStep;
  const stepLabel = `${navigationStep.value} ${navigationStep.unit}${navigationStep.value > 1 ? 's' : ''}`;

  return (
    <div className={`view-mode-navigation ${className}`}>
      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
        {/* Previous button */}
        <button
          onClick={handlePrevious}
          disabled={disabled || viewMode.isLoading || !canNavigatePrevious()}
          className={`
            flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all
            ${disabled || viewMode.isLoading || !canNavigatePrevious()
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
              : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm'
            }
          `}
          title={`Navigate back ${stepLabel}`}
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>

        {/* Center information and date picker */}
        <div className="flex-1 mx-4 text-center">
          {viewMode.currentMode === 'full' ? (
            <div className="text-sm text-gray-600">
              <div className="font-medium text-gray-900">Full Dataset View</div>
              <div>{format(dateRange.start, 'MMM d, yyyy')} - {format(dateRange.end, 'MMM d, yyyy')}</div>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <div className="font-medium text-gray-900">
                  {format(viewMode.centerDate, 'MMMM yyyy')}
                </div>
                <div className="flex items-center justify-center space-x-1">
                  <span>{format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </button>

              {/* Date range picker */}
              {showDatePicker && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50">
                  <DateRangePicker
                    startDate={dateRange.start}
                    endDate={dateRange.end}
                    onRangeChange={(start, end) => {
                      // Navigate to the center of the selected range
                      const centerTime = (start.getTime() + end.getTime()) / 2;
                      navigateToDate(new Date(centerTime));
                      setShowDatePicker(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={disabled || viewMode.isLoading || !canNavigateNext()}
          className={`
            flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all
            ${disabled || viewMode.isLoading || !canNavigateNext()
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
              : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm'
            }
          `}
          title={`Navigate forward ${stepLabel}`}
        >
          Next
          <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Navigation hint */}
      {viewMode.currentMode !== 'full' && (
        <div className="text-xs text-gray-500 text-center mt-2">
          Navigate by {stepLabel} • Click center date to jump to specific date
        </div>
      )}
    </div>
  );
}