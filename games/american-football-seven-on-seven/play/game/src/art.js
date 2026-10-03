// 2D drawing of the field, the players and the play diagrams. Used by the 2D fallback view (no WebGL), the play-call diagram, the Rules illustrations
// and the title. The 3D scene draws the same field in view3d/field.js; this file is the flat version of it.
import { FIELD, NUMBERS } from './consts.js';
import { FONT, NUM, roundPath } from './ui.js';
import { offPlay, defCall, offFormation, defFormation, OFF_SLOTS, DEF_SLOTS } from './plays.js';
import { OFF_SLOT_OF_P, DEF_SLOT_OF_P } from './consts.js';

export const TEAM_COL = [
  { main: '#2f6fd6', dark: '#1d4590', light: '#cfe0ff', trim: '#ffffff' },
  { main: '#d8453a', dark: '#8c231c', light: '#ffd0c8', trim: '#ffffff' },
];
export const TAU = Math.PI * 2;

// z0..z1 are the field rows (yards) shown from the bottom to the top of the rectangle; x runs -HALF..HALF across it
export function fieldMap(r, z0 = 0, z1 = FIELD.TOTAL, margin = 0) {
  const W = FIELD.W, hw = FIELD.HALF;
  const sw = (r.w - margin * 2) / W, sh = r.h / (z1 - z0);
  const s = Math.min(sw, sh);
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, zm = (z0 + z1) / 2;
  return { s, sx: (x) => cx + x * s, sy: (z) => cy - (z - zm) * s, hw, r };
}

function stripe(ctx, mp, z, h, col) { ctx.fillStyle = col; ctx.fillRect(mp.sx(-FIELD.HALF), mp.sy(z + h), FIELD.W * mp.s, h * mp.s); }

export function drawField(ctx, mp, o = {}) {
  const { los = null, first = null, dir = 1, labels = true, z0 = 0, z1 = FIELD.TOTAL } = o;
  const EZ = FIELD.EZ, G0 = EZ, G1 = EZ + FIELD.LEN;
  ctx.save();
  ctx.beginPath(); ctx.rect(mp.r.x, mp.r.y, mp.r.w, mp.r.h); ctx.clip();
  ctx.fillStyle = '#1c5a2c'; ctx.fillRect(mp.r.x, mp.r.y, mp.r.w, mp.r.h);
  // mown stripes every 5 yards
  for (let z = G0, i = 0; z < G1; z += 5, i++) stripe(ctx, mp, z, 5, i % 2 ? '#2a7a3a' : '#2f8440');
  // end zones
  stripe(ctx, mp, 0, EZ, '#1f4f8f'); stripe(ctx, mp, G1, EZ, '#8f2f27');
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = Math.max(1.5, mp.s * 0.16);
  const hline = (z, w = ctx.lineWidth) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(mp.sx(-FIELD.HALF), mp.sy(z)); ctx.lineTo(mp.sx(FIELD.HALF), mp.sy(z)); ctx.stroke(); };
  hline(G0, mp.s * 0.3); hline(G1, mp.s * 0.3);
  for (let y = 5; y < FIELD.LEN; y += 5) hline(G0 + y, y % 10 === 0 ? mp.s * 0.2 : mp.s * 0.1);
  ctx.lineWidth = mp.s * 0.3;
  ctx.beginPath(); ctx.rect(mp.sx(-FIELD.HALF), mp.sy(FIELD.TOTAL), FIELD.W * mp.s, FIELD.TOTAL * mp.s); ctx.stroke();
  // hash marks
  ctx.lineWidth = Math.max(1, mp.s * 0.08);
  for (let y = 1; y < FIELD.LEN; y++) for (const hx of [-3.4, 3.4]) { ctx.beginPath(); ctx.moveTo(mp.sx(hx - 0.35), mp.sy(G0 + y)); ctx.lineTo(mp.sx(hx + 0.35), mp.sy(G0 + y)); ctx.stroke(); }
  if (labels && mp.s > 7) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = `800 ${Math.round(mp.s * 1.7)}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [y, t] of [[10, '10'], [20, '20'], [30, '10'], [25, '']]) { if (!t) continue; for (const sx of [-1, 1]) { ctx.save(); ctx.translate(mp.sx(sx * 10.5), mp.sy(G0 + y)); ctx.rotate(sx * Math.PI / 2 * 0); ctx.fillText(y === 30 ? '10' : t, 0, 0); ctx.restore(); } }
    ctx.fillText('20', mp.sx(0) , -999);
  }
  void dir;
  if (los != null) { ctx.strokeStyle = '#4aa8ff'; ctx.lineWidth = Math.max(2, mp.s * 0.22); ctx.beginPath(); ctx.moveTo(mp.sx(-FIELD.HALF), mp.sy(los)); ctx.lineTo(mp.sx(FIELD.HALF), mp.sy(los)); ctx.stroke(); }
  if (first != null) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = Math.max(2, mp.s * 0.22); ctx.beginPath(); ctx.moveTo(mp.sx(-FIELD.HALF), mp.sy(first)); ctx.lineTo(mp.sx(FIELD.HALF), mp.sy(first)); ctx.stroke(); }
  ctx.restore();
  void z0; void z1;
}

// a player as a flat marker: shadow, kit disc, number, a nose showing where he faces
export function drawDot(ctx, x, y, r, team, o = {}) {
  const c = TEAM_COL[team];
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, r * 0.5, r * 1.0, r * 0.45, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = c.main; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.18); ctx.strokeStyle = o.ring || c.light; ctx.stroke();
  if (o.yaw !== undefined) { ctx.rotate(-o.yaw + Math.PI); ctx.fillStyle = c.light; ctx.beginPath(); ctx.moveTo(0, r * 1.0); ctx.lineTo(-r * 0.4, r * 0.55); ctx.lineTo(r * 0.4, r * 0.55); ctx.closePath(); ctx.fill(); ctx.rotate(o.yaw - Math.PI); }
  if (o.label) { ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(r * 1.0)}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.label, 0, 1); }
  ctx.restore();
}
export function drawBallFlat(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#7a4320'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 0.38, 0.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = Math.max(1, s * 0.1); ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.1); ctx.lineTo(s * 0.2, s * 0.1); ctx.stroke();
  ctx.restore();
}

// the live play on the flat field (2D fallback and the title's attract picture)
export function drawLiveFlat(ctx, mp, E, o = {}) {
  const P = E.P, M = E.m;
  const r = Math.max(7, mp.s * 0.78);
  const acts = P ? P.actors : M.actors;
  const order = [...acts].sort((a, b) => b.z - a.z);
  for (const a of order) {
    const hl = a.id === E.humanId && E.humanTeam >= 0;
    drawDot(ctx, mp.sx(a.x), mp.sy(a.z), r, a.team, { yaw: a.face, label: String(NUMBERS[a.team][a.p]), ring: hl ? '#ffd24a' : undefined });
  }
  if (P) {
    const b = P.ball;
    if (b.st !== 'ground' || P.phase === 'live') {
      const h = Math.max(0, b.y) * mp.s * 0.35;
      drawBallFlat(ctx, mp.sx(b.x), mp.sy(b.z) - h, Math.max(8, mp.s * 0.8));
    }
  }
  void o;
}

// ---- play diagrams ------------------------------------------------------------------------------------------------------------------------------------
function arrowHead(ctx, x0, y0, x1, y1, col, size) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - size * Math.cos(a - 0.45), y1 - size * Math.sin(a - 0.45)); ctx.lineTo(x1 - size * Math.cos(a + 0.45), y1 - size * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
// offence and defence in the play's own coordinates, offence moving up the page
export function drawDiagram(ctx, rect, o) {
  const { offId, defId, showOff = true, showDef = true, team = 0, userSlot = null, markUser = null } = o;
  const play = offPlay(offId || 'quick'), call = defCall(defId || 'zone');
  // the field window: from 8 yards behind the line to 26 yards beyond it, the width of the field
  const u0 = -7.5, u1 = 24;
  const mp = { s: Math.min(rect.w / (FIELD.W + 1), rect.h / (u1 - u0)), r: rect };
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, um = (u0 + u1) / 2;
  mp.sx = (v) => cx + v * mp.s; mp.sy = (u) => cy - (u - um) * mp.s;
  ctx.save();
  roundPath(ctx, rect.x, rect.y, rect.w, rect.h, 16); ctx.clip();
  ctx.fillStyle = '#2a7a3a'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  for (let u = Math.ceil(u0 / 5) * 5; u < u1; u += 5) { ctx.fillStyle = ((u / 5) % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'); ctx.fillRect(rect.x, mp.sy(u + 5), rect.w, 5 * mp.s); }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
  for (let u = -5; u <= 25; u += 5) { ctx.beginPath(); ctx.moveTo(rect.x, mp.sy(u)); ctx.lineTo(rect.x + rect.w, mp.sy(u)); ctx.stroke(); }
  ctx.strokeStyle = '#4aa8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(rect.x, mp.sy(0)); ctx.lineTo(rect.x + rect.w, mp.sy(0)); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `700 ${Math.max(12, Math.round(mp.s * 0.9))}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('line of scrimmage', rect.x + 10, mp.sy(0) - mp.s * 0.9);
  const R = Math.max(9, mp.s * 0.95);
  if (showDef) {
    const f = defFormation(call);
    for (const slot of DEF_SLOTS) {
      const [u, v] = f[slot], t = call.tasks[slot];
      const x = mp.sx(v), y = mp.sy(u);
      ctx.save(); ctx.strokeStyle = '#ffb0a8'; ctx.fillStyle = '#ffb0a8'; ctx.lineWidth = Math.max(2, mp.s * 0.16); ctx.setLineDash([6, 5]);
      if (t.k === 'rush') { const tx = mp.sx(t.lane * 0.3), ty = mp.sy(-4.2); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]); arrowHead(ctx, x, y, tx, ty, '#ffb0a8', 10); }
      else if (t.k === 'man') { const slotO = t.on, fo = offFormation(play)[slotO]; const tx = mp.sx(fo[1]), ty = mp.sy(fo[0]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tx, ty, R * 1.4, 0, TAU); ctx.stroke(); }
      else if (t.k === 'zone' || t.k === 'deep') { const zx = mp.sx(t.v), zy = mp.sy(t.u), rr = (t.r || 4.2) * mp.s; ctx.setLineDash([]); ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.ellipse(zx, zy, rr, rr * 0.75, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.8; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(zx, zy + (zy > y ? -R : R)); ctx.stroke(); }
      else if (t.k === 'fill') { const zx = mp.sx(t.v), zy = mp.sy(t.u); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(zx, zy); ctx.stroke(); arrowHead(ctx, x, y, zx, zy, '#ffb0a8', 10); }
      ctx.restore();
    }
    for (const slot of DEF_SLOTS) { const [u, v] = f[slot]; drawDot(ctx, mp.sx(v), mp.sy(u), R, 1, { label: slot.startsWith('DL') ? 'D' : slot.startsWith('LB') ? 'L' : slot.startsWith('CB') ? 'C' : 'S' }); }
  }
  if (showOff) {
    const f = offFormation(play);
    const colors = { WA: '#ffe27a', WB: '#9fe8ff', TE: '#b9f2a1', RB: '#ffb86a', QB: '#ffffff' };
    for (const slot of OFF_SLOTS) {
      const r = play.routes && play.routes[slot];
      const [u0s, v0s] = f[slot];
      let pts = [[u0s, v0s]];
      if (slot === play.handoff?.to || (play.fake && slot === play.fake.to)) pts = [[u0s, v0s]];
      if (r && r.length) pts = pts.concat(r);
      if (pts.length > 1 && slot !== 'C' && slot !== 'G') {
        ctx.save(); ctx.strokeStyle = colors[slot] || '#fff'; ctx.lineWidth = Math.max(3, mp.s * 0.28); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath(); pts.forEach(([u, v], i) => { const x = mp.sx(v), y = mp.sy(u); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
        const a = pts[pts.length - 2], b = pts[pts.length - 1];
        arrowHead(ctx, mp.sx(a[1]), mp.sy(a[0]), mp.sx(b[1]), mp.sy(b[0]), colors[slot] || '#fff', Math.max(9, mp.s * 0.7));
        ctx.restore();
      }
    }
    // handoff / carry hint
    if (play.carrier && play.hole) { const hx = mp.sx(play.hole[1]), hy = mp.sy(play.hole[0]); const c = play.carrier; const st = f[c]; ctx.save(); ctx.strokeStyle = '#ffb86a'; ctx.lineWidth = Math.max(4, mp.s * 0.34); ctx.setLineDash([]); ctx.lineCap = 'round'; ctx.beginPath(); const last = (play.routes && play.routes[c] && play.routes[c].length) ? play.routes[c][play.routes[c].length - 1] : [st[0], st[1]]; ctx.moveTo(mp.sx(last[1]), mp.sy(last[0])); ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]); arrowHead(ctx, mp.sx(last[1]), mp.sy(last[0]), hx, hy, '#ffb86a', 11); ctx.restore(); }
    if (play.handoff) { const q = f.QB, c = f[play.carrier]; ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(mp.sx(q[1]), mp.sy(q[0])); ctx.lineTo(mp.sx(play.handoff.at[1]), mp.sy(play.handoff.at[0])); ctx.stroke(); ctx.restore(); void c; }
    if (play.draw) { const q = f.QB; ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(4, mp.s * 0.34); ctx.setLineDash([8, 8]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(mp.sx(q[1]), mp.sy(q[0])); ctx.lineTo(mp.sx(0), mp.sy(play.draw.u)); ctx.lineTo(mp.sx(play.hole[1]), mp.sy(play.hole[0])); ctx.stroke(); ctx.restore(); }
    for (const slot of OFF_SLOTS) {
      const [u, v] = f[slot];
      const mine = userSlot === slot;
      drawDot(ctx, mp.sx(v), mp.sy(u), R, team, { label: slot === 'QB' ? 'Q' : slot === 'RB' ? 'R' : slot === 'TE' ? 'T' : slot === 'C' ? 'C' : slot === 'G' ? 'G' : 'W', ring: mine ? '#ffd24a' : undefined });
    }
    void markUser;
  }
  ctx.restore();
}
export { OFF_SLOT_OF_P, DEF_SLOT_OF_P };
