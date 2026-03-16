import type { BoundingBox } from '@/types/geo';
import type { FeatureCollection } from 'geojson';
import type { LayerName } from '@/types/layers';
import { ARCH_COLORS } from './colors';
import { smoothFeatureCollection } from '@/lib/contour/smoother';

interface RenderOptions {
  bbox: BoundingBox;
  sheetWidthInches: number;
  sheetHeightInches: number;
  scale: number; // scale denominator in inches (e.g., 24000 means 1"=2000')
  enabledLayers: Record<LayerName, boolean>;
  contourLines: FeatureCollection | null;
  osmBuildings: FeatureCollection | null;
  osmRoads: FeatureCollection | null;
  osmWater: FeatureCollection | null;
  osmLanduse: FeatureCollection | null;
  osmInfra: FeatureCollection | null;
  smoothing: number;
}

/**
 * Convert lat/lng to feet relative to bbox center using equirectangular projection.
 */
function lngLatToFeet(
  lng: number,
  lat: number,
  centerLng: number,
  centerLat: number
): [number, number] {
  const DEG_TO_RAD = Math.PI / 180;
  const EARTH_RADIUS_FT = 20_902_231;

  const dLng = (lng - centerLng) * DEG_TO_RAD;
  const dLat = (lat - centerLat) * DEG_TO_RAD;

  const xFeet = EARTH_RADIUS_FT * dLng * Math.cos(centerLat * DEG_TO_RAD);
  const yFeet = EARTH_RADIUS_FT * dLat;

  return [xFeet, yFeet];
}

/**
 * Convert real-world feet to SVG pixels on the sheet.
 * Scale: 1 inch on paper = (scale / 12) feet in real world.
 */
function feetToSvg(
  xFeet: number,
  yFeet: number,
  scale: number,
  svgCenterX: number,
  svgCenterY: number,
  ppi: number
): [number, number] {
  const feetPerInch = scale / 12;
  const xInches = xFeet / feetPerInch;
  const yInches = yFeet / feetPerInch;

  // SVG: X increases right, Y increases DOWN (flip Y)
  const svgX = svgCenterX + xInches * ppi;
  const svgY = svgCenterY - yInches * ppi;

  return [svgX, svgY];
}

function coordsToPath(
  coords: number[][],
  centerLng: number,
  centerLat: number,
  scale: number,
  svgCenterX: number,
  svgCenterY: number,
  ppi: number,
  close = false
): string {
  if (!coords || coords.length === 0) return '';
  const points: string[] = [];
  for (const [lng, lat] of coords) {
    const [xFt, yFt] = lngLatToFeet(lng, lat, centerLng, centerLat);
    const [svgX, svgY] = feetToSvg(xFt, yFt, scale, svgCenterX, svgCenterY, ppi);
    points.push(`${svgX.toFixed(1)},${svgY.toFixed(1)}`);
  }
  return `M ${points.join(' L ')}${close ? ' Z' : ''}`;
}

function renderFeatures(
  fc: FeatureCollection | null,
  centerLng: number,
  centerLat: number,
  scale: number,
  svgCenterX: number,
  svgCenterY: number,
  ppi: number,
  stroke: string,
  strokeWidth: number,
  fill = 'none',
  close = false
): string {
  if (!fc) return '';
  let svg = '';
  for (const feature of fc.features) {
    const geom = feature.geometry;
    if (geom.type === 'LineString') {
      const d = coordsToPath(geom.coordinates, centerLng, centerLat, scale, svgCenterX, svgCenterY, ppi, close);
      if (d) svg += `<path d="${d}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" />\n`;
    } else if (geom.type === 'Polygon') {
      for (const ring of geom.coordinates) {
        const d = coordsToPath(ring, centerLng, centerLat, scale, svgCenterX, svgCenterY, ppi, true);
        if (d) svg += `<path d="${d}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="${fill}" />\n`;
      }
    } else if (geom.type === 'Point') {
      const [xFt, yFt] = lngLatToFeet(geom.coordinates[0], geom.coordinates[1], centerLng, centerLat);
      const [x, y] = feetToSvg(xFt, yFt, scale, svgCenterX, svgCenterY, ppi);
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="${stroke}" />\n`;
    }
  }
  return svg;
}

function niceRoundNumber(value: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

export function renderPreviewSvg(options: RenderOptions): string {
  const { bbox, sheetWidthInches, sheetHeightInches, scale, enabledLayers } = options;

  // SVG dimensions — 10 pixels per inch for nice rendering
  const ppi = 10;
  const svgW = sheetWidthInches * ppi;
  const svgH = sheetHeightInches * ppi;
  const margin = 15; // ~1.5" border in SVG pixels

  // Center of the sheet in SVG coords
  const svgCenterX = svgW / 2;
  const svgCenterY = svgH / 2;

  // Center of the bounding box in geographic coords
  const centerLng = (bbox.west + bbox.east) / 2;
  const centerLat = (bbox.south + bbox.north) / 2;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" height="100%">`;

  // Clip to sheet border so features don't bleed outside
  svg += `<defs><clipPath id="sheet-clip"><rect x="${margin}" y="${margin}" width="${svgW - margin * 2}" height="${svgH - margin * 2}" /></clipPath></defs>`;

  // Background
  svg += `<rect width="${svgW}" height="${svgH}" fill="${ARCH_COLORS.background}" />`;

  // Sheet border
  svg += `<rect x="${margin}" y="${margin}" width="${svgW - margin * 2}" height="${svgH - margin * 2}" fill="none" stroke="${ARCH_COLORS.sheetBorder}" stroke-width="0.5" />`;

  // Start clipped group
  svg += `<g clip-path="url(#sheet-clip)">`;

  // Land use (background)
  if (enabledLayers.landuse && options.osmLanduse) {
    svg += renderFeatures(options.osmLanduse, centerLng, centerLat, scale, svgCenterX, svgCenterY, ppi, ARCH_COLORS.landuse, 0.3, ARCH_COLORS.landuseFill, true);
  }

  // Water — split polygons (filled, closed) from linestrings (stroke only, open)
  if (enabledLayers.water && options.osmWater) {
    const waterPolygons: FeatureCollection = {
      type: 'FeatureCollection',
      features: options.osmWater.features.filter((f) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'),
    };
    const waterLines: FeatureCollection = {
      type: 'FeatureCollection',
      features: options.osmWater.features.filter((f) => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'),
    };
    svg += `<g opacity="0.25">`;
    // Polygons: closed + filled (lakes, ponds, reservoirs)
    svg += renderFeatures(waterPolygons, centerLng, centerLat, scale, svgCenterX, svgCenterY, ppi, ARCH_COLORS.water, 0.5, ARCH_COLORS.waterFill, true);
    // LineStrings: open stroke only (rivers, streams, canals)
    svg += renderFeatures(waterLines, centerLng, centerLat, scale, svgCenterX, svgCenterY, ppi, ARCH_COLORS.water, 0.5);
    svg += `</g>`;
  }

  // Contours — apply smoothing if set
  if (enabledLayers.contours && options.contourLines) {
    let contours = options.contourLines;
    if (options.smoothing > 0) {
      contours = smoothFeatureCollection(contours, options.smoothing);
    }
    const minorLines: FeatureCollection = {
      type: 'FeatureCollection',
      features: contours.features.filter((f) => !f.properties?.isMajor),
    };
    const majorLines: FeatureCollection = {
      type: 'FeatureCollection',
      features: contours.features.filter((f) => f.properties?.isMajor),
    };
    svg += renderFeatures(minorLines, centerLng, centerLat, scale, svgCenterX, svgCenterY, ppi, ARCH_COLORS.contourMinor, 0.3);
    svg += renderFeatures(majorLines, centerLng, centerLat, scale, svgCenterX, svgCenterY, ppi, ARCH_COLORS.contourMajor, 0.7);
  }

  // Roads
  if (enabledLayers.roads && options.osmRoads) {
    const highways: FeatureCollection = {
      type: 'FeatureCollection',
      features: options.osmRoads.features.filter((f) => f.properties?.roadClass === 'highway'),
    };
    const locals: FeatureCollection = {
      type: 'FeatureCollection',
      features: options.osmRoads.features.filter((f) => f.properties?.roadClass !== 'highway'),
    };
    svg += renderFeatures(locals, centerLng, centerLat, scale, svgCenterX, svgCenterY, ppi, ARCH_COLORS.roadLocal, 0.3);
    svg += renderFeatures(highways, centerLng, centerLat, scale, svgCenterX, svgCenterY, ppi, ARCH_COLORS.road, 0.6);
  }

  // Buildings
  if (enabledLayers.buildings && options.osmBuildings) {
    svg += `<g opacity="0.7">`;
    svg += renderFeatures(options.osmBuildings, centerLng, centerLat, scale, svgCenterX, svgCenterY, ppi, ARCH_COLORS.building, 0.4, '#E0E0E0', true);
    svg += `</g>`;
  }

  // Infrastructure
  if (enabledLayers.infrastructure && options.osmInfra) {
    svg += renderFeatures(options.osmInfra, centerLng, centerLat, scale, svgCenterX, svgCenterY, ppi, ARCH_COLORS.infrastructure, 0.4);
  }

  // End clipped group
  svg += `</g>`;

  // North arrow (top-right corner inside border)
  const naX = svgW - margin - 15;
  const naY = margin + 25;
  svg += `<g transform="translate(${naX},${naY})">`;
  svg += `<line x1="0" y1="10" x2="0" y2="-10" stroke="${ARCH_COLORS.text}" stroke-width="0.8" />`;
  svg += `<polygon points="-3,-5 0,-12 3,-5" fill="${ARCH_COLORS.text}" />`;
  svg += `<text x="0" y="18" text-anchor="middle" font-size="5" fill="${ARCH_COLORS.text}" font-family="Arial">N</text>`;
  svg += `</g>`;

  // Scale bar (bottom-left inside border)
  const sbX = margin + 10;
  const sbY = svgH - margin - 10;
  const feetPerInch = scale / 12;
  const barFeet = niceRoundNumber(feetPerInch * 2);
  const barInches = barFeet / feetPerInch;
  const barPx = barInches * ppi;
  svg += `<g transform="translate(${sbX},${sbY})">`;
  svg += `<line x1="0" y1="0" x2="${barPx.toFixed(1)}" y2="0" stroke="${ARCH_COLORS.text}" stroke-width="0.8" />`;
  svg += `<line x1="0" y1="-3" x2="0" y2="3" stroke="${ARCH_COLORS.text}" stroke-width="0.8" />`;
  svg += `<line x1="${barPx.toFixed(1)}" y1="-3" x2="${barPx.toFixed(1)}" y2="3" stroke="${ARCH_COLORS.text}" stroke-width="0.8" />`;
  svg += `<text x="${(barPx / 2).toFixed(1)}" y="-5" text-anchor="middle" font-size="4" fill="${ARCH_COLORS.text}" font-family="Arial">${barFeet.toLocaleString()}'</text>`;
  svg += `</g>`;

  svg += '</svg>';
  return svg;
}

