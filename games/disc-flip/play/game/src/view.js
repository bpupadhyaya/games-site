// Drawing of the play screen and the mat behind the menus. Pure drawing of `state` (game.js owns it).
import { W, H, TEXT_SCALES, playLayout, toScreen, matTransform, matBox, host, lens } from './layout.js';
import { v3 } from './v3.js';
import { WR, SQUIDGERS, getWink, spread, effSpread, hopDistance } from './sim.js';
import { drawBackdrop, drawWink, drawSquidger, TONES } from './art.js';
import { drawBoard, drawParts } from './theater.js';
import { FONT, C, roundPath, drawButton, wrapLines, woodFill, paintButton } from './ui.js';
import { PROFILES } from './ai.js';
import { roundNo } from './match.js';

const TAU = Math.PI * 2;
export { drawBackdrop };

export function layoutOf(state) {
  return playLayout(TEXT_SCALES[state.settings.textIdx], !!state.m && state.m.cfg.mode === 'watch');
}
export function nameOf(state, side) {
  const c = state.m.cfg;
  if (c.mode === 'two') return `Player ${side + 1}`;
  if (c.mode === 'watch') return PROFILES[side === 0 ? c.watchA : c.opp].name;
  return side === 0 ? 'You' : PROFILES[c.opp].name;
}

// the steadiness factor of the player's hand right now (the pulsing ring), 0.65 (perfect) .. 1.4 (worst)
export const ringPhase = (ph) => { const t = (ph % 1 + 1) % 1; return t < 0.5 ? t * 4 - 1 : 3 - t * 4; };   // triangle -1..1
export const steadiness = (ph, on = true) => (on ? 1.4 - 0.75 * (1 - Math.abs(ringPhase(ph))) : 1);

// ---- aim overlay (world units) ---------------------------------------------------------------------------------
function aimOverlay(ctx, state, mat) {
  const a = state.aim, p = state.preview;
  if (!p || !state.showAim || state.act) return;
  const w = getWink(mat, a.id);
  if (!w || w.pot) return;
  const sq = SQUIDGERS[a.sq], dx = Math.cos(a.angle), dy = Math.sin(a.angle);
  const pull = a.power * 34;
  // squidger poised behind the wink, further back the harder the pull
  drawSquidger(ctx, w.x - dx * (WR + sq.r * 0.72 + pull), w.y - dy * (WR + sq.r * 0.72 + pull), a.sq, { a: 0.9 });
  // path and landing region
  const D = p.D, lx = w.x + dx * D, ly = w.y + dy * D;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,248,214,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([2, 11]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(w.x + dx * WR * 1.2, w.y + dy * WR * 1.2); ctx.lineTo(lx, ly); ctx.stroke();
  ctx.setLineDash([]);
  const e = p.e, col = p.odds.pot >= 0.5 ? '120,255,190' : p.odds.squop >= 0.5 ? '255,200,90' : '255,255,255';
  ctx.translate(lx, ly); ctx.rotate(a.angle);
  ctx.fillStyle = `rgba(${col},0.16)`; ctx.beginPath(); ctx.ellipse(0, 0, Math.max(6, e.radial), Math.max(5, e.lateral), 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(${col},0.95)`; ctx.lineWidth = 2.5; ctx.setLineDash([9, 7]); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // the steadiness ring: release when it matches the gold mark
  if (a.holding && state.settings.steady) {
    const tri = ringPhase(a.ph), rr = WR + 11 + 12 * tri, gold = WR + 11;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,215,90,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.arc(w.x, w.y, gold, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    const q = 1 - Math.abs(tri);
    ctx.strokeStyle = q > 0.8 ? 'rgba(120,255,190,0.95)' : 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(w.x, w.y, Math.max(4, rr), 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // a hint target
  if (state.hint) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,230,120,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc(state.hint.target.x, state.hint.target.y, 20, 0, TAU); ctx.stroke(); ctx.restore();
  }
}

// ---- the same overlay when the mat is seen through the 3D camera (lens): each element is drawn in a local affine frame that
// follows the projected world axes at that point, so ovals and rings sit flat on the tilted felt.
function aff(ctx, L, x, y) {
  const e = 20, p0 = toScreen(L, x, y), px = toScreen(L, x + e, y), py = toScreen(L, x, y + e);
  ctx.transform((px.x - p0.x) / e, (px.y - p0.y) / e, (py.x - p0.x) / e, (py.y - p0.y) / e, p0.x, p0.y);
}
function aimOverlayProj(ctx, state, mat, L) {
  const a = state.aim, p = state.preview;
  if (!p || !state.showAim || state.act) return;
  const w = getWink(mat, a.id);
  if (!w || w.pot) return;
  const dx = Math.cos(a.angle), dy = Math.sin(a.angle), D = p.D, lx = w.x + dx * D, ly = w.y + dy * D;
  const s0 = toScreen(L, w.x + dx * WR * 1.2, w.y + dy * WR * 1.2), s1 = toScreen(L, lx, ly);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,248,214,0.85)'; ctx.lineWidth = 3.5; ctx.setLineDash([2, 11]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
  ctx.restore();
  const e = p.e, col = p.odds.pot >= 0.5 ? '120,255,190' : p.odds.squop >= 0.5 ? '255,200,90' : '255,255,255';
  ctx.save(); aff(ctx, L, lx, ly); ctx.rotate(a.angle);
  ctx.fillStyle = `rgba(${col},0.18)`; ctx.beginPath(); ctx.ellipse(0, 0, Math.max(6, e.radial), Math.max(5, e.lateral), 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(${col},0.95)`; ctx.lineWidth = 2.6; ctx.setLineDash([9, 7]); ctx.stroke();
  ctx.restore();
  if (a.holding && state.settings.steady) {
    const tri = ringPhase(a.ph), rr = WR + 11 + 12 * tri, gold = WR + 11, q = 1 - Math.abs(tri);
    ctx.save(); aff(ctx, L, w.x, w.y);
    ctx.strokeStyle = 'rgba(255,215,90,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.arc(0, 0, gold, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = q > 0.8 ? 'rgba(120,255,190,0.95)' : 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(0, 0, Math.max(4, rr), 0, TAU); ctx.stroke();
    ctx.restore();
  }
  if (state.hint) {
    ctx.save(); aff(ctx, L, state.hint.target.x, state.hint.target.y);
    ctx.strokeStyle = 'rgba(255,230,120,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.stroke(); ctx.restore();
  }
}

// A carved walnut plaque with a recessed slate field and a brass keyline; the side to play glows gold.
function plaque(ctx, r, active) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
  roundPath(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = woodFill(ctx); ctx.fill();
  ctx.shadowColor = 'transparent';
  roundPath(ctx, r.x, r.y, r.w, r.h, 18); const lg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); lg.addColorStop(0, 'rgba(255,210,150,0.2)'); lg.addColorStop(0.2, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = lg; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#170a03'; ctx.stroke();
  const ins = 6; roundPath(ctx, r.x + ins, r.y + ins, r.w - 2 * ins, r.h - 2 * ins, 13);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, active ? '#1f5a4c' : '#10302f'); g.addColorStop(1, active ? '#0e3a30' : '#0a1e1f');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = active ? 3 : 1.8; ctx.strokeStyle = active ? '#ffd25e' : 'rgba(224,176,86,0.7)'; ctx.stroke();
  if (active) { ctx.shadowColor = 'rgba(255,210,90,0.7)'; ctx.shadowBlur = 16; ctx.stroke(); }
  ctx.restore();
}

function chip(ctx, x, y, text, col) {
  ctx.save();
  ctx.font = `700 22px ${FONT}`;
  const w = ctx.measureText(text).width + 20, h = 32;
  roundPath(ctx, x - w / 2, y - h / 2, w, h, 16); ctx.fillStyle = 'rgba(6,24,26,0.9)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
  ctx.restore();
}

// The mat with everything on it. Draws into the rectangle given by layout L (world transform applied inside).
export function drawTable(ctx, state, th, L, o = {}) {
  if (v3.on && lens.on) {
    // 3D: the scene is already drawn behind this canvas; only the effects and the aim overlay go on top
    for (const q of th.parts) { ctx.save(); aff(ctx, L, q.x, q.y); drawParts(ctx, [{ ...q, x: 0, y: 0 }]); ctx.restore(); }
    if (o.state) aimOverlayProj(ctx, o.state, th.mat, L);
  } else {
  ctx.save();
  const sh = th.shake > 0 ? Math.sin(th.shake * 60) * 6 * th.shake : 0;
  const tr = matTransform(L);
  ctx.translate(sh, 0);
  ctx.transform(...tr);
  drawBoard(ctx, th, { sel: o.sel, selT: o.selT, over: o.over });
  ctx.restore();
  }
  // floating texts in screen space (the mat may be turned)
  for (const p of th.pops) {
    const k = p.t / p.max, s = toScreen(L, p.x, p.y);
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - k) * 2.2);
    ctx.font = `800 ${Math.round(p.size * (0.9 + 0.2 * Math.min(1, k * 6)))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,18,20,0.85)'; ctx.lineJoin = 'round';
    ctx.strokeText(p.text, s.x, s.y - 40 * k - 10); ctx.fillStyle = p.col; ctx.fillText(p.text, s.x, s.y - 40 * k - 10);
    ctx.restore();
  }
}

// ---- HUD pieces ---------------------------------------------------------------------------------------------------
function card(ctx, state, L, r, side, active) {
  const m = state.m, N = m.mat.n, fs = L.fs;
  const shown = state.act && !state.act.fired?.land ? state.act.potBefore : m.mat.potted;
  const n = shown[side];
  plaque(ctx, r, active);
  const ic = Math.min(r.h * 0.34, 22);
  drawWink(ctx, r.x + 12 + ic, r.y + r.h / 2, { side, tone: 0, r: ic });
  const tx = r.x + 22 + ic * 2;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#f8f1de'; ctx.font = `700 ${fs.name}px ${FONT}`;
  let name = nameOf(state, side);
  const maxW = r.w - (tx - r.x) - fs.score * 1.2 - 14;
  while (ctx.measureText(name).width > maxW && name.length > 3) name = name.slice(0, -2);
  ctx.fillText(name, tx, r.y + fs.name * 1.05 + 6);
  // one pip per wink: lit when potted
  const pr = Math.max(4, Math.min(8, (r.w - (tx - r.x) - fs.score * 1.3) / (N * 2.6)));
  for (let i = 0; i < N; i++) {
    const px = tx + pr + i * pr * 2.5, py = r.y + r.h - pr - 9;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU);
    if (i < n) { ctx.fillStyle = TONES[side][i % 2].mid; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    else { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffd25e'; ctx.font = `800 ${fs.score}px ${FONT}`;
  ctx.fillText(String(n), r.x + r.w - 14, r.y + r.h / 2 + fs.score * 0.36);
}

function sqButton(ctx, r, id, active, state, L) {
  const sq = SQUIDGERS[id];
  const lock = state.humanTurn && state.aim.id >= 0 && !state.act;
  const { dy } = paintButton(ctx, r, { primary: active, dark: !active });
  const small = r.w < 170, ir = Math.min(r.h * 0.22, sq.r * 0.6, 18);
  drawSquidger(ctx, r.x + r.w / 2, r.y + dy + 12 + ir, id, { r: ir, a: lock || !state.humanTurn ? 0.95 : 1 });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = active ? '#2a1700' : '#f8f1de';
  let fs = Math.min(Math.round(L.fs.small * (small ? 0.95 : 1.05)), Math.floor(r.h - 18 - ir * 2 - 2));
  ctx.font = `700 ${fs}px ${FONT}`;
  while (ctx.measureText(sq.name).width > r.w - 10 && fs > 11) { fs--; ctx.font = `700 ${fs}px ${FONT}`; }
  ctx.fillText(sq.name, r.x + r.w / 2, r.y + dy + 12 + ir * 2 + fs + 2);
}

export function drawInfo(ctx, state, L) {
  const r = L.info, m = state.m, fs = L.fs;
  ctx.save(); roundPath(ctx, r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(8,16,16,0.72)'; ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(224,176,86,0.55)'; ctx.stroke(); ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const sm = Math.round(fs.small * 0.95);
  ctx.fillStyle = 'rgba(255,230,160,0.9)'; ctx.font = `700 ${sm}px ${FONT}`;
  const head = `Round ${roundNo(m)} of ${m.total}${m.bonus ? '  ·  Bonus shot' : ''}${state.demo ? '  ·  Web demo' : ''}`;
  ctx.fillText(head, r.x + 14, r.y + sm + 5);
  const msg = state.toastT > 0 && state.toast ? state.toast : defaultInfo(state);
  ctx.fillStyle = '#f8f1de'; ctx.font = `600 ${fs.info}px ${FONT}`;
  const lines = wrapLines(ctx, msg, r.w - 28);
  const lh = fs.info * 1.2, maxLines = Math.max(1, Math.floor((r.h - sm - 12) / lh));
  lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, r.x + 14, r.y + sm + 8 + fs.info + i * lh - 2));
}

function defaultInfo(state) {
  const m = state.m;
  if (m.over) return 'Match over';
  if (state.act) return '';
  if (!state.humanTurn) return `${nameOf(state, m.turn)} is thinking…`;
  return m.cfg.mode === 'two' ? `${nameOf(state, m.turn)}: pull back from one of your winks and let go` : 'Pull back from one of your winks and let go';
}

// ---- the play screen ---------------------------------------------------------------------------------------------
export function renderPlay(ctx, state) {
  const L = layoutOf(state), m = state.m, th = state.th, watch = m.cfg.mode === 'watch';
  drawBackdrop(ctx, W, H);
  const turnSide = state.act ? state.act.side : m.turn;
  card(ctx, state, L, L.cards[0], 0, !m.over && turnSide === 0);
  card(ctx, state, L, L.cards[1], 1, !m.over && turnSide === 1);
  drawInfo(ctx, state, L);
  const selId = state.showAim && !state.act && state.aim.id >= 0 ? state.aim.id : null;
  const aim = state.showAim && !state.act && state.preview;
  drawTable(ctx, state, th, L, {
    sel: selId, selT: 0.5 + 0.5 * Math.sin(state.t * 6),
    over: (c) => aimOverlay(c, state, m.mat),
    state,
  });
  // odds chip near the landing point (screen space)
  if (aim && state.aim.holding) {
    const w = getWink(m.mat, state.aim.id), p = state.preview;
    if (w) {
      const s = toScreen(L, w.x + Math.cos(state.aim.angle) * p.D, w.y + Math.sin(state.aim.angle) * p.D);
      const o = p.odds;
      const txt = o.pot >= 0.08 ? `Pot ${Math.round(o.pot * 100)}%` : o.squop + o.bomb >= 0.08 ? `${p.odds.bomb > o.squop ? 'Blast' : 'Squop'} ${Math.round((o.squop + o.bomb) * 100)}%` : null;
      if (txt) chip(ctx, Math.max(60, Math.min(W - 60, s.x)), Math.max(40, s.y - 38), txt, o.pot >= 0.5 ? '#6dffb4' : '#ffd25e');
    }
  }
  if (watch) {
    const D = L.demo;
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: 28 });
    drawButton(ctx, D.dec, 'Think −', { size: 24, disabled: state.settings.thinkIdx === 0 });
    drawButton(ctx, D.inc, 'Think +', { size: 24, disabled: state.settings.thinkIdx === 3 });
    drawButton(ctx, D.exit, 'Exit Watch & Learn', { dark: true, size: 24 });
  } else {
    L.sqBtns.forEach((r, i) => sqButton(ctx, r, i, state.aim.sq === i && state.humanTurn, state, L));
    drawButton(ctx, L.btns.hint, state.hintBusy ? 'Thinking…' : 'Hint', { size: Math.min(L.fs.btn, 34), disabled: !state.humanTurn || !!state.act });
    drawButton(ctx, L.btns.menu, 'Menu', { dark: true, size: Math.min(L.fs.btn, 34) });
  }
  void host; void spread; void effSpread; void hopDistance; void matBox;
}
