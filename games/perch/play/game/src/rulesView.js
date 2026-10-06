// Drawing for the Rules reference: ONE scrolling reader (drag, wheel, keys, scroll bar) holding every page of content.js as a
// section: title, illustration, text. Every illustration reuses the game's OWN drawing functions from render.js (the exact
// hunter, tree, stone, seed, acorn, wind and beater art the player sees in a real run) against small hand-built scenes -
// never a separate simplified icon. Text size 100 % .. 300 % (TEXT_SCALES); sections are measured once per size and cached.
// Drawing only: reads nothing from live game state, mutates nothing but the exported metrics.
import { drawText, drawTree, hunter, telegraph, stones, seeds, beaters, nuts, bird, hud, FONT, setViewEdge } from './render.js';
import { BOSS_SLOT } from './tuning.js';
import { levelDef } from './levels.js';
import { TEXT_SCALES } from './layout.js';
import { drawButton } from './ui.js';

export { TEXT_SCALES };
// Set by renderRules each frame: how far the reader can scroll and how tall its viewport is (update() needs both).
export const rulesMetrics = { max: 0, view: 0 };

const BODY_BASE = 26, TITLE_BASE = 34;
// The art was authored on a 720 x 1280 page; each illustration occupies a band of it. The reader clips to that band and moves it
// up under its title, so a page is only as tall as its picture.
const ART_RANGE = { default: [250, 650], hero: [430, 780], boss: [300, 795], hud: [290, 480], field: [270, 612], telegraph: [290, 640], pair: [470, 640], trick: [300, 640], 'hunter-arrow': [290, 640],
  net: [230, 620], seeds: [240, 600], acorn: [370, 640], wind: [210, 600], beater: [210, 600], stone: [220, 480] };
export const artRange = (a) => ART_RANGE[a.kind] || ART_RANGE.default;

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

const THREE = [{ dx: -95, dy: -244 }, { dx: 0, dy: -324 }, { dx: 95, dy: -244 }];

export function drawArt(ctx, art, t) {
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
    drawTree(ctx, tree);
    beaters(ctx, { beaters: [{ perch: 0, timer, total: 1.1 }], perches, trees: [tree] }, t);
  } else if (art.kind === 'boss') {
    const { tree, perches } = miniTree(360, 780, 0.7);
    const h = { slot: BOSS_SLOT, phase: 'pull', timer: 0.5, total: 1.3, kind: 'flat', target: 0, cancel: false };
    drawTree(ctx, tree);
    telegraph(ctx, { hunters: [h], trees: [tree], perches }, t);
    hunter(ctx, h, t, perches);
  } else if (art.kind === 'stone') {
    // a lobbed stone in flight over a tree; the whole arc stays inside this band (a taller arc was clipped away)
    const { tree, perches } = miniTree(360, 540, 0.6, THREE, 1);
    drawTree(ctx, tree);
    stones(ctx, { stones: [{ id: 1, slot: -1, kind: 'lob', target: 2, flight: 1, age: 0.5, threat: false, arc: 90, follow: true, fromPerch: 0 }], perches }, t);
  }
}


function wrap(ctx, text, maxW) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  lines.push(line);
  return lines;
}

// Section layout for one (text size, widths): { items: [{ y, h, title lines, art, text blocks }], total }. Cached.
let cached = null;
function measure(ctx, list, scaleIdx, textW, vpW) {
  const key = scaleIdx + '|' + Math.round(textW) + '|' + Math.round(vpW);
  if (cached && cached.key === key && cached.list === list) return cached;
  const scale = TEXT_SCALES[scaleIdx] ?? 1;
  const tsz = Math.round(TITLE_BASE * scale), bsz = Math.round(BODY_BASE * scale);
  const tlh = Math.round(tsz * 1.2), blh = Math.round(bsz * 1.42), pgap = Math.round(bsz * 0.85);
  const as = Math.min(1, (vpW - 16) / 720);
  const items = [];
  let y = 24;
  for (const page of list) {
    ctx.font = `800 ${tsz}px ${FONT}`;
    const tl = wrap(ctx, page.title, Math.min(vpW - 40, 860));
    ctx.font = `400 ${bsz}px ${FONT}`;
    const blocks = page.lines.map((p) => wrap(ctx, p, textW));
    const it = { y, page, tl, blocks, tsz, bsz, tlh, blh, pgap, as };
    let hh = tl.length * tlh + 14;
    it.artY = y + hh; if (page.art) { const [r0, r1] = artRange(page.art); hh += (r1 - r0) * as + 18; }
    it.textY = y + hh; hh += blocks.reduce((a, b) => a + b.length * blh, 0) + (blocks.length - 1) * pgap;
    it.h = hh; y += hh + Math.round(64 + 24 * scale);
    items.push(it);
  }
  cached = { key, list, items, total: y };
  return cached;
}

// Draws the whole reader (card, header, A-/A+, scrolling sections, scroll bar, Back / Next). `scroll` is clamped here and the
// clamped value returned. Layout comes from layout.js (L.rules, L.btn.rules).
export function renderRules(ctx, list, scroll, scaleIdx, t, L) {
  const RL = L.rules, vp = RL.viewport, B = L.btn.rules;
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,24,0.86)'; ctx.fillRect(0, 0, L.w, L.h);
  const { card } = RL;
  const g = ctx.createLinearGradient(0, card.y, 0, card.y + card.h);
  g.addColorStop(0, 'rgba(24,38,30,0.72)'); g.addColorStop(1, 'rgba(10,14,16,0.8)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(card.x, card.y, card.w, card.h, 26); ctx.fill();
  ctx.strokeStyle = 'rgba(255,226,122,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(card.x + 2, card.y + 2, card.w - 4, card.h - 4, 24); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(card.x + 9, card.y + 9, card.w - 18, card.h - 18, 19); ctx.stroke();

  const m = measure(ctx, list, scaleIdx, RL.textW, vp.w);
  rulesMetrics.view = vp.h;
  rulesMetrics.max = m.total - vp.h <= 8 ? 0 : Math.ceil(m.total - vp.h);
  const sc = Math.max(0, Math.min(scroll || 0, rulesMetrics.max));

  // header
  drawText(ctx, 'PERCH — RULES', RL.cx - 40, RL.headerY, 22, 'rgba(255,255,255,0.7)', 700);
  drawButton(ctx, B.dec, 'A−', { size: 34, disabled: scaleIdx === 0 });
  drawButton(ctx, B.inc, 'A+', { size: 34, disabled: scaleIdx === TEXT_SCALES.length - 1 });
  ctx.strokeStyle = 'rgba(255,226,122,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(card.x + 20, vp.y - 4); ctx.lineTo(card.x + card.w - 20, vp.y - 4); ctx.stroke();

  // sections
  ctx.save();
  ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w, vp.h); ctx.clip();
  ctx.translate(0, vp.y - sc);
  const cx = RL.cx;
  setViewEdge(0, 720);
  for (const it of m.items) {
    if (it.y + it.h < sc - 40 || it.y > sc + vp.h + 40) continue;
    ctx.textAlign = 'center';
    it.tl.forEach((ln, i) => drawText(ctx, ln, cx, it.y + it.tsz * 0.9 + i * it.tlh, it.tsz, '#ffe27a', 800));
    if (it.page.art) {
      ctx.save();
      const [r0, r1] = artRange(it.page.art);
      ctx.translate(cx - 360 * it.as, it.artY - r0 * it.as); ctx.scale(it.as, it.as);
      ctx.beginPath(); ctx.rect(0, r0, 720, r1 - r0); ctx.clip();
      drawArt(ctx, it.page.art, t);
      ctx.restore();
    }
    ctx.font = `400 ${it.bsz}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.globalAlpha = 0.95;
    let y = it.textY + it.bsz;
    it.blocks.forEach((block, bi) => {
      for (const ln of block) { ctx.fillText(ln, cx, y); y += it.blh; }
      if (bi < it.blocks.length - 1) y += it.pgap;
    });
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // scroll bar + footer
  if (rulesMetrics.max > 0) {
    const sb = RL.scrollbar, th = Math.max(48, (sb.h * vp.h) / m.total), ty = sb.y + (sc / rulesMetrics.max) * (sb.h - th);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,226,122,0.85)'; ctx.beginPath(); ctx.roundRect(sb.x, ty, sb.w, th, 5); ctx.fill();
  }
  const atEnd = rulesMetrics.max === 0 || sc >= rulesMetrics.max - 2;
  drawText(ctx, rulesMetrics.max ? Math.round((sc / rulesMetrics.max) * 100) + '%  ·  drag or scroll' : '', cx, RL.footY, 20, 'rgba(255,255,255,0.6)', 700);
  drawButton(ctx, B.back, '‹ Back', { size: 34 });
  drawButton(ctx, B.next, atEnd ? 'Done' : 'Next ›', { size: 34, primary: true });
  ctx.restore();
  return sc;
}
