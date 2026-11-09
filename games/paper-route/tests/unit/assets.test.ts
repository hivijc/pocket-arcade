import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSprites, type SpriteIo } from '../../src/render/assets';
import { parseManifest } from '../../src/world/manifest';

const manifest = parseManifest({
  good: { image: { src: 'good.png', anchor: [0, 0] } },
  broken: { image: { src: 'broken.png', anchor: [0, 0] } },
  absent: { image: { src: 'absent.png', anchor: [0, 0] } },
  flat: { placeholder: { color: '#ff0000', w: 4, h: 4 } },
});

const img = (tag: string) => ({ tag }) as unknown as HTMLImageElement;
const io: SpriteIo = {
  urlFor: (file) => (file === 'absent.png' ? undefined : `/${file}`),
  load: (url) => (url === '/broken.png' ? Promise.reject(new Error('could not load image /broken.png')) : Promise.resolve(img(url))),
};

afterEach(() => vi.restoreAllMocks());

describe('loadSprites', () => {
  it('keeps the sprites that load and warns about those that are missing or fail to decode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sprites = await loadSprites(manifest, io);
    expect([...sprites.keys()]).toEqual(['good']);
    const text = warn.mock.calls.map((c) => String(c[0])).join('\n');
    expect(text).toMatch(/broken/);
    expect(text).toMatch(/absent/);
    expect(text).not.toMatch(/good|flat/);
  });
});
