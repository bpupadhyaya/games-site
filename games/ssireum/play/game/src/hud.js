// The play screen furniture: scoreboard, the two balance discs with grip, the move controls, the countdown and fall banner, the coach
// card, the pass-the-phone cover. Pure drawing from state + layout; game.js owns every decision.
import { W, H, inRect, TEXT_SCALES, playLayout, SAFE } from './layout.js';
import { FONT, SERIF, roundPath, drawButton, wrapLines, textShadow, FLOOR, plaque } from './ui.js';
import { SASH, drawDisc } from './view.js';
import { GRIP_MAX, gripCost, DIR_NAMES, POW_NAMES, WINS_NEEDED } from './sim.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const layoutFor = (state) => playLayout(TEXT_SCALES[state.settings.textIdx], state.m.cfg.mode === 'watch');

export function drawHud(ctx, state, lay) {
  const m = state.m, hd = lay.hud, fs = lay.fs;
  const names = m.players.map((p) => p.name);
  plaque(ctx, hd.x + 6, hd.y, hd.w - 12, hd.h - 4, 18, { top: '#4a2a14', bot: '#27140a', rim: '#1a0d05', brass: ['#f6dc8a', '#a87a24'] });
  const pad = 16, namePx = Math.max(FLOOR, Math.round(fs * 0.92));
  const colW = (hd.w - 24) * 0.36;
  const fit = (txt, px, maxW) => { let p = px; ctx.font = `800 ${p}px ${FONT}`; while (ctx.measureText(txt).width > maxW && p > FLOOR) { p--; ctx.font = `800 ${p}px ${FONT}`; } return p; };
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < 2; i++) {
    const left = i === 0, x = left ? hd.x + pad : hd.x + hd.w - pad;
    ctx.fillStyle = SASH[i].sash; ctx.beginPath(); ctx.arc(left ? x + namePx * 0.4 : x - namePx * 0.4, hd.y + namePx * 1.05, namePx * 0.36, 0, TAU); ctx.fill();
    fit(names[i], namePx, colW - namePx);
    ctx.textAlign = left ? 'left' : 'right'; ctx.fillStyle = '#f7ead2';
    ctx.fillText(names[i], left ? x + namePx * 0.95 : x - namePx * 0.95, hd.y + namePx * 1.22);
    // falls won
    const pr = Math.max(7, fs * 0.28), py = hd.y + hd.h - pr - 9;
    for (let k = 0; k < WINS_NEEDED; k++) {
      const px = left ? hd.x + pad + pr + k * pr * 2.8 : hd.x + hd.w - pad - pr - k * pr * 2.8;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU);
      if (k < m.wins[i]) { const cg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 1, px, py, pr); cg.addColorStop(0, '#fff3b8'); cg.addColorStop(0.6, '#f2c14e'); cg.addColorStop(1, '#a87a24'); ctx.fillStyle = cg; ctx.fill(); } else { ctx.strokeStyle = 'rgba(255,240,210,0.6)'; ctx.lineWidth = 2; ctx.stroke(); }
    }
  }
  // centre: the beat, and the clock when there is one
  ctx.textAlign = 'center';
  const showClock = state.phase === 'choose' && state.timerOn;
  ctx.font = `800 ${Math.round(fs * 1.25)}px ${FONT}`;
  ctx.fillStyle = showClock && state.timer < 4 ? '#ff9c63' : '#f7ead2';
  ctx.fillText(showClock ? String(Math.max(0, Math.ceil(state.timer))) : `${state.F.beat + 1}`, hd.x + hd.w / 2, hd.y + namePx * 1.3);
  ctx.font = `600 ${Math.max(FLOOR, Math.round(fs * 0.6))}px ${FONT}`; ctx.fillStyle = 'rgba(247,234,210,0.8)';
  ctx.fillText(`Fall ${Math.min(m.idx + 1, 3)} · beat ${state.F.beat + 1} · first to ${WINS_NEEDED}`, hd.x + hd.w / 2, hd.y + hd.h - 11);
}

function gripPips(ctx, cx, y, h, grip, pending, col) {
  const r = Math.min(h * 0.4, 13), gap = r * 2.5, x0 = cx - gap * (GRIP_MAX - 1) / 2;
  for (let k = 0; k < GRIP_MAX; k++) {
    const x = x0 + k * gap;
    ctx.beginPath(); ctx.arc(x, y + h / 2, r, 0, TAU);
    if (k < grip) { ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(30,18,10,0.7)'; ctx.lineWidth = 2; ctx.stroke(); }
    else { ctx.strokeStyle = 'rgba(247,234,210,0.45)'; ctx.lineWidth = 2; ctx.stroke(); }
    if (pending > 0 && k >= grip - pending && k < grip) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y + h / 2, r + 3, 0, TAU); ctx.stroke(); }
  }
}

// The two discs. Active one (where the next tap lands) is lit; the other is dimmed.
export function drawBoard(ctx, state, lay) {
  const F = state.F, who = state.who, t = state.t;
  const choosing = state.phase === 'choose' && state.humanTurn;
  const sel = state.sel;
  const aimOn = sel.kind === 'brace' ? who : 1 - who;     // the disc the next tap lands on
  const D = [lay.discs.me, lay.discs.th];
  const names = state.m.players.map((p) => p.name);
  for (let i = 0; i < 2; i++) {
    const d = D[i];
    const moves = state.showMoves ? [state.showMoves[i]].filter((mv) => mv && (mv.kind === 'brace' ? true : false)) : [];
    // arrows: a pull/hook is drawn on the disc it lands on (the rival's); a brace on its owner's
    const land = [];
    if (state.showMoves) for (let s = 0; s < 2; s++) { const mv = state.showMoves[s]; if (!mv) continue; if ((mv.kind === 'brace' && s === i) || (mv.kind !== 'brace' && s !== i)) land.push(mv); }
    void moves;
    const active = choosing && aimOn === i;
    const hintDir = choosing && state.hint && state.hint.disc === i ? state.hint.dir : null;
    drawDisc(ctx, d.cx, d.cy, d.r, {
      p: state.disp[i], trail: state.trail ? state.trail[i] : null, active, sel: choosing && aimOn === i && sel.dir >= 0 ? sel.dir : null, pow: sel.pow,
      aim: sel.kind === 'brace' ? 'resist' : 'send', hint: hintDir, moves: land, color: SASH[i].sash, danger: Math.hypot(state.disp[i].x, state.disp[i].y) > 0.78,
      dim: choosing && !active, t,
    });
    // label above
    const px = Math.max(FLOOR, Math.round(lay.lab * 1.05));
    ctx.font = `800 ${px}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f7ead2';
    let nm = names[i], p2 = px; while (ctx.measureText(nm).width > d.r * 2 && p2 > FLOOR) { p2--; ctx.font = `800 ${p2}px ${FONT}`; }
    textShadow(ctx, nm, d.cx, lay.discLabY - 4, '#f7ead2', 4);
    // grip
    const cost = choosing && who === i ? gripCost(sel) : 0;
    gripPips(ctx, d.cx, lay.gripY, lay.gripH, F.grip[i], cost, SASH[i].sash);
    ctx.font = `700 ${Math.max(FLOOR, Math.round(lay.lab * 0.85))}px ${FONT}`; ctx.fillStyle = 'rgba(247,234,210,0.75)'; ctx.textBaseline = 'alphabetic';
  }
  // instruction under the active disc's label (one short line over the picture's bottom edge)
  if (choosing && state.phase === 'choose') {
    const txt = sel.kind === 'brace' ? 'Tap the way you expect to be sent' : sel.kind === 'hook' ? 'Tap where the hook should send them' : 'Tap where to send their balance';
    let px = Math.max(FLOOR, Math.round(lay.lab * 0.95));
    ctx.font = `700 ${px}px ${FONT}`;
    while (ctx.measureText(txt).width > lay.stage.w - 50 && px > FLOOR) { px--; ctx.font = `700 ${px}px ${FONT}`; }
    const s = lay.stage, w = Math.min(s.w - 16, ctx.measureText(txt).width + 30), y = s.y + s.h - 14 - px * 1.2;
    roundPath(ctx, s.x + s.w / 2 - w / 2, y - px * 0.4, w, px * 1.9, px); ctx.fillStyle = 'rgba(28,18,12,0.78)'; ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe3a0'; ctx.fillText(txt, s.x + s.w / 2, y + px * 0.55);
    ctx.textBaseline = 'alphabetic';
  }
}

export function drawControls(ctx, state, lay) {
  const b = lay.btn, size = Math.max(FLOOR + 4, Math.round(lay.fs * 0.95));
  if (state.m.cfg.mode === 'watch') {
    drawButton(ctx, b.pause, state.paused ? 'Resume' : 'Pause', { dark: true, size });
    drawButton(ctx, b.fast, state.ff ? 'Speed x3' : 'Speed x1', { dark: !state.ff, active: state.ff, size });
    drawButton(ctx, b.exit, 'Exit', { dark: true, size });
    drawButton(ctx, b.dec, 'Think −', { dark: true, size, disabled: state.settings.thinkIdx === 0 });
    drawButton(ctx, b.inc, 'Think +', { dark: true, size, disabled: state.settings.thinkIdx >= 3 });
    return;
  }
  const on = state.phase === 'choose' && state.humanTurn;
  const sel = state.sel, who = state.who, grip = state.F.grip[who];
  const subOk = lay.bh >= 74 && lay.s <= 1.5;
  const kinds = [['pull', 'Pull', 'send them'], ['hook', 'Hook', 'beats a loaded foe'], ['brace', 'Root', 'soak a pull']];
  for (const [id, label, sub] of kinds) drawButton(ctx, lay.kinds[id], label, { active: sel.kind === id, dark: sel.kind !== id, disabled: !on, size, sub: subOk ? sub : null });
  for (let p = 1; p <= 3; p++) {
    const c = gripCost({ kind: sel.kind, pow: p }), bad = c > grip;
    drawButton(ctx, lay.pows[`p${p}`], POW_NAMES[p - 1], { active: sel.pow === p && !bad, dark: sel.pow !== p || bad, disabled: !on || bad, size, sub: subOk ? (c === 0 ? 'free' : `${c} grip`) : null });
  }
  const ready = on && sel.dir >= 0;
  const who2 = state.m.cfg.mode === 'two' ? ` · P${who + 1}` : '';
  drawButton(ctx, b.lock, `Lock in${who2}`, { primary: true, disabled: !ready, size });
  drawButton(ctx, b.think, 'Think', { dark: true, size, disabled: !on || state.m.cfg.mode === 'two' });
  drawButton(ctx, b.menu, 'Pause', { dark: true, size });
}

export const nextRect = (lay) => {
  const s = lay.stage, w = Math.min(420, s.w - 40), h = Math.max(66, Math.round(lay.fs * 2.4));
  return { x: s.x + s.w / 2 - w / 2, y: s.y + s.h - h - 14, w, h };
};

export function drawOverlays(ctx, state, lay) {
  const s = lay.stage, cx = s.x + s.w / 2, cy = s.y + s.h * 0.4;
  if (state.phase === 'ready') {
    const n = Math.ceil(state.ready), lab = n > 0 ? String(n) : 'Satba!';
    const u = state.ready - Math.floor(state.ready), size = Math.min(s.h * 0.46, 180) * (n > 0 ? 0.85 + 0.3 * (1 - u) : 0.6);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `italic 800 ${Math.round(size)}px ${SERIF}`;
    textShadow(ctx, lab, cx, cy, '#ffe3a0', 12); ctx.restore();
  }
  if (state.phase === 'reveal' && state.rep && state.revealT > 0.2 && !state.rep.over) {
    const mv = state.rep.moves;
    const txt = state.m.players.map((p, i) => `${p.name}: ${state.labels[i]}`);
    const px = Math.max(FLOOR, Math.round(lay.fs * 0.74));
    ctx.save(); ctx.font = `700 ${px}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    txt.forEach((l, i) => {
      const w = Math.min(s.w - 16, ctx.measureText(l).width + 30), y = s.y + 16 + i * px * 2.1;
      roundPath(ctx, cx - w / 2, y, w, px * 1.8, px * 0.9); ctx.fillStyle = 'rgba(28,18,12,0.78)'; ctx.fill();
      ctx.strokeStyle = SASH[i].sash; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#fff1d0'; ctx.fillText(l, cx, y + px * 0.92);
    });
    ctx.restore(); void mv;
  }
  if ((state.phase === 'fallen' || state.phase === 'end') && state.F.over) {
    const o = state.F.over, who = state.m.players[o.win].name, you = who === 'You';
    const headline = `${who} ${you ? 'put' : 'puts'} ${state.m.players[o.loser].name === 'You' ? 'you' : state.m.players[o.loser].name} on the sand`;
    const detail = `${o.name} · beat ${o.beats} · ${state.m.wins[0]} to ${state.m.wins[1]} in falls`;
    const bh = Math.round(lay.fs * 2.7), by = s.y + Math.max(Math.round(lay.fs * 1.9), s.h * 0.16);
    ctx.save();
    roundPath(ctx, s.x + 12, by - bh / 2, s.w - 24, bh, 22); ctx.fillStyle = 'rgba(28,18,12,0.86)'; ctx.fill();
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3; ctx.stroke();
    let px = Math.round(lay.fs * 1.1); ctx.font = `800 ${px}px ${FONT}`;
    while (ctx.measureText(headline).width > s.w - 60 && px > FLOOR) { px--; ctx.font = `800 ${px}px ${FONT}`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff1c0'; ctx.fillText(headline, cx, by - bh * 0.15);
    let p2 = Math.max(FLOOR, Math.round(lay.fs * 0.68)); ctx.font = `500 ${p2}px ${FONT}`;
    while (ctx.measureText(detail).width > s.w - 60 && p2 > FLOOR) { p2--; ctx.font = `500 ${p2}px ${FONT}`; }
    ctx.fillStyle = 'rgba(247,234,210,0.92)'; ctx.fillText(detail, cx, by + bh * 0.24);
    ctx.restore();
    if (state.phase === 'end' && state.endT > 0.7 && state.m.cfg.mode !== 'watch') drawButton(ctx, nextRect(lay), state.m.over ? 'See the result' : 'Next fall', { primary: true, size: Math.round(lay.fs * 1.1) });
  }
}

// "Pass the phone" cover for two players: hides the choice of the player who just locked in
export function drawCover(ctx, state, lay) {
  const s = lay.col, top = lay.hud.y, bottom = H;
  ctx.save();
  ctx.fillStyle = 'rgba(24,14,8,0.97)'; ctx.fillRect(s.x, top + lay.hud.h + 6, s.w, bottom - top - lay.hud.h - 6);
  const cx = s.x + s.w / 2, cy = (top + bottom) / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const p = state.m.players[state.who];
  const big = Math.round(lay.fs * 1.9);
  ctx.font = `800 ${big}px ${FONT}`; textShadow(ctx, `Pass to ${p.name}`, cx, cy - big, '#ffe3a0', 6);
  ctx.font = `500 ${Math.max(FLOOR, Math.round(lay.fs * 1.1))}px ${FONT}`; ctx.fillStyle = '#f7ead2';
  const lines = wrapLines(ctx, 'The other wrestler has locked in. Take the phone, keep it out of sight, then tap.', s.w - 80);
  lines.forEach((l, i) => ctx.fillText(l, cx, cy + i * lay.fs * 1.4));
  const r = { x: cx - Math.min(s.w - 60, 420) / 2, y: cy + lines.length * lay.fs * 1.4 + 24, w: Math.min(s.w - 60, 420), h: Math.max(70, Math.round(lay.fs * 2.4)) };
  drawButton(ctx, r, `I am ${p.name}`, { primary: true, size: Math.round(lay.fs * 1.1) });
  ctx.restore();
  return r;
}
export function coverRect(ctx, state, lay) {
  const s = lay.col, top = lay.hud.y, bottom = H, cx = s.x + s.w / 2, cy = (top + bottom) / 2;
  const w = Math.min(s.w - 60, 420);
  const lines = 2;
  return { x: cx - w / 2, y: cy + lines * lay.fs * 1.2 + 24, w, h: Math.max(70, Math.round(lay.fs * 2.4)) };
}

// A coach card at the bottom of the picture; tap it to read all of it.
export function cardRectFor(lay) {
  const s = lay.stage, h = Math.min(s.h * 0.62, Math.round(lay.fs * 6.6)), w = s.w - 24;
  const need = lay.cardNeed || h;
  const hh = Math.min(h, Math.max(Math.round(lay.fs * 3.2), need));
  return { x: s.x + 12, y: s.y + s.h - hh - 10, w, h: hh };
}
export function drawCard(ctx, state, lay) {
  const k = state.card; if (!k) return;
  const tp = Math.max(FLOOR, Math.round(lay.fs * 0.95)), bp = Math.max(FLOOR, Math.round(lay.fs * 0.74));
  ctx.save();
  ctx.font = `400 ${bp}px ${FONT}`;
  lay.cardNeed = 0;
  const w0 = lay.stage.w - 24;
  const lines = wrapLines(ctx, k.text, w0 - 32);
  lay.cardNeed = Math.round(14 + tp + bp * 1.35 + lines.length * bp * 1.3 + 12);
  const r = cardRectFor(lay);
  roundPath(ctx, r.x, r.y, r.w, r.h, 20); ctx.fillStyle = 'rgba(30,18,10,0.94)'; ctx.fill();
  ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.rect(r.x + 4, r.y + 4, r.w - 8, r.h - 8); ctx.clip();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let tpx = tp; ctx.font = `800 ${tpx}px ${FONT}`;
  while (tpx > FLOOR && ctx.measureText(k.title).width > r.w - 32) { tpx -= 1; ctx.font = `800 ${tpx}px ${FONT}`; }   // long titles shrink to fit the card
  ctx.fillStyle = '#ffd24a';
  ctx.fillText(k.title, r.x + 16, r.y + 10 + tp);
  ctx.font = `400 ${bp}px ${FONT}`; ctx.fillStyle = '#fbf1dc';
  let y = r.y + 14 + tp + bp * 1.35;
  const maxLines = Math.max(1, Math.floor((r.y + r.h - 8 - y) / (bp * 1.3)) + 1);
  lines.slice(0, maxLines).forEach((l, i) => {
    const last = i === maxLines - 1 && lines.length > maxLines;
    let txt = l;
    if (last) { // end the last visible line with a tap hint that always fits the card
      const tail = ' … (tap to read)';
      while (txt.length > 1 && ctx.measureText(txt + tail).width > r.w - 32) txt = txt.replace(/\s*\S+$/, '');
      txt = `${txt}${tail}`;
    }
    ctx.fillText(txt, r.x + 16, y); y += bp * 1.3;
  });
  ctx.restore();
}
export function drawToast(ctx, state, lay) {
  if (state.toastT <= 0 || !state.toast) return;
  const s = lay.stage, a = clamp(state.toastT / 0.4, 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  const px = Math.max(FLOOR, Math.round(lay.fs * 0.8));
  ctx.font = `700 ${px}px ${FONT}`;
  const lines = wrapLines(ctx, state.toast, s.w - 70), h = lines.length * px * 1.25 + 22, w = Math.min(s.w - 24, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36);
  roundPath(ctx, s.x + s.w / 2 - w / 2, s.y + s.h * 0.3, w, h, 16); ctx.fillStyle = 'rgba(28,18,12,0.88)'; ctx.fill();
  ctx.fillStyle = '#fbf1dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, s.x + s.w / 2, s.y + s.h * 0.3 + 11 + px * (0.95 + i * 1.25)));
  ctx.restore();
}
export { inRect, SAFE, W, H, DIR_NAMES };
