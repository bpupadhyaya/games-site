// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Heavy backdrops are cached (art.js).
import { RIES, ROWS, COLS, BOARD, FIELDERS, MIN_SCORING, TENSION, LEVEL_NAMES, venueOf, flightAt, crossing, upWindow, hintFielder, pointsFor, distanceFor, windDrift, tensionAt, strikerName, strikeNumber } from './rules.js';
import { cameraFor, glCamera, proj, scaleAt, curLayout, host, clamp } from './layout.js';
import { drawBackdrop, drawClouds, drawPine, drawChalet, drawCow, drawBunting, drawFlagPole, drawBock, drawPuckAt, drawPerson, drawBoard, drawRod, drawPanel, TEAM, INK, ACC, CREAM, FOREST, GOLD, lcg, shade } from './art.js';
import { screenButtons, screenLayout, readerFlow, readerMax, zoomOf, TEXT_SCALES } from './ui.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { ART_H } from './text.js';

export const DISPLAY = '"Barlow", "Helvetica Neue", Arial, system-ui, sans-serif';
const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
const easeOut = (f) => 1 - (1 - f) * (1 - f);
let PRESSED = null;
let GL = null;   // the 3D presenter's projection for this frame (null: the 2D art draws the whole scene)
const batOf = (s) => (s.vb != null ? s.vb : s.m ? s.m.bat : 0);
const R_FIT = new Map();

export function render(ctx, state, L = curLayout(), gl = null) {
  GL = gl;
  if (gl) ctx.clearRect(0, 0, L.w, L.h);   // the meadow is drawn behind this canvas
  const sc = state.scene, z = zoomOf(state), R = makeText(ctx);
  PRESSED = state.press && !state.press.moved ? state.press.b : null;
  const panelScene = ['setup', 'settings', 'how', 'about', 'rules', 'demo-limit'].includes(sc);
  if (sc === 'title') { drawTitle(ctx, state, R, L); return; }
  if (panelScene) { drawBackdropScene(ctx, state, L); scrim(ctx, L, 0.42); drawPanelScene(ctx, state, R, z, L); return; }
  const auto = sc === 'autoplay' || sc === 'autoplay-over';
  drawWorld(ctx, state, L);
  drawHud(ctx, state, R, L, auto);
  if (sc === 'play' || sc === 'autoplay') {
    if (!state.menuOpen) { drawYouTag(ctx, state, R); drawCoach(ctx, state, R, L); }
    if (!state.menuOpen) for (const b of screenButtons(state, L)) R.button(b);
    if (sc === 'autoplay' && state.ap.paused && !state.menuOpen) drawPausedBanner(ctx, R, L);
  }
  if (state.menuOpen && (sc === 'play' || sc === 'autoplay')) { scrim(ctx, L, 0.6); drawStack(ctx, state, R, z, L); }
  if (sc === 'over' || sc === 'autoplay-over') drawOver(ctx, state, R, z, L);
}

// A small gold "YOU" tag over the striker while you are the one striking.
let STRIKER_HEAD = null;
function drawYouTag(ctx, state, R) {
  if (state.scene !== 'play' || !state.m || batOf(state) !== 0 || !['ready', 'hold', 'whip'].includes(state.ph)) return;
  const h = GL && GL.strikerHead ? GL.strikerHead : STRIKER_HEAD; if (!h) return;
  const w = 78, ht = 34, x = h.x - w / 2, y = h.y - ht - 14;
  ctx.save();
  ctx.fillStyle = '#f0b429'; ctx.beginPath(); ctx.roundRect(x, y, w, ht, 17); ctx.fill();
  ctx.beginPath(); ctx.moveTo(h.x - 9, y + ht - 1); ctx.lineTo(h.x + 9, y + ht - 1); ctx.lineTo(h.x, y + ht + 11); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, ht, 17); ctx.stroke();
  R.text('YOU', h.x, y + ht * 0.72, 22, '#2b2118', DISPLAY, 800);
  ctx.restore();
}
// The first-play coach: a short, numbered instruction while you are new to a role. It stays for your first two strikes (or two
// fielded flights) and is never shown again; the pause menu's How to Play has the full story.
function drawCoach(ctx, state, R, L) {
  if (state.scene !== 'play' || !state.m) return;
  const c = state.coach || { bat: 0, field: 0 }, batH = batOf(state) === 0, ph = state.ph;
  let head = null, lines = null;
  if (batH && c.bat < 2 && (ph === 'ready' || ph === 'hold')) {
    head = 'HOW TO STRIKE';
    lines = ph === 'ready' ? ['1. PRESS and HOLD anywhere on the meadow', 'The rod bends back while the bar fills'] : ['2. SLIDE left or right to aim', '3. LET GO when the bar is in the gold'];
  } else if (!batH && c.field < 2 && (ph === 'ready' || ph === 'flight')) {
    head = 'HOW TO DEFEND';
    lines = ph === 'ready' ? ['The other side strikes the puck from the ramp', 'Watch where it flies, then TAP a fielder'] : ['TAP the fielder the puck is heading for', 'Tap as his ring turns gold to raise the board'];
  }
  if (!lines) return;
  const S = L.play.scene, wide = L.land && S.w > 1.8 * S.h, w = wide ? Math.min(S.w * 0.4, 430) : Math.min(S.w - 24, 560), hgt = wide ? 96 : 112, x = wide ? S.x + S.w - w - 12 : S.x + (S.w - w) / 2, y = S.y + S.h - hgt - 12;
  ctx.save(); ctx.globalAlpha = 0.97;
  plate(ctx, x, y, w, hgt, 18, 'rgba(14,40,28,0.92)', '#f0b429');
  R.text(head, x + w / 2, y + 30, 19, '#ffe27a', DISPLAY, 800);
  lines.forEach((ln, i) => R.fit(ln, x + w / 2, y + 40 + i * 32, w - 28, 32, 25, 13, '#fff8e6', i ? 600 : 800));
  ctx.restore();
}

// ---- text helpers ------------------------------------------------------------------------------------------------------------
function makeText(ctx) {
  const text = (str, x, y, size, color = '#fff', font = DISPLAY, weight = 600, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const glowText = (str, x, y, size, color, align = 'center') => { ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.14); ctx.strokeStyle = 'rgba(20,30,20,0.7)'; ctx.font = `800 ${size}px ${DISPLAY}`; ctx.textAlign = align; ctx.strokeText(str, x, y); ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.restore(); };
  const fit = (str, x, y, maxW, maxH, sMax, sMin, color, weight = 600) => {
    sMax = Math.round(sMax);
    const key = str + '|' + sMax + '|' + maxW + '|' + maxH + '|' + weight;
    let hit = R_FIT.get(key);
    if (!hit) {
      for (let s = sMax; s >= sMin; s -= 1) {
        ctx.font = `${weight} ${s}px ${DISPLAY}`; const lines = []; let cur = '';
        for (const w of str.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
        lines.push(cur);
        if (lines.length * s * 1.2 <= maxH || s === sMin) { hit = { s, lines }; break; }
      }
      if (R_FIT.size > 400) R_FIT.clear();
      R_FIT.set(key, hit);
    }
    const lh = hit.s * 1.2, top = y + (maxH - hit.lines.length * lh) / 2 + hit.s * 0.86;
    hit.lines.forEach((ln, i) => text(ln, x, top + i * lh, hit.s, color, DISPLAY, weight));
  };
  // lacquered wooden buttons: a darker lip below (depth), a lit face, a bright top edge; the face sinks onto the lip when pressed
  const button = (n) => {
    ctx.save(); if (n.dim) ctx.globalAlpha = 0.5;
    const down = !!n.id && n.id === PRESSED && !n.dim;
    const prim = n.primary, sel = n.sel, hot = prim || (sel && n.chip);
    const cTop = hot ? '#f2604a' : sel ? '#47ad72' : '#2f7d52', bot = hot ? '#b82a1b' : sel ? '#1f6b43' : '#16452e', lip = hot ? '#6e150d' : '#0b2a1a';
    const rad = Math.min(18, n.h * 0.3), depth = Math.min(7, n.h * 0.1) + 1;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(n.x + 1, n.y + depth + 5, n.w, n.h, rad); ctx.fill();
    ctx.fillStyle = lip; ctx.beginPath(); ctx.roundRect(n.x, n.y + depth, n.w, n.h, rad); ctx.fill();
    const dy = down ? depth - 2 : 0;
    const gf = ctx.createLinearGradient(0, n.y + dy, 0, n.y + dy + n.h); gf.addColorStop(0, cTop); gf.addColorStop(1, bot);
    ctx.fillStyle = gf; ctx.beginPath(); ctx.roundRect(n.x, n.y + dy, n.w, n.h, rad); ctx.fill();
    ctx.strokeStyle = hot ? '#ffd9c8' : 'rgba(205,240,215,0.75)'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.roundRect(n.x + 1, n.y + dy + 1, n.w - 2, n.h - 2, rad - 1); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(n.x + 0.5, n.y + dy + 0.5, n.w - 1, n.h - 1, rad); ctx.stroke();
    ctx.translate(0, dy);
    const lines = n.lines || [n.label];
    let size = n.size; const need = lines.length * size * 1.2;
    if (need > n.h - 12) size = Math.max(14, Math.floor((n.h - 12) / (lines.length * 1.2)));
    const floor = 11 / (host.px || 0.6);
    if (size < floor) { let t = Math.min(floor, (n.h - 8) / (lines.length * 1.2)); ctx.font = `700 ${t}px ${DISPLAY}`; while (t > size && Math.max(...lines.map((l) => ctx.measureText(l).width)) > n.w - 14) { t -= 0.5; ctx.font = `700 ${t}px ${DISPLAY}`; } size = Math.max(size, t); }
    ctx.font = `700 ${size}px ${DISPLAY}`;
    const mw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (mw > n.w - 12) size = Math.max(10, size * (n.w - 12) / mw);
    const lh = size * 1.2, top = n.y + n.h / 2 - (lines.length * lh) / 2 + size * 0.86;
    lines.forEach((ln, i) => text(ln, n.x + n.w / 2, top + i * lh, size, '#fff8e6', DISPLAY, 700));
    ctx.restore();
  };
  return { text, glowText, fit, button };
}
const scrim = (ctx, L, a = 0.6) => { ctx.fillStyle = `rgba(8,22,14,${a})`; ctx.fillRect(0, 0, L.w, L.h); };
let GRAIN = null;
const grain = (ctx) => {
  if (GRAIN === null) {
    GRAIN = false;
    try {
      const c = new OffscreenCanvas(160, 96), g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, 160, 96);
      const r = lcg(31);
      for (let i = 0; i < 70; i++) { const y = r() * 96, a = 0.05 + r() * 0.1; g.strokeStyle = r() > 0.5 ? `rgba(255,220,160,${a})` : `rgba(0,0,0,${a * 2})`; g.lineWidth = 0.6 + r() * 1.4; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(50, y + (r() - 0.5) * 6, 110, y + (r() - 0.5) * 6, 160, y + (r() - 0.5) * 3); g.stroke(); }
      GRAIN = ctx.createPattern(c, 'repeat') || false;
    } catch { GRAIN = false; }
  }
  return GRAIN;
};
const rivet = (ctx, x, y, r) => {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, '#fff2b8'); g.addColorStop(1, '#8a6420');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
};
// carved-wood plaques with a brass edge (dark walnut for the scoreboard and controls, pale parchment for messages)
const plate = (ctx, x, y, w, h, r = 16, fill = 'rgba(16,44,30,0.92)', edge = '#f0b429') => {
  const cream = /^rgba\(247/.test(fill);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (cream) { g.addColorStop(0, '#fbf3df'); g.addColorStop(1, '#e6d6b0'); } else { g.addColorStop(0, '#4a2f1a'); g.addColorStop(0.5, '#33200f'); g.addColorStop(1, '#22150a'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.restore();
  const gp = grain(ctx);
  if (gp) { ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip(); ctx.globalAlpha = cream ? 0.35 : 0.85; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = gp; ctx.fillRect(x, y, w, h); ctx.restore(); }
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  const hi = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 14)); hi.addColorStop(0, 'rgba(255,255,255,0.28)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hi; ctx.fillRect(x, y, w, Math.min(h, 14)); ctx.restore();
  const eg = ctx.createLinearGradient(x, y, x, y + h); eg.addColorStop(0, '#fbe392'); eg.addColorStop(0.5, '#c79a34'); eg.addColorStop(1, '#8c6620');
  ctx.strokeStyle = cream ? FOREST : eg; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, r - 1); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + 5, y + 5, w - 10, h - 10, Math.max(4, r - 5)); ctx.stroke();
  if (w > 150 && h > 40) { const rr = Math.min(4, h * 0.07); for (const [px, py] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]]) rivet(ctx, px, py, rr); }
};

// ---- the world ------------------------------------------------------------------------------------------------------------------
// Static scenery positions (world metres), deterministic.
const SCENERY = (() => {
  const r = lcg(2024), items = [];
  for (const sd of [-1, 1]) {
    for (let z = -20; z < 250; z += 14 + r() * 16) items.push({ k: 'pine', x: sd * (19 + r() * 16), z, tone: r() > 0.5 ? 1 : 0, sz: 0.85 + r() * 0.7 });
    for (let z = 20; z < 220; z += 55 + r() * 40) items.push({ k: 'cow', x: sd * (24 + r() * 14), z: z + r() * 20, flip: r() > 0.5 ? 1 : -1 });
    for (let z = 15; z < 190; z += 7 + r() * 5) if (r() > 0.35) items.push({ k: 'fan', x: sd * (RIES.half + 3 + r() * 5), z, col: ['#e8a823', '#3fa05a', '#8a5bd6', '#e8e0d0', '#d96a2b', '#4aa7c8'][Math.floor(r() * 6)], hat: r() > 0.6 });
    items.push({ k: 'chalet', x: sd * 33, z: 70 + (sd > 0 ? 40 : 0), sz: 1.2 });
  }
  for (const zb of [-30, -55, -85, -120]) for (let i = 0; i < 9; i++) items.push(r() > 0.72 ? { k: 'chalet', x: -70 + i * 17 + r() * 8, z: zb - r() * 12, sz: 1.5 + r() } : { k: 'pine', x: -70 + i * 17 + r() * 12, z: zb - r() * 14, tone: i % 2, sz: 1.3 + r() * 0.9 });
  for (const zb of [250, 285, 320]) for (let i = 0; i < 9; i++) items.push(r() > 0.72 ? { k: 'chalet', x: -70 + i * 17 + r() * 8, z: zb + r() * 12, sz: 1.5 + r() } : { k: 'pine', x: -70 + i * 17 + r() * 12, z: zb + r() * 14, tone: i % 2, sz: 1.3 + r() * 0.9 });
  items.push({ k: 'chalet', x: -8, z: 232, sz: 1.5 }, { k: 'chalet', x: 14, z: 244, sz: 1.2 }, { k: 'chalet', x: 34, z: 222, sz: 1.3 }, { k: 'chalet', x: -32, z: 236, sz: 1.3 });
  for (let i = 0; i < 16; i++) items.push({ k: 'pine', x: -50 + i * 6.5 + r() * 3, z: 235 + r() * 40, tone: i % 2, sz: 1.2 + r() * 0.8 });
  return items;
})();

function drawFan(ctx, X, Y, s, it, bob) {
  const k = Math.max(s, 3) * 1.1;
  ctx.fillStyle = it.col; ctx.beginPath(); ctx.roundRect(X - 0.28 * k, Y - 1.1 * k + bob, 0.56 * k, 0.85 * k, 0.2 * k); ctx.fill();
  ctx.fillStyle = '#e6b48f'; ctx.beginPath(); ctx.arc(X, Y - 1.3 * k + bob, 0.17 * k, 0, TAU); ctx.fill();
  if (it.hat) { ctx.fillStyle = '#2b2118'; ctx.fillRect(X - 0.22 * k, Y - 1.42 * k + bob, 0.44 * k, 0.07 * k); ctx.fillRect(X - 0.13 * k, Y - 1.56 * k + bob, 0.26 * k, 0.16 * k); }
}

// the throws that exist now: [{ id, th, peak, sx, who }]
function boardPose(th, ft, level) {
  const tau = ft - th.th; if (tau < 0) return null;
  const upB = upWindow(level)[1], fall = 0.55, end = upB + fall + 0.5;
  if (tau > end) return null;
  let y, a = 1;
  if (tau < 0.3) y = 1.2 + (th.peak - 1.2) * easeOut(tau / 0.3);
  else if (tau < upB) y = th.peak + 0.12 * Math.sin((tau - 0.3) * 9);
  else { const f = clamp((tau - upB) / fall, 0, 1); y = Math.max(0.5, th.peak * (1 - f * f)); if (tau > upB + fall) a = clamp(1 - (tau - upB - fall) / 0.5, 0, 1); }
  return { y, sx: th.sx * ease(clamp(tau / 0.3, 0, 1)), arms: tau < 0.45 ? 1 : 0, a, tau, live: tau >= 0.3 && tau <= upB, rot: Math.sin(tau * 6) * 0.08 * (tau > upB ? 3 : 1) };
}

export function puckState(state) {
  const fl = state.fl; if (!fl) return null;
  if (state.stop) {
    const dt = state.dropT || 0, y = state.stop.y * Math.max(0, 1 - (dt / 0.55) * (dt / 0.55));
    return { x: state.stop.x, y, z: state.stop.z, u: 1, stopped: true, drop: dt };
  }
  const f = flightAt(fl, Math.min(state.ft, fl.T));
  return { ...f, stopped: false, landed: state.ft >= fl.T };
}

function drawGround(ctx, L, cam, v, t) {
  ctx.fillStyle = v.grass[1]; ctx.fillRect(0, Math.floor(cam.hy), L.w, L.h - Math.floor(cam.hy));
  // mowing stripes, far to near
  const P = (x, z) => proj(cam, x, 0, z);
  let i = 0;
  for (let d = 280; d > 5; d -= 12, i++) {
    const z0 = cam.zc + cam.dir * d, z1 = cam.zc + cam.dir * Math.max(5, d - 12);
    const a = P(-220, z0), b = P(220, z0), c = P(220, z1), e = P(-220, z1);
    ctx.fillStyle = i % 2 ? v.grass[0] : v.grass[1];
    ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(b.X, b.Y); ctx.lineTo(c.X, c.Y); ctx.lineTo(e.X, e.Y); ctx.closePath(); ctx.fill();
  }
  // patchwork of pastures and hay fields on both sides and beyond the ends
  const pr = lcg(77), tints = [v.grass[0], '#8fbf4a', '#b5c75a', '#6aa84a', '#a8b84a'];
  for (let k = 0; k < 46; k++) {
    const side = pr() < 0.5 ? -1 : 1, zc0 = -140 + pr() * 440, x0 = side * (RIES.half + 6 + pr() * 90), w = 14 + pr() * 40, dl = 10 + pr() * 40;
    if (Math.abs(x0) < RIES.half + 5 && zc0 > -5 && zc0 < RIES.len + 5) continue;
    const dd = cam.dir > 0 ? zc0 - cam.zc : cam.zc - zc0; if (dd < 14) continue;
    const a = P(x0, zc0), b = P(x0 + side * w, zc0), c = P(x0 + side * w, zc0 + dl), e = P(x0, zc0 + dl);
    ctx.fillStyle = tints[Math.floor(pr() * tints.length)]; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(b.X, b.Y); ctx.lineTo(c.X, c.Y); ctx.lineTo(e.X, e.Y); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
  }
  // the Ries: a slightly lighter, finely mown lane
  const lane = [[-RIES.half, 0], [RIES.half, 0], [RIES.half, RIES.len], [-RIES.half, RIES.len]];
  const q = [];
  for (const [x, z] of lane) q.push(P(x, z));
  const lg = ctx.createLinearGradient(0, cam.dir > 0 ? P(0, RIES.len).Y : P(0, 0).Y, 0, cam.dir > 0 ? P(0, 0).Y : P(0, RIES.len).Y);
  lg.addColorStop(0, 'rgba(255,255,230,0.16)'); lg.addColorStop(1, 'rgba(255,255,230,0.07)');
  ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(q[0].X, q[0].Y); for (let k = 1; k < 4; k++) ctx.lineTo(q[k].X, q[k].Y); ctx.closePath(); ctx.fill();
  // fine stripes along the lane
  for (let z = 0, k = 0; z < RIES.len; z += 10, k++) {
    if (k % 2) continue;
    const a = P(-RIES.half, z), b = P(RIES.half, z), c = P(RIES.half, z + 10), e = P(-RIES.half, z + 10);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(b.X, b.Y); ctx.lineTo(c.X, c.Y); ctx.lineTo(e.X, e.Y); ctx.closePath(); ctx.fill();
  }
  // lane edges and cross lines
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineCap = 'round';
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    for (let z = 0; z <= RIES.len; z += 10) { const p = P(sd * RIES.half, z); if (z === 0) ctx.moveTo(p.X, p.Y); else ctx.lineTo(p.X, p.Y); }
    ctx.lineWidth = Math.max(1.5, scaleAt(cam, RIES.len / 2) * 0.28); ctx.stroke();
  }
  const cross = (z, dash, a = 0.7) => {
    const p0 = P(-RIES.half, z), p1 = P(RIES.half, z), s = p0.s;
    ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = Math.max(1.4, s * 0.22); if (dash) ctx.setLineDash([s * 0.9, s * 0.8]);
    ctx.beginPath(); ctx.moveTo(p0.X, p0.Y); ctx.lineTo(p1.X, p1.Y); ctx.stroke(); ctx.restore();
  };
  cross(0, false, 0.9); cross(RIES.len, false, 0.9); cross(MIN_SCORING, true, 0.6); cross(105, true, 0.5); cross(135, true, 0.5);
  void t;
}

function zoneLabels(ctx, cam, R) {
  const lab = (z, str) => {
    const p = proj(cam, cam.dir > 0 ? -RIES.half + 2.2 : RIES.half - 2.2, 0, z + (cam.dir > 0 ? 6 : -6)), size = clamp(p.s * 1.15, 11, 30);
    ctx.save(); ctx.globalAlpha = 0.85; R.text(str, p.X, p.Y, size, '#fff8e6', DISPLAY, 800); ctx.restore();
  };
  lab(MIN_SCORING, '1'); lab(105, '2'); lab(135, '3');
}

// the whole scene for the current view; `o.titleDemo` draws a looping demo flight instead of the match state
export function drawWorld(ctx, state, L, o = {}) {
  const m = state.m, t = state.t, calm = state.prefs.calm;
  const view = o.view || (m && batOf(state) === 1 ? 'field' : 'bat');
  const v = venueOf(o.venue || (m ? m.venue : state.setup.venue));
  const R = o.R || makeText(ctx);
  if (GL) { drawGlWorld(ctx, state, L, R, o); return; }
  const cam = o.cam || cameraFor(L, view);
  drawBackdrop(ctx, L, cam, v.id);
  drawClouds(ctx, L.w, cam.hy, t, calm);
  drawGround(ctx, L, cam, v, t);
  zoneLabels(ctx, cam, R);
  // bunting along both side lines
  for (const sd of [-1, 1]) for (let z = 10; z < 180; z += 40) {
    const a = proj(cam, sd * (RIES.half + 0.8), 0, z), b = proj(cam, sd * (RIES.half + 0.8), 0, z + 40);
    drawBunting(ctx, a.X, a.Y - a.s * 2.4, b.X, b.Y - b.s * 2.4, (a.s + b.s) / 2, t, calm);
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = Math.max(1.5, a.s * 0.12); ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(a.X, a.Y - a.s * 2.5); ctx.stroke();
  }
  const items = [];
  const push = (z, fn) => items.push({ d: cam.dir > 0 ? z - cam.zc : cam.zc - z, fn });
  for (const it of SCENERY) {
    const dd = cam.dir > 0 ? it.z - cam.zc : cam.zc - it.z; if (dd < 9) continue;
    const p = proj(cam, it.x, 0, it.z); if (p.X < -80 || p.X > L.w + 80) continue;
    if (it.k === 'pine') push(it.z, () => drawPine(ctx, p.X, p.Y, p.s * it.sz, it.tone));
    else if (it.k === 'cow') push(it.z, () => drawCow(ctx, p.X, p.Y, p.s, it.flip));
    else if (it.k === 'chalet') push(it.z, () => drawChalet(ctx, p.X, p.Y, p.s * it.sz));
    else if (it.k === 'fan') push(it.z, () => drawFan(ctx, p.X, p.Y, p.s, it, calm ? 0 : Math.sin(t * 3 + it.z) * p.s * 0.03));
  }
  // flag pole near the Bock (bat view: bottom-left; field view: far back) shows the wind
  const wind = m ? m.wind : 0.9;
  { const fx = cam.dir > 0 ? -RIES.half - 2.6 : RIES.half + 2.6, fz = cam.dir > 0 ? 6 : 150, p = proj(cam, fx, 0, fz); push(fz, () => drawFlagPole(ctx, p.X, p.Y, p.s, wind * (cam.dir > 0 ? 1 : -1), t, calm)); }
  // the Bock and striker
  const bp = proj(cam, 0, 0, 0);
  push(0, () => drawBock(ctx, bp.X, bp.Y, bp.s, !(state.fl && (state.ph === 'flight' || state.ph === 'result')), calm));
  push(-0.5, () => drawStriker(ctx, state, cam, o));
  // fielders
  const fteam = o.fieldTeam != null ? o.fieldTeam : m ? 1 - batOf(state) : 1;
  const th = o.throws || state.throws || [], ft = o.ft != null ? o.ft : state.ft || 0, level = m ? m.level : 'normal';
  const byId = new Map(); for (const q of th) if (!byId.has(q.id)) byId.set(q.id, q);
  const boards = [];
  for (const f of FIELDERS) {
    const q = byId.get(f.id), pose = q ? boardPose(q, ft, level) : null;
    const sxo = pose ? pose.sx : 0, p = proj(cam, f.x + sxo, 0, f.z);
    const big = Math.max(1, 17 / (1.75 * p.s)), idle = calm ? 0 : Math.sin(t * 1.6 + f.id * 1.7) * 0.012;
    const isHint = (state.hintId === f.id && state.ph === 'flight') || (state.hintIds && state.hintIds.includes(f.id));
    push(f.z, () => {
      if (isHint) { const pu = 0.5 + 0.5 * Math.sin(t * 7); ctx.save(); ctx.strokeStyle = `rgba(255,236,120,${0.6 + 0.4 * pu})`; ctx.lineWidth = Math.max(2, p.s * 0.28); ctx.shadowColor = '#ffd45a'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.ellipse(p.X, p.Y, p.s * (1.5 + pu * 0.2) * big, p.s * 0.55 * big, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
      drawPerson(ctx, p.X, p.Y, p.s, { team: fteam, back: cam.dir < 0, arms: pose ? pose.arms : 0, bob: idle, big, step: pose && pose.tau < 0.3 ? Math.sin(pose.tau * 30) : 0 });
      if (!pose || pose.tau > upWindow(level)[1] + 1.05) { // the board carried at the side
        drawBoard(ctx, p.X + (cam.dir < 0 ? 1 : -1) * 0.62 * p.s * big, p.Y - 1.0 * p.s * big, p.s * big * 0.42, 0.25, 0.95);
      }
    });
    if (pose && pose.a > 0) {
      const bpos = proj(cam, f.x + sxo, pose.y, f.z);
      boards.push({ z: f.z + 0.01, fn: () => drawBoard(ctx, bpos.X, bpos.Y, bpos.s * 1.0, pose.rot, pose.a, pose.live) });
    }
  }
  for (const b of boards) push(b.z, b.fn);
  items.sort((a, b) => b.d - a.d);
  for (const it of items) it.fn();
  drawFlightLayer(ctx, state, L, cam, R, o);
  drawFx(ctx, state, cam, R);
}

function drawStriker(ctx, state, cam, o) {
  const m = state.m, team = o.strikeTeam != null ? o.strikeTeam : m ? batOf(state) : 0;
  const p = proj(cam, -1.9, 0, -0.2), s = p.s, big = Math.max(1.35, 17 / (1.75 * s));
  const hold = state.hold || { tension: 0 }, sw = state.swing;
  const winding = state.ph === 'hold' || state.ph === 'windup';
  const tension = winding ? hold.tension : sw ? 0 : 0;
  let ang = -1.0 - 1.9 * tension, bend = -0.35 * tension, arms = 0.4 + 0.5 * tension;
  if (sw) { const f = clamp(sw.t / 0.2, 0, 1), a0 = -1.0 - 1.9 * sw.t0; ang = a0 + (0.3 - a0) * ease(f); bend = -0.5 * (1 - f); arms = 0.8 - 0.5 * f; }
  const per = drawPerson(ctx, p.X, p.Y, s, { team, back: true, arms, lean: (winding ? -0.35 * tension : sw ? 0.3 * clamp(sw.t / 0.2, 0, 1) : 0), big, bob: 0 });
  STRIKER_HEAD = { x: per.hx + (per.k > 0 ? 0 : 0), y: per.topY };
  const k = per.k, hx = p.X + 0.28 * k, hy = per.shY + 0.15 * k - arms * 0.55 * k;
  drawRod(ctx, hx, hy, ang, 3.1 * k, bend, Math.max(2.2, 0.1 * k));
  void o;
}

// puck, shadow, trail, guide marker, aim preview
function drawFlightLayer(ctx, state, L, cam, R, o) {
  const m = state.m, calm = state.prefs.calm, t = state.t;
  // aim preview while the human strikes
  if (state.ph === 'hold' && state.m && batOf(state) === 0 && state.scene === 'play') drawAim(ctx, state, cam, R);
  if (state.plan && state.apShowPlan && (state.ph === 'apreveal' || state.ph === 'windup')) drawPlanTarget(ctx, state, cam, R);
  if (state.hintTarget) drawHintTarget(ctx, state, cam, R);
  const pk = puckState(state); if (!pk) return;
  const fl = state.fl;
  const g = proj(cam, pk.x, 0, pk.z), a = proj(cam, pk.x, pk.y, pk.z);
  drawArcAndLanding(ctx, state, cam, pk);
  // shadow (in 3D the presenter draws the puck, its tracer and its shadow)
  if (!GL) { ctx.save(); ctx.fillStyle = `rgba(10,30,10,${0.35 - Math.min(0.2, pk.y * 0.008)})`; ctx.beginPath(); ctx.ellipse(g.X, g.Y, Math.max(3, g.s * 0.55), Math.max(1.6, g.s * 0.2), 0, 0, TAU); ctx.fill(); ctx.restore(); }
  // trail
  if (!GL && !pk.stopped && !pk.landed && !calm) {
    ctx.save(); ctx.lineCap = 'round';
    let prev = a;
    for (let k = 1; k <= 9; k++) {
      const f = flightAt(fl, Math.max(0, state.ft - k * 0.045)), q = proj(cam, f.x, f.y, f.z);
      ctx.strokeStyle = `rgba(255,170,60,${0.5 * (1 - k / 10)})`; ctx.lineWidth = Math.max(1.5, a.s * 0.3 * (1 - k / 11) + 1.5);
      ctx.beginPath(); ctx.moveTo(prev.X, prev.Y); ctx.lineTo(q.X, q.Y); ctx.stroke(); prev = q;
    }
    ctx.restore();
  }
  // guide marker (fielding): where the puck will pass the line of fielders it can still be stopped on
  if (state.prefs.guide && m && state.scene === 'play' && batOf(state) === 1 && state.ph === 'flight' && !pk.stopped) {
    const h = hintFielder(fl);
    if (h) {
      const q = clamp((state.ft / fl.T - 0.2) / 0.35, 0, 1), wob = (1 - q) * 2.2 * Math.sin(state.ft * 6);
      const c = h.cross, ttc = c.t - state.ft;
      if (ttc > -0.15) {
        const [ua, ub] = upWindow(m.level), now = ttc >= ua && ttc <= ub;
        const P = proj(cam, c.x + wob, c.y, FIELDERS[h.id].z), r0 = clamp(P.s * 1.25, 7, 54);
        const outer = r0 * (1 + 1.9 * clamp((ttc - ua) / 1.1, 0, 1));
        const pu = 0.5 + 0.5 * Math.sin(t * 12);
        ctx.save();
        ctx.setLineDash([]); ctx.lineWidth = Math.max(2.2, r0 * 0.14);
        ctx.strokeStyle = now ? `rgba(255,226,90,${0.8 + 0.2 * pu})` : 'rgba(255,255,255,0.8)'; ctx.shadowColor = now ? '#ffd24a' : 'rgba(0,0,0,0.5)'; ctx.shadowBlur = now ? 16 : 6;
        ctx.beginPath(); ctx.arc(P.X, P.Y, outer, 0, TAU); ctx.stroke();
        ctx.lineWidth = Math.max(1.6, r0 * 0.09); ctx.strokeStyle = now ? '#7bff9a' : 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(P.X, P.Y, r0, 0, TAU); ctx.stroke();
        ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5; const gp = proj(cam, c.x + wob, 0, FIELDERS[h.id].z); ctx.beginPath(); ctx.moveTo(P.X, P.Y + r0); ctx.lineTo(gp.X, gp.Y); ctx.stroke();
        if (now) R.glowText('NOW', P.X, P.Y - r0 * 1.5 - 4, clamp(r0 * 0.9, 16, 30), '#ffe27a');
        ctx.restore();
      }
    }
  }
  // the puck itself
  if (GL) return;
  const rr = Math.max(4.2, a.s * 0.36);
  drawPuckAt(ctx, a.X, a.Y, rr, pk.stopped ? 0 : 0.8);
}

// The path the puck is on: a dotted arc from where it is now to where it comes down, and a ring on the meadow where it lands.
// This is what makes the flight read at a glance, whoever is watching it.
function drawArcAndLanding(ctx, state, cam, pk) {
  const fl = state.fl; if (!fl || state.stop) return;
  const t0 = Math.min(state.ft, fl.T);
  ctx.save(); ctx.setLineCap?.('round'); ctx.setLineDash([3, 9]); ctx.lineWidth = Math.max(2, 2.6); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath();
  let first = true;
  for (let i = 0; i <= 36; i++) {
    const tt = t0 + (fl.T - t0) * i / 36, f = flightAt(fl, tt), q = proj(cam, f.x, f.y, f.z);
    if (first) { ctx.moveTo(q.X, q.Y); first = false; } else ctx.lineTo(q.X, q.Y);
  }
  ctx.stroke(); ctx.setLineDash([]);
  const lp = proj(cam, fl.xL + fl.cw * 0, 0, fl.D), pu = 0.5 + 0.5 * Math.sin(state.t * 7);
  ctx.strokeStyle = `rgba(255,236,150,${0.7 + 0.3 * pu})`; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(lp.X, lp.Y, Math.max(8, lp.s * 1.7), Math.max(4, lp.s * 0.6), 0, 0, TAU); ctx.stroke();
  void pk; ctx.restore();
}

// ---- the world when the 3D presenter draws it: only the overlays that belong to the game remain here -------------------------------------
function drawGlWorld(ctx, state, L, R, o) {
  const cam = glCamera(GL, L), t = state.t;
  // the fielders the Hint or Auto Play points at
  const ids = new Set([...(state.hintIds || []), ...(state.hintId != null && state.ph === 'flight' ? [state.hintId] : [])]);
  for (const id of ids) {
    const f = FIELDERS[id], p = proj(cam, f.x, 0, f.z), pu = 0.5 + 0.5 * Math.sin(t * 7);
    ctx.save(); ctx.strokeStyle = `rgba(255,236,120,${0.7 + 0.3 * pu})`; ctx.lineWidth = Math.max(2, p.s * 0.22); ctx.shadowColor = '#ffd45a'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.ellipse(p.X, p.Y, p.s * (1.7 + pu * 0.2), p.s * 0.7, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  drawFlightLayer(ctx, state, L, cam, R, o);
  drawFx(ctx, state, cam, R);
  void L;
}

function drawAim(ctx, state, cam, R) {
  const h = state.hold; if (!h) return;
  const D = h.D, drift = state.prefs.guide ? windDrift(state.m.wind, D) : 0, x = clamp(h.aimX + drift, -RIES.half - 2, RIES.half + 2);
  const P = proj(cam, x, 0, D), perfect = h.perfect;
  const pu = 0.5 + 0.5 * Math.sin(state.t * 8);
  // trajectory preview
  ctx.save(); ctx.setLineDash([6, 8]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath();
  const fl = { D, xL: x, cw: 0, T: 2.2 + D * 0.021, H: 3 + D * 0.12 };
  for (let i = 0; i <= 28; i++) { const f = flightAt(fl, fl.T * i / 28), q = proj(cam, f.x, f.y, f.z); if (i === 0) ctx.moveTo(q.X, q.Y); else ctx.lineTo(q.X, q.Y); }
  ctx.stroke(); ctx.restore();
  // landing ring with its scatter
  const sx = (perfect ? 0.35 : 0.75) * 1.6 * P.s, sy = (perfect ? 1.5 : 4.5) * 1.6 * P.s * 0.28;
  ctx.save();
  ctx.fillStyle = perfect ? 'rgba(255,220,90,0.28)' : 'rgba(255,255,255,0.18)'; ctx.strokeStyle = perfect ? `rgba(255,226,90,${0.8 + 0.2 * pu})` : 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(P.X, P.Y, Math.max(8, sx), Math.max(4, sy), 0, 0, TAU); ctx.fill(); ctx.stroke();
  const pts = pointsFor(D), lab = D < MIN_SCORING ? `${Math.round(D)} m · too short` : `${Math.round(D)} m · ${pts} point${pts > 1 ? 's' : ''}`;
  R.glowText(lab, clamp(P.X, 90, L_W(cam) - 90), P.Y - Math.max(14, sy + 12), 22, perfect ? '#ffe27a' : '#fff8e6');
  ctx.restore();
}
const L_W = (cam) => cam.cx * 2;
function drawPlanTarget(ctx, state, cam, R) {
  const p = state.plan, P = proj(cam, p.x, 0, p.D), pu = 0.5 + 0.5 * Math.sin(state.t * 6);
  ctx.save(); ctx.strokeStyle = `rgba(255,226,90,${0.7 + 0.3 * pu})`; ctx.lineWidth = 4; ctx.shadowColor = '#ffd24a'; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.ellipse(P.X, P.Y, Math.max(12, P.s * 1.5), Math.max(6, P.s * 0.7), 0, 0, TAU); ctx.stroke(); ctx.restore();
  R.glowText(`${Math.round(p.D)} m`, clamp(P.X, 60, cam.cx * 2 - 60), P.Y - Math.max(18, P.s * 1.1), 22, '#ffe27a');
}
function drawHintTarget(ctx, state, cam, R) {
  const h = state.hintTarget, P = proj(cam, h.x, 0, h.D), pu = 0.5 + 0.5 * Math.sin(state.t * 6);
  ctx.save(); ctx.strokeStyle = `rgba(120,255,160,${0.7 + 0.3 * pu})`; ctx.lineWidth = 4; ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.ellipse(P.X, P.Y, Math.max(12, P.s * 1.5), Math.max(6, P.s * 0.7), 0, 0, TAU); ctx.stroke(); ctx.restore();
  R.glowText('Aim here', clamp(P.X, 60, cam.cx * 2 - 60), P.Y - Math.max(18, P.s * 1.1), 22, '#9dffb4');
}

function drawFx(ctx, state, cam, R) {
  for (const p of state.parts) {
    const q = proj(cam, p.x, p.y, p.z), a = clamp(p.life / p.max, 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(q.X, q.Y, Math.max(1.5, p.sz * q.s * 0.14 * (0.4 + 0.6 * a)), 0, TAU); ctx.fill(); ctx.restore();
  }
  for (const p of state.pops) {
    const q = proj(cam, p.x, p.y, p.z), a = clamp(1 - Math.max(0, p.t - 1.1) / 0.6, 0, 1), up = ease(clamp(p.t / 0.5, 0, 1)) * 26;
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = `800 28px ${DISPLAY}`; const w = ctx.measureText(p.text).width + 30, x = clamp(q.X, w / 2 + 8, cam.cx * 2 - w / 2 - 8), y = q.Y - 36 - up;
    plate(ctx, x - w / 2, y - 28, w, 42, 21, 'rgba(16,44,30,0.94)', p.edge || GOLD);
    R.text(p.text, x, y + 3, 28, p.color, DISPLAY, 800); ctx.restore();
  }
}

function drawBackdropScene(ctx, state, L) {
  if (GL) return;
  const cam = cameraFor(L, 'field', R_title(L), 'bgp');
  drawWorld(ctx, state, L, { cam, view: 'field', throws: [], ft: 0 });
}
const R_title = (L) => ({ x: L.U.x0, y: L.U.y0 + L.U.h * 0.12, w: L.U.w, h: L.U.h * 0.72 });

// ---- heads-up display -------------------------------------------------------------------------------------------------------------
function drawHud(ctx, state, R, L, auto) {
  const P = L.play, m = state.m; if (!m) return;
  const b = P.board;
  plate(ctx, b.x, b.y, b.w, b.h, 18, 'rgba(14,40,28,0.93)', '#e9c046');
  const half = b.w * 0.32;
  const side = (i, x, align) => {
    const bat = batOf(state) === i, col = TEAM[i].shirt, nameSz = clamp(b.h * 0.27, 16, 24);
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, b.y + 10, 8, b.h - 20, 4); ctx.fill();
    const tx = align === 'left' ? x + 18 : x - 10;
    R.text(i === 0 ? (auto ? m.names[0] : 'You · ' + m.names[0]) : m.names[1], tx, b.y + b.h * 0.36, nameSz, '#fff8e6', DISPLAY, 700, align === 'left' ? 'left' : 'right');
    R.text(bat ? 'STRIKING' : 'FIELDING', tx, b.y + b.h * 0.8, clamp(b.h * 0.2, 12, 17), bat ? '#ffd45a' : '#9fd8b4', DISPLAY, 700, align === 'left' ? 'left' : 'right');
  };
  side(0, b.x + 14, 'left');
  // the right team: bar on the right edge
  { const x = b.x + b.w - 14; ctx.fillStyle = TEAM[1].shirt; ctx.beginPath(); ctx.roundRect(x - 8, b.y + 10, 8, b.h - 20, 4); ctx.fill(); const nameSz = clamp(b.h * 0.27, 16, 24), tx = x - 20, bat = batOf(state) === 1;
    R.text(m.names[1], tx, b.y + b.h * 0.36, nameSz, '#fff8e6', DISPLAY, 700, 'right'); R.text(bat ? 'STRIKING' : 'FIELDING', tx, b.y + b.h * 0.8, clamp(b.h * 0.2, 12, 17), bat ? '#ffd45a' : '#9fd8b4', DISPLAY, 700, 'right'); }
  // scores in the middle
  const cx = b.x + b.w / 2, big = clamp(b.h * 0.62, 30, 56);
  R.text(String(m.score[0]), cx - 38, b.y + b.h * 0.66, big, '#fff8e6', DISPLAY, 800, 'right');
  R.text(String(m.score[1]), cx + 38, b.y + b.h * 0.66, big, '#fff8e6', DISPLAY, 800, 'left');
  R.text(':', cx, b.y + b.h * 0.62, big * 0.8, '#e9c046', DISPLAY, 800);
  void half;
  // the plaque: message
  const q = P.plaque;
  plate(ctx, q.x, q.y, q.w, q.h, 14, 'rgba(247,240,220,0.96)', FOREST);
  const lbl = `Half ${m.inning + 1}/2 · Strike ${Math.min(m.strike + 1, m.len)}/${m.len} · ${strikerName(m)} (${m.names[batOf(state)]}) · Wind ${windText(m.wind)}`;
  if (state.msg) R.fit(state.msg, q.x + q.w / 2, q.y + 2, q.w - 24, q.h * 0.62, q.h * 0.42, 12, INK, 700);
  R.text(lbl, q.x + q.w / 2, q.y + q.h - 8, clamp(q.h * 0.2, 11, 15), '#5a4a3a', DISPLAY, 600);
  drawInfo(ctx, state, R, L, auto);
}
const windText = (w) => `${Math.abs(w).toFixed(1)} m/s ${w > 0.05 ? 'to the right' : w < -0.05 ? 'to the left' : 'calm'}`;

function drawInfo(ctx, state, R, L, auto) {
  const I = L.play.info, m = state.m, h = state.hold;
  const humanBat = !auto && batOf(state) === 0, pu = 0.5 + 0.5 * Math.sin(state.t * 5);
  if (auto) {
    plate(ctx, I.x, I.y, I.w, I.h, 14, 'rgba(14,40,28,0.9)');
    const ap = state.ap, label = state.ph === 'apthink' ? 'Computer is thinking...' : state.ph === 'apreveal' ? 'Its chosen target' : state.ph === 'flight' ? 'Watch the flight' : state.ph === 'result' ? 'Result' : state.ph === 'windup' || state.ph === 'whip' ? 'The strike' : 'Watch & Learn';
    const think = state.apTime || 1, f = state.ph === 'apthink' ? clamp(1 - state.wait / think, 0, 1) : state.ph === 'apreveal' ? clamp(1 - state.wait / 2, 0, 1) : 0;
    R.text(ap.paused ? 'Paused' : label, I.x + 18, I.y + I.h * 0.62, clamp(I.h * 0.38, 14, 22), '#ffe27a', DISPLAY, 800, 'left');
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.roundRect(I.x + I.w * 0.5, I.y + I.h * 0.38, I.w * 0.45, I.h * 0.24, 8); ctx.fill();
    ctx.fillStyle = '#e9c046'; ctx.beginPath(); ctx.roundRect(I.x + I.w * 0.5, I.y + I.h * 0.38, Math.max(8, I.w * 0.45 * f), I.h * 0.24, 8); ctx.fill();
    return;
  }
  if (humanBat) {
    // the tension meter
    const x = I.x, y = I.y, w = I.w, hh = I.h;
    plate(ctx, x, y, w, hh, 14, 'rgba(14,40,28,0.92)');
    const bx = x + 18, bw = w - 36, by = y + hh * 0.72, bh = hh * 0.28;
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(bx, by - bh / 2, bw, bh, bh / 2); ctx.fill();
    // gold zone
    ctx.fillStyle = 'rgba(255,205,60,0.55)'; ctx.fillRect(bx + bw * TENSION.perfectA, by - bh / 2, bw * (TENSION.perfectB - TENSION.perfectA), bh);
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.strokeRect(bx + bw * TENSION.perfectA, by - bh / 2, bw * (TENSION.perfectB - TENSION.perfectA), bh);
    const ten = state.ph === 'hold' && h ? h.tension : 0;
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#59c26b'); g.addColorStop(0.8, '#e9c046'); g.addColorStop(1, '#ff7a1c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(bx, by - bh / 2, Math.max(bh, bw * ten), bh, bh / 2); ctx.fill();
    if (state.ph === 'hold') { ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * ten - 2, by - bh * 0.85, 4, bh * 1.7); }
    const msg = state.ph === 'hold' ? (h && h.perfect ? 'LET GO NOW!' : 'Let go while the bar is in the gold') : state.ph === 'ready' ? 'HOLD your finger down to bend the rod' : state.ph === 'whip' ? 'Strike!' : state.fl ? `In the air: ${Math.round(state.fl.D)} m` : '';
    if (msg) R.text(msg, x + w / 2, y + hh * 0.34, clamp(hh * 0.3, 13, 19), state.ph === 'ready' ? `rgba(255,248,230,${0.7 + 0.3 * pu})` : (h && h.perfect && state.ph === 'hold' ? '#ffe27a' : '#fff8e6'), DISPLAY, 800);
    return;
  }
  // fielding: boards left
  plate(ctx, I.x, I.y, I.w, I.h, 14, 'rgba(14,40,28,0.92)');
  const left = state.boardsLeft ?? 0, tot = state.boardsTotal ?? 2, sz = I.h * 0.5;
  for (let i = 0; i < tot; i++) drawBoard(ctx, I.x + 28 + i * (sz * 1.5), I.y + I.h / 2, sz * 0.5, 0, i < left ? 1 : 0.25);
  const cue = state.ph === 'flight' ? (state.stop ? 'Stopped!' : state.boardsLeft > 0 ? 'TAP the fielder where the puck is going' : 'No boards left: watch') : state.ph === 'result' ? '' : 'The other side strikes: get ready to tap';
  R.text(cue, I.x + I.w / 2 + 28, I.y + I.h * 0.64, clamp(I.h * 0.34, 12, 19), '#fff8e6', DISPLAY, 800);
}

function drawPausedBanner(ctx, R, L) {
  scrim(ctx, L, 0.3);
  const u = Math.min(1, (L.U.w - 16) / 420, (L.U.h - 16) / 170), bw = 420 * u, bh = 170 * u, x = L.U.x0 + (L.U.w - bw) / 2, y = L.U.y0 + (L.U.h - bh) / 2;
  plate(ctx, x, y, bw, bh, 28 * u, 'rgba(16,44,30,0.96)', GOLD);
  R.text('Paused', x + bw / 2, y + 92 * u, 72 * u, '#ffe27a', DISPLAY, 800);
  R.text('Everything is frozen. Tap Resume.', x + bw / 2, y + 140 * u, 24 * u, '#fff8e6', DISPLAY, 600);
}

// ---- panels and stacks ------------------------------------------------------------------------------------------------------------------
function fitTitle(ctx, R, str, x, y, size, maxW) {
  let s = size; ctx.font = `800 ${s}px ${DISPLAY}`;
  while (s > 26 && ctx.measureText(str).width > maxW) { s -= 2; ctx.font = `800 ${s}px ${DISPLAY}`; }
  R.text(str, x, y, s, ACC, DISPLAY, 800);
}
function drawPanelScene(ctx, state, R, z, L) {
  const sc = state.scene, P = L.panel;
  drawPanel(ctx, P.x, P.y, P.w, P.h);
  if (sc === 'how' || sc === 'about' || sc === 'rules') { drawReader(ctx, state, R, z, L); return; }
  const lay = screenLayout(state, L);
  fitTitle(ctx, R, lay.st.title, P.x + P.w / 2, P.titleY, P.titleSize, P.titleMaxW);
  drawStackBody(ctx, state, R, lay, z);
}
function drawStack(ctx, state, R, z, L) {
  const lay = screenLayout(state, L), c = lay.frame.card, u = lay.frame.u;
  if (c) { drawPanel(ctx, c.x, c.y, c.w, c.h); if (lay.st.card?.title) R.text(lay.st.card.title, c.x + c.w / 2, c.y + 96 * u, 52 * u, ACC, DISPLAY, 800); }
  drawStackBody(ctx, state, R, lay, z);
}
function drawStackBody(ctx, state, R, lay) {
  const reg = lay.region;
  ctx.save(); ctx.beginPath(); ctx.rect(reg.x - 14, reg.y - 4, reg.w + 28, reg.h + 8); ctx.clip();
  for (const n of lay.nodes) {
    if (n.y + n.h < reg.y - 4 || n.y > reg.y + reg.h + 4) continue;
    if (n.k === 'text') {
      const x = n.align === 'left' ? n.x : n.x + n.w / 2;
      n.lines.forEach((ln, i) => R.text(ln, x, n.y + i * n.lh + n.size * 0.95, n.size, n.color, DISPLAY, n.weight ?? 600, n.align === 'left' ? 'left' : 'center'));
    } else if (n.k === 'btn') R.button(n);
    else if (n.k === 'art') { ctx.save(); ctx.translate(n.x, n.y); ctx.scale(lay.u, lay.u); drawStackArt(ctx, state, R, { ...n, x: 0, y: 0, w: n.w / lay.u, h: n.h / lay.u }); ctx.restore(); }
  }
  ctx.restore();
  if (lay.maxScroll > 0) {
    const th = Math.max(40, reg.h * reg.h / lay.total), ty = reg.y + (reg.h - th) * (lay.scroll / lay.maxScroll);
    ctx.fillStyle = 'rgba(40,60,40,0.3)'; ctx.beginPath(); ctx.roundRect(reg.x + reg.w + 6, reg.y, 6, reg.h, 3); ctx.fill();
    ctx.fillStyle = 'rgba(217,58,43,0.95)'; ctx.beginPath(); ctx.roundRect(reg.x + reg.w + 6, ty, 6, th, 3); ctx.fill();
    if (lay.scroll < lay.maxScroll - 4) R.text('drag to scroll', reg.x + reg.w / 2, reg.y + reg.h - 4, 18 * Math.min(1, lay.u), 'rgba(60,40,30,0.7)', DISPLAY, 600);
  }
  for (const f of lay.footer) R.button(f);
}
function drawStackArt(ctx, state, R, n) {
  const m = state.m;
  if (n.name === 'score' && m) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    [0, 1].forEach((i) => {
      const x = cx + (i ? 1 : -1) * 130;
      ctx.fillStyle = TEAM[i].shirt; ctx.beginPath(); ctx.arc(x, cy - 28, 26, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
      R.text(String(m.score[i]), x, cy + 66, 84, INK, DISPLAY, 800);
      R.text(m.names[i], x, cy + 98, 24, '#5a4a3a', DISPLAY, 700);
    });
    R.text(':', cx, cy + 56, 70, ACC, DISPLAY, 800);
  } else if (n.name === 'puck') drawPuckAt(ctx, n.x + n.w / 2, n.y + n.h / 2, 46, 0.5);
}

// ---- reader pages -------------------------------------------------------------------------------------------------------------------------
function drawReader(ctx, state, R, z, L) {
  const sc = state.scene, RD = L.reader, P = RD.P, body = RD.body, F = readerFlow(sc, z, L), max = readerMax(state, L);
  if (state.jump != null) { const it = F.secs[Math.min(state.jump, F.secs.length - 1)]; state.scroll = Math.min(max, it ? it.y : 0); state.jump = null; }
  const scroll = clamp(state.scroll || 0, 0, max);
  fitTitle(ctx, R, sc === 'how' ? 'How to Play' : sc === 'about' ? 'About' : 'Rules', P.x + P.w / 2, P.titleY, Math.round(P.titleSize * 0.94 * Math.min(1.25, z)), P.titleMaxW);
  ctx.save(); ctx.beginPath(); ctx.rect(body.x - 14, body.y, body.w + 28, body.h); ctx.clip();
  for (const s of F.secs) {
    const top = body.y + s.y - scroll;
    if (top > body.y + body.h + 10 || top + s.hh < body.y - 10) continue;
    let y = top;
    R.text(s.h, body.x, y + s.hs * 1.05, s.hs, ACC, DISPLAY, 800, 'left'); y += Math.round(s.hs * 1.5);
    if (s.art) { drawRulesArt(ctx, s.art, body.x + body.w / 2, y + ART_H / 2 - 4, state.t, body.w); y += ART_H + Math.round(s.size * 0.3); }
    s.lines.forEach((ln) => { y += ln.gap; R.text(ln.str, body.x, y + s.size * 0.95, s.size, INK, DISPLAY, 600, 'left'); y += s.lh; });
  }
  ctx.restore();
  if (max > 0) { const th = Math.max(36, body.h * body.h / F.total), ty = body.y + (body.h - th) * (scroll / max); ctx.fillStyle = 'rgba(163,38,42,0.5)'; ctx.fillRect(body.x + body.w + 6, ty, 5, th); }
  R.text(max > 0 ? (scroll >= max - 2 ? 'End' : 'Scroll: drag, wheel or arrow keys') : '', P.x + P.w / 2, RD.captionY, 22, ACC, DISPLAY, 700);
  R.text(`Text ${Math.round(z * 100)}%`, RD.textX, RD.textY, RD.one ? 24 : 28, INK, DISPLAY, 700);
  for (const b of screenButtons(state, L)) R.button(b);
}

const cap = (ctx, str, x, y, size = 20, col = ACC) => { ctx.textAlign = 'center'; ctx.font = `700 ${size}px ${DISPLAY}`; ctx.fillStyle = col; ctx.fillText(str, x, y); };
// diagrams drawn with the game's own pieces
function drawRulesArt(ctx, kind, cx, cy, t, bw = 600) {
  const W = Math.min(bw - 20, 560);
  if (kind === 'ries') {
    const x0 = cx - W / 2, w = W, h = 130, y0 = cy - h / 2 - 8;
    ctx.fillStyle = '#5fae45'; ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 14); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0 + 40, y0 + 10, w - 50, h - 20);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(x0 + 40, y0 + 10, w - 50, h - 20);
    const px = (z) => x0 + 40 + (w - 50) * z / RIES.len, py = (x) => y0 + h / 2 + x / RIES.half * (h - 20) / 2;
    ROWS.forEach((zz) => COLS.forEach((xx) => { ctx.fillStyle = TEAM[1].shirt; ctx.beginPath(); ctx.arc(px(zz), py(xx), 5.5, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }));
    ctx.fillStyle = '#b57a3a'; ctx.fillRect(x0 + 18, y0 + h / 2 - 12, 26, 24); ctx.fillStyle = '#ff7a1c'; ctx.beginPath(); ctx.arc(x0 + 31, y0 + h / 2, 5, 0, TAU); ctx.fill();
    cap(ctx, 'Bock', x0 + 31, y0 + h + 22, 18); cap(ctx, `The Ries: ${RIES.len} m`, cx + 20, y0 + h + 22, 18); cap(ctx, `${ROWS.length} lines of ${COLS.length} fielders`, cx + 20, y0 + h + 44, 17, INK);
  } else if (kind === 'meter') {
    const x0 = cx - W / 2 + 20, w = W - 40, y = cy - 6;
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.roundRect(x0, y - 16, w, 32, 16); ctx.fill();
    const f = (Math.sin(t * 1.6) + 1) / 2;
    ctx.fillStyle = 'rgba(255,205,60,0.7)'; ctx.fillRect(x0 + w * TENSION.perfectA, y - 16, w * (TENSION.perfectB - TENSION.perfectA), 32);
    const g = ctx.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, '#59c26b'); g.addColorStop(0.8, '#e9c046'); g.addColorStop(1, '#ff7a1c');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x0, y - 16, Math.max(32, w * f), 32, 16); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(x0 + w * f - 2, y - 24, 4, 48);
    cap(ctx, 'tension', x0 + 40, y + 44, 18); cap(ctx, 'gold zone', x0 + w * 0.91, y + 44, 18, '#b07a00');
    drawRod(ctx, cx - 60, cy - 30, -0.55 - 1.2 * f, 78, -0.3 * f, 4); // kept inside the 230 px art box (it used to sweep up over the heading)
  } else if (kind === 'wind') {
    drawFlagPole(ctx, cx - 140, cy + 60, 30, 1.2, t, false);
    ctx.strokeStyle = ACC; ctx.lineWidth = 4; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(cx - 60, cy + 40); ctx.quadraticCurveTo(cx + 40, cy - 70, cx + 150, cy + 30); ctx.stroke(); ctx.setLineDash([]);
    drawPuckAt(ctx, cx + 40 + Math.sin(t) * 0, cy - 22, 9, 0.6); cap(ctx, 'wind pushes the Nouss sideways', cx + 40, cy + 74, 19);
  } else if (kind === 'board') {
    const x0 = cx - W / 2 + 10, w = W - 20, y = cy - 4, k = w / 1.4;
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x0, y - 4, w, 8);
    const a = x0 + k * BOARD.upA, b = x0 + k * upWindow('normal')[1];
    ctx.fillStyle = 'rgba(217,58,43,0.55)'; ctx.fillRect(a, y - 30, b - a, 60);
    cap(ctx, 'tap', x0, y - 40, 18); cap(ctx, 'board is up', (a + b) / 2, y - 40, 18);
    drawBoard(ctx, (a + b) / 2, y, 28, 0, 1, true);
    ctx.fillStyle = '#ff7a1c'; ctx.beginPath(); ctx.arc(x0 + k * BOARD.peak, y + 50, 7, 0, TAU); ctx.fill(); cap(ctx, 'best moment for the Nouss to arrive', x0 + w / 2, y + 86, 18, INK);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x0, y, 6, 0, TAU); ctx.fill();
  } else if (kind === 'zones') {
    const x0 = cx - W / 2 + 10, w = W - 20, y = cy - 20, h = 70;
    const seg = [[0, MIN_SCORING, '#c9b79c', 'short · 0'], [MIN_SCORING, 105, '#9bd07a', '1 point'], [105, 135, '#6fbf4f', '2 points'], [135, RIES.len, '#3f9f3a', '3 points']];
    seg.forEach(([a, b, c, l]) => { const xa = x0 + w * a / (RIES.len + 20), xb = x0 + w * b / (RIES.len + 20); ctx.fillStyle = c; ctx.fillRect(xa, y, xb - xa, h); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(xa, y, xb - xa, h); cap(ctx, l, (xa + xb) / 2, y + h / 2 + 6, 17, INK); });
    ctx.fillStyle = '#b5b5ab'; ctx.fillRect(x0 + w * RIES.len / (RIES.len + 20), y, w * 20 / (RIES.len + 20), h); cap(ctx, 'out', x0 + w * (RIES.len + 10) / (RIES.len + 20), y + h / 2 + 6, 17, INK);
    cap(ctx, 'distance from the Bock', x0 + w / 2, y + h + 30, 18);
  } else if (kind === 'flight') {
    const x0 = cx - W / 2 + 20, w = W - 40, y = cy + 54, fl = { D: 200, xL: 0, cw: 0, T: 6.4, H: 27 };
    ctx.fillStyle = '#6fbf4f'; ctx.fillRect(x0 - 10, y, w + 20, 14);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.setLineDash([6, 7]); ctx.beginPath();
    for (let i = 0; i <= 30; i++) { const f = flightAt(fl, fl.T * i / 30), px = x0 + w * f.z / 200, py = y - f.y * 3.4; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke(); ctx.setLineDash([]);
    const u = (t % 4) / 4, f = flightAt(fl, fl.T * u); drawPuckAt(ctx, x0 + w * f.z / 200, y - f.y * 3.4, 8, 0.6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x0 + w * f.z / 200, y + 6, 10, 3, 0, 0, TAU); ctx.fill();
    cap(ctx, 'it climbs, hangs and sinks', cx, y - 110, 19);
  } else if (kind === 'flow') {
    const box = (x, y, w, h, str, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); cap(ctx, str, x + w / 2, y + h / 2 + 6, 19, '#fff8e6'); };
    const bw2 = W / 3 - 12;
    box(cx - W / 2, cy - 36, bw2, 70, 'Half 1: you strike', '#2f8f5a'); box(cx - bw2 / 2, cy - 36, bw2, 70, 'Half 2: you field', '#1f5a3c'); box(cx + W / 2 - bw2, cy - 36, bw2, 70, 'More points win', '#d93a2b');
  } else if (kind === 'puck') drawPuckAt(ctx, cx, cy, 30, 0.5);
  void t;
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------------
function demoFlight(t) {
  const k = Math.floor(t / 6), ft = t - k * 6, r = lcg(k * 7919 + 11), D = 70 + r() * 105, xL = (r() * 2 - 1) * 11, fl = { D, xL, cw: (r() - 0.5) * 2, T: 2.2 + D * 0.021, H: 3 + D * 0.12 };
  const throws = [];
  for (let i = 0; i < ROWS.length; i++) {
    const c = crossing(fl, ROWS[i]); if (!c || c.y > BOARD.reach) continue;
    let best = 0, bd = 1e9; COLS.forEach((x, j) => { const d = Math.abs(x - c.x); if (d < bd) { bd = d; best = j; } });
    if (bd <= BOARD.half + BOARD.lat) throws.push({ id: i * COLS.length + best, th: c.t - BOARD.peak + (r() > 0.5 ? 0 : 0.7), peak: clamp(c.y, 2.5, 11), sx: clamp(c.x - COLS[best], -BOARD.lat, BOARD.lat), who: 'ai' });
  }
  return { fl, ft, throws };
}
function drawTitle(ctx, state, R, L) {
  const T = L.title, t = state.t, { fl, ft, throws } = demoFlight(t);
  const rect = L.land ? { x: L.U.x0, y: L.U.y0 + L.U.h * 0.1, w: T.plate.x - L.U.x0, h: L.U.h * 0.86 } : { x: L.U.x0, y: L.U.y0 + L.U.h * 0.1, w: L.U.w, h: Math.max(200, T.plate.y - (L.U.y0 + L.U.h * 0.1) + 40) };
  const cam = cameraFor(L, 'field', rect, 'title' + Math.round(rect.w) + 'x' + Math.round(rect.h));
  const fake = { ...state, m: null, fl, ft, throws, ph: 'flight', stop: null, hold: null, swing: null, plan: null, hintTarget: null, hintId: null, parts: [], pops: [] };
  if (!GL) drawWorld(ctx, fake, L, { cam, view: 'field', venue: state.setup.venue, fieldTeam: 0, throws, ft, R });
  // title block
  const b = T.tblk, cx = b.x + b.w / 2;
  ctx.save(); const gl = ctx.createLinearGradient(0, b.y, 0, b.y + b.h); gl.addColorStop(0, 'rgba(10,30,18,0.55)'); gl.addColorStop(1, 'rgba(10,30,18,0)'); ctx.fillStyle = gl; ctx.fillRect(L.land ? 0 : 0, 0, L.land ? b.x + b.w + 20 : L.w, b.y + b.h); ctx.restore();
  const size = clamp(Math.min(b.w * 0.16, b.h * 0.34), 44, 120);
  // carved, gilded lettering: a stack of dark extrusion layers, a lit gold face with a cream top edge, and a soft drop shadow
  ctx.save(); ctx.textAlign = 'center'; ctx.font = `800 ${size}px ${DISPLAY}`; ctx.lineJoin = 'round';
  const ty = b.y + size * 0.95, dep = Math.max(3, size * 0.07);
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8; ctx.fillStyle = '#2a1608'; ctx.fillText('Hornussen', cx, ty + dep);
  ctx.shadowColor = 'transparent';
  for (let i = dep; i > 0; i -= 1) { ctx.fillStyle = i > dep * 0.5 ? '#3a210d' : '#5a3515'; ctx.fillText('Hornussen', cx, ty + i); }
  const fg = ctx.createLinearGradient(0, ty - size * 0.72, 0, ty + 4); fg.addColorStop(0, '#fff6d0'); fg.addColorStop(0.45, '#f3c654'); fg.addColorStop(1, '#b97a1f');
  ctx.lineWidth = Math.max(2, size * 0.035); ctx.strokeStyle = '#4a2a0c'; ctx.strokeText('Hornussen', cx, ty);
  ctx.fillStyle = fg; ctx.fillText('Hornussen', cx, ty);
  ctx.globalCompositeOperation = 'source-atop'; ctx.restore();
  ctx.save(); const tw = Math.min(b.w - 20, size * 5.2), rh = size * 0.42, ry0 = b.y + size * 1.15;
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  const rg = ctx.createLinearGradient(0, ry0, 0, ry0 + rh); rg.addColorStop(0, '#ee5a44'); rg.addColorStop(1, '#a8271a'); ctx.fillStyle = rg;
  ctx.beginPath(); ctx.moveTo(cx - tw / 2 - rh * 0.5, ry0); ctx.lineTo(cx - tw / 2, ry0); ctx.lineTo(cx + tw / 2, ry0); ctx.lineTo(cx + tw / 2 + rh * 0.5, ry0); ctx.lineTo(cx + tw / 2 + rh * 0.15, ry0 + rh / 2); ctx.lineTo(cx + tw / 2 + rh * 0.5, ry0 + rh); ctx.lineTo(cx - tw / 2 - rh * 0.5, ry0 + rh); ctx.lineTo(cx - tw / 2 - rh * 0.15, ry0 + rh / 2); ctx.closePath(); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  R.text('THE SWISS FIELD SPORT', cx, ry0 + rh * 0.72, size * 0.24, '#fff8e6', DISPLAY, 800);
  // menu plate
  const pr = T.plate;
  plate(ctx, pr.x, pr.y, pr.w, pr.h, 24);
  const lay = screenLayout(state, L), reg = lay.region;
  ctx.save(); ctx.beginPath(); ctx.rect(reg.x - 14, reg.y - 4, reg.w + 28, reg.h + 8); ctx.clip();
  for (const n of lay.nodes) if (n.k === 'btn') R.button(n);
  ctx.restore();
  if (lay.maxScroll > 0) { const th = Math.max(40, reg.h * reg.h / lay.total), ty = reg.y + (reg.h - th) * (lay.scroll / lay.maxScroll); ctx.fillStyle = 'rgba(255,214,90,0.95)'; ctx.beginPath(); ctx.roundRect(reg.x + reg.w + 8, ty, 6, th, 3); ctx.fill(); }
  const s = state.stats;
  R.text(s.played ? `${s.played} matches · ${s.won} won` : state.demo ? 'Free web preview' : 'Free to play', pr.x + pr.w / 2, pr.y + pr.h - 6, 18, '#cfe9d4', DISPLAY, 600);
  drawLockup(ctx, T.lock, Boolean(state.press && state.press.af && !state.press.moved));
}

// ---- end screen ----------------------------------------------------------------------------------------------------------------------------
function drawOver(ctx, state, R, z, L) {
  const o = state.over; if (!o) return;
  const T0 = state.t, W = L.w, H = L.h;
  scrim(ctx, L, 0.62);
  for (let i = 0; i < 42; i++) {
    const r = lcg(i * 7919 + 3), x = r() * W, sp = 60 + r() * 120, y = ((T0 * sp + r() * H) % (H + 40)) - 20, rotA = T0 * (1 + r() * 2) + i;
    ctx.save(); ctx.translate(x + Math.sin(T0 + i) * 20, y); ctx.rotate(rotA); ctx.fillStyle = ['#d93a2b', '#fff1d6', '#e9c046', '#2c7fd1'][i % 4]; ctx.globalAlpha = 0.85; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
  }
  drawStack(ctx, state, R, z, L);
  const card = screenLayout(state, L).frame.card;
  if (card) {
    const y = L.U.y1 - 12, size = 20, free = y - 14 - (card.y + card.h);
    if (free >= 6) drawMoreLine(ctx, L.U.x0 + L.U.w / 2, y, size);
    else if (card.x - L.U.x0 >= 380) drawMoreLine(ctx, L.U.x0 + (card.x - L.U.x0) / 2, y, size);
  }
}
void TEXT_SCALES; void LEVEL_NAMES; void distanceFor; void tensionAt; void strikeNumber; void shade; void CREAM;
