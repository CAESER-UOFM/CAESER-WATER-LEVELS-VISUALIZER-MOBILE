/**
 * Smart Sampling Rate Calculator
 * 
 * Determines the best sampling rate for a given time range to stay under point limits
 * while providing maximum detail possible
 */

export type SamplingRate = '15min' | '1hour' | '6hour' | 'daily';

export interface SamplingOption {
  rate: SamplingRate;
  label: string;
  intervalMinutes: number;
  pointsPerDay: number;
  description: string;
}

export interface SamplingCalculation {
  rate: SamplingRate;
  estimatedPoints: number;
  timeSpanDays: number;
  isUpgrade: boolean; // true if this is better than daily
  maxPointsAllowed: number;
}

// Available sampling rates from highest to lowest resolution
export const SAMPLING_OPTIONS: Record<SamplingRate, SamplingOption> = {
  '15min': {
    rate: '15min',
    label: '15 minutes',
    intervalMinutes: 15,
    pointsPerDay: 96, // 24 * 60 / 15
    description: 'Highest detail - every 15 minutes'
  },
  '1hour': {
    rate: '1hour',
    label: '1 hour',
    intervalMinutes: 60,
    pointsPerDay: 24, // 24 * 60 / 60
    description: 'High detail - hourly readings'
  },
  '6hour': {
    rate: '6hour',
    label: '6 hours',
    intervalMinutes: 360,
    pointsPerDay: 4, // 24 * 60 / 360
    description: 'Medium detail - 4 readings per day'
  },
  'daily': {
    rate: 'daily',
    label: 'Daily',
    intervalMinutes: 1440,
    pointsPerDay: 1, // 24 * 60 / 1440
    description: 'Overview - one reading per day'
  }
};

/**
 * Calculate the best sampling rate for a given time range
 * @param startDate Start of the time range
 * @param endDate End of the time range
 * @param maxPoints Maximum points allowed (default 1500)
 * @returns Best sampling calculation
 */
export function calculateBestSampling(
  startDate: Date,
  endDate: Date,
  maxPoints: number = 1500
): SamplingCalculation {
  const timeSpanMs = endDate.getTime() - startDate.getTime();
  const timeSpanDays = Math.ceil(timeSpanMs / (1000 * 60 * 60 * 24));
  
  // Try each sampling rate from highest to lowest resolution
  const rates: SamplingRate[] = ['15min', '1hour', '6hour', 'daily'];
  
  for (const rate of rates) {
    const option = SAMPLING_OPTIONS[rate];
    const estimatedPoints = Math.ceil(timeSpanDays * option.pointsPerDay);
    
    if (estimatedPoints <= maxPoints) {
      return {
        rate,
        estimatedPoints,
        timeSpanDays,
        isUpgrade: rate !== 'daily',
        maxPointsAllowed: maxPoints
      };
    }
  }
  
  // Fallback to daily if everything exceeds limits (shouldn't happen with reasonable ranges)
  const dailyOption = SAMPLING_OPTIONS.daily;
  return {
    rate: 'daily',
    estimatedPoints: Math.ceil(timeSpanDays * dailyOption.pointsPerDay),
    timeSpanDays,
    isUpgrade: false,
    maxPointsAllowed: maxPoints
  };
}

/**
 * Get available sampling rates for a time range
 * Returns all rates that would be under the point limit
 */
export function getAvailableSamplingRates(
  startDate: Date,
  endDate: Date,
  maxPoints: number = 1500
): SamplingCalculation[] {
  const timeSpanMs = endDate.getTime() - startDate.getTime();
  const timeSpanDays = Math.ceil(timeSpanMs / (1000 * 60 * 60 * 24));
  
  const rates: SamplingRate[] = ['15min', '1hour', '6hour', 'daily'];
  const available: SamplingCalculation[] = [];
  
  for (const rate of rates) {
    const option = SAMPLING_OPTIONS[rate];
    const estimatedPoints = Math.ceil(timeSpanDays * option.pointsPerDay);
    
    if (estimatedPoints <= maxPoints) {
      available.push({
        rate,
        estimatedPoints,
        timeSpanDays,
        isUpgrade: rate !== 'daily',
        maxPointsAllowed: maxPoints
      });
    }
  }
  
  return available;
}

/**
 * Check if a sampling rate would provide better resolution than daily
 */
export function isUpgradeFromDaily(
  startDate: Date,
  endDate: Date,
  maxPoints: number = 1500
): boolean {
  const best = calculateBestSampling(startDate, endDate, maxPoints);
  return best.isUpgrade;
}

/**
 * Get a human-readable description of the sampling calculation
 */
export function formatSamplingDescription(calculation: SamplingCalculation): string {
  const option = SAMPLING_OPTIONS[calculation.rate];
  return `${option.label} intervals • ${calculation.estimatedPoints.toLocaleString()} points • ${calculation.timeSpanDays} days`;
}

/**
 * Calculate maximum time range for a given sampling rate and point limit
 */
export function getMaxTimeRangeForSampling(
  rate: SamplingRate,
  maxPoints: number = 1500
): number {
  const option = SAMPLING_OPTIONS[rate];
  return Math.floor(maxPoints / option.pointsPerDay);
}

/**
 * Estimate data size in bytes for a sampling calculation
 * Useful for cache management
 */
export function estimateDataSize(calculation: SamplingCalculation): number {
  // Rough estimate: each data point ~100 bytes (timestamp, values, metadata)
  return calculation.estimatedPoints * 100;
}

/**
 * Check if current zoom level warrants showing high-res options
 * @param totalDataSpanDays Full dataset span in days
 * @param currentZoomSpanDays Currently zoomed span in days
 * @returns true if high-res options should be shown
 */
export function shouldShowHighResOptions(
  totalDataSpanDays: number,
  currentZoomSpanDays: number
): boolean {
  // Show high-res options when zoomed to less than 50% of total range
  // and when the zoomed range can benefit from higher resolution
  const zoomPercentage = currentZoomSpanDays / totalDataSpanDays;
  return zoomPercentage < 0.5 && currentZoomSpanDays < 800; // Less than 800 days (2+ years)
}

/**
 * Get the cache key for a data segment
 */
export function getCacheKey(
  wellNumber: string,
  startDate: Date,
  endDate: Date,
  samplingRate: SamplingRate
): string {
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];
  return `${wellNumber}_${start}_${end}_${samplingRate}`;
}

/**
 * Parse a cache key back into its components
 */
export function parseCacheKey(key: string): {
  wellNumber: string;
  startDate: string;
  endDate: string;
  samplingRate: SamplingRate;
} | null {
  const parts = key.split('_');
  if (parts.length !== 4) return null;
  
  const [wellNumber, startDate, endDate, samplingRate] = parts;
  
  if (!Object.keys(SAMPLING_OPTIONS).includes(samplingRate)) {
    return null;
  }
  
  return {
    wellNumber,
    startDate,
    endDate,
    samplingRate: samplingRate as SamplingRate
  };
}