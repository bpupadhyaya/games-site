// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The heavy backdrop is cached (art.js).
import { LV, GATE, LOOP, TRICKS, trickInfo, levelInfo, xAt, flightTime, tolOf, sizeOfHold, idealRelease, nextNote, COUNT_IN, newTrick } from './rules.js';
import { curLayout, host, clamp } from './layout.js';
import {
  PAL, INK, ACC, CREAM, GOLD, lcg, drawBackdrop, drawGround, drawBunting, drawCharro, ropeStroke, loopPoints, flowerPoints, eightPoints, drawTarget, drawKnot, drawPanel,
} from './art.js';
import { screenButtons, screenLayout, readerFlow, readerMax, zoomOf } from './ui.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { ART_H } from './text.js';

export const DISPLAY = '"Fredoka", "Trebuchet MS", system-ui, sans-serif';
export const BIG = '"Dela Gothic One", "Fredoka", Impact, system-ui, sans-serif';
const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
let PRESSED = null;
const R_FIT = new Map();

export function render(ctx, state, L = curLayout()) {
  const sc = state.scene, z = zoomOf(state), R = makeText(ctx);
  PRESSED = state.press && !state.press.moved ? state.press.b : null;
  const panelScene = ['setup', 'settings', 'how', 'about', 'rules', 'demo-limit'].includes(sc);
  if (sc === 'title') { drawTitle(ctx, state, R, L); return; }
  if (panelScene) { drawBackdropScene(ctx, state, L); scrim(ctx, L, 0.46); drawPanelScene(ctx, state, R, z, L); return; }
  const auto = sc === 'autoplay' || sc === 'autoplay-over';
  drawArena(ctx, state, L.play.scene, { R, tight: true, charroScale: !L.land && L.h / L.w > 1.7 ? 1.5 : 1 });
  drawHud(ctx, state, R, L, auto);
  if (sc === 'play' || sc === 'autoplay') {
    if (!state.menuOpen) for (const b of screenButtons(state, L)) R.button(b);
    if (sc === 'autoplay' && state.ap.paused && !state.menuOpen) drawPausedBanner(ctx, R, L);
  }
  if (state.menuOpen && (sc === 'play' || sc === 'autoplay')) { scrim(ctx, L, 0.62); drawStack(ctx, state, R, z, L); }
  if (sc === 'over' || sc === 'autoplay-over') drawOver(ctx, state, R, z, L);
}

// ---- text helpers ------------------------------------------------------------------------------------------------------------
function makeText(ctx) {
  const text = (str, x, y, size, color = '#fff', font = DISPLAY, weight = 600, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const glowText = (str, x, y, size, color, align = 'center') => { ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size * 0.16); ctx.strokeStyle = 'rgba(40,12,20,0.78)'; ctx.font = `700 ${size}px ${DISPLAY}`; ctx.textAlign = align; ctx.strokeText(str, x, y); ctx.fillStyle = color; ctx.fillText(str, x, y); ctx.restore(); };
  const fit = (str, x, y, maxW, maxH, sMax, sMin, color, weight = 600) => {
    sMax = Math.round(sMax);
    const key = str + '|' + sMax + '|' + Math.round(maxW) + '|' + Math.round(maxH) + '|' + weight;
    let hit = R_FIT.get(key);
    if (!hit) {
      for (let s = sMax; s >= sMin; s -= 1) {
        ctx.font = `${weight} ${s}px ${DISPLAY}`; const lines = []; let cur = '';
        for (const w of str.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
        lines.push(cur);
        if (lines.length * s * 1.18 <= maxH || s === sMin) { hit = { s, lines }; break; }
      }
      if (R_FIT.size > 400) R_FIT.clear();
      R_FIT.set(key, hit);
    }
    const lh = hit.s * 1.18, top = y + (maxH - hit.lines.length * lh) / 2 + hit.s * 0.84;
    hit.lines.forEach((ln, i) => text(ln, x, top + i * lh, hit.s, color, DISPLAY, weight));
  };
  // flat, clean buttons: one solid fill, a thin edge, a soft drop shadow (no inner shapes)
  const button = (n) => {
    ctx.save(); if (n.dim) ctx.globalAlpha = 0.45;
    const down = !!n.id && n.id === PRESSED && !n.dim; if (down) ctx.translate(0, 5);
    const prim = n.primary, sel = n.sel, hot = prim || (sel && n.chip);
    // lacquered key: a darker lip underneath gives depth, the face is a soft vertical gradient, a thin lit edge on top, pressed = sinks onto the lip
    const lip = Math.min(7, Math.max(4, n.h * 0.09)), face = hot ? ['#f0603f', '#c8321d'] : sel ? ['#27c0ae', '#0f7f74'] : ['#3d3a78', '#25224f'], lipC = hot ? '#7d1a0c' : sel ? '#08463f' : '#12102c';
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.roundRect(n.x + 1, n.y + lip + 4, n.w, n.h, 18); ctx.fill();
    ctx.fillStyle = lipC; ctx.beginPath(); ctx.roundRect(n.x, n.y + lip, n.w, n.h, 18); ctx.fill();
    const fh = n.h - (down ? 0 : lip * 0.35);
    const gr = ctx.createLinearGradient(0, n.y, 0, n.y + fh); gr.addColorStop(0, face[0]); gr.addColorStop(1, face[1]);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(n.x, n.y, n.w, fh, 18); ctx.fill();
    ctx.strokeStyle = hot ? '#ffd9a8' : 'rgba(255,217,106,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.roundRect(n.x + 1.5, n.y + 1.5, n.w - 3, fh - 3, 16.5); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(n.x + 14, n.y + 2.5); ctx.lineTo(n.x + n.w - 14, n.y + 2.5); ctx.stroke(); ctx.restore();
    if (down) { ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); ctx.roundRect(n.x, n.y, n.w, fh, 18); ctx.fill(); }
    const lines = n.lines || [n.label];
    let size = n.size; const need = lines.length * size * 1.2;
    if (need > n.h - 12) size = Math.max(14, Math.floor((n.h - 12) / (lines.length * 1.2)));
    const floor = 11 / (host.px || 0.6);
    if (size < floor) { let t = Math.min(floor, (n.h - 8) / (lines.length * 1.2)); ctx.font = `700 ${t}px ${DISPLAY}`; while (t > size && Math.max(...lines.map((l) => ctx.measureText(l).width)) > n.w - 14) { t -= 0.5; ctx.font = `700 ${t}px ${DISPLAY}`; } size = Math.max(size, t); }
    ctx.font = `700 ${size}px ${DISPLAY}`;
    const mw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (mw > n.w - 12) size = Math.max(10, size * (n.w - 12) / mw);
    const lh = size * 1.2, top = n.y + n.h / 2 - (lines.length * lh) / 2 + size * 0.86;
    lines.forEach((ln, i) => text(ln, n.x + n.w / 2, top + i * lh, size, '#fff8e6', DISPLAY, 700));
    ctx.restore();
  };
  return { text, glowText, fit, button };
}
const scrim = (ctx, L, a = 0.6) => { ctx.fillStyle = `rgba(18,12,40,${a})`; ctx.fillRect(0, 0, L.w, L.h); };
const plate = (ctx, x, y, w, h, r = 16, fill = 'rgba(28,27,58,0.93)', edge = GOLD) => {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6; ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.restore();
  if (fill.startsWith('rgba(28,27,58')) { // carved dark panel: lighter upper half, darker lower half
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(70,64,138,0.55)'); g.addColorStop(0.5, 'rgba(36,33,78,0.0)'); g.addColorStop(1, 'rgba(6,4,20,0.5)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  }
  ctx.strokeStyle = edge; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke();
  if (h > 24 && w > 24) { ctx.save(); ctx.globalAlpha = 0.28; ctx.strokeStyle = edge; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(x + 5, y + 5, w - 10, h - 10, Math.max(4, r - 5)); ctx.stroke(); ctx.restore(); }
};

// ---- the arena ------------------------------------------------------------------------------------------------------------------
// Geometry of the lienzo inside a scene rectangle. All the game's scene coordinates are fractions of `sc`.
export function geom(sc, tight = false) {
  const k = clamp(Math.min(sc.w / 640, sc.h / 470), 0.45, 2.1);
  const gy = sc.y + Math.round(sc.h * 0.5);
  const a3 = arena3d(), tg = tight && a3;
  const railY = sc.y + sc.h * (tg ? 0.6 : 0.745), footY = sc.y + sc.h * (tg ? 0.91 : 0.955);
  const charX = sc.x + Math.max(sc.w * 0.17, 100 * k);
  const railL = sc.x + sc.w * 0.08, railW = sc.w * 0.84;
  const kt = k * 0.78;
  const s = Math.min(railW / (tg ? 7.0 : 9.5), sc.h / 6.8);                       // px per metre on the horse lane (the 3D scene's scale)
  return { k, kt, s, sc, gy, railY, footY, charX, railL, railW, gateX: railL + railW * GATE, neckY: railY - (a3 ? 1.5 * s : 118 * kt), X: (x) => railL + railW * x };
}

const arena3d = () => { const a = globalThis.__arena3d; return a && a.draw ? a : null; };
const PHASE = (state) => state.t * (3.2 + 11 * (state.spin ?? 0.3));

export function drawArena(ctx, state, sc, o = {}) {
  const g = geom(sc, o.tight), t = state.t, calm = state.prefs.calm, R = o.R;
  ctx.save(); ctx.beginPath(); ctx.rect(sc.x, sc.y, sc.w, sc.h); ctx.clip();
  if (state.shake > 0 && !calm) ctx.translate(Math.sin(t * 90) * 3 * state.shake * 4, 0);
  const run = o.demoRun || (state.run && (state.scene === 'play' || state.scene === 'autoplay') ? state.run : null);
  const inRun = !!run && (state.ph === 'run' || (state.ph === 'result' && state.res && state.res.kind === 'run') || state.ph === 'apthink' || state.ph === 'apreveal' || o.demoRun);
  // the real 3D lienzo when it is ready; while it loads a plain warm wash (no flash of the flat picture); the 2D picture only if 3D is unavailable
  const A3 = globalThis.__arena3d;
  if (A3 && A3.pending) { drawLoadingWash(ctx, sc); drawFx(ctx, state, sc, R); ctx.restore(); return; }
  if (A3 && A3.draw && draw3D(ctx, A3, state, g, sc, run, inRun, o)) { drawGuides(ctx, g, state, run, inRun, t); drawFx(ctx, state, sc, R); ctx.restore(); return; }
  const hy = drawBackdrop(ctx, sc, 0.5);
  drawGround(ctx, sc, hy, t);
  // papel picado strung across the arena
  drawBunting(ctx, sc.x - 10, sc.x + sc.w + 10, sc.y + 6, t, calm, clamp(g.k * 0.9, 0.6, 1.5));
  if (sc.h > 260) drawBunting(ctx, sc.x - 10, sc.x + sc.w + 10, sc.y + 6 + 54 * clamp(g.k * 0.9, 0.6, 1.5), t + 2, calm, clamp(g.k * 0.8, 0.5, 1.3));
  drawRail(ctx, g, sc);
  // the post comes first (behind the target)
  drawPost(ctx, g, state, run, inRun, t);
  if (run) drawRunTarget(ctx, g, state, run, o);
  else if (!o.noParked) drawTarget(ctx, g.X(0.9), g.railY, g.kt, -1, { roll: 0, rock: 0, t: 0, hit: 1 });
  drawCharroScene(ctx, g, state, run, inRun, o);
  drawFx(ctx, state, sc, R);
  ctx.restore();
}

function drawLoadingWash(ctx, sc) {
  const g = ctx.createLinearGradient(0, sc.y, 0, sc.y + sc.h);
  g.addColorStop(0, '#5f8fc8'); g.addColorStop(0.45, '#f3cf9c'); g.addColorStop(0.5, '#d9a86a'); g.addColorStop(1, '#e8c58c');
  ctx.fillStyle = g; ctx.fillRect(sc.x, sc.y, sc.w, sc.h);
}

// ---- the 3D scene: describe what is happening in plain numbers, the arena (view3d/arena.js) does the drawing ---------------------------
function draw3D(ctx, A3, state, g, sc, run, inRun, o) {
  const t = state.t, ang = PHASE(state), tr = state.tr;
  const trickId = o.demoTrick || (tr && !inRun ? tr.id : null);
  let arm = -1.25 + Math.sin(ang * 0.5) * 0.12, step = 0, crouch = 0, lean = 0;
  const holdNote = tr && tr.notes.find((n) => n.state === 'held');
  if (trickId === 'entrada') { step = holdNote ? 18 : 0; arm = -0.3; } else if (trickId === 'salto') { crouch = holdNote ? 1 : 0; arm = -0.3; } else if (trickId === 'mariposa') arm = -0.8;
  if (inRun && state.hold) { lean = -0.4 * sizeOfHold(state.hold.t); arm = -1.45; }
  if (inRun && state.loops.length && state.loops[state.loops.length - 1].t0 + 0.25 > state.rc && !o.demoRun) { arm = -0.35; lean = 0.5; }
  const items = [];
  if (inRun) {
    const air = state.loops.filter((q) => !q.done || (state.caught && q === state.loops[state.loops.length - 1]));
    const swinging = !!state.hold || (!air.length && state.coil <= 0 && state.run && state.run.throws < state.run.maxThrows);
    if (!o.demoRun) {
      state.loops.forEach((lp, i) => {
        const u = (state.rc - lp.t0) / lp.T, last = lp === state.loops[state.loops.length - 1];
        const fl = (uu) => ({ type: 'flight', u: uu, size: lp.size, grade: lp.res.grade, landFrac: lp.res.x, dir: run ? run.dir : 1, spin: i * 2.1 + lp.t0 * 5 });
        if (lp.done && !(state.caught && last)) { if (u < 1.25) items.push(fl(clamp(u, 0, 1.25))); return; }
        if (!state.caught) items.push(fl(clamp(u, 0, 1)));
      });
      if (state.caught && run) items.push({ type: 'caught', dir: run.dir, size: state.caught.size, settle: clamp(state.caught.t / 0.3, 0, 1) });
    }
    if (swinging || o.demoRun) { const sz = state.hold ? sizeOfHold(state.hold.t) : 0.3 + 0.1 * Math.sin(ang * 0.3); items.push({ type: 'swing', size: sz, r: 0.3 + 0.55 * sz, ang }); }
  } else {
    switch (trickId) {
      case 'flor': { const bloom = holdNote ? 1 : 0.4 + 0.3 * Math.sin(ang * 0.2); items.push({ type: 'flor', r: 0.62 + 0.22 * bloom, ang, bloom }); break; }
      case 'entrada': case 'salto': items.push({ type: trickId, r: trickId === 'salto' ? 0.9 : 0.78, ang }); break;
      case 'mariposa': items.push({ type: 'mariposa', r: 0.66, ang }); break;
      default: items.push({ type: 'swing', size: state.spin ?? 0.3, r: 0.5 + 0.2 * (state.spin ?? 0.3), ang });
    }
  }
  let horse = null;
  if (run) { const p = targetPos(state, run, o); horse = { frac: p.x, dir: run.dir, caught: !!state.caught }; }
  else if (!o.noParked) horse = { frac: 0.9, dir: -1, parked: true };
  const geo = { sc, railL: g.railL, railW: g.railW, railY: g.railY, footY: g.footY, charX: g.charX, k: g.k, s: g.s, charroScale: o.charroScale || 1 };
  return !!A3.draw(ctx, geo, { t, calm: state.prefs.calm, charro: { arm, lean, step, crouch, circle: trickId ? 0.8 : 1 }, horse, gateFrac: GATE, items });
}

// the guides the 2D game keeps on top of the picture: the catch zone and the prediction ring
function drawGuides(ctx, g, state, run, inRun, t) {
  if (!(inRun && state.scene === 'play' && state.prefs.guide && state.ph === 'run' && (state.hold || state.hintRun))) return;
  const size = state.hold ? sizeOfHold(state.hold.t) : 0.55, lvl = run ? run.level : 'charro', x = g.gateX, y = g.railY, h = 2.2 * g.s;
  const w = tolOf(size, lvl) * g.railW * 2, pu = 0.5 + 0.5 * Math.sin(t * 6);
  ctx.fillStyle = `rgba(255,226,90,${0.16 + 0.1 * pu})`; ctx.fillRect(x - w / 2, y - h, w, h + 4);
  ctx.strokeStyle = 'rgba(255,226,90,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.strokeRect(x - w / 2, y - h, w, h + 4); ctx.setLineDash([]);
  if (run && !state.caught && state.rc < run.D) {
    const px = g.X(xAt(run, state.rc + flightTime(size))), r = (0.45 + 0.4 * size) * g.s, near = Math.abs(px - g.gateX) <= tolOf(size, run.level) * g.railW * 0.7;
    ctx.save(); ctx.strokeStyle = near ? '#7bff9a' : 'rgba(255,255,255,0.92)'; ctx.lineWidth = Math.max(2.5, 0.1 * g.s); ctx.setLineDash([7, 6]); ctx.shadowColor = near ? '#7bff9a' : 'rgba(0,0,0,0.5)'; ctx.shadowBlur = near ? 14 : 5;
    ctx.beginPath(); ctx.ellipse(px, g.neckY + 0.1 * g.s, r, r * 0.42, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
}

function drawRail(ctx, g, sc) {
  const y = g.railY;
  ctx.fillStyle = 'rgba(70,40,15,0.35)'; ctx.fillRect(sc.x, y + 1, sc.w, 7 * g.kt);
  ctx.fillStyle = PAL.woodDark; for (let x = sc.x + 6; x < sc.x + sc.w; x += 22 * g.kt) ctx.fillRect(x, y - 2, 10 * g.kt, 8 * g.kt);
  ctx.fillStyle = '#4a4a56'; ctx.fillRect(sc.x, y - 4 * g.kt, sc.w, 4.5 * g.kt);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(sc.x, y - 4 * g.kt, sc.w, 1.4 * g.kt);
}

function drawPost(ctx, g, state, run, inRun, t) {
  const x = g.gateX, y = g.railY, k = g.kt, h = 150 * k;
  // the catch zone: a band on the rail whose width is the current loop's catch width
  const size = state.hold ? sizeOfHold(state.hold.t) : 0.55, lvl = run ? run.level : 'charro';
  if (inRun && state.scene === 'play' && state.prefs.guide && (state.hold || state.hintRun) && state.ph === 'run') {
    const w = tolOf(size, lvl) * g.railW * 2, pu = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(255,226,90,${0.2 + 0.1 * pu})`; ctx.fillRect(x - w / 2, y - h * 0.9, w, h * 0.9 + 6 * k);
    ctx.strokeStyle = 'rgba(255,226,90,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.strokeRect(x - w / 2, y - h * 0.9, w, h * 0.9 + 6 * k); ctx.setLineDash([]);
  }
  // painted pole with red and cream stripes and a gold hoop on top
  const px = x - 6 * k;
  for (let j = 0; j < 8; j++) { ctx.fillStyle = j % 2 ? PAL.cream : PAL.red; ctx.fillRect(px, y - (j + 1) * (h / 8), 12 * k, h / 8 + 0.5); }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(px + 8 * k, y - h, 4 * k, h);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.ellipse(x, y - h - 6 * k, 15 * k, 15 * k * 0.5, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = PAL.magenta; ctx.beginPath(); ctx.moveTo(x, y - h - 26 * k); ctx.lineTo(x + 24 * k, y - h - 18 * k + Math.sin(t * 3) * 2 * k); ctx.lineTo(x, y - h - 10 * k); ctx.closePath(); ctx.fill();
}

function targetPos(state, run, o) {
  if (o.demoRun) return { x: xAt(run, o.demoT), live: true };
  if (state.caught) return { x: state.caught.x, live: false };
  if (state.ph === 'run' || (state.ph === 'result' && state.res && state.res.kind === 'run')) return { x: xAt(run, Math.min(state.rc, run.D)), live: state.ph === 'run' };
  return { x: xAt(run, 0), live: false };
}
function drawRunTarget(ctx, g, state, run, o) {
  const p = targetPos(state, run, o), X = g.X(p.x);
  const caught = !!state.caught;
  const rock = caught ? Math.sin(state.t * 14) * (1 - clamp(state.caught.t / 0.8, 0, 1)) : 0;
  drawTarget(ctx, X, g.railY, g.kt, run.dir, { roll: p.x * 60 * run.dir, rock, t: state.t, hit: caught ? 1 : 0 });
  // prediction ring: where the target will be when a loop thrown now comes down
  if (state.scene === 'play' && state.ph === 'run' && state.prefs.guide && !caught && (state.hold || state.hintRun) && state.rc < run.D) {
    const size = state.hold ? sizeOfHold(state.hold.t) : 0.55, px = g.X(xAt(run, state.rc + flightTime(size))), r = (26 + 30 * size) * g.kt;
    const near = Math.abs(px - g.gateX) <= tolOf(size, run.level) * g.railW * 0.7;
    ctx.save(); ctx.strokeStyle = near ? '#7bff9a' : 'rgba(255,255,255,0.92)'; ctx.lineWidth = Math.max(2.5, 3 * g.kt); ctx.setLineDash([7, 6]); ctx.shadowColor = near ? '#7bff9a' : 'rgba(0,0,0,0.5)'; ctx.shadowBlur = near ? 14 : 5;
    ctx.beginPath(); ctx.ellipse(px, g.neckY + 6 * g.kt, r, r * 0.42, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
}

// the charro with whatever his rope is doing
function drawCharroScene(ctx, g, state, run, inRun, o) {
  const k = g.k * 1.32 * (o.charroScale || 1), t = state.t, ang = PHASE(state);
  const tr = state.tr, ph = state.ph;
  const trickId = o.demoTrick || (tr && !inRun ? tr.id : null);
  let arm = -1.25 + Math.sin(ang * 0.5) * 0.12, step = 0, crouch = 0, lean = 0;
  const holdNote = tr && tr.notes.find((n) => n.state === 'held');
  if (trickId === 'entrada') { step = holdNote ? 18 : 0; arm = -0.3; } else if (trickId === 'salto') { crouch = holdNote ? 1 : 0; arm = -0.3; } else if (trickId === 'mariposa') arm = -0.8;
  if (inRun && state.hold) { lean = -0.4 * sizeOfHold(state.hold.t); arm = -1.45; }
  if (inRun && state.loops.length && state.loops[state.loops.length - 1].t0 + 0.25 > state.rc && !o.demoRun) { arm = -0.35; lean = 0.5; }
  const ch = drawCharro(ctx, g.charX, g.footY, k, { arm, lean, step, crouch, t });
  const hx = ch.hx, hy = ch.hy;
  if (state.caught && run) {
    const X = g.X(state.caught.x), ny = g.neckY + 4 * g.kt;
    ropeStroke(ctx, [[hx, hy], [(hx + X) / 2, (hy + ny) / 2 + 10 * g.kt], [X, ny]], Math.max(2.5, 3.2 * g.kt));
    ropeStroke(ctx, loopPoints(X, ny, 15 * g.kt, 0.5, 0, 30), Math.max(3, 4 * g.kt), 1, true);
  }
  if (inRun) {
    // run: swinging overhead loop (grows while holding), or the loop in the air
    const air = state.loops.filter((q) => !q.done || (state.caught && q === state.loops[state.loops.length - 1]));
    const swinging = !!state.hold || (!air.length && state.coil <= 0 && state.run && state.run.throws < state.run.maxThrows);
    if (!o.demoRun) {
      for (const lp of state.loops) {
        const u = (state.rc - lp.t0) / lp.T;
        if (lp.done && !(state.caught && lp === state.loops[state.loops.length - 1])) { if (u < 1.25) drawLoopFlight(ctx, g, state, lp, clamp(u, 0, 1.2), hx, hy); continue; }
        if (!state.caught) drawLoopFlight(ctx, g, state, lp, clamp(u, 0, 1), hx, hy);
      }
    }
    if (swinging || o.demoRun) {
      const sz = state.hold ? sizeOfHold(state.hold.t) : 0.3 + 0.1 * Math.sin(ang * 0.3), r = (24 + 38 * sz) * k;
      drawSpinningLoop(ctx, hx + 6 * k, hy - 34 * k - r * 0.25, r, ang, k, 0.3, [hx, hy - 4 * k]);
    }
    return;
  }
  const cxx = hx + 6 * k;
  switch (trickId) {
    case 'flor': {
      const bloom = holdNote ? 1 : 0.4 + 0.3 * Math.sin(ang * 0.2), r = (50 + 18 * bloom) * k, cy = hy - 40 * k - r * 0.4;
      for (let j = 3; j >= 0; j--) ropeStroke(ctx, flowerPoints(cxx + 26 * k, cy, r, ang * 0.35 - j * 0.12, bloom), Math.max(3, 5.2 * k), 0.18 + (j === 0 ? 0.82 : 0));
      ropeStroke(ctx, [[hx, hy], [cxx + 14 * k, cy + r * 0.5]], Math.max(2, 3 * k));
      break;
    }
    case 'entrada': case 'salto': {
      const big = trickId === 'salto' ? 78 : 66, r = big * k, cx2 = hx + (trickId === 'salto' ? 40 : 56) * k + step * 0.8 * k, cy2 = g.footY - 74 * k - (crouch ? 6 * k : 0);
      for (let j = 3; j >= 0; j--) ropeStroke(ctx, loopPoints(cx2, cy2, r, 0.22 + 0.2 * Math.abs(Math.sin(ang * 0.4)), Math.PI / 2 + Math.sin(ang * 0.3) * 0.12, 44, ang - j * 0.12), Math.max(3, 5.2 * k), 0.18 + (j === 0 ? 0.82 : 0));
      ropeStroke(ctx, [[hx, hy], [cx2 - r * 0.15, cy2 - r * 0.9]], Math.max(2, 3 * k));
      break;
    }
    case 'mariposa': {
      const r = 52 * k, cy = hy - 46 * k;
      for (let j = 3; j >= 0; j--) ropeStroke(ctx, eightPoints(cxx + 40 * k, cy, r, -0.2, ang * 0.5 - j * 0.15), Math.max(3, 5.2 * k), 0.18 + (j === 0 ? 0.82 : 0));
      ropeStroke(ctx, [[hx, hy], [cxx + 40 * k, cy]], Math.max(2, 3 * k));
      break;
    }
    default: { // vuelta / media / title idle: the flat overhead hoop
      const r = (48 + 20 * (state.spin ?? 0.3)) * k;
      drawSpinningLoop(ctx, cxx, hy - 36 * k - r * 0.2, r, ang, k, 0.28, [hx, hy - 4 * k]);
    }
  }
  void t;
}
function drawSpinningLoop(ctx, cx, cy, r, ang, k, tilt, hand) {
  // the rope from the hand up into the loop being swung
  if (hand) ropeStroke(ctx, [[hand[0], hand[1]], [(hand[0] + cx) / 2 + 3 * k, (hand[1] + cy) / 2], [cx, cy + r * tilt * 0.9]], Math.max(2, 3 * k));
  for (let j = 3; j >= 0; j--) ropeStroke(ctx, loopPoints(cx, cy, r, tilt, -0.1 + Math.sin(ang * 0.7) * 0.05, 44, ang * 1.4 - j * 0.16), Math.max(3, 5.2 * k), 0.16 + (j === 0 ? 0.84 : 0));
}
// a thrown loop travelling hand -> post, then settling over the neck (caught) or falling away (missed)
function drawLoopFlight(ctx, g, state, lp, u, hx, hy) {
  const res = lp.res, k = g.kt, r0 = (14 + 24 * lp.size) * g.kt;
  const tx = g.X(clamp(res.x, -0.1, 1.1));
  const gx = g.gateX, gy = g.neckY;
  const f = ease(clamp(u, 0, 1)), x = hx + (gx - hx) * f, y = hy + (gy - hy) * f - Math.sin(Math.PI * f) * 70 * g.k;
  const r = r0 * (0.5 + 0.7 * Math.min(1, u * 1.6)) * (u > 1 ? 1 - Math.min(0.5, (u - 1) * 2) : 1);
  const fall = u > 1 ? (u - 1) * 120 * g.k : 0, a = u > 1 ? clamp(1 - (u - 1) / 0.25, 0, 1) : 1;
  ropeStroke(ctx, [[hx, hy], [(hx + x) / 2, (hy + y) / 2 + 12 * g.k], [x, y + fall]], Math.max(2, 2.8 * g.k), a);
  ropeStroke(ctx, loopPoints(x, y + fall, r, 0.45, u * 3, 36), Math.max(3, 4.4 * g.k), a, true);
  void tx; void k;
}

function drawFx(ctx, state, sc, R) {
  for (const p of state.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(sc.x + sc.w * p.x, sc.y + sc.h * p.y, p.sz * (0.4 + 0.6 * a), 0, TAU); ctx.fill(); ctx.restore();
  }
  if (!R) return;
  for (const p of state.pops) {
    const a = clamp(1 - Math.max(0, p.t - 0.8) / 0.6, 0, 1), up = ease(clamp(p.t / 0.5, 0, 1)) * 28;
    const size = clamp(sc.w * 0.045, 20, 34);
    ctx.save(); ctx.globalAlpha = a; ctx.font = `700 ${size}px ${DISPLAY}`;
    const w = ctx.measureText(p.text).width + 30, x = clamp(sc.x + sc.w * p.x, sc.x + w / 2 + 8, sc.x + sc.w - w / 2 - 8), y = sc.y + sc.h * p.y - up;
    plate(ctx, x - w / 2, y - size * 0.95, w, size * 1.4, size * 0.7, 'rgba(28,27,58,0.94)', p.color);
    R.text(p.text, x, y + size * 0.1, size, p.color, DISPLAY, 700); ctx.restore();
  }
}

function drawBackdropScene(ctx, state, L) {
  const sc = { x: 0, y: 0, w: L.w, h: L.h };
  // squarish portrait (tablet): a smaller charro so his head stays below the title block
  drawArena(ctx, state, sc, { demoTrick: 'flor', charroScale: L.h > L.w && L.h / L.w < 1.5 ? 0.74 : 1 });
}

// ---- heads-up display -------------------------------------------------------------------------------------------------------------
function drawHud(ctx, state, R, L, auto) {
  const P = L.play, m = state.m; if (!m) return;
  const b = P.board;
  plate(ctx, b.x, b.y, b.w, b.h, 18, 'rgba(28,27,58,0.94)', GOLD);
  const nameSz = clamp(b.h * 0.27, 15, 24), big = clamp(b.h * 0.62, 28, 52), cx = b.x + b.w / 2;
  const side = (i, x, align) => {
    ctx.fillStyle = i ? PAL.magenta : PAL.teal; ctx.beginPath(); ctx.roundRect(align === 'left' ? x : x - 8, b.y + 10, 8, b.h - 20, 4); ctx.fill();
    const tx = align === 'left' ? x + 18 : x - 18;
    R.text(i === 0 ? (auto ? 'Auto charro' : 'You') : m.names[1], tx, b.y + b.h * 0.4, nameSz, '#fff8e6', DISPLAY, 700, align);
    R.text(String(m.score[i]), tx, b.y + b.h * 0.82, big * 0.62, i ? '#ffb2d2' : '#9ff0e2', DISPLAY, 700, align);
  };
  side(0, b.x + 14, 'left'); side(1, b.x + b.w - 14, 'right');
  const p = m.plan[Math.min(m.step, m.plan.length - 1)], done = m.done || m.step >= m.plan.length;
  const pn = m.plan.slice(0, Math.min(m.step + 1, m.plan.length)).filter((q) => q.kind === p.kind).length, tot = m.plan.filter((q) => q.kind === p.kind).length;
  R.text(done ? 'Finished' : p.kind === 'trick' ? `Trick ${pn} of ${tot}` : `Run ${pn} of ${tot}`, cx, b.y + b.h * 0.4, clamp(b.h * 0.28, 15, 24), GOLD, DISPLAY, 700);
  R.text(`Part ${Math.min(m.step + 1, m.plan.length)} / ${m.plan.length}`, cx, b.y + b.h * 0.8, clamp(b.h * 0.2, 12, 17), '#cfc8ff', DISPLAY, 600);
  // the plaque: message
  const q = P.plaque;
  plate(ctx, q.x, q.y, q.w, q.h, 14, 'rgba(255,243,214,0.97)', PAL.terra);
  if (state.msg) R.fit(state.msg, q.x + q.w / 2, q.y + 2, q.w - 24, q.h - 4, q.h * 0.44, 12, INK, 600);
  // arena overlays (count-in, combo)
  drawOverlays(ctx, state, R, L);
  if (m.plan && state.ph !== 'result' || true) drawInfo(ctx, state, R, L, auto);
}

function drawOverlays(ctx, state, R, L) {
  const sc = L.play.scene, tr = state.tr;
  if (tr && state.ph === 'trick') {
    const beat = state.tc / tr.per;
    if (state.tc < tr.t0 - 0.05) {
      const nth = Math.floor(beat) + 1, f = beat - Math.floor(beat), sz = clamp(sc.h * 0.3, 60, 170) * (1.15 - 0.15 * f);
      ctx.save(); ctx.globalAlpha = 1 - f * 0.6; R.glowText(String(nth), sc.x + sc.w * 0.6, sc.y + sc.h * 0.36 + sz * 0.35, sz, '#ffe27a'); ctx.restore();
    } else if (state.tc < tr.t0 + 0.5) {
      const f = (state.tc - tr.t0) / 0.5; ctx.save(); ctx.globalAlpha = 1 - f; R.glowText('GO!', sc.x + sc.w * 0.6, sc.y + sc.h * 0.36 + 30, clamp(sc.h * 0.24, 50, 130), '#7bff9a'); ctx.restore();
    }
    if (state.mult > 1 || state.combo >= 2) {
      const sz = clamp(sc.h * 0.075, 20, 38), by = sc.y + sc.h - 14 - sz * 1.9;
      R.glowText(`x${state.mult}`, sc.x + sc.w - 16, by + sz, sz * 1.25, state.mult > 2 ? '#ffb347' : '#ffe27a', 'right');
      R.glowText(`${state.combo} in a row`, sc.x + sc.w - 16, by + sz * 1.9, sz * 0.6, '#fff3c2', 'right');
    }
  }
}

function drawInfo(ctx, state, R, L, auto) {
  const I = L.play.info, m = state.m;
  plate(ctx, I.x, I.y, I.w, I.h, 16, 'rgba(28,27,58,0.94)', GOLD);
  const tr = state.tr, run = state.run, pu = 0.5 + 0.5 * Math.sin(state.t * 5);
  if (auto && (state.ph === 'apthink' || state.ph === 'apreveal')) {
    const ap = state.ap, label = ap.paused ? 'Paused' : state.ph === 'apthink' ? 'Thinking...' : 'Its plan';
    const think = state.apTime || 1, f = state.ph === 'apthink' ? clamp(1 - state.wait / think, 0, 1) : clamp(1 - state.wait / 2, 0, 1);
    R.text(label, I.x + 22, I.y + I.h * 0.3, clamp(I.h * 0.2, 16, 26), '#ffe27a', DISPLAY, 700, 'left');
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.roundRect(I.x + 22, I.y + I.h * 0.42, I.w - 44, I.h * 0.1, 6); ctx.fill();
    ctx.fillStyle = GOLD; ctx.beginPath(); ctx.roundRect(I.x + 22, I.y + I.h * 0.42, Math.max(8, (I.w - 44) * f), I.h * 0.1, 6); ctx.fill();
    if (tr) drawLane(ctx, state, R, { x: I.x, y: I.y + I.h * 0.5, w: I.w, h: I.h * 0.5 }, true);
    return;
  }
  if (tr && (state.ph === 'trick' || state.ph === 'intro' || state.ph === 'apthink' || state.ph === 'apreveal' || state.ph === 'result')) {
    if (state.ph === 'result' && state.res && state.res.kind === 'trick') { drawTrickResult(ctx, state, R, I); return; }
    drawLane(ctx, state, R, I, false);
    return;
  }
  if (run || state.ph === 'result') {
    if (state.ph === 'result' && state.res && state.res.kind === 'run') { drawRunResult(ctx, state, R, I); return; }
    drawRunMeter(ctx, state, R, I, pu);
    return;
  }
  void m;
}

// the rhythm lane: knots slide right to left towards the gold line
function drawLane(ctx, state, R, I, mini) {
  const tr = state.tr; if (!tr) return;
  const h = I.h, hitX = I.x + I.w * 0.2, cy = I.y + h * (mini ? 0.5 : 0.52);
  const rad = clamp(h * (mini ? 0.26 : 0.22), 9, 28), pxBeat = (I.w * 0.74) / 3.6, pxSec = pxBeat / tr.per, tc = state.tc;
  ctx.save(); ctx.beginPath(); ctx.rect(I.x + 6, I.y + 4, I.w - 12, I.h - 8); ctx.clip();
  // the lane band
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(I.x + 8, cy - rad * 1.5, I.w - 16, rad * 3);
  // beat lines
  const b0 = Math.floor(tc / tr.per) - 1;
  for (let b = b0; b < b0 + 7; b++) { const x = hitX + (b * tr.per - tc) * pxSec; ctx.fillStyle = b >= COUNT_IN && (b - COUNT_IN) % 4 === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.14)'; ctx.fillRect(x - 1, cy - rad * 1.5, 2, rad * 3); }
  // the count-in numerals sit on their beats
  if (!mini) for (let b = 0; b < COUNT_IN; b++) { const x = hitX + (b * tr.per - tc) * pxSec; if (x > I.x && x < I.x + I.w) R.text(String(b + 1), x, cy + rad * 0.45, rad * 1.3, 'rgba(255,255,255,0.5)', DISPLAY, 700); }
  const nxt = nextNote(tr), hint = state.hintT > 0 || (state.scene === 'play' && state.prefs.guide && false);
  for (const n of tr.notes) {
    const x = hitX + (n.t - tc) * pxSec, xr = n.hold ? hitX + (n.rel - tc) * pxSec : x;
    if (xr < I.x - 40 || x > I.x + I.w + 40) continue;
    const dead = n.state === 'done' || n.state === 'miss', a = n.state === 'miss' ? 0.35 : dead ? 0.4 : 1;
    if (n.hold) {
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = n.state === 'held' ? '#7ff0dd' : PAL.teal; ctx.beginPath(); ctx.roundRect(x, cy - rad * 0.55, Math.max(8, xr - x), rad * 1.1, rad * 0.55); ctx.fill();
      ctx.strokeStyle = '#fff8e6'; ctx.lineWidth = 2; ctx.stroke();
      drawKnot(ctx, xr, cy, rad * 0.85, 'hold', a, 0);
      ctx.restore();
    }
    drawKnot(ctx, x, cy, rad, n.hold ? 'hold' : 'tap', a, nxt === n && (hint || mini) ? 1 : 0);
    if (nxt === n && state.hintT > 0) { ctx.save(); ctx.strokeStyle = `rgba(123,255,154,${0.6 + 0.4 * Math.sin(state.t * 10)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, cy, rad * 1.45, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
  // the gold line
  ctx.fillStyle = 'rgba(255,226,90,0.22)'; ctx.fillRect(hitX - rad * 1.2, cy - rad * 1.6, rad * 2.4, rad * 3.2);
  ctx.fillStyle = state.flash > 0 ? '#ffffff' : GOLD; ctx.fillRect(hitX - 2.5, cy - rad * 1.7, 5, rad * 3.4);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(hitX, cy, rad * 1.18, 0, TAU); ctx.stroke();
  ctx.restore();
  if (!mini) {
    const msg = state.ph === 'intro' ? 'Get ready: tap each knot as it reaches the gold ring' : state.last && state.last.t < 0.7 ? '' : nxt && nxt.hold && state.ph === 'trick' ? 'Hold and let go at the end of the bar' : 'Tap anywhere as the knot meets the gold ring';
    if (msg) R.text(msg, I.x + I.w / 2, I.y + I.h - 8, clamp(I.h * 0.12, 12, 18), 'rgba(255,248,230,0.85)', DISPLAY, 600);
    const sx = I.x + I.w - 14;
    R.text(trickInfo(tr.id).name, I.x + 18, I.y + clamp(I.h * 0.18, 18, 26), clamp(I.h * 0.13, 14, 20), '#ffe27a', DISPLAY, 700, 'left');
    R.text(`${tr.score} pts`, sx, I.y + clamp(I.h * 0.18, 18, 26), clamp(I.h * 0.13, 14, 20), '#fff8e6', DISPLAY, 700, 'right');
  }
}
function drawTrickResult(ctx, state, R, I) {
  const r = state.res, cx = I.x + I.w / 2;
  R.text(r.name, cx, I.y + I.h * 0.26, clamp(I.h * 0.17, 16, 26), '#ffe27a', DISPLAY, 700);
  for (let s = 0; s < 3; s++) drawStar(ctx, cx + (s - 1) * clamp(I.h * 0.26, 28, 52), I.y + I.h * 0.5, clamp(I.h * 0.12, 11, 22), s < r.stars);
  R.text(`${r.pts} pts   ·   ${Math.round(r.acc * 100)}% accuracy   ·   best streak ${r.combo}`, cx, I.y + I.h * 0.85, clamp(I.h * 0.12, 12, 19), '#fff8e6', DISPLAY, 600);
}
function drawRunResult(ctx, state, R, I) {
  const r = state.res, cx = I.x + I.w / 2;
  R.text(r.pts ? (r.grade === 'clean' ? 'Clean catch' : r.grade === 'good' ? 'Good catch' : 'Brushed it') : 'It got away', cx, I.y + I.h * 0.38, clamp(I.h * 0.2, 18, 32), r.pts ? '#7bff9a' : '#ffb59a', DISPLAY, 700);
  R.text(`${r.pts} pts`, cx, I.y + I.h * 0.72, clamp(I.h * 0.18, 16, 28), '#fff8e6', DISPLAY, 700);
}
function drawStar(ctx, x, y, r, on) {
  ctx.save(); ctx.fillStyle = on ? GOLD : 'rgba(255,255,255,0.18)'; ctx.strokeStyle = on ? '#fff3c2' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
// the loop meter for runs: how wide the loop is, how long it will fly, and how many throws are left
function drawRunMeter(ctx, state, R, I, pu) {
  const run = state.run; if (!run) return;
  const holding = !!state.hold, size = holding ? sizeOfHold(state.hold.t) : 0;
  const bx = I.x + 22, bw = I.w - 44, by = I.y + I.h * 0.45, bh = clamp(I.h * 0.2, 14, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(bx, by - bh / 2, bw, bh, bh / 2); ctx.fill();
  // tick marks for tight / wide, and the flight time for the current size
  const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#35c2a8'); g.addColorStop(0.7, '#f4b324'); g.addColorStop(1, '#ff7a3c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(bx, by - bh / 2, Math.max(bh, bw * (holding ? size : 0)), bh, bh / 2); ctx.fill();
  if (holding) { ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * size - 2, by - bh * 0.85, 4, bh * 1.7); }
  R.text('Tight  (quick, worth more)', bx, by + bh * 0.5 + clamp(I.h * 0.15, 14, 20), clamp(I.h * 0.1, 11, 16), '#cfc8ff', DISPLAY, 600, 'left');
  R.text('Wide  (forgiving, slower)', bx + bw, by + bh * 0.5 + clamp(I.h * 0.15, 14, 20), clamp(I.h * 0.1, 11, 16), '#cfc8ff', DISPLAY, 600, 'right');
  const left = run.maxThrows - run.throws;
  R.text(state.caught ? 'Caught!' : holding ? `Flight ${flightTime(size).toFixed(2)} s · let go when the ring meets the post` : state.coil > 0 ? 'Coiling the rope...' : state.ph === 'intro' ? 'Get ready' : left > 0 ? 'Press and hold anywhere to swing the loop' : 'No loops left', I.x + I.w / 2, I.y + I.h * 0.22, clamp(I.h * 0.14, 13, 21), state.ph === 'run' && !holding && state.coil <= 0 ? `rgba(255,248,230,${0.7 + 0.3 * pu})` : '#fff8e6', DISPLAY, 700);
  for (let i = 0; i < run.maxThrows; i++) { ctx.save(); ctx.globalAlpha = i < left ? 1 : 0.25; ctx.strokeStyle = '#f0d49a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(I.x + I.w - 36 - i * 40, I.y + I.h * 0.9, 15, 8, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  // the target's progress along the rail
  const f = clamp(state.rc / run.D, 0, 1); const py = I.y + I.h * 0.9; ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(I.x + 22, py - 3, I.w * 0.4, 6);
  ctx.fillStyle = GOLD; ctx.fillRect(I.x + 22, py - 3, I.w * 0.4 * f, 6);
  R.text('target on the rail', I.x + 22 + I.w * 0.4 + 10, py + 5, clamp(I.h * 0.085, 10, 14), '#cfc8ff', DISPLAY, 600, 'left');
}

function drawPausedBanner(ctx, R, L) {
  scrim(ctx, L, 0.3);
  const u = Math.min(1, (L.U.w - 16) / 420, (L.U.h - 16) / 170), bw = 420 * u, bh = 170 * u, x = L.U.x0 + (L.U.w - bw) / 2, y = L.U.y0 + (L.U.h - bh) / 2;
  plate(ctx, x, y, bw, bh, 28 * u, 'rgba(28,27,58,0.96)', GOLD);
  R.text('Paused', x + bw / 2, y + 92 * u, 72 * u, '#ffe27a', BIG, 400);
  R.text('Everything is frozen. Tap Resume.', x + bw / 2, y + 140 * u, 24 * u, '#fff8e6', DISPLAY, 600);
}

// ---- panels and stacks ------------------------------------------------------------------------------------------------------------------
function fitTitle(ctx, R, str, x, y, size, maxW) {
  let s = size; ctx.font = `400 ${s}px ${BIG}`;
  while (s > 24 && ctx.measureText(str).width > maxW) { s -= 2; ctx.font = `400 ${s}px ${BIG}`; }
  R.text(str, x, y, s, ACC, BIG, 400);
}
function drawPanelScene(ctx, state, R, z, L) {
  const sc = state.scene, P = L.panel;
  drawPanel(ctx, P.x, P.y, P.w, P.h);
  if (sc === 'how' || sc === 'about' || sc === 'rules') { drawReader(ctx, state, R, z, L); return; }
  const lay = screenLayout(state, L);
  fitTitle(ctx, R, lay.st.title, P.x + P.w / 2, P.titleY, P.titleSize * 0.82, P.titleMaxW);
  drawStackBody(ctx, state, R, lay, z);
}
function drawStack(ctx, state, R, z, L) {
  const lay = screenLayout(state, L), c = lay.frame.card, u = lay.frame.u;
  if (c) { drawPanel(ctx, c.x, c.y, c.w, c.h); if (lay.st.card?.title) R.text(lay.st.card.title, c.x + c.w / 2, c.y + 96 * u, 50 * u, ACC, BIG, 400); }
  drawStackBody(ctx, state, R, lay, z);
}
function drawStackBody(ctx, state, R, lay) {
  const reg = lay.region;
  ctx.save(); ctx.beginPath(); ctx.rect(reg.x - 14, reg.y - 4, reg.w + 28, reg.h + 4); ctx.clip();
  for (const n of lay.nodes) {
    if (n.y + n.h < reg.y - 4 || n.y > reg.y + reg.h + 4) continue;
    if (n.k === 'text') {
      const x = n.align === 'left' ? n.x : n.x + n.w / 2;
      const f = n.font === 'display' ? BIG : DISPLAY;
      n.lines.forEach((ln, i) => R.text(ln, x, n.y + i * n.lh + n.size * 0.95, n.size, n.color, f, n.font === 'display' ? 400 : (n.weight ?? 600), n.align === 'left' ? 'left' : 'center'));
    } else if (n.k === 'btn') R.button(n);
    else if (n.k === 'art') { ctx.save(); ctx.translate(n.x, n.y); ctx.scale(lay.u, lay.u); drawStackArt(ctx, state, R, { ...n, x: 0, y: 0, w: n.w / lay.u, h: n.h / lay.u }); ctx.restore(); }
  }
  ctx.restore();
  if (lay.maxScroll > 0) {
    const th = Math.max(40, reg.h * reg.h / lay.total), ty = reg.y + (reg.h - th) * (lay.scroll / lay.maxScroll);
    ctx.fillStyle = 'rgba(60,30,20,0.25)'; ctx.beginPath(); ctx.roundRect(reg.x + reg.w + 6, reg.y, 6, reg.h, 3); ctx.fill();
    ctx.fillStyle = 'rgba(214,64,43,0.95)'; ctx.beginPath(); ctx.roundRect(reg.x + reg.w + 6, ty, 6, th, 3); ctx.fill();
    if (lay.scroll < lay.maxScroll - 4) R.text('drag to scroll', reg.x + reg.w / 2, reg.y + reg.h + 21 * lay.u, 18 * Math.min(1, lay.u), 'rgba(60,40,30,0.7)', DISPLAY, 600); // in its own strip below the list
  }
  for (const f of lay.footer) R.button(f);
}
function drawStackArt(ctx, state, R, n) {
  const m = state.m;
  if (n.name === 'score' && m) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    [0, 1].forEach((i) => {
      const x = cx + (i ? 1 : -1) * 130;
      ctx.fillStyle = i ? PAL.magenta : PAL.teal; ctx.beginPath(); ctx.arc(x, cy - 28, 26, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
      R.text(String(m.score[i]), x, cy + 66, 72, INK, DISPLAY, 700);
      R.text(m.names[i], x, cy + 98, 24, '#6a4a38', DISPLAY, 700);
    });
    R.text(':', cx, cy + 56, 70, ACC, DISPLAY, 700);
  } else if (n.name === 'loop') {
    ropeStroke(ctx, loopPoints(n.x + n.w / 2, n.y + n.h / 2, 60, 0.4, 0, 44), 8);
  }
}

// ---- reader pages -------------------------------------------------------------------------------------------------------------------------
function drawReader(ctx, state, R, z, L) {
  const sc = state.scene, RD = L.reader, P = RD.P, body = RD.body, F = readerFlow(sc, z, L), max = readerMax(state, L);
  if (state.jump != null) { const it = F.secs[Math.min(state.jump, F.secs.length - 1)]; state.scroll = Math.min(max, it ? it.y : 0); state.jump = null; }
  const scroll = clamp(state.scroll || 0, 0, max);
  fitTitle(ctx, R, sc === 'how' ? 'How to Play' : sc === 'about' ? 'About' : 'Rules', P.x + P.w / 2, P.titleY, Math.round(P.titleSize * 0.8 * Math.min(1.25, z)), P.titleMaxW);
  ctx.save(); ctx.beginPath(); ctx.rect(body.x - 14, body.y, body.w + 28, body.h); ctx.clip();
  for (const s of F.secs) {
    const top = body.y + s.y - scroll;
    if (top > body.y + body.h + 10 || top + s.hh < body.y - 10) continue;
    let y = top;
    R.text(s.h, body.x, y + s.hs * 1.05, s.hs, ACC, DISPLAY, 700, 'left'); y += Math.round(s.hs * 1.5);
    if (s.art) { drawRulesArt(ctx, R, s.art, body.x + body.w / 2, y + ART_H / 2 - 4, state.t, body.w); y += ART_H + Math.round(s.size * 0.3); }
    s.lines.forEach((ln) => { y += ln.gap; R.text(ln.str, body.x, y + s.size * 0.95, s.size, INK, DISPLAY, 500, 'left'); y += s.lh; });
  }
  ctx.restore();
  if (max > 0) { const th = Math.max(36, body.h * body.h / F.total), ty = body.y + (body.h - th) * (scroll / max); ctx.fillStyle = 'rgba(179,54,31,0.5)'; ctx.fillRect(body.x + body.w + 6, ty, 5, th); }
  R.text(max > 0 ? (scroll >= max - 2 ? 'End' : 'Scroll: drag, wheel or arrow keys') : '', P.x + P.w / 2, RD.captionY, 22, ACC, DISPLAY, 600);
  R.text(`Text ${Math.round(z * 100)}%`, RD.textX, RD.textY, RD.one ? 24 : 28, INK, DISPLAY, 700);
  for (const b of screenButtons(state, L)) R.button(b);
}

const cap = (ctx, str, x, y, size = 20, col = ACC) => { ctx.textAlign = 'center'; ctx.font = `600 ${size}px ${DISPLAY}`; ctx.fillStyle = col; ctx.fillText(str, x, y); };
// diagrams drawn with the game's own pieces
function drawRulesArt(ctx, R, kind, cx, cy, t, bw = 600) {
  const W = Math.min(bw - 20, 560);
  if (kind === 'event') {
    const items = [['Trick', PAL.teal], ['Trick', PAL.teal], ['Run', PAL.terra], ['Trick', PAL.teal], ['Run', PAL.terra]], n = items.length, gap = 8, bwid = (W - gap * (n - 1)) / n;
    items.forEach(([l, c], i) => { const x = cx - W / 2 + i * (bwid + gap); ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, cy - 40, bwid, 56, 12); ctx.fill(); cap(ctx, l, x + bwid / 2, cy - 6, 20, '#fff8e6'); });
    cap(ctx, 'rope tricks to a beat, runs at the target', cx, cy + 46, 19);
    cap(ctx, 'you  versus  the other charro: higher total wins', cx, cy + 74, 18, INK);
  } else if (kind === 'track') {
    const x0 = cx - W / 2 + 10, w = W - 20, hit = x0 + w * 0.22, y = cy - 6;
    ctx.fillStyle = '#2d2a5a'; ctx.beginPath(); ctx.roundRect(x0, y - 34, w, 68, 14); ctx.fill();
    const f = (t * 0.5) % 1;
    [0.5, 0.65, 0.8].forEach((p) => drawKnot(ctx, hit + (w * 0.7) * (((p - f * 0.35) % 1 + 1) % 1), y, 16, 'tap', 1, 0));
    ctx.fillStyle = PAL.teal; ctx.beginPath(); ctx.roundRect(x0 + w * 0.55, y - 9, w * 0.2, 18, 9); ctx.fill(); drawKnot(ctx, x0 + w * 0.55, y, 16, 'hold', 1, 0);
    ctx.fillStyle = GOLD; ctx.fillRect(hit - 2, y - 40, 4, 80); ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hit, y, 22, 0, TAU); ctx.stroke();
    cap(ctx, 'tap when the knot meets the ring', cx, y + 62, 18); cap(ctx, 'bar: hold, then let go at its end', cx, y + 86, 17, INK);
  } else if (kind === 'run') {
    const x0 = cx - W / 2 + 20, w = W - 40, y = cy + 40;
    ctx.fillStyle = '#4a4a56'; ctx.fillRect(x0 - 10, y, w + 20, 5); ctx.fillStyle = PAL.sand; ctx.fillRect(x0 - 10, y + 5, w + 20, 14);
    const gx = x0 + w * 0.5; for (let j = 0; j < 6; j++) { ctx.fillStyle = j % 2 ? PAL.cream : PAL.red; ctx.fillRect(gx - 5, y - 84 + j * 14, 10, 14); }
    ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(gx, y - 90, 14, 7, 0, 0, TAU); ctx.stroke();
    const tx = x0 + w * (0.12 + 0.2 * ((t * 0.3) % 1)); drawTarget(ctx, tx, y, 0.42, 1, { roll: t * 4, t });
    ctx.strokeStyle = '#fff'; ctx.setLineDash([6, 5]); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(tx + w * 0.22, y - 52, 24, 10, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ropeStroke(ctx, loopPoints(x0 + 10, y - 60, 22, 0.4, 0, 30), 4, 1, true);
    cap(ctx, 'throw so the loop lands at the post', cx, cy - 78, 18); cap(ctx, 'dashed ring: where the target will be', cx, cy + 92, 17, INK);
  } else if (kind === 'zones') {
    const x0 = cx - W / 2 + 10, w = W - 20, y = cy - 20, h = 66, mid = x0 + w / 2;
    const seg = [[0.5, '#fff0b0', 'clean', '100'], [0.7, '#bfe9a0', 'good', '70'], [1, '#e9c7a0', 'brush', '40']];
    seg.slice().reverse().forEach(([f, c]) => { ctx.fillStyle = c; ctx.fillRect(mid - (w / 2) * f * 0.9, y, w * f * 0.9, h); });
    seg.forEach(([f, c, l, p]) => { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(mid - (w / 2) * f * 0.9, y, w * f * 0.9, h); void c; cap(ctx, `${l} ${p}`, mid + (w / 2) * f * 0.9 * 0.72, y + h / 2 + 6, 15, INK); });
    ctx.fillStyle = PAL.red; ctx.fillRect(mid - 3, y - 12, 6, h + 12);
    cap(ctx, 'how close the target is to the post', cx, y + h + 28, 18);
  } else if (kind === 'tricks') {
    const ids = Object.keys(TRICKS), cols = 3, cw = W / cols, rh = ART_H / 2;
    ids.forEach((id, i) => {
      const x = cx - W / 2 + (i % cols) * cw + cw / 2, y = cy - ART_H / 2 + 8 + Math.floor(i / cols) * rh + rh * 0.38, r = Math.min(cw * 0.28, 36);
      if (id === 'flor') ropeStroke(ctx, flowerPoints(x, y, r, t * 0.6, 1), 3.5);
      else if (id === 'mariposa') ropeStroke(ctx, eightPoints(x, y, r, 0, t), 3.5);
      else if (id === 'entrada' || id === 'salto') ropeStroke(ctx, loopPoints(x, y, r, 0.3, Math.PI / 2, 40, t * 2), 3.5);
      else ropeStroke(ctx, loopPoints(x, y, r, 0.3, 0, 40, t * 2), 3.5);
      cap(ctx, TRICKS[id].name, x, y + r * 0.9 + 22, 16, INK);
    });
  }
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------------
function drawTitle(ctx, state, R, L) {
  const T = L.title, pr = T.plate;
  const sc = L.land ? { x: L.U.x0, y: 0, w: pr.x - L.U.x0 - 10, h: L.h } : { x: 0, y: 0, w: L.w, h: clamp(pr.y + 6, 300, L.h) };
  // a demo run drives a target across the rail behind the charro
  const demo = { dir: 1, D: 7, k: 0.3, n: 1, level: 'charro' }, dt = state.t % 9;
  drawArena(ctx, { ...state, shake: 0, tr: null, run: null, loops: [], hold: null, caught: null, parts: [], pops: [], spin: 0.5, scene: 'title' }, sc, { R, demoRun: demo, demoT: Math.min(dt, 7), charroScale: !L.land && sc.h < sc.w * 0.95 ? 0.56 : 1 });
  void dt;
  // title block
  const b = T.tblk, cx = b.x + b.w / 2;
  ctx.save(); const gl = ctx.createLinearGradient(0, b.y, 0, b.y + b.h); gl.addColorStop(0, 'rgba(20,10,40,0.62)'); gl.addColorStop(1, 'rgba(20,10,40,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, L.land ? b.x + b.w + 20 : L.w, b.y + b.h); ctx.restore();
  const size = clamp(Math.min(b.w * 0.14, b.h * 0.3), 36, 104);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
  const emboss = (str, y, sz, top, bot, side) => {
    const dep = Math.max(3, sz * 0.09);
    for (let i = dep; i >= 1; i -= 1) R.text(str, cx, y + i, sz, side, BIG, 400);
    const gt = ctx.createLinearGradient(0, y - sz * 0.8, 0, y + sz * 0.05); gt.addColorStop(0, top); gt.addColorStop(1, bot);
    R.text(str, cx, y, sz, gt, BIG, 400);
  };
  emboss('CHARRO', b.y + size * 0.95, size, '#fff3b0', '#f2a516', '#8a3a0c');
  emboss('LASSO ROPING', b.y + size * 1.78, size * 0.62, '#ffffff', '#f3dcb4', '#6a3a22'); ctx.restore();
  ctx.save(); ctx.fillStyle = PAL.magenta; const tw = Math.min(b.w - 20, size * 6.2); ctx.beginPath(); ctx.roundRect(cx - tw / 2, b.y + size * 2.05, tw, size * 0.42, 9); ctx.fill(); ctx.restore();
  R.text('THE MEXICAN ROPE ART · LAZO', cx, b.y + size * 2.05 + size * 0.3, size * 0.2, '#fff8e6', DISPLAY, 700);
  // menu plate
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6; ctx.fillStyle = 'rgba(28,27,58,0.95)'; ctx.beginPath(); ctx.roundRect(pr.x, pr.y, pr.w, pr.h, 24); ctx.fill(); ctx.restore();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(pr.x, pr.y, pr.w, pr.h, 24); ctx.stroke();
  const lay = screenLayout(state, L), reg = lay.region;
  ctx.save(); ctx.beginPath(); ctx.rect(reg.x - 14, reg.y - 4, reg.w + 28, reg.h + 4); ctx.clip();
  for (const n of lay.nodes) if (n.k === 'btn') R.button(n);
  ctx.restore();
  if (lay.maxScroll > 0) { const th = Math.max(40, reg.h * reg.h / lay.total), ty = reg.y + (reg.h - th) * (lay.scroll / lay.maxScroll); ctx.fillStyle = 'rgba(255,214,90,0.95)'; ctx.beginPath(); ctx.roundRect(reg.x + reg.w + 8, ty, 6, th, 3); ctx.fill(); }
  const s = state.stats;
  R.text(s.played ? `${s.played} events · ${s.won} won` : state.demo ? 'Free web preview' : 'Free to play', pr.x + pr.w / 2, pr.y + pr.h - 6, 18, '#cfc8ff', DISPLAY, 600);
  drawLockup(ctx, T.lock, Boolean(state.press && state.press.af && !state.press.moved));
}

// ---- end screen ----------------------------------------------------------------------------------------------------------------------------
function drawOver(ctx, state, R, z, L) {
  const o = state.over; if (!o) return;
  const T0 = state.t, W = L.w, H = L.h;
  scrim(ctx, L, 0.62);
  for (let i = 0; i < 42; i++) {
    const r = lcg(i * 7919 + 3), x = r() * W, sp = 60 + r() * 120, y = ((T0 * sp + r() * H) % (H + 40)) - 20, rotA = T0 * (1 + r() * 2) + i;
    ctx.save(); ctx.translate(x + Math.sin(T0 + i) * 20, y); ctx.rotate(rotA); ctx.fillStyle = [PAL.magenta, '#fff1d6', GOLD, PAL.teal][i % 4]; ctx.globalAlpha = 0.85; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
  }
  drawStack(ctx, state, R, z, L);
  const card = screenLayout(state, L).frame.card;
  if (card) {
    const y = L.U.y1 - 12, size = 20, free = y - 14 - (card.y + card.h);
    if (free >= 6) drawMoreLine(ctx, L.U.x0 + L.U.w / 2, y, size);
    else if (card.x - L.U.x0 >= 380) drawMoreLine(ctx, L.U.x0 + (card.x - L.U.x0) / 2, y, size);
  }
}
void LV; void LOOP; void idealRelease; void levelInfo; void newTrick; void CREAM;
