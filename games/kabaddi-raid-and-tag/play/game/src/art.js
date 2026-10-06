// 2D drawing shared by the minimap, the no-WebGL fallback view, the menus' live court and the Rules illustrations.
// Everything is drawn in the raid-local frame: the raider's own half at the bottom, the defenders' half above, the midline between.
import { COURT, formationSlots } from './rules.js';
import { toLocal } from './sim.js';
import { FONT, C, roundPath } from './ui.js';
import { W, H, minFont } from './layout.js';

export const TAU = Math.PI * 2;
export const TEAM_COL = [{ main: '#2f6fd6', dark: '#1d4590', light: '#8fb5f5', name: 'Blue', bottoms: '#f2f2f2' }, { main: '#d8453a', dark: '#8c231c', light: '#f5a199', name: 'Red', bottoms: '#2a2a2e' }];

// A projection from raid-local (x, u) to a rectangle: u runs up the screen, x grows toward the raider's left (screen left).
export function courtMap(rect, u0 = -1.2, u1 = COURT.HALF + 0.2) {
  const kx = rect.w / COURT.W, ku = rect.h / (u1 - u0);
  return { k: Math.min(kx, ku), sx: (x) => rect.x + (COURT.W - x) * kx, sy: (u) => rect.y + rect.h - (u - u0) * ku, kx, ku, rect, u0, u1 };
}

export function drawMat(ctx, mp, o = {}) {
  const { rect } = mp;
  ctx.save();
  roundPath(ctx, rect.x, rect.y, rect.w, rect.h, o.r ?? 12);
  ctx.clip();
  const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  g.addColorStop(0, '#cfa56a'); g.addColorStop(1, '#dcb985');
  ctx.fillStyle = g; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  // the raider's half is slightly darker so the midline reads even without lines
  const yMid = mp.sy(0);
  ctx.fillStyle = 'rgba(40,24,8,0.10)'; ctx.fillRect(rect.x, yMid, rect.w, rect.y + rect.h - yMid);
  const lw = Math.max(1.5, mp.k * 0.09), line = (u, col = 'rgba(255,255,255,0.92)', w = lw) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(rect.x, mp.sy(u)); ctx.lineTo(rect.x + rect.w, mp.sy(u)); ctx.stroke(); };
  // lobbies
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(rect.x, mp.sy(COURT.HALF), mp.kx * COURT.LOBBY, mp.sy(mp.u0) - mp.sy(COURT.HALF));
  ctx.fillRect(rect.x + rect.w - mp.kx * COURT.LOBBY, mp.sy(COURT.HALF), mp.kx * COURT.LOBBY, mp.sy(mp.u0) - mp.sy(COURT.HALF));
  line(0, '#ffffff', lw * 1.6);
  line(COURT.BAULK, 'rgba(255,255,255,0.9)');
  line(COURT.BONUS, 'rgba(255,214,110,0.95)');
  line(COURT.HALF, '#ffffff', lw * 1.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = lw;
  for (const x of [COURT.LOBBY, COURT.W - COURT.LOBBY]) { ctx.beginPath(); ctx.moveTo(mp.sx(x), mp.sy(0)); ctx.lineTo(mp.sx(x), mp.sy(COURT.HALF)); ctx.stroke(); }
  if (o.labels) {
    const fs = Math.max(minFont(11), Math.min(17, Math.round(mp.k * 0.3)));
    ctx.font = `800 ${fs}px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    const lx = rect.x + rect.w - mp.kx * COURT.LOBBY - 6;
    ctx.fillStyle = 'rgba(70,40,10,0.85)';
    ctx.fillText('midline', lx, mp.sy(0) - 3);
    ctx.fillText('baulk line 3.75 m', lx, mp.sy(COURT.BAULK) - 3);
    ctx.fillStyle = 'rgba(120,70,0,0.95)'; ctx.fillText('bonus line 4.75 m', lx, mp.sy(COURT.BONUS) - 3);
    ctx.fillStyle = 'rgba(70,40,10,0.85)'; ctx.fillText('end line', lx, mp.sy(COURT.HALF) + fs + 3);
  }
  ctx.restore();
  roundPath(ctx, rect.x, rect.y, rect.w, rect.h, o.r ?? 12);
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(20,30,40,0.7)'; ctx.stroke();
}

// One player seen from above: a round body in the team colour with the jersey number, and a small head showing the way he faces.
export function drawDot(ctx, x, y, r, team, o = {}) {
  const col = TEAM_COL[team];
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x + 1.5, y + 3, r * 1.05, r * 0.9, 0, 0, TAU); ctx.fill();
  if (o.ring) { ctx.lineWidth = Math.max(2.5, r * 0.26); ctx.strokeStyle = o.ring; ctx.beginPath(); ctx.arc(x, y, r * 1.38, 0, TAU); ctx.stroke(); }
  const yaw = o.yaw ?? 0;
  // the head sits toward the facing direction
  const hx = x + Math.sin(yaw) * r * 0.95, hy = y - Math.cos(yaw) * r * 0.95;
  ctx.fillStyle = '#e8c9a6'; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath(); ctx.arc(hx, hy, r * 0.42, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = o.fill ?? col.main; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.16); ctx.strokeStyle = o.edge ?? col.dark; ctx.stroke();
  if (o.num !== undefined && r >= 7) {
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(r * (String(o.num).length > 1 ? 0.95 : 1.15))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(o.num), x, y + r * 0.06);
  }
  ctx.restore();
}

// Actors of the scene in raid-local screen positions. `team` = raiding team (the frame is that team's).
export function drawActors(ctx, mp, sc, o = {}) {
  const raid = sc.raid;
  const rt = raid ? raid.team : (sc.pre ? sc.pre.team : 0);
  const r = o.r ?? Math.max(6, mp.k * 0.42);
  const list = sc.actors.filter((a) => a.show || (o.all && a.role !== 'out'));
  for (const a of list) {
    const l = toLocal(rt, a.wx, a.wz);
    if (l.u < mp.u0 - 0.5 || l.u > mp.u1 + 0.5) continue;
    const isRaider = raid && a.team === raid.team && a.idx === raid.raider;
    const touched = raid && a.team === raid.def && raid.banked.includes(a.idx);
    const isTarget = o.target != null && raid && a.team === raid.def && a.idx === o.target;
    drawDot(ctx, mp.sx(l.x), mp.sy(l.u), isRaider ? r * 1.12 : r, a.team, {
      yaw: yawToScreen(rt, a.yaw), num: o.nums === false ? undefined : a.num, ring: isTarget ? '#ffd24a' : isRaider ? 'rgba(255,255,255,0.9)' : touched ? 'rgba(255,255,255,0.0)' : undefined,
      alpha: touched ? 0.55 : 1, edge: touched ? '#fff' : undefined,
    });
    if (touched) { ctx.save(); ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = Math.max(2, r * 0.25); ctx.beginPath(); ctx.arc(mp.sx(l.x), mp.sy(l.u), r * 1.3, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
}
// World yaw (0 faces +z) -> the dot's rotation on screen (rotation 0 = facing up the screen).
function yawToScreen(rt, yaw) {
  const hx = rt === 0 ? Math.sin(yaw) : -Math.sin(yaw), hu = rt === 0 ? Math.cos(yaw) : -Math.cos(yaw);
  return Math.atan2(-hx, hu);
}

export function drawFormationPreview(ctx, mp, form, n, team, o = {}) {
  const slots = formationSlots(form, n), r = o.r ?? Math.max(5, mp.k * 0.38);
  slots.forEach((s) => drawDot(ctx, mp.sx(s.x), mp.sy(s.u), r, team, { yaw: Math.PI, alpha: 0.95 }));
}

export function drawBackdrop(ctx, t = 0) {
  const w = W, h = H, k = Math.max(1, w / 720), kh = h / 1280;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0b1a22'); g.addColorStop(0.55, '#10303a'); g.addColorStop(1, '#0a1a20');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // stadium lights: soft pools, no shapes with edges
  const lights = [[0.167, 0.07], [0.833, 0.094], [0.5, 0.031]];
  for (const [fx, fy] of lights) { const x = fx * w, y = fy * h, rr = 360 * Math.max(1, k * 0.8); const rg = ctx.createRadialGradient(x, y, 0, x, y, rr); rg.addColorStop(0, 'rgba(255,214,140,0.18)'); rg.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h * 0.65); }
  // the mat in perspective at the bottom, lines only
  ctx.save();
  const horizon = h * 0.594, base = h, cx = w / 2, sx = k * Math.min(1, 0.5 + kh);
  const mg = ctx.createLinearGradient(0, horizon, 0, base); mg.addColorStop(0, 'rgba(196,150,92,0.0)'); mg.addColorStop(0.25, 'rgba(196,150,92,0.35)'); mg.addColorStop(1, 'rgba(206,164,108,0.55)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.moveTo(cx - 60 * sx, horizon); ctx.lineTo(cx + 60 * sx, horizon); ctx.lineTo(cx + 460 * sx, base); ctx.lineTo(cx - 460 * sx, base); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.20)'; ctx.lineWidth = 3;
  for (const f of [0.0, 0.18, 0.42, 0.74]) { const y = horizon + (base - horizon) * f, half = (60 + 330 * (0.1 + f * 0.9)) * sx; ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx + half, y); ctx.stroke(); }
  ctx.restore();
}

export function pill(ctx, x, y, text, o = {}) {
  const fs = o.size ?? 18;
  ctx.font = `800 ${fs}px ${FONT}`;
  const w = ctx.measureText(text).width + fs * 1.1, h = fs * 1.6;
  roundPath(ctx, x, y, w, h, h / 2); ctx.fillStyle = o.fill ?? C.red; ctx.fill();
  ctx.fillStyle = o.color ?? '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  return w;
}
