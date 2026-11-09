import { describe, expect, it, vi } from 'vitest';
import {
  COURSE_IDS, COURSE_NAMES, DEFAULT_COURSE, courseFromSearch, courseHoles, courseSubtitle, holeLabel, isCourseId, lazyList,
  loadCourseDef, parseCourse, sortedHoleFiles,
} from '../../src/world/course';
import { parseManifest } from '../../src/world/manifest';
import { parsePalette } from '../../src/render/palette';
import { HoleError } from '../../src/world/hole';
import { rawHole, TEST_MANIFEST } from '../helpers/makeHole';

describe('sortedHoleFiles', () => {
  it('orders modules by file name, not insertion order', () => {
    const files = sortedHoleFiles({ './world/holes/10.json': 'j', './world/holes/02.json': 'b', './world/holes/01.json': 'a' });
    expect(files.map((f) => f.raw)).toEqual(['a', 'b', 'j']);
  });

  it('unwraps a JSON module default export', () => {
    expect(sortedHoleFiles({ './holes/01.json': { default: 'x' } })[0].raw).toBe('x');
  });
});

describe('holeLabel', () => {
  it('names the file relative to holes/', () => {
    expect(holeLabel('./world/holes/04.json')).toBe('holes/04.json');
    expect(holeLabel('./world/holes/12.json')).toBe('holes/12.json');
    expect(holeLabel('plain.json')).toBe('plain.json');
  });
});

describe('parseCourse', () => {
  it('parses every hole in file order', () => {
    const course = parseCourse(
      { './holes/02.json': { ...rawHole(), name: 'Second' }, './holes/01.json': { ...rawHole(), name: 'First' } },
      TEST_MANIFEST,
    );
    expect(course.map((h) => h.name)).toEqual(['First', 'Second']);
  });

  it('reports the failing file name', () => {
    expect(() => parseCourse({ './holes/11.json': { ...rawHole(), par: 0 } }, TEST_MANIFEST)).toThrow(HoleError);
    expect(() => parseCourse({ './holes/11.json': { ...rawHole(), par: 0 } }, TEST_MANIFEST)).toThrow(/holes\/11\.json/);
  });

  it('rejects an empty course', () => {
    expect(() => parseCourse({}, TEST_MANIFEST)).toThrow(/no holes/);
  });
});

describe('lazyList', () => {
  it('makes each item on first use and caches it', () => {
    const make = vi.fn((i: number) => ({ i }));
    const list = lazyList(3, make);
    expect(make).not.toHaveBeenCalled();
    const a = list.get(1);
    expect(list.get(1)).toBe(a);
    expect(make).toHaveBeenCalledTimes(1);
    expect(list.has(1)).toBe(true);
    expect(list.has(0)).toBe(false);
  });

  it('rejects an index outside the list', () => {
    const list = lazyList(2, (i) => i);
    expect(() => list.get(2)).toThrow(RangeError);
    expect(() => list.get(-1)).toThrow(RangeError);
    expect(() => list.get(0.5)).toThrow(RangeError);
  });
});

describe('courseSubtitle', () => {
  it('counts the holes', () => {
    expect(courseSubtitle(9)).toBe('9 holes of mini-golf');
    expect(courseSubtitle(1)).toBe('1 hole of mini-golf');
  });
});

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

describe.each(COURSE_IDS)('course %s', (id) => {
  it('loads a complete definition whose holes all parse', async () => {
    const c = await loadCourseDef(id);
    expect(c.id).toBe(id);
    expect(c.name).toBe(COURSE_NAMES[id]);
    expect(parsePalette(c.palette)).toHaveLength(32);
    const holes = courseHoles(c, parseManifest(c.manifest));
    expect(holes.length).toBeGreaterThanOrEqual(3);
    expect(c.terrain.ramps.G.length).toBeGreaterThan(0);
    expect(c.background).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('courseHoles', () => {
  it('labels errors with the course and file, and rejects an empty course', async () => {
    const c = await loadCourseDef('boardwalk');
    const bad = { ...c, holes: [{ path: './holes/07.json', raw: { ...rawHole(), par: 0 } }] };
    expect(() => courseHoles(bad, TEST_MANIFEST)).toThrow(/boardwalk\/holes\/07\.json/);
    expect(() => courseHoles({ ...c, holes: [] }, TEST_MANIFEST)).toThrow(/no holes/);
  });
});
