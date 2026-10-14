// Drawing of the play screen and the table behind the menus. Pure drawing of `state` (game.js owns it).
import { W, H, TEXT_SCALES, playLayout, chipRect, host } from './layout.js';
import { FLOOR, R, DESIGNS, COVER, scatterRadius } from './sim.js';
import { drawFloor, drawDisc, drawDots, TEAM } from './art.js';
import { FONT, C, roundPath, drawButton, paintButton, wrapLines, textShadow } from './ui.js';
import { PROFILES } from './ai.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
export const BG_TOP = '#141a3a', BG_BOT = '#0b0f26';

export function layoutOf(state) {
  const m = state.m;
  return playLayout(TEXT_SCALES[state.settings.textIdx], !!m && m.cfg.mode === 'watch', m ? m.cfg.hand : 5);
}

export function drawBackdrop(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, BG_TOP); g.addColorStop(1, BG_BOT);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 12; y < H; y += 44) for (let x = ((y / 44) % 2) * 22; x < W; x += 44) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill(); }
}

// Portrait: whatever the floor leaves free (above and below it on a tall phone, left and right of it on a tablet) is the same wooden table, dimmed,
// running edge to edge between the score cards and the hand tray (no empty navy bands around the floor).
export function drawSurround(ctx, L) {
  if (L.land || !L.floor || !L.tray) return;
  const y1 = L.info.y + L.info.h + 4, y2 = L.tray.rect.y - 4, F = L.floor;
  if (y2 - y1 < 40 || (F.x < 12 && F.y - y1 < 12 && y2 - (F.y + F.size) < 12)) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, y1, W, y2 - y1); ctx.clip();
  const ph = 58;
  for (let y = y1 - ((y1 - 0) % ph), i = 0; y < y2; y += ph, i++) {
    const t = ((i * 37) % 7) / 7, g = ctx.createLinearGradient(0, y, 0, y + ph);
    g.addColorStop(0, `hsl(${26 + t * 6},${40 + t * 6}%,${26 + t * 4}%)`); g.addColorStop(1, `hsl(${24 + t * 6},${38 + t * 6}%,${20 + t * 4}%)`);
    ctx.fillStyle = g; ctx.fillRect(0, y, W, ph + 1);
    ctx.strokeStyle = 'rgba(20,8,2,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,150,0.10)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, y + 3); ctx.lineTo(W, y + 3); ctx.stroke();
    const jx = ((i * 211) % 420) + 90; ctx.strokeStyle = 'rgba(20,8,2,0.5)'; ctx.beginPath(); ctx.moveTo(jx, y); ctx.lineTo(jx, y + ph); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,26,6,0.16)'; ctx.lineWidth = 0.9;
    for (let j = 0; j < 3; j++) { const yy = y + 10 + ((i * 31 + j * 19) % (ph - 20)); ctx.beginPath(); ctx.moveTo(0, yy); ctx.bezierCurveTo(W * 0.3, yy + 2, W * 0.7, yy - 2, W, yy + 1); ctx.stroke(); }
  }
  // dim it so the lit floor stays the subject, and fade into the navy at both ends
  ctx.fillStyle = 'rgba(8,10,28,0.42)'; ctx.fillRect(0, y1, W, y2 - y1);
  const fade = Math.min(34, (y2 - y1) / 3);
  let g = ctx.createLinearGradient(0, y1, 0, y1 + fade); g.addColorStop(0, 'rgba(14,18,44,1)'); g.addColorStop(1, 'rgba(14,18,44,0)'); ctx.fillStyle = g; ctx.fillRect(0, y1, W, fade);
  g = ctx.createLinearGradient(0, y2 - fade, 0, y2); g.addColorStop(0, 'rgba(11,15,38,0)'); g.addColorStop(1, 'rgba(11,15,38,1)'); ctx.fillStyle = g; ctx.fillRect(0, y2 - fade, W, fade);
  ctx.restore();
}

// ---- world-space effects --------------------------------------------------------------------------------------------
function drawParts(ctx, parts) {
  for (const q of parts) {
    const k = 1 - q.t / q.max;
    if (k <= 0) continue;
    ctx.save();
    if (q.kind === 0) { ctx.globalAlpha = k; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + 0.5 * k), 0, TAU); ctx.fill(); }
    else if (q.kind === 1) { // gust ring
      const e = 1 - k;
      ctx.globalAlpha = k * 0.75; ctx.strokeStyle = q.col; ctx.lineWidth = 3 + 7 * k;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.15 + 0.85 * (1 - Math.pow(1 - e, 2))), 0, TAU); ctx.stroke();
    } else if (q.kind === 2) { // streak (air)
      ctx.globalAlpha = k * 0.8; ctx.strokeStyle = q.col; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      const a = Math.atan2(q.vy, q.vx), l = 12 + 10 * k;
      ctx.beginPath(); ctx.moveTo(q.x - Math.cos(a) * l, q.y - Math.sin(a) * l); ctx.lineTo(q.x, q.y); ctx.stroke();
    } else if (q.kind === 3) { // star sparkle
      ctx.globalAlpha = k; ctx.fillStyle = q.col; ctx.translate(q.x, q.y); ctx.rotate(q.t * 6);
      const s = q.size * (0.4 + 0.6 * k);
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.35 : s, a = (i / 8) * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

function chance(ctx, x, y, p, cover) {
  const t = `${Math.round(p * 100)}%`;
  ctx.save();
  ctx.font = `700 22px ${FONT}`;
  const w = ctx.measureText(t).width + 18, h = 30;
  const col = p >= 0.66 ? '#58d68d' : p >= 0.33 ? '#f4c542' : '#ff8a6a';
  roundPath(ctx, x - w / 2, y - h / 2, w, h, 15); ctx.fillStyle = 'rgba(10,12,34,0.88)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + 1);
  void cover;
  ctx.restore();
}

// The world: floor, discs at rest, discs in the act, aim overlay, effects. `o.x,o.y,o.size` = where the floor lands.
export function drawTable(ctx, state, floorObj, parts, o = {}) {
  const size = o.size ?? Math.min(W, H) * 0.9, x0 = o.x ?? (W - size) / 2, y0 = o.y ?? (H - size) / 2, k = size / FLOOR;
  ctx.save();
  ctx.translate(x0, y0); ctx.scale(k, k);
  if (o.frame === false) drawFloor(ctx, 0, 0, FLOOR);
  else {
    roundPath(ctx, -14, -14, FLOOR + 28, FLOOR + 28, 18); ctx.fillStyle = '#2a1608'; ctx.fill();
    roundPath(ctx, -14, -14, FLOOR + 28, FLOOR + 28, 18); ctx.strokeStyle = 'rgba(255,214,140,0.35)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); roundPath(ctx, -6, -6, FLOOR + 12, FLOOR + 12, 12); ctx.clip();
    drawFloor(ctx, 0, 0, FLOOR);
    ctx.restore();
  }
  const act = o.act;
  const hide = new Set();
  const cards = floorObj.cards;
  // discs at rest, drawn in a stable order (top of the floor first so lower discs overlap nothing anyway)
  for (const c of cards) {
    if (hide.has(c.id)) continue;
    let glow = 0, lift = 0;
    if (o.pulse && o.pulse.id === c.id) { glow = o.pulse.v; }
    if (c.pop > 0) lift = Math.sin((1 - c.pop / 0.3) * Math.PI) * 0.5;
    drawDisc(ctx, c.x, c.y, c.d, c.side, { spin: c.spin, glow, lift });
  }
  if (act) drawAct(ctx, act, o.target);
  drawParts(ctx, parts);
  if (o.overlay) o.overlay(ctx);
  ctx.restore();
}

// Discs in the middle of a turn: the slam in flight, the flipped discs spinning over and flying to the pile, the cover.
function drawAct(ctx, a, target) {
  const e3 = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  if (a.phase === 'fly' && a.out === null) {
    const k = Math.min(1, a.t / a.flyDur), e = k * k;
    const sx = a.to.x - 60, sy = a.to.y + 200;
    drawDisc(ctx, sx + (a.to.x - sx) * e, sy + (a.to.y - sy) * e, a.d, a.side, { spin: a.spin, lift: 1.6 * (1 - e) + 0.05, r: R });
  }
  if (!a.out) return;
  if (a.out.kind === 'slam' && a.out.cover) {
    const k = a.t - a.impactAt;
    const c = a.out.cover;
    const lift = k < 0.25 ? 0.5 * Math.sin((k / 0.25) * Math.PI) : 0;
    const out = Math.max(0, (k - 0.9) / 0.6);
    const tx = target ? target[1 - a.side].x : a.out.land.x, ty = target ? target[1 - a.side].y : a.out.land.y;
    const ex = a.out.land.x + (tx - a.out.land.x) * e3(out), ey = a.out.land.y + (ty - a.out.land.y) * e3(out);
    drawDisc(ctx, ex, ey, a.d, a.side, { spin: a.spin, lift: lift + out * 0.8, a: 1 - Math.max(0, out - 0.7) * 3, r: R * (1 - out * 0.4) });
    void c;
  }
  for (const f of a.out.flips || []) {
    const k = a.t - a.impactAt - f.delay;
    if (k < 0) { drawDisc(ctx, f.card.x, f.card.y, f.card.d, f.card.side, { spin: f.card.spin }); continue; }
    const flipT = Math.min(1, k / 0.75), fly = Math.max(0, (k - 0.95) / 0.6);
    const lift = Math.sin(Math.min(1, k / 0.9) * Math.PI) * 0.9 + fly * 0.5;
    const tx = target ? target[a.side].x : f.card.x, ty = target ? target[a.side].y : f.card.y;
    const x = f.card.x + (tx - f.card.x) * e3(fly) * 1, y = f.card.y + (ty - f.card.y) * e3(fly);
    drawDisc(ctx, x, y, f.card.d, f.card.side, { spin: f.card.spin + flipT * 3.0, flip: Math.min(1, flipT * 1.0), lift, a: 1 - Math.max(0, fly - 0.75) * 4, r: R * (1 - fly * 0.45) });
  }
}

// ---- play screen ------------------------------------------------------------------------------------------------------
function nameOf(state, side) {
  const m = state.m;
  if (m.cfg.mode === 'two') return side === 0 ? 'Player 1' : 'Player 2';
  if (m.cfg.mode === 'watch') return PROFILES[side === 0 ? m.cfg.watchA : m.cfg.opp].name;
  return side === 0 ? 'You' : PROFILES[m.cfg.opp].name;
}
export { nameOf };

function scoreCard(ctx, state, L, i) {
  const m = state.m, r = L.cards[i], on = m.turn === i && !m.over, fs = L.fs, t = TEAM[i];
  if (v3.on) v3.panels.push({ r, rad: 18, kind: on ? 'plateOn' : 'plate', team: i });
  else {
    roundPath(ctx, r.x, r.y, r.w, r.h, 18);
    ctx.fillStyle = on ? 'rgba(250,244,226,0.97)' : 'rgba(20,26,58,0.82)'; ctx.fill();
    ctx.lineWidth = on ? 4 : 2; ctx.strokeStyle = on ? t.rim : 'rgba(255,255,255,0.18)'; ctx.stroke();
  }
  const ink = on ? C.ink : '#e8ecff';
  const dr = Math.min(r.h * 0.36, 30);
  drawDisc(ctx, r.x + 14 + dr, r.y + r.h / 2, i === 0 ? 0 : 3, i, { r: dr, noPips: true });
  const tx = r.x + 26 + dr * 2;
  // score block on the right: star and number
  const num = String(m.score[i]);
  ctx.font = `700 ${fs.score}px ${FONT}`;
  const nw = ctx.measureText(num).width, sw = fs.score * 0.55;
  const blockW = nw + sw + 8;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = on ? t.dark : '#ffe08a';
  ctx.fillText(num, r.x + r.w - 14 - nw, r.y + r.h / 2 + 1);
  ctx.font = `700 ${Math.round(fs.score * 0.6)}px ${FONT}`;
  ctx.fillStyle = on ? '#d49a12' : '#ffd35a';
  ctx.fillText('★', r.x + r.w - 14 - nw - sw - 4, r.y + r.h / 2 + 1);
  // name and hand line
  let name = nameOf(state, i);
  ctx.font = `700 ${fs.name}px ${FONT}`;
  const maxW = r.w - (tx - r.x) - blockW - 24;
  while (ctx.measureText(name).width > maxW && name.length > 3) name = name.slice(0, -2);
  const two = r.h >= fs.name * 1.2 + fs.sub * 1.2 + 14;
  ctx.fillStyle = ink;
  ctx.fillText(name, tx, two ? r.y + r.h / 2 - fs.sub * 0.62 : r.y + r.h / 2);
  if (two) {
    ctx.font = `400 ${fs.sub}px ${FONT}`; ctx.fillStyle = on ? 'rgba(31,37,64,0.75)' : 'rgba(232,236,255,0.7)';
    ctx.fillText(`${m.hands[i].length} left · won ${m.piles[i].length}`, tx, r.y + r.h / 2 + fs.name * 0.7);
  }
  ctx.textBaseline = 'alphabetic';
}

function infoLine(ctx, state, L) {
  const r = L.info, fs = L.fs;
  const text = state.toastT > 0 ? state.toast : defaultInfo(state);
  if (v3.on && text) v3.panels.push({ r: { x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 4 }, rad: 16, kind: 'toast' });
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // shrink (never below ~11 css px) until the sentence fits its two lines, instead of cutting it off
  const floorPx = host.px > 0 ? Math.ceil(11 / host.px) : 18;
  let fi = fs.info, lines;
  for (;;) {
    ctx.font = `700 ${fi}px ${FONT}`; lines = wrapLines(ctx, text, r.w - 16);
    if (lines.length <= 2 || fi <= floorPx) break;
    fi = Math.max(floorPx, fi - 2);
  }
  lines = lines.slice(0, 2);
  const lh = fi * 1.2, y0 = r.y + r.h / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((l, k) => { ctx.fillStyle = 'rgba(8,10,28,0.9)'; ctx.fillText(l, r.x + r.w / 2 + 1, y0 + k * lh + 2); ctx.fillStyle = state.toastT > 0 ? '#ffe9a0' : '#e8ecff'; ctx.fillText(l, r.x + r.w / 2, y0 + k * lh); });
  ctx.restore();
}
function defaultInfo(state) {
  const m = state.m;
  if (m.over) return 'Match over';
  if (state.act) return '';
  const side = m.turn;
  if (m.cfg.mode === 'watch') return `${nameOf(state, side)} is thinking…`;
  if (!state.humanTurn) return `${nameOf(state, side)} is thinking…`;
  const lay = state.kind === 'lay';
  return lay ? 'Your turn: pick a disc and a spot to lay it' : 'Your turn: pick a disc, aim beside a rival, set the strength';
}

function slider(ctx, state, L) {
  const tr = L.track, fs = L.fs, p = state.aim.power, m = state.m;
  const ok = state.humanTurn && state.kind === 'slam' && !state.act && !state.paused;
  if (v3.on) v3.panels.push({ r: L.slider, rad: 16, kind: 'toast' });
  ctx.save();
  ctx.globalAlpha = ok ? 1 : 0.45;
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fs.label}px ${FONT}`; ctx.textAlign = 'left';
  ctx.fillStyle = '#e8ecff';
  const hi = state.aim.hi, d = m.hands[m.turn][hi];
  const w = d !== undefined ? DESIGNS[d].w : 3, sc = Math.round(scatterRadius(p, w));
  const a1 = `Strength ${Math.round(p * 100)}%`, a2 = `Gust ${p < 0.45 ? 'light' : p < 0.75 ? 'good' : 'strong'} · scatter ±${sc}`;
  ctx.fillText(a1, L.slider.x + 4, tr.labelY);
  ctx.font = `700 ${fs.label}px ${FONT}`; const w1 = ctx.measureText(a1).width;
  ctx.font = `400 ${fs.label}px ${FONT}`; const w2 = ctx.measureText(a2).width;
  if (w1 + w2 + 24 < L.slider.w) { ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(232,236,255,0.78)'; ctx.fillText(a2, L.slider.x + L.slider.w - 4, tr.labelY); }
  roundPath(ctx, tr.x0 - 8, tr.y - 8, tr.x1 - tr.x0 + 16, 16, 8); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
  const kx = tr.x0 + (tr.x1 - tr.x0) * ((p - 0.2) / 0.8);
  roundPath(ctx, tr.x0 - 8, tr.y - 8, kx - tr.x0 + 8, 16, 8);
  const g = ctx.createLinearGradient(tr.x0, 0, tr.x1, 0); g.addColorStop(0, '#58d68d'); g.addColorStop(0.6, '#f4c542'); g.addColorStop(1, '#ff6a4a');
  ctx.fillStyle = g; ctx.fill();
  for (let i = 0; i <= 4; i++) { const x = tr.x0 + (tr.x1 - tr.x0) * (i / 4); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 1, tr.y - 14, 2, 6); }
  ctx.beginPath(); ctx.arc(kx, tr.y, 21, 0, TAU); ctx.fillStyle = '#fff8e6'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#c93a2c'; ctx.stroke();
  ctx.restore();
}

function tray(ctx, state, L) {
  const m = state.m, hand = m.hands[m.turn], T = L.tray;
  const ok = state.humanTurn && !state.act && !state.paused && !state.pass;
  if (v3.on) { const t = T.rect, p = 4; v3.panels.push({ r: { x: t.x - p, y: t.y - p, w: t.w + 2 * p, h: t.h + 2 * p }, rad: 18, kind: 'felt' }); }
  for (let i = 0; i < m.cfg.hand; i++) {
    const r = chipRect(L, i), has = i < hand.length, sel = has && state.aim.hi === i && ok;
    if (v3.on) { if (has) v3.panels.push({ r, rad: 14, kind: sel ? 'chipOn' : 'chip' }); }
    else {
      roundPath(ctx, r.x, r.y, r.w, r.h, 16);
      ctx.fillStyle = has ? (state.aim.hi === i && ok ? 'rgba(255,224,138,0.22)' : 'rgba(20,26,58,0.8)') : 'rgba(255,255,255,0.05)'; ctx.fill();
      ctx.lineWidth = has && state.aim.hi === i && ok ? 4 : 1.5; ctx.strokeStyle = has && state.aim.hi === i && ok ? '#ffd35a' : 'rgba(255,255,255,0.2)'; ctx.stroke();
    }
    if (!has) continue;
    ctx.save(); ctx.globalAlpha = ok ? 1 : 0.55;
    drawDisc(ctx, r.x + r.w / 2, r.y + r.h * 0.43, hand[i], m.turn, { r: r.w * 0.34 });
    drawDots(ctx, r.x + r.w / 2, r.y + r.h - 12, DESIGNS[hand[i]].w, Math.max(2.4, r.w * 0.04), '#e8ecff');
    ctx.restore();
  }
}

export function renderPlay(ctx, state) {
  const m = state.m, L = layoutOf(state), watch = m.cfg.mode === 'watch';
  const F = L.floor;
  const act = state.act;
  if (v3.on) { ctx.clearRect(0, 0, W, H); }
  else { drawBackdrop(ctx); drawSurround(ctx, L); }
  // targets for the flying discs: the middle of each side's score card, in world units
  const target = L.cards.map((r) => ({ x: (r.x + r.w / 2 - F.x) / F.s, y: (r.y + r.h / 2 - F.y) / F.s }));
  if (v3.on) aimChips(ctx, state);
  else {
    drawTable(ctx, state, m.floor, state.parts, {
      x: F.x, y: F.y, size: F.size, act, target, pulse: state.pulse,
      overlay: (c) => aimOverlay(c, state, L),
    });
  }
  for (let i = 0; i < 2; i++) scoreCard(ctx, state, L, i);
  infoLine(ctx, state, L);
  // pops (score text) in world units
  for (const p of state.pops) {
    const k = p.t / p.max;
    const pj = v3.on && v3.proj ? v3.proj(p.x, p.y - 30 * k, 0.5) : null, ps = v3.on && v3.scale ? v3.scale(p.x, p.y) : F.s;
    const x = pj ? pj.x : F.x + p.x * F.s, y = pj ? pj.y : F.y + (p.y - 30 * k) * F.s;
    F.s0 = ps;
    ctx.save(); ctx.globalAlpha = 1 - Math.pow(k, 3); ctx.font = `700 ${Math.round(p.size * Math.max(0.8, ps))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(10,12,34,0.9)'; ctx.strokeText(p.text, x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, x, y); ctx.restore();
  }
  if (watch) {
    const D = L.demo;
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: L.fs.btn });
    drawButton(ctx, D.dec, 'Think −', { size: Math.round(L.fs.btn * 0.8) });
    drawButton(ctx, D.inc, 'Think +', { size: Math.round(L.fs.btn * 0.8) });
    drawButton(ctx, D.exit, 'Leave', { dark: true, size: Math.round(L.fs.btn * 0.9) });
  } else {
    const showPass = state.pass && !state.act;
    if (showPass) passCard(ctx, state, L);
    else {
      tray(ctx, state, L);
      slider(ctx, state, L);
      const B = L.btns, ok = state.humanTurn && !state.act && !state.paused;
      drawButton(ctx, B.hint, state.hintBusy ? 'Thinking…' : 'Hint', { disabled: !ok || state.hintBusy, size: Math.round(L.fs.btn * 0.85) });
      drawButton(ctx, B.main, state.kind === 'lay' ? 'Lay disc' : 'SLAM!', { primary: true, disabled: !ok, size: L.fs.btn });
      drawButton(ctx, B.menu, 'Menu', { dark: true, size: Math.round(L.fs.btn * 0.85) });
    }
  }
  if (state.paused && watch && !state.pauseMenu) {
    if (v3.on) v3.panels.push({ r: { x: F.x + F.size / 2 - 90, y: F.y + F.size / 2 - 28, w: 180, h: 56 }, rad: 20, kind: 'toast' });
    ctx.save(); ctx.font = `700 ${Math.round(L.fs.info * 1.2)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (!v3.on) { ctx.fillStyle = 'rgba(10,12,34,0.7)'; roundPath(ctx, F.x + F.size / 2 - 90, F.y + F.size / 2 - 28, 180, 56, 28); ctx.fill(); }
    ctx.fillStyle = '#ffe9a0'; ctx.fillText('Paused', F.x + F.size / 2, F.y + F.size / 2); ctx.restore();
  }
}

function passCard(ctx, state, L) {
  const B = L.tray.rect, S = L.btns.menu;
  const r = { x: L.slider ? L.tray.rect.x : 0, y: B.y, w: L.slider.w, h: S.y + S.h - B.y };
  if (v3.on) v3.panels.push({ r, rad: 20, kind: 'plateOn', team: state.m.turn });
  else {
    roundPath(ctx, r.x, r.y, r.w, r.h, 20); ctx.fillStyle = 'rgba(250,244,226,0.97)'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = TEAM[state.m.turn].rim; ctx.stroke();
  }
  ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fs = Math.round(L.fs.btn * 1.1);
  ctx.font = `700 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, `Pass the phone to ${nameOf(state, state.m.turn)}`, r.w - 30);
  lines.forEach((l, k) => ctx.fillText(l, r.x + r.w / 2, r.y + r.h * 0.38 + (k - (lines.length - 1) / 2) * fs * 1.2));
  ctx.font = `400 ${Math.round(fs * 0.7)}px ${FONT}`; ctx.fillStyle = 'rgba(31,37,64,0.7)';
  ctx.fillText('Tap anywhere on this card when ready', r.x + r.w / 2, r.y + r.h * 0.78);
}

// Is the aiming overlay shown right now? (shared with the 3D presenter, which draws the rings and the held disc itself)
export function aimVisible(state) {
  const m = state.m; if (!m) return false;
  if (!state.humanTurn && !(m.cfg.mode === 'watch' && state.think && state.think.phase !== 'think')) return false;
  if (state.act || state.paused && !state.pauseMenu && m.cfg.mode !== 'watch') return false;
  if (state.pass) return false;
  return m.hands[m.turn][state.aim.hi] !== undefined;
}
// 3D build: the rings live on the floor in the scene; the 2D layer only writes the odds chips and the cover warning where they are.
function aimChips(ctx, state) {
  if (!aimVisible(state) || state.kind !== 'slam') return;
  const m = state.m, side = m.turn, pv = state.preview, a = state.aim;
  if (!pv) return;
  for (const c of m.floor.cards) {
    if (c.side === side) continue;
    const p = pv.p.get(c.id) ?? 0, q = v3.proj(c.x, c.y, 0.15), sc = v3.scale(c.x, c.y);
    chance(ctx, q.x, q.y - R * sc - 22, p);
  }
  if (pv.pCover > 0.02) {
    const q = v3.proj(a.x, a.y, 0.1), sc = v3.scale(a.x, a.y), s = pv.s * sc;
    ctx.save(); ctx.font = `700 22px ${FONT}`; const t = `Cover risk ${Math.round(pv.pCover * 100)}%`, w = ctx.measureText(t).width + 18;
    const bx = Math.min(W - w / 2 - 6, Math.max(w / 2 + 6, q.x)), by = q.y + s + 26;
    v3.panels.push({ r: { x: bx - w / 2, y: by - 15, w, h: 30 }, rad: 14, kind: 'toast' });
    ctx.fillStyle = '#ff8a6a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, bx, by + 1); ctx.restore();
  }
}

// The aiming overlay, in world units: cover zones, the hint, the scatter circle, the ghost disc and the odds.
function aimOverlay(ctx, state, L) {
  const m = state.m;
  if (!state.humanTurn && !(m.cfg.mode === 'watch' && state.think && state.think.phase !== 'think')) return;
  if (state.act || state.paused && !state.pauseMenu && m.cfg.mode !== 'watch') return;
  if (state.pass) return;
  const side = m.turn, hand = m.hands[side], hi = state.aim.hi, d = hand[hi];
  if (d === undefined) return;
  const a = state.aim;
  if (state.kind === 'slam') {
    // cover zones (always on the rival discs): landing inside means your disc lands on top and is lost
    ctx.save();
    for (const c of m.floor.cards) {
      if (c.side === side) continue;
      ctx.setLineDash([7, 7]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,100,80,0.8)';
      ctx.beginPath(); ctx.arc(c.x, c.y, COVER * R, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    const pv = state.preview;
    // hint ghost
    if (state.hint && state.hint.kind === 'slam') {
      const h = state.hint;
      ctx.save(); ctx.strokeStyle = '#7ee8a8'; ctx.lineWidth = 4; ctx.setLineDash([3, 8]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(h.x, h.y, scatterRadius(h.power, DESIGNS[h.d].w), 0, TAU); ctx.stroke(); ctx.restore();
    }
    // scatter ring and ghost disc
    const s = pv ? pv.s : scatterRadius(a.power, DESIGNS[d].w);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(a.x, a.y, s, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]); ctx.stroke();
    ctx.restore();
    drawDisc(ctx, a.x, a.y, d, side, { ghost: true, a: 0.9, noPips: true });
    ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x - 9, a.y); ctx.lineTo(a.x + 9, a.y); ctx.moveTo(a.x, a.y - 9); ctx.lineTo(a.x, a.y + 9); ctx.stroke(); ctx.restore();
    if (pv) {
      for (const c of m.floor.cards) {
        if (c.side === side) continue;
        const p = pv.p.get(c.id) ?? 0;
        chance(ctx, c.x, c.y - R - 18, p);
      }
      if (pv.pCover > 0.02) {
        ctx.save(); ctx.font = `700 22px ${FONT}`; const t = `Cover risk ${Math.round(pv.pCover * 100)}%`, w = ctx.measureText(t).width + 18;
        const bx = Math.min(FLOOR - w / 2 - 6, Math.max(w / 2 + 6, a.x)), by = a.y + s + 24 < FLOOR - 20 ? a.y + s + 24 : a.y - s - 24;
        roundPath(ctx, bx - w / 2, by - 15, w, 30, 15); ctx.fillStyle = 'rgba(10,12,34,0.88)'; ctx.fill(); ctx.strokeStyle = '#ff8a6a'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#ff8a6a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, bx, by + 1); ctx.restore();
      }
    }
  } else {
    drawDisc(ctx, a.x, a.y, d, side, { ghost: true, a: 0.95 });
    if (state.layBad) {
      ctx.save(); ctx.strokeStyle = '#ff8a6a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(a.x, a.y, R + 4, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
}

export { paintButton, host };
