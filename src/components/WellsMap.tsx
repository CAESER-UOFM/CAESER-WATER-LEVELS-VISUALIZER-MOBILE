'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';

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

interface WellsMapProps {
  wells: WellLocation[];
  highlightWell?: string | null;
  onWellClick: (wellNumber: string) => void;
  databaseId: string;
  onResetReady?: (resetFunction: () => void) => void;
}

// Create custom icons for different aquifer types with improved design
const createWellIcon = (aquifer: string, caeNumber: string, isHighlighted: boolean = false, totalReadings: number = 0) => {
  let color = '#6b7280'; // gray-500 default
  let strokeColor = '#374151'; // darker border
  let shadowColor = 'rgba(0,0,0,0.3)';
  
  if (isHighlighted) {
    color = '#ef4444'; // red-500
    strokeColor = '#dc2626'; // red-600
    shadowColor = 'rgba(239,68,68,0.6)';
  } else if (totalReadings === 0) {
    // No data - gray regardless of aquifer
    color = '#6b7280'; // gray-500
    strokeColor = '#4b5563'; // gray-600
    shadowColor = 'rgba(107,114,128,0.3)';
  } else {
    // Color by aquifer type (following desktop visualizer pattern)
    switch (aquifer) {
      case 'MEM': // Memphis aquifer
        color = '#10b981'; // emerald-500 (green)
        strokeColor = '#059669'; // emerald-600
        shadowColor = 'rgba(16,185,129,0.3)';
        break;
      case 'FP': // Fort Pillow aquifer
        color = '#3b82f6'; // blue-500
        strokeColor = '#2563eb'; // blue-600
        shadowColor = 'rgba(59,130,246,0.3)';
        break;
      case 'SHAL': // Shallow aquifer
        color = '#f59e0b'; // amber-500 (orange)
        strokeColor = '#d97706'; // amber-600
        shadowColor = 'rgba(245,158,11,0.3)';
        break;
      default:
        // Unknown aquifer but has data
        color = '#8b5cf6'; // violet-500 (purple)
        strokeColor = '#7c3aed'; // violet-600
        shadowColor = 'rgba(139,92,246,0.3)';
    }
  }

  const size = isHighlighted ? 70 : 40;
  const anchor = isHighlighted ? 35 : 20;
  
  // Use CAE number for display (much shorter and cleaner)
  const displayNumber = caeNumber || 'N/A';
  const fontSize = isHighlighted ? (displayNumber.length > 3 ? '16' : '18') : (displayNumber.length > 3 ? '13' : '15');

  const viewBoxSize = isHighlighted ? 80 : 50;
  
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg width="${size}" height="${size + 16}" viewBox="0 0 ${viewBoxSize} ${viewBoxSize + 10}" xmlns="http://www.w3.org/2000/svg">
        ${isHighlighted ? `
        <!-- Pulsing outer ring for highlighted -->
        <circle cx="${viewBoxSize/2}" cy="${viewBoxSize/2}" r="${isHighlighted ? 30 : 20}" fill="none" stroke="${color}" stroke-width="3" opacity="0.6">
          <animate attributeName="r" values="${isHighlighted ? 30 : 20};${isHighlighted ? 34 : 24};${isHighlighted ? 30 : 20}" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite"/>
        </circle>
        ` : ''}
        
        <!-- Well symbol design: Circular well with center dot -->
        <!-- Outer circle shadow -->
        <circle cx="${viewBoxSize/2 + 1}" cy="${viewBoxSize/2 + 1}" r="${isHighlighted ? 22 : 15}" fill="${shadowColor}"/>
        <!-- Main outer circle -->
        <circle cx="${viewBoxSize/2}" cy="${viewBoxSize/2}" r="${isHighlighted ? 22 : 15}" fill="#ffffff" stroke="${strokeColor}" stroke-width="${isHighlighted ? 3 : 2.5}"/>
        <!-- Colored inner circle -->
        <circle cx="${viewBoxSize/2}" cy="${viewBoxSize/2}" r="${isHighlighted ? 16 : 11}" fill="${color}" stroke="${strokeColor}" stroke-width="2"/>
        <!-- Center well indicator -->
        <circle cx="${viewBoxSize/2}" cy="${viewBoxSize/2}" r="${isHighlighted ? 5 : 3}" fill="#ffffff"/>
        ${isHighlighted ? `<circle cx="${viewBoxSize/2}" cy="${viewBoxSize/2}" r="2.5" fill="${strokeColor}"/>` : ''}
        
        <!-- CAE number text below the well -->
        <text x="${viewBoxSize/2}" y="${viewBoxSize/2 + 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${strokeColor}" stroke="#ffffff" stroke-width="3" paint-order="stroke fill">${displayNumber}</text>
      </svg>
    `)}`,
    iconSize: [size, size + 16],
    iconAnchor: [anchor, anchor],
    popupAnchor: [0, -anchor],
    className: `well-marker ${isHighlighted ? 'highlighted' : ''}`
  });
};

// Component to handle map bounds fitting
function MapBounds({ wells, highlightWell, onBoundsReady }: { wells: WellLocation[]; highlightWell?: string | null; onBoundsReady?: (resetFunction: () => void) => void }) {
  const map = useMap();
  const [hasInitialized, setHasInitialized] = useState(false);
  const [hasHighlighted, setHasHighlighted] = useState(false);
  const [initialBounds, setInitialBounds] = useState<L.LatLngBounds | null>(null);

  const resetToInitialView = () => {
    if (initialBounds && wells.length > 1) {
      map.fitBounds(initialBounds, { padding: [30, 30] });
    } else if (wells.length === 1) {
      const well = wells[0];
      map.setView([well.latitude, well.longitude], 13);
    }
  };

  useEffect(() => {
    if (wells.length === 0 || hasInitialized) return;

    if (wells.length === 1) {
      // Single well: center on it
      const well = wells[0];
      map.setView([well.latitude, well.longitude], 13);
    } else {
      // Multiple wells: fit bounds with better padding and zoom
      const bounds = L.latLngBounds(wells.map(well => [well.latitude, well.longitude]));
      setInitialBounds(bounds);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
    }
    
    setHasInitialized(true);
    
    // Provide reset function to parent
    if (onBoundsReady) {
      onBoundsReady(resetToInitialView);
    }
  }, [map, wells, hasInitialized, onBoundsReady]);

  // Highlight specific well if provided - only run once
  useEffect(() => {
    if (highlightWell && wells.length > 0 && !hasHighlighted) {
      const well = wells.find(w => w.well_number === highlightWell);
      if (well) {
        // Center on the highlighted well with higher zoom
        map.setView([well.latitude, well.longitude], 15);
        
        // Add a pulsing circle around the highlighted well
        const highlightCircle = L.circle([well.latitude, well.longitude], {
          radius: 100, // 100 meters radius
          color: '#ef4444',
          weight: 3,
          opacity: 0.8,
          fillColor: '#ef4444',
          fillOpacity: 0.1,
          className: 'highlight-circle'
        }).addTo(map);

        // Remove the highlight circle after 5 seconds
        setTimeout(() => {
          map.removeLayer(highlightCircle);
        }, 5000);
        
        setHasHighlighted(true);
      }
    }
  }, [map, wells, highlightWell, hasHighlighted]);

  return null;
}

export default function WellsMap({ wells, highlightWell, onWellClick, databaseId, onResetReady }: WellsMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'No data';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getDataStatusText = (well: WellLocation): string => {
    const sources = [];
    if (well.has_transducer_data) sources.push('Transducer');
    if (well.has_telemetry_data) sources.push('Telemetry');
    if (well.has_manual_readings) sources.push('Manual');
    
    return sources.length > 0 ? sources.join(', ') : 'No data';
  };

  // Memphis area center (matching desktop implementation)
  const center: [number, number] = [35.1495, -90.0490];

  return (
    <div className="h-full w-full">
      <MapContainer
        center={center}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Custom positioned zoom control */}
        <ZoomControl position="topright" />
        
        <MapBounds wells={wells} highlightWell={highlightWell} onBoundsReady={onResetReady} />

        {wells.map((well) => {
          const isHighlighted = highlightWell === well.well_number;
          
          return (
            <Marker
              key={well.well_number}
              position={[well.latitude, well.longitude]}
              icon={createWellIcon(well.aquifer, well.cae_number, isHighlighted, well.total_readings)}
            >
              <Popup closeButton={true} maxWidth={280} className="well-popup">
                <div className="p-3">
                  <div className="mb-3">
                    <h3 className="font-semibold text-lg text-gray-900 mb-1">
                      Well {well.well_number}
                    </h3>
                    {well.cae_number && (
                      <p className="text-sm text-gray-600">CAE: {well.cae_number}</p>
                    )}
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="font-medium text-gray-700 block">Aquifer:</span>
                        <p className="text-gray-600">{well.aquifer || 'Unknown'}</p>
                      </div>
                      {well.well_field && (
                        <div>
                          <span className="font-medium text-gray-700 block">Field:</span>
                          <p className="text-gray-600">{well.well_field}</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="font-medium text-gray-700 block">Data Sources:</span>
                      <p className="text-gray-600">{getDataStatusText(well)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="font-medium text-gray-700 block">Total Readings:</span>
                        <p className="text-gray-600">{well.total_readings.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 block">Last Reading:</span>
                        <p className="text-gray-600">{formatDate(well.last_reading_date)}</p>
                      </div>
                    </div>

                    {(well.ground_elevation || well.well_depth || well.static_water_level) && (
                      <div className="grid grid-cols-1 gap-2 pt-2 border-t border-gray-100">
                        {well.ground_elevation && (
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">Ground Elevation:</span>
                            <span className="text-gray-600">{well.ground_elevation.toFixed(1)} ft</span>
                          </div>
                        )}
                        {well.well_depth && (
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">Well Depth:</span>
                            <span className="text-gray-600">{well.well_depth.toFixed(1)} ft</span>
                          </div>
                        )}
                        {well.static_water_level && (
                          <div className="flex justify-between">
                            <span className="font-medium text-gray-700">Static Level:</span>
                            <span className="text-gray-600">{well.static_water_level.toFixed(1)} ft</span>
                          </div>
                        )}
                      </div>
                    )}

                    {well.notes && (
                      <div className="pt-2 border-t border-gray-100">
                        <span className="font-medium text-gray-700 block">Notes:</span>
                        <p className="text-gray-600 text-xs mt-1">{well.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onWellClick(well.well_number);
                      }}
                      className="w-full bg-primary-600 text-white px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm"
                    >
                      📊 View Plot Data
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}