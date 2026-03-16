import { NextRequest, NextResponse } from 'next/server';
import { sampleCesiumTerrain } from '@/lib/terrain/cesiumSampler';

export const maxDuration = 300; // 5 minute timeout for large areas (Vercel Pro)

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const south = searchParams.get('south');
  const north = searchParams.get('north');
  const west = searchParams.get('west');
  const east = searchParams.get('east');
  const resolution = searchParams.get('resolution');

  if (!south || !north || !west || !east) {
    return NextResponse.json({ error: 'Missing bbox parameters' }, { status: 400 });
  }

  const cesiumToken = process.env.CESIUM_ION_TOKEN;
  if (!cesiumToken) {
    return NextResponse.json(
      { error: 'Cesium ion token not configured. Add CESIUM_ION_TOKEN to .env.local' },
      { status: 500 }
    );
  }

  try {
    const result = await sampleCesiumTerrain({
      south: parseFloat(south),
      north: parseFloat(north),
      west: parseFloat(west),
      east: parseFloat(east),
      targetResolution: resolution ? parseFloat(resolution) : undefined,
      cesiumToken,
    });

    // Encode the Float32Array grid as base64 for JSON transport
    const gridBuffer = Buffer.from(result.grid.buffer);
    const gridBase64 = gridBuffer.toString('base64');

    return NextResponse.json({
      grid: gridBase64,
      width: result.width,
      height: result.height,
      minElevation: result.minElevation,
      maxElevation: result.maxElevation,
      resolution: result.resolution,
      zoomLevel: result.zoomLevel,
      tileCount: result.tileCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Cesium terrain error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
