/**
 * Minimal quantized-mesh decoder.
 *
 * Spec: https://github.com/CesiumGS/quantized-mesh
 *
 * Each tile is a binary blob encoding a triangulated irregular network (TIN)
 * with vertex positions (u, v, height) quantized to uint16 [0..32767].
 *
 * We only need the vertex data + triangle indices to interpolate heights
 * at arbitrary lat/lon points within the tile.
 */

export interface DecodedMesh {
  /** Quantized U values [0..32767] mapping to tile's west..east */
  u: Uint16Array;
  /** Quantized V values [0..32767] mapping to tile's south..north */
  v: Uint16Array;
  /** Quantized height values [0..32767] mapping to minHeight..maxHeight */
  height: Uint16Array;
  /** Triangle indices (triplets) */
  indices: Uint16Array | Uint32Array;
  /** Minimum height in meters */
  minHeight: number;
  /** Maximum height in meters */
  maxHeight: number;
  /** Number of vertices */
  vertexCount: number;
  /** Number of triangles */
  triangleCount: number;
}

/**
 * Decode a quantized-mesh terrain tile from an ArrayBuffer.
 */
export function decodeQuantizedMesh(buffer: ArrayBuffer): DecodedMesh {
  const view = new DataView(buffer);
  let offset = 0;

  // ─── Header (88 bytes) ───
  // centerX, centerY, centerZ: 3 × float64 = 24 bytes
  offset += 24;

  // minimumHeight, maximumHeight: 2 × float32
  const minHeight = view.getFloat32(offset, true); offset += 4;
  const maxHeight = view.getFloat32(offset, true); offset += 4;

  // boundingSphere: centerX, centerY, centerZ, radius: 4 × float64 = 32 bytes
  offset += 32;

  // horizonOcclusionPoint: x, y, z: 3 × float64 = 24 bytes
  offset += 24;

  // Total header: 24 + 8 + 32 + 24 = 88 bytes
  // offset should be 88 here

  // ─── Vertex data ───
  const vertexCount = view.getUint32(offset, true); offset += 4;

  // Determine encoding size: uint16 if vertexCount <= 65536, else uint32
  const use32bit = vertexCount > 65536;
  const bytesPerVertex = use32bit ? 4 : 2;

  // u, v, height arrays are delta + zigzag encoded
  const u = new Uint16Array(vertexCount);
  const v = new Uint16Array(vertexCount);
  const height = new Uint16Array(vertexCount);

  // Decode u values (delta + zigzag)
  let accum = 0;
  for (let i = 0; i < vertexCount; i++) {
    const encoded = use32bit
      ? view.getUint32(offset, true)
      : view.getUint16(offset, true);
    offset += bytesPerVertex;
    // Zigzag decode: (encoded >>> 1) ^ -(encoded & 1)
    const delta = (encoded >>> 1) ^ -(encoded & 1);
    accum += delta;
    u[i] = accum;
  }

  // Decode v values
  accum = 0;
  for (let i = 0; i < vertexCount; i++) {
    const encoded = use32bit
      ? view.getUint32(offset, true)
      : view.getUint16(offset, true);
    offset += bytesPerVertex;
    const delta = (encoded >>> 1) ^ -(encoded & 1);
    accum += delta;
    v[i] = accum;
  }

  // Decode height values
  accum = 0;
  for (let i = 0; i < vertexCount; i++) {
    const encoded = use32bit
      ? view.getUint32(offset, true)
      : view.getUint16(offset, true);
    offset += bytesPerVertex;
    const delta = (encoded >>> 1) ^ -(encoded & 1);
    accum += delta;
    height[i] = accum;
  }

  // ─── Index data ───
  // Align to appropriate boundary
  if (use32bit) {
    // Align to 4-byte boundary
    if (offset % 4 !== 0) offset += 4 - (offset % 4);
  } else {
    // Align to 2-byte boundary
    if (offset % 2 !== 0) offset += 1;
  }

  const triangleCount = view.getUint32(offset, true); offset += 4;
  const indexCount = triangleCount * 3;

  const indices = use32bit
    ? new Uint32Array(indexCount)
    : new Uint16Array(indexCount);

  // Indices are delta-encoded with "high water mark" encoding
  let highest = 0;
  for (let i = 0; i < indexCount; i++) {
    const code = use32bit
      ? view.getUint32(offset, true)
      : view.getUint16(offset, true);
    offset += bytesPerVertex;
    indices[i] = highest - code;
    if (code === 0) {
      highest++;
    }
  }

  return {
    u,
    v,
    height,
    indices,
    minHeight,
    maxHeight,
    vertexCount,
    triangleCount,
  };
}

/**
 * Sample height at a point (normU, normV) in [0..1] within a decoded mesh.
 * Uses barycentric interpolation within the triangle containing the point.
 * Returns height in meters, or null if the point is outside all triangles.
 */
export function sampleHeight(
  mesh: DecodedMesh,
  normU: number,
  normV: number
): number | null {
  const MAX_Q = 32767;
  const qu = normU * MAX_Q;
  const qv = normV * MAX_Q;

  // Search through triangles to find one containing (qu, qv)
  for (let t = 0; t < mesh.triangleCount; t++) {
    const i0 = mesh.indices[t * 3];
    const i1 = mesh.indices[t * 3 + 1];
    const i2 = mesh.indices[t * 3 + 2];

    const u0 = mesh.u[i0], v0 = mesh.v[i0], h0 = mesh.height[i0];
    const u1 = mesh.u[i1], v1 = mesh.v[i1], h1 = mesh.height[i1];
    const u2 = mesh.u[i2], v2 = mesh.v[i2], h2 = mesh.height[i2];

    // Barycentric coordinates
    const denom = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2);
    if (Math.abs(denom) < 1e-10) continue; // degenerate triangle

    const lambda1 = ((v1 - v2) * (qu - u2) + (u2 - u1) * (qv - v2)) / denom;
    const lambda2 = ((v2 - v0) * (qu - u2) + (u0 - u2) * (qv - v2)) / denom;
    const lambda3 = 1 - lambda1 - lambda2;

    // Allow small tolerance for edge cases
    const EPS = -0.001;
    if (lambda1 >= EPS && lambda2 >= EPS && lambda3 >= EPS) {
      // Interpolate quantized height
      const qHeight = lambda1 * h0 + lambda2 * h1 + lambda3 * h2;
      // De-quantize to meters
      return mesh.minHeight + (qHeight / MAX_Q) * (mesh.maxHeight - mesh.minHeight);
    }
  }

  return null;
}

/**
 * Fast nearest-vertex height lookup (no triangle search).
 * Much faster than sampleHeight for building coarse grids.
 */
export function nearestVertexHeight(
  mesh: DecodedMesh,
  normU: number,
  normV: number
): number {
  const MAX_Q = 32767;
  const qu = normU * MAX_Q;
  const qv = normV * MAX_Q;

  let bestDist = Infinity;
  let bestHeight = 0;

  for (let i = 0; i < mesh.vertexCount; i++) {
    const du = mesh.u[i] - qu;
    const dv = mesh.v[i] - qv;
    const dist = du * du + dv * dv;
    if (dist < bestDist) {
      bestDist = dist;
      bestHeight = mesh.height[i];
    }
  }

  return mesh.minHeight + (bestHeight / MAX_Q) * (mesh.maxHeight - mesh.minHeight);
}
