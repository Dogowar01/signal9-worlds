import type { Region } from '../db';

/** Ray-casting point-in-polygon test (coordinates 0..1). */
export function pointInPolygon(x: number, y: number, pts: [number, number][]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** True when a point is hidden under any fog-of-war region. */
export function underFog(x: number, y: number, regions: Region[] | undefined) {
  return !!regions?.some((r) => r.fog && r.points.length > 2 && pointInPolygon(x, y, r.points));
}
