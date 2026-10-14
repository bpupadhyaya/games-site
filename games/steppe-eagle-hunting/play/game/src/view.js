// The play screen: sky, steppe, den, fox, eagle, glove, sight, effects, scoreboard, buttons, sheets and banners.
import { FONT, NUM, C, panel, plaque, roundPath, paintButton, wrapLines } from './ui.js';
import { FR, playLayout, TEXT_SCALES } from './layout.js';
import {
  geom, proj, drawSky, drawGround, drawProps, drawDen, drawDenRing, drawFox, drawEagle, drawPerched, drawArm, drawFx, drawWindSnow, PALETTES,
} from './art.js';
import { K, windAt, windWords, lockRadius } from './sim.js';
import { sideNames, winLine, unlockedCount } from './menus.js';
import { scene3d, draw3d } from './scene3d.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

export const REST_CAM_Z = -14;
export const DEN_RING = 70;

export function isHumanSide(m) { return m.cfg.mode === 'solo' || m.cfg.mode === 'two' || (m.cfg.mode === 'ai' && m.side === 0); }
export const palFor = (state) => PALETTES[Math.min(state.settings.plum, unlockedCount(state.record.career) - 1, PALETTES.length - 1)];

// ---- scoreboard ------------------------------------------------------------------------------------------------------------------------
function windCompass(ctx, cx, cy, r, w, t) {
  ctx.save();
  // brass bezel and a dark face
  const bz = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); bz.addColorStop(0, '#fff0b8'); bz.addColorStop(0.5, '#c8962c'); bz.addColorStop(1, '#6e4a0c');
  ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, 7); ctx.fillStyle = bz; ctx.fill();
  const fc = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r); fc.addColorStop(0, '#24406f'); fc.addColorStop(1, '#0a1630');
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fillStyle = fc; ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,170,0.5)'; ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.2832, l = i % 3 === 0 ? 0.2 : 0.1; ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * r * (1 - l), cy - Math.cos(a) * r * (1 - l)); ctx.lineTo(cx + Math.sin(a) * r * 0.97, cy - Math.cos(a) * r * 0.97); ctx.stroke(); }
  const sp = Math.hypot(w.x, w.z), a = Math.atan2(w.x, w.z), len = r * (0.4 + 0.5 * clamp(sp / 8, 0, 1));
  ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = '#ffe08a'; ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = Math.max(3, r * 0.1); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, len * 0.85); ctx.lineTo(0, -len + r * 0.2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-r * 0.22, -len + r * 0.34); ctx.lineTo(0, -len); ctx.lineTo(r * 0.22, -len + r * 0.34); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#f4d58b'; ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, 7); ctx.fill();
}

// an inlaid gauge: dark groove with a gold edge and a coloured fill
function gauge(ctx, x, y, w, h, f, col) {
  ctx.save();
  roundPath(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(3,8,20,0.85)'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(232,196,110,0.8)'; ctx.stroke();
  const fw = Math.max(h, (w - 4) * clamp(f, 0, 1));
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
  roundPath(ctx, x + 2, y + 2, fw - 0, h - 4, (h - 4) / 2); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}
const GOLDG = ['#ffe08a', '#d89a1c'], GREENG = ['#9dffc4', '#2fbf72'], REDG = ['#ffb59a', '#e0603a'];

function drawHud(ctx, state, L) {
  const m = state.m, h = m.h, names = sideNames(m.cfg), hs = Math.min(1.35, TEXT_SCALES[state.settings.textIdx]);
  const two = m.nSides > 1;
  const wind = h ? windAt(h, h.t) : { x: 0, z: 0 };
  const lock = h ? (h.ph === 'track' ? h.lock : h.lockRel) : 0;
  const fox = h ? h.fox : null;
  const rng = fox ? Math.round(Math.hypot(fox.x - (h.ph === 'fly' || h.ph === 'stoop' ? h.eagle.x : 0), fox.z - (h.ph === 'fly' || h.ph === 'stoop' ? h.eagle.z : 0))) : 0;
  const hb = L.hud;
  ctx.save();
  plaque(ctx, hb.x, hb.y, hb.w, hb.h, { r: 18, alpha: 0.9, corners: false });
  ctx.textBaseline = 'middle';
  if (!L.land) {
    // left: hunt number and the totals
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffe9b0'; ctx.font = `800 ${Math.round(20 * hs)}px ${NUM}`;
    ctx.fillText(`HUNT ${Math.min(m.i + 1, m.nHunts)} / ${m.nHunts}`, hb.x + 18, hb.y + hb.h * 0.26);
    ctx.fillStyle = '#f4f8ff';
    if (!two) { ctx.font = `900 ${Math.round(46 * Math.min(hs, 1.2))}px ${NUM}`; ctx.fillText(String(m.totals[0]), hb.x + 18, hb.y + hb.h * 0.64); }
    else {
      ctx.font = `800 ${Math.round(21 * hs)}px ${NUM}`;
      const a = m.side === 0, b = m.side === 1;
      ctx.fillStyle = a ? '#ffe08a' : '#f4f8ff'; ctx.fillText(`${names[0]} ${m.totals[0]}`, hb.x + 18, hb.y + hb.h * 0.55);
      ctx.fillStyle = b ? '#ffe08a' : '#f4f8ff'; ctx.fillText(`${names[1]} ${m.totals[1]}`, hb.x + 18, hb.y + hb.h * 0.8);
    }
    // middle: wind
    const r = Math.min(hb.h * 0.34, 36), cx = hb.x + hb.w * 0.5;
    windCompass(ctx, cx, hb.y + hb.h * 0.45, r, wind, state.t);
    ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(16 * Math.min(hs, 1.2))}px ${NUM}`; ctx.fillStyle = '#cfe2ff';
    ctx.fillText(`${Math.hypot(wind.x, wind.z).toFixed(1)} m/s`, cx, hb.y + hb.h * 0.86);
    // right: lock and distance
    const rx = hb.x + hb.w - 18;
    ctx.textAlign = 'right'; ctx.font = `800 ${Math.round(20 * hs)}px ${NUM}`; ctx.fillStyle = '#ffe9b0';
    ctx.fillText(h && (h.ph === 'track' || h.rel) ? `LOCK ${Math.round(lock * 100)}%` : 'LOCK', rx, hb.y + hb.h * 0.26);
    ctx.fillStyle = '#f4f8ff'; ctx.font = `900 ${Math.round(38 * Math.min(hs, 1.2))}px ${NUM}`;
    ctx.fillText(fox && fox.mode !== 'gone' ? `${rng} m` : '-', rx, hb.y + hb.h * 0.64);
    // lock bar
    const bw = hb.w * 0.2, bx = rx - bw, by = hb.y + hb.h - 14;
    gauge(ctx, bx, by - 1, bw, 9, lock, lock > 0.7 ? GREENG : GOLDG);
  } else {
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffe9b0'; ctx.font = `800 ${Math.round(20 * hs)}px ${NUM}`;
    ctx.fillText(`HUNT ${Math.min(m.i + 1, m.nHunts)} / ${m.nHunts}`, hb.x + 16, hb.y + 24);
    ctx.fillStyle = '#f4f8ff';
    if (!two) { ctx.font = `900 ${Math.round(46 * Math.min(hs, 1.2))}px ${NUM}`; ctx.fillText(String(m.totals[0]), hb.x + 16, hb.y + 70); }
    else {
      ctx.font = `800 ${Math.round(21 * hs)}px ${NUM}`;
      ctx.fillStyle = m.side === 0 ? '#ffe08a' : '#f4f8ff'; ctx.fillText(`${names[0]} ${m.totals[0]}`, hb.x + 16, hb.y + 56);
      ctx.fillStyle = m.side === 1 ? '#ffe08a' : '#f4f8ff'; ctx.fillText(`${names[1]} ${m.totals[1]}`, hb.x + 16, hb.y + 84);
    }
    windCompass(ctx, hb.x + hb.w - 46, hb.y + 58, 34, wind, state.t);
    ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(16 * Math.min(hs, 1.2))}px ${NUM}`; ctx.fillStyle = '#cfe2ff';
    ctx.fillText(`${Math.hypot(wind.x, wind.z).toFixed(1)} m/s`, hb.x + hb.w - 46, hb.y + 104);
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffe9b0'; ctx.font = `800 ${Math.round(18 * hs)}px ${NUM}`;
    ctx.fillText(h && (h.ph === 'track' || h.rel) ? `LOCK ${Math.round(lock * 100)}%` : 'LOCK', hb.x + 16, hb.y + 132);
    const bw = hb.w - 32, by = hb.y + 148;
    gauge(ctx, hb.x + 16, by - 1, bw, 10, lock, lock > 0.7 ? GREENG : GOLDG);
    ctx.fillStyle = '#f4f8ff'; ctx.font = `900 ${Math.round(32 * Math.min(hs, 1.2))}px ${NUM}`;
    ctx.fillText(fox && fox.mode !== 'gone' ? `Fox ${rng} m` : 'Fox -', hb.x + 16, hb.y + 186);
  }
  ctx.restore();
  // daylight bar under the scoreboard while tracking
  if (h && h.ph === 'track') {
    const f = clamp(1 - h.t / K.LIMIT, 0, 1), bx = hb.x, bw = L.land ? hb.w : hb.w, by = hb.y + hb.h + 8;
    if (!L.land) gauge(ctx, bx + 8, by - 2, bw - 16, 9, f, f > 0.25 ? GOLDG : REDG);
  }
}

function button(ctx, r, label, o = {}) {
  const { dy } = paintButton(ctx, r, o);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = o.disabled ? 'rgba(255,255,255,0.35)' : o.primary ? C.ink : '#f4f8ff';
  let px = o.size ?? Math.min(30, Math.round(r.h * 0.36));
  ctx.font = `800 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > r.w - 18 && px > 12) { px--; ctx.font = `800 ${px}px ${FONT}`; }
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + dy);
  ctx.restore();
}

function drawSheet(ctx, state, L, text, title) {
  const s = L.sheet; if (!s) return;
  const hs = Math.min(1.5, TEXT_SCALES[state.settings.textIdx]);
  panel(ctx, s.x, s.y, s.w, s.h, { r: 20, corners: false });
  ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe08a'; ctx.font = `800 ${Math.round(22 * hs)}px ${FONT}`; ctx.fillText(title, s.x + 18, s.y + 14 + 22 * hs);
  const fs = Math.round(23 * hs); ctx.font = `500 ${fs}px ${FONT}`; ctx.fillStyle = '#f4f8ff';
  const lines = wrapLines(ctx, text, s.w - 36), room = Math.floor((s.h - 50) / (fs * 1.3));
  lines.slice(0, Math.max(2, room)).forEach((l, i) => ctx.fillText(l, s.x + 18, s.y + 14 + 22 * hs + 14 + fs * (i + 1) * 1.3));
  ctx.restore();
}

// ---- the world ----------------------------------------------------------------------------------------------------------------------------
const foxSize = (g, p) => Math.max(30, 128 * g.unit * p.s);
const eagleSpan = (g, p) => Math.max(50, 250 * g.unit * p.s);

// The eagle's place in the world for drawing, or null if it is not in the air. During the return it follows a gentle loop.
export function eagleSpot(state) {
  const m = state.m, h = m.h; if (!h) return null;
  const e = h.eagle;
  if (h.ph === 'fly' || h.ph === 'stoop') return { x: e.x, z: e.z, alt: e.alt, bank: e.bank, fold: h.ph === 'stoop' ? clamp(h.st.t / 0.18, 0, 1) : 0, ph: state.t * (h.ph === 'fly' && e.alt < 10 ? 11 : 5), amp: h.ph === 'fly' ? 0.55 : 0.1, flap: Math.sin(state.t * (h.ph === 'fly' && e.alt < 10 ? 11 : 5)) * (h.ph === 'fly' ? 0.55 : 0.1) };
  if (h.ph === 'strike') return { x: e.x, z: e.z, alt: Math.min(8, e.alt + (h.pt * 5)), bank: e.bank * 0.5, fold: clamp(1 - h.pt * 2, 0, 1), ph: state.t * 8, amp: 0.45, flap: Math.sin(state.t * 8) * 0.45 };
  if (h.ph === 'recall' || h.ph === 'done') {
    const u = clamp((h.rc ? h.rc.t : K.RECALL.total) / K.RECALL.total, 0, 1), k = ease(u), from = h.res && h.res.from ? h.res.from : { x: e.x, z: e.z };
    const swing = Math.sin(u * Math.PI * 2.2) * 26 * (1 - u);
    return { x: lerp(from.x, 0, k) + swing, z: lerp(from.z, 3, Math.pow(k, 0.9)), alt: lerp(10, 2.2, k) + Math.sin(u * Math.PI) * 8, bank: Math.cos(u * Math.PI * 2.2) * 0.4 * (1 - u), fold: 0, ph: state.t * 7, amp: 0.5, flap: Math.sin(state.t * 7) * 0.5, u };
  }
  return null;
}

export function renderPlay(ctx, state) {
  const m = state.m, h = m.h, L = playLayout(), g = geom(FR.w, FR.h), cam = state.cam, pal = palFor(state);
  const guide = state.settings.guide;
  const F3 = scene3d();
  ctx.save();
  if (state.shake > 0.01) ctx.translate(Math.sin(state.t * 90) * state.shake * 6, Math.cos(state.t * 77) * state.shake * 5);
  if (F3) {
    // the real 3D scene (sky, steppe, den, fox, eagle, glove) is drawn by the presenter; the 2D layer adds the sight, guides and HUD
    draw3d(ctx, F3, {
      mode: 'play', t: state.t, cam, h, plum: Math.min(state.settings.plum, unlockedCount(state.record.career) - 1, PALETTES.length - 1), level: m.cfg.level ?? 1,
      wind: h ? windAt(h, h.t) : { x: 0, z: 0 }, glove: { x: gloveX(L.land), y: L.land ? FR.h - 190 : L.action.y - 130 },
    });
  } else {
    drawSky(ctx, g, cam, state.t);
    drawGround(ctx, g, cam, state.t, 0);
    drawProps(ctx, g, cam);
  }
  if (h) {
    if (F3) { if (guide && (h.ph === 'track' || h.ph === 'fly' || h.ph === 'stoop')) drawDenRing(ctx, g, cam, h.den, DEN_RING); }
    else drawDen(ctx, g, cam, h.den, guide && (h.ph === 'track' || h.ph === 'fly' || h.ph === 'stoop') ? DEN_RING : 0, state.t);
    const items = [];
    const f = h.fox;
    if (!F3) {
      if (f.mode !== 'gone') {
        const p = proj(g, cam, f.x, f.z);
        if (p.k > 0.03 && p.x > -80 && p.x < FR.w + 80) items.push({ z: f.z, draw: () => drawFox(ctx, p.x, p.gy, foxSize(g, p), { dir: Math.sin(f.hd) >= 0 ? 1 : -1, mode: f.mode, t: state.t, mark: guide && h.ph === 'track' && h.lock > 0.45 }) });
      }
      const es = eagleSpot(state);
      if (es && !(es.u !== undefined && es.u > 0.9)) {
        const p = proj(g, cam, es.x, es.z, es.alt), sh = proj(g, cam, es.x, es.z, 0), span = eagleSpan(g, p);
        items.push({ z: es.z + 0.01, draw: () => {
          ctx.fillStyle = `rgba(70,95,140,${clamp(0.4 - es.alt * 0.012, 0.15, 0.4)})`;
          ctx.beginPath(); ctx.ellipse(sh.x, sh.gy, span * 0.5, span * 0.1, 0, 0, 7); ctx.fill();
          drawEagle(ctx, p.x, p.y, span, { flap: es.flap, lag: Math.sin(es.ph - 0.9) * es.amp, bank: es.bank, fold: es.fold, pal, front: es.u !== undefined });
        } });
      }
      items.sort((a, b) => b.z - a.z).forEach((it) => it.draw());
      drawFx(ctx, state.fx);
    } else if (guide && h.ph === 'track' && h.lock > 0.45 && f.mode !== 'gone') {
      // a small marker above a fox the sight has found
      const p = proj(g, cam, f.x, f.z, 1.2), my = p.y - 16 - 3 * Math.sin(state.t * 6);
      ctx.save(); ctx.fillStyle = '#ffd36a'; ctx.strokeStyle = 'rgba(20,30,60,0.9)'; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(p.x - 9, my - 13); ctx.lineTo(p.x + 9, my - 13); ctx.lineTo(p.x, my); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
    }
    // sight: while tracking (for the rider, or shown for a computer rider)
    if (h.ph === 'track' && F3) {
      // the sight: a ring laid on the snow (the lock radius in the real perspective), a brass cross at its centre, a bright arc as the lock builds
      const R = lockRadius(h), pc = proj(g, cam, h.sight.x, h.sight.z), N = 56, ring = [];
      for (let i = 0; i <= N; i++) { const a = (i / N) * 6.2832, q = proj(g, cam, h.sight.x + Math.sin(a) * R, h.sight.z + Math.cos(a) * R); ring.push(q); }
      const path = (n) => { ctx.beginPath(); for (let i = 0; i <= n; i++) { const q = ring[i]; if (i === 0) ctx.moveTo(q.x, q.gy); else ctx.lineTo(q.x, q.gy); } };
      const col = h.lock >= 0.7 ? '#8dffb8' : '#ffd36a';
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      path(N); ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(8,16,34,0.45)'; ctx.stroke();
      path(N); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.setLineDash([14, 9]); ctx.stroke(); ctx.setLineDash([]);
      if (h.lock > 0.05) { path(Math.max(1, Math.round(N * h.lock))); ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke(); }
      const ar = Math.max(14, 18 * g.unit), cx = pc.x, cy = pc.gy;
      ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(8,16,34,0.7)';
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(cx + dx * ar * 0.45, cy + dy * ar * 0.45); ctx.lineTo(cx + dx * ar * 1.2, cy + dy * ar * 1.2); ctx.stroke(); }
      ctx.lineWidth = 1.8; ctx.strokeStyle = '#ffe9a6';
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(cx + dx * ar * 0.45, cy + dy * ar * 0.45); ctx.lineTo(cx + dx * ar * 1.2, cy + dy * ar * 1.2); ctx.stroke(); }
      ctx.fillStyle = '#ffe9a6'; ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, 7); ctx.fill();
      ctx.restore();
    } else if (h.ph === 'track') {
      const p = proj(g, cam, h.sight.x, h.sight.z), r = Math.max(26 * g.unit, lockRadius(h) * g.mpx * p.k);
      const on = h.lock > 0.05;
      ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = h.lock >= 0.7 ? '#7dffb0' : '#ffd36a'; ctx.setLineDash([12, 9]);
      ctx.beginPath(); ctx.arc(p.x, p.gy - r * 0.2, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(p.x - r * 0.45, p.gy - r * 0.2); ctx.lineTo(p.x + r * 0.45, p.gy - r * 0.2); ctx.moveTo(p.x, p.gy - r * 1.2 + r * 0.7); ctx.lineTo(p.x, p.gy + r * 0.3); ctx.stroke();
      if (on) { ctx.lineWidth = 7; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.gy - r * 0.2, r + 8, -Math.PI / 2, -Math.PI / 2 + h.lock * Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    }
    // steering marker and the stoop cue
    if (m.steerAt && (h.ph === 'fly' || h.ph === 'stoop')) {
      const p = proj(g, cam, m.steerAt.x, m.steerAt.z);
      ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.gy, 16 * g.unit + 6, 0, 7); ctx.moveTo(p.x - 24, p.gy); ctx.lineTo(p.x + 24, p.gy); ctx.stroke(); ctx.restore();
    }
    if (guide && h.ph === 'fly' && f.mode !== 'gone' && state.cue) {
      const p = proj(g, cam, f.x, f.z), good = state.cue.miss <= 3.5, r = 46 * g.unit * p.s + 14;
      ctx.save(); ctx.lineWidth = 5; ctx.strokeStyle = good ? '#7dffb0' : 'rgba(255,211,106,0.8)';
      ctx.beginPath(); ctx.ellipse(p.x, p.gy - 6, r * 1.4, r * 0.55, 0, 0, 7); ctx.stroke(); ctx.restore();
    }
  }
  // wind-blown snow over everything in the world
  if (h && !F3) drawWindSnow(ctx, g, state.t, windAt(h, h.t).x, windAt(h, h.t).z, 1);
  ctx.restore();
  // the glove, the arm and the perched eagle (3D: they are part of the scene)
  if (h && !F3) {
    const armA = clamp((8 - cam.z) / 22, 0, 1);
    const es = eagleSpot(state);
    const landing = es && es.u !== undefined && es.u > 0.9;
    if (armA > 0.02) {
      ctx.save(); ctx.translate(0, (1 - armA) * 260 * g.unit);
      const glove = drawArm(ctx, g, { t: state.t, raise: landing ? 1 : 0, y: L.land ? FR.h - 170 : L.action.y - 150, x: gloveX(L.land) });
      const perched = (h.ph === 'track' || landing || h.ph === 'done') && !h.rel || landing;
      if (perched) {
        const alert = h.ph === 'track' ? clamp(h.lock * 1.4, 0, 1) : 0;
        const face = (() => { const p = proj(g, cam, h.fox.x, h.fox.z); return p.x >= glove.x ? 1 : -1; })();
        drawPerched(ctx, glove.x, glove.y, (L.land ? 205 : 250) * g.unit, { pal, face, t: state.t, alert });
      }
      ctx.restore();
    }
  }
  // flying float texts (not shaken)
  for (const f of state.floats) {
    const k = f.t / f.life, y = f.y - 70 * Math.min(1, k * 1.6), sc = f.big ? 1.25 : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4); ctx.font = `900 ${Math.round(f.size * sc * (1 + 0.3 * Math.max(0, 1 - k * 6)))}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(8,20,44,0.92)'; ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, y); ctx.restore();
  }
  if (h && h.ph === 'recall') drawRecall(ctx, state, L, g, cam);
  drawHud(ctx, state, L);
  // status line
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const hs = Math.min(1.3, TEXT_SCALES[state.settings.textIdx]);
  ctx.font = `700 ${Math.round(21 * hs)}px ${FONT}`;
  const msg = statusText(state);
  if (msg.trim()) {
    const mw = Math.min(FR.w - 24, ctx.measureText(msg).width + 36);
    const my = L.land ? L.msg.y + 4 : L.msg.y + (h && h.ph === 'track' ? 8 : 0);
    plaque(ctx, L.msg.x - mw / 2, my - 18 * hs, mw, 36 * hs, { r: 18 * hs, alpha: 0.88, corners: false });
    ctx.fillStyle = '#f4f8ff'; ctx.fillText(msg, L.msg.x, my + 1, FR.w - 48);
  }
  ctx.restore();
  // buttons
  const watch = m.cfg.mode === 'watch', human = isHumanSide(m);
  const act = actionState(state);
  if (!watch) {
    if (act.label.trim()) button(ctx, L.action, act.label, { primary: !act.disabled, disabled: act.disabled, size: Math.min(44, Math.round(L.action.h * 0.4)) });
    if (act.glow && !act.disabled) {
      ctx.save(); ctx.strokeStyle = `rgba(125,255,176,${0.55 + 0.35 * Math.sin(state.t * 8)})`; ctx.lineWidth = 6; roundPath(ctx, L.action.x - 5, L.action.y - 5, L.action.w + 10, L.action.h + 10, 20); ctx.stroke(); ctx.restore();
    }
    const canThink = human && h && (h.ph === 'track' || h.ph === 'fly') && !state.paused;
    button(ctx, L.think, 'Think', { disabled: !canThink, active: !!state.hint });
    button(ctx, L.pause, 'Pause', {});
  } else {
    button(ctx, L.think, state.paused ? 'Resume' : 'Pause', { primary: state.paused });
    button(ctx, L.pause, 'Menu', {});
  }
  // sheets
  if (state.hint && human && h && (h.ph === 'track' || h.ph === 'fly')) drawSheet(ctx, state, L, state.hint.text, 'Think');
  else if (!human && m.plan && (m.ph === 'think' || m.ph === 'reveal' || m.ph === 'ride') && m.plan.text) {
    drawSheet(ctx, state, L, m.ph === 'think' ? 'Testing releases at many moments on copies of the hunt and keeping the best.' : m.plan.text, `${sideNames(m.cfg)[m.side] || 'Rider'} ${m.ph === 'think' ? 'is thinking' : 'plans'}`);
  }
  // banner
  if (m.banner) {
    const b = m.banner, k = b.t / b.life, pop = Math.min(1, b.t / 0.18), a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    const cy = g.horizon + (g.h - g.horizon) * 0.22;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(FR.w / 2, cy); ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const sz = Math.min(84, FR.w * 0.11 + 10);
    ctx.font = `900 italic ${sz}px ${FONT}`; ctx.lineJoin = 'round';
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; ctx.lineWidth = sz * 0.22; ctx.strokeStyle = '#0c1d38'; ctx.strokeText(b.text, 0, 0); ctx.restore();
    ctx.lineWidth = sz * 0.1; ctx.strokeStyle = 'rgba(255,240,190,0.8)'; ctx.strokeText(b.text, 0, -1);
    const tg = ctx.createLinearGradient(0, -sz * 0.5, 0, sz * 0.5); tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.45, b.col); tg.addColorStop(1, b.col);
    ctx.fillStyle = tg; ctx.fillText(b.text, 0, 0);
    if (b.sub) { ctx.font = `800 ${Math.round(sz * 0.36)}px ${NUM}`; ctx.lineWidth = 7; ctx.strokeText(b.sub, 0, sz * 0.7); ctx.fillStyle = '#f4f8ff'; ctx.fillText(b.sub, 0, sz * 0.7); }
    ctx.restore();
  }
}

// Where the eagle lands: just above the glove. The three closing rings of the return are drawn here.
export const gloveX = (land) => (land ? FR.w * 0.2 : FR.w * 0.3);
export function recallSpot(L) {
  return { x: gloveX(L.land), y: L.land ? FR.h - 190 - 130 : L.action.y - 150 - 150 };
}
function drawRecall(ctx, state, L, g) {
  const h = state.m.h, rc = h.rc, R = K.RECALL; if (!rc) return;
  const { x: gx, y: gy } = recallSpot(L);
  const idx = R.pulses.findIndex((p, i) => rc.taps[i] === undefined && rc.t < p + 0.5);
  if (idx < 0) return;
  ctx.save();
  const p = R.pulses[idx], f = clamp((rc.t - (p - 1.1)) / 1.1, 0, 1.25), r0 = 130, r1 = 38;
  if (rc.t > p - 1.1) {
    const r = lerp(r0, r1, Math.min(1, f));
    ctx.strokeStyle = Math.abs(rc.t - p) <= R.perfect ? '#7dffb0' : '#ffd36a'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(gx, gy, r, 0, 7); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(gx, gy, r1, 0, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(gx, gy, 6, 0, 7); ctx.fill();
  ctx.font = `800 24px ${NUM}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
  ctx.fillText(`${idx + 1} / ${R.pulses.length}`, gx, gy + r1 + 30);
  ctx.restore();
}

export function actionState(state) {
  const m = state.m, h = m.h, human = isHumanSide(m);
  if (!h || m.cfg.mode === 'watch') return { label: '', disabled: true };
  if (!human) return { label: 'Watching', disabled: true };
  if (m.ph !== 'ride') return { label: ' ', disabled: true };
  switch (h.ph) {
    case 'track': return { label: 'Release', disabled: false, glow: releaseOk(h) };
    case 'fly': return { label: 'Stoop', disabled: false, glow: !!(state.cue && state.cue.miss <= 3.5) };
    case 'recall': return { label: 'Call', disabled: false };
    default: return { label: ' ', disabled: true };
  }
}

// Is this a good moment to release? Fox out in the open, a fair range, the sight on it.
export function releaseOk(h) {
  const f = h.fox, range = Math.hypot(f.x, f.z), den = Math.hypot(f.x - h.den.x, f.z - h.den.z);
  return h.lock >= 0.6 && den >= DEN_RING && range >= 85 && range <= 215 && f.mode !== 'gone';
}

export function statusText(state) {
  const m = state.m, h = m.h, names = sideNames(m.cfg), human = isHumanSide(m), who = names[m.side] || '';
  if (state.paused && m.cfg.mode === 'watch') return 'Paused';
  if (m.ph === 'intro') return `Hunt ${m.i + 1}${m.nSides > 1 ? `: ${who}` : ''}`;
  if (m.ph === 'think') return `${who} is thinking`;
  if (m.ph === 'reveal') return `${who} chooses the moment`;
  if (m.ph === 'sum') return ' ';
  if (!h) return ' ';
  const g = state.settings.guide;
  switch (h.ph) {
    case 'track':
      if (!human) return `${who} is tracking the fox`;
      if (h.lock < 0.3) return 'Drag the sight onto the fox';
      if (!g) return 'Release when you are ready';
      if (releaseOk(h)) return 'A good moment: release!';
      if (Math.hypot(h.fox.x - h.den.x, h.fox.z - h.den.z) < DEN_RING) return 'Wait: the fox is near its den';
      return 'Wait for a better range';
    case 'fly': return human ? (g && state.cue && state.cue.miss <= 3.5 ? 'Now: stoop!' : 'Drag to steer, Stoop to dive') : `${who} flies`;
    case 'stoop': return 'Stooping';
    case 'strike': return ' ';
    case 'recall': return human ? 'Tap Call as each ring closes' : `${who} calls the eagle`;
    default: return ' ';
  }
}
export { winLine };
