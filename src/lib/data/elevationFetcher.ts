import type { BoundingBox } from '@/types/geo';
import type { ElevationGrid, DEMSource, DEMMetadata } from '@/types/dem';
import { fromArrayBuffer } from 'geotiff';

interface ElevationResult {
  grid: ElevationGrid;
  metadata: DEMMetadata;
}

// ─── Area calculation ────────────────────────────────────────────

function calcAreaSqKm(bbox: BoundingBox): number {
  const centerLat = (bbox.north + bbox.south) / 2;
  const latDist = (bbox.north - bbox.south) * 111.32;
  const lngDist = (bbox.east - bbox.west) * 111.32 * Math.cos(centerLat * Math.PI / 180);
  return latDist * lngDist;
}

// ─── Adaptive DEM source selection ───────────────────────────────
//
// Resolution tiers:
//   Small  (< 100 km²)    → 30m  (COP30 / SRTMGL1) via OpenTopography
//   Medium (< 2,500 km²)  → 90m  (COP90) via OpenTopography
//   Large  (< 50,000 km²) → 90m  (COP90) via OpenTopography
//   Huge   (≥ 50,000 km²) → adaptive (Cesium World Terrain)
//
// Cesium World Terrain auto-selects resolution based on area:
//   50k–200k km²  → ~500m–1km
//   200k+ km²     → ~2km

/** Max area for OpenTopography path */
const OPENTOPO_MAX_SQ_KM = 50_000;
/** Max area overall (Cesium can handle very large areas) */
const ABSOLUTE_MAX_SQ_KM = 1_000_000;
/** Warning thresholds */
const WARN_LARGE_SQ_KM = 2_500;
const WARN_MEDIUM_SQ_KM = 100;

type SourceSelection = {
  source: DEMSource;
  resolution: string;
  backend: 'opentopo' | 'cesium';
};

function selectDemSource(bbox: BoundingBox): SourceSelection {
  const centerLat = (bbox.north + bbox.south) / 2;
  const centerLng = (bbox.east + bbox.west) / 2;
  const areaSqKm = calcAreaSqKm(bbox);

  const isUS = centerLat >= 24 && centerLat <= 50 && centerLng >= -125 && centerLng <= -66;

  // Large areas → Cesium World Terrain
  if (areaSqKm >= OPENTOPO_MAX_SQ_KM) {
    let resLabel: string;
    if (areaSqKm < 200_000) resLabel = '~500m–1km';
    else resLabel = '~1–2km';
    return {
      source: 'CesiumWorldTerrain',
      resolution: resLabel,
      backend: 'cesium',
    };
  }

  // Small areas → 30m
  if (areaSqKm < WARN_MEDIUM_SQ_KM) {
    if (isUS) {
      return { source: 'SRTMGL1', resolution: '~30m', backend: 'opentopo' };
    }
    return { source: 'COP30', resolution: '~30m', backend: 'opentopo' };
  }

  // Medium/large → 90m
  return { source: 'COP90', resolution: '~90m', backend: 'opentopo' };
}

// ─── Public helpers ──────────────────────────────────────────────

export function getAreaWarning(bbox: BoundingBox): string | null {
  const areaSqKm = calcAreaSqKm(bbox);

  if (areaSqKm > ABSOLUTE_MAX_SQ_KM) {
    return `Selected area is ~${Math.round(areaSqKm).toLocaleString()} km² — exceeds the 1,000,000 km² maximum. Select a smaller region.`;
  }

  const { resolution, backend } = selectDemSource(bbox);

  if (areaSqKm > OPENTOPO_MAX_SQ_KM) {
    return `Very large area (~${Math.round(areaSqKm).toLocaleString()} km²). Using Cesium World Terrain at ${resolution} resolution. This may take 1–3 minutes.`;
  }
  if (areaSqKm > WARN_LARGE_SQ_KM) {
    return `Large area (~${Math.round(areaSqKm).toLocaleString()} km²). Using ${backend === 'cesium' ? 'Cesium World Terrain' : 'OpenTopography'} at ${resolution}. Download may take a while.`;
  }
  if (areaSqKm > WARN_MEDIUM_SQ_KM) {
    return `Using ${resolution} resolution for this area size (~${Math.round(areaSqKm).toLocaleString()} km²). Areas under 100 km² use higher 30m resolution.`;
  }
  return null;
}

export function getSelectedResolution(bbox: BoundingBox): string {
  const { resolution, backend } = selectDemSource(bbox);
  const prefix = backend === 'cesium' ? 'Cesium ' : '';
  return `${prefix}${resolution}`;
}

// ─── Cesium fetch path ───────────────────────────────────────────

async function fetchViaCesium(bbox: BoundingBox): Promise<ElevationResult> {
  const areaSqKm = calcAreaSqKm(bbox);
  const { resolution } = selectDemSource(bbox);

  const params = new URLSearchParams({
    south: String(bbox.south),
    north: String(bbox.north),
    west: String(bbox.west),
    east: String(bbox.east),
  });

  // Scale timeout: 30s base + area-proportional
  const timeoutMs = Math.min(600_000, 60_000 + Math.round(areaSqKm * 2));

  const response = await fetch(`/api/elevation/cesium?${params}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.error || text);
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message !== text) throw parseErr;
      throw new Error(`Cesium API error (${response.status}): ${text.slice(0, 200)}`);
    }
  }

  const data = await response.json();

  // Decode the base64 grid back to Float32Array
  const binaryStr = atob(data.grid);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const elevationData = new Float32Array(bytes.buffer);

  const grid: ElevationGrid = {
    data: elevationData,
    width: data.width,
    height: data.height,
    bbox: {
      west: bbox.west,
      south: bbox.south,
      east: bbox.east,
      north: bbox.north,
    },
    noDataValue: -9999,
    resolution: data.resolution,
    source: 'CesiumWorldTerrain',
  };

  const metadata: DEMMetadata = {
    source: 'CesiumWorldTerrain',
    resolution: `Cesium ${resolution} (${data.width}x${data.height} grid, ${data.tileCount} tiles @ z${data.zoomLevel})`,
    coverage: data.minElevation < Infinity ? 'full' : 'none',
    minElevation: data.minElevation,
    maxElevation: data.maxElevation,
  };

  return { grid, metadata };
}

// ─── OpenTopography fetch path ───────────────────────────────────

async function fetchViaOpenTopo(bbox: BoundingBox): Promise<ElevationResult> {
  const areaSqKm = calcAreaSqKm(bbox);
  const { source, resolution } = selectDemSource(bbox);

  const params = new URLSearchParams({
    south: String(bbox.south),
    north: String(bbox.north),
    west: String(bbox.west),
    east: String(bbox.east),
    demtype: source,
  });

  const timeoutMs = Math.min(300_000, 30_000 + Math.round(areaSqKm * 20));

  const response = await fetch(`/api/elevation?${params}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      const apiError = json.error || text;
      if (apiError.includes('timed out') || apiError.includes('timeout') || apiError.includes('operation w')) {
        throw new Error(
          `Request timed out. The selected area (~${Math.round(areaSqKm).toLocaleString()} km²) may be too large for the ${source} dataset. Try a smaller area.`
        );
      }
      throw new Error(apiError);
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message !== text) throw parseErr;
      throw new Error(`Elevation API error (${response.status}): ${text.slice(0, 200)}`);
    }
  }

  const arrayBuffer = await response.arrayBuffer();
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();
  const rasters = await image.readRasters();
  const elevationData = rasters[0] as Float32Array;
  const tiffBbox = image.getBoundingBox();

  const fileDir = image.getFileDirectory();
  const noDataValue = fileDir.GDAL_NODATA
    ? parseFloat(fileDir.GDAL_NODATA as string)
    : -9999;

  let minElev = Infinity;
  let maxElev = -Infinity;
  for (let i = 0; i < elevationData.length; i++) {
    const v = elevationData[i];
    if (v !== noDataValue && isFinite(v)) {
      if (v < minElev) minElev = v;
      if (v > maxElev) maxElev = v;
    }
  }

  const grid: ElevationGrid = {
    data: elevationData,
    width,
    height,
    bbox: {
      west: tiffBbox[0],
      south: tiffBbox[1],
      east: tiffBbox[2],
      north: tiffBbox[3],
    },
    noDataValue,
    resolution: source === 'COP90' || source === 'SRTMGL3' ? 90 : 30,
    source,
  };

  const metadata: DEMMetadata = {
    source,
    resolution: `${resolution} (${width}x${height} = ${(width * height / 1_000_000).toFixed(1)}M pixels)`,
    coverage: minElev < Infinity ? 'full' : 'none',
    minElevation: minElev === Infinity ? 0 : minElev,
    maxElevation: maxElev === -Infinity ? 0 : maxElev,
  };

  return { grid, metadata };
}

// ─── Main entry point ────────────────────────────────────────────

export async function fetchElevationData(bbox: BoundingBox): Promise<ElevationResult> {
  const areaSqKm = calcAreaSqKm(bbox);

  if (areaSqKm > ABSOLUTE_MAX_SQ_KM) {
    throw new Error(
      `Area too large (~${Math.round(areaSqKm).toLocaleString()} km²). ` +
      `Maximum supported area is ~1,000,000 km². Select a smaller region.`
    );
  }

  const { backend } = selectDemSource(bbox);

  if (backend === 'cesium') {
    return fetchViaCesium(bbox);
  }

  return fetchViaOpenTopo(bbox);
}
