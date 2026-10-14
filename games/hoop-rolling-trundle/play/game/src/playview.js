// The playing screen: the chase view of the road (art.js), the HUD, the balance bar, the stick, the Think / Reveal cards.
import { PAL, UI, DISPLAY, clamp, hash, makeCam, proj, drawSky, drawRoad, drawWorldItems, playerAnchor } from './art.js';
import { txt, button, panel, rrect, chip, wrap, minUnits } from './ui.js';
import { standings, PHYS } from './sim.js';
import { gl } from './glhook.js';

const TAU = Math.PI * 2;
export const GRADE_TEXT = { perfect: 'PERFECT', good: 'GOOD', miss: 'MISSED', post: 'POST!', splash: 'SPLASH', wall: 'BUMP' };
export const GRADE_COL = { perfect: '#ffd35a', good: '#8ff0d6', miss: '#ff9a8a', post: '#ffb43c', splash: '#9fd8ff', wall: '#ffb43c' };
export const ordinal = (n) => ['1st', '2nd', '3rd', '4th'][n] ?? `${n + 1}th`;
export function fmtTime(s) { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`; }

// How the finger maps to steer (u) and push (p): shared with game.js so the picture and the control always agree.
export function stickGeometry(stage, anchor) {
  return { reachX: Math.max(90, Math.min(stage.w * 0.2, 260)), reachY: Math.max(110, stage.h * 0.17), hx: anchor.x, hy: anchor.y };
}
// Height of the finger against the hoop: at or below the hoop = full push; the first part of the way up eases off, a band above
// that coasts (no push, no brake), and the top of the reach brakes. `a` is how far up the reach the finger is (0..1).
const COAST_A = 0.28, COAST_B = 0.5;
export function pushAt(a) {
  if (a <= 0) return 1;
  if (a < COAST_A) return 1 - a / COAST_A;
  if (a < COAST_B) return 0;
  return -clamp((a - COAST_B) / (1 - COAST_B), 0, 1);
}
export function stickOf(g, fx, fy) {
  let u = (fx - g.hx) / g.reachX;
  const dz = 0.06;
  u = Math.abs(u) < dz ? 0 : (u - Math.sign(u) * dz) / (1 - dz);
  const dy = fy - g.hy;
  const p = dy >= 0 ? 1 : pushAt(-dy / (g.reachY / 2));
  return { u: clamp(u, -1, 1), p };
}
// The finger height that gives push p (used by the bot driver in tests and by the hint picture).
export function stickY(g, p) {
  if (p >= 0.999) return g.hy + 40;
  const a = p >= 0 ? (1 - p) * COAST_A : p === 0 ? (COAST_A + COAST_B) / 2 : COAST_B + (-p) * (1 - COAST_B);
  return g.hy - a * g.reachY / 2;
}

// ---- the balance bar ---------------------------------------------------------------------------------------------------------------
export function drawBalance(ctx, r, lam, o = {}) {
  const X = (v) => r.x + r.w / 2 + clamp(v, -1.15, 1.15) * (r.w / 2 - 20) / 1.15 * 0.98;
  ctx.save();
  ctx.fillStyle = 'rgba(10,22,32,0.78)'; rrect(ctx, r, r.h / 2); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.28)'; rrect(ctx, r, r.h / 2); ctx.stroke();
  const y = r.y + 8, h = r.h - 16;
  const bands = [[-1.15, -0.8, 'rgba(240,70,60,0.75)'], [-0.8, -0.5, 'rgba(255,190,60,0.7)'], [-0.5, 0.5, 'rgba(70,214,150,0.65)'], [0.5, 0.8, 'rgba(255,190,60,0.7)'], [0.8, 1.15, 'rgba(240,70,60,0.75)']];
  bands.forEach(([a, b, col], i) => {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.roundRect(X(a) + (i ? 1 : 0), y, X(b) - X(a) - 2, h, i === 0 ? [h / 2, 4, 4, h / 2] : i === 4 ? [4, h / 2, h / 2, 4] : 4); ctx.fill();
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(0), y - 2); ctx.lineTo(X(0), y + h + 2); ctx.stroke();
  if (o.target !== undefined) {
    const tx = X(o.target);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(tx, r.y + r.h / 2, h * 0.28, 0, TAU); ctx.fill();
  }
  const mx = X(lam), warn = Math.abs(lam) > 0.8;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(mx + 1, r.y + r.h / 2 + 2, h * 0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = warn ? '#ffd0c8' : '#fff7da'; ctx.beginPath(); ctx.arc(mx, r.y + r.h / 2, h * 0.5, 0, TAU); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#0d1b26'; ctx.stroke();
  ctx.restore();
}

function drawTrack(ctx, r, W, st) {
  const C = W.course;
  ctx.save();
  ctx.fillStyle = 'rgba(10,22,32,0.7)'; rrect(ctx, r, r.h / 2); ctx.fill();
  const x0 = r.x + 18, x1 = r.x + r.w - 22, y = r.y + r.h / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  const zc = { plank: '#d6a05a', mud: '#8a5a34', cobble: '#b0a89a', slope: '#e8c24a' };
  for (const z of C.zones) {
    ctx.strokeStyle = zc[z.kind]; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * z.s0 / C.length, y); ctx.lineTo(x0 + (x1 - x0) * z.s1 / C.length, y); ctx.stroke();
  }
  C.gates.forEach((g, i) => {
    const r0 = st.gateRes?.[i];
    ctx.fillStyle = r0 === 'perfect' ? '#ffd35a' : r0 === 'good' ? '#8ff0d6' : r0 === 'miss' ? '#ff6a5a' : 'rgba(255,255,255,0.55)';
    ctx.fillRect(x0 + (x1 - x0) * g.s / C.length - 1.5, y - 5, 3, 10);
  });
  ctx.fillStyle = '#fff'; ctx.fillRect(x1 + 2, y - 11, 3, 22);
  ctx.fillStyle = '#e8452c'; ctx.beginPath(); ctx.moveTo(x1 + 5, y - 11); ctx.lineTo(x1 + 15, y - 6); ctx.lineTo(x1 + 5, y - 1); ctx.closePath(); ctx.fill();
  const rs = [...W.racers].sort((a, b) => (a.id === 0) - (b.id === 0));
  for (const rc of rs) {
    const x = x0 + (x1 - x0) * clamp(rc.s / C.length, 0, 1);
    ctx.fillStyle = rc.id === 0 ? '#ffd35a' : '#8fa8b8'; ctx.beginPath(); ctx.arc(x, y, rc.id === 0 ? 10 : 7, 0, TAU); ctx.fill();
    ctx.lineWidth = rc.id === 0 ? 3.5 : 2; ctx.strokeStyle = rc.id === 0 ? '#fff' : 'rgba(10,6,20,0.8)'; ctx.stroke();
  }
  ctx.restore();
}

// ---- the whole playing screen ---------------------------------------------------------------------------------------------------------
// The world in a rectangle: sky, road, scenery, gates, the hoops. Used for play and for the live backdrop behind the menus.
export function renderStage(ctx, st, S, t, o = {}) {
  const W = st.W, me = W.racers[0];
  const cam = makeCam(S, W, me, t, o.frac);
  const shk = st.shake > 0 ? { x: (hash(t * 91) - 0.5) * st.shake * 10, y: (hash(t * 57) - 0.5) * st.shake * 8 } : { x: 0, y: 0 };
  if (o.gl && gl.active) cam.G3 = gl.frame = { S, cam, shake: shk, people: [], w: gl.size.w, h: gl.size.h, t, W, me, st, items: { props: [], gates: [], puddles: null, finish: null, start: null } };
  ctx.save();
  ctx.beginPath(); ctx.rect(S.x, S.y, S.w, S.h); ctx.clip();
  if (st.shake > 0 && !cam.G3) ctx.translate(shk.x, shk.y);
  if (!cam.G3) { drawSky(ctx, cam, t); drawRoad(ctx, cam); }
  drawLine(ctx, cam, st, me);
  drawWorldItems(ctx, cam, W, me, st);
  const A = playerAnchor(cam, me);
  for (const pop of st.pops ?? []) {
    const a = 1 - pop.age / 0.9;
    ctx.save(); ctx.globalAlpha = clamp(a * 1.6, 0, 1);
    txt(ctx, pop.text, A.x + pop.dx, A.y - A.k * 1.6 - pop.age * 60, pop.size, pop.col, { align: 'center', font: DISPLAY, weight: 700, stroke: 7 });
    ctx.restore();
  }
  if (o.stick && (st.touch || st.t < 14 || st.mode === 'practice' || st.ring)) drawStick(ctx, st, cam, A, S);
  ctx.restore();
  return cam;
}

export function renderPlay(ctx, st, L, view, meta, pauseItems, drawPauseMenu) {
  const P = L.play, W = st.W, me = W.racers[0], t = st.t;
  if (!gl.active) { ctx.fillStyle = '#0d1b26'; ctx.fillRect(0, 0, L.w, L.h); }
  const S = P.stage;
  renderStage(ctx, st, S, t, { stick: true, gl: true });
  // vignette when a fall is near
  const danger = Math.max(0, Math.abs(me.lam) - 0.72) / 0.28;
  if (danger > 0 && me.phase === 'roll') {
    ctx.save(); ctx.globalAlpha = clamp(danger * 0.45 * (0.6 + 0.4 * Math.sin(t * 14)), 0, 0.5); ctx.strokeStyle = '#ff3a2a'; ctx.lineWidth = 26; ctx.strokeRect(S.x + 4, S.y + 4, S.w - 8, S.h - 8); ctx.restore();
  }
  // HUD card
  const place = standings(W).findIndex((r) => r.id === 0), sc = P.score;
  panel(ctx, sc, { fill: 'rgba(10,22,32,0.74)', rad: 20 });
  const modeName = st.mode === 'practice' ? 'Practice' : st.mode === 'auto' ? 'Watch and Learn' : 'Race';
  const g = W.course.gates, passed = Math.min(me.gi, g.length);
  if (L.mode === 'wide') {
    const cx = sc.x + sc.w / 2;
    txt(ctx, ordinal(place), cx, sc.y + 54, 60, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6 });
    txt(ctx, `of ${W.racers.length}`, cx, sc.y + 100, 22, PAL.dim, { align: 'center', weight: 600 });
    txt(ctx, fmtTime(Math.max(0, me.finished ? me.finT : W.t)), cx, sc.y + 150, 34, PAL.text, { align: 'center', weight: 700 });
    txt(ctx, `${(me.v).toFixed(1)} m/s`, cx, sc.y + 192, 24, PAL.jadeHi, { align: 'center', weight: 700 });
    txt(ctx, `Gates ${passed}/${g.length}`, cx, sc.y + 240, 22, PAL.text, { align: 'center', weight: 600 });
    txt(ctx, `Perfect ${me.perfect}`, cx, sc.y + 270, 22, '#ffd35a', { align: 'center', weight: 600 });
    txt(ctx, `Chain ${me.chain}`, cx, sc.y + 300, 22, PAL.jadeHi, { align: 'center', weight: 600 });
    txt(ctx, `Falls ${me.falls}`, cx, sc.y + 330, 22, PAL.rose, { align: 'center', weight: 600 });
    txt(ctx, W.course.name, cx, sc.y + sc.h - 60, 20, PAL.dim, { align: 'center', weight: 600, maxW: sc.w - 16 });
    txt(ctx, modeName, cx, sc.y + sc.h - 30, 18, PAL.gold, { align: 'center', weight: 700 });
  } else {
    txt(ctx, ordinal(place), sc.x + 16, sc.y + 40, 52, PAL.gold, { font: DISPLAY, weight: 700, stroke: 6 });
    txt(ctx, fmtTime(Math.max(0, me.finished ? me.finT : W.t)), sc.x + sc.w - 16, sc.y + 32, 32, PAL.text, { align: 'right', weight: 700 });
    txt(ctx, `${me.v.toFixed(1)} m/s  ·  gate ${Math.min(passed + 1, g.length)}/${g.length}  ·  chain ${me.chain}`, sc.x + sc.w - 16, sc.y + 68, 20, PAL.dim, { align: 'right', weight: 600, maxW: sc.w * 0.75 });
    txt(ctx, `${W.course.name}  ·  ${modeName}`, sc.x + 16, sc.y + sc.h - 16, 18, PAL.dim, { weight: 600, maxW: sc.w - 32 });
  }
  button(ctx, P.pause, '', { icon: 'pause', kind: 'quiet', size: 28 });
  if (st.mode === 'practice' || st.mode === 'auto') button(ctx, P.hint, '', { icon: 'bulb', kind: st.mode === 'practice' ? 'quiet' : 'disabled', size: 28 });
  drawTrack(ctx, P.track, W, st);
  const auto = st.auto;
  drawBalance(ctx, P.bal, me.phase === 'down' ? 0 : me.lam, { target: me.phase === 'down' ? undefined : me.cmd.u * PHYS.LEAN_MAX });
  txt(ctx, 'balance', P.bal.x + P.bal.w / 2, P.bal.y - 12, 16, 'rgba(255,255,255,0.7)', { align: 'center', weight: 600, stroke: 4 });
  // count-in and go
  if (W.go < 0) {
    const n = Math.ceil(-W.go), a = 1 - ((-W.go) % 1);
    ctx.save(); ctx.globalAlpha = clamp(1 - a * 0.7, 0, 1);
    txt(ctx, String(n), S.x + S.w / 2, S.y + S.h * 0.4, 190 * (0.8 + a * 0.3), PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 14 });
    ctx.restore();
  } else if (W.t < 1.0) {
    ctx.save(); ctx.globalAlpha = clamp(1 - W.t, 0, 1);
    txt(ctx, 'GO!', S.x + S.w / 2, S.y + S.h * 0.4, 150, PAL.jadeHi, { align: 'center', font: DISPLAY, weight: 700, stroke: 12 });
    ctx.restore();
  }
  if (st.banner) {
    const a = clamp(Math.min(st.banner.t / 0.15, (1.5 - st.banner.t) / 0.4), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, st.banner.text, S.x + S.w / 2, P.track.y + P.track.h + 56, 38, st.banner.col ?? PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 8, maxW: S.w - 40 });
    ctx.restore();
  }
  if (auto && auto.phase !== 'act') {
    const tw = Math.min(S.w - 32, 760), fs = Math.max(20, minUnits());
    ctx.font = `500 ${fs}px ${UI}`;
    const tipLines = wrap(ctx, auto.tip, tw - 48).slice(0, 3), lh = fs * 1.3;
    const card = { x: S.x + (S.w - tw) / 2, y: S.y + S.h * 0.3, w: tw, h: 112 + tipLines.length * lh };
    panel(ctx, card, { fill: 'rgba(10,22,32,0.88)', rad: 24, stroke: 'rgba(255,214,150,0.5)' });
    txt(ctx, auto.phase === 'think' ? `THINK  ${Math.ceil(auto.timer)}` : 'REVEAL', card.x + 24, card.y + 38, 34, PAL.gold, { font: DISPLAY, weight: 700, maxW: card.w - 48 });
    txt(ctx, auto.title, card.x + 24, card.y + 82, 26, PAL.text, { weight: 700, maxW: card.w - 48 });
    tipLines.forEach((ln, i) => txt(ctx, ln, card.x + 24, card.y + 118 + i * lh, fs, PAL.dim, { weight: 500 }));
  }
  if (st.hintCard) {
    const tw = Math.min(S.w - 32, 760), fs = Math.max(22, minUnits());
    ctx.font = `600 ${fs}px ${UI}`;
    const lines = wrap(ctx, st.hintCard.title, tw - 48).slice(0, 3), lh = fs * 1.3;
    const card = { x: S.x + (S.w - tw) / 2, y: S.y + S.h * 0.3, w: tw, h: 78 + lines.length * lh };
    panel(ctx, card, { fill: 'rgba(10,22,32,0.88)', rad: 24, stroke: 'rgba(255,214,150,0.5)' });
    txt(ctx, 'HINT', card.x + 24, card.y + 34, 30, PAL.gold, { font: DISPLAY, weight: 700 });
    lines.forEach((ln, i) => txt(ctx, ln, card.x + 24, card.y + 76 + i * lh, fs, PAL.text, { weight: 600 }));
  }
  if (st.mode === 'auto' && (!auto || auto.phase === 'act')) txt(ctx, 'WATCH AND LEARN', S.x + S.w / 2, P.track.y + P.track.h + 22, 17, 'rgba(255,230,160,0.9)', { align: 'center', weight: 700, stroke: 5 });
  if (st.paused || st.over) drawPauseMenu(ctx, st, L, pauseItems(st), st);
  void meta; void view; void chip; void UI;
}

// The line the performer is about to ride (Reveal and hint): a dotted gold path on the road with a ring at its end.
function drawLine(ctx, cam, st, me) {
  const rv = st.reveal;
  if (!rv || !rv.pts) return;
  const t = st.t;
  ctx.save();
  ctx.lineCap = 'round';
  let first = true;
  ctx.strokeStyle = 'rgba(255,226,120,0.95)';
  ctx.setLineDash([10, 9]); ctx.lineDashOffset = -t * 40;
  ctx.beginPath();
  let lastK = 30;
  for (const p of rv.pts) {
    const z = p.s - me.s;
    if (z < -2) continue;
    const q = proj(cam, z, p.d, 0);
    if (q.y < cam.hy) break;
    lastK = q.k;
    if (first) { ctx.moveTo(q.x, q.y); first = false; } else ctx.lineTo(q.x, q.y);
  }
  ctx.lineWidth = Math.max(4, lastK * 0.16 + 3); ctx.stroke(); ctx.setLineDash([]);
  // slow-down marks where the performer brakes: red ticks
  ctx.restore();
  // a ring at the next gate's centre
  const g = st.W.course.gates[me.gi];
  if (g) {
    const q = proj(cam, g.s - me.s, g.d, 0), pulse = 0.6 + 0.4 * Math.sin(t * 8);
    ctx.strokeStyle = `rgba(255,226,120,${pulse})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(q.x, q.y, q.k * 0.55, q.k * 0.16, 0, 0, TAU); ctx.stroke();
  }
}

function drawStick(ctx, st, cam, A, S) {
  const geo = stickGeometry(S, A);
  ctx.save();
  // the zones: a faint line at the hoop's height; push below, brake above
  const y = A.y;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.moveTo(S.x + 20, y); ctx.lineTo(S.x + S.w - 20, y); ctx.stroke(); ctx.setLineDash([]);
  if (!st.touch && st.t < 14 && st.mode !== 'auto') {
    // one quiet plaque so the words stay readable over the riders at the start line
    const fs = 20, w = Math.min(S.w - 40, 520), h = fs * 4.4, r = { x: S.x + (S.w - w) / 2, y: S.y + S.h * (S.w > S.h ? 0.2 : 0.17) + 70, w, h };
    ctx.fillStyle = 'rgba(8,18,28,0.74)'; rrect(ctx, r, 18); ctx.fill();
    txt(ctx, 'finger above the hoop to brake', S.x + S.w / 2, r.y + h * 0.2, fs, '#ffc9a8', { align: 'center', weight: 600, maxW: w - 24 });
    txt(ctx, 'finger below the hoop to push', S.x + S.w / 2, r.y + h * 0.5, fs, '#c8ffe4', { align: 'center', weight: 600, maxW: w - 24 });
    txt(ctx, 'slide left or right to steer', S.x + S.w / 2, r.y + h * 0.8, fs, '#ffffff', { align: 'center', weight: 600, maxW: w - 24 });
  }
  if (st.touch) {
    const f = st.touch;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(A.x, A.y - A.k * 0.3); ctx.lineTo(f.x, f.y); ctx.stroke();
    const brake = f.y < A.y - geo.reachY / 4;
    ctx.fillStyle = brake ? 'rgba(255,140,100,0.55)' : 'rgba(120,255,200,0.5)';
    ctx.beginPath(); ctx.arc(f.x, f.y, 34, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    txt(ctx, brake ? 'BRAKE' : 'PUSH', f.x, f.y - 52, 18, '#fff', { align: 'center', weight: 700, stroke: 5 });
  }
  ctx.restore();
}
