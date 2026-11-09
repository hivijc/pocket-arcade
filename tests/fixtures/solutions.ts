/** Known par-or-better lines from `npm run solve`, as [angle in degrees, power 0..1] per stroke. */
export const SOLUTIONS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  'Gnome Alley': [[0, 0.85]],
  'Picket Bank': [[6, 1], [28, 0.75]],
  'Pool Hop': [[-10, 1]],
  // Boardwalk (`npm run solve -- <n> --course boardwalk`)
  'Sandbar': [[-24.75, 1], [20, 0.95]],
  'Tide Pool Bridge': [[3, 0.82], [86, 0.35]],
  'Castle Hop': [[-12, 0.98], [-104, 0.95]],
};
