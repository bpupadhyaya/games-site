// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, inRect, R, clamp } from './layout.js';
import { drawTable, drawBoard, drawDisc, drawFlip, drawDiagram, diagramSize, CLOTHS } from './art.js';
import { RULES, HOWTO, ABOUT, LESSONS } from './content.js';
import { settingsItems } from './settings.js';
import { VARIANTS, NAMES, discs } from './rules.js';
import { LEVELS } from './ai.js';
import { drawCredit, drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';

const FONT = '"Cormorant Garamond", "Hiragino Mincho ProN", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GOLD = '#f2d08a', CREAM = '#fff6e0', DIM = 'rgba(242,208,138,0.78)', TEAL = '#17a98c';
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
  const cloth = state.cloth, style = state.style, N = state.game.n;

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
  const panel = (r, rad = 18, fill = 'rgba(5,16,20,0.62)', stroke = 'rgba(242,208,138,0.22)', brand = true) => {
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.38);
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(18, r.h / 3);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#27c6a0'); gr.addColorStop(1, '#0b6a55'); } else if (o.on) { gr.addColorStop(0, '#2f7f66'); gr.addColorStop(1, '#16463a'); } else { gr.addColorStop(0, '#2a4a5c'); gr.addColorStop(1, '#122632'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(190,255,230,0.75)' : 'rgba(242,208,138,0.55)'; ctx.lineWidth = 2; ctx.stroke();
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

  const humanToMove = () => !state.autoMode && !g.winner && (state.two || g.turn === state.humanSide);

  // ---------------------------------------------------------------- scenes
  drawTable(ctx, L, state.t);
  if (!state.calm) motes(ctx, L, state.t);

  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();

  // screens fade in from the table's dark instead of cutting
  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(5,16,20,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function drawTitle() {
    const T = L.title(!!state.saved), Rr = T.rows;
    if (T.card) panel(T.card, 24, 'rgba(5,16,20,0.55)');
    hero(T.hero);
    if (scene === 'demo-limit') {
      const r = T.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!T.card) panel(r, 24, 'rgba(5,16,20,0.7)');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, GOLD, FONT, 700);
      wrapBox('Get Reversi Flip Board on iPhone and Android for unlimited games, all three rule sets and every level.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
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
    const cx = r.x + r.w / 2;
    const ts = clamp(Math.min(r.w / 5.2, r.h / 4.4), 40, 128);
    const y0 = r.y + ts * 0.95;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    const grad = ctx.createLinearGradient(0, y0 - ts * 0.8, 0, y0 + ts * 0.1); grad.addColorStop(0, '#f6fff8'); grad.addColorStop(1, '#6fe0bf');
    fitText('Reversi', cx, y0, ts, r.w - 10, grad, FONT, 700);
    ctx.restore();
    const sub = Math.max(minU, ts * 0.28);
    ctx.save(); ctx.fillStyle = TEAL;
    const pw = Math.min(r.w * 0.6, ts * 4.2), py = y0 + ts * 0.3;
    ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, sub * 1.7, sub * 0.85); ctx.fill();
    ctx.restore();
    ctx.font = `700 ${sub}px ${UI}`; ctx.fillStyle = '#04201a'; ctx.textAlign = 'center';
    ctx.fillText('F L I P   B O A R D', cx, py + sub * 1.2);
    fitText('Trap them. Turn them. Take the board.', cx, py + sub * 1.7 + ts * 0.36, ts * 0.27, r.w - 20, 'rgba(242,208,138,0.9)', FONT, 700);
    const top = py + sub * 1.7 + ts * 0.62, room = r.y + r.h - top;
    if (room > 90) heroBoard(R(r.x, top + 6, r.w, room - 22));
  }

  // The title's animated demonstration, forever: a black disc lands and a line of white discs ripples over, then a second flip on the diagonal.
  function heroBoard(r) {
    const cols = 6, rows = 4, cell = clamp(Math.min((r.w - 24) / (cols + 0.5), (r.h - 14) / (rows + 0.5), 112), 30, 112);
    const bw = cols * cell, bh = rows * cell, x0 = r.x + (r.w - bw) / 2, y0 = r.y + (r.h - bh) / 2 + 2;
    const T = state.calm ? 3 : state.t % 8.4, pal = CLOTHS[cloth] || CLOTHS.emerald;
    const at = (r2, c) => ({ x: x0 + (c + 0.5) * cell, y: y0 + (r2 + 0.5) * cell });
    const m = cell * 0.2, pw = bw + 2 * m, ph = bh + 2 * m, px0 = x0 - m, py0 = y0 - m;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(px0 + 4, py0 + 12, pw, ph + 6, 14); ctx.fill();
    const fg = ctx.createLinearGradient(px0, py0, px0 + pw, py0 + ph); fg.addColorStop(0, pal.frame[0]); fg.addColorStop(1, pal.frame[2]);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(px0, py0, pw, ph, 14); ctx.fill();
    const g = ctx.createLinearGradient(x0, y0, x0 + bw, y0 + bh); g.addColorStop(0, pal.felt[0]); g.addColorStop(0.6, pal.felt[1]); g.addColorStop(1, pal.felt[2]);
    ctx.fillStyle = g; ctx.fillRect(x0, y0, bw, bh); ctx.strokeStyle = 'rgba(232,196,106,0.85)'; ctx.lineWidth = 2; ctx.strokeRect(x0 - 1, y0 - 1, bw + 2, bh + 2);
    ctx.strokeStyle = pal.line; ctx.lineWidth = Math.max(1.5, cell * 0.035); ctx.beginPath();
    for (let i = 0; i <= rows; i++) { ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + bw, y0 + i * cell); }
    for (let j = 0; j <= cols; j++) { ctx.moveTo(x0 + j * cell, y0); ctx.lineTo(x0 + j * cell, y0 + bh); }
    ctx.stroke();
    ctx.beginPath(); ctx.rect(x0 - 4, y0 - 4, bw + 8, bh + 8); ctx.clip();
    const op = T < 0.5 ? T / 0.5 : T > 7.6 ? Math.max(0, 1 - (T - 7.6) / 0.7) : 1;
    ctx.globalAlpha = op;
    // script: row 1: B at col 0, W at cols 1..3, black lands on col 4 at t=1.2 and the line turns 1.3, 1.45, 1.6. Then white lands on (3,1)?? no: black lands (3,3) at 4.2 turning the diagonal (2,2)->(1,1)? kept simple: diagonal W at (2,3),(1,2) with B at (0,1)... landing (3,4).
    const FT = 0.5, ease = (f) => f * f * (3 - 2 * f);
    const fixed = [[1, 0, 1], [0, 5, 2], [3, 0, 2]];
    for (const [r2, c, s] of fixed) { const p = at(r2, c); drawDisc(ctx, s, style, p.x, p.y, cell); }
    const line = [[1, 1], [1, 2], [1, 3]].map(([r2, c], k) => ({ r: r2, c, t0: 1.55 + k * 0.16 }));
    for (const it of line) { const p = at(it.r, it.c), f = clamp((T - it.t0) / FT, 0, 1); if (f <= 0) drawDisc(ctx, 2, style, p.x, p.y, cell); else if (f >= 1) drawDisc(ctx, 1, style, p.x, p.y, cell); else drawFlip(ctx, 2, 1, style, p.x, p.y, cell, ease(f)); }
    // the second move: black on the corner of a diagonal  (0,1)=B anchor, W at (1,2),(2,3), black lands (3,4)
    drawDisc(ctx, 1, style, at(0, 1).x, at(0, 1).y, cell);
    const diag = [[1, 2], [2, 3]];
    // (1,2) is part of the line above in row 1; use rows 2/3 for the diagonal instead
    const d2 = [[2, 2], [2, 3]].map(([r2, c], k) => ({ r: r2, c, t0: 4.55 + k * 0.16 }));
    const dropOf = (t0, land) => { const f = clamp((T - t0) / 0.32, 0, 1); return { f, show: T >= t0 }; };
    for (const it of d2) { const p = at(it.r, it.c), f = clamp((T - it.t0) / FT, 0, 1); if (f <= 0) drawDisc(ctx, 2, style, p.x, p.y, cell); else if (f >= 1) drawDisc(ctx, 1, style, p.x, p.y, cell); else drawFlip(ctx, 2, 1, style, p.x, p.y, cell, ease(f)); }
    for (const [t0, rr, cc] of [[1.2, 1, 4], [4.2, 2, 4]]) {
      const d = dropOf(t0), p = at(rr, cc);
      if (d.show) { const e = ease(d.f); drawDisc(ctx, 1, style, p.x, p.y, cell, { lift: (1 - e) * 1.6, alpha: 0.4 + 0.6 * e }); if (d.f >= 1 && T < t0 + 0.9 && !state.calm) { const q = (T - t0 - 0.32) / 0.58; ctx.strokeStyle = `rgba(255,240,190,${0.7 * (1 - q)})`; ctx.lineWidth = 4 * (1 - q) + 1; ctx.beginPath(); ctx.ellipse(p.x, p.y + cell * 0.12, cell * (0.35 + 0.7 * q), cell * (0.16 + 0.3 * q), 0, 0, TAU); ctx.stroke(); } }
    }
    ctx.restore();
  }

  // ================================================================ play / over / lesson
  function drawPlayScreen() {
    const isLesson = scene === 'lesson', over = scene === 'over';
    const cell = B.cell;
    if (L.land) { if (L.leftCard) panel(L.leftCard, 18); panel(L.rightCard, 18); }

    ctx.save();
    drawBoard(ctx, B, cloth, N);
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    const sqRect = (q, fill) => { const p = L.sq(q); ctx.fillStyle = fill; ctx.fillRect(p.x - cell / 2 + 1, p.y - cell / 2 + 1, cell - 2, cell - 2); return p; };
    // the lesson target
    if (isLesson && LESSONS[state.lesson.i].target !== undefined && !state.lesson.done) { const p = L.sq(LESSONS[state.lesson.i].target); ctx.strokeStyle = `rgba(255,224,122,${0.6 + 0.4 * pulse})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.38, 0, TAU); ctx.stroke(); }
    // the discs. A disc that is flipping is drawn turning; the one just placed drops in.
    const flipAt = new Map();
    if (a) a.flips.forEach((q, k) => flipAt.set(q, a.starts[k]));
    for (let rr = 0; rr < N; rr++) for (let cc = 0; cc < N; cc++) {
      const i = (L.flip ? N - 1 - rr : rr) * N + (L.flip ? N - 1 - cc : cc), k = g.board[i]; if (!k) continue;
      const p = L.sq(i);
      if (a && i === a.to) continue;
      const st = flipAt.get(i);
      if (st !== undefined) { const f = clamp((a.t - st) / a.flipDur, 0, 1), e = ease(f); if (f <= 0) drawDisc(ctx, 3 - a.side, style, p.x, p.y, cell); else if (f >= 1) drawDisc(ctx, a.side, style, p.x, p.y, cell, { glow: state.calm ? 0 : (1 - (a.t - st - a.flipDur) / 0.3 > 0 ? 1 - (a.t - st - a.flipDur) / 0.3 : 0) }); else drawFlip(ctx, 3 - a.side, a.side, style, p.x, p.y, cell, e, { height: state.calm ? 0.2 : 1 }); }
      else drawDisc(ctx, k, style, p.x, p.y, cell);
    }
    if (a) {
      const p = L.sq(a.to), f = clamp(a.t / a.place, 0, 1), e = ease(f);
      drawDisc(ctx, a.side, style, p.x, p.y, cell, { lift: (1 - e) * 2.2, alpha: 0.35 + 0.65 * e });
      if (f >= 1 && a.t < a.place + 0.5 && !state.calm) { const q = (a.t - a.place) / 0.5; ctx.strokeStyle = `rgba(255,240,190,${0.75 * (1 - q)})`; ctx.lineWidth = cell * 0.06 * (1 - q) + 1; ctx.beginPath(); ctx.ellipse(p.x, p.y + cell * 0.12, cell * (0.34 + 0.8 * q), cell * (0.16 + 0.34 * q), 0, 0, TAU); ctx.stroke(); }
    }
    // last move marker
    const last = a ? null : g.last;
    if (last && !isLesson && !over) { const p = L.sq(last.to); ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = 'rgba(40,16,4,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y - cell * 0.02, cell * 0.075, 0, TAU); ctx.fill(); ctx.stroke(); }
    // legal moves for whoever is to move and may act (the player, or the pupil watching Auto Play)
    if (!a && !over && state.legal && state.legal.length && state.hints !== 'off' && (humanToMove() || state.autoMode || isLesson)) {
      for (const m of state.legal) {
        const p = L.sq(m.to), chosen = state.hint && state.hint.to === m.to;
        if (chosen) { sqRect(m.to, `rgba(90,230,150,${0.28 + pulse * 0.2})`); ctx.strokeStyle = 'rgba(90,230,150,0.95)'; ctx.lineWidth = 3; ctx.strokeRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6); }
        const rad = cell * (chosen ? 0.2 : 0.13) * (1 + (state.calm ? 0 : pulse * 0.12));
        ctx.fillStyle = chosen ? 'rgba(210,255,225,0.95)' : `rgba(255,248,214,${0.5 + pulse * 0.18})`; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(8,40,24,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
        if (state.hints === 'counts' || chosen) { const fs = Math.max(11, Math.round(cell * 0.17)); text(String(m.n), p.x + cell * 0.3, p.y - cell * 0.27 + fs * 0.36, fs, 'rgba(255,248,214,0.9)', UI, 800); }
      }
      if (state.hint) { for (const q of state.hint.flips || []) { const p = L.sq(q); ctx.strokeStyle = `rgba(90,230,150,${0.5 + pulse * 0.4})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.4, 0, TAU); ctx.stroke(); } }
    }
    if (state.kb && !over) { const p = L.sq(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.strokeRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6); }
    ctx.restore();

    if (isLesson) lessonBox(); else plates();
    buttonsFor();
    if (over) overlay();
  }

  // Disc counts as shown while a move plays: discs that have not turned yet still count for their old owner.
  function shownCounts() {
    const c = discs(g);
    if (a) {
      if (a.t < a.place) { c[a.side] -= 1; }
      a.flips.forEach((q, k) => { if (a.t < a.starts[k] + a.flipDur * 0.5) { c[a.side] -= 1; c[3 - a.side] += 1; } });
    }
    return c;
  }
  function plate(r, side) {
    const human = !state.two && !state.autoMode && side === state.humanSide;
    const name = state.autoMode ? `${NAMES[side]} · computer` : state.two ? NAMES[side] : human ? 'You' : 'Computer';
    const sub = state.autoMode ? LEVELS[Math.max(2, state.level)].name : state.two || human ? NAMES[side] : `${LEVELS[state.level].name} · ${NAMES[side]}`;
    const turn = !g.winner && g.turn === side && scene !== 'over';
    panel(r, 16, turn ? 'rgba(18,52,46,0.8)' : 'rgba(5,16,20,0.62)', turn ? 'rgba(242,208,138,0.85)' : 'rgba(242,208,138,0.2)', true);
    const cnt = shownCounts(), mine = cnt[side], total = cnt[1] + cnt[2] || 1;
    const thinkDots = 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3));
    const status = turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'The move' : thinkDots) : state.two ? 'To move' : human ? 'Your move' : state.thinking || state.think > 0 ? thinkDots : 'Moving') : sub;
    const rev = VARIANTS[state.variant].reverse;
    const numStr = String(mine);
    if (r.h < 112) {
      const ic2 = clamp(r.h * 0.74, 36, 80), ix2 = r.x + 12 + ic2 * 0.55, iy2 = r.y + r.h * 0.5 + ic2 * 0.1;
      drawDisc(ctx, side, style, ix2, iy2, ic2, { glow: turn ? 0.7 : 0 });
      const tx2 = r.x + 12 + ic2 * 1.1 + 12, ns2 = clamp(r.h * 0.27, 18, 30), numW = clamp(r.h * 0.9, 56, 120);
      fitText(name, tx2, r.y + r.h * 0.44, ns2, r.x + r.w - 12 - tx2 - numW, CREAM, UI, 800, 'left');
      fitText(status, tx2, r.y + r.h * 0.76, Math.round(ns2 * 0.8), r.x + r.w - 12 - tx2 - numW, turn ? GOLD : DIM, UI, 600, 'left');
      fitText(numStr, r.x + r.w - 14, r.y + r.h * 0.68, clamp(r.h * 0.48, 30, 60), numW, turn ? GOLD : CREAM, UI, 800, 'right');
      return;
    }
    if (r.w < 300) {                                                   // a narrow side card: icon and count on one row, the words underneath
      const ic3 = clamp(r.h * 0.34, 38, 64), ix3 = r.x + 14 + ic3 * 0.55, iy3 = r.y + 12 + ic3 * 0.5;
      drawDisc(ctx, side, style, ix3, iy3, ic3, { glow: turn ? 0.7 : 0 });
      const nsz = clamp(r.h * 0.3, 34, 64);
      fitText(numStr, r.x + r.w - 16, r.y + 14 + nsz * 0.82, nsz, r.w - ic3 - 50, turn ? GOLD : CREAM, UI, 800, 'right');
      const top3 = r.y + 14 + Math.max(ic3, nsz) + 6, ns3 = clamp((r.y + r.h - 24 - top3) / 2.1, 13, 28), yy = top3;
      fitText(name, r.x + 16, yy + ns3 * 0.85, ns3, r.w - 32, CREAM, UI, 800, 'left');
      fitText(status, r.x + 16, yy + ns3 * 1.85, Math.round(ns3 * 0.82), r.w - 32, turn ? GOLD : DIM, UI, 600, 'left');
      const by3 = r.y + r.h - 20;
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(r.x + 16, by3, r.w - 32, 8, 4); ctx.fill();
      ctx.fillStyle = side === 1 ? '#12161c' : '#f6f2e6'; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(r.x + 16, by3, Math.max(8, (r.w - 32) * mine / total), 8, 4); ctx.fill(); ctx.stroke();
      return;
    }
    const ns = clamp(r.h * 0.22, 18, 46), ic = clamp(Math.min(r.h * 0.6, r.w * 0.22), 38, 132);
    const ix = r.x + 14 + ic * 0.55, iy = r.y + 12 + ic * 0.55;
    drawDisc(ctx, side, style, ix, iy, ic, { glow: turn ? 0.7 : 0, lift: turn && !state.calm ? 0.12 + Math.sin(state.t * 3) * 0.05 : 0 });
    const numW = clamp(r.w * 0.26, 58, 170), tx = r.x + 14 + ic * 1.1 + 14, tw = r.x + r.w - 14 - tx - numW;
    const y1 = r.y + 10 + ns * 0.85, y2 = y1 + ns * 0.84, y3 = y2 + ns * 0.8;
    fitText(name, tx, y1, ns, tw - 8, CREAM, UI, 800, 'left', 11);
    fitText(status, tx, y2, Math.round(ns * 0.72), tw - 8, turn ? GOLD : DIM, UI, 600, 'left');
    fitText(rev ? 'Fewest discs wins' : 'Most discs wins', tx, y3, Math.round(ns * 0.62), tw - 8, DIM, UI, 600, 'left');
    fitText(numStr, r.x + r.w - 16, r.y + 12 + clamp(r.h * 0.42, 40, 96) * 0.82, clamp(r.h * 0.42, 40, 96), numW, turn ? GOLD : CREAM, UI, 800, 'right');
    fitText('discs', r.x + r.w - 16, r.y + 12 + clamp(r.h * 0.42, 40, 96) * 0.82 + ns * 0.8, Math.round(ns * 0.6), numW, DIM, UI, 600, 'right');
    // a share bar: black and white discs on the board
    const by = r.y + r.h - 20, bx = r.x + 16, bw = r.w - 32;
    if (by > y3 + 10) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 8, 4); ctx.fill();
      const frac = mine / total; ctx.fillStyle = side === 1 ? '#12161c' : '#f6f2e6'; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(bx, by, Math.max(8, bw * frac), 8, 4); ctx.fill(); ctx.stroke();
    }
  }
  function plates() {
    const topSide = L.flip ? 1 : 2, botSide = L.flip ? 2 : 1;
    plate(L.plateTop, topSide); plate(L.plateBot, botSide);
    // message
    const M = L.msg, al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the computer plays both sides.' : g.winner ? '' : state.two || g.turn === state.humanSide ? 'Tap a marked square to place a disc.' : '';
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      ctx.beginPath(); ctx.roundRect(M.x, M.y + 4, M.w, M.h - 8, 14); ctx.fillStyle = 'rgba(6,22,26,0.94)'; ctx.fill(); ctx.strokeStyle = 'rgba(242,208,138,0.75)'; ctx.lineWidth = 2; ctx.stroke();
      wrapBox(state.msg.text, R(M.x + 14, M.y + 8, M.w - 28, M.h - 16), big ? 30 : 25, 1.18, CREAM);
      ctx.restore();
    } else if (base) { wrapBox(base, R(M.x + 8, M.y, M.w - 16, M.h), 24, 1.2, DIM); }
    if (L.land && L.rightHead) fitText(VARIANTS[state.variant].long, L.rightHead.x + L.rightHead.w / 2, L.rightHead.y + 34, 26, L.rightHead.w, GOLD, FONT, 700);
    if (L.badge && L.badge.show) drawBadgeStack(ctx, L.badge.cx, L.badge.bottom, L.badge.w);
  }
  function lessonBox() {
    const l = LESSONS[state.lesson.i], r = L.lessonBox;
    panel(r, 16, 'rgba(5,16,20,0.72)', 'rgba(242,208,138,0.45)');
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
    ctx.fillStyle = 'rgba(4,10,14,0.7)'; ctx.fillRect(0, 0, L.w, L.h);
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 26, 'rgba(8,24,30,0.94)', 'rgba(242,208,138,0.55)');
    const res = state.result || { winner: g.winner, reason: g.reason }, w = res.winner;
    const title = w === 3 ? 'A draw' : state.autoMode ? `${NAMES[w]} wins` : state.two ? `${NAMES[w]} wins` : w === state.humanSide ? 'You win!' : 'The computer wins';
    const k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    if (w !== 3) drawDisc(ctx, w, style, 0, 118, 118, { glow: 0.9, lift: 0.4 + Math.sin(state.t * 2.5) * 0.08 });
    else { drawDisc(ctx, 1, style, -56, 118, 96, {}); drawDisc(ctx, 2, style, 56, 118, 96, {}); }
    fitText(title, 0, 238, 62, cw2 - 40, GOLD, FONT, 700);
    wrapBox(res.reason || '', R(-cw2 / 2 + 30, 252, cw2 - 60, 70), 26, 1.25, CREAM);
    { const dc = discs(g); fitText(`${g.moves} moves · Black ${dc[1]}, White ${dc[2]}`, 0, 346, 22, cw2 - 40, DIM, UI, 500); }
    if (!state.two && !state.autoMode && w === state.humanSide) { fitText(`★ ${LEVELS[state.level].name} beaten at ${VARIANTS[state.variant].name}`, 0, 390, 24, cw2 - 40, '#ffd24a', UI, 700); confetti(c, 0); }
    ctx.restore();
    button(O.again, state.autoMode ? 'Watch another' : 'Play again', { primary: true, size: 32 }); button(O.back, 'Menu', { size: 28 });
    drawMoreLine(ctx, cx, O.back.y + O.back.h + 32, 22);
  }
  function confetti(c, cx) {
    if (state.calm) return;
    for (let k = 0; k < 22; k++) {
      const ph = (state.t * 0.32 + k * 0.0917) % 1, x = cx + Math.sin(k * 2.4 + state.t) * (60 + 170 * ph), y = 210 - ph * 190 + ph * ph * 120;
      ctx.fillStyle = k % 3 === 0 ? `rgba(255,214,110,${0.9 * (1 - ph)})` : k % 3 === 1 ? `rgba(110,230,190,${0.8 * (1 - ph)})` : `rgba(255,246,224,${0.8 * (1 - ph)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k + state.t * 2); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore();
    }
  }

  // ================================================================ documents (rules, how to play, about, settings)
  function drawDocument() {
    const D = L.doc, panelR = D.panel, vp = D.viewport, kind = state.doc.kind;
    ctx.fillStyle = 'rgba(4,10,14,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
    ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 26);
    const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(22,46,54,0.86)'); pg.addColorStop(1, 'rgba(7,19,25,0.92)');
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
          if (vis(y, ds.h)) drawDiagram(ctx, spec, cxp - ds.w / 2, y, cp, cloth, style);
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
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(14,32,38,${a0})`); gr.addColorStop(1, `rgba(14,32,38,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
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
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(6,22,26,0.96)'; ctx.fill(); ctx.strokeStyle = 'rgba(242,208,138,0.8)'; ctx.lineWidth = 2; ctx.stroke(); wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}

// ---------------------------------------------------------------- effects
function motes(ctx, L, t) {
  for (let k = 0; k < 14; k++) {
    const sp = 6 + (k % 4) * 3, x = (((k * 211.7 + t * sp) % (L.w + 80)) + L.w + 80) % (L.w + 80) - 40, y = (k * 137.3 + Math.sin(t * 0.25 + k) * 40 + L.h * 2) % L.h, r = 2 + (k % 5), a = 0.04 + 0.03 * Math.sin(t * 0.6 + k * 1.7);
    ctx.fillStyle = `rgba(160,255,225,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}
