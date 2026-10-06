// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Board, table and pieces are cached sprites (art.js).
// Every position comes from the layout `L` for the live screen size (layout.js); the board itself is drawn in canonical space
// through one transform (L.play(scene): scale f, centre cx, cy).
import { K, CX, CY, PLAY, sx, sy, BX, BY, TEXT_SCALES, AUTO_THINK_STEPS } from './layout.js';
import { drawTable, drawBoardOnly, drawPiece, THEMES } from './art.js';
import { R_COIN, R_STR, BASE_Y, trace, striker as findStriker } from './physics.js';
import { down, SIDE_NAME } from './rules.js';
import { AI_LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { flowOf } from './pages.js';
import { drawLockup, drawMoreLine } from './brand.js';

const FONT = '"Fredoka", "Trebuchet MS", system-ui, sans-serif', TAU = Math.PI * 2;
const GOLD = '#f6d58a', CREAM = '#fff3d6';
const R4 = (x, y, w, h) => ({ x, y, w, h });

// How far the current reader page overflows its viewport (set while drawing; game.js clamps scrolling with it).
export const reader = { max: 0 };
const flowCache = new Map();

export function render(ctx, state, L) {
  ctx.save();
  draw(ctx, state, L); ctx.restore();
}
function draw(ctx, state, L) {
  const bs = Math.min(TEXT_SCALES[state.textScaleIdx] ?? 1, 1.16), ts = TEXT_SCALES[state.textScaleIdx] ?? 1, sc = state.scene, t = state.t, g = state.g;
  const W = L.w, H = L.h, FL = L.minText;
  const text = (str, x, y, size, color = CREAM, align = 'center', weight = 600) => { ctx.textAlign = align; ctx.font = `${weight} ${Math.max(size, FL)}px ${FONT}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  // the largest size <= size (not below ~0.85 of the floor) at which `str` fits `maxW`
  const fit = (str, maxW, size, weight = 600) => { let s = size; const lo = FL * 0.85; ctx.font = `${weight} ${s}px ${FONT}`; while (s > lo && ctx.measureText(str).width > maxW) { s = Math.max(lo, s * 0.93); ctx.font = `${weight} ${s}px ${FONT}`; } return s; };
  const fitText = (str, x, y, size, maxW, color = CREAM, align = 'center', weight = 600) => { const s = fit(str, maxW, Math.max(size, FL), weight); ctx.textAlign = align; ctx.font = `${weight} ${s}px ${FONT}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const lines = (str, size, maxW, weight = 500) => {
    ctx.font = `${weight} ${size}px ${FONT}`; const out = [];
    for (const para of String(str).split('\n')) { let cur = ''; for (const w of para.split(' ')) { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > maxW && cur) { out.push(cur); cur = w; } else cur = tt; } out.push(cur); }
    return out;
  };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.28, align = 'center', weight = 500) => {
    size = Math.max(size, FL); const out = lines(str, size, maxW, weight);
    out.forEach((ln, i) => text(ln, x, y + i * lh, size, color, align, weight)); return out.length;
  };
  // wrapped text shrunk until it fits the rectangle (down to the text floor); vertically centred when `vc`
  const wrapIn = (str, r, size, color = CREAM, o = {}) => {
    const align = o.align ?? 'center', weight = o.weight ?? 500, pad = o.pad ?? 12, tw = r.w - 2 * pad; let s = Math.max(size, FL), out;
    for (;;) { out = lines(str, s, tw, weight); if (out.length * s * 1.26 <= r.h - 2 * (o.vpad ?? 6) || s <= FL) break; s = Math.max(FL, s * 0.94); }
    const lh = s * 1.26, total = out.length * lh, y0 = o.vc ? r.y + (r.h - total) / 2 : r.y + (o.vpad ?? 6);
    const x = align === 'center' ? r.x + r.w / 2 : align === 'left' ? r.x + pad : r.x + r.w - pad;
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    out.forEach((ln, i) => text(ln, x, y0 + s * 0.92 + i * lh, s, color, align, weight)); ctx.restore(); return s;
  };
  const shadowText = (str, x, y, size, color, align = 'center', weight = 700, maxW = 0) => { const s = maxW ? fit(str, maxW, Math.max(size, FL), weight) : size; text(str, x + 2, y + 4, s, 'rgba(0,0,0,0.55)', align, weight); text(str, x, y, s, color, align, weight); };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.45;
    const press = o.press ? 3 : 0, rad = Math.min(r.h * 0.3, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 6, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#ffe08e'); gr.addColorStop(0.5, '#f0b445'); gr.addColorStop(1, '#c47f1c'); }
    else { gr.addColorStop(0, o.tone ?? '#7d4a25'); gr.addColorStop(1, '#3f2210'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y + press, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,245,200,0.9)' : 'rgba(255,214,150,0.45)'; ctx.lineWidth = 2; ctx.stroke();
    const want = (o.size ?? (r.h > 80 ? 36 : 30)) * (o.noscale ? 1 : Math.min(bs, 1.08)), sub = o.sub && r.h >= 74 ? o.sub : '';
    const s = label ? fit(label, r.w - 26, want, 700) : want, cy = r.y + press + (sub ? r.h * 0.42 : r.h / 2);
    if (label) text(label, r.x + r.w / 2, cy + s * 0.34, s, o.primary ? '#3a1e05' : CREAM, 'center', 700);
    if (sub) { ctx.font = `500 ${FL}px ${FONT}`; if (ctx.measureText(sub).width <= r.w - 20) text(sub, r.x + r.w / 2, r.y + r.h - 14, FL, o.primary ? 'rgba(58,30,5,0.7)' : 'rgba(255,243,214,0.65)', 'center', 500); }
    ctx.restore();
  };
  const panel = (r, a = 0.8, rad = 26) => { ctx.fillStyle = `rgba(22,11,5,${a})`; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill(); ctx.strokeStyle = 'rgba(255,214,150,0.35)'; ctx.lineWidth = 2; ctx.stroke(); };
  const coinAt = (k, px, py, s = 1, lift = 0, alpha = 1) => drawPiece(ctx, k, px, py, s, lift, alpha);
  const dotted = (pts, color, w, dash, gap) => {
    ctx.save(); ctx.lineCap = 'round'; ctx.setLineDash([dash, gap]); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.restore();
  };
  const drawWorld = (world, opts = {}) => {
    for (const b of world) if (b.on && b.k !== 'S') coinAt(b.k, sx(b.x), sy(b.y), 1, 0);
    for (const b of world) if (b.on && b.k === 'S') coinAt('S', sx(b.x), sy(b.y), 1, opts.lift ?? 0);
  };
  // run fn in the board's canonical space, placed at (cx, cy) with scale f
  const inBoard = (cx, cy, f, fn) => { ctx.save(); ctx.translate(cx, cy); ctx.scale(f, f); ctx.translate(-CX, -CY); fn(); ctx.restore(); };

  // ---------------------------------------------------------------- TITLE
  if (sc === 'title') {
    const T = L.title(!!state.saved);
    drawTable(ctx, W, H);
    inBoard(T.hero.cx, T.hero.cy, T.hero.sc, () => {
      drawBoardOnly(ctx, state.theme); drawWorld(state.demo.world);
      for (const f of state.demo.fx) if (f.type === 'drop') { const a = Math.min(1, f.t / f.dur); coinAt(f.k, sx(f.x) + (sx(f.px) - sx(f.x)) * a, sy(f.y) + (sy(f.py) - sy(f.y)) * a, 1 - a * 0.6, 0, 1 - a); }
    });
    if (!L.land) {
      const gr = ctx.createLinearGradient(0, 0, 0, T.brand.y + 90); gr.addColorStop(0, 'rgba(10,4,0,0.8)'); gr.addColorStop(1, 'rgba(10,4,0,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, T.brand.y + 90);
      const d = T.dim, gr2 = ctx.createLinearGradient(0, d.y - 70, 0, d.y); gr2.addColorStop(0, 'rgba(10,4,0,0)'); gr2.addColorStop(1, 'rgba(10,4,0,0.85)'); ctx.fillStyle = gr2; ctx.fillRect(0, d.y - 70, W, 70); ctx.fillStyle = 'rgba(10,4,0,0.85)'; ctx.fillRect(0, d.y, W, d.h);
    } else {
      const gr = ctx.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, 'rgba(10,4,0,0.7)'); gr.addColorStop(1, 'rgba(10,4,0,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, T.card.x, 200);
      panel(T.card, 0.82);
    }
    const tt = T.titleText;
    ctx.save(); const tg = ctx.createLinearGradient(0, tt.y - tt.size * 0.8, 0, tt.y); tg.addColorStop(0, '#fff3c4'); tg.addColorStop(0.5, '#f4c65c'); tg.addColorStop(1, '#c07d1a');
    ctx.font = `700 ${tt.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText('Carrom', tt.x + 3, tt.y + 4); ctx.fillStyle = tg; ctx.fillText('Carrom', tt.x, tt.y); ctx.restore();
    fitText('Flick, pocket, cover the queen', T.tag.x, T.tag.y, T.tag.size, L.land ? (T.card.x - 16 - L.U.x0) - 40 : W - 40, 'rgba(255,236,190,0.95)', 'center', 500);
    { const bh = T.brand.w * 0.2725; ctx.save(); ctx.fillStyle = 'rgba(8,3,0,0.62)'; ctx.beginPath(); ctx.roundRect(T.brand.x - T.brand.w / 2 - 10, T.brand.y - bh / 2 - 6, T.brand.w + 20, bh + 12, (bh + 12) / 2); ctx.fill(); ctx.restore(); }
    drawLockup(ctx, T.brand.x, T.brand.y + (state.lkDown ? 1 : 0), T.brand.w * (state.lkDown ? 0.96 : 1), state.lkDown ? 0.7 : 1);
    const B = T.rows, lv = AI_LEVELS[state.level].name, nLearn = Object.keys(state.learned).length;
    if (B.resume) button(B.resume, 'Resume board', { primary: true, size: 36 });
    button(B.play, 'Play the computer', { primary: !B.resume, size: 36 });
    button(B.two, 'Two players', { sub: 'One phone', size: 30 });
    button(B.learn, 'Learn to play', { sub: nLearn ? `${nLearn} of ${LESSONS.length} done` : 'Start here', tone: nLearn ? undefined : '#8e5a2a', size: 30 });
    button(B.daily, 'Daily trick shot', { sub: state.daily.solvedDay === state.daily.day ? 'Solved. Streak ' + state.daily.streak : state.daily.puzzle ? 'A new shot is ready' : 'Setting up…', size: 30 });
    button(B.level, 'Level: ' + lv, { size: 28 });
    button(B.howto, 'How to play', { size: 26 }); button(B.about, 'About', { size: 26 }); button(B.rules, 'Game Rules', { size: 26 }); button(B.settings, 'Settings', { size: 26 }); button(B.auto, 'Auto Play', { size: 26 });
    if (state.dev) text('dev', T.dev.x, T.dev.y, 20, '#9f9', 'right');
    return;
  }

  // ---------------------------------------------------------------- PAGES
  const backdrop = () => { drawTable(ctx, W, H); ctx.fillStyle = 'rgba(8,3,0,0.55)'; ctx.fillRect(0, 0, W, H); };
  if (sc === 'howto' || sc === 'about' || sc === 'rules') {
    backdrop();
    const RD = L.reader;
    panel(RD.panel, 0.84);
    ctx.save(); ctx.strokeStyle = 'rgba(255,214,150,0.16)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(RD.panel.x + 8, RD.panel.y + 8, RD.panel.w - 16, RD.panel.h - 16, 20); ctx.stroke(); ctx.restore();
    const heading = sc === 'about' ? 'About' : sc === 'rules' ? 'Game Rules' : 'How to play';
    shadowText(heading, RD.title.x, RD.title.y + 14, 44, GOLD, 'left', 700, RD.dec.x - RD.title.x - 12);
    button(RD.dec, 'A−', { dim: state.textScaleIdx === 0, size: 32, noscale: true });
    button(RD.inc, 'A+', { dim: state.textScaleIdx === TEXT_SCALES.length - 1, size: 32, noscale: true });
    // ONE continuous scrolling document: every section in order (see flowOf in pages.js)
    const vp = RD.viewport, tw = RD.textW, x0 = vp.x + 4, cxv = vp.x + vp.w / 2;
    const fkey = `${sc}|${ts}|${Math.round(tw)}`;
    let F = flowCache.get(fkey);
    if (!F) {
      const items = []; let y = 4;
      for (const sec of flowOf(sc)) {
        if (sc === 'rules') {
          const tsz = 40 * Math.min(ts, 1.2), tlh = tsz * 1.15, tl = lines(sec.name, tsz, tw, 700);
          items.push({ k: 'rtitle', y, lines: tl, size: tsz, lh: tlh }); y += tl.length * tlh + (tl.length > 1 ? 20 : 30);
          if (sec.pieces) {
            const one = sec.pieces.length === 1, ay = y + (one ? 58 : 46);
            items.push({ k: 'pieces', y: ay, pieces: sec.pieces }); y = ay + (one ? 58 + Math.max(40, 26 * ts) : 46 + Math.max(78, 40 + 26 * ts));
          }
        } else if (sc === 'howto') {
          const tsz = 40 * Math.min(ts, 1.2), tlh = tsz * 1.15, tl = lines(sec.name, tsz, tw, 700);
          items.push({ k: 'rtitle', y, lines: tl, size: tsz, lh: tlh }); y += tl.length * tlh + 24;
        }
        sec.items.forEach((item, ii) => {
          if (item.h) { const sz = 34 * ts, lh = sz * 1.18, ls = lines(item.h, sz, tw, 700); items.push({ k: 'text', y, lines: ls, size: sz, lh, color: GOLD, weight: 700 }); y += ls.length * lh + 12; }
          else { const sz = 29 * ts, ls = lines(item.t, sz, tw, 500); items.push({ k: 'text', y, lines: ls, size: sz, lh: 41 * ts, color: CREAM }); y += ls.length * 41 * ts + 16; }
          if (sc === 'howto' && sec.illusAt === ii + 1) { items.push({ k: 'illus', y }); y += 270 * Math.min(1, tw / 568); }
        });
        y += 34;
      }
      F = { items, total: y }; flowCache.set(fkey, F); if (flowCache.size > 30) flowCache.delete(flowCache.keys().next().value);
    }
    const items = F.items, y = F.total;
    const max = Math.max(0, y + 6 - vp.h); reader.max = max;
    const off = Math.min(Math.max(0, state.scroll || 0), max);
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 4, vp.y, vp.w + 8, vp.h); ctx.clip(); ctx.translate(0, vp.y - off);
    for (const it of items) {
      if (it.y - off > vp.h + 400 || it.y - off < -1400) continue;
      if (it.k === 'text') it.lines.forEach((ln, i) => text(ln, x0, it.y + it.size * 0.95 + i * it.lh, it.size, it.color, 'left', it.weight ?? 500));
      else if (it.k === 'rtitle') it.lines.forEach((ln, i) => text(ln, cxv, it.y + it.size * 0.95 + i * it.lh, it.size, GOLD, 'center', 700));
      else if (it.k === 'pieces') {
        const cur = { pieces: it.pieces };
        const names = { W: 'White', B: 'Black', Q: 'Queen', S: 'Striker' };
        if (cur.pieces.length === 1) { const k = cur.pieces[0], base = (k === 'S' ? R_STR : R_COIN) * K, R = 58; coinAt(k, cxv, it.y, R / base, 0); }
        else cur.pieces.forEach((k, i) => { const px = cxv + (i === 0 ? -108 : 108), base = (k === 'S' ? R_STR : R_COIN) * K, R = 46; coinAt(k, px, it.y, R / base, 0); text(names[k] ?? '', px, it.y + R + 32, 20, 'rgba(255,240,205,0.72)', 'center', 600); });
      } else if (it.k === 'illus') {
        // a small drawing of the gesture: slide, pull back, release (drawn in its own 720-wide space, scaled to fit)
        const k = Math.min(1, tw / 568), oy = 1120; ctx.save(); ctx.translate(cxv - 360 * k, it.y - (oy - 70) * k); ctx.scale(k, k);
        ctx.fillStyle = 'rgba(232,196,128,0.22)'; ctx.beginPath(); ctx.roundRect(76, oy - 70, 568, 250, 18); ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,205,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(100, oy + 110); ctx.lineTo(620, oy + 110); ctx.stroke();
        drawPiece(ctx, 'S', 300, oy + 110, 1.1, 0.1); drawPiece(ctx, 'W', 470, oy - 10, 1, 0);
        dotted([[300, oy + 110], [452, oy + 4]], 'rgba(255,250,235,0.95)', 3.4, 2, 9); ctx.strokeStyle = 'rgba(255,250,235,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(470, oy - 10, 16, 0, TAU); ctx.stroke();
        ctx.lineCap = 'round'; ctx.strokeStyle = '#f0a03a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(296, oy + 132); ctx.lineTo(262, oy + 168); ctx.stroke(); ctx.fillStyle = '#fff5d7'; ctx.beginPath(); ctx.arc(258, oy + 172, 9, 0, TAU); ctx.fill();
        ctx.fillStyle = CREAM; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(300 + d * 62, oy + 110); ctx.lineTo(300 + d * 46, oy + 100); ctx.lineTo(300 + d * 46, oy + 120); ctx.fill(); }
        text('1  slide', 200, oy - 32, 24, GOLD, 'center', 700); text('2  drag back', 170, oy + 168, 24, GOLD, 'center', 700); text('3  release', 540, oy + 74, 24, GOLD, 'center', 700); ctx.restore();
      }
    }
    ctx.restore();
    if (max > 0) { const sb = RD.scrollbar, th = Math.max(36, sb.h * vp.h / (vp.h + max)), ty = sb.y + (sb.h - th) * (off / max); ctx.fillStyle = 'rgba(255,240,205,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,214,150,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x, ty, sb.w, th, 5); ctx.fill(); }
    text(max > 0 ? (off >= max - 2 ? 'End' : 'Scroll: drag, wheel or arrow keys') : '', RD.counter.x, RD.counter.y, 22, 'rgba(255,243,214,0.7)');
    button(RD.nav.prev, 'Top', { dim: off < 4, size: 28 });
    button(RD.nav.next, 'More', { dim: off >= max - 2, size: 28 });
    button(RD.nav.back, 'Done', { primary: true, size: 28 });
    return;
  }
  if (sc === 'settings') {
    backdrop(); const S0 = L.settings, rows = S0.rows;
    shadowText('Settings', S0.title.x, S0.title.y, S0.title.size, GOLD);
    const items = [
      ['Sound', state.sound ? 'On' : 'Off', state.sound],
      ['Reduced motion', state.calm ? 'On' : 'Off', state.calm],
      ['Text size', Math.round((TEXT_SCALES[state.textScaleIdx] ?? 1) * 100) + '%', state.textScaleIdx > 0],
      ['Left-handed layout', state.left ? 'On' : 'Off', state.left],
      ['Board', THEMES[state.theme].name, false],
      ['Aim guide', state.guide === 2 ? 'Long' : state.guide === 1 ? 'Short' : 'Off', state.guide === 2],
      ['Restore purchases', '', false],
    ];
    items.forEach((it, i) => {
      const r = rows[i]; button(r, '', { size: 30 }); const vw = it[1] ? 130 : 0;
      fitText(it[0], r.x + 28, r.y + r.h / 2 + 10, 30, r.w - 56 - vw, CREAM, 'left', 700);
      if (it[1]) fitText(it[1], r.x + r.w - 28, r.y + r.h / 2 + 10, 30, vw, it[2] ? '#b6f28a' : GOLD, 'right', 700);
    });
    if (S0.noteFits) text('Tap a row to change it.', S0.note.x, S0.note.y, 24, 'rgba(255,243,214,0.7)');
    button(S0.done, 'Done', { primary: true, size: 30 }); return;
  }
  if (sc === 'lessons') {
    backdrop(); const L0 = L.lessons, rows = L0.rows;
    shadowText('Learn to play', L0.title.x, L0.title.y, L0.title.size, GOLD, 'center', 700, L.U.w - 40);
    LESSONS.forEach((l, i) => {
      const r = rows[i], done = !!state.learned[i], locked = state.demoMode && i >= 3; button(r, '', { dim: locked, tone: done ? '#4b6a2a' : undefined });
      const tag = done ? 'done' : locked ? 'full game' : '', tw2 = tag ? 110 : 0;
      fitText(`${i + 1}. ${l.title}`, r.x + 24, r.y + r.h / 2 + 10, 30, r.w - 48 - tw2, CREAM, 'left', 700);
      if (tag) text(tag, r.x + r.w - 22, r.y + r.h / 2 + 9, 24, done ? '#c8f59a' : GOLD, 'right', 700);
    });
    button(L0.back, 'Back', { primary: true, size: 30 }); return;
  }
  if (sc === 'demo-limit') {
    backdrop(); const D = L.demo; shadowText('Enjoying the preview?', D.title.x, D.title.y, D.title.size, GOLD, 'center', 700, L.U.w - 40);
    wrap('The free web preview ends here. Get the full game on iPhone and Android for every lesson, all four computer levels, the daily trick shot and unlimited boards.', D.body.x, D.body.y, 32, D.body.w, CREAM, 44); button(D.back, 'Back', { primary: true, size: 30 }); return;
  }

  // ---------------------------------------------------------------- BOARD SCENES
  const P = L.play(sc);
  drawTable(ctx, W, H);
  const side = g.turn, phase = state.phase;
  const lifted = state.drag && state.drag.mode === 'aim';
  inBoard(P.cx, P.cy, P.f, () => {
    drawBoardOnly(ctx, state.theme);
    // pieces
    const world = g.world;
    for (const b of world) if (b.on && b.k !== 'S') coinAt(b.k, sx(b.x), sy(b.y), 1, 0);
    for (const f of state.fx) if (f.type === 'drop') { const a = Math.min(1, f.t / f.dur), e = a * a; coinAt(f.k, sx(f.x) + (sx(f.px) - sx(f.x)) * e, sy(f.y) + (sy(f.py) - sy(f.y)) * e, 1 - e * 0.55, 0, 1 - e * 0.9); }
    // striker: on its baseline while placing, in the world while flying
    const flying = phase === 'fly', st = findStriker(world);
    const showStriker = phase !== 'after' && phase !== 'over' && !(sc === 'play' && g.over);
    const invalid = state.blocked && (phase === 'aim');
    if (flying && st && st.on) coinAt('S', sx(st.x), sy(st.y), 1, 0);
    else if (showStriker && !flying) {
      const x = sx(state.sx), y = sy(BASE_Y[side]);
      if (invalid) { ctx.fillStyle = 'rgba(220,40,30,0.45)'; ctx.beginPath(); ctx.arc(x, y, (R_STR + 5) * K, 0, TAU); ctx.fill(); }
      const bob = state.calm || phase !== 'aim' ? 0 : Math.sin(t * 3) * 0.5;
      coinAt('S', x, y, 1, lifted ? 0.5 : 0.12 + bob * 0.1);
    }
    // baseline slide hint when nothing has been touched yet
    const canPlay = (phase === 'aim') && ((sc === 'play' && (state.mode === 'two' || side === 'W')) || sc === 'lesson' || sc === 'daily');
    if (canPlay && !state.drag && !state.aim && (state.hintPulse ?? 1)) {
      const y = sy(BASE_Y[side]), a = 0.5 + 0.5 * Math.sin(t * 4), x = sx(state.sx);
      ctx.save(); ctx.globalAlpha = state.calm ? 0.8 : 0.45 + a * 0.4; ctx.fillStyle = CREAM;
      for (const d of [-1, 1]) { const ax = x + d * (R_STR * K + 18 + (state.calm ? 0 : a * 6)); ctx.beginPath(); ctx.moveTo(ax + d * 12, y); ctx.lineTo(ax, y - 9); ctx.lineTo(ax, y + 9); ctx.fill(); }
      ctx.restore();
    }
    // aim overlay
    if (state.aim && (phase === 'aim' || phase === 'aiaim' || phase === 'aiplace')) {
      const y0 = BASE_Y[side], a = state.aim.angle, pw = state.aim.power, dx = Math.cos(a), dy = Math.sin(a), sxu = state.sx;
      const base = world.filter((b) => b.k !== 'S');
      const t1 = trace(base, sxu, y0, dx, dy), p0 = [sx(sxu), sy(y0)];
      const glow = (pts, w, dash, gap, alpha = 1) => { dotted(pts, `rgba(20,8,0,${0.35 * alpha})`, w + 3, dash, gap); dotted(pts, `rgba(255,250,235,${0.95 * alpha})`, w, dash, gap); };
      const segs = [p0, [sx(t1.x), sy(t1.y)]];
      if (state.guide !== 0) {
        const lim = state.guide === 1 ? 0.45 : 1; const cut = (a0, b0) => { const f = lim; return [a0[0] + (b0[0] - a0[0]) * f, a0[1] + (b0[1] - a0[1]) * f]; };
        glow([p0, state.guide === 1 ? cut(p0, segs[1]) : segs[1]], 3.4, 2, 9);
        const cx = sx(t1.x), cy = sy(t1.y);
        ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(255,250,235,0.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R_STR * K, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,250,235,0.14)'; ctx.fill(); ctx.restore();
        if (t1.coin) {
          const c = t1.coin, nx0 = c.x - t1.x, ny0 = c.y - t1.y, d = Math.hypot(nx0, ny0) || 1, nx = nx0 / d, ny = ny0 / d;
          // coin leaves along the line of centres
          const tc = trace(base.filter((b) => b.id !== c.id), c.x, c.y, nx, ny, R_COIN, c.id), len = Math.min(tc.t, 90 + pw * 330);
          const ex = c.x + nx * len, ey = c.y + ny * len;
          glow([[sx(c.x), sy(c.y)], [sx(ex), sy(ey)]], 3.4, 2, 9, 0.95);
          ctx.fillStyle = 'rgba(255,250,235,0.95)'; const ang = Math.atan2(ey - c.y, ex - c.x), ax = sx(ex), ay = sy(ey); ctx.beginPath(); ctx.moveTo(ax + Math.cos(ang) * 11, ay + Math.sin(ang) * 11); ctx.lineTo(ax + Math.cos(ang + 2.5) * 9, ay + Math.sin(ang + 2.5) * 9); ctx.lineTo(ax + Math.cos(ang - 2.5) * 9, ay + Math.sin(ang - 2.5) * 9); ctx.fill();
          ctx.strokeStyle = 'rgba(255,250,235,0.9)'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(sx(c.x), sy(c.y), R_COIN * K + 3, 0, TAU); ctx.stroke();
          // striker after the hit: it keeps going, sideways of the line of centres
          const vn = dx * nx + dy * ny, kx = dx - 0.455 * vn * nx, ky = dy - 0.455 * vn * ny;
          const kd = Math.hypot(kx, ky) || 1; glow([[cx, cy], [cx + kx / kd * 46 * pw + kx / kd * 22, cy + ky / kd * 46 * pw + ky / kd * 22]], 2.4, 2, 8, 0.6);
        } else if (t1.wall && state.guide === 2) {
          const rx = t1.wall === 'x' ? -dx : dx, ry = t1.wall === 'y' ? -dy : dy, t2 = trace(base, t1.x, t1.y, rx, ry);
          glow([[sx(t1.x), sy(t1.y)], [sx(t2.x), sy(t2.y)]], 2.6, 2, 9, 0.7);
        }
      }
      // the pull-back band
      const pull = 30 + pw * 150, bx = p0[0] - dx * pull, by = p0[1] - dy * pull;
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(20,8,0,0.45)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(p0[0] - dx * 26, p0[1] - dy * 26); ctx.lineTo(bx, by); ctx.stroke();
      const pg = ctx.createLinearGradient(p0[0], p0[1], bx, by); pg.addColorStop(0, '#ffe08e'); pg.addColorStop(1, pw > 0.8 ? '#ff6a3a' : pw > 0.5 ? '#f0a03a' : '#9fe07a'); ctx.strokeStyle = pg; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(p0[0] - dx * 26, p0[1] - dy * 26); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = 'rgba(255,245,215,0.95)'; ctx.beginPath(); ctx.arc(bx, by, 11, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(80,40,0,0.6)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
    // effects
    for (const f of state.fx) {
      if (f.type === 'ring') { const a = f.t / f.dur; ctx.strokeStyle = `rgba(255,246,220,${0.7 * (1 - a)})`; ctx.lineWidth = 3 * (1 - a) + 1; ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), (10 + a * 30 * f.s) * (state.calm ? 0.6 : 1), 0, TAU); ctx.stroke(); }
      else if (f.type === 'pop') { const a = f.t / f.dur; ctx.globalAlpha = Math.min(1, 2 - a * 2); text(f.text, sx(Math.max(90, Math.min(740 - 90, f.x))), sy(Math.max(90, Math.min(740 - 90, f.y))) - 20 - a * 50, 40, f.color ?? GOLD, 'center', 700); ctx.globalAlpha = 1; }
      else if (f.type === 'flash') { ctx.fillStyle = `rgba(255,70,50,${0.25 * (1 - f.t / f.dur)})`; ctx.fillRect(BX, BY, PLAY, PLAY); }
    }
  });

  // ---- HUD: two player cards (a coin, the name, a status line, the coins pocketed so far, the queen)
  const card = (r, k, name, sub, active) => {
    const rad = Math.min(24, r.h * 0.2), pad = Math.min(16, r.w * 0.06), cr = Math.min(r.h * 0.2, 28);
    ctx.save(); if (active) { ctx.shadowColor = 'rgba(255,200,90,0.9)'; ctx.shadowBlur = state.calm ? 16 : 18 + Math.sin(t * 4) * 8; }
    ctx.fillStyle = active ? 'rgba(70,38,14,0.94)' : 'rgba(26,13,6,0.82)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill(); ctx.restore();
    ctx.strokeStyle = active ? 'rgba(255,214,120,0.95)' : 'rgba(255,214,150,0.3)'; ctx.lineWidth = active ? 3 : 2; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.stroke();
    const row1 = r.y + r.h * 0.27, row2 = r.y + r.h * 0.55, row3 = r.y + r.h * 0.82, cs = cr / (R_COIN * K);
    coinAt(k, r.x + pad + cr, row1, cs, 0);
    const nx = r.x + pad + cr * 2 + 10, qx = r.x + r.w - pad - 18, nameW = qx - 24 - nx;
    fitText(name, nx, row1 + 10, 32 * Math.min(bs, 1.1), nameW, CREAM, 'left', 700);
    fitText(sub, r.x + pad, row2 + 6, 21 * Math.min(bs, 1.1), r.w - 2 * pad, 'rgba(255,240,205,0.72)', 'left', 500);
    const n = down(g, k), sp = Math.min(32, (r.w - 2 * pad - 20) / 8.6), ps = sp / 32 * 0.86;
    for (let i = 0; i < 9; i++) { const cx = r.x + pad + 10 + i * sp, cy = row3; if (i < n) coinAt(k, cx, cy, ps, 0); else { ctx.strokeStyle = 'rgba(255,240,205,0.35)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(cx, cy, R_COIN * K * ps, 0, TAU); ctx.stroke(); } }
    const q = g.queen, own = q.state === k, pend = q.state === 'pending' && q.by === k;
    if (own) coinAt('Q', qx, row1, 0.95, 0); else if (pend) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6); coinAt('Q', qx, row1, 0.95, 0); ctx.globalAlpha = 1; ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(qx, row1, 19, 0, TAU); ctx.stroke(); }
  };
  if (sc === 'lesson' || sc === 'daily') {
    if (L.land) panel(P.info, 0.7);
    if (sc === 'lesson') {
      const l = LESSONS[state.lesson.i], LS = P.lesson;
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, LS.label.x, LS.label.y, 26, 'rgba(255,240,205,0.8)', 'center', 500);
      if (LS.title.wrap) wrapIn(l.title, R4(LS.title.x - LS.title.w / 2, LS.title.y - 40, LS.title.w, 84), 40 * Math.min(bs, 1.05), GOLD, { weight: 700, vc: true });
      else shadowText(l.title, LS.title.x, LS.title.y, LS.title.size * Math.min(bs, 1.05), GOLD, 'center', 700, W - 40);
      if (!state.lesson.done) { if (!L.land) panel(LS.body, 0.72, 22); wrapIn(l.text, LS.body, 27 * bs, CREAM, { vc: !L.land }); }
    } else {
      const DS = P.daily, goal = 'Pocket ' + (state.pz.goal === 1 ? 'a white coin' : state.pz.goal + ' white coins') + ' in one stroke';
      text('Daily trick shot', DS.label.x, DS.label.y, 26, 'rgba(255,240,205,0.8)', 'center', 500);
      if (DS.title.wrap) wrapIn(goal, R4(DS.title.x - DS.title.w / 2, DS.title.y - 32, DS.title.w, 130), 32 * Math.min(bs, 1.05), GOLD, { weight: 700, vc: true });
      else shadowText(goal, DS.title.x, DS.title.y, DS.title.size * Math.min(bs, 1.05), GOLD, 'center', 700, W - 40);
      fitText(`Attempts left: ${Math.max(0, state.pz.left)}  ·  Streak ${state.daily.streak}`, DS.attempts.x, DS.attempts.y, 24, (P.info ? P.info.w : W) - 24, 'rgba(255,240,205,0.85)', 'center', 500);
    }
  } else {
    const two = state.mode === 'two';
    card(P.cards.W, 'W', two ? 'Player 1' : 'You', (L.land || L.w < 700 ? '' : 'White · ') + (g.turn === 'W' && !g.over ? 'to play' : 'waiting'), g.turn === 'W' && !g.over);
    card(P.cards.B, 'B', two ? 'Player 2' : 'Computer', two ? (g.turn === 'B' && !g.over ? 'to play' : 'waiting') : AI_LEVELS[state.level].name + (g.turn === 'B' && !g.over ? ' · ' + (phase === 'think' ? 'thinking' : 'to play') : ''), g.turn === 'B' && !g.over);
  }
  // message strip
  const m = state.msg;
  if (m) {
    const a = Math.min(1, (m.hold - m.t) * 2, m.t * 6 + 0.2); ctx.globalAlpha = Math.max(0, a); panel(P.msg, 0.72, 22);
    wrapIn(m.text, P.msg, 27 * bs, CREAM, { vc: !L.land || P.msg.h < 140 }); ctx.globalAlpha = 1;
  }
  if (sc === 'daily' && state.pz.status === 'making') { ctx.fillStyle = 'rgba(10,4,0,0.7)'; ctx.fillRect(0, 0, W, H); text('Setting up today’s shot…', W / 2, H / 2, 40, GOLD); }

  // ---- below / beside the board: power meter, tip and the controls
  if (P.meter) {
    const pw = state.aim ? state.aim.power : 0, mr = P.meter;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(mr.x - 4, mr.y - 4, mr.w + 8, mr.h + 8, 20); ctx.fill();
    const mg = ctx.createLinearGradient(mr.x, 0, mr.x + mr.w, 0); mg.addColorStop(0, '#7fd35a'); mg.addColorStop(0.55, '#f1c34a'); mg.addColorStop(1, '#e8442c');
    ctx.save(); ctx.beginPath(); ctx.roundRect(mr.x, mr.y, mr.w, mr.h, 14); ctx.clip(); ctx.fillStyle = 'rgba(60,32,14,0.9)'; ctx.fillRect(mr.x, mr.y, mr.w, mr.h); ctx.fillStyle = mg; ctx.fillRect(mr.x, mr.y, mr.w * pw, mr.h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 1; i < 10; i++) ctx.fillRect(mr.x + mr.w * i / 10 - 1, mr.y, 2, mr.h);
    const hg = ctx.createLinearGradient(0, mr.y, 0, mr.y + mr.h); hg.addColorStop(0, 'rgba(255,255,255,0.28)'); hg.addColorStop(0.5, 'rgba(255,255,255,0)'); ctx.fillStyle = hg; ctx.fillRect(mr.x, mr.y, mr.w, mr.h); ctx.restore();
    const lab = state.aim ? `Power ${Math.round(pw * 100)}%` : 'Power';
    text(lab, mr.x + mr.w / 2 + 1, mr.y + mr.h / 2 + 8 + 1, 22, 'rgba(0,0,0,0.6)', 'center', 700); text(lab, mr.x + mr.w / 2, mr.y + mr.h / 2 + 8, 22, '#fff8e6', 'center', 700);
  }
  if (P.tip && state.tip) wrapIn(state.tip, P.tip, 26 * bs, 'rgba(255,243,214,0.85)', { vc: true });
  if (sc === 'play' || sc === 'lesson' || sc === 'daily') {
    const pb = P.btn;
    button(pb.menu, 'Menu', { size: 28 });
    if (sc === 'play') button(pb.hint, state.hintsLeft > 0 ? `Hint ${state.hintsLeft}` : 'Hint', { size: 28, dim: state.hintsLeft <= 0 || phase !== 'aim' || (state.mode === 'ai' && side === 'B') || state.hintBusy });
    else button(pb.hint, 'Hint', { size: 28, dim: phase !== 'aim' || state.hintBusy });
    const ready = !!state.aim && phase === 'aim' && !state.drag && !state.blocked;
    button(pb.flick, 'Flick', { primary: ready, size: 30, dim: !ready });
  } else if (sc === 'auto' && state.auto) {
    // Menu/Hint/Flick have no meaning in a spectator run: the same three slots become Exit / Pause / Skip.
    const pb = P.btn, A = state.auto, ended = phase === 'over', AU = P.auto;
    button(pb.menu, 'Exit', { size: 28 });
    if (!ended) button(pb.hint, A.paused ? 'Resume' : 'Pause', { size: 28 });
    if (!ended) button(pb.flick, 'Skip', { size: 28, dim: A.sub !== 'think' && A.sub !== 'reveal' });
    // status strip: the phase word + the configurable think-time stepper
    panel(AU.bar, 0.72, 22);
    const label = A.paused ? 'Paused' : A.sub === 'think' ? 'Thinking...' : A.sub === 'reveal' ? 'Revealing the shot...' : phase === 'over' ? 'Board complete' : '';
    const lw = L.land ? AU.bar.w - 24 : AU.think.x - AU.label.x - 130;
    fitText(label, AU.label.x, AU.label.y + 9, 24, L.land ? lw : Math.max(120, lw), A.paused ? '#ffd08a' : GOLD, AU.label.align, 700);
    fitText(`Think ${AUTO_THINK_STEPS[state.autoThinkIdx]}s`, AU.think.x, AU.think.y + 8, 22, L.land ? AU.inc.x - AU.dec.x - AU.dec.w - 16 : 150, CREAM, AU.think.align, 600);
    button(AU.dec, '-', { size: 30, noscale: true, dim: state.autoThinkIdx === 0 }); button(AU.inc, '+', { size: 30, noscale: true, dim: state.autoThinkIdx === AUTO_THINK_STEPS.length - 1 });
  }

  // ---- overlays
  const dim = (a) => { ctx.fillStyle = `rgba(6,2,0,${a})`; ctx.fillRect(0, 0, W, H); };
  if (state.menu) {
    const M = L.menu; dim(0.72); shadowText('Paused', M.title.x, M.title.y, M.title.size, GOLD);
    button(M.resume, 'Resume', { primary: true, size: 34 }); button(M.restart, sc === 'play' ? 'New board' : 'Restart', { size: 34 }); button(M.settings, 'Settings', { size: 34 }); button(M.quit, 'Leave', { size: 34 });
  }
  if ((sc === 'play' || sc === 'auto') && g.over && state.phase === 'over') {
    dim(0.66);
    const D = L.dialog('over'), o = g.over, two = state.mode === 'two', win = o.winner === 'W' && !two;
    const title = o.winner === 'draw' ? 'A draw' : two ? `${o.winner === 'W' ? 'Player 1' : 'Player 2'} wins` : win ? 'You win!' : 'The computer wins';
    if (win && !state.calm) for (let i = 0; i < 26; i++) { const a = i * 2.4 + t * 0.6, r = 200 + (i % 5) * 30, x = W / 2 + Math.cos(a) * r * Math.min(1.6, W / 720), y = D.panel.y - 60 + Math.sin(a * 1.3 + t) * 40 + ((t * 60 + i * 37) % 160); coinAt(i % 3 === 0 ? 'Q' : i % 2 ? 'W' : 'B', x, y, 0.8, 0, 0.9); }
    panel(D.panel, 0.9);
    shadowText(title, D.title.x, D.title.y, 62, GOLD, 'center', 700, D.panel.w * (D.land ? 0.5 : 0.86));
    const bx = D.body.x, by = D.body.y, bw = D.body.w;
    fitText(o.winner === 'draw' ? 'Equal coins when the board stalled.' : `${o.points} point${o.points === 1 ? '' : 's'} this board`, bx, by + 28, 32, bw, CREAM, 'center', 600);
    const why = o.winner === 'draw' ? '' : o.reason === 'stalled' ? 'More coins pocketed when the board stalled.' : `${SIDE_NAME[o.winner]} pocketed every coin` + (g.queen.state === o.winner ? ' and covered the queen (+3).' : '.');
    if (why) wrapIn(why, R4(bx - bw / 2, by + 44, bw, 70), 24, 'rgba(255,243,214,0.8)', { vc: true });
    if (sc === 'play') fitText(`Boards played ${state.stats.played}  ·  won ${state.stats.wins}`, bx, by + D.body.h - 8, 24, bw, 'rgba(255,243,214,0.7)', 'center', 500);
    button(D.btns[0], 'Play again', { primary: true, size: 34 }); button(D.btns[1], sc === 'auto' ? 'Exit' : 'Menu', { size: 30 });
    drawMoreLine(ctx, D.extra.x, D.extra.y, Math.max(FL, 20));
  }
  if (sc === 'lesson' && state.lesson.done) {
    dim(0.6); const D = L.dialog('lesson'); panel(D.panel, 0.92);
    shadowText('Lesson complete', D.title.x, D.title.y, 54, GOLD, 'center', 700, D.panel.w * (D.land ? 0.5 : 0.86));
    wrapIn(LESSONS[state.lesson.i].done, R4(D.body.x - D.body.w / 2, D.body.y, D.body.w, D.body.h), 28, CREAM, { vc: true });
    button(D.btns[0], state.lesson.i >= LESSONS.length - 1 ? 'Finish' : 'Next lesson', { primary: true, size: 34 });
  }
  if (sc === 'daily' && (state.pz.status === 'solved' || state.pz.status === 'failed')) {
    dim(0.6); const ok = state.pz.status === 'solved', D = L.dialog(ok ? 'solved' : 'failed'); panel(D.panel, 0.92);
    shadowText(ok ? 'Solved!' : 'Out of attempts', D.title.x, D.title.y, ok ? 62 : 52, GOLD, 'center', 700, D.panel.w * (D.land ? 0.5 : 0.86));
    wrapIn(ok ? `Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}. Come back tomorrow for a new shot.` : 'Not this time. A new shot arrives tomorrow.', R4(D.body.x - D.body.w / 2, D.body.y, D.body.w, D.body.h), 30, CREAM, { vc: true });
    button(D.btns[0], 'Done', { primary: true, size: 34 });
  }
}
