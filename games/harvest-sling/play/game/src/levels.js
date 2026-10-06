// Seeded scene + spawn rules. Everything random comes from the rng passed in.
import { V, skyY, BIRDS } from './tuning.js';
import { createRng } from '../kit/rng.js';

// World = which landscape to draw and where birds can sit. Perches are spread over the whole
// upper two thirds of the screen on purpose (see design/GDD.md core loop) - never cluster them.
export const WORLDS = ['wheat', 'rice', 'orchard', 'savanna', 'snow'];

export function generateScene(rng, spec) {
  const world = { world: WORLDS[spec.world], seed: rng.int(1000000000), hasWire: spec.n >= 5, trees: [], perches: [], fenceY: 0, scarecrowX: 0, key: '' };
  return fitScene(world, spec);
}

// (Re)builds the scenery for the live world size (V). Everything random comes from the scene's own seed, so the same level
// always has the same character, and a rotation just re-spreads it over the new width. Birds refer to perches by index only.
export function fitScene(world, spec) {
  const r = createRng(world.seed);
  const { WW, WH, hy } = V;
  const perches = [];
  const trees = [];
  const N = Math.max(3, Math.round(WW / 240));
  const base = 2 + (spec.n > 6 ? 1 : 0);
  const treeCount = Math.min(N, Math.max(base, Math.round((base * WW) / 720)));
  const slots = r.shuffle(Array.from({ length: N }, (_, i) => ((i + 0.5) / N) * WW)).slice(0, treeCount).sort((a, b) => a - b);
  for (const baseX of slots) {
    const x = Math.max(60, Math.min(WW - 60, baseX + r.range(-40, 40)));
    const height = r.range(0.258, 0.406) * WH;
    const groundY = hy + 10;
    const tree = { x, groundY, height, crown: r.range(110, 150), branches: [] };
    const branchCount = 2 + r.int(2) + Math.max(0, Math.round((V.WH / 1560 - 1) * 4));   // taller field: taller trees with an extra tier
    for (let i = 0; i < branchCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const by = groundY - height * r.range(0.45, 0.95);
      const len = r.range(70, 130);
      const bx = Math.max(40, Math.min(WW - 40, x + side * len));
      tree.branches.push({ x0: x, y0: by + 18, x1: bx, y1: by });
      perches.push({ x: bx, y: by - 4, kind: 'branch', sway: spec.n >= 9 ? r.range(6, 14) : 0, phase: r.range(0, 6) });
    }
    trees.push(tree);
  }
  // Fence along the field edge + a scarecrow: low perches, close = bigger/easier targets.
  const fenceY = hy + 40;
  const M = Math.max(6, Math.round(WW / 120));
  const fenceCount = Math.min(M, Math.max(3, Math.round((3 * WW) / 720)));
  for (const fx of r.shuffle(Array.from({ length: M }, (_, i) => ((i + 0.5) / M) * WW)).slice(0, fenceCount)) perches.push({ x: fx, y: fenceY - 46, kind: 'fence', sway: 0, phase: 0 });
  // Hay sheaves on the stubble: extra low perches that only exist on fields wider than the baseline phone.
  const sheaves = [];
  const nSheaf = Math.max(0, Math.floor((WW - 540) / 360));
  for (let i = 0; i < nSheaf; i++) { const sx = ((i + 0.5) / nSheaf) * WW + r.range(-40, 40); sheaves.push({ x: sx, y: hy + 78 + r.range(0, 30) }); perches.push({ x: sx, y: hy + 78 + (sheaves[i].y - hy - 78) - 38, kind: 'sheaf', sway: 0, phase: 0 }); }
  const scarecrowX = r.pick([0.25, 0.75]) * WW;
  perches.push({ x: scarecrowX - 52, y: hy - 90, kind: 'scarecrow', sway: 0, phase: 0 });
  // A wire high across the sky from level 5.
  if (spec.n >= 5) {
    const c = Math.max(3, Math.round(WW / 240));
    for (let i = 0; i < c; i++) {
      const wx = ((i + 0.5) / c) * WW + r.range(-30, 30);
      perches.push({ x: wx, y: skyY(300 + Math.min(40, Math.abs(wx - WW / 2) * 0.06)), kind: 'wire', sway: 0, phase: 0 });
    }
  }
  Object.assign(world, { trees, perches, sheaves, fenceY, scarecrowX, key: V.key });
  return world;
}

export function pickBirdType(rng, spec, owlOnScreen, finchOnScreen = false) {
  const pool = [];
  for (const [type, b] of Object.entries(BIRDS)) {
    if (b.unlock > spec.n) continue;
    if (type === 'owl' && owlOnScreen) continue;
    if (type === 'goldfinch' && finchOnScreen) continue;
    for (let i = 0; i < b.weight; i++) pool.push(type);
  }
  return rng.pick(pool);
}
