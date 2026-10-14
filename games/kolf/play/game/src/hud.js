// The play screen furniture: scoreboard, power meter, Think / Watch & Learn card, toast, end-of-leg card and the control
// buttons. Pure drawing from `state`; game.js owns the state and the hit-testing (layout rects come from layout.js).
import { TEXT_SCALES, playLayout } from './layout.js';
import { FONT, SERIF, C, roundPath, panel, plaque, wrapLines, textShadow, drawButton, FLOOR } from './ui.js';
import { BALL_COLORS, fitText } from './view.js';
import { BR, V_MIN, V_MAX } from './sim.js';

const TAU = Math.PI * 2;

// Where the kit's "Preview 1:29" pill sits during play: right end of the leg/wind line, so it never covers the scoreboard.
export const badgeSlot = { ok: false, x: 0, y: 0, k: 0 };   // k: css px per virtual unit (set by game.render)
export const parLabel = (d) => (d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`);
export const scoreName = (strokes, par) => {
  if (strokes === 1) return 'In one!';
  const d = strokes - par;
  return d <= -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : `+${d}`;
};
export const windText = (c) => {
  const a = c.wind.ax, mag = Math.abs(a);
  if (mag < 0.04) return 'Calm';
  const word = mag < 0.12 ? 'Light' : mag < 0.2 ? 'Fresh' : 'Strong';
  return `${word} wind ${a > 0 ? '→' : '←'}`;
};

// ---- controls ----------------------------------------------------------------------------------------------------------
export function controlKind(state) {
  const m = state.m;
  if (m.cfg.mode === 'watch') return state.holeEnd ? 'watchNext' : 'watch';
  if (state.holeEnd) return 'next';
  if (state.phase === 'roll' || state.phase === 'settle') return 'roll';
  if (state.humanTurn && (state.phase === 'aim' || state.phase === 'swing' || state.phase === 'strike')) return 'aim';
  return 'wait';
}
export const rowsFor = (kind) => (land, s) => {
  switch (kind) {
    case 'aim': return land ? [['swing'], ['left', 'right'], ['think', 'menu']] : s >= 1.5 ? [['swing'], ['think', 'left', 'right', 'menu']] : [['think', 'left', 'swing', 'right', 'menu']];
    case 'roll': return [['menu', 'fast']];
    case 'wait': return [['menu', 'fast']];
    case 'next': return [['next', 'menu']];
    case 'watch': return land || s >= 1.5 ? [['pause', 'fast'], ['dec', 'inc', 'exit']] : [['pause', 'fast', 'dec', 'inc', 'exit']];
    case 'watchNext': return [['pause', 'exit']];
    default: return [['menu']];
  }
};
export function controlLabel(id, state) {
  const m = state.m;
  switch (id) {
    case 'think': return state.hintBusy ? 'Thinking…' : 'Think';
    case 'swing': return state.phase === 'swing' ? 'Strike!' : 'Swing';
    case 'left': return '◀';
    case 'right': return '▶';
    case 'menu': return 'Menu';
    case 'pause': return state.paused ? 'Resume' : 'Pause';
    case 'fast': return state.ff ? 'Speed ×1' : 'Speed ×2';
    case 'next': return m.idx >= m.legs.length - 1 ? 'See results' : 'Next leg';
    case 'dec': return 'Think −';
    case 'inc': return 'Think +';
    case 'exit': return 'Exit';
    default: return id;
  }
}
export function layoutFor(state) {
  const kind = controlKind(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const c = state.court;
  return playLayout(sc, rowsFor(kind), state.m.players.length, c ? c.W / c.L : 0.2);
}

// ---- scoreboard --------------------------------------------------------------------------------------------------------
export function drawHud(ctx, state, lay) {
  const m = state.m, hd = lay.hud, fs = hd.fs, leg = m.legs[m.idx], c = state.court;
  plaque(ctx, hd.x + 8, hd.y, hd.w - 16, hd.h - 4, { r: 18 });
  ctx.textBaseline = 'alphabetic';
  const pad = 20, x0 = hd.x + 8 + pad, innerW = hd.w - 16 - 2 * pad;
  ctx.textAlign = 'left'; ctx.fillStyle = '#f8edd0';
  const t1 = `${c.name}${leg.dir ? ' · back' : ' · out'}`, p1 = fitText(ctx, t1, innerW * 0.64, Math.round(fs * 1.1), 700, SERIF);
  ctx.fillText(t1, x0, hd.y + 12 + p1 * 0.95);
  ctx.textAlign = 'right'; ctx.fillStyle = '#e9c273';
  const t2 = `Par ${leg.par}`; fitText(ctx, t2, innerW * 0.32, Math.min(Math.round(fs * 1.05), p1), 700, SERIF); ctx.fillText(t2, x0 + innerW, hd.y + 12 + p1 * 0.95);
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(224,206,166,0.92)';
  const t3 = `Leg ${m.idx + 1} of ${m.legs.length}  ·  ${windText(c)}`;
  let p3;
  // The preview pill lives at the right end of this line when it fits (portrait); otherwise the kit's top-centre default.
  const pfs = Math.max(16, 11.5 / (badgeSlot.k || 0.5));
  ctx.font = `600 ${pfs}px system-ui, sans-serif`;
  const pillW = ctx.measureText('Preview 0:00').width + pfs * 1.3 + 14;
  const roomFor = innerW - pillW >= innerW * 0.6;
  p3 = fitText(ctx, t3, roomFor ? innerW - pillW : innerW, Math.round(fs * 0.78), 500);
  if (roomFor) { badgeSlot.ok = true; badgeSlot.x = x0 + innerW; badgeSlot.y = hd.y + 12 + p1 * 1.05 + p3 * 1.15 - p3 * 0.35; }
  else if (lay.mini) { badgeSlot.ok = true; badgeSlot.x = x0 + innerW; badgeSlot.y = lay.mini.y + lay.mini.h + pfs * 1.1 + 6; }   // side panel: free space under the map strip
  ctx.fillText(t3, x0, hd.y + 12 + p1 * 1.05 + p3 * 1.15);
  const n = m.players.length, perRow = Math.max(1, Math.floor((hd.w - 24) / (fs * 9.6))), chipW = (innerW - (perRow - 1) * 8) / Math.min(perRow, n);
  const cy0 = hd.y + 12 + p1 * 1.05 + p3 * 1.15 + 10, chipH = fs * 1.75;
  m.players.forEach((p, i) => {
    const row = Math.floor(i / perRow), col = i % perRow, x = x0 + col * (chipW + 8), y = cy0 + row * (chipH + 6);
    const cur = i === m.cur && !state.holeEnd;
    roundPath(ctx, x, y, chipW, chipH, chipH / 2); ctx.fillStyle = cur ? 'rgba(220,171,74,0.25)' : 'rgba(255,255,255,0.07)'; ctx.fill();
    ctx.strokeStyle = cur ? '#dcab4a' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = cur ? 3 : 1.5; ctx.stroke();
    const bc = BALL_COLORS[i % 4], br = chipH * 0.3;
    const rg = ctx.createRadialGradient(x + chipH / 2 - br * 0.3, y + chipH / 2 - br * 0.3, br * 0.1, x + chipH / 2, y + chipH / 2, br);
    rg.addColorStop(0, '#fff'); rg.addColorStop(0.35, bc.base); rg.addColorStop(1, bc.dark);
    ctx.beginPath(); ctx.arc(x + chipH / 2, y + chipH / 2, br, 0, TAU); ctx.fillStyle = rg; ctx.fill();
    const b = state.balls[i], strokes = b ? b.strokes : 0, done = b && b.done;
    ctx.textAlign = 'left'; ctx.fillStyle = '#f8edd0';
    const avail = chipW - chipH - 10 - fs * 3.2;
    fitText(ctx, p.name, Math.max(40, avail), Math.round(fs * 0.84));
    ctx.fillText(p.name, x + chipH + 2, y + chipH / 2 + fs * 0.3);
    ctx.textAlign = 'right'; ctx.font = `700 ${Math.round(fs * 0.86)}px ${FONT}`;
    ctx.fillStyle = done ? '#b9e29a' : '#f8edd0';
    const solo = n === 1;
    ctx.fillText(`${strokes}${done ? '✓' : ''}`, x + chipW - (solo ? 12 : fs * 1.5), y + chipH / 2 + fs * 0.3);
    if (!solo) { ctx.fillStyle = '#e9c273'; ctx.font = `600 ${Math.round(fs * 0.78)}px ${FONT}`; ctx.fillText(`${m.wins[i]}`, x + chipW - 12, y + chipH / 2 + fs * 0.3); }
  });
}

// ---- power meter -------------------------------------------------------------------------------------------------------
export function meterRect(lay) {
  const s = lay.sheet, fs = Math.round(Math.min(lay.fs, 34));
  const w = Math.min(s.w - 28, 600), h = Math.round(fs * 1.45);
  return { x: s.x + (s.w - w) / 2, y: s.y + s.h - h - 14, w, h, fs };
}
export function drawMeter(ctx, state, lay) {
  const r = meterRect(lay), a = state.aim, sw = state.sw;
  const p = state.phase === 'swing' || state.phase === 'strike' ? sw.p : a.pow;
  const bar = { x: r.x + 10, y: r.y + r.h * 0.5 - 2, w: r.w - 20, h: Math.max(10, r.h * 0.34) };
  ctx.save();
  plaque(ctx, r.x, r.y, r.w, r.h, { r: r.h / 2, studs: false });
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#f8edd0'; ctx.font = `700 ${Math.round(r.fs * 0.62)}px ${FONT}`;
  const dist = state.distToPost != null ? `Post ${Math.round(state.distToPost)} m` : '';
  ctx.fillText(`Power ${Math.round(p * 100)}%`, r.x + 18, r.y + r.h * 0.42);
  ctx.textAlign = 'right'; ctx.fillStyle = '#e9c273'; ctx.fillText(dist, r.x + r.w - 18, r.y + r.h * 0.42);
  roundPath(ctx, bar.x, bar.y + 4, bar.w, bar.h - 4, (bar.h - 4) / 2); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
  const fw = Math.max(0, bar.w * p);
  if (fw > 2) {
    ctx.save(); roundPath(ctx, bar.x, bar.y + 4, bar.w, bar.h - 4, (bar.h - 4) / 2); ctx.clip();
    const g = ctx.createLinearGradient(bar.x, 0, bar.x + bar.w, 0);
    g.addColorStop(0, '#6aa0cf'); g.addColorStop(0.6, '#e0b85a'); g.addColorStop(1, '#c4492f');
    ctx.fillStyle = g; ctx.fillRect(bar.x, bar.y + 4, fw, bar.h - 4); ctx.restore();
  }
  // ticks every 10 %
  ctx.strokeStyle = 'rgba(255,240,200,0.35)'; ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) { const x = bar.x + (bar.w * i) / 10; ctx.beginPath(); ctx.moveTo(x, bar.y + bar.h - 5); ctx.lineTo(x, bar.y + bar.h + 1); ctx.stroke(); }
  // the power that just reaches the post along the aim line, and the Think suggestion
  const mark = (v, col, label) => {
    if (v == null || v <= 0 || v > 1) return;
    const x = bar.x + bar.w * v;
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, bar.y + 1); ctx.lineTo(x - 7, bar.y - 9); ctx.lineTo(x + 7, bar.y - 9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    void label;
  };
  if (state.settings.guide !== 2 && a.placed) mark(state.reachPow, '#f1e6c8', 'post');
  if (state.hintPow != null && state.phase === 'aim') mark(state.hintPow, '#9fd68a', 'think');
  ctx.restore();
}

// ---- cards -------------------------------------------------------------------------------------------------------------
export function cardRectFor(state, lay) {
  const fs = Math.round(Math.min(lay.fs, 38) * 0.9);
  if (lay.land && lay.zone.h > fs * 6) { const w = lay.zone.w - 24; return { x: lay.zone.x + 12, y: lay.zone.y + 8, w, h: Math.min(lay.zone.h - 16, fs * 6.8), fs, side: true }; }
  const w = Math.min(lay.sheet.w - 24, 640), mr = meterRect(lay);
  const lift = state.m && state.m.cfg.mode === 'watch' ? Math.round(34 * lay.s) : 0;
  const h = fs * 5.4, bottom = (controlKindNeedsMeter(state) ? mr.y - 8 : lay.sheet.y + lay.sheet.h - 12 - lift);
  return { x: lay.sheet.x + (lay.sheet.w - w) / 2, y: bottom - h, w, h, fs };
}
const controlKindNeedsMeter = (state) => controlKind(state) === 'aim';
export function drawCard(ctx, state, lay) {
  const k = state.card ?? tipCard(state, lay);
  if (!k) return;
  const r = cardRectFor(state, lay);
  if (r.side && !state.card) { ctx.font = `400 ${Math.round(r.fs * 0.8)}px ${FONT}`; const n = wrapLines(ctx, k.text, r.w - 32).length; r.h = Math.min(r.h, r.fs * 2.7 + n * r.fs * 0.95 + 8); }
  panel(ctx, r.x, r.y, r.w, r.h, { r: 16, fill: 'rgba(247,239,215,0.97)', stroke: 'rgba(125,42,28,0.7)' });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${r.fs}px ${SERIF}`; ctx.fillText(k.title, r.x + 16, r.y + r.fs * 1.3);
  ctx.fillStyle = C.ink; ctx.font = `400 ${Math.round(r.fs * 0.8)}px ${FONT}`;
  const all = wrapLines(ctx, k.text, r.w - 32), maxL = Math.max(2, Math.floor((r.h - r.fs * 2.7) / (r.fs * 0.95)));
  all.slice(0, maxL).forEach((l, i) => ctx.fillText(l + (i === maxL - 1 && all.length > maxL ? '…' : ''), r.x + 16, r.y + r.fs * 2.35 + i * r.fs * 0.95));
  if (state.card) { ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(60,40,20,0.6)'; ctx.font = `600 ${Math.round(r.fs * 0.6)}px ${FONT}`; ctx.fillText('tap for more', r.x + r.w - 14, r.y + r.h - 8); }
}
function tipCard(state, lay) {
  if (!lay.land || state.holeEnd || lay.zone.h < lay.fs * 7) return null;
  return { title: 'Court tip', text: state.court.tip };
}

// ---- toast, pops, end of leg -----------------------------------------------------------------------------------------
export function drawToast(ctx, state, lay) {
  if (!(state.toastT > 0 && state.toast)) return;
  ctx.save();
  const fs = Math.max(FLOOR, Math.round(Math.min(lay.fs, 36) * 0.85)); ctx.font = `700 ${fs}px ${FONT}`;
  const maxW = Math.min(lay.sheet.w - 24, 640), lines = wrapLines(ctx, state.toast, maxW - 40), tw = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40), th = lines.length * fs * 1.25 + 20;
  const x = lay.sheet.x + (lay.sheet.w - tw) / 2, y = lay.sheet.y + 10;
  ctx.globalAlpha = Math.min(1, state.toastT * 2);
  roundPath(ctx, x, y, tw, th, 14); ctx.fillStyle = 'rgba(36,26,16,0.92)'; ctx.fill(); ctx.strokeStyle = 'rgba(201,153,58,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#f8edd0'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, x + tw / 2, y + 10 + fs * (0.95 + i * 1.25)));
  ctx.restore();
}
export function drawPops(ctx, state, cam) {
  for (const p of state.pops) {
    const q = cam.p(p.x, p.y, p.z || 1.6); if (!q) continue;
    const k = p.t / p.max, sc = k < 0.15 ? 0.6 + k * 2.6 : 1;
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2.2); ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(p.size * sc)}px ${SERIF}`;
    textShadow(ctx, p.text, q[0], q[1] - k * 50, p.col, 6); ctx.restore();
  }
}
export function drawLegEnd(ctx, state, lay) {
  if (!state.holeEnd) return;
  const m = state.m, he = state.holeEnd, leg = m.legs[m.idx], c = state.court;
  const s = Math.min(1, he.t * 3.2), ease = 1 - Math.pow(1 - s, 3);
  const fs = Math.round(Math.min(lay.fs, 40));
  const w = Math.min(lay.sheet.w - 24, 620), rows = m.players.length;
  const h = fs * 2.8 + rows * fs * 1.45 + 24, x = lay.sheet.x + (lay.sheet.w - w) / 2, y = lay.sheet.y + Math.max(8, (lay.sheet.h - h) / 2 - 20);
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(0.8 + 0.2 * ease, 0.8 + 0.2 * ease); ctx.globalAlpha = ease; ctx.translate(-(x + w / 2), -(y + h / 2));
  panel(ctx, x, y, w, h, { r: 24, fill: 'rgba(247,239,215,0.98)', stroke: 'rgba(125,42,28,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; fitText(ctx, he.title, w - 40, Math.round(fs * 1.4), 700, SERIF);
  ctx.fillText(he.title, x + w / 2, y + fs * 1.5);
  ctx.fillStyle = C.ink; ctx.font = `500 ${Math.round(fs * 0.72)}px ${FONT}`; ctx.fillText(`${c.name}${leg.dir ? ', back' : ', out'} · Par ${leg.par}`, x + w / 2, y + fs * 2.3);
  m.players.forEach((p, i) => {
    const yy = y + fs * 2.9 + i * fs * 1.45, res = he.results[i], bc = BALL_COLORS[i % 4];
    ctx.beginPath(); ctx.arc(x + 34, yy - fs * 0.3, fs * 0.42, 0, TAU); ctx.fillStyle = bc.mid; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = `700 ${Math.round(fs * 0.85)}px ${FONT}`; ctx.fillText(p.name, x + 34 + fs * 0.7, yy);
    ctx.textAlign = 'right'; ctx.fillText(`${res.out ? '–' : res.strokes}  ${res.name}`, x + w - 24, yy);
    if (i === he.lead) { ctx.fillStyle = '#c47d12'; ctx.fillText('★', x + w - 24 - ctx.measureText(`${res.out ? '–' : res.strokes}  ${res.name}`).width - 10, yy); }
  });
  ctx.restore();
}

// ---- controls ------------------------------------------------------------------------------------------------------------
export function drawControls(ctx, state, lay) {
  const kind = controlKind(state), ids = [].concat(...rowsFor(kind)(lay.land, lay.s));
  const sc = lay.s;
  for (const id of ids) {
    const r = lay.ctrl[id]; if (!r) continue;
    const disabled = (id === 'think' && (state.hintBusy || state.phase !== 'aim')) || ((id === 'left' || id === 'right') && state.phase !== 'aim');
    drawButton(ctx, r, controlLabel(id, state), {
      primary: id === 'swing' || id === 'next', active: (id === 'pause' && state.paused) || (id === 'fast' && state.ff) || (id === 'swing' && state.phase === 'swing'),
      dark: id === 'menu' || id === 'exit' || id === 'left' || id === 'right', disabled, size: id === 'left' || id === 'right' ? Math.round(30 * sc) : Math.round(26 * sc),
    });
  }
  if (kind === 'watch' || kind === 'watchNext') {
    const first = lay.ctrl.pause;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const label = state.wlabel || 'Watch & Learn';
    fitText(ctx, label, lay.box.w - 30, Math.round(24 * sc));
    textShadow(ctx, label, lay.box.x + lay.box.w / 2, first.y - 12, '#e9c273', 5);
    ctx.restore();
  }
}
export { BR, V_MIN, V_MAX };
