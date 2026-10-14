// Drawing for the play screen: the fixed camera, the baked village green, pins, bat, aim guide, effects, scoreboard and control bar.
// Pure: reads `state`, never mutates it. Menus and pages live in menus.js. All text follows the 100-300% text size setting; the town
// region shrinks to make room instead of clipping.
import { SQ, STYLES, ORIGIN, PIN_R, AIM, MAX_THROWS } from './sim.js';
import { setHost, canBake, makeCanvas, paintBackdrop, drawStandingPin, drawLyingPin, drawBat, groundRing, drawShadow, PAL } from './art.js';
import { W, H, TEXT_SCALES, playLayout, BAR_SPECS, barLabel, host, minFont, safe, shape, inRect } from './layout.js';
import { FONT, roundPath, drawButton, wrapLines, textShadow } from './ui.js';
import { drawCardEdge } from './brand.js';
import { GL } from './glbridge.js';

const TAU = Math.PI * 2;
export const textScale = (state) => TEXT_SCALES[state.settings.textIdx];

// ---- the camera ------------------------------------------------------------------------------------------------------------
// A pinhole raised above and behind the thrower's side, tilted down. Built once per region and never changes during play.
// cam.P projects a world point, cam.k gives pixels per metre at a depth, cam.groundAt is the exact inverse for ground points.
const camCache = new Map();
export function makeCam(region, o = {}) {
  const key = `${region.x}|${region.y}|${region.w}|${region.h}|${(o.box || []).join(',')}|${o.pitch}|${o.dist}|${o.wcap}`;
  if (camCache.has(key)) return camCache.get(key);
  const pitch = (o.pitch ?? 20) * Math.PI / 180, dist = o.dist ?? 11, tz = o.tz ?? 1.1;
  const CAM_H = dist * Math.sin(pitch), CAM_Z = tz - dist * Math.cos(pitch);
  const FWD = [0, -Math.sin(pitch), Math.cos(pitch)], UP = [0, Math.cos(pitch), Math.sin(pitch)];
  const raw = (x, y, z) => { const dy = y - CAM_H, dz = z - CAM_Z, d = dy * FWD[1] + dz * FWD[2]; return [x / d, (dy * UP[1] + dz * UP[2]) / d]; };
  // The width is fitted at the depth of the town (so the square fills the screen); the depth range only has to fit the height.
  const bx = o.box ?? [1.3, -1.1, 3.0, 0.32];
  const wp = [[-bx[0], 0, 1.0], [bx[0], 0, 1.0]].map((p) => raw(...p));
  const hp = [[0, bx[4] ?? 0, bx[1]], [0, bx[3] ?? 0.32, bx[2]]].map((p) => raw(...p));
  const wx0 = Math.min(...wp.map((p) => p[0])), wx1 = Math.max(...wp.map((p) => p[0]));
  const y0 = Math.min(...hp.map((p) => p[1])), y1 = Math.max(...hp.map((p) => p[1]));
  const x0 = wx0, x1 = wx1;
  const F = Math.min(Math.min(region.w, o.wcap ?? 1e9) / (x1 - x0), region.h / (y1 - y0));
  const cx = region.x + region.w / 2 - F * (x0 + x1) / 2, cy = region.y + region.h / 2 + F * (y0 + y1) / 2;
  const cam = {
    F, cx, cy, region, key, pose: { H: CAM_H, Z: CAM_Z, pitch },
    P(x, y, z) { const dy = y - CAM_H, dz = z - CAM_Z, d = dy * FWD[1] + dz * FWD[2]; return [cx + F * x / d, cy - F * (dy * UP[1] + dz * UP[2]) / d]; },
    k(z) { return F / (-CAM_H * FWD[1] + (z - CAM_Z) * FWD[2]); },
    groundAt(sx, sy) {
      const u = (sx - cx) / F, v = (cy - sy) / F;
      const dz = CAM_H * (UP[1] - v * FWD[1]) / (UP[2] - v * FWD[2]);
      const d = -CAM_H * FWD[1] + dz * FWD[2];
      return { x: u * d, z: CAM_Z + dz };
    },
  };
  if (camCache.size > 12) camCache.clear();
  camCache.set(key, cam);
  return cam;
}

// ---- the baked village green ----------------------------------------------------------------------------------------------------
const baked = new Map();
function backdrop(ctx, cam) {
  setHost(ctx);
  const key = `${W}x${H}|${cam.key}`;
  let b = baked.get(key);
  if (b === undefined) {
    b = null;
    if (canBake()) {
      const c = makeCanvas(Math.round(W), Math.round(H));
      if (c) { const g = c.getContext('2d'); if (g) { paintBackdrop(g, cam, W, H); b = c; } }
    }
    baked.set(key, b);
    if (baked.size > 5) for (const k of baked.keys()) { if (baked.size <= 4) break; if (k !== key) baked.delete(k); }
  }
  return b;
}
export function drawBackdrop(ctx, cam) {
  const b = backdrop(ctx, cam);
  if (b) ctx.drawImage(b, 0, 0, W, H);
  else paintBackdrop(ctx, cam, W, H);
}

// ---- the scene ------------------------------------------------------------------------------------------------------------------
// S: { w, fx, aim, plans, guide, t, hl, hintMark, tNow, outFade }
export function drawScene(ctx, cam, S) {
  const w = S.w;
  ctx.save();
  if (S.clip) { ctx.beginPath(); ctx.rect(S.clip.x, S.clip.y, S.clip.w, S.clip.h); ctx.clip(); }
  // the 3D layer draws the ground, the village, the pins and the bat behind this canvas; the 2D layer keeps guides, rings and effects
  if (GL.on) GL.views.push({ cam, S });
  else drawBackdrop(ctx, cam);
  // aim guide under the pieces
  if (S.aim && S.aim.show) drawAim(ctx, cam, S);
  // pins and bat, far to near
  const items = [];
  if (!GL.on) {
    for (const p of w.pins) {
      let alpha = 1;
      if (p.out) {
        const dt = S.t - (p.outT ?? 0);
        if (dt > 0.9) alpha = Math.max(0, 1 - (dt - 0.9) / 0.7);
        if (alpha <= 0) continue;
      }
      items.push({ z: p.z, draw: () => (p.st === 'stand' ? drawStandingPin(ctx, cam, p, { alpha, mark: S.hl === p.id ? '#ffd24a' : null }) : drawLyingPin(ctx, cam, p, { alpha, mark: S.hl === p.id ? '#ffd24a' : null })) });
    }
    if (w.bat) { const b = w.bat; items.push({ z: b.z + (b.mode === 'fly' ? 0.0 : 0.05), draw: () => drawBat(ctx, cam, b, S.t) }); }
  } else if (S.hl !== null && S.hl !== undefined) {
    const hp = w.pins.find((p) => p.id === S.hl);
    if (hp && !hp.out) { groundRing(ctx, cam, hp.x, hp.z, 0.16, 'rgba(20,30,50,0.7)', 6); groundRing(ctx, cam, hp.x, hp.z, 0.16, '#ffd24a', 3.5); }
  }
  items.sort((a, b) => a.z - b.z);
  for (const it of items) it.draw();
  // effects
  const fx = S.fx;
  if (fx) {
    for (const r of fx.rings) {
      const k = r.t / r.max, rr = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - k, 2));
      ctx.save(); ctx.globalAlpha = r.a * (1 - k);
      groundRing(ctx, cam, r.x, r.z, rr, r.col, r.lw);
      ctx.restore();
    }
    for (const q of fx.parts) {
      const k = q.t / q.max, p = cam.P(q.x, q.y, q.z), kk = cam.k(q.z);
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k);
      if (q.kind === 'chip') { ctx.fillStyle = '#e1b36d'; ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(q.t * 12); ctx.fillRect(-kk * 0.03, -kk * 0.012, kk * 0.06, kk * 0.025); ctx.restore(); }
      else { ctx.fillStyle = q.kind === 'spark' ? '#ffe9a8' : '#ffffff'; ctx.beginPath(); ctx.arc(p[0], p[1], kk * (q.r0 + (q.r1 - q.r0) * k) * 0.5 + 1, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
  if (!GL.on) snowfall(ctx, S.t);
  ctx.restore();
}

// light falling snow: a fixed set of flakes whose positions come from the clock (drawing only)
function snowfall(ctx, t) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 46; i++) {
    const sx = (i * 137.5) % 1, sp = 0.035 + ((i * 53) % 7) * 0.008, ph = ((i * 29) % 100) / 100;
    const y = ((ph + t * sp) % 1) * H, x = ((sx + Math.sin(t * 0.6 + i) * 0.015) % 1) * W;
    const r = 1.2 + ((i * 7) % 3) * 0.8;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawAim(ctx, cam, S) {
  const a = S.aim, style = STYLES[a.style];
  const gui = S.guide;   // 0 path + ring, 1 ring, 2 off
  if (gui === 2 && !a.force) return;
  const lx = a.x, lz = a.z;
  // the slide path: from the landing point along the flight direction, for the distance the bat will carry
  const dx = lx - ORIGIN.x, dz = lz - ORIGIN.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  if (gui === 0 || a.force) {
    const dist = style.speed * style.speed / (2 * style.fric) * 0.92;
    const half = style.across ? 0.36 : 0.06;
    ctx.save();
    const p0 = cam.P(lx, 0.01, lz), p1 = cam.P(lx + ux * dist, 0.01, lz + uz * dist);
    const g = ctx.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
    g.addColorStop(0, 'rgba(255,214,90,0.5)'); g.addColorStop(1, 'rgba(255,214,90,0.04)');
    const px = -uz, pz = ux;
    const q = [cam.P(lx + px * half, 0.01, lz + pz * half), cam.P(lx + ux * dist + px * half, 0.01, lz + uz * dist + pz * half), cam.P(lx + ux * dist - px * half, 0.01, lz + uz * dist - pz * half), cam.P(lx - px * half, 0.01, lz - pz * half)];
    ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ctx.setLineDash([8, 9]); ctx.strokeStyle = 'rgba(40,60,100,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    ctx.restore();
  }
  // the landing ring
  const pulse = 0.5 + 0.5 * Math.sin(S.t * 5);
  groundRing(ctx, cam, lx, lz, 0.17 + pulse * 0.01, 'rgba(20,40,80,0.85)', 5);
  groundRing(ctx, cam, lx, lz, 0.17 + pulse * 0.01, a.hint ? '#ffd24a' : '#ffffff', 3);
  const c = cam.P(lx, 0.01, lz), k = cam.k(lz);
  ctx.save(); ctx.strokeStyle = a.hint ? '#ffd24a' : '#ffffff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  // the bat's attitude at the landing: across for sweep, along for the others
  const hl = Math.min(0.36, 0.3) * k;
  ctx.beginPath();
  if (style.across) { ctx.moveTo(c[0] - hl, c[1]); ctx.lineTo(c[0] + hl, c[1]); }
  else { const e = cam.P(lx + ux * 0.36, 0.01, lz + uz * 0.36), s = cam.P(lx - ux * 0.36, 0.01, lz - uz * 0.36); ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]); }
  ctx.stroke(); ctx.restore();
}

// ---- the play screen: scoreboard, town, control bar -------------------------------------------------------------------------------
export function barSpecFor(state) {
  if (state.m && state.m.mode === 'watch') return BAR_SPECS.watch;
  return textScale(state) >= 1.5 ? BAR_SPECS.big : BAR_SPECS.throw;
}
export function layoutFor(state) { return playLayout(textScale(state), barSpecFor(state)); }
// The box the camera must fit: [half width, nearest ground z, farthest ground z, height at the far end]. Tall phones have room for the
// thrower standing behind the town; short or wide screens crop to the waist so the town stays large.
// box = [half width, nearest z, farthest z, height at the far end, height at the near end]: the thrower is cropped at the waist by the
// control bar, so the town stays as large as it can be. The same numbers drive the 2D fallback and the 3D layer.
// Three-quarter view: the thrower (waist up), the town and a row of onlookers behind the far board. The width is fitted on the short side
// (wcap = 696 units), so the town is the same size in portrait and landscape; landscape only loses a little thrower at the bottom.
export const playOpts = (mode) => ({ pitch: 30, dist: 15, wcap: 696, box: mode === 'wide' ? [1.3, -4.0, 4.4, 0.9, 1.75] : [1.12, -3.4, 4.8, 1.9, 1.0] });
export const heroOpts = () => ({ pitch: 24, dist: 17, box: [3.1, -4.6, 6.2, 2.0, 0.0] });
export function camFor(state, lay) {
  const l = lay ?? layoutFor(state);
  return makeCam(l.region, playOpts(l.mode));
}

const pauseIcon = (ctx, r) => {
  drawButton(ctx, r, '', { dark: true });
  ctx.fillStyle = '#f4f9ff';
  const px = r.x + r.w / 2, py = r.y + r.h / 2, bw = r.w * 0.1, bh = r.h * 0.28;
  ctx.fillRect(px - bw * 2, py - bh, bw * 1.6, bh * 2); ctx.fillRect(px + bw * 0.4, py - bh, bw * 1.6, bh * 2);
};
function fit(ctx, text, maxW, size, weight) {
  let px = size; ctx.font = `${weight} ${px}px ${FONT}`;
  const min = minFont();
  while (ctx.measureText(text).width > maxW && px > min) { px -= 1; ctx.font = `${weight} ${px}px ${FONT}`; }
  return text;
}
function batIcons(ctx, x, y, n, used, size) {
  for (let i = 0; i < n; i++) {
    const cx = x + i * size * 1.45;
    ctx.save(); ctx.translate(cx + size * 0.5, y); ctx.rotate(-0.5);
    roundPath(ctx, -size * 0.5, -size * 0.14, size, size * 0.28, size * 0.14);
    ctx.fillStyle = i < used ? 'rgba(255,255,255,0.22)' : '#e6bd78'; ctx.fill();
    if (i >= used) { ctx.fillStyle = PAL.red; ctx.fillRect(-size * 0.12, -size * 0.14, size * 0.14, size * 0.28); }
    ctx.restore();
  }
}

export function drawHud(ctx, state, lay) {
  const hb = lay.hud, tl = state.turn, m = state.m;
  const l1 = hudLine1(state), l2 = hudLine2(state);
  const n = tl ? tl.bats : MAX_THROWS, used = tl ? tl.used : 0;
  if (hb.kind === 'card') return drawHudCard(ctx, hb, l1, l2, n, used);
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, hb.bottom + 6); g.addColorStop(0, 'rgba(34,20,10,0.92)'); g.addColorStop(1, 'rgba(34,20,10,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, hb.bottom + 4);
  ctx.restore();
  pauseIcon(ctx, hb.pause);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const fs = hb.fs;
  const iconW = Math.round(fs * 1.45) * Math.min(n, 8) + 6;
  if (!hb.stacked) {
    ctx.font = `800 ${fs}px ${FONT}`; ctx.fillStyle = '#f4f9ff'; ctx.fillText(fit(ctx, l1, hb.textW, fs, 800), hb.textX, hb.y + 46);
    const f2 = Math.round(fs * 0.86);
    ctx.font = `600 ${f2}px ${FONT}`; ctx.fillStyle = '#bcd6f2'; ctx.fillText(fit(ctx, l2, hb.textW - iconW, f2, 600), hb.textX, hb.y + 84);
    if (m.mode !== 'watch' || tl) batIcons(ctx, hb.textX + hb.textW - iconW + 6, hb.y + 76, Math.min(n, 8), used, f2 * 0.9);
  } else {
    ctx.font = `800 ${fs}px ${FONT}`; ctx.fillStyle = '#f4f9ff';
    wrapLines(ctx, l1, hb.textW).slice(0, 2).forEach((l, i) => ctx.fillText(l, hb.textX, hb.y + 30 + (i + 1) * hb.row * 0.8));
    ctx.font = `600 ${Math.round(fs * 0.86)}px ${FONT}`; ctx.fillStyle = '#bcd6f2';
    const y0 = Math.max(hb.pause.y + hb.pause.h, hb.y + 30 + 2 * hb.row * 0.8) + 8;
    wrapLines(ctx, l2, hb.rowW).slice(0, 3).forEach((l, i) => ctx.fillText(l, hb.rowX, y0 + (i + 1) * hb.row * 0.78));
  }
}
function drawHudCard(ctx, hb, l1, l2, n, used) {
  const c = hb.card;
  roundPath(ctx, c.x, c.y, c.w, c.h, 22); ctx.fillStyle = 'rgba(40,24,12,0.93)'; ctx.fill();
  drawCardEdge(ctx, c);
  pauseIcon(ctx, hb.pause);
  const top = hb.textTop, bottom = hb.textBottom - 40, min = minFont();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  let fs = hb.fs, a = [], b = [];
  for (; fs >= min; fs -= 2) {
    ctx.font = `800 ${fs}px ${FONT}`; a = wrapLines(ctx, l1, hb.textW);
    ctx.font = `600 ${Math.round(fs * 0.88)}px ${FONT}`; b = wrapLines(ctx, l2, hb.textW);
    if (top + a.length * fs * 1.25 + 10 + b.length * fs * 0.88 * 1.25 <= bottom) break;
  }
  fs = Math.max(fs, min);
  ctx.font = `800 ${fs}px ${FONT}`; ctx.fillStyle = '#f4f9ff';
  a.forEach((l, i) => ctx.fillText(l, hb.textX, top + fs * (1 + i * 1.25)));
  const y2 = top + a.length * fs * 1.25 + 10, f2 = Math.round(fs * 0.88);
  ctx.font = `600 ${f2}px ${FONT}`; ctx.fillStyle = '#bcd6f2';
  b.forEach((l, i) => ctx.fillText(l, hb.textX, y2 + f2 * (1 + i * 1.25)));
  batIcons(ctx, hb.textX, hb.textBottom - 16, Math.min(n, 8), used, Math.min(30, Math.max(18, f2)));
}

function hudLine1(state) {
  const m = state.m;
  if (!m) return '';
  const f = state.fig;
  if (m.mode === 'ladder') return `Figure ${m.figure + 1} of 15 · ${f.name}`;
  if (m.mode === 'watch') return `Watch & Learn · ${f.name}`;
  return `Figure ${m.i + 1} of ${m.list.length} · ${f.name}`;
}
function hudLine2(state) {
  const m = state.m, tl = state.turn, w = state.w;
  if (!m || !tl) return '';
  const left = w.pins.filter((p) => !p.out).length;
  const base = `${tl.name}: ${left} of ${state.figTotal} pins in`;
  if (m.mode === 'duel') return `${base} · ${state.names.you} ${m.pts.you} : ${m.pts.rival} ${state.names.rival}`;
  if (m.mode === 'watch') return base;
  return base;
}

// what each bar button shows right now
export function barButtons(state) {
  const m = state.m, st = state.settings, out = {}, sc = textScale(state);
  if (m.mode === 'watch') {
    out.wpause = { label: state.paused ? 'Resume' : 'Pause', primary: true };
    out.wdec = { label: sc >= 2 ? 'Less' : 'Shorter', disabled: st.thinkIdx === 0 };
    out.winc = { label: sc >= 2 ? 'More' : 'Longer', disabled: st.thinkIdx === 3 };
    out.wexit = { label: sc >= 2 ? 'Stop' : 'Stop watching', dark: true };
    return out;
  }
  const can = state.humanTurnAim;
  const sid = state.aim.style;
  if (sc >= 1.5) {
    out.style = { label: `Style: ${STYLES[sid].name}`, active: true, disabled: !can };
    out.think = { label: state.thinkBusy ? 'Thinking…' : 'Think', dark: true, disabled: !can };
    out.throw = { label: 'Throw', primary: true, disabled: !can };
    return out;
  }
  for (const id of ['sweep', 'drive', 'smash']) out[id] = { label: STYLES[id].name, active: sid === id, dark: sid !== id, disabled: !can };
  out.think = { label: state.thinkBusy ? 'Thinking…' : 'Think', dark: true, disabled: !can };
  out.throw = { label: 'Throw', primary: true, disabled: !can };
  return out;
}
export function drawBar(ctx, state, lay) {
  const b = lay.bar;
  if (b.card) { roundPath(ctx, b.card.x, b.card.y, b.card.w, b.card.h, 22); ctx.fillStyle = 'rgba(40,24,12,0.93)'; ctx.fill(); drawCardEdge(ctx, b.card); }
  else {
    const g = ctx.createLinearGradient(0, b.top - 6, 0, H); g.addColorStop(0, 'rgba(34,20,10,0.5)'); g.addColorStop(0.3, 'rgba(34,20,10,0.9)'); g.addColorStop(1, 'rgba(34,20,10,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, b.top - 6, W, H - b.top + 6);
  }
  const bt = barButtons(state);
  for (const [id, r] of Object.entries(b.rects)) { const d = bt[id]; if (d) drawButton(ctx, r, d.label, { ...d, size: b.fs }); }
}

function drawWideBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#16243a'); g.addColorStop(0.6, '#1d3350'); g.addColorStop(1, '#0f1b2e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

export function renderPlay(ctx, state) {
  const lay = layoutFor(state), cam = camFor(state, lay);
  state.cam = { lay };
  if (GL.on) ctx.clearRect(0, 0, W, H);
  else { ctx.fillStyle = '#16243a'; ctx.fillRect(0, 0, W, H); if (lay.mode === 'wide') drawWideBackground(ctx); }
  GL.state = state;
  const showAim = state.humanTurnAim || (state.aimShow && state.aimShow > 0);
  drawScene(ctx, cam, {
    w: state.w, fx: state.fx, t: state.t, guide: state.settings.guide, hl: state.hl,
    clip: lay.mode === 'wide' ? lay.region : null,
    aim: showAim ? { ...state.aim, show: true, hint: !!state.hint, force: !!state.aimShow } : null,
  });
  if (state.plans && state.plans.length) drawPlans(ctx, cam, state, lay);
  drawHud(ctx, state, lay);
  drawBar(ctx, state, lay);
  drawOverlays(ctx, state, lay, cam);
}

// Watch & Learn: the candidates the player is weighing, as numbered rings.
function drawPlans(ctx, cam, state, lay) {
  const pl = state.plans;
  ctx.save();
  if (lay.mode === 'wide') { ctx.beginPath(); ctx.rect(lay.region.x, lay.region.y, lay.region.w, lay.region.h); ctx.clip(); }
  pl.forEach((p, i) => {
    if (state.think && state.think.phase === 'reveal' && i > 0) return;
    const c = cam.P(p.x, 0.01, p.z), k = cam.k(p.z);
    const chosen = state.think && state.think.phase === 'reveal' && i === 0;
    ctx.globalAlpha = chosen ? 1 : 0.85;
    groundRing(ctx, cam, p.x, p.z, 0.15, chosen ? '#7dffb4' : '#ffffff', chosen ? 4 : 3, chosen ? null : [6, 6]);
    ctx.font = `800 ${Math.max(14, Math.round(k * 0.2))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = chosen ? '#7dffb4' : '#ffffff';
    textShadow(ctx, `${i + 1}`, c[0], c[1] - k * 0.32, ctx.fillStyle, 3);
  });
  ctx.restore();
}

function drawOverlays(ctx, state, lay, cam) {
  const sc = Math.min(textScale(state), 2), R = lay.region;
  if (state.toastT > 0 && state.toast) {
    const fs = Math.round(24 * sc), maxW = R.w - 56;
    ctx.save(); ctx.font = `700 ${fs}px ${FONT}`;
    const lines = wrapLines(ctx, state.toast, maxW - 40).slice(0, 4);
    const h = lines.length * fs * 1.25 + 22, y = lay.regionTop + (lay.mode === 'wide' ? 56 : 10);
    ctx.globalAlpha = Math.min(1, state.toastT * 3); roundPath(ctx, R.x + 18, y, R.w - 36, h, 22); ctx.fillStyle = 'rgba(14,26,46,0.86)'; ctx.fill();
    ctx.fillStyle = '#f4f9ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, R.x + R.w / 2, y + 12 + fs * (1 + i * 1.25) - 4));
    ctx.restore();
  }
  for (const p of state.fx.pops) {
    const k = p.t / p.max, sp = cam.P(p.x, 0.5 + k * 0.7, p.z);
    ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.font = `800 ${p.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    textShadow(ctx, p.text, sp[0], sp[1], p.col, 6); ctx.restore();
  }
  // the explanation / hint card
  state.cardRect = null;
  const watch = state.m.mode === 'watch';
  let card = null;
  if (watch && state.card) {
    const th = state.think;
    card = { title: state.card.title, text: state.card.reveal ? state.card.text : th ? `Think first: which pin would you hit, and how? The plan appears in ${Math.max(1, Math.ceil(th.dur - th.t))} s.` : state.card.text, accent: state.card.reveal ? '#9dffb8' : '#ffd97a', edge: state.card.reveal ? 'rgba(120,255,190,0.9)' : 'rgba(240,194,74,0.8)', bg: 'rgba(14,26,46,0.92)' };
  } else if (!watch && state.hint && state.hint.text) card = { title: state.hint.title, text: state.hint.text, accent: '#9dffb8', edge: 'rgba(120,255,190,0.9)', bg: 'rgba(12,38,36,0.94)' };
  if (card) {
    const fs = Math.round(22 * textScale(state));
    ctx.save();
    ctx.font = `800 ${fs}px ${FONT}`;
    const head = wrapLines(ctx, card.title, R.w - 76).slice(0, 3);
    ctx.font = `400 ${fs}px ${FONT}`;
    const room = Math.max(textScale(state) > 1.5 ? 2 : 3, Math.floor(((lay.regionBottom - lay.regionTop) * (textScale(state) > 1.5 ? 0.4 : 0.34)) / (fs * 1.25)) - head.length);
    const all = card.text ? wrapLines(ctx, card.text, R.w - 76) : [];
    const body = all.slice(0, Math.max(0, Math.min(all.length, room)));
    if (all.length > body.length && body.length) { let t = body[body.length - 1].replace(/[ ,.;:]+$/, ''); while (t.length > 4 && ctx.measureText(`${t}… tap for more`).width > R.w - 76) t = t.slice(0, -1); body[body.length - 1] = `${t}… tap for more`; }
    const h = (head.length + body.length) * fs * 1.25 + 26, y = lay.regionBottom - h - 14;
    roundPath(ctx, R.x + 12, y, R.w - 24, h, 20); ctx.fillStyle = card.bg; ctx.fill();
    ctx.strokeStyle = card.edge; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `800 ${fs}px ${FONT}`; ctx.fillStyle = card.accent;
    head.forEach((l, i) => ctx.fillText(l, R.x + 32, y + 14 + fs * (1 + i * 1.25) - 4));
    ctx.font = `400 ${fs}px ${FONT}`; ctx.fillStyle = '#f4f9ff';
    body.forEach((l, i) => ctx.fillText(l, R.x + 32, y + 14 + fs * (1 + (head.length + i) * 1.25) - 4));
    ctx.restore();
    state.cardRect = { x: R.x + 12, y, w: R.w - 24, h };
    state.cardFull = { title: card.title, text: card.text };
  }
  // the thinking-time bar in Watch & Learn
  if (state.think && watch) {
    const th = state.think, fr = Math.min(1, th.t / th.dur);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(R.x + 12, lay.regionBottom - 8, R.w - 24, 6);
    ctx.fillStyle = th.phase === 'think' ? '#f0c24a' : '#7dffb4'; ctx.fillRect(R.x + 12, lay.regionBottom - 8, (R.w - 24) * fr, 6);
  }
  // big banner after a turn
  if (state.banner && state.banner.t > 0) {
    const b = state.banner, a = Math.min(1, b.t * 3, (b.max - b.t) * 5);
    const fs = Math.round(60 * Math.min(sc, 1.25));
    ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.font = `900 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    textShadow(ctx, b.text, R.x + R.w / 2, lay.regionTop + (lay.regionBottom - lay.regionTop) * 0.42, b.col, 14); ctx.restore();
  }
}

// ---- the green behind the menus ----------------------------------------------------------------------------------------------------
export function attractCam() {
  const u = safe();
  if (shape() === 'wide') return makeCam({ x: u.x0 + 12, y: u.y0 + 8, w: u.w - 24, h: u.h - 16 }, heroOpts());
  const top = Math.round(H * 0.2), bottom = Math.round(H * 0.95);
  return makeCam({ x: 12, y: top, w: W - 24, h: bottom - top }, heroOpts());
}
export function drawAttract(ctx, state) {
  const cam = attractCam(), a = state.att;
  if (GL.on) ctx.clearRect(0, 0, W, H);
  else { ctx.fillStyle = '#16243a'; ctx.fillRect(0, 0, W, H); }
  GL.state = state;
  if (!a) return;
  drawScene(ctx, cam, { w: a.w, fx: a.fx, t: state.t, guide: 2, aim: null, attract: a });
}
export { SQ, PIN_R, AIM, inRect, host };
