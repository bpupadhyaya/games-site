// The play screen: the stall, the tank with its fish and the paper poi, and the HUD around it. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, playLayout, tankRect, tankToScreen } from './layout.js';
import { TW, TH, POI_R, FISH, TANKS, GRADES, LIFT_T, SHEETS, NEW_SHEET_T } from './sim.js';
import { THEMES, drawFishShape, drawPoi, drawWater, drawRipple, drawTankFrame, drawStall, drawBowl, drawFishIcon, roundRectPath } from './art.js';
import { FONT, DISPLAY, C, drawButton, textShadow, wrapLines, ease, lacquer } from './ui.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;

export const layoutOf = (state) => playLayout(Math.min(1.6, TEXT_SCALES[state.settings.textIdx]), !!(state.run && state.run.mode === 'watch'));

// ---- the world (tank units) --------------------------------------------------------------------------------------------------
// ctx is already translated and scaled to tank units and clipped to the water.
function drawFish(ctx, f, t) {
  const spec = FISH[f.k], L = spec.len * f.size * 1.3, bob = f.rest > 0 ? 1 + Math.sin(t * 2.2 + f.id) * 0.015 : 1, boost = f.flee > 0 ? 1 : Math.min(1, f.s / 160);
  // shadow on the tank floor
  ctx.save(); ctx.translate(f.x + 11, f.y + 16); ctx.rotate(f.h); ctx.globalAlpha = 0.16; ctx.scale(1, 0.9);
  ctx.beginPath(); ctx.ellipse(0, 0, L * 0.5, L * 0.2, 0, 0, TAU); ctx.fillStyle = '#031428'; ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.h); ctx.scale(bob, bob);
  drawFishShape(ctx, f.k, L, f.ph, boost, 0.96);
  ctx.restore();
}

export function drawWorld(ctx, tr, w, theme, t, fx, o = {}) {
  const th = THEMES[theme] ?? THEMES[0];
  const rr = o.bare ? 0 : drawTankFrame(ctx, tr, th);
  ctx.save();
  roundRectPath(ctx, tr.x, tr.y, tr.w, tr.h, rr); ctx.clip();
  ctx.translate(tr.x, tr.y);
  if (tr.rot) { ctx.translate(TH * tr.s, 0); ctx.rotate(Math.PI / 2); }
  ctx.scale(tr.s, tr.s);
  const ha = tr.rot ? -0.14 * Math.PI : 0.36 * Math.PI;
  drawWater(ctx, th, t);
  if (fx) for (const rp of fx.ripples) drawRipple(ctx, rp, t);
  for (const f of w.fish) drawFish(ctx, f, t);
  const P = w.poi;
  if (!o.noPoi) {
    if (P.lift) {
      const p = Math.min(1, P.lift.t / (P.lift.dur || LIFT_T)), e = ease.outCubic(p);
      drawPoi(ctx, P.x, P.y, { paper: P.paper, wet: P.wet, scale: 1 + 0.4 * e, alpha: 1 - 0.55 * p * p, lift: e, ha });
      P.lift.items.forEach((it, i) => {
        const a = i * 2.1 + w.t * 7;
        ctx.save(); ctx.translate(P.x + Math.cos(a) * 14, P.y + Math.sin(a) * 10); ctx.rotate(a * 0.5); ctx.scale(1 + 0.4 * e, 1 + 0.4 * e);
        drawFishShape(ctx, it.k, FISH[it.k].len * 1.05, w.t * 12 + i, 1, 1 - 0.7 * p * p); ctx.restore();
      });
    } else if (P.down) {
      drawPoi(ctx, P.x, P.y, { paper: P.paper, wet: P.wet, scale: 1, ha });
    } else if (!w.over && P.hold <= 0 && o.hover) {
      drawPoi(ctx, P.x, P.y, { paper: P.paper, wet: 0, scale: 1.15, alpha: 0.4, shadow: false, ha });
    }
  }
  if (fx) {
    for (const d of fx.drops) { const a = 1 - d.t / d.max; ctx.globalAlpha = Math.max(0, a); ctx.beginPath(); ctx.arc(d.x, d.y, d.r * (0.6 + a * 0.5), 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill(); }
    for (const b of fx.bits) { const a = 1 - b.t / b.max; ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillStyle = '#fff6df'; ctx.fillRect(-9, -5, 18, 10); ctx.restore(); }
    ctx.globalAlpha = 1;
  }
  // Think: a pulsing ring on the suggested fish
  if (o.hint) {
    const f = w.fish.find((q) => q.id === o.hint.id);
    if (f) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      ctx.beginPath(); ctx.arc(f.x, f.y, 62 + pulse * 12, 0, TAU); ctx.lineWidth = 6; ctx.strokeStyle = `rgba(255,224,110,${0.6 + 0.35 * pulse})`; ctx.setLineDash([16, 12]); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

// ---- HUD -----------------------------------------------------------------------------------------------------------------------
function hudText(ctx, text, x, y, size, o = {}) {
  ctx.font = `${o.weight ?? 700} ${size}px ${o.font ?? FONT}`; ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = o.base ?? 'middle';
  if (o.shadow !== false) textShadow(ctx, text, x, y, o.col ?? '#fff6e6', 5); else { ctx.fillStyle = o.col ?? '#fff6e6'; ctx.fillText(text, x, y); }
}
// The bowl: with the 3D scene it is a porthole (the canvas is punched through and the presenter renders the glass bowl
// into v3.bowl); otherwise the flat bowl is drawn.
function bowlAt(ctx, cx, cy, br, caught, t) {
  if (!v3.on) { drawBowl(ctx, cx, cy, br, caught, t); return; }
  const R = br * 1.04;
  v3.bowl = { x: cx - R, y: cy - R, w: 2 * R, h: 2 * R };
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createLinearGradient(cx, cy - R, cx, cy + R); g.addColorStop(0, '#fff0b0'); g.addColorStop(0.5, '#a8741e'); g.addColorStop(1, '#ffe7a0');
  ctx.beginPath(); ctx.arc(cx, cy, R + 3, 0, TAU); ctx.arc(cx, cy, R - 1, 0, TAU, true); ctx.fillStyle = g; ctx.fill('evenodd');
  ctx.restore();
}
function chip(ctx, r) { lacquer(ctx, r, 'slate', { r: Math.min(18, r.h / 2), edge: 2.5 }); }

export function renderPlay(ctx, state) {
  const L = layoutOf(state), w = state.ws, run = state.run, th = TANKS[w.tank].id, t = state.t;
  const watch = run.mode === 'watch', P = w.poi;
  const tr = tankRect(L.stage);
  state.tr = tr;
  if (!v3.on) { drawStall(ctx, 0, 0, W, H, THEMES[th], t); drawWorld(ctx, tr, w, th, t, state.fx, { hover: !watch, hint: state.hint }); }

  // flights of caught fish toward the bowl
  for (const fl of state.fx.flights) {
    const p = Math.min(1, fl.t / fl.max), e = ease.inOut(p), bx = L.bowl.x + Math.min(70, L.bowl.h * 0.6), by = L.bowl.y + L.bowl.h / 2;
    const x = fl.x0 + (bx - fl.x0) * e, y = fl.y0 + (by - fl.y0) * e - Math.sin(p * Math.PI) * 60;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(by - fl.y0, bx - fl.x0) + Math.PI / 2 * 0); ctx.globalAlpha = 1 - p * p * 0.5;
    drawFishShape(ctx, fl.k, FISH[fl.k].len * tr.s * (1 - 0.35 * p), state.t * 12, 1); ctx.restore();
  }

  // score
  chip(ctx, L.score);
  const fs = L.fs;
  hudText(ctx, run.mode === 'free' ? `${w.caught.length}` : `${w.score}`, L.score.x + L.score.w / 2, L.score.y + L.score.h * 0.42, fs.big, { font: DISPLAY, weight: 800, col: '#ffd97a' });
  const sub = run.mode === 'free' ? 'fish scooped (all released)' : w.over ? 'finished' : `sheet ${Math.min(w.sheetNo + 1, w.sheets)} of ${w.sheets}`;
  hudText(ctx, sub, L.score.x + L.score.w / 2, L.score.y + L.score.h - fs.small * 1.15, fs.small, { weight: 600, col: 'rgba(255,240,220,0.85)' });

  // buttons
  if (!watch) {
    drawButton(ctx, L.pause, 'Pause', { dark: true, size: fs.btn });
    drawButton(ctx, L.think, state.hint ? 'Hide' : 'Think', { dark: true, size: fs.btn, active: !!state.hint });
  } else {
    const D = L.demo, st = state.settings, dis = st.thinkIdx;
    drawButton(ctx, D.dec, '−', { dark: true, size: fs.btn, disabled: dis === 0 });
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: fs.btn });
    drawButton(ctx, D.inc, '+', { dark: true, size: fs.btn, disabled: dis >= 3 });
    drawButton(ctx, D.exit, 'Exit', { dark: true, size: fs.btn });
  }

  // paper strip: sheets, wear gauge, combo
  const G = L.gauge; chip(ctx, G);
  const nS = w.endless ? 1 : w.sheets, pad = 14, iconR = Math.min(G.h * 0.3, 22);
  for (let i = 0; i < nS; i++) {
    const cx = G.x + pad + iconR + i * (iconR * 2 + 8), cy = G.y + G.h / 2, used = i < w.sheetNo, cur = i === w.sheetNo && !w.over;
    ctx.beginPath(); ctx.arc(cx, cy, iconR, 0, TAU); ctx.fillStyle = used ? 'rgba(255,255,255,0.12)' : cur ? '#fff6df' : 'rgba(255,246,223,0.5)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = used ? 'rgba(255,255,255,0.3)' : '#d83a22'; ctx.stroke();
    if (used) { ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - iconR * 0.6, cy - iconR * 0.3); ctx.lineTo(cx + iconR * 0.1, cy + iconR * 0.1); ctx.lineTo(cx + iconR * 0.5, cy + iconR * 0.5); ctx.stroke(); }
  }
  const bx = G.x + pad + nS * (iconR * 2 + 8) + 4, comboW = Math.round(fs.lab * 3.4), bw = Math.max(40, G.x + G.w - pad - comboW - bx), bh = Math.max(14, G.h * 0.32), by = G.y + G.h / 2 - bh / 2;
  roundRectPath(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
  const frac = Math.max(0, Math.min(1, P.paper)), col = frac > 0.55 ? '#6fe0a0' : frac > 0.28 ? '#ffd36a' : '#ff6a4a';
  if (frac > 0.01) { roundRectPath(ctx, bx, by, Math.max(bh, bw * frac), bh, bh / 2); ctx.fillStyle = col; ctx.fill(); }
  if (P.wet > 0.02) { roundRectPath(ctx, bx, by + bh * 0.62, Math.max(bh * 0.4, bw * P.wet), bh * 0.3, bh * 0.15); ctx.fillStyle = 'rgba(150,220,255,0.75)'; ctx.fill(); }
  hudText(ctx, 'PAPER LEFT', bx + bw / 2, by - fs.lab * 0.15 - 2, Math.max(10, Math.round(fs.lab * 0.55)), { weight: 700, col: 'rgba(255,240,220,0.7)', shadow: false, base: 'bottom' });
  const mult = w.streak > 1 ? 1 + 0.25 * Math.min(4, w.streak - 1) : GRADES[w.grade].mult;
  const cx2 = G.x + G.w - pad - comboW / 2;
  hudText(ctx, `x${mult.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')}`, cx2, G.y + G.h * 0.4, fs.lab, { weight: 800, col: w.streak > 1 ? '#ffd97a' : '#fff6e6' });
  hudText(ctx, w.streak > 1 ? 'COMBO' : 'PAPER', cx2, G.y + G.h * 0.76, Math.max(10, Math.round(fs.lab * 0.55)), { weight: 700, col: 'rgba(255,240,220,0.7)', shadow: false });

  // bowl row (a tall panel in landscape stacks the bowl above its text)
  const B = L.bowl; chip(ctx, B);
  const kinds = new Set(w.caught).size;
  const line1 = `Bowl: ${w.caught.length} fish`;
  const line2 = run.mode === 'free' ? 'Everything goes back' : `${kinds} kind${kinds === 1 ? '' : 's'} · best scoop ${w.bestScoop}`;
  if (B.h > B.w * 0.55) {
    const br = Math.min(B.w * 0.3, (B.h - fs.mid * 4.2) * 0.5, 120);
    bowlAt(ctx, B.x + B.w / 2, B.y + 14 + br, br, w.caught, state.t);
    hudText(ctx, line1, B.x + B.w / 2, B.y + 24 + br * 2 + fs.mid * 0.8, fs.mid, { col: '#fff6e6' });
    hudText(ctx, line2, B.x + B.w / 2, B.y + 24 + br * 2 + fs.mid * 0.8 + fs.small * 1.7, fs.small, { weight: 600, col: 'rgba(255,240,220,0.8)' });
    const ic = Math.min(30, B.w / 9), n = Math.min(7, w.caught.length), y0 = B.y + B.h - ic * 0.9;
    if (y0 > B.y + 24 + br * 2 + fs.mid * 2.6 + fs.small * 2) for (let i = 0; i < n; i++) drawFishIcon(ctx, w.caught[w.caught.length - 1 - i], B.x + B.w / 2 + (i - (n - 1) / 2) * ic * 1.15, y0, ic, state.t);
  } else {
    const br = Math.min(B.h * 0.4, 150);
    bowlAt(ctx, B.x + 18 + br, B.y + B.h / 2, br, w.caught, state.t);
    const tx = B.x + 18 + br * 2 + 18;
    hudText(ctx, line1, tx, B.y + B.h * 0.34, fs.mid, { align: 'left', col: '#fff6e6' });
    hudText(ctx, line2, tx, B.y + B.h * 0.68, fs.small, { align: 'left', weight: 600, col: 'rgba(255,240,220,0.8)' });
    const ic = Math.min(56, B.h * 0.3), n = Math.min(7, Math.floor((B.x + B.w - tx - 200) / (ic * 1.2)));
    for (let i = 0; i < n && i < w.caught.length; i++) drawFishIcon(ctx, w.caught[w.caught.length - 1 - i], B.x + B.w - 24 - i * ic * 1.25 - ic * 0.5, B.y + B.h / 2, ic, state.t);
  }

  // pops and banners
  for (const p of state.pops) {
    const a = p.t / p.max, sp = tankToScreen(tr, p.x, p.y), x = sp.x, y = sp.y - 24 - a * 60;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - a * a); hudText(ctx, p.text, x, y, Math.round(34 * p.size), { font: DISPLAY, weight: 800, col: p.col }); ctx.restore();
  }
  if (state.banner) {
    const b = state.banner, a = b.t / b.max, k = a < 0.12 ? ease.outBack(a / 0.12) : 1, o = a > 0.8 ? 1 - (a - 0.8) / 0.2 : 1;
    ctx.save(); ctx.globalAlpha = o; ctx.translate(tr.x + tr.w / 2, tr.y + tr.h * 0.3); ctx.scale(k, k);
    hudText(ctx, b.text, 0, 0, Math.round(Math.min(86, tr.w * 0.12)), { font: DISPLAY, weight: 800, col: b.col });
    hudText(ctx, b.sub, 0, Math.min(56, tr.w * 0.08), Math.round(Math.max(18, fs.mid)), { weight: 700, col: '#fff6e6' });
    ctx.restore();
  }
  // Think text, Watch & Learn status
  if (state.hint) drawNote(ctx, tr, state.hint.why, '#ffe9a0');
  else if (watch && state.dec) {
    const d = state.dec, left = Math.max(0, d.dur - d.t);
    const msg = d.phase === 'think' ? `Thinking… ${Math.ceil(left)} s` : d.phase === 'reveal' ? `Choosing: ${d.why}` : 'Scooping';
    drawNote(ctx, tr, msg, '#ffe9a0');
  } else if (state.toastT > 0 && state.toast) drawNote(ctx, tr, state.toast, '#fff6e6');
  if (state.paused && watch) {
    ctx.fillStyle = 'rgba(10,8,34,0.35)'; ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
    hudText(ctx, 'Paused', tr.x + tr.w / 2, tr.y + tr.h / 2, 64, { font: DISPLAY, weight: 800, col: '#fff6e6' });
  }
  void NEW_SHEET_T; void SHEETS; void POI_R; void TW; void TH; void C; void wrapLines; void run;
}

function drawNote(ctx, tr, text, col) {
  const size = Math.max(15, Math.round(tr.w * 0.034)), pad = 12;
  ctx.font = `700 ${size}px ${FONT}`;
  const lines = wrapLines(ctx, text, tr.w - 60), h = lines.length * size * 1.25 + pad * 2, w = Math.min(tr.w - 24, Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2 + 6);
  const x = tr.x + (tr.w - w) / 2, y = tr.y + tr.h - h - 12;
  roundRectPath(ctx, x, y, w, h, 14); ctx.fillStyle = 'rgba(16,12,46,0.82)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,224,150,0.5)'; ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, tr.x + tr.w / 2, y + pad + size * 0.65 + i * size * 1.25));
}
