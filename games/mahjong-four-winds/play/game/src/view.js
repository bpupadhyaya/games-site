// The table: everything drawn during a hand. Reads state, changes nothing. Tiles are placed by the tween objects in
// `rs.vis` (game.js); art is cached sprites (tiles.js), so a frame is a few hundred drawImage calls.
import { W, H, GEO, BTN, CHIPS, AUTO_STEP, AUTO_THINK_STEPS, inRect, claimSlots, chowSlots, pillRect, hubRect, callPos, host } from './layout.js';
import { DISPLAY, UI, CJKF, GOLD, IVORY, INK, TAU, tx, txFit, wrap, rr, btn, panel, drawTable, drawTileAt, tileByKind, windGlyph } from './draw.js';
import { drawMoreLine } from './brand.js';
import { minUnits, setTextScale } from './draw.js';
import { kindOf, kindName, seatWind, windName, wallLeft, pointsFor, POINTS } from './rules.js';
import { LEVELS } from './ai.js';

export const NAMES = ['You', 'Mei', 'Lin', 'Jun'];
// During Auto Play nobody is "you" - seat 0 is just another computer seat, driven the same as the
// other three. Used only by the new Auto Play narration/labels; every pre-existing call site keeps
// using NAMES[p] directly (seat 0 is never the one narrated to during Auto Play through those).
export const seatName = (p, auto) => (auto && p === 0 ? 'Seat 1' : NAMES[p]);

export function claimRects(list) {
  const slots = claimSlots(list.length);
  return list.map((c, i) => ({ ...c, r: slots[i] }));
}

function header(ctx, S) {
  const m = S.match, h = S.h, wide = GEO.wide, maxW = wide ? GEO.panels.L.w - 4 : 540;
  // Auto Play shows its own "Auto Play - Watch & Learn" caption + think-time stepper (renderAutoHUD) - the normal
  // "Single Hand"/"East Round" label would collide with the stepper buttons in portrait, and is redundant with that caption.
  if (S.scene !== 'auto' || wide) {
    txFit(ctx, m.mode === 'round' ? `${windName(h.wind)} Round` : m.mode === 'auto' ? 'Auto Play' : 'Single Hand', GEO.headerX, GEO.headerY1, GEO.headerSize, GOLD, maxW, { font: DISPLAY, align: 'left', shadow: true });
    const sub = m.mode === 'round' ? `Hand ${m.hand} of 4${m.repeats ? ` (dealer stays x${m.repeats})` : ''}` : `${windName(h.wind)} wind`;
    if (S.scene !== 'auto') txFit(ctx, sub, GEO.headerX, GEO.headerY2, wide ? 17 : 22 * (S.prefs.big ? 1.1 : 1), 'rgba(247,239,214,0.8)', maxW, { align: 'left', min: 12 });
  }
  // menu button
  const r = BTN.menu, k = r.w / 76;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, r.x, r.y + 5, r.w, r.h, 22); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#7d4b28'); g.addColorStop(1, '#3a200d');
  ctx.fillStyle = g; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fill(); ctx.strokeStyle = 'rgba(241,207,122,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = GOLD; for (let i = 0; i < 3; i++) rr(ctx, r.x + 20 * k, r.y + (22 + i * 13) * k, 36 * k, 5, 2.5), ctx.fill();
}

function hub(ctx, S, pulse) {
  const h = S.h, { cx, cy, s } = hubRect(), z = (v, min) => Math.max(min, v * s);
  ctx.save();
  ctx.fillStyle = 'rgba(0,26,18,0.5)'; rr(ctx, cx - 96 * s, cy - 96 * s, 192 * s, 192 * s, 26 * s); ctx.fill();
  ctx.strokeStyle = 'rgba(241,207,122,0.4)'; ctx.lineWidth = 2; rr(ctx, cx - 96 * s, cy - 96 * s, 192 * s, 192 * s, 26 * s); ctx.stroke();
  windGlyph(ctx, h.wind, cx, cy - 40 * s, 30 * s);
  tx(ctx, 'ROUND WIND', cx, cy + 8 * s, z(12, 11), 'rgba(241,207,122,0.8)', { weight: 700 });
  tx(ctx, String(wallLeft(h)), cx, cy + 52 * s, z(46, 26), IVORY, { font: UI });
  tx(ctx, 'TILES LEFT', cx, cy + 74 * s, z(12, 11), 'rgba(247,239,214,0.6)');
  // whose turn: four lights just inside the wall
  const d = 100 * s, spots = [[cx, cy + d], [cx + d, cy], [cx, cy - d], [cx - d, cy]];
  spots.forEach(([x, y], p) => {
    const on = h.turn === p && S.ui.ph !== 'result';
    ctx.fillStyle = on ? `rgba(255,224,130,${0.7 + 0.3 * pulse})` : 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(x, y, on ? 6 : 4, 0, TAU); ctx.fill();
  });
  ctx.restore();
}

function plates(ctx, S, pulse) {
  const h = S.h, m = S.match;
  for (let p = 0; p < 4; p++) {
    const r = CHIPS[p], active = h.turn === p && S.ui.ph !== 'result' && S.ui.ph !== 'dealing';
    ctx.save();
    if (active) { ctx.fillStyle = `rgba(255,224,130,${0.18 + 0.16 * pulse})`; rr(ctx, r.x - 6, r.y - 6, r.w + 12, r.h + 12, 26); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; rr(ctx, r.x, r.y + 4, r.w, r.h, 22); ctx.fill();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, 'rgba(12,70,53,0.95)'); g.addColorStop(1, 'rgba(4,36,27,0.95)');
    ctx.fillStyle = g; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fill();
    ctx.strokeStyle = active ? GOLD : 'rgba(241,207,122,0.4)'; ctx.lineWidth = active ? 3 : 2; rr(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 21); ctx.stroke();
    windGlyph(ctx, seatWind(h, p), r.x + 32, r.y + r.h / 2, 21, { dealer: h.dealer === p });
    tx(ctx, seatName(p, S.scene === 'auto'), r.x + 62, r.y + r.h / 2 - 2, 24, IVORY, { align: 'left', font: DISPLAY, weight: 700 });
    const sc = m.scores[p];
    tx(ctx, (sc > 0 ? '+' : '') + sc, r.x + r.w - 16, r.y + r.h / 2 + 9, 27, sc > 0 ? '#9df0c4' : sc < 0 ? '#ffb1a6' : 'rgba(247,239,214,0.8)', { align: 'right', font: UI });
    if (p !== 0 || S.scene === 'auto') tx(ctx, ((nm) => { const mu = minUnits(); ctx.save(); ctx.font = `700 ${Math.max(27, mu)}px ${UI}`; const scoreW = ctx.measureText((sc > 0 ? '+' : '') + sc).width; ctx.font = `600 ${Math.max(12.5, mu)}px ${UI}`; const w = ctx.measureText(nm).width; ctx.restore(); return w + 62 + 16 + scoreW + 8 > r.w ? `Lv ${m.levels[p] + 1}` : nm; })(LEVELS[m.levels[p]].name), r.x + 62, r.y + r.h / 2 + 18, 12.5, 'rgba(247,239,214,0.65)', { align: 'left', weight: 600 });
    else tx(ctx, h.dealer === 0 ? 'dealer' : `${windName(seatWind(h, 0))} seat`, r.x + 62, r.y + r.h / 2 + 22, 14, 'rgba(247,239,214,0.7)', { align: 'left', weight: 600 });
    ctx.restore();
  }
}

export function renderTiles(ctx, S, rs) {
  const style = S.prefs.style, h = S.h, ui = S.ui;
  const list = [...rs.vis.values()].sort((a, b) => a.z - b.z);
  const lastTile = h.last ? h.last.tile : ui.lastDisc ?? -1, pulse = 0.5 + 0.5 * Math.sin(S.t * 5);
  const hintTile = ui.hint ? ui.hint.tile : ui.autoHint ? ui.autoHint.tile : -1;
  for (const v of list) {
    const kind = kindOf(v.id);
    const glow = v.id === lastTile && v.river ? 0.5 + 0.3 * pulse : v.id === hintTile ? 0.5 + 0.4 * pulse : 0;
    const w = v.w;
    if (v.wall) { drawTileAt(ctx, v.id, kind, v.x, v.y, w, v.rot, 0, style, { shadow: false }); continue; }
    if (v.id === ui.selId && ui.selId >= 0) { ctx.save(); ctx.fillStyle = 'rgba(255,224,130,0.28)'; ctx.beginPath(); ctx.ellipse(v.x, v.y + w * 0.9, w * 0.62, w * 0.16, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    drawTileAt(ctx, v.id, kind, v.x, v.y, w, v.rot, v.f, style, { lift: v.lift, glow });
  }
  // keyboard cursor
  if (S.kb && ui.ph === 'human' && rs.cursorPos) {
    const c = rs.cursorPos; ctx.save(); ctx.strokeStyle = GOLD; ctx.lineWidth = 3; rr(ctx, c.x - c.w / 2 - 3, c.y - c.w * 0.67 - 3, c.w + 6, c.w * 1.33 + 6, 8); ctx.stroke(); ctx.restore();
  }
}

// The one-line status ("Mei is thinking...", "Your turn...") that sits above the hand in portrait and in the status card in landscape.
function statusLine(S) {
  const ui = S.ui;
  if (ui.ph === 'ai') return { text: `${NAMES[S.h.turn]} is thinking...`, size: 24, always: true };
  if (ui.ph === 'auto-gate') return { text: `${seatName(S.h.turn, true)} is ${ui.auto.phase === 'think' ? 'thinking' : 'about to act'}...`, size: 24, always: true };
  if (ui.ph === 'human' && !ui.own?.win) return { text: ui.own?.lowWin ? 'Complete, but no scoring pattern yet.' : 'Your turn: tap a tile, tap it again to discard.', size: 22, always: false };
  return null;
}
const msgAlpha = (ui) => (ui.msg && ui.msg.text ? Math.min(1, ui.msg.hold - ui.msg.t) > 0 ? Math.min(1, (ui.msg.hold - ui.msg.t) * 2, ui.msg.t * 5 + 0.2) : 0 : 0);
function lineBreak(ctx, str, size, maxW, font = UI) {
  ctx.save(); ctx.font = `600 ${size}px ${font}`; const lines = []; let cur = '';
  for (const w of String(str).split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
  lines.push(cur); ctx.restore(); return lines;
}

// Landscape: messages and the status line live in a card on the left, under the Auto Play controls.
function statusCard(ctx, S) {
  const ui = S.ui, auto = S.scene === 'auto';
  const r = { ...GEO.status }; if (auto) { r.y = Math.max(r.y, GEO.hudBottom); r.h = BTN.hint.y - 8 - r.y; }
  if (r.h < 60) return;
  const a = msgAlpha(ui), sl = statusLine(S), warn = ui.msg?.warn;
  const text = a > 0 ? ui.msg.text : sl ? sl.text : '';
  if (!text) return;
  ctx.save(); ctx.globalAlpha = a > 0 ? a : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(241,207,122,0.45)'; ctx.lineWidth = 1.5; rr(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 17); ctx.stroke();
  const floor = minUnits();
  let size = Math.max(19 * (S.prefs.big ? 1.1 : 1), floor), lines = lineBreak(ctx, text, size, r.w - 24), lh = size * 1.28;
  while (lines.length * lh + 20 > r.h && size > floor) { size -= 1; lines = lineBreak(ctx, text, size, r.w - 24); lh = size * 1.28; }
  const maxLines = Math.max(1, Math.floor((r.h - 20) / lh)); if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '...'; }
  const y0 = r.y + (r.h - lines.length * lh) / 2 + size * 0.9;
  lines.forEach((ln, i) => tx(ctx, ln, r.x + r.w / 2, y0 + i * lh, size, warn && a > 0 ? '#ffd0c4' : IVORY, { weight: 600 }));
  ctx.restore();
}

export function renderPlay(ctx, S, rs) {
  drawTable(ctx, GEO.inlay);
  const ui = S.ui, pulse = 0.5 + 0.5 * Math.sin(S.t * 4), big = S.prefs.big ? 1.18 : 1, wide = GEO.wide;
  header(ctx, S);
  hub(ctx, S, pulse);
  plates(ctx, S, pulse);
  renderTiles(ctx, S, rs);

  const btns = (ui.ph === 'claim' && ui.claim && ui.claim.human) || (ui.ph === 'human' && ui.own && (ui.own.win || ui.own.kongs.length));
  // the message pill (portrait) / the status card (landscape)
  if (wide) statusCard(ctx, S);
  else if (ui.msg && ui.msg.text && !(ui.claim && ui.claim.chowPick)) {
    const a = msgAlpha(ui), fs = (GEO.pillBelow ? 25 : 22) * big;
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = `600 ${fs}px ${UI}`;
    const lines = lineBreak(ctx, ui.msg.text, fs, 620);
    if (((btns && lines.length > 2) || !GEO.pillBelow) && lines.length > 2) { lines.length = 2; lines[1] = lines[1].replace(/\s*\S*$/, '') + '...'; }
    const lh = (GEO.pillBelow ? 30 : 27) * big, bh = lines.length * lh + 20, pr = pillRect(btns, bh);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(ctx, pr.x, pr.y, pr.w, bh, 20); ctx.fill();
    ctx.strokeStyle = 'rgba(241,207,122,0.5)'; ctx.lineWidth = 1.5; rr(ctx, pr.x, pr.y, pr.w, bh, 20); ctx.stroke();
    lines.forEach((ln, i) => tx(ctx, ln, GEO.handCx, pr.y + 26 * (fs / 25) + i * lh, fs, ui.msg.warn ? '#ffd0c4' : IVORY, { weight: 600 }));
    ctx.restore();
  }

  // claim buttons, decision timer
  if (ui.ph === 'claim' && ui.claim && ui.claim.human) {
    const c = ui.claim, opts = claimList(c);
    if (c.timer > 0 && S.prefs.timer) {
      const f = Math.max(0, c.t / c.timer);
      const tb = wide ? { x: GEO.claimRect.x, y: claimRects(opts)[0].r.y - 16, w: GEO.claimRect.w } : { x: GEO.handCx - 320, y: GEO.timerY, w: 640 };
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; rr(ctx, tb.x, tb.y, tb.w, 10, 5); ctx.fill();
      ctx.fillStyle = f > 0.3 ? GOLD : '#ff8a70'; rr(ctx, tb.x, tb.y, Math.max(1, tb.w * f), 10, 5); ctx.fill();
    }
    if (c.chowPick) {
      const cs = chowSlots(c.chowPick.length);
      tx(ctx, 'Which chow?', cs.title.x, cs.title.y, 28, IVORY, { font: DISPLAY });
      c.chowPick.forEach((pair, i) => {
        const r = cs.picks[i];
        btn(ctx, r, '', { kind: 'jade', pressed: rs.ptr.down && inRect(r, rs.ptr.x, rs.ptr.y) });
        const ks = [kindOf(pair[0]), kindOf(c.tile), kindOf(pair[1])].sort((a, b) => a - b), tw = Math.min(40, r.w / 4.4);
        ks.forEach((k, j) => tileByKind(ctx, k, r.x + r.w / 2 + (j - 1) * tw * 1.15, r.y + r.h / 2 + 2, tw, S.prefs.style, { shadow: false }));
      });
      btn(ctx, cs.back, 'Back', { kind: 'wood', size: 28 });
    } else {
      for (const o of claimRects(opts)) btn(ctx, o.r, o.label, { kind: o.kind, size: wide ? 32 : 36, pulse: o.kind === 'gold' ? pulse : 0, pressed: rs.ptr.down && inRect(o.r, rs.ptr.x, rs.ptr.y), sub: S.kb ? o.key : null });
    }
  }
  if (ui.ph === 'human' && ui.own) {
    const opts = ownList(ui.own);
    if (opts.length) for (const o of claimRects(opts)) btn(ctx, o.r, o.label, { kind: o.kind, size: wide ? 32 : 36, pulse: o.kind === 'gold' ? pulse : 0, pressed: rs.ptr.down && inRect(o.r, rs.ptr.x, rs.ptr.y) });
  }
  // whose move (portrait: a line above the hand)
  if (!wide) {
    const sl = statusLine(S), hasMsg = ui.msg && ui.msg.text;
    if (sl && (GEO.pillBelow ? (sl.always || !hasMsg) : !hasMsg)) tx(ctx, sl.text, GEO.handCx, GEO.textY, sl.size * (sl.always ? 1 : big), sl.always ? 'rgba(247,239,214,0.75)' : 'rgba(247,239,214,0.78)', { weight: 600 });
  }

  // bottom bar
  const hb = BTN.hint, pb = BTN.pause, auto = S.scene === 'auto';
  btn(ctx, hb, auto ? 'Skip wait' : 'Why?', { kind: 'gold', size: wide ? 30 : 32, off: !auto && !S.prefs.hints, pressed: rs.ptr.down && inRect(hb, rs.ptr.x, rs.ptr.y), sub: S.kb && !auto ? 'H' : null });
  // Auto Play: this same button freezes the WHOLE loop (ui.pause gates every phase's own timer/thinker/animation at the very top of
  // play.js's update()) and the overlay it opens is headed "Paused" with a real "Resume".
  btn(ctx, pb, auto ? 'Pause' : 'Menu', { kind: 'wood', size: wide ? 30 : 32, pressed: rs.ptr.down && inRect(pb, rs.ptr.x, rs.ptr.y) });
  if (auto) renderAutoHUD(ctx, S, rs);
}

// Auto Play's own HUD: the think-time stepper (+/-), visible throughout. Portrait: the free top strip above the header
// (Menu is top-right); landscape: a small block in the left panel.
function renderAutoHUD(ctx, S, rs) {
  const idx = S.prefs.autoThinkIdx ?? 1, secs = AUTO_THINK_STEPS[idx];
  tx(ctx, 'Auto Play · Watch & Learn', GEO.autoCap.x, GEO.autoCap.y, GEO.autoCap.size, 'rgba(247,239,214,0.7)', { weight: 600 });
  btn(ctx, AUTO_STEP.dec, '−', { kind: 'wood', size: 28, off: idx === 0, pressed: rs.ptr.down && inRect(AUTO_STEP.dec, rs.ptr.x, rs.ptr.y) });
  btn(ctx, AUTO_STEP.inc, '+', { kind: 'wood', size: 28, off: idx === AUTO_THINK_STEPS.length - 1, pressed: rs.ptr.down && inRect(AUTO_STEP.inc, rs.ptr.x, rs.ptr.y) });
  tx(ctx, `Think: ${secs}s`, GEO.autoThink.x, GEO.autoThink.y, GEO.autoThink.size, GOLD, { weight: 700 });
}

export function claimList(c) {
  const o = c.opts[0], out = [];
  if (o.win) out.push({ id: 'win', label: 'Win!', kind: 'gold', key: 'W' });
  if (o.kong) out.push({ id: 'kong', label: 'Kong', kind: 'jade', key: 'K' });
  if (o.pung) out.push({ id: 'pung', label: 'Pung', kind: 'jade', key: 'P' });
  if (o.chows.length) out.push({ id: 'chow', label: 'Chow', kind: 'jade', key: 'C' });
  out.push({ id: 'pass', label: 'Pass', kind: 'wood', key: 'X' });
  return out;
}
export function ownList(own) {
  const out = [];
  if (own.win) out.push({ id: 'win', label: 'Win!', kind: 'gold' });
  for (let i = 0; i < own.kongs.length; i++) out.push({ id: 'kong' + i, label: own.kongs.length > 1 ? `Kong ${i + 1}` : 'Kong', kind: 'jade' });
  return out;
}

// ---- hand result sheet
export const RESULT_BTN = { x: 110, y: 1256, w: 500, h: 92 };
export const AUTO_AGAIN_BTN = { x: 110, y: 1256, w: 242, h: 92 };
export const AUTO_EXIT_BTN = { x: 368, y: 1256, w: 242, h: 92 };
const setR = (o, x, y, w, h) => { o.x = x; o.y = y; o.w = w; o.h = h; };

// The pieces of the result sheet, drawn in the sheet's own coordinates (the phone layout: 660 wide, x 30..690). Each takes the left edge
// x0, the right edge x1 and a top y, and returns nothing; positions are the approved phone ones relative to `y` (the sheet's top at 150).
function winHead(ctx, S, r, cx, y, o = {}) {
  const m = S.match, style = S.prefs.style, auto = S.scene === 'auto', won = !auto && r.winner === 0, name = won ? 'You win!' : `${seatName(r.winner, auto)} wins`;
  const ts = o.titleSize ?? 78, tw0 = o.tileMax ?? 46, maxW = o.maxW ?? 640;
  tx(ctx, name, cx, y + 100 * (ts / 78), ts, GOLD, { font: DISPLAY, shadow: true });
  const sy = y + (o.subDy ?? 142);
  txFit(ctx, r.from < 0 ? `${won ? 'You' : seatName(r.winner, auto)} drew the winning tile` : `Won on ${!auto && r.from === 0 ? 'your' : seatName(r.from, auto) + "'s"} discard`, cx, sy, o.subSize ?? 24, 'rgba(247,239,214,0.8)', maxW, { weight: 600, min: 13 });
  // the winning hand: melds then the concealed sets, pair last
  const info = r.info, sets = info.sets ?? [];
  const groups = sets.length ? [...sets.map((s) => s.t === 'chow' ? [s.k, s.k + 1, s.k + 2] : s.t === 'pung' ? [s.k, s.k, s.k] : [s.k, s.k, s.k, s.k]), [info.pair, info.pair]] : [S.h.result.tiles.map(kindOf)];
  const total = groups.reduce((a, g) => a + g.length, 0), gaps = groups.length - 1;
  const tw = Math.min(tw0, (maxW - gaps * 10) / total - 1), pitch = tw + 1, ty = y + (o.tilesDy ?? 220);
  let x = cx - (total * pitch + gaps * 10) / 2 + pitch / 2;
  groups.forEach((g) => { g.forEach((k) => { tileByKind(ctx, k, x, ty, tw, style); x += pitch; }); x += 10; });
  const fl = S.h.flowers[r.winner], by = y + (o.bonusDy ?? 312);
  if (fl.length) { const x0 = o.bonusX ?? 60; tx(ctx, 'Bonus tiles', x0, by, 16, 'rgba(247,239,214,0.7)', { align: 'left', weight: 600 }); fl.forEach((t, i) => tileByKind(ctx, kindOf(t), x0 + 116 + i * 32, by - 4, 26, style)); }
}
// "HOW IT SCORED" rows + the total. Returns the y just under the total line.
function patBlock(ctx, S, r, x0, x1, y, o = {}) {
  const info = r.info, auto = S.scene === 'auto', pats = info.patterns, rowH = o.rowH ?? (pats.length > 6 ? 56 : 64), ty0 = y;
  tx(ctx, 'HOW IT SCORED', x0, ty0, 16, 'rgba(241,207,122,0.85)', { align: 'left' });
  pats.forEach((p, i) => {
    const yy = ty0 + 34 + i * rowH;
    tx(ctx, p.name, x0, yy + 14, o.nameSize ?? 27, IVORY, { align: 'left', font: DISPLAY, weight: 700 });
    tx(ctx, `${p.fan >= 10 ? 'limit' : p.fan + ' fan'}`, x1, yy + 14, o.fanSize ?? 25, GOLD, { align: 'right', font: UI });
    txFit(ctx, p.why, x0, yy + (o.whyDy ?? 38), o.whySize ?? 17, 'rgba(247,239,214,0.68)', x1 - x0, { align: 'left', weight: 500, min: 11 });
  });
  if (!pats.length) tx(ctx, 'No scoring patterns', x0, ty0 + 54, 24, IVORY, { align: 'left' });
  const ty = ty0 + 34 + Math.max(pats.length, 1) * rowH + 8, cx = (x0 + x1) / 2;
  ctx.strokeStyle = 'rgba(241,207,122,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, ty - 8); ctx.lineTo(x1, ty - 8); ctx.stroke();
  txFit(ctx, `${info.fan >= 10 ? 'Limit hand' : info.fan + ' fan'}  =  ${pointsFor(info.fan)} point${pointsFor(info.fan) === 1 ? '' : 's'}`, cx, ty + 36, o.totalSize ?? 36, GOLD, x1 - x0, { font: UI, shadow: true });
  txFit(ctx, r.from < 0 ? 'Everyone pays the points.' : `${!auto && r.from === 0 ? 'You pay' : seatName(r.from, auto) + ' pays'} double: the player who discarded it.`, cx, ty + 66, 18, 'rgba(247,239,214,0.7)', x1 - x0, { weight: 600, min: 12 });
  return ty;
}
function payBlock(ctx, S, r, x0, x1, y) {
  const m = S.match, auto = S.scene === 'auto', step = (x1 - x0) / 4;
  r.pay.forEach((d, p) => {
    const x = x0 + step * (p + 0.5);
    tx(ctx, seatName(p, auto), x, y + 22, 20, 'rgba(247,239,214,0.8)', { weight: 700 });
    tx(ctx, (d > 0 ? '+' : '') + d, x, y + 62, 36, d > 0 ? '#9df0c4' : d < 0 ? '#ffb1a6' : 'rgba(247,239,214,0.5)', { font: UI });
    tx(ctx, 'total ' + m.scores[p], x, y + 86, 15, 'rgba(247,239,214,0.55)', { weight: 600 });
  });
}

export function renderResult(ctx, S, rs) {
  const r = S.h.result, ui = S.ui;
  const a = Math.min(1, ui.resT * 2.2), auto = S.scene === 'auto', wide = GEO.wide, t = Math.max(0, host.t), b = Math.max(0, host.b);
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,12,8,0.62)'; ctx.fillRect(0, 0, W, H);
  const lift = (1 - a) * 40;
  const nPats = r.type === 'win' ? Math.max(1, r.info.patterns.length) : 0;
  let btnA, btnB, btnMain, moreAt, caption;
  if (!wide) {
    // phone layout (approved): a 660-wide sheet from y = 150; scaled down uniformly on short screens
    const rowH0 = nPats > 6 ? 56 : 64, panelH = r.type === 'draw' ? 620 : 540 + nPats * rowH0 + 240 - 150 + 110;
    const need = panelH + 60, availH = H - t - b - 28, kk = Math.min(1, availH / need, (W - 24) / 660);
    const top = kk >= 1 && H >= 1560 ? 150 + (H - 1560) * 0.3 : t + 14 + Math.max(0, (availH - need * kk) / 2);
    const ox = W / 2 - 360 * kk, oy = top - 150 * kk;
    ctx.translate(ox, oy + lift); ctx.scale(kk, kk); setTextScale(kk);
    panel(ctx, 30, 150, 660, panelH, { alpha: 0.97 });
    const nbY = 150 + panelH - 112;
    if (r.type === 'draw') {
      tx(ctx, 'Draw', 360, 290, 92, GOLD, { font: DISPLAY, shadow: true });
      wrap(ctx, 'The wall ran out and nobody completed a hand. No points move, and the dealer stays.', 360, 360, 30, 560, IVORY);
      tx(ctx, '荒莊', 360, 560, 120, 'rgba(241,207,122,0.16)', { font: CJKF });
    } else {
      winHead(ctx, S, r, 360, 150);
      const ty = patBlock(ctx, S, r, 60, 660, 506, { rowH: nPats > 6 ? 56 : 64 });
      payBlock(ctx, S, r, 60, 660, ty + 90);
    }
    const to = (q) => ({ x: ox + q.x * kk, y: oy + q.y * kk + lift, w: q.w * kk, h: q.h * kk });
    btnMain = { x: 110, y: nbY, w: 500, h: 92 }; btnA = { x: 110, y: nbY, w: 242, h: 92 }; btnB = { x: 368, y: nbY, w: 242, h: 92 };
    caption = { x: 360, y: nbY - 26, size: 18 }; moreAt = { x: 360, y: nbY + 112 + 36 };
    setR(RESULT_BTN, 0, 0, 0, 0); Object.assign(RESULT_BTN, to(btnMain)); Object.assign(AUTO_AGAIN_BTN, to(btnA)); Object.assign(AUTO_EXIT_BTN, to(btnB));
    var scaleK = kk;
  } else {
    // landscape: one wide sheet, two columns (the hand and who paid on the left, how it scored on the right)
    const pw = Math.min(W - Math.max(host.l, 0) - Math.max(host.r, 0) - 24, 1080), ph = Math.min(700, H - t - b - 24), px = W / 2 - pw / 2, py = t + 12;
    ctx.translate(0, lift);
    panel(ctx, px, py, pw, ph, { alpha: 0.97 });
    const bw = Math.min(460, pw - 80), by = py + ph - 98;
    btnMain = { x: W / 2 - bw / 2, y: by, w: bw, h: 70 }; btnA = { x: W / 2 - bw / 2, y: by, w: (bw - 16) / 2, h: 70 }; btnB = { x: W / 2 + 8, y: by, w: (bw - 16) / 2, h: 70 };
    caption = { x: W / 2, y: by - 10, size: 15 }; moreAt = { x: W / 2, y: py + ph - 8 };
    if (r.type === 'draw') {
      tx(ctx, 'Draw', W / 2, py + 150, 90, GOLD, { font: DISPLAY, shadow: true });
      wrap(ctx, 'The wall ran out and nobody completed a hand. No points move, and the dealer stays.', W / 2, py + 220, 28, Math.min(640, pw - 80), IVORY);
      tx(ctx, '荒莊', W / 2, py + 400, 120, 'rgba(241,207,122,0.16)', { font: CJKF });
    } else {
      const lx0 = px + 30, lx1 = px + pw * 0.48 - 8, lcx = (lx0 + lx1) / 2, rx0 = px + pw * 0.5 + 18, rx1 = px + pw - 30;
      winHead(ctx, S, r, lcx, py - 22, { titleSize: 58, subSize: 21, tileMax: 44, maxW: lx1 - lx0, subDy: 128, tilesDy: 196, bonusDy: 262, bonusX: lx0 });
      payBlock(ctx, S, r, lx0, lx1, py + 290);
      ctx.strokeStyle = 'rgba(241,207,122,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px + pw * 0.49, py + 24); ctx.lineTo(px + pw * 0.49, by - 18); ctx.stroke();
      const room = by - 18 - (py + 40) - 130, rowH = Math.max(46, Math.min(64, room / nPats));
      patBlock(ctx, S, r, rx0, rx1, py + 40, { rowH, nameSize: 25, whySize: 16, whyDy: rowH > 50 ? 36 : 33, totalSize: 32 });
    }
    setR(RESULT_BTN, 0, 0, 0, 0); Object.assign(RESULT_BTN, btnMain, { y: btnMain.y + lift }); Object.assign(AUTO_AGAIN_BTN, btnA, { y: btnA.y + lift }); Object.assign(AUTO_EXIT_BTN, btnB, { y: btnB.y + lift });
    var scaleK = 1;
  }
  void scaleK;
  const draw = (q, label, kind, size, pulseOn) => btn(ctx, q, label, { kind, size, pulse: pulseOn ? 0.5 + 0.5 * Math.sin(S.t * 4) : 0, pressed: rs.ptr.down && inRect(rects.get(q), rs.ptr.x, rs.ptr.y) });
  const rects = new Map([[btnMain, RESULT_BTN], [btnA, AUTO_AGAIN_BTN], [btnB, AUTO_EXIT_BTN]]);
  if (auto && ui.autoOver) {
    // The whole Auto Play "game" (one full hand) just finished: offer Play again / Exit, same shape as every other game's Auto Play end screen.
    tx(ctx, 'A full Auto Play demonstration just finished. Nothing here was saved.', caption.x, caption.y, caption.size, GOLD, { weight: 600 });
    draw(btnA, 'Play again (auto)', 'gold', wide ? 28 : 26, true); draw(btnB, 'Exit to menu', 'wood', wide ? 28 : 26, false);
  } else {
    draw(btnMain, auto ? 'Continue' : ui.resultLast ? 'See final scores' : 'Next hand', 'gold', wide ? 34 : 38, true);
  }
  if (!auto && ui.resultLast) drawMoreLine(ctx, moreAt.x, moreAt.y, Math.max(wide ? 14 : 16, minUnits()));
  setTextScale(1);
  ctx.restore();
}

export function renderMatchEnd(ctx, S, rs) {
  drawTable(ctx, null);
  const m = S.match, order = [0, 1, 2, 3].sort((a, b) => m.scores[b] - m.scores[a]), wide = GEO.wide, t = Math.max(0, host.t), b = Math.max(0, host.b);
  const first = order[0] === 0 ? 'You finished first. Well played!' : `${NAMES[order[0]]} finished first.`;
  const row = (p, i, r, sc) => {
    panel(ctx, r.x, r.y, r.w, r.h, { alpha: p === 0 ? 0.9 : 0.7, edge: i === 0 ? GOLD : 'rgba(241,207,122,0.4)' });
    const k = r.h / 124, cy = r.y + r.h / 2;
    tx(ctx, `${i + 1}`, r.x + 50, cy + 20 * k, 60 * k, i === 0 ? GOLD : 'rgba(247,239,214,0.55)', { font: UI });
    tx(ctx, p === 0 ? 'You' : NAMES[p], r.x + 110, cy - 2 * k, 40 * k, IVORY, { align: 'left', font: DISPLAY });
    if (p !== 0) tx(ctx, LEVELS[m.levels[p]].name, r.x + 110, cy + 30 * k, Math.max(14, 20 * k), 'rgba(247,239,214,0.6)', { align: 'left', weight: 600 });
    else tx(ctx, `${S.matchWins} hand${S.matchWins === 1 ? '' : 's'} won`, r.x + 110, cy + 30 * k, Math.max(14, 20 * k), 'rgba(247,239,214,0.6)', { align: 'left', weight: 600 });
    tx(ctx, (sc > 0 ? '+' : '') + sc, r.x + r.w - 34, cy + 16 * k, 50 * k, sc > 0 ? '#9df0c4' : sc < 0 ? '#ffb1a6' : IVORY, { align: 'right', font: UI });
  };
  if (!wide) {
    // the phone layout is about 1230 units tall; scale it down uniformly on shorter screens
    const availH = H - t - b - 20, kk = Math.min(1, availH / 1230, (W - 20) / 720), oy = t + 10 + Math.max(0, (availH - 1230 * kk) / 2), ox = W / 2 - 360 * kk;
    ctx.save(); ctx.translate(ox, oy - 150 * kk); ctx.scale(kk, kk); setTextScale(kk);
    tx(ctx, 'Final scores', 360, 230, 84, GOLD, { font: DISPLAY, shadow: true });
    tx(ctx, first, 360, 290, 30, IVORY, { weight: 600 });
    order.forEach((p, i) => row(p, i, { x: 60, y: 380 + i * 150, w: 600, h: 124 }, m.scores[p]));
    btn(ctx, { x: 110, y: 1090, w: 500, h: 92 }, 'Play again', { kind: 'gold', size: 38, pulse: 0.5 + 0.5 * Math.sin(S.t * 4) });
    btn(ctx, { x: 110, y: 1210, w: 500, h: 84 }, 'Main menu', { kind: 'wood', size: 34 });
    drawMoreLine(ctx, 360, 1350, Math.max(17, minUnits()));
    setTextScale(1);
    ctx.restore();
    const to = (q) => ({ x: ox + q.x * kk, y: oy - 150 * kk + q.y * kk, w: q.w * kk, h: q.h * kk });
    Object.assign(MATCHEND_BTNS.again, to({ x: 110, y: 1090, w: 500, h: 92 })); Object.assign(MATCHEND_BTNS.menu, to({ x: 110, y: 1210, w: 500, h: 84 }));
  } else {
    const top = t + 10, rw = Math.min(640, W - 40), x0 = W / 2 - rw / 2, bh = 70, availH = H - top - b - 10;
    const headH = 96, rowH = Math.min(100, (availH - headH - bh - 30) / 4 - 8), gap = 8;
    txFit(ctx, 'Final scores', W / 2, top + 58, 62, GOLD, W - 40, { font: DISPLAY, shadow: true, min: 30 });
    txFit(ctx, first, W / 2, top + 90, 24, IVORY, W - 40, { weight: 600, min: 13 });
    order.forEach((p, i) => row(p, i, { x: x0, y: top + headH + i * (rowH + gap), w: rw, h: rowH }, m.scores[p]));
    const by = top + headH + 4 * (rowH + gap) + 6, bw = (rw - 16) / 2;
    Object.assign(MATCHEND_BTNS.again, { x: x0, y: by, w: bw, h: bh }); Object.assign(MATCHEND_BTNS.menu, { x: x0 + bw + 16, y: by, w: bw, h: bh });
    btn(ctx, MATCHEND_BTNS.again, 'Play again', { kind: 'gold', size: 32, pulse: 0.5 + 0.5 * Math.sin(S.t * 4) });
    btn(ctx, MATCHEND_BTNS.menu, 'Main menu', { kind: 'wood', size: 30 });
    drawMoreLine(ctx, W / 2, by + bh + 22, Math.max(14, minUnits()));
  }
}
export const MATCHEND_BTNS = { again: { x: 110, y: 1090, w: 500, h: 92 }, menu: { x: 110, y: 1210, w: 500, h: 84 } };
