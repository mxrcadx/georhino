'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/Button';
import type { BoundingBox } from '@/types/geo';
import type MapboxDrawType from '@mapbox/mapbox-gl-draw';
import DrawRectangle from '@/lib/map/rectangleMode';

export function Step1SelectArea() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const drawRef = useRef<MapboxDrawType | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [baseLayer, setBaseLayer] = useState<'satellite' | 'streets'>('satellite');
  const [showManualInput, setShowManualInput] = useState(false);

  // Manual coordinate input state
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualWidth, setManualWidth] = useState(''); // in feet
  const [manualHeight, setManualHeight] = useState(''); // in feet

  const bbox = useAppStore((s) => s.bbox);
  const widthFeet = useAppStore((s) => s.widthFeet);
  const heightFeet = useAppStore((s) => s.heightFeet);
  const areaSqFt = useAppStore((s) => s.areaSqFt);
  const setBbox = useAppStore((s) => s.setBbox);
  const clearBbox = useAppStore((s) => s.clearBbox);

  const handleDrawUpdate = useCallback(() => {
    if (!drawRef.current) return;
    const features = drawRef.current.getAll();
    if (features.features.length === 0) {
      clearBbox();
      return;
    }
    const feature = features.features[0];
    if (feature.geometry.type !== 'Polygon') return;

    const coords = (feature.geometry as GeoJSON.Polygon).coordinates[0];
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);

    const newBbox: BoundingBox = {
      west: Math.min(...lngs),
      east: Math.max(...lngs),
      south: Math.min(...lats),
      north: Math.max(...lats),
    };
    setBbox(newBbox);
  }, [setBbox, clearBbox]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token || token === 'your_mapbox_token_here') {
      return;
    }

    let mounted = true;

    async function initMap() {
      const mapboxgl = await import('mapbox-gl');
      const mbgl = mapboxgl.default || mapboxgl;
      const MbDraw = (await import('@mapbox/mapbox-gl-draw')).default;

      if (!mounted || !mapContainerRef.current) return;

      (mbgl as any).accessToken = token;

      const map = new (mbgl as any).Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [-98.5, 39.8],
        zoom: 4,
      });

      const draw = new MbDraw({
        displayControlsDefault: false,
        controls: {
          polygon: false,
          trash: true,
        },
        defaultMode: 'draw_rectangle' as any,
        modes: {
          ...MbDraw.modes,
          draw_rectangle: DrawRectangle,
        } as any,
      });

      map.addControl(draw as any, 'top-left');
      map.addControl(new (mbgl as any).NavigationControl(), 'top-right');

      map.on('draw.create', () => handleDrawUpdate());
      map.on('draw.update', () => handleDrawUpdate());
      map.on('draw.delete', () => clearBbox());

      map.on('load', () => {
        if (mounted) setMapLoaded(true);
      });

      mapRef.current = map;
      drawRef.current = draw;
    }

    initMap();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [handleDrawUpdate, clearBbox]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const style = baseLayer === 'satellite'
      ? 'mapbox://styles/mapbox/satellite-streets-v12'
      : 'mapbox://styles/mapbox/dark-v11';
    mapRef.current.setStyle(style);
  }, [baseLayer, mapLoaded]);

  // Draw new rectangle
  const handleDrawNew = useCallback(() => {
    if (!drawRef.current) return;
    drawRef.current.deleteAll();
    clearBbox();
    drawRef.current.changeMode('draw_rectangle' as any);
  }, [clearBbox]);

  // Apply manual coordinates
  const handleManualApply = useCallback(() => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    const widthFt = parseFloat(manualWidth);
    const heightFt = parseFloat(manualHeight);

    if (isNaN(lat) || isNaN(lng) || isNaN(widthFt) || isNaN(heightFt)) return;
    if (widthFt <= 0 || heightFt <= 0) return;

    // Convert feet to degrees
    const DEG_TO_RAD = Math.PI / 180;
    const EARTH_RADIUS_FT = 20_902_231;
    const latDelta = (heightFt / 2) / (EARTH_RADIUS_FT * DEG_TO_RAD);
    const lngDelta = (widthFt / 2) / (EARTH_RADIUS_FT * DEG_TO_RAD * Math.cos(lat * DEG_TO_RAD));

    const newBbox: BoundingBox = {
      west: lng - lngDelta,
      east: lng + lngDelta,
      south: lat - latDelta,
      north: lat + latDelta,
    };
    setBbox(newBbox);

    // Fly to the area and draw rectangle on map
    if (mapRef.current && drawRef.current) {
      drawRef.current.deleteAll();
      const coords = [
        [newBbox.west, newBbox.south],
        [newBbox.east, newBbox.south],
        [newBbox.east, newBbox.north],
        [newBbox.west, newBbox.north],
        [newBbox.west, newBbox.south],
      ];
      drawRef.current.add({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [coords] },
      } as any);
      mapRef.current.fitBounds(
        [[newBbox.west, newBbox.south], [newBbox.east, newBbox.north]],
        { padding: 60, duration: 1000 }
      );
    }
    setShowManualInput(false);
  }, [manualLat, manualLng, manualWidth, manualHeight, setBbox]);

  const formatFeet = (feet: number): string => {
    if (feet >= 5280) return `${(feet / 5280).toFixed(2)} mi`;
    return `${Math.round(feet).toLocaleString()} ft`;
  };

  const formatArea = (sqft: number): string => {
    const acres = sqft / 43560;
    if (acres >= 640) return `${(acres / 640).toFixed(2)} mi²`;
    if (acres >= 1) return `${acres.toFixed(1)} acres`;
    return `${Math.round(sqft).toLocaleString()} ft²`;
  };

  const noToken = !process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN === 'your_mapbox_token_here';

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 relative">
        {noToken ? (
          <div className="h-full flex items-center justify-center bg-geo-surface">
            <div className="text-center p-8 max-w-md">
              <div className="w-16 h-16 bg-geo-border rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">&#x1F5FA;</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Mapbox Token Required</h3>
              <p className="text-sm text-geo-text-muted mb-4">
                Add your Mapbox access token to <code className="text-geo-accent">.env.local</code> to enable the map.
              </p>
              <code className="text-xs text-geo-text-muted bg-geo-bg p-3 rounded-lg block">
                NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_token
              </code>
            </div>
          </div>
        ) : (
          <div ref={mapContainerRef} className="h-full w-full" />
        )}

        {/* Map controls overlay */}
        {mapLoaded && (
          <div className="absolute top-4 right-16 flex gap-2">
            <Button
              size="sm"
              variant={baseLayer === 'satellite' ? 'primary' : 'secondary'}
              onClick={() => setBaseLayer('satellite')}
            >
              Satellite
            </Button>
            <Button
              size="sm"
              variant={baseLayer === 'streets' ? 'primary' : 'secondary'}
              onClick={() => setBaseLayer('streets')}
            >
              Streets
            </Button>
          </div>
        )}

        {/* Draw controls overlay */}
        {mapLoaded && (
          <div className="absolute top-4 left-14 flex gap-2">
            {bbox && (
              <Button size="sm" variant="secondary" onClick={handleDrawNew}>
                Redraw
              </Button>
            )}
            <Button
              size="sm"
              variant={showManualInput ? 'primary' : 'secondary'}
              onClick={() => setShowManualInput(!showManualInput)}
            >
              Coordinates
            </Button>
          </div>
        )}

        {/* Manual coordinate input panel */}
        {showManualInput && (
          <div className="absolute top-16 left-14 bg-geo-bg/95 backdrop-blur-sm border border-geo-border rounded-xl p-4 w-[280px] space-y-3 z-10">
            <h3 className="text-xs text-geo-text-muted uppercase tracking-wider">Enter Coordinates</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-geo-text-muted block mb-1">Center Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  placeholder="40.7128"
                  className="w-full px-2 py-1.5 text-xs font-mono bg-geo-surface border border-geo-border rounded-lg focus:border-geo-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-geo-text-muted block mb-1">Center Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  placeholder="-74.0060"
                  className="w-full px-2 py-1.5 text-xs font-mono bg-geo-surface border border-geo-border rounded-lg focus:border-geo-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-geo-text-muted block mb-1">Width (feet)</label>
                <input
                  type="number"
                  step="any"
                  value={manualWidth}
                  onChange={(e) => setManualWidth(e.target.value)}
                  placeholder="5000"
                  className="w-full px-2 py-1.5 text-xs font-mono bg-geo-surface border border-geo-border rounded-lg focus:border-geo-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-geo-text-muted block mb-1">Height (feet)</label>
                <input
                  type="number"
                  step="any"
                  value={manualHeight}
                  onChange={(e) => setManualHeight(e.target.value)}
                  placeholder="5000"
                  className="w-full px-2 py-1.5 text-xs font-mono bg-geo-surface border border-geo-border rounded-lg focus:border-geo-accent focus:outline-none"
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="primary"
              onClick={handleManualApply}
              disabled={!manualLat || !manualLng || !manualWidth || !manualHeight}
            >
              Apply Rectangle
            </Button>
          </div>
        )}

        {/* Bbox info overlay */}
        {bbox && (
          <div className="absolute bottom-4 left-4 bg-geo-bg/90 backdrop-blur-sm border border-geo-border rounded-xl p-4 min-w-[240px]">
            <h3 className="text-xs text-geo-text-muted uppercase tracking-wider mb-2">Selected Area</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-geo-text-muted text-xs">Width</div>
                <div className="font-mono font-semibold">{formatFeet(widthFeet)}</div>
              </div>
              <div>
                <div className="text-geo-text-muted text-xs">Height</div>
                <div className="font-mono font-semibold">{formatFeet(heightFeet)}</div>
              </div>
              <div>
                <div className="text-geo-text-muted text-xs">Area</div>
                <div className="font-mono font-semibold">{formatArea(areaSqFt)}</div>
              </div>
              <div>
                <div className="text-geo-text-muted text-xs">Metric</div>
                <div className="font-mono font-semibold">
                  {(areaSqFt / 10763910.4) < 1
                    ? `${(areaSqFt / 10.764).toFixed(0)} m²`
                    : `${(areaSqFt / 10763910.4).toFixed(1)} km²`
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions overlay */}
        {mapLoaded && !bbox && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-geo-bg/90 backdrop-blur-sm border border-geo-border rounded-xl px-6 py-3">
            <p className="text-sm text-geo-text-muted">
              Click two corners on the map to draw a rectangle, or use the Coordinates button for precise input
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
