// The table: everything drawn during a hand. Reads state, changes nothing. Tiles are placed by the tween objects in
// `rs.vis` (game.js); art is cached sprites (tiles.js), so a frame is a few hundred drawImage calls.
import { W, H, RING, BTN, CHIPS, AUTO_STEP, AUTO_THINK_STEPS, inRect } from './layout.js';
import { DISPLAY, UI, CJKF, GOLD, IVORY, INK, TAU, tx, wrap, rr, btn, panel, drawTable, drawTileAt, tileByKind, windGlyph } from './draw.js';
import { kindOf, kindName, seatWind, windName, wallLeft, pointsFor, POINTS } from './rules.js';
import { LEVELS } from './ai.js';

export const NAMES = ['You', 'Mei', 'Lin', 'Jun'];
// During Auto Play nobody is "you" - seat 0 is just another computer seat, driven the same as the
// other three. Used only by the new Auto Play narration/labels; every pre-existing call site keeps
// using NAMES[p] directly (seat 0 is never the one narrated to during Auto Play through those).
export const seatName = (p, auto) => (auto && p === 0 ? 'Seat 1' : NAMES[p]);

export function claimRects(list) {
  const n = list.length, gap = 10, w = Math.min(176, (680 - gap * (n - 1)) / n), total = n * w + gap * (n - 1);
  return list.map((c, i) => ({ ...c, r: { x: 360 - total / 2 + i * (w + gap), y: 1128, w, h: 84 } }));
}

function header(ctx, S) {
  const m = S.match, h = S.h;
  // Auto Play shows its own "Auto Play - Watch & Learn" caption + think-time stepper across this
  // same top strip (renderAutoHUD) - the normal "Single Hand"/"East Round" label would collide
  // with the stepper buttons, and is redundant with that caption anyway. The Menu icon still draws.
  if (S.scene !== 'auto') {
    tx(ctx, m.mode === 'round' ? `${windName(h.wind)} Round` : 'Single Hand', 40, 80, 40, GOLD, { font: DISPLAY, align: 'left', shadow: true });
    tx(ctx, m.mode === 'round' ? `Hand ${m.hand} of 4${m.repeats ? ` (dealer stays x${m.repeats})` : ''}` : `${windName(h.wind)} wind`, 40, 112, 22 * (S.prefs.big ? 1.1 : 1), 'rgba(247,239,214,0.8)', { align: 'left' });
  }
  // menu button
  const r = BTN.menu;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, r.x, r.y + 5, r.w, r.h, 22); ctx.fill();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#7d4b28'); g.addColorStop(1, '#3a200d');
  ctx.fillStyle = g; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fill(); ctx.strokeStyle = 'rgba(241,207,122,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = GOLD; for (let i = 0; i < 3; i++) rr(ctx, r.x + 20, r.y + 22 + i * 13, 36, 5, 2.5), ctx.fill();
}

function hub(ctx, S, pulse) {
  const h = S.h, { cx, cy } = RING;
  ctx.save();
  ctx.fillStyle = 'rgba(0,26,18,0.5)'; rr(ctx, cx - 96, cy - 96, 192, 192, 26); ctx.fill();
  ctx.strokeStyle = 'rgba(241,207,122,0.4)'; ctx.lineWidth = 2; rr(ctx, cx - 96, cy - 96, 192, 192, 26); ctx.stroke();
  windGlyph(ctx, h.wind, cx, cy - 40, 30);
  tx(ctx, 'ROUND WIND', cx, cy - 2, 12, 'rgba(241,207,122,0.8)', { weight: 700 });
  tx(ctx, String(wallLeft(h)), cx, cy + 52, 46, IVORY, { font: UI });
  tx(ctx, 'TILES LEFT', cx, cy + 74, 12, 'rgba(247,239,214,0.6)');
  // whose turn: four lights just inside the wall
  const spots = [[cx, cy + 108 - 8], [cx + 108 - 8, cy], [cx, cy - 108 + 8], [cx - 108 + 8, cy]];
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
    if (p !== 0 || S.scene === 'auto') tx(ctx, LEVELS[m.levels[p]].name, r.x + 62, r.y + r.h / 2 + 18, 12.5, 'rgba(247,239,214,0.65)', { align: 'left', weight: 600 });
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

export function renderPlay(ctx, S, rs) {
  drawTable(ctx);
  const ui = S.ui, pulse = 0.5 + 0.5 * Math.sin(S.t * 4), big = S.prefs.big ? 1.18 : 1;
  header(ctx, S);
  hub(ctx, S, pulse);
  plates(ctx, S, pulse);
  renderTiles(ctx, S, rs);

  // the message pill
  if (ui.msg && ui.msg.text) {
    const a = Math.min(1, ui.msg.hold - ui.msg.t) > 0 ? Math.min(1, (ui.msg.hold - ui.msg.t) * 2, ui.msg.t * 5 + 0.2) : 0;
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = `600 ${25 * big}px ${UI}`;
    const lines = []; { let cur = ''; for (const w of ui.msg.text.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > 620 && cur) { lines.push(cur); cur = w; } else cur = t2; } lines.push(cur); }
    const btns = (ui.ph === 'claim' && ui.claim && ui.claim.human) || (ui.ph === 'human' && ui.own && (ui.own.win || ui.own.kongs.length));
    if (btns && lines.length > 2) { lines.length = 2; lines[1] = lines[1].replace(/\s*\S*$/, '') + '...'; }
    const lh = 30 * big, bh = lines.length * lh + 20, by = btns ? 1222 : Math.min(1230, 1318 - bh);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(ctx, 360 - 330, by - 4, 660, bh, 20); ctx.fill();
    ctx.strokeStyle = 'rgba(241,207,122,0.5)'; ctx.lineWidth = 1.5; rr(ctx, 360 - 330, by - 4, 660, bh, 20); ctx.stroke();
    lines.forEach((ln, i) => tx(ctx, ln, 360, by + 26 * big + i * lh - 4, 25 * big, ui.msg.warn ? '#ffd0c4' : IVORY, { weight: 600 }));
    ctx.restore();
  }

  // claim buttons, decision timer
  if (ui.ph === 'claim' && ui.claim && ui.claim.human) {
    const c = ui.claim, opts = claimList(c);
    if (c.timer > 0 && S.prefs.timer) {
      const f = Math.max(0, c.t / c.timer);
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; rr(ctx, 40, 1106, 640, 10, 5); ctx.fill();
      ctx.fillStyle = f > 0.3 ? GOLD : '#ff8a70'; rr(ctx, 40, 1106, 640 * f, 10, 5); ctx.fill();
    }
    if (c.chowPick) {
      tx(ctx, 'Which chow?', 360, 1150, 28, IVORY, { font: DISPLAY });
      c.chowPick.forEach((pair, i) => {
        const n = c.chowPick.length, w = 200, x = 360 - (n * w + (n - 1) * 12) / 2 + i * (w + 12), r = { x, y: 1164, w, h: 78 };
        btn(ctx, r, '', { kind: 'jade', pressed: rs.ptr.down && inRect(r, rs.ptr.x, rs.ptr.y) });
        const ks = [kindOf(pair[0]), kindOf(c.tile), kindOf(pair[1])].sort((a, b) => a - b);
        ks.forEach((k, j) => tileByKind(ctx, k, x + w / 2 + (j - 1) * 46, r.y + 40, 40, S.prefs.style, { shadow: false }));
      });
      btn(ctx, { x: 258, y: 1256, w: 204, h: 62 }, 'Back', { kind: 'wood', size: 28 });
    } else {
      for (const o of claimRects(opts)) btn(ctx, o.r, o.label, { kind: o.kind, size: 36, pulse: o.kind === 'gold' ? pulse : 0, pressed: rs.ptr.down && inRect(o.r, rs.ptr.x, rs.ptr.y), sub: S.kb ? o.key : null });
    }
  }
  if (ui.ph === 'human' && ui.own) {
    const opts = ownList(ui.own);
    if (opts.length) for (const o of claimRects(opts)) btn(ctx, o.r, o.label, { kind: o.kind, size: 36, pulse: o.kind === 'gold' ? pulse : 0, pressed: rs.ptr.down && inRect(o.r, rs.ptr.x, rs.ptr.y) });
  }
  // whose move
  if (ui.ph === 'ai') tx(ctx, `${NAMES[S.h.turn]} is thinking...`, 360, 1180, 24, 'rgba(247,239,214,0.75)', { weight: 600 });
  else if (ui.ph === 'auto-gate') tx(ctx, `${seatName(S.h.turn, true)} is ${ui.auto.phase === 'think' ? 'thinking' : 'about to act'}...`, 360, 1180, 24, 'rgba(247,239,214,0.75)', { weight: 600 });
  if (ui.ph === 'human' && !ui.own?.win && !ui.msg?.text) tx(ctx, ui.own?.lowWin ? 'Complete, but no scoring pattern yet.' : 'Your turn: tap a tile, tap it again to discard.', 360, 1182, 22 * big, 'rgba(247,239,214,0.78)', { weight: 600 });

  // bottom bar
  const hb = BTN.hint, pb = BTN.pause, auto = S.scene === 'auto';
  btn(ctx, hb, auto ? 'Skip wait' : 'Why?', { kind: 'gold', size: 32, off: !auto && !S.prefs.hints, pressed: rs.ptr.down && inRect(hb, rs.ptr.x, rs.ptr.y), sub: S.kb && !auto ? 'H' : null });
  // Auto Play: this same button already freezes the WHOLE loop (ui.pause gates every phase's own
  // timer/thinker/animation at the very top of play.js's update(), before any of them run) and the
  // overlay it opens is already headed "Paused" with a real "Resume" - it was just mislabeled
  // "Menu" here, which undersold what one tap actually does for an Auto Play viewer wanting to
  // freeze the demonstration (final-polish pass, owner request for a clear Pause affordance).
  btn(ctx, pb, auto ? 'Pause' : 'Menu', { kind: 'wood', size: 32, pressed: rs.ptr.down && inRect(pb, rs.ptr.x, rs.ptr.y) });
  if (auto) renderAutoHUD(ctx, S, rs);
}

// Auto Play's own HUD strip: the think-time stepper (+/-), visible throughout, in the free top
// strip above the header text (the header's round/hand text is left-aligned; Menu is top-right).
function renderAutoHUD(ctx, S, rs) {
  const idx = S.prefs.autoThinkIdx ?? 1, secs = AUTO_THINK_STEPS[idx];
  tx(ctx, 'Auto Play · Watch & Learn', 360, 20, 15, 'rgba(247,239,214,0.65)', { weight: 600 });
  btn(ctx, AUTO_STEP.dec, '−', { kind: 'wood', size: 28, off: idx === 0, pressed: rs.ptr.down && inRect(AUTO_STEP.dec, rs.ptr.x, rs.ptr.y) });
  btn(ctx, AUTO_STEP.inc, '+', { kind: 'wood', size: 28, off: idx === AUTO_THINK_STEPS.length - 1, pressed: rs.ptr.down && inRect(AUTO_STEP.inc, rs.ptr.x, rs.ptr.y) });
  tx(ctx, `Think: ${secs}s`, 360, 72, 22, GOLD, { weight: 700 });
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
export function renderResult(ctx, S, rs) {
  const r = S.h.result, m = S.match, ui = S.ui, style = S.prefs.style;
  const a = Math.min(1, ui.resT * 2.2);
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,12,8,0.62)'; ctx.fillRect(0, 0, W, H);
  const y0 = 150 + (1 - a) * 40; ctx.translate(0, (1 - a) * 40);
  const nPats = r.type === 'win' ? Math.max(1, r.info.patterns.length) : 0, rowH0 = nPats > 6 ? 56 : 64;
  const panelH = r.type === 'draw' ? 620 : 540 + nPats * rowH0 + 240 - 150 + 110;
  panel(ctx, 30, 150, 660, panelH, { alpha: 0.97 });
  const nbY = 150 + panelH - 112;
  if (r.type === 'draw') {
    tx(ctx, 'Draw', 360, 290, 92, GOLD, { font: DISPLAY, shadow: true });
    wrap(ctx, 'The wall ran out and nobody completed a hand. No points move, and the dealer stays.', 360, 360, 30, 560, IVORY);
    tx(ctx, '荒莊', 360, 560, 120, 'rgba(241,207,122,0.16)', { font: CJKF });
  } else {
    const auto = S.scene === 'auto', won = !auto && r.winner === 0, name = won ? 'You win!' : `${seatName(r.winner, auto)} wins`;
    tx(ctx, name, 360, 250, 78, GOLD, { font: DISPLAY, shadow: true });
    tx(ctx, r.from < 0 ? `${won ? 'You' : seatName(r.winner, auto)} drew the winning tile` : `Won on ${!auto && r.from === 0 ? 'your' : seatName(r.from, auto) + "'s"} discard`, 360, 292, 24, 'rgba(247,239,214,0.8)', { weight: 600 });
    // the winning hand: melds then the concealed sets, pair last
    const info = r.info, sets = info.sets ?? [];
    const groups = sets.length ? [...sets.map((s) => s.t === 'chow' ? [s.k, s.k + 1, s.k + 2] : s.t === 'pung' ? [s.k, s.k, s.k] : [s.k, s.k, s.k, s.k]), [info.pair, info.pair]] : [S.h.result.tiles.map(kindOf)];
    const total = groups.reduce((a, g) => a + g.length, 0), gaps = groups.length - 1;
    const tw = Math.min(46, (640 - gaps * 10) / total - 1), pitch = tw + 1;
    let x = 360 - (total * pitch + gaps * 10) / 2 + pitch / 2;
    groups.forEach((g) => { g.forEach((k) => { tileByKind(ctx, k, x, 370, tw, style); x += pitch; }); x += 10; });
    const fl = S.h.flowers[r.winner];
    if (fl.length) { tx(ctx, 'Bonus tiles', 60, 462, 16, 'rgba(247,239,214,0.7)', { align: 'left', weight: 600 }); fl.forEach((t, i) => tileByKind(ctx, kindOf(t), 176 + i * 32, 458, 26, style)); }
    // patterns
    const pats = info.patterns, rowH = pats.length > 6 ? 56 : 64;
    tx(ctx, 'HOW IT SCORED', 60, 506, 16, 'rgba(241,207,122,0.85)', { align: 'left' });
    pats.forEach((p, i) => {
      const y = 540 + i * rowH;
      tx(ctx, p.name, 60, y + 14, 27, IVORY, { align: 'left', font: DISPLAY, weight: 700 });
      tx(ctx, `${p.fan >= 10 ? 'limit' : p.fan + ' fan'}`, 660, y + 14, 25, GOLD, { align: 'right', font: UI });
      tx(ctx, p.why, 60, y + 38, 17, 'rgba(247,239,214,0.68)', { align: 'left', weight: 500 });
    });
    if (!pats.length) tx(ctx, 'No scoring patterns', 60, 560, 24, IVORY, { align: 'left' });
    const ty = 540 + Math.max(pats.length, 1) * rowH + 8;
    ctx.strokeStyle = 'rgba(241,207,122,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(60, ty - 8); ctx.lineTo(660, ty - 8); ctx.stroke();
    tx(ctx, `${info.fan >= 10 ? 'Limit hand' : info.fan + ' fan'}  =  ${pointsFor(info.fan)} point${pointsFor(info.fan) === 1 ? '' : 's'}`, 360, ty + 36, 36, GOLD, { font: UI, shadow: true });
    tx(ctx, r.from < 0 ? 'Everyone pays the points.' : `${!auto && r.from === 0 ? 'You pay' : seatName(r.from, auto) + ' pays'} double: the player who discarded it.`, 360, ty + 66, 18, 'rgba(247,239,214,0.7)', { weight: 600 });
    // payments
    r.pay.forEach((d, p) => {
      const x = 110 + p * 166;
      tx(ctx, seatName(p, auto), x, ty + 112, 20, 'rgba(247,239,214,0.8)', { weight: 700 });
      tx(ctx, (d > 0 ? '+' : '') + d, x, ty + 152, 36, d > 0 ? '#9df0c4' : d < 0 ? '#ffb1a6' : 'rgba(247,239,214,0.5)', { font: UI });
      tx(ctx, 'total ' + m.scores[p], x, ty + 176, 15, 'rgba(247,239,214,0.55)', { weight: 600 });
    });
  }
  ctx.restore();
  ctx.save(); ctx.globalAlpha = a;
  if (S.scene === 'auto' && ui.autoOver) {
    // The whole Auto Play "game" (one full hand) just finished: offer Play again / Exit, same
    // shape as every other game's Auto Play end screen, instead of the normal Next-hand flow.
    AUTO_AGAIN_BTN.y = nbY; AUTO_EXIT_BTN.y = nbY;
    tx(ctx, 'A full Auto Play demonstration just finished. Nothing here was saved.', 360, nbY - 26, 18, GOLD, { weight: 600 });
    btn(ctx, AUTO_AGAIN_BTN, 'Play again (auto)', { kind: 'gold', size: 26, pulse: 0.5 + 0.5 * Math.sin(S.t * 4), pressed: rs.ptr.down && inRect(AUTO_AGAIN_BTN, rs.ptr.x, rs.ptr.y) });
    btn(ctx, AUTO_EXIT_BTN, 'Exit to menu', { kind: 'wood', size: 26, pressed: rs.ptr.down && inRect(AUTO_EXIT_BTN, rs.ptr.x, rs.ptr.y) });
  } else {
    RESULT_BTN.y = nbY;
    const nb = { x: 110, y: nbY, w: 500, h: 92 };
    const label = S.scene === 'auto' ? 'Continue' : ui.resultLast ? 'See final scores' : 'Next hand';
    btn(ctx, nb, label, { kind: 'gold', size: 38, pulse: 0.5 + 0.5 * Math.sin(S.t * 4), pressed: rs.ptr.down && inRect(nb, rs.ptr.x, rs.ptr.y) });
  }
  ctx.restore();
}
export const AUTO_AGAIN_BTN = { x: 110, y: 1256, w: 242, h: 92 };
export const AUTO_EXIT_BTN = { x: 368, y: 1256, w: 242, h: 92 };


export function renderMatchEnd(ctx, S, rs) {
  drawTable(ctx);
  const m = S.match, order = [0, 1, 2, 3].sort((a, b) => m.scores[b] - m.scores[a]);
  tx(ctx, 'Final scores', 360, 230, 84, GOLD, { font: DISPLAY, shadow: true });
  tx(ctx, order[0] === 0 ? 'You finished first. Well played!' : `${NAMES[order[0]]} finished first.`, 360, 290, 30, IVORY, { weight: 600 });
  order.forEach((p, i) => {
    const y = 380 + i * 150, r = { x: 60, y, w: 600, h: 124 };
    panel(ctx, r.x, r.y, r.w, r.h, { alpha: p === 0 ? 0.9 : 0.7, edge: i === 0 ? GOLD : 'rgba(241,207,122,0.4)' });
    tx(ctx, `${i + 1}`, r.x + 50, y + 82, 60, i === 0 ? GOLD : 'rgba(247,239,214,0.55)', { font: UI });
    tx(ctx, p === 0 ? 'You' : NAMES[p], r.x + 110, y + 60, 40, IVORY, { align: 'left', font: DISPLAY });
    if (p !== 0) tx(ctx, LEVELS[m.levels[p]].name, r.x + 110, y + 92, 20, 'rgba(247,239,214,0.6)', { align: 'left', weight: 600 });
    else tx(ctx, `${S.matchWins} hand${S.matchWins === 1 ? '' : 's'} won`, r.x + 110, y + 92, 20, 'rgba(247,239,214,0.6)', { align: 'left', weight: 600 });
    tx(ctx, (m.scores[p] > 0 ? '+' : '') + m.scores[p], r.x + r.w - 34, y + 78, 50, m.scores[p] > 0 ? '#9df0c4' : m.scores[p] < 0 ? '#ffb1a6' : IVORY, { align: 'right', font: UI });
  });
  btn(ctx, { x: 110, y: 1090, w: 500, h: 92 }, 'Play again', { kind: 'gold', size: 38, pulse: 0.5 + 0.5 * Math.sin(S.t * 4) });
  btn(ctx, { x: 110, y: 1210, w: 500, h: 84 }, 'Main menu', { kind: 'wood', size: 34 });
}
export const MATCHEND_BTNS = { again: { x: 110, y: 1090, w: 500, h: 92 }, menu: { x: 110, y: 1210, w: 500, h: 84 } };
