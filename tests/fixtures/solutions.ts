/** Known par-or-better lines from `npm run solve`, as [angle in degrees, power 0..1] per stroke. */
export const SOLUTIONS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  'Gnome Alley': [[0, 0.85]],
  'Picket Bank': [[6, 1], [28, 0.75]],
  'Pool Hop': [[-10, 1]],
  'Bunker Guard': [[0, 1], [-6, 1]],
  'Tilted Green': [[-29.5, 0.845]],
  'Plank Bridge': [[0, 0.86], [-96, 0.4]],
  'Upper Deck': [[30, 1], [-70, 0.7]],
  'Gnome Maze': [[6.75, 1], [142.75, 0.945], [147.75, 0.995], [40, 0.75]],
  'Grand Finale': [[-168.5, 0.69], [-6, 0.95]],
  // Boardwalk (`npm run solve -- <n> --course boardwalk`)
  'Sandbar': [[-24.75, 1], [20, 0.95]],
  'Tide Pool Bridge': [[3, 0.82], [86, 0.35]],
  'Castle Hop': [[-12, 0.98], [-104, 0.95]],
};

/** Each course's holes, in play order (the e2e full-course run plays one course's list). */
export const COURSE_SOLUTIONS: Readonly<Record<string, readonly string[]>> = {
  backyard: ['Gnome Alley', 'Picket Bank', 'Pool Hop', 'Bunker Guard', 'Tilted Green', 'Plank Bridge', 'Upper Deck', 'Gnome Maze', 'Grand Finale'],
  boardwalk: ['Sandbar', 'Tide Pool Bridge', 'Castle Hop'],
};
