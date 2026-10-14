// The play screen: header card, the wall with its marks and rings, pigment pots, tools and the three buttons.
import { FR, playLayout, topSafe } from './layout.js';
import { FONT, NUM, C, panel, roundPath, drawButton, wrapLines, paintButton } from './ui.js';
import { drawBackdrop, drawPanel, drawWall, drawJar, drawClothIcon, drawUndoIcon, drawBrushTip, drawFx, TAU } from './art.js';
import { PIGMENTS, KIND_INFO, paletteOf, SHIELD_WARN } from './sim.js';
import { v3 } from './v3.js';

export const guideOn = (state) => !!(state.run.cfg.guide || state.settings.guide);
export const PHASE_NAME = { paint: 'PAINT', rain: 'RAIN', repair: 'REPAIR', verdict: 'CHECK' };

// Fit wrapped text into a box by shrinking the font; returns the lines and size used.
function fitText(ctx, text, w, h, max, min, weight = 400) {
  for (let s = max; s >= min; s -= 1) {
    ctx.font = `${weight} ${s}px ${FONT}`;
    const lines = wrapLines(ctx, text, w);
    if (lines.length * s * 1.22 <= h) return { lines, s };
  }
  ctx.font = `${weight} ${min}px ${FONT}`;
  const lines = wrapLines(ctx, text, w);
  const cap = Math.max(1, Math.floor(h / (min * 1.22)));
  return { lines: lines.slice(0, cap), s: min };
}

export function hudText(state) {
  const run = state.run, k = KIND_INFO[run.cfg.kind];
  let body;
  if (run.ph === 'verdict') body = 'The elder is checking the wall, cell by cell.';
  else if (run.watch && run.caption) body = run.caption;
  else if (run.hint) body = run.hint.text;
  else if (run.ph === 'rain') body = 'Rain! Tap each ring before the drop lands to glaze the cell.';
  else if (run.ph === 'repair') body = 'The rain has passed. Repaint what was washed, then tap Done.';
  else body = k.brief;
  return { title: `${run.cfg.name}  ·  ${k.name}`, body };
}

export function renderPlay(ctx, state, o = {}) {
  const run = state.run, wall = run.wall, pal = paletteOf(wall), L = playLayout(pal.length);
  const mood = run.ph === 'rain' ? 1 : run.ph === 'repair' ? 2 : 0;
  v3.phase = run.ph;
  if (!v3.on) drawBackdrop(ctx, FR.w, FR.h, state.t, mood, run.rain ? run.rain.t : 0);
  const bare = v3.on && o.bare;     // pause menu over the 3D wall: the wall only, the modal brings its own plaques

  // ---- header card
  const hud = L.hud, tx = hud.x + 18, tw = hud.w - 36;
  const txt = hudText(state);
  if (!bare) {
    panel(ctx, hud.x, hud.y, hud.w, hud.h, { r: 18 });
    ctx.save();
    const chip = PHASE_NAME[run.watch && run.ph === 'paint' ? 'paint' : run.ph] || '';
    ctx.font = `800 20px ${NUM}`; const cw = ctx.measureText(chip).width + 22;
    const chipR = { x: hud.x + hud.w - cw - 14, y: hud.y + 12, w: cw, h: 32 };
    if (v3.on) v3.buttons.push({ r: chipR, kind: run.ph === 'rain' ? 'chipRain' : run.ph === 'repair' ? 'chipRepair' : 'chipPaint', clip: null });
    else { ctx.fillStyle = run.ph === 'rain' ? '#5a7ea8' : run.ph === 'repair' ? '#7a9a4a' : C.clay; roundPath(ctx, chipR.x, chipR.y, chipR.w, chipR.h, 10); ctx.fill(); }
    ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(chip, chipR.x + cw / 2, chipR.y + 16);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const top0 = hud.y + (v3.on ? 6 : 0), statsH = 36, avail = hud.y + hud.h - top0 - statsH - 6;
    // title and brief share what is left of the card: the largest title size at which the whole brief still fits
    let tf, bf, bodyTop;
    for (const s of [32, 28, 25, 22, 20, 18, 17]) {
      tf = fitText(ctx, txt.title, tw - cw - 8, 1e9, s, s, 800);
      const titleH = 20 + tf.lines.length * s * 1.18, area = avail - titleH - 6;
      bf = fitText(ctx, txt.body, tw, Math.max(0, area), 30, 15, 400);
      bodyTop = top0 + titleH + 6;
      if (area >= 18 && bf.lines.length * bf.s * 1.22 <= area + 1) break;
    }
    ctx.font = `800 ${tf.s}px ${FONT}`; ctx.fillStyle = '#ffe3a0';
    tf.lines.forEach((l, k) => ctx.fillText(l, tx, top0 + 20 + tf.s * (0.7 + k * 1.18)));
    ctx.font = `400 ${bf.s}px ${FONT}`; ctx.fillStyle = 'rgba(255,243,214,0.96)';
    bf.lines.forEach((l, i) => ctx.fillText(l, tx, bodyTop + bf.s * (1 + i * 1.22) - bf.s * 0.2));
    // Strokes / Par (or Shielded / Washed in the rain): small caps label then a big number
    const strokes = run.paintStrokes + run.repairStrokes;
    const segs = run.ph === 'rain' ? [['SHIELDED', run.shields], ['WASHED', run.washed]] : [['STROKES', strokes], ['PAR', wall.par]].concat(run.shields ? [['SHIELDED', run.shields]] : []);
    let sx = tx; const sy = hud.y + hud.h - 14;
    for (const [lab, val] of segs) {
      ctx.font = `700 18px ${NUM}`; ctx.fillStyle = 'rgba(255,226,160,0.85)'; ctx.fillText(lab, sx, sy); sx += ctx.measureText(lab).width + 8;
      ctx.font = `900 34px ${NUM}`; ctx.fillStyle = lab === 'STROKES' && strokes > wall.par + 1 ? '#ffb199' : '#ffe3a0'; ctx.fillText(String(val), sx, sy + 1); sx += ctx.measureText(String(val)).width + 22;
    }
    ctx.restore();
  }

  // ---- the wall
  const wetPhase = run.ph === 'rain';
  const showCursor = run.cursor && !run.watch && (run.ph === 'paint' || run.ph === 'repair' || run.ph === 'rain') && !bare ? run.cursor : null;
  if (!v3.on) drawPanel(ctx, L.wall.frame, { wet: wetPhase });
  drawWall(ctx, wall, L.wall, run.cells, {
    three: true, cursor: showCursor,
    glaze: run.glaze, guide: guideOn(state) && (run.ph === 'paint' || run.ph === 'repair'), t: state.t, wet: wetPhase,
    hintIdx: run.hint ? run.hint.idx : run.ai && run.ai.plan && (run.ai.ph === 'reveal' || run.ai.ph === 'act') ? run.ai.plan.idx : null,
    hintColor: run.hint ? run.hint.color : run.ai && run.ai.plan ? run.ai.plan.color : 0,
    wrong: run.ph === 'verdict' ? run.wrong : null,
  });
  if (bare) return;
  drawRain(ctx, state, L);
  if (!v3.on) drawFx(ctx, state.fx);
  for (const f of state.floats) {
    const k = f.t / f.life;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.font = `900 ${f.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(30,10,0,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(f.text, f.x, f.y - k * 40); ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, f.y - k * 40); ctx.restore();
  }
  if (run.banner) {
    const b = run.banner, k = Math.min(1, b.t / 0.25), out = Math.max(0, (b.t - (b.life - 0.4)) / 0.4);
    const sz = Math.round(Math.min(64, L.wall.frame.w * 0.11)), cx = L.wall.frame.x + L.wall.frame.w / 2, cy = L.wall.frame.y + L.wall.frame.h * 0.5;
    ctx.save(); ctx.globalAlpha = (1 - out) * k; ctx.translate(cx, cy); if (!v3.on) ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
    ctx.font = `900 ${sz}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(ctx.measureText(b.text).width + 60, L.wall.frame.w);
    if (v3.on) { if (out < 0.9 && k > 0.1) v3.panels.push({ r: { x: cx - w / 2, y: cy - sz * 0.9, w, h: sz * (b.sub ? 2.1 : 1.5) }, rad: 20, kind: 'plaque', front: true, clip: null }); }
    else { roundPath(ctx, -w / 2, -sz * 0.9, w, sz * (b.sub ? 2.1 : 1.5), 20); ctx.fillStyle = 'rgba(28,12,4,0.82)'; ctx.fill(); }
    ctx.fillStyle = b.col; ctx.fillText(b.text, 0, -sz * 0.15, w - 20);
    if (b.sub) { ctx.font = `700 ${Math.round(sz * 0.38)}px ${FONT}`; ctx.fillStyle = '#fff1d2'; ctx.fillText(b.sub, 0, sz * 0.62, w - 20); }
    ctx.restore();
  }

  // ---- pots and tools
  const lockTools = run.ph === 'rain' || run.ph === 'verdict' || run.watch;
  pal.forEach((c, k) => {
    const r = L.pots[k], sel = run.sel === c && !lockTools, cap = wall.cap[c], left = run.pig[c];
    const bad = run.bad && run.bad.c === c ? run.bad.t : 0;
    drawPot(ctx, r, PIGMENTS[c], left, cap, sel, lockTools, bad, c, !!(run.stroke && run.stroke.col === c));
  });
  drawTool(ctx, L.cloth, 'Wipe', run.sel === 0 && !lockTools, lockTools, (cx, cy, s) => drawClothIcon(ctx, cx, cy, s, run.sel === 0));
  drawTool(ctx, L.undo, 'Undo', false, lockTools || !run.hist.length, (cx, cy, s) => drawUndoIcon(ctx, cx, cy, s, lockTools || !run.hist.length));

  // ---- buttons
  if (run.watch) {
    drawButton(ctx, L.think, state.paused ? 'Resume' : 'Pause', { primary: true, size: 28 });
    drawButton(ctx, L.pause, 'Leave', { size: 28 });
    drawButton(ctx, L.done, 'Watching', { disabled: true, size: 26 });
  } else {
    const noThink = run.ph === 'rain' || run.ph === 'verdict';
    drawButton(ctx, L.think, run.hint ? 'Paint it' : 'Think', { disabled: noThink, primary: !!run.hint, size: 28 });
    drawButton(ctx, L.pause, 'Pause', { size: 28 });
    const label = run.ph === 'rain' ? 'Rain…' : run.doneArm > 0 ? 'Sure?' : run.ph === 'repair' ? 'Finish' : 'Done';
    drawButton(ctx, L.done, label, { disabled: run.ph === 'rain' || run.ph === 'verdict', primary: run.doneArm > 0, size: 28 });
  }

  // ---- brush under the finger (3D: the painter's hand carries the brush there)
  if (run.stroke && state.pointer && !run.watch) {
    if (v3.on) v3.stroke = { x: state.pointer.x, y: state.pointer.y, color: run.sel };
    else drawBrushTip(ctx, state.pointer.x, state.pointer.y, run.sel, Math.max(10, L.wall.cs * 0.28));
  }
  if (!v3.on && run.cursor && !run.watch && (run.ph === 'paint' || run.ph === 'repair' || run.ph === 'rain')) {
    const { cs, ox, oy } = L.wall, c = run.cursor;
    ctx.save(); ctx.lineWidth = 3.5; ctx.strokeStyle = '#fff8d6'; roundPath(ctx, ox + c.x * cs + 2, oy + c.y * cs + 2, cs - 4, cs - 4, cs * 0.14); ctx.stroke(); ctx.restore();
  }
}

function drawRain(ctx, state, L) {
  const run = state.run;
  if (run.drips && !v3.on) {
    const { cs, ox, oy } = L.wall;
    for (const d of run.drips) {
      const k = d.t / 1.5, x = ox + (d.i % run.wall.W + 0.5) * cs, y = oy + (Math.floor(d.i / run.wall.W) + 0.5) * cs;
      const len = cs * (0.5 + 1.3 * Math.min(1, k * 1.5));
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.lineCap = 'round'; ctx.lineWidth = cs * 0.2; ctx.strokeStyle = '#b87c4c'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(d.i) * 3, y + len); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + Math.sin(d.i) * 3, y + len, cs * 0.14, 0, TAU); ctx.fillStyle = '#b87c4c'; ctx.fill();
      ctx.restore();
    }
  }
  if (run.ph !== 'rain' || !run.rain) return;
  const { cs, ox, oy } = L.wall, W = run.wall.W;
  // the storm timer above the wall
  const fr = L.wall.frame, k = Math.min(1, run.rain.t / run.rain.dur);
  ctx.fillStyle = 'rgba(10,20,40,0.45)'; roundPath(ctx, fr.x, fr.y - 24, fr.w, 8, 4); ctx.fill();
  ctx.fillStyle = '#8fb8e6'; roundPath(ctx, fr.x, fr.y - 24, Math.max(8, fr.w * k), 8, 4); ctx.fill();
  for (const d of run.rain.drops) {
    if (d.st !== 'warn' || v3.on) continue;
    const cx = ox + (d.i % W + 0.5) * cs, cy = oy + (Math.floor(d.i / W) + 0.5) * cs, f = Math.min(1, (run.rain.t - d.t0) / d.warn);
    const pulse = 0.5 + 0.5 * Math.sin(state.t * 14);
    // the drop falls from above the wall onto the cell
    const sy = fr.y - 30, dy = sy + (cy - sy) * f * f;
    ctx.save();
    ctx.strokeStyle = 'rgba(210,230,255,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, dy - 30); ctx.lineTo(cx, dy); ctx.stroke();
    ctx.fillStyle = '#d6ecff'; ctx.beginPath(); ctx.ellipse(cx, dy + 3, 6, 9, 0, 0, TAU); ctx.fill();
    // warning ring that closes in
    const rr = cs * (0.78 - 0.3 * f);
    ctx.lineWidth = 4 + pulse * 2; ctx.strokeStyle = `rgba(255,${Math.round(210 - 120 * f)},${Math.round(140 - 90 * f)},0.95)`;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, cs * 0.36, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - f)); ctx.stroke();
    ctx.restore();
  }
}

function drawPot(ctx, r, pg, left, cap, selected, locked, bad, color, dip) {
  const empty = left <= 0;
  ctx.save();
  const lift = selected ? 6 : 0, wide = r.w > r.h * 1.35;
  if (v3.on) {
    // a plaster tile under a lathe-turned clay pot; the pigment level is the glossy pool inside it
    v3.panels.push({ r: { x: r.x, y: r.y - lift * 0.5, w: r.w, h: r.h }, rad: 16, kind: selected ? 'title' : 'plaque', clip: null });
    v3.pots.push({ r: { x: r.x, y: r.y - lift * 0.5, w: r.w, h: r.h }, color, fill: cap ? left / cap : 0, sel: selected, locked: locked || empty, dip });
    if (bad > 0) { roundPath(ctx, r.x, r.y, r.w, r.h, 16); ctx.fillStyle = `rgba(255,60,30,${0.4 * Math.min(1, bad * 2)})`; ctx.fill(); }
  } else {
    roundPath(ctx, r.x, r.y - lift, r.w, r.h, 16);
    ctx.fillStyle = selected ? 'rgba(224,169,90,0.28)' : 'rgba(30,14,6,0.55)'; ctx.fill();
    ctx.lineWidth = selected ? 4 : 2; ctx.strokeStyle = selected ? '#ffe3a0' : 'rgba(255,230,190,0.28)'; ctx.stroke();
    if (bad > 0) { roundPath(ctx, r.x, r.y - lift, r.w, r.h, 16); ctx.fillStyle = `rgba(255,60,30,${0.45 * Math.min(1, bad * 2)})`; ctx.fill(); }
    const js = wide ? Math.min(r.h * 1.15, r.w * 0.42) : Math.min(r.w * 1.15, r.h * 1.0);
    const jx = wide ? r.x + r.w * 0.26 : r.x + r.w * 0.42, jy = wide ? r.y - lift + r.h * 0.5 : r.y - lift + r.h * 0.42;
    drawJar(ctx, jx, jy, js, pg, cap ? left / cap : 0, { dim: locked || empty });
  }
  const ly = v3.on ? -lift * 0.5 : -lift;
  ctx.fillStyle = empty ? '#ff9a80' : '#fff4dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(Math.min(30, r.h * 0.26))}px ${NUM}`;
  ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(20,8,2,0.85)';
  if (wide) { ctx.strokeText(`${pg.short}  ${left}`, r.x + r.w * 0.72, r.y + ly + r.h * 0.5, r.w * 0.5); ctx.fillText(`${pg.short}  ${left}`, r.x + r.w * 0.72, r.y + ly + r.h * 0.5, r.w * 0.5); }
  else { ctx.strokeText(String(left), r.x + r.w / 2, r.y + ly + r.h * 0.88); ctx.fillText(String(left), r.x + r.w / 2, r.y + ly + r.h * 0.88); }
  ctx.restore();
}

function drawTool(ctx, r, label, active, disabled, icon) {
  paintButton(ctx, r, { active, disabled, dark: !active });
  ctx.save();
  const wide = r.w > r.h * 1.35;
  icon(wide ? r.x + r.w * 0.28 : r.x + r.w / 2, wide ? r.y + r.h / 2 : r.y + r.h * 0.4, Math.min(r.h * 0.8, r.w * 0.8));
  ctx.fillStyle = disabled ? 'rgba(255,255,255,0.4)' : '#fff4dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${Math.round(Math.min(26, r.h * 0.23))}px ${NUM}`;
  ctx.fillText(label, wide ? r.x + r.w * 0.68 : r.x + r.w / 2, wide ? r.y + r.h / 2 : r.y + r.h * 0.86);
  ctx.restore();
}
export { SHIELD_WARN, topSafe };
