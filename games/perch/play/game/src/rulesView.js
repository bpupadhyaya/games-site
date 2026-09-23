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

// The text-size stepper: an index into this list, never a raw float. Persisted by game.js in its
// own prefs storage. Always look it up with `?? 1` and clamp any loaded value to this range - a
// stale index from a build with a shorter array must never produce a NaN/undefined font size.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// Same header row as the "PERCH — RULES" caption, one in each top corner, clear of that centred
// label and clear of the framed panel below it.
export const TEXT_DEC_BOX = { x0: 16, y0: 22, x1: 164, y1: 92 };
export const TEXT_INC_BOX = { x0: W - 164, y0: 22, x1: W - 16, y1: 92 };

// The framed reader-card panel behind every page's title, art and body text - a rounded rect with
// a soft gradient fill and a thin gold double border, matching this game's own dusk/gold palette
// (the HUD's gold accents, the sunset sky). Drawn first, everything else on the page sits on it.
const PANEL = { x: 16, y: 100, w: W - 32, h: 980, r: 26 };

// Text always stays clear of the Back/Next row: every page uses the size below (for the current
// text-scale step), falling back to a smaller size only as a last-resort safety net - the real fix
// for a page that does not fit is to split it in content.js, not to quietly shrink its font below
// every other page's.
const TEXT_BOTTOM = 1064;
const TEXT_MAXW = W - 108;
const BODY_BASE = 26;
const TITLE_BASE = 34;
const HEADER_BASE = 22;
const FOOTER_BASE = 21;
const NAV_BASE = 36;
// The lowest this ladder will ever go, even on the last-resort safety net.
const BODY_FLOOR = 20;

// A full descending ladder from the scale's own top size down to BODY_FLOOR, 2px at a time - not
// just a handful of near-top candidates then a hard drop to a fixed floor. That old 5-candidates-
// then-cliff shape (top..top-8, then straight to 18) meant that once the text-size stepper reached
// its 300% step, almost every page's paragraph no longer fit any of the near-top candidates and
// fell all the way to the tiny fixed floor - visibly SMALLER than the default 100% step, exactly
// backwards from what the "bigger text" control promises. A fine-grained ladder finds the largest
// size that actually fits, which measured out at roughly 35-55px across every page in this game at
// the top step - comfortably bigger than the 100% default, never the old floor.
function bodySizesFor(scale) {
  const top = Math.round(BODY_BASE * scale);
  const sizes = [];
  for (let s = top; s > BODY_FLOOR; s -= 2) sizes.push(s);
  sizes.push(BODY_FLOOR);
  return sizes;
}

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

// Picks the largest body size for this scale step (and matching spacing) whose wrapped paragraphs
// fit `budget` px. In normal operation the top size always fits, because content.js keeps every
// page short enough at the top text-size step; the smaller sizes below it are only a safety net.
function layoutBody(ctx, paragraphs, budget, scale) {
  let best = null;
  for (const size of bodySizesFor(scale)) {
    ctx.font = `400 ${size}px ${FONT}`;
    const lh = Math.round(size * 1.42), pgap = Math.round(size * 0.85);
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

// Same shrink-to-fit principle as fitTitleSize, generalised for every OTHER fixed-position
// single-line label on this page (the header caption, the footer page count, "‹ Back"/"Next ›") -
// each of those used to just grow with `scale` with no upper bound, which was fine while the top
// step was a modest 1.3x/2x but breaks at 3x: the header ran into the A-/A+ buttons and even the
// panel below it, and Back/Next ran off both edges of the screen and up into the footer. Shrinking
// each to its own box, the same way the title already shrinks to the page width, fixes all three
// without touching their position, colour or weight.
function fitLineSize(ctx, text, maxW, start, floor, weight = 700) {
  let size = start;
  ctx.font = `${weight} ${size}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && size > floor) { size -= 1; ctx.font = `${weight} ${size}px ${FONT}`; }
  return size;
}

// A- / A+ text buttons in the game's own no-chrome label style (the same plain, stroked text as
// "‹ Back" / "Next ›" below) - dimmed when that end of the scale is already reached.
function stepButton(ctx, box, label, disabled) {
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2 + 13;
  ctx.save();
  ctx.globalAlpha = disabled ? 0.32 : 1;
  drawText(ctx, label, cx, cy, 38, '#fff8e0', 800);
  ctx.restore();
}

function drawPanel(ctx) {
  const { x, y, w, h, r } = PANEL;
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(24,38,30,0.66)'); g.addColorStop(1, 'rgba(10,14,16,0.74)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = 'rgba(255,226,122,0.5)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, r - 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(x + 9, y + 9, w - 18, h - 18, r - 7); ctx.stroke();
  ctx.restore();
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
    // Centred lower than the other mini-scenes on this page (380 -> 425): this is the one page
    // whose title needs to shrink (long title) rather than just sit at its usual size, and even
    // shrunk, its baseline moves below the old fixed 138 at the larger text-size steps - this
    // keeps the level-1 tree's crown clear of it at every step instead of only at the default one.
    for (const c of cols) {
      for (const tr of fitTrees(c.trees, c.x, 425, 190, 280)) drawTree(ctx, tr);
      drawText(ctx, c.label, c.x, 597, 20, '#fff8e0', 800);
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
// as this game's own bottom-corner tap zones (the dev level picker's arrows). `scaleIdx` is the
// player's chosen text-size step (see TEXT_SCALES) - always guarded, never trusted un-clamped.
export function renderRulesPage(ctx, list, index, t, scaleIdx = 0) {
  const i = ((index % list.length) + list.length) % list.length;
  const page = list[i];
  const scale = TEXT_SCALES[scaleIdx] ?? 1;
  ctx.save();
  ctx.textAlign = 'center';
  drawPanel(ctx);
  // Kept clear of both A-/A+ buttons (and, past that, shrunk further rather than run under the
  // panel below it) - see fitLineSize.
  const headerText = 'PERCH — RULES';
  const headerMaxW = TEXT_INC_BOX.x0 - TEXT_DEC_BOX.x1 - 24;
  const headerSize = fitLineSize(ctx, headerText, headerMaxW, Math.round(HEADER_BASE * scale), 14);
  drawText(ctx, headerText, W / 2, 64, headerSize, 'rgba(255,255,255,0.62)', 700);
  stepButton(ctx, TEXT_DEC_BOX, 'A−', scaleIdx === 0);
  stepButton(ctx, TEXT_INC_BOX, 'A+', scaleIdx === TEXT_SCALES.length - 1);
  // The floor is a fixed size, never scaled up with the rest of the page - at the top text-size
  // step a long title needs real room to shrink into, or it silently overflows past the panel's
  // edges instead of ever getting small enough to fit (this happened at 200% before the fix).
  const titleSize = fitTitleSize(ctx, page.title, W - 64, Math.round(TITLE_BASE * scale), 22);
  // A short title that never needed to shrink grows a lot at the top text-size step (up to
  // TITLE_BASE * 2) - keep its ascender clear of the panel's top border by nudging the baseline
  // down as the title itself gets taller. At every size this game shipped before, that formula
  // lands within a pixel of the old fixed 138, so this is invisible below the new top step.
  const titleY = Math.max(138, 112 + Math.round(titleSize * 0.8));
  drawText(ctx, page.title, W / 2, titleY, titleSize, '#ffe27a', 800);
  drawArt(ctx, page.art, t);

  const textTop = page.art ? 656 : 300;
  const { size, lh, pgap, blocks } = layoutBody(ctx, page.lines, TEXT_BOTTOM - textTop, scale);
  ctx.font = `400 ${size}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.globalAlpha = 0.95;
  let y = textTop;
  blocks.forEach((block, bi) => {
    for (const ln of block) { ctx.fillText(ln, W / 2, y); y += lh; }
    if (bi < blocks.length - 1) y += pgap;
  });
  ctx.globalAlpha = 1;

  signatureBird(ctx, t);
  const footerText = `Page ${i + 1} of ${list.length}`;
  const footerSize = fitLineSize(ctx, footerText, W - 48, Math.round(FOOTER_BASE * scale), 14);
  drawText(ctx, footerText, W / 2, 1112, footerSize, 'rgba(255,255,255,0.62)', 700);
  // Each nav label is kept inside its own tap zone's width, never the screen edge or the other
  // label - at the 300% step an unshrunk NAV_BASE ran both labels off-screen and up into the
  // footer above them (see fitLineSize).
  // On the last page the label reads "Done" (game.js exits to the title on tap) instead of a
  // dead-end "Next ›" that just wraps back to page one.
  const nextLabel = i === list.length - 1 ? 'Done' : 'Next ›';
  const backSize = fitLineSize(ctx, '‹ Back', RULES_BACK_BOX.x1 - RULES_BACK_BOX.x0 - 24, Math.round(NAV_BASE * scale), 18, 800);
  const nextSize = fitLineSize(ctx, nextLabel, RULES_NEXT_BOX.x1 - RULES_NEXT_BOX.x0 - 24, Math.round(NAV_BASE * scale), 18, 800);
  drawText(ctx, '‹ Back', 140, 1224, backSize, '#fff8e0', 800);
  drawText(ctx, nextLabel, W - 140, 1224, nextSize, '#ffe27a', 800);
  ctx.restore();
}
