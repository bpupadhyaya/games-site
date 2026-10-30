// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, inRect, R, clamp } from './layout.js';
import { drawTable, drawBoard, drawPiece, drawDiagram, diagramSize, boardLines, blob, SURFACES } from './art.js';
import { RULES, HOWTO, ABOUT, LESSONS } from './content.js';
import { settingsItems } from './settings.js';
import { VARIANTS, NAMES, startCount, pieceCount, isSultan, sideOf } from './rules.js';
import { LEVELS } from './ai.js';
import { v3 } from './v3.js';
import { drawCredit, drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GOLD = '#f4d596', CREAM = '#fff6e0', DIM = 'rgba(244,213,150,0.78)', VERM = '#1f8f8a';
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
  const scene = state.scene, scale = TEXT_SCALES[state.textScaleIdx] ?? 1, big = scale > 1, g = state.game, a = state.anim, B = L.board;
  const minU = Math.max(12, 11 / (host.px || 0.6));
  const wood = state.wood, style = state.style, N = L.n, ALQ = VARIANTS[g.variant].alq;

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
  const panel = (r, rad = 18, fill = 'rgba(30,15,8,0.62)', stroke = 'rgba(244,213,150,0.22)', brand = true, kind = 'plate') => {
    if (v3.on) { v3.panels.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad, kind }); return; }
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.38);
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = v3.on ? 0.72 : 0.5;
    const rad = Math.min(18, r.h / 3);
    if (v3.on) v3.buttons.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad, primary: !!o.primary, on: !!o.on, dim: !!o.dim });
    if (!v3.on) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#2ab1a8'); gr.addColorStop(1, '#0e5a56'); } else if (o.on) { gr.addColorStop(0, '#1d7a74'); gr.addColorStop(1, '#0c3f3c'); } else { gr.addColorStop(0, '#74432a'); gr.addColorStop(1, '#3a1d10'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(190,255,240,0.8)' : 'rgba(244,213,150,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, Math.max(2, rad - 3)); ctx.stroke();
    }
    const size = o.size ?? 28, maxW = r.w - 20, col = o.primary ? '#f2fffb' : GOLD, cy = r.y + r.h / 2 - (v3.on ? 3 : 0);
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
    if (o.sub && best.ls.length === 1) { text(label, r.x + r.w / 2, cy + best.s * 0.1 - 6, best.s, col, UI, 700); fitText(o.sub, r.x + r.w / 2, cy + best.s * 0.1 + Math.max(minU, size * 0.62) + 2, Math.round(size * 0.62), maxW, DIM, UI, 500, 'center', minU); }
    else if (best.ls.length === 1) text(label, r.x + r.w / 2, cy + best.s * 0.35, best.s, col, UI, 700);
    else best.ls.forEach((ln, i) => text(ln, r.x + r.w / 2, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s, col, UI, 700));
    ctx.restore();
  };
  const hit = (r, id, v) => ui.hits.push({ r, id, v });

  // ---------------------------------------------------------------- scenes
  drawTable(ctx, L, state.t);
  if (!state.calm && !v3.on) motes(ctx, L, state.t);

  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();

  // screens fade in from the table's dark instead of cutting
  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(30,15,8,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function drawTitle() {
    const T = L.title(!!state.saved), Rr = T.rows;
    if (T.card) panel(T.card, 24, 'rgba(30,15,8,0.55)', undefined, true, 'plate');
    hero(T.hero);
    if (scene === 'demo-limit') {
      const r = T.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!T.card) panel(r, 24, 'rgba(30,15,8,0.7)', undefined, true, 'plate');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, GOLD, FONT, 700);
      wrapBox('Get Zamma on iPhone and Android for unlimited games, all three board sizes and every level.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      if (Rr.resume) button(Rr.resume, 'Continue your game', { primary: true, size: 30 });
      button(Rr.play, 'Play the computer', { primary: !Rr.resume, size: 32, sub: `${VARIANTS[state.variant].name} board · ${LEVELS[state.level].name} · as ${NAMES[state.humanSide]}` });
      button(Rr.two, 'Two players', { size: 26 }); button(Rr.learn, state.learned ? 'Learn' : 'Learn to play', { size: 26, primary: false });
      button(Rr.auto, 'Auto Play · Watch & Learn', { size: 26 });
      button(Rr.rules, 'Rules', { size: 26 }); button(Rr.how, 'How to Play', { size: 26 });
      button(Rr.about, 'About', { size: 26 }); button(Rr.settings, 'Settings', { size: 26 });
      if (state.msg) fitText(state.msg.text, L.w / 2, T.rows.play.y - 14, 24, L.w - 40, GOLD, UI, 600);
    }
    // the Arcforge lockup, bottom centre under the menu
    const lk = T.lockup; state.lockupRect = drawLockup(ctx, lk.x, lk.y + 4, 50);
  }

  function hero(r) {
    // title text
    const cx = r.x + r.w / 2, tall = r.h > 520;
    const ts = clamp(Math.min(r.w / 7.2, r.h / 4.6), 40, 112);
    const y0 = r.y + ts * 0.95;
    { // embossed lettering: a bronze extrusion under a gold face, a dark outline and a specular line
      const wFit = (() => { ctx.font = `700 ${ts}px ${FONT}`; const w0 = ctx.measureText('Zamma').width; return w0 > r.w - 10 ? ts * (r.w - 10) / w0 : ts; })();
      ctx.save(); ctx.font = `700 ${wFit}px ${FONT}`; ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = wFit * 0.12; ctx.fillStyle = '#2a1204'; ctx.fillText('Zamma', cx, y0 + wFit * 0.1); ctx.shadowColor = 'transparent';
      const dep = Math.max(3, Math.round(wFit * 0.07));
      for (let d = dep; d >= 1; d--) { ctx.fillStyle = d > dep * 0.5 ? '#6a3a12' : '#8e5a1c'; ctx.fillText('Zamma', cx, y0 + d); }
      const grad = ctx.createLinearGradient(0, y0 - wFit * 0.75, 0, y0 + wFit * 0.08); grad.addColorStop(0, '#fffbe8'); grad.addColorStop(0.35, '#ffe39a'); grad.addColorStop(0.62, '#e8a742'); grad.addColorStop(1, '#a8601c');
      ctx.fillStyle = grad; ctx.fillText('Zamma', cx, y0);
      ctx.lineWidth = Math.max(1.5, wFit * 0.018); ctx.strokeStyle = 'rgba(58,26,6,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText('Zamma', cx, y0);
      ctx.globalCompositeOperation = 'source-atop'; ctx.restore();
      ctx.save(); ctx.font = `700 ${wFit}px ${FONT}`; ctx.textAlign = 'center'; ctx.strokeStyle = 'rgba(255,255,240,0.55)'; ctx.lineWidth = Math.max(1, wFit * 0.012); ctx.strokeText('Zamma', cx - wFit * 0.006, y0 - wFit * 0.012); ctx.restore();
    }
    const sub = Math.max(minU, ts * 0.3);
    ctx.save(); ctx.fillStyle = VERM;
    const pw = Math.min(r.w * 0.92, ts * 5.4), py = y0 + ts * 0.34;
    if (v3.on) v3.buttons.push({ r: { x: cx - pw / 2, y: py, w: pw, h: sub * 1.7 }, rad: sub * 0.85, primary: true, on: false, dim: false });
    else { ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, sub * 1.7, sub * 0.85); ctx.fill(); }
    ctx.restore();
    ctx.font = `700 ${sub}px ${UI}`; ctx.fillStyle = CREAM; ctx.textAlign = 'center';
    ctx.fillText('S A H A R A   D R A U G H T S', cx, py + sub * 1.2);
    fitText('The jumping game of the Mzab and Mauritania', cx, py + sub * 1.7 + ts * 0.36, ts * 0.26, r.w - 20, 'rgba(244,213,150,0.88)', FONT, 700);
    // the animated demonstration: a sandwich, forever
    const top = py + sub * 1.7 + ts * 0.62, room = r.y + r.h - top;
    if (room > 90) { const hr = R(r.x, top + 6, r.w, room - 22); if (v3.on) { const sw = Math.min(hr.w, hr.h * 1.9); v3.heroRect = { x: hr.x + (hr.w - sw) / 2, y: hr.y, w: sw, h: hr.h * 1.02 }; } else heroBoard(hr); }
  }

  function heroBoard(r) {
    const cols = 5, rows = 5, cell = clamp(Math.min((r.w - 24) / (cols + 0.4), (r.h - 14) / (rows + 0.45), 112), 28, 112);
    const bw = cols * cell, bh = rows * cell, x0 = r.x + (r.w - bw) / 2, y0 = r.y + (r.h - bh) / 2 + 4;
    const T = state.calm ? 3.2 : (state.t + 2.7) % 9;
    ctx.save();
    // a small sand board plate
    const m = cell * 0.2, pw = bw + 2 * m, ph = bh + 2 * m, px0 = x0 - m, py0 = y0 - m, pal = SURFACES[wood] || SURFACES.sand;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.roundRect(px0 + 4, py0 + 12, pw, ph + 6, 14); ctx.fill();
    const sg = ctx.createLinearGradient(0, py0 + ph - 8, 0, py0 + ph + 12); sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
    ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(px0, py0 + 8, pw, ph + 8, 14); ctx.fill();
    const gg = ctx.createLinearGradient(px0, py0, px0 + pw, py0 + ph); gg.addColorStop(0, pal.top[0]); gg.addColorStop(0.55, pal.top[1]); gg.addColorStop(1, pal.top[2]);
    ctx.fillStyle = gg; ctx.beginPath(); ctx.roundRect(px0, py0, pw, ph, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    const at = (r2, c) => ({ x: x0 + (c + 0.5) * cell, y: y0 + (r2 + 0.5) * cell });
    ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(1.5, cell * 0.035); ctx.lineCap = 'round'; ctx.beginPath();
    boardLines(5, false, (r0, c0, r1, c1) => { const p = at(r0, c0), q = at(r1, c1); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); });
    ctx.stroke();
    // script: the Basalt man at (4,1) jumps (3,2) to (2,3), jumps (1,3) to (0,3) and is crowned; the rest stand about
    const fixed = [[1, 0, 2], [0, 1, 2], [4, 0, 1], [4, 4, 1], [3, 4, 1]];
    const victims = [[3, 2, 1.9], [1, 3, 2.45]];
    const op = T < 0.5 ? T / 0.5 : T > 6.4 ? Math.max(0, 1 - (T - 6.4) / 0.6) : 1;
    ctx.globalAlpha = op;
    for (const [r2, c, s2] of fixed) { const p = at(r2, c); drawPiece(ctx, s2, style, p.x, p.y, cell); }
    for (const [r2, c, tcap] of victims) { const p = at(r2, c), f = (T - tcap) / 0.6; if (T < tcap) drawPiece(ctx, 2, style, p.x, p.y, cell); else if (f < 1) capFx(ctx, style, 2, p.x, p.y, cell, f, false, state.calm, r2 + c); }
    const A = at(4, 1), Bp = at(2, 3), C = at(0, 3);
    let mx, my, lift = 0;
    if (T < 1.4) { mx = A.x; my = A.y; lift = clamp((T - 0.9) / 0.5, 0, 1) * 0.5; }
    else if (T < 1.9) { const f = ease((T - 1.4) / 0.5); mx = A.x + (Bp.x - A.x) * f; my = A.y + (Bp.y - A.y) * f; lift = 0.5 + Math.sin(Math.PI * f) * 0.3; }
    else if (T < 1.95) { mx = Bp.x; my = Bp.y; lift = 0.5; }
    else if (T < 2.45) { const f = ease((T - 1.95) / 0.5); mx = Bp.x + (C.x - Bp.x) * f; my = Bp.y + (C.y - Bp.y) * f; lift = 0.5 + Math.sin(Math.PI * f) * 0.3; }
    else { mx = C.x; my = C.y; lift = Math.max(0, 0.5 * (1 - (T - 2.45) / 0.3)); }
    const crowned = T > 2.55;
    drawPiece(ctx, 1, style, mx, my, cell, { lift, king: crowned, glow: T > 0.9 && T < 1.4 ? 0.6 : crowned && T < 3.3 ? 0.9 : 0, scale: crowned && T < 2.9 ? 1 + 0.18 * Math.sin((T - 2.55) / 0.35 * Math.PI) : 1 });
    if (crowned && T < 3.2 && !state.calm) { const f = (T - 2.55) / 0.65; ctx.strokeStyle = `rgba(255,240,190,${0.8 * (1 - f)})`; ctx.lineWidth = 5 * (1 - f) + 1; ctx.beginPath(); ctx.ellipse(C.x, C.y + cell * 0.2, cell * (0.3 + 0.8 * f), cell * (0.15 + 0.4 * f), 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  // ================================================================ play / over / lesson
  function drawPlayScreen() {
    const isLesson = scene === 'lesson', over = scene === 'over';
    const cell = B.cell;
    // side cards in landscape
    if (L.land) { if (L.leftCard) panel(L.leftCard, 18); panel(L.rightCard, 18); }

    // ---- 3D scene: the board, stones and markers are in the WebGL layer; only badges are drawn here
    if (v3.on) {
      const u = v3.unit;
      if (state.sel >= 0 && !a && !over) for (const m of state.selMoves) if (m.caps) {
        const p = v3.sq(m.to, 0.2), sz = Math.round(u * 0.3), bx = p.x + u * 0.34, by = p.y - u * 0.4;
        ctx.fillStyle = '#e23c24'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, sz * 0.62, 0, TAU); ctx.fill(); ctx.stroke();
        text(String(m.caps), bx, by + sz * 0.24, sz * 0.78, '#fff', UI, 800);
      }
      if (state.marks && !over && !a && state.danger) for (const i of state.danger) { const p = v3.sq(i, 0.32); dangerMark(p.x + u * 0.3, p.y - u * 0.22, u * 1.1); }
      if (a && a.caps.length && !state.calm && a.t > a.glide) {
        const f = (a.t - a.glide) / 0.8;
        if (f < 1) {
          const p1 = v3.sq(a.to, 0.2), e2 = ease(Math.min(1, f * 1.4)), fs = Math.round(u * 0.62);
          ctx.save(); ctx.globalAlpha = Math.min(1, (1 - f) * 2.2); ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(40,16,4,0.9)'; ctx.lineJoin = 'round'; ctx.font = `800 ${fs}px ${UI}`; ctx.textAlign = 'center';
          const tx = p1.x, ty = p1.y - u * (0.9 + 0.8 * e2);
          ctx.strokeText(`+${a.caps.length}`, tx, ty); ctx.fillStyle = '#ffd24a'; ctx.fillText(`+${a.caps.length}`, tx, ty); ctx.restore();
        }
      }
    } else {
    // ---- the board scene (shaken a little on a capture)
    ctx.save();
    const capEnd = a && a.caps.length ? a.glide : 0;
    if (a && a.caps.length && !state.calm && a.t > capEnd && a.t < capEnd + 0.35) { const f = (a.t - capEnd) / 0.35; ctx.translate(Math.sin(f * 46) * (1 - f) * cell * 0.045, Math.cos(f * 38) * (1 - f) * cell * 0.03); }
    drawBoard(ctx, B, wood, N, ALQ);
    const ring = (p, r, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); };
    // last move: the squares it visited, joined by a faint line
    const last = a ? null : g.last;
    if (last && !isLesson) {
      const pts = [last.from, ...last.path].map((q) => L.sq(q));
      ctx.strokeStyle = 'rgba(255,214,110,0.4)'; ctx.lineWidth = cell * 0.08; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      for (const p of pts) { ctx.fillStyle = 'rgba(255,214,110,0.3)'; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.4, 0, TAU); ctx.fill(); }
    }
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    // lesson target
    if (isLesson && LESSONS[state.lesson.i].target !== undefined && !state.lesson.done) ring(L.sq(LESSONS[state.lesson.i].target), cell * 0.38, `rgba(214,64,31,${0.6 + 0.4 * pulse})`, cell * 0.07);
    // a capture is compulsory: the stones that may take are marked
    const mine = !a && !over && !state.autoMode && !g.winner && (isLesson || state.two || g.turn === state.humanSide);
    if (mine && state.forced && state.sel < 0) for (const q of state.movers) ring(L.sq(q), cell * (0.43 + pulse * 0.03), `rgba(40,200,190,${0.55 + pulse * 0.35})`, cell * 0.05);
    // selected stone: its legal points
    if (state.sel >= 0 && !a && !over) {
      const sp = L.sq(state.sel); ctx.fillStyle = `rgba(255,224,120,${0.3 + pulse * 0.14})`; ctx.beginPath(); ctx.arc(sp.x, sp.y, cell * 0.44, 0, TAU); ctx.fill();
      if (state.pre.length) {                                                 // the landings already chosen along a chain
        ctx.strokeStyle = 'rgba(226,60,36,0.8)'; ctx.lineWidth = cell * 0.07; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(sp.x, sp.y);
        for (const q of state.pre) { const p = L.sq(q); ctx.lineTo(p.x, p.y); } ctx.stroke();
        for (const q of state.pre) { const p = L.sq(q); ctx.fillStyle = 'rgba(226,60,36,0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.3, 0, TAU); ctx.fill(); }
      }
      for (const m of state.selMoves) {
        const p = L.sq(m.to);
        if (m.caps) {
          ring(p, cell * 0.36, `rgba(226,60,36,${0.7 + pulse * 0.3})`, cell * 0.07);
          ctx.fillStyle = 'rgba(226,60,36,0.2)'; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.36, 0, TAU); ctx.fill();
          const sz = Math.round(cell * 0.3); ctx.fillStyle = '#e23c24'; ctx.beginPath(); ctx.arc(p.x + cell * 0.3, p.y - cell * 0.3, sz * 0.56, 0, TAU); ctx.fill();
          text(String(m.caps), p.x + cell * 0.3, p.y - cell * 0.3 + sz * 0.2, sz * 0.72, '#fff', UI, 800);
        } else { ctx.fillStyle = `rgba(255,248,214,${0.6 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.14, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(70,40,10,0.5)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    }
    if (state.hint && !a) for (const q of [state.hint.from, ...(state.hint.path || [state.hint.to])]) { const p = L.sq(q); ctx.fillStyle = `rgba(40,200,150,${0.3 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.44, 0, TAU); ctx.fill(); ring(p, cell * 0.44, 'rgba(60,230,170,0.95)', 3); }
    // stones, far rows first (a lower stone overlaps the one above it)
    const order = []; for (let rr = 0; rr < N; rr++) for (let cc = 0; cc < N; cc++) order.push((L.flip ? N - 1 - rr : rr) * N + (L.flip ? N - 1 - cc : cc));
    const movingTo = a ? a.to : -1;
    const dragging = state.drag && state.sel >= 0;
    for (const i of order) {
      const k = g.board[i]; if (!k || i === movingTo) continue;
      if (dragging && i === state.sel) continue;
      const p = L.sq(i), sel = state.sel === i;
      const lift = sel ? 0.45 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.06) : 0;
      drawPiece(ctx, sideOf(k), style, p.x, p.y, cell, { lift, king: isSultan(k), glow: sel ? 0.8 : 0 });
      if (state.marks && !over && !a && state.danger && state.danger.has(i)) dangerMark(p.x + cell * 0.3, p.y - cell * 0.42, cell);
    }
    // the captured stones: each stays until the mover has jumped it, then flashes and flies off
    if (a) for (let k = 0; k < a.caps.length; k++) {
      const q = a.caps[k], v = a.capVals[k], p = L.sq(q), tj = (k + 1) * a.segDur - a.segDur * 0.5;
      if (a.t < tj) drawPiece(ctx, sideOf(v), style, p.x, p.y, cell, { king: isSultan(v) });
      else { const f = (a.t - tj) / 0.55; if (f < 1) capFx(ctx, style, sideOf(v), p.x, p.y, cell, f, false, state.calm, k + q, isSultan(v)); }
    }
    // a golden burst and a floating count where the chain ended
    if (a && a.caps.length && !state.calm && a.t > a.glide) {
      const f = (a.t - a.glide) / 0.8;
      if (f < 1) {
        const p1 = L.sq(a.to), e2 = ease(Math.min(1, f * 1.4));
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const rg = ctx.createRadialGradient(p1.x, p1.y, 0, p1.x, p1.y, cell * (0.4 + 1.3 * f)); rg.addColorStop(0, `rgba(255,220,140,${0.5 * (1 - f)})`); rg.addColorStop(1, 'rgba(255,200,100,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p1.x, p1.y, cell * (0.4 + 1.3 * f), 0, TAU); ctx.fill(); ctx.restore();
        const fs = Math.round(cell * 0.62);
        ctx.save(); ctx.globalAlpha = Math.min(1, (1 - f) * 2.2);
        ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(40,16,4,0.9)'; ctx.lineJoin = 'round'; ctx.font = `800 ${fs}px ${UI}`; ctx.textAlign = 'center';
        const tx = p1.x, ty = p1.y - cell * (0.7 + 0.8 * e2);
        ctx.strokeText(`+${a.caps.length}`, tx, ty); ctx.fillStyle = '#ffd24a'; ctx.fillText(`+${a.caps.length}`, tx, ty); ctx.restore();
      }
    }
    // the moving stone: landing to landing along its path
    if (a) {
      const segs = a.path.length - 1, s = Math.min(segs - 1, Math.floor(a.t / a.segDur)), f = clamp((a.t - s * a.segDur) / a.segDur, 0, 1), e = ease(f);
      const p0 = L.sq(a.path[s]), p1 = L.sq(a.path[s + 1]);
      const x = p0.x + (p1.x - p0.x) * e, y = p0.y + (p1.y - p0.y) * e, dist = Math.hypot(p1.x - p0.x, p1.y - p0.y) / cell;
      const gliding = a.t < a.glide, jumpLift = a.caps.length ? 0.9 : 0.35 + Math.min(0.5, dist * 0.06);
      const lift = gliding ? Math.sin(Math.PI * f) * jumpLift + 0.2 * (s === 0 ? 1 - f : 0.5) : Math.max(0, 0.2 * (1 - (a.t - a.glide) / 0.12));
      const crowned = a.promote && a.t >= a.glide;
      const pop = crowned && !state.calm ? 1 + 0.2 * Math.sin(clamp((a.t - a.glide) / 0.35, 0, 1) * Math.PI) : 1;
      drawPiece(ctx, a.side, style, x, y, cell, { lift, king: a.king || crowned, glow: crowned ? 0.9 : 0.5, scale: pop });
      if (a.t > a.glide && a.t < a.glide + 0.45 && !state.calm) { const ff = (a.t - a.glide) / 0.45; ctx.strokeStyle = `rgba(255,240,200,${0.75 * (1 - ff)})`; ctx.lineWidth = cell * 0.07 * (1 - ff) + 1; ctx.beginPath(); ctx.ellipse(p1.x, p1.y + cell * 0.2, cell * (0.3 + 0.8 * ff), cell * (0.14 + 0.34 * ff), 0, 0, TAU); ctx.stroke(); }
    }
    // a dragged stone follows the finger
    if (dragging) drawPiece(ctx, sideOf(g.board[state.sel]) || g.turn, style, state.drag.x, state.drag.y - cell * 0.15, cell, { lift: 0.9, king: isSultan(g.board[state.sel]), glow: 0.9 });
    if (state.kb && !over) { const p = L.sq(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.strokeRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6); }
    ctx.restore();

    }

    // ---- furniture
    if (isLesson) lessonBox(); else plates();
    buttonsFor();
    if (over) overlay();
  }

  function dangerMark(x, y, cell) {
    const r = cell * 0.17;
    ctx.fillStyle = '#e23c24'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(x - r * 0.12, y - r * 0.55, r * 0.24, r * 0.7); ctx.fillRect(x - r * 0.12, y + r * 0.28, r * 0.24, r * 0.24);
  }

  function plateInfo(side) {
    const opp = 3 - side, flying = a && a.t < a.glide + 0.3 ? a.caps.length : 0;     // while a capture plays, the trays still show the old numbers
    return { got: g.lost[opp] - (a && a.side === side ? flying : 0), left: pieceCount(g, side) + (a && a.side !== side ? flying : 0) };
  }
  function plate(r, side) {
    const human = !state.two && !state.autoMode && side === state.humanSide;
    const name = state.autoMode ? `${NAMES[side]} · computer` : state.two ? NAMES[side] : human ? 'You' : 'Computer';
    const sub = state.autoMode ? LEVELS[Math.max(2, state.level)].name : state.two || human ? NAMES[side] : `${LEVELS[state.level].name} · ${NAMES[side]}`;
    const turn = !g.winner && g.turn === side && scene !== 'over';
    panel(r, 16, turn ? 'rgba(40,34,18,0.78)' : 'rgba(30,15,8,0.62)', turn ? 'rgba(244,213,150,0.85)' : 'rgba(244,213,150,0.2)', true, turn ? 'plateOn' : 'plate');
    const info = plateInfo(side), v = state.variant;
    if (r.h < 112) {                                                  // compact: one line of text, the captured pieces on the right
      const ic2 = clamp(r.h * 0.74, 36, 80), ix2 = r.x + 12 + ic2 * 0.55, iy2 = r.y + r.h * 0.5 + ic2 * 0.3;
      drawPiece(ctx, side, style, ix2, iy2, ic2, { glow: turn ? 0.7 : 0 });
      const tx2 = r.x + 12 + ic2 * 1.1 + 12, ns2 = clamp(r.h * 0.27, 18, 30), tcw = Math.min(r.w * 0.34, 260);
      const st = turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))) : state.two ? 'To move' : human ? 'Your move' : 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))) : sub;
      const room = r.x + r.w - 12 - tx2 - tcw;
      const fits = (str) => { ctx.font = `800 ${Math.round(ns2 * 0.8)}px ${UI}`; return ctx.measureText(str).width <= room; };
      const label = [`${name} · ${st}`, turn ? st : `${name} · ${sub.split(' · ')[0]}`, name, NAMES[side]].find(fits) || NAMES[side];   // narrow plates (tablet portrait): shorter caption, never overlapping the tray
      fitText(label, tx2, r.y + r.h * 0.42, ns2, room, turn ? CREAM : DIM, UI, 800, 'left');
      const goal2 = `Captured ${info.got}`;
      const sz2 = Math.round(ns2 * 0.78), fits2 = (str) => { ctx.font = `600 ${Math.round(sz2 * 0.8)}px ${UI}`; return ctx.measureText(str).width <= room; };
      fitText([`${goal2} · ${info.left} left`, `${info.got} taken · ${info.left} left`, `${info.left} left`].find(fits2) || `${info.left} left`, tx2, r.y + r.h * 0.75, sz2, room, DIM, UI, 600, 'left');
      const tc2 = clamp(r.h * 0.5, 24, 40), per2 = Math.max(1, Math.floor(tcw / (tc2 * 0.6)));
      for (let k = 0; k < Math.min(info.got, 18); k++) drawPiece(ctx, 3 - side, style, r.x + r.w - 14 - tcw + tc2 * 0.4 + (k % per2) * tc2 * 0.6, r.y + r.h * 0.5 + tc2 * 0.28 + Math.floor(k / per2) * tc2 * 0.3 - (info.got > per2 ? tc2 * 0.15 : 0), tc2, { alpha: 0.95 });
      return;
    }
    const ns = clamp(r.h * 0.22, 18, 46), ic = clamp(Math.min(r.h * 0.6, r.w * 0.22), 38, 132);
    const ix = r.x + 14 + ic * 0.55, iy = r.y + 12 + ic * 0.62;
    drawPiece(ctx, side, style, ix, iy, ic, { glow: turn ? 0.7 : 0, lift: turn && !state.calm ? 0.12 + Math.sin(state.t * 3) * 0.05 : 0 });
    const tx = r.x + 14 + ic * 1.1 + 14, tw = r.x + r.w - 14 - tx;
    const y1 = r.y + 10 + ns * 0.85, y2 = y1 + ns * 0.84, y3 = y2 + ns * 0.8;
    fitText(name, tx, y1, ns, tw, CREAM, UI, 800, 'left');
    const status = turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'The move' : 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))) : state.two ? 'To move' : human ? 'Your move' : state.thinking || state.think > 0 ? 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3)) : 'Moving') : sub;
    fitText(status, tx, y2, Math.round(ns * 0.72), tw, turn ? GOLD : DIM, UI, 600, 'left');
    const goal = `Captured ${info.got}`;
    fitText(`${goal} · ${info.left} left`, tx, y3, Math.round(ns * 0.62), tw, DIM, UI, 600, 'left');
    const slots = 0, cols = 12, availH = r.y + r.h - (y3 + 8) - 4;
    const tc = Math.min(clamp(availH, 0, 56), tw / (0.62 * cols + 0.35));          // one row of slots must fit the plate's width
    if (tc >= 18) {
      const at = (k) => ({ x: tx + tc * 0.4 + (k % cols) * tc * 0.62, y: y3 + 8 + tc * 0.55 + Math.floor(k / cols) * tc * 0.42 });
      ctx.strokeStyle = 'rgba(244,213,150,0.2)'; ctx.lineWidth = 1.5;
      for (let k = info.got; k < slots; k++) { const p = at(k); ctx.beginPath(); ctx.ellipse(p.x, p.y + tc * 0.05, tc * 0.2, tc * 0.28, 0, 0, TAU); ctx.stroke(); }   // empty slots show what is still to win
      for (let k = 0; k < Math.min(info.got, 36); k++) { const p = at(k); drawPiece(ctx, 3 - side, style, p.x, p.y, tc * 0.9, { alpha: 0.95 }); }
    }
  }
  function plates() {
    const topSide = L.flip ? 1 : 2, botSide = L.flip ? 2 : 1;
    plate(L.plateTop, topSide); plate(L.plateBot, botSide);
    // message
    const M = L.msg, al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the computer plays both sides.' : g.winner ? '' : state.two || g.turn === state.humanSide ? 'Tap a stone, then a glowing point.' : '';
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      if (v3.on) v3.panels.push({ r: { x: M.x, y: M.y + 4, w: M.w, h: M.h - 8 }, rad: 14, kind: 'toast' });
      else { ctx.beginPath(); ctx.roundRect(M.x, M.y + 4, M.w, M.h - 8, 14); ctx.fillStyle = 'rgba(20,10,5,0.92)'; ctx.fill(); ctx.strokeStyle = 'rgba(244,213,150,0.75)'; ctx.lineWidth = 2; ctx.stroke(); }
      wrapBox(state.msg.text, R(M.x + 14, M.y + 8, M.w - 28, M.h - 16), big ? 30 : 25, 1.18, CREAM);
      ctx.restore();
    } else if (base) { if (v3.on) v3.panels.push({ r: { x: M.x + 6, y: M.y + 6, w: M.w - 12, h: M.h - 12 }, rad: 12, kind: 'toast' }); wrapBox(base, R(M.x + 8, M.y, M.w - 16, M.h), 24, 1.2, DIM); }
    if (L.land && L.rightHead) fitText(VARIANTS[state.variant].long, L.rightHead.x + L.rightHead.w / 2, L.rightHead.y + 34, 26, L.rightHead.w, GOLD, FONT, 700);
    if (L.badge && L.badge.show) drawBadgeStack(ctx, L.badge.cx, L.badge.bottom, L.badge.w);
  }
  function lessonBox() {
    const l = LESSONS[state.lesson.i], r = L.lessonBox;
    panel(r, 16, 'rgba(30,15,8,0.72)', 'rgba(244,213,150,0.45)');
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
    else if (scene === 'over') { /* the card has its own buttons */ }
  }
  function overlay() {
    if (v3.on) v3.scrim = 0.66; else { ctx.fillStyle = 'rgba(18,9,4,0.7)'; ctx.fillRect(0, 0, L.w, L.h); }
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 26, 'rgba(36,18,10,0.92)', 'rgba(244,213,150,0.55)', true, 'doc');
    const res = state.result || { winner: g.winner, reason: g.reason }, w = res.winner;
    const title = w === 3 ? 'A draw' : state.autoMode ? `${NAMES[w]} wins` : state.two ? `${NAMES[w]} wins` : w === state.humanSide ? 'You win!' : 'The computer wins';
    const k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    if (w !== 3) drawPiece(ctx, w, style, 0, 118, 118, { glow: 0.9, lift: 0.4 + Math.sin(state.t * 2.5) * 0.08 });
    else { drawPiece(ctx, 1, style, -56, 118, 96, {}); drawPiece(ctx, 2, style, 56, 118, 96, {}); }
    fitText(title, 0, 238, 62, cw2 - 40, GOLD, FONT, 700);
    wrapBox(res.reason || '', R(-cw2 / 2 + 30, 252, cw2 - 60, 70), 26, 1.25, CREAM);
    fitText(`${Math.ceil(g.moves / 2)} moves · captured ${g.lost[2]} limestone, ${g.lost[1]} basalt`, 0, 346, 22, cw2 - 40, DIM, UI, 500);
    if (!state.two && !state.autoMode && w === state.humanSide) { fitText(`★ ${LEVELS[state.level].name} beaten on the ${VARIANTS[state.variant].name} board`, 0, 390, 24, cw2 - 40, '#ffd24a', UI, 700); confetti(c, 0); }
    ctx.restore();
    button(O.again, state.autoMode ? 'Watch another' : 'Play again', { primary: true, size: 32 }); button(O.back, 'Menu', { size: 28 });
    drawMoreLine(ctx, cx, O.back.y + O.back.h + 32, 22);
  }
  function confetti(c, cx) {
    if (state.calm) return;
    for (let k = 0; k < 22; k++) {
      const ph = (state.t * 0.32 + k * 0.0917) % 1, x = cx + Math.sin(k * 2.4 + state.t) * (60 + 170 * ph), y = 210 - ph * 190 + ph * ph * 120;
      ctx.fillStyle = k % 3 === 0 ? `rgba(255,214,110,${0.9 * (1 - ph)})` : k % 3 === 1 ? `rgba(255,150,150,${0.8 * (1 - ph)})` : `rgba(255,246,224,${0.8 * (1 - ph)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k + state.t * 2); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore();
    }
  }

  // ================================================================ documents (rules, how to play, about, settings)
  function drawDocument() {
    const D = L.doc, panelR = D.panel, vp = D.viewport, kind = state.doc.kind;
    if (v3.on) { v3.scrim = 0.4; v3.panels.push({ r: { x: panelR.x, y: panelR.y, w: panelR.w, h: panelR.h }, rad: 26, kind: 'doc' }); }
    else {
    ctx.fillStyle = 'rgba(18,9,4,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
    ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 26);
    const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(70,38,22,0.86)'); pg.addColorStop(1, 'rgba(30,15,8,0.92)');
    ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(244,213,150,0.32)'; ctx.lineWidth = 2; ctx.stroke();
    edgeStroke(ctx, panelR, 26, 0.4);
    }
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kind];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 44, D.header.textDec.x - 96 - hx, GOLD, FONT, 700, 'left');
    ctx.strokeStyle = 'rgba(244,213,150,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panelR.x + 28, panelR.y + 82); ctx.lineTo(panelR.x + panelR.w - 28, panelR.y + 82); ctx.stroke();
    const secs = kind === 'rules' ? RULES : kind === 'how' ? HOWTO : kind === 'about' ? ABOUT : [{ title: '', items: settingsItems(state) }];
    const sc0 = Math.max(0, Math.min(state.doc.scroll || 0, docMetrics.max));
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 6, vp.y, vp.w + 12, vp.h); ctx.clip();
    const bodyW = D.bodyW, cxp = vp.x + vp.w / 2, left = cxp - bodyW / 2;
    const size = Math.round(27 * scale), lh = Math.round(size * 1.38), gap = Math.round(12 * scale);
    let y = vp.y - sc0 + 4;
    const vis = (y0, h) => y0 + h > vp.y - 40 && y0 < vp.y + vp.h + 40;
    secs.forEach((sec, si) => {
      if (sec.title) {
        const t0 = Math.round(34 * Math.min(scale, 2)), ty = y + t0 * 0.9;
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
          const spec = it.spec, C = spec.rows[0].length, cp = Math.min((spec.cell || 44) * (1 + (Math.min(scale, 2) - 1) * 0.35), (bodyW - 24) / (C + 0.36)), ds = diagramSize(spec, cp);
          if (vis(y, ds.h)) drawDiagram(ctx, spec, cxp - ds.w / 2, y, cp, wood, style);
          y += ds.h + gap + 6;
        } else if (it.k === 'btn') {
          const bh = Math.round(72 * Math.min(scale, 2.2)), rr = R(left, y, bodyW, bh);
          if (vis(y, bh)) button(rr, it.label, { size: Math.round(27 * Math.min(scale, 2.2)), primary: !it.disabled, dim: it.disabled });
          if (!it.disabled) ui.hits.push({ r: rr, id: it.id, v: 1, clip: vp });
          y += bh + gap;
        } else if (it.k === 'seg') {
          const ls = lines(it.label, Math.round(25 * Math.min(scale, 2.2)), bodyW, 600);
          const fs = Math.round(25 * Math.min(scale, 2.2)); if (vis(y, ls.length * fs * 1.3)) ls.forEach((ln, i) => text(ln, cxp, y + fs * 0.9 + i * fs * 1.3, fs, DIM, UI, 600, 'center'));
          y += ls.length * fs * 1.3 + 6;
          const n = it.opts.length, os = Math.round(25 * Math.min(scale, 2.2)), bh = Math.round(66 * Math.min(scale, 2.2));
          let per = n; ctx.font = `700 ${os}px ${UI}`;
          const fitsRow = (p) => it.opts.every((o) => ctx.measureText(o.l + (o.locked ? ' (locked)' : '')).width + 28 <= (bodyW - (p - 1) * 10) / p);
          while (per > 1 && !fitsRow(per)) per--;
          const bw = (bodyW - (per - 1) * 10) / per;
          it.opts.forEach((o, k) => {
            const rx = left + (k % per) * (bw + 10), ry = y + Math.floor(k / per) * (bh + 10), rr = R(rx, ry, bw, bh);
            if (vis(ry, bh)) button(rr, o.locked ? `${o.l} (locked)` : o.l, { size: os, on: o.v === it.cur && !o.locked, primary: o.v === it.cur && !o.locked, dim: o.locked });
            ui.hits.push({ r: rr, id: it.id, v: o.v, locked: o.locked, need: o.need, clip: vp });
          });
          y += Math.ceil(n / per) * (bh + 10) + gap;
        }
      }
    });
    ctx.restore();
    const contentH = y - (vp.y - sc0) + 10;
    if (contentH - vp.h > 8) {
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(36,19,9,${a0})`); gr.addColorStop(1, `rgba(36,19,9,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 22, vp.y, 0, 0.95);
    }
    docMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); docMetrics.view = vp.h;
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(244,213,150,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(244,213,150,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(docMetrics.max > 0 ? (sc0 >= docMetrics.max - 1 ? 'End' : 'Scroll, or tap Next') : '', D.cx, D.counterY, 21, 'rgba(244,213,150,0.65)', UI, 500);
    button(D.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(D.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    fitText(`${Math.round(scale * 100)}%`, D.header.textDec.x - 14, D.header.textDec.y + 42, 22, 70, DIM, UI, 600, 'right');
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); if (v3.on) v3.panels.push({ r, rad: 14, kind: 'toast' }); else { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(20,10,5,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(244,213,150,0.8)'; ctx.lineWidth = 2; ctx.stroke(); } wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}

// ---------------------------------------------------------------- effects
// A captured stone: a flash, then it tilts, rises and fades with a few chips of sand thrown off. f runs 0..1.
export function capFx(ctx, style, side, x, y, cell, f, flip, calm, k, king = false) {
  const dirn = k % 2 ? 1 : -1;
  if (f < 0.22) { const e = f / 0.22; drawPiece(ctx, side, style, x, y, cell, { king, scale: 1 + 0.1 * e, flash: 0.75 * e, lift: 0.1 * e }); return; }
  const g = (f - 0.22) / 0.78, e = ease(g);
  drawPiece(ctx, side, style, x, y - e * cell * 0.7, cell, { king, alpha: 1 - g, scale: 1.1 - 0.35 * e, tilt: calm ? 0 : dirn * e * 0.8, lift: 0.2 });
  if (calm) return;
  ctx.save();
  for (let j = 0; j < 6; j++) {
    const ang = k * 1.7 + j * 1.05, sp = cell * (0.5 + 0.45 * ((j * 5 + k) % 3) / 2);
    const px = x + Math.cos(ang) * sp * g, py = y - cell * 0.1 - Math.abs(Math.sin(ang)) * sp * 1.1 * g + g * g * cell * 0.9;
    ctx.globalAlpha = Math.max(0, 1 - g * 1.15); ctx.fillStyle = j % 2 ? '#f0d8a0' : '#a8845a';
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang + g * 6); const s = cell * (0.05 + 0.025 * (j % 3)); ctx.fillRect(-s, -s * 0.5, s * 2, s); ctx.restore();
  }
  ctx.restore();
}

function motes(ctx, L, t) {
  for (let k = 0; k < 14; k++) {
    const sp = 6 + (k % 4) * 3, x = (((k * 211.7 + t * sp) % (L.w + 80)) + L.w + 80) % (L.w + 80) - 40, y = (k * 137.3 + Math.sin(t * 0.25 + k) * 40 + L.h * 2) % L.h, r = 2 + (k % 5), a = 0.04 + 0.03 * Math.sin(t * 0.6 + k * 1.7);
    ctx.fillStyle = `rgba(255,214,150,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}
