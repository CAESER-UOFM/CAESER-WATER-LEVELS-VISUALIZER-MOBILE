'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { LivePlotPreview } from './LivePlotPreview';
import type { PlotCustomization } from './PlotCustomizationDialog';
import type { Well } from '@/lib/api/api';

// Utility function to format numbers with significant figures
function formatWithSignificantFigures(value: number, sigFigs: number): string {
  if (value === 0) return '0';
  
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const precision = sigFigs - magnitude - 1;
  
  if (precision >= 0) {
    return value.toFixed(precision);
  } else {
    const factor = Math.pow(10, -precision);
    return (Math.round(value / factor) * factor).toString();
  }
}


interface SimplePlotCustomizationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (customization: PlotCustomization) => void;
  databaseId: string;
  wellNumber: string;
  well: Well;
  currentTimeRange: { start: string; end: string } | null;
  plotData: any[];
  isDarkMode: boolean;
}


const presetTemplates = {
  'default': {
    name: 'Default (Balanced)',
    description: 'Well-balanced proportions for general use',
    config: {
      width: 1200,
      height: 800,
      aspectRatio: '3:2' as const,
      dpi: 300,
      title: { fontSize: 18 },
      xAxis: { fontSize: 14, tickFontSize: 12 },
      yAxis: { fontSize: 14, tickFontSize: 12 },
      legend: { fontSize: 12 },
      transducerData: { lineWidth: 2, pointSize: 4, showPoints: false },
      manualData: { pointSize: 6 },
    }
  },
  'publication': {
    name: 'Publication Ready',
    description: 'Clean, professional layout suitable for academic papers',
    config: {
      width: 2400,
      height: 1600,
      aspectRatio: '3:2' as const,
      dpi: 300,
      title: { fontSize: 28 },
      xAxis: { fontSize: 18, tickFontSize: 16 },
      yAxis: { fontSize: 18, tickFontSize: 16 },
      legend: { fontSize: 16 },
      transducerData: { lineWidth: 3, pointSize: 6, showPoints: false },
      manualData: { pointSize: 8 },
    }
  },
  'presentation': {
    name: 'Presentation Slides',
    description: 'Bold fonts and high contrast for presentations',
    config: {
      width: 1920,
      height: 1080,
      aspectRatio: '16:9' as const,
      dpi: 150,
      title: { fontSize: 32 },
      xAxis: { fontSize: 20, tickFontSize: 18 },
      yAxis: { fontSize: 20, tickFontSize: 18 },
      legend: { fontSize: 18 },
      transducerData: { lineWidth: 4, pointSize: 8, showPoints: true },
      manualData: { pointSize: 10 },
    }
  },
};

export function SimplePlotCustomizationDialog({
  isOpen,
  onClose,
  onExport,
  databaseId,
  wellNumber,
  well,
  currentTimeRange,
  plotData,
  isDarkMode
}: SimplePlotCustomizationDialogProps) {
  const [customization, setCustomization] = useState<PlotCustomization | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showFullImageViewer, setShowFullImageViewer] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [isRenderingImage, setIsRenderingImage] = useState(false);
  
  const dialogRef = useRef<HTMLDivElement>(null);
  const imageViewerContainerRef = useRef<HTMLDivElement>(null);

  // Initialize customization when dialog opens
  useEffect(() => {
    if (isOpen && currentTimeRange && !customization) {
      const generateFilename = () => {
        const caeNumber = well?.cae_number || wellNumber;
        const startDate = new Date(currentTimeRange.start);
        const endDate = new Date(currentTimeRange.end);
        
        const startYear = startDate.getFullYear();
        const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
        const endYear = endDate.getFullYear();
        const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
        
        return `${caeNumber}_${startYear}-${startMonth}_to_${endYear}-${endMonth}`;
      };

      // Initialize with default from the original interface
      setCustomization({
        width: 1200,
        height: 800,
        aspectRatio: '3:2',
        dpi: 300,
        showTransducerData: true,
        showManualData: true,
        showTemperatureData: false,
        dateRange: currentTimeRange,
        title: {
          text: `Well ${wellNumber}${well?.cae_number ? ` (${well.cae_number})` : ''}`,
          fontSize: 18,
          color: '#000000',
          show: true,
          position: 'top',
          distance: 20,
        },
        xAxis: {
          label: 'Date',
          fontSize: 14,
          color: '#000000',
          showGrid: true,
          gridColor: '#e0e0e0',
          gridLines: 5,
          tickCount: 5,
          tickFontSize: 12,
          labelPosition: 'bottom',
          labelDistance: 50,
          tickDistance: 15,
        },
        yAxis: {
          label: 'Water Level (m)',
          fontSize: 14,
          color: '#000000',
          showGrid: true,
          gridColor: '#e0e0e0',
          gridLines: 5,
          tickCount: 5,
          tickFontSize: 12,
          labelPosition: 'left',
          labelDistance: 45,
          tickDistance: 10,
          significantFigures: 3,
        },
        rightAxis: {
          label: 'Temperature (°C)',
          fontSize: 14,
          color: '#dc2626',
          showGrid: false,
          gridColor: '#ffe0b3',
          gridLines: 5,
          tickCount: 5,
          tickFontSize: 12,
          labelDistance: 45,
          tickDistance: 10,
          significantFigures: 2,
          show: true,
        },
        legend: {
          show: true,
          position: 'top-right',
          fontSize: 12,
          backgroundColor: '#ffffff',
          textColor: '#000000',
          borderColor: '#cccccc',
          borderWidth: 1,
          padding: 8,
          backgroundOpacity: 0.9,
        },
        transducerData: {
          color: '#2563eb',
          lineWidth: 2,
          lineStyle: 'solid',
          pointSize: 4,
          showPoints: false,
        },
        manualData: {
          color: '#059669',
          pointSize: 6,
          pointStyle: 'circle',
          borderWidth: 1,
          borderColor: '#000000',
        },
        temperatureData: {
          color: '#dc2626',
          lineWidth: 2,
          pointSize: 3,
          showPoints: false,
          yAxisSide: 'right',
        },
        wellInfoLegend: {
          show: false,
          position: { x: 50, y: 50 },
          fontSize: 12,
          backgroundColor: '#ffffff',
          textColor: '#000000',
          borderColor: '#cccccc',
          borderWidth: 1,
          padding: 8,
          backgroundOpacity: 0.9,
          isDraggable: true,
          fields: {
            wellNumber: true,
            caeNumber: true,
            totalReadings: true,
            dataRange: true,
            levelStats: true,
            trend: false,
          },
        },
        backgroundColor: '#ffffff',
        plotAreaColor: '#ffffff',
        borderColor: '#000000',
        borderWidth: 1,
        export: {
          filename: generateFilename(),
          format: 'png',
          downloadFolder: undefined,
        },
      });
    }
  }, [isOpen, wellNumber, well, currentTimeRange, customization]);

  // Process plot data to ensure both previews use identical data
  useEffect(() => {
    if (!plotData || plotData.length === 0 || !customization) {
      setProcessedData([]);
      return;
    }

    // Ensure data is in the correct format
    let convertedData = plotData.map((item: any) => ({
      timestamp: item.timestamp || item.timestamp_utc,
      water_level: item.water_level,
      temperature: item.temperature,
      reading_type: item.reading_type || 'transducer'
    }));

    // Apply data filtering based on customization
    if (!customization.showTransducerData) {
      convertedData = convertedData.filter(d => d.reading_type !== 'transducer');
    }
    
    if (!customization.showManualData) {
      convertedData = convertedData.filter(d => d.reading_type !== 'manual');
    }

    // Apply date range filtering if specified
    if (customization.dateRange) {
      const startTime = new Date(customization.dateRange.start).getTime();
      const endTime = new Date(customization.dateRange.end).getTime();
      convertedData = convertedData.filter(d => {
        const dataTime = new Date(d.timestamp).getTime();
        return dataTime >= startTime && dataTime <= endTime;
      });
    }

    // Filter out data without temperature if temperature is enabled but water level is disabled
    if (customization.showTemperatureData && !customization.showTransducerData && !customization.showManualData) {
      convertedData = convertedData.filter(d => d.temperature !== undefined && d.temperature !== null);
    }

    setProcessedData(convertedData);
  }, [plotData, customization?.showTransducerData, customization?.showManualData, customization?.showTemperatureData, customization?.dateRange]);

  // Simple approach: just track when we have all the data ready for rendering
  useEffect(() => {
    if (selectedTemplate && customization && processedData.length > 0) {
      console.log('✅ PREVIEW DATA READY:', {
        template: selectedTemplate,
        dimensions: `${customization.width}x${customization.height}`,
        dataPoints: processedData.length,
        renderMode: 'CONSISTENT_LIVE_PREVIEW'
      });
      setIsRenderingImage(false); // Ready to show preview
    } else {
      setIsRenderingImage(true); // Still loading
    }
  }, [selectedTemplate, customization, processedData]);

  // Mobile detection
  useEffect(() => {
    const checkDeviceType = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
    };

    checkDeviceType();
    window.addEventListener('resize', checkDeviceType);
    return () => window.removeEventListener('resize', checkDeviceType);
  }, []);

  // Apply template
  const applyTemplate = useCallback((templateKey: string) => {
    const template = presetTemplates[templateKey as keyof typeof presetTemplates];
    if (!template || !customization) return;

    setCustomization(prev => {
      if (!prev) return null;
      return {
        ...prev,
        width: template.config.width,
        height: template.config.height,
        aspectRatio: template.config.aspectRatio,
        dpi: template.config.dpi,
        title: {
          ...prev.title,
          fontSize: template.config.title.fontSize,
        },
        xAxis: {
          ...prev.xAxis,
          fontSize: template.config.xAxis.fontSize,
          tickFontSize: template.config.xAxis.tickFontSize,
        },
        yAxis: {
          ...prev.yAxis,
          fontSize: template.config.yAxis.fontSize,
          tickFontSize: template.config.yAxis.tickFontSize,
        },
        legend: {
          ...prev.legend,
          fontSize: template.config.legend.fontSize,
        },
        transducerData: {
          ...prev.transducerData,
          lineWidth: template.config.transducerData.lineWidth,
          pointSize: template.config.transducerData.pointSize,
          showPoints: template.config.transducerData.showPoints,
        },
        manualData: {
          ...prev.manualData,
          pointSize: template.config.manualData.pointSize,
        },
      };
    });
  }, [customization]);

  // Handle template selection
  const handleTemplateSelect = useCallback((templateKey: string) => {
    setSelectedTemplate(templateKey);
    applyTemplate(templateKey);
    setShowSettingsDialog(true);
  }, [applyTemplate]);

  // Handle settings dialog close
  const handleSettingsClose = useCallback(() => {
    setShowSettingsDialog(false);
  }, []);

  // Handle export
  const handleExport = useCallback(() => {
    if (customization) {
      console.log('📦 EXPORT TRIGGERED:', {
        exportCustomization: `${customization.width}x${customization.height}`,
        exportFonts: {
          title: customization.title.fontSize,
          xAxis: customization.xAxis.fontSize,
          yAxis: customization.yAxis.fontSize
        },
        dataPoints: processedData.length,
        renderMode: 'EXPORT_FINAL'
      });
      onExport(customization);
    }
  }, [onExport, customization, processedData]);

  // Open image viewer
  const openImageViewer = useCallback(() => {
    if (selectedTemplate && customization) {
      setShowFullImageViewer(true);
    }
  }, [selectedTemplate, customization]);

  if (!isOpen || !customization) return null;

  return (
    <>
      {/* Main Simple Interface */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div 
          ref={dialogRef}
          className={`w-full ${
            isMobile 
              ? 'max-w-sm max-h-[95vh]' 
              : 'max-w-4xl max-h-[90vh]'
          } rounded-xl shadow-2xl overflow-hidden transition-colors duration-300 ${
            isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            <h2 className={`text-xl font-semibold ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              🎨 Plot Customization
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Simple Content */}
          <div className="p-6 space-y-6">
            {/* Template Selector */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Choose Plot Style
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  if (e.target.value) {
                    handleTemplateSelect(e.target.value);
                  }
                }}
                className={`w-full px-4 py-3 rounded-lg border text-lg transition-colors duration-200 ${
                  isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500' 
                    : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                }`}
              >
                <option value="">Select a template to customize...</option>
                {Object.entries(presetTemplates).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.name} - {preset.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Plot Preview
              </label>
              <div 
                className={`relative border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${
                  selectedTemplate
                    ? (isDarkMode ? 'border-blue-500 hover:border-blue-400 bg-blue-900/10' : 'border-blue-400 hover:border-blue-500 bg-blue-50')
                    : (isDarkMode ? 'border-gray-600 hover:border-gray-500 bg-gray-800/30' : 'border-gray-300 hover:border-gray-400 bg-gray-50')
                }`}
                onClick={openImageViewer}
              >
                {selectedTemplate ? (
                  <div className="relative">
                    {(() => {
                      if (isRenderingImage) {
                        console.log('⏳ PREVIEW: WAITING FOR DATA READY...');
                        return (
                          <div className="bg-white rounded-lg overflow-hidden flex items-center justify-center p-4" style={{ minHeight: '300px' }}>
                            <div className="text-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                              <p className="text-sm text-gray-600">Loading preview...</p>
                            </div>
                          </div>
                        );
                      }

                      if (!customization || !processedData.length) {
                        console.log('❌ PREVIEW: NO DATA AVAILABLE');
                        return (
                          <div className="bg-white rounded-lg overflow-hidden flex items-center justify-center p-4" style={{ minHeight: '300px' }}>
                            <div className="text-center text-gray-500">
                              <p className="text-sm">Preview not available</p>
                            </div>
                          </div>
                        );
                      }

                      console.log('🖼️ PREVIEW: SHOWING LIVE PLOT PREVIEW:', {
                        template: selectedTemplate,
                        dimensions: `${customization.width}x${customization.height}`,
                        dataPoints: processedData.length,
                        renderMode: 'CONSISTENT_LIVE_PREVIEW'
                      });

                      return (
                        <div className="bg-white rounded-lg overflow-hidden" style={{ minHeight: '300px' }}>
                          <LivePlotPreview
                            customization={customization}
                            plotData={processedData}
                            isDarkMode={false}
                            wellNumber={wellNumber}
                            well={well}
                            showFullSize={false}
                            skipDataProcessing={true}
                          />
                        </div>
                      );
                    })()}
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-lg pointer-events-none">
                      <div className="text-white text-center">
                        <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium">Click to view full-screen with zoom/pan</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center min-h-[300px]">
                    <div className="text-center space-y-3">
                      <div className={`w-12 h-12 mx-auto rounded-lg flex items-center justify-center ${
                        isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                      }`}>
                        <svg className={`w-6 h-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className={`text-lg font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Your Plot Preview
                        </p>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Select a template above to start customizing
                        </p>
                        <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          Click here to view full-screen when ready
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Export Button */}
            <div className="flex justify-end">
              <button
                onClick={handleExport}
                disabled={!selectedTemplate}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-lg transition-all duration-300 disabled:cursor-not-allowed"
              >
                📱 Export Plot
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Overlay Dialog */}
      {showSettingsDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-60 p-4">
          <div 
            className={`w-full max-w-2xl max-h-[80vh] rounded-xl shadow-2xl overflow-hidden transition-colors duration-300 ${
              isDarkMode ? 'bg-gray-800 border border-gray-600' : 'bg-white border border-gray-200'
            }`}
          >
            {/* Settings Header */}
            <div className={`flex items-center justify-between p-4 border-b ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                ⚙️ Customize {presetTemplates[selectedTemplate as keyof typeof presetTemplates]?.name}
              </h3>
              <button
                onClick={handleSettingsClose}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Settings Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
              {/* Basic Settings */}
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                <h4 className={`font-medium mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  📐 Dimensions
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Width (px)
                    </label>
                    <input
                      type="number"
                      value={customization.width}
                      onChange={(e) => setCustomization(prev => prev ? ({
                        ...prev,
                        width: parseInt(e.target.value) || 1200
                      }) : null)}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Height (px)
                    </label>
                    <input
                      type="number"
                      value={customization.height}
                      onChange={(e) => setCustomization(prev => prev ? ({
                        ...prev,
                        height: parseInt(e.target.value) || 800
                      }) : null)}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Title Settings */}
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                <h4 className={`font-medium mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  🔤 Title
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Title Text
                    </label>
                    <input
                      type="text"
                      value={customization.title.text}
                      onChange={(e) => setCustomization(prev => prev ? ({
                        ...prev,
                        title: { ...prev.title, text: e.target.value }
                      }) : null)}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Font Size
                    </label>
                    <input
                      type="number"
                      value={customization.title.fontSize}
                      onChange={(e) => setCustomization(prev => prev ? ({
                        ...prev,
                        title: { ...prev.title, fontSize: parseInt(e.target.value) || 18 }
                      }) : null)}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      }`}
                      min="10"
                      max="48"
                    />
                  </div>
                </div>
              </div>

              {/* Data Series */}
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                <h4 className={`font-medium mb-3 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  📊 Data Series
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={customization.showTransducerData}
                      onChange={(e) => setCustomization(prev => prev ? ({
                        ...prev,
                        showTransducerData: e.target.checked
                      }) : null)}
                      className="rounded"
                    />
                    <label className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Show Transducer Data
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={customization.showManualData}
                      onChange={(e) => setCustomization(prev => prev ? ({
                        ...prev,
                        showManualData: e.target.checked
                      }) : null)}
                      className="rounded"
                    />
                    <label className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Show Manual Readings
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={customization.showTemperatureData}
                      onChange={(e) => setCustomization(prev => prev ? ({
                        ...prev,
                        showTemperatureData: e.target.checked
                      }) : null)}
                      className="rounded"
                    />
                    <label className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Show Temperature Data
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Settings Footer */}
            <div className={`flex items-center justify-end space-x-3 p-4 border-t ${
              isDarkMode ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <button
                onClick={handleSettingsClose}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Image Viewer Modal */}
      {showFullImageViewer && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-[9999] p-4">
          <div className="w-full h-full flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 text-white">
              <div>
                <h3 className="text-lg font-semibold">Plot Preview</h3>
                <p className="text-sm text-gray-300">{customization.width}×{customization.height}px @ {customization.dpi} DPI</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowSettingsDialog(true)}
                  className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-white"
                  title="Edit settings"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowFullImageViewer(false)}
                  className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Full Image Viewer */}
            <div ref={imageViewerContainerRef} className="flex-1 overflow-hidden bg-gray-900 relative">
              <TransformWrapper
                initialScale={1}
                minScale={0.1}
                maxScale={4}
                centerOnInit={false}
                limitToBounds={false}
                centerZoomedOut={false}
                wheel={{ step: 0.1 }}
                pinch={{ step: 5 }}
                doubleClick={{ disabled: true }}
                panning={{ velocityDisabled: true }}
                onInit={(ref) => {
                  setTimeout(() => {
                    if (ref && imageViewerContainerRef.current) {
                      const container = imageViewerContainerRef.current;
                      const containerWidth = container.clientWidth;
                      const containerHeight = container.clientHeight;
                      const imageWidth = customization.width;
                      const imageHeight = customization.height;
                      
                      const scaleX = containerWidth / imageWidth;
                      const scaleY = containerHeight / imageHeight;
                      const scale = Math.min(scaleX, scaleY) * 0.9;
                      
                      const scaledImageWidth = imageWidth * scale;
                      const scaledImageHeight = imageHeight * scale;
                      const x = (containerWidth - scaledImageWidth) / 2;
                      const y = (containerHeight - scaledImageHeight) / 2;
                      
                      if (ref.instance) {
                        ref.instance.transformState.scale = scale;
                        ref.instance.transformState.positionX = x;
                        ref.instance.transformState.positionY = y;
                        ref.instance.applyTransformation();
                      }
                    }
                  }, 300);
                }}
              >
                {({ zoomIn, zoomOut, instance }) => (
                  <>
                    {/* Zoom Controls */}
                    <div className="absolute top-4 right-4 flex space-x-2 z-10">
                      <button
                        onClick={() => zoomIn()}
                        className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                      <button
                        onClick={() => zoomOut()}
                        className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          if (instance && imageViewerContainerRef.current) {
                            const container = imageViewerContainerRef.current;
                            const containerWidth = container.clientWidth;
                            const containerHeight = container.clientHeight;
                            const imageWidth = customization.width;
                            const imageHeight = customization.height;
                            
                            const scaleX = containerWidth / imageWidth;
                            const scaleY = containerHeight / imageHeight;
                            const scale = Math.min(scaleX, scaleY) * 0.9;
                            
                            const scaledImageWidth = imageWidth * scale;
                            const scaledImageHeight = imageHeight * scale;
                            const x = (containerWidth - scaledImageWidth) / 2;
                            const y = (containerHeight - scaledImageHeight) / 2;
                            
                            if (instance.transformState) {
                              instance.transformState.scale = scale;
                              instance.transformState.positionX = x;
                              instance.transformState.positionY = y;
                              instance.applyTransformation();
                            }
                          }
                        }}
                        className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>

                    <TransformComponent
                      wrapperClass="w-full h-full"
                      contentClass="shadow-2xl"
                    >
                      <div 
                        style={{
                          width: `${customization.width}px`, 
                          height: `${customization.height}px`,
                          backgroundColor: 'white'
                        }}
                      >
                        {(() => {
                          console.log('🖥️ FULL-SCREEN: SHOWING LIVE PLOT PREVIEW:', {
                            template: selectedTemplate,
                            dimensions: `${customization.width}x${customization.height}`,
                            dataPoints: processedData.length,
                            renderMode: 'CONSISTENT_LIVE_PREVIEW_FULLSIZE'
                          });
                          
                          return (
                            <LivePlotPreview
                              customization={customization}
                              plotData={processedData}
                              isDarkMode={false}
                              wellNumber={wellNumber}
                              well={well}
                              showFullSize={true}
                              skipDataProcessing={true}
                            />
                          );
                        })()}
                      </div>
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 text-white">
              <div className="text-sm text-gray-300">
                🖱️ Drag to pan • 🎯 Scroll to zoom • 📱 Pinch & drag on touch
              </div>
              <button
                onClick={() => {
                  setShowFullImageViewer(false);
                  handleExport();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                🚀 Export This Plot
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}