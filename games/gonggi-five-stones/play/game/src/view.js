// The play screen: the world (mat, pebbles, palm marker, routes), the HUD, the toss pad and the overlays.
// Pure drawing; game.js owns state.
import { W, H, HOME, R, FIELD, STAGES, SET_MIN_HOME, KK, CHARGE_SECS, H_MIN, FLICK_T, WIN_EARLY, WIN_LATE, airtime, winScale, clamp, handAt, kkPos, clusterAt } from './sim.js';
import { drawFloor, drawMat, drawHomeMark, drawStone, drawShadow, drawHand, drawTrail, drawRoute, drawBadge, drawRing, drawParticles } from './art.js';
import { playLayout, TEXT_SCALES, toScreen } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, fitPx } from './ui.js';
import { tx, stageName } from './content.js';
import { THINK_STEPS } from './layout.js';

const TAU = Math.PI * 2;
const ease = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);

// ---- the world ----------------------------------------------------------------------------------------
function tossPos(ev, t, h) {
  const u = clamp(t / ev.T, 0, 1);
  const hmax = 120 + 190 * h;
  return { x: HOME.x + (ev.L.x - HOME.x) * u, y: HOME.y + (ev.L.y - HOME.y) * u, z: hmax * 4 * u * (1 - u), u };
}

const trayPos = (i) => ({ x: 44 + i * 40, y: 774 });
function drawTray(ctx, ids) {
  ids.forEach((id, i) => { const p = trayPos(i); drawStone(ctx, { id, x: p.x, y: p.y, rot: i * 0.9 }, { scale: 0.58 }); });
}

// A dashed ghost of the four stones set down together (stage 4).
function drawGhostCluster(ctx, spot, alpha = 0.55) {
  const c = clusterAt(spot.x, spot.y, [1, 2, 3, 4]);
  c.forEach((s) => drawStone(ctx, s, { alpha }));
}

export function drawWorld(ctx, state, rd, hp = {}) {
  const t = state.t;
  drawMat(ctx, t);
  const phase = rd.phase;
  const mode = state.match ? state.match.cfg.mode : 'cpu';
  const ev = rd.ev;
  const rdef = hp.roundDef && ['plan', 'charge', 'exec', 'resolve'].includes(phase) ? hp.roundDef() : null;
  const stage = rd.stage;
  const hint = rd.hint;
  const reveal = rd.beat && rd.beat.phase !== 'think';
  const charging = phase === 'charge' || phase === 'kcharging';
  drawHomeMark(ctx, HOME.x, HOME.y, charging ? 1 : 0);

  // ---- kkeokki
  if (stage === 5 && state.match && ['kcharge', 'kcharging', 'kflight', 'kcatch', 'kflick', 'kresult'].includes(phase)) return drawKk(ctx, state, rd, hp);

  // ---- stage 4 set marker before the cluster exists
  if (rdef && rdef.kind === 'set' && phase === 'plan') {
    if (!rd.spot) drawRing(ctx, HOME.x, HOME.y, SET_MIN_HOME, 'rgba(255,120,100,0.6)', 3, [8, 10]);
    else {
      drawRoute(ctx, [HOME, rd.spot, HOME], { alpha: 0.28, t });
      drawGhostCluster(ctx, rd.spot);
    }
  }
  if (rdef && rdef.kind === 'set' && phase === 'charge' && rd.spot) { drawRoute(ctx, [HOME, rd.spot, HOME], { alpha: 0.22, t }); drawGhostCluster(ctx, rd.spot); }

  // ---- the pile in hand before the scatter
  if (phase === 'scatter') {
    [0, 1, 2, 3, 4].forEach((id, i) => drawStone(ctx, { id, x: HOME.x + (i - 2) * 14, y: HOME.y - 18 - Math.abs(i - 2) * 6, rot: i }, { z: 16, scale: 0.9 }));
    if (rd.sc) {
      drawRing(ctx, rd.sc.cx, rd.sc.cy, rd.sc.spread, 'rgba(255,244,214,0.85)', 4, [10, 10]);
      ctx.save(); ctx.fillStyle = 'rgba(255,244,214,0.95)'; ctx.beginPath(); ctx.arc(rd.sc.cx, rd.sc.cy, 6, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (hint && hint.kind === 'scatter') drawRing(ctx, hint.cx, hint.cy, hint.spread, 'rgba(255,214,102,0.95)', 5, [4, 9]);
    if (rd.ai && rd.beat && rd.beat.phase !== 'think' && rd.ai.sc) drawRing(ctx, rd.ai.sc.cx, rd.ai.sc.cy, rd.ai.sc.spread, 'rgba(255,214,102,0.95)', 5, [4, 9]);
  }

  // ---- stones lying on the mat
  const knocked = (s) => {
    if (!s.knock) return s;
    const k = ease(s.knock.t / 0.5);
    const hx = ev ? handAt(ev, ev.fault ? ev.fault.t : 0) : HOME;
    let dx = s.x - hx.x, dy = s.y - hx.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    return { ...s, x: s.x + dx * 46 * k, y: s.y + dy * 46 * k, rot: s.rot + 1.6 * k };
  };
  const carried = new Set(['exec', 'resolve'].includes(phase) ? rd.picked : []);
  const selOrder = rd.sel || [];
  const hintTargets = hint && hint.kind === 'plan' && hint.plan.targets ? hint.plan.targets : null;
  const clipId = rd.pv && rd.pv.ev.fault ? rd.pv.ev.fault.id : null;
  const flying = [];
  for (const s0 of rd.mat) {
    if (carried.has(s0.id)) continue;
    let s = knocked(s0), z = 0, rot = s.rot;
    if (s.fly) {
      const fl = s.fly, u = clamp(fl.t / fl.dur, 0, 1);
      if (fl.t < 0) continue;
      const e = ease(u);
      s = { id: s.id, x: fl.x0 + (s.x - fl.x0) * e, y: fl.y0 + (s.y - fl.y0) * e, rot: s.rot };
      z = 170 * 4 * u * (1 - u); rot = s.rot + (1 - u) * fl.sp;
    }
    if (s0.drop) z = 40 * (1 - s0.drop.t / 0.4);
    const sel = selOrder.indexOf(s0.id);
    const holdPulse = phase === 'hold' ? 0.35 + 0.3 * Math.sin(t * 5 + s0.id) : 0;
    const hintHold = hint && hint.kind === 'hold' && hint.id === s0.id;
    const revealHold = reveal && rd.ai && rd.ai.hold === s0.id && phase === 'hold';
    const hintTake = hintTargets && hintTargets.includes(s0.id) && sel < 0;
    flying.push({ s: { ...s, rot }, z, glow: sel >= 0 ? 0.55 : holdPulse * 0.6, ring: sel >= 0 ? (clipId === s0.id ? '#ff7a62' : '#ffe9a0') : hintHold || revealHold ? '#ffd45e' : hintTake ? 'rgba(255,214,94,0.9)' : null, sel, base: s0, y: s.y });
  }
  flying.sort((a, b) => a.y - b.y);
  for (const f of flying) {
    drawStone(ctx, f.s, { z: f.z, glow: f.glow, ring: f.ring });
    if (f.sel >= 0 && rdef && rdef.kind === 'take' && rdef.take > 1) drawBadge(ctx, f.s.x + R * 0.95, f.s.y - R * 0.95, String(f.sel + 1), { fill: clipId === f.base.id ? '#d04a3a' : '#e2503c' });
  }
  if (clipId !== null && phase === 'plan') { const cs = rd.mat.find((s) => s.id === clipId); if (cs) drawRing(ctx, cs.x, cs.y, R * 1.7, 'rgba(255,110,90,0.9)', 3, [6, 6]); }

  // ---- route preview while planning
  if ((phase === 'plan' || phase === 'charge') && rdef && rdef.kind === 'take' && rd.sel.length) {
    const pts = [HOME, ...rd.sel.map((id) => rd.mat.find((s) => s.id === id)).filter(Boolean), HOME];
    drawRoute(ctx, pts, { alpha: 0.26, bad: !!clipId, t });
  }
  if (hint && hint.kind === 'plan' && hint.plan.targets && !(rd.sel.length === hint.plan.targets.length && rd.sel.every((id, i) => id === hint.plan.targets[i]))) {
    const pts = [HOME, ...hint.plan.targets.map((id) => rd.mat.find((s) => s.id === id)).filter(Boolean), HOME];
    if (pts.length > 2) { drawRoute(ctx, pts, { alpha: 0.22, t }); hint.plan.targets.forEach((id, i) => { const s = rd.mat.find((q) => q.id === id); if (s) drawBadge(ctx, s.x - R * 0.95, s.y - R * 0.95, String(i + 1), { fill: '#d9a441' }); }); }
  }
  if (hint && hint.kind === 'plan' && hint.plan.spot && !rd.spot) { drawRoute(ctx, [HOME, hint.plan.spot, HOME], { alpha: 0.2, t }); drawGhostCluster(ctx, hint.plan.spot, 0.45); }
  if (rd.beat && rd.beat.phase === 'think' && rd.ai && rd.ai.cands && phase === 'plan') {
    // while thinking, the computer tries routes one after another
    const c = rd.ai.cands[Math.floor(rd.beat.t * 2.2) % rd.ai.cands.length];
    if (c && c.targets) { const pts = [HOME, ...c.targets.map((id) => rd.mat.find((s) => s.id === id)).filter(Boolean), HOME]; drawRoute(ctx, pts, { alpha: 0.2, t }); }
  }

  // ---- the toss
  const hold = rd.hold;
  const showHeld = rd.held.includes(hold) && phase !== 'scatter' && phase !== 'scattering' && phase !== 'hold';
  if (['plan', 'charge'].includes(phase) && showHeld) {
    const lift = phase === 'charge' ? 22 + 50 * clamp(rd.charge / CHARGE_SECS, 0, 1) : 20 + 3 * Math.sin(t * 3);
    drawStone(ctx, { id: hold, x: HOME.x, y: HOME.y - 6, rot: 0.4 }, { z: lift, scale: 0.95 });
    drawHand(ctx, HOME.x, HOME.y, { glow: phase === 'charge' ? 1 : 0.2 });
  }
  if (rd.holdFly) {
    const u = ease(rd.holdFly.t / 0.35), f = rd.holdFly;
    drawStone(ctx, { id: f.id, x: f.x + (HOME.x - f.x) * u, y: f.y + (HOME.y - 6 - f.y) * u, rot: f.rot }, { z: 40 * 4 * u * (1 - u) + 20 * u });
  }
  if (phase === 'hold' && rd.held.length === 0) drawHand(ctx, HOME.x, HOME.y, { glow: 0.2 });

  if (['exec', 'resolve'].includes(phase) && ev) drawToss(ctx, state, rd, ev);

  // ---- the stones taken so far wait in the other hand
  const tray = rd.held.filter((id) => id !== hold || phase === 'turnend' || phase === 'stageclear');
  if (!['scatter', 'scattering', 'hold'].includes(phase)) drawTray(ctx, rd.held.filter((id) => !(id === hold && ['plan', 'charge', 'exec', 'resolve'].includes(phase) && showHeld && !(rd.res && rd.res.ok))).slice(0, 5));
  void tray;

  drawParticles(ctx, rd.parts);
  for (const f of rd.floats) {
    const k = f.t / f.max, y = f.y - 38 * ease(k * 1.3), a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.save(); ctx.globalAlpha = a; ctx.font = `700 34px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(f.text).width + 36;
    roundPath(ctx, f.x - w / 2, y - 24, w, 48, 24); ctx.fillStyle = 'rgba(28,20,50,0.82)'; ctx.fill();
    ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, y + 2); ctx.restore();
  }
}

// The tossed stone, the hand, the picked-up stones and the catch ring.
function drawToss(ctx, state, rd, ev) {
  const t = state.t, et = rd.et;
  const h = ev.h;
  const caught = rd.res && rd.res.ok && rd.catchAt !== null && et >= rd.catchAt;
  const sc = winScale(h);
  const hpos = handAt(ev, rd.res && rd.catchAt !== null ? Math.min(et, Math.max(rd.catchAt, 0)) : et);
  if (rd.trail.length) drawTrail(ctx, rd.trail);
  // catch ring at the landing spot
  if (!rd.res) {
    const inWin = et >= ev.T - WIN_EARLY * sc && et <= ev.T + WIN_LATE * sc;
    const r = 30 + 100 * clamp((ev.T - et) / 0.6, 0, 1);
    drawRing(ctx, ev.L.x, ev.L.y, r, inWin ? 'rgba(255,224,120,0.98)' : 'rgba(255,246,228,0.6)', inWin ? 6 : 3);
    drawRing(ctx, ev.L.x, ev.L.y, 30, 'rgba(255,246,228,0.35)', 2);
    ctx.save(); ctx.fillStyle = 'rgba(255,246,228,0.5)'; ctx.beginPath(); ctx.arc(ev.L.x, ev.L.y, 4, 0, TAU); ctx.fill(); ctx.restore();
  }
  // the tossed stone
  let tp;
  if (caught) tp = { x: hpos.x, y: hpos.y, z: 18 };
  else if (et < ev.T) tp = tossPos(ev, et, h);
  else {
    const dt = et - ev.T, roll = rd.roll ? rd.roll.ang : 0, k = 1 - Math.exp(-dt * 7);
    const bounce = Math.max(0, 26 * Math.sin(dt * 18) * Math.exp(-dt * 7));
    tp = { x: ev.L.x + Math.cos(roll) * 34 * k, y: ev.L.y + Math.sin(roll) * 22 * k, z: bounce };
  }
  if (!caught) drawStone(ctx, { id: rd.hold, x: tp.x, y: tp.y, rot: et * 6 }, { z: tp.z });
  // picked stones travel with the hand
  const carry = rd.picked.filter((id) => rd.mat.some((s) => s.id === id) || (rd.res && rd.res.ok));
  const fade = rd.res && rd.res.ok && rd.catchAt !== null ? clamp(1 - (et - rd.catchAt) / 0.5, 0, 1) : 1;
  if (fade > 0) carry.forEach((id, i) => drawStone(ctx, { id, x: hpos.x + (i - (carry.length - 1) / 2) * 20, y: hpos.y - 6, rot: i }, { z: 20, scale: 0.8, alpha: fade }));
  if (caught) drawStone(ctx, { id: rd.hold, x: hpos.x, y: hpos.y - 6, rot: 0.4 }, { z: 22, scale: 0.95, alpha: clamp(1 - (et - rd.catchAt) / 0.5, 0, 1) });
  const dwell = hpos.dwelling ? 1 : 0;
  drawHand(ctx, hpos.x, hpos.y, { closed: dwell, glow: caught ? 1 : 0.3 });
  if (ev.fault && rd.res && !rd.res.ok) { const f = ev.fault; ctx.save(); ctx.strokeStyle = 'rgba(255,110,90,0.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.x, f.y, 34, 0, TAU); ctx.stroke(); ctx.restore(); }
  void t;
}

// ---- kkeokki ---------------------------------------------------------------------------------------------
function drawKk(ctx, state, rd, hp) {
  const t = state.t, phase = rd.phase, hint = rd.hint;
  const stones = [];
  if (phase === 'kcharge' || phase === 'kcharging') {
    const h = phase === 'kcharging' ? clamp(0.2 + 0.8 * rd.charge / CHARGE_SECS, 0.2, 1) : 0.6;
    const sig = 30 + 60 * h;
    drawRing(ctx, HOME.x, HOME.y - 40, sig * 1.7, 'rgba(255,244,214,0.5)', 3, [8, 10]);
    const lift = phase === 'kcharging' ? 22 + 40 * clamp(rd.charge / CHARGE_SECS, 0, 1) : 20;
    [0, 1, 2, 3, 4].forEach((id, i) => drawStone(ctx, { id, x: HOME.x + (i - 2) * 16, y: HOME.y - 8 - Math.abs(i - 2) * 5, rot: i }, { z: lift, scale: 0.92 }));
    drawHand(ctx, HOME.x, HOME.y, { glow: phase === 'kcharging' ? 1 : 0.2 });
    if (hint && hint.kind === 'kcharge') drawRing(ctx, HOME.x, HOME.y - 40, (30 + 60 * hint.h) * 1.7, 'rgba(255,214,102,0.95)', 5, [4, 9]);
    if (rd.ai && rd.beat && rd.beat.phase !== 'think' && rd.ai.h) drawRing(ctx, HOME.x, HOME.y - 40, (30 + 60 * rd.ai.h) * 1.7, 'rgba(255,214,102,0.95)', 5, [4, 9]);
    drawParticles(ctx, rd.parts);
    return;
  }
  const kk = rd.kk, res = rd.kres;
  if (phase === 'kflight') {
    for (const s of kk.stones) { const p = kkPos(s, Math.min(rd.et, s.T)); stones.push({ id: s.id, x: p.x, y: p.y, z: p.z, down: p.down, spin: s.spin * rd.et, landed: rd.et >= s.T }); }
    stones.sort((a, b) => a.y - b.y);
    // the catch circle follows the finger
    if (rd.kh) {
      drawRing(ctx, rd.kh.x, rd.kh.y, KK.Rb, 'rgba(255,244,214,0.75)', 4, [10, 8]);
      drawHand(ctx, rd.kh.x, rd.kh.y, { r: 34, glow: 0.6 });
    }
    if (hint && hint.kind === 'kflight') {
      drawRing(ctx, hint.best.x, hint.best.y, KK.Rb, 'rgba(255,214,102,0.95)', 5, [4, 9]);
    }
    for (const s of stones) drawStone(ctx, { id: s.id, x: s.x, y: s.y, rot: s.spin }, { z: s.z, glow: s.down && s.z <= KK.Zc ? 0.7 : 0 });
  } else if (res) {
    const cx = res.x, cy = res.y;
    const caught = res.caught;
    kk.stones.forEach((s) => {
      if (caught.includes(s.id)) return;
      const tt = Math.min(res.tau + rd.et, s.T + 2), p = kkPos(s, Math.min(tt, s.T));
      const fall = rd.et > 0 ? clamp((tt - s.T) / 0.4, 0, 1) : 0;
      const bounce = tt > s.T ? Math.max(0, 22 * Math.sin((tt - s.T) * 16) * Math.exp(-(tt - s.T) * 6)) : 0;
      stones.push({ id: s.id, x: p.x + fall * 12, y: p.y + fall * 8, z: tt > s.T ? bounce : p.z, spin: s.spin * tt });
    });
    for (const s of stones) drawStone(ctx, { id: s.id, x: s.x, y: s.y, rot: s.spin }, { z: s.z });
    // flip: the ring turns over and the caught stones sit on the back of the hand
    if (phase === 'kcatch' || phase === 'kresult') {
      const flip = ease(rd.et / 0.4);
      drawRing(ctx, cx, cy, KK.Rb * (1 - 0.25 * flip), 'rgba(255,244,214,0.6)', 3);
      caught.forEach((id, i) => {
        const a = (i / Math.max(1, caught.length)) * TAU + 0.6, rr = caught.length === 1 ? 0 : 38;
        drawStone(ctx, { id, x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.8, rot: i }, { z: 16, scale: 0.92, alpha: phase === 'kresult' && rd.kept === 0 ? 0.4 : 1 });
      });
      drawHand(ctx, cx, cy, { r: 34, glow: 0.8 });
    }
    if (phase === 'kflick') {
      const u = clamp(rd.et / FLICK_T, 0, 1), z = 200 * 4 * u * (1 - u);
      const r = 30 + 90 * clamp((FLICK_T - rd.et) / 0.5, 0, 1);
      const inWin = Math.abs(rd.et - FLICK_T) <= 0.18;
      if (rd.eps === null) drawRing(ctx, cx, cy, r, inWin ? 'rgba(255,224,120,0.98)' : 'rgba(255,246,228,0.6)', inWin ? 6 : 3);
      caught.forEach((id, i) => { const a = (i / Math.max(1, caught.length)) * TAU + 0.6, rr = caught.length === 1 ? 0 : 30 * (1 - u * 0.4); drawStone(ctx, { id, x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.8, rot: i + rd.et * 5 }, { z: z + 16, scale: 0.92 }); });
      drawHand(ctx, cx, cy, { r: 34, glow: 0.5 });
    }
  }
  drawParticles(ctx, rd.parts);
  for (const f of rd.floats) {
    const k = f.t / f.max, y = f.y - 38 * ease(k * 1.3), a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.save(); ctx.globalAlpha = a; ctx.font = `700 34px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(f.text).width + 36;
    roundPath(ctx, f.x - w / 2, y - 24, w, 48, 24); ctx.fillStyle = 'rgba(28,20,50,0.82)'; ctx.fill();
    ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, y + 2); ctx.restore();
  }
  void t; void hp;
}

// ---- the attract mat behind the title ---------------------------------------------------------------------
export function drawAttract(ctx, state, ox = 30, oy = 70, s = 1) {
  drawFloor(ctx, W, H);
  const a = state.att;
  ctx.save(); ctx.translate(ox, oy); ctx.scale(s, s);
  drawMat(ctx, state.t);
  drawHomeMark(ctx, HOME.x, HOME.y, 0);
  if (a) {
    const ev = a.ev, et = a.et;
    for (const st of a.mat) { if (a.picked.includes(st.id) && et < ev.T + 1) continue; drawStone(ctx, st); }
    if (et > 0 && et < ev.T + 0.5) {
      drawTrail(ctx, a.trail);
      const hp = handAt(ev, et);
      const tp = tossPos(ev, Math.min(et, ev.T), ev.h);
      drawStone(ctx, { id: a.hold, x: tp.x, y: tp.y, rot: et * 5 }, { z: tp.z });
      a.picked.forEach((id, i) => drawStone(ctx, { id, x: hp.x + i * 14, y: hp.y - 6, rot: i }, { z: 20, scale: 0.8 }));
      drawHand(ctx, hp.x, hp.y, { closed: hp.dwelling ? 1 : 0 });
    } else {
      drawStone(ctx, { id: a.hold, x: HOME.x, y: HOME.y - 6, rot: 0.4 }, { z: 20 });
      drawHand(ctx, HOME.x, HOME.y, { glow: 0.2 });
    }
    drawParticles(ctx, a.parts);
  }
  ctx.restore();
}
export function renderAttract(ctx, state) { drawAttract(ctx, state); }

// ---- the HUD -------------------------------------------------------------------------------------------------
function coachText(state, hp, rd, T) {
  if (state.toastT > 0 && state.toast) return state.toast;
  const m = state.match, phase = rd.phase, ai = hp.actorIsAI();
  const name = hp.nameOf(rd.who);
  if (m.cfg.mode === 'watch' && rd.beat) {
    const b = rd.beat;
    const lab = b.phase === 'think' ? T('beatThink') : b.phase === 'reveal' ? T('beatReveal') : T('beatAct');
    return `${lab} · ${name}`;
  }
  const tip = isLessonTip(m, phase, T, rd);
  if (tip) return tip;
  if (ai) return T('c_ai', { name });
  switch (phase) {
    case 'scatter': return T('c_scatter');
    case 'scattering': return T('c_scattering');
    case 'hold': return T('c_hold');
    case 'plan': {
      const rdef = hp.roundDef();
      if (rdef.kind === 'take') return rd.sel.length < rdef.take ? T('c_take', { n: rdef.take - rd.sel.length, k: rdef.take }) : (rd.pv && rd.pv.clip ? T('c_clip') : T('c_ready'));
      if (rdef.kind === 'set') return rd.spot ? T('c_ready') : T('c_set');
      return T('c_sweep');
    }
    case 'charge': return T('c_charge');
    case 'exec': return T('c_exec');
    case 'resolve': return rd.res && rd.res.ok ? T('c_ok') : T('c_fail');
    case 'kcharge': return T('c_kcharge');
    case 'kcharging': return T('c_charge');
    case 'kflight': return T('c_kflight');
    case 'kcatch': return rd.kres && rd.kres.n ? T('c_kcatch') : T('c_kmiss');
    case 'kflick': return T('c_kflick');
    case 'kresult': return T('c_kdone');
    case 'stageclear': return T('c_clear');
    case 'turnend': return T('c_turnend');
    default: return '';
  }
}
function isLessonTip(m, phase, T, rd) {
  if (m.cfg.mode !== 'learn') return null;
  if (phase === 'plan' && rd.sel.length > 0) return null;
  return T(`tip_${m.cfg.lesson}_${phase}`, null, true) || null;
}

function drawHud(ctx, state, hp, L) {
  const rd = state.rd, m = state.match, lang = state.settings.lang;
  const T = (k, v, soft) => tx(lang, k, v, soft);
  const mm = L.m;
  // player cards
  for (let i = 0; i < 2; i++) {
    const c = L.cards[i];
    const learn = m.cfg.mode === 'learn';
    if (learn && i === 1) continue;
    const active = rd.who === i;
    panel(ctx, c.x, c.y, c.w, c.h, { r: 20, fill: 'rgba(30,22,60,0.86)', stroke: active ? '#ffd45e' : 'rgba(255,246,228,0.28)' });
    if (active) { ctx.fillStyle = '#ffd45e'; ctx.beginPath(); ctx.arc(c.x + 20, c.y + c.h / 2, 7 * Math.min(mm, 1.4), 0, TAU); ctx.fill(); }
    const nameFs = fitPx(ctx, hp.nameOf(i), 700, 24 * mm, c.w * 0.5 - 34);
    ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `700 ${nameFs}px ${FONT}`;
    ctx.fillText(hp.nameOf(i), c.x + 40, c.y + c.h * 0.36);
    if (m.cfg.mode !== 'learn') {
      ctx.fillStyle = 'rgba(255,246,228,0.72)'; ctx.font = `400 ${Math.round(17 * mm)}px ${FONT}`;
      ctx.fillText(T('stageShort', { n: Math.min(m.stage[i], 5) }), c.x + 40, c.y + c.h * 0.74);
      const sc = `${m.scores[i]}`, tg = `/${m.cfg.target}`;
      ctx.textAlign = 'right'; ctx.font = `700 ${Math.round(46 * mm)}px ${DISPLAY}`; ctx.fillStyle = '#ffe28a';
      const tgW = (ctx.font = `400 ${Math.round(22 * mm)}px ${FONT}`, ctx.measureText(tg).width);
      ctx.fillText(tg, c.x + c.w - 16, c.y + c.h * 0.62);
      ctx.font = `700 ${Math.round(46 * mm)}px ${DISPLAY}`; ctx.fillText(sc, c.x + c.w - 20 - tgW, c.y + c.h * 0.55);
    } else {
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffe28a'; ctx.font = `700 ${Math.round(24 * mm)}px ${FONT}`;
      ctx.fillText(T('lessonLabel', { n: m.cfg.lesson + 1 }), c.x + c.w - 16, c.y + c.h / 2);
    }
  }
  if (m.cfg.mode === 'learn') { /* the second card slot carries the stage */ const c = L.cards[1]; panel(ctx, c.x, c.y, c.w, c.h, { r: 20, fill: 'rgba(30,22,60,0.86)', stroke: 'rgba(255,246,228,0.28)' }); ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const s = stageName(lang, rd.stage); ctx.font = `700 ${fitPx(ctx, s, 700, 24 * mm, c.w - 28)}px ${FONT}`; ctx.fillText(s, c.x + c.w / 2, c.y + c.h / 2); }
  // stage strip
  const st = L.strip;
  panel(ctx, st.x, st.y, st.w, st.h, { r: 16, fill: 'rgba(30,22,60,0.78)', stroke: 'rgba(255,246,228,0.22)', shadow: false });
  const label = `${T('stageShort', { n: rd.stage })} · ${stageName(lang, rd.stage)}`;
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const rounds = STAGES[rd.stage - 1].rounds;
  const pipsW = rounds.length * 22 * Math.min(mm, 1.4) + 10;
  const fs = fitPx(ctx, label, 700, 22 * mm, st.w - pipsW - 36);
  ctx.font = `700 ${fs}px ${FONT}`; ctx.fillText(label, st.x + 16, st.y + st.h / 2 + 1);
  rounds.forEach((_, i) => {
    const px = st.x + st.w - 18 - (rounds.length - 1 - i) * 22 * Math.min(mm, 1.4), py = st.y + st.h / 2, done = i < rd.ri || (i === rd.ri && rd.res && rd.res.ok && rd.phase === 'resolve');
    ctx.beginPath(); ctx.arc(px, py, 7 * Math.min(mm, 1.4), 0, TAU); ctx.fillStyle = done ? '#ffd45e' : i === rd.ri ? 'rgba(255,246,228,0.9)' : 'rgba(255,246,228,0.25)'; ctx.fill();
  });
  // coach line
  const cr = L.coach, text = coachText(state, hp, rd, T);
  panel(ctx, cr.x, cr.y, cr.w, cr.h, { r: 16, fill: 'rgba(255,246,228,0.95)', stroke: 'rgba(28,37,82,0.45)', shadow: false });
  ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = Math.round(22 * Math.min(mm, 1.6)), lines;
  for (;;) { ctx.font = `600 ${size}px ${FONT}`; lines = wrapLines(ctx, text, cr.w - 28); if ((lines.length * size * 1.18 <= cr.h - 8) || size <= 13) break; size -= 1; }
  lines.forEach((l, i) => ctx.fillText(l, cr.x + cr.w / 2, cr.y + cr.h / 2 + (i - (lines.length - 1) / 2) * size * 1.18));
}

function drawGauge(ctx, pad, rd, hp, mm, T) {
  const phase = rd.phase;
  const gx = pad.x + 22, gw = pad.w - 44, gh = Math.round(20 * Math.min(mm, 1.5)), gy = pad.y + pad.h - gh - 16;
  roundPath(ctx, gx, gy, gw, gh, gh / 2); ctx.fillStyle = 'rgba(10,6,30,0.55)'; ctx.fill();
  const charging = phase === 'charge' || phase === 'kcharging';
  const h = charging ? clamp(H_MIN + (1 - H_MIN) * rd.charge / CHARGE_SECS, H_MIN, 1) : phase === 'exec' || phase === 'resolve' ? (rd.ev ? rd.ev.h : 0) : 0;
  const fillW = gw * ((h - H_MIN) / (1 - H_MIN));
  if (h > 0) { roundPath(ctx, gx, gy, Math.max(gh, fillW), gh, gh / 2); ctx.fillStyle = '#ffd45e'; ctx.fill(); }
  // the time the route needs
  if (rd.pv && hp.roundDef && phase !== 'kcharge' && phase !== 'kcharging') {
    const need = rd.pv.need;
    const hMin = clamp(((need + 0.06 - 0.55) / 0.85 - H_MIN) / (1 - H_MIN), 0, 1), hSafe = clamp(((need + 0.2 - 0.55) / 0.85 - H_MIN) / (1 - H_MIN), 0, 1);
    const mark = (hh, col) => { const x = gx + gw * hh; ctx.fillStyle = col; ctx.fillRect(x - 2, gy - 6, 4, gh + 12); };
    mark(hMin, '#ff8a70'); mark(hSafe, '#7fe8d6');
  }
  void T;
}

function drawPad(ctx, state, hp, L) {
  const rd = state.rd, lang = state.settings.lang, T = (k, v) => tx(lang, k, v);
  const pad = L.pad, mm = L.m, phase = rd.phase, ai = hp.actorIsAI();
  const watch = hp.isWatch();
  let label = '', sub = '', active = false, dim = false;
  const rdef = ['plan', 'charge'].includes(phase) ? hp.roundDef() : null;
  if (watch && rd.beat) {
    const b = rd.beat;
    // THINK / REVEAL / ACT progress
    panel(ctx, pad.x, pad.y, pad.w, pad.h, { r: 22, fill: 'rgba(30,22,60,0.9)', stroke: 'rgba(255,246,228,0.3)' });
    const names = [T('beatThink'), T('beatReveal'), T('beatAct')], idx = b.phase === 'think' ? 0 : b.phase === 'reveal' ? 1 : 2;
    const w3 = (pad.w - 40) / 3;
    names.forEach((n, i) => {
      const x = pad.x + 20 + i * w3;
      roundPath(ctx, x + 4, pad.y + 14, w3 - 8, pad.h - 28, 16); ctx.fillStyle = i === idx ? (i === 0 ? '#ffd45e' : i === 1 ? '#7fe8d6' : '#ff9a86') : 'rgba(255,246,228,0.12)'; ctx.fill();
      ctx.fillStyle = i === idx ? '#1c2552' : 'rgba(255,246,228,0.7)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${fitPx(ctx, n, 700, 24 * Math.min(mm, 1.5), w3 - 24)}px ${FONT}`;
      ctx.fillText(n, x + w3 / 2, pad.y + pad.h / 2 - (i === idx && idx < 2 ? 8 : 0));
      if (i === idx && idx < 2) { const left = Math.max(0, Math.ceil(b.dur - b.t)); ctx.font = `600 ${Math.round(18 * Math.min(mm, 1.5))}px ${FONT}`; ctx.fillText(`${left} s`, x + w3 / 2, pad.y + pad.h / 2 + 20 * Math.min(mm, 1.5)); }
    });
    return;
  }
  if (ai) { label = T('pad_ai', { name: hp.nameOf(rd.who) }); dim = true; }
  else if (phase === 'plan') { const ok = hp.planComplete(); label = ok ? T('pad_hold') : T('pad_plan'); dim = !ok; active = ok; }
  else if (phase === 'charge') { label = T('pad_release'); active = true; }
  else if (phase === 'exec') { label = T('pad_catch'); const ev = rd.ev; if (ev) { const sc = winScale(ev.h); active = !rd.res && rd.et >= ev.T - WIN_EARLY * sc && rd.et <= ev.T + WIN_LATE * sc; } dim = !active; }
  else if (phase === 'kcharge') { label = T('pad_hold'); active = true; }
  else if (phase === 'kcharging') { label = T('pad_release'); active = true; }
  else if (phase === 'kflight') { label = T('pad_kflight'); active = true; }
  else if (phase === 'kflick') { label = T('pad_catch'); active = Math.abs(rd.et - FLICK_T) <= 0.18 && rd.eps === null; dim = !active; }
  else if (phase === 'scatter') { label = T('pad_scatter'); dim = true; }
  else if (phase === 'hold') { label = T('pad_holdstone'); dim = true; }
  else {
    const mp = { resolve: rd.res && rd.res.ok ? 'c_ok' : 'c_fail', kcatch: 'c_kcatch', kresult: 'c_kdone', stageclear: 'c_clear', turnend: 'c_turnend', scattering: 'c_scattering', lessonclear: 'c_clear', learnretry: 'c_fail' };
    label = mp[phase] ? T(mp[phase]) : ''; dim = true;
  }
  panel(ctx, pad.x, pad.y, pad.w, pad.h, { r: 22, fill: active ? 'rgba(226,80,60,0.95)' : dim ? 'rgba(30,22,60,0.82)' : 'rgba(30,22,60,0.9)', stroke: active ? 'rgba(255,230,190,0.9)' : 'rgba(255,246,228,0.3)' });
  ctx.fillStyle = active ? '#fffaf0' : 'rgba(255,246,228,0.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const hasGauge = ['plan', 'charge', 'kcharge', 'kcharging', 'exec', 'resolve'].includes(phase) && !ai;
  const fs = fitPx(ctx, label, 700, 32 * Math.min(mm, 1.5), pad.w - 40);
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.fillText(label, pad.x + pad.w / 2, pad.y + (hasGauge ? pad.h * 0.34 : pad.h / 2));
  if (hasGauge) {
    drawGauge(ctx, pad, rd, hp, mm, T);
    // caption: air time and route time
    let cap = '';
    if ((phase === 'plan' || phase === 'charge') && rd.pv) cap = T('pad_cap', { route: rd.pv.need.toFixed(2), air: airtime(phase === 'charge' ? clamp(H_MIN + (1 - H_MIN) * rd.charge / CHARGE_SECS, H_MIN, 1) : 0.6).toFixed(2) });
    if (cap && phase === 'plan') cap = T('pad_cap0', { route: rd.pv.need.toFixed(2) });
    if (cap) { ctx.font = `500 ${Math.round(17 * Math.min(mm, 1.4))}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.8)'; ctx.fillText(cap, pad.x + pad.w / 2, pad.y + pad.h * 0.58 - 4); }
  }
}

function drawBar(ctx, state, hp, L) {
  const lang = state.settings.lang, T = (k, v) => tx(lang, k, v);
  const rd = state.rd;
  drawPad(ctx, state, hp, L);
  if (hp.isWatch()) {
    const th = THINK_STEPS[state.settings.thinkIdx];
    drawButton(ctx, L.watch.dec, T('w_dec'), { size: 24, disabled: state.settings.thinkIdx === 0 });
    drawButton(ctx, L.watch.pause, state.paused ? T('w_resume') : T('pause'), { size: 24, active: state.paused });
    drawButton(ctx, L.watch.inc, T('w_inc'), { size: 24, disabled: state.settings.thinkIdx === THINK_STEPS.length - 1 });
    drawButton(ctx, L.watch.exit, T('w_exit'), { size: 24, dark: true });
    void th;
    return;
  }
  const can = ['scatter', 'hold', 'plan', 'kcharge', 'kflight'].includes(rd.phase) && !hp.actorIsAI();
  drawButton(ctx, L.think, T('think'), { size: 28 * Math.min(L.m, 1.5) * 0.9, disabled: !can, primary: can && !!rd.hint });
  drawButton(ctx, L.clear, T('clear'), { size: 28 * Math.min(L.m, 1.5) * 0.9, disabled: rd.phase !== 'plan' || hp.actorIsAI() });
  drawButton(ctx, L.pause, T('pause'), { size: 28 * Math.min(L.m, 1.5) * 0.9, dark: true });
}

function drawHintCard(ctx, state, L, text, title, kindWatch) {
  const lang = state.settings.lang;
  const zoom = Math.min(L.m, 1.8);
  const x = 22, w = W - 44;
  let size = Math.round(24 * zoom), lines, h;
  const maxH = Math.max(160, (L.barTop - 8) - (L.hudBottom + 8) - 20);
  for (;;) {
    ctx.font = `500 ${size}px ${FONT}`; lines = wrapLines(ctx, text, w - 44);
    h = lines.length * size * 1.3 + size * 1.7 + 34;
    if (h <= maxH || size <= 14) break;
    size -= 1;
  }
  const bottom = L.barTop - 14;
  const y = bottom - h;
  panel(ctx, x, y, w, h, { r: 22, fill: 'rgba(255,246,228,0.97)', stroke: kindWatch ? '#1f9d8f' : '#d9a441' });
  ctx.fillStyle = C.vermDark; ctx.font = `700 ${Math.round(size * 0.92)}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, x + 22, y + 18 + size * 0.9);
  ctx.fillStyle = C.ink; ctx.font = `500 ${size}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 22, y + 22 + size * 1.7 + (i + 0.8) * size * 1.3 - size * 0.4));
  void lang;
}

function drawBanner(ctx, state, rd, L) {
  const b = rd.banner;
  if (!b || rd.bannerT <= 0) return;
  const k = clamp(rd.bannerT / 0.3, 0, 1), a = Math.min(1, k);
  const zoom = Math.min(L.m, 1.8);
  let size = Math.round(40 * zoom), lines;
  for (;;) { ctx.font = `700 ${size}px ${FONT}`; lines = wrapLines(ctx, b.text, 560); if (lines.length * size * 1.2 <= 260 || size <= 18) break; size -= 1; }
  const h = lines.length * size * 1.2 + 50, y = L.hudBottom + 40 + (L.barTop - L.hudBottom - 80) * 0.3 - h / 2;
  ctx.save(); ctx.globalAlpha = a;
  roundPath(ctx, 60, y, W - 120, h, 28);
  ctx.fillStyle = b.kind === 'end' ? 'rgba(60,24,40,0.94)' : b.kind === 'clear' ? 'rgba(20,70,66,0.94)' : 'rgba(30,22,60,0.94)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = b.kind === 'clear' ? '#7fe8d6' : b.kind === 'end' ? '#ff9a86' : '#ffd45e'; ctx.stroke();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 25 + size * 0.6 + i * size * 1.2));
  ctx.restore();
}

export function renderPlay(ctx, state, hp) {
  const rd = state.rd, L = playLayout(state.settings.textIdx);
  drawFloor(ctx, W, H);
  ctx.save();
  if (rd.shake > 0 && !state.settings.calm) ctx.translate(Math.sin(state.t * 90) * 6 * rd.shake, Math.cos(state.t * 77) * 4 * rd.shake);
  ctx.translate(L.view.ox, L.view.oy); ctx.scale(L.view.s, L.view.s);
  drawWorld(ctx, state, rd, hp);
  ctx.restore();
  if (rd.flash > 0 && !state.settings.calm) { ctx.fillStyle = `rgba(255,90,70,${0.18 * rd.flash})`; ctx.fillRect(0, 0, W, H); }
  drawHud(ctx, state, hp, L);
  drawBar(ctx, state, hp, L);
  const lang = state.settings.lang;
  const reason = rd.hint ? rd.hint.text : rd.beat && rd.beat.phase === 'reveal' ? rd.beat.reason : '';
  if (reason) drawHintCard(ctx, state, L, reason, rd.hint ? tx(lang, 'hintTitle') : tx(lang, 'revealTitle'), !rd.hint);
  drawBanner(ctx, state, rd, L);
  void toScreen; void TEXT_SCALES; void FIELD; void kkPos; void drawShadow; void C;
}
