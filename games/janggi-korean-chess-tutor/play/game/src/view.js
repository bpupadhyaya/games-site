// Everything drawn each frame. Reads `state` (see game.js) and changes nothing. Static art and pieces are cached sprites.
// Positions come from the layout (layout.js `layoutFor(w, h)`), never from fixed numbers: the screen can be portrait or landscape.
// The board and everything that lives on it is drawn in canonical board space under one transform (L.board(kind): s, ox, oy).
import { pointXY, D, GX, GY, TEXT_SCALES, THINK_STEPS, BOARD } from './layout.js';
import { drawTable, drawBoard } from './art.js';
import { drawPiece, blob, CJK, LATIN } from './pieces.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { HOW, ABOUT, RULES } from './content.js';
import { SIDE_NAME, kingSquare, inCheckBoard, canPass, startBoard, LAYOUTS, LAYOUT_NAME, LAYOUT_KO, LAYOUT_SEQ, CHARIOT, GUARD, HORSE, ELEPHANT, GENERAL, CHO, HAN, NO_CAPTURE_LIMIT, HAN_BONUS, POINTS } from './rules.js';
import { drawCredit, drawMoreLine, drawLockup } from './brand.js';
import { sqName } from './tutor.js';
import { glyph } from './pieces.js';
import { v3, flatAlpha } from './v3.js';

const TITLE = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2, GOLD = '#f2d27a', CREAM = '#f8f0d8', CHO_C = '#4fd08d', HAN_C = '#ff7d63';
const START_COUNT = [0, 1, 2, 2, 2, 2, 2, 5];
const GY_MID = GY + 4.5 * D;
const FILES = 'abcdefghi';
// The reader card publishes how tall its content is, so game.js can clamp scrolling (render never changes `state`).
export const readerMetrics = { contentH: 0, viewH: 0, max: 0 };

export function capturedBy(g, side) {              // pieces of the other colour that `side` has taken
  const have = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let s = 0; s < 90; s++) { const p = g.board[s]; if (p && (p > 0) !== (side > 0)) have[Math.abs(p)]++; }
  const out = [];
  for (const t of [5, 6, 4, 3, 2, 7, 1]) for (let k = have[t]; k < START_COUNT[t]; k++) out.push(-side * t);
  return out;
}
const tally = (g, side) => { let n = 0; for (let s = 0; s < 90; s++) { const p = g.board[s]; if (p && (p > 0) === (side > 0)) n += POINTS[Math.abs(p)]; } return side === HAN ? n + HAN_BONUS : n; };

export function render(ctx, state, L) {
  const scene = state.scene, big = state.big, calm = state.calm;
  const theme = state.set, lang = state.lang === 'en' ? 'en' : 'ko', flip = state.human === HAN && !state.two && (scene === 'play');
  const T = state.t, SW = L.w, SH = L.h;
  // 3D on: the room and the board are drawn by the presenter behind this canvas; this layer keeps the HUD (the flat table and
  // board fade out once during the crossfade). Off: the flat art, exactly as before.
  const V = v3.on && !!v3.proj, fa = flatAlpha();
  const pub = (o) => { if (V) v3.frame = { theme: state.board, set: state.set, lang, calm, t: T, ...o }; };
  if (fa > 0) { ctx.save(); ctx.globalAlpha = fa; drawTable(ctx, SW, SH); ctx.restore(); }
  if (V) { v3.hero = null; const m = Math.max(SW, SH), vg = ctx.createRadialGradient(SW / 2, SH * 0.48, Math.min(SW, SH) * 0.42, SW / 2, SH * 0.5, m * 0.72); vg.addColorStop(0, 'rgba(20,8,2,0)'); vg.addColorStop(1, 'rgba(20,8,2,0.62)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, SW, SH); }
  const piece = (p, x, y, o = {}) => drawPiece(ctx, p, x, y, { theme, lang, ...o });

  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const fit = (str, maxW, size, font = UI, weight = 700, min = 20) => { ctx.font = `${weight} ${size}px ${font}`; const w = ctx.measureText(str).width; return w <= maxW ? size : Math.max(min, Math.floor(size * maxW / w)); };
  const lines = (str, size, maxW, weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.3, align = 'center', weight = 600) => {
    const ls = lines(str, size, maxW, weight); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, weight, align)); return ls.length;
  };
  // Wrap text into a box, shrinking the font (down to `min`) until it fits the height. Returns the font size used.
  const fitWrap = (str, r, size, color, { min = 20, lhK = 1.3, align = 'center', weight = 600 } = {}) => {
    let sz = size, ls = lines(str, sz, r.w, weight);
    while (sz > min && ls.length * sz * lhK > r.h) { sz -= 1; ls = lines(str, sz, r.w, weight); }
    const lh = sz * lhK, x = align === 'center' ? r.x + r.w / 2 : r.x;
    ls.forEach((ln, i) => text(ln, x, r.y + sz + i * lh, sz, color, UI, weight, align)); return sz;
  };
  // Panels and buttons belong to the room: lacquered wood (otchil) plaques with a white-brass (baektong) edge and corner fittings,
  // like the board's own corners. Flat fills, no inner gloss shapes.
  const LAQ = { lacquer: ['#3b2015', '#1f0f09'], red: ['#a52a1c', '#5e1209'], jade: ['#2c7a5a', '#123f2c'], gold: ['#f6d989', '#c48d2c'] };
  const corners = (r, inset, len, col, lw) => {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'square';
    for (const [cx, cy, sx, sy] of [[r.x + inset, r.y + inset, 1, 1], [r.x + r.w - inset, r.y + inset, -1, 1], [r.x + inset, r.y + r.h - inset, 1, -1], [r.x + r.w - inset, r.y + r.h - inset, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(cx + sx * len, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * len); ctx.stroke();
    }
  };
  const plaque = (r, kind = 'lacquer', alpha = 0.92, glow = 0) => {
    const c = LAQ[kind] ?? LAQ.lacquer, rad = Math.min(16, r.h * 0.22);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.32 * alpha})`; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
    ctx.globalAlpha = alpha; ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = glow ? `rgba(255,214,120,${0.6 + glow * 0.4})` : 'rgba(232,214,160,0.55)'; ctx.lineWidth = glow ? 3 : 1.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,200,0.14)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10, Math.max(4, rad - 4)); ctx.stroke();
    if (r.w > 120 && r.h > 50) corners(r, 7, Math.min(18, r.h * 0.22), 'rgba(236,222,178,0.75)', 2.4);
    ctx.restore();
  };
  const panel = (r, alpha = 0.55, glow = 0) => plaque(r, 'lacquer', V ? 0.95 : Math.min(0.94, 0.42 + alpha * 0.6), glow);
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.45;
    const press = o.press ? 3 : 0, rad = Math.min(16, r.h * 0.28);
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 6, r.w, r.h, rad); ctx.fill();
    const c = LAQ[o.primary ? 'gold' : o.on ? 'jade' : o.warn ? 'red' : 'lacquer'];
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y + press, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,248,214,0.9)' : 'rgba(232,214,160,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    if (r.w > 100 && r.h >= 50) corners({ x: r.x, y: r.y + press, w: r.w, h: r.h }, 6, Math.min(12, r.h * 0.2), o.primary ? 'rgba(90,52,8,0.55)' : 'rgba(236,222,178,0.6)', 2);
    let sz = Math.min(o.size ?? (r.h > 70 ? 32 : 28), Math.round(r.h * 0.46));
    const ic = o.icon && r.w - 22 > 120 ? Math.min(r.h * 0.42, 30) : 0;
    sz = fit(label, r.w - 22 - (ic ? ic + 10 : 0), sz, o.font ?? UI, 700, 18);
    let lx = r.x + r.w / 2;
    if (ic) { ctx.font = `700 ${sz}px ${o.font ?? UI}`; const tw = ctx.measureText(label).width, x0 = r.x + (r.w - tw - ic - 10) / 2; icon(o.icon, x0 + ic / 2, r.y + press + r.h / 2, ic, o.primary ? '#3a2406' : '#ecd6a0'); lx = x0 + ic + 10 + tw / 2; }
    text(label, lx, r.y + press + r.h / 2 + sz * 0.35, sz, o.primary ? '#2a1c06' : CREAM, o.font ?? UI, 700);
    if (o.sub) text(o.sub, r.x + r.w / 2, r.y + press + r.h - Math.max(10, r.h * 0.13), Math.min(22, r.h * 0.2), o.primary ? 'rgba(52,32,6,0.85)' : 'rgba(248,240,216,0.75)', UI, 600);
    ctx.restore();
  };
  // small line icons for the menu (stroked in the button's text colour)
  function icon(kind, x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(2, s * 0.09); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const h = s / 2, oct = (r) => { ctx.beginPath(); for (let i = 0; i < 8; i++) { const an = (i * 45 + 22.5) * Math.PI / 180, R = r / Math.cos(Math.PI / 8); i ? ctx.lineTo(Math.cos(an) * R, Math.sin(an) * R) : ctx.moveTo(Math.cos(an) * R, Math.sin(an) * R); } ctx.closePath(); };
    if (kind === 'play') { ctx.beginPath(); ctx.moveTo(-h * 0.55, -h * 0.75); ctx.lineTo(h * 0.8, 0); ctx.lineTo(-h * 0.55, h * 0.75); ctx.closePath(); ctx.fill(); }
    else if (kind === 'book') { ctx.beginPath(); ctx.moveTo(0, -h * 0.55); ctx.quadraticCurveTo(-h * 0.5, -h * 0.85, -h, -h * 0.6); ctx.lineTo(-h, h * 0.7); ctx.quadraticCurveTo(-h * 0.5, h * 0.45, 0, h * 0.75); ctx.quadraticCurveTo(h * 0.5, h * 0.45, h, h * 0.7); ctx.lineTo(h, -h * 0.6); ctx.quadraticCurveTo(h * 0.5, -h * 0.85, 0, -h * 0.55); ctx.lineTo(0, h * 0.75); ctx.stroke(); }
    else if (kind === 'eye') { ctx.beginPath(); ctx.moveTo(-h, 0); ctx.quadraticCurveTo(0, -h * 1.1, h, 0); ctx.quadraticCurveTo(0, h * 1.1, -h, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, h * 0.32, 0, TAU); ctx.fill(); }
    else if (kind === 'two') { ctx.translate(-h * 0.35, -h * 0.2); oct(h * 0.55); ctx.stroke(); ctx.translate(h * 0.7, h * 0.4); oct(h * 0.55); ctx.stroke(); }
    else if (kind === 'han') { ctx.strokeStyle = HAN_C; oct(h * 0.8); ctx.stroke(); ctx.fillStyle = HAN_C; ctx.font = `700 ${(h * 1.05).toFixed(1)}px ${CJK}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('漢', 0, h * 0.05); }
    else if (kind === 'info') { ctx.beginPath(); ctx.arc(0, 0, h * 0.85, 0, TAU); ctx.stroke(); ctx.fillRect(-s * 0.045, -h * 0.1, s * 0.09, h * 0.6); ctx.beginPath(); ctx.arc(0, -h * 0.4, s * 0.06, 0, TAU); ctx.fill(); }
    else if (kind === 'how') { ctx.beginPath(); ctx.arc(0, 0, h * 0.85, 0, TAU); ctx.stroke(); ctx.font = `800 ${(h * 1.2).toFixed(1)}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, h * 0.06); }
    else if (kind === 'rules') { ctx.strokeRect(-h * 0.65, -h * 0.85, h * 1.3, h * 1.7); for (const yy of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.moveTo(-h * 0.35, yy * h); ctx.lineTo(h * 0.35, yy * h); ctx.stroke(); } }
    else if (kind === 'gear') { ctx.beginPath(); ctx.arc(0, 0, h * 0.5, 0, TAU); ctx.stroke(); for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(an) * h * 0.62, Math.sin(an) * h * 0.62); ctx.lineTo(Math.cos(an) * h * 0.92, Math.sin(an) * h * 0.92); ctx.stroke(); } }
    else if (kind === 'resume') { ctx.beginPath(); ctx.arc(0, 0, h * 0.8, -Math.PI * 0.35, Math.PI * 1.45); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-h * 0.25, -h * 0.4); ctx.lineTo(h * 0.45, 0); ctx.lineTo(-h * 0.25, h * 0.4); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  const stepper = (st, dec, inc, label) => {
    button(st.dec, '−', { dim: dec, size: 30 }); button(st.inc, '+', { dim: inc, size: 30 });
    text(label, st.label.x, st.label.y, st.label.size, 'rgba(248,240,216,0.9)', UI, 700);
  };

  // ================================ title ==========================================================================
  if (scene === 'title') {
    const TL = L.title(!!state.saved), hr = TL.hero;
    if (V) {
      // the 3D board (set up for a game) fills the hero; the lettering sits below it on a soft shade
      v3.hero = { x: hr.x + 20 * hr.s, y: hr.y + 200 * hr.s, w: 680 * hr.s, h: 330 * hr.s };
      // the hero board is alive: every few seconds a soldier steps forward and is put down with a tak, then steps back
      const bd = startBoard('inner', 'inner'); let an = null;
      if (!calm) {
        const P = 5, c = Math.floor(T / P), ph = T - c * P, from = [54, 56, 58, 60, 62][c % 5], to = from - 9, dur = 0.42;
        const fwd = ph >= 1 && ph < 3.4, mv = (ph >= 1 && ph < 1 + dur) ? { f: from, t: to, u: ph - 1 } : (ph >= 3.4 && ph < 3.4 + dur) ? { f: to, t: from, u: ph - 3.4 } : null;
        if (fwd || mv) { bd[to] = bd[from]; bd[from] = 0; }
        if (mv && !fwd) { bd[from] = bd[to]; bd[to] = 0; }
        if (mv) { const pc = bd[mv.t] || 7; bd[mv.t] = pc; bd[mv.f] = 0; an = { type: 'move', from: mv.f, to: mv.t, p: pc, t: mv.u, dur }; }
      }
      pub({ board: bd, flip: false, caps: false, anim: an });
    }
    ctx.save(); ctx.translate(hr.x, hr.y); ctx.scale(hr.s, hr.s);
    if (!V) {
      const bob = calm ? 0 : Math.sin(T * 1.4) * 5;
      blob(ctx, 360, 380, 340, 200, '120,230,170', 0.2); blob(ctx, 360, 380, 260, 150, '255,200,110', 0.16);
      piece(1, 226, 360 + bob, { R: 32, scale: 2.5 });
      piece(-1, 494, 360 - bob, { R: 32, scale: 2.5 });
      ctx.save(); ctx.strokeStyle = 'rgba(242,210,122,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(316, 372); ctx.lineTo(404, 372); ctx.stroke();
      if (lang === 'en') { ctx.font = `700 24px ${TITLE}`; ctx.fillStyle = 'rgba(242,210,122,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Cho vs Han', 360, 340); }
      else { ctx.font = `700 34px ${CJK}`; ctx.fillStyle = 'rgba(242,210,122,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('楚  漢', 360, 338); }
      ctx.restore();
    } else {
      const sh = ctx.createRadialGradient(360, 630, 30, 360, 630, 330); sh.addColorStop(0, 'rgba(18,8,3,0.78)'); sh.addColorStop(0.6, 'rgba(18,8,3,0.45)'); sh.addColorStop(1, 'rgba(18,8,3,0)');
      ctx.fillStyle = sh; ctx.fillRect(-300, 280, 1320, 720);
    }
    // embossed gold lettering: dark cast, lit gold face, thin bright edge
    ctx.save(); ctx.font = `700 108px ${TITLE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = V ? 'rgba(0,0,0,0.7)' : 'rgba(120,255,190,0.45)'; ctx.shadowBlur = V ? 16 : 24; ctx.shadowOffsetY = V ? 6 : 0;
    const tg = ctx.createLinearGradient(0, 500, 0, 590); tg.addColorStop(0, '#fff2c0'); tg.addColorStop(0.45, '#f2c75a'); tg.addColorStop(0.55, '#c98d26'); tg.addColorStop(1, '#f7d98a');
    ctx.fillStyle = V ? tg : GOLD; ctx.fillText('Janggi', 360, 586);
    if (V) { ctx.shadowColor = 'transparent'; ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,248,220,0.7)'; ctx.strokeText('Janggi', 360, 586); }
    ctx.restore();
    ctx.save(); ctx.font = `700 40px ${CJK}`; ctx.fillStyle = 'rgba(248,240,216,0.92)'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; if (V) { ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8; } ctx.fillText('장기', 360, V ? 650 : 642); ctx.restore();
    ctx.save(); if (V) { ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8; } text('Korean chess, with a tutor', 360, V ? 692 : 684, 26, 'rgba(248,240,216,0.92)', UI, 600); ctx.restore();
    ctx.restore();
    const nr = TL.narrow;
    if (state.saved) { button(TL.resume, 'Resume game', { primary: true, size: 36, icon: 'resume' }); button(TL.cho, nr ? 'New game' : 'New game as Cho', { icon: 'play', size: 26 }); }
    else button(TL.cho, 'Play', { primary: true, size: 40, icon: 'play', sub: TL.cho.h >= 84 ? 'as Cho · green · moves first' : null });
    button(TL.han, nr ? 'Play Han' : 'Play as Han (red)', { icon: 'han', size: 24 }); button(TL.two, 'Two players', { icon: 'two', size: 24 });
    button(TL.learn, state.learnedAll ? 'Lessons' : 'Learn to play', { icon: 'book', size: 24, on: !state.learnedAll && !state.progress.played });
    button(TL.autoplay, 'Auto Play', { icon: 'eye', size: 24 });
    button(TL.langKo, 'Play (장기)', { on: lang !== 'en', size: 25, font: CJK });
    button(TL.langEn, 'Play (English)', { on: lang === 'en', size: 23 });
    button(TL.level, TL.level.w < 260 ? `CPU: ${LEVELS[state.level].name}` : `Computer: ${LEVELS[state.level].name}`, { size: 23 }); button(TL.tutor, `Tutor: ${state.tutor ? 'on' : 'off'}`, { size: 23, on: state.tutor });
    button(TL.how, 'How to play', { size: 22, icon: TL.how.w >= 210 ? 'how' : null }); button(TL.about, TL.how.w < 190 ? 'About' : 'About Janggi', { size: 22, icon: TL.how.w >= 230 ? 'info' : null }); button(TL.rules, 'Rules', { size: 24, icon: 'rules' }); button(TL.look, 'Board, pieces and settings', { size: 24, icon: 'gear' });
    if (state.progress.played) text(`Games ${state.progress.played}   Wins ${state.progress.wins}`, TL.stats.x, TL.stats.y, 22, 'rgba(248,240,216,0.6)', UI, 600);
    { const c = TL.credit, lh = c.w * 0.2725, pad = lh * 0.12; ctx.save(); ctx.globalAlpha = state.lockPress > 0 ? 0.7 : 1; ctx.fillStyle = 'rgba(10,8,24,0.55)'; ctx.beginPath(); ctx.roundRect(c.x - c.w / 2 - pad, c.top - pad, c.w + 2 * pad, lh + 2 * pad, (lh + 2 * pad) * 0.3); ctx.fill(); ctx.restore(); }
    if (!drawLockup(ctx, TL.credit.x, TL.credit.top + TL.credit.w * 0.2725, TL.credit.w, state.lockPress > 0 ? 0.7 : 1)) drawCredit(ctx, TL.credit.x, TL.credit.y, 20);
    return;
  }
  if (scene === 'demo-limit') {
    const DL = L.demo();
    blob(ctx, DL.hero.x, DL.hero.y + 40, 300, 200, '120,230,170', 0.22);
    piece(1, DL.hero.x - 70, DL.hero.y, { R: 32, scale: 2.6 }); piece(-1, DL.hero.x + 70, DL.hero.y, { R: 32, scale: 2.6 });
    text('Enjoying Janggi?', DL.title.x, DL.title.y, 60, GOLD, TITLE, 700, 'center');
    wrap('The free web version stops here. Get the free app on iPhone and Android: every lesson, unlimited games against five computer levels with a tutor that explains moves, and it works offline.', DL.body.x, DL.body.y, 30, DL.body.w, CREAM, 42);
    button(DL.back, 'Back to menu', { primary: true }); return;
  }

  // ================================ set-up: choose the horse / elephant layout =======================================
  if (scene === 'setup') {
    const SU = L.setup(), S = state.setup;
    if (V) { const sh = Math.min(SH * 0.3, 260), tg = ctx.createLinearGradient(0, 0, 0, sh); tg.addColorStop(0, 'rgba(22,10,4,0.85)'); tg.addColorStop(1, 'rgba(22,10,4,0)'); ctx.fillStyle = tg; ctx.fillRect(0, 0, SW, sh); }
    const chooser = S.mode === 'two' ? (S.step === 0 ? CHO : HAN) : S.human;
    text('Choose your set-up', SU.head.x, SU.head.y, fit('Choose your set-up', SU.head.align === 'center' ? SW - 60 : SU.cards[1].x + SU.cards[1].w - SU.head.x, SU.head.size, TITLE, 700), GOLD, TITLE, 700, SU.head.align);
    const who = S.mode === 'two' ? `${SIDE_NAME[chooser]} chooses` : chooser === CHO ? 'You are Cho and set up first' : 'You are Han and set up second';
    text(who, SU.head.sub.x, SU.head.sub.y, 24, chooser === CHO ? CHO_C : HAN_C, UI, 700, SU.head.align);
    if (SU.board && V) {
      const bd = startBoard(S.cho, S.han), fl = S.mode === 'vs' && S.human === HAN, ghost = new Set();
      for (let s = 0; s < 90; s++) { const p = bd[s]; if (p && (p > 0 ? !S.choKnown : !S.hanKnown) && Math.abs(p) >= 3 && Math.abs(p) <= 4) ghost.add(s); }
      pub({ board: bd, flip: fl, ghost, caps: false });
    } else if (V) pub({ board: startBoard(S.cho, S.han), flip: false, caps: false });
    if (SU.board && fa > 0) {
      const B = SU.board;
      ctx.save(); ctx.globalAlpha = fa;
      ctx.save(); ctx.beginPath(); ctx.rect(B.rect.x - 2, B.rect.y - 2, B.rect.w + 4, B.rect.h + 4); ctx.clip();
      ctx.translate(B.ox, B.oy); ctx.scale(B.s, B.s);
      drawBoard(ctx, state.board, lang);
      const bd = startBoard(S.cho, S.han), fl = S.mode === 'vs' && S.human === HAN;
      for (let s = 0; s < 90; s++) { const p = bd[s]; if (!p) continue; const q = pointXY(s, fl); const unknown = (p > 0 ? !S.choKnown : !S.hanKnown) && Math.abs(p) >= 3 && Math.abs(p) <= 4; piece(p, q.x, q.y, { alpha: unknown ? 0.35 : 1 }); }
      ctx.restore();
      ctx.restore();
    }
    const side = chooser;
    SU.cards.forEach((r, i) => {
      const lay2 = LAYOUTS[i], cur = (side === CHO ? S.cho : S.han) === lay2, known = side === CHO ? S.choKnown : S.hanKnown;
      const sel = cur && known;
      plaque(r, sel ? 'jade' : 'lacquer', 0.95, sel ? 1 : 0);
      const nm = LAYOUT_NAME[lay2], ko = LAYOUT_KO[lay2];
      const compact = r.h < 150;
      ctx.save(); ctx.font = `700 ${compact ? 22 : 26}px ${CJK}`; const koW = ctx.measureText(ko).width; ctx.restore();
      text(nm, r.x + 16, r.y + (compact ? 30 : 36), fit(nm, r.w - 46 - koW, compact ? 24 : 28, UI, 700, 15), CREAM, UI, 700, 'left');
      ctx.save(); ctx.font = `700 ${compact ? 22 : 26}px ${CJK}`; ctx.fillStyle = 'rgba(242,210,122,0.9)'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillText(ko, r.x + r.w - 14, r.y + (compact ? 30 : 36)); ctx.restore();
      // the back rank, drawn from the chooser's own left: chariot, 2 places, guard, gap, guard, 2 places, chariot
      const seq = LAYOUT_SEQ[lay2], pitch = Math.min(60, (r.w - 28) / 9), scl = pitch / 52, y0 = r.y + r.h * (compact ? 0.62 : 0.58), x0 = r.x + r.w / 2 - 4 * pitch;
      const row = [CHARIOT, seq[0] === 'H' ? HORSE : ELEPHANT, seq[1] === 'H' ? HORSE : ELEPHANT, GUARD, 0, GUARD, seq[2] === 'H' ? HORSE : ELEPHANT, seq[3] === 'H' ? HORSE : ELEPHANT, CHARIOT];
      row.forEach((t, k) => { if (t) piece(side * t, x0 + k * pitch, y0, { R: 32, scale: scl * 0.9 }); });
      if (!compact) text(seq.split('').join(' '), r.x + r.w / 2, r.y + r.h - 22, 20, 'rgba(248,240,216,0.7)', UI, 700);
      if (sel) { ctx.save(); ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(r.x + r.w - 38, r.y + r.h - 30); ctx.lineTo(r.x + r.w - 30, r.y + r.h - 22); ctx.lineTo(r.x + r.w - 16, r.y + r.h - 40); ctx.stroke(); ctx.restore(); }
    });
    panel(SU.info, 0.55);
    const cur = side === CHO ? S.cho : S.han;
    const tips = { inner: 'Elephants next to the guards, horses outside: a solid, defensive set-up.', outer: 'Horses next to the guards, elephants on the edge: the horses reach the centre quickly.', left: 'An elephant on the outside left of each side of the palace: a flexible, balanced set-up.', right: 'An elephant on the inside right: a mirror of Left elephant, flexible and balanced.' };
    let msg;
    if (S.mode === 'vs' && chooser === HAN) msg = `Cho (the computer) chose ${LAYOUT_NAME[S.cho]}. Now choose yours. ${tips[cur]}`;
    else if (S.mode === 'two' && chooser === HAN) msg = `Cho chose ${LAYOUT_NAME[S.cho]}. Han, choose yours. ${tips[cur]}`;
    else if (S.mode === 'vs') msg = `Han (the computer) will choose after you. ${tips[cur]}`;
    else msg = `Han will choose after seeing your set-up. ${tips[cur]}`;
    fitWrap(msg, { x: SU.info.x + 18, y: SU.info.y + 10, w: SU.info.w - 36, h: SU.info.h - 20 }, big ? 27 : 24, CREAM, { min: 17, lhK: 1.25, weight: 600 });
    button(SU.start, S.mode === 'two' && S.step === 0 ? 'Next: Han chooses' : 'Start game', { primary: true });
    button(SU.back, S.mode === 'two' && S.step === 1 ? 'Back' : 'Cancel', {});
    return;
  }

  if (V && scene !== 'setup') pub({ board: startBoard('inner', 'inner'), flip: false, caps: false });
  // reading / settings screens over the room: a soft shade at the top keeps the title and the A- / A+ buttons clear of the lit doors
  if (V && (scene === 'look' || scene === 'howto' || scene === 'about' || scene === 'rules')) { const tg = ctx.createLinearGradient(0, 0, 0, Math.min(SH * 0.35, 320)); tg.addColorStop(0, 'rgba(22,10,4,0.82)'); tg.addColorStop(1, 'rgba(22,10,4,0)'); ctx.fillStyle = tg; ctx.fillRect(0, 0, SW, Math.min(SH * 0.35, 320)); }
  if (scene === 'look') {
    const LK = L.look();
    text('Settings', LK.head.x, LK.head.y, LK.head.size, GOLD, TITLE, 700, LK.head.align);
    if (LK.showPieces) { const py = LK.pieces.y + 20; [[1, -170], [-1, -60], [5, 60], [-6, 170]].forEach(([p, dx]) => piece(p, SW / 2 + dx, py, { R: 32, scale: 1.6 })); }
    const names = { lang: ['Play (장기)', 'Play (English)'], boards: ['Pine', 'Night'], sets: ['Boxwood', 'Ebony'], text: ['Normal', 'Large'], calm: ['Full', 'Reduced'], sound: ['On', 'Off'] };
    const labels = { lang: 'Language', boards: 'Board', sets: 'Pieces', text: 'Text size', calm: 'Motion', sound: 'Sound' };
    const cur = { lang: lang === 'en' ? 1 : 0, boards: state.board === 'night' ? 1 : 0, sets: state.set === 'ebony' ? 1 : 0, text: big ? 1 : 0, calm: calm ? 1 : 0, sound: state.sound ? 0 : 1 };
    for (const g of LK.groups) {
      text(labels[g.key], g.label.x, g.label.y, g.label.size, 'rgba(248,240,216,0.8)', UI, 600);
      g.rects.forEach((r, k) => button(r, names[g.key][k], { on: cur[g.key] === k, size: 25, font: g.key === 'lang' && k === 0 ? CJK : UI }));
    }
    button(LK.back, 'Back', { primary: true }); return;
  }
  if (scene === 'howto' || scene === 'about' || scene === 'rules') {
    const RF = L.ref();
    const pages = scene === 'howto' ? HOW : scene === 'about' ? ABOUT : RULES;
    const sceneTitle = scene === 'howto' ? 'How to play' : scene === 'about' ? 'About this game' : 'Rules';
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    const tsz = fit(sceneTitle, RF.title.align === 'center' ? RF.card.w - 40 : RF.dec.x - RF.title.x - 20, RF.title.size, TITLE, 700);
    text(sceneTitle, RF.title.x, RF.title.y, tsz, GOLD, TITLE, 700, RF.title.align);

    // The reader card: one framed panel holding ONE continuous scrolling document: every section in order (heading, the piece
    // portraits where the section has them, then its bullets). Drag, wheel, keys and the scroll bar move it; Next moves a screenful.
    const rp = RF.card;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(rp.x, rp.y, rp.w, rp.h, 26);
    const rg = ctx.createLinearGradient(0, rp.y, 0, rp.y + rp.h);
    if (V) { rg.addColorStop(0, 'rgba(52,28,18,0.93)'); rg.addColorStop(1, 'rgba(28,14,8,0.95)'); } else { rg.addColorStop(0, 'rgba(14,40,34,0.66)'); rg.addColorStop(1, 'rgba(5,16,14,0.78)'); }
    ctx.fillStyle = rg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(242,210,122,0.32)'; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(rp.x + 6, rp.y + 6, rp.w - 12, rp.h - 12, 20);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(242,210,122,0.12)'; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(rp.x + 3, rp.y + 3, rp.w - 6, rp.h - 6, 23); ctx.clip();
    const scroll = Math.max(0, Math.min(state.scroll || 0, readerMetrics.max));
    const tx = rp.x + 54, vis = (y0, y1) => y1 >= rp.y - 80 && y0 <= rp.y + rp.h + 80;
    // Body font grows a lot more than the (capped) title as the text-size step rises, so the gap below the title (and the
    // piece labels) grows with it, sized from the body font's own cap-height.
    const sz = Math.round(28 * scale), lh = Math.round(sz * 1.4), gap = Math.round(18 * scale);
    const bulletR = Math.round(5 * scale), bulletDy = Math.round(9 * scale), titlePx = Math.round(46 * Math.min(scale, 1.15));
    let top = 0;                                   // document y (0 = top of the card), screen y = rp.y + top - scroll
    pages.forEach((pg, pi) => {
      if (pi) top += Math.round(6 * scale) - 24;
      const y0 = rp.y + top - scroll;
      if (vis(y0, y0 + titlePx * 1.6)) text(pg.title, rp.x + rp.w / 2, y0 + 62, fit(pg.title, rp.w - 40, titlePx, TITLE, 700), GOLD, TITLE);
      let y = y0 + 90 + Math.round(sz * 0.75);
      // A Rules section about one piece shows that piece's own real in-game sprite, Cho and Han side by side.
      if (pg.type) {
        const py = y0 + 148, dx = 120, pr = 50, cxp = rp.x + rp.w / 2;
        if (vis(py - 70, py + 100)) {
          piece(pg.type, cxp - dx, py, { R: pr }); piece(-pg.type, cxp + dx, py, { R: pr });
          text('Cho', cxp - dx, py + 78, 22, 'rgba(248,240,216,0.7)', UI, 600);
          text('Han', cxp + dx, py + 78, 22, 'rgba(248,240,216,0.7)', UI, 600);
        }
        y = py + 98 + Math.round(sz * 0.75);
      }
      for (const it of pg.items) {
        const n = lines(it, sz, rp.w - 90, 500).length;
        if (vis(y - lh, y + n * lh)) {
          ctx.fillStyle = '#e2b661'; ctx.beginPath(); ctx.arc(rp.x + 32, y - bulletDy, bulletR, 0, TAU); ctx.fill();
          wrap(it, tx, y, sz, rp.w - 90, CREAM, lh, 'left', 500);
        }
        y += n * lh + gap;
      }
      top = y - rp.y + scroll;
    });
    readerMetrics.contentH = top + 12; readerMetrics.viewH = rp.h; readerMetrics.max = Math.max(0, readerMetrics.contentH - rp.h);
    if (readerMetrics.max > 0) {
      const bh = Math.max(36, rp.h * rp.h / readerMetrics.contentH), by = rp.y + (rp.h - bh) * (scroll / readerMetrics.max);
      ctx.fillStyle = 'rgba(242,210,122,0.5)'; ctx.beginPath(); ctx.roundRect(rp.x + rp.w - 11, by + 4, 5, bh - 8, 3); ctx.fill();
    }
    ctx.restore();
    button(RF.prev, 'Back', {}); button(RF.page, (state.scroll || 0) >= readerMetrics.max - 2 ? 'Done' : 'Next', { primary: true });
    button(RF.dec, 'A−', { dim: state.textScaleIdx === 0, size: 30 });
    button(RF.inc, 'A+', { dim: state.textScaleIdx === TEXT_SCALES.length - 1, size: 30 });
    return;
  }

  // ================================ board scenes ===================================================================
  const inLesson = scene === 'lesson', inAuto = scene === 'autoplay';
  const BL = L.board(inLesson ? 'lesson' : inAuto ? 'auto' : 'play');
  const g = state.g, a = state.anim;
  const hd = BL.head;
  const headTitle = inAuto ? 'Auto Play' : inLesson ? 'Lesson ' + (state.lesson.i + 1) + ' of ' + LESSONS.length : 'Janggi';
  if (!hd.hidden) text(headTitle, hd.x, hd.y, hd.align === 'left' ? fit(headTitle, hd.w, hd.size, TITLE, 700) : hd.size, GOLD, TITLE, 700, hd.align);
  if (inAuto && hd.sub && !hd.hidden) text(state.paused ? 'Paused' : 'Both sides play automatically', hd.sub.x, hd.sub.y, 22, state.paused ? GOLD : 'rgba(248,240,216,0.75)', UI, 600, hd.align);
  const own = state.human;

  // ---- plates (play only) and lesson header
  const plate = (r, side, name, sub, active) => {
    panel(r, 0.6, active ? 0.5 + 0.5 * (calm ? 1 : Math.sin(T * 4) * 0.5 + 0.5) : 0);
    const inline = r.w >= 560, compact = !inline && r.h < 80, k = Math.min(1, r.h / 88), cap = capturedBy(g, side), maxN = 16;
    const nameCol = side === CHO ? CHO_C : HAN_C;
    if (compact) {
      piece(side * 1, r.x + 34, r.y + r.h / 2, { R: 32, scale: 0.62 });
      text(name, r.x + 68, r.y + r.h * 0.44, 24, nameCol, UI, 700, 'left');
      text(sub, r.x + 68, r.y + r.h * 0.44 + 20, fit(sub, r.w * 0.55 - 70, 18, UI, 500, 14), 'rgba(248,240,216,0.72)', UI, 500, 'left');
      const pitch = Math.min(15, (r.w * 0.42) / maxN); cap.slice(0, maxN).forEach((p, i) => piece(p, r.x + r.w - 14 - (Math.min(cap.length, maxN) - i) * pitch, r.y + r.h / 2, { R: 32, scale: 0.3, alpha: 0.95 }));
      return;
    }
    piece(side * 1, r.x + (inline ? r.h * 0.59 : 54), r.y + (inline ? r.h / 2 : 46), { R: 32, scale: 0.9 * (inline ? k : 1) });
    const nx = r.x + (inline ? r.h * 1.14 : 100), ny = inline ? r.y + r.h * 0.48 : r.y + 42;
    text(name, nx, ny, Math.round((inline ? 30 * k : 28)), nameCol, UI, 700, 'left'); text(sub, nx, ny + (inline ? 30 * k : 28), fit(sub, r.x + r.w - nx - (inline ? 340 * k : 12), 22, UI, 500, 18), 'rgba(248,240,216,0.72)', UI, 500, 'left');
    if (inline) { const x0 = r.x + 312 * k, pitch = 20.5 * k; cap.slice(0, maxN).forEach((p, i) => piece(p, x0 + i * pitch, r.y + r.h * 0.52, { R: 32, scale: 0.4 * k, alpha: 0.95 })); }
    else { const pitch = Math.min(20.5, (r.w - 40) / maxN); cap.slice(0, maxN).forEach((p, i) => piece(p, r.x + 26 + i * pitch, r.y + r.h - 24, { R: 32, scale: pitch < 18 ? 0.34 : 0.4, alpha: 0.95 })); }
  };
  const pts = (side) => { const n = tally(g, side); return `${n % 1 ? n.toFixed(1) : n} pts`; };
  if (inAuto) {
    plate(BL.top, HAN, 'Han', `${LEVELS[state.level].name} computer · ${pts(HAN)}`, !g.result && g.turn === HAN);
    plate(BL.bot, CHO, 'Cho', `${LEVELS[state.level].name} computer · ${pts(CHO)}`, !g.result && g.turn === CHO);
  } else if (inLesson) {
    const l = LESSONS[state.lesson.i], st = l.steps[state.lesson.s], r = BL.top;
    panel(r, 0.5);
    const small = r.h < 150, body = state.lesson.done ? st.done : st.text, bcol = state.lesson.done ? '#c9f7c0' : '#ffffff';
    if (small) {      // tight screens: title and step on one line, the text below it gets the room
      text(l.title, r.x + 20, r.y + 32, fit(l.title, r.w * 0.6, 30, TITLE, 700), GOLD, TITLE, 700, 'left');
      text(`Step ${state.lesson.s + 1} of ${l.steps.length}`, r.x + r.w - 20, r.y + 30, 20, 'rgba(242,210,122,0.85)', UI, 600, 'right');
      fitWrap(body, { x: r.x + 20, y: r.y + 42, w: r.w - 40, h: r.h - 50 }, big ? 24 : 22, bcol, { min: 15, lhK: 1.2 });
    } else {
      text(l.title, r.x + r.w / 2, r.y + 44, fit(l.title, r.w - 30, 42, TITLE, 700), GOLD, TITLE);
      text(`Step ${state.lesson.s + 1} of ${l.steps.length}`, r.x + r.w / 2, r.y + 74, 22, 'rgba(242,210,122,0.85)', UI, 600);
      fitWrap(body, { x: r.x + 22, y: r.y + 86, w: r.w - 44, h: r.h - 98 }, big ? 27 : 24, bcol, { min: 17, lhK: 1.2 });
    }
  } else {
    const topSide = flip ? CHO : HAN, botSide = flip ? HAN : CHO;
    const nm = (side) => state.two ? SIDE_NAME[side] : (side === own ? 'You' : 'Computer');
    const sd = (side) => `${SIDE_NAME[side]} · ${!state.two && side !== own ? LEVELS[state.level].name : side === CHO ? 'moves first' : 'second'} · ${pts(side)}`;
    plate(BL.top, topSide, nm(topSide), sd(topSide), !g.result && g.turn === topSide);
    plate(BL.bot, botSide, nm(botSide), sd(botSide), !g.result && g.turn === botSide);
  }

  // ---- the board and everything on it: the 3D board (marks + projected labels and effects) or the flat art in canonical board space
  const pulse = calm ? 0.6 : 0.5 + 0.5 * Math.sin(T * 4.2);
  if (V) {
    pub({ board: g.board, flip, anim: a, land: state.land, drag: state.drag, sel: state.sel, caps: true });
    const M = (sq, kind, rgb, s, al, add = false) => v3.marks.push({ sq, kind, rgb, s, a: al, add });
    if (state.last) for (const s of [state.last.f, state.last.t]) M(s, 'glow', '255,170,60', 1.25, inLesson ? 0.45 : 0.6);
    const inChk3 = !g.result && inCheckBoard(g.board, g.turn);
    if (inChk3 || (g.result && g.result.why === 'checkmate')) { const k = kingSquare(g.board, g.turn); if (k >= 0) M(k, 'glow', '235,30,15', 1.8 + pulse * 0.25, 0.75 + pulse * 0.2); }
    if (g.bik && !g.result) for (const side of [CHO, HAN]) { const k = kingSquare(g.board, side); if (k >= 0) M(k, 'glow', '255,190,30', 1.7 + pulse * 0.2, 0.7 + pulse * 0.2); }
    if (state.sel >= 0) { M(state.sel, 'glow', '255,190,70', 1.9, 0.7, true); M(state.sel, 'ring', '255,186,40', 1.42, 1); }
    if (state.hint && !state.hint.pass) for (const s of [state.hint.from, state.hint.to]) M(s, 'glow', '20,190,100', 1.5 + pulse * 0.15, 0.6 + pulse * 0.3);
    for (const s of state.targets) {
      if (g.board[s] !== 0) M(s, 'ring', '225,35,25', 1.5, 0.75 + pulse * 0.25);
      else { M(s, 'glow', '40,210,120', 1.0 + pulse * 0.12, 0.5 + pulse * 0.25); M(s, 'dot', '18,140,76', 0.5, 0.95); }
      if (state.risks && state.risks.has(s)) M(s, 'dash', '255,140,10', 1.3, 0.85 + pulse * 0.15);
    }
    if (inLesson && !state.lesson.done && state.lesson.showSol) { const st = LESSONS[state.lesson.i].steps[state.lesson.s]; if (Array.isArray(st.sol)) for (const pt of st.sol) M(pt[1] * 9 + pt[0], 'glow', '20,190,100', 1.5, 0.6 + pulse * 0.3); }
    if (inAuto && state.autoPhase === 'reveal' && state.hint) M(state.hint.to, 'ring', '255,200,40', 1.4 + pulse * 0.15, 0.8 + pulse * 0.2);
    if (state.kb && !a) M(state.cursor, 'square', '40,220,140', 1.05, 0.95);
    // file letters and rank numbers on the board's border, as Cho sees them (turned round when you play Han)
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = state.board === 'night' ? 'rgba(236,214,160,0.6)' : 'rgba(52,30,12,0.62)';
    const lab = (str, cx, cy) => { const p = v3.proj(cx, cy); ctx.font = `700 ${Math.max(11, 17 * p.k).toFixed(1)}px ${UI}`; ctx.fillText(str, p.x, p.y); };
    for (let i = 0; i < 9; i++) lab(FILES[flip ? 8 - i : i], GX + i * D, GY + 9 * D + 56);
    for (let j = 0; j < 10; j++) lab(String(flip ? j + 1 : 10 - j), GX - 58, GY + j * D);
    ctx.restore();
    // tap rings and capture sparks, laid onto the tilted board
    for (const r of state.rings) { const f = r.t / 0.5; if (f < 1) { const c = v3.proj(r.x, r.y), e = v3.proj(r.x + 20 + f * 60, r.y), n = v3.proj(r.x, r.y + 20 + f * 60); ctx.save(); ctx.strokeStyle = `rgba(255,220,130,${1 - f})`; ctx.lineWidth = (6 * (1 - f) + 1) * c.k; ctx.beginPath(); ctx.ellipse(c.x, c.y, Math.hypot(e.x - c.x, e.y - c.y), Math.hypot(n.x - c.x, n.y - c.y), 0, 0, TAU); ctx.stroke(); ctx.restore(); } }
    for (const q of state.parts) { const f = q.t / q.max; if (f < 1) { const c = v3.proj(q.x, q.y, 0.6 + f * 1.5); ctx.fillStyle = `rgba(${q.c},${1 - f})`; ctx.beginPath(); ctx.arc(c.x, c.y, q.size * (1 - f * 0.6) * c.k, 0, TAU); ctx.fill(); } }
    if (inAuto && state.paused) { const R = BL.boardRect; ctx.fillStyle = 'rgba(4,14,12,0.3)'; ctx.beginPath(); ctx.roundRect(R.x, R.y, R.w, R.h, 18); ctx.fill(); }
    if (state.banner && state.banner.t < 1.4) {
      const c = v3.proj(360, GY_MID), f = state.banner.t / 1.4, sc = (1 + Math.max(0, 0.4 - f * 2)) * BL.s, al = f < 0.75 ? 1 : 1 - (f - 0.75) * 4;
      ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.translate(c.x, c.y); ctx.scale(sc, sc);
      const bk = state.banner.text === 'Pass' || state.banner.text.startsWith('Bikjang');
      plaque({ x: -210, y: -56, w: 420, h: 112 }, bk ? 'jade' : 'red');
      text(state.banner.text, 0, 24, fit(state.banner.text, 380, state.banner.text.length > 8 ? 54 : 72, TITLE, 700, 30), '#fff2cf', TITLE, 700); ctx.restore();
    }
  }
  if (fa > 0) {
  ctx.save(); ctx.globalAlpha = fa; ctx.translate(BL.ox, BL.oy); ctx.scale(BL.s, BL.s);
  drawBoard(ctx, state.board, lang);
  // coordinates along the frame (files a..i, ranks 1..10 as Cho sees them; turned round when you play Han)
  ctx.save(); ctx.font = `700 17px ${UI}`; ctx.fillStyle = state.board === 'night' ? 'rgba(217,192,122,0.55)' : 'rgba(45,27,14,0.5)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 9; i++) ctx.fillText(FILES[flip ? 8 - i : i], GX + i * D, GY + 9 * D + 50);
  for (let j = 0; j < 10; j++) ctx.fillText(String(flip ? j + 1 : 10 - j), 30, GY + j * D);
  ctx.restore();
  const pos = (s) => pointXY(s, flip);
  if (state.last) for (const s of [state.last.f, state.last.t]) { const p = pos(s); blob(ctx, p.x, p.y, 54, 54, '255,205,90', inLesson ? 0.4 : 0.5); }
  const inChk = !g.result && inCheckBoard(g.board, g.turn);
  if (inChk || (g.result && g.result.why === 'checkmate')) { const k = kingSquare(g.board, g.turn); if (k >= 0) { const p = pos(k); blob(ctx, p.x, p.y, 78 + pulse * 10, 78 + pulse * 10, '255,50,30', 0.6 + pulse * 0.3); } }
  if (g.bik && !g.result) for (const side of [CHO, HAN]) { const k = kingSquare(g.board, side); if (k >= 0) { const p = pos(k); blob(ctx, p.x, p.y, 74 + pulse * 8, 74 + pulse * 8, '255,200,60', 0.5 + pulse * 0.25); } }
  if (state.sel >= 0) { const p = pos(state.sel); blob(ctx, p.x, p.y, 66, 66, '255,214,110', 0.7); }
  if (state.hint && !state.hint.pass) for (const s of [state.hint.from, state.hint.to]) { const p = pos(s); blob(ctx, p.x, p.y, 62 + pulse * 8, 62 + pulse * 8, '90,255,160', 0.55 + pulse * 0.25); }
  for (const s of state.targets) {
    const p = pos(s), cap = g.board[s] !== 0, risky = state.risks && state.risks.has(s);
    if (cap) { blob(ctx, p.x, p.y, 62, 62, '255,60,40', 0.4 + pulse * 0.25); }
    else { blob(ctx, p.x, p.y, 34 + pulse * 5, 34 + pulse * 5, '70,220,140', 0.65 + pulse * 0.25); ctx.fillStyle = 'rgba(214,255,226,0.95)'; ctx.beginPath(); ctx.arc(p.x, p.y, 7.5, 0, TAU); ctx.fill(); }
    if (risky) { ctx.save(); ctx.strokeStyle = `rgba(255,176,40,${0.75 + pulse * 0.25})`; ctx.lineWidth = 5; ctx.setLineDash([9, 7]); ctx.beginPath(); ctx.arc(p.x, p.y, 33, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
  if (inLesson && !state.lesson.done && state.lesson.showSol) { const st = LESSONS[state.lesson.i].steps[state.lesson.s]; if (Array.isArray(st.sol)) for (const pt of st.sol) { const p = pos(pt[1] * 9 + pt[0]); blob(ctx, p.x, p.y, 62, 62, '90,255,160', 0.5 + pulse * 0.3); } }
  // Auto Play REVEAL: a bold gold ring around the destination of the move about to be played.
  if (inAuto && state.autoPhase === 'reveal' && state.hint) {
    const p = pos(state.hint.to);
    ctx.save(); ctx.strokeStyle = `rgba(255,214,80,${0.75 + pulse * 0.25})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(p.x, p.y, 30 + pulse * 6, 0, TAU); ctx.stroke(); ctx.restore();
  }
  // pieces (top to bottom so lower ones overlap upper ones' shadows naturally)
  const moving = a && (a.type === 'move' || a.type === 'refuse') ? a : null, dragSq = state.drag && state.drag.moved ? state.drag.sq : -1;
  const drawAt = (p, s, o = {}) => { const q = pos(s); piece(p, q.x + (o.dx ?? 0), q.y + (o.dy ?? 0), o); };
  for (let s = 0; s < 90; s++) {
    const p = g.board[s]; if (!p) continue;
    if (moving && a.type === 'move' && s === a.to) continue;
    if (moving && a.type === 'refuse' && s === a.from) continue;
    if (s === dragSq) continue;
    let lift = s === state.sel ? 1 : 0, bob = lift && !calm ? Math.sin(T * 5) * 1.5 : 0, sc = lift ? 1.06 : 1;
    if (state.land && state.land.sq === s && !calm) { const f = Math.min(1, state.land.t / 0.24), k = (1 - f) * (1 - f); lift = Math.max(lift, k * 0.7); sc = 1 + 0.06 * k; }
    drawAt(p, s, { lift, dy: bob, scale: sc });
  }
  if (moving && a.type === 'move' && a.cap) { const f = Math.min(1, a.t / a.dur); if (f < 0.98) drawAt(a.cap, a.to, { alpha: 1 - Math.max(0, (f - 0.7) / 0.28), scale: 1 - Math.max(0, (f - 0.7)) * 0.6 }); }
  if (moving) {
    const f = Math.min(1, a.t / a.dur), from = pos(a.from), to = pos(a.to);
    if (a.type === 'move') {
      const e = f * f * (3 - 2 * f), x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e, lift = Math.sin(Math.PI * f) * 1.25;
      piece(a.p, x, y, { lift, scale: 1 + lift * 0.06 });
    } else {
      const reach = 0.55, out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = out * out * (3 - 2 * out) * reach;
      const shake = calm ? 0 : f >= 0.38 && f < 0.64 ? Math.sin(f * 110) * 5 : 0;
      piece(a.p, from.x + (to.x - from.x) * e + shake, from.y + (to.y - from.y) * e, { lift: 0.5 * Math.sin(Math.PI * Math.min(1, f * 1.1)) });
      if (f > 0.34 && f < 0.7) { ctx.save(); ctx.strokeStyle = `rgba(255,90,60,${0.8 * (1 - Math.abs(f - 0.5) * 4)})`; ctx.lineWidth = 4; const q = pos(a.to); ctx.beginPath(); ctx.moveTo(q.x - 16, q.y - 16); ctx.lineTo(q.x + 16, q.y + 16); ctx.moveTo(q.x + 16, q.y - 16); ctx.lineTo(q.x - 16, q.y + 16); ctx.stroke(); ctx.restore(); }
    }
  }
  if (dragSq >= 0) piece(g.board[dragSq], state.drag.x, state.drag.y - 46, { lift: 1.2, scale: 1.12 });
  if (state.kb && !moving) { const p = pos(state.cursor); ctx.save(); ctx.strokeStyle = '#7fffc0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(p.x - 38, p.y - 38, 76, 76, 12); ctx.stroke(); ctx.restore(); }
  for (const r of state.rings) { const f = r.t / 0.5; if (f < 1) { ctx.save(); ctx.strokeStyle = `rgba(255,220,130,${1 - f})`; ctx.lineWidth = 6 * (1 - f) + 1; ctx.beginPath(); ctx.arc(r.x, r.y, 20 + f * 60, 0, TAU); ctx.stroke(); ctx.restore(); } }
  for (const q of state.parts) { const f = q.t / q.max; if (f < 1) { ctx.fillStyle = `rgba(${q.c},${1 - f})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - f * 0.6), 0, TAU); ctx.fill(); } }
  if (inAuto && state.paused) { ctx.fillStyle = 'rgba(4,14,12,0.35)'; ctx.fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h); }
  if (state.banner && state.banner.t < 1.4) {
    const f = state.banner.t / 1.4, sc = 1 + Math.max(0, 0.4 - f * 2), al = f < 0.75 ? 1 : 1 - (f - 0.75) * 4;
    ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.translate(360, GY_MID); ctx.scale(sc, sc);
    const bk = state.banner.text === 'Pass' || state.banner.text.startsWith('Bikjang');
    ctx.fillStyle = bk ? 'rgba(20,90,70,0.92)' : 'rgba(160,20,14,0.9)'; ctx.beginPath(); ctx.roundRect(-210, -56, 420, 112, 20); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.stroke();
    text(state.banner.text, 0, 24, fit(state.banner.text, 380, state.banner.text.length > 8 ? 54 : 72, TITLE, 700, 30), '#fff2cf', TITLE, 700); ctx.restore();
  }
  ctx.restore();
  }

  // ---- message panel
  const mr = BL.msg;
  panel(mr, 0.5);
  const m = state.msg;
  const line = inAuto ? autoMessage(state) : m ? m.text : defaultMessage(state);
  const col = m ? (m.kind === 'warn' ? '#ffcf8a' : m.kind === 'good' ? '#c9f7c0' : CREAM) : CREAM;
  const tip = inLesson && !state.lesson.done && mr.h >= 150;
  const dots = inLesson ? 26 : 0, tipH = tip ? (mr.w < 420 ? 62 : 36) : 0;
  const chipH = BL.tutor && !BL.tight ? 46 : 0;
  const box = { x: mr.x + 20, y: mr.y + 12, w: mr.w - 40 - (BL.tutor && BL.tight ? BL.tutor.w + 8 : 0), h: Math.max(30, mr.h - 24 - tipH - dots - chipH) };
  fitWrap(line, box, big ? 34 : 29, inAuto && state.autoPhase === 'reveal' ? '#8de08a' : col, { min: 17, lhK: big ? 1.3 : 1.31, weight: 600 });
  if (tip) { const tr = { x: mr.x + 20, y: mr.y + mr.h - dots - tipH - 4, w: mr.w - 40, h: tipH }; fitWrap('TAP a piece, then TAP a glowing point. Or DRAG it there.', tr, 22, 'rgba(242,210,122,0.85)', { min: 17, lhK: 1.2 }); }
  if (BL.tutor) {
    const r = BL.tutor; ctx.save();
    ctx.fillStyle = state.tutor ? 'rgba(47,138,98,0.85)' : 'rgba(20,40,36,0.8)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 19); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,140,0.6)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
    text(`Tutor: ${state.tutor ? 'on' : 'off'}`, r.x + r.w / 2, r.y + r.h / 2 + 8, 22, CREAM, UI, 700);
    if (!m && state.tutor && !g.result) { /* the default line already explains what to do */ }
  }
  if (inLesson) { const l = LESSONS[state.lesson.i]; l.steps.forEach((_, k) => { ctx.fillStyle = k < state.lesson.s || (k === state.lesson.s && state.lesson.done) ? '#8de08a' : k === state.lesson.s ? GOLD : 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(mr.x + mr.w / 2 + (k - (l.steps.length - 1) / 2) * 26, mr.y + mr.h - 14, 7, 0, TAU); ctx.fill(); }); }

  // ---- buttons
  if (inAuto) {
    // Think-time stepper: an index into THINK_STEPS (never a raw float).
    stepper(BL.stepper, state.autoThinkIdx === 0, state.autoThinkIdx === THINK_STEPS.length - 1, `Think: ${THINK_STEPS[state.autoThinkIdx]}s`);
    button(BL.btn.pause, state.paused ? 'Resume' : 'Pause', { primary: state.paused }); button(BL.btn.exit, 'Exit', {});
  } else if (inLesson) {
    const st = LESSONS[state.lesson.i].steps[state.lesson.s], dn = state.lesson.done, last = state.lesson.s + 1 >= LESSONS[state.lesson.i].steps.length;
    button(BL.btn.menu, 'Lessons', {}); button(BL.btn.hint, 'Hint', { dim: dn || st.want.read });
    button(BL.btn.pass, 'Pass', { dim: dn || !st.want.pass, primary: !dn && !!st.want.pass });
    button(BL.btn.next, dn ? (!last ? 'Next step' : state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish') : 'Restart', { primary: dn });
  } else {
    const cantPass = !g.result && (!(canPass(g) || g.bik) || state.thinking || !!state.anim || (!state.two && g.turn !== own));
    button(BL.btn.menu, 'Menu', {}); button(BL.btn.undo, 'Undo', { dim: g.log.length === 0 });
    button(BL.btn.hint, g.result ? 'New game' : `Think (${state.hintsLeft})`, { dim: !g.result && (state.hintsLeft <= 0 || state.thinking), primary: !!g.result });
    button(BL.btn.pass, g.bik && !g.result ? (BL.btn.pass.w < 140 ? 'Bikjang' : 'Call bikjang') : 'Pass', { dim: cantPass, warn: g.bik && !g.result, size: g.bik ? 24 : undefined });
  }

  // ---- move list (landscape / tablet side panel)
  if (BL.hist) {
    const r = BL.hist; panel(r, 0.5);
    text('Moves', r.x + 18, r.y + 30, 22, GOLD, TITLE, 700, 'left');
    const rows = Math.max(1, Math.floor((r.h - 50) / 31)), log = g.log, from = Math.max(0, log.length - rows);
    for (let i = from; i < log.length; i++) {
      const e = log[i], first = state.scene === 'autoplay' || true, mover = ((i % 2 === 0) === (g.startTurn !== HAN)) ? CHO : HAN, y = r.y + 58 + (i - from) * 31 + 14;
      text(String(i + 1), r.x + 40, y, 17, 'rgba(248,240,216,0.45)', UI, 600, 'right');
      if (e.pass) { text('pass', r.x + 56, y, 20, mover === CHO ? CHO_C : HAN_C, UI, 600, 'left'); continue; }
      text(glyph(e.p || mover, lang), r.x + 76, y + 1, 24, mover === CHO ? CHO_C : HAN_C, lang === 'en' ? LATIN : CJK, 700);
      const t = `${sqName(e.f)} → ${sqName(e.t)}${e.cap ? '  × ' + glyph(e.cap, lang) : ''}`;
      text(t, r.x + 98, y, 20, mover === CHO ? CHO_C : HAN_C, UI, 600, 'left');
    }
    if (!log.length) text('No moves yet', r.x + r.w / 2, r.y + r.h / 2 + 6, 20, 'rgba(248,240,216,0.45)', UI, 600);
  }

  // ---- result panel
  if (state.overOpen && g.result) {
    const RS = L.res();
    ctx.fillStyle = 'rgba(2,10,8,0.68)'; ctx.fillRect(0, 0, SW, SH);
    panel(RS.panel, 0.93, 0.6);
    const r = g.result, humanWon = !state.two && !inAuto && r.winner === own, drew = r.winner === 0;
    const title = drew ? 'A draw' : (state.two || inAuto) ? `${SIDE_NAME[r.winner]} wins` : humanWon ? 'You win!' : 'The computer wins';
    const fm = (n) => (n % 1 ? n.toFixed(1) : String(n));
    const why = {
      checkmate: 'Checkmate.', repetition: 'The same position three times: a draw.', bikjang: 'Bikjang: the generals face each other and nobody can or will break it. A draw.',
      count: `Both players passed, so the pieces are counted: Cho ${fm(r.cho ?? 0)}, Han ${fm(r.han ?? 0)} (including 1.5 for moving second).`,
      quiet: `${NO_CAPTURE_LIMIT} moves without a capture, so the pieces are counted: Cho ${fm(r.cho ?? 0)}, Han ${fm(r.han ?? 0)} (including 1.5 for moving second).`,
    }[r.why];
    piece(drew ? 1 : r.winner, RS.piece.x, RS.piece.y, { R: 32, scale: RS.piece.scale, lift: 0.5 + (calm ? 0 : Math.sin(T * 3) * 0.3) });
    if (inAuto) text('AUTO-PLAY DEMO — not saved', RS.tag.x, RS.tag.y, fit('AUTO-PLAY DEMO — not saved', RS.title.max, 22, UI, 700), 'rgba(242,210,122,0.85)', UI, 700);
    text(title, RS.title.x, RS.title.y, fit(title, RS.title.max, 62, TITLE, 700), GOLD, TITLE);
    wrap(why, RS.why.x, RS.why.y, 24, RS.why.max, CREAM, 30);
    if (inAuto) { button(RS.again, 'Watch again', { primary: true }); button(RS.look, 'Look at the board', {}); button(RS.menu, 'Exit to menu', {}); }
    else { button(RS.again, 'Play again', { primary: true }); button(RS.look, 'Look at the board', {}); button(RS.menu, 'Menu', {}); }
    drawMoreLine(ctx, RS.more.x, RS.more.y, 21);
  }
}

// The THINK/REVEAL phase, shown in the message panel instead of the usual default/status message.
function autoMessage(state) {
  if (state.g.result) return 'Game over — see the result below.';
  if (state.paused) return 'Paused. Tap Resume to carry on exactly where it stopped.';
  const side = state.g.turn === CHO ? 'Cho' : 'Han';
  if (state.autoPhase === 'reveal') return state.autoMove && state.autoMove.pass ? `${side} will pass.` : 'Here is the move about to be played (highlighted in green).';
  return `${side} is thinking… try to guess the move before it is revealed.`;
}

function defaultMessage(state) {
  const g = state.g, scene = state.scene;
  if (scene === 'lesson') return state.lesson.done ? LESSONS[state.lesson.i].steps[state.lesson.s].done : 'Follow the step above. Ask for a Hint if you are stuck.';
  if (g.result) { const r = g.result; return r.winner === 0 ? 'The game is drawn.' : `${SIDE_NAME[r.winner]} wins${r.why === 'checkmate' ? ' by checkmate' : ''}.`; }
  if (g.bik) return (state.two || g.turn === state.human) ? 'Bikjang! The generals face each other. Break it by blocking, capturing or moving the general, or call bikjang for a draw.' : 'Bikjang: waiting for the reply.';
  if (state.sel >= 0 && !state.thinking) return 'Green points: where it can go. A red glow: a piece you can capture. Tap a point to move, or tap the piece again to put it down.';
  if (state.thinking) return `The computer is thinking${'.'.repeat(1 + (Math.floor(state.t * 3) % 3))}`;
  if (state.two) return `${SIDE_NAME[g.turn]} to move. TAP a piece, then TAP a glowing point.`;
  return g.log.length === 0 && state.human === CHO ? 'Your move. TAP one of your green pieces, then TAP a glowing point (or DRAG it).' : 'Your move.';
}
