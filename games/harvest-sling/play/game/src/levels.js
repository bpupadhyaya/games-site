// Seeded scene + spawn rules. Everything random comes from the rng passed in.
import { W, BIRDS } from './tuning.js';

// World = which landscape to draw and where birds can sit. Perches are spread over the whole
// upper two thirds of the screen on purpose (see design/GDD.md core loop) - never cluster them.
export const WORLDS = ['wheat', 'rice', 'orchard'];

export function generateScene(rng, spec) {
  const perches = [];
  const trees = [];
  const treeCount = 2 + (spec.n > 6 ? 1 : 0);
  const slots = rng.shuffle([110, 360, 610]).slice(0, treeCount).sort((a, b) => a - b);
  for (const baseX of slots) {
    const x = baseX + rng.range(-40, 40);
    const height = rng.range(330, 520);
    const groundY = 800;
    const tree = { x, groundY, height, crown: rng.range(110, 150), branches: [] };
    const branchCount = 2 + rng.int(2);
    for (let i = 0; i < branchCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const by = groundY - height * rng.range(0.45, 0.95);
      const len = rng.range(70, 130);
      const bx = Math.max(40, Math.min(W - 40, x + side * len));
      tree.branches.push({ x0: x, y0: by + 18, x1: bx, y1: by });
      perches.push({ x: bx, y: by - 4, kind: 'branch', sway: spec.n >= 9 ? rng.range(6, 14) : 0, phase: rng.range(0, 6) });
    }
    trees.push(tree);
  }
  // Fence along the field edge + a scarecrow: low perches, close = bigger/easier targets.
  const fenceY = 830;
  for (const fx of rng.shuffle([90, 210, 330, 450, 570, 650]).slice(0, 3)) perches.push({ x: fx, y: fenceY - 46, kind: 'fence', sway: 0, phase: 0 });
  const scarecrowX = rng.pick([180, 540]);
  perches.push({ x: scarecrowX - 52, y: 700, kind: 'scarecrow', sway: 0, phase: 0 });
  // A wire high across the sky from level 5.
  if (spec.n >= 5) for (const wx of [170, 360, 550]) perches.push({ x: wx + rng.range(-30, 30), y: 300 + Math.abs(wx - 360) * 0.06, kind: 'wire', sway: 0, phase: 0 });
  return { world: WORLDS[spec.world], trees, perches, fenceY, scarecrowX, hasWire: spec.n >= 5 };
}

export function pickBirdType(rng, spec, owlOnScreen) {
  const pool = [];
  for (const [type, b] of Object.entries(BIRDS)) {
    if (b.unlock > spec.n) continue;
    if (type === 'owl' && owlOnScreen) continue;
    for (let i = 0; i < b.weight; i++) pool.push(type);
  }
  return rng.pick(pool);
}
