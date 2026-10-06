// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The cloth, board and seed sprites are cached (art.js).
// Positions come from the live layout (layout.js): the board is a group drawn under a uniform scale, everything else sits in rectangles.
import { PIT_R, PITCH, BTN, REF, pitLocal, trayLocal, geom, withGeom, TEXT_SCALES, AP_THINK_STEPS, bigMenu } from './layout.js';
import { drawTable, drawBoard, drawSeed, slot, WOODS, SEEDSETS, beginFrame } from './art.js';
import { LEVELS } from './engine.js';
import { RULES, HOWTO, ABOUT, FIGS } from './content.js';
import { LESSONS } from './lessons.js';
import { NYUMBA, sum } from './rules.js';
import { drawLockup, drawMoreLine } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const CREAM = '#f8ebcc', GOLD = '#f0c860', BODY = '#fff3d6';
const COL = { gold: '255,220,120', green: '120,255,170', red: '255,110,90', amber: '255,176,70' };
const DOCS = { about: { title: 'About', pages: ABOUT }, howto: { title: 'How to Play', pages: HOWTO }, rules: { title: 'Rules', pages: RULES } };

// What was drawn this frame (screen units): every button and the board, for the layout checks (overlap, off-screen, clipped labels).
export const drawn = [];
const note = (kind, label, r, clipped = false) => { drawn.push({ kind, label, x: r.x, y: r.y, w: r.w, h: r.h, clipped }); };

// ---- small text helpers --------------------------------------------------------------------------------------------
function text(ctx, str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center', shadow = true) {
  ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`;
  if (shadow) { ctx.fillStyle = 'rgba(4,8,24,0.6)'; ctx.fillText(str, x + 1.5, y + 2.5); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function wrapLines(ctx, str, maxW, size, weight = 600, font = UI) {
  ctx.font = `${weight} ${size}px ${font}`;
  const words = str.split(' '), out = []; let cur = '';
  for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
  out.push(cur); return out;
}
// the largest size (down to `min`) at which `str` wraps to lines that fit maxW x maxH; `over` = still too big at `min`
// Results are cached per (text, box, size, font): a button label used to be re-fitted (shrink-and-measure loop) every frame.
// Both caches are dropped when a web font finishes loading. readerStats.fits / .layouts count cache misses (tests read them).
const fitMemo = new Map(); let fontsKey = '';
export const readerStats = { fits: 0, layouts: 0 };
function checkFonts(ctx) {
  ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`;
  const k = a + '/' + ctx.measureText('Hamburgefonstiv').width;
  if (k !== fontsKey || fitMemo.size > 2000) { fitMemo.clear(); for (const q in pageCache) delete pageCache[q]; fontsKey = k; }
}
function fitBox(ctx, str, maxW, maxH, size, min, weight = 600, lhk = 1.28, font = UI) {
  const mk = `${str}|${maxW}|${maxH}|${size}|${min}|${weight}|${lhk}|${font}`, hit = fitMemo.get(mk); if (hit) return hit;
  readerStats.fits++; const r = fitBoxRaw(ctx, str, maxW, maxH, size, min, weight, lhk, font); fitMemo.set(mk, r); return r;
}
function fitBoxRaw(ctx, str, maxW, maxH, size, min, weight, lhk, font) {
  let s = Math.round(size), L = wrapLines(ctx, str, maxW, s, weight, font);
  const bad = () => L.length * s * lhk > maxH || L.some((l) => ctx.measureText(l).width > maxW);
  while (bad() && s > min) { s -= 1; L = wrapLines(ctx, str, maxW, s, weight, font); }
  return { L, s, lh: s * lhk, over: bad() };
}
function fitSz(ctx, str, size, weight, font, maxW, min) { let s = Math.round(size); ctx.font = `${weight} ${s}px ${font}`; while (ctx.measureText(str).width > maxW && s > min) { s -= 1; ctx.font = `${weight} ${s}px ${font}`; } return s; }

// a status "line" (layout.js): fitted into its box, wrapped if the box allows, kept clear of the host back button
function clearW(Lo, ln) {
  const b = Lo.backBox; if (!b.h) return ln.maxW;
  if (ln.y - ln.size * 0.85 < b.y + b.h && ln.x - ln.maxW / 2 < b.x + b.w) return Math.max(80, Math.min(ln.maxW, 2 * (ln.x - (b.x + b.w + 8))));
  return ln.maxW;
}
function drawLine(ctx, Lo, ln, str, color, font, weight, min = 20) {
  if (!str || !str.trim()) return;
  const f = fitBox(ctx, str, clearW(Lo, ln), ln.maxH, ln.size, Math.min(ln.size, min), weight, 1.18, font);
  f.L.forEach((t, i) => text(ctx, t, ln.x, ln.y + i * f.lh, f.s, color, font, weight));
  if (f.over) note('text-over', str, { x: ln.x - ln.maxW / 2, y: ln.y - ln.size, w: ln.maxW, h: ln.maxH }, true);
}

// flat buttons: one solid fill, a thin edge, a soft drop shadow. No inner highlight shape.
function button(ctx, r, label, o = {}, scale = 1) {
  ctx.save(); if (o.dim) ctx.globalAlpha = 0.45;
  const rad = Math.min(18, r.h / 2.4);
  ctx.fillStyle = 'rgba(2,6,20,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + 5, r.w, r.h, rad); ctx.fill();
  ctx.fillStyle = o.primary ? '#e0b048' : '#3b2415'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
  ctx.strokeStyle = o.primary ? '#fff0b8' : 'rgba(240,200,96,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  const base = o.size ?? 30, sc = Math.max(1, scale), padX = Math.min(14, r.w * 0.08), padY = 8;
  const f = fitBox(ctx, label, r.w - padX * 2, r.h - padY * 2, base * sc, Math.min(base, 18), 700, 1.12);
  ctx.textAlign = 'center'; ctx.font = `700 ${f.s}px ${UI}`; ctx.fillStyle = o.primary ? '#2a1606' : CREAM;
  const top = r.y + r.h / 2 - (f.L.length * f.lh) / 2 + f.s * 0.88;
  f.L.forEach((ln, i) => ctx.fillText(ln, r.x + r.w / 2, top + i * f.lh));
  ctx.restore();
  note('button', label, r, f.over);
}
function panel(ctx, x, y, w, h, alpha = 0.88) {
  ctx.save(); ctx.fillStyle = `rgba(12,18,36,${alpha})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(240,200,96,0.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
}

// ---- the position: pits, seeds, counts, stores ----------------------------------------------------------------------
function glow(ctx, q, rgb, a, sq) {
  const g = ctx.createRadialGradient(q.x, q.y, PIT_R * 0.5, q.x, q.y, PIT_R + 20);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(0.7, `rgba(${rgb},${0.55 * a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, PIT_R + 20, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(${rgb},${0.95 * a})`; ctx.lineWidth = 3.5; ctx.beginPath();
  if (sq) ctx.roundRect(q.x - PIT_R * 0.86 - 5, q.y - PIT_R * 0.86 - 5, PIT_R * 1.72 + 10, PIT_R * 1.72 + 10, 16); else ctx.arc(q.x, q.y, PIT_R + 3, 0, TAU);
  ctx.stroke();
}
function tag(ctx, x, y, label, size = 21) {
  ctx.font = `700 ${size}px ${UI}`; const w = ctx.measureText(label).width + 18;
  ctx.fillStyle = 'rgba(10,16,34,0.9)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - size * 0.85, w, size * 1.5, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(240,200,96,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = CREAM; ctx.fillText(label, x, y + size * 0.3);
}
function arcArrow(ctx, x, y, r, cw, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const a0 = cw ? -2.3 : -0.84, a1 = cw ? -0.84 + 3.1 : -2.3 - 3.1 + 0.0;
  ctx.beginPath(); ctx.arc(x, y, r, a0, cw ? a0 + 4.2 : a0 - 4.2, !cw); ctx.stroke();
  const ae = cw ? a0 + 4.2 : a0 - 4.2, ex = x + Math.cos(ae) * r, ey = y + Math.sin(ae) * r, tx = cw ? -Math.sin(ae) : Math.sin(ae), ty = cw ? Math.cos(ae) : -Math.cos(ae);
  ctx.beginPath(); ctx.moveTo(ex - tx * 11 + ty * 9, ey - ty * 11 - tx * 9); ctx.lineTo(ex + tx * 4, ey + ty * 4); ctx.lineTo(ex - tx * 11 - ty * 9, ey - ty * 11 + tx * 9); ctx.stroke();
  void a1; ctx.restore();
}

function drawPosition(ctx, state, pos, o = {}) {
  const set = state.seeds, t = state.t, pulse = state.calm ? 0.7 : 0.5 + 0.5 * Math.sin(t * 5);
  drawBoard(ctx, state.wood);
  const sc = TEXT_SCALES[state.textScaleIdx] ?? 1, cs = o.countSize ?? Math.round(26 * Math.min(1.35, 1 + (sc - 1) * 0.18));
  for (const m of o.marks || []) glow(ctx, pitLocal(m.p, m.r), COL[m.c] || m.rgb || COL.gold, (m.a ?? 1) * (m.pulse ? 0.55 + 0.45 * pulse : 1), m.r === NYUMBA);
  const A = o.anim;
  for (let p = 0; p < 2; p++) for (let r = 0; r < 16; r++) {
    const n = pos.pits[p][r]; if (n <= 0) continue;
    const q = pitLocal(p, r); let dx = 0;
    if (o.shake && o.shake.p === p && o.shake.r === r && !state.calm) dx = Math.sin(o.shake.t * 60) * 5 * (1 - o.shake.t / 0.6);
    const key = p * 16 + r, show = Math.min(n, 40);
    for (let k = 0; k < show; k++) {
      const s = slot(key, k); let oy = 0;
      if (A && A.last && A.last.p === p && A.last.r === r && k === n - 1 && A.last.t < 0.14 && !state.calm) oy = -8 * (1 - A.last.t / 0.14);
      drawSeed(ctx, set, s.v, q.x + s.x + dx, q.y + s.y + oy, s.rot, 1.2);
    }
  }
  if (o.counts !== false) for (let p = 0; p < 2; p++) for (let r = 0; r < 16; r++) {
    const n = pos.pits[p][r]; if (n <= 0) continue;
    const q = pitLocal(p, r), y = p === 0 ? q.y + PIT_R + cs + 2 : q.y - PIT_R - 8;
    ctx.textAlign = 'center'; ctx.font = `800 ${cs}px ${UI}`; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(14,6,0,0.85)'; ctx.strokeText(String(n), q.x, y); ctx.fillStyle = '#fff1c8'; ctx.fillText(String(n), q.x, y);
  }
  // the stores
  const ph = (p) => (pos.stock[p] > 0 ? 'Namua' : 'Mtaji');
  for (let p = 0; p < 2; p++) {
    const T = p === 0 ? geom().TRAY.s : geom().TRAY.n, n = pos.stock[p];
    for (let k = 0; k < n; k++) drawSeed(ctx, set, (k * 3 + p) % 4, T.x + 200 + (k % 11) * 30 + (Math.floor(k / 11) % 2) * 9, T.y + 25 + Math.floor(k / 11) * 28, ((k * 97) % 360) * Math.PI / 180, 1.0);
    if (o.counts !== false) {
      const label = o.labels ? o.labels[p] : p === 0 ? 'You' : 'Computer';
      const f = fitSz(ctx, label, 26, 700, UI, 150, 14);
      text(ctx, label, T.x + 24, T.y + 33, f, CREAM, UI, 700, 'left'); text(ctx, ph(p), T.x + 24, T.y + 60, 20, 'rgba(248,235,204,0.8)', UI, 600, 'left');
      if (n === 0) text(ctx, `${sum(pos.pits[p])} on board`, T.x + T.w - 28, T.y + 47, 26, GOLD, UI, 700, 'right'); else text(ctx, String(n), T.x + T.w - 22, T.y + 50, 36, GOLD, UI, 800, 'right');
    }
  }
  if (o.loop !== undefined && o.loop !== null) {
    const p = o.loop;
    ctx.save(); ctx.strokeStyle = 'rgba(255,224,130,0.95)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let r = 0; r < 16; r++) {
      const a = pitLocal(p, r), b = pitLocal(p, (r + 1) % 16), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.save(); ctx.translate(mx, my); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(-9, -11); ctx.lineTo(7, 0); ctx.lineTo(-9, 11); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  for (const tg of o.tags || []) { const q = pitLocal(tg.p, tg.r); tag(ctx, q.x, tg.below ? q.y + PIT_R + 30 : tg.p === 0 ? q.y - PIT_R - 20 : q.y + PIT_R + 24, tg.t, o.tagSize ?? 21); }
  if (o.kbPit) glow(ctx, pitLocal(o.kbPit.p, o.kbPit.r), '125,255,155', 1, o.kbPit.r === NYUMBA);
  // seeds being carried
  const V = A && A.vis;
  if (V) {
    if (V.place) {
      const P = V.place, e = P.f * P.f * (3 - 2 * P.f), x = P.x0 + (P.x1 - P.x0) * e, y = P.y0 + (P.y1 - P.y0) * e - Math.sin(Math.PI * e) * 60;
      ctx.fillStyle = 'rgba(8,2,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 5, y + 24, 14, 7, 0, 0, TAU); ctx.fill();
      drawSeed(ctx, set, 1, x, y, e * 5, 1.15);
    }
    if (V.hand && V.hand.n > 0) {
      const H2 = V.hand, hop = H2.hop || 0, x = H2.x, y = H2.y - 30 - hop;
      ctx.fillStyle = 'rgba(8,2,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 6, H2.y + 12, 26 - hop * 0.12, 11, 0, 0, TAU); ctx.fill();
      const n = Math.min(H2.n, 9); for (let k = 0; k < n; k++) { const s = slot(99, k, 30); drawSeed(ctx, set, s.v, x + s.x * 0.75, y + s.y * 0.65, s.rot, 1.05); }
      ctx.fillStyle = 'rgba(12,16,34,0.92)'; ctx.beginPath(); ctx.arc(x + 28, y - 22, 16, 0, TAU); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, String(H2.n), x + 28, y - 15, 20, '#ffe9b0', UI, 800, 'center', false);
    }
    if (V.cap) {
      const q = V.cap.q, f = V.cap.f;
      ctx.strokeStyle = `rgba(255,214,120,${0.9 * (1 - f)})`; ctx.lineWidth = 7 * (1 - f) + 1; ctx.beginPath(); ctx.arc(q.x, q.y, PIT_R * (0.7 + 1.0 * f), 0, TAU); ctx.stroke();
      text(ctx, `+${V.cap.n}`, q.x, q.y - 52 - f * 34, 36, `rgba(255,228,140,${1 - f * 0.55})`, FONT, 700);
    }
  }
}

// ---- reference pages (About / How to Play / Rules): ONE scrolling column laid out for the current text size ----------------
// Content y is measured from the top of the body area; the whole document is one list (drag, wheel, keys, scroll bar).
const pageCache = {};
function layoutDoc(ctx, key, doc, scale, Lo) {
  const D = Lo.docs, ck = key + '|' + scale + '|' + D.key; if (pageCache[ck]) return pageCache[ck];
  readerStats.layouts++;
  const bodySz = Math.round(28 * scale), lh = Math.round(bodySz * 1.38), gap = Math.round(lh * 0.5), maxW = D.body.w;
  const items = []; let y = 0;
  for (const sec of doc) {
    const titleSz = fitSz(ctx, sec.title, Math.round(34 * scale), 700, FONT, maxW, 22);
    items.push({ k: 'title', t: sec.title, sz: titleSz, y: y + Math.round(titleSz * 0.85), h: Math.round(titleSz * 1.2) });
    y += Math.round(titleSz * 1.2) + 14;
    if (sec.fig) {
      const fg = FIGS[sec.fig], capSz = Math.max(18, Math.round(21 * Math.min(scale, 2))), capL = wrapLines(ctx, fg.caption, maxW, capSz, 600);
      const figH = Math.round((fg.crop[1] - fg.crop[0]) * fg.k);
      items.push({ k: 'fig', fig: sec.fig, y, h: figH, capL, capSz, capY: y + figH + 14 + Math.round(capSz * 0.9) });
      y += figH + 12 + Math.round(capL.length * capSz * 1.3) + 14;
    }
    let firstLine = true;
    for (const para of sec.text) {
      const L = wrapLines(ctx, para, maxW, bodySz, 600);
      L.forEach((ln, i) => { const g = i === 0 && !firstLine ? gap : 0; items.push({ k: 'line', t: ln, y: y + g + Math.round(bodySz * 0.85), h: lh }); y += lh + g; firstLine = false; });
    }
    y += Math.round(36 * Math.min(scale, 2));
  }
  return (pageCache[ck] = { items, total: y, bodySz });
}
function drawFig(ctx, state, id, topY, cx) {
  const F = FIGS[id], k = F.k, [y0] = F.crop, [, y1] = F.crop;
  withGeom('tall', () => {
    ctx.save(); ctx.translate(cx, topY); ctx.scale(k, k); ctx.translate(-360, -y0);
    ctx.beginPath(); ctx.roundRect(8, y0, 704, y1 - y0, 26); ctx.clip();
    const marks = F.hl.map((h) => ({ p: h.p, r: h.r, c: h.c, pulse: false }));
    drawPosition(ctx, { ...state, t: 0, calm: true }, { pits: F.pits, stock: F.stock }, { marks, tags: F.tags, tagSize: Math.round(21 / k * 0.82 > 24 ? 24 : 21), countSize: Math.round(28 * 0.82 / k * 0.9), counts: F.noCounts ? false : undefined, loop: F.loop, labels: ['You', 'Opponent'] });
    ctx.restore();
  });
}

const CALM_DIM = 'rgba(6,12,28,0.55)'; void CALM_DIM;
export function render(ctx, state, Lo) {
  beginFrame(); drawn.length = 0; checkFonts(ctx);
  const scene = state.scene, g = state.game, A = state.anim, scale = TEXT_SCALES[state.textScaleIdx] ?? 1, B = BTN, P = Lo.play;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'autoplay' || scene === 'autoplay-over';
  const playScene = scene === 'play' || scene === 'lesson' || scene === 'autoplay';
  const refScene = DOCS[scene];
  const tx = (s, x, y, size, color, font, weight, align, shadow) => text(ctx, s, x, y, size, color, font, weight, align, shadow);
  const btn = (r, label, o) => button(ctx, r, label, o, scale);

  drawTable(ctx, Lo, !!refScene || scene === 'settings');

  const labels = scene === 'autoplay' || scene === 'autoplay-over' ? ['Bottom seat', 'Top seat'] : scene === 'lesson' ? ['You', 'Opponent'] : state.two ? ['Player one', 'Player two'] : ['You', 'Computer'];
  if (playScene) {
    const pulse = state.calm ? 0.7 : 0.5 + 0.5 * Math.sin(state.t * 5);
    const S = P.status;
    ctx.fillStyle = 'rgba(8,14,34,0.6)'; ctx.beginPath(); ctx.roundRect(S.panel.x, S.panel.y, S.panel.w, S.panel.h, 28); ctx.fill();
    let l1, l2, l3 = '';
    const phase = (p) => (g.stock[p] > 0 ? 'namua' : 'mtaji');
    if (scene === 'lesson') { l1 = `Lesson ${state.lesson.i + 1} of ${LESSONS.length}`; l2 = LESSONS[state.lesson.i].title; }
    else if (scene === 'autoplay') {
      const AP = state.ap, dots = '.'.repeat(1 + (Math.floor(state.t * 3) % 3));
      l1 = 'Watch & Learn'; l2 = 'Two computer players. You watch and think.';
      l3 = state.apPaused ? 'Paused' : g.winner !== null ? 'Game over' : !AP ? '' : AP.phase === 'think' ? `${g.turn === 0 ? 'Bottom' : 'Top'} seat thinks${dots}` : AP.phase === 'reveal' ? 'Here is the move' : 'Playing it out' + dots;
    } else {
      const th = state.thinking && !A ? 'The computer is thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3)) : null;
      l1 = A ? (A.S0.turn === 0 ? (state.two ? 'Player one plays' : 'You play') : (state.two ? 'Player two plays' : 'The computer plays')) : g.winner !== null ? 'Game over' : state.two ? (g.turn === 0 ? 'Player one' : 'Player two') : g.turn === 0 ? 'Your move' : (th || 'The computer moves');
      l2 = state.two ? 'Two players, one phone' : `Computer: ${LEVELS[state.level].name}`;
      l3 = g.winner === null ? `${g.turn === 0 && !state.two ? 'You are' : (state.two ? (g.turn === 0 ? 'Bottom' : 'Top') : 'Computer') + (g.turn === 0 && !state.two ? '' : ' is')} in ${phase(g.turn)}` : '';
    }
    drawLine(ctx, Lo, S.l1, l1, CREAM, FONT, 700, 26);
    drawLine(ctx, Lo, S.l2, l2, 'rgba(248,235,204,0.85)', UI, 500, 18);
    drawLine(ctx, Lo, S.l3, l3, scene === 'autoplay' && state.apPaused ? '#ff9a6a' : GOLD, UI, 700, 18);

    // markers on pits
    const marks = [], kb = state.kbPit;
    if (!A && g.winner === null) {
      for (const m of state.legalMarks || []) marks.push({ p: m.p, r: m.r, c: m.c || 'gold', pulse: m.pulse !== false, a: m.c === 'red' ? 0.85 : 1 });
      if (state.sel) marks.push({ p: state.sel.p, r: state.sel.r, c: 'green', pulse: false });
    }
    if (state.hint && state.hint.show) marks.push({ p: state.hint.p, r: state.hint.r, c: 'green', pulse: true });
    if (state.prompt) for (const m of state.prompt.marks || []) marks.push({ ...m, pulse: true });
    if (state.apMarks) for (const m of state.apMarks) marks.push({ ...m, pulse: m.c === 'green' });
    if (A && A.last && A.last.t < 0.5 && !A.vis?.hold) marks.push({ p: A.last.p, r: A.last.r, c: 'amber', a: 0.7 * (1 - A.last.t / 0.5) });
    // the board group: drawn in group space under one uniform scale (count labels grow a little when the board shrinks)
    const k = Lo.grp.k, boost = Math.min(1.35, 1 + (scale - 1) * 0.18), cs = Math.round(Math.max(26, Math.min(32, Math.round(22 / k))) * boost);
    ctx.save(); ctx.translate(Lo.grp.ox, Lo.grp.oy); ctx.scale(k, k);
    drawPosition(ctx, state, state.shown, { marks, anim: A, shake: state.shake, labels, kbPit: kb, countSize: cs });
    if (state.prompt && state.prompt.arrows) for (const a of state.prompt.arrows) { const q = pitLocal(a.p, a.r); arcArrow(ctx, q.x, q.y, PIT_R + 11, a.cw, a.cw ? 'rgba(130,255,180,' + (0.65 + 0.35 * pulse) + ')' : 'rgba(255,200,110,' + (0.65 + 0.35 * pulse) + ')'); }
    ctx.restore();
    { const F = geom().FRAME; note('board', 'board', { x: Lo.grp.ox + F.x * k, y: Lo.grp.oy + F.y * k, w: F.w * k, h: F.h * k }); }

    // message / coach / prompt panel
    const inBar = P.promptInBar;
    if (state.prompt) {
      const PR = state.prompt, dir = PR.type === 'dir', PT = P.promptText(dir);
      panel(ctx, P.prompt.x, P.prompt.y, P.prompt.w, P.prompt.h, 0.94);
      const f = fitBox(ctx, PR.text, PT.w, PT.h, 26 * Math.min(scale, 1.4), 16, 700, 1.15);
      const y0 = PT.top ? PT.y : PT.y + (PT.h - f.L.length * f.lh) / 2 + f.s * 0.2;
      f.L.forEach((ln, i) => tx(ln, PT.x, y0 + i * f.lh, f.s, '#fff3d6', UI, 700, 'center', false));
      btn(B.pick1, PR.labels[0], { primary: true, size: 26 }); btn(B.pick2, PR.labels[1], { primary: true, size: 26 });
      if (PR.dots) PR.dots.forEach((c, i) => { const r = i ? B.pick2 : B.pick1; if (r.w < 230) return; ctx.fillStyle = c; ctx.strokeStyle = '#2a1606'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x + 22, r.y + r.h / 2, 8, 0, TAU); ctx.fill(); ctx.stroke(); });
      if (dir) btn(B.pickCancel, 'Cancel', { size: 22 });
    } else {
      const msg = state.msg ? state.msg.text : state.coach;
      if (msg) {
        const al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0.92, M = P.msg;
        const f = fitBox(ctx, msg, M.w - 50, M.h - 22, 28 * Math.min(scale, 1.5), 16, 600, 1.26);
        ctx.save(); ctx.globalAlpha = Math.max(0, al); panel(ctx, M.x, M.y, M.w, M.h, 0.9);
        const top = M.y + M.h / 2 - (f.L.length * f.lh) / 2 + f.s * 0.88; f.L.forEach((ln, i) => tx(ln, M.x + M.w / 2, top + i * f.lh, f.s, '#fff3d6', UI, 600, 'center', false));
        ctx.restore();
        if (f.over) note('text-over', msg, M, true);
      }
    }
    const prompting = !!state.prompt && inBar;
    if (scene === 'play') {
      btn(prompting ? B.menuPrompt : B.menu, 'Menu', { size: 28 });
      if (!prompting) { btn(B.undo, 'Undo', { size: 28, dim: !state.undo.length || !!A }); btn(B.hint, state.hintBusy ? 'Thinking…' : 'Think', { size: 28, dim: !!A || state.hintBusy }); }
    } else if (scene === 'lesson') {
      btn(prompting ? B.menuPrompt : B.menu, 'Menu', { size: 28 });
      if (state.lesson.done && !A) btn(B.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 30 });
    } else if (scene === 'autoplay') {
      btn(B.apExit, 'Exit', { size: 26 }); btn(B.apPause, state.apPaused ? 'Resume' : 'Pause', { size: 26, primary: state.apPaused });
      btn(B.apDec, '−', { size: 32, dim: state.apThinkIdx === 0 }); btn(B.apInc, '+', { size: 32, dim: state.apThinkIdx === AP_THINK_STEPS.length - 1 });
      const lab = `Think time: ${AP_THINK_STEPS[state.apThinkIdx]}s`, lw = P.apLabel.w ?? 600;
      tx(lab, P.apLabel.x, P.apLabel.y - 4, fitSz(ctx, lab, P.apLabel.size, 600, UI, lw, 16), GOLD, UI, 600);
    }
    if (scene === 'play' && state.dev) tx('DEV', P.dev.x, P.dev.y, 18, '#7dff9a', UI, 700, 'right');
  }

  if (scene === 'title') {
    const T = Lo.title(!!state.saved, scale);
    if (T.board) {
      withGeom('tall', () => {
        ctx.save(); ctx.translate(T.board.ox, T.board.oy); ctx.scale(T.board.s, T.board.s);
        const st = { ...state, shown: null };
        const start = () => { const a = new Array(16).fill(0); a[4] = 6; a[5] = 2; a[6] = 2; return a; };
        drawPosition(ctx, st, { pits: [start(), start()], stock: [22, 22] }, { counts: false });
        ctx.restore();
      });
      note('board', 'mini board', { x: T.board.ox + 8 * T.board.s, y: T.board.oy + 330 * T.board.s, w: 704 * T.board.s, h: 850 * T.board.s });
    }
    ctx.fillStyle = 'rgba(8,14,34,0.62)'; ctx.beginPath(); ctx.roundRect(T.panel.x, T.panel.y, T.panel.w, T.panel.h, 30); ctx.fill();
    const f = fitSz(ctx, 'Bao la Kiswahili', T.title.size, 700, FONT, clearW(Lo, T.title), 40);
    tx('Bao la Kiswahili', T.title.x, T.title.y, f, CREAM, FONT, 700);
    tx('The great board game of the Swahili coast', T.tagline.x, T.tagline.y, fitSz(ctx, 'The great board game of the Swahili coast', T.tagline.size, 600, FONT, clearW(Lo, T.tagline), 16), 'rgba(248,235,204,0.92)', FONT, 600);
    const R = T.rows;
    if (R.resume) btn(R.resume, 'Continue your game', { primary: true, size: 32 });
    btn(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 32 });
    btn(R.play, 'Play the computer', { primary: state.learned && !R.resume, size: 32 });
    btn(R.two, 'Two players, one phone', { size: 30 });
    btn(R.autoplay, 'Watch & Learn (Auto Play)', { size: 28 });
    const ss = T.smallSize; btn(R.howto, 'How to Play', { size: ss }); btn(R.rules, 'Rules', { size: ss }); btn(R.about, 'About', { size: ss }); btn(R.settings, 'Settings', { size: ss });
    tx(`Games played: ${state.stats.games}  ·  won: ${state.stats.wins}`, T.sx, T.stats.y, T.stats.size, 'rgba(248,235,204,0.85)', UI, 500);
    let stars = ''; for (let l = 0; l < LEVELS.length; l++) stars += state.stats.badges['L' + l] ? '★ ' : '☆ ';
    tx(stars.trim(), T.sx, T.stats.y2, T.stats.size2, GOLD, UI, 700);
    if (state.msg) { const mx = T.sx, f2 = fitBox(ctx, state.msg.text, Math.min(620, R.learn.w + 40), 70, 24, 16); f2.L.forEach((ln, i) => tx(ln, mx, T.msgY + i * f2.lh, f2.s, '#ffe9b0', UI, 600)); }
    if (T.brand && drawLockup(ctx, T.brand, 0.9, (state.afFlash || 0) > 0)) note('brand', 'lockup', T.brand);
  } else if (scene === 'demo-limit') {
    const o = Lo.over.demo;
    ctx.save(); ctx.translate(o.ox, o.oy); ctx.scale(o.s, o.s);
    panel(ctx, 60, 790, 600, 400, 0.9);
    tx('That was the free taste.', 360, 900, 52, CREAM, FONT, 700);
    const f = fitBox(ctx, 'Get Bao la Kiswahili on iPhone and Android for unlimited games.', 520, 140, 30 * Math.min(scale, 1.5), 16, 600);
    f.L.forEach((ln, i) => tx(ln, 360, 970 + i * f.lh, f.s, '#fff3d6', UI, 600));
    ctx.restore();
    btn(B.demoMenu, 'Menu', { primary: true, size: 32 });
  } else if (scene === 'settings') {
    const S = Lo.settings(scale), SET = S.rows, PN = S.panel;
    panel(ctx, PN.x, PN.y, PN.w, PN.h, 0.55);
    tx('Settings', S.title.x, S.title.y, fitSz(ctx, 'Settings', S.title.size, 700, FONT, clearW(Lo, { x: S.title.x, y: S.title.y, size: S.title.size, maxW: 400 }), 30), CREAM, FONT, 700);
    btn(SET.level, `Computer level: ${LEVELS[state.level].name}`, { size: 30 });
    btn(SET.sound, state.sound ? 'Sound: on' : 'Sound: off', { size: 30 });
    btn(SET.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 30 });
    btn(SET.text, `Text size: ${Math.round(scale * 100)}%`, { size: 30 });
    btn(SET.seeds, `Seeds: ${SEEDSETS[state.seeds]}`, { size: 30 });
    btn(SET.wood, `Board: ${WOODS[state.wood].name}`, { size: 30 });
    btn(SET.think, `Watch & Learn think time: ${AP_THINK_STEPS[state.apThinkIdx]}s`, { size: 28 });
    const X = S.extra;
    if (scale < 2 && X.room >= 70) {
      const f = fitBox(ctx, LEVELS[state.level].blurb, X.w, Math.min(130 * Math.min(scale, 1.5), X.room - 12), 26 * Math.min(scale, 1.6), 16, 600);
      f.L.forEach((ln, i) => tx(ln, X.x, X.y + i * f.lh, f.s, '#ffe9b0', UI, 600));
      if (X.room >= 200) for (let k = 0; k < 9; k++) drawSeed(ctx, state.seeds, k % 4, X.seedsX + k * 38, X.seedsY, k * 0.7, 1.5);
    }
    btn(SET.back, 'Back', { primary: true, size: 32 });
  } else if (refScene) {
    const D = DOCS[scene], DL = Lo.docs, doc = layoutDoc(ctx, scene, D.pages, scale, Lo), PN = DL.panel;
    const bx = DL.body.x, top = DL.body.top, vh = Math.max(40, DL.body.bottom - top);
    state.scrollMax = Math.max(0, doc.total - vh); state.scroll = Math.max(0, Math.min(state.scrollMax, state.scroll));
    panel(ctx, PN.x, PN.y, PN.w, PN.h, 0.9);
    tx(D.title, DL.title.x, DL.title.y + 22, fitSz(ctx, D.title, 64, 700, FONT, DL.title.w, 28), CREAM, FONT, 700);
    btn(B.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); btn(B.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    ctx.save(); ctx.beginPath(); ctx.rect(PN.x + 4, top - 4, PN.w - 8, vh + 8); ctx.clip();
    const sy = top - state.scroll;
    for (const it of doc.items) {
      const iy = sy + it.y;
      if (iy + (it.h || 0) < top - 60 || iy - (it.h || 0) > top + vh + 60) continue;
      if (it.k === 'title') tx(it.t, bx, iy, it.sz, GOLD, FONT, 700, 'left');
      else if (it.k === 'line') tx(it.t, bx, iy, doc.bodySz, BODY, UI, 600, 'left');
      else if (it.k === 'fig') {
        drawFig(ctx, state, it.fig, sy + it.y, PN.x + PN.w / 2);
        it.capL.forEach((ln, i) => tx(ln, PN.x + PN.w / 2, sy + it.capY + i * it.capSz * 1.3, it.capSz, 'rgba(248,235,204,0.85)', UI, 600));
      }
    }
    ctx.restore();
    if (state.scrollMax > 0) { // scroll bar
      const trH = vh, thH = Math.max(36, trH * vh / doc.total), thY = top + (trH - thH) * (state.scroll / state.scrollMax), sx = PN.x + PN.w - 12;
      ctx.fillStyle = 'rgba(248,235,204,0.14)'; ctx.beginPath(); ctx.roundRect(sx, top, 6, trH, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,200,110,0.8)'; ctx.beginPath(); ctx.roundRect(sx, thY, 6, thH, 3); ctx.fill();
    }
    tx(state.scrollMax > 0 ? `${Math.round(100 * state.scroll / state.scrollMax)}%` : '', DL.label.x, DL.label.y, DL.label.size, 'rgba(248,235,204,0.7)', UI, 500);
    const last = state.scrollMax <= 1 || state.scroll >= state.scrollMax - 1;
    btn(B.pgBack, 'Back', { size: 28 }); btn(B.pgNext, last ? 'Done' : 'Next', { primary: true, size: 28 });
  } else if (scene === 'over' || scene === 'autoplay-over') {
    const o = Lo.over;
    ctx.fillStyle = 'rgba(6,10,26,0.9)'; ctx.fillRect(0, 0, Lo.w, Lo.h);
    ctx.save(); ctx.translate(o.text.ox, o.text.oy); ctx.scale(o.text.s, o.text.s);
    if (scene === 'over') {
      const won = g.winner === 'draw' ? 'A draw' : state.two ? (g.winner === 0 ? 'Player one wins' : 'Player two wins') : g.winner === 0 ? 'You win!' : 'The computer wins';
      const f1 = fitSz(ctx, won, 96, 700, FONT, 640, 40); tx(won, 360, 440, f1, CREAM, FONT, 700);
      const f = fitBox(ctx, g.reason, 600, 130, 28 * Math.min(scale, 1.6), 16, 600); f.L.forEach((ln, i) => tx(ln, 360, 510 + i * f.lh, f.s, '#fff3d6', UI, 600));
      tx(`${sum(g.pits[0]) + g.stock[0]} : ${sum(g.pits[1]) + g.stock[1]}`, 360, 760, 120, GOLD, FONT, 700);
      tx(state.two ? 'Seeds held: Player one : Player two' : 'Seeds held: You : Computer', 360, 806, 22 * Math.min(scale, 1.3), 'rgba(248,235,204,0.85)', UI, 600);
      tx(`${g.moves} moves`, 360, 850, 24, 'rgba(248,235,204,0.7)', UI, 500);
      if (!state.two && g.winner === 0) {
        tx(`★ ${LEVELS[state.level].name} beaten`, 360, 920, 34, GOLD, UI, 700);
        if (!state.calm) for (let k = 0; k < 16; k++) { const ph = (state.t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (170 + 90 * ph), y = 640 - ph * 420; drawSeed(ctx, state.seeds, k % 4, x, y, ph * 6, 0.9 - ph * 0.4); }
      }
    } else {
      const won = g.winner === 'draw' ? 'A draw' : g.winner === 0 ? 'Bottom seat wins' : 'Top seat wins';
      tx('Watch & Learn complete', 360, 440, fitSz(ctx, 'Watch & Learn complete', 56, 700, FONT, 640, 30), CREAM, FONT, 700);
      tx(won, 360, 530, fitSz(ctx, won, 80, 700, FONT, 640, 36), GOLD, FONT, 700);
      const f = fitBox(ctx, g.reason, 600, 120, 28 * Math.min(scale, 1.6), 16, 600); f.L.forEach((ln, i) => tx(ln, 360, 600 + i * f.lh, f.s, '#fff3d6', UI, 600));
      tx(`${g.moves} moves`, 360, 800, 26, 'rgba(248,235,204,0.8)', UI, 500);
    }
    ctx.restore();
    if (scene === 'over') { btn(B.again, 'Play again', { primary: true, size: 36 }); btn(B.back, 'Menu', { size: 32 }); }
    else { btn(B.again, 'Watch another', { primary: true, size: 34 }); btn(B.back, 'Exit to menu', { size: 30 }); }
    drawMoreLine(ctx, o.more.x, o.more.y, 22);
  }
  void PITCH; void trayLocal; void REF; void bigMenu;
}
