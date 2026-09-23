// Drawing for the Rules reference page. Every illustration reuses the game's OWN drawing
// functions from render.js (the exact hunter, tree, stone, seed, acorn, wind and beater art the
// player sees in a real run) against small hand-built scenes - never a separate simplified icon.
// Pure: reads nothing from live game state, mutates nothing.
import { W, H, drawText, drawTree, hunter, telegraph, stones, seeds, beaters, nuts, bird, hud, FONT } from './render.js';
import { BOSS_SLOT } from './tuning.js';
import { levelDef } from './levels.js';

const NAV_Y0 = 1148, NAV_Y1 = 1270;
export const RULES_ENTRY_BOX = { x0: W - 176, y0: 26, x1: W - 16, y1: 96 };
export const RULES_BACK_BOX = { x0: 20, y0: NAV_Y0, x1: 260, y1: NAV_Y1 };
export const RULES_NEXT_BOX = { x0: W - 260, y0: NAV_Y0, x1: W - 20, y1: NAV_Y1 };

// Text always stays clear of the Back/Next row: every page picks the biggest size (from the list
// below) whose wrapped lines fit between its own top and this floor, so nothing ever overlaps the
// nav row or "Page N of M", however long a page's content turns out to be.
const TEXT_BOTTOM = 1082;
const TEXT_MAXW = W - 108;
const BODY_SIZES = [25, 24, 23, 22, 21, 20, 19, 18, 17];

function wrapParagraph(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; }
    else line = t;
  }
  lines.push(line);
  return lines;
}

// Picks the largest body size (and matching spacing) whose wrapped paragraphs fit `budget` px.
function layoutBody(ctx, paragraphs, budget) {
  let best = null;
  for (const size of BODY_SIZES) {
    ctx.font = `400 ${size}px ${FONT}`;
    const lh = Math.round(size * 1.3), pgap = Math.round(size * 0.85);
    const blocks = paragraphs.map((p) => wrapParagraph(ctx, p, TEXT_MAXW));
    const lines = blocks.reduce((a, b) => a + b.length, 0);
    const height = lines * lh + (blocks.length - 1) * pgap;
    best = { size, lh, pgap, blocks, height };
    if (height <= budget) break;
  }
  return best;
}

// Shrinks a title until it fits the page width, the same "shrink to fit" rule this game's own
// button labels use nowhere else - simplest safe default for a one-line heading.
function fitTitleSize(ctx, text, maxW, start, floor) {
  let size = start;
  ctx.font = `800 ${size}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && size > floor) { size -= 2; ctx.font = `800 ${size}px ${FONT}`; }
  return size;
}

// Fit a level's real tree layout into a small box elsewhere on the page - the same tree() shapes
// levels.js builds, just translated and scaled, never redrawn from scratch.
function fitTrees(trees, cx, cy, targetW, targetH) {
  const xs = trees.map((t) => t.x), ys = trees.map((t) => t.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = 210 * Math.max(...trees.map((t) => t.s));
  const scale = Math.min(targetW / (x1 - x0 + pad * 2 || 1), targetH / (y1 - y0 + pad * 2 || 1));
  const bcx = (x0 + x1) / 2, bcy = (y0 + y1) / 2;
  return trees.map((t) => ({ ...t, x: cx + (t.x - bcx) * scale, y: cy + (t.y - bcy) * scale, s: t.s * scale }));
}

// One small tree plus the perches its own offsets put on it - the same geometry buildPerches()
// uses for the real field, just placed wherever a page needs it (always kept well clear of the
// text band below, unlike a real level's tall trees).
function miniTree(x, y, s, offs = [{ dx: 0, dy: -324 }], crown = 1) {
  const tree = { x, y, s, offs, crown };
  const perches = offs.map((o, i) => ({ x: x + o.dx * s, y: y + o.dy * s, s, tree: 0, slot: i }));
  return { tree, perches };
}

// A quiet, idly-bobbing bird in the corner of every page - the same bird() the field itself uses.
function signatureBird(ctx, t) {
  const fake = { perches: [{ x: 92, y: 1096, s: 0.5 }], bird: { perch: 0, from: 0, dest: 0, flit: -1, stun: 0, inv: 0 }, beaters: [] };
  bird(ctx, fake, t, true);
}

const THREE = [{ dx: -95, dy: -244 }, { dx: 0, dy: -324 }, { dx: 95, dy: -244 }];

function drawArt(ctx, art, t) {
  if (!art) return;
  if (art.kind === 'hero') {
    const five = [{ dx: -190, dy: -134 }, { dx: -95, dy: -244 }, { dx: 0, dy: -324 }, { dx: 95, dy: -244 }, { dx: 190, dy: -134 }];
    const { tree, perches } = miniTree(360, 760, 0.55, five, 1);
    drawTree(ctx, tree);
    bird(ctx, { perches, bird: { perch: 2, from: 2, dest: 2, flit: -1, stun: 0, inv: 0 }, beaters: [] }, t, true);
  } else if (art.kind === 'field') {
    const cols = [
      { trees: levelDef(1).trees, x: 140, label: 'Level 1' },
      { trees: levelDef(2).trees, x: 360, label: 'Level 2' },
      { trees: levelDef(3).trees, x: 580, label: 'Level 3+' },
    ];
    for (const c of cols) {
      for (const tr of fitTrees(c.trees, c.x, 380, 190, 280)) drawTree(ctx, tr);
      drawText(ctx, c.label, c.x, 552, 20, '#fff8e0', 800);
    }
  } else if (art.kind === 'hud') {
    ctx.save(); ctx.translate(0, 230);
    hud(ctx, {
      score: 1240, lives: 2, combo: 3, t: 22, duration: 60, level: 4, name: 'Windy Grove',
      feats: { seeds: 1, wind: 0.6, hitback: 1, boss: 0 }, seedsGot: 4, ammo: 2, wind: 0.55, blurb: '',
    });
    ctx.restore();
  } else if (art.kind === 'telegraph') {
    const { tree, perches } = miniTree(420, 600, 0.5);
    const h = { slot: 0, phase: 'pull', timer: 0.55, total: 1.2, kind: 'lob', target: 0, cancel: false };
    drawTree(ctx, tree);
    telegraph(ctx, { hunters: [h], trees: [tree], perches }, t);
    hunter(ctx, h, t, perches);
  } else if (art.kind === 'pair') {
    const hl = { slot: 0, phase: 'pull', timer: 0.5, total: 1.2, kind: art.left, target: 0, cancel: false };
    const hr = { slot: 1, phase: 'pull', timer: 0.5, total: 1.2, kind: art.right, target: 0, cancel: false };
    const pl = [{ x: 300, y: 540, s: 0.5, tree: 0, slot: 0 }];
    const pr = [{ x: 420, y: 540, s: 0.5, tree: 0, slot: 0 }];
    hunter(ctx, hl, t, pl); hunter(ctx, hr, t, pr);
    drawText(ctx, art.leftLabel, 96, 500, 22, '#fff8e0', 800);
    drawText(ctx, art.rightLabel, 624, 500, 22, '#fff8e0', 800);
  } else if (art.kind === 'trick') {
    const { tree, perches } = miniTree(300, 600, 0.5);
    const h = { slot: 1, phase: 'pull', timer: 0.35, total: 1.1, kind: 'fake', target: 0, cancel: true };
    drawTree(ctx, tree);
    telegraph(ctx, { hunters: [h], trees: [tree], perches }, t);
    hunter(ctx, h, t, perches);
    drawText(ctx, 'a FAKE\'s ring glows amber', 360, 490, 19, '#ffd35c', 700);
  } else if (art.kind === 'hunter-arrow') {
    const { tree, perches } = miniTree(420, 600, 0.5);
    const h = { slot: 0, phase: 'pull', timer: 0.3, total: 0.55, kind: 'arrow', target: 0, cancel: false };
    drawTree(ctx, tree);
    telegraph(ctx, { hunters: [h], trees: [tree], perches }, t);
    hunter(ctx, h, t, perches);
  } else if (art.kind === 'net') {
    const { tree, perches } = miniTree(360, 560, 0.55, THREE, 1);
    const h = { slot: 0, phase: 'pull', timer: 0.4, total: 1.2, kind: 'net', target: 1, cancel: false };
    drawTree(ctx, tree);
    telegraph(ctx, { hunters: [h], trees: [tree], perches }, t);
  } else if (art.kind === 'seeds') {
    const { tree, perches } = miniTree(360, 560, 0.55, THREE, 1);
    drawTree(ctx, tree);
    seeds(ctx, { seeds: [{ perch: 1, ttl: 5 }], perches }, t);
  } else if (art.kind === 'acorn') {
    const h = { slot: 0, phase: 'pull', timer: 0.6, total: 1.2, kind: 'flat', target: 0, cancel: false };
    const perches = [{ x: 260, y: 520, s: 0.5, tree: 0, slot: 0 }];
    hunter(ctx, h, t, perches);
    nuts(ctx, { ammo: 1, over: false, won: false, hunters: [h], nuts: [{ slot: 0, age: 0.15, flight: 0.3, from: { x: 460, y: 460 } }] }, t);
  } else if (art.kind === 'wind') {
    const tree = { x: 360, y: 560, s: 0.6, offs: THREE, crown: 1 };
    drawTree(ctx, tree, { w: Math.sin(t * 1.3) * 0.9, t });
  } else if (art.kind === 'beater') {
    const { tree, perches } = miniTree(360, 560, 0.6);
    const cyc = t % 1.6, timer = Math.max(0.02, 0.9 - cyc);
    beaters(ctx, { beaters: [{ perch: 0, timer, total: 1.1 }], perches, trees: [tree] }, t);
  } else if (art.kind === 'boss') {
    const { tree, perches } = miniTree(360, 780, 0.7);
    const h = { slot: BOSS_SLOT, phase: 'pull', timer: 0.5, total: 1.3, kind: 'flat', target: 0, cancel: false };
    drawTree(ctx, tree);
    telegraph(ctx, { hunters: [h], trees: [tree], perches }, t);
    hunter(ctx, h, t, perches);
  } else if (art.kind === 'stone') {
    stones(ctx, {
      stones: [{ id: 1, slot: -1, kind: 'lob', target: 1, flight: 1, age: 0.55, threat: false, arc: 160, follow: true, fromPerch: 0 }],
      perches: [{ x: 260, y: 420, s: 0.5 }, { x: 480, y: 380, s: 0.5 }],
    }, t);
  }
}

// Renders one page of `list` (see content.js), with the same Back-exits / Next-cycles convention
// as this game's own bottom-corner tap zones (the dev level picker's arrows).
export function renderRulesPage(ctx, list, index, t) {
  const i = ((index % list.length) + list.length) % list.length;
  const page = list[i];
  ctx.save();
  ctx.textAlign = 'center';
  drawText(ctx, 'PERCH — RULES', W / 2, 64, 24, 'rgba(255,255,255,0.62)', 700);
  const titleSize = fitTitleSize(ctx, page.title, W - 64, 38, 24);
  drawText(ctx, page.title, W / 2, 138, titleSize, '#ffe27a', 800);
  drawArt(ctx, page.art, t);

  const textTop = page.art ? 656 : 300;
  const { size, lh, pgap, blocks } = layoutBody(ctx, page.lines, TEXT_BOTTOM - textTop);
  ctx.font = `400 ${size}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.globalAlpha = 0.95;
  let y = textTop;
  blocks.forEach((block, bi) => {
    for (const ln of block) { ctx.fillText(ln, W / 2, y); y += lh; }
    if (bi < blocks.length - 1) y += pgap;
  });
  ctx.globalAlpha = 1;

  signatureBird(ctx, t);
  drawText(ctx, `Page ${i + 1} of ${list.length}`, W / 2, 1112, 21, 'rgba(255,255,255,0.62)', 700);
  drawText(ctx, '‹ Back', 140, 1224, 36, '#fff8e0', 800);
  drawText(ctx, 'Next ›', W - 140, 1224, 36, '#fff8e0', 800);
  ctx.restore();
}
