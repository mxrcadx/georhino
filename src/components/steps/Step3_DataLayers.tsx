'use client';

import { useCallback } from 'react';
import { useAppStore } from '@/store';
import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LAYER_DEFINITIONS } from '@/lib/constants/layerDefinitions';
import type { LayerName } from '@/types/layers';
import { fetchOsmData } from '@/lib/data/osmFetcher';
import { fetchElevationData } from '@/lib/data/elevationFetcher';

export function Step3DataLayers() {
  const bbox = useAppStore((s) => s.bbox);
  const enabledLayers = useAppStore((s) => s.enabledLayers);
  const fetchStatus = useAppStore((s) => s.fetchStatus);
  const fetchErrors = useAppStore((s) => s.fetchErrors);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const setFetchStatus = useAppStore((s) => s.setFetchStatus);
  const setOsmData = useAppStore((s) => s.setOsmData);
  const setElevationGrid = useAppStore((s) => s.setElevationGrid);

  const fetchLayer = useCallback(async (name: LayerName) => {
    if (!bbox) return;
    setFetchStatus(name, 'fetching');

    try {
      if (name === 'contours') {
        const result = await fetchElevationData(bbox);
        setElevationGrid(result.grid, result.metadata);
        setFetchStatus(name, 'success');
      } else {
        const data = await fetchOsmData(name, bbox);
        if (data.features.length === 0) {
          setFetchStatus(name, 'no-data');
        } else {
          setOsmData(name, data);
          setFetchStatus(name, 'success');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      setFetchStatus(name, 'error', message);
    }
  }, [bbox, setFetchStatus, setOsmData, setElevationGrid]);

  const fetchAllEnabled = useCallback(async () => {
    const layers = Object.entries(enabledLayers)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name as LayerName);

    await Promise.allSettled(layers.map((name) => fetchLayer(name)));
  }, [enabledLayers, fetchLayer]);

  const getStatusBadge = (name: LayerName) => {
    const status = fetchStatus[name];
    const error = fetchErrors[name];

    switch (status) {
      case 'idle': return null;
      case 'fetching': return <Badge variant="info">Loading...</Badge>;
      case 'success': return <Badge variant="success">Ready</Badge>;
      case 'no-data': return <Badge variant="warning">No data</Badge>;
      case 'error': {
        const msg = error || 'Error';
        const truncated = msg.length > 60 ? msg.slice(0, 57) + '...' : msg;
        return <Badge variant="error" title={msg}>{truncated}</Badge>;
      }
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold mb-1">Data Layers</h2>
            <p className="text-sm text-geo-text-muted">
              Select which layers to include in your site file. Each layer is fetched from free public APIs.
            </p>
          </div>
          <Button onClick={fetchAllEnabled} disabled={!bbox}>
            Fetch All Data
          </Button>
        </div>

        <div className="space-y-3">
          {LAYER_DEFINITIONS.map((layer) => (
            <Card key={layer.name} className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <span className="text-lg w-6 text-center">{layer.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{layer.label}</h3>
                    {getStatusBadge(layer.name)}
                  </div>
                  <p className="text-xs text-geo-text-muted mt-0.5">{layer.description}</p>
                  <p className="text-[10px] text-geo-text-muted/60 mt-0.5">Source: {layer.source}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                {enabledLayers[layer.name] && fetchStatus[layer.name] === 'idle' && bbox && (
                  <Button size="sm" variant="ghost" onClick={() => fetchLayer(layer.name)}>
                    Fetch
                  </Button>
                )}
                {enabledLayers[layer.name] && fetchStatus[layer.name] === 'error' && bbox && (
                  <Button size="sm" variant="ghost" onClick={() => fetchLayer(layer.name)}>
                    Retry
                  </Button>
                )}
                <Toggle
                  checked={enabledLayers[layer.name]}
                  onChange={() => toggleLayer(layer.name)}
                />
              </div>
            </Card>
          ))}
        </div>

        {/* DXF Layer mapping info */}
        <Card>
          <h3 className="text-sm font-medium mb-3">Export Layer Names</h3>
          <p className="text-xs text-geo-text-muted mb-3">
            Each data type maps to named layers in the output file following architectural conventions.
          </p>
          <div className="grid grid-cols-2 gap-1 text-xs font-mono">
            {LAYER_DEFINITIONS.filter((l) => enabledLayers[l.name]).flatMap((l) =>
              l.dxfLayers.map((dxf) => (
                <div key={dxf} className="flex items-center gap-2 py-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  <span className="text-geo-text-muted">{dxf}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
