'use client';

import React from 'react';
import type { Well } from '@/lib/api/api';

interface WellInfoPanelProps {
  well: Well;
  currentTimeRange?: {
    start: string;
    end: string;
  } | null;
  totalPoints: number;
  displayedPoints: number;
  samplingRate: string;
  isDarkMode?: boolean; // Optional theme prop
}

export function WellInfoPanel({ 
  well, 
  currentTimeRange, 
  totalPoints, 
  displayedPoints,
  samplingRate,
  isDarkMode = true // Default to dark mode if not specified
}: WellInfoPanelProps) {
  const InfoItem = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
    <div>
      <div className={`text-xs font-medium transition-colors duration-300 ${
        isDarkMode ? 'text-gray-400' : 'text-gray-500'
      }`}>{label}</div>
      <div className={`text-sm font-semibold transition-colors duration-300 ${
        color || (isDarkMode ? 'text-white' : 'text-gray-900')
      }`}>{value}</div>
    </div>
  );

  return (
    <div className={`backdrop-blur-sm border rounded-xl p-6 shadow-xl transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-gray-800/50 border-gray-700' 
        : 'bg-white border-gray-200'
    }`}>
      <h3 className={`text-lg font-semibold mb-4 transition-colors duration-300 ${
        isDarkMode ? 'text-white' : 'text-gray-900'
      }`}>Well Information</h3>
      
      {/* Well Static Info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <InfoItem 
          label="Well Number" 
          value={well.well_number} 
          color={isDarkMode ? 'text-cyan-400' : 'text-blue-600'} 
        />
        <InfoItem label="CAE Number" value={well.cae_number || '—'} />
        <InfoItem label="Aquifer Type" value={well.aquifer_type ? well.aquifer_type.charAt(0).toUpperCase() + well.aquifer_type.slice(1) : '—'} />
        <InfoItem label="Top of Casing" value={well.top_of_casing ? `${well.top_of_casing.toFixed(2)} ft` : '—'} />
      </div>

      {/* Dataset Info */}
      <div className={`border rounded-lg p-4 transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-cyan-900/20 border-cyan-700/30' 
          : 'bg-blue-50 border-blue-200'
      }`}>
        <div className={`text-sm font-medium mb-3 transition-colors duration-300 ${
          isDarkMode ? 'text-cyan-300' : 'text-blue-700'
        }`}>Full Dataset</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoItem 
            label="Total Points Available" 
            value={`${well.total_readings?.toLocaleString() || totalPoints.toLocaleString()} (Manual: ${well.manual_readings_count?.toLocaleString() || 'N/A'})`} 
            color={isDarkMode ? 'text-cyan-400' : 'text-blue-600'} 
          />
          <InfoItem 
            label="Full Data Range" 
            value={currentTimeRange ? 
              `${new Date(currentTimeRange.start).toLocaleDateString()} - ${new Date(currentTimeRange.end).toLocaleDateString()}`
              : 'Loading...'
            } 
          />
          <InfoItem 
            label="Total Span" 
            value={currentTimeRange ? 
              (() => {
                // Use the same calculation method as WellStatisticsPanel for consistency
                const totalDays = Math.round((new Date(currentTimeRange.end).getTime() - new Date(currentTimeRange.start).getTime()) / (1000 * 60 * 60 * 24));
                const years = (totalDays / 365.25).toFixed(1);
                return `${totalDays} days (${years} years)`;
              })()
              : 'Loading...'
            } 
            color="text-gray-600" 
          />
        </div>
      </div>

    </div>
  );
}