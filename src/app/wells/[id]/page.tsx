'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { WellBrowser } from '@/components/WellBrowser';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { DatabaseInfo, Well } from '@/lib/api/api';

export default function WellsPage() {
  const params = useParams();
  const router = useRouter();
  const databaseId = params.id as string;

  const [database, setDatabase] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load database on mount
  useEffect(() => {
    const loadDatabase = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get database metadata from API
        const response = await fetch('/.netlify/functions/databases');
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch databases');
        }

        const databases = data.data as DatabaseInfo[];
        const dbInfo = databases.find(db => db.id === databaseId);
        
        if (!dbInfo) {
          throw new Error('Database not found');
        }

        setDatabase(dbInfo);
        
      } catch (err) {
        console.error('Error loading database:', err);
        setError(err instanceof Error ? err.message : 'Failed to load database');
      } finally {
        setLoading(false);
      }
    };

    loadDatabase();
  }, [databaseId]);

  const handleWellSelected = useCallback((well: Well) => {
    router.push(`/wells/${databaseId}/plot/${well.well_number}`);
  }, [databaseId, router]);

  const handleBackToDatabases = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleViewMap = useCallback(() => {
    router.push(`/wells/${databaseId}/map`);
  }, [databaseId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-blue-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-gray-300">Loading database...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-blue-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <h1 className="text-xl font-semibold text-white mb-2">
            Database Error
          </h1>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={handleBackToDatabases}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300"
          >
            ← Back to Databases
          </button>
        </div>
      </div>
    );
  }

  if (!database) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-blue-900">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={handleBackToDatabases}
                className="p-2 text-gray-400 hover:text-white transition-colors mobile-touch-target"
                title="Back to databases"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              {/* Small CAESER mascot - better visible and integrated */}
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center overflow-hidden hover:from-cyan-500/30 hover:to-blue-500/30 transition-all duration-300 hover:scale-110">
                  <img 
                    src="/caeser-mascot.png" 
                    alt="CAESER"
                    className="w-8 h-8 object-contain"
                  />
                </div>
                {/* Small glow effect */}
                <div className="absolute inset-0 w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400/10 to-blue-400/10 blur-sm -z-10"></div>
              </div>
              
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  {database.name}
                </h1>
                <p className="text-sm text-gray-300">
                  {database.wellsCount} wells available
                </p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handleViewMap}
                className="bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-medium py-2 px-3 rounded-lg transition-all duration-300 text-sm"
                title="View wells on map"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">Map View</span>
              </button>
              
              {/* Database Info Badge */}
              <div className="hidden md:flex items-center space-x-2 text-sm text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                <span>Database</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <WellBrowser
          databaseId={databaseId}
          onWellSelected={handleWellSelected}
        />
      </div>
    </div>
  );
}