// Drawing of the instrument and the note lanes: the dusk sky with a stone tower, the three bound cane pipes with the cheek
// reservoir, the lanes, the notes and the pads. Pure drawing from the simulation state; game.js owns every decision.
import { FONT, SERIF, roundPath, FLOOR } from './ui.js';
import { FALL } from './sim.js';
import { LANE_NAMES } from './tunes.js';
import { v3, active, toV } from './v3.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const PAL = {
  low: ['#6fe0d0', '#1f8077'], high: ['#ffd36a', '#a5701a'], breath: ['#ff9a6a', '#b8401f'],
  cane: ['#f3d896', '#c99a45', '#8a5a1e'], thread: '#c8402a', umber: '#150d09', ink: '#0d0a14',
};
export const pipeCol = (lane) => (lane < 2 ? PAL.low : PAL.high);

// ---- the sky, the hills and the stone tower -------------------------------------------------------------------------------
export function drawBackdrop(ctx, r, t, o = {}) {
  if (active()) { v3.sky = { dim: o.dim || 0 }; return; }
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, '#120e2a'); g.addColorStop(0.45, '#4a2a58'); g.addColorStop(0.78, '#c9603f'); g.addColorStop(1, '#f6ad5c');
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  // stars
  ctx.fillStyle = '#fff4d8';
  for (let i = 0; i < 26; i++) {
    const px = r.x + ((i * 0.6180339 + 0.13) % 1) * r.w, sy = r.y + ((i * 0.7548777 + 0.31) % 1) * r.h * 0.5;
    ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * 0.8 + i * 1.7));
    ctx.fillRect(px, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
  // low sun
  const sx = r.x + r.w * 0.78, sy = r.y + r.h * 0.82, sr = Math.min(r.w, r.h) * 0.32;
  const rg = ctx.createRadialGradient(sx, sy, 4, sx, sy, sr);
  rg.addColorStop(0, 'rgba(255,230,160,0.95)'); rg.addColorStop(0.35, 'rgba(255,170,90,0.55)'); rg.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = rg; ctx.fillRect(r.x, r.y, r.w, r.h);
  // far hills
  const hy = r.y + r.h * 0.8;
  ctx.fillStyle = '#6a3158';
  ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h);
  for (let i = 0; i <= 12; i++) { const x = r.x + (i / 12) * r.w; ctx.lineTo(x, hy - 12 - 14 * Math.sin(i * 0.9 + 0.6) - 8 * Math.sin(i * 2.1)); }
  ctx.lineTo(r.x + r.w, r.y + r.h); ctx.closePath(); ctx.fill();
  // the stone tower: a truncated cone with a stepped, overhanging top, a doorway and a lower side tower
  const tw = Math.min(r.w * 0.22, r.h * 0.55), tx = r.x + r.w * 0.13, tb = r.y + r.h + 2, th = tw * 0.95;
  const tower = (cx, w, h, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.5, tb); ctx.lineTo(cx - w * 0.3, tb - h * 0.82); ctx.lineTo(cx - w * 0.37, tb - h * 0.9);
    ctx.lineTo(cx - w * 0.33, tb - h); ctx.lineTo(cx + w * 0.33, tb - h); ctx.lineTo(cx + w * 0.37, tb - h * 0.9);
    ctx.lineTo(cx + w * 0.3, tb - h * 0.82); ctx.lineTo(cx + w * 0.5, tb); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,170,110,0.16)'; ctx.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) { const yy = tb - (h * 0.82 * i) / 6, hw = w * (0.5 - 0.2 * (i / 6)); ctx.beginPath(); ctx.moveTo(cx - hw, yy); ctx.lineTo(cx + hw, yy); ctx.stroke(); }
  };
  tower(tx, tw, th, '#2a1426');
  ctx.fillStyle = '#ffb25a'; ctx.globalAlpha = 0.75;
  roundPath(ctx, tx - tw * 0.07, tb - tw * 0.34, tw * 0.14, tw * 0.34, tw * 0.06); ctx.fill();
  ctx.globalAlpha = 1;
  tower(tx + tw * 0.78, tw * 0.55, th * 0.55, '#341b2d');
  // near ground
  ctx.fillStyle = '#1d0f14'; ctx.fillRect(r.x, r.y + r.h - Math.max(8, r.h * 0.05), r.w, r.h);
  if (o.dim) { ctx.fillStyle = `rgba(10,6,16,${o.dim})`; ctx.fillRect(r.x, r.y, r.w, r.h); }
  ctx.restore();
}

// ---- one cane pipe ------------------------------------------------------------------------------------------------------------
function cane(ctx, cx, y0, y1, w, o = {}) {
  const x = cx - w / 2;
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, PAL.cane[2]); g.addColorStop(0.28, PAL.cane[0]); g.addColorStop(0.62, PAL.cane[1]); g.addColorStop(1, PAL.cane[2]);
  // contact shadow to the right, then the cylinder, a lit stripe and fibre lines so it reads as a round cane
  ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#000'; roundPath(ctx, x + w * 0.22, y0 + 6, w, y1 - y0, w * 0.35); ctx.fill(); ctx.restore();
  roundPath(ctx, x, y0, w, y1 - y0, w * 0.35);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(40,18,6,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff6d0'; roundPath(ctx, x + w * 0.2, y0 + w * 0.3, w * 0.12, y1 - y0 - w * 0.6, w * 0.06); ctx.fill();
  ctx.globalAlpha = 0.16; ctx.strokeStyle = '#4a2408'; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) { const fx = x + w * (0.3 + i * 0.16); ctx.beginPath(); ctx.moveTo(fx, y0 + w * 0.3); ctx.lineTo(fx + 1.5, y1 - w * 0.3); ctx.stroke(); }
  ctx.restore();
  // cane joints
  ctx.strokeStyle = 'rgba(70,36,10,0.55)'; ctx.lineWidth = 2;
  const nodes = o.nodes ?? 3;
  for (let i = 1; i <= nodes; i++) { const yy = y0 + ((y1 - y0) * i) / (nodes + 1); ctx.beginPath(); ctx.moveTo(x + 1, yy); ctx.lineTo(x + w - 1, yy); ctx.stroke(); }
  // flared top (bell of cane)
  if (o.flare) {
    // beeswax collar with the little cane reed mounted in it, wrapped in thread
    const rw = w * 0.36, rx = cx - rw / 2, rh = Math.max(12, w * 0.55);
    const rg = ctx.createLinearGradient(rx, 0, rx + rw, 0); rg.addColorStop(0, '#8a6a2a'); rg.addColorStop(0.5, '#f1dea0'); rg.addColorStop(1, '#7a5a20');
    roundPath(ctx, rx, y0 - rh - w * 0.05, rw, rh + w * 0.1, rw * 0.3); ctx.fillStyle = rg; ctx.fill(); ctx.strokeStyle = 'rgba(40,18,6,0.7)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#8a2a1c'; for (let i = 0; i < 3; i++) ctx.fillRect(rx - 0.5, y0 - rh * 0.8 + i * rh * 0.22, rw + 1, Math.max(1.5, rh * 0.09));
    const wg = ctx.createLinearGradient(x, 0, x + w, 0); wg.addColorStop(0, '#8a4a12'); wg.addColorStop(0.45, '#ffbf5a'); wg.addColorStop(1, '#7a3e0c');
    roundPath(ctx, x - w * 0.1, y0 - w * 0.1, w * 1.2, w * 0.38, w * 0.17); ctx.fillStyle = wg; ctx.fill(); ctx.strokeStyle = 'rgba(60,28,4,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  // the sounding glow around a pipe that is speaking
  if (o.glow > 0.02) {
    ctx.save(); ctx.globalAlpha = clamp(o.glow, 0, 1) * 0.55;
    const rg = ctx.createRadialGradient(cx, y0, 2, cx, y0, w * 2.4);
    rg.addColorStop(0, o.col ?? '#ffd36a'); rg.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = rg; ctx.fillRect(cx - w * 3, y0 - w * 3, w * 6, w * 6);
    ctx.restore();
  }
}
function wrap(ctx, cx, y, w) {
  const x = cx - w * 0.62;
  roundPath(ctx, x, y, w * 1.24, w * 0.11, w * 0.05); ctx.fillStyle = PAL.thread; ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,200,0.5)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + (i * w * 1.24) / 5, y + 1); ctx.lineTo(x + (i * w * 1.24) / 5 - w * 0.03, y + w * 0.11 - 1); ctx.stroke(); }
}

// ---- the three pipes and the cheek reservoir -----------------------------------------------------------------------------------
// o: { t, air 0..1, squeeze, drone 0..1 (how strongly the drone sounds), lit: [bool x5], hint: [lane...], breathHint, wave }
export function drawPipes(ctx, r, o) {
  const k = Math.min(r.w / 620, r.h / 380);
  const lit3 = active();
  if (lit3) v3.pipes.push({ r: toV(ctx, r), o: { t: o.t || 0, air: o.air ?? 1, squeeze: !!o.squeeze, drone: o.drone ?? 1, lit: o.lit || [], hint: o.hint || null, breathHint: !!o.breathHint } });
  const ox = r.x + r.w / 2, oy = r.y + r.h / 2;
  ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k); ctx.translate(-310, -190);
  const t = o.t || 0, air = clamp(o.air ?? 1, 0, 1), drone = clamp(o.drone ?? 1, 0, 1);
  const pip = [{ x: 235, top: 14, w: 40, key: 'drone' }, { x: 312, top: 78, w: 32, key: 'low' }, { x: 384, top: 50, w: 32, key: 'high' }];
  if (!lit3) {
    // soft shadow on the ground
    ctx.fillStyle = 'rgba(8,3,10,0.45)'; ctx.beginPath(); ctx.ellipse(310, 372, 170, 12, 0, 0, TAU); ctx.fill();
    // the drone's sound rings
    if (drone > 0.05) {
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const ph = ((t * 0.9 + i / 3) % 1), rad = 24 + ph * 80;
        ctx.globalAlpha = (1 - ph) * 0.45 * drone * (o.air < 0.2 ? 0.4 + 0.6 * Math.abs(Math.sin(t * 18)) : 1);
        ctx.strokeStyle = '#ffe4a0'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(pip[0].x, pip[0].top, rad, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      }
      ctx.restore();
    }
    // pipes (back to front)
    const litLow = (o.lit?.[0] ? 1 : 0) + (o.lit?.[1] ? 1 : 0), litHigh = (o.lit?.[2] ? 1 : 0) + (o.lit?.[3] ? 1 : 0) + (o.lit?.[4] ? 1 : 0);
    cane(ctx, pip[0].x, pip[0].top, 296, pip[0].w, { nodes: 5, flare: true, glow: drone * 0.8, col: '#ffd890' });
    cane(ctx, pip[1].x, pip[1].top, 296, pip[1].w, { nodes: 3, flare: true, glow: Math.min(1, litLow), col: '#7ff0df' });
    cane(ctx, pip[2].x, pip[2].top, 296, pip[2].w, { nodes: 4, flare: true, glow: Math.min(1, litHigh), col: '#ffd36a' });

  }
  // finger holes
  const hole = (cx, cy, lane, cw) => {
    const lit = !!o.lit?.[lane], hinted = o.hint?.includes(lane);
    const col = pipeCol(lane);
    if (!lit3) {
      ctx.beginPath(); ctx.ellipse(cx, cy, cw * 0.3, cw * 0.22, 0, 0, TAU);
      ctx.fillStyle = lit ? col[0] : '#1a0c06'; ctx.fill();
      ctx.lineWidth = hinted ? 4 : 2; ctx.strokeStyle = hinted ? '#ffffff' : lit ? '#fff2c8' : 'rgba(255,225,170,0.6)'; ctx.stroke();
      if (lit) { ctx.save(); ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(cx, cy, cw * 0.62, 0, TAU); ctx.fillStyle = col[0]; ctx.fill(); ctx.restore(); }
    } else if (hinted) {
      ctx.beginPath(); ctx.ellipse(cx, cy, cw * 0.42, cw * 0.34, 0, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    }
    const n = lane < 2 ? lane + 1 : lane - 1;
    ctx.fillStyle = lit ? '#2a1204' : 'rgba(255,230,190,0.9)'; ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), cx + cw * 0.62, cy);
  };
  hole(pip[1].x, 146, 0, pip[1].w); hole(pip[1].x, 192, 1, pip[1].w);
  hole(pip[2].x, 118, 2, pip[2].w); hole(pip[2].x, 164, 3, pip[2].w); hole(pip[2].x, 210, 4, pip[2].w);
  // binding threads
  if (!lit3) for (const y of [236, 262]) { wrap(ctx, 310, y, 190); }
  // the cheek reservoir (the air)
  const rr = 30 + air * 26 + (o.squeeze ? 4 * Math.sin(t * 26) : 0), by = 326 - rr * 0.35, bx = 310;
  const low = air < 0.25;
  const bg = ctx.createRadialGradient(bx - rr * 0.3, by - rr * 0.35, rr * 0.1, bx, by, rr);
  bg.addColorStop(0, low ? '#ffb8a0' : '#ffe0b0'); bg.addColorStop(0.55, low ? '#e05a40' : '#e7a050'); bg.addColorStop(1, low ? '#7a1f14' : '#7a4210');
  if (!lit3) {
  ctx.save();
  if (low) { ctx.shadowColor = `rgba(255,70,40,${0.5 + 0.5 * Math.sin(t * 14)})`; ctx.shadowBlur = 24; }
  ctx.beginPath(); ctx.arc(bx, by, rr, 0, TAU); ctx.fillStyle = bg; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,16,4,0.75)'; ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(bx - rr * 0.35, by - rr * 0.4, rr * 0.22, rr * 0.13, -0.6, 0, TAU); ctx.fill();
  }
  if (o.squeeze || o.breathHint) {
    ctx.strokeStyle = o.breathHint && !o.squeeze ? '#ffffff' : '#fff0c0'; ctx.lineWidth = 4; ctx.setLineDash([8, 7]);
    ctx.beginPath(); ctx.arc(bx, by, rr + 9, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

// ---- the lanes -------------------------------------------------------------------------------------------------------------------------
const noteY = (lay, at, t) => lay.hitY - ((at - t) / FALL) * (lay.hitY - lay.top);

function pill(ctx, r, rad, fill, stroke, lw = 2) {
  roundPath(ctx, r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

export function drawAirGauge(ctx, r, air, t, squeeze, size) {
  if (active()) {
    v3.gauge = { r: toV(ctx, r), air: clamp(air, 0, 1), low: air < 0.25, t, squeeze: !!squeeze };
    ctx.fillStyle = '#fff4dc'; ctx.font = `800 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4; ctx.fillText('AIR', r.x + r.w / 2, r.y + size * 1.15); ctx.restore();
    return;
  }
  pill(ctx, r, Math.min(r.w / 2, 22), 'rgba(6,3,10,0.7)', 'rgba(255,215,150,0.4)', 2);
  const inset = 5, ih = r.h - inset * 2, fh = Math.max(0, ih * clamp(air, 0, 1));
  if (fh > 1) {
    ctx.save(); roundPath(ctx, r.x + inset, r.y + inset, r.w - inset * 2, ih, Math.min(r.w / 2, 18)); ctx.clip();
    const low = air < 0.25;
    const g = ctx.createLinearGradient(0, r.y + r.h, 0, r.y);
    g.addColorStop(0, low ? '#ff5a3c' : '#ff9a4a'); g.addColorStop(1, low ? '#ffb090' : '#ffe08a');
    ctx.fillStyle = g; ctx.fillRect(r.x + inset, r.y + r.h - inset - fh, r.w - inset * 2, fh);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(r.x + inset, r.y + r.h - inset - fh, r.w - inset * 2, 3);
    if (low) { ctx.fillStyle = `rgba(255,50,30,${0.15 + 0.2 * Math.sin(t * 14)})`; ctx.fillRect(r.x, r.y, r.w, r.h); }
    ctx.restore();
  }
  // tick marks at quarters
  ctx.strokeStyle = 'rgba(255,235,200,0.35)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) { const y = r.y + inset + (ih * i) / 4; ctx.beginPath(); ctx.moveTo(r.x + r.w * 0.2, y); ctx.lineTo(r.x + r.w * 0.8, y); ctx.stroke(); }
  ctx.fillStyle = '#fff4dc'; ctx.font = `800 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4; ctx.fillText('AIR', r.x + r.w / 2, r.y + size * 1.15); ctx.restore();
}

// V: { S, t, pressed: [bool x6], hint: {lanes, breath}, cues, parts, pops, ready }
export function drawField(ctx, lay, V) {
  const S = V.S, f = lay.field, lab = lay.lab;
  const lit3 = active();
  if (lit3) v3.field = { f: toV(ctx, f), laneTop: toV(ctx, { x: 0, y: lay.top + Math.max(FLOOR, Math.round(lab * 0.9)) * 1.6, w: 0, h: 0 }).y, top: toV(ctx, { x: 0, y: lay.top, w: 0, h: 0 }).y, hitY: toV(ctx, { x: 0, y: lay.hitY, w: 0, h: 0 }).y, cols: lay.cols.map((c) => toV(ctx, { x: c.x, y: 0, w: c.w, h: 0 })), pressed: V.pressed || [], hint: V.hint || null, alpha: ctx.globalAlpha };
  // panel
  if (!lit3) pill(ctx, f, 18, 'rgba(14,7,10,0.84)', 'rgba(255,205,130,0.35)', 2);
  // group captions
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
  const cap = Math.max(FLOOR, Math.round(lab * 0.9));
  ctx.font = `700 ${cap}px ${FONT}`;
  const c = lay.cols;
  const capY = lay.top + cap * 0.9;
  ctx.fillStyle = PAL.low[0]; ctx.fillText('MANCOSA', (c[1].x + c[2].x + c[2].w) / 2, capY);
  ctx.fillStyle = PAL.high[0]; ctx.fillText('MANCOSEDDA', (c[3].x + c[5].x + c[5].w) / 2, capY);
  // lanes
  for (let i = 1; i < 6; i++) {
    const col = pipeCol(i - 1);
    const lx = c[i].x, lw = c[i].w, hot = V.pressed?.[i];
    if (lit3) continue;
    const g = ctx.createLinearGradient(0, lay.top, 0, lay.hitY);
    g.addColorStop(0, 'rgba(255,230,190,0.02)'); g.addColorStop(1, hot ? 'rgba(255,240,200,0.22)' : 'rgba(255,230,190,0.09)');
    roundPath(ctx, lx, lay.top + cap * 1.6, lw, lay.hitY - lay.top - cap * 1.6 + 8, 12); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,190,0.14)'; ctx.lineWidth = 1.5; ctx.stroke();
    // coloured edge at the line
    ctx.fillStyle = col[0]; ctx.globalAlpha = 0.5; ctx.fillRect(lx + lw * 0.15, lay.hitY - 2, lw * 0.7, 4); ctx.globalAlpha = 1;
  }
  // air gauge column
  const ag = { x: c[0].x, y: lay.top + cap * 1.6, w: c[0].w, h: lay.hitY - lay.top - cap * 1.6 + 8 };
  drawAirGauge(ctx, ag, S.air, V.t, S.squeeze, Math.max(FLOOR, Math.round(lab * 0.9)));
  // the hit line
  if (!lit3) {
  const lg = ctx.createLinearGradient(c[1].x, 0, c[5].x + c[5].w, 0);
  lg.addColorStop(0, 'rgba(111,224,208,0.9)'); lg.addColorStop(0.5, 'rgba(255,240,200,0.95)'); lg.addColorStop(1, 'rgba(255,211,106,0.9)');
  ctx.fillStyle = lg; ctx.globalAlpha = 0.85; ctx.fillRect(c[1].x, lay.hitY - 1.5, c[5].x + c[5].w - c[1].x, 3); ctx.globalAlpha = 1;
  }
  // notes
  ctx.save(); ctx.beginPath(); ctx.rect(f.x, lay.top + cap * 1.4, f.w, lay.hitY - lay.top - cap * 1.4 + 26); ctx.clip();
  const rad = clamp(Math.min(c[1].w * 0.4, 44), 14, 44);
  for (let i = S.cur; i < S.notes.length; i++) {
    const n = S.notes[i], dt = n.at - S.t;
    if (dt > FALL + 0.1) break;
    if (n.st === 1) continue;
    const y = noteY(lay, n.at, S.t);
    const col = pipeCol(n.lane), x = c[n.lane + 1].x + c[n.lane + 1].w / 2;
    const dead = n.st === 2;
    drawNote(ctx, x, y, rad, col, dead, n.lane, V.hint?.lanes?.includes(n.lane) && dt < 1.2, V.t);
  }
  // notes already resolved but still behind the cursor (misses fall on)
  for (let i = Math.max(0, S.cur - 8); i < S.cur; i++) {
    const n = S.notes[i];
    if (n.st !== 2) continue;
    const y = noteY(lay, n.at, S.t);
    if (y > lay.hitY + 60) continue;
    drawNote(ctx, c[n.lane + 1].x + c[n.lane + 1].w / 2, y, rad, pipeCol(n.lane), true, n.lane, false, V.t);
  }
  ctx.restore();
  // particles then pads
  drawParts(ctx, V.parts);
  for (let i = 0; i < 6; i++) drawPad(ctx, lay, i, V);
  drawPops(ctx, V.pops);
}

function drawNote(ctx, x, y, r, col, dead, lane, hinted, t) {
  if (active()) {
    const q = toV(ctx, { x, y, w: r, h: 0 });
    v3.notes.push({ x: q.x, y: q.y, r: q.w, lane, dead, hint: hinted, a: ctx.globalAlpha });
    ctx.save();
    if (hinted && !dead) { ctx.beginPath(); ctx.arc(x, y, r * 1.38 + 2 * Math.sin(t * 9), 0, TAU); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
    const n3 = lane < 2 ? lane + 1 : lane - 1;
    ctx.fillStyle = dead ? '#cbbfb0' : '#2a1204'; ctx.font = `800 ${Math.round(r * 0.9)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n3), x, y + 1);
    ctx.restore();
    return;
  }
  ctx.save();
  if (dead) ctx.globalAlpha = 0.4;
  if (hinted && !dead) { ctx.beginPath(); ctx.arc(x, y, r * 1.35 + 2 * Math.sin(t * 9), 0, TAU); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  if (dead) { g.addColorStop(0, '#7a6a66'); g.addColorStop(1, '#3a2c2c'); } else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, col[0]); g.addColorStop(1, col[1]); }
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = dead ? 'rgba(20,10,10,0.6)' : 'rgba(30,12,4,0.8)'; ctx.stroke();
  // the hole it asks for
  const n = lane < 2 ? lane + 1 : lane - 1;
  ctx.fillStyle = dead ? '#bba' : '#2a1204'; ctx.font = `800 ${Math.round(r * 0.9)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(n), x, y + 1);
  ctx.restore();
}

export function drawPad(ctx, lay, i, V) {
  const r = lay.pads[i], S = V.S;
  const down = !!V.pressed?.[i];
  const isB = i === 0;
  const col = isB ? PAL.breath : pipeCol(i - 1);
  const hinted = isB ? V.hint?.breath : V.hint?.lanes?.includes(i - 1);
  const dy = down ? 3 : 0;
  if (active()) {
    v3.pads.push({ r: toV(ctx, r), i, down, hint: !!hinted, sq: !!(isB && S.squeeze), a: ctx.globalAlpha });
    const fs3 = Math.max(FLOOR, Math.round(lay.lab * 1.05));
    ctx.save(); ctx.fillStyle = '#2a1204'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${fs3}px ${FONT}`;
    if (hinted) { ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; roundPath(ctx, r.x + 2, r.y + dy + 2, r.w - 4, r.h - 4, 16); ctx.stroke(); }
    if (isB) {
      ctx.fillText('BREATH', r.x + r.w / 2, r.y + dy + r.h * 0.42);
      ctx.font = `600 ${Math.max(FLOOR, Math.round(fs3 * 0.8))}px ${FONT}`; ctx.fillText('hold', r.x + r.w / 2, r.y + dy + r.h * 0.42 + fs3 * 1.05);
    } else {
      const n3 = i - 1 < 2 ? i : i - 2;
      ctx.font = `800 ${Math.round(fs3 * 1.5)}px ${FONT}`; ctx.fillText(String(n3), r.x + r.w / 2, r.y + dy + r.h * 0.4);
      ctx.font = `600 ${Math.max(FLOOR, Math.round(fs3 * 0.78))}px ${FONT}`;
      ctx.fillText(i - 1 < 2 ? 'low' : 'high', r.x + r.w / 2, r.y + dy + r.h * 0.4 + fs3 * 1.25);
    }
    ctx.restore();
    return;
  }
  ctx.save();
  roundPath(ctx, r.x, r.y + (down ? 3 : 6), r.w, r.h, 16); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  roundPath(ctx, r.x, r.y + dy, r.w, r.h, 16);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, down ? col[0] : col[0]); g.addColorStop(1, col[1]);
  ctx.globalAlpha = down ? 1 : 0.9; ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1;
  if (isB && S.squeeze) { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill(); }
  ctx.lineWidth = hinted ? 4 : 2; ctx.strokeStyle = hinted ? '#ffffff' : 'rgba(255,245,220,0.55)'; ctx.stroke();
  const fs = Math.max(FLOOR, Math.round(lay.lab * 1.05));
  ctx.fillStyle = '#2a1204'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${fs}px ${FONT}`;
  if (isB) {
    ctx.fillText('BREATH', r.x + r.w / 2, r.y + dy + r.h * 0.42);
    ctx.font = `600 ${Math.max(FLOOR, Math.round(fs * 0.8))}px ${FONT}`; ctx.fillText('hold', r.x + r.w / 2, r.y + dy + r.h * 0.42 + fs * 1.05);
  } else {
    const n = i - 1 < 2 ? i : i - 2;
    ctx.font = `800 ${Math.round(fs * 1.5)}px ${FONT}`; ctx.fillText(String(n), r.x + r.w / 2, r.y + dy + r.h * 0.4);
    ctx.font = `600 ${Math.max(FLOOR, Math.round(fs * 0.78))}px ${FONT}`;
    ctx.fillText(i - 1 < 2 ? 'low' : 'high', r.x + r.w / 2, r.y + dy + r.h * 0.4 + fs * 1.25);
  }
  ctx.restore();
}

// ---- particles and pops -----------------------------------------------------------------------------------------------------------------------
export function drawParts(ctx, parts) {
  if (!parts) return;
  for (const q of parts) {
    const a = clamp(1 - q.t / q.max, 0, 1);
    ctx.globalAlpha = a;
    if (q.kind === 2) { ctx.strokeStyle = q.col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.35 + 0.65 * (q.t / q.max)), 0, TAU); ctx.stroke(); }
    else { ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + 0.5 * a), 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
export function drawPops(ctx, pops) {
  if (!pops) return;
  for (const p of pops) {
    const a = clamp(1 - p.t / p.max, 0, 1), up = p.t * 46;
    ctx.save(); ctx.globalAlpha = Math.min(1, a * 2.2);
    ctx.font = `800 ${Math.max(FLOOR, p.size)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 6; ctx.fillStyle = p.col; ctx.fillText(p.text, p.x, p.y - up);
    ctx.restore();
  }
}
export const SERIF_FONT = SERIF;
export { LANE_NAMES };
