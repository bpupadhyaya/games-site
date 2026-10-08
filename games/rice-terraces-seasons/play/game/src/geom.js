// Where everything sits on the hillside (metres). +X is across, +Z is down the slope towards the viewer, +Y is up. Tier 0 (the spring tier) is the highest and the farthest.
// Shared by the simulation-facing code (taps) and the 3D picture so a tap lands exactly where the gate is drawn.
export const PW = 6.4, PD = 5.2, STEP = 1.5, HW = 2.75, HD = 2.15, BED = 0.35;

export const plotX = (lv, c) => (c - (lv.C - 1) / 2) * PW;
export const plotZ = (lv, r) => (r - (lv.R - 1) / 2) * PD;
export const tierY = (lv, r) => (lv.R - 1 - r) * STEP;
export const plotPos = (lv, i) => { const r = Math.floor(i / lv.C), c = i % lv.C; return { x: plotX(lv, c), y: tierY(lv, r), z: plotZ(lv, r), r, c }; };
export const canalZ = (lv) => plotZ(lv, 0) - HD - 0.9;
export const canalY = (lv) => tierY(lv, 0) + 0.55;
export const SPRING = (lv) => ({ x: 0, y: tierY(lv, 0) + 1.7, z: canalZ(lv) - 4.2 });

// World position of a gate's handle (the point a finger should hit).
export function gatePos(lv, g) {
  if (g.kind === 'f') return { x: plotX(lv, g.c), y: canalY(lv) + 0.2, z: canalZ(lv) + 0.35 };
  if (g.kind === 'd') return { x: plotX(lv, g.c), y: tierY(lv, g.r) + 0.5, z: plotZ(lv, g.r) + HD + 0.1 };
  return { x: plotX(lv, g.c) + PW / 2, y: tierY(lv, g.r) + 0.5, z: plotZ(lv, g.r) - 0.15 };
}
// The corners of the whole map, used to frame the camera.
export function mapBounds(lv) {
  const x = (lv.C * PW) / 2 + 0.6, z0 = canalZ(lv) - 1.2, z1 = plotZ(lv, lv.R - 1) + HD + 1.2;
  const yTop = tierY(lv, 0) + 2.0;
  const pts = [];
  for (const sx of [-1, 1]) for (const [z, y] of [[z0, yTop + 0.6], [z1, -STEP * 0.9], [z0, -0.2], [z1, 1.0]]) pts.push({ x: sx * x, y, z });
  return pts;
}
