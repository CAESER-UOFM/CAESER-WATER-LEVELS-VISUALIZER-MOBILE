'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ScatterController,
  LineController,
  Filler
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

import type { WaterLevelReading } from '@/lib/api/api';
import type { SamplingRate } from '@/utils/smartSampling';
import { 
  calculateBestSampling, 
  shouldShowHighResOptions, 
  formatSamplingDescription,
  SAMPLING_OPTIONS 
} from '@/utils/smartSampling';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ScatterController,
  LineController,
  Filler
);

export interface ChartJSTimeSeriesChartProps {
  data: WaterLevelReading[];
  wellNumber: string;
  title?: string;
  height?: number;
  onZoomChange?: (startDate: Date, endDate: Date) => void;
  onHighResRequest?: (startDate: Date, endDate: Date, samplingRate: SamplingRate) => void;
  isLoading?: boolean;
  currentSamplingRate?: SamplingRate;
  totalDataSpanDays?: number;
  className?: string;
  onResetZoom?: () => void;
}

export function ChartJSTimeSeriesChart({
  data,
  wellNumber,
  title = 'Water Level Time Series',
  height = 400,
  onZoomChange,
  onHighResRequest,
  isLoading = false,
  currentSamplingRate = 'daily',
  totalDataSpanDays,
  className = '',
  onResetZoom
}: ChartJSTimeSeriesChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const [currentZoom, setCurrentZoom] = useState<{ start: Date; end: Date } | null>(null);
  const [showHighResButton, setShowHighResButton] = useState(false);
  const [availableSampling, setAvailableSampling] = useState<typeof SAMPLING_OPTIONS[SamplingRate] | null>(null);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // Prepare chart data
  const chartData = {
    datasets: [
      {
        label: 'Water Level',
        data: data.map(point => ({
          x: new Date(point.timestamp_utc).getTime(),
          y: point.water_level || 0
        })),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: 1.5,
        pointRadius: data.length > 500 ? 0 : 1, // Hide points for large datasets
        pointHoverRadius: 4,
        fill: true,
        tension: 0.1
      },
      // Add temperature data if available (only for transducer/telemetry data, not manual)
      ...(data.some(point => point.temperature !== undefined && point.temperature !== null && point.data_source !== 'manual') ? [{
        label: 'Temperature',
        data: data
          .filter(point => point.data_source !== 'manual' && point.temperature !== undefined && point.temperature !== null)
          .map(point => ({
            x: new Date(point.timestamp_utc).getTime(),
            y: point.temperature!
          })),
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        borderWidth: 1.5,
        pointRadius: data.length > 500 ? 0 : 1,
        pointHoverRadius: 4,
        yAxisID: 'temperature',
        fill: false,
        tension: 0.1
      }] : []),
      // Add manual readings as scatter points
      ...(data.some(point => point.data_source === 'manual') ? [{
        label: 'Manual Readings',
        type: 'scatter' as const,
        data: data
          .filter(point => point.data_source === 'manual')
          .map(point => ({
            x: new Date(point.timestamp_utc).getTime(),
            y: point.water_level || 0
          })),
        borderColor: '#059669',
        backgroundColor: '#059669',
        pointRadius: 4,
        pointHoverRadius: 6
      }] : [])
    ]
  };

  // Chart configuration
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    plugins: {
      title: {
        display: !!title,
        text: title,
        font: {
          size: 16,
          weight: 'bold' as const
        }
      },
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20
        }
      },
      tooltip: {
        callbacks: {
          title: (context: any) => {
            return new Date(context[0].parsed.x).toLocaleString();
          },
          label: (context: any) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            const unit = label.includes('Temperature') ? '°C' : 'm';
            return `${label}: ${value.toFixed(2)} ${unit}`;
          }
        }
      },
    },
    scales: {
      x: {
        type: 'time' as const,
        ...(zoomRange && {
          min: zoomRange.min,
          max: zoomRange.max
        }),
        time: {
          tooltipFormat: 'MMM dd, yyyy HH:mm',
          displayFormats: {
            minute: 'MMM dd, yyyy HH:mm',
            hour: 'MMM dd, yyyy HH:mm',
            day: 'MMM dd, yyyy',
            week: 'MMM dd, yyyy',
            month: 'MMM yyyy',
            year: 'yyyy'
          }
        },
        title: {
          display: true,
          text: 'Date/Time'
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Water Level (m)'
        },
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      // Temperature scale (if needed - only for non-manual data)
      ...(data.some(point => point.temperature !== undefined && point.temperature !== null && point.data_source !== 'manual') ? {
        temperature: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          title: {
            display: true,
            text: 'Temperature (°C)'
          },
          grid: {
            drawOnChartArea: false,
          },
        }
      } : {})
    },
    // Mobile optimizations
    animation: {
      duration: data.length > 1000 ? 0 : 300 // Disable animation for large datasets
    },
    elements: {
      point: {
        hoverBackgroundColor: '#ffffff',
        hoverBorderWidth: 2
      }
    },
    // Custom interaction handlers
    onHover: (event: any, elements: any, chart: any) => {
      chart.canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default';
    }
  };

  // Handle mouse wheel zoom
  const handleWheel = useCallback((event: WheelEvent) => {
    if (!chartRef.current) return;
    
    event.preventDefault();
    const chart = chartRef.current;
    const rect = chart.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    
    // Get current scale
    const scale = chart.scales.x;
    const currentMin = scale.min;
    const currentMax = scale.max;
    const currentRange = currentMax - currentMin;
    
    // Calculate zoom factor
    const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
    const newRange = currentRange * zoomFactor;
    
    // Calculate mouse position in data coordinates
    const mouseTime = scale.getValueForPixel(x);
    if (mouseTime === undefined) return;
    
    const mousePercent = (mouseTime - currentMin) / currentRange;
    
    // Calculate new bounds
    const newMin = mouseTime - (newRange * mousePercent);
    const newMax = mouseTime + (newRange * (1 - mousePercent));
    
    // Apply zoom
    const startDate = new Date(newMin);
    const endDate = new Date(newMax);
    
    setZoomRange({ min: newMin, max: newMax });
    setCurrentZoom({ start: startDate, end: endDate });
    
    // Check for high-res options
    checkHighResOptions(startDate, endDate);
    
    // Notify parent
    if (onZoomChange) {
      onZoomChange(startDate, endDate);
    }
  }, [onZoomChange, totalDataSpanDays, currentSamplingRate]);
  
  // Handle mouse drag pan
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (!chartRef.current) return;
    
    setIsDragging(true);
    setDragStart({ x: event.clientX, y: event.clientY });
  }, []);
  
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging || !dragStart || !chartRef.current) return;
    
    const chart = chartRef.current;
    const scale = chart.scales.x;
    const rect = chart.canvas.getBoundingClientRect();
    
    // Calculate drag distance
    const deltaX = event.clientX - dragStart.x;
    const pixelRange = scale.right - scale.left;
    const dataRange = scale.max - scale.min;
    const deltaTime = -(deltaX / pixelRange) * dataRange;
    
    // Apply pan
    const newMin = (zoomRange?.min || scale.min) + deltaTime;
    const newMax = (zoomRange?.max || scale.max) + deltaTime;
    
    setZoomRange({ min: newMin, max: newMax });
    
    const startDate = new Date(newMin);
    const endDate = new Date(newMax);
    setCurrentZoom({ start: startDate, end: endDate });
    
    // Update drag start for continuous pan
    setDragStart({ x: event.clientX, y: event.clientY });
    
    // Notify parent
    if (onZoomChange) {
      onZoomChange(startDate, endDate);
    }
  }, [isDragging, dragStart, zoomRange, onZoomChange]);
  
  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setDragStart(null);
    
    // Check for high-res options after pan
    if (currentZoom) {
      checkHighResOptions(currentZoom.start, currentZoom.end);
    }
  }, [isDragging, currentZoom]);
  
  // Check high-res options helper
  const checkHighResOptions = useCallback((startDate: Date, endDate: Date) => {
    const timeSpanDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (totalDataSpanDays && shouldShowHighResOptions(totalDataSpanDays, timeSpanDays)) {
      const bestSampling = calculateBestSampling(startDate, endDate, 1500);
      
      if (bestSampling.isUpgrade && bestSampling.rate !== currentSamplingRate) {
        setAvailableSampling(SAMPLING_OPTIONS[bestSampling.rate]);
        setShowHighResButton(true);
      } else {
        setShowHighResButton(false);
      }
    } else {
      setShowHighResButton(false);
    }
  }, [totalDataSpanDays, currentSamplingRate]);
  
  // Add event listeners
  useEffect(() => {
    const canvas = chartRef.current?.canvas;
    if (!canvas) return;
    
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Handle high-res request
  const handleHighResRequest = useCallback(() => {
    if (currentZoom && availableSampling && onHighResRequest) {
      onHighResRequest(currentZoom.start, currentZoom.end, availableSampling.rate);
      setShowHighResButton(false); // Hide button after request
    }
  }, [currentZoom, availableSampling, onHighResRequest]);

  // Reset zoom
  const handleResetZoom = useCallback(() => {
    setZoomRange(null);
    setCurrentZoom(null);
    setShowHighResButton(false);
  }, []);
  
  // Expose reset function to parent
  useEffect(() => {
    (window as any).chartResetZoom = handleResetZoom;
  }, [handleResetZoom]);

  // NOTE: Removed automatic chart updates to prevent zoom reset
  // Chart.js will automatically update when the chartData prop changes

  return (
    <div className={`relative ${className}`}>
      {/* Chart container */}
      <div 
        style={{ height: `${height}px` }} 
        className="relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <Chart
          ref={chartRef}
          type="line"
          data={chartData}
          options={chartOptions}
          key={`chart-${wellNumber}-${currentSamplingRate}`}
        />
        
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-gray-700">Loading data...</span>
            </div>
          </div>
        )}
      </div>

      {/* Chart controls */}
      <div className="mt-4 flex justify-center">
        {/* High-res loading button */}
        {showHighResButton && availableSampling && (
          <button
            onClick={handleHighResRequest}
            disabled={isLoading}
            className="px-4 py-2 bg-primary-600 text-white text-sm rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mobile-touch-target"
          >
            Load {availableSampling.label} Resolution
          </button>
        )}
      </div>

      {/* Zoom instructions */}
      {!currentZoom && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          🖱️ Scroll wheel to zoom • Drag to pan
        </div>
      )}
      
      {/* Zoom indicator */}
      {currentZoom && (
        <div className="mt-2 text-xs text-blue-600 text-center">
          🔍 Zoomed: {Math.ceil((currentZoom.end.getTime() - currentZoom.start.getTime()) / (1000 * 60 * 60 * 24))} days 
          ({totalDataSpanDays ? Math.round(((currentZoom.end.getTime() - currentZoom.start.getTime()) / (1000 * 60 * 60 * 24)) / totalDataSpanDays * 100) : 0}% of total)
        </div>
      )}
    </div>
  );
}