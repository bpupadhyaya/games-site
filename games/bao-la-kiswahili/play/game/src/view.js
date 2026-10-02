// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The cloth, board and seed sprites are cached (art.js).
import { W, H, PIT_R, PITCH, FRAME, TRAY, BTN, REF, pitPos, trayPos, titleRows, setRows, bigMenu, TEXT_SCALES, AP_THINK_STEPS } from './layout.js';
import { drawTable, drawBoard, drawSeed, slot, WOODS, SEEDSETS, beginFrame } from './art.js';
import { LEVELS } from './engine.js';
import { RULES, HOWTO, ABOUT, FIGS } from './content.js';
import { LESSONS } from './lessons.js';
import { NYUMBA, sum } from './rules.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const CREAM = '#f8ebcc', GOLD = '#f0c860', BODY = '#fff3d6';
const COL = { gold: '255,220,120', green: '120,255,170', red: '255,110,90', amber: '255,176,70' };
const DOCS = { about: { title: 'About', pages: ABOUT }, howto: { title: 'How to Play', pages: HOWTO }, rules: { title: 'Rules', pages: RULES } };

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
// the largest size (down to `min`) at which `str` wraps to lines that fit maxW x maxH
function fitBox(ctx, str, maxW, maxH, size, min, weight = 600, lhk = 1.28) {
  let s = Math.round(size), L = wrapLines(ctx, str, maxW, s, weight);
  while ((L.length * s * lhk > maxH || L.some((l) => ctx.measureText(l).width > maxW)) && s > min) { s -= 1; L = wrapLines(ctx, str, maxW, s, weight); }
  return { L, s, lh: s * lhk };
}
function fitSz(ctx, str, size, weight, font, maxW, min) { let s = Math.round(size); ctx.font = `${weight} ${s}px ${font}`; while (ctx.measureText(str).width > maxW && s > min) { s -= 1; ctx.font = `${weight} ${s}px ${font}`; } return s; }
function wrapText(ctx, str, x, y, size, maxW, color = BODY, lh = size * 1.3, align = 'center') { const L = wrapLines(ctx, str, maxW, size); L.forEach((ln, i) => text(ctx, ln, x, y + i * lh, size, color, UI, 600, align)); return L.length; }

// flat buttons: one solid fill, a thin edge, a soft drop shadow. No inner highlight shape.
function button(ctx, r, label, o = {}, scale = 1) {
  ctx.save(); if (o.dim) ctx.globalAlpha = 0.45;
  ctx.fillStyle = 'rgba(2,6,20,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + 5, r.w, r.h, 18); ctx.fill();
  ctx.fillStyle = o.primary ? '#e0b048' : '#3b2415'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill();
  ctx.strokeStyle = o.primary ? '#fff0b8' : 'rgba(240,200,96,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  const base = o.size ?? 30, sc = Math.max(1, scale), padX = 14, padY = 10;
  const f = fitBox(ctx, label, r.w - padX * 2, r.h - padY * 2, base * sc, Math.min(base, 16), 700, 1.12);
  ctx.textAlign = 'center'; ctx.font = `700 ${f.s}px ${UI}`; ctx.fillStyle = o.primary ? '#2a1606' : CREAM;
  const top = r.y + r.h / 2 - (f.L.length * f.lh) / 2 + f.s * 0.88;
  f.L.forEach((ln, i) => ctx.fillText(ln, r.x + r.w / 2, top + i * f.lh));
  ctx.restore();
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
  for (const m of o.marks || []) glow(ctx, pitPos(m.p, m.r), COL[m.c] || m.rgb || COL.gold, (m.a ?? 1) * (m.pulse ? 0.55 + 0.45 * pulse : 1), m.r === NYUMBA);
  const A = o.anim;
  for (let p = 0; p < 2; p++) for (let r = 0; r < 16; r++) {
    const n = pos.pits[p][r]; if (n <= 0) continue;
    const q = pitPos(p, r); let dx = 0;
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
    const q = pitPos(p, r), y = p === 0 ? q.y + PIT_R + cs + 2 : q.y - PIT_R - 8;
    ctx.textAlign = 'center'; ctx.font = `800 ${cs}px ${UI}`; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(14,6,0,0.85)'; ctx.strokeText(String(n), q.x, y); ctx.fillStyle = '#fff1c8'; ctx.fillText(String(n), q.x, y);
  }
  // the stores
  const ph = (p) => (pos.stock[p] > 0 ? 'Namua' : 'Mtaji');
  for (let p = 0; p < 2; p++) {
    const T = p === 0 ? TRAY.s : TRAY.n, n = pos.stock[p];
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
      const a = pitPos(p, r), b = pitPos(p, (r + 1) % 16), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.save(); ctx.translate(mx, my); ctx.rotate(ang); ctx.beginPath(); ctx.moveTo(-9, -11); ctx.lineTo(7, 0); ctx.lineTo(-9, 11); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  for (const tg of o.tags || []) { const q = pitPos(tg.p, tg.r); tag(ctx, q.x, tg.below ? q.y + PIT_R + 30 : tg.p === 0 ? q.y - PIT_R - 20 : q.y + PIT_R + 24, tg.t, o.tagSize ?? 21); }
  if (o.kbPit) glow(ctx, pitPos(o.kbPit.p, o.kbPit.r), '125,255,155', 1, o.kbPit.r === NYUMBA);
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

// ---- reference pages (About / How to Play / Rules): paginated to the current text size ------------------------------------
const pageCache = {};
function layoutDoc(ctx, key, doc, scale) {
  const ck = key + '|' + scale; if (pageCache[ck]) return pageCache[ck];
  const bodySz = Math.round(28 * scale), lh = Math.round(bodySz * 1.38), gap = Math.round(lh * 0.5), maxW = REF.w - 70;
  const top = 266, bottom = REF.bottom, pages = [];
  for (const sec of doc) {
    const titleSz = fitSz(ctx, sec.title, Math.round(34 * scale), 700, FONT, maxW, 22);
    const startY = top + Math.round(titleSz * 1.2) + 14;
    const lines = [];
    for (const para of sec.text) { const L = wrapLines(ctx, para, maxW, bodySz, 600); L.forEach((ln, i) => lines.push({ t: ln, gap: i === 0 && lines.length ? gap : 0 })); }
    let figH = 0, capL = [], capSz = 0;
    if (sec.fig) { capSz = Math.max(18, Math.round(21 * Math.min(scale, 2))); capL = wrapLines(ctx, FIGS[sec.fig].caption, maxW, capSz, 600); figH = Math.round((FIGS[sec.fig].crop[1] - FIGS[sec.fig].crop[0]) * FIGS[sec.fig].k) + 12 + capL.length * capSz * 1.3 + 14; }
    let i = 0, first = true;
    while (i < lines.length || first) {
      const pg = { title: sec.title, titleSz, fig: first ? sec.fig : null, figH: first ? figH : 0, capL, capSz, lines: [], y0: startY + (first ? figH : 0) };
      let y = pg.y0;
      while (i < lines.length) {
        const need = lh + lines[i].gap;
        if (y + need > bottom && (pg.lines.length || (first && sec.fig))) break;
        pg.lines.push({ t: lines[i].t, y: y + lines[i].gap + Math.round(bodySz * 0.85) }); y += need; i++;
      }
      pg.bodySz = bodySz; pages.push(pg); first = false;
      if (!pg.lines.length && i >= lines.length) break;
    }
  }
  return (pageCache[ck] = pages);
}
function drawFig(ctx, state, id, topY) {
  const F = FIGS[id], k = F.k, [y0, y1] = F.crop;
  ctx.save(); ctx.translate(360, topY); ctx.scale(k, k); ctx.translate(-360, -y0);
  ctx.beginPath(); ctx.roundRect(8, y0, 704, y1 - y0, 26); ctx.clip();
  const marks = F.hl.map((h) => ({ p: h.p, r: h.r, c: h.c, pulse: false }));
  drawPosition(ctx, { ...state, t: 0, calm: true }, { pits: F.pits, stock: F.stock }, { marks, tags: F.tags, tagSize: Math.round(21 / k * 0.82 > 24 ? 24 : 21), countSize: Math.round(28 * 0.82 / k * 0.9), counts: F.noCounts ? false : undefined, loop: F.loop, labels: ['You', 'Opponent'] });
  ctx.restore();
}

export function render(ctx, state) {
  beginFrame();
  const scene = state.scene, g = state.game, A = state.anim, scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'autoplay' || scene === 'autoplay-over';
  const refScene = DOCS[scene];
  const tx = (s, x, y, size, color, font, weight, align, shadow) => text(ctx, s, x, y, size, color, font, weight, align, shadow);
  const btn = (r, label, o) => button(ctx, r, label, o, scale);

  drawTable(ctx, !!refScene || scene === 'settings');

  const labels = scene === 'autoplay' || scene === 'autoplay-over' ? ['Bottom seat', 'Top seat'] : scene === 'lesson' ? ['You', 'Opponent'] : state.two ? ['Player one', 'Player two'] : ['You', 'Computer'];
  if (boardScene) {
    const pulse = state.calm ? 0.7 : 0.5 + 0.5 * Math.sin(state.t * 5);
    ctx.fillStyle = 'rgba(8,14,34,0.6)'; ctx.beginPath(); ctx.roundRect(50, 112, 620, 186, 28); ctx.fill();
    let l1, l2, l3 = '';
    const phase = (p) => (g.stock[p] > 0 ? 'namua' : 'mtaji');
    if (scene === 'lesson') { l1 = `Lesson ${state.lesson.i + 1} of ${LESSONS.length}`; l2 = LESSONS[state.lesson.i].title; }
    else if (scene === 'autoplay' || scene === 'autoplay-over') {
      const AP = state.ap, dots = '.'.repeat(1 + (Math.floor(state.t * 3) % 3));
      l1 = 'Watch & Learn'; l2 = 'Two computer players. You watch and think.';
      l3 = scene === 'autoplay' && state.apPaused ? 'Paused' : g.winner !== null ? 'Game over' : !AP ? '' : AP.phase === 'think' ? `${g.turn === 0 ? 'Bottom' : 'Top'} seat thinks${dots}` : AP.phase === 'reveal' ? 'Here is the move' : 'Playing it out' + dots;
    } else {
      const th = state.thinking && !A ? 'The computer is thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3)) : null;
      l1 = A ? (A.S0.turn === 0 ? (state.two ? 'Player one plays' : 'You play') : (state.two ? 'Player two plays' : 'The computer plays')) : g.winner !== null ? 'Game over' : state.two ? (g.turn === 0 ? 'Player one' : 'Player two') : g.turn === 0 ? 'Your move' : (th || 'The computer moves');
      l2 = state.two ? 'Two players, one phone' : `Computer: ${LEVELS[state.level].name}`;
      l3 = g.winner === null ? `${g.turn === 0 && !state.two ? 'You are' : (state.two ? (g.turn === 0 ? 'Bottom' : 'Top') : 'Computer') + (g.turn === 0 && !state.two ? '' : ' is')} in ${phase(g.turn)}` : '';
    }
    const f1 = fitSz(ctx, l1, 60, 700, FONT, 640, 30);
    tx(l1, 360, 176, f1, CREAM, FONT, 700);
    const f2 = fitSz(ctx, l2, 24, 500, UI, 640, 14); tx(l2, 360, 220, f2, 'rgba(248,235,204,0.85)', UI, 500);
    const f3 = fitSz(ctx, l3 || ' ', 26, 700, UI, 640, 14); tx(l3, 360, 262, f3, scene === 'autoplay' && state.apPaused ? '#ff9a6a' : GOLD, UI, 700);

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
    drawPosition(ctx, state, state.shown, { marks, anim: A, shake: state.shake, labels, kbPit: kb });
    if (state.prompt && state.prompt.arrows) for (const a of state.prompt.arrows) { const q = pitPos(a.p, a.r); arcArrow(ctx, q.x, q.y + (a.p === 0 ? 0 : 0), PIT_R + 11, a.cw, a.cw ? 'rgba(130,255,180,' + (0.65 + 0.35 * pulse) + ')' : 'rgba(255,200,110,' + (0.65 + 0.35 * pulse) + ')'); }

    // message / coach / prompt panel
    if (state.prompt) {
      panel(ctx, 30, 1196, 660, 142, 0.94);
      const P = state.prompt, f = fitBox(ctx, P.text, P.type === 'dir' ? 520 : 610, 52, 26 * Math.min(scale, 1.4), 16, 700, 1.15);
      f.L.forEach((ln, i) => tx(ln, P.type === 'dir' ? 300 : 360, 1226 + i * f.lh, f.s, '#fff3d6', UI, 700, 'center', false));
      btn(BTN.pick1, P.labels[0], { primary: true, size: 26 }); btn(BTN.pick2, P.labels[1], { primary: true, size: 26 });
      if (P.dots) P.dots.forEach((c, i) => { const r = i ? BTN.pick2 : BTN.pick1; ctx.fillStyle = c; ctx.strokeStyle = '#2a1606'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x + 24, r.y + r.h / 2, 9, 0, TAU); ctx.fill(); ctx.stroke(); });
      if (P.type === 'dir') btn(BTN.pickCancel, 'Cancel', { size: 20 });
    } else {
      const msg = state.msg ? state.msg.text : state.coach;
      if (msg && scene !== 'over' && scene !== 'autoplay-over') {
        const al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0.92;
        const f = fitBox(ctx, msg, 610, 112, 28 * Math.min(scale, 1.5), 15, 600, 1.26);
        ctx.save(); ctx.globalAlpha = Math.max(0, al); panel(ctx, 30, 1196, 660, 134, 0.9);
        const top = 1196 + 67 - (f.L.length * f.lh) / 2 + f.s * 0.88; f.L.forEach((ln, i) => tx(ln, 360, top + i * f.lh, f.s, '#fff3d6', UI, 600, 'center', false));
        ctx.restore();
      }
    }
    if (scene === 'play') {
      btn(BTN.menu, 'Menu', { size: 28 }); btn(BTN.undo, 'Undo', { size: 28, dim: !state.undo.length || !!A }); btn(BTN.hint, state.hintBusy ? 'Thinking…' : 'Think', { size: 28, dim: !!A || state.hintBusy });
    } else if (scene === 'lesson') {
      btn(BTN.menu, 'Menu', { size: 28 });
      if (state.lesson.done && !A) btn(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 30 });
    } else if (scene === 'autoplay') {
      btn(BTN.apExit, 'Exit', { size: 26 }); btn(BTN.apPause, state.apPaused ? 'Resume' : 'Pause', { size: 26, primary: state.apPaused });
      btn(BTN.apDec, '−', { size: 32, dim: state.apThinkIdx === 0 }); btn(BTN.apInc, '+', { size: 32, dim: state.apThinkIdx === AP_THINK_STEPS.length - 1 });
      tx(`Think time: ${AP_THINK_STEPS[state.apThinkIdx]}s`, 360, 1456 - 4, 22, GOLD, UI, 600);
    }
    if (scene === 'play' && state.dev) tx('DEV', 40, 130, 20, '#7dff9a', UI, 700, 'left');
  }

  if (scene === 'title' || scene === 'demo-limit') {
    if (!(scene === 'title' && bigMenu(scale))) { ctx.save(); ctx.translate(360, 524); ctx.scale(0.5, 0.5); ctx.translate(-360, -(FRAME.y + FRAME.h / 2));
    const st = { ...state, shown: null };
    const start = (p) => { const a = new Array(16).fill(0); a[4] = 6; a[5] = 2; a[6] = 2; void p; return a; };
    drawPosition(ctx, st, { pits: [start(0), start(1)], stock: [22, 22] }, { counts: false });
    ctx.restore(); }
    ctx.fillStyle = 'rgba(8,14,34,0.62)'; ctx.beginPath(); ctx.roundRect(28, 116, 664, 168, 30); ctx.fill();
    const f = fitSz(ctx, 'Bao la Kiswahili', 112, 700, FONT, 640, 50);
    tx('Bao la Kiswahili', 360, 196, f, CREAM, FONT, 700);
    tx('The great board game of the Swahili coast', 360, 252, 25, 'rgba(248,235,204,0.92)', FONT, 600);
  }
  if (scene === 'title') {
    const R = titleRows(!!state.saved, scale);
    if (R.resume) btn(R.resume, 'Continue your game', { primary: true, size: 32 });
    btn(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 32 });
    btn(R.play, 'Play the computer', { primary: state.learned && !R.resume, size: 32 });
    btn(R.two, 'Two players, one phone', { size: 30 });
    btn(R.autoplay, 'Watch & Learn (Auto Play)', { size: 28 });
    btn(R.howto, 'How to Play', { size: 20 }); btn(R.rules, 'Rules', { size: 20 }); btn(R.about, 'About', { size: 20 }); btn(R.settings, 'Settings', { size: 20 });
    const y = Math.min(R.howto.y + R.howto.h + 50, 1400);
    const ss = Math.min(scale, 1.6); tx(`Games played: ${state.stats.games}  ·  won: ${state.stats.wins}`, 360, y, Math.round(22 * ss), 'rgba(248,235,204,0.85)', UI, 500);
    let stars = ''; for (let l = 0; l < LEVELS.length; l++) stars += state.stats.badges['L' + l] ? '★ ' : '☆ ';
    tx(stars.trim(), 360, y + Math.round(40 * ss), Math.round(30 * ss), GOLD, UI, 700);
    if (state.msg) { const f = fitBox(ctx, state.msg.text, 620, 70, 24, 14); f.L.forEach((ln, i) => tx(ln, 360, 1420 + i * f.lh, f.s, '#ffe9b0', UI, 600)); }
  } else if (scene === 'demo-limit') {
    panel(ctx, 60, 790, 600, 400, 0.9);
    tx('That was the free taste.', 360, 900, 52, CREAM, FONT, 700);
    const f = fitBox(ctx, 'Get Bao la Kiswahili on iPhone and Android for unlimited games.', 520, 140, 30 * Math.min(scale, 1.5), 16, 600);
    f.L.forEach((ln, i) => tx(ln, 360, 970 + i * f.lh, f.s, '#fff3d6', UI, 600)); btn(BTN.back, 'Menu', { primary: true, size: 32 });
  } else if (scene === 'settings') {
    panel(ctx, 40, 130, 640, 1220, 0.55);
    tx('Settings', 360, 232, 70, CREAM, FONT, 700);
    const SET = setRows(scale);
    btn(SET.level, `Computer level: ${LEVELS[state.level].name}`, { size: 30 });
    btn(SET.sound, state.sound ? 'Sound: on' : 'Sound: off', { size: 30 });
    btn(SET.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 30 });
    btn(SET.text, `Text size: ${Math.round(scale * 100)}%`, { size: 30 });
    btn(SET.seeds, `Seeds: ${SEEDSETS[state.seeds]}`, { size: 30 });
    btn(SET.wood, `Board: ${WOODS[state.wood].name}`, { size: 30 });
    btn(SET.think, `Watch & Learn think time: ${AP_THINK_STEPS[state.apThinkIdx]}s`, { size: 28 });
    if (scale < 2) {
      const f = fitBox(ctx, LEVELS[state.level].blurb, 580, 130 * Math.min(scale, 1.5), 26 * Math.min(scale, 1.6), 15, 600);
      f.L.forEach((ln, i) => tx(ln, 360, SET.think.y + SET.think.h + 56 + i * f.lh, f.s, '#ffe9b0', UI, 600));
      for (let k = 0; k < 9; k++) drawSeed(ctx, state.seeds, k % 4, 210 + k * 38, 1170, k * 0.7, 1.5);
    }
    btn(SET.back, 'Back', { primary: true, size: 32 });
  } else if (refScene) {
    const D = DOCS[scene], pages = layoutDoc(ctx, scene, D.pages, scale);
    state.pageCount = pages.length; const pi = Math.min(state.page, pages.length - 1), pg = pages[pi];
    panel(ctx, REF.x, REF.y, REF.w, REF.h, 0.9);
    tx(D.title, 360, 214, fitSz(ctx, D.title, 64, 700, FONT, 380, 30), CREAM, FONT, 700);
    btn(BTN.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); btn(BTN.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    tx(pg.title, 70, 266 + Math.round(pg.titleSz * 0.85), pg.titleSz, GOLD, FONT, 700, 'left');
    if (pg.fig) {
      const figTop = 266 + Math.round(pg.titleSz * 1.2) + 14, fg = FIGS[pg.fig];
      drawFig(ctx, state, pg.fig, figTop);
      const capTop = figTop + Math.round((fg.crop[1] - fg.crop[0]) * fg.k) + 14 + Math.round(pg.capSz * 0.9);
      pg.capL.forEach((ln, i) => tx(ln, 360, capTop + i * pg.capSz * 1.3, pg.capSz, 'rgba(248,235,204,0.85)', UI, 600));
    }
    for (const L of pg.lines) tx(L.t, 70, L.y, pg.bodySz, BODY, UI, 600, 'left');
    tx(`Page ${pi + 1} of ${pages.length}`, 360, 1304, 20, 'rgba(248,235,204,0.7)', UI, 500);
    const last = pi === pages.length - 1;
    btn(BTN.pgBack, 'Back', { size: 28 }); btn(BTN.pgNext, last ? 'Done' : 'Next', { primary: true, size: 28 });
  } else if (scene === 'over') {
    ctx.fillStyle = 'rgba(6,10,26,0.9)'; ctx.fillRect(0, 0, W, H);
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
    btn(BTN.again, 'Play again', { primary: true, size: 36 }); btn(BTN.back, 'Menu', { size: 32 });
  } else if (scene === 'autoplay-over') {
    ctx.fillStyle = 'rgba(6,10,26,0.9)'; ctx.fillRect(0, 0, W, H);
    const won = g.winner === 'draw' ? 'A draw' : g.winner === 0 ? 'Bottom seat wins' : 'Top seat wins';
    tx('Watch & Learn complete', 360, 440, fitSz(ctx, 'Watch & Learn complete', 56, 700, FONT, 640, 30), CREAM, FONT, 700);
    tx(won, 360, 530, fitSz(ctx, won, 80, 700, FONT, 640, 36), GOLD, FONT, 700);
    const f = fitBox(ctx, g.reason, 600, 120, 28 * Math.min(scale, 1.6), 16, 600); f.L.forEach((ln, i) => tx(ln, 360, 600 + i * f.lh, f.s, '#fff3d6', UI, 600));
    tx(`${g.moves} moves`, 360, 800, 26, 'rgba(248,235,204,0.8)', UI, 500);
    btn(BTN.again, 'Watch another', { primary: true, size: 34 }); btn(BTN.back, 'Exit to menu', { size: 30 });
  }
  void H; void PITCH; void trayPos;
}
