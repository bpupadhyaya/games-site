// Drawing the play screen: the green seen from above through the camera, bowls, the guide line and ghost, the whole-rink map, the
// scoreboard cards, the control bar and the end-of-end measuring close-up. Pure drawing from `state` and the layout; game.js owns state.
import { RINK, R_BOWL, R_JACK, WEIGHTS, ranking, theJack, GREENS, paceSeconds } from './sim.js';
import { drawGreen, drawBowl, drawJack, drawBowlIcon, TEAM, GREEN, setHost } from './art.js';
import { projector } from './cam.js';
import { v3 } from './v3.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines } from './ui.js';
import { inRect } from './layout.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// pixel radius of a ball on screen: true size when zoomed in, never smaller than a readable dot
export const bowlPx = (b, s) => Math.max(b.r * s, b.k ? 3.2 : 5.2);

export function projFor(L, cam) { return projector(L.play.head, L.wide, cam); }

// ---- the world on its own: the backdrop of every menu and the heart of the play screen -------------------------------------------
export function drawWorld(ctx, view, pr, state, world, parts, o = {}) {
  setHost(ctx);
  // with the 3D presenter the green, the bowls, the trail and the dust are the lit scene behind this canvas
  if (v3.on) return;
  drawGreen(ctx, view, pr, { minJack: o.minJack });
  ctx.save();
  ctx.beginPath(); ctx.rect(view.x, view.y, view.w, view.h); ctx.clip();
  const s = pr.s, rgt = pr.right;
  // the trail of the bowl that is rolling
  if (o.trail && o.trail.length > 4) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < o.trail.length; i += 2) { const p = pr.p(o.trail[i], o.trail[i + 1]); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
    ctx.stroke();
  }
  // the bowl that is in (nearest the jack): a soft ring
  if (!o.noRing && world.balls.length) {
    const rk = ranking(world);
    if (rk.length) {
      const b = rk[0].b, p = pr.p(b.x, b.y), rp = bowlPx(b, s) * 1.5, pulse = 0.6 + 0.4 * Math.sin((state.t || 0) * 4);
      ctx.strokeStyle = `rgba(255,214,90,${0.5 + 0.3 * pulse})`; ctx.lineWidth = Math.max(1.5, rp * 0.12);
      ctx.beginPath(); ctx.arc(p.x, p.y, rp, 0, TAU); ctx.stroke();
    }
  }
  const list = world.balls.filter((b) => !(b.fade > 1.1));
  for (const b of list) {
    const p = pr.p(b.x, b.y), rp = bowlPx(b, s);
    if (p.x < view.x - 30 || p.x > view.x + view.w + 30 || p.y < view.y - 30 || p.y > view.y + view.h + 30) continue;
    const dead = (b.out || (b.ditch && !b.toucher && !b.k)) && !b.k;
    const alpha = dead ? clamp(1 - b.fade * 0.8, 0, 1) : 1;
    if (b.k) drawJack(ctx, p.x, p.y, rp, { alpha });
    else drawBowl(ctx, p.x, p.y, rp, b.team, { alpha, bx: rgt.x * b.bias, by: rgt.y * b.bias, toucher: b.toucher && b.ditch });
  }
  if (parts && parts.length) {
    for (const q of parts) {
      const k = q.t / q.max, p = pr.p(q.x, q.y);
      ctx.globalAlpha = Math.max(0, 1 - k);
      if (q.kind === 1) { ctx.fillStyle = '#fff6c4'; ctx.beginPath(); ctx.arc(p.x, p.y - q.z * s * 0.4, 1.6 + (1 - k), 0, TAU); ctx.fill(); }
      else if (q.kind === 2) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + k * 26, 0, TAU); ctx.stroke(); }
      else { ctx.fillStyle = q.col ?? 'rgba(235,225,190,0.85)'; ctx.beginPath(); ctx.arc(p.x, p.y - q.z * s * 0.4, (q.size ?? 3) * (0.6 + k), 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---- guides: path, spread, target, ghost -------------------------------------------------------------------------------------------
function worldPoly(ctx, pr, pts, from = 0, to = pts.length) {
  ctx.beginPath();
  for (let i = from; i < to; i += 2) { const p = pr.p(pts[i], pts[i + 1]); if (i === from) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
}
function pathLen(pts) { let d = 0; for (let i = 2; i < pts.length; i += 2) d += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); return d; }

function drawGuides(ctx, L, pr, state) {
  const P = L.play, view = P.view, m = state.m, s = pr.s;
  ctx.save(); ctx.beginPath(); ctx.rect(view.x, view.y, view.w, view.h); ctx.clip();
  const guideMode = state.settings.guide;     // 0 full path, 1 first part, 2 off
  const pv = state.prev, a = state.aim;
  const showAim = (state.humanTurn || (state.think && (state.think.phase === 'reveal' || state.think.phase === 'pull'))) && a && (m.phase === 'aim' || m.phase === 'jack');
  if (v3.on) {
    // the 3D presenter lays the ring, the dotted path, the ghost bowl and the spread on the grass; only the weight word is drawn here
    if (showAim && a && m.phase === 'aim') {
      const p = pr.p(a.x, a.y), rp = Math.max(14, 0.2 * pr.sAt(a.x, a.y));
      ctx.font = `700 ${Math.round(clamp(rp * 0.8, 15, 20))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff6d8'; ctx.shadowColor = 'rgba(0,10,0,0.85)'; ctx.shadowBlur = 5;
      ctx.fillText(WEIGHTS[a.weight].name, p.x, p.y + rp * 2.1 + 10); ctx.shadowBlur = 0;
    }
    ctx.restore();
    return;
  }
  if (showAim && pv) {
    const col = m.phase === 'jack' ? 'rgba(255,240,170,0.95)' : 'rgba(255,255,255,0.95)';
    const pts = pv.path, total = pathLen(pts);
    if (guideMode !== 2 || !state.humanTurn) {
      let end = pts.length;
      if (guideMode === 1 && state.humanTurn) {
        let d = 0; end = 2;
        for (let i = 2; i < pts.length; i += 2) { d += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]); end = i + 2; if (d > total * 0.38) break; }
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,30,10,0.45)'; ctx.lineWidth = Math.max(3.2, s * 0.07); ctx.setLineDash([]);
      worldPoly(ctx, pr, pts, 0, end); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.8, s * 0.04); ctx.setLineDash([Math.max(6, s * 0.14), Math.max(5, s * 0.1)]);
      ctx.lineDashOffset = -(state.t * 14) % 100;
      worldPoly(ctx, pr, pts, 0, end); ctx.stroke(); ctx.setLineDash([]);
    }
    // ghost: where it would finish, and any bowls it would move (full guide only)
    if (guideMode === 0 || !state.humanTurn) {
      if (m.phase === 'aim') {
        for (const o of pv.moved) {
          const p0 = pr.p(o.x0, o.y0), p1 = pr.p(o.x, o.y);
          ctx.strokeStyle = 'rgba(255,200,90,0.8)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); ctx.setLineDash([]);
          if (o.k) drawJack(ctx, p1.x, p1.y, Math.max(3.2, R_JACK * s), { alpha: 0.5, shadow: false });
          else drawBowl(ctx, p1.x, p1.y, Math.max(5.2, R_BOWL * s), o.team, { alpha: 0.45, shadow: false });
        }
        const pr0 = pr.p(pv.rest.x, pv.rest.y);
        const side = m.turn;
        drawBowl(ctx, pr0.x, pr0.y, Math.max(5.2, R_BOWL * s), side, { alpha: 0.6, shadow: false });
      }
    }
    // the spread: how far a shaky hand could miss
    if (state.humanTurn && guideMode !== 2 && pv.spread) {
      const sp = pv.spread;
      ctx.beginPath();
      for (let i = 0; i <= 28; i++) {
        const t = (i / 28) * TAU, p = pr.p(pv.rest.x + Math.cos(t) * sp.x * 2, pv.rest.y + Math.sin(t) * sp.y * 2);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath(); ctx.fillStyle = 'rgba(255,230,120,0.16)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,120,0.8)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // the target ring
  if (showAim && a) {
    const p = pr.p(a.x, a.y), rp = Math.max(9, 0.15 * s) * (1 + 0.06 * Math.sin(state.t * 5));
    ctx.strokeStyle = 'rgba(0,20,8,0.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, rp, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, rp, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x - rp * 1.5, p.y); ctx.lineTo(p.x - rp * 0.5, p.y); ctx.moveTo(p.x + rp * 0.5, p.y); ctx.lineTo(p.x + rp * 1.5, p.y);
    ctx.moveTo(p.x, p.y - rp * 1.5); ctx.lineTo(p.x, p.y - rp * 0.5); ctx.moveTo(p.x, p.y + rp * 0.5); ctx.lineTo(p.x, p.y + rp * 1.5); ctx.stroke();
    if (m.phase === 'aim') {
      ctx.font = `700 ${Math.round(clamp(rp * 0.9, 13, 18))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff6d8'; ctx.shadowColor = 'rgba(0,10,0,0.8)'; ctx.shadowBlur = 4;
      ctx.fillText(WEIGHTS[a.weight].name, p.x, p.y + rp * 2.3 + 8); ctx.shadowBlur = 0;
    }
  }
  // the jack's length line in the jack phase is the preview path itself; the hint is the same ring with a different colour
  if (state.hintPlan && state.humanTurn) {
    const p = pr.p(state.hintPlan.tx, state.hintPlan.ty), rp = Math.max(11, 0.26 * s) + 2 * Math.sin(state.t * 6);
    ctx.strokeStyle = 'rgba(120,255,190,0.95)'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(p.x, p.y, rp, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

// ---- the whole-rink map --------------------------------------------------------------------------------------------------------------
const MAP_Y0 = -1.2, MAP_Y1 = RINK.bank + 0.4;
export function miniMap(L) {
  const M = L.play.mini, wide = L.wide, along = MAP_Y1 - MAP_Y0;
  if (!wide) {
    const ky = M.h / along, kx = Math.min(13, (M.w - 12) / (2 * RINK.half));
    return { M, p: (x, y) => ({ x: M.x + M.w / 2 + x * kx, y: M.y + M.h - (y - MAP_Y0) * ky }), inv: (sx, sy) => ({ x: (sx - (M.x + M.w / 2)) / kx, y: MAP_Y0 + (M.y + M.h - sy) / ky }), kx, ky };
  }
  const kyy = M.w / along, kxx = Math.min(14, (M.h - 14) / (2 * RINK.half));
  return { M, p: (x, y) => ({ x: M.x + (y - MAP_Y0) * kyy, y: M.y + M.h / 2 + x * kxx }), inv: (sx, sy) => ({ x: (sy - (M.y + M.h / 2)) / kxx, y: MAP_Y0 + (sx - M.x) / kyy }), kx: kxx, ky: kyy };
}
function drawMini(ctx, L, pr, state) {
  const mp = miniMap(L), M = mp.M, w = state.w, wide = L.wide;
  ctx.save();
  roundPath(ctx, M.x, M.y, M.w, M.h, 12); ctx.fillStyle = 'rgba(8,24,18,0.82)'; ctx.fill();
  ctx.strokeStyle = 'rgba(214,176,86,0.85)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); roundPath(ctx, M.x, M.y, M.w, M.h, 12); ctx.clip();
  const a = mp.p(-RINK.half, 0), b = mp.p(RINK.half, RINK.ditch);
  { const gx = Math.min(a.x, b.x), gy = Math.min(a.y, b.y), gw = Math.abs(b.x - a.x), gh = Math.abs(b.y - a.y);
    ctx.fillStyle = '#4f9a3c'; ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = 'rgba(20,70,30,0.28)';   // mown stripes
    const n = 6; for (let i = 0; i < n; i += 2) { if (wide) ctx.fillRect(gx, gy + (gh / n) * i, gw, gh / n); else ctx.fillRect(gx + (gw / n) * i, gy, gw / n, gh); } }
  const d0 = mp.p(-RINK.half, RINK.ditch), d1 = mp.p(RINK.half, RINK.bank);
  ctx.fillStyle = '#bfa97a'; ctx.fillRect(Math.min(d0.x, d1.x), Math.min(d0.y, d1.y), Math.abs(d1.x - d0.x), Math.abs(d1.y - d0.y));
  const m0 = mp.p(-0.2, -0.6), m1 = mp.p(0.2, 0);
  ctx.fillStyle = '#25292d'; ctx.fillRect(Math.min(m0.x, m1.x), Math.min(m0.y, m1.y), Math.max(3, Math.abs(m1.x - m0.x)), Math.max(3, Math.abs(m1.y - m0.y)));
  if (state.m.phase === 'jack' || state.m.phase === 'jack-fly') {
    const l0 = mp.p(-RINK.half, RINK.minJack), l1 = mp.p(RINK.half, RINK.minJack);
    ctx.strokeStyle = 'rgba(255,236,150,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(l0.x, l0.y); ctx.lineTo(l1.x, l1.y); ctx.stroke();
  }
  // the guide path, thin
  if (state.humanTurn && state.prev && state.settings.guide !== 2 && state.m.phase !== 'score') {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.3; ctx.beginPath();
    const pts = state.prev.path;
    for (let i = 0; i < pts.length; i += 2) { const p = mp.p(pts[i], pts[i + 1]); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
    ctx.stroke();
  }
  if (state.trail && state.trail.length > 4) {
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < state.trail.length; i += 2) { const p = mp.p(state.trail[i], state.trail[i + 1]); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
    ctx.stroke();
  }
  for (const bl of w.balls) {
    if (bl.fade > 1) continue;
    const p = mp.p(bl.x, bl.y);
    if (bl.k) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, TAU); ctx.fill(); ctx.stroke(); }
    else { ctx.fillStyle = bl.team === 0 ? '#14151a' : '#f2ead0'; ctx.strokeStyle = bl.team === 0 ? '#d8402f' : '#2a68c8'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(p.x, p.y, 3.6, 0, TAU); ctx.fill(); ctx.stroke(); }
  }
  // what the camera is showing
  const H = L.play.head, c0 = pr.inv(H.x, H.y), c1 = pr.inv(H.x + H.w, H.y + H.h);
  const q0 = mp.p(clamp(Math.min(c0.x, c1.x), -3, 3), clamp(Math.min(c0.y, c1.y), MAP_Y0, MAP_Y1)), q1 = mp.p(clamp(Math.max(c0.x, c1.x), -3, 3), clamp(Math.max(c0.y, c1.y), MAP_Y0, MAP_Y1));
  ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.lineWidth = 1.6;
  ctx.strokeRect(Math.min(q0.x, q1.x), Math.min(q0.y, q1.y), Math.abs(q1.x - q0.x), Math.abs(q1.y - q0.y));
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `600 15px ${FONT}`; ctx.textAlign = wide ? 'left' : 'center'; ctx.textBaseline = 'alphabetic';
  if (!wide) ctx.fillText('MAP', M.x + M.w / 2, M.y + 14); else ctx.fillText('MAP', M.x + 8, M.y + 14);
  ctx.restore();
}

// ---- HUD ---------------------------------------------------------------------------------------------------------------------------
function scoreCard(ctx, r, side, state) {
  const m = state.m, lab = state.labels[side];
  const turn = m.turn === side && ['aim', 'fly', 'jack', 'jack-fly'].includes(m.phase);
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: 'rgba(12,32,56,0.9)', stroke: turn ? 'rgba(236,198,92,0.95)' : 'rgba(255,255,255,0.2)' });
  const col = TEAM[side];
  ctx.fillStyle = side === 0 ? '#1b1c22' : '#f4ecd3'; roundPath(ctx, r.x + 9, r.y + 12, 8, r.h - 24, 4); ctx.fill();
  ctx.strokeStyle = col.decal; ctx.lineWidth = 2; ctx.stroke();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  let fs = 27; ctx.font = `700 ${fs}px ${FONT}`;
  while (ctx.measureText(lab.name).width > r.w - 100 && fs > 17) { fs--; ctx.font = `700 ${fs}px ${FONT}`; }
  ctx.fillStyle = '#fff6e0'; ctx.fillText(lab.name, r.x + 28, r.y + 31);
  ctx.font = `500 19px ${FONT}`; ctx.fillStyle = 'rgba(255,246,224,0.72)'; ctx.fillText(lab.sub ?? `${col.name} bowls`, r.x + 28, r.y + 54);
  const left = m.left[side] - (turn && (m.phase === 'fly') ? 0 : 0);
  for (let i = 0; i < 4; i++) drawBowlIcon(ctx, r.x + 38 + i * 25, r.y + r.h - (r.h < 90 ? 12 : 17), 8.5, side, i < left ? 1 : 0.22, { shadow: false });
  ctx.textAlign = 'right'; ctx.font = `700 ${r.h > 84 ? 54 : 46}px ${DISPLAY}`; ctx.fillStyle = '#ecc65c';
  ctx.fillText(String(m.scores[side]), r.x + r.w - 16, r.y + r.h - 16);
  if (turn) { ctx.fillStyle = '#ecc65c'; ctx.beginPath(); ctx.arc(r.x + r.w - 18, r.y + 16, 4.5 + Math.sin(state.t * 6), 0, TAU); ctx.fill(); }
}

function pill(ctx, x, y, text, maxW) {
  ctx.save(); ctx.font = `600 22px ${FONT}`;
  const lines = wrapLines(ctx, text, maxW - 36).slice(0, 2), lh = 26;
  const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36), h = 38 + (lines.length - 1) * lh;
  roundPath(ctx, x - w / 2, y - 19, w, h, 19); ctx.fillStyle = 'rgba(8,24,44,0.82)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#fff6e0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, y + 1 + i * lh));
  ctx.restore();
}

function phaseText(state) {
  const m = state.m, lab = state.labels[m.turn], a = state.aim;
  if (m.phase === 'score') return m.endInfo && m.endInfo.dead ? 'Dead end: replay' : 'The end is measured';
  if (m.phase === 'over') return 'Match over';
  if (m.phase === 'jack') return state.humanTurn ? `${lab.name}: roll the jack, at least 23 m` : `${lab.name} rolls the jack`;
  if (m.phase === 'jack-fly' || m.phase === 'fly' || state.windup) return 'Rolling…';
  if (state.humanTurn) return `${m.cfg.mode === 'two' ? `${lab.name}: ` : ''}${WEIGHTS[a.weight].name}, curving ${a.hand > 0 ? 'right' : 'left'}`;
  if (state.think) return state.think.phase === 'reveal' ? `${lab.name} chooses…` : state.think.phase === 'pull' ? `${lab.name} bowls` : `${lab.name} is thinking…`;
  return lab.name;
}

function drawBar(ctx, L, state) {
  const P = L.play, m = state.m, human = state.humanTurn && !state.paused;
  const jack = m.phase === 'jack';
  const wide = L.wide;
  if (m.cfg.mode === 'watch') {
    const think = state.settings.thinkIdx;
    drawButton(ctx, P.demo.dec, 'Think −', { size: 24, disabled: think === 0, sub: wide ? null : 'shorter' });
    drawButton(ctx, P.demo.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: 28 });
    drawButton(ctx, P.demo.inc, 'Think +', { size: 24, disabled: think >= 3, sub: wide ? null : 'longer' });
    drawButton(ctx, P.demo.rules, 'Rules', { size: 24 });
    if (P.demo.howto) drawButton(ctx, P.demo.howto, 'How to Play', { size: 24 });
    drawButton(ctx, P.demo.exit, 'Leave', { dark: true, size: 26 });
    return;
  }
  const a = state.aim;
  if (jack) {
    // the jack has no hand or weight: the same space shows how far it will run
    const x0 = P.handL.x, y0 = P.handL.y, x1 = (wide ? P.hint : P.hint).x + P.hint.w, y1 = (wide ? P.weights[0] : P.weights[0]).y + P.weights[0].h;
    panel(ctx, x0, y0, x1 - x0, y1 - y0, { r: 16, fill: 'rgba(12,32,56,0.9)', stroke: 'rgba(255,255,255,0.18)', shadow: false });
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (wide) {
      ctx.fillStyle = '#ecc65c'; ctx.font = `700 40px ${DISPLAY}`; ctx.fillText(`Jack: ${state.aim.y.toFixed(1)} m`, cx - 120, cy + 14);
      ctx.fillStyle = 'rgba(255,246,224,0.85)'; ctx.font = `500 18px ${FONT}`; ctx.fillText('Press the green: at least 23 m,', cx + 190, cy - 2); ctx.fillText('then Roll', cx + 190, cy + 22);
    } else {
      ctx.fillStyle = '#ecc65c'; ctx.font = `700 52px ${DISPLAY}`; ctx.fillText(`Jack: ${state.aim.y.toFixed(1)} m`, cx, cy - 6);
      ctx.fillStyle = 'rgba(255,246,224,0.85)'; ctx.font = `500 21px ${FONT}`; ctx.fillText('Press the green to set the length: at least 23 m', cx, cy + 36);
    }
  } else {
    drawButton(ctx, P.handL, wide ? '◄ Left' : '◄ Curve left', { size: 25, active: human && a.hand < 0, disabled: !human });
    drawButton(ctx, P.handR, wide ? 'Right ►' : 'Curve right ►', { size: 25, active: human && a.hand > 0, disabled: !human });
    WEIGHTS.forEach((wt, i) => drawButton(ctx, P.weights[i], wt.name, { size: 26, sub: wide ? null : wt.sub, active: human && a.weight === i, disabled: !human }));
    drawButton(ctx, P.hint, 'Hint', { size: 26, dark: true, disabled: !human || state.hintBusy, sub: state.hintBusy ? 'thinking…' : null });
  }
  drawButton(ctx, P.roll, jack ? 'Roll the jack' : 'Roll', { size: 32, primary: true, disabled: !human });
  drawButton(ctx, P.menu, 'Menu', { size: 26, dark: true });
}

export function drawExplain(ctx, r, state) {
  const e = state.explain;
  if (!e || r.w < 120) return;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 14, fill: 'rgba(12,32,56,0.82)', stroke: 'rgba(255,255,255,0.18)', shadow: false });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let fs = 21; ctx.font = `700 ${fs}px ${FONT}`;
  ctx.fillStyle = '#ecc65c';
  const head = wrapLines(ctx, e.head, r.w - 24)[0] ?? '';
  ctx.fillText(head, r.x + 12, r.y + 28);
  ctx.font = `500 18px ${FONT}`; ctx.fillStyle = 'rgba(255,246,224,0.92)';
  let y = r.y + 54;
  for (const l of e.lines) { if (y > r.y + r.h - 4) break; const t = wrapLines(ctx, l, r.w - 24)[0] ?? ''; ctx.fillText(t, r.x + 12, y); y += 25; }
}

// measuring lines and distances at the end of an end
function drawMeasure(ctx, pr, state) {
  const e = state.m.endInfo, w = state.w;
  if (!e || !e.lines) return;
  const j = theJack(w);
  if (!j) return;
  const jp = pr.p(j.x, j.y), k = Math.min(1, e.t / 0.9);
  ctx.save();
  ctx.font = `700 20px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  e.lines.forEach((ln) => {
    const b = w.balls.find((q) => q.id === ln.id);
    if (!b) return;
    const bp = pr.p(b.x, b.y), x = jp.x + (bp.x - jp.x) * k, y = jp.y + (bp.y - jp.y) * k;
    ctx.strokeStyle = ln.scores ? 'rgba(255,214,90,0.95)' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = ln.scores ? 2.5 : 1.5; ctx.setLineDash(ln.scores ? [] : [4, 4]);
    ctx.beginPath(); ctx.moveTo(jp.x, jp.y); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
    if (k >= 1) {
      const mx = (jp.x + bp.x) / 2, my = (jp.y + bp.y) / 2, txt = `${Math.round(ln.d * 100)} cm`;
      const tw = ctx.measureText(txt).width + 14;
      roundPath(ctx, mx - tw / 2, my - 14, tw, 28, 14); ctx.fillStyle = ln.scores ? 'rgba(236,198,92,0.96)' : 'rgba(8,24,44,0.85)'; ctx.fill();
      ctx.fillStyle = ln.scores ? '#1b1405' : '#fff6e0'; ctx.fillText(txt, mx, my + 1);
    }
  });
  ctx.restore();
}

function drawScorePanel(ctx, L, state) {
  const m = state.m, e = m.endInfo;
  if (!e) return;
  const P = L.play, w = Math.min(560, P.view.w - 30), h = 108, x = P.view.x + P.view.w / 2 - w / 2, y = P.view.y + P.view.h - h - 14;
  const k = Math.min(1, e.t / 0.5), yy = y + (1 - k) * 30;
  ctx.save(); ctx.globalAlpha = k;
  panel(ctx, x, yy, w, h, { r: 22, fill: 'rgba(12,32,56,0.94)', stroke: 'rgba(236,198,92,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let head;
  if (e.dead) head = 'Dead end';
  else if (e.team < 0) head = e.tie ? 'Tied: no score' : 'No score';
  else head = `${state.labels[e.team].name === 'You' ? 'You score' : `${state.labels[e.team].name} scores`} ${e.pts}`;
  ctx.font = `700 40px ${DISPLAY}`; ctx.fillStyle = '#ecc65c';
  let fs = 40; while (ctx.measureText(head).width > w - 40 && fs > 20) { fs -= 2; ctx.font = `700 ${fs}px ${DISPLAY}`; }
  ctx.fillText(head, x + w / 2, yy + 52);
  ctx.font = `500 19px ${FONT}`; ctx.fillStyle = 'rgba(255,246,224,0.82)';
  ctx.fillText(e.dead || e.tie || e.none ? e.text : (e.t > 0.8 ? 'Tap to continue' : ''), x + w / 2, yy + 86);
  ctx.restore();
}

// ---- the play screen -----------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state, L) {
  const P = L.play, m = state.m;
  const pr = projFor(L, state.cam);
  drawWorld(ctx, P.view, pr, state, state.w, state.parts, { trail: state.trail, minJack: m.phase === 'jack', noRing: m.phase === 'jack' || m.phase === 'jack-fly' });
  if (m.phase === 'score') drawMeasure(ctx, pr, state);
  drawGuides(ctx, L, pr, state);
  drawMini(ctx, L, pr, state);
  // vignette under the HUD
  const g = ctx.createLinearGradient(0, P.view.y, 0, P.view.y + 40);
  g.addColorStop(0, 'rgba(6,18,34,0.45)'); g.addColorStop(1, 'rgba(6,18,34,0)');
  ctx.fillStyle = g; ctx.fillRect(P.view.x, P.view.y, P.view.w, 40);
  // top: cards and info
  scoreCard(ctx, P.cards[0], 0, state);
  scoreCard(ctx, P.cards[1], 1, state);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const extra = m.end > m.cfg.ends ? ' (extra)' : '';
  ctx.fillStyle = '#fff6e0'; ctx.font = `700 ${L.wide ? 30 : 28}px ${DISPLAY}`;
  ctx.fillText(`End ${Math.min(m.end, 99)}${L.wide ? ` of ${m.cfg.ends}` : `/${m.cfg.ends}`}${extra}`, P.info.x, P.info.y);
  ctx.font = `500 ${L.wide ? 19 : 19}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,224,0.8)';
  const gname = (state.w.green.name ?? '').replace(' green', '');
  ctx.fillText(L.wide ? `${state.w.green.name} · about ${paceSeconds(state.w.green)} s over 30 m` : gname, P.info.x, P.info.y2);
  if (L.wide && P.explain && state.explain) drawExplain(ctx, P.explain, state);
  if (!(L.wide && m.phase === 'score')) pill(ctx, P.pill.x, L.wide ? P.view.y + P.view.h - 26 : P.pill.y, phaseText(state), P.pill.w);
  if (state.toastT > 0 && state.toast) {
    const a = Math.min(1, state.toastT / 0.4);
    ctx.save(); ctx.globalAlpha = a; pill(ctx, P.toast.x, L.wide ? P.view.y + P.view.h - 70 : P.toast.y, state.toast, P.toast.maxW); ctx.restore();
  }
  if (!L.wide && state.explain) drawExplain(ctx, { x: P.head.x + 6, y: P.view.y + 52, w: Math.min(P.head.w - 12, 640), h: 140 }, state);
  if (state.ff > 1) { ctx.fillStyle = 'rgba(255,246,224,0.9)'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('▶▶ x3', P.ffPos.x, P.ffPos.y); }
  if (state.pop) {
    const k = state.pop.t / 1.8, y = P.view.y + P.view.h * 0.3 - k * 40;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4); ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(88 + 18 * Math.sin(Math.min(1, k * 3) * 3))}px ${DISPLAY}`;
    ctx.fillStyle = TEAM[state.pop.team].decalHi; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12;
    ctx.fillText(state.pop.text, P.view.x + P.view.w / 2, y);
    ctx.restore();
  }
  if (m.phase === 'score') drawScorePanel(ctx, L, state);
  drawBar(ctx, L, state);
}
export { C, inRect, GREEN, GREENS };
