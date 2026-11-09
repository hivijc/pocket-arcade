export type Footprint =
  | { readonly kind: 'circle'; readonly r: number }
  | { readonly kind: 'box'; readonly w: number; readonly d: number };

export interface Placeholder {
  readonly color: string;
  readonly w: number;
  readonly h: number;
}

export interface SpriteImage {
  /** File name inside assets/sprites/. */
  readonly src: string;
  /** Pixel inside the image that sits on the sprite's ground point. */
  readonly anchor: readonly [number, number];
}

export interface Light {
  /** Pool radius in tiles. */
  readonly radius: number;
}

export interface SpriteDef {
  readonly footprint?: Footprint;
  readonly placeholder?: Placeholder;
  readonly image?: SpriteImage;
  /** Sways in the wind: the top half shifts a pixel on alternate wind steps. */
  readonly sway: boolean;
  /** Casts a lamp-light pool at dusk and night. */
  readonly light?: Light;
}

export type Manifest = Readonly<Record<string, SpriteDef>>;

export class ManifestError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPosNum = (v: unknown): v is number => isNum(v) && v > 0;
const FILE = /^[a-z0-9-]+\.png$/;

function parseFootprint(name: string, raw: unknown): Footprint | undefined {
  if (raw === undefined) return undefined;
  if (!isObj(raw)) throw new ManifestError(`manifest: ${name}.footprint must be an object`);
  if (raw.kind === 'circle' && isPosNum(raw.r)) return { kind: 'circle', r: raw.r };
  if (raw.kind === 'box' && isPosNum(raw.w) && isPosNum(raw.d)) return { kind: 'box', w: raw.w, d: raw.d };
  throw new ManifestError(`manifest: ${name}.footprint must be {kind:'circle',r} or {kind:'box',w,d}`);
}

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
  return { src: raw.src, anchor: [a[0], a[1]] };
}

function parseLight(name: string, raw: unknown): Light | undefined {
  if (raw === undefined) return undefined;
  if (!isObj(raw) || !isPosNum(raw.radius)) throw new ManifestError(`manifest: ${name}.light needs a positive radius`);
  return { radius: raw.radius };
}

function parseDef(name: string, raw: unknown): SpriteDef {
  const d = isObj(raw) ? raw : {};
  if (d.sway !== undefined && typeof d.sway !== 'boolean') throw new ManifestError(`manifest: ${name}.sway must be true or false`);
  const def: SpriteDef = {
    footprint: parseFootprint(name, d.footprint),
    placeholder: parsePlaceholder(name, d.placeholder),
    image: parseImage(name, d.image),
    sway: d.sway === true,
    light: parseLight(name, d.light),
  };
  if (!def.image && !def.placeholder) throw new ManifestError(`manifest: ${name} needs an image or a placeholder`);
  return def;
}

export function parseManifest(raw: unknown): Manifest {
  if (!isObj(raw)) throw new ManifestError('manifest: must be an object of sprite definitions');
  return Object.freeze(Object.fromEntries(Object.entries(raw).map(([name, def]) => [name, parseDef(name, def)])));
}
