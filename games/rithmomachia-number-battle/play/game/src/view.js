// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, inRect, R, clamp } from './layout.js';
import { drawTable, drawBoard, drawPiece, drawDiagram, diagramSize } from './art.js';
import { RULES, HOWTO, ABOUT, LESSONS } from './content.js';
import { settingsItems } from './settings.js';
import { NAMES, TAKE_TARGET, pieceCount, mk, ROUND, mathLine, KINDS, sideOf } from './rules.js';
import { LEVELS } from './ai.js';
import { drawCredit, drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GOLD = '#f0d27a', CREAM = '#fff4d8', DIM = 'rgba(240,210,122,0.78)', VERM = '#c2381f', LAPIS = '#233f86';
const TAU = Math.PI * 2;
export const ui = { hits: [], buttons: [] };
export const docMetrics = { max: 0, view: 0 };
export const readerStats = { fits: 0 };
const fitMemo = new Map(); let fitFontsKey = '';
const ease = (f) => f * f * (3 - 2 * f);
const SUBTITLE = 'The philosophers’ game of medieval Europe';

export function render(ctx, state, L) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== fitFontsKey || fitMemo.size > 3000) { fitMemo.clear(); fitFontsKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { readerStats.fits++; v = fn(); fitMemo.set(key, v); } return v; };
  ui.hits.length = 0; ui.buttons.length = 0;
  const scene = state.scene, scale = TEXT_SCALES[state.textScaleIdx] ?? 1, big = scale > 1, g = state.game, a = state.anim, B = L.board;
  const minU = Math.max(12, 11 / (host.px || 0.6));

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
  const panel = (r, rad = 18, fill = 'rgba(24,10,24,0.66)', stroke = 'rgba(240,210,122,0.26)', brand = true) => {
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.34);
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(16, r.h / 3);
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#d9482b'); gr.addColorStop(1, '#8e1f12'); } else if (o.on) { gr.addColorStop(0, '#7a5c1e'); gr.addColorStop(1, '#4a3510'); } else { gr.addColorStop(0, '#2f4d96'); gr.addColorStop(1, '#17285c'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,224,150,0.9)' : 'rgba(240,210,122,0.7)'; ctx.lineWidth = 2; ctx.stroke();
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

  // ---------------------------------------------------------------- scenes
  drawTable(ctx, L, state.t);
  if (!state.calm) motes(ctx, L, state.t);

  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();

  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(18,8,16,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function drawTitle() {
    const T = L.title(!!state.saved), Rr = T.rows;
    if (T.card) panel(T.card, 24, 'rgba(24,10,24,0.58)');
    hero(T.hero);
    if (scene === 'demo-limit') {
      const r = T.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!T.card) panel(r, 24, 'rgba(24,10,24,0.78)');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, GOLD, FONT, 700);
      wrapBox('Get Rithmomachia Number Battle on iPhone and Android for unlimited games, every computer level and all the lessons.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      if (Rr.resume) button(Rr.resume, 'Continue your game', { primary: true, size: 30 });
      button(Rr.play, 'Play the computer', { primary: !Rr.resume, size: 32, sub: `${LEVELS[state.level].name} · as ${NAMES[state.humanSide]}` });
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
    const ts = clamp(Math.min(r.w / 6.6, r.h / 4.4), 40, 112);
    const y0 = r.y + ts * 0.95;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    const grad = ctx.createLinearGradient(0, y0 - ts * 0.8, 0, y0 + ts * 0.1); grad.addColorStop(0, '#fff5c8'); grad.addColorStop(0.5, '#ecc65c'); grad.addColorStop(1, '#b98a28');
    fitText('Rithmomachia', cx, y0, ts, r.w - 10, grad, FONT, 700);
    ctx.restore();
    const sub = Math.max(minU, ts * 0.28);
    const pw = Math.min(r.w * 0.66, ts * 5.4), py = y0 + ts * 0.3;
    ctx.save();
    const pg = ctx.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0); pg.addColorStop(0, '#2d4f9e'); pg.addColorStop(0.5, '#233f86'); pg.addColorStop(1, '#122552');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, sub * 1.75, sub * 0.875); ctx.fill();
    ctx.strokeStyle = 'rgba(240,210,122,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    ctx.font = `700 ${sub}px ${UI}`; ctx.fillStyle = CREAM; ctx.textAlign = 'center';
    ctx.fillText('N U M B E R   B A T T L E', cx, py + sub * 1.22);
    fitText(SUBTITLE, cx, py + sub * 1.75 + ts * 0.36, ts * 0.3, r.w - 20, 'rgba(240,210,122,0.88)', FONT, 700);
    const top = py + sub * 1.75 + ts * 0.62, room = r.y + r.h - top;
    if (room > 90) heroBoard(R(r.x, top + 6, r.w, room - 22));
  }

  // The animated demonstration, forever: a 6 steps beside a 12 and takes it (1 : 2).
  function heroBoard(r) {
    const cols = 6, cw0 = clamp((r.w - 24) / (cols + 0.4), 30, 112), rows = clamp(Math.floor((r.h - 14) / cw0 - 0.5), 4, 6), cell = clamp(Math.min(cw0, (r.h - 14) / (rows + 0.5)), 30, 112);
    const bw = cols * cell, bh = rows * cell, x0 = r.x + (r.w - bw) / 2, y0 = r.y + (r.h - bh) / 2 + 4;
    const T = state.calm ? 3.2 : state.t % 9;
    const m = cell * 0.15;
    const at = (r2, c) => ({ x: x0 + (c + 0.5) * cell, y: y0 + (r2 + 0.5) * cell });
    drawDiagram(ctx, { cols, rows, pieces: [] }, x0 - m, y0 - m, cell);
    const glideStart = 1.5, glideEnd = 2.2, hitT = glideEnd, fxLen = 0.7, resetT = 6.6;
    const op = T < 0.5 ? T / 0.5 : T > resetT ? Math.max(0, 1 - (T - resetT) / 0.6) : 1;
    ctx.save(); ctx.globalAlpha = op;
    const code = (s, sh, v) => mk(s, sh, v);
    const bot = rows - 1;
    drawPiece(ctx, code(2, 2, 15), at(0, 0).x, at(0, 0).y, cell, { ang: Math.PI });
    drawPiece(ctx, code(2, 3, 96), at(0, 5).x, at(0, 5).y, cell, { ang: Math.PI });
    drawPiece(ctx, code(1, 3, 54), at(bot, 0).x, at(bot, 0).y, cell, { ang: 0 });
    drawPiece(ctx, code(1, 2, 21), at(bot, 5).x, at(bot, 5).y, cell, { ang: 0 });
    if (rows > 4) { drawPiece(ctx, code(2, 1, 9), at(1, 1).x, at(1, 1).y, cell); drawPiece(ctx, code(1, 1, 5), at(bot - 1, 5).x, at(bot - 1, 5).y, cell); }
    const p12 = at(bot - 2, 3);
    if (T < hitT) drawPiece(ctx, code(2, 1, 12), p12.x, p12.y, cell);
    else { const f = (T - hitT) / fxLen; if (f < 1) capFx(ctx, code(2, 1, 12), p12.x, p12.y, cell, f, 0, state.calm, 3); }
    const p0 = at(bot - 1, 3), p1 = at(bot, 3), f = clamp((T - glideStart) / (glideEnd - glideStart), 0, 1), e = ease(f);
    const x = p1.x + (p0.x - p1.x) * e, y = p1.y + (p0.y - p1.y) * e;
    drawPiece(ctx, code(1, 1, 6), x, y, cell, { lift: T < glideStart ? clamp((T - 0.9) / 0.5, 0, 1) * 0.4 : Math.sin(Math.PI * f) * 0.4, glow: T > 0.9 && T < glideStart ? 0.6 : 0 });
    if (T > hitT && T < hitT + 1.8) {
      const ff = (T - hitT) / 1.8, al = Math.min(1, ff * 6) * Math.min(1, (1 - ff) * 3);
      ctx.save(); ctx.globalAlpha = op * al; const fs = Math.round(cell * 0.4), ty = at(bot - 2, 3).y - cell * (0.5 + 0.4 * ff);
      ctx.lineWidth = fs * 0.16; ctx.strokeStyle = 'rgba(30,10,4,0.9)'; ctx.lineJoin = 'round'; ctx.font = `800 ${fs}px ${UI}`; ctx.textAlign = 'center';
      ctx.strokeText('6 : 12 = 1 : 2', at(bot - 2, 3).x, ty); ctx.fillStyle = '#ffd24a'; ctx.fillText('6 : 12 = 1 : 2', at(bot - 2, 3).x, ty); ctx.restore();
    }
    ctx.restore();
  }

  // ================================================================ play / over / lesson
  function drawPlayScreen() {
    const isLesson = scene === 'lesson', over = scene === 'over', cell = B.cell, ang = L.ang;
    if (L.rightCard) panel(L.rightCard, 18);

    ctx.save();
    if (a && a.caps.length && !state.calm && a.t > a.glide && a.t < a.glide + 0.35) { const f = (a.t - a.glide) / 0.35; ctx.translate(Math.sin(f * 46) * (1 - f) * cell * 0.04, Math.cos(f * 38) * (1 - f) * cell * 0.025); }
    drawBoard(ctx, B);
    const last = a ? null : g.last;
    if (last && !isLesson) { for (const q of [last.from, last.to]) { const p = L.sq(q); ctx.fillStyle = 'rgba(255,214,110,0.26)'; ctx.fillRect(p.x - cell / 2, p.y - cell / 2, cell, cell); } }
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    if (isLesson && LESSONS[state.lesson.i].target !== undefined && !state.lesson.done) { const p = L.sq(LESSONS[state.lesson.i].target); ctx.strokeStyle = `rgba(194,56,31,${0.6 + 0.4 * pulse})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.38, 0, TAU); ctx.stroke(); }
    // selected piece: legal squares
    if (state.sel >= 0 && !a && !over) {
      const sp = L.sq(state.sel); ctx.fillStyle = `rgba(255,224,120,${0.3 + pulse * 0.14})`; ctx.fillRect(sp.x - cell / 2, sp.y - cell / 2, cell, cell);
      for (const m of state.selMoves) {
        const p = L.sq(m.to);
        if (m.caps) {
          ctx.strokeStyle = `rgba(194,56,31,${0.75 + pulse * 0.25})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.38, 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(194,56,31,0.2)'; ctx.fill();
          const s = Math.round(cell * 0.3); ctx.fillStyle = '#c2381f'; ctx.beginPath(); ctx.arc(p.x + cell * 0.3, p.y - cell * 0.3, s * 0.56, 0, TAU); ctx.fill();
          text(String(m.caps), p.x + cell * 0.3, p.y - cell * 0.3 + s * 0.2, s * 0.72, '#fff', UI, 800);
        } else if (m.arr) {
          ctx.strokeStyle = `rgba(255,214,90,${0.8 + pulse * 0.2})`; ctx.lineWidth = cell * 0.08; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.38, 0, TAU); ctx.stroke();
          text('★', p.x, p.y + cell * 0.14, cell * 0.4, '#ffd24a', UI, 800);
        } else { ctx.fillStyle = `rgba(255,248,214,${0.6 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.14, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(70,40,10,0.55)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    }
    // the other side is one move from an arrangement: mark where
    if (state.threat && state.threat.length && !a && !over && !isLesson && state.marks) for (const t of state.threat) { const p = L.sq(t.to); ctx.strokeStyle = `rgba(150,96,250,${0.55 + pulse * 0.4})`; ctx.lineWidth = cell * 0.06; ctx.setLineDash([cell * 0.12, cell * 0.1]); ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.42, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    if (state.hint && !a) for (const q of [state.hint.from, state.hint.to]) { const p = L.sq(q); ctx.fillStyle = `rgba(90,230,150,${0.3 + pulse * 0.2})`; ctx.fillRect(p.x - cell / 2, p.y - cell / 2, cell, cell); ctx.strokeStyle = 'rgba(90,230,150,0.9)'; ctx.lineWidth = 3; ctx.strokeRect(p.x - cell / 2 + 2, p.y - cell / 2 + 2, cell - 4, cell - 4); }
    // an arrangement that won: a gold thread through its three pieces
    if (over && g.arr && g.winner && g.winner !== 3 && g.reason.includes('arrangement')) {
      const ps = g.arr.sq.map((q) => L.sq(q)); ctx.save(); ctx.strokeStyle = `rgba(255,214,90,${0.6 + pulse * 0.4})`; ctx.lineWidth = cell * 0.12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ps[0].x, ps[0].y); ctx.lineTo(ps[1].x, ps[1].y); ctx.lineTo(ps[2].x, ps[2].y); ctx.stroke(); ctx.restore();
    }
    // pieces: far (upper) rows first so a lifted piece sits above its neighbour
    const order = []; for (let i = 0; i < 128; i++) if (g.board[i]) order.push(i);
    const ys = new Map(order.map((i) => [i, L.sq(i).y])); order.sort((p, q) => ys.get(p) - ys.get(q));
    const movingTo = a ? a.to : -1, dragging = state.drag && state.sel >= 0;
    for (const i of order) {
      const k = g.board[i]; if (i === movingTo) continue;
      if (dragging && i === state.sel) continue;
      const p = L.sq(i), sel = state.sel === i;
      const lift = sel ? 0.45 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.06) : 0;
      drawPiece(ctx, k, p.x, p.y, cell, { lift, ang: ang(sideOf(k)), glow: sel ? 0.8 : 0 });
      if (state.marks && !over && !a && state.danger && state.danger.has(i)) dangerMark(p.x + cell * 0.3, p.y - cell * 0.4, cell);
    }
    // taken pieces stay until the mover lands, then flash and fly off, with their sums
    if (a) for (const [n, c] of a.caps.entries()) {
      const p = L.sq(c.sq);
      if (a.t < a.glide) drawPiece(ctx, c.code, p.x, p.y, cell, { ang: ang(sideOf(c.code)) });
      else { const f = (a.t - a.glide) / 0.6; if (f < 1) capFx(ctx, c.code, p.x, p.y, cell, f, ang(sideOf(c.code)), state.calm, n + c.sq); }
    }
    if (a && a.caps.length && a.t > a.glide && state.sums) {
      const f = (a.t - a.glide) / 1.4;
      if (f < 1) a.caps.forEach((c, n) => {
        const p = L.sq(c.sq), e2 = ease(Math.min(1, f * 1.5)), fs = Math.round(clamp(cell * 0.36, 14, 40));
        ctx.save(); ctx.globalAlpha = Math.min(1, (1 - f) * 2.4) * Math.min(1, (a.t - a.glide) * 8);
        ctx.lineWidth = fs * 0.16; ctx.strokeStyle = 'rgba(30,10,4,0.92)'; ctx.lineJoin = 'round'; ctx.font = `800 ${fs}px ${UI}`; ctx.textAlign = 'center';
        const lab = mathLine(c.info), tx = clamp(p.x, B.gx + fs * 3, B.gx + B.cols * cell - fs * 3 + (B.tall ? 0 : (B.cols - 8) * 0)), ty = p.y - cell * (0.55 + 0.45 * e2) - n * fs * 1.15;
        ctx.strokeText(lab, tx, ty); ctx.fillStyle = '#ffd24a'; ctx.fillText(lab, tx, ty); ctx.restore();
      });
    }
    // the moving piece
    if (a) {
      const p0 = L.sq(a.from), p1 = L.sq(a.to), f = clamp(a.t / a.glide, 0, 1), e = ease(f);
      const x = p0.x + (p1.x - p0.x) * e, y = p0.y + (p1.y - p0.y) * e, dist = Math.hypot(p1.x - p0.x, p1.y - p0.y) / cell;
      const lift = f < 1 ? Math.sin(Math.PI * f) * (0.5 + Math.min(0.7, dist * 0.2)) + 0.2 * (1 - f) : Math.max(0, 0.2 * (1 - (a.t - a.glide) / 0.12));
      drawPiece(ctx, g.board[a.to], x, y, cell, { lift, ang: ang(a.side), glow: 0.5 });
      if (a.t > a.glide && a.t < a.glide + 0.45 && !state.calm) { const ff = (a.t - a.glide) / 0.45; ctx.strokeStyle = `rgba(255,240,200,${0.75 * (1 - ff)})`; ctx.lineWidth = cell * 0.07 * (1 - ff) + 1; ctx.beginPath(); ctx.arc(p1.x, p1.y, cell * (0.4 + 0.5 * ff), 0, TAU); ctx.stroke(); }
    }
    if (dragging) drawPiece(ctx, g.board[state.sel] || mk(g.turn, ROUND, 1), state.drag.x, state.drag.y - cell * 0.15, cell, { lift: 0.9, ang: ang(g.turn), glow: 0.9 });
    if (state.kb && !over) { const p = L.sq(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.strokeRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6); }
    ctx.restore();

    if (isLesson) lessonBox(); else plates();
    buttonsFor();
    if (over) overlay();
  }

  function dangerMark(x, y, cell) {
    const r = cell * 0.17;
    ctx.fillStyle = '#c2381f'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(x - r * 0.12, y - r * 0.55, r * 0.24, r * 0.7); ctx.fillRect(x - r * 0.12, y + r * 0.28, r * 0.24, r * 0.24);
  }

  function plateInfo(side) {
    const opp = 3 - side, flying = a && a.t < a.glide + 0.3 ? a.caps.length : 0;
    return { got: g.lost[opp] - (a && a.side === side ? flying : 0), left: pieceCount(g, side) + (a && a.side !== side ? flying : 0) };
  }
  function plate(r, side) {
    const human = !state.two && !state.autoMode && side === state.humanSide;
    const name = state.autoMode ? `${NAMES[side]} · computer` : state.two ? NAMES[side] : human ? 'You' : 'Computer';
    const sub = state.autoMode ? LEVELS[Math.max(2, state.level)].name : state.two || human ? NAMES[side] : `${LEVELS[state.level].name} · ${NAMES[side]}`;
    const turn = !g.winner && g.turn === side && scene !== 'over';
    panel(r, 16, turn ? 'rgba(56,34,24,0.82)' : 'rgba(24,10,24,0.62)', turn ? 'rgba(240,210,122,0.9)' : 'rgba(240,210,122,0.2)', true);
    const info = plateInfo(side);
    const status = turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'The move' : 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))) : state.two ? 'To move' : human ? 'Your move' : state.thinking || state.think > 0 ? 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3)) : 'Moving') : sub;
    const icon = mk(side, 1, 0), goal = `Taken ${info.got} of ${TAKE_TARGET} · ${info.left} left`;
    const compact = r.h < 100;
    const ic = compact ? clamp(r.h * 0.72, 34, 72) : clamp(Math.min(r.h * 0.6, r.w * 0.2), 38, 110);
    const ix = r.x + 12 + ic * 0.55, iy = compact ? r.y + r.h * 0.5 + ic * 0.12 : r.y + 12 + ic * 0.6;
    drawPiece(ctx, icon, ix, iy, ic, { ang: L.ang(side), glow: turn ? 0.7 : 0, lift: turn && !state.calm ? 0.12 + Math.sin(state.t * 3) * 0.05 : 0 });
    const tx = r.x + 12 + ic * 1.1 + 12;
    if (compact) {
      const tw = r.x + r.w - 12 - tx, ns = clamp(r.h * 0.27, 17, 30);
      fitText(`${state.autoMode ? NAMES[side] : name} · ${status.replace(/ · (Ivory|Ink)$/, '')}`, tx, r.y + r.h * 0.42, ns, tw, turn ? CREAM : DIM, UI, 800, 'left');
      fitText(goal, tx, r.y + r.h * 0.76, Math.round(ns * 0.78), tw, DIM, UI, 600, 'left');
      return;
    }
    const tw = r.x + r.w - 14 - tx, ns = clamp(r.h * 0.22, 18, 44);
    const y1 = r.y + 10 + ns * 0.85, y2 = y1 + ns * 0.84, y3 = y2 + ns * 0.8;
    fitText(name, tx, y1, ns, tw, CREAM, UI, 800, 'left');
    fitText(status, tx, y2, Math.round(ns * 0.72), tw, turn ? GOLD : DIM, UI, 600, 'left');
    fitText(goal, tx, y3, Math.round(ns * 0.62), tw, DIM, UI, 600, 'left');
    // ten slots: what is still to take
    const cols = TAKE_TARGET, availH = r.y + r.h - (y3 + 8) - 4, tc = Math.min(clamp(availH, 0, 40), tw / (cols * 0.72 + 0.3));
    if (tc >= 14) {
      const at = (k) => ({ x: tx + tc * 0.4 + k * tc * 0.72, y: y3 + 10 + tc * 0.5 });
      for (let k = 0; k < cols; k++) {
        const p = at(k), filled = k < info.got;
        ctx.beginPath(); ctx.arc(p.x, p.y, tc * 0.3, 0, TAU);
        if (filled) { ctx.fillStyle = side === 1 ? '#2c2538' : '#f3e4bb'; ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.stroke(); }
        else { ctx.strokeStyle = 'rgba(240,210,122,0.25)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    }
  }
  function plates() {
    let pillOn = false;
    const topSide = L.flip ? 1 : 2, botSide = L.flip ? 2 : 1;
    plate(L.plateTop, topSide); plate(L.plateBot, botSide);
    // The kit's "Preview m:ss" pill: park it where nothing is drawn (beside the message, or in the card's title row) and keep the text clear of it.
    const side = L.mode === 'wide-side' || L.mode === 'tall-side';
    let M = L.msg;
    if (scene === 'play' && !state.autoMode && !g.winner) {
      const fs = Math.max(16, 11.5 / (host.px || 0.6)); ctx.save(); ctx.font = `600 ${fs}px system-ui, sans-serif`; const pw = ctx.measureText('Preview 0:00').width + fs * 1.3; ctx.restore();
      const ph = fs * 1.7;
      if (side && L.rightHead) { globalThis.__previewBadge = { x: L.rightHead.x + L.rightHead.w / 2, y: L.rightHead.y + (L.rightHead.h - ph) / 2, align: 'center' }; pillOn = true; }
      else { globalThis.__previewBadge = { x: M.x + M.w - 6, y: M.y + (M.h - ph) / 2, align: 'right' }; M = R(M.x, M.y, M.w - pw - 14, M.h); }
    } else globalThis.__previewBadge = null;
    const al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const threat = state.threat && state.threat.length && !g.winner && state.marks ? `${NAMES[3 - g.turn]} is one move from a ${KINDS[state.threat[0].arr.kind]} arrangement: block it.` : '';
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the computer plays both sides.' : g.winner ? '' : threat || (state.two || g.turn === state.humanSide ? 'Tap a piece, then a glowing square.' : '');
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      ctx.beginPath(); ctx.roundRect(M.x, M.y + 2, M.w, M.h - 4, 14); ctx.fillStyle = 'rgba(28,12,10,0.94)'; ctx.fill(); ctx.strokeStyle = 'rgba(240,210,122,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      wrapBox(state.msg.text, R(M.x + 14, M.y + 6, M.w - 28, M.h - 12), big ? 30 : 25, 1.18, CREAM);
      ctx.restore();
    } else if (base) { wrapBox(base, R(M.x + 8, M.y, M.w - 16, M.h), 24, 1.2, threat ? '#d9c2ff' : DIM); }
    if (L.rightHead && !pillOn) fitText(state.autoMode ? `Think time ${THINK_STEPS[state.autoThinkIdx]} s` : 'Rithmomachia', L.rightHead.x + L.rightHead.w / 2, L.rightHead.y + 30, 30, L.rightHead.w, GOLD, FONT, 700);
    if (L.badge && L.badge.show) drawBadgeStack(ctx, L.badge.cx, L.badge.bottom, L.badge.w);
  }
  function lessonBox() {
    const l = LESSONS[state.lesson.i], r = L.lessonBox, pad = 16, roomy = r.h > 200;
    panel(r, 16, 'rgba(24,10,24,0.8)', 'rgba(240,210,122,0.5)');
    const head = roomy ? 44 : 38, hy = r.y + (roomy ? 82 : 38);
    text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, r.x + r.w - pad, r.y + 26, Math.max(minU, 19), DIM, UI, 600, 'right');
    fitText(l.title, r.x + pad, hy, head, r.w - 2 * pad - (roomy ? 0 : 150), GOLD, FONT, 700, 'left');
    const body = state.lesson.done ? l.done : state.msg ? state.msg.text : l.text, top = hy + 12;
    wrapBox(body, R(r.x + pad, top, r.w - 2 * pad, r.y + r.h - top - 8), big ? 32 : 27, 1.22, state.lesson.done ? '#c9f7c0' : CREAM, 'left', minU, 'top');
  }
  function buttonsFor() {
    const BTN = L.BTN, sz = 26;
    if (scene === 'play') {
      if (state.autoMode) {
        button(BTN.auto.exit, 'Exit', { size: 24 }); button(BTN.auto.pause, state.autoPaused ? 'Resume' : 'Pause', { size: 24, primary: state.autoPaused });
        button(BTN.auto.dec, '- Think', { size: 22, dim: state.autoThinkIdx <= 0 }); button(BTN.auto.inc, 'Think +', { size: 22, dim: state.autoThinkIdx >= THINK_STEPS.length - 1 });
      } else {
        button(BTN.menu, 'Menu', { size: sz }); button(BTN.undo, 'Take back', { size: sz, dim: !state.undo.length }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: sz, dim: state.hintsLeft <= 0, primary: !!state.hint });
      }
    } else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: sz }); if (state.lesson.done) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
  }
  function overlay() {
    ctx.fillStyle = 'rgba(12,6,12,0.72)'; ctx.fillRect(0, 0, L.w, L.h);
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 26, 'rgba(26,12,24,0.94)', 'rgba(240,210,122,0.6)');
    const res = state.result || { winner: g.winner, reason: g.reason }, w = res.winner;
    const title = w === 3 ? 'A draw' : state.autoMode ? `${NAMES[w]} wins` : state.two ? `${NAMES[w]} wins` : w === state.humanSide ? 'You win!' : 'The computer wins';
    const k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    if (g.arr && w !== 3 && res.reason.includes('arrangement')) {
      g.arr.codes.forEach((pc, n) => drawPiece(ctx, pc, (n - 1) * 118, 112, 112, { glow: 0.8, lift: 0.3 + Math.sin(state.t * 2.5 + n) * 0.06, ang: 0 }));
    } else if (w !== 3) drawPiece(ctx, mk(w, ROUND, 0), 0, 112, 118, { glow: 0.9, lift: 0.4 + Math.sin(state.t * 2.5) * 0.08, ang: 0 });
    else { drawPiece(ctx, mk(1, ROUND, 0), -56, 112, 96, {}); drawPiece(ctx, mk(2, ROUND, 0), 56, 112, 96, {}); }
    fitText(title, 0, 238, 62, cw2 - 40, GOLD, FONT, 700);
    wrapBox(res.reason || '', R(-cw2 / 2 + 30, 252, cw2 - 60, 76), 25, 1.25, CREAM);
    fitText(`${Math.ceil(g.moves / 2)} moves · Ivory took ${g.lost[2]}, Ink took ${g.lost[1]}`, 0, 350, 22, cw2 - 40, DIM, UI, 500);
    if (!state.two && !state.autoMode && w === state.humanSide) { fitText(`★ ${LEVELS[state.level].name} beaten`, 0, 392, 24, cw2 - 40, '#ffd24a', UI, 700); confetti(c, 0); }
    ctx.restore();
    button(O.again, state.autoMode ? 'Watch another' : 'Play again', { primary: true, size: 32 }); button(O.back, 'Menu', { size: 28 });
    drawMoreLine(ctx, cx, O.back.y + O.back.h + 32, 22);
  }
  function confetti(c, cx) {
    if (state.calm) return;
    for (let k = 0; k < 22; k++) {
      const ph = (state.t * 0.32 + k * 0.0917) % 1, x = cx + Math.sin(k * 2.4 + state.t) * (60 + 170 * ph), y = 210 - ph * 190 + ph * ph * 120;
      ctx.fillStyle = k % 3 === 0 ? `rgba(255,214,110,${0.9 * (1 - ph)})` : k % 3 === 1 ? `rgba(120,150,255,${0.8 * (1 - ph)})` : `rgba(255,246,224,${0.8 * (1 - ph)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k + state.t * 2); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore();
    }
  }

  // ================================================================ documents (rules, how to play, about, settings)
  function drawDocument() {
    const D = L.doc, panelR = D.panel, vp = D.viewport, kind = state.doc.kind;
    ctx.fillStyle = 'rgba(12,6,12,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
    ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 26);
    const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(48,26,42,0.9)'); pg.addColorStop(1, 'rgba(22,10,22,0.94)');
    ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(240,210,122,0.4)'; ctx.lineWidth = 2; ctx.stroke();
    edgeStroke(ctx, panelR, 26, 0.4);
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kind];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 44, D.header.textDec.x - 90 - hx, GOLD, FONT, 700, 'left');
    ctx.strokeStyle = 'rgba(240,210,122,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panelR.x + 28, panelR.y + 82); ctx.lineTo(panelR.x + panelR.w - 28, panelR.y + 82); ctx.stroke();
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
          const spec = it.spec, cp = Math.min((spec.cell || 44) * (1 + (Math.min(scale, 2) - 1) * 0.35), (bodyW - 24) / (spec.cols + 0.3)), ds = diagramSize(spec, cp);
          if (vis(y, ds.h)) drawDiagram(ctx, spec, cxp - ds.w / 2, y, cp);
          y += ds.h + gap + 6;
        } else if (it.k === 'seg') {
          const fs = Math.round(25 * Math.min(scale, 2.2)), ls = lines(it.label, fs, bodyW, 600);
          if (vis(y, ls.length * fs * 1.3)) ls.forEach((ln, i) => text(ln, cxp, y + fs * 0.9 + i * fs * 1.3, fs, DIM, UI, 600, 'center'));
          y += ls.length * fs * 1.3 + 6;
          const n = it.opts.length, os = Math.round(25 * Math.min(scale, 2.2)), bh = Math.round(66 * Math.min(scale, 2.2));
          let per = n; ctx.font = `700 ${os}px ${UI}`;
          const fitsRow = (p) => it.opts.every((o) => ctx.measureText(o.l).width + 28 <= (bodyW - (p - 1) * 10) / p);
          while (per > 1 && !fitsRow(per)) per--;
          const bw = (bodyW - (per - 1) * 10) / per;
          it.opts.forEach((o, k) => {
            const rx = left + (k % per) * (bw + 10), ry = y + Math.floor(k / per) * (bh + 10), rr = R(rx, ry, bw, bh);
            if (vis(ry, bh)) button(rr, o.l, { size: os, on: o.v === it.cur, primary: o.v === it.cur });
            ui.hits.push({ r: rr, id: it.id, v: o.v, clip: vp });
          });
          y += Math.ceil(n / per) * (bh + 10) + gap;
        }
      }
    });
    ctx.restore();
    const contentH = y - (vp.y - sc0) + 10;
    if (contentH - vp.h > 8) {
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(34,16,32,${a0})`); gr.addColorStop(1, `rgba(34,16,32,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 22, vp.y, 0, 0.95);
    }
    docMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); docMetrics.view = vp.h;
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(240,210,122,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(240,210,122,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(docMetrics.max > 0 ? (sc0 >= docMetrics.max - 1 ? 'End' : 'Scroll, or tap Next') : '', D.cx, D.counterY, 21, 'rgba(240,210,122,0.65)', UI, 500);
    button(D.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(D.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    fitText(`${Math.round(scale * 100)}%`, D.header.textDec.x - 14, D.header.textDec.y + 42, 22, 70, DIM, UI, 600, 'right');
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(28,12,10,0.96)'; ctx.fill(); ctx.strokeStyle = 'rgba(240,210,122,0.8)'; ctx.lineWidth = 2; ctx.stroke(); wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}

// ---------------------------------------------------------------- effects
// A taken piece: a flash, then it tilts, rises and fades, with a few flakes of gold leaf thrown off. f runs 0..1.
export function capFx(ctx, code, x, y, cell, f, ang, calm, k) {
  const dirn = k % 2 ? 1 : -1;
  if (f < 0.22) { const e = f / 0.22; drawPiece(ctx, code, x, y, cell, { ang, scale: 1 + 0.1 * e, flash: 0.75 * e, lift: 0.1 * e }); return; }
  const g = (f - 0.22) / 0.78, e = ease(g);
  drawPiece(ctx, code, x, y - e * cell * 0.7, cell, { ang, alpha: 1 - g, scale: 1.1 - 0.35 * e, tilt: calm ? 0 : dirn * e * 0.8, lift: 0.2 });
  if (calm) return;
  ctx.save();
  for (let j = 0; j < 8; j++) {
    const an = k * 1.7 + j * 0.9, sp = cell * (0.5 + 0.45 * ((j * 5 + k) % 3) / 2);
    const px = x + Math.cos(an) * sp * g, py = y - cell * 0.1 - Math.abs(Math.sin(an)) * sp * 1.1 * g + g * g * cell * 0.9;
    ctx.globalAlpha = Math.max(0, 1 - g * 1.15); ctx.fillStyle = j % 2 ? '#f4d77a' : '#b98a28';
    ctx.save(); ctx.translate(px, py); ctx.rotate(an + g * 6); const s = cell * (0.04 + 0.025 * (j % 3)); ctx.fillRect(-s, -s * 0.5, s * 2, s); ctx.restore();
  }
  ctx.restore();
}

function motes(ctx, L, t) {
  for (let k = 0; k < 14; k++) {
    const sp = 6 + (k % 4) * 3, x = (((k * 211.7 + t * sp) % (L.w + 80)) + L.w + 80) % (L.w + 80) - 40, y = (k * 137.3 + Math.sin(t * 0.25 + k) * 40 + L.h * 2) % L.h, r = 2 + (k % 5), a = 0.04 + 0.03 * Math.sin(t * 0.6 + k * 1.7);
    ctx.fillStyle = `rgba(255,214,150,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}
