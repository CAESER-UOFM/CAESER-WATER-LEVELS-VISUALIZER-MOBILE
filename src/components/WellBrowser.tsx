'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { Well, WellsQueryParams, PaginatedResponse } from '@/lib/api/api';

interface WellBrowserProps {
  databaseId: string;
  onWellSelected: (well: Well) => void;
}

export function WellBrowser({ databaseId, onWellSelected }: WellBrowserProps) {
  const [wells, setWells] = useState<Well[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAquifer, setSelectedAquifer] = useState('');
  const [dataTypeFilter, setDataTypeFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'well_number' | 'cae_number'>('well_number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalWells, setTotalWells] = useState(0);
  const [aquiferTypes, setAquiferTypes] = useState<string[]>([]);

  const pageSize = 20;

  // Load aquifer types for filter
  useEffect(() => {
    const loadAquiferTypes = async () => {
      try {
        const response = await fetch(`/.netlify/functions/wells/${databaseId}/aquifers`);
        const result = await response.json();
        
        if (result.success && result.data) {
          setAquiferTypes(result.data);
        }
      } catch (err) {
        console.error('Error loading aquifer types:', err);
        // Fallback to common aquifer types
        setAquiferTypes(['confined', 'unconfined', 'semiconfined']);
      }
    };

    loadAquiferTypes();
  }, [databaseId]);

  const loadWells = useCallback(async (params: WellsQueryParams = {}) => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(params.search && { search: params.search }),
        ...(params.aquifer && { aquifer: params.aquifer }),
        ...(params.dataType && { dataType: params.dataType }),
        ...(params.sortBy && { sortBy: params.sortBy }),
        ...(params.sortOrder && { sortOrder: params.sortOrder })
      });

      const response = await fetch(`/.netlify/functions/wells/${databaseId}?${queryParams}`);
      const result: PaginatedResponse<Well> = await response.json();

      if (result.success && result.data) {
        setWells(result.data);
        setTotalPages(result.pagination.totalPages);
        setTotalWells(result.pagination.total);
      } else {
        throw new Error(result.error || 'Failed to load wells');
      }
    } catch (err) {
      console.error('Error loading wells:', err);
      setError(err instanceof Error ? err.message : 'Failed to load wells');
      setWells([]);
    } finally {
      setLoading(false);
    }
  }, [databaseId, currentPage, pageSize]);

  // Load wells when filters change
  useEffect(() => {
    const params: WellsQueryParams = {
      search: searchTerm || undefined,
      aquifer: selectedAquifer || undefined,
      dataType: dataTypeFilter || undefined,
      sortBy,
      sortOrder
    };

    loadWells(params);
  }, [loadWells, searchTerm, selectedAquifer, dataTypeFilter, sortBy, sortOrder]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedAquifer, dataTypeFilter]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleAquiferChange = useCallback((value: string) => {
    setSelectedAquifer(value);
  }, []);

  const handleDataTypeFilterChange = useCallback((value: string) => {
    setDataTypeFilter(value);
  }, []);

  const handleSortChange = useCallback((field: 'well_number' | 'cae_number') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }, [sortBy]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'No data';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) {
      return (
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
      );
    }
    
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 15l4-4 4 4" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 9l-4 4-4-4" />
      </svg>
    );
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <h3 className="text-lg font-medium text-white mb-2">
          Error Loading Wells
        </h3>
        <p className="text-gray-300 mb-4">{error}</p>
        <button
          onClick={() => loadWells()}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Well Browser
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Search Wells
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Well number, CAE, field..."
                className="w-full px-3 py-2 pl-10 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors duration-200"
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Aquifer Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Aquifer Type
            </label>
            <select
              value={selectedAquifer}
              onChange={(e) => handleAquiferChange(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors duration-200"
            >
              <option value="">All Aquifers</option>
              {aquiferTypes.map(aquifer => (
                <option key={aquifer} value={aquifer}>
                  {aquifer.charAt(0).toUpperCase() + aquifer.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Data Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Data Type
            </label>
            <select
              value={dataTypeFilter}
              onChange={(e) => handleDataTypeFilterChange(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors duration-200"
            >
              <option value="">All Types</option>
              <option value="transducer">Transducer</option>
              <option value="telemetry">Telemetry</option>
              <option value="manual">Manual Only</option>
            </select>
          </div>

          {/* Results Count */}
          <div className="flex items-end">
            <div className="text-sm text-gray-300">
              <span className="font-medium text-cyan-400">{totalWells}</span> wells found
              {totalPages > 1 && (
                <span className="block text-xs text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Wells Table */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
        {loading ? (
          <div className="text-center py-12">
            <LoadingSpinner size="large" />
            <p className="mt-4 text-gray-300">Loading wells...</p>
          </div>
        ) : wells.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">
              No Wells Found
            </h3>
            <p className="text-gray-300">
              Try adjusting your search criteria or filters
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50 border-b border-gray-600">
                <tr>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600/50 mobile-touch-target transition-colors"
                    onClick={() => handleSortChange('well_number')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Well Number</span>
                      {getSortIcon('well_number')}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-600/50 mobile-touch-target transition-colors"
                    onClick={() => handleSortChange('cae_number')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>CAE Number</span>
                      {getSortIcon('cae_number')}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Aquifer Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Transducer
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Manual Readings</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800/30 divide-y divide-gray-600">
                {wells.map((well) => (
                  <tr 
                    key={well.well_number}
                    className="hover:bg-gray-700/50 cursor-pointer transition-colors duration-200"
                    onClick={() => onWellSelected(well)}
                  >
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {well.well_number}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">
                      {well.cae_number || '—'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">
                      <span className="capitalize">
                        {well.aquifer_type || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-cyan-400">
                          {well.has_transducer_data ? (well.total_readings || 0) - (well.manual_readings_count || 0) : 0}
                        </span>
                        {well.has_transducer_data && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-cyan-900/50 text-cyan-300 border border-cyan-600">
                            Available
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-emerald-400">{well.manual_readings_count || 0}</span>
                        {(well.manual_readings_count || 0) > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-900/50 text-emerald-300 border border-emerald-600">
                            Available
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-600 bg-gray-700/30 px-4 py-3 sm:px-6">
            <div className="flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-md border border-gray-600 bg-gray-700/50 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-600 bg-gray-700/50 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-300">
                  Showing{' '}
                  <span className="font-medium text-cyan-400">{(currentPage - 1) * pageSize + 1}</span>
                  {' '}to{' '}
                  <span className="font-medium text-cyan-400">
                    {Math.min(currentPage * pageSize, totalWells)}
                  </span>
                  {' '}of{' '}
                  <span className="font-medium text-cyan-400">{totalWells}</span>
                  {' '}results
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-600 hover:bg-gray-600/50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                          currentPage === page
                            ? 'z-10 bg-cyan-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600'
                            : 'text-gray-300 ring-1 ring-inset ring-gray-600 hover:bg-gray-600/50 focus:z-20 focus:outline-offset-0'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-600 hover:bg-gray-600/50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}