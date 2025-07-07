'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { exportRechargeResultsToCSV, exportRechargeResultsToJSON, exportRechargeResultsToPDF } from '@/utils/dataExport';
import type { Well, RechargeResult, RechargeCalculationSummary } from '@/types/database';

export default function RechargeResultsPage() {
  const params = useParams();
  const router = useRouter();
  const databaseId = params.id as string;
  const wellNumber = params.wellNumber as string;

  const [well, setWell] = useState<Well | null>(null);
  const [rechargeResults, setRechargeResults] = useState<RechargeCalculationSummary[]>([]);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRechargeData = async () => {
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

        // Load recharge results
        const rechargeResponse = await fetch(`/.netlify/functions/data/${databaseId}/recharge/${wellNumber}`);
        const rechargeResult = await rechargeResponse.json();
        
        if (rechargeResult.success) {
          setRechargeResults(rechargeResult.data || []);
        } else {
          // Don't fail if recharge data doesn't exist - just show empty results
          setRechargeResults([]);
        }

      } catch (err) {
        console.error('Error loading recharge data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load recharge data');
      } finally {
        setLoading(false);
      }
    };

    loadRechargeData();
  }, [databaseId, wellNumber]);

  const handleBackToPlot = useCallback(() => {
    router.push(`/wells/${databaseId}/plot/${wellNumber}`);
  }, [databaseId, wellNumber, router]);

  const handleBackToWells = useCallback(() => {
    router.push(`/wells/${databaseId}`);
  }, [databaseId, router]);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatRechargeValue = (value?: number, unit: string = 'mm'): string => {
    if (value === undefined || value === null) return '—';
    return `${value.toFixed(2)} ${unit}`;
  };

  const handleExportCSV = useCallback(async () => {
    if (!well || rechargeResults.length === 0) return;
    
    try {
      exportRechargeResultsToCSV(rechargeResults as any, well as any);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV file. Please try again.');
    }
  }, [well, rechargeResults]);

  const handleExportJSON = useCallback(async () => {
    if (!well || rechargeResults.length === 0) return;
    
    try {
      exportRechargeResultsToJSON(rechargeResults as any, well as any);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      alert('Failed to export JSON file. Please try again.');
    }
  }, [well, rechargeResults]);

  const handleExportPDF = useCallback(async () => {
    if (!well || rechargeResults.length === 0) return;
    
    try {
      exportRechargeResultsToPDF(rechargeResults as any, well as any);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF report. Please try again.');
    }
  }, [well, rechargeResults]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading recharge results...</p>
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
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Results
          </h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-x-3">
            <button onClick={handleBackToWells} className="btn-secondary">
              ← Back to Wells
            </button>
            <button onClick={() => window.location.reload()} className="btn-primary">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleBackToPlot}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors mobile-touch-target"
                title="Back to plot"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Recharge Results - Well {well?.well_number}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  {well?.cae_number && <span>CAE: {well.cae_number}</span>}
                  {well?.well_field && <span>Field: {well.well_field}</span>}
                  <span>{rechargeResults.length} calculation{rechargeResults.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleBackToPlot}
              className="btn-outline text-sm px-3 py-2"
            >
              View Plot
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {rechargeResults.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Recharge Results Available
            </h3>
            <p className="text-gray-600 mb-4">
              No recharge calculations have been performed for this well.
            </p>
            <button
              onClick={handleBackToPlot}
              className="btn-primary"
            >
              View Water Level Data
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Results Overview */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Recharge Calculation Summary
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['RISE', 'MRC'].map(method => {
                  const methodResults = rechargeResults.filter(r => r.method === method);
                  const latestResult = methodResults.sort((a, b) => 
                    new Date(b.calculation_date).getTime() - new Date(a.calculation_date).getTime()
                  )[0];
                  
                  return (
                    <div key={method} className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-2">{method} Method</h3>
                      {latestResult ? (
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Latest:</span>
                            <span className="font-medium">{formatDate(latestResult.calculation_date)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Recharge:</span>
                            <span className="font-medium text-primary-600">
                              {latestResult.total_recharge.toFixed(2)} inches
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Annual Rate:</span>
                            <span className="font-medium text-green-600">
                              {latestResult.annual_rate.toFixed(2)} in/yr
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Events:</span>
                            <span className="font-medium">{latestResult.total_events}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Calculations:</span>
                            <span className="font-medium">{methodResults.length}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No calculations</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed Results */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                All Recharge Calculations
              </h2>
              <div className="space-y-4">
                {rechargeResults
                  .sort((a, b) => new Date(b.calculation_date).getTime() - new Date(a.calculation_date).getTime())
                  .map((result) => (
                  <div key={result.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Summary Row */}
                    <div 
                      className="p-4 bg-white hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedResult(expandedResult === result.id ? null : result.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            result.method === 'RISE' ? 'bg-blue-100 text-blue-800' :
                            result.method === 'MRC' ? 'bg-green-100 text-green-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {result.method}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {formatDate(result.calculation_date)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {result.data_start_date && result.data_end_date && 
                                `${formatDate(result.data_start_date)} - ${formatDate(result.data_end_date)}`
                              }
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6 text-sm">
                          <div className="text-center">
                            <div className="font-medium text-primary-600">
                              {result.total_recharge.toFixed(2)} in
                            </div>
                            <div className="text-xs text-gray-500">Total Recharge</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-green-600">
                              {result.annual_rate.toFixed(2)} in/yr
                            </div>
                            <div className="text-xs text-gray-500">Annual Rate</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-gray-900">
                              {result.total_events}
                            </div>
                            <div className="text-xs text-gray-500">Events</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium text-gray-700">
                              {result.specific_yield?.toFixed(3) || '—'}
                            </div>
                            <div className="text-xs text-gray-500">Sy</div>
                          </div>
                          <svg 
                            className={`w-5 h-5 text-gray-400 transition-transform ${
                              expandedResult === result.id ? 'rotate-180' : ''
                            }`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedResult === result.id && result.details && (
                      <div className="border-t border-gray-200 bg-gray-50 p-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Parameters */}
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">Calculation Parameters</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Specific Yield:</span>
                                <span className="font-medium">{result.specific_yield?.toFixed(3)}</span>
                              </div>
                              {result.method === 'RISE' && result.details.parameters && (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Rise Threshold:</span>
                                    <span className="font-medium">{result.details.parameters.rise_threshold?.toFixed(3)} ft</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Water Year Start:</span>
                                    <span className="font-medium">{result.details.parameters.water_year_start_month}/{result.details.parameters.water_year_start_day}</span>
                                  </div>
                                </>
                              )}
                              {result.method === 'MRC' && result.details.deviation_threshold && (
                                <>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Deviation Threshold:</span>
                                    <span className="font-medium">{result.details.deviation_threshold.toFixed(3)} ft</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Curve Type:</span>
                                    <span className="font-medium">{result.details.curve_info?.curve_type}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">R²:</span>
                                    <span className="font-medium">{result.details.curve_info?.r_squared?.toFixed(4)}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Yearly Summary */}
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">Yearly Summary</h4>
                            {result.details.yearly_summaries || result.details.yearly_summary ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-gray-200">
                                      <th className="text-left py-1">Year</th>
                                      <th className="text-right py-1">Events</th>
                                      <th className="text-right py-1">Recharge (in)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(result.details.yearly_summaries || result.details.yearly_summary || []).map((year: any, idx: number) => (
                                      <tr key={idx} className="border-b border-gray-100">
                                        <td className="py-1">{year.water_year}</td>
                                        <td className="text-right py-1">{year.num_events}</td>
                                        <td className="text-right py-1">{year.total_recharge?.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No yearly breakdown available</p>
                            )}
                          </div>
                        </div>

                        {result.notes && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                            <p className="text-sm text-gray-700">{result.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Method Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3">RISE Method</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Rapid Intensive Successive Events - automated water table fluctuation method that identifies 
                  rapid water level rises and calculates recharge using Recharge = Rise Height × Specific Yield.
                </p>
                <div className="text-xs text-gray-500">
                  <p>• Automated rise event detection</p>
                  <p>• Water year analysis (Oct 1 - Sep 30)</p>
                  <p>• Quality control filters and thresholds</p>
                  <p>• Statistical summaries by year</p>
                </div>
              </div>

              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3">MRC Method</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Master Recession Curve - fits recession curves to declining water levels, then calculates 
                  recharge when actual levels exceed predicted curve levels.
                </p>
                <div className="text-xs text-gray-500">
                  <p>• Recession curve fitting (exponential, power law, 2-segment)</p>
                  <p>• Deviation-based recharge calculation</p>
                  <p>• User-defined deviation thresholds</p>
                  <p>• Curve versioning and comparison</p>
                </div>
              </div>
            </div>

            {/* Export Options */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">Export Results</h3>
              <p className="text-sm text-gray-600 mb-4">
                Download recharge calculation results for further analysis.
              </p>
              <div className="flex flex-wrap gap-3">
                <button 
                  className="btn-outline"
                  onClick={handleExportCSV}
                  disabled={rechargeResults.length === 0}
                >
                  📊 Export CSV
                </button>
                <button 
                  className="btn-outline"
                  onClick={handleExportJSON}
                  disabled={rechargeResults.length === 0}
                >
                  📋 Export JSON
                </button>
                <button 
                  className="btn-outline"
                  onClick={handleExportPDF}
                  disabled={rechargeResults.length === 0}
                >
                  📄 Export Report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}