// The play screen furniture: header, buttons, count-in, the coach card and toasts. Pure drawing from state + layout.
import { playLayout, TEXT_SCALES, W, H } from './layout.js';
import { FONT, SERIF, roundPath, drawButton, wrapLines, FLOOR } from './ui.js';
import { TUNES } from './tunes.js';
import { LEAD } from './tunes.js';
import { progress, mult, PACES } from './sim.js';
import { THINK_STEPS } from './layout.js';
import { v3, active, toV } from './v3.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const layoutFor = (state) => playLayout(TEXT_SCALES[state.settings.textIdx], false, state.mode === 'watch');

export function drawHud(ctx, state, lay) {
  const S = state.S, hd = lay.hud, fs = lay.fs, tune = TUNES[S.tune];
  if (active()) v3.panels.push({ r: toV(ctx, { x: hd.x + 6, y: hd.y, w: hd.w - 12, h: hd.h }), rad: 18, fill: 'rgba(16,8,12,0.86)', clip: null, hud: true });
  else {
    roundPath(ctx, hd.x + 6, hd.y, hd.w - 12, hd.h, 18); ctx.fillStyle = 'rgba(16,8,12,0.86)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,205,130,0.4)'; ctx.lineWidth = 2; ctx.stroke();
  }
  const pad = 16, pxA = Math.max(FLOOR, Math.round(fs * 0.95));
  ctx.textBaseline = 'alphabetic';
  // line 1: tune name left, score right
  ctx.textAlign = 'left'; ctx.font = `800 ${pxA}px ${FONT}`; ctx.fillStyle = '#ffe9b8';
  let name = tune.name; const maxN = hd.w * 0.5;
  while (ctx.measureText(name).width > maxN && name.length > 4) name = name.slice(0, -2);
  ctx.fillText(name === tune.name ? name : `${name}…`, hd.x + pad, hd.y + pxA * 1.15);
  ctx.textAlign = 'right'; ctx.fillStyle = '#fff4dc'; ctx.fillText(String(S.score), hd.x + hd.w - pad, hd.y + pxA * 1.15);
  // line 2: progress bar + combo
  const by = hd.y + pxA * 1.6, bh = Math.max(10, Math.round(fs * 0.55));
  const sub = Math.max(FLOOR, Math.round(fs * 0.7));
  const cm = S.combo > 1 ? `x${mult(S.combo)}  ·  ${S.combo} in a row` : PACES[S.pace].name;
  ctx.font = `700 ${sub}px ${FONT}`; ctx.textAlign = 'right';
  const cw = ctx.measureText(cm).width + 6;
  const bw = hd.w - pad * 2 - cw - 12;
  roundPath(ctx, hd.x + pad, by + (sub - bh) * 0.4, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,230,190,0.15)'; ctx.fill();
  const p = progress(S);
  if (p > 0.005) { roundPath(ctx, hd.x + pad, by + (sub - bh) * 0.4, Math.max(bh, bw * p), bh, bh / 2); ctx.fillStyle = '#ffc95c'; ctx.fill(); }
  ctx.fillStyle = S.combo > 1 ? '#ffd890' : 'rgba(255,240,215,0.75)'; ctx.fillText(cm, hd.x + hd.w - pad, by + sub * 0.85);
}

export function drawButtons(ctx, state, lay) {
  const b = lay.btn, S = state.S;
  const size = Math.round(lay.fs * 1.0);
  if (state.mode === 'watch') {
    drawButton(ctx, b.pause, state.paused ? 'Resume' : 'Pause', { dark: true, size });
    drawButton(ctx, b.fast, state.ff ? 'x3 on' : 'x3', { dark: !state.ff, active: state.ff, size });
    drawButton(ctx, b.exit, 'Exit', { dark: true, size });
    drawButton(ctx, b.dec, 'Think −', { dark: true, size: Math.round(size * 0.9), disabled: state.settings.thinkIdx === 0 });
    drawButton(ctx, b.inc, `Think + (${THINK_STEPS[state.settings.thinkIdx]}s)`, { dark: true, size: Math.round(size * 0.9), disabled: state.settings.thinkIdx === THINK_STEPS.length - 1 });
  } else {
    drawButton(ctx, b.menu, 'Menu', { dark: true, size });
    drawButton(ctx, b.think, state.think ? 'Go on' : 'Think', { primary: !!state.think, active: !state.think, size });
  }
}

export function cardRectFor(lay) {
  const f = lay.field, h = Math.min(f.h * 0.5, Math.round(lay.fs * 6.3 + 60));
  const w = Math.min(f.w - 20, 640);
  return { x: f.x + (f.w - w) / 2, y: f.y + Math.round(lay.lab * 2.2), w, h };
}
export function drawCard(ctx, state, lay) {
  const k = state.card; if (!k) return;
  const r = cardRectFor(lay);
  roundPath(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = 'rgba(247,238,215,0.97)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#c8402a'; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const tp = Math.max(FLOOR, Math.round(lay.fs * 1.05)), bp = Math.max(FLOOR, Math.round(lay.fs * 0.82));
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#8a2a14'; ctx.font = `800 ${tp}px ${FONT}`;
  const tl = wrapLines(ctx, k.title, r.w - 28);
  tl.forEach((l, i) => ctx.fillText(l, r.x + 14, r.y + tp * (1.2 + i * 1.15)));
  ctx.fillStyle = '#2a1608'; ctx.font = `500 ${bp}px ${FONT}`;
  let y = r.y + tp * (1.2 + (tl.length - 1) * 1.15) + bp * 1.5;
  for (const l of wrapLines(ctx, k.text, r.w - 28)) { if (y > r.y + r.h - 6) break; ctx.fillText(l, r.x + 14, y); y += bp * 1.28; }
  ctx.restore();
  ctx.save(); ctx.font = `700 ${Math.max(FLOOR, Math.round(bp * 0.8))}px ${FONT}`; ctx.fillStyle = 'rgba(138,42,20,0.8)'; ctx.textAlign = 'right';
  ctx.fillText(state.think ? 'tap to go on' : 'tap for more', r.x + r.w - 12, r.y + r.h - 8); ctx.restore();
}

export function drawCountIn(ctx, state, lay) {
  const S = state.S;
  if (S.t >= LEAD || state.paused) return;
  const f = lay.field, left = LEAD - S.t, n = Math.ceil(left / (LEAD / 3));
  const ph = 1 - ((left / (LEAD / 3)) % 1 || 1);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = clamp(1.4 - ph, 0, 1);
  const sz = Math.round(Math.min(f.w * 0.5, 190) * (1 + 0.25 * ph));
  ctx.font = `800 ${sz}px ${SERIF}`; ctx.fillStyle = '#ffe9b8'; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 14;
  ctx.fillText(String(clamp(n, 1, 3)), f.x + f.w / 2, f.y + f.h * 0.4);
  ctx.restore();
}

export function drawToast(ctx, state, lay) {
  if (!(state.toastT > 0) || !state.toast) return;
  const p = lay.pic, px = Math.max(FLOOR, Math.round(lay.fs * 0.85));
  ctx.save(); ctx.font = `700 ${px}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = Math.min(p.w - 16, ctx.measureText(state.toast).width + 36), h = px * 1.9;
  ctx.globalAlpha = clamp(state.toastT * 2, 0, 1);
  roundPath(ctx, p.x + p.w / 2 - w / 2, p.y + p.h - h - 8, w, h, h / 2); ctx.fillStyle = 'rgba(16,8,12,0.82)'; ctx.fill();
  ctx.fillStyle = '#ffe9b8'; ctx.fillText(state.toast, p.x + p.w / 2, p.y + p.h - h / 2 - 8);
  ctx.restore();
}
