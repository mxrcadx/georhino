'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/Button';
import type { BoundingBox } from '@/types/geo';
import type MapboxDrawType from '@mapbox/mapbox-gl-draw';

export function Step1SelectArea() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const drawRef = useRef<MapboxDrawType | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [baseLayer, setBaseLayer] = useState<'satellite' | 'streets'>('satellite');

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
        defaultMode: 'draw_polygon',
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
              <div className="col-span-2">
                <div className="text-geo-text-muted text-xs">Area</div>
                <div className="font-mono font-semibold">{formatArea(areaSqFt)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions overlay */}
        {mapLoaded && !bbox && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-geo-bg/90 backdrop-blur-sm border border-geo-border rounded-xl px-6 py-3">
            <p className="text-sm text-geo-text-muted">
              Draw a rectangle on the map to define your site area
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
