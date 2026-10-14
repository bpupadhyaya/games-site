// The play screen: score cards, the whole-cancha strip, the loupe (a true-scale close-up that frames the mingo and the aim point),
// the swing meter and the controls. Pure drawing from `state` and the layout; game.js owns the state.
import { COURT, STYLES, R_BALL, R_MINGO, theMingo, gap } from './sim.js';
import { makeView, drawScenery, drawGround, drawBoards, drawBall, ballIcon, TEAM } from './art.js';
import { FONT, DISPLAY, C, roundPath, drawButton, paintButton, wrapLines, textShadow } from './ui.js';
import { makeView3 } from './proj.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
const BOARD_NEAR = 0.5;

// Whole-court strip view for a rect.
export function stripView(rect) {
  if (v3.on) return makeView3(rect, { uc: COURT.len / 2 + 0.2, half: (COURT.len + 1.7) / 2, pitch: rect.w > rect.h * 2.2 ? 27 : rect.w > rect.h * 1.5 ? 50 : 40, fov: 20, axisV: rect.w > rect.h * 2.2 ? -2.6 : rect.w > rect.h * 1.5 ? -3.4 : -0.6, minR: 4 });   // squarer strips (landscape left column) tilt up so the sand fills the window
  const kx = (rect.w - 30) / (COURT.len + 1.4), hs = rect.h;
  const H = Math.min(hs * 0.55, kx * 3 * 2.3);
  const ky = H / 3, kz = ky * 0.9;
  const yNear = rect.y + hs - 0.5 * kz * 0.9 - 6;
  return makeView(rect, { uc: COURT.len / 2 + 0.2, cx: rect.x + rect.w / 2, kx, ky, kz, yFar: yNear - H, taper: 0.08, minR: 5.5 });
}
// True-scale close-up: centred on uc, showing at least `half` metres either side.
export function loupeView(rect, uc, half) {
  if (v3.on) return makeView3(rect, { uc, half, pitch: 40, fov: 32, axisV: -0.4, minR: 3 });
  const kx0 = rect.w / (2 * half), kyMax = (rect.h * 0.7) / 3;
  const ky = Math.min(kx0 * 0.85, kyMax), kx = ky / 0.85, kz = ky * 0.95;
  const yNear = rect.y + rect.h - 0.5 * kz * 0.92 - 5;
  return makeView(rect, { uc, cx: rect.x + rect.w / 2, kx, ky, kz, yFar: yNear - 3 * ky, taper: 0.06, minR: 3 });
}

const clipRect = (ctx, r, rad = 20) => { roundPath(ctx, r.x, r.y, r.w, r.h, rad); ctx.clip(); };

// One court scene into V.rect: scenery, ground, boards, balls (far to near), overlays.
export function drawCourtView(ctx, V, state, world, o = {}) {
  const { rect } = V, t = state.t;
  const farTop = V.p3 ? 0 : V.y(-COURT.half) - 0.55 * V.kz * V.s(-COURT.half);
  ctx.save();
  if (!o.noClip) clipRect(ctx, rect, o.radius ?? 20);
  const k = theMingo(world);
  if (!V.p3) {
    // dark backing so anything outside the ground reads as night
    ctx.fillStyle = '#1b1240'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    drawScenery(ctx, rect, farTop + 2, Math.max(0.6, Math.min(1.4, rect.h / 260)), t);
    drawGround(ctx, V, world.surf, { detail: o.detail });
    drawBoards(ctx, V, 'far');
  }
  // measuring rings around the mingo (in 3D they are polylines laid on the ground through the same projection)
  if (o.rings && k) {
    ctx.save();
    ctx.lineWidth = V.p3 ? 2 : 1.3;
    const reach = V.p3 ? rect.w / (2 * V.kx) * 1.15 : 3.01;
    for (let d = 0.5; d <= 3; d += 0.5) {
      const whole = d % 1 === 0;
      if (V.p3 && d > reach) break;
      if (V.p3) {
        ctx.strokeStyle = whole ? 'rgba(255,244,214,0.62)' : 'rgba(255,244,214,0.3)'; ctx.setLineDash(whole ? [] : [5, 6]);
        ctx.beginPath();
        for (let i = 0; i <= 48; i++) { const a = (i / 48) * TAU, px = V.x(k.x + Math.cos(a) * (d + k.r), k.y + Math.sin(a) * (d + k.r)), py = V.y(k.y + Math.sin(a) * (d + k.r)); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
        ctx.stroke();
        if (whole) {
          const lx = V.x(k.x + d + k.r, k.y), ly = V.y(k.y);
          if (lx < rect.x + rect.w - 34 && lx > rect.x + 6) { ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,244,214,0.85)'; ctx.font = `700 ${Math.round(Math.max(13, V.kx * 0.12))}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(`${d} m`, lx + 3, ly - 4); }
        }
        continue;
      }
      const cx = V.x(k.x, k.y), cy = V.y(k.y), rx = (d + k.r) * V.kx * V.s(k.y), ry = (d + k.r) * V.ky;
      ctx.strokeStyle = whole ? 'rgba(60,24,10,0.5)' : 'rgba(60,24,10,0.26)'; ctx.setLineDash(whole ? [] : [5, 6]);
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
      if (whole && cx + rx < rect.x + rect.w - 30) { ctx.setLineDash([]); ctx.fillStyle = 'rgba(60,24,10,0.65)'; ctx.font = `700 ${Math.round(Math.max(12, V.kx * 0.12))}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(`${d} m`, cx + rx + 4, cy + 4); }
    }
    ctx.setLineDash([]); ctx.restore();
  }
  if (o.under) o.under(ctx, V);
  if (!V.p3) {
    // balls and the held ball, back to front
    const list = world.balls.filter((b) => b.st !== 'out' || b.fade < 0.5).slice().sort((a, b) => a.y - b.y);
    for (const b of list) { if (b.st === 'out') ctx.globalAlpha = Math.max(0, 1 - b.fade * 2); drawBall(ctx, V, b); ctx.globalAlpha = 1; }
    if (o.held) drawBall(ctx, V, o.held);
    // dust and sparks
    for (const p of state.parts) {
      const px = V.x(p.x, p.y), py = V.y(p.y, p.z), a = Math.max(0, 1 - p.t / p.max);
      if (px < rect.x - 10 || px > rect.x + rect.w + 10) continue;
      ctx.fillStyle = p.kind === 1 ? `rgba(255,240,200,${a})` : `rgba(${p.col ?? '230,190,130'},${a * 0.55})`;
      ctx.beginPath(); ctx.arc(px, py, Math.max(1.5, p.size * V.kx * 0.02 * (p.kind === 1 ? 1 : 1 + p.t * 2)), 0, TAU); ctx.fill();
    }
    drawBoards(ctx, V, 'near');
  }
  if (o.over) o.over(ctx, V);
  ctx.restore();
}

// aim marker, predicted path and rest point (drawn inside a court view)
function aimOverlay(ctx, V, state, kind) {
  const g = state.guide;
  if (!g) return;
  const pv = state.preview, t = state.t;
  if (V.p3) {
    // the 3D presenter lays the ring and the dotted flight on the sand; only the words are drawn here
    const ax = V.x(g.tx, g.ty), ay = V.y(g.ty);
    if (pv && pv.rest && pv.rest.out) { ctx.save(); ctx.fillStyle = '#ffd0c8'; ctx.font = `700 ${kind === 'strip' ? 18 : 22}px ${FONT}`; ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(10,6,30,0.8)'; ctx.shadowBlur = 5; ctx.fillText('would leave the cancha', ax, ay - 26); ctx.restore(); }
    return;
  }
  if (pv && pv.path.length > 1) {
    ctx.save();
    ctx.setLineDash([2, 7]); ctx.lineCap = 'round'; ctx.lineWidth = kind === 'strip' ? 3 : 4; ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    pv.path.forEach((p, i) => { const px = V.x(p.x, p.y), py = V.y(p.y, p.z); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
    ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  // aim ring
  const ax = V.x(g.tx, g.ty), ay = V.y(g.ty), pulse = 0.5 + 0.5 * Math.sin(t * 6), rr = Math.max(kind === 'strip' ? 11 : 18, 0.34 * V.kx * V.s(g.ty));
  ctx.save();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.ellipse(ax, ay, rr + pulse * 2, (rr + pulse * 2) * 0.5, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#ff7a4d'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.ellipse(ax, ay, rr * 0.55, rr * 0.28, 0, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax - rr * 1.5, ay); ctx.lineTo(ax - rr * 0.8, ay); ctx.moveTo(ax + rr * 0.8, ay); ctx.lineTo(ax + rr * 1.5, ay); ctx.stroke();
  if (pv && pv.rest) {
    const rx = V.x(pv.rest.x, pv.rest.y), ry = V.y(pv.rest.y);
    if (!pv.rest.out && (Math.abs(rx - ax) > 5 || Math.abs(ry - ay) > 3)) {
      ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(rx, ry, rr * 0.7, rr * 0.36, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    if (pv.rest.out) { ctx.fillStyle = '#ffd0c8'; ctx.font = `700 ${kind === 'strip' ? 18 : 22}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('would leave the cancha', ax, ay - rr - 8); }
  }
  ctx.restore();
}

// distances measured at the end of an end: a line from the mingo to each ball, labelled in cm
function measureOverlay(ctx, V, state) {
  const m = state.m, w = state.w, info = m.endInfo;
  if (!info || !info.rank) return;
  const k = theMingo(w);
  if (!k) return;
  const shown = Math.min(info.rank.length, 1 + Math.floor(info.t / 0.45));
  ctx.save();
  info.rank.slice(0, shown).forEach((r, i) => {
    const b = w.balls.find((q) => q.id === r.id);
    if (!b) return;
    const x0 = V.x(k.x, k.y), y0 = V.y(k.y) - V.rad(k.r, k.y), x1 = V.x(b.x, b.y), y1 = V.y(b.y) - V.rad(b.r, b.y);
    const win = info.team === b.side && r.d < (info.rank.find((q) => q.side !== info.team)?.d ?? 99) - 0.012;
    ctx.strokeStyle = win ? '#ffe27a' : 'rgba(255,255,255,0.8)'; ctx.lineWidth = win ? 3.5 : 2; ctx.setLineDash(win ? [] : [5, 5]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 - 8 - (i % 2) * 14, label = `${Math.round(r.d * 100)} cm`;
    ctx.font = `700 ${Math.round(Math.max(14, V.kx * 0.13))}px ${FONT}`; ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width + 12;
    roundPath(ctx, mx - tw / 2, my - 15, tw, 22, 8); ctx.fillStyle = win ? 'rgba(255,214,90,0.95)' : 'rgba(30,18,60,0.8)'; ctx.fill();
    ctx.fillStyle = win ? '#3a2200' : '#fff'; ctx.fillText(label, mx, my + 1);
  });
  ctx.restore();
}

// ---- header -------------------------------------------------------------------------------------------------------------------
// A carved walnut plaque with a brass keyline (the throwing side's colour lights its edge).
function plaque(ctx, r, edgeCol, active) {
  roundPath(ctx, r.x, r.y + 6, r.w, r.h, 18); ctx.fillStyle = C.shadow; ctx.fill();
  roundPath(ctx, r.x, r.y, r.w, r.h, 18);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#5b341d'); g.addColorStop(0.5, '#3d2213'); g.addColorStop(1, '#27140a');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  for (let i = 0; i < 9; i++) { const yy = r.y + 6 + i * (r.h / 9); ctx.strokeStyle = `rgba(255,200,140,${0.035 + (i % 3) * 0.02})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(r.x, yy); ctx.bezierCurveTo(r.x + r.w * 0.3, yy - 3, r.x + r.w * 0.7, yy + 3, r.x + r.w, yy); ctx.stroke(); }
  const hl = ctx.createLinearGradient(0, r.y, 0, r.y + 18); hl.addColorStop(0, 'rgba(255,226,170,0.28)'); hl.addColorStop(1, 'rgba(255,226,170,0)');
  ctx.fillStyle = hl; ctx.fillRect(r.x, r.y, r.w, 18);
  ctx.restore();
  ctx.lineWidth = active ? 4 : 2.5; ctx.strokeStyle = edgeCol; ctx.stroke();
  roundPath(ctx, r.x + 5, r.y + 5, r.w - 10, r.h - 10, 14); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(217,163,90,0.55)'; ctx.stroke();
}
function scoreCard(ctx, r, side, state, label) {
  const m = state.m, active = m.phase !== 'score' && m.phase !== 'over' && m.turn === side;
  ctx.save();
  plaque(ctx, r, active ? TEAM[side].base : '#c9964a', active);
  ballIcon(ctx, r.x + 34, r.y + 36, 20, side);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff3dc'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'left';
  let nm = label.name;
  while (ctx.measureText(nm).width > r.w - 138 && nm.length > 4) nm = nm.slice(0, -1);
  ctx.fillText(nm === label.name ? nm : `${nm}…`, r.x + 66, r.y + 32);
  ctx.font = `400 19px ${FONT}`; ctx.fillStyle = 'rgba(255,243,220,0.7)';
  ctx.fillText(active ? 'throwing' : state.m.lead === side && m.phase !== 'over' ? 'leads this end' : ' ', r.x + 66, r.y + 56);
  ctx.font = `700 54px ${DISPLAY}`; ctx.textAlign = 'right'; ctx.fillStyle = '#ffd27a';
  ctx.fillText(String(m.scores[side]), r.x + r.w - 16, r.y + 56);
  // balls still to throw
  for (let i = 0; i < 4; i++) {
    const px = r.x + 24 + i * 24, py = r.y + r.h - 16;
    ctx.fillStyle = i < m.hand[side] ? TEAM[side].base : 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.arc(px, py, 8, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.restore();
}

function infoText(state) {
  const m = state.m;
  return m.phase === 'over' ? ['Match', 'over'] : [`End ${m.end}`, `first to ${m.cfg.target}`];
}
function turnMessage(state) {
  const m = state.m;
  if (m.phase === 'score') return 'End scored: tap to continue';
  if (m.phase === 'fly' || m.phase === 'mingo-fly') return 'Hold the screen to fast-forward';
  const nm = state.labels[m.turn].name, mg = m.phase === 'mingo' || m.phase === 'mingo-fly';
  if (state.humanTurn) return `${m.cfg.mode === 'two' ? `${nm}: ` : ''}${mg ? 'Toss the mingo' : 'Your throw'}. Hold SWING, let go in the green`;
  return `${nm} is ${mg ? 'tossing the mingo' : 'throwing'}`;
}

// ---- controls -----------------------------------------------------------------------------------------------------------------
function styleIcon(ctx, id, cx, cy, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  if (id === 'roll') { ctx.beginPath(); ctx.moveTo(cx - 22, cy + 8); ctx.lineTo(cx + 12, cy + 8); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + 18, cy + 2, 7, 0, TAU); ctx.fill(); }
  else if (id === 'lob') { ctx.beginPath(); ctx.moveTo(cx - 22, cy + 10); ctx.quadraticCurveTo(cx - 2, cy - 22, cx + 16, cy + 8); ctx.setLineDash([3, 6]); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(cx + 18, cy + 8, 6, 0, TAU); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(cx - 24, cy + 2); ctx.lineTo(cx + 12, cy + 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx + 22, cy + 2); ctx.lineTo(cx + 10, cy - 8); ctx.lineTo(cx + 10, cy + 12); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx - 24, cy - 8); ctx.lineTo(cx - 6, cy - 8); ctx.moveTo(cx - 24, cy + 12); ctx.lineTo(cx - 6, cy + 12); ctx.stroke(); }
  ctx.restore();
}

function meterBar(ctx, r, state) {
  const sw = state.swing;
  ctx.save();
  roundPath(ctx, r.x, r.y + 5, r.w, r.h, 18); ctx.fillStyle = C.shadow; ctx.fill();
  roundPath(ctx, r.x, r.y, r.w, r.h, 18);
  const sg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); sg.addColorStop(0, '#2a2158'); sg.addColorStop(1, '#171238');
  ctx.fillStyle = sg; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#c9964a'; ctx.stroke();
  roundPath(ctx, r.x + 5, r.y + 5, r.w - 10, r.h - 10, 14); ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,226,170,0.28)'; ctx.stroke();
  const x0 = r.x + 22, w = r.w - 44, y0 = r.y + 28, h = 22;
  roundPath(ctx, x0, y0, w, h, h / 2); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.stroke();
  if (sw) {
    const a = x0 + (sw.centre - sw.half) * w, b = x0 + (sw.centre + sw.half) * w;
    roundPath(ctx, a, y0 - 3, b - a, h + 6, (h + 6) / 2);
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#79ffb0'); g.addColorStop(1, '#17b564');
    ctx.fillStyle = g; ctx.fill();
    // soft shoulders
    ctx.fillStyle = 'rgba(255,214,90,0.5)';
    ctx.fillRect(a - w * sw.half * 0.5, y0, w * sw.half * 0.5, h); ctx.fillRect(b, y0, w * sw.half * 0.5, h);
    const nx = x0 + (sw.live ? sw.needle : 0) * w;
    ctx.fillStyle = '#ffe9a0'; ctx.strokeStyle = '#3a1a06'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(nx, y0 - 8); ctx.lineTo(nx - 10, y0 - 22); ctx.lineTo(nx + 10, y0 - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff6d8'; ctx.fillRect(nx - 2.5, y0 - 6, 5, h + 12);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `700 22px ${FONT}`;
  const lr = state.lastRel;
  let msg = turnMessage(state);
  if (sw && sw.live && state.humanTurn) msg = 'Let go when the needle is in the green';
  else if (lr && lr.t < 2.4 && state.humanTurn) msg = lr.label;
  ctx.fillStyle = lr && lr.t < 2.4 && !(sw && sw.live) && state.humanTurn ? (lr.e <= 1 ? '#8dffb8' : '#ffb59a') : 'rgba(255,243,220,0.9)';
  ctx.fillText(msg, r.x + r.w / 2, r.y + r.h - 12);
  ctx.restore();
}

// A carved wooden frame around a window onto the scene: dark inner shadow, warm bevel, thin brass keyline.
function cutHole(ctx, r, rad) { ctx.save(); roundPath(ctx, r.x, r.y, r.w, r.h, rad); ctx.clip(); ctx.clearRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2); ctx.restore(); }
function frameView(ctx, r, rad) {
  ctx.save();
  roundPath(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, rad + 3); ctx.lineWidth = 6; ctx.strokeStyle = '#3a1f10'; ctx.stroke();
  roundPath(ctx, r.x, r.y, r.w, r.h, rad); ctx.lineWidth = 3; ctx.strokeStyle = '#d9a35a'; ctx.stroke();
  ctx.save(); roundPath(ctx, r.x, r.y, r.w, r.h, rad); ctx.clip();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + 22); g.addColorStop(0, 'rgba(10,4,0,0.45)'); g.addColorStop(1, 'rgba(10,4,0,0)');
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, 22); ctx.restore();
  ctx.restore();
}

// ---- the whole play screen --------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state, L) {
  const P = L.play, m = state.m, w = state.w;
  // night backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, L.h);
  bg.addColorStop(0, '#1c1448'); bg.addColorStop(0.5, '#2b1c5e'); bg.addColorStop(1, '#150e36');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, L.w, L.h);
  scoreCard(ctx, P.cards[0], 0, state, state.labels[0]);
  scoreCard(ctx, P.cards[1], 1, state, state.labels[1]);
  const [i1, i2] = infoText(state);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff3dc'; ctx.font = `700 ${L.wide ? 26 : 30}px ${FONT}`; ctx.fillText(i1, P.info.x, P.info.y);
  ctx.fillStyle = '#ffd27a'; ctx.font = `600 ${L.wide ? 20 : 22}px ${FONT}`;
  ctx.fillText(i2, P.info.x, P.info.y2);
  ctx.restore();

  // views
  const mingo = theMingo(w), marker = state.guide;
  const sv = stripView(P.strip);
  // loupe framing eases toward the mingo and the aim point (state.loupe is presentation only)
  const lp = state.loupe ?? { uc: mingo ? mingo.x : 10, half: 2.4 };
  const lv = loupeView(P.loupe, lp.uc, lp.half);
  const held = state.humanTurn && state.m.phase !== 'score' && !state.paused ? heldBall(state) : null;
  const over = (kind) => (ctx2, V) => {
    if (m.phase === 'score') measureOverlay(ctx2, V, state);
    aimOverlay(ctx2, V, state, kind);
    if (state.hint && !state.guide) { /* hint already placed into guide */ }
  };
  if (v3.on) { cutHole(ctx, P.strip, 16); cutHole(ctx, P.loupe, 18); }   // the 3D canvas shows through these two windows
  drawCourtView(ctx, sv, state, w, { noClip: false, over: over('strip'), held, radius: 16 });
  frameView(ctx, P.strip, 16);
  // strip labels
  ctx.save(); ctx.font = `700 ${L.wide ? 17 : 16}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,248,230,0.9)';
  const lblY = sv.y(COURT.half) + 0.5 * sv.kz * 0.92 * 0.6;
  ctx.textAlign = 'left'; ctx.fillText('THROW LINE', P.strip.x + 12, P.strip.y + 26);
  ctx.textAlign = 'center'; ctx.fillText('MINGO ZONE', sv.x((COURT.zoneA + COURT.zoneB) / 2, 0), P.strip.y + 26);
  ctx.textAlign = 'right'; ctx.fillText('DEAD LINE', P.strip.x + P.strip.w - 12, P.strip.y + 26);
  ctx.restore();
  // loupe: sand close-up with measuring rings; also the held ball when it is in view
  drawCourtView(ctx, lv, state, w, { rings: true, detail: true, over: over('loupe'), radius: 18 });
  frameView(ctx, P.loupe, 18);
  ctx.save();
  ctx.font = `700 ${L.wide ? 18 : 20}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,248,230,0.95)';
  const ph = m.phase === 'mingo' || m.phase === 'mingo-fly';
  const tag = state.guide ? `${ph ? 'Mingo toss' : STYLES.find((s) => s.id === state.guide.style).name}: ${state.guide.tx.toFixed(1)} m` : 'LOUPE';
  const tw = ctx.measureText(tag).width + 20;
  roundPath(ctx, P.loupe.x + 10, P.loupe.y + 10, tw, 32, 12); ctx.fillStyle = 'rgba(25,16,60,0.78)'; ctx.fill();
  ctx.fillStyle = '#fff3dc'; ctx.fillText(tag, P.loupe.x + 20, P.loupe.y + 33);
  ctx.restore();

  meterBar(ctx, P.meter, state);

  const watch = m.cfg.mode === 'watch';
  if (watch) {
    drawButton(ctx, P.demo.dec, 'Think −', { size: 24, sub: `${state.thinkSecs}s` });
    drawButton(ctx, P.demo.pause, state.paused ? 'Resume' : 'Pause', { size: 26, primary: true });
    drawButton(ctx, P.demo.inc, 'Think +', { size: 24, sub: `${state.thinkSecs}s` });
    drawButton(ctx, P.demo.exit, 'Exit', { size: 28 });
  } else {
    const mingoPhase = m.phase === 'mingo' || m.phase === 'mingo-fly';
    STYLES.forEach((s, i) => {
      const r = P.styles[i], dis = mingoPhase && s.id !== 'roll';
      drawButton(ctx, r, s.name, { active: state.sel === i && !dis, disabled: dis, size: 26, sub: L.wide ? null : s.sub });
      const col = dis ? 'rgba(80,60,100,0.4)' : state.sel === i ? '#fff8ea' : C.ink;
      styleIcon(ctx, s.id, r.x + 36, r.y + r.h / 2 + (state.sel === i ? 3 : 0), col);
    });
    const hum = state.humanTurn && !state.paused;
    drawButton(ctx, P.hint, 'Hint', { size: 26, disabled: !hum || m.phase !== 'aim' });
    const live = !!(state.swing && state.swing.live && state.humanTurn);
    drawButton(ctx, P.swing, live ? 'RELEASE' : 'SWING', { primary: true, size: 36, disabled: !hum || (m.phase !== 'aim' && m.phase !== 'mingo') || !state.guide, sub: live ? null : 'hold, then let go' });
    drawButton(ctx, P.menu, 'Menu', { size: 26 });
  }

  // toast and score pop
  if (state.toast && state.toastT > 0) {
    ctx.save();
    ctx.font = `600 ${L.wide ? 22 : 26}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = wrapLines(ctx, state.toast, P.toast.maxW - 40), lh = 32, hgt = lines.length * lh + 22, tw2 = Math.min(P.toast.maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44);
    ctx.globalAlpha = Math.min(1, state.toastT * 3);
    roundPath(ctx, P.toast.x - tw2 / 2, P.toast.y, tw2, hgt, 16); ctx.fillStyle = 'rgba(25,16,60,0.9)'; ctx.fill();
    ctx.fillStyle = '#fff3dc'; lines.forEach((l, i) => ctx.fillText(l, P.toast.x, P.toast.y + 11 + lh * (i + 0.5)));
    ctx.restore();
  }
  if (state.pop) {
    const a = state.pop, k = Math.min(1, a.t / 0.35), s = 0.7 + 0.5 * (1 - Math.pow(1 - k, 3)), alpha = a.t > 1.4 ? Math.max(0, 1 - (a.t - 1.4) / 0.4) : 1;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(L.w / 2, P.loupe.y + P.loupe.h * 0.42); ctx.scale(s, s);
    ctx.font = `700 120px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(25,16,60,0.9)'; ctx.strokeText(a.text, 0, 0);
    ctx.fillStyle = TEAM[a.team]?.hi ?? '#ffd27a'; ctx.fillText(a.text, 0, 0);
    ctx.restore();
  }
  // Watch & Learn: why the rival throws what it throws
  if (watch && state.explain) {
    const ex = state.explain, r = L.wide ? { x: P.loupe.x + 8, y: P.loupe.y + 50, w: P.loupe.w - 16 } : { x: P.loupe.x + 8, y: P.loupe.y + 50, w: P.loupe.w - 16 };
    ctx.save(); ctx.font = `700 ${L.wide ? 19 : 22}px ${FONT}`;
    const heads = wrapLines(ctx, ex.head, r.w - 28);
    ctx.font = `400 ${L.wide ? 17 : 20}px ${FONT}`;
    const body = ex.lines.flatMap((l) => wrapLines(ctx, l, r.w - 28));
    const lh = L.wide ? 23 : 27, hh = heads.length * lh + body.length * (lh - 3) + 22;
    roundPath(ctx, r.x, r.y, r.w, hh, 14); ctx.fillStyle = 'rgba(25,16,60,0.88)'; ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#ffd27a'; ctx.font = `700 ${L.wide ? 19 : 22}px ${FONT}`;
    heads.forEach((l, i) => ctx.fillText(l, r.x + 14, r.y + 27 + i * lh));
    ctx.fillStyle = 'rgba(255,243,220,0.95)'; ctx.font = `400 ${L.wide ? 17 : 20}px ${FONT}`;
    body.forEach((l, i) => ctx.fillText(l, r.x + 14, r.y + 27 + heads.length * lh + i * (lh - 3)));
    ctx.restore();
  }
  if (state.paused && watch) {
    ctx.save(); ctx.font = `700 42px ${DISPLAY}`; ctx.textAlign = 'center'; textShadow(ctx, 'PAUSED', P.loupe.x + P.loupe.w / 2, P.loupe.y + P.loupe.h / 2, '#fff3dc', 10); ctx.restore();
  }
}

// the ball held at the throwing line (for the strip), drawn in the colour of the side to throw
function heldBall(state) {
  const m = state.m;
  if (!(m.phase === 'aim' || m.phase === 'mingo')) return null;
  const mingo = m.phase === 'mingo';
  return { id: -5, side: m.turn, k: mingo, x: 0.0, y: 0, z: mingo ? 0.15 : 0.22, r: mingo ? R_MINGO : R_BALL, hit: 0, st: 'roll', vx: 0, vy: 0 };
}

export { paintButton, gap };
