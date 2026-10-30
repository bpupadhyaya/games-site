// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, titleLayout, docLayout, settingsLayout, listLayout, quiltRects, tierRects, overLayout, pauseLayout, centerCard, patchGeo, TEXT_SCALES, host, R, clamp, grid } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, plaque, embossText, bead, button, rr, txt, para, paraHeight, wrap, F, mix, rgba, icons, UI, NUM, threadColor, THREAD_NAMES, lookKey, setPress } from './ui.js';
import { v3, clothCamera, clothToScreen } from './v3.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke } from './brand.js';
import { walk, previewStep, sewPoint, patch, RHYTHM, CHAPTERS, bestFinish, pointAt, STITCH } from './engine.js';
import { FACTS, TIER_TEXT, DOCS } from './content.js';
import { drawCloth, chalkRun, threadRun, floatLine, marker, glyph, needle, threadBar, miniPatch, sewnLine, dashesFor } from './art.js';

export const metrics = { max: 0, view: 0, rect: null };   // scroll body of the current screen, filled in each frame
export const SETTINGS = [
  { id: 'look', label: 'Cloth', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'marks', label: 'Colour marks', opts: ['Off', 'On'] },
  { id: 'floats', label: 'Back threads', opts: ['Show', 'Hide'] },
  { id: 'guide', label: 'Path check', opts: ['Off', 'On'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore'] },
];
// The rows shown: no Purchases row in the web demo (nothing can be bought there); its button reflects ownership / busy.
export const settingRows = (s) => SETTINGS.filter((r) => r.id !== 'restore' || !s.demo).map((r) => (r.id !== 'restore' ? r
  : { ...r, label: s.restoreMsg || 'Purchases', opts: [s.owned ? 'Full game unlocked' : s.restoreBusy ? 'Checking...' : 'Restore purchase'] }));
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'marks': return p.marks ? 1 : 0;
    case 'floats': return p.floats ? 0 : 1;
    case 'guide': return p.guide ? 1 : 0;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return -1;
  }
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);
const fmt1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const fmtT = (t) => { const x = Math.max(0, Math.floor(t)); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; };

export function render(ctx, s, view) {
  const w = view.width, h = view.height, T = theme();
  v3.W = w; v3.H = h; v3.frame = null; v3.gauge = null; v3.dim = 0; setPress(s.press);
  background(ctx, w, h, s.prefs.calm ? 0 : s.t);
  metrics.max = 0; metrics.rect = null;
  const sc = s.scene;
  const backdrop = v3.on && ['quilt', 'tiers', 'doc', 'settings', 'stats', 'demo-limit'].includes(sc);
  if (backdrop) { ctx.fillStyle = 'rgba(14,7,3,0.52)'; ctx.fillRect(0, 0, w, h); }
  if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'steady') drawSteady(ctx, s, w, h);
  else if (sc === 'quilt') drawQuilt(ctx, s, w, h);
  else if (sc === 'tiers') drawTiers(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'stats') drawStats(ctx, s, w, h);
  else if (sc === 'over') drawOver(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  if (v3.on && !v3.frame) v3.frame = backdropFrame(s, w, h);
  if (s.sceneT < 0.25 && sc !== 'play' && sc !== 'steady') { ctx.fillStyle = rgba(T.bg1, 1 - smooth(s.sceneT / 0.25)); ctx.fillRect(0, 0, w, h); }
}
// The calm scene behind the text pages and lists: the lotus patch, fully sewn, on the table with its props.
function backdropFrame(s, w, h) {
  const P = patch(2, 0), side = Math.min(w, h) * 0.9, rect = R((w - side) / 2, Math.max(0, (h - side) * 0.42), side, side);
  const fr = newFrame(s, { size: 10, rect }, P.runs, 'title|lotus|bd');
  P.runs.forEach((run, ri) => { fr.sewn.push({ id: `${ri}:0`, dashes: dashesFor(run, 0), upTo: 1e9, slot: run.color, run, ri }); fr.targets.push([ri, 1]); });
  fr.props = true; fr.backdrop = true; fr.puck = 1;
  return fr;
}

function drawSparks(ctx, s) {
  for (const sp of s.sparks) {
    ctx.globalAlpha = clamp(1 - sp.t / sp.life, 0, 1); ctx.fillStyle = sp.c;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ================================================================ the patch =================================================================
const endAngle = (run, o) => {
  const p0 = sewPoint(run, o, Math.max(0, run.len - 0.3)), p1 = sewPoint(run, o, run.len);
  const a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  return Number.isFinite(a) ? a : 0;
};
// Draws the cloth, every row (sewn, sewing or chalk), markers and the needle for a session. With the 3D scene behind the canvas
// (v3.on) this builds the scene description for the presenter (v3.frame) and only paints what stays flat: colour marks, the cost chip,
// sparks. Without WebGL the same description is painted with the flat art.
function drawPatchScene(ctx, s, geo, B, o = {}) {
  const P = B.P, T = theme(), st = walk(P, B.steps), a = B.anim;
  const done = B.done, prog = B.steps.length / P.runs.length;
  const puck = done ? smooth(1 - Math.max(0, s.winT - 0.4) / 2.8) : prog * 0.45;
  const sewn = new Map();
  B.steps.forEach((step, k) => { const op = P.opts[step.g]; sewn.set(op.run, { op, idx: P.runs[op.run].opts.indexOf(op), k }); });
  const on = v3.on;
  const fr = on ? newFrame(s, geo, P.runs, `${B.kind}|${B.ref}|${P.runs.length}|${P.C}`) : null;
  if (!on) drawCloth(ctx, geo, { puck: s.prefs.calm ? puck * 0.7 : puck, t: s.t, seed: P.runs.length });
  // chalk rows first
  for (const run of P.runs) {
    const glow = !!(s.hl && s.hl.run === run.i) || B.sel !== null && P.opts[B.sel].run === run.i;
    if (!sewn.has(run.i)) { if (on) fr.chalk.push({ dashes: dashesFor(run, 0), tint: threadColor(run.color), ri: run.i, glow }); else chalkRun(ctx, geo, run, { glow }); }
  }
  // back threads (floats) between rows of the same thread
  if (s.prefs.floats) {
    for (let k = 1; k < B.steps.length; k++) {
      const lg = st.log[k];
      if (lg && !lg.nw) {
        const a0 = P.opts[B.steps[k - 1].g], b0 = P.opts[B.steps[k].g], al = k === B.steps.length - 1 && a ? 0.7 * Math.min(1, a.hop) : 0.38;
        if (on) fr.floats.push({ ax: a0.to[0], ay: a0.to[1], bx: b0.from[0], by: b0.from[1], slot: b0.color, alpha: al }); else floatLine(ctx, geo, a0.to, b0.from, b0.color, al);
      }
    }
  }
  // sewn rows
  for (const [ri, v] of sewn) {
    const run = P.runs[ri];
    let upTo = 1e9;
    if (a && a.g === v.op.g) upTo = a.hop < 1 ? 0 : a.u;
    if (upTo > 0) {
      if (on) {
        const u = Math.min(upTo, run.len);
        fr.sewn.push({ id: `${ri}:${v.idx}`, dashes: dashesFor(run, v.idx), upTo: u >= run.len - 1e-6 ? 1e9 : u, slot: run.color, run, ri });
        fr.targets.push([ri, Math.min(1, u / run.len)]);
        if (u >= run.len - 1e-6) { const c = fr.chalk.findIndex((q) => q.ri === ri); if (c >= 0) fr.chalk.splice(c, 1); }
        else fr.chalk.push({ dashes: dashesFor(run, 0), tint: threadColor(run.color), ri, glow: false });
      } else threadRun(ctx, geo, run, v.idx, upTo, run.color);
    }
  }
  if (s.prefs.marks) for (const run of P.runs) {
    const mid = pointAt(run, run.len * 0.5), c = geo.P(mid[0], mid[1], 0.004), r = Math.max(8, geo.k(mid[0], mid[1]) * 0.2);
    ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.25, 0, 7); ctx.fillStyle = rgba(T.patch0, 0.92); ctx.fill();
    glyph(ctx, c.x, c.y, r, run.color, T.dark ? T.ink : '#222');
  }
  // markers for rows not yet sewn
  const mr = Math.max(7, geo.s * 0.17);
  if (!done) for (const run of P.runs) if (!sewn.has(run.i)) {
    for (const op of run.opts) {
      const active = B.sel === op.g, pulse = s.hl && s.hl.g === op.g ? 0.5 + 0.5 * Math.sin(s.t * 6) : 0;
      const fresh = st.last >= 0 && previewStep(P, st, op.g).nw;
      if (on) fr.markers.push({ x: op.from[0], y: op.from[1], slot: run.color, kind: fresh ? 'eyelet' : 'knot', active, pulse, dim: !!a, g: op.g });
      else marker(ctx, geo.X(op.from[0]), geo.Y(op.from[1]), mr * (active ? 1.25 : 1), run.color, { active, pulse, dim: !!a, fresh });
    }
  }
  // the preview of the selected end: hop line and cost chip
  if (B.sel !== null && !a && !done) {
    const op = P.opts[B.sel], pv = previewStep(P, st, B.sel);
    if (st.last >= 0 && !pv.nw) { if (on) fr.floats.push({ ax: st.pos[0], ay: st.pos[1], bx: op.from[0], by: op.from[1], slot: op.color, alpha: 0.9 }); else floatLine(ctx, geo, st.pos, op.from, op.color, 0.9); }
    drawChip(ctx, geo, op, pv, st, P);
  }
  // the needle
  if (!done) {
    let nd = null;
    if (a) {
      const op = P.opts[a.g], run = P.runs[op.run];
      if (a.hop < 1 && a.from) {
        const x = a.from[0] + (op.from[0] - a.from[0]) * a.hop, y = a.from[1] + (op.from[1] - a.from[1]) * a.hop;
        nd = { x, y, ang: Math.atan2(op.from[1] - a.from[1], op.from[0] - a.from[0]), slot: op.color, mode: 'hop', hop: a.hop, fx: a.from[0], fy: a.from[1], tx: op.from[0], ty: op.from[1] };
      } else {
        const u = Math.min(a.u, run.len), p = sewPoint(run, op, u), q = sewPoint(run, op, Math.min(run.len, u + 0.25)), q0 = sewPoint(run, op, Math.max(0, u - 0.05));
        nd = { x: p[0], y: p[1], ang: Math.atan2(q[1] - q0[1], q[0] - q0[0]) || 0, slot: op.color, mode: 'sew' };
      }
    } else if (st.pos) {
      const op = P.opts[st.last], run = P.runs[op.run];
      nd = { x: st.pos[0], y: st.pos[1], ang: endAngle(run, op), slot: op.color, mode: 'rest' };
    }
    if (nd) {
      if (on) { fr.needle = nd; fr.hand = nd.mode !== 'rest'; }
      else needle(ctx, geo.X(nd.x), geo.Y(nd.y), Math.max(12, geo.s * 0.3), nd.ang, nd.slot);
    }
  }
  if (on) { fr.puck = puck; fr.done = done; fr.glowT = s.winT; v3.frame = fr; }
  drawSparks(ctx, s);
  void o;
  return st;
}
// Common fields of a 3D scene description (see presenter.js).
function newFrame(s, geo, runs, key) {
  return { kind: 'cloth', size: geo.size, rect: geo.rect, T: theme(), look: lookKey(), key, runs, sewn: [], targets: [], chalk: [], floats: [], markers: [], needle: null, hand: false, puck: 0, done: false, t: s.t, calm: !!s.prefs.calm, scene: s.scene, props: false };
}
function drawChip(ctx, geo, op, pv, st, P) {
  const T = theme();
  let text;
  if (pv.reason === 'first') text = 'Start here';
  else if (pv.nw) text = pv.reason === 'colour' ? 'New colour: new thread' : `Too long: new thread (wastes ${fmt1(pv.wasted)})`;
  else text = `Hop ${fmt1(pv.hop)}  ·  ${fmt1(pv.rem)} left`;
  const cp = geo.P(op.from[0], op.from[1], 0.006), x = cp.x, y = cp.y, size = F(24), padX = 14;
  ctx.save(); ctx.font = `600 ${size}px ${UI}`;
  const w = ctx.measureText(text).width + padX * 2, h = size + 16, r = geo.rect;
  let bx = clamp(x - w / 2, r.x + 6, r.x + r.w - w - 6), by = y - 44 - h;
  if (by < r.y + 4) by = y + 36;
  plaque(ctx, R(bx, by, w, h), { radius: h / 2, tone: pv.nw && pv.reason !== 'first' ? 'dark' : 'dark', alpha: 0.96, stitch: false });
  if (pv.nw && pv.reason !== 'first') { rr(ctx, bx + 2, by + 2, w - 4, h - 4, h / 2 - 2); ctx.lineWidth = 2.5; ctx.strokeStyle = T.err; ctx.stroke(); }
  ctx.fillStyle = '#f7f1e0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + w / 2, by + h / 2 + 1);
  ctx.restore();
  void st; void P;
}

// ================================================================ patch play =================================================================
function drawPlay(ctx, s, w, h) {
  const B = s.B, P = B.P;
  const L = playLayout(w, h, { coach: !!(s.hint || s.auto.on), buttons: s.auto.on ? [] : ['sew', 'undo', 'hint', 'clear'] });
  const geo = patchGeo(L.area, P.size);
  // the carved tray under the controls (portrait) and the side panel (landscape): the cloth stays on the table, the controls sit on wood
  if (L.mode === 'land' && L.info) plaque(ctx, L.info, { radius: 26, tone: 'dark', alpha: 0.88 });
  else if (L.ctl) plaque(ctx, R(L.ctl.x - 6, L.ctl.y - 2, L.ctl.w + 12, L.ctl.h + 6), { radius: 26, tone: 'dark', alpha: 0.86 });
  const st = drawPatchScene(ctx, s, geo, B);
  drawHud(ctx, s, L, playTitle(s), playSub(s, st));
  drawGauge(ctx, s, L, B, st);
  if (s.paused) drawPaused(ctx, s, L);
  else if (s.auto.on) drawAutoControls(ctx, s, L);
  else if (s.hint) drawCoach(ctx, s, L);
  else { drawBuildControls(ctx, s, L); drawLegend(ctx, s, L, B, st); drawPlan(ctx, s, L, B); }
  drawMsg(ctx, s, L);
}
const playTitle = (s) => {
  const B = s.B;
  if (s.auto.on) return 'Watch and Learn';
  if (B.kind === 'daily') return 'Daily Patch';
  return B.P.name;
};
const playSub = (s, st) => {
  const B = s.B, P = B.P, left = P.runs.length - B.steps.length;
  return `${left} row${left === 1 ? '' : 's'} left  ·  ${st.t || 1} thread${(st.t || 1) === 1 ? '' : 's'} so far`;
};
function drawHud(ctx, s, L, title, sub) {
  const T = theme(), t = L.hud.title;
  if (L.mode !== 'land') plaque(ctx, R(t.x - 10, t.y + 1, t.w + 20, 82), { radius: 20, tone: 'dark', alpha: 0.88 });
  txt(ctx, title, t.x, t.y + 28, { size: F(40), weight: 700, color: T.text, maxW: t.w, min: 18, fam: NUM });
  txt(ctx, sub, t.x, t.y + 64, { size: F(24), weight: 500, color: T.dim, maxW: t.w + 40, min: 12 });
  const pr = L.pause;
  if (!s.auto.on) button(ctx, pr, '', { icon: 'pause', size: 28, flash: flashOf(s, 'pause'), radius: 18 });
}
function drawGauge(ctx, s, L, B, st) {
  const T = theme(), P = B.P, g = L.gauge, fresh = st.last < 0;
  const slot = st.color ?? (B.sel !== null ? P.opts[B.sel].color : P.colors[0]);
  const sp = v3.on ? 70 : 0;   // room for the 3D spool at the left end
  plaque(ctx, R(g.x - 6, g.y - 4, g.w + 12, g.h + 8), { radius: 22, tone: 'dark', alpha: 0.9, stitch: false });
  const gx = g.x + sp, gw = g.w - sp;
  const top = R(gx, g.y, gw, 26), bar = R(gx, g.y + 28, gw, 32);
  let use = 0, nw = false;
  if (B.sel !== null && !B.anim && !B.done) { const pv = previewStep(P, st, B.sel); use = pv.need; nw = pv.nw && pv.reason !== 'first'; }
  const left = fresh ? P.C : st.rem;
  if (v3.on) {
    const sr = R(g.x + 3, g.y - 6, sp - 8, g.h + 12);
    v3.gauge = { x: sr.x, y: sr.y, w: sr.w, h: sr.h, frac: clamp(left / P.C, 0, 1), slot };
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; rr(ctx, sr.x, sr.y, sr.w, sr.h, 18); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    rr(ctx, sr.x, sr.y, sr.w, sr.h, 18); ctx.lineWidth = 3.5; ctx.strokeStyle = '#e8c16a'; ctx.stroke();
    rr(ctx, sr.x + 3, sr.y + 3, sr.w - 6, sr.h - 6, 15); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
  }
  threadBar(ctx, bar, { cap: P.C, rem: fresh ? P.C : st.rem, use: nw ? 0 : use, slot, fresh: false, newThread: nw, spool: !v3.on });
  txt(ctx, fresh ? `Thread ${fmt1(P.C)} long` : `Thread ${st.t}  ·  ${fmt1(left)} left`, gx + 4, top.y + top.h / 2, { size: F(22), weight: 600, color: T.text, maxW: gw * 0.62, min: 12 });
  let aim = `Aim ${P.opt} thread${P.opt === 1 ? '' : 's'}`;
  let col = '#ffd36b';
  if (s.prefs.guide && B.steps.length && !B.done) {
    const bf = bestFinish(P, B.steps);
    if (bf > P.opt) { aim = `This plan: ${bf} threads`; col = '#ff9a80'; } else aim = `On track: ${P.opt} thread${P.opt === 1 ? '' : 's'}`;
  }
  txt(ctx, aim, gx + gw - 4, top.y + top.h / 2, { size: F(22), weight: 600, color: col, align: 'right', maxW: gw * 0.4, min: 12 });
}
// Rows still to sew, per thread colour: a swatch (with its mark when colour marks are on) and a count.
function drawLegend(ctx, s, L, B, st) {
  const T = theme(), g = L.legend;
  if (!g) return;
  const P = B.P, left = P.colors.map((c) => ({ c, n: P.runs.filter((r) => r.color === c && !(st.mask & (1 << r.i))).length, total: P.runs.filter((r) => r.color === c).length }));
  const size = F(22), chipH = Math.max(40, size * 1.9), gap = 10;
  let x = g.x, y = g.y;
  for (const it of left) {
    const label = it.n === 0 ? 'done' : `${it.n} to sew`;
    ctx.font = `600 ${size}px ${UI}`;
    const w = chipH + 8 + ctx.measureText(label).width + 22;
    if (x + w > g.x + g.w && x > g.x) { x = g.x; y += chipH + gap; }
    if (y + chipH > g.y + g.h + 40) break;
    plaque(ctx, R(x, y, w, chipH), { radius: chipH / 2, tone: 'wood', alpha: 0.95, stitch: false });
    const cx = x + chipH / 2, cy = y + chipH / 2;
    bead(ctx, cx, cy, chipH * 0.3, threadColor(it.c));
    if (s.prefs.marks) glyph(ctx, cx, cy, chipH * 0.22, it.c, T.patch0);
    ctx.globalAlpha = it.n === 0 ? 0.6 : 1;
    txt(ctx, label, x + chipH + 2, cy, { size, weight: 600, color: it.n === 0 ? '#8df0b8' : '#fbeedd' });
    ctx.globalAlpha = 1;
    x += w + gap;
  }
}
// Tall phones: the order the rows were sewn in, as numbered thread-coloured beads (empty rings for the rows still to do).
function drawPlan(ctx, s, L, B) {
  const r = L.plan;
  if (!r) return;
  const T = theme(), P = B.P, n = P.runs.length, gap = 10;
  plaque(ctx, r, { radius: 24, tone: 'dark', alpha: 0.7, stitch: false });
  txt(ctx, 'Your order', r.x + 18, r.y + 26, { size: F(22), weight: 600, color: 'rgba(251,238,221,0.8)', maxW: r.w - 36, min: 12 });
  const top = r.y + 52, avail = r.w - 36, availH = r.y + r.h - 14 - top;
  let rows = 1, d = Math.min(84, (avail - gap * (n - 1)) / n);
  if (d < 40) { rows = 2; d = Math.min(84, (avail - gap * (Math.ceil(n / 2) - 1)) / Math.ceil(n / 2)); }
  d = Math.min(d, (availH - (rows - 1) * gap) / rows);
  if (d < 22) return;
  const perRow = Math.ceil(n / rows), top0 = top + (availH - (rows * d + (rows - 1) * gap)) / 2;
  for (let k = 0; k < n; k++) {
    const row = Math.floor(k / perRow), col = k % perRow, inRow = row === rows - 1 ? n - row * perRow : perRow;
    const rowW = inRow * d + (inRow - 1) * gap, x = r.x + 18 + (avail - rowW) / 2 + col * (d + gap) + d / 2, y = top0 + row * (d + gap) + d / 2;
    ctx.save();
    if (k < B.steps.length) {
      const op = P.opts[B.steps[k].g];
      bead(ctx, x, y, d / 2, threadColor(op.color));
      txt(ctx, String(k + 1), x, y + 1, { size: Math.max(16, d * 0.46), weight: 700, color: '#fff', align: 'center', maxW: d * 0.8, min: 10 });
    } else {
      ctx.setLineDash([5, 5]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,225,170,0.4)'; ctx.beginPath(); ctx.arc(x, y, d / 2 - 1, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, String(k + 1), x, y + 1, { size: Math.max(16, d * 0.42), weight: 600, color: 'rgba(251,238,221,0.7)', align: 'center', maxW: d * 0.8, min: 10 });
    }
    ctx.restore();
  }
}
function drawBuildControls(ctx, s, L) {
  const B = s.B, tl = L.tools;
  if (!tl) return;
  const sel = B.sel !== null && !B.anim;
  const defs = [['sew', 'Sew', 'needle', !sel], ['undo', 'Undo', 'undo', !B.hist.length], ['hint', 'Hint', 'bulb', false], ['clear', 'Clear', 'erase', !B.steps.length]];
  for (const [id, label, icon, dis] of defs) {
    const r = tl[id];
    if (!r) continue;
    const wide = r.h >= 56 && r.w > 96;
    button(ctx, r, wide ? label : '', { kind: id === 'sew' ? 'accent' : 'solid', icon, size: 26, disabled: dis, flash: flashOf(s, id), radius: 20, active: false });
  }
}
function drawCoach(ctx, s, L) {
  const T = theme(), hnt = s.hint, C = L.coachR, B = L.coachBtns;
  panel(ctx, C, { radius: 24 });
  const x = C.x + 20, w = C.w - 40;
  const title = hnt.h.name, chip = hnt.stage === 'look' ? 'Where to look' : 'Why it works';
  const ts = F(C.h > 300 ? 34 : 28);
  txt(ctx, title.charAt(0).toUpperCase() + title.slice(1), x, C.y + 14 + ts * 0.6, { size: ts, weight: 700, color: '#ffd36b', maxW: w, min: 18 });
  txt(ctx, chip, x, C.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: 'rgba(251,238,221,0.75)' });
  const bodyTop = C.y + 14 + ts * 2.1, bodyH = B.close.y - 10 - bodyTop;
  let size = F(C.w > 500 ? 28 : 26);
  while (size > 14 && paraHeight(ctx, hnt.text, w, size, 500, 1.28) > bodyH) size -= 1;
  para(ctx, hnt.text, x, bodyTop, w, { size, weight: 500, color: '#fbeedd', lh: 1.28 });
  button(ctx, B.close, 'Close', { size: 28, flash: flashOf(s, 'close') });
  button(ctx, B.go, hnt.stage === 'look' ? 'Explain' : 'Sew it', { kind: 'accent', size: 28, flash: flashOf(s, 'go') });
}
const THINK_LABEL = ['2 s', '5 s', '8 s', '10 s'];
function drawAutoControls(ctx, s, L) {
  const T = theme(), a = s.auto, C = L.coachR, rl = L.rail, hnt = s.hint;
  panel(ctx, C, { radius: 24 });
  const x = C.x + 20, w = C.w - 40, T0 = L.coachText;
  const ts = F(C.h > 300 ? 34 : 28), name = hnt?.h?.name ? hnt.h.name.charAt(0).toUpperCase() + hnt.h.name.slice(1) : (a.done ? 'Patch complete' : s.B.anim ? 'Sewing' : 'Thinking');
  txt(ctx, name, x, T0.y + 14 + ts * 0.6, { size: ts, weight: 700, color: '#ffd36b', maxW: w, min: 18 });
  const phase = a.paused ? 'Paused' : a.phase === 'think' ? 'Where to look' : a.phase === 'reveal' ? 'Why it works' : a.done ? 'Every row is sewn' : s.B.anim ? 'Sewing the row' : 'Finding the next row';
  txt(ctx, `Step ${a.n}  ·  ${phase}`, x, T0.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: 'rgba(251,238,221,0.75)', maxW: w * 0.6, min: 12 });
  const bodyTop = T0.y + 14 + ts * 2.1, bodyH = T0.y + T0.h - bodyTop;
  const text = hnt?.text ?? (a.done ? 'The cloth is finished with the fewest threads. Tap Exit to go back to the menu.' : 'Looking for the next row.');
  let size = F(C.w > 500 ? 26 : 24);
  while (size > 14 && paraHeight(ctx, text, w, size, 500, 1.28) > bodyH) size -= 1;
  para(ctx, text, x, bodyTop, w, { size, weight: 500, color: '#fbeedd', lh: 1.28 });
  button(ctx, rl.exit, 'Exit', { icon: 'exit', size: 26, flash: flashOf(s, 'aexit') });
  button(ctx, rl.pause, a.paused ? 'Resume' : 'Pause', { icon: a.paused ? 'play' : 'pause', kind: 'accent', size: 26, flash: flashOf(s, 'apause') });
  button(ctx, rl.dec, '', { icon: 'minus', size: 26, flash: flashOf(s, 'adec') });
  button(ctx, rl.inc, '', { icon: 'plus', size: 26, flash: flashOf(s, 'ainc') });
  txt(ctx, `Think ${THINK_LABEL[s.prefs.thinkIdx]}`, C.x + C.w - 20, T0.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: 'rgba(251,238,221,0.75)', align: 'right' });
}
function drawPaused(ctx, s, L) {
  const T = theme(), pl = pauseLayout(L.w, L.h, L.area);
  ctx.fillStyle = rgba(T.bg1, v3.on ? 0.55 : 0.88); rr(ctx, L.area.x, L.area.y, L.area.w, L.area.h, 30); ctx.fill();
  plaque(ctx, pl.card, { radius: 26, tone: 'dark', alpha: 0.97 });
  embossText(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 40, { size: F(54), maxW: pl.card.w - 40 });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 30, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, s.scene === 'play' ? 'Start patch again' : 'Start over', { size: 28, flash: flashOf(s, 'restart') });
  button(ctx, pl.settings, 'Settings', { icon: 'gear', size: 28, flash: flashOf(s, 'psettings') });
  button(ctx, pl.menu, s.scene === 'play' ? 'Save and menu' : 'Menu', { size: 28, flash: flashOf(s, 'pmenu') });
}
function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), portrait = L.mode === 'portrait';
  const bx = L.area, w = portrait ? Math.min(bx.w - 30, 560) : L.info.w - 24, cx2 = portrait ? bx.x + bx.w / 2 : L.info.x + L.info.w / 2;
  let size = F(portrait ? 24 : 26), lines = wrap(ctx, m.text, w - 36, size, 600);
  while (portrait && lines.length > 2 && size > F(18)) { size -= 1; lines = wrap(ctx, m.text, w - 36, size, 600); }
  const hh = lines.length * size * 1.22 + 22;
  const y = portrait ? L.area.y + L.area.h * 0.5 - hh / 2 : L.info.y + L.info.h - hh - 150;
  ctx.save(); ctx.globalAlpha = a;
  plaque(ctx, R(cx2 - w / 2, y, w, hh), { radius: 18, tone: 'dark', alpha: 0.97, stitch: false });
  para(ctx, m.text, cx2 - w / 2 + 18, y + 11, w - 36, { size, weight: 600, color: '#f7f1e0', align: 'center', lh: 1.22 });
  ctx.restore();
}

// ================================================================ Steady Hand =================================================================
function rowPt(row, s) {
  const run = row.run, q = clamp(s, 0, run.len);
  return pointAt(run, q);
}
function stitchPath(ctx, geo, row, sa, sb, ox = 0, oy = 0) {
  const n = Math.max(2, Math.ceil((sb - sa) / 0.08));
  ctx.beginPath();
  for (let i = 0; i <= n; i++) { const p = rowPt(row, sa + ((sb - sa) * i) / n), x = geo.X(p[0]) + ox, y = geo.Y(p[1]) + oy; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
}
function stitchAt(ctx, geo, row, sc, col, { loose = false } = {}) {
  const a = sc - STITCH / 2, b = sc + STITCH / 2, wd = Math.max(2.6, geo.s * 0.09);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  stitchPath(ctx, geo, row, a, b, geo.s * 0.04, geo.s * 0.055); ctx.lineWidth = wd * 1.35; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
  stitchPath(ctx, geo, row, a, b); ctx.lineWidth = wd; ctx.strokeStyle = loose ? mix(col, '#808080', 0.5) : col; ctx.stroke();
  stitchPath(ctx, geo, row, a, b, -geo.s * 0.01, -geo.s * 0.014); ctx.lineWidth = wd * 0.32; ctx.strokeStyle = mix(col, '#ffffff', 0.5); ctx.globalAlpha = 0.55; ctx.stroke();
  ctx.restore();
}
// A stitch laid on a Steady Hand row as a dash description (same shape as art.dashesFor entries).
function stitchDash(row, sc) {
  const a = Math.max(0, sc - STITCH / 2), b = Math.min(row.run.len, sc + STITCH / 2), n = Math.max(2, Math.ceil((b - a) / 0.1)), pts = [];
  for (let i = 0; i <= n; i++) { const u = a + ((b - a) * i) / n, p = rowPt(row, u); pts.push(p[0], p[1], u); }
  return { u0: a, u1: b, pts };
}
function drawSteady(ctx, s, w, h) {
  const Rd = s.R, data = Rd.data, T = theme(), Tt = RHYTHM[Rd.tier];
  const L = playLayout(w, h, { coach: false, buttons: [], slim: true });
  const geo = patchGeo(L.area, 10);
  const on = v3.on, rows = data.rows;
  if (L.mode === 'land' && L.info) plaque(ctx, L.info, { radius: 26, tone: 'dark', alpha: 0.88 });
  else if (L.ctl) plaque(ctx, R(L.ctl.x - 6, L.ctl.y - 2, L.ctl.w + 12, L.ctl.h + 6), { radius: 26, tone: 'dark', alpha: 0.86 });
  const fr = on ? newFrame(s, geo, rows.map((r) => r.run), `steady|${Rd.tier}|${Rd.seed}`) : null;
  if (!on) drawCloth(ctx, geo, { puck: s.prefs.calm ? Rd.tension * 0.7 : Rd.tension, t: s.t, seed: Rd.tier });
  const t = Rd.t;
  let cur = rows.findIndex((r) => t < r.start + r.dur + 0.5);
  if (cur < 0) cur = rows.length - 1;
  const mr = Math.max(7, geo.s * 0.17);
  rows.forEach((row, r) => {
    const col = threadColor(r % 3);
    // the chalk line the stitches go along
    const dsh = dashesFor(row.run, 0, 0.14, 0.22);
    if (on) fr.chalk.push({ dashes: dsh, tint: col, ri: r, glow: false, thin: true });
    else {
      ctx.beginPath();
      for (const d of dsh) { const p = d.pts; ctx.moveTo(geo.X(p[0]), geo.Y(p[1])); for (let i = 3; i < p.length; i += 3) ctx.lineTo(geo.X(p[i]), geo.Y(p[i + 1])); }
      ctx.lineWidth = Math.max(1.4, geo.s * 0.035); ctx.lineCap = 'round'; ctx.strokeStyle = T.chalk; ctx.stroke();
    }
    let resolved = 0;
    row.holes.forEach((hole, k) => {
      const hh = Rd.holes[r][k], p = rowPt(row, hole.s), x = geo.X(p[0]), y = geo.Y(p[1]);
      if (hh.res) resolved += 1;
      if (hh.res === 'hit') {
        if (on) {
          fr.sewn.push({ id: `st${r}:${k}`, dashes: [stitchDash(row, hole.s + hh.err * Tt.speed)], upTo: 1e9, slot: r % 3, run: null, ri: r });
          if (hh.grade === 0) fr.markers.push({ x: p[0], y: p[1], slot: r % 3, kind: 'gold' });
        } else {
          stitchAt(ctx, geo, row, hole.s + hh.err * Tt.speed, col);
          if (hh.grade === 0) { ctx.beginPath(); ctx.arc(x, y - mr * 0.1, mr * 0.28, 0, 7); ctx.fillStyle = 'rgba(255,225,120,0.9)'; ctx.fill(); }
        }
        return;
      }
      if (hh.res === 'miss') {
        if (on) fr.markers.push({ x: p[0], y: p[1], slot: r % 3, kind: 'miss' });
        else { ctx.beginPath(); ctx.arc(x, y, mr * 0.65, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = rgba(T.err, 0.85); ctx.stroke(); }
        return;
      }
      const dt = hole.t - t;
      if (dt < 1.5 && dt > -0.4) {
        const f = dt > 0 && dt < 0.9 ? clamp(dt / 0.9, 0, 1) : -1;
        if (on) fr.markers.push({ x: p[0], y: p[1], slot: r % 3, kind: 'knot', active: true, ring: f });
        else {
          ctx.beginPath(); ctx.arc(x, y, mr, 0, 7); ctx.fillStyle = T.marker; ctx.fill(); ctx.lineWidth = Math.max(2, mr * 0.35); ctx.strokeStyle = col; ctx.stroke();
          if (f >= 0) { ctx.beginPath(); ctx.arc(x, y, mr * (1.25 + 2.4 * f), 0, 7); ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(T.accent, 0.3 + 0.55 * (1 - f)); ctx.stroke(); }
        }
      } else if (on) fr.markers.push({ x: p[0], y: p[1], slot: r % 3, kind: 'dot' });
      else { ctx.beginPath(); ctx.arc(x, y, mr * 0.5, 0, 7); ctx.fillStyle = rgba(col, 0.5); ctx.fill(); }
    });
    if (on) fr.targets.push([r, row.holes.length ? resolved / row.holes.length : 0]);
  });
  if (Rd.phase === 'play') {
    const row = rows[cur], sN = clamp((t - row.start) * Tt.speed, 0, row.run.len), p = rowPt(row, sN), q0 = rowPt(row, Math.max(0, sN - 0.1)), q1 = rowPt(row, Math.min(row.run.len, sN + 0.15));
    const ang = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]) || 0;
    if (on) { fr.needle = { x: p[0], y: p[1], ang, slot: cur % 3, mode: 'sew' }; fr.hand = true; }
    else needle(ctx, geo.X(p[0]), geo.Y(p[1]), Math.max(12, geo.s * 0.3), ang, cur % 3);
  }
  if (on) { fr.puck = Rd.tension; v3.frame = fr; }
  for (const f of s.fx) {
    const c = geo.P(f.x, f.y, 0.01), x = c.x, y = c.y - 26 - f.t * 40;
    ctx.globalAlpha = clamp(1 - f.t / 0.9, 0, 1);
    txt(ctx, f.text, x, y, { size: F(24), weight: 700, color: f.grade === 0 ? '#ffd45a' : '#ffffff', align: 'center' });
    ctx.globalAlpha = 1;
  }
  drawSparks(ctx, s);
  drawHud(ctx, s, L, `Steady Hand  ·  ${Tt.name}`, `Row ${Math.min(cur + 1, rows.length)} of ${rows.length}  ·  Combo ${Rd.combo}`);
  // accuracy bar in the gauge band
  plaque(ctx, R(L.gauge.x - 6, L.gauge.y - 4, L.gauge.w + 12, 64), { radius: 20, tone: 'dark', alpha: 0.9, stitch: false });
  const g = L.gauge, resolved = Rd.counts.reduce((a, b) => a + b, 0), acc = resolved ? Rd.base / (100 * resolved) : 1;
  txt(ctx, `Even stitches ${Math.round(acc * 100)}%`, g.x + 4, g.y + 13, { size: F(22), weight: 600, color: T.text, maxW: g.w * 0.62, min: 12 });
  txt(ctx, `Score ${Rd.score}`, g.x + g.w - 4, g.y + 13, { size: F(22), weight: 600, color: T.accent, align: 'right', maxW: g.w * 0.38, min: 12 });
  const bar = R(g.x, g.y + 32, g.w, 22);
  rr(ctx, bar.x, bar.y, bar.w, bar.h, 11); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
  rr(ctx, bar.x, bar.y, Math.max(bar.h, bar.w * clamp(acc, 0, 1)), bar.h, 11); ctx.fillStyle = acc > 0.88 ? T.good : acc > 0.7 ? T.accent : T.err; ctx.fill();
  // counts and row chips in the control area
  const C = L.ctl, c = Rd.counts;
  const sp = R(C.x, C.y + 4, C.w, Math.min(110, C.h * 0.4));
  panel(ctx, sp, { radius: 22, fill: rgba('#000000', 0.22) });
  const lbl = ['Perfect', 'Good', 'Close', 'Missed'], colr = ['#ffd45a', T.text, T.dim, T.err], cw = (sp.w - 20) / 4;
  for (let i = 0; i < 4; i++) {
    txt(ctx, String(c[i]), sp.x + 10 + cw * (i + 0.5), sp.y + sp.h * 0.4, { size: F(34), weight: 700, color: colr[i], align: 'center', maxW: cw - 8, min: 14 });
    txt(ctx, lbl[i], sp.x + 10 + cw * (i + 0.5), sp.y + sp.h * 0.76, { size: F(19), weight: 500, color: T.dim, align: 'center', maxW: cw - 6, min: 11 });
  }
  const chipH = 46, gap = 10, cwid = Math.min(120, (C.w - gap * (rows.length - 1)) / rows.length), y0 = sp.y + sp.h + 16;
  rows.forEach((row, r) => {
    const x = C.x + r * (cwid + gap), acc2 = Rd.rowAcc[r], on = r === cur && Rd.phase === 'play';
    rr(ctx, x, y0, cwid, chipH, 14); ctx.fillStyle = acc2 !== null ? rgba(threadColor(r % 3), 0.35) : T.btn; ctx.fill();
    ctx.lineWidth = on ? 2.5 : 1.5; ctx.strokeStyle = on ? T.accent : T.line; ctx.stroke();
    txt(ctx, acc2 !== null ? `${r + 1} · ${Math.round(acc2 * 100)}%` : String(r + 1), x + cwid / 2, y0 + chipH / 2, { size: F(22), weight: 600, color: T.text, align: 'center', maxW: cwid - 10, min: 11 });
  });
  if (t < 1.6) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (1.6 - t) * 1.5);
    const bw = Math.min(L.area.w - 40, 560); rr(ctx, L.area.x + (L.area.w - bw) / 2, L.area.y + L.area.h * 0.45, bw, 70, 18); ctx.fillStyle = 'rgba(10,12,30,0.92)'; ctx.fill();
    txt(ctx, 'Tap anywhere as the needle reaches each mark.', L.area.x + L.area.w / 2, L.area.y + L.area.h * 0.45 + 35, { size: F(26), weight: 600, color: '#f7f1e0', align: 'center', maxW: bw - 30, min: 14 });
    ctx.restore();
  }
  if (s.paused) drawPaused(ctx, s, L);
}

// ================================================================ title ==================================================================
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h, !!s.saved), hero = L.hero; setBrandTone(T.dark);
  const H = hero.h, tb = Math.min(160, Math.max(86, H * 0.3));
  const art = R(hero.x, hero.y, hero.w, H - tb);
  // a lotus patch being sewn, row by row, in a loop
  const P = patch(2, 0), side = Math.min(art.w, art.h) * 0.94, ar = R(art.x + (art.w - side) / 2, art.y + (art.h - side) / 2, side, side);
  const geo = patchGeo(ar, 10, 0.06), cyc = 9, ph = s.prefs.calm ? 8 : (s.t % cyc);
  const on = v3.on, fr = on ? newFrame(s, geo, P.runs, 'title|lotus') : null;
  if (!on) drawCloth(ctx, geo, { puck: clamp(ph / cyc, 0, 1) * 0.8, t: s.t, seed: 3 });
  const order = [6, 0, 1, 2, 3, 4, 5];
  order.forEach((ri, k) => {
    const run = P.runs[ri], start = 0.4 + k * 0.95, u = clamp((ph - start) / 0.72, 0, 1) * run.len;
    if (on) {
      if (u <= 0) fr.chalk.push({ dashes: dashesFor(run, 0), tint: threadColor(run.color), ri, glow: false });
      else { fr.sewn.push({ id: `${ri}:0`, dashes: dashesFor(run, 0), upTo: u >= run.len - 1e-6 ? 1e9 : u, slot: run.color, run, ri }); fr.targets.push([ri, u / run.len]); }
    } else if (u <= 0) chalkRun(ctx, geo, run);
    else { threadRun(ctx, geo, run, 0, u, run.color); }
    if (u > 0 && u < run.len) {
      const p = sewPoint(run, run.opts[0], u), p0 = sewPoint(run, run.opts[0], Math.max(0, u - 0.05)), p1 = sewPoint(run, run.opts[0], Math.min(run.len, u + 0.25)), ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) || 0;
      if (on) { fr.needle = { x: p[0], y: p[1], ang, slot: run.color, mode: 'sew' }; fr.hand = true; }
      else needle(ctx, geo.X(p[0]), geo.Y(p[1]), Math.max(12, geo.s * 0.3), ang, run.color);
    }
    // between two rows the needle is lifted across to the next row's start (the hand never lets go of it)
    const nx = order[k + 1];
    if (on && nx !== undefined && ph >= start + 0.72 && ph < start + 1.0 && !fr.needle) {
      const nr = P.runs[nx], h = clamp((ph - start - 0.72) / 0.23, 0, 1), a = sewPoint(run, run.opts[0], run.len), b = sewPoint(nr, nr.opts[0], 0);
      fr.needle = { x: a[0] + (b[0] - a[0]) * h, y: a[1] + (b[1] - a[1]) * h, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) || 0, slot: run.color, mode: 'hop', hop: h }; fr.hand = true;
    }
  });
  if (on) { fr.puck = clamp(ph / cyc, 0, 1) * 0.8; fr.props = true; fr.hero = true; fr.rect = hero; v3.frame = fr; }
  const ty = hero.y + H - tb + tb * 0.45;
  embossText(ctx, 'Kantha', hero.x + hero.w / 2, ty, { size: tb * 0.66, maxW: hero.w * 0.94, fam: NUM });
  if (on) { const sw = Math.min(hero.w * 0.9, tb * 7.4), sh = Math.max(30, tb * 0.3); plaque(ctx, R(hero.x + hero.w / 2 - sw / 2, ty + tb * 0.46 - sh / 2, sw, sh), { radius: sh / 2, tone: 'dark', alpha: 0.82, stitch: false, shadow: false }); }
  txt(ctx, 'RUNNING STITCH QUILT  ·  BENGAL', hero.x + hero.w / 2, ty + tb * 0.46, { size: tb * 0.17, weight: 700, color: '#ffe3a1', align: 'center', maxW: hero.w * 0.92, min: 12 });
  const done = Object.keys(s.progress).length, Bt = L.buttons;
  const lab = {
    continue: ['Continue', s.saved ? `${s.saved.kind === 'daily' ? 'Daily Patch' : 'Patch'}  ·  ${s.saved.n} rows sewn` : ''],
    quilt: ['The Quilt', `${done} of 30 patches sewn`], steady: ['Steady Hand', 'Even stitches, in time with the needle'],
    daily: ['Daily Patch', s.dailyDone ? 'done today' : s.streak ? `${s.streak} day streak` : 'a new cloth every day'],
    learn: ['Watch and Learn', ''], howto: ['How to Play', ''], rules: ['Rules', ''], stats: ['Stats', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear', stats: 'star' };
  for (const id of Object.keys(Bt)) {
    const prim = id === 'continue' || id === 'quilt' || id === 'steady' || id === 'daily', r = Bt[id];
    button(ctx, r, lab[id][0], { kind: id === 'quilt' || id === 'continue' ? 'accent' : 'solid', size: prim ? 30 : 24, sub: prim && L.subs ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: prim ? '' : (iconOf[id] ?? '') });
    if (id === 'daily' && s.dailyDone) icons.check(ctx, r.x + r.w - 36, r.y + r.h / 2, 28, T.good);
  }
  drawCredit(ctx, L.brand.x, L.brand.y, Math.min(16, Math.max(12.5, 13.5 / (host.px || 0.55) * 0.5 + 6)), { dim: 0.95 });
}

// ================================================================ pick screens ============================================================
function header(ctx, s, P, title) {
  const T = theme(), sc = scaleOf(s);
  if (v3.on) plaque(ctx, R(P.header.x - 4, P.header.y, P.header.w + 8, P.header.h), { radius: 22, tone: 'dark', alpha: 0.88, stitch: false });
  txt(ctx, title, P.titleX, P.header.y + P.header.h / 2, { size: F(44), weight: 700, color: T.text, maxW: P.textDec.x - P.titleX - 14, min: 18, fam: NUM });
  button(ctx, P.textDec, 'A−', { size: 28, disabled: s.prefs.textIdx === 0, flash: flashOf(s, 'tdec'), radius: 16 });
  button(ctx, P.textInc, 'A+', { size: 28, disabled: s.prefs.textIdx === TEXT_SCALES.length - 1, flash: flashOf(s, 'tinc'), radius: 16 });
  if (sc > 1) txt(ctx, `${Math.round(sc * 100)}%`, P.textDec.x - 12, P.header.y + P.header.h / 2, { size: F(22), weight: 500, color: T.dim, align: 'right' });
}
function scrollBody(ctx, s, rect, draw) {
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x - 6, rect.y, rect.w + 12, rect.h); ctx.clip();
  ctx.translate(0, -s.scrollY);
  const ch = draw();
  ctx.restore();
  metrics.max = Math.max(0, ch - rect.h); metrics.view = rect.h; metrics.rect = rect;
  if (metrics.max > 0) {
    const T = theme(), bx = rect.x + rect.w + 4, th = Math.max(40, rect.h * rect.h / ch), ty = rect.y + (rect.h - th) * clamp(s.scrollY / metrics.max, 0, 1);
    rr(ctx, bx, rect.y, 6, rect.h, 3); ctx.fillStyle = 'rgba(128,128,128,0.2)'; ctx.fill();
    rr(ctx, bx, ty, 6, th, 3); ctx.fillStyle = T.accent; ctx.fill();
  }
}
const TILE = 256, TILE_RECT = { x: 14, y: 14, w: 228, h: 228 };
function tileFrame(P, done, key) {
  const fr = { kind: 'cloth', size: 10, rect: TILE_RECT, T: theme(), look: lookKey(), key, runs: P.runs, sewn: [], targets: [], chalk: [], floats: [], markers: [], needle: null, hand: false, puck: done ? 0.9 : 0, done: false, t: 0, calm: true, scene: 'quilt', props: false };
  for (const run of P.runs) {
    if (done) { fr.sewn.push({ id: `${run.i}:0`, dashes: dashesFor(run, 0), upTo: 1e9, slot: run.color, run, ri: run.i }); fr.targets.push([run.i, 1]); }
    else fr.chalk.push({ dashes: dashesFor(run, 0), tint: threadColor(run.color), ri: run.i, glow: false });
  }
  return fr;
}
// A quilt tile: the 3D patch baked to a sprite (flat miniature until it is ready or without WebGL).
function tile(ctx, r, P, ci, i, done, locked) {
  const key = `tile|${ci}|${i}|${done ? 1 : 0}|${lookKey()}`;
  const spr = v3.on && v3.bake ? v3.bake(key, () => tileFrame(P, done, key), TILE) : null;
  if (!spr) { miniPatch(ctx, r, P, { done, locked }); return; }
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, r.w * 0.08); ctx.clip(); ctx.globalAlpha = locked ? 0.4 : 1; ctx.drawImage(spr, r.x, r.y, r.w, r.h); ctx.restore();
  rr(ctx, r.x, r.y, r.w, r.h, r.w * 0.08); ctx.lineWidth = 3; ctx.strokeStyle = done ? 'rgba(255,211,107,0.95)' : 'rgba(240,212,136,0.55)'; ctx.stroke();
}
const prevKey = (ci, i) => (i > 0 ? `${ci}:${i - 1}` : `${ci - 1}:${CHAPTERS[Math.max(0, ci - 1)].count - 1}`);

function drawQuilt(ctx, s, w, h) {
  const T = theme(), LL = listLayout(w, h), sc = scaleOf(s);
  header(ctx, s, LL, 'The Quilt');
  button(ctx, LL.back, 'Menu', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
  scrollBody(ctx, s, LL.body, () => {
    const J = quiltRects(LL.body, CHAPTERS.map((c) => c.count), sc);
    J.items.forEach((it) => {
      const ch = CHAPTERS[it.ci], z = Math.min(sc, 1.6);
      if (v3.on) plaque(ctx, R(it.head.x - 4, it.head.y, it.head.w + 8, it.head.h - 4), { radius: 18, tone: 'dark', alpha: 0.86, stitch: false });
      txt(ctx, ch.name, it.head.x + 4, it.head.y + 26 * z, { size: F(34) * z, weight: 700, color: T.text, maxW: it.head.w - 8, min: 16, fam: NUM });
      txt(ctx, ch.blurb, it.head.x + 4, it.head.y + 58 * z, { size: F(21) * z, weight: 400, color: T.dim, maxW: it.head.w - 8, min: 12 });
      it.lv.forEach((r, i) => {
        if (r.y - s.scrollY > LL.body.y + LL.body.h || r.y + r.h - s.scrollY < LL.body.y) return;
        const key = `${it.ci}:${i}`, done = s.progress[key], locked = !s.dev && !s.demo && !(it.ci === 0 && i === 0) && !s.progress[prevKey(it.ci, i)] && !done;
        const Pq = patch(it.ci, i);
        tile(ctx, r, Pq, it.ci, i, !!done, locked);
        // number and stars
        const lab = R(r.x + 6, r.y + r.h - 34, r.w - 12, 28);
        rr(ctx, lab.x, lab.y, lab.w, lab.h, 10); ctx.fillStyle = 'rgba(10,12,30,0.78)'; ctx.fill();
        txt(ctx, String(i + 1), lab.x + 12, lab.y + lab.h / 2, { size: F(20), weight: 700, color: '#f7f1e0', fam: UI });
        const stars = done?.stars ?? 0;
        for (let k = 0; k < 3; k++) icons.star(ctx, lab.x + lab.w - 16 - (2 - k) * 22, lab.y + lab.h / 2, 20, k < stars ? '#ffc93c' : 'rgba(200,200,200,0.35)');
      });
    });
    return J.contentH + 10;
  });
}

function drawTiers(ctx, s, w, h) {
  const T = theme(), LL = listLayout(w, h), sc = scaleOf(s);
  header(ctx, s, LL, 'Steady Hand');
  button(ctx, LL.back, 'Menu', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
  scrollBody(ctx, s, LL.body, () => {
    const Tr = tierRects(LL.body, RHYTHM.length, sc), z = Math.min(sc, 1.5);
    Tr.cards.forEach((r, i) => {
      panel(ctx, r, { radius: 22 });
      // a little needle sewing a row
      sewnLine(ctx, r.x + r.w - 190 * z - 20, r.x + r.w - 24, r.y + 40 * z, s.t + i, threadColor(i), { amp: 5, period: 70 + i * 14, n: 10, width: 4 });
      txt(ctx, RHYTHM[i].name, r.x + 24, r.y + 40 * z, { size: F(42) * z, weight: 700, color: T.text, maxW: r.w - 250 * z, min: 16, fam: NUM });
      txt(ctx, TIER_TEXT[i], r.x + 24, r.y + 82 * z, { size: F(22) * z, weight: 400, color: T.dim, maxW: r.w - 48, min: 12 });
      const best = s.stats.best[RHYTHM[i].id];
      txt(ctx, best ? `Best ${best}` : 'No score yet', r.x + 24, r.y + r.h - 46 * z, { size: F(26) * z, weight: 600, color: best ? T.accent : T.dim, maxW: r.w - 190 * z, min: 12 });
      const pr = R(r.x + r.w - 140 * z - 18, r.y + r.h - 62 * z - 16, 140 * z, 62 * z);
      button(ctx, pr, 'Play', { kind: 'accent', size: 28, radius: 16 });
    });
    return Tr.contentH + 10;
  });
}

// Illustrations for the text pages.
const fakeRun = (name, color, pts, closed = false) => {
  const run = { i: Math.abs(name.length * 7 + color), name, color, closed, pts: pts.map((p) => [p[0], p[1]]), cum: [0], len: 0, opts: [] };
  if (closed) run.pts.push([run.pts[0][0], run.pts[0][1]]);
  for (let k = 1; k < run.pts.length; k++) run.cum.push(run.cum[k - 1] + Math.hypot(run.pts[k][0] - run.pts[k - 1][0], run.pts[k][1] - run.pts[k - 1][1]));
  run.len = run.cum[run.cum.length - 1];
  run.opts.push({ run: run.i, s0: 0, dir: 1, from: run.pts[0], to: run.pts[run.pts.length - 1] });
  return run;
};
const lineRun = (x0, y0, x1, y1, color, name = 'line') => { const pts = []; for (let i = 0; i <= 40; i++) pts.push([x0 + ((x1 - x0) * i) / 40, y0 + ((y1 - y0) * i) / 40]); return fakeRun(name + x0 + y0, color, pts); };
const ringRun = (cx, cy, rad, color) => { const pts = []; for (let i = 0; i < 64; i++) { const a = -Math.PI / 2 + (i / 64) * Math.PI * 2; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); } return fakeRun('ring' + rad, color, pts, true); };
const FIG = 512, FIG_RECT = { x: FIG * 0.05, y: FIG * 0.05, w: FIG * 0.9, h: FIG * 0.9 };
// the static 3D composition of a text-page figure (baked once by the presenter into a sprite)
function figureFrame(kind) {
  const T = theme(), runs = [], fr = { kind: 'cloth', size: 10, rect: FIG_RECT, T, look: lookKey(), key: `fig|${kind}`, runs, sewn: [], targets: [], chalk: [], floats: [], markers: [], needle: null, hand: false, puck: 0.5, done: false, t: 0, calm: true, scene: 'doc', props: false };
  const reg = (run) => { runs.push(run); return runs.length - 1; };
  const sew = (run, u = 1e9) => { const ri = reg(run), full = u >= run.len; fr.sewn.push({ id: `f${ri}`, dashes: dashesFor(run, 0), upTo: full ? 1e9 : u, slot: run.color, run, ri }); fr.targets.push([ri, full ? 1 : u / run.len]); return ri; };
  const chalk = (run, glow = false) => { const ri = reg(run); fr.chalk.push({ dashes: dashesFor(run, 0), tint: threadColor(run.color), ri, glow }); return ri; };
  const mk = (x, y, slot, o = {}) => fr.markers.push({ x, y, slot, kind: 'knot', ...o });
  if (kind === 'row' || kind === 'thread' || kind === 'hop' || kind === 'hint') {
    const a = lineRun(1.5, 3, 8.5, 3, 0, 'a'), b = lineRun(8.5, 5.4, 1.5, 5.4, 0, 'b'), c = lineRun(1.5, 7.8, 8.5, 7.8, 1, 'c');
    const u = a.len * 0.62;
    sew(a, u); fr.chalk.push({ dashes: dashesFor(a, 0), tint: threadColor(0), ri: 0, glow: false });
    if (kind === 'thread' || kind === 'hop') { sew(b); fr.floats.push({ ax: 8.5, ay: 3, bx: 8.5, by: 5.4, slot: 0, alpha: 0.8 }); chalk(c); mk(1.5, 7.8, 1); mk(8.5, 7.8, 1); }
    else { chalk(b, kind === 'hint'); chalk(c); mk(8.5, 5.4, 0, { active: true }); mk(1.5, 5.4, 0); }
    const p = sewPoint(a, a.opts[0], u); fr.needle = { x: p[0], y: p[1], ang: 0, slot: 0, mode: 'sew' };
  } else if (kind === 'ring') {
    chalk(ringRun(5, 5, 3, 1), true); chalk(ringRun(5, 5, 1.3, 0));
    for (const a of [0, 90, 180, 270]) { const an = -Math.PI / 2 + (a * Math.PI) / 180; mk(5 + Math.cos(an) * 3, 5 + Math.sin(an) * 3, 1, { active: a === 90 }); }
  } else if (kind === 'colour') {
    [0, 1, 2].forEach((c, i) => sew(lineRun(1.5, 2.6 + i * 2.4, 8.5, 2.6 + i * 2.4, c, 'c' + c)));
  } else if (kind === 'steady') {
    const row = lineRun(1.2, 5, 8.8, 5, 0, 'st'), u = row.len * 0.6;
    const ri = chalk(row); [1.9, 3.1, 4.7, 5.6, 7.3].forEach((x, i) => mk(x, 5, 0, { active: i === 2 }));
    fr.sewn.push({ id: 'fs', dashes: dashesFor(row, 0), upTo: Math.min(u, 2.0), slot: 0, run: row, ri }); fr.targets.push([ri, 0.3]);
    const p = sewPoint(row, row.opts[0], u); fr.needle = { x: p[0], y: p[1], ang: 0, slot: 0, mode: 'sew' };
  } else if (kind === 'stars' || kind === 'quilt') {
    const P = patch(2, 1);
    for (const run of P.runs) { const ri = reg(run); fr.sewn.push({ id: `f${ri}`, dashes: dashesFor(run, 0), upTo: 1e9, slot: run.color, run, ri }); fr.targets.push([ri, 1]); }
    fr.puck = 0.9;
  }
  return fr;
}
const figProject = (pr, x, y, h = 0) => { const c = clothToScreen(clothCamera(FIG_RECT, 10, FIG, FIG, { pitch: (60 * Math.PI) / 180 }), x, y, h); return { x: pr.x + (c.x / FIG) * pr.w, y: pr.y + (c.y / FIG) * pr.h }; };
function figure(ctx, r, kind, t) {
  const T = theme();
  const side = Math.min(r.w, r.h), pr = R(r.x + (r.w - side) / 2, r.y + (r.h - side) / 2, side, side), geo = patchGeo(pr, 10, 0.05);
  const spr = v3.on && v3.bake ? v3.bake(`fig|${kind}|${lookKey()}`, () => figureFrame(kind), FIG) : null;
  if (spr) {
    ctx.save(); rr(ctx, pr.x, pr.y, pr.w, pr.h, pr.w * 0.04); ctx.clip(); ctx.drawImage(spr, pr.x, pr.y, pr.w, pr.h); ctx.restore();
    rr(ctx, pr.x, pr.y, pr.w, pr.h, pr.w * 0.04); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(240,212,136,0.8)'; ctx.stroke();
    const P2 = (x, y, h = 0) => figProject(pr, x, y, h);
    if (kind === 'colour') [0, 1, 2].forEach((c, i) => { const p = P2(9.1, 2.6 + i * 2.4); glyph(ctx, p.x, p.y, pr.w * 0.026, c, '#fbeedd'); });
    else if (kind === 'stars') {
      for (let k = 0; k < 3; k++) { const p = P2(2.6 + k * 2.4, 4.4); icons.star(ctx, p.x, p.y, pr.w * 0.22, '#ffc93c'); }
      const p = P2(1.2, 7); threadBar(ctx, R(p.x, p.y, pr.w * 0.76, 30), { cap: 20, rem: 11, use: 0, slot: 0, spool: false });
    } else if (kind === 'quilt') {
      for (let i = 0; i < 6; i++) { const q = P2(0.9 + (i % 3) * 2.8, 1.2 + Math.floor(i / 3) * 4.2), q2 = P2(0.9 + (i % 3) * 2.8 + 2.5, 1.2 + Math.floor(i / 3) * 4.2 + 2.5); miniPatch(ctx, R(q.x, q.y, q2.x - q.x, q2.y - q.y), patch(i % 5, i % 6), { done: true }); }
    }
    return;
  }
  const fake = fakeRun;
  void fake;
  drawCloth(ctx, geo, { puck: kind === 'quilt' || kind === 'stars' ? 0.8 : 0.3, t });
  const cyc = (t % 5) / 4;
  if (kind === 'row' || kind === 'thread' || kind === 'hop' || kind === 'hint') {
    const a = lineRun(1.5, 3, 8.5, 3, 0, 'a'), b = lineRun(8.5, 5.4, 1.5, 5.4, 0, 'b'), c = lineRun(1.5, 7.8, 8.5, 7.8, 1, 'c');
    const u = clamp(cyc * 1.4, 0, 1) * a.len;
    threadRun(ctx, geo, a, 0, u, 0);
    if (kind === 'thread' || kind === 'hop') { threadRun(ctx, geo, b, 0, b.len, 0); floatLine(ctx, geo, [8.5, 3], [8.5, 5.4], 0, 0.7); chalkRun(ctx, geo, c); marker(ctx, geo.X(1.5), geo.Y(7.8), 9, 1); marker(ctx, geo.X(8.5), geo.Y(7.8), 9, 1); }
    else { chalkRun(ctx, geo, b, { glow: kind === 'hint' }); chalkRun(ctx, geo, c); marker(ctx, geo.X(8.5), geo.Y(5.4), 10, 0, { active: true }); marker(ctx, geo.X(1.5), geo.Y(5.4), 10, 0); }
    if (u > 0 && u < a.len) { const p = sewPoint(a, a.opts[0], u); needle(ctx, geo.X(p[0]), geo.Y(p[1]), 18, 0, 0); }
  } else if (kind === 'ring') {
    const ring = ringRun(5, 5, 3, 1), r2 = ringRun(5, 5, 1.3, 0);
    chalkRun(ctx, geo, ring, { glow: true }); chalkRun(ctx, geo, r2);
    for (const a of [0, 90, 180, 270]) { const an = -Math.PI / 2 + (a * Math.PI) / 180; marker(ctx, geo.X(5 + Math.cos(an) * 3), geo.Y(5 + Math.sin(an) * 3), 9, 1, { active: a === 90 }); }
  } else if (kind === 'colour') {
    [0, 1, 2].forEach((c, i) => { const run = lineRun(1.5, 2.6 + i * 2.4, 8.5, 2.6 + i * 2.4, c, 'c' + c); threadRun(ctx, geo, run, 0, run.len, c); glyph(ctx, geo.X(9.1), geo.Y(2.6 + i * 2.4), 10, c, T.ink); });
  } else if (kind === 'stars') {
    for (let k = 0; k < 3; k++) icons.star(ctx, geo.X(2.6 + k * 2.4), geo.Y(4.4), geo.s * 2.2, '#ffc93c');
    threadBar(ctx, R(geo.X(1.2), geo.Y(7), geo.s * 7.6, 30), { cap: 20, rem: 11, use: 0, slot: 0 });
  } else if (kind === 'steady') {
    const row = lineRun(1.2, 5, 8.8, 5, 0, 'st'), u = clamp(cyc * 1.3, 0, 1) * row.len;
    chalkRun(ctx, geo, row);
    [1.9, 3.1, 4.7, 5.6, 7.3].forEach((x, i) => { marker(ctx, geo.X(x), geo.Y(5), 9, 0, { dim: false, active: i === 2 }); });
    threadRun(ctx, geo, row, 0, Math.min(u, 2.0), 0);
    const p = sewPoint(row, row.opts[0], u); needle(ctx, geo.X(p[0]), geo.Y(p[1]), 18, 0, 0);
  } else if (kind === 'quilt') {
    for (let i = 0; i < 6; i++) { const rr0 = R(geo.X(0.9 + (i % 3) * 2.8), geo.Y(1.2 + Math.floor(i / 3) * 4.2), geo.s * 2.5, geo.s * 2.5); miniPatch(ctx, rr0, patch(i % 5, i % 6), { done: true }); }
  }
}

function drawDoc(ctx, s, w, h) {
  const T = theme(), doc = DOCS[s.doc.kind], page = doc.pages[s.doc.page], DL = docLayout(w, h), sc = scaleOf(s);
  header(ctx, s, DL, doc.title);
  const n = doc.pages.length;
  button(ctx, DL.menu, 'Menu', { icon: 'back', size: 26, flash: flashOf(s, 'back') });
  button(ctx, DL.prev, 'Prev', { size: 26, disabled: s.doc.page === 0, flash: flashOf(s, 'prev') });
  button(ctx, DL.next, 'Next', { size: 26, kind: s.doc.page < n - 1 ? 'accent' : 'solid', disabled: s.doc.page >= n - 1, flash: flashOf(s, 'next') });
  txt(ctx, `${s.doc.page + 1} / ${n}`, DL.count.x + DL.count.w / 2, DL.count.y + DL.count.h / 2, { size: F(26), weight: 600, color: T.dim, align: 'center' });
  const textR = DL.text, figR = DL.fig;
  if (v3.on) plaque(ctx, R(textR.x - 10, textR.y - 8, textR.w + 20, textR.h + 14), { radius: 24, tone: 'dark', alpha: 0.88, stitch: false });
  const drawText = (top, width, x) => {
    let y = top;
    txt(ctx, page.title, x, y + 26 * sc, { size: F(38) * sc, weight: 700, color: T.accent, maxW: width, min: 16, fam: NUM }); y += 26 * sc + 30 * sc;
    for (const b of page.body) {
      if (b.p) y += para(ctx, b.p, x, y, width, { size: F(28) * sc, weight: 400, color: T.text, lh: 1.34 }) + 14 * sc;
      else if (b.li) for (const it of b.li) {
        const sz = F(27) * sc;
        ctx.beginPath(); ctx.arc(x + 8 * sc, y + sz * 0.62, 5 * sc, 0, 7); ctx.fillStyle = T.accent; ctx.fill();
        y += para(ctx, it, x + 28 * sc, y, width - 28 * sc, { size: sz, weight: 400, color: T.text, lh: 1.3 }) + 10 * sc;
      }
    }
    return y - top + 20;
  };
  if (DL.split) {
    if (page.fig) figure(ctx, figR, page.fig, s.t);
    scrollBody(ctx, s, textR, () => drawText(textR.y, textR.w - 10, textR.x));
  } else {
    scrollBody(ctx, s, textR, () => {
      let y = textR.y;
      if (page.fig) {
        const fh = Math.min(textR.w, Math.max(240, textR.h * (sc > 1.6 ? 0.4 : 0.52)), 560), fr = R(textR.x + (textR.w - Math.min(textR.w, fh + 120)) / 2, y, Math.min(textR.w, fh + 120), fh);
        figure(ctx, fr, page.fig, s.t); y += fr.h + 14;
      }
      return y - textR.y + drawText(y, textR.w - 10, textR.x);
    });
  }
}

function drawSettings(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), ROWS = settingRows(s), SL = settingsLayout(w, h, sc, ROWS.length);
  header(ctx, s, SL, 'Settings');
  scrollBody(ctx, s, SL.body, () => {
    ROWS.forEach((row, i) => {
      const g = SL.rows[i];
      panel(ctx, g.rect, { radius: 20 });
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + g.rect.h / 2, { size: F(28) * Math.min(sc, 1.5), weight: 600, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      const n = row.opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      row.opts.forEach((o, k) => button(ctx, seg[k], o, { size: 24, active: k === cur || (row.id === 'restore' && !!s.owned), radius: 14, kind: row.id === 'restore' ? 'accent' : 'solid', disabled: row.id === 'restore' && !!s.restoreBusy, flash: flashOf(s, 'set' + i + '.' + k) }));
    });
    return SL.contentH;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

function drawStats(ctx, s, w, h) {
  const T = theme(), LL = listLayout(w, h), sc = scaleOf(s), z = Math.min(sc, 1.6);
  header(ctx, s, LL, 'Stats');
  button(ctx, LL.back, 'Menu', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
  scrollBody(ctx, s, LL.body, () => {
    const body = LL.body;
    const stars = Object.values(s.progress).reduce((a, p) => a + (p.stars ?? 0), 0);
    const rows = [
      ['Quilt patches sewn', `${Object.keys(s.progress).length} of 30`],
      ['Quilt stars', `${stars} of 90`],
      ['Patches sewn in all', s.stats.solved],
      ['Daily streak', `${s.streak} day${s.streak === 1 ? '' : 's'}`],
      ['Best daily streak', `${s.stats.bestStreak} day${s.stats.bestStreak === 1 ? '' : 's'}`],
      ...RHYTHM.map((t) => [`Steady Hand ${t.name}: best`, s.stats.best[t.id] ?? '–']),
      ['Steady Hand rounds', s.stats.rounds],
    ];
    let y = body.y;
    const rh = 70 * z;
    rows.forEach(([l, v]) => {
      const r = R(body.x, y, body.w, rh - 8);
      panel(ctx, r, { radius: 16 });
      txt(ctx, l, r.x + 18, r.y + r.h / 2, { size: F(26) * z, weight: 500, color: T.text, maxW: r.w * 0.66, min: 12 });
      txt(ctx, String(v), r.x + r.w - 18, r.y + r.h / 2, { size: F(30) * z, weight: 600, color: T.accent, align: 'right', maxW: r.w * 0.3, min: 12 });
      y += rh;
    });
    return y - body.y + 10;
  });
}

// ================================================================ result ===================================================================
function drawOver(ctx, s, w, h) {
  const T = theme(), R0 = s.result;
  if (!R0) return;
  setBrandTone(T.dark);
  const sc = scaleOf(s), O = overLayout(w, h), art = O.art;
  if (R0.type === 'patch' && s.B) {
    const P = s.B.P, geo = patchGeo(art, P.size, 0.05);
    const sewn = new Map();
    s.B.steps.forEach((step) => { const op = P.opts[step.g]; sewn.set(op.run, P.runs[op.run].opts.indexOf(op)); });
    if (v3.on) {
      const fr = newFrame(s, geo, P.runs, `${s.B.kind}|${s.B.ref}|${P.runs.length}|${P.C}`);
      for (const run of P.runs) { const idx = sewn.get(run.i) ?? 0; fr.sewn.push({ id: `${run.i}:${idx}`, dashes: dashesFor(run, idx), upTo: 1e9, slot: run.color, run, ri: run.i }); fr.targets.push([run.i, 1]); }
      fr.puck = 1; fr.done = true; fr.props = true; v3.frame = fr;
    } else {
      drawCloth(ctx, geo, { puck: 1, t: s.t, seed: P.runs.length });
      for (const run of P.runs) threadRun(ctx, geo, run, sewn.get(run.i) ?? 0, 1e9, run.color);
    }
    drawSparks(ctx, s);
  } else if (R0.type === 'steady' && s.R) {
    const Rd = s.R, geo = patchGeo(art, 10, 0.05), Tt = RHYTHM[Rd.tier];
    const fr = v3.on ? newFrame(s, geo, Rd.data.rows.map((r) => r.run), `steady|${Rd.tier}|${Rd.seed}`) : null;
    if (!v3.on) drawCloth(ctx, geo, { puck: 1, t: s.t, seed: 4 });
    Rd.data.rows.forEach((row, r) => {
      const col = threadColor(r % 3);
      row.holes.forEach((hole, k) => {
        const hh = Rd.holes[r][k];
        if (hh.res !== 'hit') return;
        if (fr) fr.sewn.push({ id: `st${r}:${k}`, dashes: [stitchDash(row, hole.s + hh.err * Tt.speed)], upTo: 1e9, slot: r % 3, run: null, ri: r });
        else stitchAt(ctx, geo, row, hole.s + hh.err * Tt.speed, col);
      });
      if (fr) fr.targets.push([r, 1]);
    });
    if (fr) { fr.puck = 1; fr.done = true; fr.props = true; v3.frame = fr; }
  }
  if (v3.on) plaque(ctx, R(O.body.x - 6, O.body.y - 4, O.body.w + 12, O.body.h + 8), { radius: 24, tone: 'dark', alpha: 0.84, stitch: false });
  const body = O.body;
  scrollBody(ctx, s, body, () => {
    let y = body.y + 4;
    const compact = O.wide, tsz = compact ? 40 : 50, z = Math.min(sc, 1.5);
    const title = R0.type === 'steady' ? 'Round complete' : R0.daily ? 'Daily Patch sewn' : 'Patch sewn';
    txt(ctx, title, body.x + body.w / 2, y + tsz * 0.55, { size: F(tsz) * z, weight: 700, color: T.text, align: 'center', maxW: body.w, min: 18, fam: NUM }); y += (tsz + 12) * z;
    const sz = compact ? 36 : 50;
    for (let k = 0; k < 3; k++) icons.star(ctx, body.x + body.w / 2 + (k - 1) * (sz + 10), y + sz / 2, sz, k < R0.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
    y += sz + (compact ? 8 : 16);
    const facts = R0.type === 'steady'
      ? [['Score', R0.score], ['Even stitches', `${Math.round(R0.acc * 100)}%`], ['Best combo', R0.combo], ['Best', R0.best]]
      : [['Threads used', R0.threads], ['Best plan', R0.aim], ['Thread wasted', fmt1(R0.wasted)], ['Time', fmtT(R0.time)]];
    const cols = body.w > 330 ? 4 : 2, fw = (body.w - 8 * (cols - 1)) / cols, fh = (compact ? 66 : 80) * Math.min(sc, 1.7);
    facts.forEach(([l, v], i) => {
      const r = R(body.x + (i % cols) * (fw + 8), y + Math.floor(i / cols) * (fh + 8), fw, fh);
      panel(ctx, r, { radius: 14 });
      txt(ctx, v, r.x + r.w / 2, r.y + fh * 0.4, { size: F(compact ? 26 : 32) * z, weight: 700, color: T.text, align: 'center', maxW: fw - 8, min: 12 });
      txt(ctx, l, r.x + r.w / 2, r.y + fh * 0.78, { size: F(18) * z, weight: 400, color: T.dim, align: 'center', maxW: fw - 6, min: 11 });
    });
    y += Math.ceil(facts.length / cols) * (fh + 8) + 4;
    if (R0.newBest) { txt(ctx, 'New best score for this tier', body.x + body.w / 2, y + 16, { size: F(24) * sc, weight: 600, color: T.good, align: 'center', maxW: body.w, min: 12 }); y += 40 * sc; }
    if (R0.type === 'patch' && R0.threads <= R0.aim) { txt(ctx, 'You found the fewest possible threads', body.x + body.w / 2, y + 16, { size: F(24) * sc, weight: 600, color: T.good, align: 'center', maxW: body.w, min: 12 }); y += 40 * sc; }
    if (R0.daily) y += para(ctx, `Daily streak: ${R0.streak} day${R0.streak === 1 ? '' : 's'}`, body.x, y, body.w, { size: F(28) * sc, weight: 600, color: T.accent, align: 'center' }) + 8;
    txt(ctx, 'Did you know', body.x, y + 16 * sc, { size: F(26) * sc, weight: 700, color: T.accent }); y += 38 * sc;
    y += para(ctx, FACTS[R0.fact % FACTS.length], body.x + 8, y, body.w - 16, { size: F(24) * sc, weight: 400, color: T.dim, lh: 1.3 }) + 6;
    return y - body.y + 10;
  });
  const nextLabel = R0.type === 'steady' ? 'Play again' : R0.kind === 'quilt' ? (R0.next ? 'Next patch' : 'Back to the Quilt') : 'Back to menu';
  button(ctx, O.btns.next, nextLabel, { kind: 'accent', size: 32, flash: flashOf(s, 'next') });
  button(ctx, O.btns.share, 'Share', { size: 28, flash: flashOf(s, 'share') });
  button(ctx, O.btns.menu, R0.type === 'steady' ? 'Tiers' : R0.kind === 'quilt' ? 'Quilt' : 'Menu', { size: 28, flash: flashOf(s, 'menu') });
  drawMoreLine(ctx, O.more.x, O.more.y, 15);
}

function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 460);
  panel(ctx, c, { radius: 28, fill: 'rgba(14,16,40,0.95)' }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the demo end', c.x + c.w / 2, c.y + 70, { size: F(40), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 18, fam: NUM });
  para(ctx, 'The full game has the whole Quilt of 30 patches, the Daily Patch, Steady Hand at three tiers, hints that teach and Watch and Learn. Get Kantha Running Stitch Quilt on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(26), weight: 400, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
export { smooth };
