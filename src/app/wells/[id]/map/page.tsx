'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// Dynamic import to avoid SSR issues with Leaflet
const WellsMap = dynamic(() => import('@/components/WellsMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <LoadingSpinner size="large" />
    </div>
  )
});

interface WellLocation {
  well_number: string;
  cae_number: string;
  latitude: number;
  longitude: number;
  aquifer: string;
  well_field: string;
  cluster: string;
  ground_elevation?: number;
  well_depth?: number;
  static_water_level?: number;
  last_reading_date?: string;
  total_readings: number;
  data_status: 'transducer' | 'telemetry' | 'manual' | 'no_data';
  status: 'has_data' | 'limited_data' | 'no_data';
  has_manual_readings: boolean;
  has_transducer_data: boolean;
  has_telemetry_data: boolean;
  notes: string;
}

export default function MapPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const databaseId = params.id as string;
  const highlightWell = searchParams.get('highlight');

  const [wells, setWells] = useState<WellLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAquifer, setSelectedAquifer] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLegendExpanded, setIsLegendExpanded] = useState(true);
  const [resetMapView, setResetMapView] = useState<(() => void) | null>(null);

  useEffect(() => {
    const loadWellLocations = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/.netlify/functions/wells-locations?databaseId=${databaseId}`);
        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Failed to load well locations');
        }

        setWells(result.data || []);
      } catch (err) {
        console.error('Error loading well locations:', err);
        setError(err instanceof Error ? err.message : 'Failed to load well locations');
      } finally {
        setLoading(false);
      }
    };

    loadWellLocations();
  }, [databaseId]);

  const handleBackToWells = () => {
    router.push(`/wells/${databaseId}`);
  };

  const handleWellClick = (wellNumber: string) => {
    router.push(`/wells/${databaseId}/plot/${wellNumber}`);
  };

  // Filter wells based on search and aquifer
  const filteredWells = wells.filter(well => {
    const matchesSearch = searchTerm === '' || 
      well.well_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      well.cae_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAquifer = selectedAquifer === 'all' || well.aquifer === selectedAquifer;
    
    return matchesSearch && matchesAquifer;
  });

  // Get unique aquifers for filter
  const uniqueAquifers = Array.from(new Set(wells.map(w => w.aquifer))).filter(Boolean).sort();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-600">Loading well locations...</p>
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
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Map</h1>
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
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-200 z-20">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left side - Back button and title */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleBackToWells}
                className="p-1.5 text-gray-600 hover:text-gray-900 transition-colors"
                title="Back to wells"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  Wells Map
                  {highlightWell && (
                    <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                      Showing Well {highlightWell}
                    </span>
                  )}
                </h1>
                <p className="text-xs text-gray-500">{filteredWells.length} of {wells.length} wells</p>
              </div>
            </div>

            {/* Right side - Compact controls */}
            <div className="flex items-center space-x-2">
              {resetMapView && (
                <button
                  onClick={resetMapView}
                  className="btn-outline text-xs px-2 py-1.5 flex items-center space-x-1"
                  title="Reset to initial view"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Reset View</span>
                </button>
              )}
              <button
                onClick={handleBackToWells}
                className="btn-outline text-xs px-2 py-1.5"
              >
                List View
              </button>
            </div>
          </div>

          {/* Compact Filters */}
          <div className="mt-3 flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search wells..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div className="w-32">
              <select
                value={selectedAquifer}
                onChange={(e) => setSelectedAquifer(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="all">All</option>
                {uniqueAquifers.map(aquifer => (
                  <option key={aquifer} value={aquifer}>{aquifer}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Map */}
      <div className="flex-1 relative">
        {wells.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Well Locations</h3>
              <p className="text-gray-600">No wells with coordinate data found in this database.</p>
            </div>
          </div>
        ) : (
          <>
            <WellsMap
              wells={filteredWells}
              highlightWell={highlightWell}
              onWellClick={handleWellClick}
              databaseId={databaseId}
              onResetReady={setResetMapView}
            />
            
            {/* Collapsible Legend - Top Left */}
            <div className="absolute top-4 left-4 bg-white rounded-lg shadow-xl border-2 border-gray-300 z-[1000]" style={{zIndex: 1000}}>
              {/* Legend Header - Always Visible */}
              <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 rounded-t-lg"
                onClick={() => setIsLegendExpanded(!isLegendExpanded)}
              >
                <h3 className="text-sm font-semibold text-gray-900">Legend</h3>
                <svg 
                  className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${isLegendExpanded ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              
              {/* Collapsible Content */}
              {isLegendExpanded && (
                <div className="px-3 pb-3">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <svg width="20" height="20" viewBox="0 0 20 20" className="flex-shrink-0">
                        <circle cx="10" cy="10" r="9" fill="#ffffff" stroke="#059669" strokeWidth="1.5"/>
                        <circle cx="10" cy="10" r="6" fill="#10b981" stroke="#059669" strokeWidth="1"/>
                        <circle cx="10" cy="10" r="2" fill="#ffffff"/>
                      </svg>
                      <span className="text-sm text-gray-700 font-medium">MEM - Memphis Aquifer</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <svg width="20" height="20" viewBox="0 0 20 20" className="flex-shrink-0">
                        <circle cx="10" cy="10" r="9" fill="#ffffff" stroke="#2563eb" strokeWidth="1.5"/>
                        <circle cx="10" cy="10" r="6" fill="#3b82f6" stroke="#2563eb" strokeWidth="1"/>
                        <circle cx="10" cy="10" r="2" fill="#ffffff"/>
                      </svg>
                      <span className="text-sm text-gray-700 font-medium">FP - Fort Pillow Aquifer</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <svg width="20" height="20" viewBox="0 0 20 20" className="flex-shrink-0">
                        <circle cx="10" cy="10" r="9" fill="#ffffff" stroke="#d97706" strokeWidth="1.5"/>
                        <circle cx="10" cy="10" r="6" fill="#f59e0b" stroke="#d97706" strokeWidth="1"/>
                        <circle cx="10" cy="10" r="2" fill="#ffffff"/>
                      </svg>
                      <span className="text-sm text-gray-700 font-medium">SHAL - Shallow Aquifer</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <svg width="20" height="20" viewBox="0 0 20 20" className="flex-shrink-0">
                        <circle cx="10" cy="10" r="9" fill="#ffffff" stroke="#7c3aed" strokeWidth="1.5"/>
                        <circle cx="10" cy="10" r="6" fill="#8b5cf6" stroke="#7c3aed" strokeWidth="1"/>
                        <circle cx="10" cy="10" r="2" fill="#ffffff"/>
                      </svg>
                      <span className="text-sm text-gray-700 font-medium">Unknown Aquifer</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <svg width="20" height="20" viewBox="0 0 20 20" className="flex-shrink-0">
                        <circle cx="10" cy="10" r="9" fill="#ffffff" stroke="#4b5563" strokeWidth="1.5"/>
                        <circle cx="10" cy="10" r="6" fill="#6b7280" stroke="#4b5563" strokeWidth="1"/>
                        <circle cx="10" cy="10" r="2" fill="#ffffff"/>
                      </svg>
                      <span className="text-sm text-gray-700 font-medium">No Data</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <svg width="20" height="20" viewBox="0 0 20 20" className="flex-shrink-0">
                        <circle cx="10" cy="10" r="12" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.7"/>
                        <circle cx="10" cy="10" r="9" fill="#ffffff" stroke="#dc2626" strokeWidth="1.5"/>
                        <circle cx="10" cy="10" r="6" fill="#ef4444" stroke="#dc2626" strokeWidth="1"/>
                        <circle cx="10" cy="10" r="2" fill="#ffffff"/>
                        <circle cx="10" cy="10" r="1" fill="#dc2626"/>
                      </svg>
                      <span className="text-sm text-gray-700 font-medium">Selected</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500">Colors indicate aquifer type • Click pins for details</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}