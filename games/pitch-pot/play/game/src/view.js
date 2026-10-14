// The play screen: pavilion, vase, arrows, aim guide, flight, effects, scores, buttons and banners.
import { FONT, NUM, C, panel, roundPath, paintButton, wrapLines, drawIcon } from './ui.js';
import { FR, playLayout, TEXT_SCALES, inRect } from './layout.js';
import { drawBackdrop, drawMat, drawThrowLine, drawVase, drawArrow, drawSleeve, drawFx, cameraFor, sx, sy, TEAM, SERIF } from './art.js';
import { HAND, ARROW, ARROWS_EACH, LEVELS, HUMAN_SIGMA, guidePath, crossingSpread, RIM_Y } from './sim.js';
import { sideNames, winLine } from './menus.js';
import { drawLockupImg } from './brand.js';

const lerp = (a, b, t) => a + (b - a) * t;

export function baseSigma(state, side) {
  const c = state.m.cfg;
  if (c.mode === 'ai') return side === 0 ? HUMAN_SIGMA : LEVELS[c.opp].sig;
  if (c.mode === 'watch') return LEVELS[c.watch[side]].sig;
  return HUMAN_SIGMA;
}
export const isHuman = (m, side) => {
  const c = m.cfg.mode;
  return c === 'two' || c === 'solo' || (c === 'ai' && side === 0);
};
export const camOf = (state, L = playLayout()) => cameraFor(L.scene, state.m.D, state.camZ || 0);
export const flightFrame = (fl) => {
  const tr = fl.res.track, f = Math.max(0, fl.t) * 60, i = Math.min(tr.length - 1, Math.floor(f)), j = Math.min(tr.length - 1, i + 1), k = f - i;
  const a = tr[i], b = tr[j];
  return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), th: lerp(a[2], b[2], k) };
};

function dottedPath(ctx, cam, a, v, D, col, width = 4, alpha = 0.9) {
  const g = guidePath(a, v, D, 0.025, 3);
  ctx.save(); ctx.setLineDash([2, Math.max(8, cam.s * 3)]); ctx.lineCap = 'round'; ctx.lineWidth = width; ctx.strokeStyle = col; ctx.globalAlpha = alpha;
  ctx.beginPath();
  g.forEach((p, i) => { const X = sx(cam, p.tx), Y = sy(cam, p.ty); if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); });
  ctx.stroke(); ctx.restore();
}

function drawAim(ctx, state, L, cam) {
  const m = state.m, D = m.D, side = m.turn, a = m.aim;
  const guide = state.settings.guide;
  if (guide) {
    dottedPath(ctx, cam, a.a, a.v, D, TEAM[side].light, 4.5, 0.95);
    const sp = crossingSpread(a.a, a.v, D, baseSigma(state, side));
    if (sp) {
      const x0 = sx(cam, sp.x - sp.sd * 1.5), x1 = sx(cam, sp.x + sp.sd * 1.5), y = sy(cam, RIM_Y + 4);
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(20,12,8,0.7)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.strokeStyle = TEAM[side].light; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      const mx = sx(cam, sp.x); ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(mx, y, 6, 0, 7); ctx.fill();
      ctx.restore();
    }
  }
}

function sideBlock(ctx, x, y, w, h, side, state, m, name, hs, active) {
  const tm = TEAM[side];
  ctx.save();
  panel(ctx, x, y, w, h, { r: 18, stroke: active ? tm.light : 'rgba(216,165,74,0.55)', studs: false, lw: active ? 3 : 2 });
  if (active) { ctx.save(); roundPath(ctx, x + 3, y + 3, w - 6, h - 6, 15); ctx.clip(); const pulse = 0.14 + 0.07 * Math.sin(state.t * 3.2); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, tm.main); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = pulse * 1.6; ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore(); }
  // enamel seal: a round disc with a bright rim and a highlight, the side's character carved in cream
  const sx0 = x + 12 + 18, sy0 = y + h * 0.5;
  ctx.beginPath(); ctx.arc(sx0, sy0 + 2, 19, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
  const sg = ctx.createRadialGradient(sx0 - 6, sy0 - 7, 2, sx0, sy0, 20); sg.addColorStop(0, tm.light); sg.addColorStop(0.45, tm.main); sg.addColorStop(1, tm.dark);
  ctx.beginPath(); ctx.arc(sx0, sy0, 19, 0, 7); ctx.fillStyle = sg; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#e9c57a'; ctx.stroke();
  ctx.fillStyle = '#fff4dc'; ctx.font = `900 22px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(side === 0 ? '紅' : '翠', sx0, sy0 + 1);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff1d2';
  ctx.font = `700 ${Math.round(20 * hs)}px ${FONT}`; ctx.fillText(name, x + 58, y + h * 0.3, w - 64 - 70 * hs);
  // pips: arrows left in this round, drawn as little arrows with a team-coloured band
  const left = m.left[side];
  for (let i = 0; i < ARROWS_EACH; i++) {
    const px = x + 66 + i * 22, py = y + h * 0.72;
    ctx.strokeStyle = i < left ? '#e8c27a' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px - 6, py + 8); ctx.lineTo(px + 6, py - 8); ctx.stroke();
    ctx.fillStyle = i < left ? tm.main : 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(px - 6, py + 8, 3.4, 0, 7); ctx.fill();
  }
  // score: embossed gold numerals
  const sz = Math.round(50 * Math.min(hs, 1.15)), nx = x + w - 16, ny = y + h / 2 + 2;
  ctx.textAlign = 'right'; ctx.font = `900 ${sz}px ${NUM}`;
  ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillText(String(m.score[side]), nx + 2, ny + 3);
  const ng = ctx.createLinearGradient(0, ny - sz / 2, 0, ny + sz / 2); ng.addColorStop(0, '#fff3c4'); ng.addColorStop(0.5, tm.light); ng.addColorStop(1, '#e0a84a');
  ctx.fillStyle = ng; ctx.fillText(String(m.score[side]), nx, ny);
  ctx.restore();
}

function drawHud(ctx, state, L) {
  const m = state.m, names = sideNames(m.cfg), hs = Math.min(1.35, TEXT_SCALES[state.settings.textIdx]);
  const solo = m.cfg.mode === 'solo';
  const act = m.ph === 'over' ? -1 : m.turn;
  const roundLabel = solo ? `Round ${m.round}/${m.rounds}` : m.cfg.style === 'count' ? `Round ${m.round}/${m.rounds + m.extra}` : `Round ${m.round}`;
  const subLabel = solo ? `${m.left[0]} left` : m.cfg.style === 'race' ? `to ${m.target}` : m.extra ? 'extra round' : 'highest wins';
  if (!L.land) {
    const h = L.hud, mid = Math.max(112, 90 * hs), bw = (h.w - mid) / 2;
    sideBlock(ctx, h.x, h.y, bw - 6, h.h, 0, state, m, names[0] || 'You', hs, act === 0);
    if (!solo) sideBlock(ctx, h.x + bw + mid + 6, h.y, bw - 6, h.h, 1, state, m, names[1], hs, act === 1);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cx = h.x + h.w / 2;
    ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; ctx.fillStyle = '#ffe9b0';
    ctx.font = `800 ${Math.round(21 * hs)}px ${NUM}`; ctx.fillText(roundLabel, cx, h.y + h.h * 0.34, mid + bw * 0.2);
    ctx.font = `700 ${Math.round(17 * hs)}px ${NUM}`; ctx.fillStyle = '#fff1d2';
    ctx.fillText(subLabel, cx, h.y + h.h * 0.68, mid + bw * 0.2);
    ctx.restore();
  } else {
    const h = L.hud, bh = 100;
    sideBlock(ctx, h.x, h.y, h.w, bh, 0, state, m, names[0] || 'You', hs, act === 0);
    if (!solo) sideBlock(ctx, h.x, h.y + bh + 12, h.w, bh, 1, state, m, names[1], hs, act === 1);
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9b0'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(20 * hs)}px ${NUM}`; ctx.fillText(`${roundLabel}  ·  ${subLabel}`, h.x + h.w / 2, h.y + (solo ? bh : bh * 2 + 12) + 34, h.w);
    ctx.restore();
  }
}

function button(ctx, r, label, o = {}) {
  const { dy } = paintButton(ctx, r, o);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = o.disabled ? 'rgba(255,255,255,0.35)' : o.primary ? C.ink : '#fbefd2';
  let px = Math.min(30, Math.round(r.h * 0.36));
  ctx.font = `800 ${px}px ${FONT}`;
  while (ctx.measureText(label).width > r.w - 18 && px > 12) { px--; ctx.font = `800 ${px}px ${FONT}`; }
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + dy);
  ctx.restore();
}

export function hintRects(L) {
  const s = L.sheet;
  return s ? { use: { x: s.x + s.w - 210, y: s.y + s.h - 66, w: 194, h: 52 }, close: { x: s.x + s.w - 52, y: s.y + 6, w: 46, h: 46 } } : {};
}

function drawSheet(ctx, state, L, text, title, withUse) {
  const s = L.sheet; if (!s) return;
  const hs = Math.min(1.5, TEXT_SCALES[state.settings.textIdx]);
  panel(ctx, s.x, s.y, s.w, s.h, { r: 20, fill: 'rgba(22,16,13,0.95)' });
  ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd98a'; ctx.font = `800 ${Math.round(22 * hs)}px ${FONT}`; ctx.fillText(title, s.x + 18, s.y + 14 + 22 * hs);
  const fs = Math.round(23 * hs); ctx.font = `500 ${fs}px ${FONT}`; ctx.fillStyle = '#fbefd2';
  const lines = wrapLines(ctx, text, s.w - 36), room = Math.floor((s.h - 60 - (withUse ? 60 : 0)) / (fs * 1.3));
  lines.slice(0, Math.max(2, room)).forEach((l, i) => ctx.fillText(l, s.x + 18, s.y + 14 + 22 * hs + 14 + fs * (i + 1) * 1.3));
  ctx.restore();
  if (withUse) { const h = hintRects(L); button(ctx, h.use, 'Use this throw', { primary: true }); }
}


// A magnified window on the vase mouth while aiming: the planned tip path, the spread bar and the arrows already in play.
function drawScope(ctx, state, L, m) {
  const r = L.sheet, D = m.D, side = m.turn, hs = Math.min(1.3, TEXT_SCALES[state.settings.textIdx]);
  const win = 52, s = Math.min(r.h / (win + 4), r.w / 72);
  const cam = { ox: r.x + r.w / 2, cx: D - 4, s, floorY: r.y + r.h / 2 + 38 * s };
  if (!state.has3d) {
  ctx.save();
  roundPath(ctx, r.x, r.y, r.w, r.h, 20); ctx.clip();
  ctx.fillStyle = grad2(ctx, r.y, r.h); ctx.fillRect(r.x, r.y, r.w, r.h);
  for (const a of m.board.arrows) drawArrow(ctx, cam, a.x, a.y, a.th, a.side);
  drawVase(ctx, cam, D, state.t);
  if (state.settings.guide) {
    dottedPath(ctx, cam, m.aim.a, m.aim.v, D, TEAM[side].light, 4.5, 1);
    const sp = crossingSpread(m.aim.a, m.aim.v, D, baseSigma(state, side));
    if (sp) {
      const x0 = sx(cam, sp.x - sp.sd * 1.5), x1 = sx(cam, sp.x + sp.sd * 1.5), y = sy(cam, RIM_Y + 4);
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(20,12,8,0.7)'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.strokeStyle = TEAM[side].light; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    }
  }
  ctx.restore();
  }
  ctx.save(); roundPath(ctx, r.x, r.y, r.w, r.h, state.has3d ? 8 : 20); ctx.lineWidth = state.has3d ? 8 : 3; ctx.strokeStyle = state.has3d ? '#6e150c' : 'rgba(216,165,74,0.7)'; ctx.stroke();
  if (state.has3d) { roundPath(ctx, r.x + 4, r.y + 4, r.w - 8, r.h - 8, 6); ctx.lineWidth = 2; ctx.strokeStyle = '#d8a54a'; ctx.stroke(); }
  ctx.font = `700 ${Math.round(17 * hs)}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = state.has3d ? '#fff1c4' : 'rgba(30,18,8,0.85)';
  if (state.has3d) { ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 5; }
  ctx.fillText(`Angle ${Math.round(m.aim.a)}\u00b0   Power ${Math.round(((m.aim.v - 300) / 680) * 100)}%`, r.x + 14, r.y + 10, r.w - 28);
  ctx.restore();
}
const grad2 = (ctx, y, h) => { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#d9e6d8'); g.addColorStop(0.75, '#f3e8c8'); g.addColorStop(1, '#f6e8c6'); return g; };

export function renderPlay(ctx, state) {
  const m = state.m, L = playLayout(), cam = camOf(state, L), D = m.D;
  if (!state.has3d) {
  ctx.save();
  if (state.shake > 0.01) ctx.translate(Math.sin(state.t * 90) * state.shake * 5, Math.cos(state.t * 77) * state.shake * 4);
  drawBackdrop(ctx, FR.w, FR.h, state.t, cam);
  ctx.save(); ctx.beginPath(); ctx.rect(L.scene.x, 0, L.scene.w, FR.h); ctx.clip();
  drawMat(ctx, cam, D); drawThrowLine(ctx, cam);
  // arrows lying on the floor or in the vase
  for (const a of m.board.arrows) drawArrow(ctx, cam, a.x, a.y, a.th, a.side);
  const aimPhase = m.ph === 'aim' || m.ph === 'think' || m.ph === 'reveal' || m.ph === 'act';
  // thrower
  const swing = m.fl && m.ph === 'fly' ? Math.max(0, 1 - m.fl.t / 0.4) : 0;
  drawSleeve(ctx, cam, swing);
  if (aimPhase && m.left[m.turn] > 0 && !m.fl) {
    const al = (m.aim.a * Math.PI) / 180;
    drawArrow(ctx, cam, HAND.x + Math.cos(al) * ARROW.hl, HAND.y + Math.sin(al) * ARROW.hl, al, m.turn);
  }
  if (m.fl && m.ph === 'fly') {
    const f = flightFrame(m.fl), end = m.fl.t >= m.fl.res.dur;
    if (!end) drawArrow(ctx, cam, f.x, f.y, f.th, m.fl.res.side);
  }
  if (aimPhase && !m.fl && (m.ph === 'aim' && isHuman(m, m.turn) || m.ph === 'act' || m.ph === 'reveal')) drawAim(ctx, state, L, cam);
  // watch & learn: the candidate throws the computer weighed
  if (m.ph === 'reveal' && m.plan && m.plan.top) {
    m.plan.top.forEach((c, i) => {
      dottedPath(ctx, cam, c.a, c.v, D, i === 0 ? '#7dffb0' : 'rgba(255,255,255,0.6)', i === 0 ? 5 : 3, i === 0 ? 1 : 0.7);
    });
  }
  if (state.hint && m.ph === 'aim') dottedPath(ctx, cam, state.hint.a, state.hint.v, D, '#7dffb0', 5, 1);
  drawVase(ctx, cam, D, state.t);
  ctx.restore();
  drawFx(ctx, state.fx);
  ctx.restore();
  }
  if (L.land) {
    // lacquered side columns frame the scene and carry the scores and buttons (the scope window stays open when the 3D view fills it)
    const sc = L.scene, cols = [[0, sc.x], [sc.x + sc.w, FR.w - sc.x - sc.w]];
    for (const [x0, w0] of cols) {
      const g = ctx.createLinearGradient(x0, 0, x0 + w0, 0);
      if (x0 === 0) { g.addColorStop(0, 'rgba(12,8,5,0.97)'); g.addColorStop(1, 'rgba(34,24,18,0.94)'); } else { g.addColorStop(0, 'rgba(34,24,18,0.94)'); g.addColorStop(1, 'rgba(12,8,5,0.97)'); }
      ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, w0, FR.h);
      if (state.has3d && L.sheet && L.sheet.x >= x0 && L.sheet.x < x0 + w0 && m.ph === 'aim' && isHuman(m, m.turn) && !state.paused && !state.hint) ctx.rect(L.sheet.x, L.sheet.y, L.sheet.w, L.sheet.h);
      ctx.fillStyle = g; ctx.fill('evenodd'); ctx.restore();
    }
    ctx.fillStyle = 'rgba(216,165,74,0.75)'; ctx.fillRect(sc.x - 2, 0, 2, FR.h); ctx.fillRect(sc.x + sc.w, 0, 2, FR.h);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sc.x - 8, 0, 6, FR.h); ctx.fillRect(sc.x + sc.w + 2, 0, 6, FR.h);
  }
  // floating score text (not shaken)
  for (const f of state.floats) {
    const k = f.t / f.life, y = f.y - 60 * Math.min(1, k * 1.6), sc = f.big ? 1.25 : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4); ctx.font = `900 ${Math.round(f.size * sc * (1 + 0.3 * Math.max(0, 1 - k * 6)))}px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(18,10,6,0.92)'; ctx.strokeText(f.text, f.x, y); ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, y); ctx.restore();
  }
  drawHud(ctx, state, L);
  // message line
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const hs = Math.min(1.3, TEXT_SCALES[state.settings.textIdx]);
  ctx.font = `700 ${Math.round(21 * hs)}px ${FONT}`;
  const msg = statusText(state);
  if (msg.trim()) {
    const mw = Math.min(L.scene.w - 24, ctx.measureText(msg).width + 36);
    roundPath(ctx, L.msg.x - mw / 2, L.msg.y - 18 * hs + 3, mw, 36 * hs, 18 * hs); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
    roundPath(ctx, L.msg.x - mw / 2, L.msg.y - 18 * hs, mw, 36 * hs, 18 * hs);
    const mg = ctx.createLinearGradient(0, L.msg.y - 18 * hs, 0, L.msg.y + 18 * hs); mg.addColorStop(0, '#3a2a20'); mg.addColorStop(1, '#17100c'); ctx.fillStyle = mg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(216,165,74,0.8)'; ctx.stroke();
    ctx.fillStyle = '#fff3d6'; ctx.fillText(msg, L.msg.x, L.msg.y + 1, mw - 20);
  }
  ctx.restore();
  // buttons
  const watch = m.cfg.mode === 'watch';
  if (watch) {
    button(ctx, L.think, state.paused ? 'Resume' : 'Pause', { primary: state.paused });
    button(ctx, L.pause, 'Menu', {});
  } else {
    const canThink = isHuman(m, m.turn) && m.ph === 'aim' && !state.paused;
    button(ctx, L.think, 'Think', { disabled: !canThink, active: !!state.hint });
    button(ctx, L.pause, 'Pause', {});
  }
  // sheets
  if (state.hint && m.ph === 'aim') drawSheet(ctx, state, L, state.hint.text, 'Think', true);
  else if (watch && m.plan && (m.ph === 'think' || m.ph === 'reveal' || m.ph === 'act') && m.plan.text) drawSheet(ctx, state, L, m.ph === 'think' ? 'Weighing up the vase: testing many simulated throws for each plan.' : m.plan.text, `${sideNames(m.cfg)[m.turn]} ${m.ph === 'think' ? 'is thinking' : 'chooses'}`, false);
  // the scope: a magnified view of the mouth with the planned path
  if (m.ph === 'aim' && isHuman(m, m.turn) && !state.paused && !state.hint && L.sheet) drawScope(ctx, state, L, m);
  // banner
  if (m.banner) {
    const b = m.banner, k = b.t / b.life, pop = Math.min(1, b.t / 0.2), a = k > 0.72 ? 1 - (k - 0.72) / 0.28 : 1;
    const cy = L.scene.top + (L.scene.floorY - L.scene.top) * 0.28;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(L.scene.x + L.scene.w / 2, cy); ctx.scale(0.7 + 0.3 * pop, 0.7 + 0.3 * pop);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const sz = Math.min(80, L.scene.w * 0.1 + 8);
    ctx.font = `900 ${sz}px ${SERIF}`; ctx.lineWidth = sz * 0.2; ctx.lineJoin = 'round'; ctx.strokeStyle = '#14100d'; ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.col; ctx.fillText(b.text, 0, 0);
    if (b.sub) { ctx.font = `800 ${Math.round(sz * 0.36)}px ${NUM}`; ctx.lineWidth = 7; ctx.strokeText(b.sub, 0, sz * 0.72); ctx.fillStyle = '#fff1d2'; ctx.fillText(b.sub, 0, sz * 0.72); }
    ctx.restore();
  }
}

export function statusText(state) {
  const m = state.m, names = sideNames(m.cfg);
  if (state.paused && m.cfg.mode === 'watch') return 'Paused';
  switch (m.ph) {
    case 'intro': return `Round ${m.round}`;
    case 'aim': return isHuman(m, m.turn) ? (m.cfg.mode === 'two' ? `${names[m.turn]}: pull back, lift to throw` : 'Pull back to aim, lift to throw') : `${names[m.turn]} is thinking`;
    case 'think': return `${names[m.turn]} is thinking`;
    case 'reveal': return `${names[m.turn]} picks a throw`;
    case 'act': return `${names[m.turn]} throws`;
    case 'fly': case 'settle': return ' ';
    case 'bonus': return m.bonus && m.bonus.length ? `${m.bonus.map((s) => names[s] || 'You').join(' and ')}: sweep` : 'No sweep this round';
    case 'roundEnd': return `Round ${m.round} done`;
    case 'over': return m.winner >= 0 && m.cfg.mode !== 'solo' ? winLine(names[m.winner]) : 'Match over';
    default: return ' ';
  }
}
export { inRect, lerp, drawLockupImg };
