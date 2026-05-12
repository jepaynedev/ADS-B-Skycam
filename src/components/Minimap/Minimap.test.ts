import { buildTrailSegments } from './Minimap';

type Pt = { lat: number; lng: number; alt_m: number };

function pt(lat: number, lng: number, alt_m: number): Pt {
  return { lat, lng, alt_m };
}

describe('buildTrailSegments', () => {
  it('returns empty array for fewer than 2 points', () => {
    expect(buildTrailSegments([])).toEqual([]);
    expect(buildTrailSegments([pt(0, 0, 0)])).toEqual([]);
  });

  it('returns one segment when all points share the same altitude bucket', () => {
    const history = [pt(0, 0, 100), pt(1, 0, 200), pt(2, 0, 300)];
    const segs = buildTrailSegments(history);
    expect(segs).toHaveLength(1);
    expect(segs[0].path).toHaveLength(3);
  });

  it('splits into two segments when altitude crosses a 500 m bucket boundary', () => {
    // Two points in 0–499 m bucket, two in 500–999 m bucket
    const history = [pt(0, 0, 100), pt(1, 0, 200), pt(2, 0, 600), pt(3, 0, 700)];
    const segs = buildTrailSegments(history);
    expect(segs).toHaveLength(2);
  });

  it('overlaps adjacent segments by one point for visual continuity', () => {
    // 4 points spanning two buckets — transition at index 2 (lat:2)
    const history = [pt(0, 0, 100), pt(1, 0, 200), pt(2, 0, 600), pt(3, 0, 700)];
    const segs = buildTrailSegments(history);
    expect(segs).toHaveLength(2);
    // The transition point (lat:2) is the last of seg 0 and first of seg 1
    const lastOfFirst = segs[0].path[segs[0].path.length - 1];
    const firstOfSecond = segs[1].path[0];
    expect(lastOfFirst).toEqual(firstOfSecond);
    expect(lastOfFirst.lat).toBe(2);
  });

  it('assigns different colours for different altitude buckets', () => {
    const history = [pt(0, 0, 0), pt(1, 0, 500), pt(2, 0, 6000)];
    const segs = buildTrailSegments(history);
    const colors = segs.map((s) => s.color);
    const unique = new Set(colors);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('uses an hsl colour string', () => {
    const segs = buildTrailSegments([pt(0, 0, 0), pt(1, 0, 100)]);
    expect(segs[0].color).toMatch(/^hsl\(/);
  });
});
