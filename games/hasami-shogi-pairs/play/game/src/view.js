// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, inRect, R, clamp } from './layout.js';
import { setFaces, drawTable, drawBoard, drawPiece, drawDiagram, diagramSize, blob, WOODS } from './art.js';
import { RULES, HOWTO, ABOUT, LESSONS } from './content.js';
import { settingsItems } from './settings.js';
import { VARIANTS, NAMES, START, pieceCount } from './rules.js';
import { LEVELS } from './ai.js';
import { drawCredit, drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';

const FONT = '"Cormorant Garamond", "Hiragino Mincho ProN", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const JP = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", "Noto Serif JP", serif';
const GOLD = '#f2d08a', CREAM = '#fff6e0', DIM = 'rgba(242,208,138,0.78)', VERM = '#d6401f';
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
  const wood = state.wood, style = state.style; setFaces(state.faces);

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
  const panel = (r, rad = 18, fill = 'rgba(8,12,28,0.62)', stroke = 'rgba(242,208,138,0.22)', brand = true) => {
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.38);
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(18, r.h / 3);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#f0643c'); gr.addColorStop(1, '#a8240f'); } else if (o.on) { gr.addColorStop(0, '#6a5224'); gr.addColorStop(1, '#3d2d10'); } else { gr.addColorStop(0, '#34406a'); gr.addColorStop(1, '#1a2140'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,214,150,0.8)' : 'rgba(242,208,138,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, Math.max(2, rad - 3)); ctx.stroke();
    const size = o.size ?? 28, maxW = r.w - 20, col = o.primary ? '#fff6e0' : GOLD, cy = r.y + r.h / 2;
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
  if (!state.calm) motes(ctx, L, state.t);

  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();

  // screens fade in from the table's dark instead of cutting
  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(8,12,28,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function drawTitle() {
    const T = L.title(!!state.saved), Rr = T.rows;
    if (T.card) panel(T.card, 24, 'rgba(8,12,28,0.55)');
    hero(T.hero);
    if (scene === 'demo-limit') {
      const r = T.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!T.card) panel(r, 24, 'rgba(8,12,28,0.7)');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, GOLD, FONT, 700);
      wrapBox('Get Hasami Shogi: Pairs on iPhone and Android for unlimited games, all three rule sets and every level.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      if (Rr.resume) button(Rr.resume, 'Continue your game', { primary: true, size: 30 });
      button(Rr.play, 'Play the computer', { primary: !Rr.resume, size: 32, sub: `${VARIANTS[state.variant].name} · ${LEVELS[state.level].name} · as ${NAMES[state.humanSide]}` });
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
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    const grad = ctx.createLinearGradient(0, y0 - ts * 0.8, 0, y0 + ts * 0.1); grad.addColorStop(0, '#fff2cf'); grad.addColorStop(1, '#e9b658');
    fitText('Hasami Shogi', cx, y0, ts, r.w - 10, grad, FONT, 700);
    ctx.restore();
    const sub = Math.max(minU, ts * 0.3);
    ctx.save(); ctx.fillStyle = VERM;
    const pw = Math.min(r.w * 0.6, ts * 4.6), py = y0 + ts * 0.34;
    ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, sub * 1.7, sub * 0.85); ctx.fill();
    ctx.restore();
    ctx.font = `700 ${sub}px ${UI}`; ctx.fillStyle = CREAM; ctx.textAlign = 'center';
    const pairs = 'P A I R S'; ctx.fillText(pairs, cx, py + sub * 1.2);
    if (state.faces === 'jp') text('挟み将棋', cx, py + sub * 1.7 + ts * 0.42, ts * 0.34, 'rgba(242,208,138,0.85)', JP, 700);
    else fitText("Japan's sandwich chess", cx, py + sub * 1.7 + ts * 0.36, ts * 0.3, r.w - 20, 'rgba(242,208,138,0.88)', FONT, 700);
    // the animated demonstration: a sandwich, forever
    const top = py + sub * 1.7 + ts * 0.62, room = r.y + r.h - top;
    if (room > 90) heroBoard(R(r.x, top + 6, r.w, room - 22));
  }

  function heroBoard(r) {
    const cols = 7, rows = 5, cell = clamp(Math.min((r.w - 24) / (cols + 0.4), (r.h - 14) / (rows + 0.45), 118), 30, 118);
    const bw = cols * cell, bh = rows * cell, x0 = r.x + (r.w - bw) / 2, y0 = r.y + (r.h - bh) / 2 + 4;
    const T = state.calm ? 1.5 : state.t % 9;
    ctx.save();
    // a small board plate
    const m = cell * 0.2, pw = bw + 2 * m, ph = bh + 2 * m, px0 = x0 - m, py0 = y0 - m, pal = WOODS[wood] || WOODS.kaya;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.roundRect(px0 + 4, py0 + 12, pw, ph + 6, 14); ctx.fill();
    const sg = ctx.createLinearGradient(0, py0 + ph - 8, 0, py0 + ph + 12); sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
    ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(px0, py0 + 8, pw, ph + 8, 14); ctx.fill();
    const gg = ctx.createLinearGradient(px0, py0, px0 + pw, py0 + ph); gg.addColorStop(0, pal.top[0]); gg.addColorStop(0.55, pal.top[1]); gg.addColorStop(1, pal.top[2]);
    ctx.fillStyle = gg; ctx.beginPath(); ctx.roundRect(px0, py0, pw, ph, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(1.5, cell * 0.035); ctx.beginPath();
    for (let i = 0; i <= rows; i++) { ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + bw, y0 + i * cell); }
    for (let j = 0; j <= cols; j++) { ctx.moveTo(x0 + j * cell, y0); ctx.lineTo(x0 + j * cell, y0 + bh); }
    ctx.stroke();
    const at = (r2, c) => ({ x: x0 + (c + 0.5) * cell, y: y0 + (r2 + 0.5) * cell });
    // script: black jaw at (2,1); three white at (2,2..4); black mover from (4,5) up to (2,5); a second pair elsewhere for company
    const fixed = [[2, 1, 1], [0, 5, 2], [1, 0, 2]];
    const whites = [[2, 2], [2, 3], [2, 4]];
    const glideStart = 1.4, glideEnd = 2.1, hitT = glideEnd, fxLen = 0.6, resetT = 6.4;
    const op = T < 0.5 ? T / 0.5 : T > resetT ? Math.max(0, 1 - (T - resetT) / 0.6) : 1;
    ctx.globalAlpha = 1;
    const items = [];
    for (const [r2, c, s] of fixed) items.push({ r: r2, c, s, fx: null });
    for (const [r2, c] of whites) items.push({ r: r2, c, s: 2, cap: true });
    let mover = null;
    {
      const p0 = at(4, 5), p1 = at(2, 5);
      let f = clamp((T - glideStart) / (glideEnd - glideStart), 0, 1), e = ease(f);
      mover = { x: p0.x + (p1.x - p0.x) * e, y: p0.y + (p1.y - p0.y) * e, lift: T < glideStart ? clamp((T - 0.9) / 0.5, 0, 1) * 0.5 : T < glideEnd ? 0.5 * (1 - f) + Math.sin(Math.PI * f) * 0.3 : 0 };
    }
    items.sort((p, q) => p.r - q.r);
    const shake = !state.calm && T > hitT && T < hitT + 0.3 ? Math.sin((T - hitT) * 60) * (1 - (T - hitT) / 0.3) * cell * 0.03 : 0;
    ctx.translate(shake, 0);
    ctx.globalAlpha = op;
    let moverDrawn = false;
    const drawMover = () => { moverDrawn = true; drawPiece(ctx, 1, style, mover.x, mover.y, cell, { lift: mover.lift, glow: T > 0.9 && T < glideStart ? 0.6 : 0 }); };
    for (const it of items) {
      if (!moverDrawn && at(it.r, it.c).y > mover.y + cell * 0.02 && false) drawMover();
      const p = at(it.r, it.c);
      if (it.cap) { const f = (T - hitT) / fxLen; if (T < hitT) drawPiece(ctx, 2, style, p.x, p.y, cell); else if (f < 1) capFx(ctx, style, 2, p.x, p.y, cell, f, false, state.calm, it.c); }
      else drawPiece(ctx, it.s, style, p.x, p.y, cell);
    }
    drawMover();
    if (T > hitT && T < hitT + 0.5 && !state.calm) { const f = (T - hitT) / 0.5, p = at(2, 5); ctx.strokeStyle = `rgba(255,236,190,${0.8 * (1 - f)})`; ctx.lineWidth = 5 * (1 - f) + 1; ctx.beginPath(); ctx.ellipse(p.x, p.y + cell * 0.25, cell * (0.3 + 0.7 * f), cell * (0.15 + 0.3 * f), 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  // ================================================================ play / over / lesson
  function drawPlayScreen() {
    const isLesson = scene === 'lesson', over = scene === 'over';
    const pal = WOODS[wood] || WOODS.kaya, cell = B.cell;
    // side cards in landscape
    if (L.land) { if (L.leftCard) panel(L.leftCard, 18); panel(L.rightCard, 18); }

    // ---- the board scene (shaken a little on a capture)
    ctx.save();
    if (a && a.caps.length && !state.calm && a.t > a.glide && a.t < a.glide + 0.35) { const f = (a.t - a.glide) / 0.35; ctx.translate(Math.sin(f * 46) * (1 - f) * cell * 0.045, Math.cos(f * 38) * (1 - f) * cell * 0.03); }
    drawBoard(ctx, B, wood);
    // last move
    const last = a ? null : g.last;
    if (last && !isLesson) { for (const q of [last.from, last.to]) { const p = L.sq(q); ctx.fillStyle = 'rgba(255,214,110,0.22)'; ctx.fillRect(p.x - cell / 2, p.y - cell / 2, cell, cell); } }
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    // lesson target
    if (isLesson && LESSONS[state.lesson.i].target !== undefined && !state.lesson.done) { const p = L.sq(LESSONS[state.lesson.i].target); ctx.strokeStyle = `rgba(214,64,31,${0.6 + 0.4 * pulse})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.38, 0, TAU); ctx.stroke(); }
    // selected piece: legal squares
    if (state.sel >= 0 && !a && !over) {
      const sp = L.sq(state.sel); ctx.fillStyle = `rgba(255,224,120,${0.28 + pulse * 0.14})`; ctx.fillRect(sp.x - cell / 2, sp.y - cell / 2, cell, cell);
      for (const m of state.selMoves) {
        const p = L.sq(m.to);
        if (m.caps) {
          ctx.strokeStyle = `rgba(226,60,36,${0.7 + pulse * 0.3})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.36, 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(226,60,36,0.2)'; ctx.fill();
          const s = Math.round(cell * 0.3); ctx.fillStyle = '#e23c24'; ctx.beginPath(); ctx.arc(p.x + cell * 0.3, p.y - cell * 0.3, s * 0.56, 0, TAU); ctx.fill();
          text(String(m.caps), p.x + cell * 0.3, p.y - cell * 0.3 + s * 0.2, s * 0.72, '#fff', UI, 800);
        } else { ctx.fillStyle = `rgba(255,248,214,${0.55 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.13, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(70,40,10,0.45)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    }
    if (state.hint && !a) for (const q of [state.hint.from, state.hint.to]) { const p = L.sq(q); ctx.fillStyle = `rgba(90,230,150,${0.3 + pulse * 0.2})`; ctx.fillRect(p.x - cell / 2, p.y - cell / 2, cell, cell); ctx.strokeStyle = `rgba(90,230,150,${0.9})`; ctx.lineWidth = 3; ctx.strokeRect(p.x - cell / 2 + 2, p.y - cell / 2 + 2, cell - 4, cell - 4); }
    // pieces, far rows first (a lower piece overlaps the one above it)
    const order = []; for (let rr = 0; rr < 9; rr++) for (let cc = 0; cc < 9; cc++) order.push((L.flip ? 8 - rr : rr) * 9 + (L.flip ? 8 - cc : cc));
    const movingTo = a ? a.to : -1;
    const dragging = state.drag && state.sel >= 0;
    for (const i of order) {
      const k = g.board[i]; if (!k || i === movingTo) continue;
      if (dragging && i === state.sel) continue;
      const p = L.sq(i), sel = state.sel === i;
      let lift = sel ? 0.45 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.06) : 0;
      drawPiece(ctx, k, style, p.x, p.y, cell, { lift, flip: L.flip, glow: sel ? 0.8 : 0 });
      if (state.marks && !over && !a && state.danger && state.danger.has(i)) dangerMark(p.x + cell * 0.3, p.y - cell * 0.42, cell);
    }
    // the captured pieces: they stay until the mover lands, then flash and fly off
    if (a) for (const [n, q] of a.caps.entries()) {
      const p = L.sq(q); if (a.t < a.glide) drawPiece(ctx, 3 - a.side, style, p.x, p.y, cell, { flip: L.flip });
      else { const f = (a.t - a.glide) / 0.55; if (f < 1) capFx(ctx, style, 3 - a.side, p.x, p.y, cell, f, L.flip, state.calm, n + q); }
    }
    // a golden burst and a floating count where the sandwich closed
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
    // the moving piece
    if (a) {
      const p0 = L.sq(a.from), p1 = L.sq(a.to), f = clamp(a.t / a.glide, 0, 1), e = ease(f);
      const x = p0.x + (p1.x - p0.x) * e, y = p0.y + (p1.y - p0.y) * e, dist = Math.hypot(p1.x - p0.x, p1.y - p0.y) / cell;
      const lift = f < 1 ? Math.sin(Math.PI * f) * (a.jump ? 1.2 : 0.35 + Math.min(0.3, dist * 0.04)) + 0.2 * (1 - f) : Math.max(0, 0.2 * (1 - (a.t - a.glide) / 0.12));
      drawPiece(ctx, a.side, style, x, y, cell, { lift, flip: L.flip, glow: 0.5 });
      if (a.t > a.glide && a.t < a.glide + 0.45 && !state.calm) { const ff = (a.t - a.glide) / 0.45; ctx.strokeStyle = `rgba(255,240,200,${0.75 * (1 - ff)})`; ctx.lineWidth = cell * 0.07 * (1 - ff) + 1; ctx.beginPath(); ctx.ellipse(p1.x, p1.y + cell * 0.2, cell * (0.3 + 0.8 * ff), cell * (0.14 + 0.34 * ff), 0, 0, TAU); ctx.stroke(); }
    }
    // a dragged piece follows the finger
    if (dragging) drawPiece(ctx, g.board[state.sel] || g.turn, style, state.drag.x, state.drag.y - cell * 0.15, cell, { lift: 0.9, flip: L.flip, glow: 0.9 });
    if (state.kb && !over) { const p = L.sq(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.strokeRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6); }
    ctx.restore();

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
    panel(r, 16, turn ? 'rgba(40,34,18,0.78)' : 'rgba(8,12,28,0.62)', turn ? 'rgba(242,208,138,0.85)' : 'rgba(242,208,138,0.2)', true);
    const info = plateInfo(side), v = state.variant;
    if (r.h < 112) {                                                  // compact: one line of text, the captured pieces on the right
      const ic2 = clamp(r.h * 0.74, 36, 80), ix2 = r.x + 12 + ic2 * 0.55, iy2 = r.y + r.h * 0.5 + ic2 * 0.3;
      drawPiece(ctx, side, style, ix2, iy2, ic2, { flip: L.flip, glow: turn ? 0.7 : 0 });
      const tx2 = r.x + 12 + ic2 * 1.1 + 12, ns2 = clamp(r.h * 0.27, 18, 30), tcw = Math.min(r.w * 0.34, 260);
      const st = turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))) : state.two ? 'To move' : human ? 'Your move' : 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))) : sub;
      fitText(`${name} · ${st}`, tx2, r.y + r.h * 0.42, ns2, r.x + r.w - 12 - tx2 - tcw, turn ? CREAM : DIM, UI, 800, 'left');
      const goal2 = v === 'quick' ? `Captured ${info.got} of 5` : v === 'classic' ? `Captured ${info.got} of 8` : `Captured ${info.got}`;
      fitText(`${goal2} · ${info.left} left`, tx2, r.y + r.h * 0.75, Math.round(ns2 * 0.78), r.x + r.w - 12 - tx2 - tcw, DIM, UI, 600, 'left');
      const tc2 = clamp(r.h * 0.5, 24, 40), per2 = Math.max(1, Math.floor(tcw / (tc2 * 0.6)));
      for (let k = 0; k < Math.min(info.got, 18); k++) drawPiece(ctx, 3 - side, style, r.x + r.w - 14 - tcw + tc2 * 0.4 + (k % per2) * tc2 * 0.6, r.y + r.h * 0.5 + tc2 * 0.28 + Math.floor(k / per2) * tc2 * 0.3 - (info.got > per2 ? tc2 * 0.15 : 0), tc2, { flip: L.flip, alpha: 0.95 });
      return;
    }
    const ns = clamp(r.h * 0.22, 18, 46), ic = clamp(Math.min(r.h * 0.6, r.w * 0.22), 38, 132);
    const ix = r.x + 14 + ic * 0.55, iy = r.y + 12 + ic * 0.62;
    drawPiece(ctx, side, style, ix, iy, ic, { flip: L.flip, glow: turn ? 0.7 : 0, lift: turn && !state.calm ? 0.12 + Math.sin(state.t * 3) * 0.05 : 0 });
    const tx = r.x + 14 + ic * 1.1 + 14, tw = r.x + r.w - 14 - tx;
    const y1 = r.y + 10 + ns * 0.85, y2 = y1 + ns * 0.84, y3 = y2 + ns * 0.8;
    fitText(name, tx, y1, ns, tw, CREAM, UI, 800, 'left');
    const status = turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'The move' : 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))) : state.two ? 'To move' : human ? 'Your move' : state.thinking || state.think > 0 ? 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3)) : 'Moving') : sub;
    fitText(status, tx, y2, Math.round(ns * 0.72), tw, turn ? GOLD : DIM, UI, 600, 'left');
    const goal = v === 'quick' ? `Captured ${info.got} of 5` : v === 'classic' ? `Captured ${info.got} of 8` : `Captured ${info.got}`;
    fitText(`${goal} · ${info.left} left`, tx, y3, Math.round(ns * 0.62), tw, DIM, UI, 600, 'left');
    const slots = v === 'classic' ? 8 : v === 'quick' ? 5 : 0, cols = v === 'dai' ? 9 : slots, availH = r.y + r.h - (y3 + 8) - 4;
    const tc = Math.min(clamp(availH, 0, 56), tw / (0.62 * cols + 0.35));          // one row of slots must fit the plate's width
    if (tc >= 18) {
      const at = (k) => ({ x: tx + tc * 0.4 + (k % cols) * tc * 0.62, y: y3 + 8 + tc * 0.55 + Math.floor(k / cols) * tc * 0.42 });
      ctx.strokeStyle = 'rgba(242,208,138,0.2)'; ctx.lineWidth = 1.5;
      for (let k = info.got; k < slots; k++) { const p = at(k); ctx.beginPath(); ctx.ellipse(p.x, p.y + tc * 0.05, tc * 0.2, tc * 0.28, 0, 0, TAU); ctx.stroke(); }   // empty slots show what is still to win
      for (let k = 0; k < Math.min(info.got, 18); k++) { const p = at(k); drawPiece(ctx, 3 - side, style, p.x, p.y, tc * 0.9, { flip: L.flip, alpha: 0.95 }); }
    }
  }
  function plates() {
    const topSide = L.flip ? 1 : 2, botSide = L.flip ? 2 : 1;
    plate(L.plateTop, topSide); plate(L.plateBot, botSide);
    // message
    const M = L.msg, al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the computer plays both sides.' : g.winner ? '' : state.two || g.turn === state.humanSide ? 'Tap a piece, then a glowing square.' : '';
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      ctx.beginPath(); ctx.roundRect(M.x, M.y + 4, M.w, M.h - 8, 14); ctx.fillStyle = 'rgba(22,12,6,0.92)'; ctx.fill(); ctx.strokeStyle = 'rgba(242,208,138,0.75)'; ctx.lineWidth = 2; ctx.stroke();
      wrapBox(state.msg.text, R(M.x + 14, M.y + 8, M.w - 28, M.h - 16), big ? 30 : 25, 1.18, CREAM);
      ctx.restore();
    } else if (base) { wrapBox(base, R(M.x + 8, M.y, M.w - 16, M.h), 24, 1.2, DIM); }
    if (L.land && L.rightHead) fitText(VARIANTS[state.variant].long, L.rightHead.x + L.rightHead.w / 2, L.rightHead.y + 34, 26, L.rightHead.w, GOLD, FONT, 700);
    if (L.badge && L.badge.show) drawBadgeStack(ctx, L.badge.cx, L.badge.bottom, L.badge.w);
  }
  function lessonBox() {
    const l = LESSONS[state.lesson.i], r = L.lessonBox;
    panel(r, 16, 'rgba(8,12,28,0.72)', 'rgba(242,208,138,0.45)');
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
    ctx.fillStyle = 'rgba(6,8,18,0.7)'; ctx.fillRect(0, 0, L.w, L.h);
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 26, 'rgba(14,18,40,0.92)', 'rgba(242,208,138,0.55)');
    const res = state.result || { winner: g.winner, reason: g.reason }, w = res.winner;
    const title = w === 3 ? 'A draw' : state.autoMode ? `${NAMES[w]} wins` : state.two ? `${NAMES[w]} wins` : w === state.humanSide ? 'You win!' : 'The computer wins';
    const k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    if (w !== 3) drawPiece(ctx, w, style, 0, 118, 118, { flip: L.flip, glow: 0.9, lift: 0.4 + Math.sin(state.t * 2.5) * 0.08 });
    else { drawPiece(ctx, 1, style, -56, 118, 96, {}); drawPiece(ctx, 2, style, 56, 118, 96, { flip: true }); }
    fitText(title, 0, 238, 62, cw2 - 40, GOLD, FONT, 700);
    wrapBox(res.reason || '', R(-cw2 / 2 + 30, 252, cw2 - 60, 70), 26, 1.25, CREAM);
    fitText(`${Math.ceil(g.moves / 2)} moves · captured ${g.lost[2]} white, ${g.lost[1]} black`, 0, 346, 22, cw2 - 40, DIM, UI, 500);
    if (!state.two && !state.autoMode && w === state.humanSide) { fitText(`★ ${LEVELS[state.level].name} beaten at ${VARIANTS[state.variant].name}`, 0, 390, 24, cw2 - 40, '#ffd24a', UI, 700); confetti(c, 0); }
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
    ctx.fillStyle = 'rgba(6,8,18,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
    ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 26);
    const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(36,34,64,0.84)'); pg.addColorStop(1, 'rgba(12,14,30,0.9)');
    ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(242,208,138,0.32)'; ctx.lineWidth = 2; ctx.stroke();
    edgeStroke(ctx, panelR, 26, 0.4);
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kind];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 44, panelR.x + panelR.w - 2 * (D.header.textDec.w * 2 + 90) - hx, GOLD, FONT, 700, 'left');
    ctx.strokeStyle = 'rgba(242,208,138,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panelR.x + 28, panelR.y + 82); ctx.lineTo(panelR.x + panelR.w - 28, panelR.y + 82); ctx.stroke();
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
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(20,22,44,${a0})`); gr.addColorStop(1, `rgba(20,22,44,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 22, vp.y, 0, 0.95);
    }
    docMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); docMetrics.view = vp.h;
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(242,208,138,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(242,208,138,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(docMetrics.max > 0 ? (sc0 >= docMetrics.max - 1 ? 'End' : 'Scroll, or tap Next') : '', D.cx, D.counterY, 21, 'rgba(242,208,138,0.65)', UI, 500);
    button(D.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(D.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    fitText(`${Math.round(scale * 100)}%`, D.header.textDec.x - 14, D.header.textDec.y + 42, 22, 70, DIM, UI, 600, 'right');
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(22,12,6,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(242,208,138,0.8)'; ctx.lineWidth = 2; ctx.stroke(); wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}

// ---------------------------------------------------------------- effects
// A captured piece: a flash, then it tilts, rises and fades with a few wood chips thrown off. f runs 0..1.
export function capFx(ctx, style, side, x, y, cell, f, flip, calm, k) {
  const dirn = k % 2 ? 1 : -1;
  if (f < 0.22) { const e = f / 0.22; drawPiece(ctx, side, style, x, y, cell, { flip, scale: 1 + 0.1 * e, flash: 0.75 * e, lift: 0.1 * e }); return; }
  const g = (f - 0.22) / 0.78, e = ease(g);
  drawPiece(ctx, side, style, x, y - e * cell * 0.7, cell, { flip, alpha: 1 - g, scale: 1.1 - 0.35 * e, tilt: calm ? 0 : dirn * e * 0.8, lift: 0.2 });
  if (calm) return;
  ctx.save();
  for (let j = 0; j < 6; j++) {
    const ang = k * 1.7 + j * 1.05, sp = cell * (0.5 + 0.45 * ((j * 5 + k) % 3) / 2);
    const px = x + Math.cos(ang) * sp * g, py = y - cell * 0.1 - Math.abs(Math.sin(ang)) * sp * 1.1 * g + g * g * cell * 0.9;
    ctx.globalAlpha = Math.max(0, 1 - g * 1.15); ctx.fillStyle = j % 2 ? '#e9c27c' : '#8a5a2c';
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
