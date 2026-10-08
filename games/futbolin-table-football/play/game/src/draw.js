// The table scene: a tavern floor, a lit wooden table with felt, chrome rods, painted wooden men and the ball.
// Everything is drawn in table units inside a transform (rotated a quarter turn in landscape); soft shadows are offset manually so the light
// always comes from the top left of the SCREEN. Pure drawing: reads the sim state, owns nothing.
import { HW, HL, FW, FL, BALL_R, GOAL_HW, CHAMFER, MAN_HX, MAN_HY, KINDS, dirOf } from './consts.js';
import { RIM, GRIP } from './layout.js';
import { manX } from './physics.js';

const TAU = Math.PI * 2;
const hash = (n) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

// ---- floor -------------------------------------------------------------------------------------------------------------
export function drawFloor(ctx, w, h, lay) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#3a1f12'); g.addColorStop(1, '#24120a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // painted tiles: a lattice of diamonds with a small flower in the middle, quiet so the table stays the hero
  const T = 92, ox = lay ? lay.cx : w / 2, oy = lay ? lay.cy : h / 2;
  ctx.save();
  const x0 = ox - Math.ceil(ox / T) * T, y0 = oy - Math.ceil(oy / T) * T;
  for (let y = y0; y < h + T; y += T) {
    for (let x = x0; x < w + T; x += T) {
      const k = Math.round((x - ox) / T) + Math.round((y - oy) / T) * 7;
      ctx.fillStyle = (Math.round((x - ox) / T) + Math.round((y - oy) / T)) & 1 ? 'rgba(160,82,40,0.20)' : 'rgba(110,50,22,0.22)';
      ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
      ctx.fillStyle = 'rgba(232,170,80,0.10)';
      ctx.beginPath(); ctx.moveTo(x + T / 2, y + 14); ctx.lineTo(x + T - 14, y + T / 2); ctx.lineTo(x + T / 2, y + T - 14); ctx.lineTo(x + 14, y + T / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = hash(k) > 0.5 ? 'rgba(60,120,160,0.20)' : 'rgba(210,150,60,0.16)';
      ctx.beginPath(); ctx.arc(x + T / 2, y + T / 2, 8, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
// The hanging lamp: a warm pool of light over the table and dark corners. Drawn last, over everything but the HUD.
export function drawLight(ctx, w, h, lay) {
  const cx = lay ? lay.cx : w / 2, cy = lay ? lay.cy : h / 2, r = Math.max(w, h) * 0.78;
  const g = ctx.createRadialGradient(cx, cy - h * 0.04, r * 0.08, cx, cy, r);
  g.addColorStop(0, 'rgba(255,214,150,0.14)'); g.addColorStop(0.45, 'rgba(255,190,110,0.02)'); g.addColorStop(1, 'rgba(8,3,0,0.66)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

// ---- table ---------------------------------------------------------------------------------------------------------------
function outline(ctx, hw, hl, c) {
  ctx.beginPath();
  ctx.moveTo(-hw + c, -hl); ctx.lineTo(hw - c, -hl); ctx.lineTo(hw, -hl + c); ctx.lineTo(hw, hl - c); ctx.lineTo(hw - c, hl); ctx.lineTo(-hw + c, hl);
  ctx.lineTo(-hw, hl - c); ctx.lineTo(-hw, -hl + c); ctx.closePath();
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// screen vector (dx, dy) expressed in table units (so shadows fall to the same side of the screen in both orientations)
const shadowVec = (lay, dx, dy) => (lay.wide ? { x: dy / lay.s, y: -dx / lay.s } : { x: dx / lay.s, y: dy / lay.s });

export function drawTable(ctx, lay, S, o = {}) {
  const s = lay.s, sh = shadowVec(lay, 3.2, 4.8);
  const kits = o.kits, rods = S.rods;
  ctx.save();
  ctx.translate(lay.cx, lay.cy);
  if (lay.wide) ctx.rotate(Math.PI / 2);
  ctx.scale(s, s);
  // ground shadow of the table
  const gs = shadowVec(lay, 10, 22);
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; rr(ctx, -HW - RIM + gs.x, -HL - RIM + gs.y, FW + 2 * RIM, FL + 2 * RIM, 5); ctx.fill();
  // wooden frame (with the two goal boxes behind the end rails)
  const fx0 = -HW - RIM, fy0 = -HL - RIM, fw = FW + 2 * RIM, fh = FL + 2 * RIM;
  const wood = ctx.createLinearGradient(lay.wide ? 0 : fx0, lay.wide ? fx0 : 0, lay.wide ? 0 : fx0 + fw, lay.wide ? fx0 + fw : 0);
  wood.addColorStop(0, '#8a5226'); wood.addColorStop(0.5, '#b87636'); wood.addColorStop(1, '#6f3f1c');
  for (const sg of [-1, 1]) { ctx.fillStyle = '#5c3416'; rr(ctx, -GOAL_HW - 3, sg > 0 ? HL : -HL - 8, 2 * GOAL_HW + 6, 8, 2); ctx.fill(); }
  ctx.fillStyle = wood; rr(ctx, fx0, fy0, fw, fh, 4); ctx.fill();
  // grain
  ctx.save(); rr(ctx, fx0, fy0, fw, fh, 4); ctx.clip();
  for (let i = 0; i < 46; i++) {
    const a = hash(i + 1), b = hash(i + 91);
    ctx.strokeStyle = b > 0.5 ? 'rgba(60,30,10,0.16)' : 'rgba(255,214,150,0.12)'; ctx.lineWidth = 0.18 + b * 0.25;
    ctx.beginPath(); ctx.moveTo(fx0 + a * fw, fy0); ctx.bezierCurveTo(fx0 + a * fw + (b - 0.5) * 4, fy0 + fh * 0.3, fx0 + a * fw - (b - 0.5) * 5, fy0 + fh * 0.7, fx0 + a * fw + (b - 0.5) * 3, fy0 + fh); ctx.stroke();
  }
  ctx.restore();
  // top bevel light
  ctx.strokeStyle = 'rgba(255,226,170,0.35)'; ctx.lineWidth = 0.35; rr(ctx, fx0 + 0.3, fy0 + 0.3, fw - 0.6, fh - 0.6, 3.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(30,12,2,0.55)'; ctx.lineWidth = 0.45; rr(ctx, fx0 + RIM - 0.5, fy0 + RIM - 0.5, fw - 2 * RIM + 1, fh - 2 * RIM + 1, 2); ctx.stroke();
  // felt
  ctx.save(); outline(ctx, HW, HL, CHAMFER); ctx.clip();
  const felt = ctx.createLinearGradient(0, -HL, 0, HL); felt.addColorStop(0, '#2c8a46'); felt.addColorStop(0.5, '#34a054'); felt.addColorStop(1, '#2a8044');
  ctx.fillStyle = felt; ctx.fillRect(-HW, -HL, FW, FL);
  for (let i = 0; i < 8; i++) { if (i & 1) { ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(-HW, -HL + i * 15, FW, 15); } }
  // felt weave
  ctx.strokeStyle = 'rgba(0,40,10,0.06)'; ctx.lineWidth = 0.1;
  for (let y = -HL; y < HL; y += 1.6) { ctx.beginPath(); ctx.moveTo(-HW, y); ctx.lineTo(HW, y); ctx.stroke(); }
  // markings
  ctx.strokeStyle = 'rgba(255,255,255,0.78)'; ctx.lineWidth = 0.55;
  ctx.beginPath(); ctx.moveTo(-HW, 0); ctx.lineTo(HW, 0); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(0, 0, 0.9, 0, TAU); ctx.fill();
  for (const sg of [-1, 1]) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.45;
    ctx.strokeRect(-20, sg > 0 ? HL - 15 : -HL, 40, 15);
    ctx.strokeRect(-GOAL_HW - 2, sg > 0 ? HL - 6 : -HL, 2 * GOAL_HW + 4, 6);
    ctx.beginPath(); ctx.arc(0, sg * (HL - 21), 6, sg > 0 ? Math.PI * 1.15 : Math.PI * 0.15, sg > 0 ? Math.PI * 1.85 : Math.PI * 0.85); ctx.stroke();
  }
  // inner shading near the rails
  const ish = ctx.createLinearGradient(-HW, 0, HW, 0);
  ish.addColorStop(0, 'rgba(0,0,0,0.30)'); ish.addColorStop(0.07, 'rgba(0,0,0,0)'); ish.addColorStop(0.93, 'rgba(0,0,0,0)'); ish.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = ish; ctx.fillRect(-HW, -HL, FW, FL);
  const ish2 = ctx.createLinearGradient(0, -HL, 0, HL);
  ish2.addColorStop(0, 'rgba(0,0,0,0.30)'); ish2.addColorStop(0.05, 'rgba(0,0,0,0)'); ish2.addColorStop(0.95, 'rgba(0,0,0,0)'); ish2.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = ish2; ctx.fillRect(-HW, -HL, FW, FL);
  ctx.restore();
  // goal pockets with nets
  const wob = o.netWob || 0;
  for (const sg of [-1, 1]) {
    const y0 = sg > 0 ? HL : -HL - 6;
    ctx.fillStyle = '#120a06'; ctx.fillRect(-GOAL_HW, y0, 2 * GOAL_HW, 6);
    ctx.strokeStyle = 'rgba(235,235,225,0.5)'; ctx.lineWidth = 0.14;
    for (let x = -GOAL_HW; x <= GOAL_HW; x += 1.5) { ctx.beginPath(); ctx.moveTo(x + wob * Math.sin(x), y0); ctx.lineTo(x + wob * Math.sin(x + 1), y0 + 6); ctx.stroke(); }
    for (let y = 0; y <= 6; y += 1.5) { ctx.beginPath(); ctx.moveTo(-GOAL_HW, y0 + y); ctx.lineTo(GOAL_HW, y0 + y); ctx.stroke(); }
    for (const px of [-GOAL_HW, GOAL_HW]) {
      const pg = ctx.createRadialGradient(px - 0.2, sg * HL - 0.2, 0.1, px, sg * HL, 1);
      pg.addColorStop(0, '#fff7da'); pg.addColorStop(1, '#b58a30'); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, sg * HL, 0.8, 0, TAU); ctx.fill();
    }
  }
  // corner brass studs
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const px = sx * (HW + RIM / 2), py = sy * (HL + RIM / 2);
    const bg = ctx.createRadialGradient(px - 0.3, py - 0.3, 0.1, px, py, 1.3); bg.addColorStop(0, '#ffe9a8'); bg.addColorStop(1, '#8a6218');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(px, py, 1.15, 0, TAU); ctx.fill();
  }

  // ---- rods, men, handles -----------------------------------------------------------------------------------------
  const L = -HW - RIM - 2.5, Rr = HW + RIM + GRIP;
  // shadows first (rods and men)
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  for (const r of rods) {
    ctx.fillRect(-HW + sh.x, r.y - 0.45 + sh.y, FW, 0.9);
    const K = KINDS[r.kind], d = dirOf(r.team);
    for (let k = 0; k < K.n; k++) { const cx = manX(r, k), cy = r.y + d * r.f; rr(ctx, cx - MAN_HX + sh.x * 1.1, cy - MAN_HY + sh.y * 1.1, 2 * MAN_HX, 2 * MAN_HY, 0.9); ctx.fill(); }
  }
  const sel = o.active;
  for (const r of rods) {
    const kit = r.team === 0 ? kits[0] : kits[1], d = dirOf(r.team), K = KINDS[r.kind];
    const isSel = Array.isArray(sel) ? sel.includes(r.i) : r.team === 0 && sel === r.i;
    // chrome rod
    const rg = ctx.createLinearGradient(0, r.y - 0.8, 0, r.y + 0.8);
    if (lay.wide) { /* gradient axis follows the screen vertical */ rg.addColorStop(0, '#6c7078'); rg.addColorStop(0.35, '#f3f6fb'); rg.addColorStop(0.55, '#c3c8d0'); rg.addColorStop(1, '#575b63'); } else {
      rg.addColorStop(0, '#6c7078'); rg.addColorStop(0.35, '#f3f6fb'); rg.addColorStop(0.55, '#c3c8d0'); rg.addColorStop(1, '#575b63');
    }
    if (isSel) { ctx.fillStyle = 'rgba(255,224,120,0.26)'; ctx.fillRect(L - 1, r.y - 3.2, Rr - L + 3, 6.4); }
    ctx.fillStyle = rg; ctx.fillRect(L, r.y - 0.8, Rr - L, 1.6);
    // men: leg from the rod to the boot, boot, shoulders and head
    for (let k = 0; k < K.n; k++) {
      const cx = manX(r, k), fy = r.y + d * r.f;
      // leg
      ctx.fillStyle = kit.dark;
      const ly0 = Math.min(r.y, fy), ly1 = Math.max(r.y, fy);
      if (ly1 - ly0 > 0.2) ctx.fillRect(cx - 1.1, ly0, 2.2, ly1 - ly0);
      // boot (this is the collision rectangle)
      const bgd = ctx.createLinearGradient(cx - MAN_HX, 0, cx + MAN_HX, 0);
      if (lay.wide) { bgd.addColorStop(0, kit.col); bgd.addColorStop(1, kit.col); }
      bgd.addColorStop(0, kit.light); bgd.addColorStop(0.5, kit.col); bgd.addColorStop(1, kit.dark);
      ctx.fillStyle = bgd; rr(ctx, cx - MAN_HX, fy - MAN_HY, 2 * MAN_HX, 2 * MAN_HY, 0.9); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.18; ctx.stroke();
      ctx.fillStyle = kit.trim; ctx.fillRect(cx - MAN_HX + 0.5, fy - 0.25 - d * 0.0, 2 * MAN_HX - 1, 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; rr(ctx, cx - MAN_HX + 0.35, fy - MAN_HY + 0.3, 1.1, 2 * MAN_HY - 0.6, 0.5); ctx.fill();
      // shoulders and head sit on the rod
      const sg = ctx.createLinearGradient(cx - 2.6, 0, cx + 2.6, 0); sg.addColorStop(0, kit.light); sg.addColorStop(0.55, kit.col); sg.addColorStop(1, kit.dark);
      ctx.fillStyle = sg; rr(ctx, cx - 2.6, r.y - 1.0 - d * 0.0, 5.2, 2.0, 0.8); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.16; ctx.stroke();
      const hg = ctx.createRadialGradient(cx - 0.35, r.y - 0.35, 0.1, cx, r.y, 1.3); hg.addColorStop(0, '#f6d7b0'); hg.addColorStop(1, '#a8703c');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, r.y, 1.05, 0, TAU); ctx.fill();
    }
    // handle outside the rail: the player's rods on the right, the rival's on the left (as seen in portrait)
    const hx0 = r.team === 0 ? HW + RIM + 1.5 : -HW - RIM - 1.5 - GRIP + 0;
    const hxA = r.team === 0 ? hx0 + r.off * 0.0 : hx0;
    const off = r.off;   // the handle slides with the rod
    const hhx = hxA + off;
    const hg2 = ctx.createLinearGradient(0, r.y - 2, 0, r.y + 2);
    hg2.addColorStop(0, '#1b1b1f'); hg2.addColorStop(0.3, '#55565e'); hg2.addColorStop(0.5, '#3a3b42'); hg2.addColorStop(1, '#0e0e11');
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, hhx + sh.x, r.y - 1.9 + sh.y, GRIP - 1.5, 3.8, 1.6); ctx.fill();
    ctx.fillStyle = hg2; rr(ctx, hhx, r.y - 1.9, GRIP - 1.5, 3.8, 1.6); ctx.fill();
    ctx.fillStyle = kit.col; ctx.fillRect(hhx + (r.team === 0 ? 0.4 : GRIP - 3.2), r.y - 1.9, 1.3, 3.8);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; rr(ctx, hhx + 1, r.y - 1.4, GRIP - 3.5, 0.8, 0.4); ctx.fill();
    if (isSel) { ctx.strokeStyle = '#ffd77a'; ctx.lineWidth = 0.45; rr(ctx, hhx - 0.5, r.y - 2.4, GRIP - 0.5, 4.8, 2); ctx.stroke(); }
  }

  // ---- ball ---------------------------------------------------------------------------------------------------------------
  const b = S.ball;
  const hide = S.phase === 'goal' && S.phaseT > 1.2 ? 0.0 : 1;
  if (o.trail && S.hist.length) {
    for (let i = 0; i < S.hist.length; i += 2) {
      const p = S.hist[i], a = i / S.hist.length, sp = Math.hypot(p.vx, p.vy);
      if (sp < 90) continue;
      ctx.fillStyle = `rgba(255,255,255,${0.12 * a * Math.min(1, sp / 220)})`; ctx.beginPath(); ctx.arc(p.x, p.y, BALL_R * (0.5 + 0.4 * a), 0, TAU); ctx.fill();
    }
  }
  if (hide) {
    ctx.fillStyle = 'rgba(0,0,0,0.34)'; ctx.beginPath(); ctx.ellipse(b.x + sh.x * 0.9, b.y + sh.y * 0.9, BALL_R * 1.02, BALL_R * 0.92, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(b.x, b.y);
    ctx.rotate(-(lay.wide ? Math.PI / 2 : 0));
    const bg = ctx.createRadialGradient(-BALL_R * 0.35, -BALL_R * 0.4, BALL_R * 0.1, 0, 0, BALL_R * 1.05);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.55, '#efe9dc'); bg.addColorStop(1, '#a29b8c');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, TAU); ctx.clip();
    ctx.rotate(b.rot * 0.9);
    ctx.fillStyle = 'rgba(40,36,34,0.82)';
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * BALL_R * 0.78, Math.sin(a) * BALL_R * 0.78, BALL_R * 0.3, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 0, BALL_R * 0.3, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(-BALL_R * 0.35, -BALL_R * 0.4, BALL_R * 0.32, BALL_R * 0.2, -0.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.15; ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // overlays in table space: aim arrow / hint
  if (o.overlay) o.overlay(ctx, lay, S);
  // particles
  if (o.fx) {
    for (const p of o.fx) {
      const a = Math.max(0, 1 - p.age / p.life);
      ctx.globalAlpha = a; ctx.fillStyle = p.col;
      if (p.t === 'conf') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.age * p.spin); ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export const KIT_PAL = (col, trim) => {
  const m = (hex, f) => { const n = parseInt(hex.slice(1), 16); const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f))), g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f))), b = Math.max(0, Math.min(255, Math.round((n & 255) * f))); return `rgb(${r},${g},${b})`; };
  return { col, trim, light: m(col, 1.35), dark: m(col, 0.62) };
};
