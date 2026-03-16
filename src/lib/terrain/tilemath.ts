/**
 * TMS / Slippy-map tile math for Cesium World Terrain.
 *
 * Cesium terrain tiles use TMS (y-flipped) addressing:
 *   z = zoom level
 *   x = column (0 at -180, increases east)
 *   y = row   (0 at -90 in TMS, 0 at +90 in slippy)
 *
 * At zoom z the world is 2^z tiles wide and 2^z tiles tall (WebMercator)
 * but Cesium terrain uses geodetic (EPSG:4326) tiling:
 *   - 2 tiles wide x 1 tile tall at level 0
 *   - 2^(z+1) tiles wide x 2^z tiles tall at level z
 */

export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

export interface TileBounds {
  west: number;   // degrees
  south: number;
  east: number;
  north: number;
}

/**
 * Convert lat/lon to a geodetic tile coordinate at the given zoom level.
 * Uses Cesium's geodetic (EPSG:4326) tiling scheme:
 *   - Level 0 has 2 tiles in X and 1 tile in Y
 *   - Level z has 2^(z+1) tiles in X and 2^z tiles in Y
 *   - Y=0 is at the south pole (TMS convention)
 */
export function latLonToTile(lat: number, lon: number, z: number): TileCoord {
  const tilesX = Math.pow(2, z + 1); // 2^(z+1) columns
  const tilesY = Math.pow(2, z);      // 2^z rows

  // Normalize longitude to [0, 360) and latitude to [0, 180)
  const normLon = ((lon + 180) % 360 + 360) % 360; // 0..360
  const normLat = lat + 90; // 0..180 (south pole = 0)

  let x = Math.floor(normLon / 360 * tilesX);
  let y = Math.floor(normLat / 180 * tilesY);

  // Clamp to valid range
  x = Math.max(0, Math.min(tilesX - 1, x));
  y = Math.max(0, Math.min(tilesY - 1, y));

  return { z, x, y };
}

/**
 * Get the geographic bounds of a tile.
 */
export function tileBounds(tile: TileCoord): TileBounds {
  const tilesX = Math.pow(2, tile.z + 1);
  const tilesY = Math.pow(2, tile.z);

  const tileWidthDeg = 360 / tilesX;
  const tileHeightDeg = 180 / tilesY;

  return {
    west: -180 + tile.x * tileWidthDeg,
    south: -90 + tile.y * tileHeightDeg,
    east: -180 + (tile.x + 1) * tileWidthDeg,
    north: -90 + (tile.y + 1) * tileHeightDeg,
  };
}

/**
 * Enumerate all tiles covering a bounding box at a given zoom level.
 */
export function tilesInBbox(
  south: number,
  west: number,
  north: number,
  east: number,
  z: number
): TileCoord[] {
  const sw = latLonToTile(south, west, z);
  const ne = latLonToTile(north, east, z);

  const tiles: TileCoord[] = [];
  // Y goes from south (low) to north (high) in TMS
  for (let y = sw.y; y <= ne.y; y++) {
    for (let x = sw.x; x <= ne.x; x++) {
      tiles.push({ z, x, y });
    }
  }
  return tiles;
}

/**
 * Choose an appropriate zoom level for a target ground resolution (meters).
 * At zoom z, a geodetic tile spans 180/2^z degrees of latitude.
 * 1 degree of latitude ≈ 111,320 meters.
 *
 * Returns a zoom level where each tile has ~65 vertices spanning
 * the tile width, giving per-vertex spacing close to targetMeters.
 */
export function zoomForResolution(targetMeters: number, centerLat: number): number {
  // Each quantized-mesh tile has 65 vertices across (roughly)
  const VERTICES_PER_TILE = 65;

  for (let z = 0; z <= 15; z++) {
    const tilesY = Math.pow(2, z);
    const tileDegLat = 180 / tilesY;
    const tileMetersLat = tileDegLat * 111_320;
    const vertexSpacing = tileMetersLat / VERTICES_PER_TILE;

    if (vertexSpacing <= targetMeters) {
      return z;
    }
  }
  return 15;
}
