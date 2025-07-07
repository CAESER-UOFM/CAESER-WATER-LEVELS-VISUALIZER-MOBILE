'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ViewModeType, ViewModeState, VIEW_MODES, ViewModeConfig } from '@/types/viewModes';
import { addMonths, addYears, subMonths, subYears, startOfMonth, endOfMonth } from 'date-fns';

interface ViewModeContextType {
  viewMode: ViewModeState;
  config: ViewModeConfig;
  setViewMode: (mode: ViewModeType) => void;
  setCenterDate: (date: Date) => void;
  navigatePrevious: () => void;
  navigateNext: () => void;
  navigateToDate: (date: Date) => void;
  canNavigatePrevious: () => boolean;
  canNavigateNext: () => boolean;
  getDateRange: () => { start: Date; end: Date };
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function ViewModeProvider({ 
  children,
  initialMode = '1month',
  dataRange
}: { 
  children: React.ReactNode;
  initialMode?: ViewModeType;
  dataRange?: { start: Date; end: Date };
}) {
  const [viewMode, setViewModeState] = useState<ViewModeState>({
    currentMode: initialMode,
    centerDate: new Date(),
    dateRange: { start: new Date(), end: new Date() },
    isLoading: false,
    cacheStatus: {
      isCached: false,
      isPreloading: false,
      cachedRanges: []
    }
  });

  const config = VIEW_MODES[viewMode.currentMode];

  // Calculate date range based on view mode and center date
  const calculateDateRange = useCallback((mode: ViewModeType, center: Date) => {
    const modeConfig = VIEW_MODES[mode];
    
    if (mode === 'full' && dataRange) {
      return { start: dataRange.start, end: dataRange.end };
    }

    let start: Date;
    let end: Date;

    switch (mode) {
      case '1year':
        start = subMonths(center, 6);
        end = addMonths(center, 6);
        break;
      case '6month':
        start = subMonths(center, 3);
        end = addMonths(center, 3);
        break;
      case '1month':
        start = startOfMonth(center);
        end = endOfMonth(center);
        break;
      default:
        // Full mode without dataRange
        const now = new Date();
        start = subYears(now, 5);
        end = now;
    }

    return { start, end };
  }, [dataRange]);

  // Update date range when mode or center date changes
  useEffect(() => {
    const dateRange = calculateDateRange(viewMode.currentMode, viewMode.centerDate);
    setViewModeState(prev => ({ ...prev, dateRange }));
  }, [viewMode.currentMode, viewMode.centerDate, calculateDateRange]);

  const setViewMode = useCallback((mode: ViewModeType) => {
    setViewModeState(prev => ({
      ...prev,
      currentMode: mode,
      cacheStatus: {
        isCached: false,
        isPreloading: false,
        cachedRanges: []
      }
    }));
  }, []);

  const setCenterDate = useCallback((date: Date) => {
    setViewModeState(prev => ({ ...prev, centerDate: date }));
  }, []);

  const navigatePrevious = useCallback(() => {
    const step = config.navigationStep;
    let newDate: Date;

    switch (step.unit) {
      case 'year':
        newDate = subYears(viewMode.centerDate, step.value);
        break;
      case 'month':
        newDate = subMonths(viewMode.centerDate, step.value);
        break;
      default:
        newDate = viewMode.centerDate;
    }

    setCenterDate(newDate);
  }, [config.navigationStep, viewMode.centerDate, setCenterDate]);

  const navigateNext = useCallback(() => {
    const step = config.navigationStep;
    let newDate: Date;

    switch (step.unit) {
      case 'year':
        newDate = addYears(viewMode.centerDate, step.value);
        break;
      case 'month':
        newDate = addMonths(viewMode.centerDate, step.value);
        break;
      default:
        newDate = viewMode.centerDate;
    }

    setCenterDate(newDate);
  }, [config.navigationStep, viewMode.centerDate, setCenterDate]);

  const navigateToDate = useCallback((date: Date) => {
    setCenterDate(date);
  }, [setCenterDate]);

  const canNavigatePrevious = useCallback(() => {
    if (!dataRange) return true;
    const range = calculateDateRange(viewMode.currentMode, viewMode.centerDate);
    const step = config.navigationStep;
    
    let testDate: Date;
    switch (step.unit) {
      case 'year':
        testDate = subYears(viewMode.centerDate, step.value);
        break;
      case 'month':
        testDate = subMonths(viewMode.centerDate, step.value);
        break;
      default:
        testDate = viewMode.centerDate;
    }
    
    const testRange = calculateDateRange(viewMode.currentMode, testDate);
    return testRange.start >= dataRange.start;
  }, [dataRange, calculateDateRange, viewMode.currentMode, viewMode.centerDate, config.navigationStep]);

  const canNavigateNext = useCallback(() => {
    if (!dataRange) return true;
    const range = calculateDateRange(viewMode.currentMode, viewMode.centerDate);
    const step = config.navigationStep;
    
    let testDate: Date;
    switch (step.unit) {
      case 'year':
        testDate = addYears(viewMode.centerDate, step.value);
        break;
      case 'month':
        testDate = addMonths(viewMode.centerDate, step.value);
        break;
      default:
        testDate = viewMode.centerDate;
    }
    
    const testRange = calculateDateRange(viewMode.currentMode, testDate);
    return testRange.end <= dataRange.end;
  }, [dataRange, calculateDateRange, viewMode.currentMode, viewMode.centerDate, config.navigationStep]);

  const getDateRange = useCallback(() => {
    return viewMode.dateRange;
  }, [viewMode.dateRange]);

  return (
    <ViewModeContext.Provider value={{
      viewMode,
      config,
      setViewMode,
      setCenterDate,
      navigatePrevious,
      navigateNext,
      navigateToDate,
      canNavigatePrevious,
      canNavigateNext,
      getDateRange
    }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
}