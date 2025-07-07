'use client';

import { useState, useCallback } from 'react';
import { WaterLevelDatabase } from '@/lib/database';
import type { DatabaseInfo } from '@/types/database';

interface DatabaseUploadProps {
  onDatabaseUploaded: (database: DatabaseInfo) => void;
}

export function DatabaseUpload({ onDatabaseUploaded }: DatabaseUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const validateAndProcessFile = useCallback(async (file: File): Promise<DatabaseInfo> => {
    // Validate file type
    const validExtensions = ['.db', '.sqlite', '.sqlite3'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      throw new Error('Invalid file type. Please upload a SQLite database file (.db, .sqlite, .sqlite3)');
    }

    // Validate file size (max 100MB for mobile)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      throw new Error('File too large. Maximum size is 100MB for mobile visualization.');
    }

    setUploadProgress(25);

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    setUploadProgress(50);

    // Validate database structure
    const db = new WaterLevelDatabase(arrayBuffer);
    await db.initialize();
    setUploadProgress(75);

    // Get wells count for metadata
    const wellsResult = await db.getWells({ limit: 1 });
    const wellsCount = wellsResult.pagination.total;
    
    db.close();
    setUploadProgress(90);

    // Create database info
    const databaseId = `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const databaseInfo: DatabaseInfo = {
      id: databaseId,
      name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      filename: file.name,
      uploadDate: new Date().toISOString(),
      wellsCount,
      size: file.size
    };

    // Store in localStorage for persistence (in a real app, this would be uploaded to cloud storage)
    const dbData = Array.from(new Uint8Array(arrayBuffer));
    localStorage.setItem(`db_${databaseId}`, JSON.stringify(dbData));
    
    // Store metadata
    const existingDatabases = JSON.parse(localStorage.getItem('uploaded_databases') || '[]');
    existingDatabases.push(databaseInfo);
    localStorage.setItem('uploaded_databases', JSON.stringify(existingDatabases));

    setUploadProgress(100);
    return databaseInfo;
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const databaseInfo = await validateAndProcessFile(file);
      
      // Small delay to show 100% progress
      setTimeout(() => {
        onDatabaseUploaded(databaseInfo);
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload database');
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [validateAndProcessFile, onDatabaseUploaded]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
  }, []);

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200
          ${dragOver 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${isUploading ? 'pointer-events-none opacity-75' : 'cursor-pointer'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => {
          if (!isUploading) {
            document.getElementById('database-file-input')?.click();
          }
        }}
      >
        <input
          id="database-file-input"
          type="file"
          accept=".db,.sqlite,.sqlite3"
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />
        
        {isUploading ? (
          <div className="space-y-4">
            <div className="w-16 h-16 loading-spinner mx-auto"></div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                Processing database...
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500">
                {uploadProgress}% complete
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <svg 
              className="w-12 h-12 text-gray-400 mx-auto" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
              />
            </svg>
            <div>
              <p className="text-lg font-medium text-gray-900 mb-1">
                Drop database file here
              </p>
              <p className="text-sm text-gray-600">
                or click to browse files
              </p>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>Supported formats: .db, .sqlite, .sqlite3</p>
              <p>Maximum size: 100MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-900 mb-1">
                Upload Failed
              </h3>
              <p className="text-sm text-red-700">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>
          <strong>Tip:</strong> Upload SQLite database files from the main Water Level Monitoring application.
        </p>
        <p>
          The database should contain wells and water_level_readings tables with monitoring data.
        </p>
      </div>
    </div>
  );
}