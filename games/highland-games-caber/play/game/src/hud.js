// The in-play screen on the 2D canvas: top strip, balance pad, action button, the gauges of each event, the choice / result / scoreboard cards, the
// Watch & Learn panel and the flat fallback picture used when WebGL is missing. Pure drawing from game state; game.js owns state.
import { SW, H, host, minU, hudLayout, PLAY_M, TEXT_SCALES } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, fitPx } from './ui.js';
import { CABERS, STONES, BAR_HEIGHTS, WT } from './physics.js';
import { STRIDES, STONE_ANGLE, WIND_FULL, WIND_FOUL, ARC, VB_MAX, SPIN_V0 } from './sim.js';
import { EVENT_NAME, ATTEMPTS, CABER_MULT, MEDALS, EVENT_SHORT } from './consts.js';
import { drawMoreLine } from './brand.js';

const TAU = Math.PI * 2;
export const CARD = { rect: null, max: 0, view: 0 };
let RECTS = [];                         // clickable overlay buttons of this frame: { id, x, y, w, h }
export const overlayRects = () => RECTS;
export const hit = (x, y) => { for (let i = RECTS.length - 1; i >= 0; i--) { const r = RECTS[i]; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id; } return null; };
const addRect = (id, r) => { RECTS.push({ id, x: r.x, y: r.y, w: r.w, h: r.h }); return r; };

const ink = '#f6f0e2';
const gold = '#f0c455', teal = '#7fd6c2', coral = '#ff9a86', moss = '#6fbf7d';
const font = (px, w = 700) => `${w} ${Math.max(Math.round(px), minU())}px ${FONT}`;

function chip(ctx, x, y, w, h, fill = 'rgba(14,22,20,0.74)', edge = 'rgba(246,240,226,0.22)') {
  roundPath(ctx, x, y, w, h, Math.min(18, h / 2)); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke();
}

// ---------------------------------------------------------------------------------------------------------------------------------
export function renderHud(ctx, G, v, hudIn) {
  RECTS = [];
  const s = G.sim; if (!s) return;
  const M = PLAY_M[G.settings.textIdx];
  const L = hudLayout(G.settings.textIdx);
  G.lay = L;
  const watch = G.mode === 'watch';
  drawTop(ctx, G, s, L, M);
  if (!watch) { drawPauseThink(ctx, G, L); }
  if (s.ph === 'choose') drawChoose(ctx, G, s, L, M);
  else if (s.ph === 'evend') drawEventEnd(ctx, G, s, L, M);
  else {
    if (!watch || s.hold !== undefined) drawControls(ctx, G, s, L, M, watch);
    if (s.ph === 'judge') drawResult(ctx, G, s, L, M);
    else if (s.replay) drawReplayBadge(ctx, G, s, L);
  }
  if (watch) drawWatch(ctx, G, s, L, M);
  else if (G.think) drawThink(ctx, G, s, L, M);
  drawFeedback(ctx, G, s, L, M);
}

function drawTop(ctx, G, s, L, M) {
  const t = L.top;
  chip(ctx, t.x, t.y, t.w, t.h);
  ctx.textBaseline = 'middle';
  const pad = 16, mid = t.y + t.h / 2;
  const fsA = fitPx(ctx, EVENT_NAME[s.event], 700, 30 * Math.min(M, 1.4), t.w * (L.land ? 0.34 : 0.5) - pad, 13);
  ctx.font = font(fsA); ctx.fillStyle = gold; ctx.textAlign = 'left';
  ctx.fillText(EVENT_NAME[s.event], t.x + pad, mid - (t.h > 70 ? 14 : 8) * 1);
  const att = s.event === 'weight' ? `Try ${s.attempt + 1} of ${ATTEMPTS.weight}` : `Throw ${s.attempt + 1} of ${ATTEMPTS[s.event]}`;
  ctx.font = font(Math.max(15, fsA * 0.72), 500); ctx.fillStyle = 'rgba(246,240,226,0.82)';
  ctx.fillText(att, t.x + pad, mid + (t.h > 70 ? 16 : 14));
  // event dots + points on the right
  ctx.textAlign = 'right';
  const total = s.total;
  ctx.font = font(Math.max(15, fsA * 0.72), 500); ctx.fillStyle = 'rgba(246,240,226,0.82)';
  ctx.fillText('Festival points', t.x + t.w - pad, mid + (t.h > 70 ? 16 : 14));
  ctx.font = font(fsA * 1.15); ctx.fillStyle = ink;
  ctx.fillText(String(total), t.x + t.w - pad, mid - (t.h > 70 ? 14 : 8));
  if (s.mode === 'festival' && L.land === false) {
    // small event progress pips in the middle
    const cx = t.x + t.w * 0.56;
    s.list.forEach((e, i) => { ctx.beginPath(); ctx.arc(cx + (i - 1) * 22, mid - 2, 7, 0, TAU); ctx.fillStyle = i < s.idx ? moss : i === s.idx ? gold : 'rgba(246,240,226,0.25)'; ctx.fill(); });
  }
  ctx.textBaseline = 'alphabetic';
}

function drawPauseThink(ctx, G, L) {
  const s = G.sim;
  drawButton(ctx, addRect('pause', L.pause), 'Pause', { dark: true, size: Math.round(L.uh * 0.4) });
  const tb = addRect('think', L.think);
  drawButton(ctx, tb, 'Think', { dark: true, size: Math.round(L.uh * 0.4) });
}

// ---------------------------------------------------------------------------------------------------------------------------------
function controlsOn(s) { return s.ph === 'lift' || s.ph === 'run' || s.ph === 'heave' || s.ph === 'angle' || s.ph === 'wind' || s.ph === 'spin' || s.ph === 'fly'; }

function drawPad(ctx, G, s, L, active) {
  const p = L.pad;
  ctx.save();
  ctx.globalAlpha = active ? 1 : 0.45;
  const g = ctx.createRadialGradient(p.x, p.y, p.r * 0.2, p.x, p.y, p.r);
  g.addColorStop(0, 'rgba(24,36,32,0.30)'); g.addColorStop(1, 'rgba(24,36,32,0.74)');
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(246,240,226,0.38)'; ctx.stroke();
  // target ring (the steady zone) and the lean dot
  const sr = p.r * (0.14 / 0.8);
  ctx.beginPath(); ctx.arc(p.x, p.y, sr, 0, TAU); ctx.strokeStyle = 'rgba(111,191,125,0.9)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(246,240,226,0.2)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(p.x - p.r * 0.9, p.y); ctx.lineTo(p.x + p.r * 0.9, p.y); ctx.moveTo(p.x, p.y - p.r * 0.9); ctx.lineTo(p.x, p.y + p.r * 0.9); ctx.stroke();
  if (s.cab && (s.ph === 'lift' || s.ph === 'run' || s.ph === 'heave')) {
    const c = s.cab;
    // dot position in pad frame: portrait x = lean to the right (= -left), y = -forward ; landscape x = forward, y = -left
    const bx = c.bx, bz = c.bz;
    const dx = (L.land ? bx : -bz) / 0.8 * p.r, dy = (L.land ? -bz : -bx) / 0.8 * p.r;
    const m = Math.hypot(dx, dy), k = m > p.r * 0.95 ? (p.r * 0.95) / m : 1;
    const danger = Math.hypot(bx, bz) > 0.5;
    ctx.beginPath(); ctx.arc(p.x + dx * k, p.y + dy * k, 14, 0, TAU); ctx.fillStyle = danger ? coral : gold; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#2a2014'; ctx.stroke();
    if (G.pad && G.pad.active) { ctx.beginPath(); ctx.arc(p.x + G.pad.x * p.r, p.y + G.pad.y * p.r, 9, 0, TAU); ctx.fillStyle = 'rgba(246,240,226,0.9)'; ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(246,240,226,0.8)'; ctx.font = font(Math.max(15, p.r * 0.14)); ctx.textAlign = 'center';
  ctx.fillText('BALANCE', p.x, p.y + p.r * 0.78);
  ctx.restore();
}

function drawButtonRound(ctx, G, s, L) {
  const b = L.btn;
  let label = '', sub = '', on = true, col = '#3d7a4c';
  if (s.event === 'caber') {
    if (s.ph === 'run') { label = 'STRIDE'; }
    else if (s.ph === 'heave') { label = 'HEAVE'; col = '#b9892f'; }
    else { label = 'STRIDE'; on = false; }
  } else if (s.event === 'stone') {
    if (s.ph === 'angle') { label = 'LOCK'; sub = 'angle'; col = '#b9892f'; }
    else if (s.ph === 'wind') { label = s.st.wind ? 'RELEASE' : 'HOLD'; sub = s.st.wind ? 'to put' : 'to wind up'; }
    else on = false, label = 'PUT';
  } else {
    if (s.ph === 'spin') { label = s.wt.inArc ? 'LET GO' : 'SPIN'; col = s.wt.inArc ? '#b9892f' : '#3d7a4c'; }
    else on = false, label = 'SPIN';
  }
  const down = G.btnDown;
  ctx.save();
  ctx.globalAlpha = on ? 1 : 0.45;
  ctx.beginPath(); ctx.arc(b.x, b.y + (down ? 3 : 6), b.r, 0, TAU); ctx.fillStyle = 'rgba(7,13,12,0.4)'; ctx.fill();
  const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r);
  g.addColorStop(0, '#ffffff22'); g.addColorStop(1, '#00000022');
  ctx.beginPath(); ctx.arc(b.x, b.y + (down ? 3 : 0), b.r, 0, TAU); ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(246,240,226,0.55)'; ctx.stroke();
  ctx.fillStyle = '#fffaf0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fs = fitPx(ctx, label, 800, b.r * 0.34, b.r * 1.6, 14);
  ctx.font = font(fs, 800); ctx.fillText(label, b.x, b.y + (down ? 3 : 0) - (sub ? fs * 0.25 : 0));
  if (sub) { ctx.font = font(fs * 0.55, 500); ctx.globalAlpha *= 0.85; ctx.fillText(sub, b.x, b.y + fs * 0.55 + (down ? 3 : 0)); }
  ctx.restore();
  // rhythm ring: closes on the button at the beat
  const ring = beatRing(s);
  if (ring) {
    const f = ring.f;                                   // 1 = far, 0 = on the button
    ctx.save();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1 + 0.9 * f), 0, TAU);
    ctx.lineWidth = 6 - 3 * f; ctx.strokeStyle = ring.col; ctx.globalAlpha = 0.25 + 0.7 * (1 - f); ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.02, 0, TAU); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(246,240,226,0.8)'; ctx.globalAlpha = 0.9; ctx.stroke();
    ctx.restore();
  }
}
function beatRing(s) {
  if (s.event === 'caber' && s.ph === 'run') {
    const c = s.cab, P = s.lv.beat, k = c.resolved;
    if (k >= STRIDES) return null;
    const bt = c.beat0 + k * P, d = bt - s.t;
    if (d > 0.9) return null;
    return { f: Math.max(0, Math.min(1, d / 0.9)), col: Math.abs(d) < 0.06 ? gold : teal };
  }
  if (s.event === 'weight' && s.ph === 'spin' && !s.wt.inArc) {
    const w = s.wt, a = ((w.a % TAU) + TAU) % TAU;
    const toNext = ((TAU - a) % TAU) / Math.max(0.5, w.w);
    if (toNext > 0.9) return null;
    return { f: Math.min(1, toNext / 0.9), col: toNext < 0.07 ? gold : teal };
  }
  return null;
}

function gaugeBar(ctx, r, frac, o = {}) {
  roundPath(ctx, r.x, r.y, r.w, r.h, r.h / 2); ctx.fillStyle = 'rgba(14,22,20,0.82)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(246,240,226,0.3)'; ctx.stroke();
  if (o.zones) for (const z of o.zones) { roundPath(ctx, r.x + r.w * z.lo, r.y + 3, Math.max(4, r.w * (z.hi - z.lo)), r.h - 6, (r.h - 6) / 2); ctx.fillStyle = z.col; ctx.fill(); }
  if (frac !== null && frac !== undefined && o.fill) { roundPath(ctx, r.x + 3, r.y + 3, Math.max(r.h - 6, (r.w - 6) * frac), r.h - 6, (r.h - 6) / 2); ctx.fillStyle = o.fill; ctx.fill(); }
  if (o.cursor !== undefined && o.cursor !== null) { const cx = r.x + r.w * o.cursor; ctx.fillStyle = '#fff'; roundPath(ctx, cx - 5, r.y - 8, 10, r.h + 16, 4); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#2a2014'; ctx.stroke(); }
}

function drawControls(ctx, G, s, L, M, watch) {
  if (!controlsOn(s) && s.ph !== 'judge') return;
  const G0 = L.gauge, k = M;
  const showPad = s.event === 'caber' && (s.ph === 'lift' || s.ph === 'run' || s.ph === 'heave');
  if (!watch) { if (s.event === 'caber') drawPad(ctx, G, s, L, showPad); drawButtonRound(ctx, G, s, L); }
  else if (showPad) drawPad(ctx, G, s, L, true);
  if (s.ph === 'judge') return;
  const lbl = (txt, x, y, col = ink, px = 24 * Math.min(k, 1.3), al = 'center') => { ctx.fillStyle = col; ctx.font = font(px, 700); ctx.textAlign = al; ctx.fillText(txt, x, y); };
  const bar = { x: G0.x + 10, y: G0.y + G0.h - 62, w: G0.w - 20, h: 36 };
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4;
  if (s.event === 'caber' && s.cab) {
    const c = s.cab;
    if (s.ph === 'lift') {
      lbl(c.dropT > 0 ? 'Dropped! Pick it up again' : 'Hold the caber steady', G0.x + G0.w / 2, bar.y - 18, c.dropT > 0 ? coral : ink);
      gaugeBar(ctx, bar, c.steady / 1.6, { fill: moss });
      lbl(`${s.cab.cab.name}  ·  ${s.cab.cab.ft}  ·  ${s.cab.cab.kg}`, G0.x + G0.w / 2, bar.y + bar.h + 26, 'rgba(246,240,226,0.8)', 19 * Math.min(k, 1.2));
    } else if (s.ph === 'run') {
      lbl('Tap STRIDE on each beat', G0.x + G0.w / 2, bar.y - 52, ink);
      // six pips
      const pw = 34, gap = 14, total = STRIDES * pw + (STRIDES - 1) * gap, x0 = G0.x + G0.w / 2 - total / 2;
      for (let i = 0; i < STRIDES; i++) {
        const q = c.strides[i];
        roundPath(ctx, x0 + i * (pw + gap), bar.y - 38, pw, 16, 8);
        ctx.fillStyle = q === undefined ? (i === c.resolved ? 'rgba(246,240,226,0.55)' : 'rgba(246,240,226,0.2)') : q >= 1 ? gold : q >= 0.7 ? moss : q >= 0.4 ? teal : coral; ctx.fill();
      }
      gaugeBar(ctx, bar, c.v / 7, { fill: teal });
      lbl(`Pace ${c.v.toFixed(1)} m/s`, G0.x + G0.w / 2, bar.y + bar.h + 26, 'rgba(246,240,226,0.85)', 19 * Math.min(k, 1.2));
    } else if (s.ph === 'heave') {
      lbl(c.zone ? 'Tap HEAVE while the cursor is in the green' : 'Too slow to turn it: just heave', G0.x + G0.w / 2, bar.y - 18, ink);
      const zones = [];
      if (c.zone && s.lv.zone) { zones.push({ lo: c.zone.lo, hi: c.zone.hi, col: 'rgba(111,191,125,0.85)' }); zones.push({ lo: c.zone.mid - c.zone.half * 0.3, hi: c.zone.mid + c.zone.half * 0.3, col: gold }); }
      else if (c.zone) zones.push({ lo: c.zone.mid - 0.012, hi: c.zone.mid + 0.012, col: gold });
      gaugeBar(ctx, bar, null, { zones, cursor: c.sweepT > 0 ? c.tau : 0 });
      ctx.fillStyle = 'rgba(246,240,226,0.7)'; ctx.font = font(17, 500); ctx.textAlign = 'left'; ctx.fillText('early: falls back', bar.x + 6, bar.y + bar.h + 24); ctx.textAlign = 'right'; ctx.fillText('late: spins too far', bar.x + bar.w - 6, bar.y + bar.h + 24);
    }
  } else if (s.event === 'stone' && s.st) {
    const q = s.st;
    if (s.ph === 'angle') {
      lbl('Tap to lock the angle', G0.x + G0.w / 2, bar.y - 18, ink);
      const fr = (q.angle - STONE_ANGLE.lo) / (STONE_ANGLE.hi - STONE_ANGLE.lo), idl = (STONE_ANGLE.ideal - STONE_ANGLE.lo) / (STONE_ANGLE.hi - STONE_ANGLE.lo);
      const zones = s.lv.zone ? [{ lo: idl - 0.12, hi: idl + 0.12, col: 'rgba(111,191,125,0.85)' }, { lo: idl - 0.025, hi: idl + 0.025, col: gold }] : [];
      gaugeBar(ctx, bar, null, { zones, cursor: fr });
      lbl(`${Math.round(q.angle)}°`, G0.x + G0.w / 2, bar.y + bar.h + 28, ink, 24 * Math.min(k, 1.2));
    } else if (s.ph === 'wind') {
      lbl(q.wind ? 'Release near full power' : `Hold to wind up  ·  angle ${Math.round(q.locked)}°`, G0.x + G0.w / 2, bar.y - 18, ink);
      const p = q.wind ? q.windT / WIND_FULL : 0;
      const over = q.wind && p > 1;
      gaugeBar(ctx, bar, Math.min(1, p) , { fill: over ? coral : moss, zones: [{ lo: 0.9, hi: 1.0, col: 'rgba(240,196,85,0.55)' }] });
      if (over) { lbl('Too long: you will step over the board', G0.x + G0.w / 2, bar.y + bar.h + 28, coral, 20 * Math.min(k, 1.2)); }
    }
  } else if (s.event === 'weight' && s.wt) {
    const w = s.wt;
    if (s.ph === 'spin') {
      const need = G.sim ? G.needSpeed : 10;
      lbl(w.inArc ? 'NOW: tap to let go' : 'Tap at the bottom to spin it up', G0.x + G0.w / 2, bar.y - 18, w.inArc ? gold : ink);
      const need0 = G.needSpeed || 10;
      gaugeBar(ctx, bar, (w.vb - 6.5) / (VB_MAX - 6.5), { fill: teal, zones: [{ lo: Math.max(0, (need0 - 6.5) / (VB_MAX - 6.5)), hi: Math.min(1, (need0 + 1.4 - 6.5) / (VB_MAX - 6.5)), col: 'rgba(240,196,85,0.45)' }] });
      lbl(`Speed ${w.vb.toFixed(1)} m/s  ·  bar ${w.bar.toFixed(1)} m needs about ${need0.toFixed(1)}`, G0.x + G0.w / 2, bar.y + bar.h + 26, 'rgba(246,240,226,0.85)', 18 * Math.min(k, 1.2));
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------------------------
function centerPanel(ctx, L, w, h, y0) {
  const cx = SW / 2;
  const x = cx - w / 2;
  panel(ctx, x, y0, w, h, { r: 26, fill: 'rgba(16,26,23,0.92)', stroke: 'rgba(246,240,226,0.4)' });
  return { x, y: y0, w, h };
}

function drawChoose(ctx, G, s, L, M) {
  const opts = chooseOptions(s);
  const w = Math.min(SW - 40 - host.l - host.r, 600);
  const avail = H - host.b - (L.pause.y + L.pause.h + 14) - 12;
  let mm = Math.min(M, 1.8);
  const dims = (m) => { const rh = Math.round(94 * m), hd = Math.round(120 * m); return { rowH: rh, head: hd, h: hd + opts.length * (rh + 12) + 18 }; };
  while (mm > 0.8 && dims(mm).h > avail) mm -= 0.05;
  const { rowH, head, h } = dims(mm);
  const y0 = Math.max(L.pause.y + L.pause.h + 14, Math.min((H - h) / 2, H - host.b - h - 20));
  const hh = Math.min(h, H - host.b - y0 - 12);
  const p = centerPanel(ctx, L, w, hh, y0);
  ctx.textAlign = 'center'; ctx.fillStyle = gold; ctx.font = font(30 * mm, 800);
  const title = s.event === 'caber' ? 'Choose your caber' : s.event === 'stone' ? 'Choose your stone' : 'Choose the bar height';
  ctx.fillText(title, p.x + w / 2, p.y + 46 * mm);
  ctx.fillStyle = 'rgba(246,240,226,0.8)'; ctx.font = font(18 * mm, 500);
  const sub = s.event === 'caber' ? `Throw ${s.attempt + 1} of 3. Heavier cabers score more.` : s.event === 'stone' ? `Throw ${s.attempt + 1} of 3.` : `Try ${s.attempt + 1} of 5. The bar rises 0.3 m after each clear.`;
  ctx.fillText(sub, p.x + w / 2, p.y + 80 * mm);
  opts.forEach((o, i) => {
    const r = { x: p.x + 18, y: p.y + head + i * (rowH + 12), w: w - 36, h: rowH };
    addRect(`pick:${o.id}`, r);
    drawButton(ctx, r, o.label, { primary: o.rec, sub: o.sub, size: Math.round(28 * mm) });
  });
}
export function chooseOptions(s) {
  if (s.event === 'caber') return CABERS.map((c) => ({ id: c.id, label: c.name, sub: `${c.ft} · ${c.kg} · up to ${Math.min(100, Math.round(100 * CABER_MULT[c.id]))} points`, rec: c.id === ['glen', 'braemar', 'champion'][s.attempt] }));
  if (s.event === 'stone') return STONES.map((c) => ({ id: c.id, label: c.name, sub: `${c.lb} · ${c.kg}${c.id === 'light' ? ' · flies further, scores a little less' : ''}`, rec: c.id === 'heavy' }));
  const base = s.attempt === 0 ? 1 : (s.wt ? (s.wt.nextIdx ?? s.wt.barIdx) : 1);
  const idxs = s.attempt === 0 ? [0, 2, 4] : [Math.max(0, base - 1), base, Math.min(BAR_HEIGHTS.length - 1, base + 1)].filter((x, i, a) => a.indexOf(x) === i);
  return idxs.map((i) => ({ id: String(i), label: `${BAR_HEIGHTS[i].toFixed(1)} m`, sub: s.attempt === 0 ? (i === 0 ? 'Safe start' : i === 2 ? 'Confident' : 'Bold') : (i < base ? 'Lower' : i === base ? (s.res && s.res.cleared ? 'Next height' : 'Try again') : 'Raise'), rec: i === base }));
}

function drawResult(ctx, G, s, L, M) {
  const res = s.res; if (!res) return;
  const w = Math.min(SW - 36 - host.l - host.r, L.land ? 520 : 640);
  const lines = resultLines(s, res);
  const availH = H - host.b - (L.land ? L.top.y + L.top.h + 12 : L.pause.y + L.pause.h + 18) - 12;
  let mm = Math.min(M, 1.8), big, sm, h;
  const meas = (m) => { big = 54 * m; sm = 22 * m; h = 60 + big + lines.length * (sm * 1.45) + sm * 2.2 + 30 + (G.mode === 'watch' ? 0 : 92); return h; };
  while (mm > 0.75 && meas(mm) > availH) mm -= 0.05;
  meas(mm);
  const x = L.land ? SW - host.r - 24 - w : SW / 2 - w / 2;
  const y0 = L.land ? Math.max(L.top.y + L.top.h + 12, (H - h) / 2 - 20) : Math.max(L.pause.y + L.pause.h + 18, H * 0.2);
  const p = { x, y: y0, w, h };
  panel(ctx, p.x, p.y, p.w, p.h, { r: 26, fill: 'rgba(16,26,23,0.92)', stroke: 'rgba(246,240,226,0.4)' });
  ctx.textAlign = 'center';
  const col = res.pts >= 70 ? gold : res.pts > 0 ? teal : coral;
  ctx.fillStyle = col; ctx.font = font(fitPx(ctx, res.text, 800, big, w - 40, 20), 800);
  ctx.fillText(res.text, p.x + w / 2, p.y + 36 + big * 0.85);
  let y = p.y + 54 + big;
  ctx.fillStyle = ink; ctx.font = font(sm, 500);
  for (const l of lines) { y += sm * 1.45; ctx.fillText(l, p.x + w / 2, y); }
  y += sm * 1.5;
  ctx.fillStyle = gold; ctx.font = font(sm * 1.35, 800); ctx.fillText(`${res.pts} points`, p.x + w / 2, y);
  if (G.mode !== 'watch') {
    const bw = (w - 54) / 2, by = p.y + p.h - 84;
    const canReplay = s.event === 'caber' ? !!(s.cab && s.cab.res && s.cab.res.frames) : s.event === 'stone' ? !!(s.st && s.st.fly) : !!(s.wt && s.wt.fly);
    const rp = addRect('replay', { x: p.x + 18, y: by, w: bw, h: 68 });
    drawButton(ctx, rp, 'Slow-mo replay', { dark: true, disabled: !canReplay, size: 24 });
    const nx = addRect('next', { x: p.x + 36 + bw, y: by, w: bw, h: 68 });
    const last = s.attempt + 1 >= ATTEMPTS[s.event];
    drawButton(ctx, nx, last ? 'Finish event' : s.event === 'weight' ? 'Next try' : 'Next throw', { primary: true, size: 26 });
  }
}
function resultLines(s, r) {
  const o = [];
  if (s.event === 'caber') {
    if (r.kind === 'turned') {
      const dg = Math.abs(r.psi), side = r.psi < 0 ? 'left' : 'right';
      o.push(`Clock ${r.clock}  ${dg <= 3 ? '(12 o\'clock!)' : `(${dg.toFixed(0)}° ${side} of 12)`}`);
      o.push(`Line ${Math.abs(r.line).toFixed(2)} m ${r.line < 0 ? 'left' : 'right'} of centre`);
      o.push(`Turn 40 · Clock ${r.clockPts} · Line ${r.linePts}`);
    } else if (r.kind === 'fellback') o.push('The heavy end landed, but the pole fell back toward you.');
    else if (r.kind === 'short') o.push('The pole came down on its small end. Heave later in the sweep.');
    else if (r.kind === 'over') o.push('The pole spun past upright. Heave earlier.');
    else o.push(r.why || '');
  } else if (s.event === 'stone') {
    if (r.kind === 'put') { o.push(`${s.st.stone.name} at ${Math.round(s.st.locked)}°`); o.push(`Power ${Math.round(s.st.power * 100)}%`); } else o.push('Stepped over the board. No mark.');
  } else {
    o.push(`Bar ${r.bar.toFixed(2)} m`);
    if (r.margin != null) o.push(r.cleared ? `Cleared by ${(r.margin * 100).toFixed(0)} cm` : `Passed ${(Math.abs(r.margin) * 100).toFixed(0)} cm ${r.margin < 0 ? 'below' : 'over'} the bar`);
    else o.push('The weight did not reach the bar.');
  }
  return o.filter(Boolean);
}

function drawEventEnd(ctx, G, s, L, M) {
  const card = s.card; if (!card) return;
  const w = Math.min(SW - 36 - host.l - host.r, 560);
  const rows = card.board;
  const availE = H - host.b - (L.pause.y + L.pause.h + 12) - 12;
  let mm = Math.min(M, 1.8);
  while (mm > 0.75 && 150 + rows.length * Math.round(46 * mm) + 100 > availE) mm -= 0.05;
  const rh = Math.round(46 * mm);
  const h = 150 + rows.length * rh + 100;
  const y0 = Math.max(L.pause.y + L.pause.h + 12, (H - h) / 2);
  const p = { x: SW / 2 - w / 2, y: y0, w, h: Math.min(h, H - host.b - y0 - 10) };
  panel(ctx, p.x, p.y, p.w, p.h, { r: 26, fill: 'rgba(16,26,23,0.94)', stroke: 'rgba(246,240,226,0.4)' });
  ctx.textAlign = 'center'; ctx.fillStyle = gold; ctx.font = font(34 * mm, 800); ctx.fillText(EVENT_NAME[card.event], p.x + w / 2, p.y + 52);
  ctx.fillStyle = ink; ctx.font = font(22 * mm, 500); ctx.fillText(`Your best: ${card.pts} points`, p.x + w / 2, p.y + 88);
  rows.forEach((r, i) => {
    const y = p.y + 112 + i * rh;
    if (r.you) { roundPath(ctx, p.x + 16, y, w - 32, rh - 6, 12); ctx.fillStyle = 'rgba(240,196,85,0.22)'; ctx.fill(); }
    ctx.textAlign = 'left'; ctx.fillStyle = r.you ? gold : ink; ctx.font = font(22 * mm, r.you ? 800 : 500);
    ctx.fillText(`${i + 1}.  ${r.name}`, p.x + 34, y + rh * 0.62);
    ctx.textAlign = 'right'; ctx.fillText(String(r.pts), p.x + w - 34, y + rh * 0.62);
  });
  if (G.mode !== 'watch') {
    const bt = addRect('next', { x: p.x + 24, y: p.y + p.h - 84, w: w - 48, h: 68 });
    drawButton(ctx, bt, s.idx + 1 < s.list.length ? 'Next event' : 'See the results', { primary: true, size: 28 });
  }
}

function drawReplayBadge(ctx, G, s, L) {
  const r = { x: SW / 2 - 120, y: L.pause.y + 4, w: 240, h: 44 };
  chip(ctx, r.x, r.y, r.w, r.h, 'rgba(14,22,20,0.8)');
  ctx.fillStyle = gold; ctx.font = font(20, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SLOW-MO REPLAY', r.x + r.w / 2, r.y + r.h / 2 + 1); ctx.textBaseline = 'alphabetic';
  addRect('skipreplay', { x: 0, y: 0, w: 1, h: 1 });
  const sk = addRect('skipreplay', { x: SW / 2 - 100, y: r.y + r.h + 8, w: 200, h: 54 });
  drawButton(ctx, sk, 'Skip', { dark: true, size: 22 });
}

// ---------------------------------------------------------------------------------------------------------------------------------
function textBlock(ctx, text, x, y, w, px, lh, maxLines = 99) {
  ctx.font = font(px, 400); const ls = wrapLines(ctx, text, w); let n = 0;
  for (const l of ls) { if (n++ >= maxLines) break; ctx.fillText(l, x, y); y += lh; }
  return y;
}

function drawThink(ctx, G, s, L, M) {
  const t = G.think; if (!t) return;
  const w = Math.min(SW - 36 - host.l - host.r, 620), px = 21 * Math.min(M, 1.4);
  ctx.font = font(px, 400); const lines = wrapLines(ctx, t.reason, w - 40);
  const h = 140 + lines.length * px * 1.3;
  const y0 = Math.max(L.pause.y + L.pause.h + 12, 0), hh = Math.min(h, H * 0.62);
  const p = { x: SW / 2 - w / 2, y: y0, w, h: hh };
  panel(ctx, p.x, p.y, p.w, p.h, { r: 22, fill: 'rgba(16,26,23,0.95)', stroke: 'rgba(246,240,226,0.45)' });
  ctx.textAlign = 'left'; ctx.fillStyle = gold; ctx.font = font(26 * Math.min(M, 1.3), 800); ctx.fillText(t.summary, p.x + 20, p.y + 44);
  ctx.fillStyle = ink;
  ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y + 56, p.w, p.h - 130); ctx.clip();
  const sc = G.ui.cardScroll || 0;
  const endY = textBlock(ctx, t.reason, p.x + 20, p.y + 84 - sc, w - 40, px, px * 1.3);
  ctx.restore();
  CARD.rect = { x: p.x, y: p.y + 56, w: p.w, h: p.h - 130 }; CARD.view = p.h - 130; CARD.max = Math.max(0, lines.length * px * 1.3 + 40 - CARD.view);
  const cl = addRect('think-close', { x: p.x + 20, y: p.y + p.h - 68, w: w - 40, h: 54 });
  drawButton(ctx, cl, 'Got it', { primary: true, size: 24 });
}

export function watchRects() { return G_WATCH; }
let G_WATCH = [];
function drawWatch(ctx, G, s, L, M) {
  const W2 = G.watch;
  const hold = s.hold;
  const w = Math.min(SW - 24 - host.l - host.r, L.land ? 560 : 660);
  const px = 20 * Math.min(M, 1.4);
  const x = L.land ? host.l + 14 : SW / 2 - w / 2;
  let y = L.land ? L.top.y + L.top.h + 10 : L.top.y + L.top.h + 10;
  // header chips: Watch & Learn + controls
  const ph = W2.phase;
  const hdrH = 56;
  chip(ctx, x, y, w, hdrH, 'rgba(14,22,20,0.82)');
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = gold; ctx.font = font(20 * Math.min(M, 1.2), 800);
  ctx.fillText(W2.paused ? 'PAUSED' : hold ? (ph === 'think' ? 'THINK' : 'REVEAL') : 'ACT', x + 16, y + hdrH / 2);
  const bw = 100, bh = 40, bx = x + w - 16 - bw * 3 - 16, by = y + (hdrH - bh) / 2;
  G_WATCH = [];
  const btn = (id, label, i, o = {}) => { const r = addRect(id, { x: bx + i * (bw + 8), y: by, w: bw, h: bh }); drawButton(ctx, r, label, { dark: true, size: 18, ...o }); };
  btn('w-pause', W2.paused ? 'Resume' : 'Pause', 0);
  btn('w-faster', 'Shorter', 1); btn('w-slower', 'Longer', 2);
  const qr = addRect('w-quit', { x: x + w - 16 - bw * 3 - 16 - 84, y: by, w: 76, h: bh }); drawButton(ctx, qr, 'Quit', { dark: true, size: 18 });
  ctx.textBaseline = 'alphabetic';
  y += hdrH + 8;
  if (hold) {
    ctx.font = font(px, 400); const lines = wrapLines(ctx, hold.reason, w - 36);
    const h = 70 + lines.length * px * 1.3 + 22;
    const hh = Math.min(h, H * (L.land ? 0.5 : 0.36));
    panel(ctx, x, y, w, hh, { r: 20, fill: 'rgba(16,26,23,0.9)', stroke: 'rgba(246,240,226,0.35)' });
    ctx.textAlign = 'left'; ctx.fillStyle = ink; ctx.font = font(24 * Math.min(M, 1.3), 800); ctx.fillText(hold.summary, x + 18, y + 38);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y + 48, w, hh - 74); ctx.clip();
    const sc = G.ui.cardScroll || 0;
    ctx.fillStyle = 'rgba(246,240,226,0.92)';
    textBlock(ctx, hold.reason, x + 18, y + 74 - sc, w - 36, px, px * 1.3);
    ctx.restore();
    CARD.rect = { x, y: y + 48, w, h: hh - 74 }; CARD.view = hh - 74; CARD.max = Math.max(0, lines.length * px * 1.3 + 30 - CARD.view);
    // timer bar
    const tw = w - 36, total = W2.phase === 'think' ? G.thinkTotal : 2;
    roundPath(ctx, x + 18, y + hh - 18, tw, 8, 4); ctx.fillStyle = 'rgba(246,240,226,0.2)'; ctx.fill();
    roundPath(ctx, x + 18, y + hh - 18, Math.max(8, tw * (1 - W2.timer / Math.max(0.1, total))), 8, 4); ctx.fillStyle = W2.phase === 'think' ? gold : teal; ctx.fill();
  }
}

function drawFeedback(ctx, G, s, L, M) {
  const f = G.feedback;
  if (!f || s.t - f.t > 1.1) return;
  const a = 1 - Math.max(0, (s.t - f.t - 0.6) / 0.5);
  ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'center';
  ctx.font = font(44 * Math.min(M, 1.2), 800); ctx.fillStyle = f.col;
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8;
  const y = L.gauge.y - 20 - (s.t - f.t) * 40;
  ctx.fillText(f.text, L.land ? SW / 2 : SW / 2, y); ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Flat picture used when WebGL is not available: sky, hills, grass and a side-on view of the pole and thrower.
export function renderFallback(ctx, G, v) {
  const s = G.sim; if (!s) return;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9cc3e8'); g.addColorStop(0.55, '#cfe2ef'); g.addColorStop(0.56, '#5f8f4b'); g.addColorStop(1, '#3f6f3b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, H);
  ctx.fillStyle = '#6f7d92'; ctx.beginPath(); ctx.moveTo(0, H * 0.56); for (let i = 0; i <= 8; i++) ctx.lineTo((SW / 8) * i, H * 0.56 - 60 - 50 * Math.abs(Math.sin(i * 1.7))); ctx.lineTo(SW, H * 0.56); ctx.fill();
  const gy = H * 0.7, sc = Math.min(SW, H) / 14;      // pixels per metre
  const ax = SW * 0.3;
  ctx.fillStyle = '#e8dcc0'; ctx.fillRect(0, gy, SW, 4);
  ctx.strokeStyle = '#2a2014'; ctx.lineCap = 'round';
  const X = (f) => ax + f * sc, Y = (y) => gy - y * sc;
  if (s.event === 'caber' && s.cab) {
    const c = s.cab, cab = c.cab;
    let f = 0.45, ys = 1.12, th = 0.15 + c.bx;
    if (s.ph === 'fly' && c.res) { const fr = c.res.frames, i = Math.min(fr.length - 1, Math.max(0, Math.round(Math.max(0, c.flyT) * 60))); const q = fr[i]; th = q.th; f = q.f - cab.d * Math.sin(q.th); ys = q.y - cab.d * Math.cos(q.th); }
    ctx.lineWidth = 12; ctx.strokeStyle = '#7a5a34';
    ctx.beginPath(); ctx.moveTo(X(f), Y(ys)); ctx.lineTo(X(f + cab.L * Math.sin(th)), Y(ys + cab.L * Math.cos(th))); ctx.stroke();
  }
  ctx.lineWidth = 8; ctx.strokeStyle = '#25533a'; ctx.beginPath(); ctx.moveTo(ax, gy); ctx.lineTo(ax, gy - 1.0 * sc); ctx.stroke();
  ctx.beginPath(); ctx.arc(ax, gy - 1.25 * sc, 0.16 * sc, 0, TAU); ctx.fillStyle = '#e0b48a'; ctx.fill();
  if (s.event === 'stone' && s.st && s.st.fly && s.ph === 'fly') { const fr = s.st.fly.frames, q = fr[Math.min(fr.length - 1, Math.max(0, Math.round(s.st.flyT * 60)))]; ctx.beginPath(); ctx.arc(X(q.f), Y(q.y), 0.14 * sc, 0, TAU); ctx.fillStyle = '#555'; ctx.fill(); }
  if (s.event === 'weight' && s.wt) { const w = s.wt; let p = { f: -WT.R * Math.sin(w.a), y: WT.pivotY - WT.R * Math.cos(w.a) }; if (s.ph === 'fly' && w.fly) { const fr = w.fly.frames; const q = fr[Math.min(fr.length - 1, Math.max(0, Math.round(w.flyT * 60)))]; p = { f: q.f, y: q.y }; } ctx.beginPath(); ctx.arc(X(p.f), Y(p.y), 0.16 * sc, 0, TAU); ctx.fillStyle = '#333'; ctx.fill(); ctx.fillStyle = '#c33'; ctx.fillRect(X(WT.barF) - 2, Y(w.bar), 4, w.bar * sc); }
}
