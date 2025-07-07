'use client';

import { useState, useEffect } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface WellStatistics {
  wellNumber: string;
  totalReadings: number;
  dataRange: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  levels: {
    min: number;
    max: number;
    average: number;
    range: number;
    minDate: string;
    maxDate: string;
  };
  trend: {
    direction: 'rising' | 'falling' | 'stable';
    slope: number;
    changePerYear: number;
    confidence: number;
  };
  seasonal: {
    highestMonth: string;
    lowestMonth: string;
    seasonalVariation: number;
    monthlyAverages: Array<{
      month: string;
      average: number;
      readings: number;
    }>;
  };
  recent: {
    last30Days: number;
    last90Days: number;
    lastReading: string;
    recentTrend: 'rising' | 'falling' | 'stable';
  };
}

interface WellStatisticsPanelProps {
  databaseId: string;
  wellNumber: string;
  isDarkMode?: boolean; // Optional theme prop
}

export function WellStatisticsPanel({ databaseId, wellNumber, isDarkMode = true }: WellStatisticsPanelProps) {
  const [statistics, setStatistics] = useState<WellStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const loadStatistics = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get well statistics from our new endpoint
        const statsResponse = await fetch(`/.netlify/functions/well-statistics?wellNumber=${encodeURIComponent(wellNumber)}`);
        const statsResult = await statsResponse.json();
        
        if (!statsResult.success) {
          throw new Error(statsResult.error || 'Failed to load well statistics');
        }

        setStatistics(statsResult.data);
      } catch (err) {
        console.error('Error loading well statistics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    loadStatistics();
  }, [databaseId, wellNumber]);

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'rising':
        return <span className="text-green-600">📈</span>;
      case 'falling':
        return <span className="text-red-600">📉</span>; 
      default:
        return <span className="text-gray-500">➡️</span>;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'rising':
        return 'text-green-600';
      case 'falling':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  if (loading) {
    return (
      <div className={`backdrop-blur-sm border rounded-xl p-6 shadow-xl transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-gray-800/50 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="small" />
          <span className={`ml-2 transition-colors duration-300 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>Loading statistics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`backdrop-blur-sm border rounded-xl p-6 shadow-xl transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-gray-800/50 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="text-center py-4">
          <p className={`text-sm transition-colors duration-300 ${
            isDarkMode ? 'text-red-400' : 'text-red-600'
          }`}>{error}</p>
        </div>
      </div>
    );
  }

  if (!statistics) {
    return null;
  }

  return (
    <div className={`backdrop-blur-sm border rounded-xl p-6 shadow-xl transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-gray-800/50 border-gray-700' 
        : 'bg-white border-gray-200'
    }`}>
      {/* Header - Always visible */}
      <div 
        className={`flex items-center justify-between cursor-pointer -m-6 p-6 rounded-lg transition-colors duration-300 ${
          isDarkMode 
            ? 'hover:bg-gray-700/30' 
            : 'hover:bg-gray-50'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className={`text-lg font-semibold transition-colors duration-300 ${
          isDarkMode ? 'text-white' : 'text-gray-900'
        }`}>Well Statistics & Insights</h3>
        <svg 
          className={`w-5 h-5 transition-all duration-200 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          } ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Quick Summary - Always visible */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
        <div className="text-center">
          <div className="text-xl font-bold text-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {statistics.levels.min.toFixed(2)} ft
          </div>
          <div className="text-xs text-gray-600">Minimum Level</div>
          <div className="text-xs text-gray-500">{formatDate(statistics.levels.minDate)}</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-red-600 flex items-center justify-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            {statistics.levels.max.toFixed(2)} ft
          </div>
          <div className="text-xs text-gray-600">Maximum Level</div>
          <div className="text-xs text-gray-500">{formatDate(statistics.levels.maxDate)}</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-green-600 flex items-center justify-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            {statistics.levels.average.toFixed(2)} ft
          </div>
          <div className="text-xs text-gray-600">Average Level</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4" />
            </svg>
            {statistics.levels.range.toFixed(2)} ft
          </div>
          <div className="text-xs text-gray-600">Range</div>
        </div>
        <div className="text-center">
          <div className={`text-xl font-bold flex items-center justify-center ${getTrendColor(statistics.trend.direction)}`}>
            {getTrendIcon(statistics.trend.direction)}
            <span className="ml-1">{statistics.trend.direction}</span>
            <span className="ml-1 text-sm">({statistics.trend.changePerYear.toFixed(2)} ft/yr)</span>
          </div>
          <div className="text-xs text-gray-600">Trend</div>
        </div>
      </div>

      {/* Detailed Statistics - Collapsible */}
      {isExpanded && (
        <div className="mt-6 space-y-6">

          {/* Data Range */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Data Period</h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Start:</span>
                  <span className="ml-2">{formatDate(statistics.dataRange.startDate)}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">End:</span>
                  <span className="ml-2">{formatDate(statistics.dataRange.endDate)}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Duration:</span>
                  <span className="ml-2">{statistics.dataRange.totalDays > 0 ? (statistics.dataRange.totalDays / 365.25).toFixed(1) : '0'} years</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trend Analysis */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Trend Analysis</h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Trend Direction:</span>
                  <span className={`ml-2 ${getTrendColor(statistics.trend.direction)}`}>
                    {getTrendIcon(statistics.trend.direction)} {statistics.trend.direction}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Change per Year:</span>
                  <span className="ml-2">{statistics.trend.changePerYear.toFixed(3)} ft/year</span>
                </div>
              </div>
            </div>
          </div>

          {/* Seasonal Patterns */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Seasonal Patterns</h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Highest Month:</span>
                  <span className="ml-2">{statistics.seasonal.highestMonth || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Lowest Month:</span>
                  <span className="ml-2">{statistics.seasonal.lowestMonth || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Recent Activity</h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Readings (Last 30 Days):</span>
                  <span className="ml-2">{statistics.recent.last30Days.toLocaleString()}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Last Reading:</span>
                  <span className="ml-2">{formatDate(statistics.recent.lastReading)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}