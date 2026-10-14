// Drawing of the play screen and of the lawn behind the menus. Pure drawing of `state` (game.js owns it).
import { W, H, TEXT_SCALES, playLayout, host, bgLayout } from './layout.js';
import { airPoint, flightOf, SK_R, PIN_HL } from './sim.js';
import { makeCam, drawLawn, drawLight, drawStanding, drawLying, drawFlying, DISPLAY, h01 } from './art.js';
import { FONT, roundPath, drawButton, wrapLines, textShadow, woodGrain } from './ui.js';
import { PROFILES, throwName } from './ai.js';
import { GL } from './glbridge.js';

const TAU = Math.PI * 2;
export const BG = '#1b3a2a';

export function layoutOf(state) {
  const m = state.m;
  return playLayout(TEXT_SCALES[state.settings.textIdx], !!m && m.cfg.mode === 'watch', m ? m.n : 2);
}

export const nameOf = (state, i) => (state.m && state.m.players[i] ? state.m.players[i].name : '');

// camera framing: centre and span that keep every standing skittle and everything moving in view. The person stands to the left of the
// bundle's line, so the view is pulled back and tilted enough to hold his upper body in the lower left and the bundle in the middle.
const QD = (() => { try { return new URLSearchParams(globalThis.location.search); } catch { return new URLSearchParams(''); } })();
const devCam = (k) => (QD.has('dev') && QD.has(k) ? QD.get(k).split(',').map(Number) : null);
export function camTarget(sk, extra, wide) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const s of sk) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); }
  for (const e of extra) { x0 = Math.min(x0, e.x); x1 = Math.max(x1, e.x); y0 = Math.min(y0, e.y); y1 = Math.max(y1, e.y); }
  const w = x1 - x0, h = y1 - y0;
  const dc = devCam('cam');
  const A = dc || (wide ? [-10, -70, 260, 700, 0.30] : [-12, -100, 190, 520, 0.36]);
  const span = Math.max(A[2], w * 1.45 + 60);
  const spanY = Math.max(A[3], h * 1.35 + 120);
  return { x: (x0 + x1) / 2 + A[0], y: (y0 + y1) / 2 + A[1] + 100, span: Math.min(span, 420), spanY: Math.min(spanY, 700), pitch: A[4] };
}
// the view while a throw is wound up and in the air: a little further back so the arc and the whole swing fit
export function throwView(wide) {
  const dc = devCam('tcam');
  const A = dc || (wide ? [-10, -110, 290, 740, 0.30] : [-12, -140, 240, 600, 0.34]);
  return { x: A[0], y: A[1], span: A[2], spanY: A[3], pitch: A[4] };
}

function drawParts(ctx, cam, parts) {
  for (const q of parts) {
    const k = 1 - q.t / q.max;
    if (k <= 0) continue;
    const p = cam.p(q.x, q.y, q.z);
    const s = cam.k(q.x, q.y, q.z);
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.4);
    if (q.kind === 0) { ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.2, q.size * s * (0.5 + 0.5 * k)), 0, TAU); ctx.fill(); }
    else if (q.kind === 1) { ctx.strokeStyle = q.col; ctx.lineWidth = 1 + 2.5 * k; ctx.beginPath(); ctx.ellipse(p.x, p.y, q.size * s * (1 - k * k) + 2, (q.size * s * (1 - k * k) + 2) * 0.55, 0, 0, TAU); ctx.stroke(); }
    else {
      ctx.fillStyle = q.col; ctx.translate(p.x, p.y); ctx.rotate(q.t * 7);
      const r = Math.max(2, q.size * s) * (0.4 + 0.6 * k);
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.4 : r, a = (i / 8) * TAU; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// The lawn and everything standing or flying on it. scene: { sk, bodies, flying, rise, parts, cam, aim, hint, t }
export function drawScene(ctx, rect, scene, anchor = 0.6) {
  const cam = makeCam(rect, scene.cam, anchor);
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  // the 3D layer (web/view3d) draws the lawn, the skittles and the pin behind this canvas; the 2D layer keeps guides, rings and text
  if (GL.on) GL.views.push({ cam, S: scene, rect, anchor });
  else drawLawn(ctx, cam, scene.t || 0);
  const items = [];
  const rise = scene.rise || [];
  if (GL.on) { /* drawn in 3D */ } else if (scene.bodies) {
    for (const b of scene.bodies) items.push({ y: b.y, b });
  } else {
    for (const s of scene.sk) {
      const r = rise.find((q) => q.num === s.num);
      items.push({ y: s.y, s, hop: r ? 7 * Math.sin(Math.min(1, r.t / 0.45) * Math.PI) : 0, hot: scene.glow && scene.glow === s.num });
    }
  }
  items.sort((a, b) => b.y - a.y);
  for (const it of items) {
    if (it.b) { if (it.b.st === 0) drawStanding(ctx, cam, it.b, {}); else drawLying(ctx, cam, it.b); }
    else drawStanding(ctx, cam, it.s, { hop: it.hop, hot: it.hot });
  }
  // aim preview: arc and landing ring
  const path = (pts, col, dash, w) => {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.setLineDash(dash);
    ctx.beginPath(); let first = true;
    for (const q of pts) { const p = cam.p(q.x, q.y, q.z); if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y); }
    ctx.stroke(); ctx.restore();
  };
  const ring = (c, col, fill) => {
    const pts = [];
    for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; pts.push(cam.p(c.x + Math.cos(a) * c.rx, c.y + Math.sin(a) * c.ry, 0)); }
    ctx.save(); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 5.5; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
    const m = cam.p(c.x, c.y, 0); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(m.x, m.y, 3.4, 0, TAU); ctx.fill(); ctx.restore();
  };
  const arc = (spec) => {
    const f = flightOf(spec), out = [];
    for (let i = 0; i <= 26; i++) out.push(airPoint(spec, f, f.tl * i / 26));
    return out;
  };
  if (scene.hint) {
    path(arc(scene.hint.spec), 'rgba(255,205,70,0.95)', [3, 6], 2.4);
    ring({ x: scene.hint.tx, y: scene.hint.ty, rx: 5, ry: 5 }, 'rgba(255,205,70,0.98)', 'rgba(255,205,70,0.18)');
  }
  if (scene.aim && scene.aim.spec) {
    path(arc(scene.aim.spec), 'rgba(255,255,255,0.92)', [2, 7], 2);
    ring({ x: scene.aim.x, y: scene.aim.y, rx: scene.aim.rx, ry: scene.aim.ry }, scene.aim.steady > 0.85 ? 'rgba(255,214,90,1)' : 'rgba(255,255,255,0.95)', 'rgba(255,255,255,0.22)');
  }
  // the pin in the air
  if (scene.flying && !GL.on) {
    const fl = scene.flying;
    if (fl.trail) path(fl.trail, 'rgba(255,248,224,0.4)', [], 2);
    drawFlying(ctx, cam, fl.P, fl.axis, fl.spin);
  }
  if (!GL.on) { drawParts(ctx, cam, scene.parts || []); drawLight(ctx, rect, scene.t || 0); }
  ctx.restore();
  return cam;
}

// the lawn behind the menus (full screen, slowly drifting attract throws)
export function drawBackdrop(ctx, state) {
  if (!GL.on) { ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); }
  const L = bgLayout();
  const sc = state.att.scene;
  drawScene(ctx, L.field, sc, W > H ? 0.74 : 0.34);
}

// ---- HUD --------------------------------------------------------------------------------------------------------------
function dots(ctx, x, y, n, of, r) {
  for (let i = 0; i < of; i++) {
    ctx.beginPath(); ctx.arc(x + i * (r * 2.8), y, r, 0, TAU);
    ctx.fillStyle = i < n ? '#e0533a' : 'rgba(255,255,255,0.28)'; ctx.fill();
  }
}
function card(ctx, r, p, m, active, fs, state) {
  roundPath(ctx, r.x, r.y + 7, r.w, r.h, 15); ctx.fillStyle = 'rgba(4,14,30,0.4)'; ctx.fill();
  roundPath(ctx, r.x, r.y + 4, r.w, r.h, 15); ctx.fillStyle = active ? '#6b4a10' : '#0c1a2c'; ctx.fill();
  roundPath(ctx, r.x, r.y, r.w, r.h, 15);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, active ? '#3f78b0' : '#2a4766'); g.addColorStop(1, active ? '#1f4a7a' : '#16293f');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip(); woodGrain(ctx, r.x, r.y, r.w, r.h, 'rgba(255,255,255,0.07)', 6);
  const lg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.45); lg.addColorStop(0, 'rgba(255,255,255,0.22)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = lg; ctx.fillRect(r.x, r.y, r.w, r.h * 0.45); ctx.restore();
  roundPath(ctx, r.x, r.y, r.w, r.h, 15); ctx.lineWidth = active ? 3.5 : 2; ctx.strokeStyle = active ? '#ffd97a' : 'rgba(190,215,240,0.45)'; ctx.stroke();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = p.out ? 'rgba(255,255,255,0.45)' : '#fff6e2';
  const maxName = r.w - fs.score * 1.35 - 22;
  let nf = fs.name; ctx.font = `700 ${nf}px ${FONT}`;
  while (ctx.measureText(p.name).width > maxName && nf > 13) { nf -= 1; ctx.font = `700 ${nf}px ${FONT}`; }
  ctx.fillText(p.name, r.x + 12, r.y + 8 + fs.name * 0.9);
  // score
  ctx.textAlign = 'right'; ctx.font = `600 ${fs.score}px ${DISPLAY}`; ctx.fillStyle = p.out ? 'rgba(255,217,122,0.4)' : '#ffd97a';
  ctx.fillText(p.out ? 'OUT' : String(p.score), r.x + r.w - 12, r.y + 8 + fs.score * 0.86);
  // progress bar 0 .. target with the drop-back notch
  const bx = r.x + 12, bw = r.w - 24 - fs.score * 0.2, by = r.y + r.h - 18, bh = 9;
  roundPath(ctx, bx, by, bw, bh, 4.5); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
  const k = Math.max(0, Math.min(1, p.score / m.target));
  if (k > 0) { roundPath(ctx, bx, by, Math.max(bh, bw * k), bh, 4.5); ctx.fillStyle = k > 0.8 ? '#ffb347' : '#5ec2ff'; ctx.fill(); }
  // notch at the drop-back value and a flag at the end
  const nx = bx + bw * (m.back / m.target);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(nx - 1, by - 3, 2, bh + 6);
  ctx.fillStyle = '#ffd97a'; ctx.fillRect(bx + bw - 2, by - 5, 3, bh + 10);
  // misses
  if (!p.out) dots(ctx, r.x + 14, r.y + 8 + fs.name * 1.38 + 5, p.misses, 3, Math.max(4, fs.sub * 0.28));
  if (state && p.ai >= 0 && false) void 0;
}

export function infoLines(ctx, text, w) { return wrapLines(ctx, text, w); }

export function renderPlay(ctx, state) {
  const m = state.m, L = layoutOf(state), fs = L.fs;
  if (!GL.on) { ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); }
  const sc = sceneOf(state);
  const cam = drawScene(ctx, L.field, sc, L.land ? 0.58 : 0.6);
  state.camPx = { f: cam.f };
  // score cards
  m.players.forEach((p, i) => card(ctx, L.cards[i], p, m, m.turn === i && !m.over, fs, state));
  // info line
  const I = L.info;
  roundPath(ctx, I.x, I.y, I.w, I.h, 12); ctx.fillStyle = 'rgba(6,16,32,0.55)'; ctx.fill();
  ctx.fillStyle = '#fff1d0'; ctx.font = `600 ${fs.info}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const lines = wrapLines(ctx, state.info || '', I.w - 16);
  const maxL = Math.max(1, Math.floor((I.h - 6) / (fs.info * 1.18)));
  lines.slice(0, maxL).forEach((l, i) => ctx.fillText(l, I.x + I.w / 2, I.y + 4 + fs.info * (0.98 + i * 1.18)));
  // buttons
  if (L.btns) {
    const human = state.humanTurn && !state.act && !m.over;
    drawButton(ctx, L.btns.hint, state.hintBusy ? 'Thinking…' : 'Hint', { size: fs.btn, disabled: !human || state.hintBusy });
    drawButton(ctx, L.btns.card, 'Scorecard', { size: fs.btn, dark: true });
    drawButton(ctx, L.btns.menu, 'Menu', { size: fs.btn, dark: true });
  }
  if (L.demo) {
    const D = L.demo;
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: Math.min(fs.btn, 30) });
    drawButton(ctx, D.dec, 'Think −', { size: Math.min(fs.btn, 26), disabled: state.settings.thinkIdx === 0 });
    drawButton(ctx, D.inc, 'Think +', { size: Math.min(fs.btn, 26), disabled: state.settings.thinkIdx === 3 });
    drawButton(ctx, D.exit, 'Leave Watch & Learn', { size: Math.min(fs.btn, 26), dark: true });
  }
  // the style switches (only while a person is choosing)
  if (state.humanTurn && !state.act && !m.over && !state.pass && !L.demo) {
    const s = state.aimSet;
    drawButton(ctx, L.tg.style, s.style === 0 ? 'Lob: high arc' : 'Skim: low and fast', { size: Math.min(fs.btn * 0.82, 26), dark: true });
    drawButton(ctx, L.tg.spin, s.flat ? 'Flat spin: wide' : 'End over end: narrow', { size: Math.min(fs.btn * 0.82, 26), dark: true });
    // pull hint when idle
    if (!state.pull) {
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fy = L.field.y + L.field.h - L.tg.style.h - 34;
      ctx.font = `700 ${Math.round(Math.min(fs.info, 26))}px ${FONT}`;
      const msg = 'Pull back on the lawn, then let go';
      const tw = ctx.measureText(msg).width + 30, cx = L.field.x + L.field.w / 2;
      roundPath(ctx, cx - tw / 2, fy - 20, tw, 40, 20); ctx.fillStyle = 'rgba(6,16,32,0.6)'; ctx.fill();
      ctx.fillStyle = '#fff1d0'; ctx.fillText(msg, cx, fy + 1);
      ctx.restore();
    }
  }
  // the pull handle
  if (state.pull) {
    const pu = state.pull;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(pu.x0, pu.y0, 20, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.moveTo(pu.x0, pu.y0); ctx.lineTo(pu.x, pu.y); ctx.stroke(); ctx.setLineDash([]);
    const power = Math.max(0, Math.min(1, (pu.v - 260) / 740));
    ctx.fillStyle = `rgba(255,${Math.round(230 - 120 * power)},90,0.95)`; ctx.beginPath(); ctx.arc(pu.x, pu.y, 15, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // world-anchored pop texts
  for (const p of state.pops) {
    const q = cam.p(p.x, p.y, 20), k = p.t / p.max;
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(p.size * (1 + 0.25 * Math.min(1, k * 6)))}px ${DISPLAY}`;
    textShadow(ctx, p.text, q.x, q.y - 60 * k, p.col, 8);
    ctx.restore();
  }
  // toast
  if (state.toastT > 0 && state.toast) {
    ctx.save();
    const tf = Math.min(Math.round(fs.info), 30);
    ctx.font = `700 ${tf}px ${FONT}`;
    const tl = wrapLines(ctx, state.toast, Math.min(L.field.w - 40, 640));
    const tw = Math.max(...tl.map((l) => ctx.measureText(l).width)) + 36, th = tl.length * tf * 1.25 + 18;
    const ty = L.field.y + 14;
    roundPath(ctx, L.field.x + L.field.w / 2 - tw / 2, ty, tw, th, 16); ctx.fillStyle = 'rgba(6,16,32,0.82)'; ctx.fill();
    ctx.strokeStyle = 'rgba(180,210,240,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff6e2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    tl.forEach((l, i) => ctx.fillText(l, L.field.x + L.field.w / 2, ty + 9 + (i + 0.5) * tf * 1.25));
    ctx.restore();
  }
  // pass-the-phone card
  if (state.pass) {
    ctx.fillStyle = 'rgba(4,12,26,0.8)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const z = Math.min(1.3, TEXT_SCALES[state.settings.textIdx]);
    ctx.font = `600 ${Math.round(54 * z)}px ${DISPLAY}`;
    textShadow(ctx, nameOf(state, m.turn), W / 2, H / 2 - 20, '#ffd97a', 8);
    ctx.font = `600 ${Math.round(28 * Math.min(1.5, TEXT_SCALES[state.settings.textIdx]))}px ${FONT}`; ctx.fillStyle = '#fff3d8';
    const p = m.players[m.turn];
    wrapLines(ctx, `Hand over the phone. ${p.name} needs ${m.target - p.score} for exactly ${m.target}. Tap to throw.`, W - 120).forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + 30 + i * 38));
  }
}

// What the lawn shows right now.
export function sceneOf(state) {
  const a = state.act;
  const sc = { sk: state.sk, cam: state.cam, parts: state.parts, rise: state.rise, t: state.t, hint: state.hint, aim: state.humanTurn && !state.act ? state.aim : null, glow: state.glow };
  if (a) {
    const th = a.th;
    if (th.air) {
      const P = airPoint(th.spec, th.f, th.t);
      const f = th.f, tt = th.t - th.tl;
      let ax;
      if (th.spec.flat) { const yaw = th.spec.yaw + (th.spec.spinDir || 1) * 14 * tt; ax = { x: Math.cos(yaw), y: Math.sin(yaw), z: 0.12 }; }
      else { const ph = -9 * tt; ax = { x: f.sx * Math.cos(ph), y: f.sy * Math.cos(ph), z: Math.sin(ph) }; }
      sc.sk = null; sc.bodies = th.bodies; sc.flying = { P, axis: ax, spin: 0, trail: a.trail };
      sc.bodies = th.bodies;
    } else sc.bodies = th.bodies;
  }
  return sc;
}
void PROFILES; void throwName; void SK_R; void PIN_HL; void host; void h01;
