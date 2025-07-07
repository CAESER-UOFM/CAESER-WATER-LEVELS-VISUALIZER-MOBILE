import type { WaterLevelReading, RechargeResult, Well } from '@/types/database';
import type { SamplingRate } from '@/utils/smartSampling';

// Export water level data to CSV format
export function exportWaterLevelDataToCSV(
  data: WaterLevelReading[],
  well: Well,
  filename?: string
): void {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // CSV headers
  const headers = [
    'Date/Time',
    'Water Level (ft)',
    'Temperature (°C)',
    'Data Type',
    'Quality'
  ];

  // Convert data to CSV rows
  const rows = data.map(reading => [
    reading.timestamp_utc,
    reading.water_level?.toString() || '',
    reading.temperature?.toString() || '',
    reading.data_source || '',
    reading.level_flag || ''
  ]);

  // Create CSV content
  const csvContent = [
    `# Water Level Data Export`,
    `# Well: ${well.well_number}`,
    well.cae_number ? `# CAE Number: ${well.cae_number}` : '',
    well.well_field ? `# Field: ${well.well_field}` : '',
    `# Export Date: ${new Date().toISOString()}`,
    `# Total Records: ${data.length}`,
    '',
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].filter(line => line !== '').join('\n');

  // Download file
  const finalFilename = filename || `water_level_data_${well.well_number}_${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(csvContent, finalFilename, 'text/csv');
}

// Export water level data to JSON format
export function exportWaterLevelDataToJSON(
  data: WaterLevelReading[],
  well: Well,
  filename?: string
): void {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  const exportData = {
    metadata: {
      well_number: well.well_number,
      cae_number: well.cae_number,
      well_field: well.well_field,
      latitude: well.latitude,
      longitude: well.longitude,
      ground_elevation: well.ground_elevation,
      export_date: new Date().toISOString(),
      total_records: data.length
    },
    data: data.map(reading => ({
      datetime: reading.timestamp_utc,
      water_level_ft: reading.water_level,
      temperature_c: reading.temperature,
      data_source: reading.data_source,
      level_flag: reading.level_flag
    }))
  };

  const jsonContent = JSON.stringify(exportData, null, 2);
  const finalFilename = filename || `water_level_data_${well.well_number}_${new Date().toISOString().split('T')[0]}.json`;
  downloadFile(jsonContent, finalFilename, 'application/json');
}

// Export recharge results to CSV format
export function exportRechargeResultsToCSV(
  results: RechargeResult[],
  well: Well,
  filename?: string
): void {
  if (results.length === 0) {
    throw new Error('No recharge results to export');
  }

  // CSV headers
  const headers = [
    'Method',
    'Calculation Date',
    'Start Date',
    'End Date',
    'Recharge (mm)',
    'Recharge (inches)',
    'Specific Yield',
    'Notes'
  ];

  // Convert data to CSV rows
  const rows = results.map(result => [
    result.method,
    result.calculation_date,
    result.start_date,
    result.end_date,
    result.recharge_mm?.toString() || '',
    result.recharge_inches?.toString() || '',
    result.specific_yield?.toString() || '',
    result.notes || ''
  ]);

  // Create CSV content
  const csvContent = [
    `# Recharge Results Export`,
    `# Well: ${well.well_number}`,
    well.cae_number ? `# CAE Number: ${well.cae_number}` : '',
    well.well_field ? `# Field: ${well.well_field}` : '',
    `# Export Date: ${new Date().toISOString()}`,
    `# Total Calculations: ${results.length}`,
    '',
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].filter(line => line !== '').join('\n');

  // Download file
  const finalFilename = filename || `recharge_results_${well.well_number}_${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(csvContent, finalFilename, 'text/csv');
}

// Export recharge results to JSON format
export function exportRechargeResultsToJSON(
  results: RechargeResult[],
  well: Well,
  filename?: string
): void {
  if (results.length === 0) {
    throw new Error('No recharge results to export');
  }

  const exportData = {
    metadata: {
      well_number: well.well_number,
      cae_number: well.cae_number,
      well_field: well.well_field,
      latitude: well.latitude,
      longitude: well.longitude,
      export_date: new Date().toISOString(),
      total_calculations: results.length
    },
    recharge_results: results.map(result => ({
      method: result.method,
      calculation_date: result.calculation_date,
      period: {
        start_date: result.start_date,
        end_date: result.end_date
      },
      recharge: {
        mm: result.recharge_mm,
        inches: result.recharge_inches
      },
      specific_yield: result.specific_yield,
      notes: result.notes
    }))
  };

  const jsonContent = JSON.stringify(exportData, null, 2);
  const finalFilename = filename || `recharge_results_${well.well_number}_${new Date().toISOString().split('T')[0]}.json`;
  downloadFile(jsonContent, finalFilename, 'application/json');
}

// Generate a PDF report (simplified version)
export function exportRechargeResultsToPDF(
  results: RechargeResult[],
  well: Well,
  filename?: string
): void {
  if (results.length === 0) {
    throw new Error('No recharge results to export');
  }

  // For now, create a simple HTML report that can be printed as PDF
  const htmlContent = generateRechargeReport(results, well);
  const finalFilename = filename || `recharge_report_${well.well_number}_${new Date().toISOString().split('T')[0]}.html`;
  downloadFile(htmlContent, finalFilename, 'text/html');
  
  // Open in new window for printing
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
  }
}

// Generate HTML report for recharge results
function generateRechargeReport(results: RechargeResult[], well: Well): string {
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.method]) acc[result.method] = [];
    acc[result.method].push(result);
    return acc;
  }, {} as Record<string, RechargeResult[]>);

  const methodDescriptions = {
    RISE: 'Recharge Investigation and Simulation Tool - automated water table fluctuation method',
    MRC: 'Manual Recharge Calculation - user-defined parameters and periods',
    EMR: 'Enhanced Manual Recharge - advanced manual calculation with additional parameters'
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recharge Results Report - Well ${well.well_number}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
        .header { border-bottom: 2px solid #ccc; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { margin: 0; color: #2563eb; }
        .metadata { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 20px 0; }
        .metadata dt { font-weight: bold; }
        .method-section { margin: 30px 0; page-break-inside: avoid; }
        .method-title { background: #f3f4f6; padding: 10px; border-left: 4px solid #2563eb; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f9fafb; font-weight: 600; }
        .summary { background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
        @media print { body { margin: 0; } .no-print { display: none; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>Recharge Results Report</h1>
        <h2>Well ${well.well_number}</h2>
        <div class="metadata">
            ${well.cae_number ? `<div><dt>CAE Number:</dt><dd>${well.cae_number}</dd></div>` : ''}
            ${well.well_field ? `<div><dt>Field:</dt><dd>${well.well_field}</dd></div>` : ''}
            <div><dt>Export Date:</dt><dd>${new Date().toLocaleDateString()}</dd></div>
            <div><dt>Total Calculations:</dt><dd>${results.length}</dd></div>
        </div>
    </div>

    <div class="summary">
        <h3>Summary</h3>
        <p>This report contains ${results.length} recharge calculations for well ${well.well_number} using ${Object.keys(groupedResults).length} different methods.</p>
    </div>

    ${Object.entries(groupedResults).map(([method, methodResults]) => `
    <div class="method-section">
        <div class="method-title">
            <h3>${method} Method (${methodResults.length} calculations)</h3>
            <p style="margin: 5px 0; font-size: 14px; color: #666;">${methodDescriptions[method as keyof typeof methodDescriptions] || 'Unknown method'}</p>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Calculation Date</th>
                    <th>Period</th>
                    <th>Recharge (mm)</th>
                    <th>Recharge (in)</th>
                    <th>Specific Yield</th>
                </tr>
            </thead>
            <tbody>
                ${methodResults
                  .sort((a, b) => new Date(b.calculation_date).getTime() - new Date(a.calculation_date).getTime())
                  .map(result => `
                <tr>
                    <td>${new Date(result.calculation_date).toLocaleDateString()}</td>
                    <td>${new Date(result.start_date).toLocaleDateString()} - ${new Date(result.end_date).toLocaleDateString()}</td>
                    <td>${result.recharge_mm?.toFixed(2) || '—'}</td>
                    <td>${result.recharge_inches?.toFixed(3) || '—'}</td>
                    <td>${result.specific_yield?.toFixed(3) || '—'}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    `).join('')}

    <div class="no-print" style="margin-top: 40px; text-align: center;">
        <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Print Report
        </button>
    </div>
</body>
</html>
  `;
}

// Utility function to download files
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Format data for export with optional date range filtering
export function filterDataForExport(
  data: WaterLevelReading[],
  startDate?: string,
  endDate?: string
): WaterLevelReading[] {
  if (!startDate && !endDate) return data;
  
  return data.filter(reading => {
    const readingDate = new Date(reading.timestamp_utc);
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    
    return readingDate >= start && readingDate <= end;
  });
}

// Chunked data fetcher for large exports
export async function fetchDataForExport(
  databaseId: string,
  wellNumber: string,
  samplingRate: SamplingRate,
  startDate: string,
  endDate: string,
  onProgress?: (progress: { current: number; total: number; percentage: number }) => void,
  signal?: AbortSignal
): Promise<WaterLevelReading[]> {
  const CHUNK_SIZE_DAYS = 30; // Fetch 30 days at a time
  const allData: WaterLevelReading[] = [];
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const totalChunks = Math.ceil(totalDays / CHUNK_SIZE_DAYS);
  
  let processedChunks = 0;
  
  for (let chunkStart = new Date(start); chunkStart < end; ) {
    // Check for cancellation
    if (signal?.aborted) {
      throw new Error('Export cancelled by user');
    }
    
    const chunkEnd = new Date(chunkStart);
    chunkEnd.setDate(chunkEnd.getDate() + CHUNK_SIZE_DAYS);
    if (chunkEnd > end) {
      chunkEnd.setTime(end.getTime());
    }
    
    try {
      const params = new URLSearchParams({
        samplingRate,
        startDate: chunkStart.toISOString(),
        endDate: chunkEnd.toISOString()
      });
      
      const response = await fetch(
        `/.netlify/functions/data/${databaseId}/water/${wellNumber}?${params}`,
        { 
          signal: AbortSignal.timeout(60000) // 60 second timeout per chunk
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch data chunk: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data chunk');
      }
      
      if (result.data && Array.isArray(result.data)) {
        allData.push(...result.data);
      }
      
      processedChunks++;
      
      // Report progress
      if (onProgress) {
        onProgress({
          current: processedChunks,
          total: totalChunks,
          percentage: Math.round((processedChunks / totalChunks) * 100)
        });
      }
      
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Export cancelled by user');
      }
      console.error('Error fetching data chunk:', error);
      throw new Error(`Failed to fetch data chunk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Move to next chunk
    chunkStart = new Date(chunkEnd);
    chunkStart.setDate(chunkStart.getDate() + 1);
  }
  
  // Sort data by timestamp
  allData.sort((a, b) => new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime());
  
  return allData;
}

// Enhanced export function with progress tracking
export async function exportWaterLevelDataWithProgress(
  databaseId: string,
  wellNumber: string,
  well: Well,
  options: {
    samplingRate: SamplingRate;
    startDate: string;
    endDate: string;
    format: 'csv' | 'json';
    filename?: string;
  },
  onProgress?: (progress: { stage: string; percentage: number; message: string }) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    // Stage 1: Fetch data
    onProgress?.({ stage: 'fetching', percentage: 0, message: 'Fetching data...' });
    
    const data = await fetchDataForExport(
      databaseId,
      wellNumber,
      options.samplingRate,
      options.startDate,
      options.endDate,
      (fetchProgress) => {
        onProgress?.({
          stage: 'fetching',
          percentage: Math.round(fetchProgress.percentage * 0.8), // 80% of progress for fetching
          message: `Fetching data chunk ${fetchProgress.current} of ${fetchProgress.total}...`
        });
      },
      signal
    );
    
    // Stage 2: Process and export
    onProgress?.({ stage: 'processing', percentage: 80, message: 'Processing data for export...' });
    
    if (signal?.aborted) {
      throw new Error('Export cancelled by user');
    }
    
    // Add export metadata to the data
    const exportMetadata = {
      exportDate: new Date().toISOString(),
      samplingRate: options.samplingRate,
      dateRange: {
        start: options.startDate,
        end: options.endDate
      },
      totalRecords: data.length,
      exportOptions: options
    };
    
    onProgress?.({ stage: 'exporting', percentage: 90, message: 'Generating export file...' });
    
    // Export based on format
    if (options.format === 'csv') {
      exportWaterLevelDataToCSVWithMetadata(data, well, exportMetadata, options.filename);
    } else {
      exportWaterLevelDataToJSONWithMetadata(data, well, exportMetadata, options.filename);
    }
    
    onProgress?.({ stage: 'complete', percentage: 100, message: 'Export completed successfully!' });
    
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.message.includes('cancelled'))) {
      onProgress?.({ stage: 'cancelled', percentage: 0, message: 'Export cancelled' });
      throw new Error('Export cancelled by user');
    }
    
    onProgress?.({ stage: 'error', percentage: 0, message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    throw error;
  }
}

// Enhanced CSV export with metadata
function exportWaterLevelDataToCSVWithMetadata(
  data: WaterLevelReading[],
  well: Well,
  metadata: any,
  filename?: string
): void {
  const headers = [
    'Date/Time',
    'Water Level (ft)',
    'Temperature (°C)',
    'Data Type',
    'Quality'
  ];

  const rows = data.map(reading => [
    reading.timestamp_utc,
    reading.water_level?.toString() || '',
    reading.temperature?.toString() || '',
    reading.data_source || '',
    reading.level_flag || ''
  ]);

  const csvContent = [
    `# Water Level Data Export`,
    `# Well: ${well.well_number}`,
    well.cae_number ? `# CAE Number: ${well.cae_number}` : '',
    well.well_field ? `# Field: ${well.well_field}` : '',
    `# Export Date: ${metadata.exportDate}`,
    `# Sampling Rate: ${metadata.samplingRate}`,
    `# Date Range: ${new Date(metadata.dateRange.start).toLocaleDateString()} - ${new Date(metadata.dateRange.end).toLocaleDateString()}`,
    `# Total Records: ${metadata.totalRecords}`,
    '',
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].filter(line => line !== '').join('\n');

  const finalFilename = filename || `water_level_${well.well_number}_${metadata.samplingRate}_${new Date().toISOString().split('T')[0]}.csv`;
  downloadFile(csvContent, finalFilename, 'text/csv');
}

// Enhanced JSON export with metadata
function exportWaterLevelDataToJSONWithMetadata(
  data: WaterLevelReading[],
  well: Well,
  metadata: any,
  filename?: string
): void {
  const exportData = {
    metadata: {
      well_number: well.well_number,
      cae_number: well.cae_number,
      well_field: well.well_field,
      latitude: well.latitude,
      longitude: well.longitude,
      ground_elevation: well.ground_elevation,
      export_date: metadata.exportDate,
      sampling_rate: metadata.samplingRate,
      date_range: metadata.dateRange,
      total_records: metadata.totalRecords,
      export_settings: metadata.exportOptions
    },
    data: data.map(reading => ({
      datetime: reading.timestamp_utc,
      water_level_ft: reading.water_level,
      temperature_c: reading.temperature,
      data_source: reading.data_source,
      level_flag: reading.level_flag
    }))
  };

  const jsonContent = JSON.stringify(exportData, null, 2);
  const finalFilename = filename || `water_level_${well.well_number}_${metadata.samplingRate}_${new Date().toISOString().split('T')[0]}.json`;
  downloadFile(jsonContent, finalFilename, 'application/json');
}