// The play screen: score cards, the scope (first-person view down the lane), the whole-course strip, the power gauge and the controls.
// Pure drawing from `state` and the layout; game.js owns the state.
import { FAR_R, RING_R, DISC_R, STAKE_R } from './sim.js';
import { makeScope, drawSky, drawLane, drawStake, drawRock, drawPalm, drawDisc, discIcon, SIDE } from './art.js';
import { FONT, DISPLAY, C, roundPath, drawButton, paintButton, wrapLines, textShadow, wood } from './ui.js';
import { gl } from './glhook.js';

const TAU = Math.PI * 2;
const clipRect = (ctx, r, rad = 20) => { roundPath(ctx, r.x, r.y, r.w, r.h, rad); ctx.clip(); };

// Where the palms stand (fixed for a course): around the far bank and along the sides, outside the lane.
export function palmSpots(track) {
  const out = [], h = track.half;
  for (let i = 0; i < 4; i++) out.push({ x: -h - 2.2 - (i % 2) * 1.4, y: 6 + i * (track.len / 4), h: 4.6 + (i % 3) * 0.5, lean: 0.4 });
  for (let i = 0; i < 4; i++) out.push({ x: h + 2.4 + (i % 2) * 1.2, y: 10 + i * (track.len / 4.5), h: 4.4 + (i % 2) * 0.7, lean: -0.35 });
  out.push({ x: -2.6, y: track.len + 4.6, h: 5.2, lean: 0.3 }, { x: 3.2, y: track.len + 5.2, h: 4.8, lean: -0.3 }, { x: 0.3, y: track.len + 6.4, h: 5.6, lean: 0.1 });
  return out;
}

// One full scope picture into `rect`: scenery, lane, standing things, discs, preview path and particles.
// scene = { track, cam, t, rests: [{x,y,side}], roll: {s,side}|null, held: {x,y,side}|null, preview, parts, pathTrace }
export function drawScope(ctx, rect, scene, o = {}) {
  const V = makeScope(rect, scene.cam), { track } = scene;
  if (gl.active && !o.force2d) {
    // the WebGL scene shows through a window in the kit canvas; the carved koa frame goes over its edge
    ctx.save();
    roundPath(ctx, rect.x, rect.y, rect.w, rect.h, o.radius ?? 20); ctx.clip(); ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
    if (!o.noClip) {
      ctx.save();
      roundPath(ctx, rect.x - 7, rect.y - 7, rect.w + 14, rect.h + 14, (o.radius ?? 20) + 7);
      roundPath(ctx, rect.x, rect.y, rect.w, rect.h, o.radius ?? 20, true);
      ctx.fillStyle = '#5a2e16'; ctx.fill('evenodd');
      ctx.lineWidth = 2; ctx.strokeStyle = '#e6b855'; roundPath(ctx, rect.x - 1, rect.y - 1, rect.w + 2, rect.h + 2, (o.radius ?? 20) + 1); ctx.stroke();
      ctx.strokeStyle = 'rgba(10,4,0,0.8)'; roundPath(ctx, rect.x - 7, rect.y - 7, rect.w + 14, rect.h + 14, (o.radius ?? 20) + 7); ctx.stroke();
      ctx.restore();
    }
    return V;
  }
  ctx.save();
  if (!o.noClip) clipRect(ctx, rect, o.radius ?? 20);
  ctx.fillStyle = '#7fb8da'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  drawSky(ctx, V, scene.t);
  drawLane(ctx, V, track, scene.t);
  // preview path on the ground
  const pv = scene.preview;
  if (pv && pv.path.length > 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    const n = pv.path.length;
    for (let i = 1; i < n; i++) {
      const p = V.pt(pv.path[i].x, pv.path[i].y);
      if (!p) continue;
      ctx.globalAlpha = pv.faint ? 0.42 : 0.95;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.6, Math.min(5, p.s * 0.035)), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const e = pv.path[n - 1], rp = V.pt(e.x, e.y);
    if (rp) {
      ctx.strokeStyle = pv.faint ? 'rgba(255,255,255,0.5)' : '#fff'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.ellipse(rp.x, rp.y, Math.max(7, DISC_R * rp.s * 1.2), Math.max(4, DISC_R * rp.s * 0.5), 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // the trace of the roll in flight
  if (scene.pathTrace && scene.pathTrace.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); let started = false;
    for (const q of scene.pathTrace) { const p = V.pt(q.x, q.y); if (!p) { started = false; continue; } if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y); }
    ctx.stroke();
  }
  // standing things, far to near
  const items = [];
  for (const p of palmSpots(track)) items.push({ d: V.depth(p.x, p.y), f: () => drawPalm(ctx, V, p.x, p.y, p.h, scene.t, p.lean) });
  for (const g of track.gates) {
    for (const sx of [g.x - g.w / 2 - STAKE_R, g.x + g.w / 2 + STAKE_R]) items.push({ d: V.depth(sx, g.y), f: () => drawStake(ctx, V, sx, g.y, 0.95, STAKE_R) });
  }
  for (const r of track.rocks) items.push({ d: V.depth(r.x, r.y), f: () => drawRock(ctx, V, r.x, r.y, r.r) });
  items.push({ d: V.depth(track.far.x, track.far.y), f: () => drawStake(ctx, V, track.far.x, track.far.y, 1.25, FAR_R, { far: true, t: scene.t }) });
  for (const d of scene.rests || []) items.push({ d: V.depth(d.x, d.y), f: () => drawDisc(ctx, V, d.x, d.y, d.side, { face: 0.55, alpha: d.out ? 0.45 : 1, spin: d.spin || 0 }) });
  if (scene.roll) {
    const s = scene.roll.s, sp = Math.hypot(s.vx, s.vy) || 1, vx = s.rest ? 0 : s.vx / sp, vy = s.rest ? 1 : s.vy / sp;
    const sn = Math.sin(scene.cam.yaw), cs = Math.cos(scene.cam.yaw);
    const lat = Math.abs(vx * cs - vy * sn);
    items.push({ d: V.depth(s.x, s.y), f: () => drawDisc(ctx, V, s.x, s.y, scene.roll.side, { face: Math.max(0.3, lat), spin: (s.y * 3 + s.x) / DISC_R * 0.1, alpha: s.out ? 0.5 : 1 }) });
  }
  if (scene.held) items.push({ d: V.depth(scene.held.x, scene.held.y) - 0.01, f: () => drawDisc(ctx, V, scene.held.x, scene.held.y, scene.held.side, { face: 0.62, spin: 0.6 }) });
  items.sort((a, b) => b.d - a.d);
  for (const it of items) if (it.d > 0.2) it.f();
  // particles
  for (const q of scene.parts || []) {
    const p = V.pt(q.x, q.y, q.z), a = Math.max(0, 1 - q.t / q.max);
    if (!p) continue;
    ctx.fillStyle = q.kind === 1 ? `rgba(255,244,200,${a})` : `rgba(${q.col || '120,90,50'},${a * 0.7})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, p.s * q.size * 0.03 * (q.kind === 1 ? 1 : 1 + q.t * 2)), 0, TAU); ctx.fill();
  }
  ctx.restore();
  if (!o.noClip) { ctx.save(); roundPath(ctx, rect.x, rect.y, rect.w, rect.h, o.radius ?? 20); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.stroke(); ctx.restore(); }
  return V;
}

// ---- the strip: the whole course from above, true to scale --------------------------------------------------------------------------
export function stripGeom(rect, track) {
  const padX = 22, padY = 22;
  const k = Math.min((rect.w - 2 * padX) / (track.len + 3), (rect.h - 2 * padY) / (2 * track.half + 0.6));
  const x0 = rect.x + (rect.w - k * (track.len + 3)) / 2 + k * 0.6, cy = rect.y + rect.h / 2 + 3;
  return { k, X: (y) => x0 + y * k, Y: (x) => cy + x * k, x0, cy };
}

export function drawStrip(ctx, rect, scene) {
  const { track } = scene, G = stripGeom(rect, track);
  wood(ctx, rect.x, rect.y, rect.w, rect.h, { r: 18, tone: 'dark', brass: true });
  ctx.save(); clipRect(ctx, { x: rect.x + 7, y: rect.y + 7, w: rect.w - 14, h: rect.h - 14 }, 12);
  ctx.fillStyle = '#1d5a36'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  const lane = { x: G.X(-0.4), y: G.Y(-track.half), w: (track.len + 2.6) * G.k, h: 2 * track.half * G.k };
  const gg = ctx.createLinearGradient(0, lane.y, 0, lane.y + lane.h);
  gg.addColorStop(0, '#79c96c'); gg.addColorStop(1, '#5fb55a');
  ctx.fillStyle = gg; ctx.fillRect(lane.x, lane.y, lane.w, lane.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.strokeRect(lane.x, lane.y, lane.w, lane.h);
  // distance ticks
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = `600 ${Math.round(Math.max(11, Math.min(15, G.k * 0.5)))}px ${FONT}`; ctx.textAlign = 'center';
  for (let y = 5; y <= track.len; y += 5) { ctx.fillRect(G.X(y) - 0.75, lane.y + lane.h - 5, 1.5, 5); ctx.fillText(`${y}`, G.X(y), lane.y + lane.h - 8); }
  for (const m of track.mud) { ctx.fillStyle = 'rgba(96,64,34,0.85)'; ctx.fillRect(G.X(m.y0), G.Y(m.x0), (m.y1 - m.y0) * G.k, (m.x1 - m.x0) * G.k); }
  for (const s of track.slopes) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    const dir = s.a > 0 ? 1 : -1;
    for (let y = s.y0 + 1; y < s.y1; y += 3) { const px = G.X(y), py = G.Y(0); ctx.beginPath(); ctx.moveTo(px, py - dir * 7); ctx.lineTo(px, py + dir * 7); ctx.moveTo(px - 4, py + dir * 3); ctx.lineTo(px, py + dir * 8); ctx.lineTo(px + 4, py + dir * 3); ctx.stroke(); }
  }
  // far ring and stake
  const f = track.far;
  ctx.beginPath(); ctx.arc(G.X(f.y), G.Y(f.x), RING_R * G.k, 0, TAU); ctx.fillStyle = 'rgba(255,214,96,0.25)'; ctx.fill(); ctx.strokeStyle = '#ffe07a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#e23a5c'; ctx.beginPath(); ctx.arc(G.X(f.y), G.Y(f.x), Math.max(4, FAR_R * G.k * 1.2), 0, TAU); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  for (const g of track.gates) {
    ctx.strokeStyle = 'rgba(255,230,140,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(G.X(g.y), G.Y(g.x - g.w / 2)); ctx.lineTo(G.X(g.y), G.Y(g.x + g.w / 2)); ctx.stroke(); ctx.setLineDash([]);
    for (const sx of [g.x - g.w / 2 - STAKE_R, g.x + g.w / 2 + STAKE_R]) { ctx.fillStyle = '#14b3a7'; ctx.beginPath(); ctx.arc(G.X(g.y), G.Y(sx), Math.max(3.2, STAKE_R * G.k * 1.3), 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke(); }
  }
  for (const r of track.rocks) { ctx.fillStyle = '#3a4048'; ctx.beginPath(); ctx.arc(G.X(r.y), G.Y(r.x), r.r * G.k, 0, TAU); ctx.fill(); ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 1.5; ctx.stroke(); }
  // preview, trace, rests and the disc
  const pv = scene.preview;
  if (pv && pv.path.length > 1) {
    ctx.save(); ctx.setLineDash([2, 5]); ctx.lineCap = 'round'; ctx.strokeStyle = pv.faint ? 'rgba(255,255,255,0.5)' : '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); pv.path.forEach((p, i) => (i ? ctx.lineTo(G.X(p.y), G.Y(p.x)) : ctx.moveTo(G.X(p.y), G.Y(p.x)))); ctx.stroke(); ctx.restore();
    const e = pv.path[pv.path.length - 1];
    ctx.beginPath(); ctx.arc(G.X(e.y), G.Y(e.x), 7, 0, TAU); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
  }
  if (scene.pathTrace && scene.pathTrace.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); scene.pathTrace.forEach((p, i) => (i ? ctx.lineTo(G.X(p.y), G.Y(p.x)) : ctx.moveTo(G.X(p.y), G.Y(p.x)))); ctx.stroke();
  }
  const dot = (x, y, side, a = 1) => {
    const S = SIDE[side] || SIDE[0];
    ctx.globalAlpha = a; ctx.fillStyle = S.base; ctx.beginPath(); ctx.arc(G.X(y), G.Y(x), Math.max(5, DISC_R * G.k * 1.6), 0, TAU); ctx.fill();
    ctx.strokeStyle = S.band; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
  };
  for (const d of scene.rests || []) dot(d.x, d.y, d.side, d.out ? 0.4 : 1);
  if (scene.roll) dot(scene.roll.s.x, scene.roll.s.y, scene.roll.side);
  else if (scene.held) dot(scene.held.x, scene.held.y, scene.held.side);
  ctx.restore();
}

// ---- header -----------------------------------------------------------------------------------------------------------------------
function scoreCard(ctx, r, side, state) {
  const m = state.m, solo = m.sides === 1;
  const active = (m.phase === 'aim' || m.phase === 'roll') && m.turn === side;
  ctx.save();
  wood(ctx, r.x, r.y, r.w, r.h, { r: 18, tone: active ? 'warm' : 'mid', brass: active, teeth: true });
  if (active) { roundPath(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 20); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,214,110,0.9)'; ctx.stroke(); }
  discIcon(ctx, r.x + 32, r.y + 33, 18, side, 0.9);
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(10,4,0,0.7)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 21px ${FONT}`; ctx.textAlign = 'left';
  let nm = (solo && side === 1 ? 'Best' : state.labels[side].name);
  while (ctx.measureText(nm).width > r.w - 132 && nm.length > 4) nm = nm.slice(0, -1);
  ctx.fillText(nm, r.x + 60, r.y + 30);
  ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,208,0.78)';
  const sub = solo && side === 1 ? 'on this course' : active ? 'rolling' : m.cfg.lead % 2 === side && m.sides === 2 && m.no === 1 ? 'rolls first' : ' ';
  ctx.fillText(sub, r.x + 60, r.y + 52);
  ctx.font = `700 46px ${DISPLAY}`; ctx.textAlign = 'right'; ctx.fillStyle = '#ffd27a';
  ctx.fillText(String(solo && side === 1 ? state.record.best[state.track.id] | 0 : m.scores[side]), r.x + r.w - 14, r.y + 48);
  ctx.shadowColor = 'transparent';
  // discs still to roll
  const total = m.cfg.rolls, left = Math.max(0, total - m.rolls[side] - (m.phase === 'roll' && m.turn === side ? 1 : 0));
  if (!(solo && side === 1)) for (let i = 0; i < total; i++) {
    const px = r.x + 18 + i * 17, py = r.y + r.h - 16;
    ctx.fillStyle = i < left ? SIDE[side].base : 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = i < left ? SIDE[side].band : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.4; ctx.stroke();
  }
  ctx.restore();
}

function infoBlock(ctx, P, state) {
  const m = state.m;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 22px ${FONT}`;
  const n = Math.min(m.rolls[Math.min(m.turn, 1)] + 1, m.cfg.rolls + m.sudden);
  textShadow(ctx, m.sudden ? 'Sudden death' : m.sides === 1 ? `Disc ${Math.min(m.cfg.rolls, m.rolls[0] + 1)} of ${m.cfg.rolls}` : `Roll ${n} of ${m.cfg.rolls}`, P.info.x, P.info.y, '#fff6e4', 4);
  ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.8)';
  textShadow(ctx, state.track.name, P.info.x, P.info.y2, 'rgba(255,246,228,0.85)', 4);
  ctx.restore();
}

// ---- gauge, controls ------------------------------------------------------------------------------------------------------------
function drawGauge(ctx, g, state) {
  const power = state.hold.on ? state.hold.power : state.preview && !state.preview.faint ? state.preview.power : 0, last = state.lastPower;
  ctx.save();
  wood(ctx, g.x - 6, g.y - 24, g.w + 12, g.h + 48, { r: 14, tone: 'dark', brass: true, shadow: true, alpha: 0.96 });
  roundPath(ctx, g.x, g.y, g.w, g.h, g.w / 2); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
  const fh = Math.max(0, g.h * power);
  if (fh > 1) {
    ctx.save(); roundPath(ctx, g.x, g.y, g.w, g.h, g.w / 2); ctx.clip();
    const gr = ctx.createLinearGradient(0, g.y + g.h, 0, g.y);
    gr.addColorStop(0, '#14b3a7'); gr.addColorStop(0.6, '#ffc857'); gr.addColorStop(1, '#ff6a4d');
    ctx.fillStyle = gr; ctx.fillRect(g.x, g.y + g.h - fh, g.w, fh); ctx.restore();
  }
  // ticks: the power that just reaches each gate and the far stake
  ctx.font = `700 15px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (const t of state.ticks) {
    const y = g.y + g.h * (1 - t.p);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(g.x - 8, y); ctx.lineTo(g.x + g.w + 4, y); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(t.label, g.x - 12, y);
  }
  if (last > 0.02 && !state.hold.on) {
    const y = g.y + g.h * (1 - last);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.moveTo(g.x + g.w + 4, y); ctx.lineTo(g.x + g.w + 14, y - 6); ctx.lineTo(g.x + g.w + 14, y + 6); ctx.closePath(); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `700 13px ${FONT}`; ctx.fillStyle = '#fff6e4'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('POWER', g.x + g.w / 2, g.y - 7);
  ctx.fillText(`${Math.round(power * 100)}`, g.x + g.w / 2, g.y + g.h + 17);
  ctx.restore();
}

function drawLeanRow(ctx, P, state) {
  const lean = state.aim.lean, can = state.humanTurn && !state.paused && !state.hold.on;
  drawButton(ctx, P.leanDec, 'Lean ◀', { disabled: !can || lean <= -2, size: 26 });
  drawButton(ctx, P.leanInc, 'Lean ▶', { disabled: !can || lean >= 2, size: 26 });
  const r = P.leanShow;
  ctx.save();
  wood(ctx, r.x, r.y, r.w, r.h, { r: 16, tone: 'dark', brass: true });
  // a little dial: a curved arrow showing the bow of the roll
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  ctx.strokeStyle = '#ffc857'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  const label = lean === 0 ? 'Straight' : lean < 0 ? `Left ${-lean}` : `Right ${lean}`;
  ctx.font = `700 22px ${FONT}`;
  const icon = r.w > ctx.measureText(label).width + 120;
  if (icon) { const ix = r.x + 34; ctx.beginPath(); ctx.moveTo(ix - 12, cy + r.h * 0.26); ctx.quadraticCurveTo(ix - 12 + lean * 20, cy, ix - 12 + lean * 6 + 20, cy - r.h * 0.26); ctx.stroke(); }
  ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, icon ? cx + 18 : cx, cy);
  ctx.restore();
}

function drawPad(ctx, P, state) {
  const r = P.pad, on = state.hold.on, can = state.humanTurn && !state.paused;
  paintButton(ctx, r, { primary: can, disabled: false, dark: !can });
  ctx.save();
  roundPath(ctx, r.x, r.y + (on ? 3 : 0), r.w, r.h, 18); ctx.clip();
  if (on) {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(r.x, r.y + r.h * (1 - state.hold.power) + 3, r.w, r.h * state.hold.power);
  }
  ctx.restore();
  ctx.save();
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2 + (on ? 3 : 0);
  const rr = Math.min(r.h * 0.3, 44);
  if (r.w > r.h * 1.6) {
    discIcon(ctx, r.x + r.h * 0.62, cy, rr, state.m.turn === 1 ? 1 : 0, 0.9);
    ctx.fillStyle = can ? '#fff3d6' : 'rgba(236,224,200,0.6)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(Math.min(40, r.h * 0.3))}px ${FONT}`; ctx.fillText('ROLL', r.x + r.h * 1.05, cy - r.h * 0.12);
    ctx.font = `400 ${Math.round(Math.min(22, r.h * 0.17))}px ${FONT}`; ctx.fillText(on ? `power ${Math.round(state.hold.power * 100)}%` : 'press, swipe up, let go', r.x + r.h * 1.05, cy + r.h * 0.2);
  } else {
    discIcon(ctx, cx, cy - r.h * 0.12, rr, state.m.turn === 1 ? 1 : 0, 0.9);
    ctx.fillStyle = can ? '#fff3d6' : 'rgba(236,224,200,0.6)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 34px ${FONT}`; ctx.fillText('ROLL', cx, cy + r.h * 0.2);
    ctx.font = `400 21px ${FONT}`; ctx.fillText(on ? `power ${Math.round(state.hold.power * 100)}%` : 'press, swipe up, let go', cx, cy + r.h * 0.34);
  }
  ctx.restore();
}

function drawDemoControls(ctx, P, state) {
  drawButton(ctx, P.demo.dec, 'Think −', { size: 24 });
  drawButton(ctx, P.demo.inc, 'Think +', { size: 24 });
  drawButton(ctx, P.demo.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: 30 });
  drawButton(ctx, P.demo.exit, 'Exit', { dark: true, size: 26 });
}

// breakdown lines of a roll, for the result panel
export function breakdown(track, res) {
  const lines = [];
  res.gs.forEach((g, i) => {
    const n = track.gates.length > 1 ? ` ${i + 1}` : '';
    if (g === 1) lines.push([`Gate${n} passed clean`, '+2']);
    else if (g === 2) lines.push([`Gate${n}: touched a stake`, '0']);
    else if (g === 3) lines.push([`Gate${n}: missed`, '0']);
    else lines.push([`Gate${n}: not reached`, '0']);
  });
  if (res.hit) lines.push([res.allGates ? 'Hit the far stake' : 'Hit the far stake (gate missed)', `+${res.stake}`]);
  else lines.push(['Far stake: no hit', '0']);
  if (res.inRing) lines.push(['Rested in the ring', '+1']);
  else if (res.out) lines.push([res.outWhy === 'end' ? 'Rolled past the end: out' : 'Left the lane: out', '0']);
  else lines.push(['Not in the ring', '0']);
  return lines;
}

function resultPanel(ctx, P, state) {
  const m = state.m, res = m.last;
  if (!res) return;
  const lines = breakdown(state.track, res), t = m.phaseT || 0;
  const w = Math.min(430, P.scope.w - 50), rowH = 36, h = 92 + lines.length * rowH + 20;
  const x = P.scope.x + (P.scope.w - w) / 2, y = P.scope.y + Math.max(10, P.scope.h - h - 18);
  const k = Math.min(1, t / 0.22), e = 1 - Math.pow(1 - k, 3);
  ctx.save(); ctx.globalAlpha = e; ctx.translate(0, (1 - e) * 24);
  wood(ctx, x, y, w, h, { r: 22, tone: 'dark', brass: true });
  roundPath(ctx, x + 10, y + 10, w - 20, h - 20, 14); { const gg = ctx.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, '#fbf1d6'); gg.addColorStop(1, '#efe0b6'); ctx.fillStyle = gg; ctx.fill(); }
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.coralDark; ctx.font = `700 28px ${FONT}`; ctx.textAlign = 'center';
  const who = state.labels[res.side].name;
  ctx.fillText(res.points > 0 ? `${who}: ${res.points} ${res.points === 1 ? 'point' : 'points'}` : `${who}: no score`, x + w / 2, y + 42);
  ctx.strokeStyle = 'rgba(20,80,100,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 24, y + 56); ctx.lineTo(x + w - 24, y + 56); ctx.stroke();
  ctx.font = `500 22px ${FONT}`;
  lines.forEach(([a, b], i) => {
    const yy = y + 62 + (i + 0.72) * rowH;
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.fillText(a, x + 26, yy);
    ctx.textAlign = 'right'; ctx.fillStyle = b.startsWith('+') ? '#0b7a45' : 'rgba(20,48,60,0.55)'; ctx.font = `700 24px ${FONT}`; ctx.fillText(b, x + w - 26, yy); ctx.font = `500 22px ${FONT}`;
  });
  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(20,48,60,0.7)'; ctx.font = `400 19px ${FONT}`;
  ctx.fillText(m.over ? 'tap to see the result' : 'tap to continue', x + w / 2, y + h - 16);
  ctx.restore();
}

function toastPill(ctx, P, state) {
  if (state.toastT <= 0 || !state.toast) return;
  const a = Math.min(1, state.toastT / 0.35);
  ctx.save(); ctx.globalAlpha = a; ctx.font = `600 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = wrapLines(ctx, state.toast, P.toast.maxW - 40), h = lines.length * 30 + 24, w = Math.min(P.toast.maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44);
  wood(ctx, P.toast.x - w / 2, P.toast.y - h / 2, w, h, { r: 16, tone: 'dark', brass: true });
  ctx.fillStyle = '#fff3d6'; lines.forEach((l, i) => ctx.fillText(l, P.toast.x, P.toast.y - h / 2 + 12 + 15 + i * 30));
  ctx.restore();
}

function explainBox(ctx, P, state) {
  const e = state.explain;
  if (!e) return;
  ctx.save(); ctx.font = `600 21px ${FONT}`;
  const w = P.explain.w - 70, lines = [];
  for (const l of [e.head, ...e.lines]) lines.push(...wrapLines(ctx, l, w - 24));
  const h = lines.length * 26 + 20, x = P.explain.x, y = P.explain.y;
  wood(ctx, x, y, w, h, { r: 14, tone: 'dark', brass: true, alpha: 0.94 });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => { ctx.fillStyle = i === 0 ? '#ffd27a' : 'rgba(255,246,228,0.92)'; ctx.fillText(l, x + 14, y + 29 + i * 26); });
  ctx.restore();
}

// sight read-out inside the scope: angle and the far distance
function sightHud(ctx, P, state) {
  const deg = (state.aim.ang * 180) / Math.PI, r = P.scope;
  ctx.save(); ctx.font = `700 20px ${FONT}`; ctx.textBaseline = 'middle';
  const text = `Sight ${Math.abs(deg).toFixed(1)}° ${deg < -0.05 ? 'left' : deg > 0.05 ? 'right' : 'straight'}`;
  const w = ctx.measureText(text).width + 24;
  wood(ctx, r.x + 12, r.y + r.h - 46, w, 34, { r: 12, tone: 'dark', brass: true, shadow: false });
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'left'; ctx.fillText(text, r.x + 24, r.y + r.h - 28);
  // centre sight mark
  const cx = r.x + (r.w - 54) / 2, cy = r.y + r.h - 44 - 18;
  void cx; void cy;
  ctx.restore();
}

export function renderPlay(ctx, state, L) {
  const P = L.play, m = state.m;
  // background
  const bg = ctx.createLinearGradient(0, 0, 0, L.h);
  bg.addColorStop(0, '#3a1c0e'); bg.addColorStop(1, '#22100a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, L.w, L.h);
  wood(ctx, -20, -20, L.w + 40, L.h + 40, { r: 0, tone: 'dark', shadow: false, hi: false });
  scoreCard(ctx, P.cards[0], 0, state);
  scoreCard(ctx, P.cards[1], 1, state);
  infoBlock(ctx, P, state);
  const scene = state.scene3;
  const V = drawScope(ctx, P.scope, scene);
  void V;
  drawStrip(ctx, P.map, scene);
  drawGauge(ctx, P.gauge, state);
  sightHud(ctx, P, state);
  if (m.cfg.mode === 'watch') {
    drawDemoControls(ctx, P, state);
  } else {
    drawLeanRow(ctx, P, state);
    drawButton(ctx, P.hint, state.hintBusy ? '…' : 'Hint', { disabled: !state.humanTurn || state.paused || m.phase !== 'aim', size: 28 });
    drawButton(ctx, P.menu, 'Menu', { dark: true, size: 26 });
    drawPad(ctx, P, state);
  }
  toastPill(ctx, P, state);
  explainBox(ctx, P, state);
  if (m.phase === 'result') resultPanel(ctx, P, state);
  if (state.paused && !state.pauseMenu) {
    ctx.save(); ctx.fillStyle = 'rgba(4,20,30,0.45)'; ctx.fillRect(P.scope.x, P.scope.y, P.scope.w, P.scope.h);
    ctx.fillStyle = '#fff6e4'; ctx.font = `700 54px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    textShadow(ctx, 'Paused', P.scope.x + P.scope.w / 2, P.scope.y + P.scope.h / 2, '#fff6e4', 8); ctx.restore();
  }
}
