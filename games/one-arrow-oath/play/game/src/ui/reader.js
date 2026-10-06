// The help reader (How to Play / About / Rules): ONE scrolling page per tab, laid out from the live screen size (native frame).
// Text-size steps (100% .. 300%) change the type only; nothing is paginated, so any size is reachable by scrolling
// (drag, mouse wheel, arrow / page keys, or the scroll bar). Pure geometry + drawing; the input lives in game.js.
import { ELEMENTS } from '../data/cards.js';
import { HOW_TO_PLAY, ABOUT, CREDITS } from '../data/help.js';
import { RULES_REFERENCE } from '../data/rules_reference.js';
import { C, alpha, font } from './theme.js';
import { button, diamond, drawCard, drawRing, goldFoil, icon, panel, roundRect, text, tracked, wrap } from './draw.js';
import { host } from './frame.js';
import { CARD_H, CARD_W, TEXT_SCALES } from './layout.js';

const R = (x, y, w, h) => ({ x, y, w, h });
export const TABS = ['How to Play', 'About', 'Rules'];

// Live geometry for a screen of w x h units (short side 720).
export function readerLayout(w, h) {
  const m = 12;
  const x0 = host.l + m;
  const x1 = w - host.r - m;
  const y0 = host.t + m;
  const y1 = h - host.b - m;
  const wide = x1 - x0 >= 900;
  const BH = 76;
  const hb = host.back > 0 ? host.back + 12 : 0; // the host's floating back button owns the top-left corner
  const L = { panel: R(x0, y0, x1 - x0, y1 - y0), wide, BH };
  const pad = 16;
  let top;
  if (wide) {
    const tabW = 168;
    const tx = x0 + pad + hb;
    L.tabs = [0, 1, 2].map((i) => R(tx + i * (tabW + 12), y0 + pad, tabW, BH));
    L.inc = R(x1 - pad - 96, y0 + pad, 96, BH);
    L.dec = R(x1 - pad - 96 - 12 - 96, y0 + pad, 96, BH);
    L.title = null;
    top = y0 + pad + BH + 12;
  } else {
    L.dec = R(x0 + pad + hb, y0 + pad, 96, 72);
    L.inc = R(x1 - pad - 96, y0 + pad, 96, 72);
    L.title = { x: (L.dec.x + L.dec.w + L.inc.x) / 2, y: y0 + pad + 46 };   // centred in the gap between A- and A+ (the back button shifts A-)
    const tw = Math.min(200, (x1 - x0 - 2 * pad - 24) / 3);
    const tx = (x0 + x1) / 2 - (3 * tw + 24) / 2;
    L.tabs = [0, 1, 2].map((i) => R(tx + i * (tw + 12), y0 + pad + 72 + 12, tw, BH));
    top = y0 + pad + 72 + 12 + BH + 12;
  }
  const closeW = 340;
  L.close = R((x0 + x1) / 2 - closeW / 2, y1 - pad - BH, closeW, BH);
  const colW = Math.min(x1 - x0 - 2 * pad - 56, 760);
  const cx = (x0 + x1) / 2;
  L.vp = R(cx - colW / 2, top, colW, L.close.y - 12 - top);
  L.bar = R(L.vp.x + L.vp.w + 6, L.vp.y, 40, L.vp.h);
  return L;
}

// ---------------------------------------------------------------- content
function mergedRules() {
  const out = [];
  for (const p of RULES_REFERENCE) {
    const last = out[out.length - 1];
    if (last && last.title === p.title && !p.demo) last.lines.push(...p.lines);
    else if (last && last.title === p.title && p.demo && !last.demo) {
      last.demo = p.demo;
      last.lines.push(...p.lines);
    } else out.push({ title: p.title, demo: p.demo ?? null, lines: [...p.lines] });
  }
  // consecutive fragments of one topic read as one paragraph
  return out.map((sec) => ({ ...sec, text: sec.lines.join(' ').replace(/\s+/g, ' ').trim() }));
}
const RULES = mergedRules();

const cache = new Map();
// Blocks with their heights, for one tab at one text step and column width.
export function contentFor(ctx, tab, scale, cw, version) {
  const key = `${tab}|${scale}|${Math.round(cw)}|${version}`;
  let c = cache.get(key);
  if (c) return c;
  const blocks = [];
  const measure = (str, size, weight, display, maxW) => {
    ctx.save();
    ctx.font = font(size, weight, display);
    const lines = wrap(ctx, str, maxW);
    ctx.restore();
    return lines;
  };
  const gap = 22 * scale;
  if (tab === 0) {
    HOW_TO_PLAY.forEach((step) => {
      const iconW = 84;
      const tSize = 28 * scale;
      const bSize = 25 * scale;
      const tl = measure(step.title, tSize, 700, true, cw - iconW);
      const bl = measure(step.text, bSize, 400, false, cw - iconW);
      const h = Math.max(tl.length * tSize * 1.2 + bl.length * bSize * 1.34 + 6, 68);
      blocks.push({ k: 'step', step, tl, bl, tSize, bSize, h, gap: 42 * scale });
    });
    blocks.push({ k: 'ring', title: 'The element ring', note: 'Each element beats the next one around the ring.', tSize: 28 * scale, h: 28 * scale * 1.3 + 190 + 60 * Math.min(scale, 1.5), gap });
  } else if (tab === 1) {
    ABOUT.forEach((para) => {
      const size = (para.lead ? 30 : 27) * scale;
      const lines = measure(para.text, size, para.lead ? 700 : 400, !!para.lead, cw);
      blocks.push({ k: 'para', lines, size, lead: !!para.lead, h: lines.length * size * 1.4, gap: para.lead ? 10 * scale : gap });
    });
    blocks.push({ k: 'foot', lines: [`Version ${version ?? ''}`, CREDITS], h: 74, gap: 0 });
  } else {
    RULES.forEach((sec) => {
      const tSize = 31 * scale;
      const bSize = 26 * scale;
      const tl = measure(sec.title, tSize, 700, true, cw);
      const bl = sec.text ? measure(sec.text, bSize, 400, false, cw) : [];
      const demoH = sec.demo === 'cards' ? 290 : sec.demo === 'ring' ? 190 : 0;
      blocks.push({ k: 'rule', sec, tl, bl, tSize, bSize, demoH, h: tl.length * tSize * 1.25 + 10 + demoH + bl.length * bSize * 1.4, gap: 34 * scale });
    });
  }
  let y = 0;
  for (const b of blocks) {
    b.y = y;
    y += b.h + b.gap;
  }
  c = { blocks, height: Math.max(0, y - (blocks.length ? blocks[blocks.length - 1].gap : 0)) + 6 };
  cache.set(key, c);
  if (cache.size > 24) cache.delete(cache.keys().next().value);
  return c;
}

export const readerScale = (idx) => TEXT_SCALES[idx] ?? 1;

export function readerMax(ctx, o, textScaleIdx, L, version) {
  const c = contentFor(ctx, o.page, readerScale(textScaleIdx), L.vp.w, version);
  return Math.max(0, c.height - L.vp.h);
}

// ---------------------------------------------------------------- drawing
function drawBlock(ctx, b, x0, w, scale) {
  const cx = x0 + w / 2;
  if (b.k === 'step') {
    const iconY = b.tSize * 0.7;
    diamond(ctx, x0 + 34, iconY, 30);
    ctx.fillStyle = '#0a0c24';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = goldFoil(ctx, x0 + 4, iconY - 30, x0 + 64, iconY + 30);
    ctx.stroke();
    icon(ctx, b.step.icon, x0 + 34, iconY, 26, C.goldLight, 2.6);
    let y = b.tSize;
    for (const ln of b.tl) {
      text(ctx, ln, x0 + 84, y, { size: b.tSize, weight: 700, align: 'left', color: C.goldLight, display: true });
      y += b.tSize * 1.2;
    }
    y += b.bSize * 0.12;
    for (const ln of b.bl) {
      text(ctx, ln, x0 + 84, y + b.bSize * 0.9, { size: b.bSize, align: 'left', color: C.inkSoft });
      y += b.bSize * 1.34;
    }
  } else if (b.k === 'ring') {
    text(ctx, b.title, cx, b.tSize, { size: b.tSize, weight: 700, color: C.goldLight, display: true });
    drawRing(ctx, cx, b.tSize * 1.3 + 100, 64, ELEMENTS, {});
    text(ctx, b.note, cx, b.h - 18, { size: 21 * Math.min(scale, 1.5), color: C.muted });
  } else if (b.k === 'para') {
    let y = b.size * 0.95;
    for (const ln of b.lines) {
      text(ctx, ln, cx, y, { size: b.size, weight: b.lead ? 700 : 400, color: b.lead ? C.goldLight : C.inkSoft, display: b.lead });
      y += b.size * 1.4;
    }
  } else if (b.k === 'foot') {
    text(ctx, b.lines[0], cx, 24, { size: 19, color: C.muted });
    text(ctx, b.lines[1], cx, 54, { size: 18, color: C.muted });
  } else if (b.k === 'rule') {
    let y = b.tSize;
    for (const ln of b.tl) {
      text(ctx, ln, x0, y, { size: b.tSize, weight: 700, align: 'left', color: C.goldLight, display: true });
      y += b.tSize * 1.25;
    }
    y += 10 - b.tSize * 0.25;
    if (b.sec.demo === 'cards') {
      for (const [dx, id, t, label, col] of [[-110, 'first_promise', 0, 'An Arrow', C.goldLight], [110, 'reed', 0.3, 'A Technique', C.inkSoft]]) {
        ctx.save();
        ctx.translate(cx + dx, y + 120);
        drawCard(ctx, id, CARD_W, CARD_H, { t, lit: true });
        ctx.restore();
        text(ctx, label, cx + dx, y + 258, { size: 19, color: col });
      }
      y += 290;
    } else if (b.sec.demo === 'ring') {
      drawRing(ctx, cx, y + 84, 64, ELEMENTS, {});
      y += 190;
    }
    for (const ln of b.bl) {
      text(ctx, ln, x0, y + b.bSize * 0.95, { size: b.bSize, align: 'left', color: C.inkSoft });
      y += b.bSize * 1.4;
    }
  }
}

export function drawReader(ctx, s, o, w, h, version) {
  const L = readerLayout(w, h);
  const scale = readerScale(s.textScaleIdx);
  panel(ctx, L.panel);
  button(ctx, L.dec, 'A−', { quiet: true, size: 24, disabled: s.textScaleIdx === 0 });
  button(ctx, L.inc, 'A+', { quiet: true, size: 24, disabled: s.textScaleIdx === TEXT_SCALES.length - 1 });
  if (L.title) tracked(ctx, 'One Arrow Oath', L.title.x, L.title.y, { size: 28, spacing: 5, maxWidth: L.inc.x - L.dec.x - L.dec.w - 24, fill: goldFoil(ctx, L.title.x - 190, 0, L.title.x + 190, 0), glow: alpha(C.gold, 0.5) });
  else text(ctx, `Text ${Math.round(scale * 100)}%`, L.dec.x - 70, L.dec.y + L.dec.h / 2 + 8, { size: 18, color: C.muted, align: 'right' });
  if (L.title) text(ctx, `${Math.round(scale * 100)}%`, L.title.x, L.title.y + 24, { size: 14, color: C.muted });
  TABS.forEach((label, i) => button(ctx, L.tabs[i], label, { size: 22, primary: o.page === i, quiet: o.page !== i }));

  const c = contentFor(ctx, o.page, scale, L.vp.w, version);
  const max = Math.max(0, c.height - L.vp.h);
  o.scroll = Math.max(0, Math.min(max, o.scroll || 0));
  ctx.save();
  ctx.beginPath();
  ctx.rect(L.vp.x - 8, L.vp.y, L.vp.w + 16, L.vp.h);
  ctx.clip();
  for (const b of c.blocks) {
    const y = L.vp.y + b.y - o.scroll;
    if (y > L.vp.y + L.vp.h || y + b.h < L.vp.y) continue;
    ctx.save();
    ctx.translate(0, y);
    drawBlock(ctx, b, L.vp.x, L.vp.w, scale);
    ctx.restore();
  }
  ctx.restore();
  // soft fades at the clip edges tell the reader there is more
  if (o.scroll > 2) {
    const g = ctx.createLinearGradient(0, L.vp.y, 0, L.vp.y + 28);
    g.addColorStop(0, 'rgba(10,13,34,0.95)');
    g.addColorStop(1, 'rgba(10,13,34,0)');
    ctx.fillStyle = g;
    ctx.fillRect(L.vp.x - 8, L.vp.y, L.vp.w + 16, 28);
  }
  if (o.scroll < max - 2) {
    const g = ctx.createLinearGradient(0, L.vp.y + L.vp.h - 28, 0, L.vp.y + L.vp.h);
    g.addColorStop(0, 'rgba(10,13,34,0)');
    g.addColorStop(1, 'rgba(10,13,34,0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(L.vp.x - 8, L.vp.y + L.vp.h - 28, L.vp.w + 16, 28);
  }
  if (max > 0) {
    const tr = { x: L.bar.x + 12, y: L.vp.y + 4, w: 10, h: L.vp.h - 8 };
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, tr.x, tr.y, tr.w, tr.h, 5);
    ctx.fill();
    const th = Math.max(48, (tr.h * L.vp.h) / c.height);
    const ty = tr.y + (tr.h - th) * (o.scroll / max);
    ctx.fillStyle = alpha(C.gold, 0.9);
    roundRect(ctx, tr.x, ty, tr.w, th, 5);
    ctx.fill();
  }
  button(ctx, L.close, 'Close', { size: 26, primary: true });
  return { L, max };
}
