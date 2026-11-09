export type Vec2 = readonly [number, number];

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return a;
  const t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2;
  const clamped = Math.max(0, Math.min(1, t));
  return [a[0] + abx * clamped, a[1] + aby * clamped];
}
