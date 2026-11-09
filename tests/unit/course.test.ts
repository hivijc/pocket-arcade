import { describe, expect, it, vi } from 'vitest';
import { courseSubtitle, holeLabel, lazyList, parseCourse, sortedHoleFiles } from '../../src/world/course';
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
