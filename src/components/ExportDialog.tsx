'use client';

import React, { useState, useCallback } from 'react';
import type { SamplingRate } from '@/utils/smartSampling';
import { SAMPLING_OPTIONS } from '@/utils/smartSampling';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  wellNumber: string;
  fullDataRange: { start: string; end: string } | null;
  isLoading?: boolean;
}

export interface ExportOptions {
  samplingRate: SamplingRate;
  startDate: string;
  endDate: string;
  format: 'csv' | 'json';
  filename?: string;
}

export function ExportDialog({
  isOpen,
  onClose,
  onExport,
  wellNumber,
  fullDataRange,
  isLoading = false
}: ExportDialogProps) {
  const [samplingRate, setSamplingRate] = useState<SamplingRate>('daily');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [startDate, setStartDate] = useState(fullDataRange?.start.split('T')[0] || '');
  const [endDate, setEndDate] = useState(fullDataRange?.end.split('T')[0] || '');
  const [customFilename, setCustomFilename] = useState('');

  const handleExport = useCallback(() => {
    const exportOptions: ExportOptions = {
      samplingRate,
      startDate: useCustomRange ? startDate : (fullDataRange?.start || ''),
      endDate: useCustomRange ? endDate : (fullDataRange?.end || ''),
      format,
      filename: customFilename || undefined
    };
    onExport(exportOptions);
  }, [samplingRate, useCustomRange, startDate, endDate, format, customFilename, fullDataRange, onExport]);

  const estimateDataPoints = useCallback(() => {
    if (!fullDataRange) return 0;
    
    const start = new Date(useCustomRange ? startDate : fullDataRange.start);
    const end = new Date(useCustomRange ? endDate : fullDataRange.end);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    const pointsPerDay = SAMPLING_OPTIONS[samplingRate].pointsPerDay;
    return Math.ceil(daysDiff * pointsPerDay);
  }, [samplingRate, useCustomRange, startDate, endDate, fullDataRange]);

  const estimatedPoints = estimateDataPoints();
  const isLargeExport = estimatedPoints > 50000;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Export Data</h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Well Information */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Well: <span className="font-medium">{wellNumber}</span></p>
            {fullDataRange && (
              <p className="text-xs text-gray-500 mt-1">
                Full range: {new Date(fullDataRange.start).toLocaleDateString()} - {new Date(fullDataRange.end).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Sampling Rate Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sampling Rate
            </label>
            <select
              value={samplingRate}
              onChange={(e) => setSamplingRate(e.target.value as SamplingRate)}
              disabled={isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {Object.entries(SAMPLING_OPTIONS).map(([rate, option]) => (
                <option key={rate} value={rate}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Date Range</label>
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={useCustomRange}
                  onChange={(e) => setUseCustomRange(e.target.checked)}
                  disabled={isLoading}
                  className="mr-2"
                />
                Custom range
              </label>
            </div>
            
            {useCustomRange && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Format
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}
                  disabled={isLoading}
                  className="mr-2"
                />
                <span className="text-sm">CSV (Excel compatible)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="json"
                  checked={format === 'json'}
                  onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}
                  disabled={isLoading}
                  className="mr-2"
                />
                <span className="text-sm">JSON</span>
              </label>
            </div>
          </div>

          {/* Custom Filename */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filename (optional)
            </label>
            <input
              type="text"
              value={customFilename}
              onChange={(e) => setCustomFilename(e.target.value)}
              disabled={isLoading}
              placeholder={`water_level_${wellNumber}_${new Date().toISOString().split('T')[0]}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          {/* Data Size Estimation */}
          <div className={`rounded-lg p-3 ${isLargeExport ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
            <div className="flex items-center space-x-2">
              {isLargeExport ? (
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <div>
                <p className={`text-sm font-medium ${isLargeExport ? 'text-amber-800' : 'text-blue-800'}`}>
                  Estimated: {estimatedPoints.toLocaleString()} data points
                </p>
                {isLargeExport && (
                  <p className="text-xs text-amber-600 mt-1">
                    Large export - may take several minutes to complete
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isLoading || !fullDataRange}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Data
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}