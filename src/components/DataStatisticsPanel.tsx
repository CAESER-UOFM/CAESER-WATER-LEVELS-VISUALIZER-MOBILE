'use client';

import React from 'react';
import type { WaterLevelReading } from '@/lib/api/api';

interface DataStatisticsProps {
  data: WaterLevelReading[];
  wellNumber: string;
}

interface StatValue {
  value: number | string;
  unit?: string;
  label: string;
  color?: string;
}

// Calculate basic statistics
function calculateBasicStats(data: WaterLevelReading[]): Record<string, StatValue> {
  const waterLevels = data
    .map(d => d.water_level)
    .filter(level => level !== undefined && level !== null) as number[];

  if (waterLevels.length === 0) {
    return {
      count: { value: 0, label: 'Total Points' },
      mean: { value: '—', label: 'Mean' },
      median: { value: '—', label: 'Median' },
      min: { value: '—', label: 'Minimum' },
      max: { value: '—', label: 'Maximum' },
      stdDev: { value: '—', label: 'Std Dev' }
    };
  }

  const sortedLevels = [...waterLevels].sort((a, b) => a - b);
  const mean = waterLevels.reduce((sum, val) => sum + val, 0) / waterLevels.length;
  const median = sortedLevels.length % 2 === 0
    ? (sortedLevels[sortedLevels.length / 2 - 1] + sortedLevels[sortedLevels.length / 2]) / 2
    : sortedLevels[Math.floor(sortedLevels.length / 2)];
  
  const variance = waterLevels.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / waterLevels.length;
  const stdDev = Math.sqrt(variance);

  return {
    count: { value: waterLevels.length.toLocaleString(), label: 'Total Points' },
    mean: { value: mean.toFixed(2), unit: 'ft', label: 'Mean', color: 'text-blue-600' },
    median: { value: median.toFixed(2), unit: 'ft', label: 'Median', color: 'text-blue-600' },
    min: { value: Math.min(...waterLevels).toFixed(2), unit: 'ft', label: 'Minimum', color: 'text-red-600' },
    max: { value: Math.max(...waterLevels).toFixed(2), unit: 'ft', label: 'Maximum', color: 'text-green-600' },
    stdDev: { value: stdDev.toFixed(3), unit: 'ft', label: 'Std Dev', color: 'text-gray-600' }
  };
}

// Calculate data quality metrics
function calculateDataQuality(data: WaterLevelReading[]): Record<string, StatValue> {
  if (data.length === 0) {
    return {
      completeness: { value: '0%', label: 'Data Completeness' },
      firstReading: { value: '—', label: 'First Reading' },
      lastReading: { value: '—', label: 'Last Reading' },
      dataSpan: { value: '—', label: 'Data Span' }
    };
  }

  const validReadings = data.filter(d => d.water_level !== undefined && d.water_level !== null);
  const completeness = ((validReadings.length / data.length) * 100).toFixed(1);

  const timestamps = data.map(d => new Date(d.timestamp_utc)).sort((a, b) => a.getTime() - b.getTime());
  const firstReading = timestamps[0];
  const lastReading = timestamps[timestamps.length - 1];
  
  const spanDays = Math.floor((lastReading.getTime() - firstReading.getTime()) / (1000 * 60 * 60 * 24));
  const spanYears = (spanDays / 365.25).toFixed(1);

  return {
    completeness: { 
      value: `${completeness}%`, 
      label: 'Data Completeness',
      color: parseFloat(completeness) > 95 ? 'text-green-600' : parseFloat(completeness) > 85 ? 'text-yellow-600' : 'text-red-600'
    },
    firstReading: { 
      value: firstReading.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), 
      label: 'First Reading' 
    },
    lastReading: { 
      value: lastReading.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), 
      label: 'Last Reading' 
    },
    dataSpan: { 
      value: `${spanYears} years`, 
      label: 'Data Span',
      color: 'text-primary-600'
    }
  };
}

// Calculate recent trend (last 30 days vs previous period)
function calculateRecentTrend(data: WaterLevelReading[]): Record<string, StatValue> {
  const validData = data.filter(d => d.water_level !== undefined && d.water_level !== null);
  
  if (validData.length < 10) {
    return {
      recentTrend: { value: '—', label: 'Recent Trend (30d)' },
      trendDirection: { value: '—', label: 'Trend Direction' }
    };
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const recentData = validData.filter(d => new Date(d.timestamp_utc) >= thirtyDaysAgo);
  const previousData = validData.filter(d => {
    const date = new Date(d.timestamp_utc);
    return date >= sixtyDaysAgo && date < thirtyDaysAgo;
  });

  if (recentData.length === 0 || previousData.length === 0) {
    return {
      recentTrend: { value: '—', label: 'Recent Trend (30d)' },
      trendDirection: { value: 'Insufficient data', label: 'Trend Direction' }
    };
  }

  const recentAvg = recentData.reduce((sum, d) => sum + d.water_level!, 0) / recentData.length;
  const previousAvg = previousData.reduce((sum, d) => sum + d.water_level!, 0) / previousData.length;
  const change = recentAvg - previousAvg;
  const changePercent = ((change / previousAvg) * 100);

  let direction = 'Stable';
  let color = 'text-gray-600';
  
  if (Math.abs(changePercent) > 1) {
    if (change > 0) {
      direction = 'Rising';
      color = 'text-green-600';
    } else {
      direction = 'Declining';
      color = 'text-red-600';
    }
  }

  return {
    recentTrend: { 
      value: `${change >= 0 ? '+' : ''}${change.toFixed(3)} ft`,
      unit: `(${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%)`,
      label: 'Recent Trend (30d)',
      color: change >= 0 ? 'text-green-600' : 'text-red-600'
    },
    trendDirection: { 
      value: direction, 
      label: 'Trend Direction',
      color
    }
  };
}

// Calculate seasonal metrics
function calculateSeasonalMetrics(data: WaterLevelReading[]): Record<string, StatValue> {
  const validData = data.filter(d => d.water_level !== undefined && d.water_level !== null);
  
  if (validData.length < 100) {
    return {
      seasonal: { value: 'Insufficient data', label: 'Seasonal Pattern' }
    };
  }

  // Group by month
  const monthlyData: Record<number, number[]> = {};
  validData.forEach(d => {
    const month = new Date(d.timestamp_utc).getMonth();
    if (!monthlyData[month]) monthlyData[month] = [];
    monthlyData[month].push(d.water_level!);
  });

  // Calculate monthly averages
  const monthlyAvgs = Object.entries(monthlyData).map(([month, levels]) => ({
    month: parseInt(month),
    avg: levels.reduce((sum, level) => sum + level, 0) / levels.length
  }));

  if (monthlyAvgs.length < 6) {
    return {
      seasonal: { value: 'Limited seasonal data', label: 'Seasonal Pattern' }
    };
  }

  // Find highest and lowest months
  const maxMonth = monthlyAvgs.reduce((max, curr) => curr.avg > max.avg ? curr : max);
  const minMonth = monthlyAvgs.reduce((min, curr) => curr.avg < min.avg ? curr : min);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const seasonalRange = maxMonth.avg - minMonth.avg;

  return {
    highMonth: { 
      value: monthNames[maxMonth.month], 
      unit: `(${maxMonth.avg.toFixed(2)} ft)`,
      label: 'Highest Month',
      color: 'text-green-600'
    },
    lowMonth: { 
      value: monthNames[minMonth.month], 
      unit: `(${minMonth.avg.toFixed(2)} ft)`,
      label: 'Lowest Month',
      color: 'text-red-600'
    },
    seasonalRange: { 
      value: seasonalRange.toFixed(2), 
      unit: 'ft',
      label: 'Seasonal Range',
      color: 'text-primary-600'
    }
  };
}

export function DataStatisticsPanel({ data, wellNumber }: DataStatisticsProps) {
  const basicStats = calculateBasicStats(data);
  const dataQuality = calculateDataQuality(data);
  const recentTrend = calculateRecentTrend(data);
  const seasonalMetrics = calculateSeasonalMetrics(data);

  const StatCard = ({ stat, title }: { stat: StatValue; title: string }) => (
    <div className="bg-white p-3 rounded-lg border border-gray-200">
      <div className="text-xs font-medium text-gray-500 mb-1">{stat.label}</div>
      <div className={`text-lg font-semibold ${stat.color || 'text-gray-900'}`}>
        {stat.value}
        {stat.unit && <span className="text-sm font-normal text-gray-500 ml-1">{stat.unit}</span>}
      </div>
    </div>
  );

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Statistics</h3>
      
      <div className="space-y-6">
        {/* Basic Statistics */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Basic Statistics</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard stat={basicStats.count} title="Count" />
            <StatCard stat={basicStats.mean} title="Mean" />
            <StatCard stat={basicStats.median} title="Median" />
            <StatCard stat={basicStats.min} title="Min" />
            <StatCard stat={basicStats.max} title="Max" />
            <StatCard stat={basicStats.stdDev} title="Std Dev" />
          </div>
        </div>

        {/* Data Quality */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Data Quality & Coverage</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard stat={dataQuality.completeness} title="Completeness" />
            <StatCard stat={dataQuality.dataSpan} title="Data Span" />
            <StatCard stat={dataQuality.firstReading} title="First" />
            <StatCard stat={dataQuality.lastReading} title="Last" />
          </div>
        </div>

        {/* Recent Trends */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Analysis</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StatCard stat={recentTrend.recentTrend} title="30-Day Trend" />
            <StatCard stat={recentTrend.trendDirection} title="Direction" />
          </div>
        </div>

        {/* Seasonal Patterns */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Seasonal Patterns</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {seasonalMetrics.highMonth && <StatCard stat={seasonalMetrics.highMonth} title="High Month" />}
            {seasonalMetrics.lowMonth && <StatCard stat={seasonalMetrics.lowMonth} title="Low Month" />}
            {seasonalMetrics.seasonalRange && <StatCard stat={seasonalMetrics.seasonalRange} title="Range" />}
            {seasonalMetrics.seasonal && <StatCard stat={seasonalMetrics.seasonal} title="Pattern" />}
          </div>
        </div>

        {/* Data Type Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Data Sources</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs font-medium text-blue-700 mb-1">Transducer</div>
              <div className="text-lg font-semibold text-blue-900">
                {data.filter(d => d.data_source === 'transducer').length.toLocaleString()}
              </div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="text-xs font-medium text-purple-700 mb-1">Telemetry</div>
              <div className="text-lg font-semibold text-purple-900">
                {data.filter(d => d.data_source === 'telemetry').length.toLocaleString()}
              </div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-xs font-medium text-green-700 mb-1">Manual</div>
              <div className="text-lg font-semibold text-green-900">
                {data.filter(d => d.data_source === 'manual').length.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}