import manifest from '../../../../assets/courses/boardwalk/manifest.json';
import palette from '../../../../assets/courses/boardwalk/palette.json';
import { parseTerrainStyle } from '../../../render/terrain-bake';
import { holeFiles, type CourseDef } from '../../course';

const HOLES = import.meta.glob('./holes/*.json', { eager: true, import: 'default' });

/** Beach at golden hour: golden sand, turf putting strips, weathered planks and a teal sea. */
export const BOARDWALK_TERRAIN = parseTerrainStyle({
  ramps: {
    G: ['#2f5530', '#3f7a3c', '#5e9a4a', '#8cbf5c'],
    R: ['#8a6a4a', '#b08a62', '#d4a86a', '#e8c88a'],
    S: ['#d9c08c', '#e8c88a', '#f6e3b4'],
    W: ['#1d3b5c', '#22577a', '#2f6f9a', '#3a8fa8', '#5aa7d0', '#9fd8ee'],
    sideL: ['#6e5240', '#8a6a4a', '#b08a62'],
    sideR: ['#3b2a24', '#4a3b2e', '#6e5240'],
    P: ['#3b2a24', '#6e5240', '#8f7a66', '#b08a62'],
    fringe: ['#3f7a3c', '#5e9a4a', '#a8b85a', '#c9c27a'],
    rim: ['#d4a86a', '#e8c88a', '#e8c88a', '#fffaf0'],
  },
  rim: 'speckle',
  fence: { post: '#8f7a66', postFoot: '#3b2a24', rail: '#d9c08c', postsPerTile: 2, sag: true },
});

export const course: CourseDef = {
  id: 'boardwalk',
  name: 'Boardwalk',
  tagline: 'beach at golden hour',
  palette,
  manifest,
  holes: holeFiles(HOLES),
  spriteDir: 'courses/boardwalk/sprites',
  terrain: BOARDWALK_TERRAIN,
  background: '#1d3b5c',
};
