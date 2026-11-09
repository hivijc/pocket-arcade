export interface Placeholder {
  readonly color: string;
  readonly w: number;
  readonly h: number;
}

export interface SpriteImage {
  /** File name inside assets/sprites/. */
  readonly src: string;
  /** Pixel inside one frame that sits on the sprite's ground point. */
  readonly anchor: readonly [number, number];
  /** Frames laid out left to right in equal-width cells. */
  readonly frames: number;
  readonly fps: number;
}

export interface SpriteDef {
  readonly placeholder?: Placeholder;
  readonly image?: SpriteImage;
}

export type Manifest = Readonly<Record<string, SpriteDef>>;

export class ManifestError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPosNum = (v: unknown): v is number => isNum(v) && v > 0;
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const FILE = /^[a-z0-9-]+\.png$/;

function parsePlaceholder(name: string, raw: unknown): Placeholder | undefined {
  if (raw === undefined) return undefined;
  if (!isObj(raw) || typeof raw.color !== 'string' || !isPosNum(raw.w) || !isPosNum(raw.h)) {
    throw new ManifestError(`manifest: ${name}.placeholder needs color, w, h`);
  }
  return { color: raw.color, w: raw.w, h: raw.h };
}

function parseImage(name: string, raw: unknown): SpriteImage | undefined {
  if (raw === undefined) return undefined;
  const a = isObj(raw) ? raw.anchor : undefined;
  if (!isObj(raw) || typeof raw.src !== 'string' || !FILE.test(raw.src) || !Array.isArray(a) || a.length !== 2 || !a.every(isNum)) {
    throw new ManifestError(`manifest: ${name}.image needs src (a plain .png file name) and anchor [x, y]`);
  }
  const frames = raw.frames ?? 1;
  const fps = raw.fps ?? 8;
  if (!isPosInt(frames)) throw new ManifestError(`manifest: ${name}.image.frames must be a positive whole number`);
  if (!isPosNum(fps)) throw new ManifestError(`manifest: ${name}.image.fps must be positive`);
  return { src: raw.src, anchor: [a[0], a[1]], frames, fps };
}

function parseDef(name: string, raw: unknown): SpriteDef {
  const d = isObj(raw) ? raw : {};
  const def: SpriteDef = { placeholder: parsePlaceholder(name, d.placeholder), image: parseImage(name, d.image) };
  if (!def.image && !def.placeholder) throw new ManifestError(`manifest: ${name} needs an image or a placeholder`);
  return def;
}

export function parseManifest(raw: unknown): Manifest {
  if (!isObj(raw)) throw new ManifestError('manifest: must be an object of sprite definitions');
  return Object.freeze(Object.fromEntries(Object.entries(raw).map(([name, def]) => [name, parseDef(name, def)])));
}
