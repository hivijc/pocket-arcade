import manifest from '../../../../assets/manifest.json';
import palette from '../../../../assets/palette.json';
import { BACKYARD_TERRAIN } from '../../../render/terrain-bake';
import { holeFiles, type CourseDef } from '../../course';

// Backyard keeps its original paths: assets/palette.json, assets/manifest.json, assets/sprites/, src/world/holes/.
const HOLES = import.meta.glob('../../holes/*.json', { eager: true, import: 'default' });

export const course: CourseDef = {
  id: 'backyard',
  name: 'Backyard',
  tagline: 'garden mini-golf',
  palette,
  manifest,
  holes: holeFiles(HOLES),
  spriteDir: 'sprites',
  terrain: BACKYARD_TERRAIN,
  background: '#2c2c3a',
};
