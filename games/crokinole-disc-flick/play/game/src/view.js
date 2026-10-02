// Drawing for the play screen (table, discs, aim guide, HUD, control bar, overlays). Pure: reads `state`, never
// mutates it. Menus, pages and settings live in menus.js.
import {
  R_DISC, R_BASE, R_BOARD, R_POCKET, PEGS, MAX_U, U_ANGLE, startPoint, discValue, tally,
} from './sim.js';
import {
  TEAM, drawBackdrop, drawBoardDirect, BOARD_STAGES, startBoardBake, SPRITE_SIZE, drawDisc, drawPeg, setHost, canBake, makeCanvas, leafPath,
} from './art.js';
import { W, H, BC, CARD, ROUND_PILL, TOAST_Y, SLIDER, TRACK, HINT_BTN, MENU_BTN, DEMO_BAR, PULL, inRect } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, textShadow } from './ui.js';
import { PROFILES } from './opponents.js';
import { PER_SIDE } from './match.js';

const TAU = Math.PI * 2;
const FALL_T = 0.5;
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();

// ---- sprites (baked off-screen, a slice per frame) -------------------------------------------------------
let backdrop = null, backdropJob = 0;
let boardSprite = null, boardJob = null;
function artRes(ctx) {
  try { const a = typeof ctx.getTransform === 'function' ? ctx.getTransform().a : 2; return Math.min(2, Math.max(1, Math.ceil(a * 2) / 2)); } catch { return 2; }
}
function ensureBackdrop(ctx) {
  setHost(ctx);
  if (backdrop || !canBake()) return backdrop;
  const cv = makeCanvas(W, H);
  if (!cv) return null;
  drawBackdrop(cv.getContext('2d'), W, H);
  backdrop = cv;
  backdropJob = 1;
  return backdrop;
}
function ensureBoard(ctx) {
  setHost(ctx);
  if (boardSprite) return boardSprite;
  if (!canBake()) return false;
  if (!boardJob) boardJob = startBoardBake(artRes(ctx));
  if (boardJob.failed) return false;
  const r = boardJob.step(SHOT_MODE);
  if (r) { boardSprite = r; return r; }
  return null;
}

// ---- coordinates -----------------------------------------------------------------------------------------
export const shakeOf = (state) => {
  const s = state.shake;
  if (!s) return { x: 0, y: 0 };
  const k = 1 - s.t / s.dur;
  return { x: Math.sin(s.t * 71) * s.amp * k, y: Math.cos(s.t * 63) * s.amp * k };
};
export function toScreen(state, x, y, o = {}) {
  const rot = o.rot ?? state.view?.rot ?? 0, sc = o.scale ?? 1, sh = o.noShake ? { x: 0, y: 0 } : shakeOf(state);
  const c = Math.cos(rot), s = Math.sin(rot);
  return { x: BC.x + sh.x + (x * c - y * s) * sc, y: BC.y + sh.y + (x * s + y * c) * sc };
}
export function toWorld(state, sx, sy) {
  const rot = state.view?.rot ?? 0, c = Math.cos(-rot), s = Math.sin(-rot), dx = sx - BC.x, dy = sy - BC.y;
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

// ---- the table ----------------------------------------------------------------------------------------------
function drawDiscs(ctx, state, w, o = {}) {
  const t = state.t;
  const discs = w.discs;
  // shadows are inside drawDisc; streaks first so they sit under the discs
  for (const d of discs) {
    if (d.mode !== 'live') continue;
    const sp = Math.hypot(d.vx, d.vy);
    if (sp > 260) {
      const len = Math.min(70, sp * 0.045), nx = d.vx / sp, ny = d.vy / sp;
      const g = ctx.createLinearGradient(d.x, d.y, d.x - nx * len, d.y - ny * len);
      const col = TEAM[d.team].glow;
      g.addColorStop(0, col.replace('0.9', String(Math.min(0.5, sp / 2600)))); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = R_DISC * 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - nx * len, d.y - ny * len); ctx.stroke();
    }
  }
  for (const d of discs) {
    if (d.mode === 'live') {
      const hot = d.id === w.shot && !w.settled ? 0.7 : 0;
      drawDisc(ctx, d.x, d.y, d.team, d.spin, { glow: Math.max(hot, d.heat ?? 0), lift: hot ? 2 : 0 });
    } else if (d.mode === 'pocket') {
      const k = Math.min(1, d.fall / 0.45);
      if (k < 1) drawDisc(ctx, d.x * (1 - k), d.y * (1 - k), d.team, d.spin, { scale: 1 - 0.55 * k, a: 1 - k * k });
    } else if (d.mode === 'gutter') {
      const k = d.fall / FALL_T;
      if (k < 1) {
        const rc = Math.hypot(d.x, d.y) || 1;
        drawDisc(ctx, d.x + (d.x / rc) * k * 18, d.y + (d.y / rc) * k * 18, d.team, d.spin, { scale: 1 - 0.35 * k, a: 1 - k });
      }
    }
  }
  void t; void o;
}

function drawParticles(ctx, parts) {
  for (const q of parts) {
    const k = q.t / q.max, a = Math.max(0, 1 - k);
    if (q.kind === 2) {
      ctx.save(); ctx.globalAlpha = a * 0.85; ctx.strokeStyle = q.col ?? '#fff6d8'; ctx.lineWidth = 3 * a + 1;
      ctx.beginPath(); ctx.arc(q.x, q.y, 6 + k * (q.size ?? 30), 0, TAU); ctx.stroke(); ctx.restore();
    } else if (q.kind === 1) {
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = q.col ?? '#fff2c8'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.035, q.y - q.vy * 0.035); ctx.stroke(); ctx.restore();
    } else if (q.kind === 3) {
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = q.col ?? '#ffd35a';
      if (q.leaf) leafPath(ctx, q.x, q.y, q.size, q.rot + q.t * 4); else { ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - k * 0.5), 0, TAU); }
      ctx.fill(); ctx.restore();
    } else {
      ctx.save(); ctx.globalAlpha = a * 0.7; ctx.fillStyle = q.col ?? 'rgba(255,240,206,0.9)';
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 + k), 0, TAU); ctx.fill(); ctx.restore();
    }
  }
}

// The table with whatever lies on it. o: { rot, scale, over(ctx) } - `over` draws in board coordinates after the discs.
export function drawTable(ctx, state, w, parts, o = {}) {
  const bg = ensureBackdrop(ctx);
  if (bg) ctx.drawImage(bg, 0, 0, W, H); else drawBackdrop(ctx, W, H);
  const spr = ensureBoard(ctx);
  const sh = o.noShake ? { x: 0, y: 0 } : shakeOf(state);
  ctx.save();
  ctx.translate((o.cx ?? BC.x) + sh.x, (o.cy ?? BC.y) + sh.y);
  ctx.rotate(o.rot ?? state.view?.rot ?? 0);
  if (o.scale) ctx.scale(o.scale, o.scale);
  if (spr) ctx.drawImage(spr, -SPRITE_SIZE / 2, -SPRITE_SIZE / 2, SPRITE_SIZE, SPRITE_SIZE);
  else if (spr === false) drawBoardDirect(ctx);
  else BOARD_STAGES[0](ctx);
  if (state.pegFlash) state.pegFlash.forEach((f, i) => { if (f > 0.02) drawPeg(ctx, PEGS[i].x, PEGS[i].y, f); });
  if (o.base !== undefined) drawBaseGlow(ctx, o.base, state.t, o.baseStrength ?? 1);
  drawDiscs(ctx, state, w, o);
  drawParticles(ctx, parts);
  if (o.over) o.over(ctx);
  ctx.restore();
  return true;
}

function drawBaseGlow(ctx, side, t, k) {
  const c = side === 0 ? Math.PI / 2 : -Math.PI / 2, half = MAX_U * U_ANGLE + 0.1;
  const pulse = 0.55 + 0.25 * Math.sin(t * 4);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = TEAM[side].glow.replace('0.9', String(0.5 * pulse * k)); ctx.lineWidth = 14;
  ctx.beginPath(); ctx.arc(0, 0, R_BASE + R_DISC - 4, c - half, c + half); ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${0.55 * k})`; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, R_BASE + R_DISC + 1, c - half, c + half); ctx.stroke();
  ctx.restore();
}

// A small board for the rules illustrations: the baked sprite when ready, else drawn directly.
export function drawBoardMini(ctx, state, cx, cy, s) {
  const spr = ensureBoard(ctx);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  if (spr) ctx.drawImage(spr, -SPRITE_SIZE / 2, -SPRITE_SIZE / 2, SPRITE_SIZE, SPRITE_SIZE);
  else if (spr === false) drawBoardDirect(ctx);
  else BOARD_STAGES[0](ctx);
  ctx.restore();
}

// ---- aim guide -----------------------------------------------------------------------------------------------
function dotted(ctx, pts, color, width, alphaFrom = 0.9, alphaTo = 0.5) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = width; ctx.setLineDash([0.1, width * 3.1]);
  for (let i = 1; i < pts.length; i++) {
    ctx.strokeStyle = color; ctx.globalAlpha = alphaFrom + (alphaTo - alphaFrom) * (i / pts.length);
    ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
  }
  ctx.restore();
}

function drawAim(ctx, state) {
  const m = state.m, a = state.aim, side = m.turn;
  const t = state.t;
  const humanOrWatch = state.humanTurn || state.think || state.aiDrag;
  if (!a || !humanOrWatch || m.phase !== 'aim') return;
  const p = startPoint(side, a.u);
  const T = TEAM[side];
  const dragging = !!(a.active || state.aiDrag);
  // the waiting disc, hovering a little
  drawDisc(ctx, p.x, p.y, side, a.ang * 0.4, { lift: 7, glow: 0.35 + 0.2 * Math.sin(t * 5) });
  if (dragging) {
    const L = 14 + a.power * 62, bx = p.x - Math.cos(a.ang) * L, by = p.y - Math.sin(a.ang) * L;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(40,18,6,0.35)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(p.x + 2, p.y + 3); ctx.lineTo(bx + 2, by + 3); ctx.stroke();
    ctx.strokeStyle = '#f7ead0'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = T.face1; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(bx, by); ctx.stroke();
    const fg = ctx.createRadialGradient(bx - 3, by - 4, 1, bx, by, 14);
    fg.addColorStop(0, '#fff6e6'); fg.addColorStop(1, '#d8b88a');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(bx, by, 13, 0, TAU); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(80,44,16,0.75)'; ctx.stroke();
    ctx.restore();
  }
  const pv = state.preview;
  if (pv && (dragging || state.kbOn || state.hint || state.think)) {
    const path = pv.path;
    const stopI = state.settings.calm ? path.length : (pv.first != null ? pv.first + 1 : path.length);
    const pts = path.slice(0, Math.max(2, stopI));
    dotted(ctx, pts, pv.hitOpp || !pv.needHit ? '#fffbe8' : '#ffc46b', 4.2);
    if (pv.contact) {
      ctx.save(); ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(pv.contact.x, pv.contact.y, 9 + Math.sin(t * 8) * 1.5, 0, TAU); ctx.stroke(); ctx.restore();
    }
    const end = state.settings.calm || !pv.contact ? pv.rest : pv.contact;
    if (pv.rest && (state.settings.calm || !pv.contact)) drawDisc(ctx, pv.rest.x, pv.rest.y, side, 0, { a: 0.4, ghost: true });
    void end;
  }
  // power ring
  if (dragging) {
    ctx.save(); ctx.lineCap = 'round';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(40,18,6,0.45)'; ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, TAU); ctx.stroke();
    const g = ctx.createLinearGradient(p.x - 30, p.y, p.x + 30, p.y);
    g.addColorStop(0, '#6ee7a0'); g.addColorStop(0.6, '#ffd35a'); g.addColorStop(1, '#ff6a4a');
    ctx.strokeStyle = g; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p.x, p.y, 30, a.ang + Math.PI - a.power * Math.PI, a.ang + Math.PI + a.power * Math.PI); ctx.stroke();
    ctx.restore();
  }
}

function drawHintGhost(ctx, state) {
  const h = state.hint;
  if (!h || state.m.phase !== 'aim') return;
  const p = startPoint(state.m.turn, h.u);
  const pv = state.hintPreview;
  ctx.save();
  if (pv) {
    dotted(ctx, pv.path.slice(0, Math.max(2, (pv.first != null ? pv.first + 1 : pv.path.length))), '#9be8ff', 4.5, 0.95, 0.6);
    if (pv.contact) { ctx.strokeStyle = '#9be8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pv.contact.x, pv.contact.y, 11, 0, TAU); ctx.stroke(); }
  }
  ctx.globalAlpha = 0.55 + 0.25 * Math.sin(state.t * 6);
  drawDisc(ctx, p.x, p.y, state.m.turn, 0, { ghost: true, a: 0.7 });
  ctx.strokeStyle = '#9be8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, R_DISC + 5, 0, TAU); ctx.stroke();
  ctx.restore();
  if (state.alts) {
    for (const al of state.alts) {
      const s = startPoint(state.m.turn, al.u);
      ctx.save(); ctx.globalAlpha = 0.28; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Math.cos(al.ang) * 220, s.y + Math.sin(al.ang) * 220); ctx.stroke(); ctx.restore();
    }
  }
}

// ---- HUD ----------------------------------------------------------------------------------------------------
function names(state) {
  const m = state.m, mode = m.cfg.mode;
  if (mode === 'two') return ['Player 1', 'Player 2'];
  if (mode === 'watch') return [PROFILES[m.cfg.watchA].name, PROFILES[m.cfg.opp].name];
  return ['You', PROFILES[m.cfg.opp].name];
}

function drawCard(ctx, state, side, board) {
  const m = state.m, r = CARD[side], T = TEAM[side], active = m.phase === 'aim' && m.turn === side;
  const t = state.t;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 24, fill: 'rgba(30,14,10,0.84)', stroke: active ? T.glow.replace('0.9', '0.95') : 'rgba(255,214,150,0.28)' });
  if (active) {
    ctx.save(); roundPath(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 27); ctx.lineWidth = 3; ctx.strokeStyle = T.glow.replace('0.9', String(0.35 + 0.25 * Math.sin(t * 5))); ctx.stroke(); ctx.restore();
  }
  drawDisc(ctx, r.x + 38, r.y + 38, side, 0, { scale: 1.05 });
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 26px ${FONT}`;
  ctx.fillText(names(state)[side], r.x + 70, r.y + 38);
  ctx.fillStyle = 'rgba(255,233,191,0.75)'; ctx.font = `400 19px ${FONT}`;
  ctx.fillText(`on board ${board.pts[side]}`, r.x + 70, r.y + 62);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffd97a'; ctx.font = `700 54px ${FONT}`;
  ctx.fillText(String(m.scores[side]), r.x + r.w - 20, r.y + 70);
  // discs left
  for (let i = 0; i < PER_SIDE; i++) {
    const x = r.x + 26 + i * 33, y = r.y + 106, has = i < m.hand[side];
    if (has) drawDisc(ctx, x, y, side, 0, { scale: 0.52 });
    else { ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
}

export function drawHud(ctx, state) {
  const m = state.m, board = tally(state.w);
  drawCard(ctx, state, 0, board);
  drawCard(ctx, state, 1, board);
  // round pill
  panel(ctx, ROUND_PILL.x, ROUND_PILL.y, ROUND_PILL.w, ROUND_PILL.h, { r: 18, fill: 'rgba(30,14,10,0.84)', stroke: 'rgba(255,214,150,0.28)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,233,191,0.8)'; ctx.font = `400 16px ${FONT}`; ctx.fillText('ROUND', ROUND_PILL.x + 34, ROUND_PILL.y + 22);
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 28px ${FONT}`; ctx.fillText(`${m.round}/${m.rounds}`, ROUND_PILL.x + 34, ROUND_PILL.y + 50);
}

export function drawToast(ctx, state) {
  if (!(state.toastT > 0) || !state.toast) return;
  const a = Math.min(1, state.toastT / 0.4);
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = `700 26px ${FONT}`;
  const tw = Math.min(660, ctx.measureText(state.toast).width + 56);
  roundPath(ctx, W / 2 - tw / 2, TOAST_Y, tw, 52, 26); ctx.fillStyle = 'rgba(30,14,10,0.86)'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,214,150,0.45)'; ctx.stroke();
  ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = 26; ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText(state.toast).width > tw - 40 && px > 14) { px--; ctx.font = `700 ${px}px ${FONT}`; }
  ctx.fillText(state.toast, W / 2, TOAST_Y + 27);
  ctx.restore();
}

export function drawBar(ctx, state) {
  const m = state.m, watch = m.cfg.mode === 'watch';
  if (watch) {
    drawButton(ctx, DEMO_BAR.dec, 'Think −', { size: 24, sub: null });
    drawButton(ctx, DEMO_BAR.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: 32 });
    drawButton(ctx, DEMO_BAR.inc, 'Think +', { size: 24 });
    drawButton(ctx, DEMO_BAR.exit, 'Leave Watch & Learn', { dark: true, size: 26 });
    return;
  }
  // shooting spot slider
  const on = state.humanTurn && m.phase === 'aim' && !state.paused;
  const S = SLIDER;
  ctx.save();
  roundPath(ctx, S.x, S.y, S.w, S.h, 22); ctx.fillStyle = 'rgba(30,14,10,0.84)'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,214,150,0.3)'; ctx.stroke();
  ctx.globalAlpha = on ? 1 : 0.45;
  ctx.fillStyle = 'rgba(255,233,191,0.8)'; ctx.font = `400 18px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('SHOOTING SPOT: drag along the line', W / 2, S.y + 22);
  ctx.strokeStyle = 'rgba(255,233,191,0.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(TRACK.x0, TRACK.y); ctx.lineTo(TRACK.x1, TRACK.y); ctx.stroke();
  for (let i = -4; i <= 4; i++) { const x = W / 2 + (i / 4) * 276; ctx.beginPath(); ctx.moveTo(x, TRACK.y - 8); ctx.lineTo(x, TRACK.y + 8); ctx.stroke(); }
  const u = state.aim ? state.aim.u : 0, kx = W / 2 + (u / MAX_U) * 276;
  drawDisc(ctx, kx, TRACK.y, m.cfg.mode === 'two' ? m.turn : 0, 0, { scale: 1.2, glow: on ? 0.5 : 0 });
  ctx.restore();
  const waiting = !state.humanTurn;
  drawButton(ctx, HINT_BTN, state.hintBusy ? 'Thinking…' : 'Hint', { disabled: waiting || state.hintBusy || m.phase !== 'aim', size: 28 });
  drawButton(ctx, MENU_BTN, 'Menu', { dark: true, size: 28 });
  ctx.fillStyle = 'rgba(255,233,191,0.85)'; ctx.font = `400 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`Disc ${PER_SIDE - m.hand[m.turn] + (m.phase === 'aim' ? 1 : 0)} of ${PER_SIDE}`, W / 2, HINT_BTN.y + 32);
}

// Floating text and score chips in screen space (they stay upright however the board is turned).
function drawChips(ctx, state) {
  const m = state.m;
  if (m.phase === 'score' && m.roundInfo) {
    const info = m.roundInfo, t = info.t;
    const list = state.w.discs.filter((d) => d.mode === 'live' && discValue(d) > 0);
    list.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
    list.forEach((d, i) => {
      const k = Math.min(1, Math.max(0, (t - 0.25 - i * 0.07) / 0.3));
      if (k <= 0) return;
      const p = toScreen(state, d.x, d.y), v = discValue(d), e = 1 + 0.5 * Math.sin(Math.min(1, k) * Math.PI);
      ctx.save(); ctx.translate(p.x, p.y - 4); ctx.scale(e, e);
      roundPath(ctx, -17, -13, 34, 26, 13); ctx.fillStyle = v >= 15 ? '#ffd35a' : v >= 10 ? '#fff3d6' : '#e6d5b0'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(70,40,10,0.8)'; ctx.stroke();
      ctx.fillStyle = '#4a2810'; ctx.font = `700 18px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(v), 0, 1);
      ctx.restore();
    });
  }
  for (const p of state.pops) {
    const k = p.t / p.max, s = toScreen(state, p.x, p.y);
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${p.size ?? 30}px ${FONT}`;
    ctx.translate(s.x, s.y - 24 - k * 34);
    textShadow(ctx, p.text, 0, 0, p.col ?? '#ffe08a', 6);
    ctx.restore();
  }
}

// Round and match banners over the table.
function drawBanner(ctx, state) {
  const m = state.m;
  if (m.phase !== 'score' || !m.roundInfo) return;
  const info = m.roundInfo, k = Math.min(1, Math.max(0, (info.t - 0.3) / 0.5));
  if (k <= 0) return;
  const y = 330 - (1 - k) * 30, nm = names(state);
  ctx.save(); ctx.globalAlpha = k;
  const g = ctx.createLinearGradient(0, y - 20, 0, y + 150); g.addColorStop(0, 'rgba(24,10,8,0.0)'); g.addColorStop(0.2, 'rgba(24,10,8,0.9)'); g.addColorStop(1, 'rgba(24,10,8,0.9)');
  roundPath(ctx, 40, y, 640, 150, 28); ctx.fillStyle = 'rgba(28,12,10,0.92)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,150,0.5)'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 34px ${FONT}`; ctx.fillText(`Round ${info.round} counted`, W / 2, y + 44);
  ctx.font = `700 52px ${FONT}`;
  ctx.fillStyle = TEAM[0].face0; ctx.textAlign = 'right'; ctx.fillText(String(info.pts[0]), W / 2 - 40, y + 104);
  ctx.fillStyle = '#ffe9bf'; ctx.textAlign = 'center'; ctx.fillText(':', W / 2, y + 100);
  ctx.fillStyle = TEAM[1].face0; ctx.textAlign = 'left'; ctx.fillText(String(info.pts[1]), W / 2 + 40, y + 104);
  ctx.font = `400 21px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.8)';
  ctx.textAlign = 'right'; ctx.fillText(nm[0], W / 2 - 100, y + 134); ctx.textAlign = 'left'; ctx.fillText(nm[1], W / 2 + 100, y + 134);
  ctx.restore();
  void g;
  if (info.t > 1.2) { ctx.save(); ctx.globalAlpha = 0.6 + 0.3 * Math.sin(state.t * 4); ctx.fillStyle = '#fff3d6'; ctx.font = `400 22px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(m.cfg.mode === 'watch' ? 'Next round starting…' : 'Tap to continue', W / 2, y + 180); ctx.restore(); }
}

export function renderPlay(ctx, state) {
  const m = state.m, w = state.w;
  const showBase = m.phase === 'aim' ? m.turn : undefined;
  drawTable(ctx, state, w, state.parts, {
    base: showBase,
    baseStrength: state.humanTurn ? 1 : 0.55,
    over: (c) => { drawHintGhost(c, state); drawAim(c, state); },
  });
  drawHud(ctx, state);
  drawChips(ctx, state);
  drawBanner(ctx, state);
  drawToast(ctx, state);
  // think / reveal status for a computer shooter
  if (state.think && m.phase === 'aim') {
    const th = state.think, r = CARD[m.turn];
    const frac = th.phase === 'think' ? Math.min(1, th.t / th.dur) : 1;
    roundPath(ctx, r.x + 22, r.y + r.h - 12, r.w - 44, 6, 3); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
    roundPath(ctx, r.x + 22, r.y + r.h - 12, Math.max(6, (r.w - 44) * frac), 6, 3); ctx.fillStyle = th.phase === 'think' ? '#ffd35a' : '#7ee8a8'; ctx.fill();
  }
  drawBar(ctx, state);
  void H; void inRect; void PULL; void C; void R_BOARD; void R_POCKET;
}
export { names };
