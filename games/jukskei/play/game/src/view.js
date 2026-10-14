// Drawing the play screen: the lane through the camera, pins, guide arc and ghost, the stake loupe, the wind and swing meter, the score
// cards, the control bar and the end-of-round panel. Pure drawing from `state` and the layout; game.js owns state.
import { STYLES, PINS_EACH, NEAR, TOUCH, STAKE_H, clamp } from './sim.js';
import { drawBackdrop, drawLane, drawStake, drawPin, drawPinIcon, drawPinShape, drawFigure, palette, TEAM, pinScreen } from './art.js';
import { projector, K } from './cam.js';
import { FONT, DISPLAY, roundPath, drawButton, panel, wrapLines } from './ui.js';
import { PROFILES } from './opponents.js';
import { GL } from './glbridge.js';

const TAU = Math.PI * 2;
export const FIG_X = -0.55;           // where the thrower stands (m)

export const splitNow = (L, state) => !!(L.play.split && state.m && ['aim', 'swing', 'throw'].includes(state.m.phase));
export const viewRect = (L, state) => (splitNow(L, state) ? L.play.strip : L.play.view);
export function projFor(L, cam, state) { return projector(state ? viewRect(L, state) : L.play.view, cam); }
// the stake close-up camera (a big panel in portrait, a corner inset in landscape)
export const loupeCam = (L, D) => ({ cx: D - 0.7, s: L.play.loupe.w / (L.play.split ? 7.4 : 5.6) });
export const figureH = (s) => Math.max(1.75 * s, 92);

// ---- the thrower's pose -----------------------------------------------------------------------------------------------------------
const ease = (t) => t * t * (3 - 2 * t);
const POSE_KEYS = ['arm', 'elbow', 'lean', 'bend', 'step'];
function targetPose(state) {
  const t = state.t;
  if (state.swing && state.swing.on) {
    const u = clamp(state.swing.u, 0, 1);
    return { arm: 0.2 - 2.55 * ease(u), elbow: -0.5 * u, lean: -0.1 - 0.12 * u, bend: 0.25 + 0.35 * u, step: 0 };
  }
  const th = state.throwAnim;
  if (th) {
    const k = clamp(th.t / th.dur, 0, 1);
    if (k < 1) return { arm: -2.35 + 4.5 * ease(k), elbow: 0.2 + 0.6 * k, lean: -0.2 + 0.55 * ease(k), bend: 0.6 - 0.35 * k, step: ease(k) };
    const f = clamp((th.t - th.dur) / 1.1, 0, 1);
    return { arm: 2.15 - 2.0 * ease(f), elbow: 0.8 - 0.55 * f, lean: 0.35 - 0.3 * f, bend: 0.25 - 0.12 * f, step: 1 - ease(Math.min(1, f * 1.3)) };
  }
  // idle: a slow breath and a little weight shift
  return { arm: 0.12 + Math.sin(t * 1.6) * 0.03, elbow: 0.25 + Math.sin(t * 1.6 + 1) * 0.03, lean: 0.04 + Math.sin(t * 0.8) * 0.015, bend: 0.12 + Math.sin(t * 1.6) * 0.02, step: 0 };
}
// The target pose is low-pass filtered (by the game clock, so it is deterministic) so phase changes never pop.
export function poseFor(state) {
  const tgt = targetPose(state), t = state.t;
  let c = state.poseCur;
  if (!c || t < state.poseT || t - state.poseT > 0.4) { state.poseCur = c = { ...tgt }; state.poseT = t; return c; }
  const dt = t - state.poseT;
  if (dt > 0) {
    const k = 1 - Math.exp(-dt * 26);
    for (const key of POSE_KEYS) c[key] += (tgt[key] - c[key]) * k;
    state.poseT = t;
  }
  return c;
}

// ---- the scene -------------------------------------------------------------------------------------------------------------------
export function drawScene(ctx, R, pr, cam, state, o = {}) {
  const w = state.w, pal = palette(w.pitch.sky);
  const m0 = state.m, team0 = m0 ? m0.turn : (state.attTeam | 0);
  if (GL.on) {
    // the 3D layer draws the venue, the lane, the stake, the pins and the thrower from this request; only guides, trail and dust stay 2D
    GL.views.push({ R, cam: { cx: cam.cx, s: cam.s }, state, noFigure: !!o.noFigure, look: o.look ?? figureLook(state, team0) });
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
  if (!GL.on) {
    drawBackdrop(ctx, R, pr, cam, pal, state.t);
    drawLane(ctx, R, pr, cam, pal, w.D, w.pitch.fric);
  }
  const s = pr.s;
  // things standing on the lane, back to front
  const items = [];
  if (!GL.on) {
    for (const p of w.pins) items.push({ y: p.y, draw: () => drawPin(ctx, pr, p) });
    items.push({ y: 0.001, draw: () => drawStake(ctx, pr, w, state.t, w.wind) });
  }
  if (!o.noFigure && !GL.on) {
    const m = state.m, team = m ? m.turn : (state.attTeam | 0);
    const look = o.look ?? figureLook(state, team);
    items.push({ y: 0.0, draw: () => {
      const base = pr.p(FIG_X, 0.15, 0), H = figureH(s);
      const hand = drawFigure(ctx, base.x, base.y, H, poseFor(state), look);
      // the pin in the hand until it is let go
      if (state.holding) {
        const sw = state.swing && state.swing.on;
        const th = state.throwAnim;
        const k = th ? clamp(th.t / th.dur, 0, 1) : 0;
        const ang = sw ? -1.2 - 0.9 * clamp(state.swing.u, 0, 1) : th ? -1.2 + 2.9 * k : -0.4;
        drawPinShape(ctx, hand.x + Math.cos(ang) * 8, hand.y + Math.sin(ang) * 8, Math.max(PIN_PX(s), 16), ang, team);
      }
    } });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();
  // trail of the pin in flight
  if (state.trail && state.trail.length > 6) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? 'rgba(255,255,255,0.7)' : 'rgba(40,24,6,0.18)'; ctx.lineWidth = pass ? Math.max(1.5, s * 0.04) : Math.max(1, s * 0.03);
      ctx.beginPath();
      for (let i = 0; i < state.trail.length; i += 3) { const p = pr.p(state.trail[i], state.trail[i + 1], pass ? state.trail[i + 2] : 0); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
      ctx.stroke();
    }
  }
  // particles: sand puffs, wood chips, sparks
  if (state.parts && state.parts.length) {
    for (const q of state.parts) {
      const k = q.t / q.max, p = pr.p(q.x, q.y, q.z);
      ctx.globalAlpha = Math.max(0, 1 - k);
      if (q.kind === 1) { ctx.fillStyle = '#fff2c0'; ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 + (1 - k) * 1.6, 0, TAU); ctx.fill(); }
      else if (q.kind === 2) { ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, 6 + k * s * 0.5, (6 + k * s * 0.5) * K, 0, 0, TAU); ctx.stroke(); }
      else { ctx.fillStyle = q.col ?? 'rgba(232,206,150,0.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, (q.size ?? 3) * (0.7 + k), 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
const PIN_PX = (s) => Math.max(0.3 * s * 1.25, 19);

export function figureLook(state, team) {
  const m = state.m;
  const prof = m && m.cfg.mode !== 'two' ? (m.cfg.mode === 'watch' ? PROFILES[team === 0 ? m.cfg.watchA : m.cfg.opp] : team === 1 ? PROFILES[m.cfg.profile ?? m.cfg.opp] : null) : null;
  if (prof) return { skin: prof.skin, shirt: prof.shirt, female: !!prof.female };
  return team === 0 ? { skin: 1, shirt: '#e8892a', hat: '#d8c48c' } : { skin: 2, shirt: '#2a95c4', hat: '#c9b784' };
}

// ---- guides: flight arc, target, ghost, spread --------------------------------------------------------------------------------------
function drawGuides(ctx, R, pr, state, o = {}) {
  const m = state.m, a = state.aim, pv = state.prev, s = pr.s;
  const showAim = (state.humanTurn || (state.think && state.think.phase === 'reveal')) && a && m.phase === 'aim';
  if (!showAim) return;
  ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
  const guide = state.settings.guide, human = state.humanTurn;
  if (pv) {
    // the arc
    if (guide === 0 || !human) {
      const pts = pv.path;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(30,18,4,0.3)'; ctx.lineWidth = Math.max(3, s * 0.09); ctx.setLineDash([]);
      ctx.beginPath(); for (let i = 0; i < pts.length; i += 3) { const p = pr.p(pts[i], pts[i + 1], pts[i + 2]); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); } ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(2, s * 0.05); ctx.setLineDash([Math.max(6, s * 0.2), Math.max(5, s * 0.14)]); ctx.lineDashOffset = -(state.t * 20) % 100;
      ctx.beginPath(); for (let i = 0; i < pts.length; i += 3) { const p = pr.p(pts[i], pts[i + 1], pts[i + 2]); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); } ctx.stroke(); ctx.setLineDash([]);
    }
    // ghost: where the pin finishes, and the pins it would move
    if (guide <= 1 || !human) {
      for (const mv of pv.moved) {
        const p0 = pr.p(mv.x0, mv.y0), p1 = pr.p(mv.x, mv.y);
        ctx.strokeStyle = 'rgba(255,214,90,0.9)'; ctx.lineWidth = 1.6; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); ctx.setLineDash([]);
        drawPinShape(ctx, p1.x, p1.y - 2, PIN_PX(s), -0.04, mv.team, { alpha: 0.5, ghost: true });
      }
      const rp = pr.p(pv.rest.x, pv.rest.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
      const lp = pr.p(pv.land.x, pv.land.y);
      ctx.beginPath(); ctx.moveTo(lp.x, lp.y); ctx.lineTo(rp.x, rp.y); ctx.stroke(); ctx.setLineDash([]);
      drawPinShape(ctx, rp.x, rp.y - 2, PIN_PX(s), -0.04, m.turn, { alpha: 0.62, ghost: true });
      if (pv.kind === 'stake') { ctx.fillStyle = '#ffd54a'; ctx.font = `700 ${Math.round(clamp(s * 0.4, 14, 22))}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('★', rp.x, rp.y - 16); }
    }
    // the spread: how far a shaky hand could miss (around the landing spot)
    if (human && guide !== 2 && pv.spread) {
      const sp = pv.spread, c = pr.p(pv.land.x, pv.land.y);
      ctx.beginPath(); ctx.ellipse(c.x, c.y, sp.x * 2 * s, Math.max(3, sp.y * 2 * K * s), 0, 0, TAU);
      ctx.fillStyle = 'rgba(255,230,120,0.18)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,120,0.85)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // the target ring on the sand
  const c = pr.p(a.x, a.y), r = Math.max(0.32 * s, 10) * (1 + 0.05 * Math.sin(state.t * 5));
  ctx.strokeStyle = 'rgba(30,18,4,0.45)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r * K * 1.15, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r * K * 1.15, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(c.x - r * 1.5, c.y); ctx.lineTo(c.x - r * 0.5, c.y); ctx.moveTo(c.x + r * 0.5, c.y); ctx.lineTo(c.x + r * 1.5, c.y);
  ctx.moveTo(c.x, c.y - r * K * 1.7); ctx.lineTo(c.x, c.y - r * K * 0.6); ctx.moveTo(c.x, c.y + r * K * 0.6); ctx.lineTo(c.x, c.y + r * K * 1.7); ctx.stroke();
  if (!o.small) {
    ctx.font = `700 ${Math.round(clamp(r * 0.9, 13, 18))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff6d8'; ctx.shadowColor = 'rgba(40,20,0,0.8)'; ctx.shadowBlur = 4;
    const note = pv ? (pv.flat === false ? 'drops on its end' : 'lands flat') : '';
    ctx.fillText(`${STYLES[a.style].name}${note ? ` · ${note}` : ''}`, c.x, c.y - r * K * 1.15 - 12); ctx.shadowBlur = 0;
  }
  if (state.hintPlan && human) {
    const p = pr.p(state.hintPlan.tx, state.hintPlan.ty), rp = Math.max(13, 0.42 * s) + 2 * Math.sin(state.t * 6);
    ctx.strokeStyle = 'rgba(110,255,180,0.95)'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.ellipse(p.x, p.y, rp, rp * K * 1.2, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}

// ---- HUD -------------------------------------------------------------------------------------------------------------------------
function scoreCard(ctx, r, side, state) {
  const m = state.m, lab = state.labels[side];
  const turn = m.turn === side && ['aim', 'swing', 'throw', 'fly'].includes(m.phase);
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: 'rgba(40,26,12,0.9)', stroke: turn ? 'rgba(255,214,110,0.95)' : 'rgba(255,255,255,0.2)' });
  const col = TEAM[side];
  ctx.fillStyle = col.main; roundPath(ctx, r.x + 9, r.y + 12, 8, r.h - 24, 4); ctx.fill();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  let fs = 27; ctx.font = `700 ${fs}px ${FONT}`;
  while (ctx.measureText(lab.name).width > r.w - 100 && fs > 17) { fs--; ctx.font = `700 ${fs}px ${FONT}`; }
  ctx.fillStyle = '#fff6e0'; ctx.fillText(lab.name, r.x + 28, r.y + 31);
  ctx.font = `500 19px ${FONT}`; ctx.fillStyle = 'rgba(255,246,224,0.72)'; ctx.fillText(lab.sub ?? `${col.name} pins`, r.x + 28, r.y + 54);
  const left = m.left[side];
  for (let i = 0; i < PINS_EACH; i++) drawPinIcon(ctx, r.x + 44 + i * 30, r.y + r.h - (r.h < 90 ? 13 : 18), 22, side, i < left ? 1 : 0.2);
  ctx.textAlign = 'right'; ctx.font = `700 ${r.h > 84 ? 54 : 46}px ${DISPLAY}`; ctx.fillStyle = '#ffd36a';
  ctx.fillText(String(m.scores[side] + (m.phase === 'score' ? 0 : 0)), r.x + r.w - 16, r.y + r.h - 16);
  if (turn) { ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.arc(r.x + r.w - 18, r.y + 16, 4.5 + Math.sin(state.t * 6), 0, TAU); ctx.fill(); }
}

function pill(ctx, x, y, text, maxW) {
  ctx.save(); ctx.font = `600 22px ${FONT}`;
  const lines = wrapLines(ctx, text, maxW - 36).slice(0, 2), lh = 26;
  const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36), h = 38 + (lines.length - 1) * lh;
  roundPath(ctx, x - w / 2, y - 19, w, h, 19); ctx.fillStyle = 'rgba(40,24,8,0.84)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#fff6e0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, y + 1 + i * lh));
  ctx.restore();
}

function phaseText(state) {
  const m = state.m, lab = state.labels[m.turn], a = state.aim;
  if (m.phase === 'score') return 'Round over';
  if (m.phase === 'judge') return state.pop ? state.pop.text : 'Pin down';
  if (m.phase === 'fly') return 'In the air…';
  if (m.phase === 'swing') return state.humanTurn ? 'Tap Release in the gold zone' : `${lab.name} swings`;
  if (m.phase === 'throw') return `${lab.name} throws`;
  if (state.humanTurn) return `${m.cfg.mode === 'two' ? `${lab.name}: ` : ''}${STYLES[a.style].name}: press the sand to aim`;
  if (state.think) return state.think.phase === 'reveal' ? `${lab.name} chooses…` : `${lab.name} is thinking…`;
  return lab.name;
}

const WIND_WORDS = (w) => {
  const sp = w.wind.speed;
  if (sp < 0.4) return 'calm';
  const along = Math.cos(w.wind.dir), side = Math.sin(w.wind.dir);
  const a = Math.abs(along) > 0.55 ? (along > 0 ? 'tailwind' : 'headwind') : '';
  const b = Math.abs(side) > 0.4 ? (side > 0 ? 'toward you' : 'away from you') : '';
  return [a, b].filter(Boolean).join(', ') || 'light';
};
function drawWind(ctx, r, state) {
  const w = state.w;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 16, fill: 'rgba(40,24,8,0.78)', stroke: 'rgba(255,255,255,0.2)', shadow: false });
  const cx = r.x + 38, cy = r.y + r.h / 2, d = w.wind.dir, sp = w.wind.speed, len = 12 + Math.min(sp, 6) * 3.2;
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('stake', 20, -20);
  ctx.rotate(d);
  ctx.strokeStyle = '#ffd36a'; ctx.fillStyle = '#ffd36a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2 - 4, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(len / 2 + 6, 0); ctx.lineTo(len / 2 - 6, -7); ctx.lineTo(len / 2 - 6, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff6e0'; ctx.font = `700 21px ${FONT}`; ctx.fillText(`Wind ${sp.toFixed(1)} m/s`, r.x + 76, r.y + 32);
  ctx.fillStyle = 'rgba(255,246,224,0.75)'; ctx.font = `500 16px ${FONT}`;
  const words = WIND_WORDS(w);
  ctx.fillText(words, r.x + 76, r.y + 56);
}

function drawMeter(ctx, r, state) {
  const sw = state.swing;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: 'rgba(40,24,8,0.85)', stroke: 'rgba(255,214,110,0.8)' });
  const pad = 14, bx = r.x + pad, bw = r.w - 2 * pad, by = r.y + r.h / 2 - 9, bh = 18;
  roundPath(ctx, bx, by, bw, bh, 9); ctx.fillStyle = '#51402a'; ctx.fill();
  // the zones: bad - fair - gold - fair - bad
  const z = (a, b, col) => { ctx.fillStyle = col; ctx.fillRect(bx + bw * a, by, bw * (b - a), bh); };
  ctx.save(); roundPath(ctx, bx, by, bw, bh, 9); ctx.clip();
  z(0.0, 0.22, '#a8483a'); z(0.22, 0.4, '#d6a03a'); z(0.4, 0.6, '#5cc060'); z(0.6, 0.78, '#d6a03a'); z(0.78, 1, '#a8483a');
  ctx.restore();
  const u = clamp(sw ? sw.u : 0, 0, 1), x = bx + bw * u;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, by - 3); ctx.lineTo(x - 9, by - 14); ctx.lineTo(x + 9, by - 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillRect(x - 2, by - 2, 4, bh + 4);
}

export function drawExplain(ctx, r, state) {
  const e = state.explain;
  if (!e || r.w < 120) return;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 14, fill: 'rgba(40,24,8,0.82)', stroke: 'rgba(255,255,255,0.18)', shadow: false });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 21px ${FONT}`; ctx.fillStyle = '#ffd36a';
  ctx.fillText(wrapLines(ctx, e.head, r.w - 24)[0] ?? '', r.x + 12, r.y + 28);
  ctx.font = `500 18px ${FONT}`; ctx.fillStyle = 'rgba(255,246,224,0.92)';
  let y = r.y + 54;
  for (const l of e.lines) { if (y > r.y + r.h - 4) break; ctx.fillText(wrapLines(ctx, l, r.w - 24)[0] ?? '', r.x + 12, y); y += 25; }
}

function drawBar(ctx, L, state) {
  const P = L.play, m = state.m, human = state.humanTurn && !state.paused && m.phase === 'aim';
  const wide = L.wide;
  if (m.cfg.mode === 'watch') {
    const think = state.settings.thinkIdx;
    drawButton(ctx, P.demo.dec, 'Think −', { size: 24, disabled: think === 0, sub: wide ? null : 'shorter' });
    drawButton(ctx, P.demo.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: 28 });
    drawButton(ctx, P.demo.inc, 'Think +', { size: 24, disabled: think >= 3, sub: wide ? null : 'longer' });
    drawButton(ctx, P.demo.rules, 'Rules', { size: 24 });
    drawButton(ctx, P.demo.howto, 'How to Play', { size: 24 });
    drawButton(ctx, P.demo.exit, 'Leave', { dark: true, size: 26 });
    return;
  }
  const a = state.aim, sw = state.swing && state.swing.on;
  STYLES.forEach((st, i) => drawButton(ctx, P.styles[i], st.name, { size: 26, sub: wide ? null : st.sub, active: human && a.style === i, disabled: !human }));
  drawButton(ctx, P.hint, 'Hint', { size: 26, dark: true, disabled: !human || state.hintBusy, sub: state.hintBusy ? 'thinking…' : null });
  const canThrow = (human || (state.humanTurn && sw)) && !state.paused;
  drawButton(ctx, P.throwB, sw ? 'Release!' : 'Throw', { size: 32, primary: true, disabled: !canThrow });
  drawButton(ctx, P.menu, 'Menu', { size: 26, dark: true });
}

// the points for a finished pin, shown big and fading over the stake
function drawPop(ctx, L, pr, state) {
  const p = state.pop;
  if (!p) return;
  const k = p.t / p.dur, P = L.play;
  const st = pr.p(state.w.D, 0, STAKE_H + 1.4);
  const x = clamp(st.x, P.view.x + 140, P.view.x + P.view.w - 140), y = clamp(st.y, P.view.y + 90, P.view.y + P.view.h * 0.5) - k * 30;
  ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.65) / 0.35); ctx.textAlign = 'center';
  ctx.font = `700 ${Math.round(66 + 14 * Math.sin(Math.min(1, k * 3) * 3))}px ${DISPLAY}`;
  ctx.fillStyle = TEAM[p.team].light; ctx.shadowColor = 'rgba(30,14,0,0.7)'; ctx.shadowBlur = 12;
  ctx.fillText(p.big, x, y);
  ctx.font = `700 26px ${FONT}`; ctx.fillStyle = '#fff6e0'; ctx.fillText(p.small, x, y + 34);
  ctx.restore();
}

function drawScorePanel(ctx, L, state) {
  const m = state.m, e = m.roundInfo;
  if (!e) return;
  const r = L.play.score, k = Math.min(1, e.t / 0.5), yy = r.y + (1 - k) * 30;
  ctx.save(); ctx.globalAlpha = k;
  panel(ctx, r.x, yy, r.w, r.h, { r: 22, fill: 'rgba(40,24,8,0.95)', stroke: 'rgba(255,214,110,0.85)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const head = e.pts[0] === e.pts[1] ? `Round ${m.round}: level ${e.pts[0]} – ${e.pts[1]}` : `${state.labels[e.pts[0] > e.pts[1] ? 0 : 1].name === 'You' ? 'You take' : `${state.labels[e.pts[0] > e.pts[1] ? 0 : 1].name} takes`} round ${m.round}`;
  let fs = 36; ctx.font = `700 ${fs}px ${DISPLAY}`;
  while (ctx.measureText(head).width > r.w - 40 && fs > 20) { fs -= 2; ctx.font = `700 ${fs}px ${DISPLAY}`; }
  ctx.fillStyle = '#ffd36a'; ctx.fillText(head, r.x + r.w / 2, yy + 46);
  // one row per side: four pin chips and the bonus
  [0, 1].forEach((side) => {
    const y = yy + 96 + side * 74;
    ctx.textAlign = 'left'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#fff6e0';
    let nm = state.labels[side].name; while (ctx.measureText(nm).width > 120 && nm.length > 3) nm = nm.slice(0, -2);
    ctx.fillText(nm, r.x + 22, y + 8);
    const list = m.throwLog.filter((q) => q.team === side);
    list.forEach((q, i) => {
      const cx = r.x + 160 + i * 66;
      drawPinIcon(ctx, cx, y - 8, 36, side, 1);
      roundPath(ctx, cx - 18, y + 4, 36, 26, 13); ctx.fillStyle = q.pts >= 3 ? '#ffd36a' : q.pts > 0 ? 'rgba(255,214,110,0.6)' : 'rgba(255,255,255,0.14)'; ctx.fill();
      ctx.fillStyle = q.pts > 0 ? '#2b1a04' : 'rgba(255,246,224,0.8)'; ctx.font = `700 19px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(q.pts > 0 ? `+${q.pts}` : '0', cx, y + 23);
    });
    ctx.textAlign = 'right'; ctx.font = `700 40px ${DISPLAY}`; ctx.fillStyle = e.bonusTeam === side ? '#7dff9b' : '#ffd36a';
    ctx.fillText(String(e.pts[side]), r.x + r.w - 22, y + 24);
    if (e.bonusTeam === side) { ctx.font = `600 15px ${FONT}`; ctx.fillStyle = '#9dffb4'; ctx.fillText('nearest pin +1', r.x + r.w - 22, y - 12); }
  });
  ctx.textAlign = 'center'; ctx.font = `500 19px ${FONT}`; ctx.fillStyle = 'rgba(255,246,224,0.82)';
  ctx.fillText(e.t > 0.8 ? 'Tap to continue' : '', r.x + r.w / 2, yy + r.h - 18);
  ctx.restore();
}

// ---- the play screen -------------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state, L) {
  const P = L.play, m = state.m;
  const split = splitNow(L, state), R = split ? P.strip : P.view;
  const pr = projector(R, state.cam);
  drawScene(ctx, R, pr, state.cam, state);
  drawGuides(ctx, R, pr, state);
  if (split) { ctx.fillStyle = 'rgba(30,16,4,0.9)'; ctx.fillRect(P.view.x, P.strip.y + P.strip.h, P.view.w, 6); }
  // the loupe: the stake and the pins around it, large
  if (P.loupe.w > 100 && (split || !L.play.split)) {
    const lc = loupeCam(L, state.w.D);
    const lp = projector(P.loupe, lc);
    const lr = GL.on ? 3 : 14;
    ctx.save(); roundPath(ctx, P.loupe.x, P.loupe.y, P.loupe.w, P.loupe.h, lr); ctx.clip();
    drawScene(ctx, P.loupe, lp, lc, state, { noFigure: true });
    drawGuides(ctx, P.loupe, lp, state, { small: !split });
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,246,224,0.9)'; ctx.lineWidth = 3; roundPath(ctx, P.loupe.x, P.loupe.y, P.loupe.w, P.loupe.h, lr); ctx.stroke();
    ctx.font = `700 15px ${FONT}`; ctx.fillStyle = '#fff6e0'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4; ctx.fillText('CLOSE-UP AT THE STAKE', P.loupe.x + 12 + (split ? 0 : 0), P.loupe.y + 22); ctx.shadowBlur = 0;
  }
  drawWind(ctx, P.windBox, state);
  // vignette under the HUD
  const g = ctx.createLinearGradient(0, P.view.y, 0, P.view.y + 40);
  g.addColorStop(0, 'rgba(30,16,4,0.4)'); g.addColorStop(1, 'rgba(30,16,4,0)');
  ctx.fillStyle = g; ctx.fillRect(P.view.x, P.view.y, P.view.w, 40);
  scoreCard(ctx, P.cards[0], 0, state);
  scoreCard(ctx, P.cards[1], 1, state);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const extra = m.round > m.cfg.rounds ? ' (extra)' : '';
  ctx.fillStyle = '#fff6e0'; ctx.font = `700 ${L.wide ? 28 : 26}px ${DISPLAY}`;
  ctx.fillText(`Round ${Math.min(m.round, 99)}/${m.cfg.rounds}${extra}`, P.info.x, P.info.y);
  ctx.font = `500 17px ${FONT}`; ctx.fillStyle = 'rgba(255,246,224,0.8)';
  ctx.fillText(`${state.w.pitch.name} · ${state.w.D} m`, P.info.x, P.info.y2);
  if (L.wide && P.explain && state.explain) drawExplain(ctx, P.explain, state);
  if (!(m.phase === 'score')) pill(ctx, P.pill.x, P.pill.y, phaseText(state), P.pill.w);
  if (state.swing && state.swing.on) drawMeter(ctx, P.meter, state);
  if (state.toastT > 0 && state.toast) {
    const a = Math.min(1, state.toastT / 0.4);
    ctx.save(); ctx.globalAlpha = a; pill(ctx, P.toast.x, P.toast.y, state.toast, P.toast.maxW); ctx.restore();
  }
  if (!L.wide && state.explain) drawExplain(ctx, { x: P.view.x + 8, y: P.view.y + 92, w: Math.min(P.view.w * 0.58, 420), h: 120 }, state);
  if (state.ff > 1) { ctx.fillStyle = 'rgba(255,246,224,0.9)'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('▶▶ x3', P.ffPos.x, P.ffPos.y); }
  drawPop(ctx, L, pr, state);
  if (m.phase === 'score') drawScorePanel(ctx, L, state);
  drawBar(ctx, L, state);
}
export { NEAR, TOUCH };
