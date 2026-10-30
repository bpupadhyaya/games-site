// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, R, clamp } from './layout.js';
import { drawBackdrop, drawBoard, drawSpatula, drawStick, miniBoard, miniSize } from './art.js';
import { RULES, HOWTO, ABOUT } from './content.js';
import { settingsItems } from './settings.js';
import { NAMES, spot, HOME, OUT_END, count, waiting, homeCount, COLS } from './rules.js';
import { LEVELS, hitChance } from './ai.js';
import { drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';
import { v3 } from './v3.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GOLD = '#f6c85a', CREAM = '#fff4de', DIM = 'rgba(236,214,176,0.82)';
const TAU = Math.PI * 2;
export const ui = { hits: [], buttons: [], harbour: [{ x: 0, y: 0 }, { x: 0, y: 0 }] };
export const docMetrics = { max: 0, view: 0 };
const fitMemo = new Map(); let fitFontsKey = '';
const ease = (f) => f * f * (3 - 2 * f);


function drawIcon(ctx, id, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(2, s * 0.09); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const h = s / 2, L = (a, b, c, d) => { ctx.beginPath(); ctx.moveTo(a * h, b * h); ctx.lineTo(c * h, d * h); ctx.stroke(); }, C = (cx, cy, r, f) => { ctx.beginPath(); ctx.arc(cx * h, cy * h, r * h, 0, TAU); f ? ctx.fill() : ctx.stroke(); };
  if (id === 'two') { C(-0.45, -0.3, 0.3, 1); C(0.45, -0.3, 0.3, 1); ctx.beginPath(); ctx.arc(-0.45 * h, 0.95 * h, 0.7 * h, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.beginPath(); ctx.arc(0.45 * h, 0.95 * h, 0.7 * h, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  else if (id === 'auto') { ctx.beginPath(); ctx.moveTo(-0.55 * h, -0.8 * h); ctx.lineTo(0.8 * h, 0); ctx.lineTo(-0.55 * h, 0.8 * h); ctx.closePath(); ctx.fill(); }
  else if (id === 'rules') { ctx.beginPath(); ctx.roundRect(-0.7 * h, -0.9 * h, 1.4 * h, 1.8 * h, 0.2 * h); ctx.stroke(); L(-0.35, -0.35, 0.35, -0.35); L(-0.35, 0.05, 0.35, 0.05); L(-0.35, 0.45, 0.1, 0.45); }
  else if (id === 'how') { C(0, 0, 0.9, 0); ctx.font = `800 ${s * 0.9}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('?', 0, s * 0.31); }
  else if (id === 'about') { C(0, 0, 0.9, 0); C(0, -0.42, 0.11, 1); L(0, -0.1, 0, 0.5); }
  else if (id === 'settings') { L(-0.85, -0.5, 0.85, -0.5); L(-0.85, 0.5, 0.85, 0.5); C(-0.3, -0.5, 0.26, 1); C(0.35, 0.5, 0.26, 1); }
  else if (id === 'menu') { L(-0.8, -0.55, 0.8, -0.55); L(-0.8, 0, 0.8, 0); L(-0.8, 0.55, 0.8, 0.55); }
  else if (id === 'hint') { C(0, -0.2, 0.62, 0); L(-0.3, 0.7, 0.3, 0.7); L(-0.2, 0.98, 0.2, 0.98); }
  else if (id === 'play') { ctx.beginPath(); ctx.moveTo(-0.5 * h, -0.8 * h); ctx.lineTo(0.8 * h, 0); ctx.lineTo(-0.5 * h, 0.8 * h); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

export function render(ctx, state, L) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== fitFontsKey || fitMemo.size > 3000) { fitMemo.clear(); fitFontsKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { v = fn(); fitMemo.set(key, v); } return v; };
  ui.hits.length = 0; ui.buttons.length = 0;
  let ovlOn = false;
  const P3 = v3.on;                                   // the 3D presenter draws the world, plaques and buttons; this layer draws text
  if (P3) ctx.clearRect(0, 0, L.w, L.h);
  const pt = (r, c) => (P3 && v3.cell ? v3.cell(r, c) : L.pt(r, c));
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
  const panel = (r, rad = 18, fill = 'rgba(34,19,10,0.78)', stroke = 'rgba(246,200,90,0.32)', brand = false, kind = 'card', side = 0) => {
    if (P3) { v3.panels.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, rad, kind, side, ov: kind === 'over' }); return; }
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.3);
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim && !P3) ctx.globalAlpha = 0.5;
    const rad = Math.min(18, r.h / 3);
    // 3D: a lacquered button drawn by the presenter. A button only partly inside a scrolling page falls back to the flat paint.
    const in3d = P3 && !(o.clipTo && (r.y < o.clipTo.y || r.y + r.h > o.clipTo.y + o.clipTo.h));
    if (in3d) v3.buttons.push({ r: { x: r.x, y: r.y, w: r.w, h: r.h }, kind: o.dim ? 'disabled' : o.primary ? 'primary' : o.on ? 'on' : 'quiet', hot: !!o.primary && !o.dim, rad, ov: scene === 'over' && !!ovlOn });
    else {
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
      const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      if (o.primary) { gr.addColorStop(0, '#d9482c'); gr.addColorStop(1, '#8a1d10'); } else if (o.on) { gr.addColorStop(0, '#3c8f93'); gr.addColorStop(1, '#1e5558'); } else { gr.addColorStop(0, '#6a4528'); gr.addColorStop(1, '#33200f'); }
      ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
      ctx.strokeStyle = o.primary ? 'rgba(255,224,150,0.85)' : 'rgba(246,200,90,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    }
    if (o.dim && P3) ctx.globalAlpha = 0.6;
    const tcx0 = r.x + r.w / 2;
    const size = o.size ?? 28, icw = o.icon && r.w > 150 ? Math.min(r.h * 0.42, 34) : 0, maxW = r.w - 20 - (icw ? icw + 12 : 0), col = o.primary ? '#fff6e0' : '#fbeccd', cy = r.y + r.h / 2;
    const tcx = tcx0 + (icw ? (icw + 12) / 2 : 0);
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
    if (o.sub && best.ls.length === 1) { text(label, tcx, cy + best.s * 0.1 - 6, best.s, col, UI, 700); fitText(o.sub, tcx, cy + best.s * 0.1 + Math.max(minU, size * 0.62) + 2, Math.round(size * 0.62), maxW, DIM, UI, 500, 'center', minU); }
    else if (best.ls.length === 1) text(label, tcx, cy + best.s * 0.35, best.s, col, UI, 700);
    else best.ls.forEach((ln, i) => text(ln, tcx, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s, col, UI, 700));
    if (icw) { ctx.font = `700 ${best.s}px ${UI}`; const tw = Math.max(...best.ls.map((l) => ctx.measureText(l).width)); drawIcon(ctx, o.icon, tcx - tw / 2 - 12 - icw / 2, cy, icw, col); }
    ctx.restore();
  };

  // ---------------------------------------------------------------- scenes
  drawBackdrop(ctx, L, state.t, state.calm);
  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();
  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(8,14,18,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function drawTitle() {
    const T = L.title(!!state.saved), Rr = T.rows;
    if (T.card) panel(T.card, 24, 'rgba(34,19,10,0.7)');
    hero(T.hero);
    if (scene === 'demo-limit') {
      const r = T.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!T.card) panel(r, 24, 'rgba(34,19,10,0.86)');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, GOLD, FONT, 700);
      wrapBox('Get Daldøs on iPhone and Android for unlimited games, every computer level and all boards.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      if (Rr.resume) button(Rr.resume, 'Continue your game', { primary: true, size: 30 });
      button(Rr.play, 'Play the computer', { primary: !Rr.resume, size: 32, sub: `${LEVELS[state.level].name} · as ${NAMES[state.humanSide]}` });
      button(Rr.two, 'Two players', { size: 26, icon: 'two' }); button(Rr.auto, 'Auto Play', { size: 26, icon: 'auto' });
      button(Rr.rules, 'Rules', { size: 26, icon: 'rules' }); button(Rr.how, 'How to Play', { size: 26, icon: 'how' });
      button(Rr.about, 'About', { size: 26, icon: 'about' }); button(Rr.settings, 'Settings', { size: 26, icon: 'settings' });
      if (state.msg) fitText(state.msg.text, L.w / 2, Rr.play.y - 14, 24, L.w - 40, GOLD, UI, 600);
    }
    const lk = T.lockup; state.lockupRect = drawLockup(ctx, lk.x, lk.y + 4, 50);
  }

  function hero(r) {
    const cx = r.x + r.w / 2;
    const ts = clamp(Math.min(r.w / 3.8, r.h / 3.2), 52, 160), y0 = r.y + ts * 0.9;
    // carved, gilded lettering: a stacked extrusion, a dark rim, a gold face with a bright top edge
    {
      let q = ts; ctx.font = `700 ${q}px ${FONT}`; while (q > minU && ctx.measureText('Daldøs').width > r.w - 24) { q -= 1; ctx.font = `700 ${q}px ${FONT}`; }
      ctx.save(); ctx.textAlign = 'center'; ctx.font = `700 ${q}px ${FONT}`;
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8; ctx.fillStyle = '#2a1405'; ctx.fillText('Daldøs', cx, y0 + q * 0.09);
      ctx.shadowColor = 'transparent';
      const depth = Math.max(3, Math.round(q * 0.06));
      for (let i = depth; i >= 1; i--) { const k = i / depth; ctx.fillStyle = `rgb(${Math.round(120 - 70 * k)},${Math.round(62 - 36 * k)},${Math.round(14 - 8 * k)})`; ctx.fillText('Daldøs', cx, y0 + i * 1.15); }
      const grad = ctx.createLinearGradient(0, y0 - q * 0.8, 0, y0 + q * 0.05);
      grad.addColorStop(0, '#fffbe8'); grad.addColorStop(0.45, '#ffd877'); grad.addColorStop(0.55, '#f2b13a'); grad.addColorStop(1, '#b8741a');
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, q * 0.03); ctx.strokeStyle = '#4a2406'; ctx.strokeText('Daldøs', cx, y0);
      ctx.fillStyle = grad; ctx.fillText('Daldøs', cx, y0);
      ctx.restore();
    }
    const sub = Math.max(minU, ts * 0.16), pw = Math.min(r.w * 0.82, ts * 6.2), py = y0 + ts * 0.22;
    const pg = ctx.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0); pg.addColorStop(0, '#b53a24'); pg.addColorStop(0.5, '#d89a2a'); pg.addColorStop(1, '#2b7f86');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, sub * 2, sub); ctx.fill();
    fitText('NORWEGIAN BOARD AND STICK GAME', cx, py + sub * 1.4, sub, pw - 20, '#fff', UI, 800);
    const top = py + sub * 2 + ts * 0.18, room = r.y + r.h - top;
    if (room > 110) { if (P3) v3.heroRect = R(r.x, top, r.w, room - 6); else heroBoard(R(r.x, top, r.w, room - 6)); }
  }

  // a looping demonstration: Red hits a Blue spatula in the middle row, then another Red spatula turns over
  function heroBoard(r) {
    const cw = clamp(Math.min((r.w - 8) / 11, (r.h - 30) / 3.6 / 1.2), 22, 100), ch = Math.min(cw * 1.9, (r.h - 30) / 3.6), w = cw * 11, h = ch * 3.6;
    const x = r.x + (r.w - w) / 2, y = r.y + (r.h - h) / 2 - 10, gx = x + cw * 1.5, gy = y + ch * 0.3;
    const Bh = { x, y, w, h, cw, ch, gx, gy, flip: false, rowOf: (s) => (s === 0 ? 2 : 0), pt: (rr, c) => ({ x: gx + (c + 0.5) * cw, y: gy + (rr + 0.5) * ch }) };
    drawBoard(ctx, Bh, wood);
    const T = state.calm ? 2.6 : state.t % 9.5;
    const p = (rr, c) => Bh.pt(rr, c), lerp = (p0, p1, f) => ({ x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f });
    const f1 = ease(clamp((T - 1.2) / 1.3, 0, 1)), f2 = ease(clamp((T - 4.6) / 1.2, 0, 1));
    const s = Math.min(cw, ch * 0.9);
    // blue on column 3 of the middle row until captured; another blue way back in its own row
    if (T < 2.6) drawSpatula(ctx, 1, p(1, 3).x, p(1, 3).y, s, { turned: true });
    else if (T < 3.4) { const f = (T - 2.6) / 0.8; drawSpatula(ctx, 1, p(1, 3).x, p(1, 3).y - f * ch * 0.8, s, { turned: true, alpha: 1 - f, tilt: f * 0.9 }); }
    drawSpatula(ctx, 1, p(0, 5).x, p(0, 5).y, s, {});
    drawSpatula(ctx, 0, p(2, 2).x, p(2, 2).y, s, {});
    const a0 = lerp(p(1, 5), p(1, 3), f1);
    drawSpatula(ctx, 0, a0.x, a0.y, s, { turned: true, lift: f1 > 0 && f1 < 1 ? Math.sin(Math.PI * f1) * 0.7 : 0 });
    const b0 = lerp(p(2, 6), p(1, 7), f2);
    drawSpatula(ctx, 0, b0.x, b0.y, s, { turned: f2 > 0.5, flip: f2 > 0 && f2 < 1 ? f2 : undefined, lift: f2 > 0 && f2 < 1 ? Math.sin(Math.PI * f2) * 0.7 : 0 });
    // the stick drops in at the start of each move
    const fs = (T < 1.2 ? T / 1.2 : T > 4 && T < 4.6 ? (T - 4) / 0.6 : -1);
    if (fs >= 0) drawStick(ctx, T < 1.2 ? 2 : 1, x + w / 2, Math.min(y + h + 14, r.y + r.h - 18), Math.min(w * 0.42, cw * 3.4), { spin: state.calm ? 0 : fs < 1 ? fs : 0 });
  }

  // ================================================================ play / over
  function drawPlayScreen() {
    const over = scene === 'over', cw = B.cw, ch = B.ch, me = g.turn, S = Math.min(cw, ch * 0.92);
    if (L.land) panel(L.rightCard, 22, undefined, undefined, false, 'card');
    ctx.save();
    if (a && a.cap && !state.calm && a.t > a.glide && a.t < a.glide + 0.35) { const f = (a.t - a.glide) / 0.35; ctx.translate(Math.sin(f * 46) * (1 - f) * cw * 0.045, Math.cos(f * 38) * (1 - f) * cw * 0.03); }
    if (!P3) drawBoard(ctx, B, wood);
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    const cellPt = (side, step) => { const c = spot(side, step); return c ? pt(c.row, c.col) : null; };
    const exitPt = (side) => { if (P3) return pt(1, side === 0 ? -1.15 : 8.15); const e = L.pt(1, side === 0 ? 0 : 7), nx = L.pt(1, side === 0 ? 1 : 6), dx = Math.sign(e.x - nx.x) || 1; return { x: e.x + dx * cw * 1.1, y: e.y }; };
    const ring = (p, col, lw = cw * 0.06, fill) => { if (P3) return; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(p.x, p.y, cw * 0.44, Math.min(ch * 0.44, cw * 0.5), 0, 0, TAU); ctx.stroke(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } };
    const mine = !state.autoMode && g.phase === 'move' && !a && !state.rollAnim && !over && (state.two || me === state.humanSide);
    // last move
    if (g.last && !a && !over) { const lp = cellPt(g.last.side, g.last.to); if (lp) ring(lp, 'rgba(255,214,110,0.55)', cw * 0.04); }
    const ms = state.viewMoves || [];
    const selM = mine && state.sel >= 0 ? ms.find((m) => m.from === state.sel) : null;
    if (mine && !selM) for (const m of ms) { if (m.from === 0) continue; const p = cellPt(me, m.from); if (p) ring(p, `rgba(130,255,170,${0.4 + pulse * 0.4})`, cw * 0.05); }
    if (selM) {
      if (selM.from > 0) { const sp = cellPt(me, selM.from); ring(sp, 'rgba(255,230,130,0.95)', cw * 0.07, `rgba(255,224,120,${0.16 + pulse * 0.1})`); }
      const dp = selM.home ? exitPt(me) : cellPt(me, selM.to);
      const col = selM.cap ? '226,60,36' : selM.turn || selM.home ? '255,200,40' : '240,252,255';
      ring(dp, `rgba(${col},${0.75 + pulse * 0.25})`, cw * 0.07, `rgba(${col},0.2)`);
      const bs = cw * 0.2; ctx.fillStyle = selM.cap ? '#e23c24' : selM.turn || selM.home ? '#d99a10' : '#1f6a8a'; ctx.beginPath(); ctx.arc(dp.x + cw * 0.3, dp.y - Math.min(ch * 0.3, cw * 0.4), bs, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      text(selM.home ? 'H' : selM.cap ? '!' : String(selM.v), dp.x + cw * 0.3, dp.y - Math.min(ch * 0.3, cw * 0.4) + bs * 0.38, bs * 1.15, '#fff', UI, 800);
      if (selM.home) text('home', dp.x, dp.y + ch * 0.1, Math.max(minU, cw * 0.2), '#ffe08a', UI, 800);
    }
    if (state.hint && !a) {
      for (const q of [state.hint.from, state.hint.to]) {
        if (q <= 0 || q >= HOME) continue; const p = cellPt(state.hint.side, q); ring(p, 'rgba(90,230,150,0.95)', cw * 0.06, `rgba(90,230,150,${0.16 + pulse * 0.12})`);
      }
    }
    // spatulas, top rows first
    const items = [];
    for (let side = 0; side < 2; side++) {
      const seen = new Map();
      for (const st of g.pieces[side]) if (st > 0 && st < HOME) seen.set(st, (seen.get(st) || 0) + 1);
      for (const [st, n0] of seen) {
        let n = n0;
        if (a && a.side === side && a.to === st && a.t < a.dur) n -= 1;
        if (n <= 0 && !(a && a.cap && a.side !== side && 25 - a.to === st && a.t < a.glide)) continue;
        const p = cellPt(side, st); if (p) items.push({ side, st, n, p });
      }
    }
    if (a && a.cap && a.t < a.glide) { const rs = 25 - a.to, rside = 1 - a.side, p = cellPt(rside, rs); if (p && !items.some((i) => i.side === rside && i.st === rs)) items.push({ side: rside, st: rs, n: 1, p }); }
    items.sort((q, w) => q.p.y - w.p.y);
    for (const it of items) {
      const { side, st, n, p } = it;
      for (let k = 0; !P3 && k < n; k++) {
        const ox = n === 2 ? (k === 0 ? -0.2 : 0.2) * cw : 0, sc = n === 2 ? 0.82 : 1;
        const selected = mine && side === me && state.sel === st && k === 0;
        drawSpatula(ctx, side, p.x + ox, p.y + ch * 0.04, S * 1.0, { turned: st > OUT_END, style, scale: sc, lift: selected ? 0.4 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.06) : 0, glow: selected ? 0.8 : 0 });
      }
      const humanSide = state.two || state.autoMode ? me : state.humanSide;
      if (state.marks && !over && !a && !state.autoMode && side === humanSide && n === 1 && hitChance(g, side, st) > 0) { if (P3) dangerMark(p.x + v3.cw * 0.36, p.y - v3.cw * 0.5, v3.cw); else dangerMark(p.x + cw * 0.34, p.y - Math.min(ch * 0.36, cw * 0.42), cw); }
    }
    // the captured piece flies off after the landing
    if (a && a.cap && a.t >= a.glide) {
      const f = clamp((a.t - a.glide) / 0.6, 0, 1), p = cellPt(a.side, a.to);
      if (!P3) drawSpatula(ctx, 1 - a.side, p.x, p.y - ease(f) * ch * 0.7, S, { turned: true, alpha: 1 - f, scale: 1.05 - 0.4 * ease(f), tilt: ease(f) * 0.9, flash: Math.max(0, 0.8 - f * 3) });
      if (!state.calm && !P3) for (let j = 0; j < 7; j++) { const ang = j * 0.9 + 0.4, sp = cw * (0.4 + 0.5 * ((j * 5) % 3) / 2); ctx.fillStyle = `rgba(255,240,210,${Math.max(0, 1 - f * 1.2)})`; ctx.beginPath(); ctx.arc(p.x + Math.cos(ang) * sp * f, p.y - Math.abs(Math.sin(ang)) * sp * f * 1.1 + f * f * cw * 0.5, cw * 0.04, 0, TAU); ctx.fill(); }
      const fs = Math.round(cw * 0.46); ctx.save(); ctx.globalAlpha = Math.min(1, (1 - f) * 2); ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(30,12,4,0.9)'; ctx.lineJoin = 'round'; ctx.font = `800 ${fs}px ${UI}`; ctx.textAlign = 'center';
      const ty = p.y - ch * (0.6 + 0.6 * ease(f)); ctx.strokeText('Captured', p.x, ty); ctx.fillStyle = '#ffd24a'; ctx.fillText('Captured', p.x, ty); ctx.restore();
    }
    // the moving piece
    if (a && !P3) {
      const from = a.from === 0 ? ui.harbour[a.side] : cellPt(a.side, a.from);
      const to = a.to >= HOME ? exitPt(a.side) : cellPt(a.side, a.to);
      const f = clamp(a.t / a.glide, 0, 1), e = ease(f);
      const x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e, lift = f < 1 ? Math.sin(Math.PI * f) * 0.7 + 0.15 : 0;
      const turnedNow = a.to > OUT_END && a.from <= OUT_END ? undefined : a.to > OUT_END;
      const flipping = a.turn && f > 0.25 && f < 0.85 ? (f - 0.25) / 0.6 : undefined;
      const fade = a.home && f > 0.6 ? 1 - (f - 0.6) / 0.4 : 1;
      drawSpatula(ctx, a.side, x, y + ch * 0.04, S, { turned: a.turn ? (flipping === undefined ? f >= 0.85 : false) : a.to > OUT_END, flip: flipping, lift, glow: 0.5, style, alpha: fade, scale: a.from === 0 ? 0.7 + 0.3 * Math.min(1, f * 3) : 1 });
      void turnedNow;
      if (a.t > a.glide && a.t < a.glide + 0.45 && !state.calm && a.to < HOME) { const ff = (a.t - a.glide) / 0.45, p1 = cellPt(a.side, a.to); ctx.strokeStyle = `rgba(255,248,230,${0.75 * (1 - ff)})`; ctx.lineWidth = cw * 0.06 * (1 - ff) + 1; ctx.beginPath(); ctx.ellipse(p1.x, p1.y + ch * 0.18, cw * (0.3 + 0.7 * ff), ch * (0.12 + 0.28 * ff), 0, 0, TAU); ctx.stroke(); }
      if (a.turn && a.t >= a.glide && !state.calm) {
        const ff = clamp((a.t - a.glide) / 0.7, 0, 1), p = cellPt(a.side, a.to);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, cw * (0.4 + 1.1 * ff)); rg.addColorStop(0, `rgba(255,230,150,${0.6 * (1 - ff)})`); rg.addColorStop(1, 'rgba(255,220,100,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p.x, p.y, cw * (0.4 + 1.1 * ff), 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    ctx.restore();

    if (!over) { plates(); trayDraw(); buttonsFor(); }
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
    panel(r, 18, turn ? 'rgba(74,44,20,0.9)' : 'rgba(34,19,10,0.7)', turn ? 'rgba(246,200,90,0.9)' : 'rgba(246,200,90,0.2)', false, turn ? 'plateOn' : 'plateOff', side);
    const compact = r.h < 104, ic = clamp(Math.min(r.h * (compact ? 0.78 : 0.62), r.w * 0.2), 36, 104);
    drawSpatula(ctx, side, r.x + 14 + ic * 0.5, r.y + r.h * 0.5 + ic * 0.22, ic, { glow: turn ? 0.7 : 0, style, turned: false });
    const tx = r.x + 14 + ic + 12, tw = r.x + r.w - 12 - tx;
    const dots = '.'.repeat(1 + (Math.floor(state.t * 3) % 3));
    const rolling = g.phase === 'roll' ? 'To throw' : 'To move';
    const status = turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'The move' : 'Thinking' + dots) : state.two ? rolling : human ? (g.phase === 'roll' ? (g.extra ? 'Throw again' : 'Your throw') : 'Your move') : 'Thinking' + dots) : sub;
    const ns = clamp(r.h * (compact ? 0.24 : 0.2), 17, 40);
    fitText(`${name} · ${status}`, tx, r.y + r.h * (compact ? 0.34 : 0.3), ns, tw, turn ? CREAM : DIM, UI, 800, 'left');
    // harbour (waiting) and home (finished) rows
    const wt = waiting(g, side), hm = homeCount(g, side), n = g.n;
    const ss = clamp(r.h * (compact ? 0.4 : 0.36), 22, 48), sy = r.y + r.h * (compact ? 0.74 : 0.7);
    const per = Math.max(1, Math.min(n, Math.floor((tw * 0.62) / (ss * 0.62))));
    const hx = tx + ss * 0.35, step = Math.min(ss * 0.66, (tw * 0.62) / Math.max(1, n));
    const hit = R(tx - 4, sy - ss * 0.8, Math.min(tw * 0.64, step * (n - 1) + ss * 0.9 + 8), ss * 1.3);
    ui.harbour[side] = { x: hx + step * Math.max(0, wt - 1) * 0.5, y: sy };
    if (human || state.two) ui.hits.push({ r: hit, id: 'harbour', v: side });
    void per;
    const canLaunch = (human || state.two) && g.turn === side && g.phase === 'move' && (state.viewMoves || []).some((m) => m.from === 0);
    if (canLaunch) { ctx.strokeStyle = `rgba(130,255,170,${0.5 + 0.4 * (0.5 + 0.5 * Math.sin(state.t * 5))})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(hit.x, hit.y, hit.w, hit.h, 10); ctx.stroke(); }
    if (state.sel === 0 && g.turn === side) { ctx.strokeStyle = 'rgba(255,230,130,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(hit.x, hit.y, hit.w, hit.h, 10); ctx.stroke(); }
    for (let k = 0; k < n; k++) {
      const px = hx + k * step;
      if (k < wt && !(a && a.from === 0 && a.side === side && k === wt - 1 && a.t < a.glide * 0.2)) drawSpatula(ctx, side, px, sy, ss * 0.95, { style });
      else { ctx.strokeStyle = 'rgba(246,200,90,0.2)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(px, sy + ss * 0.04, ss * 0.18, ss * 0.28, 0, 0, TAU); ctx.stroke(); }
    }
    const infoX = hx + n * step + 8, infoW = r.x + r.w - 12 - infoX;
    const isz = Math.max(minU, Math.round(ns * 0.78)), full = `${hm} of ${n} home`, short = `${hm}/${n}`;
    ctx.font = `700 ${isz}px ${UI}`;
    const label = ctx.measureText(full).width <= infoW ? full : ctx.measureText(short).width <= infoW ? short : '';
    if (label) text(label, infoX, sy + ss * 0.2, isz, hm === n ? GOLD : DIM, UI, 700, 'left');
    ui.hits.push({ r: R(r.x, r.y, r.w, r.h), id: 'home', v: side });
  }
  function plates() {
    const topSide = L.flip ? 0 : 1, botSide = L.flip ? 1 : 0;
    plate(L.plateTop, topSide); plate(L.plateBot, botSide);
    const M = L.msg, al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const humanNow = !state.autoMode && g.winner < 0 && (state.two || g.turn === state.humanSide);
    const sel = state.sel >= 0;
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the computer plays both sides.' : g.winner >= 0 ? '' : humanNow ? (g.phase === 'roll' ? (g.extra ? 'A 4: throw again.' : 'Tap the tray to throw the stick.') : sel ? 'Tap the ring, or the spatula again, to move.' : 'Tap a glowing spatula.') : '';
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      ctx.beginPath(); ctx.roundRect(M.x, M.y + 4, M.w, M.h - 8, 14); ctx.fillStyle = 'rgba(30,16,8,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(246,200,90,0.75)'; ctx.lineWidth = 2; ctx.stroke();
      wrapBox(state.msg.text, R(M.x + 14, M.y + 8, M.w - 28, M.h - 16), big ? 30 : 25, 1.18, CREAM);
      ctx.restore();
    } else if (base) { if (P3) { panel(R(M.x + 6, M.y + 6, M.w - 12, M.h - 12), 14, undefined, undefined, false, 'plateOff'); } wrapBox(base, R(M.x + 14, M.y, M.w - 28, M.h), 24, 1.2, CREAM); }
    if (L.land && !state.autoMode) fitText('Daldøs', L.rightCard.x + L.rightCard.w / 2, L.rightCard.y + L.rightCard.h - 18, 30, L.rightCard.w - 24, 'rgba(246,200,90,0.55)', FONT, 700);
  }

  function trayDraw() {
    const T = L.tray, rolling = state.rollAnim;
    panel(T, 20, 'rgba(34,19,10,0.78)', 'rgba(246,200,90,0.4)', false, 'tray');
    const human = !state.autoMode && g.winner < 0 && (state.two || g.turn === state.humanSide), canRoll = human && g.phase === 'roll' && !rolling && !a;
    const val = state.shownRoll || g.lastRoll || 0;
    const narrow = T.w <= T.h * 2.2, sw = narrow ? Math.min(T.w * 0.84, T.h * 3.2, 420) : Math.min(T.w * 0.62, T.h * 3.6, 520), cx = T.x + T.w * (T.w > T.h * 2.2 ? 0.38 : 0.5), cy = T.y + T.h * 0.46;
    const showV = rolling ? (rolling.t < rolling.dur * 0.8 && !state.calm ? 1 + (Math.floor(state.t * 18) % 4) : val) : val;
    if (P3) { if (scene !== 'over') v3.stick = { r: { x: cx - sw / 2, y: cy - sw * 0.1, w: sw, h: sw * 0.2 }, value: rolling ? val || 1 : val, spin: rolling && !state.calm ? clamp(rolling.t / rolling.dur, 0, 1) : 0, blank: !val && !rolling, extra: val === 4 && !rolling }; }
    else drawStick(ctx, showV, cx, cy, sw, { spin: rolling && !state.calm ? clamp(rolling.t / rolling.dur, 0, 1) : 0, blank: !val && !rolling, extra: val === 4 && !rolling });
    if (val && !rolling) {
      const big2 = clamp(T.h * 0.42, 28, 70), nx = T.w > T.h * 2.2 ? T.x + T.w * 0.78 : cx + sw / 2 - big2 * 0.2;
      if (T.w > T.h * 2.2) text(String(val), nx, T.y + T.h * 0.6, big2, GOLD, FONT, 700);
      if (val === 4 && g.extra) fitText('Throw again', T.x + T.w / 2, T.y + T.h - 10, clamp(T.h * 0.16, 14, 26), T.w - 24, '#ff9a6a', UI, 800);
      else if (g.phase === 'move' && !canRoll) fitText(`Move one spatula ${val}`, T.x + T.w / 2, T.y + T.h - 10, clamp(T.h * 0.16, 14, 26), T.w - 24, DIM, UI, 700);
    }
    if (canRoll) {
      const pulse = 0.5 + 0.5 * Math.sin(state.t * 4);
      ctx.strokeStyle = `rgba(246,200,90,${0.5 + pulse * 0.5})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(T.x + 3, T.y + 3, T.w - 6, T.h - 6, 16); ctx.stroke();
      fitText('Tap to throw', T.x + T.w / 2, T.y + T.h - 10, clamp(T.h * 0.17, 16, 28), T.w - 20, GOLD, UI, 800);
    }
  }

  function buttonsFor() {
    const BTN = L.BTN, sz = 26;
    if (scene === 'play') {
      if (state.autoMode) {
        button(BTN.auto.exit, 'Exit', { size: 24 }); button(BTN.auto.pause, state.autoPaused ? 'Resume' : 'Pause', { size: 24, primary: state.autoPaused });
        button(BTN.auto.dec, '- Think', { size: 22, dim: state.autoThinkIdx <= 0 }); button(BTN.auto.inc, L.land ? `Think + ${THINK_STEPS[state.autoThinkIdx]}s` : 'Think +', { size: 22, dim: state.autoThinkIdx >= THINK_STEPS.length - 1 });
              } else {
        button(BTN.menu, 'Menu', { size: sz, icon: 'menu' }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: sz, icon: 'hint', dim: state.hintsLeft <= 0, primary: !!state.hint });
      }
    }
  }
  function overlay() {
    ovlOn = true;
    if (P3) v3.scrim = 0.72; else { ctx.fillStyle = 'rgba(10,6,3,0.72)'; ctx.fillRect(0, 0, L.w, L.h); }
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 28, 'rgba(40,22,10,0.96)', 'rgba(246,200,90,0.6)', true, 'over');
    const res = state.result || { winner: g.winner, reason: g.reason }, w = res.winner;
    const title = state.autoMode ? `${NAMES[w]} wins` : state.two ? `${NAMES[w]} wins` : w === state.humanSide ? 'You win!' : 'The computer wins';
    const k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    drawSpatula(ctx, w, 0, 118, 140, { glow: 0.9, turned: true, lift: 0.3 + Math.sin(state.t * 2.5) * 0.06, style });
    fitText(title, 0, 238, 62, cw2 - 40, GOLD, FONT, 700);
    wrapBox(res.reason || '', R(-cw2 / 2 + 30, 252, cw2 - 60, 70), 26, 1.25, CREAM);
    fitText(`${g.rolls} throws · captured ${g.taken[0]} red, ${g.taken[1]} blue`.replace(/captured (\d+) red, (\d+) blue/, 'Red took $1, Blue took $2'), 0, 346, 22, cw2 - 40, DIM, UI, 500);
    if (!state.two && !state.autoMode && w === state.humanSide) { fitText(`★ ${LEVELS[state.level].name} beaten`, 0, 390, 24, cw2 - 40, '#ffd24a', UI, 700); confetti(c, 0); }
    ctx.restore();
    button(O.again, state.autoMode ? 'Watch another' : 'Play again', { primary: true, size: 32 }); button(O.back, 'Menu', { size: 28 });
    drawMoreLine(ctx, cx, O.back.y + O.back.h + 32, 22);
    ovlOn = false;
  }
  function confetti(c, cx) {
    if (state.calm) return;
    for (let k = 0; k < 22; k++) {
      const ph = (state.t * 0.32 + k * 0.0917) % 1, x = cx + Math.sin(k * 2.4 + state.t) * (60 + 170 * ph), y = 210 - ph * 190 + ph * ph * 120;
      ctx.fillStyle = k % 3 === 0 ? `rgba(255,214,110,${0.9 * (1 - ph)})` : k % 3 === 1 ? `rgba(255,120,90,${0.8 * (1 - ph)})` : `rgba(110,200,205,${0.8 * (1 - ph)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k + state.t * 2); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore();
    }
  }

  // ================================================================ documents (rules, how to play, about, settings)
  function drawDocument() {
    const D = L.doc, panelR = D.panel, vp = D.viewport, kind = state.doc.kind;
    if (P3) { v3.scrim = 0.38; v3.panels.push({ r: { x: panelR.x, y: panelR.y, w: panelR.w, h: panelR.h }, rad: 28, kind: 'sheet', side: 0 }); }
    else {
      ctx.fillStyle = 'rgba(6,10,12,0.5)'; ctx.fillRect(0, 0, L.w, L.h);
      ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 26);
      const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(58,34,18,0.93)'); pg.addColorStop(1, 'rgba(28,15,8,0.95)');
      ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(246,200,90,0.38)'; ctx.lineWidth = 2; ctx.stroke();
      edgeStroke(ctx, panelR, 26, 0.35);
    }
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kind];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 44, D.header.textDec.x - 100 - hx, GOLD, FONT, 700, 'left');
    ctx.strokeStyle = 'rgba(246,200,90,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panelR.x + 28, panelR.y + 82); ctx.lineTo(panelR.x + panelR.w - 28, panelR.y + 82); ctx.stroke();
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
          const cp = Math.min(46 * (1 + (Math.min(scale, 2) - 1) * 0.3), (bodyW - 10) / 11), ds = miniSize(cp) + cp * 0.2;
          if (vis(y, ds)) miniBoard(ctx, it.spec, cxp - (cp * 11) / 2, y, cp, wood);
          y += ds + gap;
        } else if (it.k === 'dice') {
          const sw = Math.min(190 * Math.min(scale, 1.5), (bodyW - 30) / 2), rowH = Math.max(40, sw * 0.28);
          for (let v = 1; v <= 4; v++) { if (vis(y, rowH)) drawStick(ctx, v, cxp - sw * 0.08, y + rowH / 2, sw, {}); y += rowH; }
          y += gap;
        } else if (it.k === 'btn') {
          const bs = Math.round(26 * Math.min(scale, 2.2)), bh = Math.round(72 * Math.min(scale, 2.2)), rr = R(left, y, bodyW, bh);
          if (vis(y, bh)) button(rr, it.label, { size: bs, primary: !it.disabled, dim: it.disabled, clipTo: vp });
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
            if (vis(ry, bh)) button(rr, o.locked ? `${o.l} (locked)` : o.l, { size: os, on: o.v === it.cur && !o.locked, primary: o.v === it.cur && !o.locked, dim: o.locked, clipTo: vp });
            ui.hits.push({ r: rr, id: it.id, v: o.v, locked: o.locked, need: o.need });
          });
          y += Math.ceil(n / per) * (bh + 10) + gap;
        }
      }
    });
    ctx.restore();
    const contentH = y - (vp.y - sc0) + 10;
    if (contentH - vp.h > 8) {
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(36,20,10,${a0})`); gr.addColorStop(1, `rgba(36,20,10,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 22, vp.y, 0, 0.95);
    }
    docMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); docMetrics.view = vp.h;
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(246,200,90,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(246,200,90,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(docMetrics.max > 0 ? (sc0 >= docMetrics.max - 1 ? 'End' : 'Scroll, or tap Next') : '', D.cx, D.counterY, 21, 'rgba(246,200,90,0.7)', UI, 500);
    button(D.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(D.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    fitText(`${Math.round(scale * 100)}%`, D.header.textDec.x - 14, D.header.textDec.y + 42, 22, 70, DIM, UI, 600, 'right');
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(30,16,8,0.97)'; ctx.fill(); ctx.strokeStyle = 'rgba(246,200,90,0.8)'; ctx.lineWidth = 2; ctx.stroke(); wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
  void drawBadgeStack; void count; void COLS;
}
