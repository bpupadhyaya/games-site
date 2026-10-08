// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, R, clamp } from './layout.js';
import { drawTable, drawBoard, drawPeg, drawDiagram, diagramSize, BOARDS, SEAT } from './art.js';
import { RULES, HOWTO, ABOUT, LESSONS } from './content.js';
import { settingsItems } from './settings.js';
import { VARIANTS, NAMES, geo, progress, pegsHome } from './rules.js';
import { LEVELS } from './ai.js';
import { drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';

const FONT = '"Fredoka", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GOLD = '#f6d77c', CREAM = '#fff8e8', DIM = 'rgba(246,215,124,0.8)', CORAL = '#ee6f4d';
const TAU = Math.PI * 2;
export const ui = { hits: [], buttons: [] };
export const docMetrics = { max: 0, view: 0 };
export const readerStats = { fits: 0 };
const fitMemo = new Map(); let fitFontsKey = '';
const ease = (f) => f * f * (3 - 2 * f);

export function render(ctx, state, L) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== fitFontsKey || fitMemo.size > 3000) { fitMemo.clear(); fitFontsKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { readerStats.fits++; v = fn(); fitMemo.set(key, v); } return v; };
  ui.hits.length = 0; ui.buttons.length = 0;
  const scene = state.scene, scale = TEXT_SCALES[state.textScaleIdx] ?? 1, big = scale > 1, g = state.game, a = state.anim, B = L.board, G = geo(g.variant);
  const minU = Math.max(12, 11 / (host.px || 0.6));
  const boardKey = state.board, style = state.style;

  // ---------------------------------------------------------------- helpers
  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const fitText = (str, x, y, size, maxW, color, font = UI, weight = 700, align = 'center', min = minU) => {
    const s = memo(`f|${str}|${size}|${maxW}|${font}|${weight}|${min}`, () => { let q = size; ctx.font = `${weight} ${q}px ${font}`; while (q > min && ctx.measureText(str).width > maxW) { q -= 1; ctx.font = `${weight} ${q}px ${font}`; } return q; });
    text(str, x, y, s, color, font, weight, align); return s;
  };
  const lines = (str, size, maxW, weight = 600, font = UI) => memo(`l|${weight}|${size}|${maxW}|${font}|${str}`, () => {
    ctx.font = `${weight} ${size}px ${font}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  });
  const wrapBox = (str, r, size, lhRatio, color, align = 'center', min = minU, valign = 'middle') => {
    const s = memo(`b|${str}|${size}|${r.w}|${r.h}|${lhRatio}|${min}`, () => { let q = size, l2 = lines(str, q, r.w); while (q > min && (l2.length * q * lhRatio > r.h || l2.some((l) => ctx.measureText(l).width > r.w + 0.5))) { q -= 1; l2 = lines(str, q, r.w); } return q; });
    const ls = lines(str, s, r.w), lh = s * lhRatio, x = align === 'center' ? r.x + r.w / 2 : align === 'right' ? r.x + r.w : r.x;
    const y0 = valign === 'middle' ? r.y + (r.h - ls.length * lh) / 2 : r.y;
    ls.forEach((ln, i) => text(ln, x, y0 + s * 0.85 + i * lh, s, color, UI, 600, align));
    return ls.length;
  };
  const panel = (r, rad = 18, fill = 'rgba(5,28,32,0.66)', stroke = 'rgba(246,215,124,0.22)', brand = true) => {
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.38);
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(18, r.h / 3);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#fbc649'); gr.addColorStop(1, '#d9820f'); } else if (o.on) { gr.addColorStop(0, '#3f8f8a'); gr.addColorStop(1, '#215a58'); } else { gr.addColorStop(0, '#23595d'); gr.addColorStop(1, '#10353a'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,236,170,0.9)' : 'rgba(246,215,124,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    const size = o.size ?? 28, maxW = r.w - 20, col = o.primary ? '#2d1800' : GOLD, cy = r.y + r.h / 2;
    const w1 = (str, s) => { ctx.font = `600 ${s}px ${FONT}`; return ctx.measureText(str).width; };
    let s1 = size; while (s1 > minU && w1(label, s1) > maxW) s1 -= 1;
    let best = { s: s1, ls: [label] };
    if (s1 < size * 0.74) {
      const ws = label.split(' ');
      for (let cut = 1; cut < ws.length; cut++) {
        const ls = [ws.slice(0, cut).join(' '), ws.slice(cut).join(' ')]; let s2 = size;
        while (s2 > minU && (Math.max(w1(ls[0], s2), w1(ls[1], s2)) > maxW || s2 * 2.25 > r.h)) s2 -= 1;
        if (s2 > best.s) best = { s: s2, ls };
      }
    }
    if (o.sub && best.ls.length === 1) { text(label, r.x + r.w / 2, cy + best.s * 0.1 - 6, best.s, col, FONT, 600); fitText(o.sub, r.x + r.w / 2, cy + best.s * 0.1 + Math.max(minU, size * 0.62) + 2, Math.round(size * 0.62), maxW, o.primary ? 'rgba(45,24,0,0.8)' : DIM, UI, 500, 'center', minU); }
    else if (best.ls.length === 1) text(label, r.x + r.w / 2, cy + best.s * 0.35, best.s, col, FONT, 600);
    else best.ls.forEach((ln, i) => text(ln, r.x + r.w / 2, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s, col, FONT, 600));
    ctx.restore();
  };

  // ---------------------------------------------------------------- scenes
  drawTable(ctx, L, state.t);
  if (!state.calm) motes(ctx, L, state.t);

  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();

  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(6,22,26,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function drawTitle() {
    const T = L.title(!!state.saved), Rr = T.rows;
    if (T.card) panel(T.card, 24, 'rgba(5,28,32,0.58)');
    hero(T.hero);
    if (scene === 'demo-limit') {
      const r = T.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!T.card) panel(r, 24, 'rgba(5,28,32,0.74)');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, GOLD, FONT, 700);
      wrapBox('Get Halma: Hop and Leap on iPhone and Android for unlimited games, all three rule sets and every level.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      if (Rr.resume) button(Rr.resume, 'Continue your game', { primary: true, size: 30 });
      button(Rr.play, 'Play the computer', { primary: !Rr.resume, size: 32, sub: `${VARIANTS[state.variant].name} · ${LEVELS[state.level].name}` });
      button(Rr.two, state.variant === 'quad' ? 'Four players' : 'Two players', { size: 26 }); button(Rr.learn, state.learned ? 'Learn' : 'Learn to play', { size: 26 });
      button(Rr.auto, 'Auto Play · Watch & Learn', { size: 26 });
      button(Rr.rules, 'Rules', { size: 26 }); button(Rr.how, 'How to Play', { size: 26 });
      button(Rr.about, 'About', { size: 26 }); button(Rr.settings, 'Settings', { size: 26 });
      if (state.msg) fitText(state.msg.text, L.w / 2, T.rows.play.y - 14, 24, L.w - 40, GOLD, UI, 600);
    }
    const lk = T.lockup; state.lockupRect = drawLockup(ctx, lk.x, lk.y + 4, 50);
  }

  function hero(r) {
    const cx = r.x + r.w / 2;
    const ts = clamp(Math.min(r.w / 4.4, r.h / 3.6), 44, 150), sub = Math.max(minU, ts * 0.22);
    const pw = Math.min(r.w * 0.78, ts * 4.1);
    const head = ts * 0.92 + ts * 0.2 + sub * 1.8 + ts * 0.18, cellEst = clamp(Math.min((r.w - 24) / 8.4, 104), 28, 104), boardH = 5 * cellEst + 0.9 * cellEst + 24;
    const off = Math.max(0, Math.min(r.h * 0.2, (r.h - head - boardH) / 2));
    const y0 = r.y + off + ts * 0.92;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5;
    const grad = ctx.createLinearGradient(0, y0 - ts * 0.8, 0, y0 + ts * 0.1); grad.addColorStop(0, '#fff3c4'); grad.addColorStop(1, '#f0a93a');
    fitText('Halma', cx, y0, ts, r.w - 10, grad, FONT, 700);
    ctx.restore();
    const py = y0 + ts * 0.2;
    ctx.save(); const pg = ctx.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0); pg.addColorStop(0, '#ee6f4d'); pg.addColorStop(1, '#e0a030');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, sub * 1.8, sub * 0.9); ctx.fill(); ctx.restore();
    fitText('HOP  ·  LEAP  ·  RACE', cx, py + sub * 1.3, sub, pw - 20, '#2b1500', FONT, 700);
    const top = py + sub * 1.8 + ts * 0.18, room = r.y + r.h - top;
    if (room > 90) heroBoard(R(r.x, top + 6, r.w, Math.min(room - 22, boardH + 30)));
  }

  function heroBoard(r) {
    const cols = 8, rows = 5, cell = clamp(Math.min((r.w - 24) / (cols + 0.4), (r.h - 14) / (rows + 0.45), 104), 28, 104);
    const bw = cols * cell, bh = rows * cell, x0 = r.x + (r.w - bw) / 2, y0 = r.y + (r.h - bh) / 2 + 4;
    const T = state.calm ? 1.5 : state.t % 8.2, pal = BOARDS[boardKey] || BOARDS.maple;
    ctx.save();
    const m = cell * 0.2, pw = bw + 2 * m, ph = bh + 2 * m, px0 = x0 - m, py0 = y0 - m;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.roundRect(px0 + 4, py0 + 12, pw, ph + 6, 14); ctx.fill();
    const sg = ctx.createLinearGradient(0, py0 + ph - 8, 0, py0 + ph + 12); sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
    ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(px0, py0 + 8, pw, ph + 8, 14); ctx.fill();
    const fg = ctx.createLinearGradient(px0, py0, px0 + pw, py0 + ph); fg.addColorStop(0, pal.frame[0]); fg.addColorStop(1, pal.frame[2]);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(px0, py0, pw, ph, 14); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, bw, bh); ctx.clip();
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { ctx.fillStyle = (i + j) % 2 ? pal.b : pal.a; ctx.fillRect(x0 + j * cell, y0 + i * cell, cell, cell); }
    ctx.restore();
    ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(1, cell * 0.03); ctx.beginPath();
    for (let i = 0; i <= rows; i++) { ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + bw, y0 + i * cell); }
    for (let j = 0; j <= cols; j++) { ctx.moveTo(x0 + j * cell, y0); ctx.lineTo(x0 + j * cell, y0 + bh); }
    ctx.stroke();
    const at = (r2, c) => ({ x: x0 + (c + 0.5) * cell, y: y0 + (r2 + 0.5) * cell });
    // the script: a blue peg rides a ladder of three pieces in one turn
    const path = [[4, 0], [2, 2], [2, 4], [0, 6]], fixed = [[3, 1, 2], [2, 3, 3], [1, 5, 4], [4, 4, 1], [0, 1, 2], [3, 7, 3], [4, 6, 4]];
    const t0 = 1.5, segT = 0.46, tEnd = t0 + 3 * segT, resetT = 6.6;
    const op = T < 0.5 ? T / 0.5 : T > resetT ? Math.max(0, 1 - (T - resetT) / 0.6) : 1;
    ctx.globalAlpha = op;
    // the gold trail
    const seg = clamp((T - t0) / segT, 0, 3), done = Math.floor(seg);
    if (T > t0) {
      ctx.strokeStyle = `rgba(255,205,90,${0.85 * (T > tEnd + 1.2 ? Math.max(0, 1 - (T - tEnd - 1.2) / 1.5) : 1)})`; ctx.lineWidth = Math.max(2.5, cell * 0.07); ctx.lineCap = 'round'; ctx.setLineDash([cell * 0.14, cell * 0.12]);
      for (let k = 0; k < 3; k++) {
        const f = clamp(seg - k, 0, 1); if (f <= 0) break;
        const p0 = at(...path[k]), p1 = at(...path[k + 1]), mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2 - cell * 0.5;
        ctx.beginPath(); const n = 14;
        for (let q = 0; q <= n * f; q++) { const u = q / n, x = (1 - u) * (1 - u) * p0.x + 2 * u * (1 - u) * mx + u * u * p1.x, y = (1 - u) * (1 - u) * p0.y + 2 * u * (1 - u) * my + u * u * p1.y; q ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    const items = fixed.map(([r2, c, s]) => ({ r2, c, s })); items.sort((p, q) => p.r2 - q.r2);
    for (const it of items) { const p = at(it.r2, it.c); drawPeg(ctx, it.s, style, p.x, p.y, cell); }
    let mp = at(...path[0]), lift = 0;
    if (T < t0) lift = clamp((T - 0.9) / 0.5, 0, 1) * 0.5;
    else if (T < tEnd) { const k = Math.min(2, done), f = seg - k, p0 = at(...path[k]), p1 = at(...path[k + 1]); mp = { x: p0.x + (p1.x - p0.x) * ease(f), y: p0.y + (p1.y - p0.y) * ease(f) }; lift = 0.5 + Math.sin(Math.PI * f) * 2.4; }
    else { mp = at(...path[3]); lift = Math.max(0, 0.5 * (1 - (T - tEnd) / 0.25)); }
    drawPeg(ctx, 1, style, mp.x, mp.y, cell, { lift, glow: T > 0.9 && T < tEnd + 0.8 ? 0.7 : 0 });
    if (T > tEnd && T < tEnd + 0.8 && !state.calm) {                                  // a burst where the ladder ends
      const f = (T - tEnd) / 0.8, p = at(...path[3]);
      ctx.strokeStyle = `rgba(255,236,170,${0.85 * (1 - f)})`; ctx.lineWidth = 5 * (1 - f) + 1; ctx.beginPath(); ctx.ellipse(p.x, p.y + cell * 0.25, cell * (0.3 + 0.9 * f), cell * (0.15 + 0.4 * f), 0, 0, TAU); ctx.stroke();
      const fs = Math.round(cell * 0.5); ctx.save(); ctx.globalAlpha *= Math.min(1, (1 - f) * 2); ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = fs * 0.14; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(30,12,0,0.9)';
      ctx.strokeText('3 hops!', p.x, p.y - cell * (0.7 + 0.6 * f)); ctx.fillStyle = '#ffd24a'; ctx.fillText('3 hops!', p.x, p.y - cell * (0.7 + 0.6 * f)); ctx.restore();
    }
    ctx.restore();
  }

  // ================================================================ play / over / lesson
  function drawPlayScreen() {
    const isLesson = scene === 'lesson', over = scene === 'over', cell = B.cell, n = G.n;
    if (L.land) { if (L.leftCard) panel(L.leftCard, 18); panel(L.rightCard, 18); }
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    ctx.save();
    drawBoard(ctx, B, boardKey, g.variant);
    // the last move: its route, until the next move
    const last = a ? null : g.last;
    if (last && !isLesson && last.path.length > 1) { for (const q of last.path) { const p = L.sq(q); ctx.fillStyle = 'rgba(255,214,110,0.20)'; ctx.fillRect(p.x - cell / 2, p.y - cell / 2, cell, cell); } trail(last.path, 0.5, cell); }
    // your goal camp: a star on each square still to fill
    const goalSeat = state.autoMode ? 0 : state.two ? g.turn : 1;
    if (state.marks && goalSeat && !over) for (const q of G.camps[G.targetC[goalSeat]]) {
      if (g.board[q] === goalSeat) continue;
      const p = L.sq(q); star(p.x, p.y, cell * (g.board[q] ? 0.2 : 0.26), `rgba(${SEAT[goalSeat].tint},${g.board[q] ? 0.5 : 0.55 + pulse * 0.2})`, g.board[q] ? 1 : 0);
    }
    if (isLesson && LESSONS[state.lesson.i].target !== undefined && !state.lesson.done) { const p = L.sq(LESSONS[state.lesson.i].target); ctx.strokeStyle = `rgba(238,111,77,${0.6 + 0.4 * pulse})`; ctx.lineWidth = cell * 0.08; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.4, 0, TAU); ctx.stroke(); }
    // selected peg: reachable squares
    if (state.sel >= 0 && !a && !over) {
      const sp = L.sq(state.sel); ctx.fillStyle = `rgba(255,224,120,${0.28 + pulse * 0.14})`; ctx.fillRect(sp.x - cell / 2, sp.y - cell / 2, cell, cell);
      for (const m of state.selMoves) {
        const p = L.sq(m.to);
        if (m.hops) {
          ctx.fillStyle = `rgba(255,200,70,${0.22 + pulse * 0.1})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.36, 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(232,150,20,${0.8 + pulse * 0.2})`; ctx.lineWidth = Math.max(2, cell * 0.07); ctx.stroke();
          if (cell >= 26) { const s = Math.round(cell * 0.3); ctx.fillStyle = '#c96a08'; ctx.beginPath(); ctx.arc(p.x + cell * 0.3, p.y - cell * 0.3, s * 0.58, 0, TAU); ctx.fill(); text(String(m.hops), p.x + cell * 0.3, p.y - cell * 0.3 + s * 0.2, s * 0.74, '#fff', UI, 800); }
        } else { ctx.fillStyle = `rgba(255,248,214,${0.6 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.14, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(70,40,10,0.5)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    }
    if (state.hint && !a) {
      for (const q of [state.hint.from, state.hint.to]) { const p = L.sq(q); ctx.fillStyle = `rgba(90,230,150,${0.3 + pulse * 0.2})`; ctx.fillRect(p.x - cell / 2, p.y - cell / 2, cell, cell); ctx.strokeStyle = 'rgba(90,230,150,0.95)'; ctx.lineWidth = 3; ctx.strokeRect(p.x - cell / 2 + 2, p.y - cell / 2 + 2, cell - 4, cell - 4); }
      if (state.hint.path) trail([state.hint.from, ...state.hint.path], 1, cell, '90,230,150');
    }
    // pegs, far rows first (a lower peg overlaps the one above it)
    const movingTo = a ? a.path[a.path.length - 1] : -1, dragging = state.drag && state.sel >= 0;
    for (let i = 0; i < g.board.length; i++) {
      const k = g.board[i]; if (!k || i === movingTo) continue;
      if (dragging && i === state.sel) continue;
      const p = L.sq(i), sel = state.sel === i;
      drawPeg(ctx, k, style, p.x, p.y, cell, { lift: sel ? 0.45 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.06) : 0, glow: sel ? 0.8 : 0 });
    }
    // the moving peg: a hop arc per jump, a ripple at every landing, a count when the chain ends
    if (a) {
      let acc = 0, k = 0;
      while (k < a.segs.length - 1 && a.t >= acc + a.segs[k].d) { acc += a.segs[k].d; k++; }
      const sg = a.segs[k], f = clamp((a.t - acc) / sg.d, 0, 1), done = a.t >= a.dur - 0.16;
      const reached = done ? a.segs.length : k;
      const upto = a.path.slice(0, Math.min(a.path.length, reached + 2)); trail(upto, 1, cell, null, (done ? 1 : f), a.path.length - 1);
      acc = 0;
      for (let q = 0; q < a.segs.length; q++) {                                    // ripples
        acc += a.segs[q].d; const since = a.t - acc;
        if (since >= 0 && since < 0.45 && !state.calm) { const ff = since / 0.45, p = L.sq(a.path[q + 1]); ctx.strokeStyle = `rgba(255,240,200,${0.8 * (1 - ff)})`; ctx.lineWidth = cell * 0.07 * (1 - ff) + 1; ctx.beginPath(); ctx.ellipse(p.x, p.y + cell * 0.2, cell * (0.3 + 0.7 * ff), cell * (0.14 + 0.3 * ff), 0, 0, TAU); ctx.stroke(); }
      }
      const pa = L.sq(a.path[Math.min(k, a.path.length - 1)]), pb = L.sq(a.path[Math.min(k + 1, a.path.length - 1)]), e = done ? 1 : ease(f);
      const x = pa.x + (pb.x - pa.x) * e, y = pa.y + (pb.y - pa.y) * e;
      const lift = done ? Math.max(0, 0.2 * (1 - (a.t - (a.dur - 0.16)) / 0.16)) : Math.sin(Math.PI * f) * (sg.hop ? 2.6 : 0.8) + 0.2;
      drawPeg(ctx, a.seat, style, x, y, cell, { lift, glow: 0.5 });
      if (done && a.hops >= 2 && !state.calm) {
        const ff = (a.t - (a.dur - 0.16)) / 0.16, p1 = L.sq(movingTo), fs = Math.round(cell * 0.62);
        ctx.save(); ctx.globalAlpha = Math.min(1, (1 - ff * 0.6) * 1.5); ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(40,16,4,0.9)'; ctx.lineJoin = 'round'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center';
        ctx.strokeText(`${a.hops} hops!`, p1.x, p1.y - cell * 0.9); ctx.fillStyle = '#ffd24a'; ctx.fillText(`${a.hops} hops!`, p1.x, p1.y - cell * 0.9); ctx.restore();
      }
    }
    if (dragging) drawPeg(ctx, g.board[state.sel] || g.turn, style, state.drag.x, state.drag.y - cell * 0.15, cell, { lift: 0.9, glow: 0.9 });
    if (state.kb && !over) { const p = L.sq(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.strokeRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6); }
    ctx.restore();
    if (state.loupe && !over && !isLesson) loupe(state.loupe, cell);
    if (isLesson) lessonBox(); else chips();
    buttonsFor();
    if (over) overlay();
    void n;
  }

  // finger magnifier for tiny cells: a zoomed copy of the board around the finger, shown above it, with a crosshair on the square that would be chosen
  function loupe(f, cell) {
    if (!ctx.getTransform || !ctx.canvas) return;
    const tr = ctx.getTransform?.(); if (!tr || !tr.a) return;
    const k = tr.a, rad = cell * 2.9, src = cell * 1.55, vw = ctx.canvas.width / k;
    let cx = clamp(f.x, rad + 6, vw - rad - 6), cy = f.y - rad * 1.25 - cell * 0.6; if (cy < rad + 6) cy = Math.min(f.y + rad * 1.25 + cell * 0.6, ctx.canvas.height / k - rad - 6);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.clip(); ctx.fillStyle = '#06161a'; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    const sx = (f.x - src) * k + tr.e, sy = (f.y - src) * k + tr.f, sw = src * 2 * k;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(ctx.canvas, sx, sy, sw, sw, (cx - rad) * k + tr.e, (cy - rad) * k + tr.f, rad * 2 * k, rad * 2 * k); ctx.setTransform(tr);
    const i = L.squareAt(f.x, f.y), mag = rad / src;
    if (i >= 0) { const q = L.sq(i), bx = cx + (q.x - f.x) * mag, by = cy + (q.y - f.y) * mag; ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.strokeRect(bx - cell * mag / 2, by - cell * mag / 2, cell * mag, cell * mag); }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = GOLD; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.stroke(); ctx.restore();
  }

  // a dotted gold route through board squares. `part` (0..1) is how much of the final segment is drawn; `tot` = number of segments in the whole path
  function trail(path, alpha, cell, rgb = '255,205,90', part = 1, tot = path.length - 1) {
    if (path.length < 2) return;
    const col = rgb || '255,205,90';
    ctx.save(); ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {                                  // a soft wide glow, then the dotted line (no blur filter: cheap)
      if (pass === 0) { ctx.strokeStyle = `rgba(${col},${0.22 * alpha})`; ctx.lineWidth = Math.max(6, cell * 0.24); ctx.setLineDash([]); }
      else { ctx.strokeStyle = `rgba(${col},${0.92 * alpha})`; ctx.lineWidth = Math.max(3, cell * 0.1); ctx.setLineDash([cell * 0.16, cell * 0.12]); }
      for (let k = 0; k + 1 < path.length; k++) {
        const f = k + 2 === path.length && path.length - 1 < tot + 1 && part < 1 ? part : 1;
        const p0 = L.sq(path[k]), p1 = L.sq(path[k + 1]), hop = Math.hypot(p1.x - p0.x, p1.y - p0.y) > cell * 1.6, mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2 - (hop ? cell * 0.5 : cell * 0.15);
        ctx.beginPath(); const nn = 14;
        for (let q = 0; q <= nn * f; q++) { const u = q / nn, x = (1 - u) * (1 - u) * p0.x + 2 * u * (1 - u) * mx + u * u * p1.x, y = (1 - u) * (1 - u) * p0.y + 2 * u * (1 - u) * my + u * u * p1.y; q ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function star(x, y, r, fill, outline) {
    ctx.beginPath();
    for (let k = 0; k < 10; k++) { const rad = k % 2 ? r * 0.45 : r, ang = -Math.PI / 2 + k * Math.PI / 5; k ? ctx.lineTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad) : ctx.moveTo(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad); }
    ctx.closePath(); if (outline) { ctx.strokeStyle = fill; ctx.lineWidth = 1.5; ctx.stroke(); } else { ctx.fillStyle = fill; ctx.fill(); }
  }

  // ---- seat chips: one card per player with its peg, role and progress to the goal
  function chip(r, seat) {
    const turn = !g.winner && (a ? a.seat : g.turn) === seat && scene !== 'over', P = SEAT[seat], human = !state.two && !state.autoMode && seat === 1;
    const seats3 = G.seats > 2, tight = r.h < 96 || r.w < 220;
    panel(r, 16, turn ? 'rgba(40,36,14,0.8)' : 'rgba(5,28,32,0.66)', turn ? `rgba(${P.tint},0.95)` : 'rgba(246,215,124,0.2)', true);
    const role = state.autoMode ? 'Computer' : state.two ? 'Player' : human ? 'You' : 'Computer';
    const dots = '.'.repeat(1 + (Math.floor(state.t * 3) % 3));
    const status = turn && a ? 'Moving' : turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'The move' : 'Thinking' + dots) : state.two ? 'To move' : human ? 'Your move' : (state.thinking || state.think > 0 ? 'Thinking' + dots : 'Moving')) : role;
    const pr = progress(g, seat, G), home = pegsHome(g, seat, G);
    const ic = clamp(Math.min(r.h * (tight ? 0.5 : 0.46), r.w * 0.26), 30, 88), ix = r.x + 12 + ic * 0.5, iy = r.y + 10 + ic * 0.58;
    drawPeg(ctx, seat, style, ix, iy, ic, { glow: turn ? 0.7 : 0, lift: turn && !state.calm ? 0.12 + Math.sin(state.t * 3) * 0.05 : 0 });
    const tx = r.x + 12 + ic + 6, tw = r.x + r.w - 10 - tx, ns = clamp(r.h * (tight ? 0.2 : 0.2), 17, 36);
    fitText(NAMES[seat], tx, r.y + 10 + ns * 0.9, ns, tw, CREAM, FONT, 600, 'left');
    fitText(status, tx, r.y + 10 + ns * 0.9 + ns * 0.82, Math.round(ns * 0.7), tw, turn ? GOLD : DIM, UI, 600, 'left');
    // progress bar along the bottom of the chip
    const bh = clamp(r.h * 0.17, 12, 22), bx = r.x + 12, by = r.y + r.h - 12 - bh, bw = r.w - 24;
    if (by > iy + ic * 0.45) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh / 2); ctx.fill();
      if (pr > 0.005) { const fg = ctx.createLinearGradient(bx, 0, bx + bw, 0); fg.addColorStop(0, P.lo); fg.addColorStop(1, P.hi); ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(bh, bw * pr), bh, bh / 2); ctx.fill(); }
      const lab = tight || seats3 && r.w < 200 ? `${Math.round(pr * 100)}%` : `${Math.round(pr * 100)}% · ${home} of ${G.pegs} home`;
      fitText(lab, bx + bw / 2, by + bh * 0.8, Math.max(minU - 1, bh * 0.82), bw - 8, pr > 0.5 ? '#fff' : CREAM, UI, 700, 'center', Math.max(10, minU - 1));
    }
  }
  function chips() {
    for (let s = 1; s <= G.seats; s++) chip(L.chips[s - 1], s);
    const M = L.msg, al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the computer plays every side.' : g.winner ? '' : state.two || g.turn === 1 ? 'Tap a peg, then a lit square.' : '';
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      ctx.beginPath(); ctx.roundRect(M.x, M.y + 4, M.w, M.h - 8, 14); ctx.fillStyle = 'rgba(14,14,10,0.92)'; ctx.fill(); ctx.strokeStyle = 'rgba(246,215,124,0.75)'; ctx.lineWidth = 2; ctx.stroke();
      wrapBox(state.msg.text, R(M.x + 14, M.y + 8, M.w - 28, M.h - 16), big ? 30 : 25, 1.18, CREAM);
      ctx.restore();
    } else if (base) wrapBox(base, R(M.x + 8, M.y, M.w - 16, M.h), 24, 1.2, DIM);
    if (L.land && L.rightHead) fitText(VARIANTS[g.variant].long, L.rightHead.x + L.rightHead.w / 2, L.rightHead.y + 34, 26, L.rightHead.w, GOLD, FONT, 600);
    if (L.badge && L.badge.show) drawBadgeStack(ctx, L.badge.cx, L.badge.bottom, L.badge.w);
  }
  function lessonBox() {
    const l = LESSONS[state.lesson.i], r = L.lessonBox;
    panel(r, 16, 'rgba(5,28,32,0.76)', 'rgba(246,215,124,0.45)');
    const pad = 16;
    text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, r.x + pad, r.y + 30, Math.max(minU, 20), DIM, UI, 600, 'left');
    fitText(l.title, r.x + pad, r.y + 30 + 40, 38, r.w - 2 * pad, GOLD, FONT, 600, 'left');
    const body = state.lesson.done ? l.done : state.msg ? state.msg.text : l.text;
    wrapBox(body, R(r.x + pad, r.y + 82, r.w - 2 * pad, r.h - 92), big ? 32 : 27, 1.25, state.lesson.done ? '#c9f7c0' : CREAM, 'left', minU, 'top');
  }
  function buttonsFor() {
    const BTN = L.BTN, sz = 26;
    if (scene === 'play') {
      if (state.autoMode) {
        button(BTN.auto.exit, 'Exit', { size: 24 }); button(BTN.auto.pause, state.autoPaused ? 'Resume' : 'Pause', { size: 24, primary: state.autoPaused });
        button(BTN.auto.dec, '- Think', { size: 22, dim: state.autoThinkIdx <= 0 }); button(BTN.auto.inc, 'Think +', { size: 22, dim: state.autoThinkIdx >= THINK_STEPS.length - 1 });
        if (L.land && L.rightHead) fitText(`think time ${THINK_STEPS[state.autoThinkIdx]} s`, L.rightHead.x + L.rightHead.w / 2, BTN.auto.inc.y + BTN.auto.inc.h + 36, 22, L.rightHead.w, DIM, UI, 600);
      } else {
        button(BTN.menu, 'Menu', { size: sz }); button(BTN.undo, 'Take back', { size: sz, dim: !state.undo.length }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: sz, dim: state.hintsLeft <= 0, primary: !!state.hint });
      }
    } else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: sz }); if (state.lesson.done) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
  }
  function overlay() {
    ctx.fillStyle = 'rgba(3,14,18,0.72)'; ctx.fillRect(0, 0, L.w, L.h);
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 26, 'rgba(8,36,40,0.94)', 'rgba(246,215,124,0.55)');
    const res = state.result || { winner: g.winner, reason: g.reason }, w = res.winner;
    const title = w === 9 ? 'A draw' : state.autoMode || state.two ? `${NAMES[w]} wins` : w === 1 ? 'You win!' : G.seats > 2 ? `${NAMES[w]} wins` : 'The computer wins';
    const k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    if (w !== 9) drawPeg(ctx, w, style, 0, 118, 118, { glow: 0.9, lift: 0.4 + Math.sin(state.t * 2.5) * 0.08 });
    else { drawPeg(ctx, 1, style, -56, 118, 96, {}); drawPeg(ctx, 2, style, 56, 118, 96, {}); }
    fitText(title, 0, 238, 62, cw2 - 40, GOLD, FONT, 700);
    wrapBox(res.reason || '', R(-cw2 / 2 + 30, 252, cw2 - 60, 70), 26, 1.25, CREAM);
    fitText(`${Math.ceil(g.moves / G.seats)} moves each · ${Array.from({ length: G.seats }, (_, i) => `${NAMES[i + 1]} ${Math.round(progress(g, i + 1, G) * 100)}%`).join(' · ')}`, 0, 346, 22, cw2 - 40, DIM, UI, 500);
    if (!state.two && !state.autoMode && w === 1) { fitText(`★ ${LEVELS[state.level].name} beaten at ${VARIANTS[g.variant].name}`, 0, 390, 24, cw2 - 40, '#ffd24a', UI, 700); confetti(); }
    ctx.restore();
    button(O.again, state.autoMode ? 'Watch another' : 'Play again', { primary: true, size: 32 }); button(O.back, 'Menu', { size: 28 });
    drawMoreLine(ctx, cx, O.back.y + O.back.h + 32, 22);
  }
  function confetti() {
    if (state.calm) return;
    for (let k = 0; k < 24; k++) {
      const ph = (state.t * 0.32 + k * 0.0917) % 1, x = Math.sin(k * 2.4 + state.t) * (60 + 170 * ph), y = 210 - ph * 190 + ph * ph * 120;
      ctx.fillStyle = k % 4 === 0 ? `rgba(255,214,110,${0.9 * (1 - ph)})` : k % 4 === 1 ? `rgba(238,111,77,${0.85 * (1 - ph)})` : k % 4 === 2 ? `rgba(90,200,255,${0.85 * (1 - ph)})` : `rgba(255,246,224,${0.8 * (1 - ph)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k + state.t * 2); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore();
    }
  }

  // ================================================================ documents (rules, how to play, about, settings)
  function drawDocument() {
    const D = L.doc, panelR = D.panel, vp = D.viewport, kind = state.doc.kind;
    ctx.fillStyle = 'rgba(3,14,18,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
    ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 26);
    const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(20,70,74,0.86)'); pg.addColorStop(1, 'rgba(6,28,32,0.92)');
    ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(246,215,124,0.32)'; ctx.lineWidth = 2; ctx.stroke();
    edgeStroke(ctx, panelR, 26, 0.4);
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kind];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 44, D.header.textDec.x - 100 - hx, GOLD, FONT, 700, 'left');
    ctx.strokeStyle = 'rgba(246,215,124,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panelR.x + 28, panelR.y + 82); ctx.lineTo(panelR.x + panelR.w - 28, panelR.y + 82); ctx.stroke();
    const secs = kind === 'rules' ? RULES : kind === 'how' ? HOWTO : kind === 'about' ? ABOUT : [{ title: '', items: settingsItems(state) }];
    const sc0 = Math.max(0, Math.min(state.doc.scroll || 0, docMetrics.max));
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 6, vp.y, vp.w + 12, vp.h); ctx.clip();
    const bodyW = D.bodyW, cxp = vp.x + vp.w / 2, left = cxp - bodyW / 2;
    const size = Math.round(27 * scale), lh = Math.round(size * 1.38), gap = Math.round(12 * scale);
    let y = vp.y - sc0 + 4;
    const vis = (y0, h) => y0 + h > vp.y - 40 && y0 < vp.y + vp.h + 40;
    secs.forEach((sec, si) => {
      if (sec.title) {
        const t0 = Math.round(34 * Math.min(scale, 2));
        if (si > 0) y += Math.round(18 * Math.min(scale, 2));
        const ty2 = y + t0 * 0.9; if (vis(y, t0)) fitText(sec.title, cxp, ty2, t0, bodyW, '#ffd24a', FONT, 600, 'center', 18);
        y += t0 * 1.35 + 6;
      }
      for (const it of sec.items) {
        if (it.k === 'p') {
          const ls = lines(it.t, size, bodyW); if (vis(y, ls.length * lh)) ls.forEach((ln, i) => text(ln, cxp, y + size * 0.9 + i * lh, size, CREAM, UI, 600, 'center'));
          y += ls.length * lh + gap;
        } else if (it.k === 'h') {
          const hs = Math.round(30 * Math.min(scale, 2)); y += 8; if (vis(y, hs)) text(it.t, cxp, y + hs * 0.9, hs, '#ffd24a', FONT, 600, 'center'); y += hs * 1.3 + 4;
        } else if (it.k === 'd') {
          const spec = it.spec, C = spec.rows[0].length, cp = Math.min((spec.cell || 44) * (1 + (Math.min(scale, 2) - 1) * 0.35), (bodyW - 24) / (C + 0.32)), ds = diagramSize(spec, cp);
          if (vis(y, ds.h)) drawDiagram(ctx, spec, cxp - ds.w / 2, y, cp, boardKey, style);
          y += ds.h + gap + 6;
        } else if (it.k === 'seg') {
          const fs = Math.round(25 * Math.min(scale, 2.2)), ls = lines(it.label, fs, bodyW, 600);
          if (vis(y, ls.length * fs * 1.3)) ls.forEach((ln, i) => text(ln, cxp, y + fs * 0.9 + i * fs * 1.3, fs, DIM, UI, 600, 'center'));
          y += ls.length * fs * 1.3 + 6;
          const nOpts = it.opts.length, os = fs, bh = Math.round(66 * Math.min(scale, 2.2));
          let per = nOpts; ctx.font = `600 ${os}px ${FONT}`;
          const fitsRow = (p) => it.opts.every((o) => ctx.measureText(o.l + (o.locked ? ' (locked)' : '')).width + 28 <= (bodyW - (p - 1) * 10) / p);
          while (per > 1 && !fitsRow(per)) per--;
          const bw = (bodyW - (per - 1) * 10) / per;
          it.opts.forEach((o, k) => {
            const rx = left + (k % per) * (bw + 10), ry = y + Math.floor(k / per) * (bh + 10), rr = R(rx, ry, bw, bh);
            if (vis(ry, bh)) button(rr, o.locked ? `${o.l} (locked)` : o.l, { size: os, on: o.v === it.cur && !o.locked, primary: o.v === it.cur && !o.locked, dim: o.locked });
            ui.hits.push({ r: rr, id: it.id, v: o.v, locked: o.locked, need: o.need, clip: vp });
          });
          y += Math.ceil(nOpts / per) * (bh + 10) + gap;
        }
      }
    });
    ctx.restore();
    const contentH = y - (vp.y - sc0) + 10;
    if (contentH - vp.h > 8) {
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(10,40,44,${a0})`); gr.addColorStop(1, `rgba(10,40,44,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 22, vp.y, 0, 0.95);
    }
    docMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); docMetrics.view = vp.h;
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(246,215,124,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(246,215,124,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(docMetrics.max > 0 ? (sc0 >= docMetrics.max - 1 ? 'End' : 'Scroll, or tap Next') : '', D.cx, D.counterY, 21, 'rgba(246,215,124,0.65)', UI, 500);
    button(D.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(D.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    fitText(`${Math.round(scale * 100)}%`, D.header.textDec.x - 14, D.header.textDec.y + 42, 22, 70, DIM, UI, 600, 'right');
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(14,14,10,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(246,215,124,0.8)'; ctx.lineWidth = 2; ctx.stroke(); wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}

function motes(ctx, L, t) {
  for (let k = 0; k < 14; k++) {
    const sp = 6 + (k % 4) * 3, x = (((k * 211.7 + t * sp) % (L.w + 80)) + L.w + 80) % (L.w + 80) - 40, y = (k * 137.3 + Math.sin(t * 0.25 + k) * 40 + L.h * 2) % L.h, r = 2 + (k % 5), a = 0.04 + 0.03 * Math.sin(t * 0.6 + k * 1.7);
    ctx.fillStyle = `rgba(255,224,160,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}
