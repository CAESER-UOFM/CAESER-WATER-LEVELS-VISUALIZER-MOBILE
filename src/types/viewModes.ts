export type ViewModeType = 'full' | '1year' | '6month' | '1month';

export interface ViewModeConfig {
  id: ViewModeType;
  label: string;
  description: string;
  duration: {
    value: number;
    unit: 'month' | 'year' | 'all';
  };
  samplingRate: string;
  targetPoints: number;
  preloadStrategy: number[]; // Relative offsets to preload (e.g., [-1, 0, 1])
  navigationStep: {
    value: number;
    unit: 'day' | 'month' | 'year';
  };
}

export const VIEW_MODES: Record<ViewModeType, ViewModeConfig> = {
  'full': {
    id: 'full',
    label: 'Full Dataset',
    description: 'Complete data range with adaptive sampling',
    duration: { value: 0, unit: 'all' },
    samplingRate: 'adaptive', // Will be calculated based on data range
    targetPoints: 5000,
    preloadStrategy: [0], // Only current view
    navigationStep: { value: 1, unit: 'year' }
  },
  '1year': {
    id: '1year',
    label: '1 Year',
    description: '12 months of data at 12-hour resolution',
    duration: { value: 1, unit: 'year' },
    samplingRate: '12hour',
    targetPoints: 730, // 365 days * 2 points per day
    preloadStrategy: [-1, 0, 1], // Previous, current, next year
    navigationStep: { value: 1, unit: 'year' }
  },
  '6month': {
    id: '6month',
    label: '6 Months',
    description: '6 months of data at 6-hour resolution',
    duration: { value: 6, unit: 'month' },
    samplingRate: '6hour',
    targetPoints: 720, // 180 days * 4 points per day
    preloadStrategy: [-1, 0, 1], // Previous, current, next 6 months
    navigationStep: { value: 6, unit: 'month' }
  },
  '1month': {
    id: '1month',
    label: '1 Month',
    description: '30 days of data at 15-minute resolution',
    duration: { value: 1, unit: 'month' },
    samplingRate: '15min',
    targetPoints: 2880, // 30 days * 96 points per day
    preloadStrategy: [-1, 0, 1], // Previous, current, next month
    navigationStep: { value: 1, unit: 'month' }
  }
};

export interface ViewModeState {
  currentMode: ViewModeType;
  centerDate: Date;
  dateRange: {
    start: Date;
    end: Date;
  };
  isLoading: boolean;
  cacheStatus: {
    isCached: boolean;
    isPreloading: boolean;
    cachedRanges: Array<{
      start: Date;
      end: Date;
    }>;
  };
}