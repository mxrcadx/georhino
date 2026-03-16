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
//   Small  (< 100 km²)  → 30m (COP30 or SRTMGL1 for US)
//   Medium (< 2,500 km²) → 90m (COP90)
//   Large  (< 50,000 km²) → 90m (COP90) with warning
//   Huge   (≥ 50,000 km²) → blocked (too much data for browser)
//
// Pixel budget estimates at each tier:
//   100 km² @ 30m  ≈   110k pixels  — instant
//   2,500 km² @ 90m ≈   310k pixels — fast
//   50,000 km² @ 90m ≈ 6.2M pixels — slow but workable

const MAX_AREA_SQ_KM = 50_000;
const WARN_LARGE_SQ_KM = 2_500;
const WARN_MEDIUM_SQ_KM = 100;

function selectDemSource(bbox: BoundingBox): { source: DEMSource; resolution: string } {
  const centerLat = (bbox.north + bbox.south) / 2;
  const centerLng = (bbox.east + bbox.west) / 2;
  const areaSqKm = calcAreaSqKm(bbox);

  // Check if in continental US (SRTMGL1 has better accuracy there)
  const isUS = centerLat >= 24 && centerLat <= 50 && centerLng >= -125 && centerLng <= -66;

  if (areaSqKm < WARN_MEDIUM_SQ_KM) {
    // Small areas: use high-res 30m data
    if (isUS) {
      return { source: 'SRTMGL1', resolution: '~30m/pixel' };
    }
    return { source: 'COP30', resolution: '~30m/pixel' };
  }

  // Medium and large areas: use 90m data to keep pixel count manageable
  return { source: 'COP90', resolution: '~90m/pixel' };
}

// ─── Public helpers ──────────────────────────────────────────────

export function getAreaWarning(bbox: BoundingBox): string | null {
  const areaSqKm = calcAreaSqKm(bbox);

  if (areaSqKm > MAX_AREA_SQ_KM) {
    return `Selected area is ~${Math.round(areaSqKm).toLocaleString()} km² — exceeds the ${MAX_AREA_SQ_KM.toLocaleString()} km² maximum. Even at 90m resolution this would overwhelm the browser. Select a smaller region.`;
  }
  if (areaSqKm > WARN_LARGE_SQ_KM) {
    const { resolution } = selectDemSource(bbox);
    return `Large area (~${Math.round(areaSqKm).toLocaleString()} km²). Using ${resolution} resolution. Download and contour generation may take a while.`;
  }
  if (areaSqKm > WARN_MEDIUM_SQ_KM) {
    const { resolution } = selectDemSource(bbox);
    return `Using ${resolution} resolution for this area size (~${Math.round(areaSqKm).toLocaleString()} km²). Areas under 100 km² use higher 30m resolution.`;
  }
  return null;
}

export function getSelectedResolution(bbox: BoundingBox): string {
  const { resolution } = selectDemSource(bbox);
  return resolution;
}

// ─── Main fetch ──────────────────────────────────────────────────

export async function fetchElevationData(bbox: BoundingBox): Promise<ElevationResult> {
  const areaSqKm = calcAreaSqKm(bbox);

  // Pre-flight area check
  if (areaSqKm > MAX_AREA_SQ_KM) {
    throw new Error(
      `Area too large (~${Math.round(areaSqKm).toLocaleString()} km²). ` +
      `Maximum supported area is ~${MAX_AREA_SQ_KM.toLocaleString()} km². ` +
      `Select a smaller region.`
    );
  }

  const { source, resolution } = selectDemSource(bbox);

  const params = new URLSearchParams({
    south: String(bbox.south),
    north: String(bbox.north),
    west: String(bbox.west),
    east: String(bbox.east),
    demtype: source,
  });

  // Scale timeout with area — larger areas need more time
  // 90m data is ~9x smaller than 30m for the same area, but large areas still need time
  const timeoutMs = Math.min(300_000, 30_000 + Math.round(areaSqKm * 20));

  const response = await fetch(`/api/elevation?${params}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text();
    // Parse and provide user-friendly error messages
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

  // Calculate elevation range
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
    resolution: `${resolution} (${width}×${height} = ${(width * height / 1_000_000).toFixed(1)}M pixels)`,
    coverage: minElev < Infinity ? 'full' : 'none',
    minElevation: minElev === Infinity ? 0 : minElev,
    maxElevation: maxElev === -Infinity ? 0 : maxElev,
  };

  return { grid, metadata };
}
