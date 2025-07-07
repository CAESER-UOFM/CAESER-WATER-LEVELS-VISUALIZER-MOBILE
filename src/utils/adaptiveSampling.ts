/**
 * Adaptive Sampling Utility
 * 
 * Enhanced to work with the new resolution system
 * Calculates optimal sampling rates for different resolution modes targeting ~5000 data points max
 * Uses natural time boundaries instead of arbitrary downsampling
 */

import { ResolutionMode, ResolutionCalculation } from '@/types/database';
import { RESOLUTION_CONFIGS, getResolutionConfig } from './resolutionConfig';

export interface SamplingRate {
  name: string;
  minutes: number;
  description: string;
}

export const SAMPLING_RATES: SamplingRate[] = [
  { name: '1min', minutes: 1, description: '1 minute (highest detail)' },
  { name: '5min', minutes: 5, description: '5 minutes' },
  { name: '15min', minutes: 15, description: '15 minutes (raw data)' },
  { name: '30min', minutes: 30, description: '30 minutes' },
  { name: '1hour', minutes: 60, description: '1 hour' },
  { name: '2hour', minutes: 120, description: '2 hours' },
  { name: '3hour', minutes: 180, description: '3 hours' },
  { name: '6hour', minutes: 360, description: '6 hours' },
  { name: '12hour', minutes: 720, description: '12 hours' },
  { name: '1day', minutes: 1440, description: '1 day' },
  { name: '2day', minutes: 2880, description: '2 days' },
  { name: '3day', minutes: 4320, description: '3 days' },
  { name: '1week', minutes: 10080, description: '1 week' },
  { name: '2week', minutes: 20160, description: '2 weeks' },
  { name: '1month', minutes: 43200, description: '1 month (~30 days)' }
];

export interface AdaptiveSamplingResult {
  samplingRate: SamplingRate;
  estimatedPoints: number;
  timeSpanDays: number;
  recommendation: string;
  resolutionMode?: ResolutionMode;
}

/**
 * Calculate optimal sampling rate for a given time range and resolution mode
 * Target: Never exceed 5000 points, prefer optimal ranges per resolution
 */
export function calculateOptimalSampling(
  startDate: Date, 
  endDate: Date,
  resolutionMode?: ResolutionMode,
  targetMinPoints: number = 4000,
  targetMaxPoints: number = 5000
): AdaptiveSamplingResult {
  const timeSpanMs = endDate.getTime() - startDate.getTime();
  const timeSpanDays = timeSpanMs / (1000 * 60 * 60 * 24);
  const timeSpanMinutes = timeSpanMs / (1000 * 60);
  
  // If resolution mode is specified, use its configuration
  if (resolutionMode && resolutionMode !== 'full') {
    const config = getResolutionConfig(resolutionMode);
    const samplingMinutes = config.samplingInterval;
    const estimatedPoints = Math.floor(timeSpanMinutes / samplingMinutes);
    
    // Find corresponding sampling rate
    const samplingRate = SAMPLING_RATES.find(rate => rate.minutes === samplingMinutes) || {
      name: `${samplingMinutes}min`,
      minutes: samplingMinutes,
      description: `${samplingMinutes} minutes (${resolutionMode})`
    };
    
    return {
      samplingRate,
      estimatedPoints: Math.min(estimatedPoints, 5000), // Never exceed 5000
      timeSpanDays,
      recommendation: `${config.name}: ${Math.min(estimatedPoints, 5000)} points with ${samplingRate.description}`,
      resolutionMode
    };
  }
  
  // For full mode or no specified mode, calculate optimal sampling
  let bestRate = SAMPLING_RATES[2]; // Default to 15min (index 2)
  let bestPoints = Math.floor(timeSpanMinutes / bestRate.minutes);
  
  for (const rate of SAMPLING_RATES) {
    const estimatedPoints = Math.floor(timeSpanMinutes / rate.minutes);
    
    // Never exceed 5000 points
    if (estimatedPoints > 5000) {
      continue;
    }
    
    // If this rate gives us points in our target range, use it
    if (estimatedPoints >= targetMinPoints && estimatedPoints <= targetMaxPoints) {
      bestRate = rate;
      bestPoints = estimatedPoints;
      break;
    }
    
    // If we're below target, this is our best option (finest resolution possible)
    if (estimatedPoints < targetMinPoints) {
      bestRate = rate;
      bestPoints = estimatedPoints;
      break;
    }
    
    // Keep this as a candidate (it's above target but might be our best option)
    bestRate = rate;
    bestPoints = estimatedPoints;
  }
  
  // Generate recommendation message
  let recommendation: string;
  if (bestPoints >= targetMinPoints && bestPoints <= targetMaxPoints) {
    recommendation = `Optimal: ${bestPoints} points with ${bestRate.description}`;
  } else if (bestPoints < targetMinPoints) {
    recommendation = `Maximum detail: ${bestPoints} points (limited by ${bestRate.description})`;
  } else {
    recommendation = `Efficient view: ${bestPoints} points with ${bestRate.description}`;
  }
  
  return {
    samplingRate: bestRate,
    estimatedPoints: bestPoints,
    timeSpanDays,
    recommendation,
    resolutionMode
  };
}

/**
 * Get sampling rate for overview loading (full dataset)
 * Uses longer time periods for very large datasets
 */
export function calculateOverviewSampling(
  totalDataSpanDays: number,
  targetPoints: number = 5000
): AdaptiveSamplingResult {
  // Create a synthetic time range for calculation
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - (totalDataSpanDays * 24 * 60 * 60 * 1000));
  
  return calculateOptimalSampling(startDate, endDate, 'full', 4000, targetPoints);
}

/**
 * Calculate resolution-aware sampling for a specific resolution mode
 */
export function calculateResolutionSampling(
  startDate: Date,
  endDate: Date,
  resolutionMode: ResolutionMode
): ResolutionCalculation {
  const config = getResolutionConfig(resolutionMode);
  const timeSpanMs = endDate.getTime() - startDate.getTime();
  const timeSpanDays = timeSpanMs / (1000 * 60 * 60 * 24);
  const timeSpanMinutes = timeSpanMs / (1000 * 60);
  
  let samplingInterval = config.samplingInterval;
  let estimatedPoints = config.targetPoints;
  
  if (resolutionMode === 'full') {
    // For full mode, calculate dynamic sampling to target ~5000 points
    samplingInterval = Math.max(1, Math.ceil(timeSpanMinutes / 5000));
    estimatedPoints = Math.ceil(timeSpanMinutes / samplingInterval);
  } else {
    // For fixed resolution modes, calculate actual points
    estimatedPoints = Math.ceil(timeSpanMinutes / samplingInterval);
  }
  
  // Never exceed 5000 points
  if (estimatedPoints > 5000) {
    samplingInterval = Math.ceil(timeSpanMinutes / 5000);
    estimatedPoints = Math.ceil(timeSpanMinutes / samplingInterval);
  }
  
  return {
    mode: resolutionMode,
    samplingInterval,
    estimatedPoints: Math.min(estimatedPoints, 5000),
    actualTimeSpan: timeSpanDays,
    startDate,
    endDate
  };
}

/**
 * Get optimal sampling for data export
 */
export function calculateExportSampling(
  startDate: Date,
  endDate: Date,
  maxPoints?: number,
  preferredResolution?: ResolutionMode
): AdaptiveSamplingResult {
  const targetPoints = maxPoints || 10000; // Allow more points for export
  
  if (preferredResolution) {
    return calculateOptimalSampling(startDate, endDate, preferredResolution, 1000, targetPoints);
  }
  
  return calculateOptimalSampling(startDate, endDate, 'full', 1000, targetPoints);
}

/**
 * Format sampling info for user display
 */
export function formatSamplingInfo(result: AdaptiveSamplingResult): string {
  const { timeSpanDays, samplingRate, estimatedPoints, resolutionMode } = result;
  
  let timeDisplay = '';
  if (timeSpanDays < 1) {
    timeDisplay = `${(timeSpanDays * 24).toFixed(1)} hours`;
  } else if (timeSpanDays < 30) {
    timeDisplay = `${timeSpanDays.toFixed(1)} days`;
  } else if (timeSpanDays < 365) {
    timeDisplay = `${(timeSpanDays / 30).toFixed(1)} months`;
  } else {
    timeDisplay = `${(timeSpanDays / 365).toFixed(1)} years`;
  }
  
  const modeDisplay = resolutionMode ? ` (${resolutionMode})` : '';
  
  return `${timeDisplay} at ${samplingRate.description} (${estimatedPoints.toLocaleString()} points)${modeDisplay}`;
}

/**
 * Check if current sampling is optimal for the given time range
 */
export function isSamplingOptimal(
  result: AdaptiveSamplingResult,
  targetMin: number = 4000,
  targetMax: number = 5000
): boolean {
  return result.estimatedPoints >= targetMin && result.estimatedPoints <= targetMax;
}

/**
 * Get sampling rate suggestions for performance optimization
 */
export function getSamplingRateRecommendations(
  timeSpanDays: number,
  currentPoints: number
): { 
  recommendation: string; 
  suggestedMode?: ResolutionMode; 
  reason: string 
} {
  if (currentPoints > 5000) {
    return {
      recommendation: 'Reduce resolution',
      suggestedMode: timeSpanDays > 365 ? 'full' : timeSpanDays > 180 ? '1year' : timeSpanDays > 30 ? '6months' : '1month',
      reason: 'Too many points may cause performance issues'
    };
  }
  
  if (currentPoints < 1000 && timeSpanDays < 30) {
    return {
      recommendation: 'Increase resolution',
      suggestedMode: '1month',
      reason: 'More detail available for short time periods'
    };
  }
  
  return {
    recommendation: 'Current resolution is optimal',
    reason: 'Good balance between detail and performance'
  };
}