// The play screen: the world (yard, hole, pebbles, throwing stone, glass-ring hand, routes), the HUD, the toss pad and the
// overlays. Pure drawing; game.js owns state. Moving things are drawn from the display time `rd.det` (the sim time blended
// between two fixed steps) so motion is smooth at any refresh rate.
import {
  W, H, HOME, PIT, R, CHARGE_SECS, H_MIN, WIN_EARLY, WIN_LATE, airtime, AIR_BASE, AIR_SLOPE, winScale, clamp, handAt, slotPos, stageCount, tossesPerHalf, stageTake, progressOf, MODES,
} from './sim.js';
import { drawFloor, drawYard, drawHomeMark, drawStone, drawGho, drawHand, drawTrail, drawRoute, drawBadge, drawRing, drawParticles } from './art.js';
import { playLayout, THINK_STEPS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, fitPx } from './ui.js';
import { tx, stageName } from './content.js';

const TAU = Math.PI * 2;
const ease = (u) => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const BACK_SECS = 0.5;

export const tossHeightMax = (h) => 120 + 190 * h;
export function tossPos(rd, t) {
  const u = clamp(t / rd.T, 0, 1);
  return { x: HOME.x + (rd.L.x - HOME.x) * u, y: HOME.y + (rd.L.y - HOME.y) * u, z: tossHeightMax(rd.h) * 4 * u * (1 - u), u };
}

// The stones that are in the hand, in the hole or lying beside it while a toss is under way (not part of the resting pile).
function takenView(rd, p, det) {
  const skip = new Set(), list = [];
  if (!rd.taken || !rd.ev) return { skip, list };
  const hand = handAt(rd.ev, det);
  const res = rd.res, ok = res && res.ok;
  const sweepN = rd.taken.length;
  rd.taken.forEach((tk, i) => {
    if (det < tk.tPick) return;
    const dropped = rd.ev.tDrop !== null && det >= rd.ev.tDrop;
    let x, y, z, inPit = false, sc = 0.82;
    if (dropped) {
      // set down: the stones leave the hand in a short arc and settle with a small bounce
      const hd = handAt(rd.ev, rd.ev.tDrop), u = clamp((det - rd.ev.tDrop) / 0.3, 0, 1), e = ease(u);
      x = hd.x + (tk.to.x - hd.x) * e; y = hd.y + (tk.to.y - hd.y) * e;
      z = (rd.dir === 'out' ? 70 : 30) * 4 * u * (1 - u) + (u >= 1 ? Math.max(0, 7 * Math.sin((det - rd.ev.tDrop - 0.3) * 22) * Math.exp(-(det - rd.ev.tDrop - 0.3) * 9)) : 0);
      inPit = rd.dir === 'in' && u >= 1; sc = 0.82 + 0.18 * u;
    }
    else { const off = (i - (sweepN - 1) / 2) * Math.min(20, 90 / Math.max(1, sweepN)); x = hand.x + off; y = hand.y - 6; z = 22; }
    if (res && !ok && rd.resAt !== null) {
      const k = ease((rd.det - rd.resAt) / BACK_SECS);
      x = x + (tk.from.x - x) * k; y = y + (tk.from.y - y) * k; z = z + 40 * 4 * k * (1 - k); inPit = rd.dir === 'out' && k > 0.85;
      if (k >= 1) return;
    }
    if (ok) return;                      // the pile now holds them
    skip.add(tk.id);
    list.push({ id: tk.id, x, y, z, inPit, sc, rot: tk.rot });
  });
  void p;
  return { skip, list };
}

export function drawWorld(ctx, state, rd, p, hp = {}) {
  const t = state.t, det = rd.det ?? rd.et ?? 0;
  const phase = rd.phase, hint = rd.hint;
  const reveal = rd.beat && rd.beat.phase !== 'think';
  const inToss = ['air', 'resolve'].includes(phase) && rd.ev;
  const charging = phase === 'charge';
  drawYard(ctx);
  drawHomeMark(ctx, HOME.x, HOME.y, charging ? 1 : 0);
  const tk = inToss ? takenView(rd, p, det) : { skip: new Set(), list: [] };

  const tapIds = (rd.taps || []).map((q) => q.id);
  const planIds = hint && hint.kind === 'plan' ? hint.plan.ids : reveal && rd.ai && rd.ai.plan ? rd.ai.plan.ids : null;
  const showNum = rd.ctx ? rd.ctx.take > 1 && !rd.ctx.sweep : (hp.take ? hp.take() > 1 : false);

  // ---- the pile in the hole, then the stones on the yard
  const items = [];
  for (const id of p.pit) { if (tk.skip.has(id)) continue; const s = slotPos(id); items.push({ id, x: s.x, y: s.y, rot: (id * 1.37) % 3.14, inPit: true }); }
  for (const g of p.ground) {
    if (tk.skip.has(g.id)) continue;
    let s = { id: g.id, x: g.x, y: g.y, rot: g.rot }, z = 0;
    if (g.fly) { const u = clamp(g.fly.t / g.fly.dur, 0, 1), e = ease(u); s = { id: g.id, x: g.fly.x0 + (g.x - g.fly.x0) * e, y: g.fly.y0 + (g.y - g.fly.y0) * e, rot: g.rot + (1 - u) * 5 }; z = 120 * 4 * u * (1 - u); }
    items.push({ ...s, z, base: g });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    const tapN = tapIds.indexOf(it.id), planN = planIds ? planIds.indexOf(it.id) : -1;
    const sel = tapN >= 0 && !tk.skip.has(it.id);
    const ring = sel ? '#ffe9a0' : planN >= 0 ? 'rgba(255,214,94,0.95)' : null;
    drawStone(ctx, it, { z: it.z || 0, inPit: it.inPit, ring, glow: sel ? 0.45 : 0 });
    if (showNum && sel) drawBadge(ctx, it.x + R * 0.95, it.y - R * 0.95, String(tapN + 1), { r: 14 });
    else if (showNum && planN >= 0) drawBadge(ctx, it.x - R * 0.95, it.y - R * 0.95, String(planN + 1), { fill: '#c28a2a', r: 14 });
  }
  if (planIds && planIds.length === 1 && !hp.noPlanBadge) { const s = items.find((q) => q.id === planIds[0]); if (s) drawRing(ctx, s.x, s.y, R * 1.9, 'rgba(255,214,94,0.7)', 3, [5, 7]); }
  if (hint && hint.kind === 'plan' && !rd.ctx?.sweep) drawPlanRoute(ctx, hint.plan.ids.map((id) => lookup(p, id)).filter(Boolean), p.dir, t);
  if (reveal && rd.ai && rd.ai.plan && phase === 'ready') drawPlanRoute(ctx, rd.ai.plan.ids.map((id) => lookup(p, id)).filter(Boolean), p.dir, t);
  if ((hint && hint.kind === 'plan' && rd.ctx?.sweep) || (reveal && rd.ai && rd.ai.sweep)) drawRing(ctx, p.dir === 'out' ? PIT.x : lookupCentroid(p).x, p.dir === 'out' ? PIT.y : lookupCentroid(p).y, p.dir === 'out' ? PIT.r : 90, 'rgba(255,214,94,0.85)', 4, [8, 8]);
  if (rd.beat && rd.beat.phase === 'think' && rd.ai && rd.ai.cands && phase === 'ready') {
    const c = rd.ai.cands[Math.floor(rd.beat.t * 2.2) % rd.ai.cands.length];
    if (c) drawPlanRoute(ctx, c.ids.map((id) => lookup(p, id)).filter(Boolean), p.dir, t, 0.2);
  }

  // ---- the hand and the stone before the toss
  if (phase === 'ready' || phase === 'charge') {
    const lift = phase === 'charge' ? 22 + 50 * clamp(rd.charge / CHARGE_SECS, 0, 1) : 20 + 3 * Math.sin(t * 3);
    if (charging) drawApex(ctx, rd.chargeH);
    drawGho(ctx, HOME.x, HOME.y - 6, lift, {});
    drawHand(ctx, HOME.x, HOME.y, { glow: phase === 'charge' ? 1 : 0.2 });
  }
  if (inToss) drawToss(ctx, rd, det);
  for (const s of tk.list) drawStone(ctx, { id: s.id, x: s.x, y: s.y, rot: s.rot }, { z: s.z, scale: s.sc, inPit: s.inPit && s.z === 0 });

  drawParticles(ctx, rd.parts);
  for (const f of rd.floats) {
    const k = f.t / f.max, y = f.y - 38 * ease(k * 1.3), a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.save(); ctx.globalAlpha = a; ctx.font = `700 34px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(f.text).width + 36;
    roundPath(ctx, f.x - w / 2, y - 24, w, 48, 24); ctx.fillStyle = 'rgba(44,24,12,0.86)'; ctx.fill();
    ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, y + 2); ctx.restore();
  }
}
const lookup = (p, id) => { const g = p.ground.find((q) => q.id === id); if (g) return g; if (p.pit.includes(id)) return slotPos(id); return null; };
const lookupCentroid = (p) => (p.ground.length ? { x: p.ground.reduce((a, s) => a + s.x, 0) / p.ground.length, y: p.ground.reduce((a, s) => a + s.y, 0) / p.ground.length } : HOME);
function drawPlanRoute(ctx, stones, dir, t, alpha = 0.26) {
  if (!stones.length) return;
  const pts = [HOME, ...stones, ...(dir === 'in' ? [PIT] : []), HOME];
  drawRoute(ctx, pts, { alpha, t });
}
// A faint marker above the hand showing how high the stone will go.
function drawApex(ctx, h) {
  const z = tossHeightMax(h) * 0.55 * 1, y = HOME.y - z;
  ctx.save(); ctx.strokeStyle = 'rgba(255,244,214,0.6)'; ctx.lineWidth = 3; ctx.setLineDash([4, 8]);
  ctx.beginPath(); ctx.moveTo(HOME.x, HOME.y - 40); ctx.lineTo(HOME.x, y); ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(HOME.x - 22, y); ctx.lineTo(HOME.x + 22, y); ctx.stroke(); ctx.restore();
}

// The tossed stone, its visible arc, the hand and the closing catch ring.
function drawToss(ctx, rd, det) {
  const ev = rd.ev, T = rd.T, h = rd.h, sc = winScale(h);
  const caught = rd.res && rd.res.ok && rd.catchAt !== null && det >= rd.catchAt;
  const hpos = handAt(ev, rd.res && rd.catchAt !== null ? Math.min(det, rd.catchAt) : det);
  // the arc: a dotted path of where the stone will be
  if (!rd.res) {
    ctx.save(); ctx.fillStyle = 'rgba(255,246,222,0.55)';
    for (let i = 1; i < 24; i++) { const u = i / 24; if (u * T < det) continue; const q = tossPos(rd, u * T); ctx.beginPath(); ctx.arc(q.x, q.y - q.z * 0.55, 2.6, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  if (rd.trail.length) drawTrail(ctx, rd.trail);
  if (!rd.res) {
    const inWin = det >= T - WIN_EARLY * sc && det <= T + WIN_LATE * sc;
    const r = 30 + 100 * clamp((T - det) / 0.8, 0, 1);
    drawRing(ctx, rd.L.x, rd.L.y, r, inWin ? 'rgba(255,224,120,0.98)' : 'rgba(255,246,228,0.62)', inWin ? 6 : 3);
    drawRing(ctx, rd.L.x, rd.L.y, 30, 'rgba(255,246,228,0.35)', 2);
    ctx.save(); ctx.fillStyle = 'rgba(255,246,228,0.5)'; ctx.beginPath(); ctx.arc(rd.L.x, rd.L.y, 4, 0, TAU); ctx.fill(); ctx.restore();
  }
  let tp;
  if (caught) tp = { x: hpos.x, y: hpos.y, z: 18 };
  else if (det < T) tp = tossPos(rd, det);
  else {
    const dt = det - T, roll = rd.roll ? rd.roll.ang : 0, k = 1 - Math.exp(-dt * 7);
    const bounce = Math.max(0, 26 * Math.sin(dt * 18) * Math.exp(-dt * 7));
    tp = { x: rd.L.x + Math.cos(roll) * 34 * k, y: rd.L.y + Math.sin(roll) * 22 * k, z: bounce };
  }
  if (!caught) drawGho(ctx, tp.x, tp.y, tp.z, { spin: det * 6 });
  else drawGho(ctx, hpos.x, hpos.y - 6, 22, { alpha: clamp(1 - (det - rd.catchAt) / 0.5, 0, 1) });
  drawHand(ctx, hpos.x, hpos.y, { closed: hpos.dwelling ? 1 : 0, glow: caught ? 1 : 0.3 });
}

// ---- the title's moving yard ------------------------------------------------------------------------------------
export function drawAttract(ctx, state, ox = 30, oy = 70, s = 1) {
  drawFloor(ctx, W, H);
  const a = state.att;
  ctx.save(); ctx.translate(ox, oy); ctx.scale(s, s);
  if (a) drawWorld(ctx, state, a.rd, a.p, { noPlanBadge: true });
  ctx.restore();
}

// ---- the HUD ------------------------------------------------------------------------------------------------------
function coachText(state, hp, rd, T) {
  if (state.toastT > 0 && state.toast) return state.toast;
  const m = state.match, phase = rd.phase, ai = hp.actorIsAI();
  const name = hp.nameOf(rd.who);
  if (m.cfg.mode === 'watch' && rd.beat) {
    const b = rd.beat;
    return `${b.phase === 'think' ? T('beatThink') : b.phase === 'reveal' ? T('beatReveal') : T('beatAct')} · ${name}`;
  }
  if (m.cfg.mode === 'learn') { const tip = T(`tip_${hp.lessonId()}`, null, true); if (tip && phase === 'ready' && m.learnWins === 0) return tip; }
  if (ai) return T('c_ai', { name });
  const ctx = rd.ctx;
  switch (phase) {
    case 'ready': return T('c_ready');
    case 'charge': return T('c_charge');
    case 'air': {
      if (!ctx) return T('c_air');
      if (ctx.sweep) return rd.taps.length ? T('c_air_catch') : T('c_air_sweep');
      if (rd.ev && rd.ev.complete) return T('c_air_catch');
      return rd.taps.length ? T('c_air_n', { n: ctx.take - rd.taps.length, k: ctx.take }) : T('c_air');
    }
    case 'resolve': return rd.res && rd.res.ok ? T('c_ok') : T('c_fail');
    case 'stageclear': return T('c_clear');
    case 'turnend': return T('c_turnend');
    default: return '';
  }
}

function drawHud(ctx, state, hp, L) {
  const rd = state.rd, m = state.match;
  const T = (k, v, soft) => tx(k, v, soft);
  const mm = L.m, mode = m.cfg.len;
  const learn = m.cfg.mode === 'learn';
  for (let i = 0; i < 2; i++) {
    const c = L.cards[i];
    if (learn && i === 1) continue;
    const active = rd.who === i;
    panel(ctx, c.x, c.y, c.w, c.h, { r: 20, fill: 'rgba(46,28,18,0.88)', stroke: active ? '#ffd45e' : 'rgba(255,246,228,0.28)' });
    if (active) { ctx.fillStyle = '#ffd45e'; ctx.beginPath(); ctx.arc(c.x + 20, c.y + c.h * 0.36, 7 * Math.min(mm, 1.4), 0, TAU); ctx.fill(); }
    const nm = hp.nameOf(i);
    const nameFs = fitPx(ctx, nm, 700, 24 * mm, c.w * 0.5 - 34);
    ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `700 ${nameFs}px ${FONT}`;
    ctx.fillText(nm, c.x + 40, c.y + c.h * 0.36);
    if (!learn) {
      const pl = m.ps[i], total = stageCount(mode);
      const lab = pl.stage > total ? T('c_won') : `${T('stageShort', { n: pl.stage })}/${total}`;
      ctx.fillStyle = '#ffe28a'; ctx.textAlign = 'right'; ctx.font = `700 ${fitPx(ctx, lab, 700, 26 * mm, c.w * 0.4)}px ${FONT}`;
      ctx.fillText(lab, c.x + c.w - 16, c.y + c.h * 0.36);
      const bx = c.x + 18, bw = c.w - 36, bh = Math.max(8, Math.round(10 * Math.min(mm, 1.4))), by = c.y + c.h * 0.72;
      roundPath(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,246,228,0.18)'; ctx.fill();
      const pr = progressOf(mode, pl);
      if (pr > 0) { roundPath(ctx, bx, by, Math.max(bh, bw * pr), bh, bh / 2); ctx.fillStyle = '#ffd45e'; ctx.fill(); }
    } else {
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffe28a'; ctx.font = `700 ${Math.round(24 * mm)}px ${FONT}`;
      ctx.fillText(T('lessonLabel', { n: hp.lessonIndex() + 1 }), c.x + c.w - 16, c.y + c.h / 2);
    }
  }
  // stage strip
  const st = L.strip, p = m.ps[rd.who];
  panel(ctx, st.x, st.y, st.w, st.h, { r: 16, fill: 'rgba(46,28,18,0.8)', stroke: 'rgba(255,246,228,0.22)', shadow: false });
  const stage = Math.min(p.stage, stageCount(mode));
  const nTos = tossesPerHalf(mode, stage), take = stageTake(mode, stage);
  const label = `${T('stageShort', { n: stage })} · ${stageName(mode, stage)} · ${p.dir === 'out' ? 'OUT' : 'IN'}`;
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const gap = 22 * Math.min(mm, 1.4), pipsW = nTos * gap + 10;
  const fs = fitPx(ctx, label, 700, 22 * mm, st.w - Math.min(pipsW, st.w * 0.35) - 36);
  ctx.font = `700 ${fs}px ${FONT}`; ctx.fillText(label, st.x + 16, st.y + st.h / 2 + 1);
  const shown = Math.min(nTos, 10), doneT = Math.ceil(p.done / take);
  for (let i = 0; i < shown; i++) {
    const px = st.x + st.w - 18 - (shown - 1 - i) * Math.min(gap, (st.w * 0.3) / shown), py = st.y + st.h / 2;
    ctx.beginPath(); ctx.arc(px, py, 7 * Math.min(mm, 1.4), 0, TAU);
    ctx.fillStyle = i < doneT ? '#ffd45e' : i === doneT ? 'rgba(255,246,228,0.9)' : 'rgba(255,246,228,0.25)'; ctx.fill();
  }
  // coach line
  const cr = L.coach, text = coachText(state, hp, rd, T);
  panel(ctx, cr.x, cr.y, cr.w, cr.h, { r: 16, fill: 'rgba(255,246,228,0.95)', stroke: 'rgba(43,26,16,0.45)', shadow: false });
  ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = Math.round(22 * Math.min(mm, 1.6)), lines;
  for (;;) { ctx.font = `600 ${size}px ${FONT}`; lines = wrapLines(ctx, text, cr.w - 28); if ((lines.length * size * 1.18 <= cr.h - 8) || size <= 13) break; size -= 1; }
  lines.forEach((l, i) => ctx.fillText(l, cr.x + cr.w / 2, cr.y + cr.h / 2 + (i - (lines.length - 1) / 2) * size * 1.18));
}

function drawGauge(ctx, pad, rd, hp, mm) {
  const phase = rd.phase;
  const gx = pad.x + 22, gw = pad.w - 44, gh = Math.round(20 * Math.min(mm, 1.5)), gy = pad.y + pad.h - gh - 16;
  roundPath(ctx, gx, gy, gw, gh, gh / 2); ctx.fillStyle = 'rgba(20,10,4,0.55)'; ctx.fill();
  const h = phase === 'charge' ? rd.chargeH : phase === 'air' || phase === 'resolve' ? rd.h : 0;
  if (h > 0) { roundPath(ctx, gx, gy, Math.max(gh, gw * h), gh, gh / 2); ctx.fillStyle = '#ffd45e'; ctx.fill(); }
  if (rd.hint && rd.hint.kind === 'plan' && !rd.res) { const x = gx + gw * rd.hint.plan.h; ctx.strokeStyle = '#ffd45e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, gy + gh / 2, gh * 0.9, 0, TAU); ctx.stroke(); }
  if (rd.pv) {
    const hMin = clamp((rd.pv.need + 0.06 - AIR_BASE) / AIR_SLOPE, 0, 1), hSafe = clamp((rd.pv.need + 0.2 - AIR_BASE) / AIR_SLOPE, 0, 1);
    const mark = (hh, col) => { const x = gx + gw * hh; ctx.fillStyle = col; ctx.fillRect(x - 2, gy - 6, 4, gh + 12); };
    mark(hMin, '#ff8a70'); mark(hSafe, '#7fe8d6');
  }
  void hp;
}

function drawPad(ctx, state, hp, L) {
  const rd = state.rd, T = (k, v) => tx(k, v);
  const pad = L.pad, mm = L.m, phase = rd.phase, ai = hp.actorIsAI();
  const watch = hp.isWatch();
  let label = '', active = false, dim = false;
  if (watch && rd.beat) {
    const b = rd.beat;
    panel(ctx, pad.x, pad.y, pad.w, pad.h, { r: 22, fill: 'rgba(46,28,18,0.92)', stroke: 'rgba(255,246,228,0.3)' });
    const names = [T('beatThink'), T('beatReveal'), T('beatAct')], idx = b.phase === 'think' ? 0 : b.phase === 'reveal' ? 1 : 2;
    const w3 = (pad.w - 40) / 3;
    names.forEach((n, i) => {
      const x = pad.x + 20 + i * w3;
      roundPath(ctx, x + 4, pad.y + 14, w3 - 8, pad.h - 28, 16); ctx.fillStyle = i === idx ? (i === 0 ? '#ffd45e' : i === 1 ? '#7fe8d6' : '#ff9a86') : 'rgba(255,246,228,0.12)'; ctx.fill();
      ctx.fillStyle = i === idx ? '#2b1a10' : 'rgba(255,246,228,0.7)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${fitPx(ctx, n, 700, 24 * Math.min(mm, 1.5), w3 - 24)}px ${FONT}`;
      ctx.fillText(n, x + w3 / 2, pad.y + pad.h / 2 - (i === idx && idx < 2 ? 8 : 0));
      if (i === idx && idx < 2) { const left = Math.max(0, Math.ceil(b.dur - b.t)); ctx.font = `600 ${Math.round(18 * Math.min(mm, 1.5))}px ${FONT}`; ctx.fillText(`${left} s`, x + w3 / 2, pad.y + pad.h / 2 + 20 * Math.min(mm, 1.5)); }
    });
    return;
  }
  if (ai) { label = T('pad_ai', { name: hp.nameOf(rd.who) }); dim = true; }
  else if (phase === 'ready') { label = T('pad_hold'); active = true; }
  else if (phase === 'charge') { label = T('pad_release'); active = true; }
  else if (phase === 'air') { label = T('pad_catch'); if (rd.ev) { const sc = winScale(rd.h); active = !rd.res && rd.et >= rd.T - WIN_EARLY * sc && rd.et <= rd.T + WIN_LATE * sc; } dim = !active; }
  else {
    const mp = { resolve: rd.res && rd.res.ok ? 'c_ok' : 'c_fail', stageclear: 'c_clear', turnend: 'c_turnend', lessonclear: 'c_clear', learnretry: 'c_fail' };
    label = mp[phase] ? T(mp[phase]) : ''; dim = true;
  }
  panel(ctx, pad.x, pad.y, pad.w, pad.h, { r: 22, fill: active ? 'rgba(213,85,58,0.96)' : dim ? 'rgba(46,28,18,0.84)' : 'rgba(46,28,18,0.92)', stroke: active ? 'rgba(255,230,190,0.9)' : 'rgba(255,246,228,0.3)' });
  ctx.fillStyle = active ? '#fffaf0' : 'rgba(255,246,228,0.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const hasGauge = ['ready', 'charge', 'air', 'resolve'].includes(phase) && !ai;
  const fs = fitPx(ctx, label, 700, 32 * Math.min(mm, 1.5), pad.w - 40);
  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.fillText(label, pad.x + pad.w / 2, pad.y + (hasGauge ? pad.h * 0.34 : pad.h / 2));
  if (hasGauge) {
    drawGauge(ctx, pad, rd, hp, mm);
    if ((phase === 'ready' || phase === 'charge') && rd.pv) {
      const air = airtime(phase === 'charge' ? rd.chargeH : 0.6).toFixed(2);
      const cap = T('pad_cap', { route: rd.pv.need.toFixed(2), air });
      ctx.font = `500 ${Math.round(17 * Math.min(mm, 1.4))}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.8)'; ctx.fillText(cap, pad.x + pad.w / 2, pad.y + pad.h * 0.58 - 4);
    }
  }
}

function drawBar(ctx, state, hp, L) {
  const T = (k, v) => tx(k, v);
  const rd = state.rd;
  drawPad(ctx, state, hp, L);
  if (hp.isWatch()) {
    drawButton(ctx, L.watch.dec, T('w_dec'), { size: 24, disabled: state.settings.thinkIdx === 0 });
    drawButton(ctx, L.watch.pause, state.paused ? T('w_resume') : T('pause'), { size: 24, active: state.paused });
    drawButton(ctx, L.watch.inc, T('w_inc'), { size: 24, disabled: state.settings.thinkIdx === THINK_STEPS.length - 1 });
    drawButton(ctx, L.watch.exit, T('w_exit'), { size: 24, dark: true });
    return;
  }
  const can = ['ready', 'charge'].includes(rd.phase) && !hp.actorIsAI();
  drawButton(ctx, L.think, T('think'), { size: 28 * Math.min(L.m, 1.5) * 0.9, disabled: !can, primary: can && !!rd.hint });
  drawButton(ctx, L.pause, T('pause'), { size: 28 * Math.min(L.m, 1.5) * 0.9, dark: true });
}

function drawHintCard(ctx, state, L, text, title, kindWatch) {
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
  void state;
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
  ctx.fillStyle = b.kind === 'end' ? 'rgba(80,28,22,0.95)' : b.kind === 'clear' ? 'rgba(20,70,56,0.95)' : 'rgba(46,28,18,0.95)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = b.kind === 'clear' ? '#7fe8d6' : b.kind === 'end' ? '#ff9a86' : '#ffd45e'; ctx.stroke();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 25 + size * 0.6 + i * size * 1.2));
  ctx.restore();
  void state;
}

export function renderPlay(ctx, state, hp) {
  const rd = state.rd, L = playLayout(state.settings.textIdx);
  // display time: blend between the last two fixed steps so motion is smooth at any refresh rate
  rd.det = rd.etPrev + (rd.et - rd.etPrev) * (state.alpha ?? 1);
  drawFloor(ctx, W, H);
  ctx.save();
  ctx.translate(L.view.ox, L.view.oy); ctx.scale(L.view.s, L.view.s);
  drawWorld(ctx, state, rd, state.match.ps[rd.who], hp);
  ctx.restore();
  if (rd.flash > 0 && !state.settings.calm) { ctx.fillStyle = `rgba(255,90,70,${0.14 * rd.flash})`; ctx.fillRect(0, 0, W, H); }
  drawHud(ctx, state, hp, L);
  drawBar(ctx, state, hp, L);
  const reason = rd.hint ? rd.hint.text : rd.beat && rd.beat.phase === 'reveal' ? rd.beat.reason : '';
  if (reason) drawHintCard(ctx, state, L, reason, rd.hint ? tx('hintTitle') : tx('revealTitle'), !rd.hint);
  drawBanner(ctx, state, rd, L);
  void DISPLAY; void H_MIN; void MODES;
}
