'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SmartWaterLevelChart } from '@/components/SmartWaterLevelChart';
import { WellInfoPanel } from '@/components/WellInfoPanel';
import { WellStatisticsPanel } from '@/components/WellStatisticsPanel';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ExportDialog, type ExportOptions } from '@/components/ExportDialog';
import { SimplePlotCustomizationDialog } from '@/components/SimplePlotCustomizationDialog';
import { type PlotCustomization } from '@/components/PlotCustomizationDialog';
import { exportWaterLevelDataWithProgress } from '@/utils/dataExport';
import { exportCustomPlot } from '@/utils/customPlotExport';
import type { Well } from '@/lib/api/api';

export default function PlotViewerPage() {
  const params = useParams();
  const router = useRouter();
  const databaseId = params.id as string;
  const wellNumber = params.wellNumber as string;

  const [well, setWell] = useState<Well | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showPlotCustomization, setShowPlotCustomization] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{stage: string; percentage: number; message: string} | null>(null);
  const [currentTimeRange, setCurrentTimeRange] = useState<{ start: string; end: string } | null>(null);
  const chartRef = useRef<{ switchToDailyOverview: () => void; resetZoom: () => void; isZoomed: boolean } | null>(null);
  const [chartInfo, setChartInfo] = useState<{ 
    totalPoints: number; 
    displayedPoints: number; 
    samplingRate: string;
    dataRange: { start: string; end: string } | null;
    isHighRes: boolean;
    currentData?: any[];
  }>({ 
    totalPoints: 0, 
    displayedPoints: 0, 
    samplingRate: 'Loading...',
    dataRange: null,
    isHighRes: false,
    currentData: []
  });
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode

  // Handle chart info updates - stable callback
  const updateChartInfo = useCallback((info: typeof chartInfo) => {
    setChartInfo(info);
    if (info.dataRange) {
      setCurrentTimeRange(info.dataRange);
    }
  }, []);

  // Load well data and initial overview
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError(null);
        

        // Load well metadata
        const wellResponse = await fetch(`/.netlify/functions/wells/${databaseId}/${wellNumber}`);
        const wellResult = await wellResponse.json();
        
        if (!wellResult.success) {
          throw new Error(wellResult.error || 'Well not found');
        }
        setWell(wellResult.data);

      } catch (err) {
        console.error('Error loading initial data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load well data');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [databaseId, wellNumber]);





  const handleBackToWells = useCallback(() => {
    router.push(`/wells/${databaseId}`);
  }, [databaseId, router]);

  const handleExportData = useCallback(() => {
    setShowExportDialog(true);
  }, []);

  const handleCustomizePlot = useCallback(() => {
    setShowPlotCustomization(true);
  }, []);

  const handleCustomPlotExport = useCallback(async (customization: PlotCustomization) => {
    if (!well || !currentTimeRange) return;

    setIsExporting(true);
    setShowPlotCustomization(false);
    setExportProgress({ stage: 'preparing', percentage: 0, message: 'Preparing custom plot export...' });

    try {
      const abortController = new AbortController();
      
      await exportCustomPlot(
        databaseId,
        wellNumber,
        well,
        customization,
        (progress) => {
          setExportProgress(progress);
        },
        abortController.signal,
        chartInfo.currentData // Pass existing data to avoid re-fetching
      );

      // Success - close dialog after a brief delay
      setTimeout(() => {
        setExportProgress(null);
        setIsExporting(false);
      }, 1500);

    } catch (error) {
      console.error('Custom plot export failed:', error);
      
      setExportProgress({ 
        stage: 'error', 
        percentage: 0, 
        message: `Custom plot export failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });

      // Reset after showing error
      setTimeout(() => {
        setExportProgress(null);
        setIsExporting(false);
      }, 3000);
    }
  }, [databaseId, wellNumber, well, currentTimeRange]);

  const handleExportDialogClose = useCallback(() => {
    if (!isExporting) {
      setShowExportDialog(false);
      setExportProgress(null);
    }
  }, [isExporting]);

  const handleExportStart = useCallback(async (options: ExportOptions) => {
    if (!well || !currentTimeRange) return;

    setIsExporting(true);
    setExportProgress({ stage: 'preparing', percentage: 0, message: 'Preparing export...' });

    const abortController = new AbortController();

    try {
      await exportWaterLevelDataWithProgress(
        databaseId,
        wellNumber,
        well,
        options,
        (progress) => {
          setExportProgress(progress);
        },
        abortController.signal
      );

      // Success - close dialog after a brief delay
      setTimeout(() => {
        setShowExportDialog(false);
        setExportProgress(null);
        setIsExporting(false);
      }, 1500);

    } catch (error) {
      console.error('Export failed:', error);
      
      if (error instanceof Error && error.message.includes('cancelled')) {
        setExportProgress({ stage: 'cancelled', percentage: 0, message: 'Export cancelled' });
      } else {
        setExportProgress({ 
          stage: 'error', 
          percentage: 0, 
          message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
      }

      // Reset after showing error
      setTimeout(() => {
        setShowExportDialog(false);
        setExportProgress(null);
        setIsExporting(false);
      }, 3000);
    }
  }, [databaseId, wellNumber, well, currentTimeRange]);

  const handleViewRecharge = useCallback(() => {
    router.push(`/wells/${databaseId}/recharge/${wellNumber}`);
  }, [databaseId, wellNumber, router]);

  const handleViewOnMap = useCallback(() => {
    router.push(`/wells/${databaseId}/map?highlight=${wellNumber}`);
  }, [databaseId, wellNumber, router]);

  if (loading && !well) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-gradient-to-br from-gray-900 via-slate-900 to-blue-900' 
          : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className={`mt-4 transition-colors duration-300 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>Loading well data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-gradient-to-br from-gray-900 via-slate-900 to-blue-900' 
          : 'bg-gray-50'
      }`}>
        <div className="text-center max-w-md mx-auto px-4">
          <svg className={`w-16 h-16 mx-auto mb-4 transition-colors duration-300 ${
            isDarkMode ? 'text-red-400' : 'text-red-500'
          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h1 className={`text-xl font-semibold mb-2 transition-colors duration-300 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Error Loading Data
          </h1>
          <p className={`mb-4 transition-colors duration-300 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>{error}</p>
          <div className="space-x-3">
            <button
              onClick={handleBackToWells}
              className={`font-medium py-2 px-4 rounded-lg transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white' 
                  : 'bg-white hover:bg-gray-50 border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900'
              }`}
            >
              ← Back to Wells
            </button>
            <button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!well) {
    return null;
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-gray-900 via-slate-900 to-blue-900' 
        : 'bg-gray-50'
    }`}>
      {/* Header */}
      <div className={`backdrop-blur-sm border-b sticky top-0 z-10 transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-gray-800/50 border-gray-700' 
          : 'bg-white/90 border-gray-200'
      }`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleBackToWells}
                className={`p-2 transition-colors mobile-touch-target ${
                  isDarkMode 
                    ? 'text-gray-400 hover:text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Back to wells"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className={`text-xl font-semibold transition-colors duration-300 ${
                  isDarkMode 
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent' 
                    : 'text-gray-900'
                }`}>
                  Well {well.well_number}
                </h1>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              {/* Theme Toggle */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-2 rounded-lg transition-all duration-300 ${
                  isDarkMode 
                    ? 'bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600 text-gray-300 hover:text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-600 hover:text-gray-900'
                }`}
                title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
              >
                {isDarkMode ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              <button
                onClick={handleViewOnMap}
                className={`font-medium py-2 px-3 rounded-lg transition-all duration-300 text-sm ${
                  isDarkMode 
                    ? 'bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white' 
                    : 'bg-white hover:bg-gray-50 border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900'
                }`}
                title="View well location on map"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">Map</span>
              </button>
              
              <button
                onClick={handleViewRecharge}
                className={`font-medium py-2 px-3 rounded-lg transition-all duration-300 text-sm ${
                  isDarkMode 
                    ? 'bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white' 
                    : 'bg-white hover:bg-gray-50 border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900'
                }`}
                title="View recharge calculations"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="hidden sm:inline">Recharge</span>
              </button>
              
              
              {/* Export Button */}
              <button
                onClick={handleExportData}
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium py-2 px-3 rounded-lg transition-all duration-300 text-sm"
                title="Export data"
                disabled={isExporting}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">Export Data</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Well Information Panel - Top */}
        <WellInfoPanel
          well={well}
          currentTimeRange={currentTimeRange}
          totalPoints={chartInfo.totalPoints}
          displayedPoints={chartInfo.displayedPoints}
          samplingRate={chartInfo.samplingRate}
          isDarkMode={isDarkMode}
        />

        {/* Well Statistics Panel */}
        <WellStatisticsPanel 
          databaseId={databaseId}
          wellNumber={wellNumber}
          isDarkMode={isDarkMode}
        />

        {/* Chart */}
        <div className={`backdrop-blur-sm border rounded-xl p-6 shadow-xl transition-colors duration-300 ${
          isDarkMode 
            ? 'bg-gray-800/50 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1"></div>
            <h2 className={`text-lg font-semibold transition-colors duration-300 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              Water Level Data
            </h2>
            <div className="flex-1 flex justify-end">
              <div className="flex items-center space-x-2">
              {/* Back to Overview button - always visible, goes to full daily view */}
              <button
                onClick={() => {
                  if (chartRef.current) {
                    chartRef.current.switchToDailyOverview();
                  }
                  // Also reset zoom
                  if ((window as any).chartResetZoom) {
                    (window as any).chartResetZoom();
                  }
                }}
                disabled={loading}
                className={`px-3 py-1 text-sm rounded-lg disabled:opacity-50 transition-colors border ${
                  isDarkMode 
                    ? 'bg-cyan-900/50 text-cyan-300 hover:bg-cyan-800/50 border-cyan-600' 
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300'
                }`}
              >
                Back to Overview
              </button>
              {/* Reset Zoom button - only when high-res data loaded */}
              {chartInfo.isHighRes && (
                <button
                  onClick={() => {
                    if ((window as any).chartResetZoom) {
                      (window as any).chartResetZoom();
                    }
                  }}
                  disabled={loading}
                  className={`px-3 py-1 text-sm rounded-lg disabled:opacity-50 transition-colors border ${
                    isDarkMode 
                      ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border-gray-600' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
                  }`}
                >
                  Reset Zoom
                </button>
              )}
              {/* Plot Customization Button - inside chart controls */}
              <button
                onClick={handleCustomizePlot}
                className={`px-3 py-1 text-sm rounded-lg transition-colors border ${
                  isDarkMode 
                    ? 'bg-purple-900/50 text-purple-300 hover:bg-purple-800/50 border-purple-600' 
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-300'
                }`}
                title="Customize plot appearance and export"
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
                Customize Plot
              </button>
              {/* Loading indicator */}
              {loading && (
                <div className={`flex items-center space-x-2 text-sm transition-colors duration-300 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  <LoadingSpinner size="small" />
                  <span>Updating...</span>
                </div>
              )}
              </div>
            </div>
          </div>
          
          <SmartWaterLevelChart
            ref={chartRef}
            databaseId={databaseId}
            wellNumber={wellNumber}
            title=""
            height={400}
            onError={(error) => setError(error)}
            onInfoUpdate={updateChartInfo}
          />
        </div>

      </div>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={handleExportDialogClose}
        onExport={handleExportStart}
        wellNumber={wellNumber}
        fullDataRange={currentTimeRange}
        isLoading={isExporting}
      />

      {/* Plot Customization Dialog */}
      <SimplePlotCustomizationDialog
        isOpen={showPlotCustomization}
        onClose={() => setShowPlotCustomization(false)}
        onExport={handleCustomPlotExport}
        databaseId={databaseId}
        wellNumber={wellNumber}
        well={well}
        currentTimeRange={currentTimeRange}
        plotData={chartInfo.currentData || []}
        isDarkMode={isDarkMode}
      />

      {/* Export Progress Overlay */}
      {isExporting && exportProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className={`border rounded-lg p-6 w-full max-w-md mx-4 transition-colors duration-300 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700' 
              : 'bg-white border-gray-200'
          }`}>
            <div className="text-center">
              <h3 className={`text-lg font-semibold mb-4 transition-colors duration-300 ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>Exporting Data</h3>
              
              <div className={`w-full rounded-full h-2 mb-4 transition-colors duration-300 ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
              }`}>
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    exportProgress.stage === 'error' ? 'bg-red-500' :
                    exportProgress.stage === 'cancelled' ? 'bg-gray-500' :
                    exportProgress.stage === 'complete' ? 'bg-green-500' :
                    'bg-cyan-500'
                  }`}
                  style={{ width: `${exportProgress.percentage}%` }}
                />
              </div>
              
              <div className="space-y-2">
                <p className={`text-sm font-medium transition-colors duration-300 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {exportProgress.message}
                </p>
                <p className={`text-xs transition-colors duration-300 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {exportProgress.percentage}% complete
                </p>
              </div>

              {exportProgress.stage === 'complete' && (
                <div className="mt-4 flex items-center justify-center text-green-500">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium">Export completed successfully!</span>
                </div>
              )}

              {(exportProgress.stage === 'error' || exportProgress.stage === 'cancelled') && (
                <button
                  onClick={handleExportDialogClose}
                  className={`mt-4 px-4 py-2 rounded-md transition-colors ${
                    isDarkMode 
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}