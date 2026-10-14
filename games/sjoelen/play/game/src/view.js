// Drawing of the play screen and the board behind the menus. Pure drawing of `state` (game.js owns it).
import { W, H, TEXT_SCALES, playLayout, applyBoard, toScreen, host } from './layout.js';
import { TW, TL, D, START_Y, R, ARCH_VALUES, laneX, setsOf, scoreOf, countOf, PERFECT } from './sim.js';
import { drawBoardStill, drawDisc, drawPile, drawPlates, setRot, DISPLAY, LIGHT } from './art.js';
import { FONT, C, roundPath, drawButton, wrapLines, textShadow, plaque } from './ui.js';
import { PROFILES } from './ai.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
export const BG_TOP = '#2b180b', BG_BOT = '#0e0704';

export function layoutOf(state) {
  const m = state.m;
  return playLayout(TEXT_SCALES[state.settings.textIdx], !!m && m.cfg.mode === 'watch');
}

export function drawBackdrop(ctx) {
  if (v3.on) {                                   // the lit 3D cafe is behind this canvas: only a soft vignette goes on top
    ctx.clearRect(0, 0, W, H);
    const v = ctx.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.35, W / 2, H * 0.46, Math.max(W, H) * 0.78);
    v.addColorStop(0, 'rgba(10,4,0,0)'); v.addColorStop(1, 'rgba(10,4,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, BG_TOP); g.addColorStop(1, BG_BOT);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // warm pool of light behind the board
  const r = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, Math.max(W, H) * 0.7);
  r.addColorStop(0, 'rgba(255,190,110,0.22)'); r.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  // table-cloth weave
  ctx.fillStyle = 'rgba(255,214,150,0.03)';
  for (let y = 10; y < H; y += 40) for (let x = ((y / 40) % 2) * 20; x < W; x += 40) { ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill(); }
}

export const nameOf = (state, side) => {
  const m = state.m, mode = m.cfg.mode;
  if (mode === 'two') return `Player ${side + 1}`;
  if (mode === 'solo') return 'You';
  if (mode === 'watch') return PROFILES[side === 0 ? m.cfg.watchA : m.cfg.opp].name;
  return side === 0 ? 'You' : PROFILES[m.cfg.opp].name;
};

function drawParts(ctx, parts) {
  for (const q of parts) {
    const k = 1 - q.t / q.max;
    if (k <= 0) continue;
    ctx.save();
    if (q.kind === 0) { ctx.globalAlpha = k; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + 0.5 * k), 0, TAU); ctx.fill(); }
    else if (q.kind === 1) { ctx.globalAlpha = k * 0.8; ctx.strokeStyle = q.col; ctx.lineWidth = 0.8 + 2.4 * k; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - k * k), 0, TAU); ctx.stroke(); }
    else if (q.kind === 3) {
      ctx.globalAlpha = k; ctx.fillStyle = q.col; ctx.translate(q.x, q.y); ctx.rotate(q.t * 6);
      const s = q.size * (0.4 + 0.6 * k);
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.38 : s, a = (i / 8) * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// The board and everything on it, in world units. `scene`: { table, side, queue, moving, falls, parts, pile, pulse, guide, hint, aim, ready }.
function drawPartsProj(ctx, parts) {
  for (const q of parts) {
    const k = 1 - q.t / q.max;
    if (k <= 0) continue;
    const p = v3.xf(q.x, q.y, q.kind === 1 ? 0 : 0.5), sz = q.size * p.s;
    ctx.save();
    if (q.kind === 0) { ctx.globalAlpha = k * 0.8; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.2, sz * (0.5 + 0.5 * k)), 0, TAU); ctx.fill(); }
    else if (q.kind === 1) { ctx.globalAlpha = k * 0.8; ctx.strokeStyle = q.col; ctx.lineWidth = 1 + 2.4 * k; ctx.beginPath(); ctx.ellipse(p.x, p.y, sz * (1 - k * k), sz * (1 - k * k) * 0.6, 0, 0, TAU); ctx.stroke(); }
    else if (q.kind === 3) {
      ctx.globalAlpha = k; ctx.fillStyle = q.col; ctx.translate(p.x, p.y); ctx.rotate(q.t * 6);
      const s = Math.max(2, sz * (0.4 + 0.6 * k));
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.38 : s, a = (i / 8) * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// With the 3D board behind the canvas only the overlays (guide / hint lines, sparkles) are drawn, projected through its camera.
function drawOverlay3D(ctx, scene) {
  const path = (tr, col, dash, w) => {
    if (!tr || tr.length < 4) return;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.setLineDash(dash);
    ctx.beginPath();
    for (let i = 0; i < tr.length; i += 2) { const p = v3.xf(tr[i], tr[i + 1], 0.36); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
    ctx.stroke(); ctx.setLineDash([]);
    const ex = tr[tr.length - 2], ey = tr[tr.length - 1], e = v3.xf(ex, ey, 0.36);
    ctx.globalAlpha = 0.5; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(e.x, e.y, R * e.s, R * e.s * 0.7, 0, 0, TAU); ctx.fill();
    ctx.restore();
  };
  if (scene.hint) path(scene.hint.trace, 'rgba(255,214,90,0.95)', [3, 7], 3);
  if (scene.guide) path(scene.guide, 'rgba(255,255,255,0.92)', [2, 7], 2.6);
  drawPartsProj(ctx, scene.parts);
}

export function drawScene(ctx, L, scene, raw = false) {
  if (v3.on && !raw && v3.xf) { drawOverlay3D(ctx, scene); return; }
  ctx.save();
  if (!raw) { setRot(L.rot); applyBoard(ctx, L); }
  drawBoardStill(ctx);
  const side = scene.side ?? 0;
  const counts = scene.pile ?? [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) drawPile(ctx, k, counts[k], side);
  drawPlates(ctx, counts, scene.pulse);
  // the near rail: discs still in hand
  if (scene.queue > 0) {
    const n = Math.min(scene.queue, 10);
    for (let i = 0; i < n; i++) drawDisc(ctx, 20 + (i % 5) * 7.5 + (i >= 5 ? 3.5 : 0), TL + 6 + (i >= 5 ? 6 : 12) , side, { r: 6.2, shadow: false });
  }
  // lying discs
  for (const d of scene.table) drawDisc(ctx, d.x, d.y, d.side ?? side);
  // guide / hint paths
  const path = (tr, col, dash, w) => {
    if (!tr || tr.length < 4) return;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(tr[0], tr[1]);
    for (let i = 2; i < tr.length; i += 2) ctx.lineTo(tr[i], tr[i + 1]);
    ctx.stroke(); ctx.setLineDash([]);
    const ex = tr[tr.length - 2], ey = tr[tr.length - 1];
    ctx.globalAlpha = 0.5; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ex, ey, R, 0, TAU); ctx.fill();
    ctx.restore();
  };
  if (scene.hint) path(scene.hint.trace, 'rgba(255,214,90,0.95)', [3, 5], 2.2);
  if (scene.guide) path(scene.guide, 'rgba(255,255,255,0.9)', [2, 5], 1.8);
  // the disc to slide
  if (scene.ready) {
    const a = scene.aim;
    if (scene.hint) drawDisc(ctx, scene.hint.x, START_Y, side, { alpha: 0.5, shadow: false, ring: 'rgba(255,214,90,0.9)' });
    drawDisc(ctx, a.x, START_Y, side, { lift: 1.2, ring: scene.readyGlow ? 'rgba(255,255,255,0.65)' : null });
  }
  if (scene.moving) drawDisc(ctx, scene.moving.x, scene.moving.y, scene.moving.side, { lift: 0.5 });
  for (const f of scene.falls) drawDisc(ctx, f.x, f.y, f.side, {});
  drawParts(ctx, scene.parts);
  ctx.restore();
}

// ---- HUD --------------------------------------------------------------------------------------------------------------
function card(ctx, r, name, total, sub, active, L, fs, col) {
  roundPath(ctx, r.x, r.y + 5, r.w, r.h, 16); ctx.fillStyle = 'rgba(10,4,0,0.45)'; ctx.fill();
  plaque(ctx, r, { rad: 16, c0: active ? '#7a4a22' : '#4a2a12', c1: active ? '#4a280e' : '#2a1406', rim: active ? '#ffd97a' : 'rgba(201,154,58,0.55)', edge: '#140802', glow: active });
  // a turned wooden disc as the player's marker
  const dr = Math.min(13, r.h * 0.2), dx = r.x + 24, dy = r.y + 26;
  const dg = ctx.createRadialGradient(dx - dr * 0.3, dy - dr * 0.3, dr * 0.1, dx, dy, dr);
  dg.addColorStop(0, '#fff3d0'); dg.addColorStop(0.6, col); dg.addColorStop(1, '#2a1404');
  ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(dx, dy, dr, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(30,12,2,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `700 ${fs.name}px ${FONT}`; ctx.fillStyle = '#fff3d8';
  let nm = name; while (ctx.measureText(nm).width > r.w - 120 && nm.length > 4) nm = nm.slice(0, -2);
  ctx.fillText(nm === name ? nm : `${nm}…`, r.x + 44, r.y + 6 + fs.name * 0.9);
  ctx.textAlign = 'right'; ctx.font = `400 ${fs.score}px ${DISPLAY}`;
  const sx = r.x + r.w - 16, sy = r.y + r.h - 12;
  ctx.fillStyle = '#2a1204'; ctx.fillText(String(total), sx + 1.5, sy + 2.5);
  const g = ctx.createLinearGradient(0, sy - fs.score * 0.8, 0, sy); g.addColorStop(0, '#fff2b8'); g.addColorStop(1, '#e0a838');
  ctx.fillStyle = g; ctx.fillText(String(total), sx, sy);
  ctx.textAlign = 'left'; ctx.font = `400 ${fs.sub}px ${FONT}`; ctx.fillStyle = 'rgba(255,238,200,0.85)';
  ctx.fillText(sub, r.x + 16, r.y + r.h - 14);
}

export function infoText(state) {
  const m = state.m;
  if (m.over) return 'Match over';
  const sd = nameOf(state, m.side);
  const rd = m.rounds > 1 ? `Round ${m.round + 1} of ${m.rounds}` : 'One round';
  if (m.push > 0) return `${rd} · ${sd}: ${m.queue} stray${m.queue === 1 ? '' : 's'} slide again (${m.push + 1} of 3)`;
  return `${rd} · ${sd}: ${m.queue} disc${m.queue === 1 ? '' : 's'} to slide`;
}

export function renderPlay(ctx, state) {
  const m = state.m, L = layoutOf(state), fs = L.fs;
  drawBackdrop(ctx);
  const scene = sceneOf(state);
  drawScene(ctx, L, scene);
  // score cards
  const tot = m.stack.map(scoreOf);
  const names = [0, 1].map((s) => nameOf(state, s));
  const sub = (s) => `${setsOf(m.stack[s])} set${setsOf(m.stack[s]) === 1 ? '' : 's'} · ${countOf(m.stack[s])} in`;
  card(ctx, L.cards[0], names[0], tot[0], sub(0), m.side === 0 && !m.over, L, fs, '#f0d28a');
  if (m.sides === 2) card(ctx, L.cards[1], names[1], tot[1], sub(1), m.side === 1 && !m.over, L, fs, '#6a3d22');
  else card(ctx, L.cards[1], 'Best run', Math.max(state.record.bestSolo | 0, tot[0]), `Perfect is ${PERFECT}`, false, L, fs, '#ffd97a');
  // info line
  const I = L.info;
  ctx.fillStyle = 'rgba(255,238,200,0.92)'; ctx.font = `600 ${fs.info}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const lines = wrapLines(ctx, infoText(state), I.w);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, I.x + I.w / 2, I.y + fs.info * (1.05 + i * 1.2)));
  // buttons
  if (L.btns) {
    const human = state.humanTurn && !state.act && !m.over;
    drawButton(ctx, L.btns.hint, state.hintBusy ? 'Thinking…' : 'Hint', { size: fs.btn, disabled: !human || state.hintBusy });
    drawButton(ctx, L.btns.menu, 'Menu', { size: fs.btn, dark: true });
  }
  if (L.demo) {
    const D = L.demo;
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: Math.min(fs.btn, 30) });
    drawButton(ctx, D.dec, 'Think −', { size: Math.min(fs.btn, 26), disabled: state.settings.thinkIdx === 0 });
    drawButton(ctx, D.inc, 'Think +', { size: Math.min(fs.btn, 26), disabled: state.settings.thinkIdx === 3 });
    drawButton(ctx, D.exit, 'Leave Watch & Learn', { size: Math.min(fs.btn, 26), dark: true });
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,238,200,0.8)'; ctx.font = `600 ${Math.round(fs.small)}px ${FONT}`;
    const dx = D.pause.x + D.pause.w / 2;
    void dx;
  }
  // world-anchored pop texts (screen space so they never rotate)
  for (const p of state.pops) {
    const s = v3.on && v3.xf ? v3.xf(p.x, p.y, 0.8) : toScreen(L, p.x, p.y), k = p.t / p.max;
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `400 ${Math.round(p.size * (1 + 0.2 * Math.min(1, k * 6)))}px ${DISPLAY}`;
    textShadow(ctx, p.text, s.x, s.y - 50 * k, p.col, 6);
    ctx.restore();
  }
  // toast
  if (state.toastT > 0 && state.toast) {
    ctx.save();
    const tf = Math.min(Math.round(fs.info), 30);
    ctx.font = `700 ${tf}px ${FONT}`;
    const tl = wrapLines(ctx, state.toast, Math.min(W - 60, 640));
    const tw = Math.max(...tl.map((l) => ctx.measureText(l).width)) + 36, th = tl.length * tf * 1.25 + 18;
    const below = H - (L.rect.y + L.rect.h), above = L.rect.y;
    const ty = (!L.rot || L.topHud) ? L.rect.y + L.rect.h * 0.5 - th / 2 : (below >= above && L.btns && !L.land) || (L.land ? false : below > th + 20) ? L.rect.y + L.rect.h + 10 : Math.max(36, L.rect.y - th - 8);
    plaque(ctx, { x: W / 2 - tw / 2, y: ty, w: tw, h: th }, { rad: 16, c0: '#4a2a12', c1: '#24120a', rim: '#d6a845', edge: '#0e0602' });
    ctx.fillStyle = '#fff3d8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    tl.forEach((l, i) => ctx.fillText(l, W / 2, ty + 9 + (i + 0.5) * tf * 1.25));
    ctx.restore();
  }
  // pass-the-phone card (two players)
  if (state.pass) {
    ctx.fillStyle = 'rgba(8,4,0,0.78)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `400 ${Math.round(46 * Math.min(1.3, TEXT_SCALES[state.settings.textIdx]))}px ${DISPLAY}`;
    textShadow(ctx, `${nameOf(state, m.side)}`, W / 2, H / 2 - 20, '#ffd97a', 8);
    ctx.font = `600 ${Math.round(28 * Math.min(1.5, TEXT_SCALES[state.settings.textIdx]))}px ${FONT}`; ctx.fillStyle = '#fff3d8';
    wrapLines(ctx, 'Hand the phone over, then tap to slide your round.', W - 120).forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + 30 + i * 38));
  }
}

// What the board shows right now.
export function sceneOf(state) {
  const m = state.m, side = m.side;
  const live = state.live ?? [0, 0, 0, 0];
  const pile = m.stack[side].map((c, k) => c + live[k]);
  return {
    side, queue: state.act ? Math.max(0, m.queue - 1) : m.queue, table: state.world ? state.world.discs.filter((d) => d.cap < 0 && d !== state.moving) : m.table,
    moving: state.moving, falls: state.falls, parts: state.parts, pile, pulse: state.pulse,
    guide: state.guide, hint: state.hint, aim: state.aim, ready: !state.act && !m.over && !state.moving && m.queue > 0,
    readyGlow: state.humanTurn,
  };
}
void TW; void D; void ARCH_VALUES; void laneX; void host; void C; void LIGHT;
