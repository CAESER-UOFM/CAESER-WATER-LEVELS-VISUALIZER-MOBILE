import { 
  ResolutionMode, 
  ResolutionConfig, 
  ResolutionCalculation, 
  NavigationState 
} from '@/types/database';

// Resolution configurations based on user requirements
export const RESOLUTION_CONFIGS: Record<ResolutionMode, ResolutionConfig> = {
  full: {
    id: 'full',
    name: 'Full View',
    description: 'All available data (~5000 points)',
    samplingInterval: 0, // Will be calculated dynamically
    targetPoints: 5000,
    icon: '📊'
  },
  '1year': {
    id: '1year',
    name: '1 Year',
    description: '12-hour intervals (365 days)',
    samplingInterval: 720, // 12 hours in minutes
    maxTimeSpan: 365,
    targetPoints: 730, // 365 days * 2 samples per day
    icon: '📅'
  },
  '6months': {
    id: '6months',
    name: '6 Months',
    description: '6-hour intervals (180 days)',
    samplingInterval: 360, // 6 hours in minutes
    maxTimeSpan: 180,
    targetPoints: 720, // 180 days * 4 samples per day
    icon: '📆'
  },
  '1month': {
    id: '1month',
    name: '1 Month',
    description: '15-minute intervals (30 days)',
    samplingInterval: 15, // 15 minutes
    maxTimeSpan: 30,
    targetPoints: 2880, // 30 days * 96 samples per day
    icon: '📋'
  }
};

// Get all available resolution modes
export function getAvailableResolutions(): ResolutionConfig[] {
  return Object.values(RESOLUTION_CONFIGS);
}

// Get resolution config by mode
export function getResolutionConfig(mode: ResolutionMode): ResolutionConfig {
  return RESOLUTION_CONFIGS[mode];
}

// Calculate optimal resolution based on time span
export function calculateOptimalResolution(
  startDate: Date,
  endDate: Date,
  availableDataRange: { start: Date; end: Date }
): ResolutionCalculation {
  const timeSpanDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Determine best resolution mode based on time span
  let bestMode: ResolutionMode = 'full';
  
  if (timeSpanDays <= 30) {
    bestMode = '1month';
  } else if (timeSpanDays <= 180) {
    bestMode = '6months';
  } else if (timeSpanDays <= 365) {
    bestMode = '1year';
  } else {
    bestMode = 'full';
  }
  
  const config = RESOLUTION_CONFIGS[bestMode];
  
  // For full view, calculate dynamic sampling interval
  let samplingInterval = config.samplingInterval;
  let estimatedPoints = config.targetPoints;
  
  if (bestMode === 'full') {
    // Calculate sampling interval to target ~5000 points
    const totalMinutes = timeSpanDays * 24 * 60;
    samplingInterval = Math.max(1, Math.ceil(totalMinutes / 5000));
    estimatedPoints = Math.ceil(totalMinutes / samplingInterval);
  } else {
    // Calculate actual points for fixed interval modes
    const totalMinutes = timeSpanDays * 24 * 60;
    estimatedPoints = Math.ceil(totalMinutes / samplingInterval);
  }
  
  return {
    mode: bestMode,
    samplingInterval,
    estimatedPoints: Math.min(estimatedPoints, 5000), // Never exceed 5000 points
    actualTimeSpan: timeSpanDays,
    startDate,
    endDate
  };
}

// Calculate navigation boundaries for a given resolution
export function calculateNavigationState(
  currentResolution: ResolutionMode,
  currentRange: { start: Date; end: Date },
  availableRange: { start: Date; end: Date }
): NavigationState {
  const config = RESOLUTION_CONFIGS[currentResolution];
  
  // Calculate if we can navigate left (earlier) or right (later)
  const canNavigateLeft = currentRange.start > availableRange.start;
  const canNavigateRight = currentRange.end < availableRange.end;
  
  // Calculate position (0-1) within the full dataset
  const totalSpan = availableRange.end.getTime() - availableRange.start.getTime();
  const currentStart = currentRange.start.getTime() - availableRange.start.getTime();
  const position = totalSpan > 0 ? Math.max(0, Math.min(1, currentStart / totalSpan)) : 0;
  
  return {
    currentResolution,
    dateRange: currentRange,
    availableRange,
    canNavigateLeft,
    canNavigateRight,
    position
  };
}

// Calculate next navigation range (pan left/right)
export function calculateNextNavigationRange(
  currentResolution: ResolutionMode,
  currentRange: { start: Date; end: Date },
  direction: 'left' | 'right',
  availableRange: { start: Date; end: Date },
  overlapPercent: number = 0.1 // 10% overlap between ranges
): { start: Date; end: Date } {
  const config = RESOLUTION_CONFIGS[currentResolution];
  const currentSpan = currentRange.end.getTime() - currentRange.start.getTime();
  const overlapMs = currentSpan * overlapPercent;
  
  let newStart: Date;
  let newEnd: Date;
  
  if (direction === 'left') {
    // Move earlier in time
    newEnd = new Date(currentRange.start.getTime() + overlapMs);
    newStart = new Date(newEnd.getTime() - currentSpan);
    
    // Ensure we don't go before available data
    if (newStart < availableRange.start) {
      newStart = availableRange.start;
      newEnd = new Date(newStart.getTime() + currentSpan);
    }
  } else {
    // Move later in time
    newStart = new Date(currentRange.end.getTime() - overlapMs);
    newEnd = new Date(newStart.getTime() + currentSpan);
    
    // Ensure we don't go after available data
    if (newEnd > availableRange.end) {
      newEnd = availableRange.end;
      newStart = new Date(newEnd.getTime() - currentSpan);
    }
  }
  
  return { start: newStart, end: newEnd };
}

// Get default date range for a resolution mode
export function getDefaultDateRange(
  mode: ResolutionMode,
  availableRange: { start: Date; end: Date },
  preferLatest: boolean = true
): { start: Date; end: Date } {
  const config = RESOLUTION_CONFIGS[mode];
  
  if (mode === 'full') {
    return availableRange;
  }
  
  const maxTimeSpanMs = (config.maxTimeSpan || 30) * 24 * 60 * 60 * 1000;
  
  if (preferLatest) {
    // Start from the most recent data
    const start = new Date(Math.max(
      availableRange.end.getTime() - maxTimeSpanMs,
      availableRange.start.getTime()
    ));
    return { start, end: availableRange.end };
  } else {
    // Start from the earliest data
    const end = new Date(Math.min(
      availableRange.start.getTime() + maxTimeSpanMs,
      availableRange.end.getTime()
    ));
    return { start: availableRange.start, end };
  }
}

// Utility to format resolution info for display
export function formatResolutionInfo(calculation: ResolutionCalculation): string {
  const config = RESOLUTION_CONFIGS[calculation.mode];
  const { samplingInterval, estimatedPoints, actualTimeSpan } = calculation;
  
  let intervalStr = '';
  if (samplingInterval < 60) {
    intervalStr = `${samplingInterval}min`;
  } else if (samplingInterval < 1440) {
    intervalStr = `${Math.round(samplingInterval / 60)}hr`;
  } else {
    intervalStr = `${Math.round(samplingInterval / 1440)}day`;
  }
  
  return `${config.name} • ${intervalStr} intervals • ~${estimatedPoints.toLocaleString()} points • ${actualTimeSpan} days`;
}

// Check if resolution mode is suitable for given time span
export function isResolutionSuitable(
  mode: ResolutionMode,
  timeSpanDays: number
): boolean {
  const config = RESOLUTION_CONFIGS[mode];
  
  if (mode === 'full') {
    return true; // Full view is always suitable
  }
  
  if (!config.maxTimeSpan) {
    return true;
  }
  
  // Allow some flexibility (up to 20% over the recommended span)
  return timeSpanDays <= config.maxTimeSpan * 1.2;
}