// Drawing for the play screen: the fixed true-perspective camera, the yard (baked once, never moves), the can, slippers and token
// players, the aim guide, effects, scoreboard and control bar. Pure: reads `state`, never mutates it. Menus and pages live in menus.js.
// All text follows the 100-300% text size setting; the yard region shrinks to make room instead of clipping.
import { FIELD, CAN, LINE_Z, TAG_R, SLIP, STYLES, throwSolve, G, taya, throwers, tagLive, HAND_Y } from './sim.js';
import {
  setHost, canBake, startTextureBake, startBackdrop, drawCan, drawSlipper, drawPawn, drawShadow, groundRing, pawnLook, lcg, WALL_Z,
} from './art.js';
import { W, H, TEXT_SCALES, playLayout, BAR_SPECS, barLabel, inRect } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow } from './ui.js';

const TAU = Math.PI * 2;
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
export const textScale = (state) => TEXT_SCALES[state.settings.textIdx];

// ---- the camera ----------------------------------------------------------------------------------------------------------------
// A pinhole raised above and behind the toe line, tilted down. It is built once per layout (text size) and never changes during play:
// the yard is a fixed trapezoid, scale grows smoothly towards the camera, circles stay true ellipses. cam.P projects a world point,
// cam.groundAt is the exact inverse for points on the ground.
const camCache = new Map();
export function makeCam(region, o = {}) {
  const key = `${region.x}|${region.y}|${region.w}|${region.h}|${o.pitch ?? ''}|${o.h ?? ''}|${o.z ?? ''}|${o.box ? o.box.join(',') : ''}`;
  if (camCache.has(key)) return camCache.get(key);
  const CAM_H = o.h ?? 12, CAM_Z = o.z ?? -6.5, PITCH = (o.pitch ?? 62) * Math.PI / 180;
  const FWD = [0, -Math.sin(PITCH), Math.cos(PITCH)], UP = [0, Math.cos(PITCH), Math.sin(PITCH)];
  const raw = (x, y, z) => { const dy = y - CAM_H, dz = z - CAM_Z, d = dy * FWD[1] + dz * FWD[2]; return [x / d, (dy * UP[1] + dz * UP[2]) / d, d]; };
  const bx = o.box ?? [3.6, -2.0, WALL_Z];   // half width, nearest z, farthest z
  const pts = o.box
    ? [[-bx[0], 0, bx[1] - 0.3], [bx[0], 0, bx[1] - 0.3], [-bx[0], 1.5, bx[2]], [bx[0], 1.5, bx[2]], [-bx[0], 1.9, bx[1] + 0.8], [bx[0], 1.9, bx[1] + 0.8]]
    : [[-3.6, 0, -2.0], [3.6, 0, -2.0], [-3.6, 0, WALL_Z], [3.6, 0, WALL_Z], [-3.6, 1.7, WALL_Z], [3.6, 1.7, WALL_Z], [-2.6, 1.4, -1.9]];
  const rp = pts.map((p) => raw(...p));
  const x0 = Math.min(...rp.map((p) => p[0])), x1 = Math.max(...rp.map((p) => p[0])), y0 = Math.min(...rp.map((p) => p[1])), y1 = Math.max(...rp.map((p) => p[1]));
  const F = Math.min(region.w / (x1 - x0), region.h / (y1 - y0));
  const cx = region.x + region.w / 2 - F * (x0 + x1) / 2, cy = region.y + region.h / 2 + F * (y0 + y1) / 2;
  const cam = {
    F, cx, cy, region, pos: [0, CAM_H, CAM_Z],
    P(x, y, z) { const dy = y - CAM_H, dz = z - CAM_Z, d = dy * FWD[1] + dz * FWD[2]; return [cx + F * x / d, cy - F * (dy * UP[1] + dz * UP[2]) / d]; },
    depth(x, y, z) { return (y - CAM_H) * FWD[1] + (z - CAM_Z) * FWD[2]; },
    depthAtZ(z) { return -CAM_H * FWD[1] + (z - CAM_Z) * FWD[2]; },
    // screen pixels per metre across the yard at a ground point
    k(z) { return F / (-CAM_H * FWD[1] + (z - CAM_Z) * FWD[2]); },
    groundAt(sx, sy) {
      const u = (sx - cx) / F, v = (cy - sy) / F;
      const dz = CAM_H * (UP[1] - v * FWD[1]) / (UP[2] - v * FWD[2]);
      const d = -CAM_H * FWD[1] + dz * FWD[2];
      return { x: u * d, z: CAM_Z + dz };
    },
  };
  camCache.set(key, cam);
  return cam;
}

// ---- the baked yard -----------------------------------------------------------------------------------------------------------------
let texJob = null, tex = null;
const backdrops = new Map();
function ensureBackdrop(ctx, cam) {
  setHost(ctx);
  const key = `${cam.cx.toFixed(2)}|${cam.cy.toFixed(2)}|${cam.F.toFixed(3)}`;
  let b = backdrops.get(key);
  if (b && b.canvas) return b.canvas;
  if (!canBake()) return null;
  if (!tex) {
    if (!texJob) texJob = startTextureBake();
    if (texJob.failed) return null;
    const r = texJob.step(SHOT_MODE);
    if (!r) return null;
    tex = r;
  }
  if (!b) { b = { job: startBackdrop(cam, tex), canvas: null }; backdrops.clear(); backdrops.set(key, b); }
  if (b.job.failed) return null;
  const r = b.job.step(SHOT_MODE ? 99999 : 150);
  if (r) b.canvas = r;
  return b.canvas;
}
function fallbackYard(ctx, cam) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a2030'); g.addColorStop(0.4, '#5a4a4a'); g.addColorStop(1, '#8c7861');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const a = cam.P(FIELD.x0, 0, FIELD.z1), b = cam.P(FIELD.x1, 0, FIELD.z1), c = cam.P(FIELD.x1, 0, FIELD.z0), d = cam.P(FIELD.x0, 0, FIELD.z0);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fillStyle = '#8c7861'; ctx.fill();
}
export const yardReady = (ctx, cam) => !!ensureBackdrop(ctx, cam);

const lerp = (a, b, t) => a + (b - a) * t;
const HALO = (ctx, x, y, r, col) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };

// ---- the scene ----------------------------------------------------------------------------------------------------------------------
// S: { w, alpha, humanId, fx:{parts,rings,pops,ping,erect}, aim, mark, guide, t, hintMark, hlId, showTag }
export function drawScene(ctx, cam, S) {
  const w = S.w, al = S.alpha ?? 1;
  const bd = ensureBackdrop(ctx, cam);
  if (bd) ctx.drawImage(bd, 0, 0); else fallbackYard(ctx, cam);
  const T = taya(w);
  // ground layer: shadows, rings and guide marks
  const can = w.can;
  const cX = lerp(can.px, can.x, al), cY = lerp(can.py, can.y, al), cZ = lerp(can.pz, can.z, al);
  drawShadow(ctx, cam, cX, cZ, CAN.r * 1.05, 0.46, can.mode === 'up' ? 0 : cY * 0.6);
  for (const s of w.slips) {
    if (s.mode === 'held') continue;
    const sx = lerp(s.px, s.x, al), sy = lerp(s.py, s.y, al), sz = lerp(s.pz, s.z, al);
    drawShadow(ctx, cam, sx, sz, 0.24, 0.4, Math.max(0, sy - 0.03));
  }
  const pos = new Map();
  for (const a of w.agents) pos.set(a.id, { x: lerp(a.px, a.x, al), z: lerp(a.pz, a.z, al) });
  for (const a of w.agents) { const p = pos.get(a.id); drawShadow(ctx, cam, p.x, p.z, 0.34, 0.5, a.carry ? 0.15 : 0); }

  // the guard's tag reach: red while it can tag, grey while the can is down
  if (w.phase === 'play') {
    const p = pos.get(T.id), live = tagLive(w);
    ctx.save(); ctx.setLineDash(live ? [] : [7, 7]);
    groundRing(ctx, cam, p.x, p.z, TAG_R, live ? `rgba(255,80,60,${0.55 + 0.25 * Math.sin(S.t * 6)})` : 'rgba(255,255,255,0.28)', live ? 3 : 2);
    ctx.restore();
  }
  // placing the can: a progress ring in the circle
  if (can.mode === 'carried' && can.placeT > 0) {
    ctx.save(); ctx.strokeStyle = '#9dffb0'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); const n = Math.round(40 * Math.min(1, can.placeT / 0.4));
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / 40) * TAU, p = cam.P(Math.cos(a) * CAN.circle, 0.01, CAN.z + Math.sin(a) * CAN.circle); if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
    ctx.stroke(); ctx.restore();
  }
  // the human's own marker and the hint
  if (S.humanId >= 0) {
    const p = pos.get(S.humanId);
    if (p) { const pulse = 0.5 + 0.5 * Math.sin(S.t * 5); groundRing(ctx, cam, p.x, p.z, 0.46 + 0.04 * pulse, `rgba(255,214,90,${0.8})`, 3.5); }
  }
  if (S.hintMark) {
    const pulse = 0.5 + 0.5 * Math.sin(S.t * 7);
    groundRing(ctx, cam, S.hintMark.x, S.hintMark.z, 0.5 + 0.15 * pulse, 'rgba(120,255,190,0.95)', 4);
    groundRing(ctx, cam, S.hintMark.x, S.hintMark.z, 0.25, 'rgba(120,255,190,0.6)', 3);
  }
  // ground rings from effects (landings, pings, the can standing again)
  for (const r of S.fx.rings) {
    const k = r.t / r.max;
    groundRing(ctx, cam, r.x, r.z, r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - k, 2)), r.col.replace('A', String((1 - k) * r.a)), r.lw ?? 3);
  }
  // aim guide: the dotted path and the scatter ring
  if (S.aim && S.aim.show) {
    const a = w.agents.find((q) => q.id === S.humanId);
    if (a) {
      const sv = throwSolve(a, S.aim.x, S.aim.z, S.aim.style);
      const ap = pos.get(a.id);
      if (S.guide < 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        const T0 = sv.T, N = 16;
        for (let i = 1; i < N; i++) {
          const t = (i / N) * T0, x = ap.x + sv.vx * t, z = a.z + sv.vz * t, y = Math.max(0.03, HAND_Y + sv.vy * t - 0.5 * G * t * t);
          const p = cam.P(x, y, z), g = cam.P(x, 0, z);
          ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, TAU); ctx.fill();
          ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(g[0], g[1], 2.4, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      groundRing(ctx, cam, S.aim.x, S.aim.z, S.aim.style === 'skim' ? 0.4 : 0.32, 'rgba(255,255,255,0.85)', 3);
      const c0 = cam.P(S.aim.x, 0.02, S.aim.z);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5;
      const ln = cam.k(S.aim.z) * 0.12;
      ctx.beginPath(); ctx.moveTo(c0[0] - ln, c0[1]); ctx.lineTo(c0[0] + ln, c0[1]); ctx.moveTo(c0[0], c0[1] - ln * 0.6); ctx.lineTo(c0[0], c0[1] + ln * 0.6); ctx.stroke();
    }
  }

  // objects, back to front
  const items = [];
  items.push({ z: cZ + 0.0, draw: () => drawCan(ctx, cam, { ...can, x: cX, y: cY, z: cZ, tilt: lerp(can.ptilt, can.tilt, al) }, { wob: can.wob, ping: S.fx.ping }) });
  for (const s of w.slips) {
    const o = { ...s, x: lerp(s.px, s.x, al), y: lerp(s.py, s.y, al), z: lerp(s.pz, s.z, al), yaw: lerp(s.pyaw, s.yaw, al), pitch: lerp(s.ppitch, s.pitch, al) };
    items.push({ z: o.z - (o.y > 0.2 ? 0 : 0.35), draw: () => drawSlipper(ctx, cam, o) });
  }
  for (const a of w.agents) {
    const p = pos.get(a.id);
    const look = pawnLook(a, S.humanId);
    const th = a.throwT > 0 ? Math.sin(Math.PI * (1 - a.throwT / 0.6)) * 0.28 : 0;
    items.push({
      z: p.z + 0.1,
      draw: () => {
        const r = drawPawn(ctx, cam, a, look, { pos: p, vx: a.vx, vz: a.vz, fx: Math.sin(a.face) * th, fz: Math.cos(a.face) * th, step: a.step, t: S.t, lift: 0 });
        // the guard wears a red band; the can in hand is drawn by the can itself
        if (a.role === 'taya') drawTag(ctx, [r.base[0], r.base[1] + 44], a.id === S.humanId ? 'YOU: GUARD' : 'GUARD', '#d4322e', cam.k(p.z), S.t, true);
        else if (a.id === S.humanId) drawTag(ctx, r.top, 'YOU', '#e9a420', cam.k(p.z), S.t);
        if (S.hlId === a.id) HALO(ctx, r.top[0], r.top[1] + cam.k(p.z) * 0.3, cam.k(p.z) * 1.1, 'rgba(120,255,190,0.35)');
        if (a.tagged) drawTag(ctx, [r.top[0], r.top[1] - 36], 'TAGGED', '#ffffff', cam.k(p.z), S.t, true);
      },
    });
  }
  items.sort((a, b) => a.z - b.z);
  for (const it of items) it.draw();

  // particles
  for (const q of S.fx.parts) {
    const k = q.t / q.max, p = cam.P(q.x, q.y, q.z), px = cam.k(q.z);
    if (q.kind === 'dust') {
      const r = (q.r0 + (q.r1 - q.r0) * k) * px;
      HALO(ctx, p[0], p[1], r, `rgba(214,190,150,${0.34 * (1 - k)})`);
    } else if (q.kind === 'spark') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,${230 - 60 * k | 0},${180 - 100 * k | 0},${1 - k})`; ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(1, 3.6 * (1 - k)), 0, TAU); ctx.fill(); ctx.restore();
    }
  }
}

function drawTag(ctx, top, label, col, k, t = 0, plain = false) {
  const fs = Math.round(Math.max(15, Math.min(22, k * 0.28)));
  ctx.save(); ctx.font = `800 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const bob = plain ? 0 : Math.sin(t * 4) * 2;
  const tw = ctx.measureText(label).width + 16, y = top[1] - fs * 1.2 + bob, x = top[0];
  roundPath(ctx, x - tw / 2, y - fs * 0.75, tw, fs * 1.5, fs * 0.75); ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = col === '#ffffff' ? '#7a1210' : '#ffffff'; ctx.fillText(label, x, y + 1);
  if (!plain) { ctx.beginPath(); ctx.moveTo(x - 6, y + fs * 0.74); ctx.lineTo(x + 6, y + fs * 0.74); ctx.lineTo(x, y + fs * 0.74 + 8); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); }
  ctx.restore();
}

// ---- the play screen: scoreboard, yard, control bar -------------------------------------------------------------------------------------
export function barSpecFor(state) {
  if (state.m && state.m.cfg.mode === 'watch') return BAR_SPECS.watch;
  if (state.m && state.m.cfg.role === 'taya') return BAR_SPECS.taya;
  return textScale(state) >= 2 ? BAR_SPECS.big : BAR_SPECS.thrower;
}
// The two buttons of the one-row bar: Set up + Throw while holding the slipper at home, Fetch + Run home otherwise.
export function bigBarIds(state) {
  const you = state.human >= 0 && state.w ? state.w.agents.find((a) => a.id === state.human) : null;
  return you && you.hasSlip && you.z <= 0.02 ? { ba: 'sheet', bb: 'throw' } : { ba: 'fetch', bb: 'home' };
}
export function layoutFor(state) { return playLayout(textScale(state), barSpecFor(state)); }
export function camFor(state, lay) {
  const l = lay ?? layoutFor(state);
  return makeCam({ x: 12, y: l.regionTop, w: W - 24, h: l.regionBottom - l.regionTop });
}

export function drawHud(ctx, state, lay) {
  const sc = textScale(state), hb = lay.hud, m = state.m, w = state.w;
  // translucent bar so the yard still shows through
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, hb.bottom + 6); g.addColorStop(0, 'rgba(24,12,8,0.86)'); g.addColorStop(1, 'rgba(24,12,8,0.62)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, hb.bottom + 4);
  ctx.restore();
  drawButton(ctx, hb.pause, '', { dark: true });
  ctx.fillStyle = '#fff6e6';
  const px = hb.pause.x + hb.pause.w / 2, py = hb.pause.y + hb.pause.h / 2, bw = hb.pause.w * 0.1, bh = hb.pause.h * 0.28;
  ctx.fillRect(px - bw * 2, py - bh, bw * 1.6, bh * 2); ctx.fillRect(px + bw * 0.4, py - bh, bw * 1.6, bh * 2);
  const left = Math.max(0, Math.ceil(w.limit - w.t));
  const mode = m.cfg.mode, role = m.cfg.role;
  const line1 = mode === 'lesson' ? `Lesson: ${state.lesson ? state.lesson.def.title : ''}` : mode === 'watch' ? `Watch & Learn · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `Round ${m.round} of ${m.cfg.rounds} · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  let line2 = '';
  if (mode === 'ai') {
    line2 = role === 'thrower'
      ? `Points ${m.pts.you} · Tagged ${m.strikes} (up to ${m.need} allowed)`
      : `Tags ${m.tags} of ${m.need} needed · Escapes ${m.escapes}`;
  } else if (mode === 'watch') line2 = 'Four rivals play a whole round';
  else line2 = state.lesson ? state.lesson.def.goal : '';
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const fs = hb.fs;
  if (!hb.stacked) {
    ctx.font = `800 ${fs}px ${FONT}`; ctx.fillStyle = '#fff6e6'; ctx.fillText(fit(ctx, line1, hb.textW, fs, 800), hb.textX, 56);
    ctx.font = `600 ${Math.round(fs * 0.86)}px ${FONT}`; ctx.fillStyle = '#e6cfa6'; ctx.fillText(fit(ctx, line2, hb.textW, Math.round(fs * 0.86), 600), hb.textX, 94);
  } else {
    ctx.font = `800 ${fs}px ${FONT}`; ctx.fillStyle = '#fff6e6';
    const l1 = wrapLines(ctx, line1, hb.textW - hb.pause.w - 20).slice(0, 2);
    l1.forEach((l, i) => ctx.fillText(l, hb.pause.x + hb.pause.w + 20, 30 + (i + 1) * hb.row * 0.8));
    ctx.font = `600 ${Math.round(fs * 0.86)}px ${FONT}`; ctx.fillStyle = '#e6cfa6';
    const l2 = wrapLines(ctx, line2, hb.textW).slice(0, 3);
    const y0 = Math.max(hb.pause.y + hb.pause.h, 30 + 2 * hb.row * 0.8) + 8;
    l2.forEach((l, i) => ctx.fillText(l, hb.textX, y0 + (i + 1) * hb.row * 0.78));
  }
  // round clock bar
  const frac = Math.max(0, 1 - w.t / w.limit);
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(0, hb.bottom + 1, W, 5);
  ctx.fillStyle = frac < 0.2 ? '#ff7a5c' : '#f0c24a'; ctx.fillRect(0, hb.bottom + 1, W * frac, 5);
}
function fit(ctx, text, maxW, size, weight) {
  let px = size; ctx.font = `${weight} ${px}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && px > 14) { px -= 1; ctx.font = `${weight} ${px}px ${FONT}`; }
  return text;
}

// what each bar button shows right now
export function barButtons(state) {
  const m = state.m, w = state.w, st = state.settings, out = {}, sc = textScale(state);
  const mode = m.cfg.mode;
  if (mode === 'watch') {
    out.wpause = { label: state.paused ? 'Resume' : 'Pause', primary: true };
    out.wdec = { label: sc >= 2 ? 'Less' : 'Shorter', disabled: st.thinkIdx === 0 };
    out.winc = { label: sc >= 2 ? 'More' : 'Longer', disabled: st.thinkIdx === 3 };
    out.wexit = { label: sc >= 2 ? 'Stop' : 'Stop watching', dark: true };
    return out;
  }
  const you = state.human >= 0 ? w.agents.find((a) => a.id === state.human) : null;
  if (m.cfg.role === 'taya') {
    out.think = { label: state.thinkBusy ? 'Thinking…' : 'Think', dark: true };
    out.fix = { label: 'Fix can', disabled: w.can.mode === 'up', active: state.auto === 'fix' };
    out.chase = { label: 'Chase', active: state.auto === 'chase', disabled: w.can.mode !== 'up' };
    return out;
  }
  const canT = you && you.hasSlip && you.z <= 0.02 && w.phase === 'play';
  if (sc >= 2) {
    const ids = bigBarIds(state);
    out.sheet = { label: 'Set up' };
    out.throw = { label: 'Throw', primary: true, disabled: !canT || w.can.mode !== 'up' };
    out.fetch = { label: 'Fetch', disabled: !you || you.hasSlip || you.tagged, active: state.auto === 'fetch' };
    out.home = { label: 'Home', disabled: !you || you.z <= 0.02, active: state.auto === 'home' };
    return { ba: out[ids.ba], bb: out[ids.bb] };
  }
  out.lob = { label: 'Lob', active: state.aim.style === 'lob', dark: state.aim.style !== 'lob' };
  out.skim = { label: 'Skim', active: state.aim.style === 'skim', dark: state.aim.style !== 'skim' };
  out.think = { label: state.thinkBusy ? 'Thinking…' : 'Think', dark: true };
  out.throw = { label: 'Throw', primary: true, disabled: !canT || w.can.mode !== 'up' };
  out.fetch = { label: sc >= 2 ? 'Fetch' : 'Fetch slipper', disabled: !you || you.hasSlip || you.tagged, active: state.auto === 'fetch' };
  out.home = { label: sc >= 2 ? 'Home' : 'Run home', disabled: !you || you.z <= 0.02, active: state.auto === 'home' };
  return out;
}
export function drawBar(ctx, state, lay) {
  const b = lay.bar;
  const g = ctx.createLinearGradient(0, b.top - 6, 0, H); g.addColorStop(0, 'rgba(24,12,8,0.55)'); g.addColorStop(0.3, 'rgba(24,12,8,0.88)'); g.addColorStop(1, 'rgba(24,12,8,0.92)');
  ctx.fillStyle = g; ctx.fillRect(0, b.top - 6, W, H - b.top + 6);
  const bt = barButtons(state);
  for (const [id, r] of Object.entries(b.rects)) { const d = bt[id]; if (d) drawButton(ctx, r, d.label, { ...d, size: b.fs }); }
}

export function renderPlay(ctx, state) {
  const lay = layoutFor(state), cam = camFor(state, lay);
  state.cam = { lay };
  ctx.fillStyle = '#14100e'; ctx.fillRect(0, 0, W, H);
  drawScene(ctx, cam, {
    w: state.w, alpha: state.alpha, humanId: state.human, fx: state.fx, aim: state.aim && state.humanTurnAim ? { ...state.aim, show: true } : null,
    guide: state.settings.guide, t: state.t, hintMark: state.hint && state.hint.mark, hlId: state.hl,
  });
  drawHud(ctx, state, lay);
  drawBar(ctx, state, lay);
  drawOverlays(ctx, state, lay, cam);
}

function drawOverlays(ctx, state, lay, cam) {
  const sc = Math.min(textScale(state), 2), w = state.w;
  // toast
  if (state.toastT > 0 && state.toast) {
    const fs = Math.round(24 * sc), maxW = W - 80;
    ctx.save(); ctx.font = `700 ${fs}px ${FONT}`;
    const lines = wrapLines(ctx, state.toast, maxW - 40).slice(0, 4);
    const h = lines.length * fs * 1.25 + 22, y = lay.regionTop + 10;
    const a = Math.min(1, state.toastT * 3);
    ctx.globalAlpha = a; roundPath(ctx, 30, y, W - 60, h, 22); ctx.fillStyle = 'rgba(20,10,6,0.82)'; ctx.fill();
    ctx.fillStyle = '#fff6e6'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 12 + fs * (1 + i * 1.25) - 4));
    ctx.restore();
  }
  // pops
  for (const p of state.fx.pops) {
    const k = p.t / p.max, sp = cam.P(p.x, 1.3 + k * 0.8, p.z);
    ctx.save(); ctx.globalAlpha = 1 - k * k; ctx.font = `800 ${p.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    textShadow(ctx, p.text, sp[0], sp[1], p.col, 6); ctx.restore();
  }
  // Ready... Go!
  if (w.phase === 'play' && w.go > 0 && !state.paused) {
    const fs = Math.round(96 * Math.min(sc, 1.2)), n = w.go > 0.6 ? 'Ready' : 'Go!';
    ctx.save(); ctx.font = `900 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = Math.min(1, w.go * 3);
    textShadow(ctx, n, W / 2, lay.regionTop + (lay.regionBottom - lay.regionTop) * 0.42, '#ffe08a', 14); ctx.restore();
  }
  // The explanation card: the choice in bold, then the reason with its numbers. It shows as much as fits above the control bar
  // and opens in full (Close button) when tapped, so it stays readable at every text size.
  state.cardRect = null;
  const watch = state.m.cfg.mode === 'watch';
  let card = null;
  if (watch && state.card) { const th = state.think; card = { title: th ? th.ex.title : state.card.title, text: state.card.reveal && th ? th.ex.text : th ? `Think first: why is this a good choice? The reason appears in ${Math.max(1, Math.ceil(th.dur - th.t))} s.` : '', accent: state.card.reveal ? '#9dffb8' : '#ffd97a', edge: state.card.reveal ? 'rgba(120,255,190,0.9)' : 'rgba(240,194,74,0.8)', bg: 'rgba(20,10,6,0.9)' }; }
  else if (!watch && state.hint && state.hint.text) card = { title: state.hint.title, text: state.hint.text, accent: '#9dffb8', edge: 'rgba(120,255,190,0.9)', bg: 'rgba(14,34,26,0.93)' };
  if (card) {
    const fs = Math.round(22 * textScale(state));   // what does not fit opens in a scrolling reader when the card is tapped
    ctx.save();
    ctx.font = `800 ${fs}px ${FONT}`;
    const head = wrapLines(ctx, card.title, W - 100).slice(0, 3);
    ctx.font = `400 ${fs}px ${FONT}`;
    const room = Math.max(textScale(state) > 1.5 ? 2 : 3, Math.floor(((lay.regionBottom - lay.regionTop) * (textScale(state) > 1.5 ? 0.4 : 0.46)) / (fs * 1.25)) - head.length);
    const all = card.text ? wrapLines(ctx, card.text, W - 100) : [];
    const maxBody = Math.max(0, Math.min(all.length, room));
    const body = all.slice(0, maxBody);
    const more = all.length > body.length;
    if (more && body.length) { let t = body[body.length - 1].replace(/[ ,.;:]+$/, ''); while (t.length > 4 && ctx.measureText(`${t}… tap for more`).width > W - 100) t = t.slice(0, -1); body[body.length - 1] = `${t}… tap for more`; }
    const h = (head.length + body.length) * fs * 1.25 + 26, y = lay.regionBottom - h - 14;
    roundPath(ctx, 24, y, W - 48, h, 20); ctx.fillStyle = card.bg; ctx.fill();
    ctx.strokeStyle = card.edge; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `800 ${fs}px ${FONT}`; ctx.fillStyle = card.accent;
    head.forEach((l, i) => ctx.fillText(l, 44, y + 14 + fs * (1 + i * 1.25) - 4));
    ctx.font = `400 ${fs}px ${FONT}`; ctx.fillStyle = '#fff6e6';
    body.forEach((l, i) => ctx.fillText(l, 44, y + 14 + fs * (1 + (head.length + i) * 1.25) - 4));
    ctx.restore();
    state.cardRect = { x: 24, y, w: W - 48, h };
    state.cardFull = { title: card.title, text: card.text };
  }
  // thinking-time bar in Watch & Learn
  if (state.think && state.m.cfg.mode === 'watch') {
    const th = state.think, fr = Math.min(1, th.t / th.dur);
    ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(24, lay.regionBottom - 8, W - 48, 6);
    ctx.fillStyle = th.phase === 'think' ? '#f0c24a' : '#7dffb4'; ctx.fillRect(24, lay.regionBottom - 8, (W - 48) * fr, 6);
  }
}

// ---- the attract yard behind the menus -----------------------------------------------------------------------------------------------------
export function drawAttract(ctx, state, top = 300, bottom = 1180) {
  const cam = makeCam({ x: 12, y: top, w: W - 24, h: bottom - top });
  const a = state.att;
  ctx.fillStyle = '#14100e'; ctx.fillRect(0, 0, W, H);
  if (!a) return;
  drawScene(ctx, cam, { w: a.w, alpha: state.alpha, humanId: -1, fx: a.fx, aim: null, guide: 2, t: state.t });
}
