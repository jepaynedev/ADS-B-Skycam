export function lerpHeading(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180; // normalize to -180..180
  return (a + delta * t + 360) % 360;
}
