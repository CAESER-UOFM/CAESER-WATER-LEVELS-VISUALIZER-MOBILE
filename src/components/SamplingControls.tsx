'use client';

import React from 'react';
import { ResolutionMode } from '@/types/database';
import { ResolutionModeSelector } from './ResolutionModeSelector';

// Legacy mapping for backward compatibility
const LEGACY_TO_RESOLUTION_MAP: Record<string, ResolutionMode> = {
  'Overview': 'full',
  'Medium Detail': '1year',
  'Full Detail': '1month'
};

const RESOLUTION_TO_LEGACY_MAP: Record<ResolutionMode, string> = {
  'full': 'Overview',
  '1year': 'Medium Detail',
  '6months': 'Medium Detail', // Fallback to closest legacy option
  '1month': 'Full Detail'
};

export interface SamplingOption {
  label: string;
  value: string;
  intervalMinutes: number | null; // null means no downsampling
}

const SAMPLING_OPTIONS: SamplingOption[] = [
  { label: 'Overview', value: 'Overview', intervalMinutes: null }, // Full dataset - ~5000 points
  { label: 'Last Year', value: 'Medium Detail', intervalMinutes: null }, // 1 year - ~5000 points
  { label: 'Last Month', value: 'Full Detail', intervalMinutes: null }, // 1 month - ~5000 points
];

interface SamplingControlsProps {
  selectedSampling: string;
  onSamplingChange: (sampling: string) => void;
  totalPoints: number;
  displayedPoints: number;
  isLoading?: boolean;
}

/**
 * @deprecated Use ResolutionModeSelector instead. This component is maintained for backward compatibility.
 */
export function SamplingControls({ 
  selectedSampling, 
  onSamplingChange, 
  totalPoints, 
  displayedPoints,
  isLoading = false 
}: SamplingControlsProps) {
  // Convert legacy sampling to resolution mode
  const currentResolution = LEGACY_TO_RESOLUTION_MAP[selectedSampling] || 'full';
  
  // Handle resolution change and convert back to legacy format
  const handleResolutionChange = (resolution: ResolutionMode) => {
    const legacyValue = RESOLUTION_TO_LEGACY_MAP[resolution] || 'Overview';
    onSamplingChange(legacyValue);
  };

  return (
    <ResolutionModeSelector
      selectedResolution={currentResolution}
      onResolutionChange={handleResolutionChange}
      totalDataPoints={totalPoints}
      displayedPoints={displayedPoints}
      isLoading={isLoading}
    />
  );
}

// Utility function to downsample data based on time intervals
export function downsampleData<T extends { timestamp_utc: string; water_level?: number }>(
  data: T[],
  intervalMinutes: number | null
): T[] {
  if (!intervalMinutes || data.length === 0) {
    return data; // Return original data if no downsampling needed
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  const result: T[] = [];
  const groups = new Map<number, T[]>();

  // Group data points by time intervals
  data.forEach(point => {
    const timestamp = new Date(point.timestamp_utc).getTime();
    const intervalKey = Math.floor(timestamp / intervalMs) * intervalMs;
    
    if (!groups.has(intervalKey)) {
      groups.set(intervalKey, []);
    }
    groups.get(intervalKey)!.push(point);
  });

  // For each interval, calculate average or select representative point
  Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([intervalKey, points]) => {
      if (points.length === 1) {
        result.push(points[0]);
      } else {
        // Calculate average water level for the interval
        const validWaterLevels = points
          .map(p => p.water_level)
          .filter(level => level !== undefined && level !== null) as number[];
        
        if (validWaterLevels.length > 0) {
          const avgWaterLevel = validWaterLevels.reduce((sum, level) => sum + level, 0) / validWaterLevels.length;
          
          // Use the first point as template and update water level
          const representative = { ...points[0] };
          if (representative.water_level !== undefined) {
            representative.water_level = avgWaterLevel;
          }
          
          // Use timestamp at the middle of the interval
          representative.timestamp_utc = new Date(intervalKey + intervalMs / 2).toISOString();
          
          result.push(representative);
        }
      }
    });

  return result;
}