import type { AppStore } from '@/store';
import type { FeatureCollection } from 'geojson';
import { createProjector, projectFeatureCollection } from '@/lib/geo/projection';
import { smoothFeatureCollection } from '@/lib/contour/smoother';
import { renderPreviewSvg } from '@/lib/preview/renderer';
import { DxfWriter } from './dxf/DxfWriter';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Yield to the browser so the page stays responsive during heavy work */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function generateDxf(
  state: AppStore,
  projector: ReturnType<typeof createProjector>,
  setProgress: (p: number) => void
): Promise<Blob> {
  const writer = new DxfWriter();

  // ── Stage 1: Smooth contours (heaviest CPU work) ──
  setProgress(15);
  let contours = state.contourLines;
  if (contours && state.smoothing > 0) {
    contours = smoothFeatureCollection(contours, state.smoothing);
  }
  await yieldToMain();

  // ── Stage 2: Project each data layer (proj4 per coordinate) ──
  setProgress(25);
  const projectedContours = projectFeatureCollection(contours, projector);
  await yieldToMain();

  setProgress(30);
  const projectedBuildings = projectFeatureCollection(state.osmBuildings, projector);
  const projectedRoads = projectFeatureCollection(state.osmRoads, projector);
  await yieldToMain();

  setProgress(35);
  const projectedWater = projectFeatureCollection(state.osmWater, projector);
  const projectedLanduse = projectFeatureCollection(state.osmLanduse, projector);
  const projectedInfra = projectFeatureCollection(state.osmInfra, projector);
  await yieldToMain();

  // ── Stage 3: Build DXF entities in batches ──
  const BATCH_SIZE = 50; // yield every 50 features

  // Contour lines
  if (projectedContours && state.enabledLayers.contours) {
    const features = projectedContours.features;
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      if (feature.geometry.type !== 'LineString') continue;
      const coords = feature.geometry.coordinates;
      const isMajor = feature.properties?.isMajor;
      const elevation = feature.properties?.elevation || 0;
      const elevFeet = Math.round(elevation * 3.28084);
      const layer = isMajor ? 'TOPO-CONTOUR-MAJOR' : 'TOPO-CONTOUR-MINOR';

      if (state.is3D) {
        writer.add3dPolyline(
          layer,
          coords.map((c) => [c[0], c[1], elevFeet])
        );
      } else {
        writer.addLwPolyline(layer, coords.map((c) => [c[0], c[1]]));
        // Add elevation label at midpoint for major contours
        if (isMajor && coords.length >= 2) {
          const mid = coords[Math.floor(coords.length / 2)];
          writer.addText('TOPO-CONTOUR-LABEL', [mid[0], mid[1], 0], `${elevFeet}'`, 2.0);
        }
      }

      if (i % BATCH_SIZE === 0 && i > 0) {
        setProgress(40 + Math.round((i / features.length) * 25));
        await yieldToMain();
      }
    }
  }
  setProgress(65);
  await yieldToMain();

  // Buildings
  if (projectedBuildings && state.enabledLayers.buildings) {
    for (const feature of projectedBuildings.features) {
      if (feature.geometry.type === 'Polygon') {
        for (const ring of feature.geometry.coordinates) {
          writer.addLwPolyline('SITE-BLDG', ring.map((c) => [c[0], c[1]]), true);
        }
      } else if (feature.geometry.type === 'LineString') {
        writer.addLwPolyline('SITE-BLDG', feature.geometry.coordinates.map((c) => [c[0], c[1]]));
      }
    }
  }
  setProgress(70);
  await yieldToMain();

  // Roads
  if (projectedRoads && state.enabledLayers.roads) {
    for (const feature of projectedRoads.features) {
      if (feature.geometry.type !== 'LineString') continue;
      const isHighway = feature.properties?.roadClass === 'highway';
      const layer = isHighway ? 'SITE-ROADS-HWY' : 'SITE-ROADS-LOCAL';
      writer.addLwPolyline(layer, feature.geometry.coordinates.map((c) => [c[0], c[1]]));
    }
  }

  // Water
  if (projectedWater && state.enabledLayers.water) {
    for (const feature of projectedWater.features) {
      if (feature.geometry.type === 'Polygon') {
        for (const ring of feature.geometry.coordinates) {
          writer.addLwPolyline('SITE-WATER', ring.map((c) => [c[0], c[1]]), true);
        }
      } else if (feature.geometry.type === 'LineString') {
        writer.addLwPolyline('SITE-WATER', feature.geometry.coordinates.map((c) => [c[0], c[1]]));
      }
    }
  }

  // Land use
  if (projectedLanduse && state.enabledLayers.landuse) {
    for (const feature of projectedLanduse.features) {
      if (feature.geometry.type === 'Polygon') {
        for (const ring of feature.geometry.coordinates) {
          writer.addLwPolyline('SITE-LANDUSE', ring.map((c) => [c[0], c[1]]), true);
        }
      }
    }
  }

  // Infrastructure
  if (projectedInfra && state.enabledLayers.infrastructure) {
    for (const feature of projectedInfra.features) {
      if (feature.geometry.type === 'LineString') {
        const isPower = feature.properties?.power;
        const layer = isPower ? 'SITE-INFRA-POWER' : 'SITE-INFRA-TELECOM';
        writer.addLwPolyline(layer, feature.geometry.coordinates.map((c) => [c[0], c[1]]));
      } else if (feature.geometry.type === 'Point') {
        const isPower = feature.properties?.power;
        const layer = isPower ? 'SITE-INFRA-POWER' : 'SITE-INFRA-TELECOM';
        writer.addPoint(layer, [feature.geometry.coordinates[0], feature.geometry.coordinates[1]]);
      }
    }
  }
  setProgress(80);
  await yieldToMain();

  // ── Stage 4: Build final DXF string ──
  setProgress(85);
  const dxfString = writer.build();
  await yieldToMain();

  setProgress(90);
  return new Blob([dxfString], { type: 'application/dxf' });
}

function generateSvg(state: AppStore): Blob {
  const svgContent = renderPreviewSvg({
    bbox: state.bbox!,
    sheetWidthInches: state.sheetWidthInches,
    sheetHeightInches: state.sheetHeightInches,
    scale: state.scale,
    enabledLayers: state.enabledLayers,
    contourLines: state.contourLines,
    osmBuildings: state.osmBuildings,
    osmRoads: state.osmRoads,
    osmWater: state.osmWater,
    osmLanduse: state.osmLanduse,
    osmInfra: state.osmInfra,
    smoothing: state.smoothing,
  });

  return new Blob([svgContent], { type: 'image/svg+xml' });
}

async function generatePdf(state: AppStore): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: state.sheetWidthInches > state.sheetHeightInches ? 'landscape' : 'portrait',
    unit: 'in',
    format: [state.sheetWidthInches, state.sheetHeightInches],
  });

  // For now, add a text placeholder. Full SVG-to-PDF rendering would require svg2pdf.js
  doc.setFontSize(8);
  doc.text('GeoRhino Site Plan Export', 1, 1);
  doc.text(`Scale: ${state.scaleLabel}`, 1, 1.3);
  doc.text(`Sheet: ${state.sheetWidthInches}" × ${state.sheetHeightInches}"`, 1, 1.6);

  return doc.output('blob');
}

export async function runExportPipeline(state: AppStore): Promise<void> {
  const { bbox, utmZone, utmHemisphere, exportFormat } = state;

  if (!bbox || !utmZone || !utmHemisphere) {
    state.setExportError('No area selected');
    return;
  }

  state.setIsExporting(true);
  state.setExportProgress(0);
  state.setExportError(null);

  try {
    state.setExportProgress(10);

    const projector = createProjector(utmZone, utmHemisphere, bbox);
    state.setExportProgress(20);

    let blob: Blob;
    const timestamp = new Date().toISOString().slice(0, 10);

    switch (exportFormat) {
      case 'dxf':
        blob = await generateDxf(state, projector, (p) => state.setExportProgress(p));
        downloadBlob(blob, `georhino-site-${timestamp}.dxf`);
        break;

      case 'svg':
        state.setExportProgress(40);
        blob = generateSvg(state);
        state.setExportProgress(90);
        downloadBlob(blob, `georhino-site-${timestamp}.svg`);
        break;

      case 'pdf':
        state.setExportProgress(40);
        blob = await generatePdf(state);
        state.setExportProgress(90);
        downloadBlob(blob, `georhino-site-${timestamp}.pdf`);
        break;
    }

    state.setExportProgress(100);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    state.setExportError(message);
  } finally {
    state.setIsExporting(false);
  }
}
