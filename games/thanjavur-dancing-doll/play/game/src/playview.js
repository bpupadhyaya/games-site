// The play screen and the pieces other screens reuse: the shelf of dolls, the tuning rail, the timeline.
import { PAL, UI, DISPLAY, TAU, clamp, drawRoom, drawShelf, drawParticles, rgba } from './art.js';
import { txt, button, panel, rrect, chip } from './ui.js';
import { dollSlots, inRect } from './layout.js';
import { drawDoll } from './doll.js';
import { v3 } from './v3.js';
import { PHASES, TOTAL, ghostAt, periodOf, ballastFor, liveSync, DEG, phaseName } from './sim.js';

export function newView() {
  return { t: 0, lag: [0, 0, 0], hist: new Array(Math.round(PHASES.HOLD / 0.5)).fill(-1), histAcc: [0, 0], parts: [], pops: [], banner: null, glow: [0, 0, 0], tapFx: [0, 0, 0], guide: [], shake: 0, lamp: 0, drag: -1 };
}

// ---- the tuning rail: a brass bead on a groove under each doll ------------------------------------------------------------------------
export function drawRail(ctx, r, b, o = {}) {
  const gh = r.h * 0.46, gy = r.y + (r.h - gh) / 2, rad = gh / 2, pad = r.h * 0.5, x0 = r.x + pad, x1 = r.x + r.w - pad;
  // groove
  ctx.fillStyle = '#2a1208'; rrect(ctx, { x: r.x, y: gy, w: r.w, h: gh }, rad); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, { x: r.x + 2, y: gy + 2, w: r.w - 4, h: gh * 0.5 }, rad); ctx.fill();
  // tuning mark: a brass inlay where the right swing speed sits
  if (o.mark > 0 && o.target != null) {
    const a = x0 + (x1 - x0) * clamp(o.target - o.mark, 0, 1), c = x0 + (x1 - x0) * clamp(o.target + o.mark, 0, 1);
    const pulse = o.hint ? 0.6 + 0.4 * Math.sin(o.t * 7) : 0;
    ctx.fillStyle = o.near ? '#7be0a2' : PAL.goldHi; rrect(ctx, { x: a, y: gy + 2, w: Math.max(8, c - a), h: gh - 4 }, rad - 2); ctx.fill();
    if (pulse) { ctx.strokeStyle = rgba('#ffffff', pulse); ctx.lineWidth = 3; rrect(ctx, { x: a - 3, y: gy - 1, w: Math.max(8, c - a) + 6, h: gh + 2 }, rad); ctx.stroke(); }
  } else if (o.hint && o.target != null) {
    const tx = x0 + (x1 - x0) * o.target;
    ctx.fillStyle = rgba('#ffffff', 0.6 + 0.4 * Math.sin(o.t * 7)); ctx.fillRect(tx - 3, gy - 3, 6, gh + 6);
  }
  ctx.strokeStyle = 'rgba(255,230,180,0.35)'; ctx.lineWidth = 1.5;
  for (let i = 0; i <= 10; i++) { const x = x0 + ((x1 - x0) * i) / 10; ctx.beginPath(); ctx.moveTo(x, gy + gh); ctx.lineTo(x, gy + gh + (i % 5 === 0 ? 7 : 4)); ctx.stroke(); }
  // bead
  const bx = x0 + (x1 - x0) * clamp(b, 0, 1), br = r.h * 0.4 * (o.drag ? 1.12 : 1), by = r.y + r.h / 2;
  const g = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.4, br * 0.1, bx, by, br * 1.1);
  g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, PAL.gold); g.addColorStop(1, PAL.goldDeep);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(bx, by + br * 0.85, br * 0.9, br * 0.28, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#6b3d06'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(107,61,6,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, by - br * 0.5); ctx.lineTo(bx, by + br * 0.5); ctx.stroke();
  if (o.label) txt(ctx, o.label, bx, r.y - 4, Math.max(20, r.h * 0.4), PAL.cream, { align: 'center', weight: 800, stroke: 6, strokeColor: 'rgba(40,16,6,0.85)', base: 'bottom' });
}

// ---- the timeline: build, hold, settle ----------------------------------------------------------------------------------------------
export function drawTimeline(ctx, r, t, hist, o = {}) {
  panel(ctx, r, { rad: 20 });
  const pad = 14, x0 = r.x + pad, w = r.w - pad * 2, y = r.y + r.h * 0.3, h = Math.max(16, r.h * 0.26);
  const segs = [['Build', PHASES.RAMP, '#f1b35a'], ['Hold', PHASES.HOLD, '#8fd0a8'], ['Settle', PHASES.SETTLE, '#8fb4e8'], ['', PHASES.REST, '#d8c8b0']];
  let x = x0;
  segs.forEach(([name, d, col], si) => {
    const sw = (w * d) / TOTAL;
    ctx.fillStyle = col; rrect(ctx, { x, y, w: sw - 3, h }, 6); ctx.fill();
    if (si === 1 && hist) {
      const n = hist.length, cw = (sw - 3) / n;
      for (let k = 0; k < n; k++) {
        const v = hist[k]; if (v < 0) continue;
        ctx.fillStyle = v > 0.66 ? PAL.good : v > 0.33 ? '#e7a21a' : PAL.warn;
        ctx.fillRect(x + k * cw, y + 2, Math.ceil(cw), h - 4);
      }
    }
    if (name) txt(ctx, name, x + (sw - 3) / 2, y + h + 14, Math.max(15, r.h * 0.2), PAL.dim, { align: 'center', weight: 700 });
    x += sw;
  });
  const px = x0 + (w * clamp(t, 0, TOTAL)) / TOTAL;
  ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.moveTo(px, y - 3); ctx.lineTo(px - 8, y - 14); ctx.lineTo(px + 8, y - 14); ctx.closePath(); ctx.fill();
  ctx.fillRect(px - 1.5, y - 3, 3, h + 6);
  void o;
}

// ---- the stage: room, shelf, rails, ghosts and dolls ------------------------------------------------------------------------------------
// o: { t, rails (draw tuning rails), tags, ghost: 'live' | 'preview' | 'none', hint (reveal), paint: [..] }
export function renderStage(ctx, stage, W, V, o = {}) {
  const L = W.L, n = L.n, D = dollSlots(stage, n, o.topPad ?? 64, { rails: o.rails, lean: o.lean }), t = o.t ?? V.t;
  const cap = o.v3 !== false && v3.on;
  v3.capture = cap;
  ctx.save();
  ctx.beginPath(); ctx.rect(stage.x, stage.y, stage.w, stage.h); ctx.clip();
  const sh = V.shake > 0 ? Math.sin(t * 60) * V.shake * 4 : 0;
  ctx.translate(sh, 0);
  const sync = liveSync(W);
  drawRoom(ctx, stage, D.gy, t, W.phase === 'run' ? V.lamp : 0);
  drawShelf(ctx, stage, D.gy, D.fh);
  if (cap && v3.stage) { v3.stage.shake = sh; v3.stage.n = n; }
  const run = W.phase === 'run' || W.phase === 'over';
  const ghostTh = [];
  if (o.ghost !== 'none') {
    for (let i = 0; i < n; i++) {
      const d = L.dolls[i];
      const gth = o.ghost === 'preview' || !run ? d.A * Math.sin(TAU * (V.t / d.T + d.ph)) : ghostAt(L, i, W.t).th;
      ghostTh[i] = gth;
      drawDoll(ctx, D.slots[i].cx, D.gy, D.R, { th: gth, lag: -gth * 0.35, ch: d.ch, variant: d.variant, ghost: true, alpha: o.ghostAlpha ?? 0.62 });
    }
  }
  for (let i = 0; i < n; i++) {
    const s = D.slots[i], o2 = W.dolls[i], d = L.dolls[i];
    const th = o2.th, sp = V.sp?.[i], lag = sp ? sp.h + ((V.lag[i] ?? 0) - th) * 0.5 : ((V.lag[i] ?? 0) - th) * 1.35;
    v3.capture = cap;
    drawDoll(ctx, s.cx, D.gy, D.R, { th, lag, torso: sp ? sp.q : undefined, ch: d.ch, variant: d.variant, paint: o.paint?.[i] ?? 3, glow: V.glow[i] ?? 0, tap: V.tapFx[i] ?? 0 });
    // target tag above the doll
    if (o.tags !== false) {
      const ty = Math.max(stage.y + 24, D.gy - D.R * 5.7 - 16);
      const tw = Math.min(s.w - 6, 230), sz = clamp(tw / 9, 14, 22);
      chip(ctx, s.cx, ty, `${D.stacked ? (i + 1) + '  ·  ' : ''}${d.T.toFixed(1)} s  ·  ${Math.round(d.A / DEG)}°`, sz, { align: 'center' });
    }
    if (o.rails !== false) {
      const near = Math.abs(o2.b - ballastFor(d.T)) < (L.mark || 0.05);
      drawRail(ctx, s.rail, o2.b, { target: ballastFor(d.T), mark: L.mark, near, drag: V.drag === i, label: D.stacked ? '' : `${periodOf(o2.b).toFixed(2)} s`, hint: o.hint, t });
      if (D.stacked) {
        // rail number, and the live swing time at its right end
        const r = s.rail, bc = r.h * 0.42, bx = r.x - bc * 1.3, by = r.y + r.h / 2;
        ctx.fillStyle = PAL.cream; ctx.beginPath(); ctx.arc(bx, by, bc, 0, TAU); ctx.fill(); ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2.5; ctx.stroke();
        txt(ctx, String(i + 1), bx, by + 1, bc * 1.3, PAL.text, { align: 'center', font: DISPLAY, weight: 400 });
        txt(ctx, `${periodOf(o2.b).toFixed(2)} s`, r.x + r.w - 6, r.y - 2, Math.max(15, r.h * 0.32), PAL.cream, { align: 'right', base: 'bottom', weight: 800, stroke: 5, strokeColor: 'rgba(40,16,6,0.85)' });
      }
    }
    // tap guide: a chevron on the side to tap
    const gd = V.guide[i];
    if (gd && o.guides) {
      const side = -gd.dir, gx = s.cx + side * D.R * 1.5, gyy = D.gy - D.R * 2.2, pul = 0.55 + 0.45 * Math.sin(t * 10);
      ctx.save(); ctx.translate(gx, gyy); ctx.globalAlpha = clamp(0.3 + gd.mag, 0.3, 1) * pul;
      ctx.fillStyle = PAL.vermilion; ctx.strokeStyle = PAL.cream; ctx.lineWidth = 3;
      const k = D.R * 0.42; ctx.beginPath(); ctx.moveTo(-gd.dir * k * -0.9, -k); ctx.lineTo(gd.dir * k * 0.9 + 0, 0); ctx.lineTo(-gd.dir * k * -0.9, k); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  drawParticles(ctx, V.parts);
  ctx.restore();
  v3.capture = false;
  return { D, sync };
}

export function popups(ctx, V, x, y) {
  for (const p of V.pops) {
    const a = clamp(1 - p.age / 0.9, 0, 1);
    ctx.save(); ctx.globalAlpha = Math.min(1, a * 2);
    txt(ctx, p.text, p.x ?? x, (p.y ?? y) - p.age * 60, p.size, p.col, { align: 'center', font: DISPLAY, weight: 400, stroke: 8, strokeColor: 'rgba(58,22,32,0.9)' });
    ctx.restore();
  }
}

const NOTE = {
  tune: 'Slide each bead to match its tag, then press Start.',
  ramp: 'Build the swing: tap the side the doll is leaving.',
  hold: 'Hold the sway: stay inside the ghost.',
  settle: 'Ease down with the ghost. Rest a finger to steady.',
  rest: 'Let the dolls come to rest.',
};

export function renderPlay(ctx, st, L, view, meta, pauseItems, drawPause) {
  const pl = st.pl, P = L.play, W = pl.W, V = pl.V, S = L.S;
  const wide = L.mode === 'wide';
  if (!v3.on) { ctx.fillStyle = '#f4ddb0'; ctx.fillRect(0, 0, L.w, L.h); }
  const reveal = pl.reveal || pl.hintT > 0;
  const info = renderStage(ctx, P.stage, W, V, { t: V.t, guides: pl.mode === 'practice' || !!pl.reveal || pl.hintT > 0, hint: reveal, ghost: W.phase === 'tune' ? 'preview' : 'live', paint: pl.paint });
  popups(ctx, V, P.stage.x + P.stage.w / 2, P.stage.y + P.stage.h * 0.3);
  if (V.banner) {
    const b = V.banner, a = clamp(Math.min(b.t / 0.15, (1.6 - b.t) / 0.4), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    txt(ctx, b.text, P.stage.x + P.stage.w / 2, P.stage.y + P.stage.h * 0.22, Math.min(56, P.stage.w / 9), b.kind === 'bad' ? PAL.warn : PAL.vermilion, { align: 'center', font: DISPLAY, weight: 400, stroke: 10, maxW: P.stage.w - 40 });
    ctx.restore();
  }
  // HUD
  const H = P.hud, sync = info.sync, pct = Math.round(sync * 100);
  const modeName = pl.mode === 'practice' ? 'Practice' : pl.mode === 'auto' ? 'Watch and Learn' : 'Play';
  panel(ctx, H, { rad: 20 });
  const lvlName = W.L.daily ? 'Daily Set' : `Level ${W.L.name}`;
  txt(ctx, lvlName, H.x + 16, H.y + (wide ? 30 : 28), wide ? 28 : 30, PAL.text, { weight: 800, font: DISPLAY, maxW: H.w - 150 });
  txt(ctx, modeName + (W.phase === 'tune' ? '' : '  ·  ' + { ramp: 'Build', hold: 'Hold', settle: 'Settle', rest: 'Rest' }[phaseName(W.t)] ?? ''), H.x + 16, H.y + (wide ? 62 : 54), 21, PAL.dim, { weight: 700, maxW: H.w - 30 });
  const mw = H.w - 32, my = H.y + H.h - 14;
  ctx.fillStyle = 'rgba(58,22,32,0.12)'; rrect(ctx, { x: H.x + 16, y: my - 5, w: mw, h: 10 }, 5); ctx.fill();
  ctx.fillStyle = pct > 66 ? PAL.good : pct > 33 ? '#e7a21a' : PAL.warn; rrect(ctx, { x: H.x + 16, y: my - 5, w: Math.max(10, mw * sync), h: 10 }, 5); ctx.fill();
  txt(ctx, `in time ${pct}%`, H.x + H.w - 16, H.y + (wide ? 30 : 28), 22, PAL.text, { align: 'right', weight: 800 });
  // buttons
  if (pl.mode === 'practice') button(ctx, P.hint, '', { icon: 'bulb', kind: 'quiet' });
  button(ctx, P.pause, '', { icon: 'pause', kind: 'ghost' });
  // timeline
  drawTimeline(ctx, P.bar, W.phase === 'tune' ? 0 : W.t, V.hist);
  // start / phase note
  const auto = pl.mode === 'auto';
  if (W.phase === 'tune') {
    if (!auto) button(ctx, P.start, 'Start swaying', { kind: 'primary', size: 34, icon: 'play' });
    else panel(ctx, P.start, { rad: 22 }), txt(ctx, pl.auto?.phase === 'act' ? 'Tuning the dolls...' : 'Watching the setup', P.start.x + P.start.w / 2, P.start.y + P.start.h / 2, 28, PAL.text, { align: 'center', weight: 800, maxW: P.start.w - 30 });
  } else {
    panel(ctx, P.start, { rad: 22 });
    const key = W.phase === 'over' ? 'rest' : phaseName(W.t);
    drawNote(ctx, P.start, NOTE[key], wide ? 22 : 24);
  }
  if (wide && P.note) {
    // the column has room: a reminder of how the controls work
    if (W.phase === 'run') {
      ctx.fillStyle = 'rgba(255,247,228,0.7)'; rrect(ctx, P.note, 18); ctx.fill();
      const rows = W.dolls.length, rh = Math.min(54, (P.note.h - 16) / rows);
      W.dolls.forEach((o, i) => {
        const y = P.note.y + 10 + i * rh + rh / 2, f = o.bandT > 0 ? o.syncT / o.bandT : 0;
        txt(ctx, String(i + 1), P.note.x + 22, y, 22, PAL.text, { font: DISPLAY, weight: 400 });
        ctx.fillStyle = 'rgba(58,22,32,0.12)'; rrect(ctx, { x: P.note.x + 44, y: y - 7, w: P.note.w - 130, h: 14 }, 7); ctx.fill();
        ctx.fillStyle = o.inBand ? PAL.good : '#e7a21a'; rrect(ctx, { x: P.note.x + 44, y: y - 7, w: Math.max(12, (P.note.w - 130) * f), h: 14 }, 7); ctx.fill();
        txt(ctx, `${Math.round(f * 100)}%`, P.note.x + P.note.w - 14, y, 20, PAL.text, { align: 'right', weight: 800 });
      });
    } else drawNote(ctx, P.note, 'Slide a bead to tune a doll.  Tap a doll to push it.  Hold a finger to steady it.', 21, true);
  }
  // Watch and Learn card (think / reveal)
  if (auto && pl.auto && pl.auto.phase !== 'act') drawThinkCard(ctx, st, L, pl, P);
  else if (pl.hintCard) drawHintCard(ctx, P, pl.hintCard);
  if (pl.paused) drawPause(ctx, st, L, pauseItems());
  void UI; void S; void view; void meta; void inRect;
}

function drawNote(ctx, r, text, size, soft) {
  if (soft) { ctx.fillStyle = 'rgba(255,247,228,0.7)'; rrect(ctx, r, 18); ctx.fill(); }
  ctx.save(); rrect(ctx, r, 18); ctx.clip();
  ctx.font = `600 ${size}px ${UI}`;
  const words = text.split(' '), lines = []; let line = '';
  for (const w of words) { const nx = line ? line + ' ' + w : w; if (line && ctx.measureText(nx).width > r.w - 28) { lines.push(line); line = w; } else line = nx; }
  lines.push(line);
  const lh = size * 1.3, y0 = r.y + r.h / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, y0 + i * lh, size, PAL.text, { align: 'center', weight: 700, maxW: r.w - 20 }));
  ctx.restore();
}

function drawThinkCard(ctx, st, L, pl, P) {
  const a = pl.auto, S = L.S;
  const w = Math.min(S.w - 40, 560), h = 148, x = P.stage.x + (P.stage.w - w) / 2, y = P.stage.y + 10;
  panel(ctx, { x, y, w, h }, { fill: 'rgba(255,247,228,0.97)', rad: 24 });
  const col = a.phase === 'think' ? PAL.cobalt : PAL.vermilion;
  txt(ctx, a.phase === 'think' ? `THINK  ${Math.ceil(a.timer)}` : 'REVEAL', x + 22, y + 32, 24, col, { weight: 800 });
  txt(ctx, a.title, x + 22, y + 70, 28, PAL.text, { font: DISPLAY, weight: 400, maxW: w - 44 });
  ctx.font = `600 21px ${UI}`;
  const tip = String(a.tip).split(' '), lines = []; let line = '';
  for (const wd of tip) { const nx = line ? line + ' ' + wd : wd; if (line && ctx.measureText(nx).width > w - 44) { lines.push(line); line = wd; } else line = nx; }
  lines.push(line);
  lines.slice(0, 2).forEach((ln, i) => txt(ctx, ln, x + 22, y + 104 + i * 26, 21, PAL.dim, { weight: 600, maxW: w - 44 }));
  // the thinking bar
  if (a.phase === 'think') {
    const f = clamp(a.timer / a.total, 0, 1);
    ctx.fillStyle = 'rgba(58,22,32,0.12)'; rrect(ctx, { x: x + w - 150, y: y + 24, w: 128, h: 12 }, 6); ctx.fill();
    ctx.fillStyle = PAL.cobalt; rrect(ctx, { x: x + w - 150, y: y + 24, w: Math.max(12, 128 * f), h: 12 }, 6); ctx.fill();
  }
}

function drawHintCard(ctx, P, card) {
  const w = Math.min(P.stage.w - 30, 560), h = 112, x = P.stage.x + (P.stage.w - w) / 2, y = P.stage.y + 10;
  panel(ctx, { x, y, w, h }, { fill: 'rgba(255,247,228,0.97)', rad: 22 });
  txt(ctx, card.title, x + 20, y + 34, 26, PAL.text, { font: DISPLAY, weight: 400, maxW: w - 40 });
  ctx.font = `600 21px ${UI}`;
  const words = card.tip.split(' '), lines = []; let line = '';
  for (const wd of words) { const nx = line ? line + ' ' + wd : wd; if (line && ctx.measureText(nx).width > w - 40) { lines.push(line); line = wd; } else line = nx; }
  lines.push(line);
  lines.slice(0, 2).forEach((ln, i) => txt(ctx, ln, x + 20, y + 68 + i * 26, 21, PAL.dim, { weight: 600, maxW: w - 40 }));
}
