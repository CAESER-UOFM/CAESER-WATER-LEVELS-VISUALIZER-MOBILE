'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { LivePlotPreview } from './LivePlotPreview';
// Using regular SVG icons instead of lucide-react

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

// Smart margin calculation to ensure labels don't get too close to borders
function calculateSmartMargins(customization: PlotCustomization): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const MINIMUM_BORDER_MARGIN = 10; // Minimum space from image border - tight layout
  
  // Base margins for plot area - compact layout
  let top = 20;
  let right = 30;
  let bottom = 75;
  let left = 60;
  
  // Adjust for title positioning
  if (customization.title.show) {
    const titleSpace = customization.title.fontSize + customization.title.distance;
    if (customization.title.position === 'top') {
      top = Math.max(top, titleSpace + MINIMUM_BORDER_MARGIN);
    } else {
      bottom = Math.max(bottom, titleSpace + MINIMUM_BORDER_MARGIN);
    }
  }
  
  // Adjust based on axis label distances
  if (customization.xAxis.labelPosition === 'bottom') {
    bottom = Math.max(bottom, customization.xAxis.labelDistance + customization.xAxis.fontSize + MINIMUM_BORDER_MARGIN);
  } else {
    top = Math.max(top, customization.xAxis.labelDistance + customization.xAxis.fontSize + MINIMUM_BORDER_MARGIN);
  }
  
  if (customization.yAxis.labelPosition === 'left') {
    left = Math.max(left, customization.yAxis.labelDistance + customization.yAxis.fontSize + MINIMUM_BORDER_MARGIN);
  } else {
    right = Math.max(right, customization.yAxis.labelDistance + customization.yAxis.fontSize + MINIMUM_BORDER_MARGIN);
  }
  
  // Adjust for right axis if shown
  if (customization.showTemperatureData && customization.rightAxis.show) {
    right = Math.max(right, customization.rightAxis.labelDistance + customization.rightAxis.fontSize + MINIMUM_BORDER_MARGIN);
  }
  
  return { top, right, bottom, left };
}

export interface PlotCustomization {
  // Dimensions and Layout
  width: number;
  height: number;
  aspectRatio: 'custom' | '16:9' | '4:3' | '1:1' | '3:2';
  dpi: number;
  
  // Data Filtering
  showTransducerData: boolean;
  showManualData: boolean;
  showTemperatureData: boolean;
  dateRange: {
    start: string;
    end: string;
  } | null;
  
  // Plot Appearance
  title: {
    text: string;
    fontSize: number;
    color: string;
    show: boolean;
    position: 'top' | 'bottom';
    distance: number; // Distance from plot area in pixels
  };
  
  xAxis: {
    label: string;
    fontSize: number;
    color: string;
    showGrid: boolean;
    gridColor: string;
    gridLines: number;
    tickCount: number;
    tickFontSize: number;
    labelPosition: 'bottom' | 'top';
    labelDistance: number; // Distance from axis line in pixels
    tickDistance: number; // Distance of tick labels from axis line in pixels
  };
  
  yAxis: {
    label: string;
    fontSize: number;
    color: string;
    showGrid: boolean;
    gridColor: string;
    gridLines: number;
    tickCount: number;
    tickFontSize: number;
    labelPosition: 'left' | 'right';
    labelDistance: number; // Distance from axis line in pixels
    tickDistance: number; // Distance of tick labels from axis line in pixels
    significantFigures: number; // Number of significant figures for tick labels
  };
  
  // Right axis for temperature
  rightAxis: {
    label: string;
    fontSize: number;
    color: string;
    showGrid: boolean;
    gridColor: string;
    gridLines: number;
    tickCount: number;
    tickFontSize: number;
    labelDistance: number;
    tickDistance: number; // Distance of tick labels from axis line in pixels
    significantFigures: number;
    show: boolean; // Whether to show right axis
  };
  
  legend: {
    show: boolean;
    position: 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'below-x-axis';
    fontSize: number;
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    borderWidth: number;
    padding: number;
    backgroundOpacity: number;
  };
  
  // Data Series Styling
  transducerData: {
    color: string;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    pointSize: number;
    showPoints: boolean;
  };
  
  manualData: {
    color: string;
    pointSize: number;
    pointStyle: 'circle' | 'square' | 'triangle' | 'diamond';
    borderWidth: number;
    borderColor: string;
  };
  
  temperatureData: {
    color: string;
    lineWidth: number;
    pointSize: number;
    showPoints: boolean;
    yAxisSide: 'left' | 'right'; // Secondary y-axis
  };
  
  // Well Info Legend (Second Legend)
  wellInfoLegend: {
    show: boolean;
    position: { x: number; y: number }; // Draggable position in pixels
    fontSize: number;
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    borderWidth: number;
    padding: number;
    backgroundOpacity: number;
    isDraggable: boolean;
    fields: {
      wellNumber: boolean;
      caeNumber: boolean;
      totalReadings: boolean;
      dataRange: boolean;
      levelStats: boolean;
      trend: boolean;
    };
  };
  
  // Background and Colors
  backgroundColor: string;
  plotAreaColor: string;
  borderColor: string;
  borderWidth: number;
  
  // Export Settings
  export: {
    filename: string;
    format: 'png' | 'jpg' | 'tiff' | 'webp';
    downloadFolder?: string; // Optional browser download folder setting
  };
}

interface PlotCustomizationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (customization: PlotCustomization) => void;
  databaseId: string;
  wellNumber: string;
  well: any; // Well type from API
  currentTimeRange: { start: string; end: string } | null;
  plotData?: any[]; // Current plot data to reuse
  isDarkMode?: boolean;
}

const defaultCustomization: PlotCustomization = {
  // Dimensions and Layout
  width: 1200,
  height: 800,
  aspectRatio: '3:2',
  dpi: 300,
  
  // Data Filtering
  showTransducerData: true,
  showManualData: true,
  showTemperatureData: false,
  dateRange: null,
  
  // Plot Appearance
  title: {
    text: 'Water Level Data',
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
    show: true, // Auto-show when temperature data is enabled
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
  
  // Data Series Styling
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
  
  // Well Info Legend (Second Legend)
  wellInfoLegend: {
    show: false,
    position: { x: 50, y: 50 }, // Default position in top-left area
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
      trend: false, // Advanced statistic, off by default
    },
  },
  
  // Background and Colors
  backgroundColor: '#ffffff',
  plotAreaColor: '#ffffff',
  borderColor: '#000000',
  borderWidth: 1,
  
  // Export Settings
  export: {
    filename: 'well_plot_custom',
    format: 'png',
    downloadFolder: undefined,
  },
};

const aspectRatios = {
  'custom': { width: 1, height: 1 },
  '16:9': { width: 16, height: 9 },
  '4:3': { width: 4, height: 3 },
  '1:1': { width: 1, height: 1 },
  '3:2': { width: 3, height: 2 },
};

const presetTemplates = {
  'default': {
    name: 'Default (Balanced)',
    description: 'Well-balanced proportions for general use',
    config: {
      width: 1200,
      height: 800,
      aspectRatio: '3:2' as const,
      dpi: 300,
      backgroundColor: '#ffffff',
      plotAreaColor: '#ffffff',
      borderColor: '#000000',
      borderWidth: 1,
      title: {
        fontSize: 18,
        color: '#000000',
        show: true,
      },
      xAxis: {
        fontSize: 14,
        color: '#000000',
        showGrid: true,
        gridColor: '#e0e0e0',
        tickFontSize: 12,
      },
      yAxis: {
        fontSize: 14,
        color: '#000000',
        showGrid: true,
        gridColor: '#e0e0e0',
        tickFontSize: 12,
      },
      legend: {
        show: true,
        position: 'top-right' as const,
        fontSize: 12,
        backgroundColor: '#ffffff',
        textColor: '#000000',
      },
      transducerData: {
        color: '#2563eb',
        lineWidth: 2,
        pointSize: 4,
        showPoints: false,
      },
      manualData: {
        color: '#059669',
        pointSize: 6,
        pointStyle: 'circle' as const,
      },
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
      backgroundColor: '#ffffff',
      plotAreaColor: '#ffffff',
      borderColor: '#000000',
      borderWidth: 2,
      title: {
        fontSize: 28,
        color: '#000000',
        show: true,
      },
      xAxis: {
        fontSize: 18,
        color: '#000000',
        showGrid: true,
        gridColor: '#e0e0e0',
      },
      yAxis: {
        fontSize: 18,
        color: '#000000',
        showGrid: true,
        gridColor: '#e0e0e0',
      },
      legend: {
        show: true,
        position: 'top' as const,
        fontSize: 16,
        backgroundColor: '#ffffff',
        textColor: '#000000',
      },
      transducerData: {
        color: '#1f77b4',
        lineWidth: 3,
        pointSize: 0,
        showPoints: false,
      },
      manualData: {
        color: '#d62728',
        pointSize: 8,
        pointStyle: 'circle' as const,
      },
    }
  },
  'presentation': {
    name: 'Presentation',
    description: 'High contrast, large text for presentations and slides',
    config: {
      width: 1920,
      height: 1080,
      aspectRatio: '16:9' as const,
      dpi: 150,
      backgroundColor: '#ffffff',
      plotAreaColor: '#f8f9fa',
      borderColor: '#343a40',
      borderWidth: 3,
      title: {
        fontSize: 36,
        color: '#343a40',
        show: true,
      },
      xAxis: {
        fontSize: 24,
        color: '#343a40',
        showGrid: true,
        gridColor: '#dee2e6',
      },
      yAxis: {
        fontSize: 24,
        color: '#343a40',
        showGrid: true,
        gridColor: '#dee2e6',
      },
      legend: {
        show: true,
        position: 'top' as const,
        fontSize: 20,
        backgroundColor: '#ffffff',
        textColor: '#343a40',
      },
      transducerData: {
        color: '#007bff',
        lineWidth: 4,
        pointSize: 0,
        showPoints: false,
      },
      manualData: {
        color: '#dc3545',
        pointSize: 10,
        pointStyle: 'circle' as const,
      },
    }
  },
  'print': {
    name: 'Print Optimized',
    description: 'Optimized for black & white printing with patterns',
    config: {
      width: 2100,
      height: 1500,
      aspectRatio: '4:3' as const,
      dpi: 600,
      backgroundColor: '#ffffff',
      plotAreaColor: '#ffffff',
      borderColor: '#000000',
      borderWidth: 2,
      title: {
        fontSize: 24,
        color: '#000000',
        show: true,
      },
      xAxis: {
        fontSize: 16,
        color: '#000000',
        showGrid: true,
        gridColor: '#cccccc',
      },
      yAxis: {
        fontSize: 16,
        color: '#000000',
        showGrid: true,
        gridColor: '#cccccc',
      },
      legend: {
        show: true,
        position: 'top' as const,
        fontSize: 14,
        backgroundColor: '#ffffff',
        textColor: '#000000',
      },
      transducerData: {
        color: '#000000',
        lineWidth: 2,
        pointSize: 0,
        showPoints: false,
      },
      manualData: {
        color: '#000000',
        pointSize: 6,
        pointStyle: 'square' as const,
      },
    }
  }
};

export function PlotCustomizationDialog({
  isOpen,
  onClose,
  onExport,
  databaseId,
  wellNumber,
  well,
  currentTimeRange,
  plotData,
  isDarkMode = true
}: PlotCustomizationDialogProps) {
  const [customization, setCustomization] = useState<PlotCustomization>(defaultCustomization);
  const [expandedSections, setExpandedSections] = useState<{
    dimensions: boolean;
    data: boolean;
    appearance: boolean;
    wellInfo: boolean;
    export: boolean;
  }>({ dimensions: true, data: false, appearance: false, wellInfo: false, export: false });
  
  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [activeMobileSection, setActiveMobileSection] = useState<keyof typeof expandedSections>('dimensions');
  const [showFullImageViewer, setShowFullImageViewer] = useState(false);
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);
  
  // No more custom zoom/pan state - using react-zoom-pan-pinch library
  
  // Appearance sub-tabs state
  const [activeAppearanceTab, setActiveAppearanceTab] = useState<'title' | 'axes' | 'legend'>('title');
  
  // State for the overlay settings dialog
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  
  const dialogRef = useRef<HTMLDivElement>(null);
  const imageViewerContainerRef = useRef<HTMLDivElement>(null);

  // Open image viewer (no more custom zoom/pan reset needed)
  const openImageViewer = useCallback(() => {
    setShowFullImageViewer(true);
  }, []);

  // Calculate fit scale for image (same logic as our working custom implementation)
  const calculateFitScale = useCallback(() => {
    if (!imageViewerContainerRef.current) return 1;
    
    const container = imageViewerContainerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const imageWidth = customization.width;
    const imageHeight = customization.height;
    
    // Use MIN to ensure entire image fits (longest side determines scale)
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    const fitZoom = Math.min(scaleX, scaleY);
    
    return fitZoom * 0.95; // 95% of fit for padding, just like our working version
  }, [customization.width, customization.height]);

  // Calculate minimum zoom (prevent zooming out further than longest side fit)
  const calculateMinZoom = useCallback(() => {
    const fitScale = calculateFitScale();
    return Math.max(fitScale * 0.8, 0.05); // Allow 80% of fit scale minimum
  }, [calculateFitScale]);

  // Removed all custom zoom handlers - using react-zoom-pan-pinch library instead

  // Initialize with current data
  useEffect(() => {
    if (isOpen && currentTimeRange) {
      // Generate filename with CAE number and date range
      const generateFilename = () => {
        const caeNumber = well?.cae_number || wellNumber;
        const startDate = new Date(currentTimeRange.start);
        const endDate = new Date(currentTimeRange.end);
        
        // Format: CAE_YYYY-MM_to_YYYY-MM
        const startYear = startDate.getFullYear();
        const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
        const endYear = endDate.getFullYear();
        const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
        
        return `${caeNumber}_${startYear}-${startMonth}_to_${endYear}-${endMonth}`;
      };

      setCustomization(prev => ({
        ...prev,
        title: {
          ...prev.title,
          text: `Well ${wellNumber}${well?.cae_number ? ` (${well.cae_number})` : ''}`,
        },
        dateRange: currentTimeRange,
        export: {
          ...prev.export,
          filename: generateFilename(),
        },
      }));
    }
  }, [isOpen, wellNumber, currentTimeRange]);

  // Mobile device detection
  useEffect(() => {
    const checkDeviceType = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isPortrait = height > width;
      
      // Consider mobile if: width < 768px OR (touch device AND portrait mode) OR small width overall
      const mobile = width < 768 || (isTouchDevice && isPortrait && width < 1024);
      setIsMobile(mobile);
    };

    checkDeviceType();
    window.addEventListener('resize', checkDeviceType);
    window.addEventListener('orientationchange', checkDeviceType);

    return () => {
      window.removeEventListener('resize', checkDeviceType);
      window.removeEventListener('orientationchange', checkDeviceType);
    };
  }, []);

  // Handle aspect ratio changes
  const handleAspectRatioChange = useCallback((ratio: string) => {
    if (ratio === 'custom') {
      setCustomization(prev => ({
        ...prev,
        aspectRatio: 'custom',
      }));
    } else {
      const { width: ratioW, height: ratioH } = aspectRatios[ratio as keyof typeof aspectRatios];
      const baseWidth = 1920;
      const newHeight = Math.round((baseWidth * ratioH) / ratioW);
      
      setCustomization(prev => ({
        ...prev,
        aspectRatio: ratio as PlotCustomization['aspectRatio'],
        width: baseWidth,
        height: newHeight,
      }));
    }
  }, []);

  // Handle dimension changes
  const handleDimensionChange = useCallback((dimension: 'width' | 'height', value: number) => {
    setCustomization(prev => {
      if (prev.aspectRatio !== 'custom') {
        const { width: ratioW, height: ratioH } = aspectRatios[prev.aspectRatio];
        if (dimension === 'width') {
          return {
            ...prev,
            width: value,
            height: Math.round((value * ratioH) / ratioW),
          };
        } else {
          return {
            ...prev,
            width: Math.round((value * ratioW) / ratioH),
            height: value,
          };
        }
      }
      
      return {
        ...prev,
        [dimension]: value,
      };
    });
  }, []);

  // Apply preset template - only apply layout/quality settings, preserve data selection and colors
  const applyPreset = useCallback((presetKey: keyof typeof presetTemplates) => {
    const preset = presetTemplates[presetKey];
    setCustomization(prev => ({
      ...prev,
      // Apply layout settings only
      width: preset.config.width,
      height: preset.config.height,
      aspectRatio: preset.config.aspectRatio,
      dpi: preset.config.dpi,
      // Apply only font sizes but preserve all colors and content
      title: {
        ...prev.title,
        fontSize: preset.config.title.fontSize,
        // Preserve user's title text and color
      },
      // Apply axis font sizes but preserve all other settings
      xAxis: {
        ...prev.xAxis,
        fontSize: preset.config.xAxis.fontSize,
        // Preserve user's labels, colors, and grid settings
      },
      yAxis: {
        ...prev.yAxis,
        fontSize: preset.config.yAxis.fontSize,
        // Preserve user's labels, colors, and grid settings
      },
      // Apply legend font size but preserve all other settings
      legend: {
        ...prev.legend,
        fontSize: preset.config.legend.fontSize,
        // Preserve user's show/position/colors
      },
      // Apply only sizing settings to data series, preserve all colors
      transducerData: {
        ...prev.transducerData,
        lineWidth: preset.config.transducerData.lineWidth,
        pointSize: preset.config.transducerData.pointSize,
        showPoints: preset.config.transducerData.showPoints,
        // Preserve user's color choice
      },
      manualData: {
        ...prev.manualData,
        pointSize: preset.config.manualData.pointSize,
        pointStyle: preset.config.manualData.pointStyle,
        // Preserve user's color choice
      },
      // Preserve ALL data selection and user customizations
      dateRange: prev.dateRange,
      showTransducerData: prev.showTransducerData,
      showManualData: prev.showManualData,
      showTemperatureData: prev.showTemperatureData,
      backgroundColor: prev.backgroundColor,
      plotAreaColor: prev.plotAreaColor,
      borderColor: prev.borderColor,
      borderWidth: prev.borderWidth,
    }));
  }, [wellNumber]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setCustomization({
      ...defaultCustomization,
      title: {
        ...defaultCustomization.title,
        text: `Well ${wellNumber} - Water Level Data`,
      },
      dateRange: currentTimeRange,
    });
  }, [wellNumber, currentTimeRange]);

  // Handle export
  const handleExport = useCallback(() => {
    onExport(customization);
  }, [onExport, customization]);

  // Toggle section expansion
  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  if (!isOpen) return null;

  const inputClass = `w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
    isDarkMode 
      ? 'bg-gray-700 border-gray-600 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500' 
      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
  }`;

  const labelClass = `block text-sm font-medium mb-1 ${
    isDarkMode ? 'text-gray-300' : 'text-gray-700'
  }`;

  const sectionHeaderClass = `flex items-center justify-between w-full p-4 cursor-pointer transition-all duration-200 rounded-lg shadow-sm ${
    isDarkMode 
      ? 'bg-gray-800/50 hover:bg-gray-700/70 border border-gray-600 hover:border-gray-500' 
      : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
  }`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        ref={dialogRef}
        className={`w-full ${
          isMobile ? 'max-w-sm h-[95vh]' : 'max-w-7xl h-[90vh]'
        } flex flex-col rounded-xl shadow-2xl ${
          isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b bg-gradient-to-r ${
          isDarkMode 
            ? 'border-gray-700 from-gray-800 to-gray-750' 
            : 'border-gray-200 from-gray-50 to-white'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${
              isDarkMode ? 'bg-blue-600/20' : 'bg-blue-100'
            }`}>
              <svg className={`w-6 h-6 ${
                isDarkMode ? 'text-blue-400' : 'text-blue-600'
              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className={`text-xl font-bold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>
                Plot Customization
              </h2>
              <p className={`text-sm ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Well {wellNumber} {well?.cae_number ? `(${well.cae_number})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Content - Responsive Layout */}
        {isMobile ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile Plot Preview - Always Visible at Full Resolution */}
            <div className="flex-1 overflow-hidden p-4">
              <div className={`h-full rounded-lg border p-2 ${
                isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
              }`}>
                {/* Scroll hint */}
                <div className={`text-xs mb-2 text-center ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  📏 Actual plot size: {customization.width}×{customization.height}px • Scroll to explore
                </div>
                <div 
                  className={`h-full overflow-auto border rounded cursor-pointer transition-all hover:shadow-lg relative ${
                    isDarkMode ? 'border-gray-600 hover:border-blue-500' : 'border-gray-300 hover:border-blue-400'
                  }`}
                  onClick={openImageViewer}
                >
                  <LivePlotPreview
                    customization={customization}
                    plotData={plotData}
                    isDarkMode={isDarkMode}
                    wellNumber={wellNumber}
                    well={well}
                    showFullSize={true}
                  />
                  {/* Tap to enlarge hint */}
                  <div className={`absolute bottom-2 right-2 px-2 py-1 rounded text-xs pointer-events-none ${
                    isDarkMode ? 'bg-gray-800/80 text-gray-300' : 'bg-white/80 text-gray-600'
                  }`}>
                    👆 Tap to enlarge
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Controls Panel - Collapsible Bottom Sheet */}
            <div className={`border-t ${
              isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
            }`}>
              {/* Controls Header */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-lg font-semibold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    Plot Controls
                  </h3>
                  <button
                    onClick={handleExport}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isDarkMode 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    📱 Export
                  </button>
                </div>
                <select
                  value={activeMobileSection}
                  onChange={(e) => setActiveMobileSection(e.target.value as keyof typeof expandedSections)}
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="dimensions">📐 Dimensions & Layout</option>
                  <option value="data">📊 Data Selection</option>
                  <option value="appearance">🎨 Appearance</option>
                  <option value="wellInfo">📋 Well Info Legend</option>
                  <option value="export">💾 Export Settings</option>
                </select>
              </div>

              {/* Mobile Content Area - Scrollable */}
              <div className="max-h-[40vh] overflow-y-auto p-4 pt-0">
              <div className="space-y-4">
                {activeMobileSection === 'export' && (
                  <div className={`p-4 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-800/30 border-gray-700' 
                      : 'bg-gray-50/50 border-gray-200'
                  }`}>
                    <h3 className={`text-lg font-semibold mb-4 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      💾 Export Information
                    </h3>
                    <div className="space-y-3">
                      <div className={`p-3 rounded-lg ${
                        isDarkMode ? 'bg-gray-700/50' : 'bg-gray-100'
                      }`}>
                        <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          <div className="flex justify-between">
                            <span>Resolution:</span>
                            <span className="font-medium">{customization.width} × {customization.height}px</span>
                          </div>
                          <div className="flex justify-between">
                            <span>DPI:</span>
                            <span className="font-medium">{customization.dpi}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Format:</span>
                            <span className="font-medium">{customization.export?.format || 'PNG'}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        💡 Use the "📱 Export" button in the header to download your customized plot, or tap the plot preview to view it full-screen.
                      </div>
                    </div>
                  </div>
                )}
                {activeMobileSection === 'dimensions' && (
                  <div className={`p-4 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-800/30 border-gray-700' 
                      : 'bg-gray-50/50 border-gray-200'
                  }`}>
                    <div className="space-y-4">
                      {/* Preset Templates */}
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Quick Start Templates</label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              applyPreset(e.target.value as keyof typeof presetTemplates);
                            }
                          }}
                          value=""
                          className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500' 
                              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          }`}
                        >
                          <option value="">Select a template...</option>
                          {Object.entries(presetTemplates).map(([key, preset]) => (
                            <option key={key} value={key}>
                              {preset.name} ({preset.config.width}×{preset.config.height}, {preset.config.dpi} DPI)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Aspect Ratio */}
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Aspect Ratio</label>
                        <select
                          value={customization.aspectRatio}
                          onChange={(e) => handleAspectRatioChange(e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500' 
                              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          }`}
                        >
                          <option value="16:9">16:9 (Widescreen)</option>
                          <option value="4:3">4:3 (Standard)</option>
                          <option value="1:1">1:1 (Square)</option>
                          <option value="3:2">3:2 (Classic)</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>

                      {/* Width & Height */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Width (px)</label>
                          <input
                            type="number"
                            value={customization.width}
                            onChange={(e) => handleDimensionChange('width', parseInt(e.target.value) || 800)}
                            className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                              isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500' 
                                : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Height (px)</label>
                          <input
                            type="number"
                            value={customization.height}
                            onChange={(e) => handleDimensionChange('height', parseInt(e.target.value) || 600)}
                            className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                              isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500' 
                                : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                            }`}
                          />
                        </div>
                      </div>

                      {/* DPI */}
                      <div>
                        <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>DPI (Print Quality)</label>
                        <select
                          value={customization.dpi}
                          onChange={(e) => setCustomization(prev => ({
                            ...prev,
                            dpi: parseInt(e.target.value)
                          }))}
                          className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500' 
                              : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                          }`}
                        >
                          <option value={72}>72 DPI (Screen)</option>
                          <option value={150}>150 DPI (Good Print)</option>
                          <option value={300}>300 DPI (High Print)</option>
                          <option value={600}>600 DPI (Professional)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {activeMobileSection === 'data' && (
                  <div className={`p-4 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-800/30 border-gray-700' 
                      : 'bg-gray-50/50 border-gray-200'
                  }`}>
                    <div className="space-y-4">
                      {/* Data Selection */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="mobile-show-transducer"
                            checked={customization.showTransducerData}
                            onChange={(e) => setCustomization(prev => ({ 
                              ...prev, 
                              showTransducerData: e.target.checked 
                            }))}
                            className="rounded"
                          />
                          <label htmlFor="mobile-show-transducer" className={`font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Show Transducer Data</label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="mobile-show-manual"
                            checked={customization.showManualData}
                            onChange={(e) => setCustomization(prev => ({ 
                              ...prev, 
                              showManualData: e.target.checked 
                            }))}
                            className="rounded"
                          />
                          <label htmlFor="mobile-show-manual" className={`font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Show Manual Readings</label>
                        </div>
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id="mobile-show-temperature"
                            checked={customization.showTemperatureData}
                            onChange={(e) => setCustomization(prev => ({ 
                              ...prev, 
                              showTemperatureData: e.target.checked 
                            }))}
                            className="rounded"
                          />
                          <label htmlFor="mobile-show-temperature" className={`font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Show Temperature Data</label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeMobileSection === 'appearance' && (
                  <div className={`p-4 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-800/30 border-gray-700' 
                      : 'bg-gray-50/50 border-gray-200'
                  }`}>
                    <div className="space-y-4">
                      {/* Colors */}
                      <div>
                        <h4 className={`font-medium text-sm mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Plot Colors</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Background</label>
                            <input
                              type="color"
                              value={customization.backgroundColor}
                              onChange={(e) => setCustomization(prev => ({
                                ...prev,
                                backgroundColor: e.target.value
                              }))}
                              className="w-full h-10 rounded border cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Plot Area</label>
                            <input
                              type="color"
                              value={customization.plotAreaColor}
                              onChange={(e) => setCustomization(prev => ({
                                ...prev,
                                plotAreaColor: e.target.value
                              }))}
                              className="w-full h-10 rounded border cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Title */}
                      <div>
                        <div className="flex items-center space-x-3 mb-3">
                          <input
                            type="checkbox"
                            id="mobile-show-title"
                            checked={customization.title.show}
                            onChange={(e) => setCustomization(prev => ({ 
                              ...prev, 
                              title: { ...prev.title, show: e.target.checked }
                            }))}
                            className="rounded"
                          />
                          <label htmlFor="mobile-show-title" className={`font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Show Title</label>
                        </div>
                        {customization.title.show && (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={customization.title.text}
                              onChange={(e) => setCustomization(prev => ({
                                ...prev,
                                title: { ...prev.title, text: e.target.value }
                              }))}
                              placeholder="Enter title..."
                              className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                                isDarkMode 
                                  ? 'bg-gray-700 border-gray-600 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500' 
                                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                              }`}
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Font Size</label>
                                <input
                                  type="number"
                                  value={customization.title.fontSize}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    title: { ...prev.title, fontSize: parseInt(e.target.value) || 12 }
                                  }))}
                                  className={`w-full px-3 py-2 rounded-lg border transition-colors duration-200 ${
                                    isDarkMode 
                                      ? 'bg-gray-700 border-gray-600 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500' 
                                      : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                                  }`}
                                  min="8"
                                  max="48"
                                />
                              </div>
                              <div>
                                <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Color</label>
                                <input
                                  type="color"
                                  value={customization.title.color}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    title: { ...prev.title, color: e.target.value }
                                  }))}
                                  className="w-full h-10 rounded border cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeMobileSection === 'wellInfo' && (
                  <div className={`p-4 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-800/30 border-gray-700' 
                      : 'bg-gray-50/50 border-gray-200'
                  }`}>
                    <div className="space-y-4">
                      {/* Well Info Legend */}
                      <div className="flex items-center space-x-3 mb-3">
                        <input
                          type="checkbox"
                          id="mobile-show-well-info"
                          checked={customization.wellInfoLegend.show}
                          onChange={(e) => setCustomization(prev => ({ 
                            ...prev, 
                            wellInfoLegend: { ...prev.wellInfoLegend, show: e.target.checked }
                          }))}
                          className="rounded"
                        />
                        <label htmlFor="mobile-show-well-info" className={`font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Show Well Info Legend</label>
                      </div>

                      {customization.wellInfoLegend.show && (
                        <div className="space-y-3">
                          {/* Position Controls */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Horizontal Position</label>
                              <input
                                type="range"
                                min="0"
                                max={customization.width - 200}
                                value={customization.wellInfoLegend.position.x}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  wellInfoLegend: {
                                    ...prev.wellInfoLegend,
                                    position: { ...prev.wellInfoLegend.position, x: parseInt(e.target.value) }
                                  }
                                }))}
                                className="w-full"
                              />
                            </div>
                            <div>
                              <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Vertical Position</label>
                              <input
                                type="range"
                                min="0"
                                max={customization.height - 150}
                                value={customization.wellInfoLegend.position.y}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  wellInfoLegend: {
                                    ...prev.wellInfoLegend,
                                    position: { ...prev.wellInfoLegend.position, y: parseInt(e.target.value) }
                                  }
                                }))}
                                className="w-full"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Controls */}
          <div className={`w-1/3 min-w-[400px] overflow-y-auto p-6 border-r ${
            isDarkMode ? 'border-gray-700' : 'border-gray-200'
          }`}>
            {/* Section Navigation Overview */}
            <div className={`mb-6 p-4 rounded-lg border ${
              isDarkMode 
                ? 'bg-gray-800/50 border-gray-700' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <h3 className={`text-sm font-semibold mb-3 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Customization Sections
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { key: 'dimensions', label: 'Dimensions', icon: '📐' },
                  { key: 'data', label: 'Data', icon: '📊' },
                  { key: 'appearance', label: 'Appearance', icon: '🎨' },
                  { key: 'wellInfo', label: 'Well Info', icon: '📋' },
                  { key: 'export', label: 'Export', icon: '💾' }
                ].map(section => (
                  <div 
                    key={section.key}
                    className={`flex items-center space-x-2 p-2 rounded cursor-pointer transition-colors ${
                      expandedSections[section.key as keyof typeof expandedSections]
                        ? (isDarkMode ? 'bg-blue-600/20 text-blue-400' : 'bg-blue-100 text-blue-700')
                        : (isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-700')
                    }`}
                    onClick={() => toggleSection(section.key as keyof typeof expandedSections)}
                  >
                    <span>{section.icon}</span>
                    <span className="font-medium">{section.label}</span>
                    {expandedSections[section.key as keyof typeof expandedSections] && (
                      <div className={`w-2 h-2 rounded-full ${
                        isDarkMode ? 'bg-blue-400' : 'bg-blue-500'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {/* Dimensions Section */}
              <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
                <button 
                  onClick={() => toggleSection('dimensions')}
                  className={sectionHeaderClass}
                >
                  <div className="flex items-center">
                    <svg className={`w-5 h-5 mr-2 ${isDarkMode ? 'text-white' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    <span className={`font-semibold text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Dimensions & Layout
                    </span>
                  </div>
                  <svg 
                    className={`w-5 h-5 transition-transform duration-200 ${
                      expandedSections.dimensions ? 'rotate-180' : ''
                    } ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedSections.dimensions && (
                  <div className={`mt-4 space-y-4 p-5 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-800/30 border-gray-700' 
                      : 'bg-gray-50/50 border-gray-200'
                  }`}>
                    {/* Preset Templates */}
                    <div>
                      <label className={labelClass}>Quick Start Templates</label>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            applyPreset(e.target.value as keyof typeof presetTemplates);
                          }
                        }}
                        value=""
                        className={inputClass}
                      >
                        <option value="">Select a template...</option>
                        {Object.entries(presetTemplates).map(([key, preset]) => (
                          <option key={key} value={key}>
                            {preset.name} ({preset.config.width}×{preset.config.height}, {preset.config.dpi} DPI)
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Aspect Ratio */}
                    <div>
                      <label className={labelClass}>Aspect Ratio</label>
                      <select
                        value={customization.aspectRatio}
                        onChange={(e) => handleAspectRatioChange(e.target.value)}
                        className={inputClass}
                      >
                        <option value="16:9">16:9 (Widescreen)</option>
                        <option value="4:3">4:3 (Standard)</option>
                        <option value="3:2">3:2 (Photo)</option>
                        <option value="1:1">1:1 (Square)</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    {/* Dimensions */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Width (px)</label>
                        <input
                          type="number"
                          value={customization.width}
                          onChange={(e) => handleDimensionChange('width', parseInt(e.target.value) || 0)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Height (px)</label>
                        <input
                          type="number"
                          value={customization.height}
                          onChange={(e) => handleDimensionChange('height', parseInt(e.target.value) || 0)}
                          className={inputClass}
                          disabled={customization.aspectRatio !== 'custom'}
                        />
                      </div>
                    </div>

                    {/* DPI */}
                    <div>
                      <label className={labelClass}>DPI (Resolution)</label>
                      <select
                        value={customization.dpi}
                        onChange={(e) => setCustomization(prev => ({ ...prev, dpi: parseInt(e.target.value) }))}
                        className={inputClass}
                      >
                        <option value="72">72 DPI (Screen)</option>
                        <option value="150">150 DPI (Good Quality)</option>
                        <option value="300">300 DPI (Print Quality)</option>
                        <option value="600">600 DPI (High Resolution)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Data Selection Section */}
              <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
                <button 
                  onClick={() => toggleSection('data')}
                  className={sectionHeaderClass}
                >
                  <div className="flex items-center">
                    <svg className={`w-5 h-5 mr-2 ${isDarkMode ? 'text-white' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className={`font-semibold text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Data Selection
                    </span>
                  </div>
                  <svg 
                    className={`w-5 h-5 transition-transform duration-200 ${
                      expandedSections.data ? 'rotate-180' : ''
                    } ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedSections.data && (
                  <div className={`mt-4 space-y-4 p-5 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-800/30 border-gray-700' 
                      : 'bg-gray-50/50 border-gray-200'
                  }`}>
                    {/* Data Type Selection */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="transducer-data"
                          checked={customization.showTransducerData}
                          onChange={(e) => setCustomization(prev => ({ 
                            ...prev, 
                            showTransducerData: e.target.checked 
                          }))}
                          className="rounded"
                        />
                        <label htmlFor="transducer-data" className={labelClass}>
                          Show Transducer Data
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="manual-data"
                          checked={customization.showManualData}
                          onChange={(e) => setCustomization(prev => ({ 
                            ...prev, 
                            showManualData: e.target.checked 
                          }))}
                          className="rounded"
                        />
                        <label htmlFor="manual-data" className={labelClass}>
                          Show Manual Readings
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="temperature-data"
                          checked={customization.showTemperatureData}
                          onChange={(e) => setCustomization(prev => ({ 
                            ...prev, 
                            showTemperatureData: e.target.checked 
                          }))}
                          className="rounded"
                        />
                        <label htmlFor="temperature-data" className={labelClass}>
                          Show Temperature Data
                        </label>
                      </div>
                    </div>

                    {/* Data Series Colors */}
                    {(customization.showTransducerData || customization.showManualData || customization.showTemperatureData) && (
                      <div className="space-y-3">
                        <h4 className={`font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Data Series Styling</h4>
                        
                        {customization.showTransducerData && (
                          <div className="space-y-2">
                            <h5 className={`font-medium text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Transducer Data</h5>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Color</label>
                                <input
                                  type="color"
                                  value={customization.transducerData.color}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    transducerData: { ...prev.transducerData, color: e.target.value }
                                  }))}
                                  className="w-full h-8 rounded border border-gray-300 cursor-pointer"
                                />
                              </div>
                              <div>
                                <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Line Width</label>
                                <input
                                  type="number"
                                  value={customization.transducerData.lineWidth}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    transducerData: { ...prev.transducerData, lineWidth: parseInt(e.target.value) || 1 }
                                  }))}
                                  className={`w-full px-2 py-1 text-xs rounded border ${
                                    isDarkMode 
                                      ? 'bg-gray-700 border-gray-600 text-white' 
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                />
                              </div>
                              <div>
                                <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Line Style</label>
                                <select
                                  value={customization.transducerData.lineStyle}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    transducerData: { ...prev.transducerData, lineStyle: e.target.value as any }
                                  }))}
                                  className={`w-full px-2 py-1 text-xs rounded border ${
                                    isDarkMode 
                                      ? 'bg-gray-700 border-gray-600 text-white' 
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                >
                                  <option value="solid">Solid</option>
                                  <option value="dashed">Dashed</option>
                                  <option value="dotted">Dotted</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {customization.showManualData && (
                          <div className="space-y-2">
                            <h5 className={`font-medium text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Manual Readings</h5>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Fill Color</label>
                                <input
                                  type="color"
                                  value={customization.manualData.color}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    manualData: { ...prev.manualData, color: e.target.value }
                                  }))}
                                  className="w-full h-8 rounded border border-gray-300 cursor-pointer"
                                />
                              </div>
                              <div>
                                <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Point Size</label>
                                <input
                                  type="number"
                                  value={customization.manualData.pointSize}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    manualData: { ...prev.manualData, pointSize: parseInt(e.target.value) || 4 }
                                  }))}
                                  className={`w-full px-2 py-1 text-xs rounded border ${
                                    isDarkMode 
                                      ? 'bg-gray-700 border-gray-600 text-white' 
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                />
                              </div>
                              <div>
                                <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Point Shape</label>
                                <select
                                  value={customization.manualData.pointStyle}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    manualData: { ...prev.manualData, pointStyle: e.target.value as any }
                                  }))}
                                  className={`w-full px-2 py-1 text-xs rounded border ${
                                    isDarkMode 
                                      ? 'bg-gray-700 border-gray-600 text-white' 
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                >
                                  <option value="circle">Circle</option>
                                  <option value="square">Square</option>
                                  <option value="triangle">Triangle</option>
                                  <option value="diamond">Diamond</option>
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Border Color</label>
                                <input
                                  type="color"
                                  value={customization.manualData.borderColor}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    manualData: { ...prev.manualData, borderColor: e.target.value }
                                  }))}
                                  className="w-full h-8 rounded border border-gray-300 cursor-pointer"
                                />
                              </div>
                              <div>
                                <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Border Width</label>
                                <input
                                  type="number"
                                  value={customization.manualData.borderWidth}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    manualData: { ...prev.manualData, borderWidth: parseInt(e.target.value) || 0 }
                                  }))}
                                  className={`w-full px-2 py-1 text-xs rounded border ${
                                    isDarkMode 
                                      ? 'bg-gray-700 border-gray-600 text-white' 
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                />
                              </div>
                              <div>
                                {/* Empty div for grid alignment */}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {customization.showTemperatureData && (
                          <div className="space-y-2">
                            <h5 className={`font-medium text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Temperature Data</h5>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Line Color</label>
                                <input
                                  type="color"
                                  value={customization.temperatureData.color}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    temperatureData: { ...prev.temperatureData, color: e.target.value }
                                  }))}
                                  className="w-full h-8 rounded border border-gray-300 cursor-pointer"
                                />
                              </div>
                              <div>
                                <label className={`block text-xs mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Line Width</label>
                                <input
                                  type="number"
                                  value={customization.temperatureData.lineWidth}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    temperatureData: { ...prev.temperatureData, lineWidth: parseInt(e.target.value) || 1 }
                                  }))}
                                  className={`w-full px-2 py-1 text-xs rounded border ${
                                    isDarkMode 
                                      ? 'bg-gray-700 border-gray-600 text-white' 
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                />
                              </div>
                              <div>
                                {/* Empty div for grid alignment */}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Appearance Section */}
              <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
                <button 
                  onClick={() => toggleSection('appearance')}
                  className={sectionHeaderClass}
                >
                  <div className="flex items-center">
                    <svg className={`w-5 h-5 mr-2 ${isDarkMode ? 'text-white' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4 4 4 0 004-4V5z" />
                    </svg>
                    <span className={`font-semibold text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Appearance
                    </span>
                  </div>
                  <svg 
                    className={`w-5 h-5 transition-transform duration-200 ${
                      expandedSections.appearance ? 'rotate-180' : ''
                    } ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedSections.appearance && (
                  <div className={`mt-4 space-y-4 p-5 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-800/30 border-gray-700' 
                      : 'bg-gray-50/50 border-gray-200'
                  }`}>
                    {/* Title Settings */}
                    <div>
                      <div className="flex items-center space-x-3 mb-3">
                        <input
                          type="checkbox"
                          id="show-title"
                          checked={customization.title.show}
                          onChange={(e) => setCustomization(prev => ({ 
                            ...prev, 
                            title: { ...prev.title, show: e.target.checked }
                          }))}
                          className="rounded"
                        />
                        <label htmlFor="show-title" className={`font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Show Title</label>
                      </div>
                      
                      {customization.title.show && (
                        <div className="space-y-3">
                          <div>
                            <label className={labelClass}>Title Text</label>
                            <input
                              type="text"
                              value={customization.title.text}
                              onChange={(e) => setCustomization(prev => ({
                                ...prev,
                                title: { ...prev.title, text: e.target.value }
                              }))}
                              className={inputClass}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={labelClass}>Font Size</label>
                              <input
                                type="number"
                                value={customization.title.fontSize}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  title: { ...prev.title, fontSize: parseInt(e.target.value) || 12 }
                                }))}
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className={labelClass}>Color</label>
                              <input
                                type="color"
                                value={customization.title.color}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  title: { ...prev.title, color: e.target.value }
                                }))}
                                className="w-full h-8 rounded border"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={labelClass}>Position</label>
                              <select
                                value={customization.title.position}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  title: { ...prev.title, position: e.target.value as 'top' | 'bottom' }
                                }))}
                                className={inputClass}
                              >
                                <option value="top">Top</option>
                                <option value="bottom">Bottom</option>
                              </select>
                            </div>
                            <div>
                              <label className={labelClass}>Distance (px)</label>
                              <input
                                type="number"
                                value={customization.title.distance}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  title: { ...prev.title, distance: parseInt(e.target.value) || 20 }
                                }))}
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Enhanced Axis Settings */}
                    <div className="space-y-4">
                      <h4 className={`font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Axis Configuration</h4>
                      
                      {/* X-Axis */}
                      <div className="space-y-3">
                        <h5 className={`font-medium text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>X-Axis (Date)</h5>
                        <div className="space-y-2">
                          <div>
                            <label className={labelClass}>Label</label>
                            <input
                              type="text"
                              value={customization.xAxis.label}
                              onChange={(e) => setCustomization(prev => ({
                                ...prev,
                                xAxis: { ...prev.xAxis, label: e.target.value }
                              }))}
                              className={inputClass}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Label Font</label>
                              <input
                                type="number"
                                value={customization.xAxis.fontSize}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  xAxis: { ...prev.xAxis, fontSize: parseInt(e.target.value) || 12 }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                            </div>
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tick Font</label>
                              <input
                                type="number"
                                value={customization.xAxis.tickFontSize}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  xAxis: { ...prev.xAxis, tickFontSize: parseInt(e.target.value) || 10 }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                            </div>
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tick Count</label>
                              <input
                                type="number"
                                value={customization.xAxis.tickCount}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  xAxis: { ...prev.xAxis, tickCount: parseInt(e.target.value) || 5 }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Grid Lines</label>
                              <input
                                type="number"
                                value={customization.xAxis.gridLines}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  xAxis: { ...prev.xAxis, gridLines: parseInt(e.target.value) || 5 }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                                min="0"
                                max="20"
                              />
                            </div>
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Position</label>
                              <select
                                value={customization.xAxis.labelPosition}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  xAxis: { ...prev.xAxis, labelPosition: e.target.value as any }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              >
                                <option value="bottom">Bottom</option>
                                <option value="top">Top</option>
                              </select>
                            </div>
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Label Distance</label>
                              <input
                                type="number"
                                value={customization.xAxis.labelDistance}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  xAxis: { ...prev.xAxis, labelDistance: parseInt(e.target.value) || 40 }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                                min="10"
                                max="100"
                                title="Distance of label from axis line (pixels)"
                              />
                            </div>
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tick Distance</label>
                              <input
                                type="number"
                                value={customization.xAxis.tickDistance}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  xAxis: { ...prev.xAxis, tickDistance: parseInt(e.target.value) || 15 }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                                min="5"
                                max="50"
                                title="Distance of tick labels from axis line (pixels)"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Y-Axis */}
                      <div className="space-y-3">
                        <h5 className={`font-medium text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Y-Axis (Water Level)</h5>
                        <div className="space-y-2">
                          <div>
                            <label className={labelClass}>Label</label>
                            <input
                              type="text"
                              value={customization.yAxis.label}
                              onChange={(e) => setCustomization(prev => ({
                                ...prev,
                                yAxis: { ...prev.yAxis, label: e.target.value }
                              }))}
                              className={inputClass}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Label Font</label>
                              <input
                                type="number"
                                value={customization.yAxis.fontSize}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  yAxis: { ...prev.yAxis, fontSize: parseInt(e.target.value) || 12 }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                            </div>
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tick Font</label>
                              <input
                                type="number"
                                value={customization.yAxis.tickFontSize}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  yAxis: { ...prev.yAxis, tickFontSize: parseInt(e.target.value) || 10 }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                            </div>
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tick Count</label>
                              <input
                                type="number"
                                value={customization.yAxis.tickCount}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  yAxis: { ...prev.yAxis, tickCount: parseInt(e.target.value) || 5 }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Grid Lines</label>
                              <input
                                type="number"
                                value={customization.yAxis.gridLines}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  yAxis: { ...prev.yAxis, gridLines: parseInt(e.target.value) || 5 }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                                min="0"
                                max="20"
                              />
                            </div>
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Position</label>
                              <select
                                value={customization.yAxis.labelPosition}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  yAxis: { ...prev.yAxis, labelPosition: e.target.value as any }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              >
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                              </select>
                            </div>
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Distance</label>
                              <input
                                type="number"
                                value={customization.yAxis.labelDistance}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  yAxis: { ...prev.yAxis, labelDistance: parseInt(e.target.value) || 50 }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                                min="10"
                                max="100"
                                title="Distance of label from axis line (pixels)"
                              />
                            </div>
                          </div>
                          <div className="mt-2">
                            <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Significant Figures</label>
                            <input
                              type="number"
                              value={customization.yAxis.significantFigures}
                              onChange={(e) => setCustomization(prev => ({
                                ...prev,
                                yAxis: { ...prev.yAxis, significantFigures: parseInt(e.target.value) || 3 }
                              }))}
                              className={`w-full px-2 py-1 text-xs rounded border ${
                                isDarkMode 
                                  ? 'bg-gray-700 border-gray-600 text-white' 
                                  : 'bg-white border-gray-300 text-gray-900'
                              }`}
                              min="1"
                              max="6"
                              title="Number of significant figures for tick labels"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right Axis (Temperature) */}
                      {customization.showTemperatureData && (
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id="show-right-axis"
                              checked={customization.rightAxis.show}
                              onChange={(e) => setCustomization(prev => ({ 
                                ...prev, 
                                rightAxis: { ...prev.rightAxis, show: e.target.checked }
                              }))}
                              className="rounded"
                            />
                            <h5 className={`font-medium text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Show Right Axis (Temperature)</h5>
                          </div>
                          
                          {customization.rightAxis.show && (
                            <div className="space-y-2">
                              <div>
                                <label className={labelClass}>Label</label>
                                <input
                                  type="text"
                                  value={customization.rightAxis.label}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    rightAxis: { ...prev.rightAxis, label: e.target.value }
                                  }))}
                                  className={inputClass}
                                />
                              </div>
                              <div>
                                <label className={labelClass}>Color</label>
                                <input
                                  type="color"
                                  value={customization.rightAxis.color}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    rightAxis: { ...prev.rightAxis, color: e.target.value }
                                  }))}
                                  className="w-16 h-8 rounded border border-gray-300 cursor-pointer"
                                />
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Label Font</label>
                                  <input
                                    type="number"
                                    value={customization.rightAxis.fontSize}
                                    onChange={(e) => setCustomization(prev => ({
                                      ...prev,
                                      rightAxis: { ...prev.rightAxis, fontSize: parseInt(e.target.value) || 12 }
                                    }))}
                                    className={`w-full px-2 py-1 text-xs rounded border ${
                                      isDarkMode 
                                        ? 'bg-gray-700 border-gray-600 text-white' 
                                        : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                    min="8"
                                    max="72"
                                  />
                                </div>
                                <div>
                                  <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tick Font</label>
                                  <input
                                    type="number"
                                    value={customization.rightAxis.tickFontSize}
                                    onChange={(e) => setCustomization(prev => ({
                                      ...prev,
                                      rightAxis: { ...prev.rightAxis, tickFontSize: parseInt(e.target.value) || 10 }
                                    }))}
                                    className={`w-full px-2 py-1 text-xs rounded border ${
                                      isDarkMode 
                                        ? 'bg-gray-700 border-gray-600 text-white' 
                                        : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                    min="6"
                                    max="48"
                                  />
                                </div>
                                <div>
                                  <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Tick Count</label>
                                  <input
                                    type="number"
                                    value={customization.rightAxis.tickCount}
                                    onChange={(e) => setCustomization(prev => ({
                                      ...prev,
                                      rightAxis: { ...prev.rightAxis, tickCount: parseInt(e.target.value) || 5 }
                                    }))}
                                    className={`w-full px-2 py-1 text-xs rounded border ${
                                      isDarkMode 
                                        ? 'bg-gray-700 border-gray-600 text-white' 
                                        : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                    min="2"
                                    max="10"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Distance</label>
                                  <input
                                    type="number"
                                    value={customization.rightAxis.labelDistance}
                                    onChange={(e) => setCustomization(prev => ({
                                      ...prev,
                                      rightAxis: { ...prev.rightAxis, labelDistance: parseInt(e.target.value) || 50 }
                                    }))}
                                    className={`w-full px-2 py-1 text-xs rounded border ${
                                      isDarkMode 
                                        ? 'bg-gray-700 border-gray-600 text-white' 
                                        : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                    min="10"
                                    max="100"
                                    title="Distance of label from axis line (pixels)"
                                  />
                                </div>
                                <div>
                                  <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Sig Figs</label>
                                  <input
                                    type="number"
                                    value={customization.rightAxis.significantFigures}
                                    onChange={(e) => setCustomization(prev => ({
                                      ...prev,
                                      rightAxis: { ...prev.rightAxis, significantFigures: parseInt(e.target.value) || 2 }
                                    }))}
                                    className={`w-full px-2 py-1 text-xs rounded border ${
                                      isDarkMode 
                                        ? 'bg-gray-700 border-gray-600 text-white' 
                                        : 'bg-white border-gray-300 text-gray-900'
                                    }`}
                                    min="1"
                                    max="6"
                                    title="Number of significant figures for tick labels"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center space-x-3 mt-2">
                                <input
                                  type="checkbox"
                                  id="right-axis-grid"
                                  checked={customization.rightAxis.showGrid}
                                  onChange={(e) => setCustomization(prev => ({ 
                                    ...prev, 
                                    rightAxis: { ...prev.rightAxis, showGrid: e.target.checked }
                                  }))}
                                  className="rounded"
                                />
                                <label htmlFor="right-axis-grid" className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Show Grid Lines</label>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Legend Tab */}
                    {activeAppearanceTab === 'legend' && (
                      <div className="space-y-4">
                        <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="show-legend"
                          checked={customization.legend.show}
                          onChange={(e) => setCustomization(prev => ({ 
                            ...prev, 
                            legend: { ...prev.legend, show: e.target.checked }
                          }))}
                          className="rounded"
                        />
                        <label htmlFor="show-legend" className={`font-medium text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Show Legend</label>
                      </div>
                      
                      {customization.legend.show && (
                        <div className="space-y-4">
                          {/* Position Controls */}
                          <div>
                            <label className={`text-xs font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Position</label>
                            <select
                              value={customization.legend.position}
                              onChange={(e) => setCustomization(prev => ({
                                ...prev,
                                legend: { ...prev.legend, position: e.target.value as any }
                              }))}
                              className={inputClass}
                            >
                              <option value="top-left">Top Left</option>
                              <option value="top-center">Top Center</option>
                              <option value="top-right">Top Right</option>
                              <option value="middle-left">Middle Left</option>
                              <option value="middle-right">Middle Right</option>
                              <option value="bottom-left">Bottom Left</option>
                              <option value="bottom-center">Bottom Center</option>
                              <option value="bottom-right">Bottom Right</option>
                              <option value="below-x-axis">Below X-Axis</option>
                            </select>
                          </div>

                          {/* Typography Controls */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Font Size</label>
                              <input
                                type="number"
                                value={customization.legend.fontSize}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  legend: { ...prev.legend, fontSize: parseInt(e.target.value) || 12 }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              />
                            </div>
                            <div>
                              <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Padding</label>
                              <input
                                type="number"
                                value={customization.legend.padding}
                                onChange={(e) => setCustomization(prev => ({
                                  ...prev,
                                  legend: { ...prev.legend, padding: parseInt(e.target.value) || 8 }
                                }))}
                                className={`w-full px-2 py-1 text-xs rounded border ${
                                  isDarkMode 
                                    ? 'bg-gray-700 border-gray-600 text-white' 
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                                min="2"
                                max="20"
                              />
                            </div>
                          </div>

                          {/* Color Controls */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Text:</label>
                                <input
                                  type="color"
                                  value={customization.legend.textColor}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    legend: { ...prev.legend, textColor: e.target.value }
                                  }))}
                                  className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Background:</label>
                                <input
                                  type="color"
                                  value={customization.legend.backgroundColor}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    legend: { ...prev.legend, backgroundColor: e.target.value }
                                  }))}
                                  className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Border:</label>
                                <input
                                  type="color"
                                  value={customization.legend.borderColor}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    legend: { ...prev.legend, borderColor: e.target.value }
                                  }))}
                                  className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Opacity:</label>
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.1"
                                  value={customization.legend.backgroundOpacity}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    legend: { ...prev.legend, backgroundOpacity: parseFloat(e.target.value) }
                                  }))}
                                  className="w-16"
                                />
                                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                  {Math.round(customization.legend.backgroundOpacity * 100)}%
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Border Width:</label>
                                <input
                                  type="number"
                                  value={customization.legend.borderWidth}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    legend: { ...prev.legend, borderWidth: parseInt(e.target.value) || 0 }
                                  }))}
                                  className={`w-16 px-2 py-1 text-xs rounded border ${
                                    isDarkMode 
                                      ? 'bg-gray-700 border-gray-600 text-white' 
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Well Info Legend Section */}
              <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
                <button 
                  onClick={() => toggleSection('wellInfo')}
                  className={sectionHeaderClass}
                >
                  <div className="flex items-center">
                    <svg className={`w-5 h-5 mr-2 ${isDarkMode ? 'text-white' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className={`font-semibold text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Well Info Legend
                    </span>
                  </div>
                  <svg 
                    className={`w-5 h-5 transition-transform duration-200 ${
                      expandedSections.wellInfo ? 'rotate-180' : ''
                    } ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedSections.wellInfo && (
                  <div className={`mt-4 space-y-4 p-5 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-800/30 border-gray-700' 
                      : 'bg-gray-50/50 border-gray-200'
                  }`}>
                    {/* Enable Well Info Legend */}
                    <div className="flex items-center space-x-3 mb-4">
                      <input
                        type="checkbox"
                        id="show-well-info"
                        checked={customization.wellInfoLegend.show}
                        onChange={(e) => setCustomization(prev => ({ 
                          ...prev, 
                          wellInfoLegend: { ...prev.wellInfoLegend, show: e.target.checked }
                        }))}
                        className="rounded"
                      />
                      <label 
                        htmlFor="show-well-info" 
                        className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
                      >
                        Show Well Statistics & Insights
                      </label>
                    </div>

                    {customization.wellInfoLegend.show && (
                      <div className="space-y-4">
                        {/* Field Selection */}
                        <div>
                          <h5 className={`font-medium text-sm mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Information Fields
                          </h5>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="field-well-number"
                                checked={customization.wellInfoLegend.fields.wellNumber}
                                onChange={(e) => setCustomization(prev => ({ 
                                  ...prev, 
                                  wellInfoLegend: { 
                                    ...prev.wellInfoLegend, 
                                    fields: { ...prev.wellInfoLegend.fields, wellNumber: e.target.checked }
                                  }
                                }))}
                                className="rounded"
                              />
                              <label htmlFor="field-well-number" className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Well Number
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="field-cae-number"
                                checked={customization.wellInfoLegend.fields.caeNumber}
                                onChange={(e) => setCustomization(prev => ({ 
                                  ...prev, 
                                  wellInfoLegend: { 
                                    ...prev.wellInfoLegend, 
                                    fields: { ...prev.wellInfoLegend.fields, caeNumber: e.target.checked }
                                  }
                                }))}
                                className="rounded"
                              />
                              <label htmlFor="field-cae-number" className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                CAE Number
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="field-total-readings"
                                checked={customization.wellInfoLegend.fields.totalReadings}
                                onChange={(e) => setCustomization(prev => ({ 
                                  ...prev, 
                                  wellInfoLegend: { 
                                    ...prev.wellInfoLegend, 
                                    fields: { ...prev.wellInfoLegend.fields, totalReadings: e.target.checked }
                                  }
                                }))}
                                className="rounded"
                              />
                              <label htmlFor="field-total-readings" className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Total Readings
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="field-data-range"
                                checked={customization.wellInfoLegend.fields.dataRange}
                                onChange={(e) => setCustomization(prev => ({ 
                                  ...prev, 
                                  wellInfoLegend: { 
                                    ...prev.wellInfoLegend, 
                                    fields: { ...prev.wellInfoLegend.fields, dataRange: e.target.checked }
                                  }
                                }))}
                                className="rounded"
                              />
                              <label htmlFor="field-data-range" className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Date Range
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="field-level-stats"
                                checked={customization.wellInfoLegend.fields.levelStats}
                                onChange={(e) => setCustomization(prev => ({ 
                                  ...prev, 
                                  wellInfoLegend: { 
                                    ...prev.wellInfoLegend, 
                                    fields: { ...prev.wellInfoLegend.fields, levelStats: e.target.checked }
                                  }
                                }))}
                                className="rounded"
                              />
                              <label htmlFor="field-level-stats" className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Level Statistics
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="field-trend"
                                checked={customization.wellInfoLegend.fields.trend}
                                onChange={(e) => setCustomization(prev => ({ 
                                  ...prev, 
                                  wellInfoLegend: { 
                                    ...prev.wellInfoLegend, 
                                    fields: { ...prev.wellInfoLegend.fields, trend: e.target.checked }
                                  }
                                }))}
                                className="rounded"
                              />
                              <label htmlFor="field-trend" className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                Trend Analysis
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Styling Controls */}
                        <div>
                          <h5 className={`font-medium text-sm mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Appearance
                          </h5>
                          <div className="space-y-3">
                            {/* Font Size and Padding */}
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Font Size:</label>
                                <input
                                  type="number"
                                  value={customization.wellInfoLegend.fontSize}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    wellInfoLegend: { ...prev.wellInfoLegend, fontSize: parseInt(e.target.value) || 12 }
                                  }))}
                                  className={`w-16 px-2 py-1 text-xs rounded border ${
                                    isDarkMode 
                                      ? 'bg-gray-700 border-gray-600 text-white' 
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                  min="8"
                                  max="24"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Padding:</label>
                                <input
                                  type="number"
                                  value={customization.wellInfoLegend.padding}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    wellInfoLegend: { ...prev.wellInfoLegend, padding: parseInt(e.target.value) || 8 }
                                  }))}
                                  className={`w-16 px-2 py-1 text-xs rounded border ${
                                    isDarkMode 
                                      ? 'bg-gray-700 border-gray-600 text-white' 
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                  min="4"
                                  max="20"
                                />
                              </div>
                            </div>

                            {/* Colors */}
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Text:</label>
                                <input
                                  type="color"
                                  value={customization.wellInfoLegend.textColor}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    wellInfoLegend: { ...prev.wellInfoLegend, textColor: e.target.value }
                                  }))}
                                  className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Background:</label>
                                <input
                                  type="color"
                                  value={customization.wellInfoLegend.backgroundColor}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    wellInfoLegend: { ...prev.wellInfoLegend, backgroundColor: e.target.value }
                                  }))}
                                  className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Opacity:</label>
                                <input
                                  type="range"
                                  value={customization.wellInfoLegend.backgroundOpacity * 100}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    wellInfoLegend: { ...prev.wellInfoLegend, backgroundOpacity: parseInt(e.target.value) / 100 }
                                  }))}
                                  className="w-16"
                                  min="0"
                                  max="100"
                                />
                                <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                  {Math.round(customization.wellInfoLegend.backgroundOpacity * 100)}%
                                </span>
                              </div>
                            </div>

                            {/* Border */}
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Border:</label>
                                <input
                                  type="color"
                                  value={customization.wellInfoLegend.borderColor}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    wellInfoLegend: { ...prev.wellInfoLegend, borderColor: e.target.value }
                                  }))}
                                  className="w-8 h-6 rounded border border-gray-300 cursor-pointer"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Width:</label>
                                <input
                                  type="number"
                                  value={customization.wellInfoLegend.borderWidth}
                                  onChange={(e) => setCustomization(prev => ({
                                    ...prev,
                                    wellInfoLegend: { ...prev.wellInfoLegend, borderWidth: parseInt(e.target.value) || 0 }
                                  }))}
                                  className={`w-16 px-2 py-1 text-xs rounded border ${
                                    isDarkMode 
                                      ? 'bg-gray-700 border-gray-600 text-white' 
                                      : 'bg-white border-gray-300 text-gray-900'
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Position Sliders */}
                            <div className="space-y-3">
                              <h6 className={`font-medium text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Position</h6>
                              <div className="space-y-3">
                                {/* Horizontal Position */}
                                <div className="flex items-center gap-3">
                                  <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} style={{ minWidth: '60px' }}>
                                    Horizontal:
                                  </label>
                                  <input
                                    type="range"
                                    value={customization.wellInfoLegend.position.x}
                                    onChange={(e) => setCustomization(prev => ({
                                      ...prev,
                                      wellInfoLegend: { 
                                        ...prev.wellInfoLegend, 
                                        position: { 
                                          ...prev.wellInfoLegend.position, 
                                          x: parseInt(e.target.value) 
                                        }
                                      }
                                    }))}
                                    className="flex-1"
                                    min="0"
                                    max={customization.width - 50}
                                    step="10"
                                  />
                                  <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} style={{ minWidth: '35px' }}>
                                    {customization.wellInfoLegend.position.x}px
                                  </span>
                                </div>
                                
                                {/* Vertical Position */}
                                <div className="flex items-center gap-3">
                                  <label className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} style={{ minWidth: '60px' }}>
                                    Vertical:
                                  </label>
                                  <input
                                    type="range"
                                    value={customization.wellInfoLegend.position.y}
                                    onChange={(e) => setCustomization(prev => ({
                                      ...prev,
                                      wellInfoLegend: { 
                                        ...prev.wellInfoLegend, 
                                        position: { 
                                          ...prev.wellInfoLegend.position, 
                                          y: parseInt(e.target.value) 
                                        }
                                      }
                                    }))}
                                    className="flex-1"
                                    min="0"
                                    max={customization.height - 50}
                                    step="10"
                                  />
                                  <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} style={{ minWidth: '35px' }}>
                                    {customization.wellInfoLegend.position.y}px
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Export Section */}
              <div className="pb-6">
                <button 
                  onClick={() => toggleSection('export')}
                  className={sectionHeaderClass}
                >
                  <div className="flex items-center">
                    <svg className={`w-5 h-5 mr-2 ${isDarkMode ? 'text-white' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className={`font-semibold text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      Export Settings
                    </span>
                  </div>
                  <svg 
                    className={`w-5 h-5 transition-transform duration-200 ${
                      expandedSections.export ? 'rotate-180' : ''
                    } ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {expandedSections.export && (
                  <div className="mt-4 p-4 rounded-lg bg-gray-500 bg-opacity-5">
                    {/* Export Controls */}
                    <div className="space-y-4 mb-6">
                      <div>
                        <label className={labelClass}>Filename</label>
                        <input
                          type="text"
                          value={customization.export.filename}
                          onChange={(e) => setCustomization(prev => ({
                            ...prev,
                            export: { ...prev.export, filename: e.target.value }
                          }))}
                          className={inputClass}
                          placeholder="well_plot_custom"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>File Format</label>
                          <select
                            value={customization.export.format}
                            onChange={(e) => setCustomization(prev => ({
                              ...prev,
                              export: { ...prev.export, format: e.target.value as 'png' | 'jpg' | 'tiff' | 'webp' }
                            }))}
                            className={inputClass}
                          >
                            <option value="png">PNG</option>
                            <option value="jpg">JPG</option>
                            <option value="tiff">TIFF</option>
                            <option value="webp">WebP</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className={labelClass}>Quality</label>
                          <div className={`px-3 py-2 rounded-lg border ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-400' 
                              : 'bg-gray-100 border-gray-300 text-gray-600'
                          }`}>
                            {customization.export.format === 'png' || customization.export.format === 'tiff' ? 'Lossless' : 'High'}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className={`p-4 rounded-lg ${
                      isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
                    }`}>
                      <h4 className={`font-medium mb-2 text-sm ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>Export Summary</h4>
                      <div className={`text-sm space-y-1 ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        <p>Filename: {customization.export.filename}.{customization.export.format}</p>
                        <p>Format: {customization.export.format.toUpperCase()}</p>
                        <p>Dimensions: {customization.width} × {customization.height} pixels</p>
                        <p>Resolution: {customization.dpi} DPI</p>
                        <p>Aspect Ratio: {customization.aspectRatio}</p>
                        <p>Data: {[
                          customization.showTransducerData && 'Transducer',
                          customization.showManualData && 'Manual',
                          customization.showTemperatureData && 'Temperature'
                        ].filter(Boolean).join(', ') || 'None selected'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Live Preview */}
          <div className="flex-1 flex flex-col">
            <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Live Preview
              </h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                See your customizations in real-time
              </p>
            </div>
            <div className="flex-1 overflow-hidden">
              <LivePlotPreview
                customization={customization}
                plotData={plotData}
                isDarkMode={isDarkMode}
                wellNumber={wellNumber}
                well={well}
              />
            </div>
          </div>
        </div>
        )}

        {/* Full-Screen Image Viewer Modal (Mobile Only) */}
        {isMobile && showFullImageViewer && (
          <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-[70] p-4">
            <div className="w-full h-full flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 text-white">
                <div>
                  <h3 className="text-lg font-semibold">Plot Preview</h3>
                  <p className="text-sm text-gray-300">{customization.width}×{customization.height}px @ {customization.dpi} DPI</p>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Zoom controls are now integrated into the react-zoom-pan-pinch component */}
                  
                  <button
                    onClick={() => setShowPropertiesDialog(true)}
                    className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-white"
                    title="View plot properties"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
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
              
              {/* Full Image Viewer - Using react-zoom-pan-pinch */}
              <div ref={imageViewerContainerRef} className="flex-1 overflow-hidden bg-gray-900 relative">
                <TransformWrapper
                  initialScale={1}
                  minScale={0.1}
                  maxScale={4}
                  centerOnInit={false}
                  limitToBounds={false}
                  centerZoomedOut={false}
                  wheel={{ 
                    step: 0.1
                  }}
                  pinch={{
                    step: 5
                  }}
                  doubleClick={{
                    disabled: true
                  }}
                  panning={{
                    velocityDisabled: true
                  }}
                  onInit={(ref) => {
                    setTimeout(() => {
                      if (ref && imageViewerContainerRef.current) {
                        const container = imageViewerContainerRef.current;
                        const containerWidth = container.clientWidth;
                        const containerHeight = container.clientHeight;
                        const imageWidth = customization.width;
                        const imageHeight = customization.height;
                        
                        // Calculate scale to fit image completely in container
                        const scaleX = containerWidth / imageWidth;
                        const scaleY = containerHeight / imageHeight;
                        const scale = Math.min(scaleX, scaleY) * 0.9;
                        
                        // Calculate position to center the scaled image
                        const scaledImageWidth = imageWidth * scale;
                        const scaledImageHeight = imageHeight * scale;
                        const x = (containerWidth - scaledImageWidth) / 2;
                        const y = (containerHeight - scaledImageHeight) / 2;
                        
                        // Use the internal state setting instead of animation
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
                  {({ zoomIn, zoomOut, resetTransform, centerView, instance }) => (
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
                              
                              // Calculate scale to fit image completely in container
                              const scaleX = containerWidth / imageWidth;
                              const scaleY = containerHeight / imageHeight;
                              const scale = Math.min(scaleX, scaleY) * 0.9;
                              
                              // Calculate position to center the scaled image
                              const scaledImageWidth = imageWidth * scale;
                              const scaledImageHeight = imageHeight * scale;
                              const x = (containerWidth - scaledImageWidth) / 2;
                              const y = (containerHeight - scaledImageHeight) / 2;
                              
                              // Apply the same direct transformation as onInit
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
                          <LivePlotPreview
                            customization={customization}
                            plotData={plotData}
                            isDarkMode={false}
                            wellNumber={wellNumber}
                            well={well}
                            showFullSize={true}
                          />
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

        {/* Properties Dialog Modal */}
        {showPropertiesDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] p-4">
            <div className={`w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl shadow-2xl ${
              isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
            }`}>
              <div className={`flex items-center justify-between p-4 border-b ${
                isDarkMode ? 'border-gray-700' : 'border-gray-200'
              }`}>
                <h3 className={`text-lg font-semibold ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  📊 Plot Properties
                </h3>
                <button
                  onClick={() => setShowPropertiesDialog(false)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-4">
                  <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                    <h4 className={`font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>📐 Dimensions</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Width:</span>
                        <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{customization.width}px</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Height:</span>
                        <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{customization.height}px</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>DPI:</span>
                        <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{customization.dpi}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Ratio:</span>
                        <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{customization.aspectRatio}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                    <h4 className={`font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>🔤 Typography</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Title:</span>
                        <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{customization.title.fontSize}px</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Axes:</span>
                        <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{customization.xAxis.fontSize}px</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Legend:</span>
                        <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{customization.legend.fontSize}px</span>
                      </div>
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                    <h4 className={`font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>📊 Data Series</h4>
                    <div className="space-y-1 text-sm">
                      {customization.showTransducerData && (
                        <div className="flex items-center justify-between">
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Transducer:</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-1 rounded" style={{ backgroundColor: customization.transducerData.color }} />
                            <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{customization.transducerData.lineWidth}px</span>
                          </div>
                        </div>
                      )}
                      {customization.showManualData && (
                        <div className="flex items-center justify-between">
                          <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Manual:</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: customization.manualData.color }} />
                            <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{customization.manualData.pointSize}px</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className={`flex justify-end p-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <button
                  onClick={() => setShowPropertiesDialog(false)}
                  className={`px-4 py-2 rounded-lg ${
                    isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`flex items-center justify-between p-4 border-t ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <button
            onClick={handleReset}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Reset</span>
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className={`px-6 py-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg transition-all duration-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export Plot</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
