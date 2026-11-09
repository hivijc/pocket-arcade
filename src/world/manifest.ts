export type Footprint =
  | { readonly kind: 'circle'; readonly r: number }
  | { readonly kind: 'box'; readonly w: number; readonly d: number };

export interface Placeholder {
  readonly color: string;
  readonly w: number;
  readonly h: number;
}

export interface SpriteDef {
  readonly footprint?: Footprint;
  readonly placeholder: Placeholder;
}

export type Manifest = Readonly<Record<string, SpriteDef>>;

export class ManifestError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isPosNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

function parseFootprint(name: string, raw: unknown): Footprint | undefined {
  if (raw === undefined) return undefined;
  if (!isObj(raw)) throw new ManifestError(`manifest: ${name}.footprint must be an object`);
  if (raw.kind === 'circle' && isPosNum(raw.r)) return { kind: 'circle', r: raw.r };
  if (raw.kind === 'box' && isPosNum(raw.w) && isPosNum(raw.d)) return { kind: 'box', w: raw.w, d: raw.d };
  throw new ManifestError(`manifest: ${name}.footprint must be {kind:'circle',r} or {kind:'box',w,d}`);
}

function parsePlaceholder(name: string, raw: unknown): Placeholder {
  if (!isObj(raw)) throw new ManifestError(`manifest: ${name}.placeholder is required`);
  if (typeof raw.color !== 'string' || !isPosNum(raw.w) || !isPosNum(raw.h)) {
    throw new ManifestError(`manifest: ${name}.placeholder needs color, w, h`);
  }
  return { color: raw.color, w: raw.w, h: raw.h };
}

export function parseManifest(raw: unknown): Manifest {
  if (!isObj(raw)) throw new ManifestError('manifest: must be an object of sprite definitions');
  const entries = Object.entries(raw).map(([name, def]): [string, SpriteDef] => {
    const d = isObj(def) ? def : {};
    return [name, { footprint: parseFootprint(name, d.footprint), placeholder: parsePlaceholder(name, d.placeholder) }];
  });
  return Object.freeze(Object.fromEntries(entries));
}
