// The play screen furniture: scoreboard, meters, buttons, the pull pad, the countdown and the bout-end banner, the coach card.
// Pure drawing from state + layout; game.js owns every decision.
import { SAFE, W, H, inRect, TEXT_SCALES, playLayout } from './layout.js';
import { FONT, SERIF, C, roundPath, drawButton, wrapLines, textShadow, panel, FLOOR } from './ui.js';
import { drawCompass, lookFor } from './view.js';
import { BOUT_TIME, TARGET_POINTS, GOLDEN_TIME, len } from './sim.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mono = (n) => `${Math.max(0, Math.ceil(n))}`;

export const layoutFor = (state) => playLayout(TEXT_SCALES[state.settings.textIdx], state.m.cfg.mode === 'two', state.m.cfg.mode === 'watch');

function bar(ctx, x, y, w, h, v, col, label, pct, hot, t) {
  roundPath(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(4,10,34,0.66)'; ctx.fill();
  const fw = Math.max(h, w * clamp(v, 0, 1));
  if (v > 0.001) {
    roundPath(ctx, x, y, fw, h, h / 2);
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    ctx.fillStyle = g; ctx.fill();
  }
  if (hot) { ctx.save(); roundPath(ctx, x, y, w, h, h / 2); ctx.strokeStyle = `rgba(255,90,70,${0.5 + 0.5 * Math.sin(t * 12)})`; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); }
  else { roundPath(ctx, x, y, w, h, h / 2); ctx.strokeStyle = 'rgba(190,230,235,0.35)'; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.save();
  const px = Math.max(FLOOR, Math.round(h * 0.62));
  ctx.font = `700 ${px}px ${FONT}`; ctx.textBaseline = 'middle';
  const need = ctx.measureText(`${label}  ${pct}`).width + h * 1.1;
  ctx.fillStyle = '#f4faf6'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 3;
  if (need <= w) { ctx.textAlign = 'left'; ctx.fillText(label, x + h * 0.55, y + h / 2 + 1); ctx.textAlign = 'right'; ctx.fillText(pct, x + w - h * 0.5, y + h / 2 + 1); }
  else { ctx.textAlign = 'center'; ctx.fillText(pct, x + w / 2, y + h / 2 + 1); }
  ctx.restore();
}
export function drawHud(ctx, state, lay) {
  const m = state.m, B = state.B, hd = lay.hud, fs = lay.fs;
  const names = m.players.map((p) => p.name);
  roundPath(ctx, hd.x + 6, hd.y, hd.w - 12, hd.h, 18); ctx.fillStyle = 'rgba(6,14,44,0.86)'; ctx.fill();
  ctx.strokeStyle = 'rgba(120,160,235,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  const pad = 16, namePx = Math.max(FLOOR, Math.round(fs * 0.92));
  ctx.textBaseline = 'alphabetic';
  const colW = (hd.w - 24) * 0.3;
  const nameFit = (txt, px, maxW) => { let p = px; ctx.font = `800 ${p}px ${FONT}`; while (ctx.measureText(txt).width > maxW && p > FLOOR) { p--; ctx.font = `800 ${p}px ${FONT}`; } return p; };
  const kit = (i) => lookFor(i, state.looks[i]).kit;
  ctx.fillStyle = kit(0); ctx.beginPath(); ctx.arc(hd.x + pad + namePx * 0.4, hd.y + namePx * 1.05, namePx * 0.36, 0, TAU); ctx.fill();
  nameFit(names[0], namePx, colW - namePx);
  ctx.textAlign = 'left'; ctx.fillStyle = '#f3f6ff'; ctx.fillText(names[0], hd.x + pad + namePx * 0.95, hd.y + namePx * 1.22);
  ctx.fillStyle = kit(1); ctx.beginPath(); ctx.arc(hd.x + hd.w - pad - namePx * 0.4, hd.y + namePx * 1.05, namePx * 0.36, 0, TAU); ctx.fill();
  nameFit(names[1], namePx, colW - namePx);
  ctx.textAlign = 'right'; ctx.fillStyle = '#f3f6ff'; ctx.fillText(names[1], hd.x + hd.w - pad - namePx * 0.95, hd.y + namePx * 1.22);
  // centre: the points, then the clock
  const left = Math.max(0, B.limit - B.t);
  ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(fs * 1.3)}px ${FONT}`; ctx.fillStyle = '#ffe27a';
  ctx.fillText(`${B.side[0].pts} : ${B.side[1].pts}`, hd.x + hd.w / 2, hd.y + namePx * 1.22);
  ctx.font = `700 ${Math.max(FLOOR, Math.round(fs * 0.62))}px ${FONT}`;
  ctx.fillStyle = B.golden ? '#ffb892' : left < 10 && state.phase === 'fight' ? '#ffd24a' : 'rgba(238,244,255,0.88)';
  const clock = state.phase === 'ready' ? `${BOUT_TIME}` : `${Math.max(0, Math.ceil(left))}`;
  ctx.fillText(B.golden ? `Golden throw  ${clock}` : `${clock} s`, hd.x + hd.w / 2, hd.y + hd.h - 11);
  // bout pips: bouts won of three
  const need = 2, pr = Math.max(7, fs * 0.28), py = hd.y + hd.h - pr - 9;
  for (let i = 0; i < 2; i++) {
    for (let k = 0; k < need; k++) {
      const x = i === 0 ? hd.x + pad + pr + k * pr * 2.8 : hd.x + hd.w - pad - pr - k * pr * 2.8;
      ctx.beginPath(); ctx.arc(x, py, pr, 0, TAU);
      if (k < m.wins[i]) { ctx.fillStyle = '#ffd24a'; ctx.fill(); } else { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.stroke(); }
    }
  }
}

export function drawMeters(ctx, state, lay) {
  const B = state.B, mt = lay.meters, lab = lay.lab, t = state.t;
  const g = 8, colW = (mt.w - g) / 2, bh = Math.round(lab * 1.5);
  let y = mt.y + 4;
  for (let i = 0; i < 2; i++) {
    const s = B.side[i], x = mt.x + i * (colW + g);
    const bal = Math.max(0, 1 - len(s.b));
    bar(ctx, x, y, colW, bh, s.grip, ['#ffe27a', '#e0a82a'], 'GRIP', `${Math.round(s.grip * 100)}%`, s.grip < 0.18, t);
    bar(ctx, x, y + bh + 5, colW, bh, bal, ['#8fe0ff', '#3b8fd8'], 'BALANCE', `${Math.round(bal * 100)}%`, bal < 0.25, t);
  }
  y += bh * 2 + 14;
  const px = Math.max(FLOOR, Math.round(lab * 0.95));
  ctx.save(); ctx.font = `600 ${px}px ${FONT}`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
  const a = B.side[0].warn, b = B.side[1].warn;
  const scale = `Chala 1 · Yonbosh 2 · Halal wins`;
  ctx.fillStyle = 'rgba(232,240,255,0.92)';
  let fit = px; while (ctx.measureText(scale).width > mt.w && fit > FLOOR) { fit--; ctx.font = `600 ${fit}px ${FONT}`; }
  ctx.fillText(scale, mt.x + mt.w / 2, y + fit);
  ctx.font = `500 ${Math.max(FLOOR, Math.round(px * 0.9))}px ${FONT}`; ctx.fillStyle = a || b ? '#ffcf8a' : 'rgba(200,215,245,0.7)';
  ctx.fillText(`Passivity warnings: ${a} · ${b}`, mt.x + mt.w / 2, y + fit + px * 1.25);
  ctx.restore();
}

export function drawButtons(ctx, state, lay) {
  const b = lay.btn, st = state, size = Math.max(FLOOR + 4, Math.round(lay.fs * 0.95));
  if (b.menu) drawButton(ctx, b.menu, 'Pause', { dark: true, size });
  if (b.think) drawButton(ctx, b.think, 'Think', { primary: true, size, disabled: state.m.cfg.mode !== 'ai' || state.phase !== 'fight' || state.B.pause > 0 });
  if (b.pause) drawButton(ctx, b.pause, state.paused ? 'Resume' : 'Pause', { dark: true, size });
  if (b.fast) drawButton(ctx, b.fast, state.ff ? 'Speed x3' : 'Speed x1', { dark: !state.ff, active: state.ff, size });
  if (b.exit) drawButton(ctx, b.exit, 'Exit', { dark: true, size });
  if (b.dec) drawButton(ctx, b.dec, 'Think −', { dark: true, size, disabled: state.settings.thinkIdx === 0 });
  if (b.inc) drawButton(ctx, b.inc, 'Think +', { dark: true, size, disabled: state.settings.thinkIdx >= 3 });
}

// The pull pad: a compass (or two) that shows the drag being made, and a floating ring where the thumb is.
export function drawPad(ctx, state, lay) {
  const p = lay.pad, B = state.B;
  if (p.h < 90) return;
  const two = state.m.cfg.mode === 'two', watch = state.m.cfg.mode === 'watch';
  roundPath(ctx, p.x, p.y, p.w, p.h, 24); ctx.fillStyle = 'rgba(6,14,44,0.6)'; ctx.fill();
  ctx.strokeStyle = 'rgba(120,160,235,0.45)'; ctx.lineWidth = 2; ctx.stroke();
  const lp = Math.max(FLOOR, Math.round(lay.fs * 0.78));
  const spots = two ? [{ side: 0, cx: p.x + p.w * 0.25, w: p.w * 0.5 }, { side: 1, cx: p.x + p.w * 0.75, w: p.w * 0.5 }] : [{ side: 0, cx: p.x + p.w / 2, w: p.w }];
  for (const sp of spots) {
    const r = Math.min(sp.w * 0.34, (p.h - lp * 3.4) / 2, 150);
    if (r < 36) continue;
    const cy = p.y + p.h / 2 + lp * 0.5;
    if (state.settings.compass !== false) {
      const c = B.side[sp.side].cmd;
      drawCompass(ctx, sp.cx, cy, r, { x: c.x, y: c.y });
    }
    ctx.font = `700 ${lp}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(238,244,255,0.94)';
    let cap = watch ? `${state.m.players[sp.side].name}'s thumb` : two ? `${state.m.players[sp.side].name}: your half` : 'Move your thumb to tug. Flick and lift to throw.';
    let px = lp; ctx.font = `700 ${px}px ${FONT}`; while (ctx.measureText(cap).width > sp.w - 16 && px > FLOOR) { px--; ctx.font = `700 ${px}px ${FONT}`; }
    if (ctx.measureText(cap).width > sp.w - 16 && !watch && !two) { cap = 'Tug, flick, throw'; px = lp; ctx.font = `700 ${px}px ${FONT}`; while (ctx.measureText(cap).width > sp.w - 16 && px > FLOOR) { px--; ctx.font = `700 ${px}px ${FONT}`; } }
    ctx.fillText(cap, sp.cx, p.y + lp * 1.35);
  }
}
// floating rings for every finger currently dragging (drawn over everything in play)
export function drawFingers(ctx, state) {
  for (const f of state.fingers) {
    if (!f.on) continue;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,226,120,0.85)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(f.ox, f.oy, 46, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,226,120,0.25)'; ctx.beginPath(); ctx.arc(f.ox, f.oy, 46, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,226,120,0.9)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(f.ox, f.oy); ctx.lineTo(f.x, f.y); ctx.stroke();
    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(f.x, f.y, 18, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// "3, 2, 1, Pull!" and the bout end banner
export const nextRect = (lay) => {
  const s = lay.stage, w = Math.min(420, s.w - 40), h = Math.max(70, Math.round(lay.fs * 2.4));
  return { x: s.x + s.w / 2 - w / 2, y: s.y + s.h - h - 14, w, h };
};
const KIND_WORD = { chala: 'Chala', yonbosh: 'Yonbosh', halal: 'Halal' };
export function drawOverlays(ctx, state, lay) {
  const s = lay.stage, B = state.B, cx = s.x + s.w / 2, cy = s.y + s.h * 0.42, by = s.y + Math.max(Math.round(lay.fs * 1.9), s.h * 0.14);
  if (state.phase === 'ready') {
    const n = Math.ceil(state.ready), lab = n > 0 ? String(n) : 'GRIP!';
    const u = state.ready - Math.floor(state.ready), size = Math.min(s.h * 0.4, 170) * (0.85 + 0.3 * (1 - u));
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `italic 800 ${Math.round(size)}px ${SERIF}`;
    textShadow(ctx, lab, cx, cy, '#ffe27a', 12); ctx.restore();
    if (state.m.cfg.mode !== 'watch') {
      ctx.save(); ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(FLOOR, Math.round(lay.fs * 0.9))}px ${FONT}`;
      textShadow(ctx, 'Take the belt grip. Move to tug, flick and lift to throw.', cx, s.y + s.h - 18, '#f3f6ff', 6); ctx.restore();
    }
  }
  if (state.phase === 'fight' && B.pause > 0 && B.last && !B.over) {
    const l = B.last, who = state.m.players[l.side].name;
    const word = l.how === 'passive' ? 'Passivity: +1' : `${KIND_WORD[l.kind] || ''}!`;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const px = Math.max(FLOOR + 6, Math.round(lay.fs * 1.5));
    ctx.font = `italic 800 ${px}px ${SERIF}`;
    textShadow(ctx, word, cx, by, '#ffe27a', 10);
    ctx.font = `600 ${Math.max(FLOOR, Math.round(lay.fs * 0.78))}px ${FONT}`;
    textShadow(ctx, l.how === 'passive' ? `to ${who}` : `${who}`, cx, by + px * 0.8, '#f3f6ff', 6);
    ctx.restore();
  }
  if (state.phase === 'end' && B.over) {
    const o = B.over, you = state.m.players[o.win].name, me = you === 'You';
    const headline = o.how === 'halal' ? `${you} ${me ? 'throw' : 'throws'} a perfect halal!` : o.how === 'points' ? `${you} ${me ? 'reach' : 'reaches'} ${TARGET_POINTS} points` : o.how === 'golden' ? `${you} ${me ? 'take' : 'takes'} the golden throw` : `${you} ${me ? 'win' : 'wins'} on the judges' decision`;
    ctx.save();
    const bh = Math.round(lay.fs * 2.6);
    roundPath(ctx, s.x + 12, by - bh / 2, s.w - 24, bh, 22); ctx.fillStyle = 'rgba(6,14,44,0.88)'; ctx.fill();
    ctx.strokeStyle = o.win === 0 || state.m.cfg.mode === 'two' ? '#ffd24a' : 'rgba(180,200,240,0.7)'; ctx.lineWidth = 3; ctx.stroke();
    let px = Math.round(lay.fs * 1.15); ctx.font = `800 ${px}px ${FONT}`;
    while (ctx.measureText(headline).width > s.w - 60 && px > FLOOR) { px--; ctx.font = `800 ${px}px ${FONT}`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff3b0';
    ctx.fillText(headline, cx, by - bh * 0.12);
    ctx.font = `500 ${Math.max(FLOOR, Math.round(lay.fs * 0.7))}px ${FONT}`; ctx.fillStyle = 'rgba(238,244,255,0.92)';
    ctx.fillText(`${B.side[0].pts} to ${B.side[1].pts} in points · ${state.m.wins[0]} to ${state.m.wins[1]} in bouts`, cx, by + bh * 0.26);
    ctx.restore();
    if (state.endT > 0.7 && state.m.cfg.mode !== 'watch') drawButton(ctx, nextRect(lay), state.m.over ? 'See the result' : 'Next bout', { primary: true, size: Math.round(lay.fs * 1.1) });
  }
}

// A coach card at the bottom of the stage; tap it to read all of it.
export function cardRectFor(lay) {
  const s = lay.stage, h = Math.min(s.h * 0.5, Math.round(lay.fs * 6.2)), w = s.w - 24;
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
  roundPath(ctx, r.x, r.y, r.w, r.h, 20); ctx.fillStyle = 'rgba(6,14,44,0.94)'; ctx.fill();
  ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.rect(r.x + 4, r.y + 4, r.w - 8, r.h - 8); ctx.clip();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let tpx = tp; ctx.font = `800 ${tpx}px ${FONT}`;
  while (tpx > FLOOR && ctx.measureText(k.title).width > r.w - 32) { tpx -= 1; ctx.font = `800 ${tpx}px ${FONT}`; }   // long titles shrink to fit the card
  ctx.fillStyle = '#ffd24a';
  ctx.fillText(k.title, r.x + 16, r.y + 10 + tp);
  ctx.font = `400 ${bp}px ${FONT}`; ctx.fillStyle = '#eef6f2';
  let y = r.y + 14 + tp + bp * 1.35;
  const maxLines = Math.max(1, Math.floor((r.y + r.h - 8 - y) / (bp * 1.3)) + 1);
  lines.slice(0, maxLines).forEach((l, i) => {
    const last = i === maxLines - 1 && lines.length > maxLines;
    let txt = l;
    if (last) { // end the last visible line with a tap hint that always fits the card
      const tail = ' … (tap to read)'; txt = l;
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
  roundPath(ctx, s.x + s.w / 2 - w / 2, s.y + 10, w, h, 16); ctx.fillStyle = 'rgba(6,14,44,0.88)'; ctx.fill();
  ctx.fillStyle = '#f3f8f2'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, s.x + s.w / 2, s.y + 10 + 11 + px * (0.95 + i * 1.25)));
  ctx.restore();
}
export { inRect, SAFE, W, H, C };
