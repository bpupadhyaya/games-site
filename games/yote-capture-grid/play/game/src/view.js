// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, R, clamp } from './layout.js';
import { drawTable, drawBoard, drawPiece, drawDiagram, diagramSize, blob, BOARDS, sideName } from './art.js';
import { RULES, HOWTO, ABOUT, LESSONS } from './content.js';
import { settingsItems } from './settings.js';
import { START_PIECES, onBoard, SZ } from './rules.js';
import { LEVELS } from './ai.js';
import { TIMING } from './timing.js';
import { drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';
import { v3 } from './v3.js';

const FONT = '"Fredoka", "Trebuchet MS", system-ui, sans-serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SAFFRON = '#ffc24a', CREAM = '#fff6e0', DIM = 'rgba(206,220,255,0.78)', CLAY = '#c4552b', INK = '#0e1b38';
const TAU = Math.PI * 2;
const PANEL = 'rgba(8,16,40,0.66)', PANEL2 = 'rgba(8,16,40,0.94)', EDGE = 'rgba(160,190,255,0.24)';
export const ui = { hits: [], buttons: [] };
export const docMetrics = { max: 0, view: 0 };
export const readerStats = { fits: 0 };
const fitMemo = new Map(); let fitFontsKey = '';
const ease = (f) => f * f * (3 - 2 * f);
const T = TIMING;

export function render(ctx, state, L) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== fitFontsKey || fitMemo.size > 3000) { fitMemo.clear(); fitFontsKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { readerStats.fits++; v = fn(); fitMemo.set(key, v); } return v; };
  ui.hits.length = 0; ui.buttons.length = 0;
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
  const panel = (r, rad = 18, fill = PANEL, stroke = EDGE, brand = true, kind = 'plate') => {
    if (v3.on) { v3.panels.push({ r, rad, kind }); return; }              // the 3D layer draws the carved plaque
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.38);
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim && !v3.on) ctx.globalAlpha = 0.5;
    const rad = Math.min(r.h / 2, 30);                                           // pill buttons: round, flat, no inner shape
    if (v3.on) v3.buttons.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad, primary: !!o.primary, on: !!o.on, dim: !!o.dim });   // lacquered 3D button behind the label
    else {
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + 4, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#ffc95a'); gr.addColorStop(1, '#e5871f'); } else if (o.on) { gr.addColorStop(0, '#2fb0a4'); gr.addColorStop(1, '#176f6a'); } else { gr.addColorStop(0, '#34569f'); gr.addColorStop(1, '#1b3470'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,240,200,0.9)' : o.on ? 'rgba(190,255,240,0.7)' : 'rgba(170,196,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    }
    const size = o.size ?? 28, maxW = r.w - 24, col = o.primary ? INK : CREAM, cy = r.y + r.h / 2;
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
    if (o.sub && best.ls.length === 1) { text(label, r.x + r.w / 2, cy + best.s * 0.1 - 6, best.s, col, FONT, 600); fitText(o.sub, r.x + r.w / 2, cy + best.s * 0.1 + Math.max(minU, size * 0.62) + 2, Math.round(size * 0.62), maxW, o.primary ? 'rgba(14,27,56,0.8)' : DIM, UI, 500, 'center', minU); }
    else if (best.ls.length === 1) text(label, r.x + r.w / 2, cy + best.s * 0.35, best.s, col, FONT, 600);
    else best.ls.forEach((ln, i) => text(ln, r.x + r.w / 2, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s, col, FONT, 600));
    ctx.restore();
  };

  // ---------------------------------------------------------------- scenes
  v3.heroRect = null;
  if (v3.on) ctx.clearRect(0, 0, L.w, L.h);                               // the kit canvas is transparent over the 3D scene
  if (!v3.on) { drawTable(ctx, L); if (!state.calm) motes(ctx, L, state.t); }
  const SQ = (q) => (v3.on && v3.sq ? v3.sq(q) : L.sq(q));              // pit centre on screen (3D camera when the 3D layer is live)

  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();

  // screens fade in from the cloth's dark instead of cutting
  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(14,8,3,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function drawTitle() {
    const Tt = L.title(!!state.saved), Rr = Tt.rows;
    if (Tt.card) panel(Tt.card, 26, 'rgba(8,16,40,0.6)');
    hero(Tt.hero);
    if (scene === 'demo-limit') {
      const r = Tt.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!Tt.card) panel(r, 24, 'rgba(8,16,40,0.78)');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, SAFFRON, FONT, 600);
      wrapBox('Get Yote on iPhone and Android for unlimited games, every level and every board.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      if (Rr.resume) button(Rr.resume, 'Continue your game', { primary: true, size: 30 });
      button(Rr.play, 'Play the computer', { primary: !Rr.resume, size: 42, sub: `${LEVELS[state.level].name} · as ${sideName(style, state.humanSide)}` });
      button(Rr.two, 'Two players', { size: 26 }); button(Rr.learn, state.learned ? 'Learn' : 'Learn to play', { size: 26 });
      button(Rr.auto, 'Auto Play · Watch & Learn', { size: 26 });
      button(Rr.rules, 'Rules', { size: 26 }); button(Rr.how, 'How to Play', { size: 26 });
      button(Rr.about, 'About', { size: 26 }); button(Rr.settings, 'Settings', { size: 26 });
      if (state.msg) fitText(state.msg.text, L.w / 2, Rr.play.y - 14, 24, L.w - 40, SAFFRON, UI, 600);
    }
    const lk = Tt.lockup; state.lockupRect = drawLockup(ctx, lk.x, lk.y + 4, 50);
  }

  function hero(r) {
    const cx = r.x + r.w / 2;
    const ts = clamp(Math.min(r.w / 4.6, r.h / 4.0), 44, 140);
    const y0 = r.y + ts * 0.92;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5;
    const grad = ctx.createLinearGradient(0, y0 - ts * 0.8, 0, y0 + ts * 0.1); grad.addColorStop(0, '#fff3cf'); grad.addColorStop(1, '#ffb53e');
    if (v3.on) {                                                       // carved + gilded: a dark extrusion under a gold face with a lit top edge
      ctx.shadowColor = 'transparent';
      const depth = Math.max(4, ts * 0.075);
      for (let k = depth; k >= 1; k -= 1) fitText('Yote', cx + k * 0.35, y0 + k, ts, r.w - 10, k > depth * 0.6 ? '#2a1204' : '#5a2a0c', FONT, 700);
      fitText('Yote', cx, y0, ts, r.w - 10, grad, FONT, 700);
    } else fitText('Yote', cx, y0, ts, r.w - 10, grad, FONT, 700);
    ctx.restore();
    const sub = Math.max(minU, ts * 0.2);
    ctx.save(); ctx.fillStyle = CLAY;
    const pw = Math.min(r.w * 0.7, ts * 5.2), py = y0 + ts * 0.26;
    ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, sub * 1.8, sub * 0.9); ctx.fill();
    ctx.restore();
    ctx.font = `600 ${sub}px ${FONT}`; ctx.fillStyle = CREAM; ctx.textAlign = 'center';
    ctx.fillText('W E S T   A F R I C A', cx, py + sub * 1.28);
    if (v3.on) { const ty = py + sub * 1.8 + ts * 0.34, tw = Math.min(r.w - 20, ts * 6.6); ctx.save(); ctx.fillStyle = 'rgba(30,14,4,0.72)'; ctx.beginPath(); ctx.roundRect(cx - tw / 2, ty - ts * 0.3, tw, ts * 0.46, ts * 0.23); ctx.fill(); ctx.restore(); }
    fitText('Drop, jump, take a bonus pebble', cx, py + sub * 1.8 + ts * 0.34, ts * 0.26, r.w - 20, 'rgba(255,226,160,0.96)', FONT, 500);
    const top = py + sub * 1.8 + ts * 0.58, room = r.y + r.h - top;
    if (room > 90) { if (v3.on) v3.heroRect = R(r.x, top + 6, r.w, room - 22); else heroBoard(R(r.x, top + 6, r.w, room - 22)); }
  }

  // the animated demonstration, forever: a drop, then a jump that takes a bonus pebble from the far corner
  function heroBoard(r) {
    const cols = 6, rows = 4, cell = clamp(Math.min((r.w - 24) / (cols + 0.4), (r.h - 14) / (rows + 0.45), 118), 30, 118);
    const bw = cols * cell, bh = rows * cell, x0 = r.x + (r.w - bw) / 2 + cell * 0.18, y0 = r.y + (r.h - bh) / 2 + 4 + cell * 0.18;
    const Tm = state.frozen ? 3.5 : state.calm ? 1.2 : state.t % 7.2;
    drawDiagram(ctx, { rows: ['......', '......', '......', '......'] }, x0 - cell * 0.18, y0 - cell * 0.18, cell, kind, style);
    const at = (r2, c) => ({ x: x0 + (c + 0.5) * cell, y: y0 + (r2 + 0.5) * cell });
    const op = Tm < 0.5 ? Tm / 0.5 : Tm > 6.4 ? Math.max(0, 1 - (Tm - 6.4) / 0.6) : 1;
    ctx.save(); ctx.globalAlpha = op;
    for (const [r2, c, s] of [[3, 1, 1], [3, 4, 2], [0, 1, 1]]) { const p = at(r2, c); drawPiece(ctx, s, style, p.x, p.y, cell); }
    // an ivory pebble is dropped into the pit at (1, 4)
    { const p = at(1, 4), f = clamp((Tm - 0.9) / 0.45, 0, 1);
      if (Tm > 0.9) { const e = ease(f); drawPiece(ctx, 2, style, p.x, p.y - (1 - e) * cell * 1.5, cell, { alpha: Math.min(1, f * 3), squash: f >= 1 && Tm < 1.5 ? Math.sin((Tm - 1.35) / 0.15 * Math.PI) * 0.6 : 0 }); } }
    // the victim at (2, 2), the mover at (2, 1) jumps to (2, 3)
    const cap0 = 2.15, hop0 = 1.85, hop1 = 2.3, bon0 = 3.0, bon1 = 3.55;
    { const p = at(2, 2), f = (Tm - cap0) / 0.6;
      if (Tm < cap0) drawPiece(ctx, 2, style, p.x, p.y, cell); else if (f < 1) capFx(ctx, style, 2, p.x, p.y, cell, f, state.calm, 3); }
    { const p = at(0, 5), f = (Tm - bon1) / 0.6;
      if (Tm < bon0 - 0.15) drawPiece(ctx, 2, style, p.x, p.y, cell);
      else if (Tm < bon1) { const pu = 0.5 + 0.5 * Math.sin(Tm * 14); ctx.strokeStyle = `rgba(226,60,36,${0.6 + 0.4 * pu})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.44, 0, TAU); ctx.stroke(); drawPiece(ctx, 2, style, p.x, p.y, cell, { glow: 0.5 }); }
      else if (f < 1) capFx(ctx, style, 2, p.x, p.y, cell, f, state.calm, 5); }
    {
      const a0 = at(2, 1), a1 = at(2, 3); let pos = a0, lift = 0, glow = 0;
      if (Tm > 1.2 && Tm < hop0) glow = clamp((Tm - 1.2) / 0.4, 0, 1) * 0.6;
      if (Tm >= hop0 && Tm <= hop1) { const f = ease((Tm - hop0) / (hop1 - hop0)); pos = { x: a0.x + (a1.x - a0.x) * f, y: a0.y + (a1.y - a0.y) * f }; lift = Math.sin(Math.PI * f) * 0.7; glow = 0.5; }
      else if (Tm > hop1) pos = a1;
      drawPiece(ctx, 1, style, pos.x, pos.y, cell, { lift, glow });
      if (Tm > bon0 - 0.1 && Tm < bon1) {                                    // the line to the bonus pebble
        const q = at(0, 5), f = clamp((Tm - (bon0 - 0.1)) / 0.4, 0, 1);
        ctx.strokeStyle = `rgba(255,214,110,${0.8 * (1 - (Tm - bon0) / 0.6)})`; ctx.lineWidth = cell * 0.05; ctx.setLineDash([cell * 0.14, cell * 0.12]);
        ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(a1.x + (q.x - a1.x) * f, a1.y + (q.y - a1.y) * f); ctx.stroke(); ctx.setLineDash([]);
      }
      if (Tm > hop1 && Tm < hop1 + 0.45 && !state.calm) { const ff = (Tm - hop1) / 0.45; sandPuff(ctx, a1.x, a1.y, cell, ff, 1); }
      if (Tm > cap0 + 0.1 && Tm < bon1 + 0.9) {                               // "+2" floats up
        const f = clamp((Tm - (cap0 + 0.1)) / 1.6, 0, 1), fs = Math.round(cell * 0.5);
        ctx.save(); ctx.globalAlpha = Math.min(1, (1 - f) * 2); ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(20,10,4,0.9)'; ctx.lineJoin = 'round';
        const label = Tm >= bon1 ? '+2' : '+1', tx = a1.x, ty = a1.y - cell * (0.7 + 0.5 * f);
        ctx.strokeText(label, tx, ty); ctx.fillStyle = SAFFRON; ctx.fillText(label, tx, ty); ctx.restore();
      }
    }
    ctx.restore();
  }

  // ================================================================ play / over / lesson
  function drawPlayScreen() {
    const isLesson = scene === 'lesson', over = scene === 'over';
    const dp = v3.on ? () => {} : drawPiece, cfx = v3.on ? () => {} : capFx, puff = v3.on ? () => {} : sandPuff, blb = v3.on ? () => {} : blob;   // the 3D layer draws the board, pebbles and effects
    const cell = B.cell;
    if (L.land) { if (L.leftCard) panel(L.leftCard, 18); panel(L.rightCard, 18); }
    const tn = a ? a.t / a.k : 0;

    ctx.save();
    if (a && a.kind === 'jump' && !state.calm && !v3.on) {              // the board shivers a little as each pebble is taken
      for (const t0 of a.bonus >= 0 || a.bonusHand ? [T.capAt, T.bonusAt] : [T.capAt]) {
        const f = (tn - t0 - 0.05) / 0.35; if (f >= 0 && f < 1) ctx.translate(Math.sin(f * 46) * (1 - f) * cell * 0.04, Math.cos(f * 38) * (1 - f) * cell * 0.028);
      }
    }
    if (!v3.on) drawBoard(ctx, B, kind);
    const ring = (q, r1, col, wid) => { if (v3.on) return; const p = SQ(q); ctx.strokeStyle = col; ctx.lineWidth = wid; ctx.beginPath(); ctx.arc(p.x, p.y, cell * r1, 0, TAU); ctx.stroke(); };
    const wash = (q, col) => { if (v3.on) return; const p = SQ(q); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.45, 0, TAU); ctx.fill(); };
    const last = a ? null : g.last;
    if (last && !isLesson) { for (const q of [last.from, last.to]) if (q >= 0) wash(q, 'rgba(255,224,130,0.24)'); if (last.cap >= 0) ring(last.cap, 0.4, 'rgba(255,224,130,0.35)', 2); }
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    if (isLesson && LESSONS[state.lesson.i].target !== undefined && !state.lesson.done) ring(LESSONS[state.lesson.i].target, 0.4, `rgba(226,60,36,${0.6 + 0.4 * pulse})`, cell * 0.07);
    // selected pebble: where it can go
    const pend = state.pend;
    if (state.sel >= 0 && !a && !over && !pend) {
      wash(state.sel, `rgba(255,224,120,${0.28 + pulse * 0.14})`);
      for (const m of state.selMoves) {
        const p = SQ(m.to);
        if (m.jump) {
          ring(m.to, 0.37, `rgba(226,60,36,${0.7 + pulse * 0.3})`, cell * 0.07);
          if (!v3.on) { ctx.fillStyle = 'rgba(226,60,36,0.2)'; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.37, 0, TAU); ctx.fill(); }
          const s = Math.round(cell * 0.3); ctx.fillStyle = '#e23c24'; ctx.beginPath(); ctx.arc(p.x + cell * 0.3, p.y - cell * 0.3, s * 0.58, 0, TAU); ctx.fill();
          text('+1', p.x + cell * 0.3, p.y - cell * 0.3 + s * 0.2, s * 0.62, '#fff', UI, 800);
        } else if (!v3.on) { ctx.fillStyle = `rgba(255,248,214,${0.65 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.14, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(70,40,10,0.55)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    }
    // a jump waiting for its bonus: the landing is previewed and every enemy pebble that can be taken pulses
    if (pend && !a && !over) {
      wash(pend.move.from, 'rgba(255,224,120,0.2)'); ring(pend.move.to, 0.4, 'rgba(255,224,120,0.7)', 3);
      for (const q of pend.opts) if (q >= 0) { ring(q, 0.45 + 0.04 * pulse, `rgba(226,60,36,${0.65 + 0.35 * pulse})`, cell * 0.08); wash(q, `rgba(226,60,36,${0.12 + 0.12 * pulse})`); }
    }
    if (state.hint && !a) {
      const h = state.hint;
      for (const q of [h.from, h.to]) if (q >= 0) { wash(q, `rgba(90,230,150,${0.3 + pulse * 0.2})`); ring(q, 0.45, 'rgba(90,230,150,0.9)', 3); }
      if (h.bonus >= 0) { wash(h.bonus, `rgba(255,170,60,${0.28 + pulse * 0.2})`); ring(h.bonus, 0.47, 'rgba(255,170,60,0.95)', 3); }
    }
    // pebbles, far rows first
    const order = []; for (let i = 0; i < SZ; i++) order.push(i);
    order.sort((x, y) => SQ(x).y - SQ(y).y);
    const movingTo = a ? a.to : -1;
    const dragging = state.drag && state.sel >= 0 && !pend;
    for (const i of order) {
      const v = g.board[i]; if (!v || (i === movingTo && a)) continue;
      if (dragging && i === state.sel) continue;
      const p = SQ(i), sel = state.sel === i && !pend;
      const lift = sel ? 0.45 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.06) : 0;
      let alpha = 1;
      if (pend && i === pend.move.cap) alpha = 0.45;
      dp(ctx, v, style, p.x, p.y, cell, { lift, glow: sel ? 0.8 : 0, alpha });
      if (state.marks && !over && !a && !pend && state.danger && state.danger.has(i)) dangerMark(p.x + cell * 0.3, p.y - cell * 0.38, cell);
    }
    if (pend && !a) { const p = SQ(pend.move.to); dp(ctx, g.turn, style, p.x, p.y, cell, { alpha: 0.7, lift: 0.3 }); }
    // the pebbles taken during this move: they stay until the jump passes over them, then crack and fade
    if (a && a.kind === 'jump') {
      const opp = 3 - a.side;
      if (a.cap >= 0) { const p = SQ(a.cap); if (tn < T.capAt) dp(ctx, opp, style, p.x, p.y, cell); else { const f = (tn - T.capAt) / T.capLen; if (f < 1) cfx(ctx, style, opp, p.x, p.y, cell, f, state.calm, a.cap); } }
      if (a.bonus >= 0) {
        const p = SQ(a.bonus), t1 = T.bonusAt - 0.25;
        if (tn < T.bonusAt) {
          const hit = clamp((tn - t1) / 0.25, 0, 1);
          dp(ctx, opp, style, p.x, p.y, cell, { glow: hit * 0.7 });
          if (tn > T.hop && !state.calm && !v3.on) {                         // a beam from the landing pit to the pebble that was chosen
            const q = SQ(a.to), f = clamp((tn - T.hop) / (T.bonusAt - T.hop), 0, 1);
            ctx.strokeStyle = `rgba(255,214,110,${0.85 * (1 - f * 0.4)})`; ctx.lineWidth = cell * 0.05; ctx.setLineDash([cell * 0.14, cell * 0.12]);
            ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + (p.x - q.x) * ease(f), q.y + (p.y - q.y) * ease(f)); ctx.stroke(); ctx.setLineDash([]);
          }
          ring(a.bonus, 0.45, `rgba(226,60,36,${0.5 + 0.5 * hit})`, cell * 0.07);
        } else { const f = (tn - T.bonusAt) / T.bonusLen; if (f < 1) cfx(ctx, style, opp, p.x, p.y, cell, f, state.calm, a.bonus + 7); }
      }
      // a golden burst and a floating count where the jump landed
      if (!state.calm && tn > T.capAt) {
        const f = (tn - T.capAt) / 0.9;
        if (f < 1) {
          const p1 = SQ(a.to), e2 = ease(Math.min(1, f * 1.4));
          if (!v3.on) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const rg = ctx.createRadialGradient(p1.x, p1.y, 0, p1.x, p1.y, cell * (0.4 + 1.2 * f)); rg.addColorStop(0, `rgba(255,220,140,${0.5 * (1 - f)})`); rg.addColorStop(1, 'rgba(255,200,100,0)');
          ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p1.x, p1.y, cell * (0.4 + 1.2 * f), 0, TAU); ctx.fill(); ctx.restore(); }
          const n = 1 + (a.bonus >= 0 || a.bonusHand ? (tn > T.bonusAt ? 1 : 0) : 0), fs = Math.round(cell * 0.54);
          ctx.save(); ctx.globalAlpha = Math.min(1, (1 - f) * 2.2);
          ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(20,10,4,0.9)'; ctx.lineJoin = 'round'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center';
          const tx = p1.x, ty = p1.y - cell * (0.7 + 0.8 * e2);
          ctx.strokeText(`+${n}`, tx, ty); ctx.fillStyle = SAFFRON; ctx.fillText(`+${n}`, tx, ty); ctx.restore();
        }
      }
      // a bonus taken from the enemy's hand flies out of its tray
      if (a.bonusHand && tn >= T.bonusAt - 0.05) {
        const f = clamp((tn - (T.bonusAt - 0.05)) / T.bonusLen, 0, 1), plate = (L.flip ? (opp === 1 ? L.plateBot : L.plateTop) : (opp === 1 ? L.plateBot : L.plateTop)) || L.plateTop, q = SQ(a.to);
        const sx = plate.x + plate.w * 0.7, sy = plate.y + plate.h * 0.5, e = ease(f);
        dp(ctx, opp, style, sx + (q.x - sx) * e, sy + (q.y - sy) * e - Math.sin(f * Math.PI) * cell * 0.5, cell * 0.8, { alpha: 1 - f * f, scale: 1 - 0.3 * f });
      }
    }
    // the moving pebble
    if (a) {
      const p0 = a.from >= 0 ? SQ(a.from) : null, p1 = SQ(a.to);
      if (a.kind === 'drop') {
        const f = clamp(tn / T.dropLand, 0, 1), e = f * f, land = tn - T.dropLand;
        const y = p1.y - (1 - e) * cell * 1.7, squash = land > 0 && land < 0.16 ? Math.sin(land / 0.16 * Math.PI) * 0.7 : 0;
        if (f < 1) blb(ctx, p1.x, p1.y + cell * 0.12, cell * (0.2 + 0.3 * f), cell * (0.07 + 0.08 * f), 0.5 * f);
        dp(ctx, a.side, style, p1.x, y, cell, { alpha: Math.min(1, f * 4), squash, scale: 1.12 - 0.12 * f });
        if (land > 0 && land < 0.5 && !state.calm) puff(ctx, p1.x, p1.y, cell, land / 0.5, 0);
      } else if (a.kind === 'step') {
        const f = clamp(tn / T.step, 0, 1), e = ease(f);
        dp(ctx, a.side, style, p0.x + (p1.x - p0.x) * e, p0.y + (p1.y - p0.y) * e, cell, { lift: Math.sin(Math.PI * f) * 0.35, glow: 0.3 });
      } else {
        const f = clamp(tn / T.hop, 0, 1), e = ease(f), landed = tn >= T.hop;
        const lift = landed ? Math.max(0, 0.2 * (1 - (tn - T.hop) / 0.12)) : Math.sin(Math.PI * f) * 0.75;
        dp(ctx, a.side, style, p0.x + (p1.x - p0.x) * e, p0.y + (p1.y - p0.y) * e, cell, { lift, glow: 0.5 });
        if (landed && tn < T.hop + 0.45 && !state.calm) puff(ctx, p1.x, p1.y, cell, (tn - T.hop) / 0.45, 1);
      }
    }
    // a dragged pebble follows the finger
    if (dragging) dp(ctx, g.board[state.sel] || g.turn, style, state.drag.x, state.drag.y - cell * 0.15, cell, { lift: 0.9, glow: 0.9 });
    if (state.kb && !over && !v3.on) { const p = SQ(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.46, 0, TAU); ctx.stroke(); }
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

  // Counts shown on a plate, kept in step with the animation (a pebble in flight is still "in hand", a pebble being taken is still there).
  function plateInfo(side) {
    const tnn = a ? a.t / a.k : 0;
    let inHand = g.hand[side], onB = onBoard(g.board, side), taken = g.lost[3 - side];
    if (a) {
      if (a.kind === 'drop' && a.side === side && tnn < T.dropLand) { inHand += 1; onB -= 1; }
      if (a.kind === 'jump' && a.side !== side) {
        if (a.cap >= 0 && tnn < T.capAt + 0.1) onB += 1;
        if (a.bonus >= 0 && tnn < T.bonusAt + 0.1) onB += 1;
        if (a.bonusHand && tnn < T.bonusAt + 0.1) inHand += 1;
      }
      if (a.kind === 'jump' && a.side === side) {
        if (a.cap >= 0 && tnn < T.capAt + 0.1) taken -= 1;
        if (a.bonus >= 0 && tnn < T.bonusAt + 0.1) taken -= 1;
        if (a.bonusHand && tnn < T.bonusAt + 0.1) taken -= 1;
      }
    }
    return { inHand, onB, taken };
  }
  function plate(r, side) {
    const human = !state.two && !state.autoMode && side === state.humanSide;
    const nm = sideName(style, side);
    const name = state.autoMode ? `${nm} · computer` : state.two ? nm : human ? 'You' : 'Computer';
    const sub = state.autoMode ? LEVELS[Math.max(2, state.level)].name : state.two || human ? nm : `${LEVELS[state.level].name} · ${nm}`;
    const turn = !g.winner && g.turn === side && scene !== 'over';
    panel(r, 18, turn ? 'rgba(20,34,74,0.88)' : PANEL, turn ? 'rgba(255,194,74,0.9)' : EDGE, true, turn ? 'plateOn' : 'plate');
    const info = plateInfo(side);
    const dots = '.'.repeat(1 + (Math.floor(state.t * 3) % 3));
    const thinking = state.autoMode ? (state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'The move' : 'Thinking' + dots) : state.two ? 'To move' : human ? (state.pend ? 'Take a bonus' : 'Your move') : state.thinking || state.think > 0 ? 'Thinking' + dots : 'Moving';
    const stat = `In hand ${info.inHand} · On board ${info.onB} · Taken ${info.taken}`;
    const st = turn ? thinking : sub, hl = turn ? SAFFRON : DIM;
    const wideP = r.w >= 520 && r.h >= 100, tallP = r.w < 520 && r.h >= 150;
    if (wideP || tallP) {
      // pebble + name on the left (top), the hand of twelve slots on the right (wide) or underneath (tall)
      const ic = clamp(Math.min(r.h * (wideP ? 0.5 : 0.36), r.w * 0.2), 36, 92);
      const ix = r.x + 14 + ic * 0.55, iy = r.y + 12 + ic * 0.58;
      drawPiece(ctx, side, style, ix, iy, ic, { glow: turn ? 0.7 : 0, lift: turn && !state.calm ? 0.12 + Math.sin(state.t * 3) * 0.05 : 0 });
      const tx = r.x + 14 + ic * 1.05 + 12, ns = clamp(r.h * (wideP ? 0.19 : 0.13), 18, 38);
      const trayW = wideP ? Math.min(r.w * 0.47, 460) : r.w - 28, textR = wideP ? r.x + r.w - 14 - trayW - 12 : r.x + r.w - 14;
      const y1 = r.y + 12 + ns * 0.85, y2 = y1 + ns * 0.86;
      fitText(name, tx, y1, ns, textR - tx, CREAM, UI, 800, 'left');
      fitText(st, tx, y2, Math.round(ns * 0.74), textR - tx, hl, UI, 600, 'left');
      const ss = Math.round(clamp(ns * 0.62, 14, 24));
      if (wideP) {
        fitText(stat, r.x + 14, r.y + r.h - 16, ss, textR - r.x - 14, DIM, UI, 600, 'left');
        tray(r.x + r.w - 14 - trayW, r.y + 10, trayW, r.h - 20, side, info.inHand, START_PIECES);
      } else {
        const ty = r.y + 12 + ic + 10;
        fitText(stat, r.x + 14, ty + ss * 0.8, ss, r.w - 28, DIM, UI, 600, 'left');
        tray(r.x + 14, ty + ss + 8, r.w - 28, r.y + r.h - 10 - (ty + ss + 8), side, info.inHand, START_PIECES);
      }
      return;
    }
    // compact: two lines of text, the hand count in words
    const ic2 = clamp(r.h * 0.5, 34, 60), ix2 = r.x + 10 + ic2 * 0.5, iy2 = r.y + r.h * 0.5 + ic2 * 0.15;
    drawPiece(ctx, side, style, ix2, iy2, ic2 * 0.95, { glow: turn ? 0.7 : 0 });
    const tx2 = r.x + 10 + ic2 + 8, ns2 = clamp(r.h * 0.27, 18, 30);
    fitText(name, tx2, r.y + r.h * 0.3, ns2, r.x + r.w - 12 - tx2, turn ? CREAM : DIM, UI, 800, 'left');
    fitText(st, tx2, r.y + r.h * 0.56, Math.round(ns2 * 0.78), r.x + r.w - 12 - tx2, hl, UI, 600, 'left');
    fitText(`Hand ${info.inHand} · Board ${info.onB} · Taken ${info.taken}`, tx2, r.y + r.h * 0.83, Math.round(ns2 * 0.7), r.x + r.w - 12 - tx2, DIM, UI, 600, 'left', 9);
  }
  // twelve pit-like slots inside the rectangle (one row, or two when it is not wide enough); a slot still holding a pebble shows it
  function tray(x, y, w, h, side, inHand, n) {
    if (w < 40 || h < 18) return;
    const one = w / n >= h * 0.78, rowsN = one ? 1 : 2, per = Math.ceil(n / rowsN), pitch = Math.min(w / per, h / rowsN, 64);
    const x0 = x + (w - pitch * per) / 2 + pitch / 2, y0 = y + (h - pitch * rowsN) / 2 + pitch / 2;
    for (let k = 0; k < n; k++) {
      const rr = Math.floor(k / per), cc = k % per, px0 = x0 + cc * pitch, py0 = y0 + rr * pitch;
      ctx.fillStyle = v3.on ? 'rgba(2,6,20,0.5)' : 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(px0, py0, pitch * 0.42, 0, TAU); ctx.fill();
      ctx.strokeStyle = v3.on ? 'rgba(255,214,150,0.35)' : 'rgba(180,200,255,0.28)'; ctx.lineWidth = 1.5; ctx.stroke();
      if (k < inHand) drawPiece(ctx, side, style, px0, py0 + pitch * 0.1, pitch * 1.0, {});
    }
  }
  function plates() {
    const topSide = L.flip ? 1 : 2, botSide = L.flip ? 2 : 1;
    plate(L.plateTop, topSide); plate(L.plateBot, botSide);
    const M = L.msg, al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const mine = !g.winner && !state.autoMode && (state.two || g.turn === state.humanSide) && !a;
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the computer plays both sides.' : g.winner ? '' : mine ? (state.pend ? 'Tap an enemy pebble to take as your bonus.' : g.hand[g.turn] > 0 ? 'Tap an empty pit to drop, or a pebble to move.' : 'Tap a pebble, then a glowing pit.') : '';
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      if (v3.on) v3.panels.push({ r: { x: M.x, y: M.y + 4, w: M.w, h: M.h - 8 }, rad: 16, kind: 'toast' });
      else { ctx.beginPath(); ctx.roundRect(M.x, M.y + 4, M.w, M.h - 8, 16); ctx.fillStyle = PANEL2; ctx.fill(); ctx.strokeStyle = 'rgba(255,194,74,0.75)'; ctx.lineWidth = 2; ctx.stroke(); }
      wrapBox(state.msg.text, R(M.x + 14, M.y + 8, M.w - 28, M.h - 16), big ? 30 : 25, 1.18, CREAM);
      ctx.restore();
    } else if (base) {
      if (v3.on) v3.panels.push({ r: { x: M.x + 4, y: M.y + 4, w: M.w - 8, h: M.h - 8 }, rad: 16, kind: 'toast' });
      wrapBox(base, R(M.x + 8, M.y, M.w - 16, M.h), 24, 1.2, state.pend ? SAFFRON : CREAM);
    }
    if (L.land && L.rightHead) fitText('Yote', L.rightHead.x + L.rightHead.w / 2, L.rightHead.y + 34, 32, L.rightHead.w, SAFFRON, FONT, 700);
    if (L.badge && L.badge.show) drawBadgeStack(ctx, L.badge.cx, L.badge.bottom, L.badge.w);
  }
  function lessonBox() {
    const l = LESSONS[state.lesson.i], r = L.lessonBox;
    panel(r, 18, 'rgba(8,16,40,0.8)', 'rgba(255,194,74,0.45)');
    const pad = 16;
    text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, r.x + pad, r.y + 30, Math.max(minU, 20), DIM, UI, 600, 'left');
    fitText(l.title, r.x + pad, r.y + 30 + 40, 38, r.w - 2 * pad, SAFFRON, FONT, 600, 'left');
    const body = state.lesson.done ? l.done : state.msg ? state.msg.text : state.pend ? 'Now take a bonus: tap the enemy pebble that is about to jump.' : l.text;
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
        button(BTN.menu, 'Menu', { size: sz }); button(BTN.undo, state.pend ? 'Cancel' : 'Take back', { size: sz, dim: !state.pend && !state.undo.length }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: sz, dim: state.hintsLeft <= 0, primary: !!state.hint });
      }
    } else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: sz }); if (state.lesson.done) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
  }
  function overlay() {
    if (v3.on) v3.scrim = 0.62; else { ctx.fillStyle = 'rgba(4,8,22,0.72)'; ctx.fillRect(0, 0, L.w, L.h); }
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 28, 'rgba(12,22,50,0.95)', 'rgba(255,194,74,0.6)', true, 'doc');
    const res = state.result || { winner: g.winner, reason: g.reason }, w = res.winner;
    const nm = (s) => sideName(style, s);
    const title = w === 3 ? 'A draw' : state.autoMode ? `${nm(w)} wins` : state.two ? `${nm(w)} wins` : w === state.humanSide ? 'You win!' : 'The computer wins';
    const k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    if (w !== 3) drawPiece(ctx, w, style, 0, 124, 124, { glow: 0.9, lift: 0.4 + Math.sin(state.t * 2.5) * 0.08 });
    else { drawPiece(ctx, 1, style, -56, 124, 100, {}); drawPiece(ctx, 2, style, 56, 124, 100, {}); }
    fitText(title, 0, 238, 62, cw2 - 40, SAFFRON, FONT, 700);
    wrapBox(res.reason || '', R(-cw2 / 2 + 30, 252, cw2 - 60, 70), 26, 1.25, CREAM);
    fitText(`${Math.ceil(g.moves / 2)} moves · pebbles taken: ${g.lost[2]} ${nm(2).toLowerCase()}, ${g.lost[1]} ${nm(1).toLowerCase()}`, 0, 346, 22, cw2 - 40, DIM, UI, 500);
    if (!state.two && !state.autoMode && w === state.humanSide) { fitText(`★ ${LEVELS[state.level].name} beaten`, 0, 390, 24, cw2 - 40, SAFFRON, UI, 700); confetti(c, 0); }
    ctx.restore();
    button(O.again, state.autoMode ? 'Watch another' : 'Play again', { primary: true, size: 32 }); button(O.back, 'Menu', { size: 28 });
    drawMoreLine(ctx, cx, O.back.y + O.back.h + 32, 22);
  }
  function confetti(c, cx) {
    if (state.calm) return;
    for (let k = 0; k < 22; k++) {
      const ph = (state.t * 0.32 + k * 0.0917) % 1, x = cx + Math.sin(k * 2.4 + state.t) * (60 + 170 * ph), y = 210 - ph * 190 + ph * ph * 120;
      ctx.fillStyle = k % 3 === 0 ? `rgba(255,194,74,${0.9 * (1 - ph)})` : k % 3 === 1 ? `rgba(80,200,190,${0.8 * (1 - ph)})` : `rgba(255,246,224,${0.8 * (1 - ph)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k + state.t * 2); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore();
    }
  }

  // ================================================================ documents (rules, how to play, about, settings)
  function drawDocument() {
    const D = L.doc, panelR = D.panel, vp = D.viewport, kindDoc = state.doc.kind;
    if (v3.on) { v3.scrim = 0.3; v3.panels.push({ r: panelR, rad: 28, kind: 'doc' }); }
    else {
    ctx.fillStyle = 'rgba(4,8,22,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
    ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 28);
    const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(28,46,92,0.9)'); pg.addColorStop(1, 'rgba(9,17,40,0.95)');
    ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(160,190,255,0.3)'; ctx.lineWidth = 2; ctx.stroke();
    edgeStroke(ctx, panelR, 28, 0.4);
    }
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kindDoc];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 44, D.header.textDec.x - 90 - hx, SAFFRON, FONT, 600, 'left');
    ctx.strokeStyle = 'rgba(160,190,255,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panelR.x + 28, panelR.y + 82); ctx.lineTo(panelR.x + panelR.w - 28, panelR.y + 82); ctx.stroke();
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
        const ty2 = y + t0 * 0.9; if (vis(y, t0)) fitText(sec.title, cxp, ty2, t0, bodyW, SAFFRON, FONT, 600, 'center', 18);
        y += t0 * 1.35 + 6;
      }
      for (const it of sec.items) {
        if (it.k === 'p') {
          const ls = lines(it.t, size, bodyW); if (vis(y, ls.length * lh)) ls.forEach((ln, i) => text(ln, cxp, y + size * 0.9 + i * lh, size, CREAM, UI, 600, 'center'));
          y += ls.length * lh + gap;
        } else if (it.k === 'h') {
          const hs = Math.round(30 * Math.min(scale, 2)); y += 8; if (vis(y, hs)) text(it.t, cxp, y + hs * 0.9, hs, SAFFRON, FONT, 600, 'center'); y += hs * 1.3 + 4;
        } else if (it.k === 'd') {
          const spec = it.spec, C = spec.rows[0].length, cp = Math.min((spec.cell || 44) * (1 + (Math.min(scale, 2) - 1) * 0.35), (bodyW - 24) / (C + 0.36)), ds = diagramSize(spec, cp);
          if (vis(y, ds.h)) drawDiagram(ctx, spec, cxp - ds.w / 2, y, cp, kind, style);
          y += ds.h + gap + 6;
        } else if (it.k === 'seg') {
          const ls = lines(it.label, Math.round(25 * Math.min(scale, 2.2)), bodyW, 600);
          const fs = Math.round(25 * Math.min(scale, 2.2)); if (vis(y, ls.length * fs * 1.3)) ls.forEach((ln, i) => text(ln, cxp, y + fs * 0.9 + i * fs * 1.3, fs, DIM, UI, 600, 'center'));
          y += ls.length * fs * 1.3 + 6;
          const n = it.opts.length, os = Math.round(25 * Math.min(scale, 2.2)), bh = Math.round(66 * Math.min(scale, 2.2));
          let per = n; ctx.font = `600 ${os}px ${FONT}`;
          const fitsRow = (p) => it.opts.every((o) => ctx.measureText(o.l + (o.locked ? ' (locked)' : '')).width + 28 <= (bodyW - (p - 1) * 10) / p);
          while (per > 1 && !fitsRow(per)) per--;
          const bw = (bodyW - (per - 1) * 10) / per;
          it.opts.forEach((o, k) => {
            const rx = left + (k % per) * (bw + 10), ry = y + Math.floor(k / per) * (bh + 10), rr = R(rx, ry, bw, bh);
            if (vis(ry, bh)) button(rr, o.locked ? `${o.l} (locked)` : o.l, { size: os, on: o.v === it.cur && !o.locked, primary: false, dim: o.locked });
            ui.hits.push({ r: rr, id: it.id, v: o.v, locked: o.locked, need: o.need, clip: vp });
          });
          y += Math.ceil(n / per) * (bh + 10) + gap;
        }
      }
    });
    ctx.restore();
    const contentH = y - (vp.y - sc0) + 10;
    if (contentH - vp.h > 8) {
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(14,26,56,${a0})`); gr.addColorStop(1, `rgba(14,26,56,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 22, vp.y, 0, 0.95);
    }
    docMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); docMetrics.view = vp.h;
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(160,190,255,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,194,74,0.75)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(docMetrics.max > 0 ? (sc0 >= docMetrics.max - 1 ? 'End' : 'Scroll, or tap Next') : '', D.cx, D.counterY, 21, 'rgba(206,220,255,0.65)', UI, 500);
    button(D.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(D.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    fitText(`${Math.round(scale * 100)}%`, D.header.textDec.x - 14, D.header.textDec.y + 42, 22, 70, DIM, UI, 600, 'right');
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.fillStyle = 'rgba(8,14,34,0.96)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,194,74,0.8)'; ctx.lineWidth = 2; ctx.stroke(); wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}

// ---------------------------------------------------------------- effects
// A taken pebble: a flash, then it tilts, rises and fades with a few sand-coloured chips thrown off. f runs 0..1.
export function capFx(ctx, style, v, x, y, cell, f, calm, k) {
  const dirn = k % 2 ? 1 : -1;
  if (f < 0.22) { const e = f / 0.22; drawPiece(ctx, v, style, x, y, cell, { scale: 1 + 0.1 * e, flash: 0.75 * e, lift: 0.1 * e }); return; }
  const g = (f - 0.22) / 0.78, e = ease(g);
  drawPiece(ctx, v, style, x, y - e * cell * 0.7, cell, { alpha: 1 - g, scale: 1.1 - 0.35 * e, tilt: calm ? 0 : dirn * e * 0.8, lift: 0.2 });
  if (calm) return;
  ctx.save();
  for (let j = 0; j < 7; j++) {
    const ang = k * 1.7 + j * 0.95, sp = cell * (0.5 + 0.45 * ((j * 5 + k) % 3) / 2);
    const px = x + Math.cos(ang) * sp * g, py = y - cell * 0.1 - Math.abs(Math.sin(ang)) * sp * 1.1 * g + g * g * cell * 0.9;
    ctx.globalAlpha = Math.max(0, 1 - g * 1.15); ctx.fillStyle = j % 2 ? '#f2d9a4' : '#b9743c';
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang + g * 6); const s = cell * (0.045 + 0.022 * (j % 3)); ctx.fillRect(-s, -s * 0.5, s * 2, s); ctx.restore();
  }
  ctx.restore();
}
// A small puff of sand where a pebble lands. f runs 0..1; kind 1 = lighter (a jump).
function sandPuff(ctx, x, y, cell, f, kind) {
  ctx.save();
  for (let j = 0; j < 7; j++) {
    const ang = j * 0.9 + 0.3, d = cell * (0.16 + 0.34 * ease(f)), px = x + Math.cos(ang) * d * 1.15, py = y + cell * 0.1 + Math.sin(ang) * d * 0.45 - f * cell * 0.18;
    ctx.globalAlpha = Math.max(0, (1 - f) * 0.5); ctx.fillStyle = kind ? '#ffeccc' : '#f0cf9a';
    ctx.beginPath(); ctx.arc(px, py, cell * (0.035 + 0.04 * f), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function motes(ctx, L, t) {
  for (let k = 0; k < 14; k++) {
    const sp = 6 + (k % 4) * 3, x = (((k * 211.7 + t * sp) % (L.w + 80)) + L.w + 80) % (L.w + 80) - 40, y = (k * 137.3 + Math.sin(t * 0.25 + k) * 40 + L.h * 2) % L.h, r = 2 + (k % 5), a = 0.035 + 0.03 * Math.sin(t * 0.6 + k * 1.7);
    ctx.fillStyle = `rgba(190,215,255,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}
