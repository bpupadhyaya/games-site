// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, R, clamp } from './layout.js';
import { drawTable, drawBoard, drawPiece, drawDiagram, diagramSize, BOARDS, FIGURE } from './art.js';
import { RULES, HOWTO, ABOUT, LESSONS } from './content.js';
import { settingsItems } from './settings.js';
import { NAMES, pieceCount } from './rules.js';
import { LEVELS } from './ai.js';
import { drawCredit, drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';
import { BOARD_N } from './layout.js';
import { v3 } from './v3.js';

const FONT = '"Fredoka", "Trebuchet MS", system-ui, sans-serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GOLD = '#ffd985', CREAM = '#fff8ea', DIM = 'rgba(255,226,170,0.8)', CLAY = '#c8321f';
const TAU = Math.PI * 2, NC = BOARD_N;
const DARKUI = 'rgba(4,24,28,0.66)', DARKUI2 = 'rgba(4,24,28,0.94)';
export const ui = { hits: [], buttons: [] };
export const docMetrics = { max: 0, view: 0 };
export const readerStats = { fits: 0 };
const fitMemo = new Map(); let fitFontsKey = '';
const ease = (f) => f * f * (3 - 2 * f);

export function render(ctx, state, L) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== fitFontsKey || fitMemo.size > 3000) { fitMemo.clear(); fitFontsKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { readerStats.fits++; v = fn(); fitMemo.set(key, v); } return v; };
  ui.hits.length = 0; ui.buttons.length = 0; v3.heroRect = null;
  const scene = state.scene, scale = TEXT_SCALES[state.textScaleIdx] ?? 1, big = scale > 1, g = state.game, a = state.anim, B = L.board;
  const minU = Math.max(12, 11 / (host.px || 0.6));
  const kind = state.board, style = state.style;

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
  const panel = (r, rad = 18, fill = DARKUI, stroke = 'rgba(255,226,170,0.22)', brand = true, kind = 'panel') => {
    if (v3.on) { v3.panels.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad, kind, a: 1 }); return; }
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.38);
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim && !v3.on) ctx.globalAlpha = 0.5;
    const rad = Math.min(18, r.h / 3);
    if (v3.on) v3.buttons.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, label, primary: !!o.primary, on: !!o.on, dim: !!o.dim, a: 1 });
    else {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
      const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      if (o.primary) { gr.addColorStop(0, '#e8543a'); gr.addColorStop(1, '#9c2314'); } else if (o.on) { gr.addColorStop(0, '#8a6a22'); gr.addColorStop(1, '#4e3a10'); } else { gr.addColorStop(0, '#2f6a6a'); gr.addColorStop(1, '#154044'); }
      ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
      ctx.strokeStyle = o.primary ? 'rgba(255,214,150,0.85)' : 'rgba(255,226,170,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, Math.max(2, rad - 3)); ctx.stroke();
    }
    const size = o.size ?? 28, maxW = r.w - 20, col = o.primary || (v3.on && o.on) ? '#fff6e0' : o.dim && v3.on ? 'rgba(255,226,170,0.55)' : GOLD, cy = r.y + r.h / 2;
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

  // ---------------------------------------------------------------- scenes
  if (v3.on) ctx.clearRect(0, 0, L.w, L.h);
  else { drawTable(ctx, L); if (!state.calm) motes(ctx, L, state.t); }
  const SQ = (i) => (v3.on && v3.sq ? v3.sq(i) : L.sq(i));

  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();

  // screens fade in from the table's dark instead of cutting
  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(3,16,19,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function drawTitle() {
    const T = L.title(!!state.saved), Rr = T.rows;
    if (T.card) panel(T.card, 24, 'rgba(4,24,28,0.55)');
    hero(T.hero);
    if (scene === 'demo-limit') {
      const r = T.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!T.card) panel(r, 24, 'rgba(4,24,28,0.7)');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, GOLD, FONT, 700);
      wrapBox('Get Co Ganh on iPhone and Android for unlimited games, every level and every board.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      if (Rr.resume) button(Rr.resume, 'Continue your game', { primary: true, size: 30 });
      button(Rr.play, 'Play the computer', { primary: !Rr.resume, size: 32, sub: `${LEVELS[state.level].name} · as ${NAMES[state.humanSide]}` });
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
    const cx = r.x + r.w / 2;
    const ts = clamp(Math.min(r.w / 5.6, r.h / 4.2), 40, 122);
    const y0 = r.y + ts * 0.95;
    if (v3.on) goldTitle('Co Ganh', cx, y0, ts, r.w - 10);
    else {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
      const grad = ctx.createLinearGradient(0, y0 - ts * 0.8, 0, y0 + ts * 0.1); grad.addColorStop(0, '#fff6dc'); grad.addColorStop(1, '#ffb347');
      fitText('Co Ganh', cx, y0, ts, r.w - 10, grad, FONT, 700);
      ctx.restore();
    }
    const sub = Math.max(minU, ts * 0.26);
    const pw = Math.min(r.w * 0.7, ts * 5.6), py = y0 + ts * 0.3;
    if (v3.on) v3.panels.push({ r: { x: cx - pw / 2, y: py, w: pw, h: sub * 1.7 }, rad: sub * 0.85, kind: 'banner', a: 1 });
    else { ctx.save(); ctx.fillStyle = CLAY; ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, sub * 1.7, sub * 0.85); ctx.fill(); ctx.restore(); }
    ctx.font = `700 ${sub}px ${UI}`; ctx.fillStyle = CREAM; ctx.textAlign = 'center';
    ctx.fillText('V I E T N A M', cx, py + sub * 1.2);
    ctx.save(); if (v3.on) { ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; }
    fitText('Flank them. Flip them all.', cx, py + sub * 1.7 + ts * 0.36, ts * 0.3, r.w - 20, 'rgba(255,226,170,0.92)', FONT, 700);
    ctx.restore();
    // the animated demonstration: a flank and a trap, forever
    const top = py + sub * 1.7 + ts * 0.62, room = r.y + r.h - top;
    if (room > 90) { if (v3.on) v3.heroRect = R(r.x, top + 2, r.w, room - 8); else heroBoard(R(r.x, top + 6, r.w, room - 22)); }
  }
  // embossed gold lettering: a carved-in extrusion of dark bronze, a lit gold face and a thin top highlight
  function goldTitle(str, cx, y, size, maxW) {
    ctx.save(); ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = 'center';
    let s2 = size; while (s2 > 20 && ctx.measureText(str).width > maxW) { s2 -= 1; ctx.font = `700 ${s2}px ${FONT}`; }
    const depth = Math.max(3, s2 * 0.07);
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = s2 * 0.18; ctx.shadowOffsetY = depth + 6;
    ctx.fillStyle = '#3a1a05'; ctx.fillText(str, cx, y + depth);
    ctx.shadowColor = 'transparent';
    for (let d = depth; d >= 1; d -= 1) { ctx.fillStyle = d > depth * 0.5 ? '#5a2a08' : '#7a3c0c'; ctx.fillText(str, cx, y + d); }
    const grad = ctx.createLinearGradient(0, y - s2 * 0.78, 0, y + s2 * 0.08);
    grad.addColorStop(0, '#fff3c2'); grad.addColorStop(0.45, '#ffc94d'); grad.addColorStop(0.55, '#f0a21c'); grad.addColorStop(1, '#c9740f');
    ctx.fillStyle = grad; ctx.fillText(str, cx, y);
    ctx.lineWidth = Math.max(1.2, s2 * 0.018); ctx.strokeStyle = 'rgba(255,250,225,0.8)'; ctx.strokeText(str, cx, y - 1);
    ctx.restore();
  }

  function flipDraw(v0, v1, x, y, cell, f, extra = {}) {            // a piece turning over like a coin: f 0..1
    const sx = Math.abs(Math.cos(Math.PI * f));
    drawPiece(ctx, f < 0.5 ? v0 : v1, style, x, y, cell, { ...extra, sx: state.calm ? 1 : sx, lift: (extra.lift || 0) + (state.calm ? 0 : Math.sin(Math.PI * f) * 0.55), flash: f > 0.3 && f < 0.7 && !state.calm ? 0.35 : 0 });
  }

  function heroBoard(r) {
    const cols = 5, rows = 5, cell = clamp(Math.min((r.w - 24) / (cols + 0.4), (r.h - 14) / (rows + 0.45), 118), 30, 118);
    const bw = cols * cell, bh = rows * cell, x0 = r.x + (r.w - bw) / 2, y0 = r.y + (r.h - bh) / 2 + 4;
    const T = state.frozen ? 2.6 : state.calm ? 1.2 : state.t % 9;
    ctx.save();
    const m = cell * 0.12, pw = bw + 2 * m, ph = bh + 2 * m, px0 = x0 - m, py0 = y0 - m, pal = BOARDS[kind] || BOARDS.paper;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.roundRect(px0 + 4, py0 + 12, pw, ph + 6, 12); ctx.fill();
    const sg = ctx.createLinearGradient(0, py0 + ph - 8, 0, py0 + ph + 12); sg.addColorStop(0, pal.edge[0]); sg.addColorStop(1, pal.edge[1]);
    ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(px0, py0 + 8, pw, ph + 8, 12); ctx.fill();
    const gg = ctx.createLinearGradient(px0, py0, px0 + pw, py0 + ph); gg.addColorStop(0, pal.top[0]); gg.addColorStop(0.55, pal.top[1]); gg.addColorStop(1, pal.top[2]);
    ctx.fillStyle = gg; ctx.beginPath(); ctx.roundRect(px0, py0, pw, ph, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    const at = (r2, c) => ({ x: x0 + (c + 0.5) * cell, y: y0 + (r2 + 0.5) * cell });
    ctx.strokeStyle = pal.ink; ctx.lineWidth = Math.max(1.8, cell * 0.045); ctx.lineCap = 'round'; ctx.beginPath();
    for (const [ra, ca, rb, cb] of FIGURE) { const p = at(ra, ca), q = at(rb, cb); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); }
    ctx.stroke();
    ctx.fillStyle = pal.dot; for (let k = 0; k < 25; k++) { const p = at((k / 5) | 0, k % 5); ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.055, 0, TAU); ctx.fill(); }
    // Script (seconds). Beat 1: Red (3,2) steps to the centre and flanks Jade (2,1) and (2,3). Beat 2: the flipped Red piece at (2,1)
    // steps up to (1,1), which leaves the Jade corner piece (0,0) with no empty point beside it: it flips.
    const resetT = 7.6, op = T < 0.5 ? T / 0.5 : T > resetT ? Math.max(0, 1 - (T - resetT) / 0.7) : 1;
    ctx.globalAlpha = op;
    const t1 = 1.3, t1e = 1.8, fa = 1.95, fb = 2.12, t2 = 3.8, t2e = 4.3, fc = 4.45;
    const still = [[4, 0, 1], [4, 3, 1], [4, 4, 1], [0, 1, 1], [1, 0, 1], [0, 3, 2], [0, 4, 2], [1, 4, 2]];
    for (const [r2, c, s2] of still) { const p = at(r2, c); drawPiece(ctx, s2, style, p.x, p.y, cell); }
    const turn = (p, t0, v0, v1, extra) => { const f = (T - t0) / 0.5; if (f > 0 && f < 1) flipDraw(v0, v1, p.x, p.y, cell, f, extra); else drawPiece(ctx, f >= 1 ? v1 : v0, style, p.x, p.y, cell, extra); };
    { const p = at(0, 0); turn(p, fc, 2, 1); }
    { const p = at(2, 3); turn(p, fb, 2, 1); }
    { // (2,1): Jade, flips to Red, then walks to (1,1)
      const p = at(2, 1), q = at(1, 1);
      if (T < t2) turn(p, fa, 2, 1);
      else { const f = clamp((T - t2) / (t2e - t2), 0, 1), e = ease(f); drawPiece(ctx, 1, style, p.x + (q.x - p.x) * e, p.y + (q.y - p.y) * e, cell, { lift: Math.sin(Math.PI * f) * 0.5, glow: T < t2e ? 0.5 : 0 }); }
    }
    { // the first mover: (3,2) -> (2,2)
      const a0 = at(3, 2), b0 = at(2, 2); let pos = a0, lift = 0, glow = 0;
      if (T >= 0.6 && T < t1) { lift = clamp((T - 0.6) / 0.5, 0, 1) * 0.35; glow = 0.6; }
      if (T >= t1 && T <= t1e) { const f = ease((T - t1) / (t1e - t1)); pos = { x: a0.x + (b0.x - a0.x) * f, y: a0.y + (b0.y - a0.y) * f }; lift = Math.sin(Math.PI * f) * 0.5; } else if (T > t1e) pos = b0;
      drawPiece(ctx, 1, style, pos.x, pos.y, cell, { lift, glow });
    }
    ctx.restore();
  }

  // ================================================================ play / over / lesson
  function drawPlayScreen() {
    const isLesson = scene === 'lesson', over = scene === 'over';
    const cell = B.cell;
    if (L.land) { if (L.leftCard) panel(L.leftCard, 18); panel(L.rightCard, 18); }

    ctx.save();
    const flat = !v3.on;                                              // 3D draws the board, pieces and markers itself; the 2D layer keeps its badges
    if (flat) drawBoard(ctx, B, kind);
    const last = a ? null : g.last;
    if (flat && last && !isLesson && last.flips) { for (const q of [last.from, last.to]) { const p = SQ(q); ctx.fillStyle = 'rgba(255,214,110,0.26)'; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.43, 0, TAU); ctx.fill(); } }
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    if (flat && isLesson && LESSONS[state.lesson.i].target !== undefined && !state.lesson.done) { const p = SQ(LESSONS[state.lesson.i].target); ctx.strokeStyle = `rgba(214,64,31,${0.6 + 0.4 * pulse})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.38, 0, TAU); ctx.stroke(); }
    // selected piece: legal points
    if (state.sel >= 0 && !a && !over) {
      if (flat) { const sp = SQ(state.sel); ctx.fillStyle = `rgba(255,224,120,${0.28 + pulse * 0.14})`; ctx.beginPath(); ctx.arc(sp.x, sp.y, cell * 0.44, 0, TAU); ctx.fill(); }
      for (const m of state.selMoves) {
        const p = SQ(m.to);
        if (m.caps) {
          if (flat) { ctx.strokeStyle = `rgba(255,190,40,${0.75 + pulse * 0.25})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.36, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,190,40,0.22)'; ctx.fill(); }
          const s2 = Math.round(cell * 0.3), bx = p.x + cell * 0.3, by = p.y - cell * (flat ? 0.3 : 0.34);
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(bx + 1, by + 3, s2 * 0.58, 0, TAU); ctx.fill();
          const bg2 = ctx.createRadialGradient(bx - s2 * 0.15, by - s2 * 0.2, 1, bx, by, s2 * 0.6); bg2.addColorStop(0, '#ffe58a'); bg2.addColorStop(1, '#d48a08');
          ctx.fillStyle = bg2; ctx.beginPath(); ctx.arc(bx, by, s2 * 0.56, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
          text(String(m.caps), bx, by + s2 * 0.2, s2 * 0.72, '#20140a', UI, 800);
        } else if (flat) { ctx.fillStyle = `rgba(255,248,214,${0.7 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.13, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(20,40,40,0.65)'; ctx.lineWidth = 1.8; ctx.stroke(); }
      }
    }
    if (flat && state.hint && !a) for (const q of [state.hint.from, state.hint.to]) { const p = SQ(q); ctx.fillStyle = `rgba(90,230,150,${0.3 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.44, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(90,230,150,0.9)'; ctx.lineWidth = 3; ctx.stroke(); }
    // pieces, far rows first (a lower piece overlaps the one above it)
    const order = []; for (let rr = 0; rr < NC; rr++) for (let cc = 0; cc < NC; cc++) order.push((L.flip ? NC - 1 - rr : rr) * NC + (L.flip ? NC - 1 - cc : cc));
    const movingTo = a ? a.to : -1;
    const dragging = state.drag && state.sel >= 0;
    const forced = state.must && state.must.size && !a && !over && !state.autoMode && (state.two || g.turn === state.humanSide) && state.sel < 0 ? state.must : null;
    for (const i of order) {
      const v = g.board[i]; if (!v || (i === movingTo && a)) continue;
      if (!flat) { if (state.marks && !over && !a && state.danger && state.danger.has(i)) { const p3 = SQ(i); dangerMark(p3.x + cell * 0.3, p3.y - cell * 0.36, cell); } continue; }
      if (dragging && i === state.sel) continue;
      const p = SQ(i), sel = state.sel === i;
      // a flipped piece waits as its old colour, turns over in its turn, then stays
      const fk = a ? a.flips.indexOf(i) : -1;
      if (fk >= 0) {
        const f = (a.t - (a.flipAt + fk * a.gap)) / a.flipDur, old = 3 - a.side;
        if (f <= 0) drawPiece(ctx, old, style, p.x, p.y, cell);
        else if (f < 1) flipDraw(old, a.side, p.x, p.y, cell, f, { glow: 0.5 });
        else drawPiece(ctx, v, style, p.x, p.y, cell);
        continue;
      }
      let lift = sel ? 0.45 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.06) : 0;
      if (forced && forced.has(i)) {
        ctx.strokeStyle = `rgba(255,205,90,${0.55 + 0.4 * pulse})`; ctx.lineWidth = cell * 0.06; ctx.beginPath(); ctx.ellipse(p.x, p.y + cell * 0.12, cell * 0.5, cell * 0.36, 0, 0, TAU); ctx.stroke();
      }
      drawPiece(ctx, v, style, p.x, p.y, cell, { lift, glow: sel ? 0.8 : 0 });
      if (state.marks && !over && !a && state.danger && state.danger.has(i)) dangerMark(p.x + cell * 0.3, p.y - cell * 0.4, cell);
    }
    // the flips: a shock ring where each piece turns, and a floating count where the step landed
    if (a && a.flips.length && !state.calm) {
      for (let k = 0; flat && k < a.flips.length; k++) {
        const f = (a.t - (a.flipAt + k * a.gap)) / 0.5; if (f <= 0 || f >= 1) continue;
        const p = SQ(a.flips[k]);
        ctx.strokeStyle = a.kinds[k] === 'trap' ? `rgba(255,120,80,${0.8 * (1 - f)})` : `rgba(255,226,140,${0.85 * (1 - f)})`; ctx.lineWidth = cell * 0.08 * (1 - f) + 1;
        ctx.beginPath(); ctx.ellipse(p.x, p.y + cell * 0.18, cell * (0.3 + 0.55 * f), cell * (0.15 + 0.28 * f), 0, 0, TAU); ctx.stroke();
      }
      const tEnd = a.flipAt + (a.flips.length - 1) * a.gap, f = (a.t - tEnd) / 0.8;
      if (a.t >= a.flipAt && f < 1) {
        const p1 = SQ(a.to), e2 = ease(Math.min(1, Math.max(0, f + 0.2) * 1.4)), al = Math.min(1, (1 - Math.max(0, f)) * 2.2);
        const fs = Math.round(cell * 0.56);
        ctx.save(); ctx.globalAlpha = al;
        ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(4,24,28,0.92)'; ctx.lineJoin = 'round'; ctx.font = `800 ${fs}px ${UI}`; ctx.textAlign = 'center';
        const tx = p1.x, ty = p1.y - cell * (0.7 + 0.8 * e2);
        ctx.strokeText(`+${a.flips.length}`, tx, ty); ctx.fillStyle = '#ffd24a'; ctx.fillText(`+${a.flips.length}`, tx, ty); ctx.restore();
      }
    }
    // the moving piece: one step along its line
    if (flat && a) {
      const pts = a.path.map((q) => SQ(q)), f = clamp(a.t / a.hop, 0, 1), e = ease(f);
      const p0 = pts[0], p1 = pts[1], x = p0.x + (p1.x - p0.x) * e, y = p0.y + (p1.y - p0.y) * e;
      const landed = a.t >= a.glide, lift = landed ? Math.max(0, 0.2 * (1 - (a.t - a.glide) / 0.12)) : Math.sin(Math.PI * f) * 0.4 + 0.2 * (1 - f);
      drawPiece(ctx, a.val, style, landed ? p1.x : x, landed ? p1.y : y, cell, { lift, glow: 0.5 });
    }
    // a dragged piece follows the finger
    if (flat && dragging) drawPiece(ctx, g.board[state.sel] || g.turn, style, state.drag.x, state.drag.y - cell * 0.15, cell, { lift: 0.9, glow: 0.9 });
    if (flat && state.kb && !over) { const p = SQ(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.strokeRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6); }
    ctx.restore();

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
    // while a step plays, the counts move one piece at a time as each flipped piece turns over
    const n = a ? a.flips.length : 0, done = a ? a.flips.filter((_, k) => a.t >= a.flipAt + k * a.gap + 0.25).length : 0, pending = n - done;
    const mine = pieceCount(g, side) + (a && a.side !== side ? pending : 0) - (a && a.side === side ? pending : 0);
    return { left: mine, other: pieceCount(g, 3 - side) + (a && a.side === side ? pending : 0) - (a && a.side !== side ? pending : 0) };
  }
  function plate(r, side) {
    const human = !state.two && !state.autoMode && side === state.humanSide;
    const name = state.autoMode ? `${NAMES[side]} · computer` : state.two ? NAMES[side] : human ? 'You' : 'Computer';
    const sub = state.autoMode ? LEVELS[Math.max(2, state.level)].name : state.two || human ? NAMES[side] : `${LEVELS[state.level].name} · ${NAMES[side]}`;
    const turn = !g.winner && g.turn === side && scene !== 'over';
    panel(r, 16, turn ? 'rgba(8,52,56,0.82)' : DARKUI, turn ? 'rgba(255,226,170,0.85)' : 'rgba(255,226,170,0.2)', true, turn ? 'plateOn' : 'panel');
    const icon = (side2, x, y, size, o2 = {}) => { if (v3.on) v3.icons.push({ x, y, size: size * 0.84, side: side2, glow: o2.glow || 0, lift: o2.lift || 0 }); else drawPiece(ctx, side2, style, x, y, size, o2); };
    const info = plateInfo(side);
    const dots = '.'.repeat(1 + (Math.floor(state.t * 3) % 3));
    const thinking = state.autoMode ? (state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'The move' : 'Thinking' + dots) : state.two ? 'To move' : human ? 'Your move' : state.thinking || state.think > 0 ? 'Thinking' + dots : 'Moving';
    const goal = `${info.left} piece${info.left === 1 ? '' : 's'}`;
    const total = info.left + info.other;
    if (r.h < 112) {                                                  // compact: one line of text, the share bar under it
      const ic2 = clamp(r.h * 0.74, 36, 80), ix2 = r.x + 12 + ic2 * 0.55, iy2 = r.y + r.h * 0.5 + ic2 * 0.3;
      icon(side, ix2, iy2, ic2, { glow: turn ? 0.7 : 0 });
      const tx2 = r.x + 12 + ic2 * 1.1 + 12, ns2 = clamp(r.h * 0.27, 18, 30);
      const st = turn ? thinking : sub;
      fitText(`${name} · ${st}`, tx2, r.y + r.h * 0.42, ns2, r.x + r.w - 12 - tx2, turn ? CREAM : DIM, UI, 800, 'left');
      fitText(goal, tx2, r.y + r.h * 0.75, Math.round(ns2 * 0.78), r.x + r.w - 12 - tx2, DIM, UI, 600, 'left');
      return;
    }
    const ns = clamp(r.h * 0.22, 18, 46), ic = clamp(Math.min(r.h * 0.6, r.w * 0.22), 38, 132);
    const ix = r.x + 14 + ic * 0.55, iy = r.y + 12 + ic * 0.62;
    icon(side, ix, iy, ic, { glow: turn ? 0.7 : 0, lift: turn && !state.calm ? 0.12 + Math.sin(state.t * 3) * 0.05 : 0 });
    const tx = r.x + 14 + ic * 1.1 + 14, tw = r.x + r.w - 14 - tx;
    const y1 = r.y + 10 + ns * 0.85, y2 = y1 + ns * 0.84, y3 = y2 + ns * 0.8;
    fitText(name, tx, y1, ns, tw, CREAM, UI, 800, 'left');
    fitText(turn ? thinking : sub, tx, y2, Math.round(ns * 0.72), tw, turn ? GOLD : DIM, UI, 600, 'left');
    fitText(goal, tx, y3, Math.round(ns * 0.62), tw, DIM, UI, 600, 'left');
    // a share bar: how much of the board is this side's right now
    const by = y3 + 10, bh = Math.max(8, Math.min(16, r.y + r.h - 12 - by));
    if (by + bh < r.y + r.h - 4 && total > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(tx, by, tw, bh, bh / 2); ctx.fill();
      const pal = side === 1 ? ['#ff8a68', '#c42b18'] : ['#f4fff2', '#8fc1a9'], wv = Math.max(bh, tw * info.left / total);
      const gr = ctx.createLinearGradient(0, by, 0, by + bh); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(tx, by, info.left > 0 ? wv : 0, bh, bh / 2); ctx.fill();
    }
  }
  function plates() {
    const topSide = L.flip ? 1 : 2, botSide = L.flip ? 2 : 1;
    plate(L.plateTop, topSide); plate(L.plateBot, botSide);
    const M = L.msg, al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const mine = !g.winner && !state.autoMode && (state.two || g.turn === state.humanSide) && !a;
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the computer plays both sides.' : g.winner ? '' : mine ? (state.must && state.must.size ? 'You must step into the open point. Tap a ringed piece.' : 'Tap a piece, then a glowing point.') : '';
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      if (v3.on) v3.panels.push({ r: { x: M.x, y: M.y + 4, w: M.w, h: M.h - 8 }, rad: 14, kind: 'toast', a: clamp(al * 1.5, 0, 1) });
      else { ctx.beginPath(); ctx.roundRect(M.x, M.y + 4, M.w, M.h - 8, 14); ctx.fillStyle = DARKUI2; ctx.fill(); ctx.strokeStyle = 'rgba(255,226,170,0.75)'; ctx.lineWidth = 2; ctx.stroke(); }
      wrapBox(state.msg.text, R(M.x + 14, M.y + 8, M.w - 28, M.h - 16), big ? 30 : 25, 1.18, CREAM);
      ctx.restore();
    } else if (base) { if (v3.on && !L.land) v3.panels.push({ r: { x: M.x + 4, y: M.y + 6, w: M.w - 8, h: M.h - 12 }, rad: 14, kind: 'toast', a: 1 }); wrapBox(base, R(M.x + 8, M.y, M.w - 16, M.h), 24, 1.2, state.must && state.must.size && mine ? GOLD : CREAM); }
    if (L.land && L.rightHead) fitText('Co Ganh', L.rightHead.x + L.rightHead.w / 2, L.rightHead.y + 34, 30, L.rightHead.w, GOLD, FONT, 700);
    if (L.badge && L.badge.show && !(state.autoMode && L.land)) drawBadgeStack(ctx, L.badge.cx, L.badge.bottom, L.badge.w);
  }
  function lessonBox() {
    const l = LESSONS[state.lesson.i], r = L.lessonBox;
    panel(r, 16, 'rgba(4,24,28,0.74)', 'rgba(255,226,170,0.45)');
    const pad = 16;
    text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, r.x + pad, r.y + 30, Math.max(minU, 20), DIM, UI, 600, 'left');
    const duo = L.layoutKind === 'portrait-duo';
    fitText(l.title, r.x + pad, r.y + 30 + 40, 38, r.w - 2 * pad - (duo ? 220 : 0), GOLD, FONT, 700, 'left');
    const body = state.lesson.done ? l.done : state.msg ? state.msg.text : l.text;
    wrapBox(body, R(r.x + pad, r.y + 82, r.w - 2 * pad, r.h - 92), big ? 32 : 27, 1.25, state.lesson.done ? '#c9f7c0' : CREAM, 'left', minU, 'top');
    // progress: six pips and what to do, in the empty strip under the board (portrait)
    const pb = L.plateBot;
    if (duo) {                                                       // squat portrait: the pips sit in the lesson card's own header row
      const n = LESSONS.length, gx = 34, x1 = r.x + r.w - pad - 14, yy = r.y + 30;
      for (let k = 0; k < n; k++) {
        const done = k < state.lesson.i || (k === state.lesson.i && state.lesson.done);
        ctx.beginPath(); ctx.arc(x1 - (n - 1 - k) * gx, yy, k === state.lesson.i ? 12 : 9, 0, TAU);
        ctx.fillStyle = done ? '#4fd08a' : k === state.lesson.i ? GOLD : 'rgba(255,226,170,0.22)'; ctx.fill();
      }
    } else if (pb && !L.land) {
      panel(pb, 16, DARKUI, 'rgba(255,226,170,0.2)', true);
      const n = LESSONS.length, gapX = Math.min(70, (pb.w - 80) / n), x0 = pb.x + pb.w / 2 - (n - 1) * gapX / 2, yy = pb.y + pb.h * 0.36;
      for (let k = 0; k < n; k++) {
        const done = k < state.lesson.i || (k === state.lesson.i && state.lesson.done);
        ctx.beginPath(); ctx.arc(x0 + k * gapX, yy, k === state.lesson.i ? 15 : 11, 0, TAU);
        ctx.fillStyle = done ? '#4fd08a' : k === state.lesson.i ? GOLD : 'rgba(255,226,170,0.22)'; ctx.fill();
      }
      fitText(state.lesson.done ? 'Tap Next lesson to carry on.' : 'Tap your piece, then the point it steps to.', pb.x + pb.w / 2, pb.y + pb.h * 0.74, 26, pb.w - 40, DIM, UI, 600);
    }
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
    if (v3.on) v3.scrim = 0.62; else { ctx.fillStyle = 'rgba(2,12,14,0.7)'; ctx.fillRect(0, 0, L.w, L.h); }
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 26, 'rgba(6,34,38,0.94)', 'rgba(255,226,170,0.55)', true, 'doc');
    const res = state.result || { winner: g.winner, reason: g.reason }, w = res.winner;
    const title = w === 3 ? 'A draw' : state.autoMode ? `${NAMES[w]} wins` : state.two ? `${NAMES[w]} wins` : w === state.humanSide ? 'You win!' : 'The computer wins';
    const k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    if (v3.on) {
      const big = (sd, x, y, size, o2) => v3.icons.push({ x: cx + x * k, y: c.y + y * k, size: size * 0.84 * k, side: sd, glow: o2.glow || 0, lift: o2.lift || 0, spin: state.calm ? 0 : Math.sin(state.t * 1.2) * 0.5 });
      if (w !== 3) big(w, 0, 118, 148, { glow: 0.9, lift: 0.4 + Math.sin(state.t * 2.5) * 0.08 }); else { big(1, -62, 118, 112, {}); big(2, 62, 118, 112, {}); }
    } else if (w !== 3) drawPiece(ctx, w, style, 0, 118, 118, { glow: 0.9, lift: 0.4 + Math.sin(state.t * 2.5) * 0.08 });
    else { drawPiece(ctx, 1, style, -56, 118, 96, {}); drawPiece(ctx, 2, style, 56, 118, 96, {}); }
    fitText(title, 0, 238, 62, cw2 - 40, GOLD, FONT, 700);
    wrapBox(res.reason || '', R(-cw2 / 2 + 30, 252, cw2 - 60, 70), 26, 1.25, CREAM);
    fitText(`${Math.ceil(g.moves / 2)} moves · Red ${pieceCount(g, 1)} · Jade ${pieceCount(g, 2)}`, 0, 346, 22, cw2 - 40, DIM, UI, 500);
    if (!state.two && !state.autoMode && w === state.humanSide) { fitText(`★ ${LEVELS[state.level].name} beaten`, 0, 390, 24, cw2 - 40, '#ffd24a', UI, 700); confetti(c, 0); }
    ctx.restore();
    button(O.again, state.autoMode ? 'Watch another' : 'Play again', { primary: true, size: 32 }); button(O.back, 'Menu', { size: 28 });
    drawMoreLine(ctx, cx, O.back.y + O.back.h + 32, 22);
  }
  function confetti(c, cx) {
    if (state.calm) return;
    for (let k = 0; k < 22; k++) {
      const ph = (state.t * 0.32 + k * 0.0917) % 1, x = cx + Math.sin(k * 2.4 + state.t) * (60 + 170 * ph), y = 210 - ph * 190 + ph * ph * 120;
      ctx.fillStyle = k % 3 === 0 ? `rgba(255,214,110,${0.9 * (1 - ph)})` : k % 3 === 1 ? `rgba(240,120,90,${0.8 * (1 - ph)})` : `rgba(255,246,224,${0.8 * (1 - ph)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k + state.t * 2); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore();
    }
  }

  // ================================================================ documents (rules, how to play, about, settings)
  function drawDocument() {
    const D = L.doc, panelR = D.panel, vp = D.viewport, kindDoc = state.doc.kind;
    if (v3.on) { v3.scrim = 0.5; v3.panels.push({ r: { x: panelR.x, y: panelR.y, w: panelR.w, h: panelR.h }, rad: 26, kind: 'doc', a: 1 }); }
    else {
      ctx.fillStyle = 'rgba(2,12,14,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
      ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 26);
      const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(16,64,68,0.86)'); pg.addColorStop(1, 'rgba(6,30,34,0.94)');
      ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(255,226,170,0.32)'; ctx.lineWidth = 2; ctx.stroke();
      edgeStroke(ctx, panelR, 26, 0.4);
    }
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kindDoc];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 44, D.header.textDec.x - 96 - hx, GOLD, FONT, 700, 'left');
    ctx.strokeStyle = 'rgba(255,226,170,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panelR.x + 28, panelR.y + 82); ctx.lineTo(panelR.x + panelR.w - 28, panelR.y + 82); ctx.stroke();
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
          const spec = it.spec, C = spec.rows[0].length, cp = Math.min((spec.cell || 44) * (1 + (Math.min(scale, 2) - 1) * 0.35), (bodyW - 24) / (C + 0.36)), ds = diagramSize(spec, cp);
          if (vis(y, ds.h)) drawDiagram(ctx, spec, cxp - ds.w / 2, y, cp, kind, style);
          y += ds.h + gap + 6;
        } else if (it.k === 'act') {
          const bh = Math.round(72 * Math.min(scale, 2.2)), rr = R(left, y, bodyW, bh);
          if (vis(y, bh)) button(rr, it.busy ? 'Checking with the store...' : it.label, { size: Math.round(27 * Math.min(scale, 2.2)), primary: !it.disabled, dim: it.disabled });
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
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(10,44,48,${a0})`); gr.addColorStop(1, `rgba(10,44,48,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 22, vp.y, 0, 0.95);
    }
    docMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); docMetrics.view = vp.h;
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(255,226,170,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,226,170,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(docMetrics.max > 0 ? (sc0 >= docMetrics.max - 1 ? 'End' : 'Scroll, or tap Next') : '', D.cx, D.counterY, 21, 'rgba(255,226,170,0.65)', UI, 500);
    button(D.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(D.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    fitText(`${Math.round(scale * 100)}%`, D.header.textDec.x - 14, D.header.textDec.y + 42, 22, 70, DIM, UI, 600, 'right');
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); if (v3.on) v3.panels.push({ r, rad: 14, kind: 'toast', a: 1 }); else { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(4,24,28,0.96)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,226,170,0.8)'; ctx.lineWidth = 2; ctx.stroke(); } wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}

// ---------------------------------------------------------------- effects
function motes(ctx, L, t) {
  for (let k = 0; k < 14; k++) {
    const sp = 6 + (k % 4) * 3, x = (((k * 211.7 + t * sp) % (L.w + 80)) + L.w + 80) % (L.w + 80) - 40, y = (k * 137.3 + Math.sin(t * 0.25 + k) * 40 + L.h * 2) % L.h, r = 2 + (k % 5), a = 0.04 + 0.03 * Math.sin(t * 0.6 + k * 1.7);
    ctx.fillStyle = `rgba(255,214,150,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}
