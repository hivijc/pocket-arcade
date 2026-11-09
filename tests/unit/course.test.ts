import { describe, expect, it } from 'vitest';
import { COURSE_IDS, COURSE_NAMES, DEFAULT_COURSE, courseFromSearch, holeFiles, isCourseId, loadCourseDef } from '../../src/world/course';
import { parseManifest } from '../../src/world/manifest';
import { parsePalette } from '../../src/render/palette';

describe('course ids', () => {
  it('Backyard is the default', () => {
    expect(DEFAULT_COURSE).toBe('backyard');
    expect(courseFromSearch('')).toBe('backyard');
    expect(courseFromSearch('?course=nope')).toBe('backyard');
    expect(courseFromSearch('?phase=night&course=boardwalk')).toBe('boardwalk');
  });
  it('recognises only known ids', () => {
    expect(isCourseId('boardwalk')).toBe(true);
    expect(isCourseId('moon')).toBe(false);
    expect(isCourseId(undefined)).toBe(false);
  });
});

describe('holeFiles', () => {
  it('orders holes by file name and keeps folder/file for errors', () => {
    const files = holeFiles({ './holes/02.json': 'b', './holes/01.json': 'a', '../../holes/10.json': 'c' });
    expect(files.map((f) => f.raw)).toEqual(['a', 'b', 'c']);
    expect(files.map((f) => f.file)).toEqual(['holes/01.json', 'holes/02.json', 'holes/10.json']);
  });
});

describe.each(COURSE_IDS)('course %s', (id) => {
  it('loads a complete definition', async () => {
    const c = await loadCourseDef(id);
    expect(c.id).toBe(id);
    expect(c.name).toBe(COURSE_NAMES[id]);
    expect(c.holes.length).toBeGreaterThanOrEqual(3);
    expect(parsePalette(c.palette)).toHaveLength(32);
    expect(Object.keys(parseManifest(c.manifest)).length).toBeGreaterThan(0);
    expect(c.terrain.ramps.G.length).toBeGreaterThan(0);
    expect(c.background).toMatch(/^#[0-9a-f]{6}$/);
  });
});
