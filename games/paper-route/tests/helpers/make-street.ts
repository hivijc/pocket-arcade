/** A small valid raw street (one lot per side, one dog); override any top-level field. */
export function rawStreet(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Test Lane',
    length: 40,
    lots: [
      { side: 'L', s: 5, house: 'house-a', subscriber: true, porch: [1.5, 3, 2, 4], mailbox: [3.6, 5] },
      { side: 'R', s: 5, house: 'house-b', subscriber: false, porch: [0.5, 3, 2, 4], mailbox: [0.4, 5] },
    ],
    props: [{ kind: 'tree', at: [0.6, 20] }],
    hazards: [{ kind: 'dog', home: [12, 30] }],
    bundles: [[7, 25]],
    ...overrides,
  };
}
