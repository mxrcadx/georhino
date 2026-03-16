/**
 * Cesium World Terrain sampler.
 *
 * Fetches quantized-mesh terrain tiles from Cesium ion, decodes them,
 * and builds a regular elevation grid for use with d3-contour.
 *
 * This runs server-side (API route) to keep the Cesium token secure
 * and avoid loading CesiumJS in the browser.
 */

import type { TileCoord } from './tilemath';
import { tilesInBbox, tileBounds, zoomForResolution } from './tilemath';
import { decodeQuantizedMesh, nearestVertexHeight, sampleHeight } from './quantizedMesh';

interface CesiumEndpoint {
  url: string;
  accessToken: string;
}

interface SamplerOptions {
  south: number;
  west: number;
  north: number;
  east: number;
  /** Target resolution in meters. Auto-selected if omitted. */
  targetResolution?: number;
  /** Cesium ion access token */
  cesiumToken: string;
}

export interface SamplerResult {
  /** Row-major elevation grid (south-to-north, west-to-east) */
  grid: Float32Array;
  width: number;
  height: number;
  minElevation: number;
  maxElevation: number;
  /** Actual resolution used, in meters */
  resolution: number;
  /** Zoom level used for tile fetching */
  zoomLevel: number;
  /** Number of tiles fetched */
  tileCount: number;
  /** Debug info */
  debug: string;
}

/**
 * Get the terrain tile endpoint URL from Cesium ion.
 * Asset ID 1 = Cesium World Terrain.
 */
async function getCesiumEndpoint(token: string): Promise<CesiumEndpoint> {
  const res = await fetch('https://api.cesium.com/v1/assets/1/endpoint', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cesium ion endpoint error (${res.status}): ${text}`);
  }
  const data = await res.json();

  if (!data.url || !data.accessToken) {
    throw new Error(`Cesium ion returned invalid endpoint: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return {
    url: data.url.replace(/\/$/, ''), // strip trailing slash
    accessToken: data.accessToken,
  };
}

/**
 * Fetch a single terrain tile from Cesium ion.
 * Returns the decoded mesh, or null if the tile doesn't exist.
 */
async function fetchTile(
  endpoint: CesiumEndpoint,
  tile: TileCoord
): Promise<ReturnType<typeof decodeQuantizedMesh> | null> {
  // Auth via query param (matching CesiumJS behavior — NOT Bearer header)
  const url = `${endpoint.url}/${tile.z}/${tile.x}/${tile.y}.terrain?v=1.2.0&access_token=${endpoint.accessToken}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.quantized-mesh;extensions=octvertexnormals-watermask-metadata,application/octet-stream;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
      },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      console.warn(`Cesium tile ${tile.z}/${tile.x}/${tile.y}: HTTP ${res.status}`);
      return null;
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 88) {
      console.warn(`Cesium tile ${tile.z}/${tile.x}/${tile.y}: too small (${buffer.byteLength} bytes)`);
      return null;
    }

    return decodeQuantizedMesh(buffer);
  } catch (err) {
    console.warn(`Cesium tile ${tile.z}/${tile.x}/${tile.y} error:`, err);
    return null;
  }
}

/**
 * Choose target resolution based on area size.
 */
function autoResolution(areaSqKm: number): number {
  if (areaSqKm < 500) return 90;        // Small-medium: ~90m (same as COP90)
  if (areaSqKm < 5_000) return 200;     // Large: ~200m
  if (areaSqKm < 50_000) return 500;    // Very large: ~500m
  if (areaSqKm < 200_000) return 1000;  // Country-scale: ~1km
  return 2000;                           // Continent-scale: ~2km
}

/**
 * Sample the Cesium World Terrain across a bounding box,
 * producing a regular elevation grid suitable for d3-contour.
 */
export async function sampleCesiumTerrain(opts: SamplerOptions): Promise<SamplerResult> {
  const { south, west, north, east, cesiumToken } = opts;

  // Calculate area
  const centerLat = (south + north) / 2;
  const latDist = (north - south) * 111.32;
  const lngDist = (east - west) * 111.32 * Math.cos(centerLat * Math.PI / 180);
  const areaSqKm = latDist * lngDist;

  const targetRes = opts.targetResolution ?? autoResolution(areaSqKm);

  // Determine zoom level and grid dimensions
  const zoom = zoomForResolution(targetRes, centerLat);

  // Calculate grid dimensions based on target resolution
  const gridWidth = Math.max(10, Math.min(4000, Math.ceil(lngDist * 1000 / targetRes)));
  const gridHeight = Math.max(10, Math.min(4000, Math.ceil(latDist * 1000 / targetRes)));

  // Get Cesium endpoint
  const endpoint = await getCesiumEndpoint(cesiumToken);
  const debugLines: string[] = [];
  debugLines.push(`endpoint=${endpoint.url}`);

  // Determine which tiles we need
  const tiles = tilesInBbox(south, west, north, east, zoom);
  debugLines.push(`tiles=${tiles.length} z=${zoom}`);

  if (tiles.length > 0) {
    const f = tiles[0];
    debugLines.push(`first=${f.z}/${f.x}/${f.y}`);
  }

  if (tiles.length > 500) {
    throw new Error(
      `Too many terrain tiles needed (${tiles.length}). ` +
      `Try a smaller area or lower resolution.`
    );
  }

  // Fetch all tiles with concurrency limit
  const CONCURRENCY = 6;
  const tileCache = new Map<string, ReturnType<typeof decodeQuantizedMesh> | null>();
  let fetchErrors = 0;

  for (let i = 0; i < tiles.length; i += CONCURRENCY) {
    const batch = tiles.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (tile) => {
        const key = `${tile.z}/${tile.x}/${tile.y}`;
        const mesh = await fetchTile(endpoint, tile);
        if (!mesh) fetchErrors++;
        return { key, mesh };
      })
    );
    for (const { key, mesh } of results) {
      tileCache.set(key, mesh);
    }
  }

  debugLines.push(`errors=${fetchErrors}/${tiles.length}`);

  // Build the elevation grid by sampling each point
  const grid = new Float32Array(gridWidth * gridHeight);
  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let row = 0; row < gridHeight; row++) {
    // Row 0 = south, row (gridHeight-1) = north
    const lat = south + (row / (gridHeight - 1)) * (north - south);

    for (let col = 0; col < gridWidth; col++) {
      const lon = west + (col / (gridWidth - 1)) * (east - west);

      // Find which tile contains this point
      const tileCoord = findTile(lat, lon, zoom);
      const key = `${tileCoord.z}/${tileCoord.x}/${tileCoord.y}`;
      const mesh = tileCache.get(key);

      let elev = 0;
      if (mesh) {
        // Convert lat/lon to normalized [0,1] within this tile
        const bounds = tileBounds(tileCoord);
        const normU = (lon - bounds.west) / (bounds.east - bounds.west);
        const normV = (lat - bounds.south) / (bounds.north - bounds.south);

        // Try precise interpolation first, fall back to nearest vertex
        const precise = sampleHeight(mesh, normU, normV);
        elev = precise ?? nearestVertexHeight(mesh, normU, normV);
      }

      grid[row * gridWidth + col] = elev;
      if (elev < minElev) minElev = elev;
      if (elev > maxElev) maxElev = elev;
    }
  }

  let actualTiles = 0;
  tileCache.forEach((v) => { if (v) actualTiles++; });

  return {
    grid,
    width: gridWidth,
    height: gridHeight,
    minElevation: minElev === Infinity ? 0 : minElev,
    maxElevation: maxElev === -Infinity ? 0 : maxElev,
    resolution: targetRes,
    zoomLevel: zoom,
    tileCount: actualTiles,
    debug: debugLines.join('; '),
  };
}

/**
 * Find tile coordinates for a point (same as latLonToTile but inline).
 */
function findTile(lat: number, lon: number, z: number): TileCoord {
  const tilesX = Math.pow(2, z + 1);
  const tilesY = Math.pow(2, z);
  const normLon = ((lon + 180) % 360 + 360) % 360;
  const normLat = lat + 90;
  let x = Math.floor(normLon / 360 * tilesX);
  let y = Math.floor(normLat / 180 * tilesY);
  x = Math.max(0, Math.min(tilesX - 1, x));
  y = Math.max(0, Math.min(tilesY - 1, y));
  return { z, x, y };
}
