export interface ContourLine {
  coordinates: [number, number][];
  elevation: number;
  isMajor: boolean;
}

export interface ContourSet {
  lines: ContourLine[];
  minElevation: number;
  maxElevation: number;
  interval: number;
  totalLines: number;
}
