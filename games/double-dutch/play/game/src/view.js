// Drawing for every screen. render() is the single entry point; the play screen lives in playview.js, text screens in docview.js.
import { PAL, DISPLAY, drawTrickIcon, drawStars, clamp, TAU } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay, routineSheet } from './playview.js';
import { drawStreet, demoVisual } from './stage.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { credits } from './snaps.js';
import { LEVELS, TRICKS, TIMING, THINK, LIVES, beatsOf, routineOf } from './moves.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';

// The chunky poster title: deep extrusion, ink outline, a hot-metal face with a bright bevel along the top edge and a warm bounce below.
const titleCache = new Map();
function titleText(ctx, cx, y, size, label) {
  const key = `${label}|${Math.round(size)}|${DISPLAY}`;
  let e = titleCache.get(key);
  if (!e && typeof OffscreenCanvas !== 'undefined') {
    const pad = Math.ceil(size * 0.4), c = new OffscreenCanvas(8, 8), g = c.getContext('2d');
    g.font = `800 ${size}px ${DISPLAY}`; const w = Math.ceil(g.measureText(label).width) + pad * 2, h = Math.ceil(size * 1.3) + pad * 2;
    c.width = w; c.height = h; const mx = w / 2, my = h / 2;
    g.font = `800 ${size}px ${DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    for (let i = 10; i >= 1; i--) { g.fillStyle = i > 5 ? '#4a0f3c' : '#7a1d5e'; g.fillText(label, mx + i * size * 0.011, my + i * size * 0.022); }
    g.lineWidth = size * 0.17; g.strokeStyle = '#150a2c'; g.strokeText(label, mx, my);
    const f = g.createLinearGradient(0, my - size * 0.5, 0, my + size * 0.5);
    f.addColorStop(0, '#fffbd0'); f.addColorStop(0.28, '#ffe27a'); f.addColorStop(0.5, '#ffb52b'); f.addColorStop(0.78, '#ff7a1a'); f.addColorStop(1, '#ff9a3c');
    g.fillStyle = f; g.fillText(label, mx, my);
    // bevel: a bright edge on the top-left, a dark edge on the bottom-right, clipped to the letter faces
    g.globalCompositeOperation = 'source-atop';
    g.lineWidth = size * 0.045; g.strokeStyle = 'rgba(255,255,240,0.85)'; g.strokeText(label, mx - size * 0.012, my - size * 0.02);
    g.strokeStyle = 'rgba(150,40,0,0.55)'; g.strokeText(label, mx + size * 0.014, my + size * 0.024);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = f; g.save(); g.beginPath(); g.rect(0, 0, w, h); g.restore();
    e = { c, w, h }; titleCache.set(key, e); if (titleCache.size > 12) titleCache.delete(titleCache.keys().next().value);
  }
  if (e) { ctx.drawImage(e.c, cx - e.w / 2, y - e.h / 2); return; }
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${size}px ${DISPLAY}`; ctx.fillStyle = '#ffc83d'; ctx.fillText(label, cx, y); ctx.restore();
}

// The dimmed street behind the menus.
function backdrop(ctx, st, L, dim = 0.55) {
  if (st.has3d) { ctx.fillStyle = `rgba(14,6,32,${dim})`; ctx.fillRect(0, 0, L.w, L.h); return; }   // the 3D street is already on the canvas behind
  const vis = demoVisual(st.t);
  drawStreet(ctx, L.w, L.h, { x: 0, y: L.h * 0.26, w: L.w, h: L.h * 0.74 }, vis, st.t, { vignette: 0.1 });
  ctx.fillStyle = `rgba(14,6,32,${dim})`; ctx.fillRect(0, 0, L.w, L.h);
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const sc = st.scene;
  ctx.clearRect(0, 0, L.w, L.h);      // transparent: the 3D street (when present) shows through
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, pauseItems); drawToast(ctx, st, L); return; }
  meta.previewBadge = null;
  if (sc === 'title') renderTitle(ctx, st, L);
  else {
    backdrop(ctx, st, L, sc === 'prep' ? 0.3 : sc === 'about' || sc === 'howto' || sc === 'rules' || sc === 'settings' ? 0.55 : 0.6);
    if (sc === 'levels') renderLevels(ctx, st, L);
    else if (sc === 'prep') renderPrep(ctx, st, L);
    else if (sc === 'result') renderResult(ctx, st, L);
    else if (sc === 'about') renderDoc(ctx, st, L, { key: credits.blocks ? 'about+' : 'about', title: 'About', blocks: credits.blocks ? ABOUT.concat(credits.blocks) : ABOUT });
    else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
    else if (sc === 'rules') { const p = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `${st.rulesPage + 1}/${RULES.length}  ${p.title}`, blocks: p.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
    else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
    else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  }
  drawToast(ctx, st, L);
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 30, { align: 'center', fill: 'rgba(22,11,44,0.95)', stroke: 'rgba(255,244,228,0.45)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('timing', 'Timing', 'cycle', () => TIMING[p.timingIdx].name, 'How strict the beat windows are'),
    row('lat', 'Latency (ms)', 'stepper', () => p.lat, 'Raise it if you hear the beat late'),
    row('think', 'Think time (s)', 'stepper', () => p.thinkSec, `Watch and Learn: ${THINK.min} to ${THINK.max} seconds`),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Fewer sparks and no shaking'),
    ...(st.demo ? [] : [row('restore', 'Purchases', 'button', () => '', st.owned ? 'Full game unlocked' : st.restoreBusy ? 'Checking with the store...' : 'Already bought it? Get it back', { btn: st.owned ? 'Unlocked' : st.restoreBusy ? 'Working...' : 'Restore purchase' })]),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// ---- title -------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L) {
  const T = L.title, S = L.S, wide = L.mode === 'wide';
  if (!st.has3d) { const vis = demoVisual(st.t);
    drawStreet(ctx, L.w, L.h, wide ? { x: T.hero.x, y: T.hero.y + T.hero.h * 0.3, w: T.hero.w, h: T.hero.h * 0.7 } : { x: 0, y: T.hero.y + T.hero.h * 0.3, w: L.w, h: T.hero.h * 0.7 }, vis, st.t, { vignette: 0.25 }); }
  if (!wide) { const g = ctx.createLinearGradient(0, T.col.y - 120, 0, L.h); g.addColorStop(0, 'rgba(15,7,32,0)'); g.addColorStop(0.35, 'rgba(15,7,32,0.85)'); g.addColorStop(1, 'rgba(15,7,32,0.97)'); ctx.fillStyle = g; ctx.fillRect(0, T.col.y - 120, L.w, L.h - T.col.y + 120); }
  else { ctx.fillStyle = 'rgba(15,7,32,0.92)'; ctx.fillRect(T.col.x - 28, 0, L.w - T.col.x + 28, L.h); }
  const tcx = wide ? T.hero.x + T.hero.w / 2 : S.x + S.w / 2, size = Math.min(T.size * 1.15, T.hero.h * (wide ? 0.26 : 0.21));
  titleText(ctx, tcx, T.titleY, size, 'DOUBLE');
  titleText(ctx, tcx, T.titleY + size * 0.86, size, 'DUTCH');
  chip(ctx, tcx, T.titleY + size * 1.62, 'street jump rope', Math.max(24, size * 0.18), { align: 'center', fill: 'rgba(255,63,164,0.96)', color: '#fff' });
  button(ctx, T.play, 'Play', { kind: 'primary', size: 54, icon: 'play' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'ghost', size: 36, icon: 'eye' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 32 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 32 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 32 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 32 });
  const lw = Math.min(300, (wide ? T.col.w : S.w) * 0.6), lh = lw * 327 / 1200;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lh + 8, w: lw, h: lh })) drawCredit(ctx, T.credit.x, T.credit.y, 12);
}

// ---- levels -------------------------------------------------------------------------------------------------------------------------
function levelFacts(l) {
  const b = beatsOf(l), used = new Set(b.filter((c) => c !== '.'));
  return { tricks: TRICKS.filter((t) => used.has(t.key)), pepper: used.has('p'), beats: b.length };
}
function renderLevels(ctx, st, L) {
  const G = L.levels, S = L.S;
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 32 });
  txt(ctx, 'CHOOSE A BLOCK', S.x + S.w / 2, G.titleY, 50, PAL.gold, { align: 'center', weight: 800, stroke: 8, maxW: S.w - 2 * (G.back.w + 30) });
  LEVELS.forEach((lv, i) => {
    const r = G.cards[i], best = st.best[lv.id] ?? {}, f = levelFacts(lv);
    const locked = !(i === 0 || st.dev || st.best[LEVELS[i - 1].id]) || (st.demo && i >= 2);
    panel(ctx, r, { wood: true, fill: 'rgba(26,15,51,0.9)' }); edgeStroke(ctx, r, 24, 0.22);
    const pad = 16;
    txt(ctx, `${i + 1}`, r.x + pad, r.y + r.h * 0.2, Math.min(44, r.h * 0.2), PAL.orange, { weight: 800 });
    txt(ctx, lv.name.toUpperCase(), r.x + pad + 38, r.y + r.h * 0.2, Math.min(40, r.h * 0.17), PAL.text, { weight: 800, maxW: r.w - pad * 2 - 42 });
    chip(ctx, r.x + pad, r.y + r.h * 0.42, `${lv.bpm} bpm`, 26, {});
    if (f.pepper) chip(ctx, r.x + pad + 140, r.y + r.h * 0.42, 'PEPPER', 26, { fill: 'rgba(255,63,164,0.9)', color: '#fff' });
    const ts = Math.min(40, r.h * 0.17, (r.w - pad * 2) / 4.4);
    f.tricks.forEach((t, j) => drawTrickIcon(ctx, t.id, r.x + pad + ts / 2 + j * (ts + 8), r.y + r.h * 0.63, ts));
    drawStars(ctx, r.x + pad + 48, r.y + r.h * 0.86, Math.min(30, r.h * 0.12), best.stars || 0);
    if (best.score) txt(ctx, `Best ${best.score}`, r.x + r.w - pad, r.y + r.h * 0.86, 24, PAL.gold, { align: 'right', weight: 800, maxW: r.w * 0.5 });
    if (locked) {
      ctx.fillStyle = 'rgba(8,3,20,0.66)'; rrect(ctx, r, 24); ctx.fill();
      txt(ctx, st.demo && i >= 2 ? 'In the full game' : 'LOCKED', r.x + r.w / 2, r.y + r.h / 2, 32, PAL.text, { align: 'center', weight: 800, maxW: r.w - 20 });
    }
  });
}

// ---- prep ---------------------------------------------------------------------------------------------------------------------------
function renderPrep(ctx, st, L) {
  const D = L.prep, S = L.S, lv = LEVELS[st.sel], best = st.best[lv.id] ?? {}, f = levelFacts(lv), rt = routineOf(lv);
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 32 });
  txt(ctx, `${st.sel + 1}. ${lv.name.toUpperCase()}`, S.x + S.w / 2, S.y + 12 + D.back.h / 2, 54, PAL.gold, { align: 'center', weight: 800, stroke: 8, maxW: S.w - 2 * (D.back.w + 30) });
  const pad = 24, rows = Math.ceil(rt.beats / 8);
  const cellMax = Math.min((D.info.w - pad * 2 - 30) / 8, 80);
  const need = 24 + 100 + 26 + 40 + rows * cellMax + 24;
  const I = { x: D.info.x, y: D.info.y, w: D.info.w, h: Math.min(D.info.h, need) };
  panel(ctx, I, { wood: true, fill: 'rgba(26,15,51,0.9)' }); edgeStroke(ctx, I, 24, 0.3);
  ctx.save(); rrect(ctx, I, 24); ctx.clip();
  ctx.font = `600 28px "Barlow", system-ui, sans-serif`;
  const lines = wrap(ctx, lv.blurb, I.w - pad * 2);
  lines.slice(0, 3).forEach((ln, i) => txt(ctx, ln, I.x + pad, I.y + 38 + i * 36, 28, PAL.text, { weight: 600, font: '"Barlow", system-ui, sans-serif', maxW: I.w - pad * 2 }));
  let y = I.y + 38 + Math.min(3, lines.length) * 36 + 22;
  chip(ctx, I.x + pad, y, `${lv.bpm} bpm`, 28, {}); chip(ctx, I.x + pad + 150, y, `${f.beats} beats`, 28, {});
  if (f.pepper) chip(ctx, I.x + pad + 320, y, 'PEPPER', 28, { fill: 'rgba(255,63,164,0.9)', color: '#fff' });
  y += 46;
  if (best.score) { txt(ctx, `Best ${best.score}`, I.x + pad, y, 30, PAL.gold, { weight: 800 }); drawStars(ctx, I.x + I.w - pad - 60, y, 34, best.stars || 0); }
  else txt(ctx, 'No score yet', I.x + pad, y, 26, PAL.dim, { weight: 700 });
  y += 36;
  txt(ctx, 'THE ROUTINE', I.x + pad, y, 24, PAL.orange, { weight: 800 }); y += 18;
  const avail = I.y + I.h - y - 12;
  if (avail > 40) routineSheet(ctx, rt, I.x + pad + 14, y, I.w - pad * 2 - 14, avail);
  ctx.restore();
  button(ctx, D.play, 'Play', { kind: 'primary', size: 44, icon: 'play', sub: `${LIVES} tangles and the round ends` });
  button(ctx, D.practice, 'Practice', { kind: 'quiet', size: 38, sub: 'Slower beat, tangles are forgiven' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 36, icon: 'eye', sub: 'Read the routine, then watch it jumped' });
}

// ---- result ---------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const r = st.result, Rr = L.result, p = Rr.panel, lv = LEVELS[r.li];
  const split = L.mode === 'wide' || p.h < 1000;
  panel(ctx, p, { wood: true, fill: 'rgba(26,15,51,0.9)' }); edgeStroke(ctx, p, 28, 0.6);
  txt(ctx, r.failed ? 'THE ROPES TANGLED' : r.mode === 'play' ? 'ROUTINE COMPLETE' : r.mode === 'practice' ? 'PRACTICE DONE' : 'WATCHED', p.x + p.w / 2, p.y + 44, 28, PAL.dim, { align: 'center', weight: 800, maxW: p.w - 40 });
  txt(ctx, lv.name.toUpperCase(), p.x + p.w / 2, p.y + 100, 64, PAL.gold, { align: 'center', weight: 800, stroke: 8, maxW: p.w - 60 });
  const lx = split ? p.x + p.w * 0.23 : p.x + p.w / 2, rx0 = split ? p.x + p.w * 0.44 : p.x + 32, rw = split ? p.w * 0.53 - 28 : p.w - 64;
  const k = split ? 1 : clamp(p.h / 1000, 0.8, 1);
  let y = p.y + (split ? 200 : 175 * k + 10);
  if (r.mode === 'play') drawStars(ctx, lx, y, split ? 56 : 70 * k + 4, r.stars);
  y += split ? 140 : 140 * k;
  txt(ctx, r.failed ? 'TRY AGAIN' : r.grade, lx, y, split ? (r.failed ? 56 : 140) : (r.failed ? 70 : 160) * k, r.grade === 'S' ? PAL.gold : PAL.text, { align: 'center', weight: 800, stroke: 10, maxW: split ? p.w * 0.36 : p.w - 80 });
  if (r.newBest) chip(ctx, lx, y + (split ? 92 : 100 * k), 'NEW BEST', 26, { align: 'center', fill: PAL.hot, color: '#fff' });
  let ry = split ? p.y + 160 : y + (r.newBest ? 175 : 140) * k;
  const tile = (x, yy, w, label, val) => { ctx.fillStyle = 'rgba(255,255,255,0.09)'; rrect(ctx, { x, y: yy, w, h: 108 }, 16); ctx.fill(); txt(ctx, label, x + w / 2, yy + 28, 20, PAL.orange, { align: 'center', weight: 800, maxW: w - 8 }); txt(ctx, val, x + w / 2, yy + 74, 42, PAL.text, { align: 'center', weight: 800, maxW: w - 12 }); };
  const g = 10, tw = (rw - g * 2) / 3;
  tile(rx0, ry, tw, 'SCORE', String(r.score)); tile(rx0 + tw + g, ry, tw, 'ACCURACY', `${Math.round(r.acc * 100)}%`); tile(rx0 + (tw + g) * 2, ry, tw, r.callTotal ? 'CALLS' : 'STREAK', r.callTotal ? `${r.calls.hit}/${r.callTotal}` : String(r.maxCombo));
  ry += 126;
  const cw = (rw - g * 3) / 4;
  [['perfect', 'PERFECT'], ['good', 'GOOD'], ['ok', 'OKAY'], ['miss', 'TANGLES']].forEach(([kk, lab], i) => {
    const x = rx0 + (cw + g) * i; ctx.fillStyle = 'rgba(255,255,255,0.07)'; rrect(ctx, { x, y: ry, w: cw, h: 84 }, 14); ctx.fill();
    txt(ctx, String(r.counts[kk]), x + cw / 2, ry + 28, 36, PAL.text, { align: 'center', weight: 800, maxW: cw - 6 });
    txt(ctx, lab, x + cw / 2, ry + 62, 17, PAL.dim, { align: 'center', weight: 800, maxW: cw - 4 });
  });
  const canNext = !r.failed && r.mode === 'play' && r.li + 1 < LEVELS.length;
  button(ctx, Rr.again, r.failed ? 'Try again' : r.mode === 'play' ? 'Play again' : 'Again', { kind: 'primary', size: 36 });
  button(ctx, Rr.next, canNext ? `Next: ${LEVELS[r.li + 1].name}` : 'Blocks', { kind: 'quiet', size: 34 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 36 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, r = { x: S.x + S.w / 2 - Math.min(S.w - 40, 560) / 2, y: S.y + S.h / 2 - 220, w: Math.min(S.w - 40, 560), h: 440 };
  panel(ctx, r, { wood: true, fill: 'rgba(26,15,51,0.9)' }); edgeStroke(ctx, r, 24, 0.6);
  txt(ctx, 'THAT IS THE PREVIEW', r.x + r.w / 2, r.y + 80, 54, PAL.gold, { align: 'center', weight: 800, stroke: 8, maxW: r.w - 40 });
  ctx.font = `600 30px "Barlow", system-ui, sans-serif`;
  wrap(ctx, 'Get the full Double Dutch on iPhone and Android: all eight blocks, from the stoop to the final round.', r.w - 70).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 170 + i * 42, 30, PAL.text, { align: 'center', weight: 600, font: '"Barlow", system-ui, sans-serif' }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 40, 26, PAL.dim, { align: 'center', weight: 700 });
}
void TAU;
