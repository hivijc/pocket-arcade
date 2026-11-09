/** Known par-or-better lines from `npm run solve`, as [angle in degrees, power 0..1] per stroke. */
export const SOLUTIONS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  'Gnome Alley': [[0, 0.85]],
  'Picket Bank': [[6, 1], [28, 0.75]],
  'Pool Hop': [[-10, 1]],
};
