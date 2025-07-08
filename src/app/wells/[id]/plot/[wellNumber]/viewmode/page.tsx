'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ViewModeProvider } from '@/contexts/ViewModeContext';
import { WaterLevelChartViewMode } from '@/components/WaterLevelChartViewMode';
import { useViewModeData } from '@/hooks/useViewModeData';
import { CacheManagement } from '@/components/CacheManagement';
import type { PlotConfig } from '@/types/database';

// Inner component that uses the view mode context
function ViewModePlotContent() {
  const params = useParams();
  const router = useRouter();
  const databaseId = params.id as string;
  const wellNumber = params.wellNumber as string;

  const [plotConfig] = useState<PlotConfig>({
    showWaterLevel: true,
    showTemperature: false,
    showManualReadings: true,
    dateRange: {},
    colors: {
      waterLevel: '#3B82F6',
      temperature: '#EF4444',
      manual: '#10B981'
    }
  });

  const [metadata, setMetadata] = useState<any>(null);

  // Use the view mode data hook
  const { data, isLoading, error, metadata: dataMetadata, getCacheStats } = useViewModeData({
    databaseId,
    wellNumber,
    onError: (error) => {
      console.error('Data loading error:', error);
    }
  });

  // Display cache stats on mount
  useEffect(() => {
    getCacheStats().then(stats => {
      console.log('📊 Cache Stats:', {
        size: `${stats.totalSizeMB.toFixed(2)} MB`,
        segments: stats.segmentCount,
        utilization: `${stats.cacheUtilization.toFixed(1)}%`
      });
    });
  }, [getCacheStats]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              href={`/wells/${databaseId}`}
              className="text-blue-600 hover:text-blue-800 transition-colors"
            >
              ← Back to Wells
            </Link>
            <span className="text-gray-400">|</span>
            <Link
              href={`/wells/${databaseId}/plot/${wellNumber}`}
              className="text-blue-600 hover:text-blue-800 transition-colors"
            >
              Legacy View
            </Link>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900">
            Well {wellNumber} - Water Level Monitoring
          </h1>
          <p className="text-gray-600 mt-2">
            View Mode: Interactive visualization with predefined resolutions
          </p>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error Loading Data</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main chart */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <WaterLevelChartViewMode
            data={data as any}
            config={plotConfig}
            loading={isLoading}
            onMetadataChange={setMetadata}
          />
        </div>

        {/* Metadata display */}
        {metadata && dataMetadata && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Data Points</p>
                <p className="text-xl font-semibold text-gray-900">{metadata.totalPoints}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Manual Readings</p>
                <p className="text-xl font-semibold text-gray-900">{metadata.manualReadings}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Cache Status</p>
                <p className="text-xl font-semibold text-gray-900">
                  {dataMetadata.cacheStatus.hit ? '✅ Hit' : '❌ Miss'}
                </p>
              </div>
              {metadata.dataRange && (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Start Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(metadata.dataRange.start).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">End Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(metadata.dataRange.end).toLocaleDateString()}
                    </p>
                  </div>
                </>
              )}
              <div>
                <p className="text-sm text-gray-600">View Status</p>
                <p className="font-medium text-gray-900">{metadata.viewStatus}</p>
              </div>
            </div>
          </div>
        )}

        {/* Cache Management */}
        <div className="mt-6">
          <CacheManagement 
            wellNumber={wellNumber} 
            onCacheCleared={() => window.location.reload()}
          />
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">How to Use</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Select a view mode (Full, 1 Year, 6 Months, 1 Month) to change the time range and resolution</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Use the Previous/Next buttons to navigate within the selected resolution</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Click on the date in the navigation bar to jump to a specific date</span>
            </li>
            <li className="flex items-start">
              <span className="mr-2">•</span>
              <span>Data is automatically cached for faster loading when revisiting the same time range</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Main page component with provider
export default function ViewModePlotPage() {
  const params = useParams();
  const databaseId = params.id as string;
  const wellNumber = params.wellNumber as string;

  // Get initial data range
  const [dataRange, setDataRange] = useState<{ start: Date; end: Date } | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch data range for this well
    fetch(`/.netlify/functions/data/${databaseId}/water/${wellNumber}/range`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setDataRange({
            start: new Date(result.data.startDate),
            end: new Date(result.data.endDate)
          });
        }
      })
      .catch(err => {
        console.error('Failed to fetch data range:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [databaseId, wellNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 loading-spinner mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading view mode...</p>
        </div>
      </div>
    );
  }

  return (
    <ViewModeProvider initialMode="1month" dataRange={dataRange}>
      <ViewModePlotContent />
    </ViewModeProvider>
  );
}