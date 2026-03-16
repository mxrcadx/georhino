import type { StateCreator } from 'zustand';
import type { BoundingBox } from '@/types/geo';

export interface AreaSlice {
  bbox: BoundingBox | null;
  centerLat: number | null;
  centerLng: number | null;
  widthFeet: number;
  heightFeet: number;
  areaSqFt: number;
  utmZone: number | null;
  utmHemisphere: 'N' | 'S' | null;
  setBbox: (bbox: BoundingBox) => void;
  clearBbox: () => void;
}

function getUtmZone(longitude: number): number {
  return Math.floor((longitude + 180) / 6) + 1;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 20902231; // Earth radius in feet
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const createAreaSlice: StateCreator<AreaSlice> = (set) => ({
  bbox: null,
  centerLat: null,
  centerLng: null,
  widthFeet: 0,
  heightFeet: 0,
  areaSqFt: 0,
  utmZone: null,
  utmHemisphere: null,

  setBbox: (bbox: BoundingBox) => {
    const centerLat = (bbox.north + bbox.south) / 2;
    const centerLng = (bbox.east + bbox.west) / 2;
    const widthFeet = haversineDistance(centerLat, bbox.west, centerLat, bbox.east);
    const heightFeet = haversineDistance(bbox.south, centerLng, bbox.north, centerLng);
    const areaSqFt = widthFeet * heightFeet;
    const utmZone = getUtmZone(centerLng);
    const utmHemisphere = centerLat >= 0 ? 'N' as const : 'S' as const;

    set({ bbox, centerLat, centerLng, widthFeet, heightFeet, areaSqFt, utmZone, utmHemisphere });
  },

  clearBbox: () => {
    set({
      bbox: null, centerLat: null, centerLng: null,
      widthFeet: 0, heightFeet: 0, areaSqFt: 0,
      utmZone: null, utmHemisphere: null,
    });
  },
});
