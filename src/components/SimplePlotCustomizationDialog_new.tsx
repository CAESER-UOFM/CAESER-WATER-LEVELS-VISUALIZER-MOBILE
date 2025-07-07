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
          showPoints: false,
          pointSize: 4,
        },
        manualData: {
          color: '#dc2626',
          pointSize: 6,
          pointStyle: 'circle',
          borderWidth: 1,
          borderColor: '#991b1b',
        },
        temperatureData: {
          color: '#dc2626',
          lineWidth: 2,
          showPoints: false,
          pointSize: 4,
        },
        backgroundColor: '#ffffff',
        plotAreaColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#cccccc',
        wellInfoLegend: {
          show: true,
          position: { x: 20, y: 20 },
          fontSize: 10,
          backgroundColor: '#ffffff',
          textColor: '#000000',
          borderColor: '#cccccc',
          borderWidth: 1,
          padding: 6,
          backgroundOpacity: 0.9,
          fields: {
            wellNumber: true,
            caeNumber: true,
            totalReadings: true,
            dataRange: true,
            levelStats: false,
            trend: false,
          },
        },
        filename: generateFilename(),
      });
    }
  }, [isOpen, currentTimeRange, customization, wellNumber, well]);

  // Process plot data
  useEffect(() => {
    if (!plotData || plotData.length === 0 || !customization) {
      setProcessedData([]);
      return;
    }

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
      // Show only data points that have temperature
      convertedData = convertedData.filter(d => d.temperature !== undefined && d.temperature !== null);
    }

    setProcessedData(convertedData);
  }, [plotData, customization?.showTransducerData, customization?.showManualData, customization?.showTemperatureData, customization?.dateRange]);

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
    console.log('🎨 TEMPLATE SELECTED:', templateKey);
    setSelectedTemplate(templateKey);
    applyTemplate(templateKey);
    setShowSettingsDialog(true); // Open settings immediately
  }, [applyTemplate]);

  // Handle export
  const handleExport = useCallback(() => {
    if (!customization) return;
    console.log('📤 EXPORTING PLOT:', customization);
    onExport(customization);
  }, [customization, onExport]);

  // Handle settings dialog close
  const handleSettingsClose = useCallback(() => {
    setShowSettingsDialog(false);
  }, []);

  // Open image viewer
  const openImageViewer = useCallback(() => {
    if (selectedTemplate && customization && processedData.length > 0) {
      console.log('🖼️ OPENING FULL-SCREEN VIEWER:', {
        template: selectedTemplate,
        dimensions: `${customization.width}x${customization.height}`,
        dataPoints: processedData.length
      });
      setShowFullImageViewer(true);
    }
  }, [selectedTemplate, customization, processedData]);

  if (!isOpen) return null;

  return (
    <>
      {/* Main Dialog Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div 
          ref={dialogRef}
          className={`w-full max-w-md max-h-[90vh] rounded-xl shadow-2xl overflow-hidden transition-colors duration-300 ${
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

            {/* Action Buttons */}
            <div className="flex justify-between items-center gap-4">
              <button
                onClick={openImageViewer}
                disabled={!selectedTemplate}
                className={`flex-1 px-6 py-3 border-2 border-dashed rounded-lg transition-all duration-300 disabled:cursor-not-allowed ${
                  selectedTemplate
                    ? (isDarkMode 
                        ? 'border-blue-500 hover:border-blue-400 bg-blue-900/10 text-blue-300 hover:text-blue-200' 
                        : 'border-blue-400 hover:border-blue-500 bg-blue-50 text-blue-700 hover:text-blue-800')
                    : (isDarkMode 
                        ? 'border-gray-600 bg-gray-800/30 text-gray-500' 
                        : 'border-gray-300 bg-gray-50 text-gray-400')
                }`}
              >
                <div className="text-center">
                  <div className={`w-8 h-8 mx-auto mb-2 rounded-lg flex items-center justify-center ${
                    selectedTemplate 
                      ? (isDarkMode ? 'bg-blue-500/20' : 'bg-blue-500/10') 
                      : (isDarkMode ? 'bg-gray-700' : 'bg-gray-200')
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <p className="font-medium">🔍 Preview Plot</p>
                  <p className="text-xs mt-1 opacity-75">
                    {selectedTemplate ? 'View with zoom/pan controls' : 'Select template first'}
                  </p>
                </div>
              </button>

              <button
                onClick={handleExport}
                disabled={!selectedTemplate}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-medium rounded-lg transition-all duration-300 disabled:cursor-not-allowed"
              >
                <div className="text-center">
                  <div className="w-8 h-8 mx-auto mb-2 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                  <p className="font-medium">📱 Export Plot</p>
                  <p className="text-xs mt-1 opacity-75">Download high-quality image</p>
                </div>
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
              <div className="text-center py-8">
                <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  🚧 Settings panel coming soon!
                </p>
                <p className={`text-sm mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Use the template defaults for now, or click Preview to see the current plot.
                </p>
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
                <p className="text-sm text-gray-300">{customization?.width}×{customization?.height}px @ {customization?.dpi} DPI</p>
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
                    if (ref && imageViewerContainerRef.current && customization) {
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
                          if (instance && imageViewerContainerRef.current && customization) {
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
                          width: `${customization?.width}px`, 
                          height: `${customization?.height}px`,
                          backgroundColor: 'white'
                        }}
                      >
                        {customization && processedData.length > 0 && (
                          <LivePlotPreview
                            customization={customization}
                            plotData={processedData}
                            isDarkMode={false}
                            wellNumber={wellNumber}
                            well={well}
                            showFullSize={true}
                            skipDataProcessing={true}
                          />
                        )}
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
                onClick={handleExport}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium rounded-lg transition-all duration-300"
              >
                📱 Export Plot
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}