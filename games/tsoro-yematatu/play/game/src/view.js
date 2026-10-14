// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, R, clamp } from './layout.js';
import { drawTable, drawBoard, drawPiece, drawDiagram, diagramSize } from './art.js';
import { RULES, HOWTO, ABOUT, LESSONS } from './content.js';
import { settingsItems } from './settings.js';
import { NAMES, variantOf } from './rules.js';
import { LEVELS } from './ai.js';
import { drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';
import { v3 } from './v3.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GOLD = '#f4c96b', CREAM = '#fff7e2', DIM = 'rgba(244,201,107,0.8)', TEAL = '#1d8f86';
const TAU = Math.PI * 2;
const DARKUI = 'rgba(6,24,24,0.66)', DARKUI2 = 'rgba(5,18,18,0.94)';
export const ui = { hits: [], buttons: [] };
export const docMetrics = { max: 0, view: 0 };
export const readerStats = { fits: 0 };
const fitMemo = new Map(); let fitFontsKey = '';
const ease = (f) => f * f * (3 - 2 * f);

export function render(ctx, state, L) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== fitFontsKey || fitMemo.size > 3000) { fitMemo.clear(); fitFontsKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { readerStats.fits++; v = fn(); fitMemo.set(key, v); } return v; };
  ui.hits.length = 0; ui.buttons.length = 0;
  const scene = state.scene, scale = TEXT_SCALES[state.textScaleIdx] ?? 1, big = scale > 1, g = state.game, a = state.anim, B = L.board;
  const minU = Math.max(12, 11 / (host.px || 0.6));
  const kind = state.board, style = state.style, V = variantOf(g.variant), PS = V.pieceScale;

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
  const panel = (r, rad = 18, fill = DARKUI, stroke = 'rgba(244,201,107,0.24)', brand = true, kind = 'slate') => {
    if (v3.on) { v3.panels.push({ r, rad, kind }); return; }
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.38);
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(16, r.h / 3);
    const in3d = v3.on && !(o.clip && (r.y < o.clip.y || r.y + r.h > o.clip.y + o.clip.h));   // a button cut by a scrolled viewport stays flat so it can be clipped
    if (in3d) { v3.buttons.push({ r, rad, label, primary: !!o.primary, on: !!o.on, dim: !!o.dim }); if (o.dim) ctx.globalAlpha = 0.62; }
    else {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#e8a43c'); gr.addColorStop(1, '#a35a12'); } else if (o.on) { gr.addColorStop(0, '#6b5a22'); gr.addColorStop(1, '#443812'); } else { gr.addColorStop(0, '#23524f'); gr.addColorStop(1, '#10302f'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,222,150,0.85)' : 'rgba(244,201,107,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    }
    const size = o.size ?? 28, maxW = r.w - 20, col = o.primary ? '#fffaf0' : GOLD, cy = r.y + r.h / 2;
    const w1 = (str, s) => { ctx.font = `700 ${s}px ${UI}`; return ctx.measureText(str).width; };
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
    if (o.sub && best.ls.length === 1) { text(label, r.x + r.w / 2, cy + best.s * 0.1 - 6, best.s, col, UI, 700); fitText(o.sub, r.x + r.w / 2, cy + best.s * 0.1 + Math.max(minU, size * 0.62) + 2, Math.round(size * 0.62), maxW, o.primary ? 'rgba(255,240,210,0.9)' : DIM, UI, 500, 'center', minU); }
    else if (best.ls.length === 1) text(label, r.x + r.w / 2, cy + best.s * 0.35, best.s, col, UI, 700);
    else best.ls.forEach((ln, i) => text(ln, r.x + r.w / 2, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s, col, UI, 700));
    ctx.restore();
  };

  // ---------------------------------------------------------------- scenes
  drawTable(ctx, L);
  if (!state.calm && !v3.on) fireflies(ctx, L, state.t);

  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();

  // screens fade in from the night instead of cutting
  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(4,14,14,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function drawTitle() {
    const T = L.title(!!state.saved), Rr = T.rows;
    if (T.card) panel(T.card, 24, 'rgba(5,20,20,0.6)', undefined, true, 'card');
    hero(T.hero);
    if (scene === 'demo-limit') {
      const r = T.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!T.card) panel(r, 24, 'rgba(5,20,20,0.78)', undefined, true, 'doc');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, GOLD, FONT, 700);
      wrapBox('Get Tsoro Yematatu on iPhone and Android for unlimited games, every triangle and every level.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      const Vs = variantOf(state.variant);
      if (Rr.resume) button(Rr.resume, 'Continue your game', { primary: true, size: 30 });
      button(Rr.play, 'Play the computer', { primary: !Rr.resume, size: 32, sub: `${LEVELS[state.level].name} · ${Vs.name} · as ${NAMES[state.humanSide]}` });
      button(Rr.two, 'Two players', { size: 26 }); button(Rr.learn, state.learned ? 'Learn' : 'Learn to play', { size: 26 });
      button(Rr.auto, 'Auto Play · Watch & Learn', { size: 26 });
      button(Rr.rules, 'Rules', { size: 26 }); button(Rr.how, 'How to Play', { size: 26 });
      button(Rr.about, 'About', { size: 26 }); button(Rr.settings, 'Settings', { size: 26 });
      if (state.msg) fitText(state.msg.text, L.w / 2, T.rows.play.y - 14, 24, L.w - 40, GOLD, UI, 600);
    }
    const lk = T.lockup; state.lockupRect = drawLockup(ctx, lk.x, lk.y + 4, 50);
  }

  function hero(r) {
    const cx = r.x + r.w / 2;
    const ts = clamp(Math.min(r.w / 6.4, r.h / 4.2), 40, 118);
    const y0 = r.y + ts * 0.95;
    const pw = Math.min(r.w * 0.7, ts * 5.2), sub = Math.max(minU, ts * 0.26); let py = y0 + ts * 0.3;
    if (v3.on) {
      const q = goldTitle('Tsoro Yematatu', cx, y0, ts, r.w * 0.84);   // 8% side margin: the extruded edge and glow never touch the screen edge
      py = y0 + Math.max(ts * 0.3, q * 0.42);                          // the band sits below the letters' extrusion, never over them
      // a woven band: dark ground with a chevron border in the four colours of the Shona mat
      const ph = sub * 1.9;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#1b0f08'; ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, ph, 6); ctx.fill(); ctx.restore();
      const cols = ['#e8a43c', '#1d8f86', '#f4e6c0', '#b8402a'], dk = Math.max(5, ph * 0.18), n = Math.floor(pw / (dk * 2));
      for (let i = 0; i < n; i++) for (const yy of [py + dk * 0.85, py + ph - dk * 0.85]) {
        const x = cx - pw / 2 + dk + i * ((pw - 2 * dk) / (n - 1)); ctx.fillStyle = cols[i % 4]; ctx.beginPath(); ctx.moveTo(x - dk * 0.7, yy + dk * 0.45); ctx.lineTo(x, yy - dk * 0.45); ctx.lineTo(x + dk * 0.7, yy + dk * 0.45); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(244,201,107,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(cx - pw / 2 + 1, py + 1, pw - 2, ph - 2, 6); ctx.stroke();
      ctx.font = `700 ${sub * 0.95}px ${UI}`; ctx.fillStyle = '#fff1cf'; ctx.textAlign = 'center'; ctx.fillText('Z I M B A B W E', cx, py + sub * 1.3);
    } else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
      const grad = ctx.createLinearGradient(0, y0 - ts * 0.8, 0, y0 + ts * 0.1); grad.addColorStop(0, '#fff4cf'); grad.addColorStop(1, '#f0b23f');
      fitText('Tsoro Yematatu', cx, y0, ts, r.w - 10, grad, FONT, 700);
      ctx.restore();
      ctx.save(); ctx.fillStyle = TEAL;
      ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, sub * 1.7, sub * 0.85); ctx.fill();
      ctx.restore();
      ctx.font = `700 ${sub}px ${UI}`; ctx.fillStyle = CREAM; ctx.textAlign = 'center';
      ctx.fillText('Z I M B A B W E', cx, py + sub * 1.2);
    }
    fitText('Drop three stones. Slide them into line.', cx, py + sub * 1.7 + ts * 0.36, ts * 0.3, r.w - 20, 'rgba(244,201,107,0.9)', FONT, 700);
    const top = py + sub * 1.7 + ts * 0.62, room = r.y + r.h - top;
    if (room > 90) {
      if (v3.on) { const S = clamp(Math.min(r.w - 6, (room - 16) / 0.66, 640), 140, 640); v3.heroRect = { x: r.x + (r.w - S) / 2, y: top + 6 + (room - 22 - S) / 2 + S * 0.0, w: S, h: S }; }
      else heroBoard(R(r.x, top + 6, r.w, room - 22));
    } else if (v3.on) v3.heroRect = { x: L.w / 2 - 1, y: L.h + 40, w: 2, h: 2 };
  }
  function goldTitle(str, cx, y, size, maxW) {
    ctx.save();
    ctx.font = `700 ${size}px ${FONT}`; let q = size; while (q > 24 && ctx.measureText(str).width > maxW) { q -= 1; ctx.font = `700 ${q}px ${FONT}`; }
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(255,150,60,0.75)'; ctx.shadowBlur = q * 0.4; ctx.fillStyle = '#2a1204'; ctx.fillText(str, cx, y); ctx.shadowBlur = 0;
    const depth = Math.max(3, q * 0.06);
    for (let i = depth; i >= 1; i--) { ctx.fillStyle = i > depth * 0.6 ? '#3b1a06' : '#6b3a0c'; ctx.fillText(str, cx + i * 0.45, y + i); }
    const g = ctx.createLinearGradient(0, y - q * 0.72, 0, y + q * 0.08);
    g.addColorStop(0, '#fffbe0'); g.addColorStop(0.28, '#ffe27a'); g.addColorStop(0.52, '#f3b02a'); g.addColorStop(0.58, '#b8700f'); g.addColorStop(0.8, '#e9a526'); g.addColorStop(1, '#ffd96a');
    ctx.fillStyle = g; ctx.fillText(str, cx, y);
    ctx.lineWidth = Math.max(1.5, q * 0.014); ctx.strokeStyle = 'rgba(255,248,214,0.9)'; ctx.strokeText(str, cx, y - 0.5);
    ctx.restore();
    return q;
  }

  // The title's animated demonstration, forever: six stones dropped, then one slide that completes the line down the left side.
  function heroBoard(r) {
    const spec = { variant: 'classic' }, bx = diagramSize(spec, 100), asp = bx.h / bx.w;
    const wpx = clamp(Math.min(r.w - 30, (r.h - 6) / asp, 560), 120, 560);
    const T = state.frozen ? 6.2 : state.calm ? 6.2 : state.t % 10;
    const seq = [[0, 1, 0.5], [2, 2, 1.1], [1, 1, 1.7], [3, 2, 2.3], [5, 1, 2.9], [6, 2, 3.5]], DROP = 0.4, SLIDE = [5, 4, 4.6, 5.1];
    const resetT = 8.4, op = T < 0.3 ? T / 0.3 : T > resetT ? Math.max(0, 1 - (T - resetT) / 0.6) : 1;
    ctx.save(); ctx.globalAlpha = op;
    const sz = drawDiagram(ctx, { variant: 'classic', stones: {}, line: T > SLIDE[3] ? [0, 1, 4] : null, paint: (c2, P, pc) => {
      const piece = (i, side, t0) => {
        const f = clamp((T - t0) / DROP, 0, 1); if (T < t0) return;
        const p = P(i), e = 1 - (1 - f) * (1 - f);
        drawPiece(c2, side, style, p.x, p.y, pc * 1.25, { lift: (1 - e) * 5, alpha: Math.min(1, f * 4) });
      };
      for (const [i, side, t0] of seq) {
        if (i === SLIDE[0] && T >= SLIDE[2]) continue;
        piece(i, side, t0);
      }
      if (T >= SLIDE[2]) {                                         // the slide from the bottom middle to the bottom left
        const f = clamp((T - SLIDE[2]) / (SLIDE[3] - SLIDE[2]), 0, 1), e = ease(f), p0 = P(SLIDE[0]), p1 = P(SLIDE[1]);
        drawPiece(c2, 1, style, p0.x + (p1.x - p0.x) * e, p0.y + (p1.y - p0.y) * e, pc * 1.25, { lift: Math.sin(Math.PI * f) * 0.7, glow: 0.4 });
      }
    } }, r.x + (r.w - wpx) / 2, r.y + (r.h - wpx * asp) / 2, wpx, kind, style);
    ctx.restore();
    return sz;
  }

  // ================================================================ play / over / lesson
  function drawPlayScreen() {
    const isLesson = scene === 'lesson', over = scene === 'over';
    const cell = B.cell, pcell = cell * PS;
    if (L.land) { if (L.leftCard) panel(L.leftCard, 18, DARKUI, undefined, true, 'card'); panel(L.rightCard, 18, DARKUI, undefined, true, 'card'); }

    ctx.save();
    const D3 = v3.on;
    if (!D3) drawBoard(ctx, B, kind, g.variant);
    const last = a ? null : g.last;
    if (!D3) { if (last && !isLesson && !g.winner) for (const q of [last.from, last.to]) { if (q < 0) continue; const p = L.sq(q); ctx.strokeStyle = 'rgba(255,214,110,0.55)'; ctx.lineWidth = Math.max(2, cell * 0.04); ctx.beginPath(); ctx.arc(p.x, p.y, pcell * 0.5, 0, TAU); ctx.stroke(); }
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    const myTurn = !over && !a && !g.winner && (state.autoMode ? false : (isLesson || state.two || g.turn === state.humanSide));
    const dropping = g.placed[g.turn] < V.stones;
    if (myTurn && dropping && !state.hint) {                         // a quiet cue: every empty point is a place to drop
      for (let i = 0; i < V.n; i++) if (!g.board[i]) { const p = L.sq(i); ctx.fillStyle = `rgba(255,236,170,${0.22 + pulse * 0.18})`; ctx.beginPath(); ctx.arc(p.x, p.y, pcell * 0.13, 0, TAU); ctx.fill(); }
    }
    if (isLesson && !state.lesson.done && LESSONS[state.lesson.i].target !== undefined) { const p = L.sq(LESSONS[state.lesson.i].target); ctx.strokeStyle = `rgba(232,80,50,${0.6 + 0.4 * pulse})`; ctx.lineWidth = Math.max(3, cell * 0.06); ctx.beginPath(); ctx.arc(p.x, p.y, pcell * 0.52, 0, TAU); ctx.stroke(); }
    // threat marks: the points where the other side would make a line next
    if (state.marks && myTurn && !isLesson && state.threat && state.threat.size) {
      for (const i of state.threat) { if (g.board[i]) continue; const p = L.sq(i); ctx.strokeStyle = `rgba(232,64,44,${0.6 + pulse * 0.35})`; ctx.lineWidth = Math.max(3, cell * 0.055); ctx.beginPath(); ctx.arc(p.x, p.y, pcell * 0.5, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(232,64,44,0.16)'; ctx.fill(); }
    }
    // selected stone: its reachable points
    if (state.sel >= 0 && !a && !over) {
      const sp = L.sq(state.sel); ctx.fillStyle = `rgba(255,224,120,${0.26 + pulse * 0.14})`; ctx.beginPath(); ctx.arc(sp.x, sp.y, pcell * 0.56, 0, TAU); ctx.fill();
      for (const m of state.selMoves) { const p = L.sq(m.to); ctx.strokeStyle = `rgba(255,248,214,${0.75 + pulse * 0.25})`; ctx.lineWidth = Math.max(3, cell * 0.05); ctx.beginPath(); ctx.arc(p.x, p.y, pcell * 0.46, 0, TAU); ctx.stroke(); ctx.fillStyle = `rgba(255,236,150,${0.25 + pulse * 0.15})`; ctx.fill(); }
    }
    if (state.hint && !a) for (const q of [state.hint.from, state.hint.to]) { if (q < 0) continue; const p = L.sq(q); ctx.fillStyle = `rgba(90,230,150,${0.3 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, pcell * 0.56, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(90,230,150,0.95)'; ctx.lineWidth = 3; ctx.stroke(); }
    // the winning line, glowing under the stones
    const wl = g.winner && g.winner !== 3 && g.line && !a ? g.line : null, wf = wl ? Math.min(1, (scene === 'over' ? 1 : state.winT / 0.35)) : 0;
    if (wl) {
      const p0 = L.sq(wl[0]), p2 = L.sq(wl[2]), gl = 0.5 + 0.5 * Math.sin(state.t * 6);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,205,90,${(0.35 + 0.2 * gl) * wf})`; ctx.lineWidth = pcell * 0.7; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      ctx.strokeStyle = `rgba(255,248,214,${0.85 * wf})`; ctx.lineWidth = Math.max(4, pcell * 0.12); ctx.stroke();
      ctx.restore();
    }
    // stones, top rows first so a lower stone overlaps the one above it
    const order = [...Array(V.n).keys()].sort((p, q) => V.pts[p].y - V.pts[q].y);
    const movingTo = a ? a.to : -1, dragging = state.drag && state.sel >= 0;
    for (const i of order) {
      const v = g.board[i]; if (!v || (i === movingTo && a)) continue;
      if (dragging && i === state.sel) continue;
      const p = L.sq(i), sel = state.sel === i, inLine = wl && wl.includes(i);
      let lift = sel ? 0.5 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.06) : 0;
      if (inLine && !state.calm) lift = 0.3 + 0.18 * Math.sin(state.t * 5 + i);
      drawPiece(ctx, v, style, p.x, p.y, pcell, { lift, glow: sel || inLine ? 0.8 : 0 });
    }
    // the moving stone: dropped from above, or slid along the line with a small hop
    if (a) {
      const f = clamp(a.t / a.dur, 0, 1), p1 = L.sq(a.to);
      if (a.kind === 'drop') {
        const e = f * f, lift = (1 - e) * 5.5 * (state.calm ? 0.3 : 1), land = f > 0.78 ? (f - 0.78) / 0.22 : 0;
        drawPiece(ctx, a.side, style, p1.x, p1.y, pcell, { lift, alpha: Math.min(1, f * 5), scale: land > 0 && !state.calm ? 1 + 0.08 * Math.sin(land * Math.PI) : 1 });
        if (land > 0 && !state.calm) { ctx.strokeStyle = `rgba(255,240,200,${0.7 * (1 - land)})`; ctx.lineWidth = Math.max(1.5, cell * 0.05 * (1 - land)); ctx.beginPath(); ctx.ellipse(p1.x, p1.y + pcell * 0.22, pcell * (0.3 + 0.5 * land), pcell * (0.14 + 0.2 * land), 0, 0, TAU); ctx.stroke(); }
      } else {
        const p0 = L.sq(a.from), e = ease(f);
        drawPiece(ctx, a.side, style, p0.x + (p1.x - p0.x) * e, p0.y + (p1.y - p0.y) * e, pcell, { lift: Math.sin(Math.PI * f) * 0.7 + 0.15, glow: 0.5 });
      }
    }
    // a dragged stone follows the finger
    if (dragging) drawPiece(ctx, g.board[state.sel] || g.turn, style, state.drag.x, state.drag.y - cell * 0.15, pcell, { lift: 1, glow: 0.9 });
    if (state.kb && !over) { const p = L.sq(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, pcell * 0.6, 0, TAU); ctx.stroke(); }
    }
    ctx.restore();

    if (isLesson) lessonBox(); else plates();
    buttonsFor();
    if (over) overlay();
  }

  function plate(r, side) {
    const human = !state.two && !state.autoMode && side === state.humanSide;
    const name = state.autoMode ? `${NAMES[side]} · computer` : state.two ? NAMES[side] : human ? 'You' : 'Computer';
    const sub = state.autoMode ? LEVELS[Math.max(2, state.level)].name : state.two || human ? NAMES[side] : `${LEVELS[state.level].name} · ${NAMES[side]}`;
    const turn = !g.winner && g.turn === side && scene !== 'over';
    panel(r, 16, turn ? 'rgba(12,52,50,0.82)' : DARKUI, turn ? 'rgba(244,201,107,0.9)' : 'rgba(244,201,107,0.2)', true, turn ? 'plateOn' : 'plate');
    const dots = '.'.repeat(1 + (Math.floor(state.t * 3) % 3));
    const thinking = state.autoMode ? (state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'The move' : 'Thinking' + dots) : state.two ? 'To move' : human ? 'Your move' : state.thinking || state.think > 0 ? 'Thinking' + dots : 'Moving';
    const placed = g.placed[side] - (a && a.kind === 'drop' && a.side === side && a.t < a.dur * 0.7 ? 0 : 0), left = Math.max(0, V.stones - placed);
    const goal = left ? `${left} stone${left === 1 ? '' : 's'} to drop` : 'All stones down: slide';
    const tray = (cx, cy, size, gap) => {                              // one slot per stone: pebbles waiting, empty rings for those already dropped
      for (let k = 0; k < V.stones; k++) {
        const x = cx + k * gap, waiting = k < left;
        if (waiting) drawPiece(ctx, side, style, x, cy, size, { alpha: 0.98 });
        else { ctx.strokeStyle = 'rgba(244,201,107,0.28)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, cy + size * 0.06, size * 0.3, size * 0.24, 0, 0, TAU); ctx.stroke(); }
      }
    };
    if (r.h < 112) {                                                  // compact: one line of text, the waiting stones on the right
      const ic2 = clamp(r.h * 0.74, 36, 80), ix2 = r.x + 12 + ic2 * 0.55, iy2 = r.y + r.h * 0.5 + ic2 * 0.3;
      drawPiece(ctx, side, style, ix2, iy2, ic2, { glow: turn ? 0.7 : 0 });
      const tx2 = r.x + 12 + ic2 * 1.1 + 12, ns2 = clamp(r.h * 0.27, 18, 30), tc2 = clamp(r.h * 0.52, 26, 44), tcw = V.stones * tc2 * 0.74 + 8;
      const st = turn ? thinking : sub, avail = r.x + r.w - 12 - tx2 - (r.w > 560 ? tcw : 0);
      fitText(`${name} · ${st}`, tx2, r.y + r.h * 0.42, ns2, avail, turn ? CREAM : DIM, UI, 800, 'left');
      fitText(goal, tx2, r.y + r.h * 0.75, Math.round(ns2 * 0.78), avail, DIM, UI, 600, 'left');
      if (r.w > 560) tray(r.x + r.w - 14 - tcw + tc2 * 0.4, r.y + r.h * 0.5 + tc2 * 0.28, tc2, tc2 * 0.74);
      return;
    }
    const ns = clamp(r.h * 0.22, 18, 46), ic = clamp(Math.min(r.h * 0.6, r.w * 0.22), 38, 132);
    const ix = r.x + 14 + ic * 0.55, iy = r.y + 12 + ic * 0.62;
    drawPiece(ctx, side, style, ix, iy, ic, { glow: turn ? 0.7 : 0, lift: turn && !state.calm ? 0.12 + Math.sin(state.t * 3) * 0.05 : 0 });
    const tx = r.x + 14 + ic * 1.1 + 14, tw = r.x + r.w - 14 - tx;
    const y1 = r.y + 10 + ns * 0.85, y2 = y1 + ns * 0.84, y3 = y2 + ns * 0.8;
    fitText(name, tx, y1, ns, tw, CREAM, UI, 800, 'left');
    fitText(turn ? thinking : sub, tx, y2, Math.round(ns * 0.72), tw, turn ? GOLD : DIM, UI, 600, 'left');
    fitText(goal, tx, y3, Math.round(ns * 0.62), tw, DIM, UI, 600, 'left');
    const availH = r.y + r.h - (y3 + 8) - 4, tc = Math.min(clamp(availH, 0, 56), tw / (0.74 * V.stones + 0.3));
    if (tc >= 18) tray(tx + tc * 0.4, y3 + 8 + tc * 0.55, tc * 0.95, tc * 0.74);
  }
  function plates() {
    const topSide = L.flip ? 1 : 2, botSide = L.flip ? 2 : 1;
    plate(L.plateTop, topSide); plate(L.plateBot, botSide);
    const M = L.msg, al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const mine = !g.winner && !state.autoMode && (state.two || g.turn === state.humanSide) && !a;
    const dropping = g.placed[g.turn] < V.stones;
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the computer plays both sides.' : g.winner ? '' : mine ? (dropping ? 'Tap an empty point to drop a stone.' : 'Tap one of your stones, then a glowing point.') : '';
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      if (v3.on) panel(R(M.x, M.y + 2, M.w, M.h - 4), 14, '', '', false, 'plateOn');
      else { ctx.beginPath(); ctx.roundRect(M.x, M.y + 4, M.w, M.h - 8, 14); ctx.fillStyle = DARKUI2; ctx.fill(); ctx.strokeStyle = 'rgba(244,201,107,0.75)'; ctx.lineWidth = 2; ctx.stroke(); }
      wrapBox(state.msg.text, R(M.x + 14, M.y + 8, M.w - 28, M.h - 16), big ? 30 : 25, 1.18, CREAM);
      ctx.restore();
    } else if (base) { wrapBox(base, R(M.x + 8, M.y, M.w - 16, M.h), 24, 1.2, DIM); }
    if (L.land && L.rightHead) fitText('Tsoro Yematatu', L.rightHead.x + L.rightHead.w / 2, L.rightHead.y + 34, 30, L.rightHead.w, GOLD, FONT, 700);
    if (L.badge && L.badge.show) drawBadgeStack(ctx, L.badge.cx, L.badge.bottom, L.badge.w);
  }
  function lessonBox() {
    const l = LESSONS[state.lesson.i], r = L.lessonBox;
    panel(r, 16, 'rgba(5,20,20,0.78)', 'rgba(244,201,107,0.45)', true, 'plateOn');
    const pad = 16;
    text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, r.x + pad, r.y + 30, Math.max(minU, 20), DIM, UI, 600, 'left');
    fitText(l.title, r.x + pad, r.y + 30 + 40, 38, r.w - 2 * pad, GOLD, FONT, 700, 'left');
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
    if (v3.on) v3.scrim = 0.7; else { ctx.fillStyle = 'rgba(2,10,10,0.7)'; ctx.fillRect(0, 0, L.w, L.h); }
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 26, 'rgba(6,26,26,0.95)', 'rgba(244,201,107,0.55)', true, 'doc');
    const res = state.result || { winner: g.winner, reason: g.reason }, w = res.winner;
    const title = w === 3 ? 'A draw' : state.autoMode ? `${NAMES[w]} wins` : state.two ? `${NAMES[w]} wins` : w === state.humanSide ? 'You win!' : 'The computer wins';
    const k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    if (w !== 3) drawPiece(ctx, w, style, 0, 118, 118, { glow: 0.9, lift: 0.4 + Math.sin(state.t * 2.5) * 0.08 });
    else { drawPiece(ctx, 1, style, -56, 118, 96, {}); drawPiece(ctx, 2, style, 56, 118, 96, {}); }
    fitText(title, 0, 238, 62, cw2 - 40, GOLD, FONT, 700);
    wrapBox(res.reason || '', R(-cw2 / 2 + 30, 252, cw2 - 60, 70), 26, 1.25, CREAM);
    fitText(`${Math.ceil(g.moves / 2)} moves each · ${variantOf(g.variant).name} triangle`, 0, 346, 22, cw2 - 40, DIM, UI, 500);
    if (!state.two && !state.autoMode && w === state.humanSide) { fitText(`★ ${LEVELS[state.level].name} beaten`, 0, 390, 24, cw2 - 40, '#ffd24a', UI, 700); confetti(c, 0); }
    ctx.restore();
    button(O.again, state.autoMode ? 'Watch another' : 'Play again', { primary: true, size: 32 }); button(O.back, 'Menu', { size: 28 });
    drawMoreLine(ctx, cx, O.back.y + O.back.h + 32, 22);
  }
  function confetti(c, cx) {
    if (state.calm) return;
    for (let k = 0; k < 22; k++) {
      const ph = (state.t * 0.32 + k * 0.0917) % 1, x = cx + Math.sin(k * 2.4 + state.t) * (60 + 170 * ph), y = 210 - ph * 190 + ph * ph * 120;
      ctx.fillStyle = k % 3 === 0 ? `rgba(255,214,110,${0.9 * (1 - ph)})` : k % 3 === 1 ? `rgba(90,200,190,${0.8 * (1 - ph)})` : `rgba(255,246,224,${0.8 * (1 - ph)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k + state.t * 2); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore();
    }
  }

  // ================================================================ documents (rules, how to play, about, settings)
  function drawDocument() {
    const D = L.doc, panelR = D.panel, vp = D.viewport, kindDoc = state.doc.kind;
    if (v3.on) { v3.scrim = 0.3; panel(panelR, 26, '', '', false, 'doc'); }
    else {
    ctx.fillStyle = 'rgba(2,10,10,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
    ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 26);
    const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(22,58,56,0.88)'); pg.addColorStop(1, 'rgba(6,20,20,0.94)');
    ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(244,201,107,0.32)'; ctx.lineWidth = 2; ctx.stroke();
    edgeStroke(ctx, panelR, 26, 0.4);
    }
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kindDoc];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 44, D.header.textDec.x - 96 - hx, GOLD, FONT, 700, 'left');
    ctx.strokeStyle = 'rgba(244,201,107,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panelR.x + 28, panelR.y + 82); ctx.lineTo(panelR.x + panelR.w - 28, panelR.y + 82); ctx.stroke();
    const secs = kindDoc === 'rules' ? RULES : kindDoc === 'how' ? HOWTO : kindDoc === 'about' ? ABOUT : [{ title: '', items: settingsItems(state) }];
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
        const ty2 = y + t0 * 0.9; if (vis(y, t0)) fitText(sec.title, cxp, ty2, t0, bodyW, '#ffd24a', UI, 800, 'center', 18);
        y += t0 * 1.35 + 6;
      }
      for (const it of sec.items) {
        if (it.k === 'p') {
          const ls = lines(it.t, size, bodyW); if (vis(y, ls.length * lh)) ls.forEach((ln, i) => text(ln, cxp, y + size * 0.9 + i * lh, size, CREAM, UI, 600, 'center'));
          y += ls.length * lh + gap;
        } else if (it.k === 'h') {
          const hs = Math.round(30 * Math.min(scale, 2)); y += 8; if (vis(y, hs)) text(it.t, cxp, y + hs * 0.9, hs, '#ffd24a', UI, 800, 'center'); y += hs * 1.3 + 4;
        } else if (it.k === 'd') {
          const wd = Math.min((it.w || 320) * (1 + (Math.min(scale, 2) - 1) * 0.35), bodyW - 24), ds = diagramSize(it.spec, wd);
          if (vis(y, ds.h)) drawDiagram(ctx, it.spec, cxp - ds.w / 2, y, wd, kind, style);
          y += ds.h + gap + 6;
        } else if (it.k === 'act') {
          const os = Math.round(26 * Math.min(scale, 2.2)), bh = Math.round(72 * Math.min(scale, 2.2)), rr = R(left, y, bodyW, bh);
          if (vis(y, bh)) button(rr, it.label, { size: os, primary: !it.disabled, dim: it.disabled, clip: vp });
          if (!it.disabled) ui.hits.push({ r: rr, id: it.id, v: 0, clip: vp });
          y += bh + gap;
        } else if (it.k === 'seg') {
          const fs = Math.round(25 * Math.min(scale, 2.2)), ls = lines(it.label, fs, bodyW, 600);
          if (vis(y, ls.length * fs * 1.3)) ls.forEach((ln, i) => text(ln, cxp, y + fs * 0.9 + i * fs * 1.3, fs, DIM, UI, 600, 'center'));
          y += ls.length * fs * 1.3 + 6;
          const n = it.opts.length, os = Math.round(25 * Math.min(scale, 2.2)), bh = Math.round(66 * Math.min(scale, 2.2));
          let per = n; ctx.font = `700 ${os}px ${UI}`;
          const fitsRow = (p) => it.opts.every((o) => ctx.measureText(o.l + (o.locked ? ' (locked)' : '')).width + 28 <= (bodyW - (p - 1) * 10) / p);
          while (per > 1 && !fitsRow(per)) per--;
          const bw = (bodyW - (per - 1) * 10) / per;
          it.opts.forEach((o, k) => {
            const rx = left + (k % per) * (bw + 10), ry = y + Math.floor(k / per) * (bh + 10), rr = R(rx, ry, bw, bh);
            if (vis(ry, bh)) button(rr, o.locked ? `${o.l} (locked)` : o.l, { size: os, on: o.v === it.cur && !o.locked, primary: o.v === it.cur && !o.locked, dim: o.locked, clip: vp });
            ui.hits.push({ r: rr, id: it.id, v: o.v, locked: o.locked, need: o.need, clip: vp });
          });
          y += Math.ceil(n / per) * (bh + 10) + gap;
        }
      }
    });
    ctx.restore();
    const contentH = y - (vp.y - sc0) + 10;
    if (contentH - vp.h > 8) {
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); const fc = v3.on ? '10,30,29' : '12,34,33'; gr.addColorStop(0, `rgba(${fc},${a0})`); gr.addColorStop(1, `rgba(${fc},${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 22, vp.y, 0, 0.95);
    }
    docMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); docMetrics.view = vp.h;
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(244,201,107,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(244,201,107,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(docMetrics.max > 0 ? (sc0 >= docMetrics.max - 1 ? 'End' : 'Scroll, or tap Next') : '', D.cx, D.counterY, 21, 'rgba(244,201,107,0.65)', UI, 500);
    button(D.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(D.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    fitText(`${Math.round(scale * 100)}%`, D.header.textDec.x - 14, D.header.textDec.y + 42, 22, 70, DIM, UI, 600, 'right');
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); if (v3.on) panel(r, 14, '', '', false, 'plateOn'); else { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(4,16,16,0.96)'; ctx.fill(); ctx.strokeStyle = 'rgba(244,201,107,0.8)'; ctx.lineWidth = 2; ctx.stroke(); } wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}

// ---------------------------------------------------------------- effects
function fireflies(ctx, L, t) {
  for (let k = 0; k < 16; k++) {
    const sp = 5 + (k % 4) * 3, x = (((k * 211.7 + t * sp) % (L.w + 80)) + L.w + 80) % (L.w + 80) - 40, y = (k * 137.3 + Math.sin(t * 0.25 + k) * 40 + L.h * 2) % L.h, r = 1.6 + (k % 4), a = 0.05 + 0.05 * Math.sin(t * 0.9 + k * 1.7);
    ctx.fillStyle = `rgba(255,226,140,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}
