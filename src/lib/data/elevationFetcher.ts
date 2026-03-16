import type { BoundingBox } from '@/types/geo';
import type { ElevationGrid, DEMSource, DEMMetadata } from '@/types/dem';
import { fromArrayBuffer } from 'geotiff';

interface ElevationResult {
  grid: ElevationGrid;
  metadata: DEMMetadata;
}

function selectDemSource(bbox: BoundingBox): { source: DEMSource; resolution: string } {
  const centerLat = (bbox.north + bbox.south) / 2;
  const centerLng = (bbox.east + bbox.west) / 2;

  // Check if in continental US
  const isUS = centerLat >= 24 && centerLat <= 50 && centerLng >= -125 && centerLng <= -66;

  // Estimate area in km²
  const latDist = (bbox.north - bbox.south) * 111.32;
  const lngDist = (bbox.east - bbox.west) * 111.32 * Math.cos(centerLat * Math.PI / 180);
  const areaSqKm = latDist * lngDist;

  if (isUS && areaSqKm < 100) {
    return { source: 'SRTMGL1', resolution: '~30m/pixel' };
  }
  return { source: 'COP30', resolution: '~30m/pixel' };
}

export async function fetchElevationData(bbox: BoundingBox): Promise<ElevationResult> {
  const { source, resolution } = selectDemSource(bbox);

  const params = new URLSearchParams({
    south: String(bbox.south),
    north: String(bbox.north),
    west: String(bbox.west),
    east: String(bbox.east),
    demtype: source,
  });

  const response = await fetch(`/api/elevation?${params}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch elevation data: ${text}`);
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
    resolution: parseFloat(resolution) || 30,
    source,
  };

  const metadata: DEMMetadata = {
    source,
    resolution,
    coverage: minElev < Infinity ? 'full' : 'none',
    minElevation: minElev === Infinity ? 0 : minElev,
    maxElevation: maxElev === -Infinity ? 0 : maxElev,
  };

  return { grid, metadata };
}
