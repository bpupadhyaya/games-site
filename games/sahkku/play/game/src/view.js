// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, R, clamp } from './layout.js';
import { drawBackdrop, drawBoard, drawHerder, drawKing, drawDie as drawDieFlat, drawDie, miniBoard, miniSize, SIDE, WOODS } from './art.js';
import { RULES, HOWTO, ABOUT } from './content.js';
import { settingsItems } from './settings.js';
import { NAMES, N, CAMP, CENTRE, DAWN, menLeft } from './rules.js';
import { LEVELS } from './ai.js';
import { drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';
import { v3 } from './v3.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GOLD = '#ffd98a', CREAM = '#fff8ea', DIM = 'rgba(200,220,255,0.78)', ICE = '#9fd2ff';
const TAU = Math.PI * 2;
export const ui = { hits: [], buttons: [] };
export const docMetrics = { max: 0, view: 0 };
const fitMemo = new Map(); let fitFontsKey = '';
const ease = (f) => f * f * (3 - 2 * f);

export function render(ctx, state, L) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== fitFontsKey || fitMemo.size > 3000) { fitMemo.clear(); fitFontsKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { v = fn(); fitMemo.set(key, v); } return v; };
  ui.hits.length = 0; ui.buttons.length = 0;
  const scene = state.scene, scale = TEXT_SCALES[state.textScaleIdx] ?? 1, big = scale > 1, g = state.game, a = state.anim, B = L.board;
  const minU = Math.max(12, 11 / (host.px || 0.6));
  const wood = state.wood, style = state.style;

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
  const panel = (r, rad = 18, fill = 'rgba(6,12,32,0.66)', stroke = 'rgba(159,210,255,0.24)', brand = true, kind = 'slate') => {
    if (v3.on) { v3.panels.push({ r, rad, kind }); return; }
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.3);
  };
  // line icons for the menu buttons (drawn in the label colour, 0..1 box scaled to s)
  const icon = (kind, cx, cy, s, col) => {
    ctx.save(); ctx.translate(cx - s / 2, cy - s / 2); ctx.scale(s, s); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 0.09; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    const C = (x, y, r) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832); };
    if (kind === 'play') { ctx.moveTo(0.3, 0.14); ctx.lineTo(0.88, 0.5); ctx.lineTo(0.3, 0.86); ctx.closePath(); ctx.fill(); }
    else if (kind === 'two') { C(0.34, 0.34, 0.16); C(0.7, 0.38, 0.13); ctx.moveTo(0.08, 0.9); ctx.quadraticCurveTo(0.34, 0.42, 0.6, 0.9); ctx.moveTo(0.62, 0.7); ctx.quadraticCurveTo(0.72, 0.58, 0.94, 0.86); ctx.stroke(); }
    else if (kind === 'auto') { ctx.rect(0.12, 0.12, 0.76, 0.76); ctx.moveTo(0.4, 0.3); ctx.lineTo(0.7, 0.5); ctx.lineTo(0.4, 0.7); ctx.closePath(); ctx.stroke(); }
    else if (kind === 'rules') { ctx.rect(0.2, 0.1, 0.6, 0.8); ctx.moveTo(0.34, 0.34); ctx.lineTo(0.66, 0.34); ctx.moveTo(0.34, 0.52); ctx.lineTo(0.66, 0.52); ctx.moveTo(0.34, 0.7); ctx.lineTo(0.56, 0.7); ctx.stroke(); }
    else if (kind === 'how') { C(0.5, 0.5, 0.4); ctx.moveTo(0.38, 0.4); ctx.quadraticCurveTo(0.4, 0.26, 0.52, 0.27); ctx.quadraticCurveTo(0.66, 0.28, 0.64, 0.42); ctx.quadraticCurveTo(0.62, 0.5, 0.52, 0.56); ctx.lineTo(0.5, 0.64); ctx.stroke(); ctx.beginPath(); C(0.5, 0.78, 0.04); ctx.fill(); }
    else if (kind === 'about') { C(0.5, 0.5, 0.4); ctx.moveTo(0.5, 0.46); ctx.lineTo(0.5, 0.72); ctx.stroke(); ctx.beginPath(); C(0.5, 0.29, 0.05); ctx.fill(); }
    else if (kind === 'gear') { for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.moveTo(0.5 + Math.cos(a) * 0.3, 0.5 + Math.sin(a) * 0.3); ctx.lineTo(0.5 + Math.cos(a) * 0.46, 0.5 + Math.sin(a) * 0.46); } C(0.5, 0.5, 0.3); C(0.5, 0.5, 0.11); ctx.stroke(); }
    ctx.restore();
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(18, r.h / 3);
    if (v3.on) { v3.buttons.push({ r, rad, label, primary: !!o.primary, on: !!o.on, dim: !!o.dim }); if (o.dim) ctx.globalAlpha = 0.62; }
    else {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#e8503a'); gr.addColorStop(1, '#8e1c10'); } else if (o.on) { gr.addColorStop(0, '#3d6fb0'); gr.addColorStop(1, '#1d3d6e'); } else { gr.addColorStop(0, '#2c4478'); gr.addColorStop(1, '#16244a'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,214,150,0.85)' : 'rgba(159,210,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    }
    const size = o.size ?? 28, ic = o.icon ? Math.min(34, r.h * 0.5) : 0, maxW = r.w - 20 - (ic ? ic + 8 : 0), col = o.primary ? '#fff6e0' : '#e8f2ff', cy = r.y + r.h / 2;
    const lx = ic ? r.x + 14 + ic + 8 + (r.w - 28 - ic - 8) / 2 : r.x + r.w / 2;
    if (ic) icon(o.icon, r.x + 14 + ic / 2, cy, ic, col);
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
    if (o.sub && best.ls.length === 1) { text(label, lx, cy + best.s * 0.1 - 6, best.s, col, UI, 700); fitText(o.sub, lx, cy + best.s * 0.1 + Math.max(minU, size * 0.62) + 2, Math.round(size * 0.62), maxW, DIM, UI, 500, 'center', minU); }
    else if (best.ls.length === 1) text(label, lx, cy + best.s * 0.35, best.s, col, UI, 700);
    else best.ls.forEach((ln, i) => text(ln, lx, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s, col, UI, 700));
    ctx.restore();
  };

  const SQ = (i) => (v3.on && v3.sq ? v3.sq(i) : L.sq(i));

  // ---------------------------------------------------------------- scenes
  drawBackdrop(ctx, L, state.t, state.calm);
  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();
  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(5,10,28,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function drawTitle() {
    const T = L.title(!!state.saved), Rr = T.rows;
    if (T.card) panel(T.card, 24, 'rgba(6,12,32,0.58)');
    hero(T.hero);
    if (scene === 'demo-limit') {
      const r = T.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!T.card) panel(r, 24, 'rgba(6,12,32,0.76)');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, GOLD, FONT, 700);
      wrapBox('Get Sáhkku on iPhone and Android for unlimited games, every computer level and all boards.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      if (Rr.resume) button(Rr.resume, 'Continue your game', { primary: true, size: 30 });
      button(Rr.play, 'Play the computer', { primary: !Rr.resume, size: 34, icon: 'play', sub: `${LEVELS[state.level].name} · as ${NAMES[state.humanSide]}` });
      button(Rr.two, 'Two players', { size: 26, icon: 'two' }); button(Rr.auto, 'Auto Play', { size: 26, icon: 'auto' });
      button(Rr.rules, 'Rules', { size: 26, icon: 'rules' }); button(Rr.how, 'How to Play', { size: 25, icon: 'how' });
      button(Rr.about, 'About', { size: 26, icon: 'about' }); button(Rr.settings, 'Settings', { size: 26, icon: 'gear' });
      if (state.msg) fitText(state.msg.text, L.w / 2, Rr.play.y - 14, 24, L.w - 40, GOLD, UI, 600);
    }
    const lk = T.lockup; state.lockupRect = drawLockup(ctx, lk.x, lk.y + 4, 50);
  }

  function goldTitle(str, cx, y, size, maxW) {
    ctx.save();
    ctx.font = `700 ${size}px ${FONT}`; let q = size; while (q > 24 && ctx.measureText(str).width > maxW) { q -= 1; ctx.font = `700 ${q}px ${FONT}`; }
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    if (!v3.on) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
      const grad = ctx.createLinearGradient(0, y - q * 0.8, 0, y + q * 0.1); grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#9fd2ff');
      ctx.fillStyle = grad; ctx.fillText(str, cx, y); ctx.restore(); return q;
    }
    // aurora glow, then an embossed gold face on a deep-brown extrusion
    ctx.shadowColor = 'rgba(110,255,200,0.7)'; ctx.shadowBlur = q * 0.4; ctx.fillStyle = '#2a1204'; ctx.fillText(str, cx, y); ctx.shadowBlur = 0;
    const depth = Math.max(3, q * 0.06);
    for (let i = depth; i >= 1; i--) { ctx.fillStyle = i > depth * 0.6 ? '#3b1a06' : '#6b3a0c'; ctx.fillText(str, cx + i * 0.45, y + i); }
    const g = ctx.createLinearGradient(0, y - q * 0.72, 0, y + q * 0.08);
    g.addColorStop(0, '#fffbe0'); g.addColorStop(0.28, '#ffe27a'); g.addColorStop(0.52, '#f3b02a'); g.addColorStop(0.58, '#b8700f'); g.addColorStop(0.8, '#e9a526'); g.addColorStop(1, '#ffd96a');
    ctx.fillStyle = g; ctx.fillText(str, cx, y);
    ctx.lineWidth = Math.max(1.5, q * 0.014); ctx.strokeStyle = 'rgba(255,248,214,0.9)'; ctx.strokeText(str, cx, y - 0.5);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.restore();
    return q;
  }
  function hero(r) {
    const cx = r.x + r.w / 2;
    const ts = clamp(L.land ? Math.min(r.w / 4.6, r.h / 3.4) : Math.min(r.w / 5.4, r.h * 0.17), 48, 150), y0 = r.y + ts * 0.92;
    goldTitle('Sáhkku', cx, y0, ts, r.w - 10);
    const sub = Math.max(minU, ts * 0.17), pw = Math.min(r.w * 0.75, ts * 5.2), py = y0 + ts * 0.22;
    if (v3.on) {
      // a woven band: dark wool with a four-colour diamond border
      const ph = sub * 2;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#1b0f06'; ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, ph, 6); ctx.fill(); ctx.restore();
      const cols = ['#d23a2a', '#ffd24a', '#2f6bd6', '#3fae5c'], dk = Math.max(5, ph * 0.2), n = Math.floor(pw / (dk * 1.9));
      for (let i = 0; i < n; i++) for (const yy of [py + dk * 0.9, py + ph - dk * 0.9]) {
        const x = cx - pw / 2 + dk + i * ((pw - 2 * dk) / (n - 1)); ctx.fillStyle = cols[i % 4]; ctx.beginPath(); ctx.moveTo(x, yy - dk * 0.6); ctx.lineTo(x + dk * 0.6, yy); ctx.lineTo(x, yy + dk * 0.6); ctx.lineTo(x - dk * 0.6, yy); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,214,120,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(cx - pw / 2 + 1, py + 1, pw - 2, ph - 2, 6); ctx.stroke();
      fitText('SÁMI DICE AND BOARD GAME', cx, py + sub * 1.4, sub * 0.95, pw - 30, '#fff1cf', UI, 800);
    } else {
      const pg = ctx.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0); pg.addColorStop(0, '#d23a2a'); pg.addColorStop(0.5, '#e0a82a'); pg.addColorStop(1, '#2f6bd6');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, sub * 2, sub); ctx.fill();
      fitText('SÁMI DICE AND BOARD GAME', cx, py + sub * 1.4, sub, pw - 20, '#fff', UI, 800);
    }
    const top = py + sub * 2 + ts * 0.18, room = r.y + r.h - top;
    if (room > 120) {
      const rr = R(r.x, top, r.w, room - 6);
      if (v3.on) { const c = clamp(Math.min((rr.w - 8) / 8, (rr.h - 6) / 8), 24, 120), S = c * 8; v3.heroRect = { x: rr.x + (rr.w - S) / 2, y: rr.y + (rr.h - S) / 2, w: S, h: S }; }
      else heroBoard(rr);
    } else if (v3.on) v3.heroRect = { x: L.w / 2 - 1, y: L.h + 40, w: 2, h: 2 };
  }

  // a looping demonstration: a red herder runs, captures a blue one, then wins the king
  function heroBoard(r) {
    const c = clamp(Math.min((r.w - 8) / (N + 1), (r.h - 6) / (N + 1)), 24, 80);
    const S = c * (N + 1), x0 = r.x + (r.w - S) / 2, y0 = r.y + (r.h - S) / 2;
    const T = state.calm ? 2.2 : state.t % 9;
    const cell = (rr, cc) => rr * N + cc;
    const bx = { x: x0, y: y0, S, cell: c, gx: x0 + c * 0.5, gy: y0 + c * 0.5 };
    const sq = (i) => ({ x: bx.gx + ((i % N) + 0.5) * c, y: bx.gy + (Math.floor(i / N) + 0.5) * c });
    bx.sq = sq;
    drawBoard(ctx, bx, wood);
    // timeline: 0-1 dice, 1-2.4 red 1 -> 4 captures blue, 4-5.4 red 10 -> 24 wins the king
    const lerp = (p0, p1, f) => ({ x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f });
    const f1 = ease(clamp((T - 1) / 1.4, 0, 1)), f2 = ease(clamp((T - 4) / 1.4, 0, 1));
    const blueAlive = T < 2.4, kingOwner = T < 5.4 ? -1 : 0;
    const pr = lerp(sq(cell(0, 1)), sq(cell(0, 4)), f1), pr2 = lerp(sq(cell(1, 3)), sq(cell(3, 3)), f2);
    ctx.save();
    if (blueAlive) drawHerder(ctx, 1, sq(cell(0, 4)).x, sq(cell(0, 4)).y, c * 0.95, { alpha: T > 2.2 ? 1 - (T - 2.2) / 0.2 : 1 });
    drawHerder(ctx, 1, sq(cell(6, 3)).x, sq(cell(6, 3)).y, c * 0.95);
    const k = sq(CENTRE); drawKing(ctx, kingOwner, k.x, k.y, c * 0.95, state.t);
    drawHerder(ctx, 0, pr.x, pr.y, c * 0.95, { lift: f1 > 0 && f1 < 1 ? Math.sin(Math.PI * f1) * 0.9 : 0 });
    if (T > 3.2) drawHerder(ctx, 0, pr2.x, pr2.y, c * 0.95, { lift: f2 > 0 && f2 < 1 ? Math.sin(Math.PI * f2) * 0.9 : 0 });
    ctx.restore();
    // the four dice drop in at the start
    const ds = c * 0.8;
    for (let i = 0; i < 4; i++) { const f = clamp((T - i * 0.08) / 0.8, 0, 1); if (T < 1.2 || (T > 3.6 && T < 4.4)) drawDie(ctx, [2, 3, 0, 1][i], x0 + S / 2 + (i - 1.5) * (ds + 6), y0 + S + 4 - (1 - ease(f)) * 30, ds, { spin: f < 1 && !state.calm ? f : 0 }); }
  }

  // ================================================================ play / over
  function drawPlayScreen() {
    const over = scene === 'over', cell = B.cell, me = g.turn;
    if (L.land) { if (L.leftCard) panel(L.leftCard, 18); panel(L.rightCard, 18); }
    ctx.save();
    if (a && a.cap && !state.calm && a.t > a.glide && a.t < a.glide + 0.35) { const f = (a.t - a.glide) / 0.35; ctx.translate(Math.sin(f * 46) * (1 - f) * cell * 0.045, Math.cos(f * 38) * (1 - f) * cell * 0.03); }
    const D3 = v3.on;
    if (!D3) drawBoard(ctx, B, wood);
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    const tint = (i, col) => { const p = L.sq(i); ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(p.x - cell * 0.45, p.y - cell * 0.45, cell * 0.9, cell * 0.9, cell * 0.12); ctx.fill(); };
    const last = a ? null : g.last;
    if (last && !over && !D3) { if (last.from >= 0) tint(last.from, 'rgba(255,214,110,0.24)'); tint(last.to, 'rgba(255,214,110,0.3)'); }
    const mine = !state.autoMode && g.phase === 'move' && !a && !state.rollAnim && !over && (state.two || me === state.humanSide);
    // which of my pieces can move (a quiet pulse), or the die-filter's candidates
    if (mine && !D3 && state.sel < 0 && state.selKind !== 'wake') {
      const seen = new Set(); for (const m of state.viewMoves || []) { if (m.from >= 0 && !seen.has(m.from) && (state.dieFilter < 0 || g.dice[state.dieFilter] === m.val)) { seen.add(m.from); const p = L.sq(m.from); ctx.strokeStyle = `rgba(120,255,170,${0.35 + pulse * 0.35})`; ctx.lineWidth = cell * 0.05; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.42, 0, TAU); ctx.stroke(); } }
    }
    if (mine && !D3 && state.sel >= 0) { const sp = L.sq(state.sel); ctx.fillStyle = `rgba(255,224,120,${0.28 + pulse * 0.14})`; ctx.beginPath(); ctx.roundRect(sp.x - cell * 0.46, sp.y - cell * 0.46, cell * 0.92, cell * 0.92, cell * 0.14); ctx.fill(); }
    if (mine) for (const m of state.selMoves) {
      const p = SQ(m.to);
      if (D3) {
        const s3 = cell * 0.2, bx = p.x + cell * 0.26, by = p.y - cell * 0.34;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
        const bg = ctx.createRadialGradient(bx - s3 * 0.3, by - s3 * 0.35, s3 * 0.1, bx, by, s3);
        if (m.cap) { bg.addColorStop(0, '#ff7a5e'); bg.addColorStop(1, '#a8200e'); } else if (m.flip) { bg.addColorStop(0, '#ffe27a'); bg.addColorStop(1, '#b57a08'); } else { bg.addColorStop(0, '#6aa6f0'); bg.addColorStop(1, '#173f84'); }
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, s3, 0, TAU); ctx.fill(); ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, s3, 0, TAU); ctx.stroke();
        text(m.kind === 'wake' ? 'W' : m.val === DAWN ? '☼' : String(m.val), bx, by + s3 * 0.38, s3 * 1.15, '#fff', UI, 800);
        continue;
      }
      if (m.cap || m.flip) {
        const col = m.cap ? '226,60,36' : '255,200,40';
        ctx.strokeStyle = `rgba(${col},${0.75 + pulse * 0.25})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.4, 0, TAU); ctx.stroke(); ctx.fillStyle = `rgba(${col},0.2)`; ctx.fill();
      } else { ctx.fillStyle = `rgba(240,252,255,${0.5 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.2, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(20,50,90,0.6)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      const s = cell * 0.19; ctx.fillStyle = m.cap ? '#e23c24' : m.flip ? '#e0a010' : '#1d4f8f'; ctx.beginPath(); ctx.arc(p.x + cell * 0.3, p.y - cell * 0.3, s, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      text(m.kind === 'wake' ? 'W' : m.val === DAWN ? '☼' : String(m.val), p.x + cell * 0.3, p.y - cell * 0.3 + s * 0.38, s * 1.15, '#fff', UI, 800);
    }
    if (state.hint && !a && !D3) for (const q of [state.hint.from, state.hint.to]) { if (q < 0) continue; const p = L.sq(q); ctx.strokeStyle = 'rgba(90,230,150,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(p.x - cell * 0.46, p.y - cell * 0.46, cell * 0.92, cell * 0.92, cell * 0.14); ctx.stroke(); ctx.fillStyle = `rgba(90,230,150,${0.18 + pulse * 0.14})`; ctx.fill(); }
    if (state.hint && state.hint.kind === 'wake' && !a && !D3) { const p = L.sq(CAMP[me]); ctx.strokeStyle = 'rgba(90,230,150,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.46, 0, TAU); ctx.stroke(); }
    if (mine && !D3 && g.phase === 'move' && state.viewMoves?.some((m) => m.kind === 'wake') && state.sel !== CAMP[me]) { const p = L.sq(CAMP[me]); ctx.strokeStyle = `rgba(255,236,150,${0.5 + pulse * 0.4})`; ctx.setLineDash([cell * 0.12, cell * 0.1]); ctx.lineWidth = cell * 0.06; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.46, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }

    // pieces, top rows first (a lower piece overlaps the one above it)
    const items = [];
    const skipMan = a && (a.kind === 'man' || a.kind === 'wake') ? { p: a.p, to: a.to } : null, skipKing = a && a.kind === 'king' ? a.to : -1;
    for (let i = 0; i < N * N; i++) {
      const arr = [];
      for (let p = 0; p < 2; p++) { let n = g.men[p][i]; if (skipMan && skipMan.p === p && skipMan.to === i) n -= 1; for (let k = 0; k < n; k++) arr.push({ t: 'man', p }); }
      if (a && a.cap && a.to === i && a.t < a.glide) arr.push({ t: 'man', p: 1 - a.p, ghost: true });
      if (g.king.cell === i && skipKing !== i && !(a && a.kind !== 'king' && a.flip && a.to === i && a.t < a.glide)) arr.push({ t: 'king' });
      else if (a && a.flip && a.to === i && a.t < a.glide) arr.push({ t: 'king', ownerOverride: g.king.owner === a.p ? (a.m && a.p === 0 ? 1 : 0) : g.king.owner });
            if (arr.length) items.push({ i, arr });
    }
    items.sort((q, w) => L.sq(q.i).y - L.sq(w.i).y);
    const pieceOff = (k, n) => (n === 1 ? [0, 0, 1] : n === 2 ? [[-0.2, 0.02], [0.2, -0.02]][k].concat(0.82) : [[-0.24, 0.1], [0.24, 0.1], [0, -0.12]][k % 3].concat(0.74));
    for (const it of items) {
      const p0 = SQ(it.i), n = it.arr.length;
      if (!D3) it.arr.forEach((pc, k) => {
        const off = pieceOff(k, n), px = p0.x + (off[0] || 0) * cell, py = p0.y + (off[1] || 0) * cell, sc = off[2] ?? 1;
        if (pc.t === 'king') drawKing(ctx, pc.ownerOverride !== undefined ? pc.ownerOverride : g.king.owner, px, py, cell * 0.95 * sc, state.t);
        else {
          const sel = mine && state.sel === it.i && state.selKind === 'man' && k === 0;
          drawHerder(ctx, pc.p, px, py + cell * 0.04, cell * 0.95 * sc, { style, lift: sel ? 0.5 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.08) : 0, glow: sel ? 0.8 : 0 });
        }
      });
      if (state.marks && !over && !a && state.danger && state.danger.has(it.i) && !state.autoMode) dangerMark(p0.x + cell * (D3 ? 0.3 : 0.32), p0.y - cell * (D3 ? 0.95 : 0.42), cell);
    }
    // the captured piece flies off after the landing
    if (a && a.cap && a.t >= a.glide) {
      const f = clamp((a.t - a.glide) / 0.6, 0, 1), p = SQ(a.to);
      if (!D3) drawHerder(ctx, 1 - a.p, p.x, p.y - ease(f) * cell * 0.8, cell * 0.95, { alpha: 1 - f, scale: 1.05 - 0.4 * ease(f), tilt: ease(f) * 0.9, flash: Math.max(0, 0.8 - f * 3), style });
      if (!state.calm && !D3) for (let j = 0; j < 7; j++) { const ang = j * 0.9 + 0.4, sp = cell * (0.4 + 0.5 * ((j * 5) % 3) / 2); ctx.fillStyle = `rgba(220,240,255,${Math.max(0, 1 - f * 1.2)})`; ctx.beginPath(); ctx.arc(p.x + Math.cos(ang) * sp * f, p.y - Math.abs(Math.sin(ang)) * sp * f * 1.1 + f * f * cell * 0.5, cell * 0.04, 0, TAU); ctx.fill(); }
      const fs = Math.round(cell * 0.5); ctx.save(); ctx.globalAlpha = Math.min(1, (1 - f) * 2); ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(10,20,50,0.9)'; ctx.lineJoin = 'round'; ctx.font = `800 ${fs}px ${UI}`; ctx.textAlign = 'center';
      const ty = p.y - cell * ((D3 ? 1.1 : 0.7) + 0.8 * ease(f)); ctx.strokeText('Captured', p.x, ty); ctx.fillStyle = '#ffd24a'; ctx.fillText('Captured', p.x, ty); ctx.restore();
    }
    if (a && a.flip && a.t >= a.glide && !state.calm && !D3) {
      const f = clamp((a.t - a.glide) / 0.7, 0, 1), p = L.sq(a.to);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, cell * (0.4 + 1.2 * f)); rg.addColorStop(0, `rgba(255,230,150,${0.6 * (1 - f)})`); rg.addColorStop(1, 'rgba(255,220,100,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p.x, p.y, cell * (0.4 + 1.2 * f), 0, TAU); ctx.fill(); ctx.restore();
    }
    // the moving piece
    if (a && !D3) {
      const pts = [];
      if (a.kind === 'wake') pts.push(L.sq(CAMP[a.p])); else pts.push(L.sq(a.from));
      for (const c of a.path) pts.push(L.sq(c));
      const f = clamp(a.t / a.glide, 0, 1), segs = pts.length - 1;
      let x, y, lift = 0;
      if (segs <= 0) { x = pts[0].x; y = pts[0].y; lift = f < 1 ? Math.sin(Math.PI * f) * 0.8 : 0; }
      else {
        const u = f * segs, k = Math.min(segs - 1, Math.floor(u)), e = ease(u - k);
        x = pts[k].x + (pts[k + 1].x - pts[k].x) * e; y = pts[k].y + (pts[k + 1].y - pts[k].y) * e; lift = f < 1 ? Math.sin(Math.PI * (u - k)) * 0.5 + 0.2 : 0;
      }
      if (a.kind === 'king') drawKing(ctx, a.p, x, y, cell * 0.95, state.t, { lift });
      else drawHerder(ctx, a.p, x, y + cell * 0.04, cell * 0.95, { lift, glow: 0.5, style, scale: a.kind === 'wake' ? 0.6 + 0.4 * Math.min(1, f * 3) : 1 });
      if (a.t > a.glide && a.t < a.glide + 0.45 && !state.calm) { const ff = (a.t - a.glide) / 0.45, p1 = L.sq(a.to); ctx.strokeStyle = `rgba(240,250,255,${0.75 * (1 - ff)})`; ctx.lineWidth = cell * 0.07 * (1 - ff) + 1; ctx.beginPath(); ctx.ellipse(p1.x, p1.y + cell * 0.2, cell * (0.3 + 0.8 * ff), cell * (0.14 + 0.34 * ff), 0, 0, TAU); ctx.stroke(); }
    }
    if (state.kb && !over && !D3) { const p = L.sq(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.strokeRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6); }
    ctx.restore();

    plates(); trayDraw(); buttonsFor();
    if (over) overlay();
  }

  function dangerMark(x, y, cell) {
    const r = cell * 0.17;
    ctx.fillStyle = '#e23c24'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(x - r * 0.12, y - r * 0.55, r * 0.24, r * 0.7); ctx.fillRect(x - r * 0.12, y + r * 0.28, r * 0.24, r * 0.24);
  }

  function plate(r, side) {
    const human = !state.two && !state.autoMode && side === state.humanSide;
    const name = state.autoMode ? `${NAMES[side]} · computer` : state.two ? NAMES[side] : human ? 'You' : 'Computer';
    const sub = state.autoMode ? LEVELS[Math.max(2, state.level)].name : state.two || human ? NAMES[side] : `${LEVELS[state.level].name} · ${NAMES[side]}`;
    const turn = g.winner < 0 && g.turn === side && scene !== 'over';
    panel(r, 16, turn ? 'rgba(30,48,96,0.82)' : 'rgba(6,12,32,0.66)', turn ? 'rgba(159,210,255,0.9)' : 'rgba(159,210,255,0.2)', true, turn ? 'plateOn' : 'plate');
    const compact = r.h < 100, ic = clamp(Math.min(r.h * (compact ? 0.78 : 0.62), r.w * 0.2), 34, 104);
    drawHerder(ctx, side, r.x + 12 + ic * 0.5, r.y + r.h * 0.5 + ic * 0.26, ic, { glow: turn ? 0.7 : 0, style });
    const tx = r.x + 12 + ic + 12, tw = r.x + r.w - 12 - tx;
    const dots = '.'.repeat(1 + (Math.floor(state.t * 3) % 3));
    const rolling = g.phase === 'roll' ? 'To roll' : 'To move';
    const status = turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'The move' : 'Thinking' + dots) : state.two ? rolling : human ? (g.phase === 'roll' ? 'Your roll' : 'Your move') : 'Thinking' + dots) : sub;
    const ns = clamp(r.h * (compact ? 0.24 : 0.2), 17, 40);
    fitText(`${name} · ${status}`, tx, r.y + r.h * (compact ? 0.36 : 0.3), ns, tw, turn ? CREAM : DIM, UI, 800, 'left');
    // sleeping herders (tap to wake when a Dawn die is available) and the losses
    const sl = g.sleep[side], lost = g.lost[side], ss = clamp(r.h * (compact ? 0.42 : 0.38), 24, 52);
    const sy = r.y + r.h * (compact ? 0.74 : 0.7), rowW = Math.max(60, tw - 4);
    const per = Math.min(6, Math.max(1, Math.floor(rowW / (ss * 0.7))));
    const hit = R(tx - 4, sy - ss * 0.75, Math.min(rowW, ss * 0.7 * 6 + 20), ss * 1.2);
    if (human || state.two) ui.hits.push({ r: hit, id: 'sleepers', v: side });
    for (let k = 0; k < 6; k++) {
      const px = tx + ss * 0.35 + k * ss * 0.7;
      if (k < sl) drawHerder(ctx, side, px, sy, ss * 0.9, { alpha: 0.55, style });
      else { ctx.strokeStyle = 'rgba(159,210,255,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(px, sy + ss * 0.12, ss * 0.2, ss * 0.3, 0, 0, TAU); ctx.stroke(); }
    }
    void per;
    const infoX = tx + ss * 0.35 + 6 * ss * 0.7 + 10, infoW = r.x + r.w - 12 - infoX;
    const isz = Math.max(minU, Math.round(ns * 0.75)), full = `${sl} asleep · ${lost} lost`, short = `${lost} lost`;
    ctx.font = `600 ${isz}px ${UI}`;
    const kingW = g.king.owner === side ? ss * 0.9 : 0, room = infoW - kingW - 6;
    const label = ctx.measureText(full).width <= room ? full : ctx.measureText(short).width <= room ? short : '';
    if (label) text(label, infoX, sy + ss * 0.2, isz, DIM, UI, 600, 'left');
    if (kingW && room > -kingW) drawKing(ctx, side, r.x + r.w - 12 - ss * 0.45, sy - ss * 0.05, ss * 0.9, state.t);
  }
  function plates() {
    const topSide = L.flip ? 0 : 1, botSide = L.flip ? 1 : 0;
    plate(L.plateTop, topSide); plate(L.plateBot, botSide);
    const M = L.msg, al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const humanNow = !state.autoMode && g.winner < 0 && (state.two || g.turn === state.humanSide);
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the computer plays both sides.' : g.winner >= 0 ? '' : humanNow ? (g.phase === 'roll' ? 'Tap the dice to roll.' : 'Tap a herder, then a glowing cell.') : '';
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      if (v3.on) panel(R(M.x, M.y + 2, M.w, M.h - 4), 14, '', '', false, 'plateOn');
      else { ctx.beginPath(); ctx.roundRect(M.x, M.y + 4, M.w, M.h - 8, 14); ctx.fillStyle = 'rgba(8,14,36,0.94)'; ctx.fill(); ctx.strokeStyle = 'rgba(159,210,255,0.75)'; ctx.lineWidth = 2; ctx.stroke(); }
      wrapBox(state.msg.text, R(M.x + 14, M.y + 8, M.w - 28, M.h - 16), big ? 30 : 25, 1.18, CREAM);
      ctx.restore();
    } else if (base) wrapBox(base, R(M.x + 8, M.y, M.w - 16, M.h), 24, 1.2, DIM);
    if (L.land && L.rightHead) fitText('Sáhkku', L.rightHead.x + L.rightHead.w / 2, L.rightHead.y + 34, 34, L.rightHead.w, GOLD, FONT, 700);
    if (L.badge && L.badge.show) drawBadgeStack(ctx, L.badge.cx, L.badge.bottom, L.badge.w);
  }

  function trayDraw() {
    const T = L.tray, rolling = state.rollAnim;
    panel(T, 18, 'rgba(10,20,46,0.72)', 'rgba(255,220,150,0.35)', false, 'tray');
    const drawDie = (...q) => { if (!v3.on) drawDieFlat(...q); };
    const human = !state.autoMode && g.winner < 0 && (state.two || g.turn === state.humanSide), canRoll = human && g.phase === 'roll' && !rolling && !a;
    const hasDice = g.dice.length === 4;
    const usable = new Set();
    if (human && g.phase === 'move' && state.sel >= 0) for (const m of state.selMoves) usable.add(m.die);
    L.dice.forEach((r, i) => {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      if (rolling) { const v = state.calm ? g.dice[i] : (rolling.t < rolling.dur * 0.8 ? Math.floor(state.t * 22 + i * 3) % 4 : g.dice[i]); drawDie(ctx, v, cx, cy, r.w, { spin: state.calm ? 0 : clamp(rolling.t / rolling.dur, 0, 1) }); }
      else if (hasDice) {
        const staleOver = g.phase !== 'move';
        drawDie(ctx, g.dice[i], cx, cy, r.w, { used: g.used[i] || staleOver, sel: state.dieFilter === i, can: usable.has(i) || (human && g.phase === 'move' && state.sel < 0 && !g.used[i] && state.viewMoves?.some((m) => m.die === i)) });
        if (g.phase === 'move' && human) ui.hits.push({ r, id: 'die', v: i });
      } else drawDie(ctx, 1, cx, cy, r.w, { blank: true });
    });
    if (canRoll) {
      const pulse = 0.5 + 0.5 * Math.sin(state.t * 4);
      ctx.strokeStyle = `rgba(255,200,90,${0.5 + pulse * 0.5})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(T.x + 3, T.y + 3, T.w - 6, T.h - 6, 16); ctx.stroke();
      const ly = T.y + T.h - 8; fitText('Tap to roll', T.x + T.w / 2, ly, clamp(T.h * 0.17, 16, 28), T.w - 20, GOLD, UI, 800);
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
    }
  }
  function overlay() {
    if (v3.on) v3.scrim = 0.72; else { ctx.fillStyle = 'rgba(4,8,20,0.72)'; ctx.fillRect(0, 0, L.w, L.h); }
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 26, 'rgba(10,20,46,0.94)', 'rgba(159,210,255,0.6)', true, 'doc');
    const res = state.result || { winner: g.winner, reason: g.reason }, w = res.winner;
    const title = w === 2 ? 'A draw' : state.autoMode ? `${NAMES[w]} wins` : state.two ? `${NAMES[w]} wins` : w === state.humanSide ? 'You win!' : 'The computer wins';
    const k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    if (w < 2) drawHerder(ctx, w, 0, 118, 130, { glow: 0.9, lift: 0.4 + Math.sin(state.t * 2.5) * 0.08, style });
    else { drawHerder(ctx, 0, -60, 118, 100, { style }); drawHerder(ctx, 1, 60, 118, 100, { style }); }
    fitText(title, 0, 238, 62, cw2 - 40, GOLD, FONT, 700);
    wrapBox(res.reason || '', R(-cw2 / 2 + 30, 252, cw2 - 60, 70), 26, 1.25, CREAM);
    fitText(`${g.rolls} rolls · lost ${g.lost[0]} red, ${g.lost[1]} blue`, 0, 346, 22, cw2 - 40, DIM, UI, 500);
    if (!state.two && !state.autoMode && w === state.humanSide) { fitText(`★ ${LEVELS[state.level].name} beaten`, 0, 390, 24, cw2 - 40, '#ffd24a', UI, 700); confetti(c, 0); }
    ctx.restore();
    button(O.again, state.autoMode ? 'Watch another' : 'Play again', { primary: true, size: 32 }); button(O.back, 'Menu', { size: 28 });
    drawMoreLine(ctx, cx, O.back.y + O.back.h + 32, 22);
  }
  function confetti(c, cx) {
    if (state.calm) return;
    for (let k = 0; k < 22; k++) {
      const ph = (state.t * 0.32 + k * 0.0917) % 1, x = cx + Math.sin(k * 2.4 + state.t) * (60 + 170 * ph), y = 210 - ph * 190 + ph * ph * 120;
      ctx.fillStyle = k % 3 === 0 ? `rgba(255,214,110,${0.9 * (1 - ph)})` : k % 3 === 1 ? `rgba(255,120,110,${0.8 * (1 - ph)})` : `rgba(159,210,255,${0.8 * (1 - ph)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k + state.t * 2); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore();
    }
  }

  // ================================================================ documents (rules, how to play, about, settings)
  function drawDocument() {
    const D = L.doc, panelR = D.panel, vp = D.viewport, kind = state.doc.kind;
    if (v3.on) { v3.scrim = 0.32; panel(panelR, 26, '', '', false, 'doc'); }
    else {
      ctx.fillStyle = 'rgba(4,8,20,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
      ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 26);
      const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(24,40,84,0.88)'); pg.addColorStop(1, 'rgba(8,14,34,0.92)');
      ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(159,210,255,0.32)'; ctx.lineWidth = 2; ctx.stroke();
      edgeStroke(ctx, panelR, 26, 0.4);
    }
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kind];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 44, D.header.textDec.x - 100 - hx, GOLD, FONT, 700, 'left');
    ctx.strokeStyle = 'rgba(159,210,255,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panelR.x + 28, panelR.y + 82); ctx.lineTo(panelR.x + panelR.w - 28, panelR.y + 82); ctx.stroke();
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
          const cp = Math.min(40 * (1 + (Math.min(scale, 2) - 1) * 0.35), (bodyW - 24) / (N + 1.2)), ds = miniSize(cp);
          if (vis(y, ds)) miniBoard(ctx, it.spec, cxp - (cp * (N + 1)) / 2, y, cp, wood);
          y += ds + gap;
        } else if (it.k === 'dice') {
          const ds = Math.min(78 * Math.min(scale, 1.6), (bodyW - 30) / 4.4), tot = 4 * ds + 3 * 14, lab = ['Dawn', '1', '2', '3'];
          if (vis(y, ds + 40)) for (let i = 0; i < 4; i++) { const dx = cxp - tot / 2 + i * (ds + 14); drawDie(ctx, i, dx + ds / 2, y + ds / 2 + 4, ds); text(lab[i], dx + ds / 2, y + ds + 28, Math.round(22 * Math.min(scale, 1.6)), DIM, UI, 700); }
          y += ds + 44 + gap;
        } else if (it.k === 'btn') {
          const os = Math.round(26 * Math.min(scale, 2.2)), bh = Math.round(72 * Math.min(scale, 2.2)), rr = R(left, y, bodyW, bh);
          if (vis(y, bh)) button(rr, it.label, { size: os, primary: !it.disabled, dim: it.disabled });
          if (!it.disabled) ui.hits.push({ r: rr, id: it.id, v: 1 });
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
            if (vis(ry, bh)) button(rr, o.locked ? `${o.l} (locked)` : o.l, { size: os, on: o.v === it.cur && !o.locked, primary: o.v === it.cur && !o.locked, dim: o.locked });
            ui.hits.push({ r: rr, id: it.id, v: o.v, locked: o.locked, need: o.need });
          });
          y += Math.ceil(n / per) * (bh + 10) + gap;
        }
      }
    });
    ctx.restore();
    const contentH = y - (vp.y - sc0) + 10;
    if (contentH - vp.h > 8) {
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); const fc = v3.on ? '13,23,51' : '14,26,58'; gr.addColorStop(0, `rgba(${fc},${a0})`); gr.addColorStop(1, `rgba(${fc},${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 22, vp.y, 0, 0.95);
    }
    docMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); docMetrics.view = vp.h;
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(159,210,255,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(159,210,255,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(docMetrics.max > 0 ? (sc0 >= docMetrics.max - 1 ? 'End' : 'Scroll, or tap Next') : '', D.cx, D.counterY, 21, 'rgba(159,210,255,0.7)', UI, 500);
    button(D.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(D.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    fitText(`${Math.round(scale * 100)}%`, D.header.textDec.x - 14, D.header.textDec.y + 42, 22, 70, DIM, UI, 600, 'right');
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); if (v3.on) panel(r, 14, '', '', false, 'plateOn'); else { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(8,14,36,0.96)'; ctx.fill(); ctx.strokeStyle = 'rgba(159,210,255,0.8)'; ctx.lineWidth = 2; ctx.stroke(); } wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}
