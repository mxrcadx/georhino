/**
 * Custom MapboxDraw mode for drawing axis-aligned rectangles.
 * Click once to set the first corner, click again to set the opposite corner.
 * The rectangle is always a perfect north-south/east-west aligned box.
 */

const DrawRectangle: any = {
  onSetup() {
    const rectangle = (this as any).newFeature({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[]],
      },
    });
    (this as any).addFeature(rectangle);
    (this as any).clearSelectedFeatures();
    (this as any).setActionableState({ trash: true });

    return {
      rectangle,
      startPoint: null as [number, number] | null,
    };
  },

  onClick(state: any, e: any) {
    const point: [number, number] = [e.lngLat.lng, e.lngLat.lat];

    if (!state.startPoint) {
      // First click — set starting corner
      state.startPoint = point;
    } else {
      // Second click — finalize the rectangle
      const [lng1, lat1] = state.startPoint;
      const [lng2, lat2] = point;

      const coords = [
        [lng1, lat1],
        [lng2, lat1],
        [lng2, lat2],
        [lng1, lat2],
        [lng1, lat1], // close the ring
      ];

      state.rectangle.setCoordinates([coords]);
      (this as any).map.fire('draw.create', { features: [state.rectangle.toGeoJSON()] });
      (this as any).changeMode('simple_select', { featureIds: [state.rectangle.id] });
    }
  },

  onMouseMove(state: any, e: any) {
    if (!state.startPoint) return;

    // Live preview: update rectangle as mouse moves
    const [lng1, lat1] = state.startPoint;
    const lng2 = e.lngLat.lng;
    const lat2 = e.lngLat.lat;

    const coords = [
      [lng1, lat1],
      [lng2, lat1],
      [lng2, lat2],
      [lng1, lat2],
      [lng1, lat1],
    ];

    state.rectangle.setCoordinates([coords]);
  },

  onKeyUp(_state: any, e: any) {
    if (e.key === 'Escape') {
      (this as any).deleteFeature([_state.rectangle.id], { silent: true });
      (this as any).changeMode('simple_select');
    }
  },

  onTrash(state: any) {
    (this as any).deleteFeature([state.rectangle.id], { silent: true });
    (this as any).changeMode('simple_select');
  },

  toDisplayFeatures(state: any, geojson: any, display: any) {
    display(geojson);
  },
};

export default DrawRectangle;
