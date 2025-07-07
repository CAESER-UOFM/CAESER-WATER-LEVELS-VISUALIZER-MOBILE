'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlotCustomization } from './PlotCustomizationDialog';
import type { Well } from '@/lib/api/api';
import { LoadingSpinner } from './LoadingSpinner';

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

// Smart margin calculation for preview (scaled down)
function calculateSmartMarginsPreview(customization: PlotCustomization, previewScale: number = 0.5): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const MINIMUM_BORDER_MARGIN = 5; // Scaled down for preview - tight layout
  
  // Base margins for plot area - compact layout
  let top = 10;
  let right = 15;
  let bottom = 40;
  let left = 35;
  
  // Adjust for title positioning (scaled for preview)
  if (customization.title.show) {
    const titleSpace = (customization.title.fontSize * 0.6) + (customization.title.distance * previewScale);
    if (customization.title.position === 'top') {
      top = Math.max(top, titleSpace + MINIMUM_BORDER_MARGIN);
    } else {
      bottom = Math.max(bottom, titleSpace + MINIMUM_BORDER_MARGIN);
    }
  }
  
  // Adjust based on axis label distances (scaled for preview)
  const scaledXDistance = customization.xAxis.labelDistance * previewScale;
  const scaledYDistance = customization.yAxis.labelDistance * previewScale;
  const scaledRightDistance = customization.rightAxis.labelDistance * previewScale;
  
  if (customization.xAxis.labelPosition === 'bottom') {
    bottom = Math.max(bottom, scaledXDistance + (customization.xAxis.fontSize * 0.8) + MINIMUM_BORDER_MARGIN);
  } else {
    top = Math.max(top, scaledXDistance + (customization.xAxis.fontSize * 0.8) + MINIMUM_BORDER_MARGIN);
  }
  
  if (customization.yAxis.labelPosition === 'left') {
    left = Math.max(left, scaledYDistance + (customization.yAxis.fontSize * 0.8) + MINIMUM_BORDER_MARGIN);
  } else {
    right = Math.max(right, scaledYDistance + (customization.yAxis.fontSize * 0.8) + MINIMUM_BORDER_MARGIN);
  }
  
  // Adjust for right axis if shown
  if (customization.showTemperatureData && customization.rightAxis.show) {
    right = Math.max(right, scaledRightDistance + (customization.rightAxis.fontSize * 0.8) + MINIMUM_BORDER_MARGIN);
  }
  
  return { top, right, bottom, left };
}

interface WaterLevelData {
  timestamp: string;
  water_level: number;
  temperature?: number;
  reading_type: 'transducer' | 'manual';
}

interface LivePlotPreviewProps {
  customization: PlotCustomization;
  plotData?: WaterLevelData[]; // Use existing plot data
  isDarkMode?: boolean;
  wellNumber?: string; // For well info legend
  well?: any; // Well data for CAE number and other info
  showFullSize?: boolean; // Show actual dimensions for mobile zoom
  skipDataProcessing?: boolean; // Skip internal data processing if data is already processed
}

export function LivePlotPreview({ 
  customization, 
  plotData = [],
  isDarkMode = true,
  wellNumber,
  well,
  showFullSize = false,
  skipDataProcessing = false
}: LivePlotPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<WaterLevelData[]>([]);

  // Process plot data based on customization filters
  useEffect(() => {
    if (!plotData || plotData.length === 0) {
      setData([]);
      return;
    }

    // If data is already processed, use it directly
    if (skipDataProcessing) {
      setData(plotData as WaterLevelData[]);
      return;
    }

    // Ensure data is in the correct format
    let convertedData: WaterLevelData[] = plotData.map((item: any) => ({
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

    setData(convertedData);
  }, [plotData, customization.showTransducerData, customization.showManualData, customization.showTemperatureData, customization.dateRange, skipDataProcessing]);

  // Render plot whenever customization or data changes
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || data.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate preview dimensions based on customization aspect ratio
    let previewWidth: number;
    let previewHeight: number;
    
    if (showFullSize) {
      // For mobile modal - show actual dimensions for zoom capability
      previewWidth = customization.width;
      previewHeight = customization.height;
    } else {
      // For desktop preview - scale to fit container
      const containerRect = container.getBoundingClientRect();
      const maxPreviewWidth = Math.max(300, containerRect.width - 40);
      const maxPreviewHeight = Math.max(200, containerRect.height - 40);
      
      // Calculate aspect ratio from customization
      let targetAspectRatio = 16/9; // default
      if (customization.aspectRatio !== 'custom') {
        const aspectRatios = {
          '16:9': 16/9,
          '4:3': 4/3,
          '1:1': 1/1,
          '3:2': 3/2,
        };
        targetAspectRatio = aspectRatios[customization.aspectRatio as keyof typeof aspectRatios] || 16/9;
      } else {
        targetAspectRatio = customization.width / customization.height;
      }
      
      // Scale to fit container while maintaining aspect ratio
      previewWidth = maxPreviewWidth;
      previewHeight = previewWidth / targetAspectRatio;
      
      if (previewHeight > maxPreviewHeight) {
        previewHeight = maxPreviewHeight;
        previewWidth = previewHeight * targetAspectRatio;
      }
    }

    // Set canvas size
    canvas.width = previewWidth;
    canvas.height = previewHeight;
    canvas.style.width = `${previewWidth}px`;
    canvas.style.height = `${previewHeight}px`;

    // Clear canvas
    ctx.fillStyle = customization.backgroundColor;
    ctx.fillRect(0, 0, previewWidth, previewHeight);

    // Draw border if specified
    if (customization.borderWidth > 0) {
      ctx.strokeStyle = customization.borderColor;
      ctx.lineWidth = customization.borderWidth;
      ctx.strokeRect(0, 0, previewWidth, previewHeight);
    }

    // Calculate plot margins using smart margin calculation
    const titleFontSize = customization.title.show ? Math.max(8, customization.title.fontSize * 0.6) : 0; // Scale down for preview, no upper limit
    const margin = calculateSmartMarginsPreview(customization, 0.5);

    const plotWidth = previewWidth - margin.left - margin.right;
    const plotHeight = previewHeight - margin.top - margin.bottom;
    const plotX = margin.left;
    const plotY = margin.top;

    // Draw title if enabled
    if (customization.title.show && customization.title.text) {
      ctx.fillStyle = customization.title.color;
      ctx.font = `${titleFontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      
      let titleY;
      if (customization.title.position === 'top') {
        titleY = titleFontSize + (customization.title.distance * 0.5); // Scale distance for preview
      } else {
        titleY = previewHeight - (customization.title.distance * 0.5);
      }
      
      ctx.fillText(customization.title.text, previewWidth / 2, titleY);
    }

    // Draw plot area background
    ctx.fillStyle = customization.plotAreaColor;
    ctx.fillRect(plotX, plotY, plotWidth, plotHeight);

    if (data.length > 0) {
      // Calculate data bounds
      const waterLevels = data.map(d => d.water_level);
      const timestamps = data.map(d => new Date(d.timestamp).getTime());
      
      const minLevel = Math.min(...waterLevels);
      const maxLevel = Math.max(...waterLevels);
      const minTime = Math.min(...timestamps);
      const maxTime = Math.max(...timestamps);

      // Add some padding to the data range
      const levelRange = maxLevel - minLevel;
      const levelPadding = levelRange * 0.1;
      const yMin = minLevel - levelPadding;
      const yMax = maxLevel + levelPadding;

      // Helper functions for coordinate conversion
      const xScale = (timestamp: number) => plotX + ((timestamp - minTime) / (maxTime - minTime)) * plotWidth;
      const yScale = (level: number) => plotY + plotHeight - ((level - yMin) / (yMax - yMin)) * plotHeight;

      // Draw grid if enabled
      if (customization.xAxis.showGrid && customization.xAxis.gridLines > 0) {
        ctx.strokeStyle = customization.xAxis.gridColor;
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= customization.xAxis.gridLines; i++) {
          const x = plotX + (plotWidth / customization.xAxis.gridLines) * i;
          ctx.beginPath();
          ctx.moveTo(x, plotY);
          ctx.lineTo(x, plotY + plotHeight);
          ctx.stroke();
        }
      }

      if (customization.yAxis.showGrid && customization.yAxis.gridLines > 0) {
        ctx.strokeStyle = customization.yAxis.gridColor;
        ctx.lineWidth = 0.5;
        for (let i = 0; i <= customization.yAxis.gridLines; i++) {
          const y = plotY + (plotHeight / customization.yAxis.gridLines) * i;
          ctx.beginPath();
          ctx.moveTo(plotX, y);
          ctx.lineTo(plotX + plotWidth, y);
          ctx.stroke();
        }
      }

      // Draw data series
      const transducerData = data.filter(d => d.reading_type === 'transducer');
      const manualData = data.filter(d => d.reading_type === 'manual');

      // Draw transducer data as line
      if (customization.showTransducerData && transducerData.length > 0) {
        ctx.strokeStyle = customization.transducerData.color;
        ctx.lineWidth = Math.max(1, customization.transducerData.lineWidth * 0.5); // Scale down for preview
        
        // Set line dash pattern based on style
        if (customization.transducerData.lineStyle === 'dashed') {
          ctx.setLineDash([5, 5]);
        } else if (customization.transducerData.lineStyle === 'dotted') {
          ctx.setLineDash([2, 3]);
        } else {
          ctx.setLineDash([]);
        }
        
        ctx.beginPath();
        
        transducerData.forEach((point, index) => {
          const x = xScale(new Date(point.timestamp).getTime());
          const y = yScale(point.water_level);
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash

        // Draw points if enabled (scaled down for preview)
        if (customization.transducerData.showPoints) {
          ctx.fillStyle = customization.transducerData.color;
          transducerData.forEach(point => {
            const x = xScale(new Date(point.timestamp).getTime());
            const y = yScale(point.water_level);
            ctx.beginPath();
            ctx.arc(x, y, Math.max(1, customization.transducerData.pointSize * 0.5), 0, 2 * Math.PI);
            ctx.fill();
          });
        }
      }

      // Draw manual data as points
      if (customization.showManualData && manualData.length > 0) {
        const pointSize = Math.max(2, customization.manualData.pointSize * 0.5); // Scale down for preview
        
        manualData.forEach(point => {
          const x = xScale(new Date(point.timestamp).getTime());
          const y = yScale(point.water_level);
          
          ctx.beginPath();
          
          // Create the shape based on point style
          if (customization.manualData.pointStyle === 'circle') {
            ctx.arc(x, y, pointSize, 0, 2 * Math.PI);
          } else if (customization.manualData.pointStyle === 'square') {
            ctx.rect(x - pointSize, y - pointSize, pointSize * 2, pointSize * 2);
          } else if (customization.manualData.pointStyle === 'triangle') {
            ctx.moveTo(x, y - pointSize);
            ctx.lineTo(x - pointSize, y + pointSize);
            ctx.lineTo(x + pointSize, y + pointSize);
            ctx.closePath();
          } else if (customization.manualData.pointStyle === 'diamond') {
            ctx.moveTo(x, y - pointSize);
            ctx.lineTo(x + pointSize, y);
            ctx.lineTo(x, y + pointSize);
            ctx.lineTo(x - pointSize, y);
            ctx.closePath();
          }
          
          // Fill the shape
          ctx.fillStyle = customization.manualData.color;
          ctx.fill();
          
          // Draw border if enabled
          if (customization.manualData.borderWidth > 0) {
            ctx.strokeStyle = customization.manualData.borderColor;
            ctx.lineWidth = Math.max(0.5, customization.manualData.borderWidth * 0.5);
            ctx.setLineDash([]); // Ensure solid border
            ctx.stroke();
          }
        });
      }

      // Draw temperature data if enabled
      if (customization.showTemperatureData) {
        const temperatureData = data.filter(d => d.temperature !== undefined && d.temperature !== null);
        
        if (temperatureData.length > 0) {
          // Calculate temperature bounds for scaling
          const tempValues = temperatureData.map(d => d.temperature!);
          const minTemp = Math.min(...tempValues);
          const maxTemp = Math.max(...tempValues);
          const tempRange = maxTemp - minTemp;
          const tempPadding = tempRange * 0.1;
          const tempMin = minTemp - tempPadding;
          const tempMax = maxTemp + tempPadding;
          
          // Scale temperature to plot area (use secondary scale)
          const tempScale = (temp: number) => plotY + plotHeight - ((temp - tempMin) / (tempMax - tempMin)) * plotHeight;
          
          ctx.strokeStyle = customization.temperatureData.color;
          ctx.lineWidth = Math.max(1, customization.temperatureData.lineWidth * 0.5); // Scale down for preview
          ctx.beginPath();
          
          temperatureData.forEach((point, index) => {
            const x = xScale(new Date(point.timestamp).getTime());
            const y = tempScale(point.temperature!);
            
            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
          
          ctx.stroke();
          
          // Draw temperature points if enabled
          if (customization.temperatureData.showPoints) {
            ctx.fillStyle = customization.temperatureData.color;
            temperatureData.forEach(point => {
              const x = xScale(new Date(point.timestamp).getTime());
              const y = tempScale(point.temperature!);
              ctx.beginPath();
              ctx.arc(x, y, Math.max(1, customization.temperatureData.pointSize * 0.5), 0, 2 * Math.PI);
              ctx.fill();
            });
          }
        }
      }

      // Draw axes
      ctx.strokeStyle = customization.borderColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotX, plotY);
      ctx.lineTo(plotX, plotY + plotHeight);
      ctx.lineTo(plotX + plotWidth, plotY + plotHeight);
      ctx.stroke();

      // Draw axis labels
      const xLabelFontSize = customization.xAxis.fontSize * 0.6; // Scale down for preview, no upper limit
      const yLabelFontSize = customization.yAxis.fontSize * 0.6; // Scale down for preview, no upper limit
      
      // X-axis label
      ctx.fillStyle = customization.xAxis.color;
      ctx.font = `${xLabelFontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      const scaledXDistance = customization.xAxis.labelDistance * 0.5; // Scale for preview
      const xLabelY = customization.xAxis.labelPosition === 'top' 
        ? plotY - scaledXDistance 
        : plotY + plotHeight + scaledXDistance;
      ctx.fillText(customization.xAxis.label, plotX + plotWidth / 2, xLabelY);

      // Y-axis label
      ctx.fillStyle = customization.yAxis.color;
      ctx.font = `${yLabelFontSize}px Arial, sans-serif`;
      ctx.save();
      const scaledYDistance = customization.yAxis.labelDistance * 0.5; // Scale for preview
      const yLabelX = customization.yAxis.labelPosition === 'right' 
        ? plotX + plotWidth + scaledYDistance 
        : plotX - scaledYDistance;
      ctx.translate(yLabelX, plotY + plotHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(customization.yAxis.label, 0, 0);
      ctx.restore();

      // Draw axis tick labels with proper font sizes and counts
      const xTickFontSize = customization.xAxis.tickFontSize * 0.5; // Scale down for preview, no upper limit
      const yTickFontSize = customization.yAxis.tickFontSize * 0.5; // Scale down for preview, no upper limit
      
      // X-axis ticks
      ctx.fillStyle = customization.xAxis.color;
      ctx.font = `${xTickFontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      
      const xTickCount = Math.min(customization.xAxis.tickCount, 6); // Limit for preview
      for (let i = 0; i <= xTickCount; i++) {
        const tickTime = minTime + ((maxTime - minTime) / xTickCount) * i;
        const tickDate = new Date(tickTime);
        const x = plotX + (plotWidth / xTickCount) * i;
        const tickY = customization.xAxis.labelPosition === 'top' ? plotY - 5 : plotY + plotHeight + 25;
        ctx.fillText(tickDate.toLocaleDateString(), x, tickY);
      }

      // Y-axis ticks
      ctx.fillStyle = customization.yAxis.color;
      ctx.font = `${yTickFontSize}px Arial, sans-serif`;
      ctx.textAlign = customization.yAxis.labelPosition === 'right' ? 'left' : 'right';
      
      const yTickCount = Math.min(customization.yAxis.tickCount, 6); // Limit for preview
      for (let i = 0; i <= yTickCount; i++) {
        const tickValue = yMin + ((yMax - yMin) / yTickCount) * i;
        const y = plotY + plotHeight - (plotHeight / yTickCount) * i;
        const tickX = customization.yAxis.labelPosition === 'right' ? plotX + plotWidth + 5 : plotX - 5;
        const formattedValue = formatWithSignificantFigures(tickValue, customization.yAxis.significantFigures);
        ctx.fillText(formattedValue, tickX, y + 3);
      }
      
      // Draw right axis for temperature if enabled
      if (customization.showTemperatureData && customization.rightAxis.show) {
        const temperatureData = data.filter(d => d.temperature !== undefined && d.temperature !== null);
        
        if (temperatureData.length > 0) {
          // Calculate temperature bounds
          const tempValues = temperatureData.map(d => d.temperature!);
          const minTemp = Math.min(...tempValues);
          const maxTemp = Math.max(...tempValues);
          const tempRange = maxTemp - minTemp;
          const tempPadding = tempRange * 0.1;
          const tempMin = minTemp - tempPadding;
          const tempMax = maxTemp + tempPadding;
          
          // Draw right axis line
          ctx.strokeStyle = customization.rightAxis.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(plotX + plotWidth, plotY);
          ctx.lineTo(plotX + plotWidth, plotY + plotHeight);
          ctx.stroke();
          
          // Draw right axis label
          const rightLabelFontSize = customization.rightAxis.fontSize * 0.6; // Scale down for preview, no upper limit
          ctx.fillStyle = customization.rightAxis.color;
          ctx.font = `${rightLabelFontSize}px Arial, sans-serif`;
          ctx.save();
          const scaledRightDistance = customization.rightAxis.labelDistance * 0.5;
          const rightLabelX = plotX + plotWidth + scaledRightDistance;
          ctx.translate(rightLabelX, plotY + plotHeight / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = 'center';
          ctx.fillText(customization.rightAxis.label, 0, 0);
          ctx.restore();
          
          // Draw right axis ticks
          const rightTickFontSize = customization.rightAxis.tickFontSize * 0.5; // Scale down for preview, no upper limit
          ctx.fillStyle = customization.rightAxis.color;
          ctx.font = `${rightTickFontSize}px Arial, sans-serif`;
          ctx.textAlign = 'left';
          
          const rightTickCount = Math.min(customization.rightAxis.tickCount, 6);
          for (let i = 0; i <= rightTickCount; i++) {
            const tempTickValue = tempMin + ((tempMax - tempMin) / rightTickCount) * i;
            const y = plotY + plotHeight - (plotHeight / rightTickCount) * i;
            const tickX = plotX + plotWidth + 5;
            const formattedTempValue = formatWithSignificantFigures(tempTickValue, customization.rightAxis.significantFigures);
            ctx.fillText(formattedTempValue, tickX, y + 3);
          }
          
          // Draw right axis grid if enabled
          if (customization.rightAxis.showGrid && customization.rightAxis.gridLines > 0) {
            ctx.strokeStyle = customization.rightAxis.gridColor;
            ctx.lineWidth = 0.5;
            for (let i = 0; i <= customization.rightAxis.gridLines; i++) {
              const y = plotY + (plotHeight / customization.rightAxis.gridLines) * i;
              ctx.beginPath();
              ctx.moveTo(plotX, y);
              ctx.lineTo(plotX + plotWidth, y);
              ctx.stroke();
            }
          }
        }
      }
    }

    // Draw enhanced legend if enabled
    if (customization.legend.show) {
      const legendItems = [];
      if (customization.showTransducerData) {
        legendItems.push({ label: 'Transducer Data', color: customization.transducerData.color, type: 'line' });
      }
      if (customization.showManualData) {
        legendItems.push({ label: 'Manual Readings', color: customization.manualData.color, type: 'point' });
      }
      if (customization.showTemperatureData) {
        legendItems.push({ label: 'Temperature', color: customization.temperatureData.color, type: 'line' });
      }

      if (legendItems.length > 0) {
        // Use the actual font size from customization
        const legendFontSize = Math.max(6, customization.legend.fontSize * 0.6); // Scale down for preview, no upper limit
        const legendPadding = Math.max(4, customization.legend.padding * 0.5); // Scale padding for preview
        const lineHeight = legendFontSize + 4;
        const indicatorWidth = 20;
        const indicatorGap = 8;
        
        // Measure text to fit background properly
        ctx.font = `${legendFontSize}px Arial, sans-serif`;
        let maxTextWidth = 0;
        legendItems.forEach(item => {
          const textWidth = ctx.measureText(item.label).width;
          maxTextWidth = Math.max(maxTextWidth, textWidth);
        });
        
        // Calculate legend dimensions that fit content
        const legendWidth = indicatorWidth + indicatorGap + maxTextWidth + legendPadding * 2;
        const legendHeight = legendItems.length * lineHeight + legendPadding * 2;

        // Calculate legend position based on new positioning system
        let legendX = plotX + 10; // default
        let legendY = plotY + 10;
        
        switch (customization.legend.position) {
          case 'top-left':
            legendX = plotX + 10;
            legendY = plotY + 10;
            break;
          case 'top-center':
            legendX = plotX + (plotWidth - legendWidth) / 2;
            legendY = plotY + 10;
            break;
          case 'top-right':
            legendX = plotX + plotWidth - legendWidth - 10;
            legendY = plotY + 10;
            break;
          case 'middle-left':
            legendX = plotX + 10;
            legendY = plotY + (plotHeight - legendHeight) / 2;
            break;
          case 'middle-right':
            legendX = plotX + plotWidth - legendWidth - 10;
            legendY = plotY + (plotHeight - legendHeight) / 2;
            break;
          case 'bottom-left':
            legendX = plotX + 10;
            legendY = plotY + plotHeight - legendHeight - 10;
            break;
          case 'bottom-center':
            legendX = plotX + (plotWidth - legendWidth) / 2;
            legendY = plotY + plotHeight - legendHeight - 10;
            break;
          case 'bottom-right':
            legendX = plotX + plotWidth - legendWidth - 10;
            legendY = plotY + plotHeight - legendHeight - 10;
            break;
          case 'below-x-axis':
            legendX = plotX + (plotWidth - legendWidth) / 2;
            legendY = plotY + plotHeight + 40; // Below the axis labels
            break;
        }

        // Draw legend background with opacity
        const bgColor = customization.legend.backgroundColor;
        const opacity = customization.legend.backgroundOpacity;
        
        // Convert hex to rgba for opacity
        const r = parseInt(bgColor.slice(1, 3), 16);
        const g = parseInt(bgColor.slice(3, 5), 16);
        const b = parseInt(bgColor.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
        
        // Draw legend border if enabled
        if (customization.legend.borderWidth > 0) {
          ctx.strokeStyle = customization.legend.borderColor;
          ctx.lineWidth = Math.max(0.5, customization.legend.borderWidth * 0.5); // Scale for preview
          ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);
        }

        // Draw legend items
        ctx.font = `${legendFontSize}px Arial, sans-serif`;
        ctx.textAlign = 'left';
        
        legendItems.forEach((item, index) => {
          const itemY = legendY + legendPadding + (index * lineHeight) + legendFontSize;
          const indicatorX = legendX + legendPadding;
          const textX = indicatorX + indicatorWidth + indicatorGap;
          
          // Draw color indicator
          ctx.fillStyle = item.color;
          if (item.type === 'line') {
            // Draw line indicator
            ctx.fillRect(indicatorX, itemY - 2, indicatorWidth, 2);
          } else {
            // Draw point indicator
            ctx.beginPath();
            ctx.arc(indicatorX + indicatorWidth/2, itemY - 1, 3, 0, 2 * Math.PI);
            ctx.fill();
          }
          
          // Draw label text
          ctx.fillStyle = customization.legend.textColor;
          ctx.fillText(item.label, textX, itemY);
        });
      }
    }

    // Draw well info legend if enabled
    if (customization.wellInfoLegend.show && data.length > 0) {
      // Calculate well statistics
      const wellInfo = [];
      
      if (customization.wellInfoLegend.fields.wellNumber && wellNumber) {
        wellInfo.push(`Well: ${wellNumber}`);
      }
      
      if (customization.wellInfoLegend.fields.caeNumber && well?.cae_number) {
        wellInfo.push(`CAE: ${well.cae_number}`);
      }
      
      if (customization.wellInfoLegend.fields.totalReadings) {
        wellInfo.push(`Readings: ${data.length}`);
      }
      
      if (customization.wellInfoLegend.fields.dataRange && data.length > 0) {
        const startDate = new Date(data[0].timestamp).toLocaleDateString();
        const endDate = new Date(data[data.length - 1].timestamp).toLocaleDateString();
        wellInfo.push(`Range: ${startDate} - ${endDate}`);
      }
      
      if (customization.wellInfoLegend.fields.levelStats) {
        const waterLevels = data.map(d => d.water_level);
        const minLevel = Math.min(...waterLevels);
        const maxLevel = Math.max(...waterLevels);
        const avgLevel = waterLevels.reduce((sum, level) => sum + level, 0) / waterLevels.length;
        wellInfo.push(`Min: ${minLevel.toFixed(2)} ft`);
        wellInfo.push(`Max: ${maxLevel.toFixed(2)} ft`);
        wellInfo.push(`Avg: ${avgLevel.toFixed(2)} ft`);
      }
      
      if (customization.wellInfoLegend.fields.trend && data.length >= 2) {
        const firstLevel = data[0].water_level;
        const lastLevel = data[data.length - 1].water_level;
        const trend = lastLevel > firstLevel ? 'Rising' : lastLevel < firstLevel ? 'Falling' : 'Stable';
        const change = Math.abs(lastLevel - firstLevel);
        wellInfo.push(`Trend: ${trend} (${change.toFixed(2)} ft)`);
      }

      if (wellInfo.length > 0) {
        // Use the actual font size from customization
        const wellInfoFontSize = Math.max(6, customization.wellInfoLegend.fontSize * 0.6); // Scale down for preview
        const wellInfoPadding = Math.max(4, customization.wellInfoLegend.padding * 0.5); // Scale padding for preview
        const lineHeight = wellInfoFontSize + 3;
        
        // Measure text to fit background properly
        ctx.font = `${wellInfoFontSize}px Arial, sans-serif`;
        let maxTextWidth = 0;
        wellInfo.forEach(info => {
          const textWidth = ctx.measureText(info).width;
          maxTextWidth = Math.max(maxTextWidth, textWidth);
        });
        
        // Calculate legend dimensions that fit content
        const wellInfoWidth = maxTextWidth + wellInfoPadding * 2;
        const wellInfoHeight = wellInfo.length * lineHeight + wellInfoPadding * 2;

        // Scale position for preview (the position is in plot coordinates)
        const previewScale = 0.5;
        const wellInfoX = Math.max(0, Math.min(previewWidth - wellInfoWidth, customization.wellInfoLegend.position.x * previewScale));
        const wellInfoY = Math.max(0, Math.min(previewHeight - wellInfoHeight, customization.wellInfoLegend.position.y * previewScale));

        // Draw well info legend background with opacity
        const bgColor = customization.wellInfoLegend.backgroundColor;
        const opacity = customization.wellInfoLegend.backgroundOpacity;
        
        // Convert hex to rgba for opacity
        const r = parseInt(bgColor.slice(1, 3), 16);
        const g = parseInt(bgColor.slice(3, 5), 16);
        const b = parseInt(bgColor.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        ctx.fillRect(wellInfoX, wellInfoY, wellInfoWidth, wellInfoHeight);
        
        // Draw well info legend border if enabled
        if (customization.wellInfoLegend.borderWidth > 0) {
          ctx.strokeStyle = customization.wellInfoLegend.borderColor;
          ctx.lineWidth = Math.max(0.5, customization.wellInfoLegend.borderWidth * 0.5); // Scale for preview
          ctx.strokeRect(wellInfoX, wellInfoY, wellInfoWidth, wellInfoHeight);
        }

        // Draw well info text
        ctx.font = `${wellInfoFontSize}px Arial, sans-serif`;
        ctx.fillStyle = customization.wellInfoLegend.textColor;
        ctx.textAlign = 'left';
        
        wellInfo.forEach((info, index) => {
          const textY = wellInfoY + wellInfoPadding + (index * lineHeight) + wellInfoFontSize;
          const textX = wellInfoX + wellInfoPadding;
          ctx.fillText(info, textX, textY);
        });
      }
    }

  }, [customization, data, wellNumber, well]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <div className="text-center">
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            No data to display with current filters
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full flex items-center justify-center p-4"
    >
      <canvas 
        ref={canvasRef}
        className={`border rounded-lg ${
          isDarkMode ? 'border-gray-600' : 'border-gray-300'
        }`}
        style={{ maxWidth: '100%', maxHeight: '100%' }}
      />
    </div>
  );
}