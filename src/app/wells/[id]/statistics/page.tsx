'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface WaterLevelStats {
  totalWells: number;
  totalReadings: number;
  overallStats: {
    minLevel: number;
    maxLevel: number;
    avgLevel: number;
    minDate: string;
    maxDate: string;
  };
  wellStats: Array<{
    wellNumber: string;
    caeNumber: string;
    aquifer: string;
    totalReadings: number;
    minLevel: number;
    maxLevel: number;
    avgLevel: number;
    trend: {
      slope: number;
      direction: 'rising' | 'falling' | 'stable';
      confidence: number;
    };
    seasonalPattern: {
      highestMonth: number;
      lowestMonth: number;
      seasonalVariation: number;
    };
    recentActivity: {
      lastReading: string;
      last30Days: number;
      last90Days: number;
    };
  }>;
  monthlyStats: Array<{
    month: number;
    monthName: string;
    avgLevel: number;
    readingCount: number;
  }>;
  yearlyStats: Array<{
    year: number;
    avgLevel: number;
    minLevel: number;
    maxLevel: number;
    readingCount: number;
    trend: number;
  }>;
}

const monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export default function StatisticsPage() {
  const params = useParams();
  const router = useRouter();
  const databaseId = params.id as string;

  const [stats, setStats] = useState<WaterLevelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStatistics = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/.netlify/functions/statistics?databaseId=${databaseId}`);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to load statistics');
        }

        setStats(result.data);
      } catch (err) {
        console.error('Error loading statistics:', err);
        setError(err instanceof Error ? err.message : 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    loadStatistics();
  }, [databaseId]);

  const handleBackToWells = () => {
    router.push(`/wells/${databaseId}`);
  };

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
        return <span className="text-green-600">↗</span>;
      case 'falling':
        return <span className="text-red-600">↘</span>;
      default:
        return <span className="text-gray-500">→</span>;
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Statistics</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={handleBackToWells} className="btn-primary">
            ← Back to Wells
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleBackToWells}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                title="Back to wells"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Water Level Statistics</h1>
                <p className="text-sm text-gray-600">Data insights and analysis</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        
        {/* Overall Statistics */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.totalWells}</div>
              <div className="text-sm text-gray-600">Total Wells</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.totalReadings.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Readings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.overallStats.avgLevel.toFixed(2)} ft</div>
              <div className="text-sm text-gray-600">Average Level</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{(stats.overallStats.maxLevel - stats.overallStats.minLevel).toFixed(2)} ft</div>
              <div className="text-sm text-gray-600">Range</div>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Highest Level:</span>
              <span className="ml-2 text-green-600 font-semibold">{stats.overallStats.maxLevel.toFixed(2)} ft</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Lowest Level:</span>
              <span className="ml-2 text-red-600 font-semibold">{stats.overallStats.minLevel.toFixed(2)} ft</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Data Period:</span>
              <span className="ml-2">{formatDate(stats.overallStats.minDate)} - {formatDate(stats.overallStats.maxDate)}</span>
            </div>
          </div>
        </div>

        {/* Monthly Patterns */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Seasonal Patterns</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2">
            {stats.monthlyStats.map((month) => (
              <div key={month.month} className="text-center">
                <div className="text-xs font-medium text-gray-600">{monthNames[month.month - 1]}</div>
                <div className="text-sm font-semibold text-blue-600">{month.avgLevel.toFixed(1)}</div>
                <div className="text-xs text-gray-500">{month.readingCount}</div>
              </div>
            ))}
          </div>
          
          {stats.monthlyStats.length > 0 && (
            <div className="mt-4 text-sm text-gray-600">
              <span className="font-medium">Seasonal Insights:</span>
              {(() => {
                const highest = stats.monthlyStats.reduce((max, month) => month.avgLevel > max.avgLevel ? month : max);
                const lowest = stats.monthlyStats.reduce((min, month) => month.avgLevel < min.avgLevel ? month : min);
                return (
                  <span className="ml-2">
                    Peak levels in <span className="text-green-600 font-medium">{highest.monthName}</span> ({highest.avgLevel.toFixed(1)} ft), 
                    lowest in <span className="text-red-600 font-medium">{lowest.monthName}</span> ({lowest.avgLevel.toFixed(1)} ft)
                  </span>
                );
              })()}
            </div>
          )}
        </div>

        {/* Yearly Trends */}
        {stats.yearlyStats.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Yearly Trends</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-sm font-medium text-gray-600">Year</th>
                    <th className="text-center py-2 text-sm font-medium text-gray-600">Avg Level</th>
                    <th className="text-center py-2 text-sm font-medium text-gray-600">Range</th>
                    <th className="text-center py-2 text-sm font-medium text-gray-600">Readings</th>
                    <th className="text-center py-2 text-sm font-medium text-gray-600">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.yearlyStats.map((year) => (
                    <tr key={year.year} className="border-b border-gray-100">
                      <td className="py-2 text-sm font-medium">{year.year}</td>
                      <td className="py-2 text-sm text-center">{year.avgLevel.toFixed(2)} ft</td>
                      <td className="py-2 text-sm text-center">{(year.maxLevel - year.minLevel).toFixed(2)} ft</td>
                      <td className="py-2 text-sm text-center">{year.readingCount.toLocaleString()}</td>
                      <td className="py-2 text-sm text-center">
                        {year.trend !== 0 && (
                          <span className={year.trend > 0 ? 'text-green-600' : 'text-red-600'}>
                            {year.trend > 0 ? '↗' : '↘'} {Math.abs(year.trend).toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Top Wells by Activity */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Most Active Wells</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-sm font-medium text-gray-600">Well</th>
                  <th className="text-left py-2 text-sm font-medium text-gray-600">CAE</th>
                  <th className="text-center py-2 text-sm font-medium text-gray-600">Aquifer</th>
                  <th className="text-center py-2 text-sm font-medium text-gray-600">Readings</th>
                  <th className="text-center py-2 text-sm font-medium text-gray-600">Avg Level</th>
                  <th className="text-center py-2 text-sm font-medium text-gray-600">Range</th>
                  <th className="text-center py-2 text-sm font-medium text-gray-600">Trend</th>
                </tr>
              </thead>
              <tbody>
                {stats.wellStats.slice(0, 10).map((well) => (
                  <tr key={well.wellNumber} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 text-sm font-medium">{well.wellNumber}</td>
                    <td className="py-2 text-sm">{well.caeNumber}</td>
                    <td className="py-2 text-sm text-center">{well.aquifer}</td>
                    <td className="py-2 text-sm text-center">{well.totalReadings.toLocaleString()}</td>
                    <td className="py-2 text-sm text-center">{well.avgLevel.toFixed(2)} ft</td>
                    <td className="py-2 text-sm text-center">{(well.maxLevel - well.minLevel).toFixed(2)} ft</td>
                    <td className="py-2 text-sm text-center">
                      <span className={getTrendColor(well.trend.direction)}>
                        {getTrendIcon(well.trend.direction)} {well.trend.direction}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        {stats.wellStats.some(w => w.recentActivity.last30Days > 0) && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity (Last 30 Days)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.wellStats
                .filter(w => w.recentActivity.last30Days > 0)
                .slice(0, 6)
                .map((well) => (
                  <div key={well.wellNumber} className="p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium text-gray-900">{well.caeNumber || well.wellNumber}</div>
                    <div className="text-sm text-gray-600">{well.aquifer}</div>
                    <div className="mt-2 text-sm">
                      <span className="text-blue-600 font-medium">{well.recentActivity.last30Days}</span> readings
                    </div>
                    <div className="text-xs text-gray-500">
                      Last: {formatDate(well.recentActivity.lastReading)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}