import type { Board } from '../sim/board';

/** [c, d, depth 0..1], or null for a gap (airborne or tumbling). */
export type TrackPoint = readonly [number, number, number] | null;

/** About 1.5 s of track at 60 points a second. */
export const TRACK_MAX = 90;

export const carveDepth = (heading: number): number => Math.max(0, Math.min(1, (Math.abs(heading) - 20) / 55));

export const trackPoint = (b: Board): TrackPoint => (b.air || b.tumble > 0 ? null : [b.c, b.d, carveDepth(b.heading)]);

export function pushTrack(track: readonly TrackPoint[], p: TrackPoint): TrackPoint[] {
  if (p === null && (track.length === 0 || track[track.length - 1] === null)) return [...track];
  return [...track, p].slice(-TRACK_MAX);
}

export function trackSegments(track: readonly TrackPoint[]): [NonNullable<TrackPoint>, NonNullable<TrackPoint>][] {
  return track.slice(1).flatMap((b, i) => {
    const a = track[i];
    return a && b ? [[a, b] as [NonNullable<TrackPoint>, NonNullable<TrackPoint>]] : [];
  });
}
