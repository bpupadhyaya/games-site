// Drawing for every screen. render() is the single entry point; text screens are in docview.js.
import {
  PAL, UI, DISPLAY, TAU, drawBackdrop, drawFloor, drawObstacle, drawFigure, drawSeeker, drawPortrait, drawSilhouette, drawFeather, drawRipple, drawEarMark, drawParticles,
} from './art.js';
import { txt, button, panel, rrect, chip, wrap, icon } from './ui.js';
import { renderDoc } from './docview.js';
import { ABOUT, HOWTO, RULES, BRIEF_SEEK, BRIEF_HIDE } from './content.js';
import { VENUES, ROSTER, rosterOf, THINK_TIMES, cluesOf, candidatesOf, earMarks, feltGuests, CLUE_TEXT, heightNote, REACH_R, REACH_HALF, REACH_T, REACH_REC, CLAP_CD, TEASE_CD, FEEL_R, HIDE_TIME } from './engine.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';
import { identifyRects, menuRects } from './layout.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
const PAUSE_LABEL = { resume: 'Resume', restart: 'Restart round', quit: 'Quit to menu', again: 'Watch again', exit: 'Menu', think: 'Think time: change' };
const GAITS = ['Tiptoe', 'Walk', 'Run'];
export const shortName = (n) => n.replace('Madame ', '').replace('Monsieur ', '').replace('Chevalier ', '').replace('Little ', '').replace('Old ', '');

let titleClock = 0;
function titleLine(ctx, cx, y, size, label, maxW) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${DISPLAY}`;
  const wmax = ctx.measureText(label).width, s = wmax > maxW ? (size * maxW) / wmax : size;
  ctx.font = `700 ${s}px ${DISPLAY}`;
  // cast shadow on the wall behind
  ctx.lineJoin = 'round'; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(label, cx + s * 0.04, y + s * 0.07);
  // dark enamel outline
  ctx.lineWidth = s * 0.17; ctx.strokeStyle = '#1a1030'; ctx.strokeText(label, cx, y);
  // gilt letters: a hot top, a rich middle and a deep amber base
  const g = ctx.createLinearGradient(0, y - s * 0.5, 0, y + s * 0.5);
  g.addColorStop(0, '#fffbe8'); g.addColorStop(0.28, '#ffe08a'); g.addColorStop(0.55, '#e0a83a'); g.addColorStop(0.8, '#a8701a'); g.addColorStop(1, '#d9a640');
  ctx.shadowColor = 'rgba(255,190,100,0.55)'; ctx.shadowBlur = s * 0.28; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.shadowColor = 'transparent';
  // bevel: a fine bright edge on the upper left and a dark one on the lower right
  ctx.lineWidth = Math.max(1, s * 0.022); ctx.strokeStyle = 'rgba(255,255,240,0.55)'; ctx.strokeText(label, cx - s * 0.008, y - s * 0.012);
  // a slow candlelight glint sweeps across the letters
  const t = (titleClock % 5) / 5;
  if (t < 0.55) {
    const k = t / 0.55, x0 = cx - wmax / 2 - s, x = x0 + k * (Math.min(wmax, maxW) + s * 2);
    ctx.save(); ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.35, y - s); ctx.lineTo(x + s * 0.05, y + s); ctx.lineTo(x - s * 0.3, y + s); ctx.closePath(); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(label, cx, y); ctx.restore();
  }
  ctx.restore();
  return s;
}

// The warm dark shape the seeker feels within arm's reach.
function warmShape(ctx, g, S, a, k) {
  const r = rosterOf(g.id), s = 22 * S;
  ctx.save(); ctx.translate(g.x * S, g.y * S); ctx.rotate(g.a); ctx.globalAlpha = clamp(k, 0.35, 1) * 0.92;
  ctx.shadowColor = 'rgba(255,190,110,0.9)'; ctx.shadowBlur = s * 0.9;
  ctx.fillStyle = '#0b0818'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 1.0, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.1, 0, s * 0.5, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,214,150,0.8)'; ctx.lineWidth = Math.max(1.5, s * 0.08); ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 1.0, 0, 0, TAU); ctx.stroke();
  ctx.restore();
  void r; void a;
}

// ---- title ------------------------------------------------------------------------------------------------------------------------------
function hero(ctx, st, area) {
  const side = Math.min(area.w - 24, area.h - 12), x = area.x + (area.w - side) / 2, y = area.y + (area.h - side) / 2, S = side / 1000, t = st.t;
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, side, side, side * 0.06); ctx.clip();
  // the seeker walks a slow loop; three guests drift and clap in the dark; the room is the real 3D salon when it is available
  const a = t * 0.35, px = 500 + Math.cos(a) * 250, py = 540 + Math.sin(a * 1.3) * 160, head = Math.atan2(Math.cos(a * 1.3) * 160 * 1.3, -Math.sin(a) * 250);
  const orbit = (cx, cy, rx, ry, w, ph) => ({ x: cx + Math.cos(t * w + ph) * rx, y: cy + Math.sin(t * w * 1.2 + ph) * ry, a: Math.atan2(Math.cos(t * w * 1.2 + ph) * ry * 1.2, -Math.sin(t * w + ph) * rx) });
  const g1 = orbit(250, 330, 90, 60, 0.28, 0.5), g2 = orbit(760, 650, 80, 90, 0.22, 2.2), g3 = orbit(610, 250, 70, 50, 0.3, 4.1);
  const cast = [
    { r: ROSTER[2], role: 'guest', ...g1, clap: Math.sin(t * 1.3) > 0.7, gait: t * 6 }, { r: ROSTER[1], role: 'guest', ...g2, clap: false, gait: t * 6 },
    { r: ROSTER[8], role: 'guest', ...g3, clap: Math.sin(t * 1.1 + 2) > 0.75, gait: t * 6 },
    { r: SEEKER, role: 'seeker', x: px, y: py, a: head, arms: 0.7, gait: t * 5 },
  ];
  ctx.save(); ctx.translate(x, y);
  const r3 = room3d(ctx, S, t, 0, cast, { hero: { w: 1000, h: 1000 } });
  ctx.restore();
  if (r3 !== true) {
    drawFloor(ctx, VENUES[0], x, y, side);
    ctx.save(); ctx.translate(x, y); ctx.scale(S, S); for (const o of VENUES[0].obstacles) drawObstacle(ctx, o, t); ctx.restore();
  }
  if (r3 !== true) {
    const g = ctx.createRadialGradient(x + px * S, y + py * S, side * 0.09, x + px * S, y + py * S, side * 0.46);
    g.addColorStop(0, 'rgba(10,8,30,0)'); g.addColorStop(1, 'rgba(10,8,30,0.74)'); ctx.fillStyle = g; ctx.fillRect(x, y, side, side);
    ctx.save(); ctx.translate(x, y);
    const src = [[g1.x, g1.y, 0], [g2.x, g2.y, 1.1], [g3.x, g3.y, 2.3]];
    for (const [sx, sy, ph] of src) {
      const k = ((t * 0.6 + ph) % 3) / 1.7;
      if (k < 1) drawRipple(ctx, { x: sx, y: sy, age: k * 1.7, kind: ph > 2 ? 'giggle' : 'clap' }, S);
    }
    if (r3 === false) drawSeeker(ctx, px * S, py * S, 26 * S * 1.9 + 10, head, { gait: t * 5, out: 0.55 });
    ctx.restore();
  } else {
    // a vignette keeps the eye on the middle of the picture
    const vg = ctx.createRadialGradient(x + side / 2, y + side * 0.55, side * 0.3, x + side / 2, y + side * 0.55, side * 0.78);
    vg.addColorStop(0, 'rgba(8,6,22,0)'); vg.addColorStop(1, 'rgba(8,6,22,0.62)'); ctx.fillStyle = vg; ctx.fillRect(x, y, side, side);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(232,194,106,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, side, side, side * 0.06); ctx.stroke();
}

function renderTitle(ctx, st, L) {
  titleClock = st.t;
  const T = L.title, S = L.S, A = T.art;
  const wide = L.mode === 'wide';
  const tsize = Math.min(110, S.w / 7), titleH = wide ? 0 : Math.max(clamp(S.h * 0.15, 150, 230), (tsize * 1.25 + 26) / 0.6);
  const heroArea = { x: A.x, y: A.y + (wide ? 92 : titleH), w: A.w, h: A.h - (wide ? 172 : titleH) };
  if (wide) {
    titleLine(ctx, A.x + A.w / 2, A.y + 54, Math.min(72, A.w * 0.09), "Blind Man's Buff", A.w - 40);
    txt(ctx, 'Colin-Maillard  ·  Gallina ciega  ·  Blindekuh', A.x + A.w / 2, A.y + A.h - 22, 22, PAL.dim, { align: 'center', maxW: A.w - 30 });
  } else {
    const size = tsize;
    titleLine(ctx, S.x + S.w / 2, A.y + titleH * 0.4, size, "Blind Man's Buff", S.w * 0.88);
    txt(ctx, 'Hunt by ear. Catch, then name who it is.', S.x + S.w / 2, A.y + titleH * 0.4 + size * 0.78, clamp(S.w * 0.04, 22, 32), PAL.text, { align: 'center', weight: 600, stroke: 6, maxW: S.w - 40 });
    txt(ctx, 'Colin-Maillard  ·  Gallina ciega  ·  Blindekuh', S.x + S.w / 2, A.y + titleH * 0.4 + size * 1.25, clamp(S.w * 0.03, 18, 24), PAL.dim, { align: 'center', maxW: S.w - 40 });
  }
  hero(ctx, st, heroArea);
  button(ctx, T.play, 'Play', { kind: 'primary', size: 44, icon: 'play' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'quiet', size: 30, icon: 'ear' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26, icon: 'hint' });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26, icon: 'scroll' });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26, icon: 'info' });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26, icon: 'gear' });
  const lh = 60, lw = lh * 3.7;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lh + 4, w: lw, h: lh }, 0.92)) drawCredit(ctx, T.credit.x, T.credit.y, 13);
}

function header(ctx, G, S, text) {
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, text, S.x + S.w / 2, G.titleY, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (G.back.w + 30) });
}

function featherRow(ctx, cx, cy, n, size, gap = 1.1) {
  for (let i = 0; i < 3; i++) drawFeather(ctx, cx + (i - 1) * size * gap, cy, size, i < n, -0.5);
}

// ---- venues -----------------------------------------------------------------------------------------------------------------------------
function renderVenues(ctx, st, L) {
  const G = L.venues, S = L.S;
  header(ctx, G, S, 'Choose a room');
  const modes = [['seek', 'Seeker', 'ear'], ['hide', 'Hide and Dodge', 'hand']];
  modes.forEach(([id, label, ic], i) => button(ctx, G.modes[i], label, { kind: st.modeSel === id ? 'gold' : 'ghost', size: 30, icon: ic }));
  VENUES.forEach((v, i) => {
    const r = G.cards[i], locked = st.demo && i > 0, best = st.best[`${st.modeSel}:${v.id}`];
    panel(ctx, r, { fill: 'rgba(22,18,48,0.88)' }); edgeStroke(ctx, r, 24, 0.22);
    const pad = 14, mm = Math.min(r.w - pad * 2, r.h * 0.5), mx = r.x + (r.w - mm) / 2, my = r.y + pad;
    ctx.save(); ctx.beginPath(); ctx.roundRect(mx, my, mm, mm, 14); ctx.clip();
    const f3 = globalThis.__people3d, still = f3 && f3.roomStill && !f3.pending && !f3.off ? f3.roomStill(i, 384) : null;
    if (still) ctx.drawImage(still, mx, my, mm, mm);
    else {
      drawFloor(ctx, v, mx, my, mm);
      ctx.save(); ctx.translate(mx, my); ctx.scale(mm / 1000, mm / 1000); for (const o of v.obstacles) drawObstacle(ctx, o, st.t); ctx.restore();
    }
    if (locked) { ctx.fillStyle = 'rgba(14,10,30,0.6)'; ctx.fillRect(mx, my, mm, mm); }
    ctx.restore();
    const ty = my + mm + 26, small = r.h < 300;
    txt(ctx, v.name, r.x + r.w / 2, ty, small ? 28 : 34, locked ? PAL.dim : PAL.text, { align: 'center', font: DISPLAY, weight: 700, maxW: r.w - 24 });
    const meta = st.modeSel === 'seek' ? `${v.guests} guests · ${Math.round(v.time / 60 * 10) / 10 === Math.floor(v.time / 60) ? v.time / 60 + ' min' : mmss(v.time)}` : `${v.guests} other guests · ${HIDE_TIME} s`;
    txt(ctx, locked ? 'Full game: iPhone and Android' : meta, r.x + r.w / 2, ty + (small ? 30 : 36), small ? 20 : 22, PAL.gold, { align: 'center', weight: 700, maxW: r.w - 24 });
    if (!small) {
      ctx.font = `500 21px ${UI}`;
      wrap(ctx, v.blurb, r.w - 32).slice(0, 2).forEach((ln, k) => txt(ctx, ln, r.x + r.w / 2, ty + 74 + k * 26, 21, PAL.dim, { align: 'center', weight: 500, maxW: r.w - 24 }));
    }
    if (best && !locked) featherRow(ctx, r.x + r.w - 60, r.y + 34, best.feathers, 26);
  });
}

// ---- meet the party / brief -----------------------------------------------------------------------------------------------------------
function renderMeet(ctx, st, L, pl) {
  const M = L.meet, p = M.panel, w = pl.w;
  ctx.fillStyle = 'rgba(8,6,20,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, p, { fill: 'rgba(24,18,52,0.96)', rad: 30 }); edgeStroke(ctx, p, 30, 0.3);
  txt(ctx, w.mode === 'seek' ? 'Meet the party' : 'The game of hiding', p.x + p.w / 2, p.y + 48, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: p.w - 40 });
  ctx.font = `500 24px ${UI}`;
  const lines = wrap(ctx, w.mode === 'seek' ? BRIEF_SEEK : BRIEF_HIDE, p.w - 70);
  lines.slice(0, 2).forEach((ln, i) => txt(ctx, ln, p.x + p.w / 2, p.y + 90 + i * 30, 24, PAL.text, { align: 'center', weight: 500, maxW: p.w - 50 }));
  const n = w.guests.length, g = M.grid, cols = L.mode === 'wide' ? n : n <= 3 ? n : n === 4 ? 4 : 3, rows = Math.ceil(n / cols), gap = 12;
  const cw = (g.w - gap * (cols - 1)) / cols, chh = Math.min(g.h / rows - gap, cw * 1.25);
  w.guests.forEach((gu, i) => {
    const r = rosterOf(gu.id), c = i % cols, rw = Math.floor(i / cols), inRow = rw === rows - 1 ? n - rw * cols : cols, off = ((cols - inRow) * (cw + gap)) / 2;
    const cx0 = g.x + off + c * (cw + gap), cy0 = g.y + rw * (chh + gap) + (g.h - (rows * chh + (rows - 1) * gap)) / 2;
    ctx.fillStyle = 'rgba(251,241,220,0.07)'; rrect(ctx, { x: cx0, y: cy0, w: cw, h: chh }, 16); ctx.fill();
    const ps = Math.min(cw - 16, chh * 0.58);
    drawPortrait(ctx, r, cx0 + cw / 2, cy0 + 10 + ps / 2, ps, {});
    txt(ctx, r.name, cx0 + cw / 2, cy0 + 10 + ps + 20, clamp(cw * 0.12, 18, 26), PAL.text, { align: 'center', weight: 800, maxW: cw - 12 });
    if (chh > ps + 78) {
      const fs = clamp(cw * 0.085, 15, 20);
      txt(ctx, `${heightNote(r.height)}`, cx0 + cw / 2, cy0 + 10 + ps + 44, fs, PAL.gold, { align: 'center', weight: 700, maxW: cw - 10 });
      txt(ctx, `${r.head} · ${r.trinket}`, cx0 + cw / 2, cy0 + 10 + ps + 44 + fs * 1.3, fs, PAL.dim, { align: 'center', weight: 600, maxW: cw - 10 });
    }
  });
  button(ctx, M.start, w.mode === 'seek' ? 'Put on the blindfold' : 'Start hiding', { kind: 'primary', size: 34, icon: 'play' });
}

// ---- the playing screen ----------------------------------------------------------------------------------------------------------------
function trayChips(ctx, st, P, pl) {
  const w = pl.w, tr = P.tray, n = w.party.length, wide = P.rail !== null;
  const gap = 8;
  let cols = n, rows = 1;
  if (wide) { cols = Math.min(n, 3); rows = Math.ceil(n / cols); }
  const cw = (tr.w - gap * (cols - 1)) / cols, ch = (tr.h - gap * (rows - 1)) / rows;
  const named = ch >= 74, s = Math.min(named ? ch - 20 : ch, cw, 150);
  w.party.forEach((id, i) => {
    const c = i % cols, r = Math.floor(i / cols), x = tr.x + c * (cw + gap) + (cw - s) / 2, y = tr.y + r * (ch + gap) + (ch - s - (named ? 20 : 0)) / 2;
    const gu = w.guests.find((q) => q.id === id), out = gu.out;
    drawPortrait(ctx, rosterOf(id), x + s / 2, y + s / 2, s, { dim: out ? 0.55 : 0 });
    if (out) {
      const found = w.mode === 'seek';
      ctx.fillStyle = found ? PAL.gold : '#ff9a8a'; ctx.font = `800 ${s * 0.5}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(found ? '✓' : '×', x + s / 2, y + s / 2);
    }
    if (named) txt(ctx, shortName(rosterOf(id).name), x + s / 2, y + s + 11, 15, out ? PAL.dim : PAL.text, { align: 'center', weight: 700, maxW: cw });
  });
}

// The candlelit fog round the seeker. A small pre-baked sprite plus four flat rectangles: a fixed, cheap cost per frame on any phone
// (a full-arena radial gradient fill is the expensive way). Falls back to the gradient where no offscreen canvas exists.
const FOG_R = 363, FOG_IN = 76, FOG_A = 0.7;
let fogSprite = null;                      // main.js bakes it (it owns the DOM) and hands it over with setFogSprite()
export const setFogSprite = (c) => { fogSprite = c; };
export const FOG = { R: FOG_R, inner: FOG_IN, alpha: FOG_A, span: 1000 };
const fogSpriteGet = () => fogSprite;

function drawFog(ctx, mx, my, S, W, H) {
  const sp = fogSpriteGet();
  if (!sp) {
    const g = ctx.createRadialGradient(mx, my, FOG_IN * S, mx, my, FOG_R * S);
    g.addColorStop(0, 'rgba(8,6,26,0)'); g.addColorStop(0.35, 'rgba(8,6,26,0.32)'); g.addColorStop(1, `rgba(8,6,26,${FOG_A})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return;
  }
  // The sprite spans 2000 room units round the seeker, so it always covers the whole room: one image, no seams.
  const d = 2000 * S;
  ctx.drawImage(sp, mx - d / 2, my - d / 2, d, d);
}

const SEEKER = { id: 'seeker', skin: 1, hair: '#5a3418', outfit: '#8f2f4a', trim: '#e8c26a', head: 'none', trinket: 'none' };
// Real 3D people (view3d) composited into the room picture; main.js installs globalThis.__people3d. False = use the 2D art.
function people3d(ctx, S, t, cast) {
  const f3 = globalThis.__people3d;
  if (!f3 || !f3.draw || f3.off) return false;
  if (f3.pending) return true;           // still loading: draw nothing for the people (no flash of the other style)
  ctx.save(); ctx.scale(S, S);
  const ok = f3.draw(ctx, S, t, cast);
  ctx.restore();
  return ok;
}

// The room as a real lit 3D set with its people (platform/view3d layer); false = the 2D art is used instead.
function room3d(ctx, S, t, venueIdx, cast, o = {}) {
  const f3 = globalThis.__people3d;
  if (!f3 || !f3.draw || f3.off) return false;
  if (f3.pending) return 'pending';
  ctx.save(); ctx.scale(S, S);
  const ok = f3.draw(ctx, S, t, cast, { venue: venueIdx, ...o });
  ctx.restore();
  return ok;
}

function drawArena(ctx, st, L, pl, view) {
  const P = L.play, A = P.arena, w = pl.w, v = VENUES[w.venueIdx], S = A.w / 1000, t = st.t;
  const shake = pl.shake > 0 && !st.prefs.calm ? Math.sin(pl.shake * 70) * pl.shake * 6 : 0;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(A.x, A.y, A.w, A.h, 22); ctx.clip();
  ctx.translate(A.x + shake, A.y);
  const seekMode0 = w.mode === 'seek';
  const clapping0 = (id) => w.events.some((e) => e.who === id && (e.kind === 'clap' || e.kind === 'taunt') && e.age < 0.7);
  const cast0 = [];
  if (seekMode0) {
    const me0 = w.me, rk0 = me0.reach > 0 ? 1 - me0.reach / REACH_T : me0.rec > REACH_REC - 0.2 ? 0.9 : 0;
    cast0.push({ r: SEEKER, role: 'seeker', x: me0.x, y: me0.y, a: me0.a, reach: rk0, arms: me0.reach > 0 || me0.rec > 0.5 ? 1 : 0.5, recover: me0.rec > 0.4 && me0.reach <= 0, gait: me0.gait, sim: me0 });
  } else {
    const sk0 = w.seeker;
    for (const gu of w.guests) if (!gu.out) cast0.push({ r: rosterOf(gu.id), role: 'guest', x: gu.x, y: gu.y, a: gu.a, clap: clapping0(gu.id), gait: t * 8 + gu.seq, fb: [20, 1], tag: gu.id });
    cast0.push({ r: ROSTER[4], role: 'guest', x: w.me.x, y: w.me.y, a: w.me.a, clap: false, gait: w.me.gait, fb: [22, 0], me: true, tag: 'me' });
    cast0.push({ r: SEEKER, role: 'seeker', x: sk0.x, y: sk0.y, a: sk0.a, reach: sk0.reach > 0 ? 1 - sk0.reach / REACH_T : 0, arms: sk0.reach > 0 ? 1 : 0.55, recover: sk0.rec > 0.4, gait: t * 4, fb: [26, 2] });
  }
  const room3 = room3d(ctx, S, t, w.venueIdx, cast0, { speedScale: v.speed });
  if (room3 !== true) {
    drawFloor(ctx, v, 0, 0, A.w);
    ctx.save(); ctx.scale(S, S); for (const o of v.obstacles) drawObstacle(ctx, o, t); ctx.restore();
  }
  const seekMode = w.mode === 'seek';
  const me = w.me;
  // ---- hide mode: everything is visible
  if (!seekMode) {
    const sk = w.seeker;
    if (sk.reach > 0 || sk.rec > 0) fan(ctx, sk, S, sk.reach > 0 ? 0.35 : 0.12);
    // me: a gold ring under the figure, and how far my steps carry
    ctx.strokeStyle = 'rgba(232,194,106,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(me.x * S, me.y * S, 30 * S * 1.7 + 8, 0, TAU); ctx.stroke();
    if (me.noise > 0) { ctx.setLineDash([10, 10]); ctx.strokeStyle = me.noise > 200 ? 'rgba(240,138,122,0.7)' : 'rgba(240,217,138,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(me.x * S, me.y * S, me.noise * S, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    if (room3 === false) {
      const cast = cast0;
      for (const c of cast) {
        if (c.role === 'seeker') drawSeeker(ctx, c.x * S, c.y * S, 26 * S * 1.7 + 6, c.a, { reach: c.reach, out: sk.reach > 0 ? 1 : 0.55, gait: t * 4 });
        else drawFigure(ctx, c.r, c.x * S, c.y * S, c.fb[0] * S * 1.7 + 6, c.a, { sway: Math.sin(c.me ? me.gait : c.gait) });
      }
    }
    for (const e of w.events) drawRipple(ctx, e, S);
    if (pl.dest) { ctx.strokeStyle = 'rgba(251,241,220,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(pl.dest.x * S, pl.dest.y * S, 14, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  } else {
    // ---- seek mode: dim candlelit room, ears and warm shapes only
    drawFog(ctx, me.x * S, me.y * S, S, A.w, A.h);
    const marks = earMarks(w);
    for (const m of marks) drawEarMark(ctx, m, S, 1);
    for (const e of w.events) drawRipple(ctx, e, S);
    for (const f of feltGuests(w)) warmShape(ctx, f, S, 1, 1 - Math.hypot(f.x - me.x, f.y - me.y) / FEEL_R);
    // arms
    if (me.reach > 0 || me.rec > 0) fan(ctx, me, S, me.reach > 0 ? 0.4 : 0.1);
    if (room3 === false) {
      const rk = me.reach > 0 ? 1 - me.reach / REACH_T : me.rec > REACH_REC - 0.2 ? 0.9 : 0;
      drawSeeker(ctx, me.x * S, me.y * S, 24 * S * 1.7 + 6, me.a, { reach: rk, out: me.reach > 0 || me.rec > 0.5 ? 1 : 0.5, gait: me.gait });
    }
    if (pl.dest) { ctx.strokeStyle = 'rgba(251,241,220,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(pl.dest.x * S, pl.dest.y * S, 14, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    // the hint or the coach's plan
    const plan = pl.pre?.plan ?? (pl.hintT > 0 ? pl.hint : null);
    if (plan && plan.tx !== undefined && plan.kind !== 'wait' && plan.kind !== 'clap') {
      const pulse = 0.6 + 0.4 * Math.sin(t * 6);
      ctx.strokeStyle = `rgba(255,217,106,${0.55 + 0.4 * pulse})`; ctx.lineWidth = 4; ctx.setLineDash([12, 8]);
      ctx.beginPath(); ctx.arc(plan.tx * S, plan.ty * S, 42 * S * 2.2 + 8, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(me.x * S, me.y * S); ctx.lineTo(plan.tx * S, plan.ty * S); ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]);
    }
  }
  ctx.save(); ctx.scale(S, S); drawParticles(ctx, pl.parts); ctx.restore();
  ctx.restore();
  // the frame
  { const fg = ctx.createLinearGradient(A.x, A.y, A.x + A.w, A.y + A.h); fg.addColorStop(0, '#fff0b8'); fg.addColorStop(0.35, '#b8861f'); fg.addColorStop(0.7, '#e8c26a'); fg.addColorStop(1, '#8a5f14');
    ctx.strokeStyle = fg; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(A.x - 1, A.y - 1, A.w + 2, A.h + 2, 23); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(A.x + 3, A.y + 3, A.w - 6, A.h - 6, 19); ctx.stroke(); }
  void view;
}

// The sweep of the arms: a translucent wedge.
function fan(ctx, who, S, alpha) {
  ctx.save(); ctx.translate(who.x * S, who.y * S);
  ctx.fillStyle = `rgba(255,217,130,${alpha})`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, REACH_R * S, who.a - REACH_HALF, who.a + REACH_HALF); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function renderIdentify(ctx, st, L, pl) {
  const w = pl.w, A = L.play.arena, cands = candidatesOf(w), I = identifyRects(L, A, cands.length);
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,28,0.9)'; ctx.beginPath(); ctx.roundRect(A.x, A.y, A.w, A.h, 22); ctx.fill();
  ctx.restore();
  const h = I.head, clues = cluesOf(w.hold), small = A.h < 520;
  // the held figure and the clue lines
  const sil = Math.min(h.h * 0.98, h.w * 0.36);
  {
    const f3 = globalThis.__people3d;
    let ok = false;
    if (f3 && f3.caught && !f3.pending && !f3.off) {
      const sc = Math.hypot(ctx.getTransform().a, ctx.getTransform().b);
      ctx.save(); ctx.beginPath(); ctx.roundRect(h.x + 2, h.y + h.h / 2 - sil / 2, sil * 1.04, sil, 16); ctx.clip(); ctx.translate(h.x + 2, h.y + h.h / 2 - sil / 2);
      ok = f3.caught(ctx, sil * 1.04, sil, st.t, sc) === true;
      ctx.restore();
      if (ok) { ctx.strokeStyle = 'rgba(232,194,106,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(h.x + 2, h.y + h.h / 2 - sil / 2, sil * 1.04, sil, 16); ctx.stroke(); }
    }
    if (!ok) drawSilhouette(ctx, h.x + sil * 0.52, h.y + h.h / 2, sil, st.t);
  }
  const lx = h.x + sil * 1.1, lw = h.w - sil * 1.1, rowH = h.h / 3;
  const labels = ['Height', 'On the head', 'Worn or carried'];
  clues.forEach((c, i) => {
    const y = h.y + rowH * (i + 0.5), shown = i < w.clue;
    ctx.fillStyle = shown ? 'rgba(232,194,106,0.14)' : 'rgba(251,241,220,0.05)'; rrect(ctx, { x: lx, y: y - rowH * 0.45, w: lw, h: rowH * 0.9 }, 12); ctx.fill();
    txt(ctx, labels[i], lx + 12, y - rowH * 0.2, small ? 15 : 17, PAL.gold, { weight: 800, maxW: lw - 20 });
    if (shown) {
      ctx.font = `600 ${small ? 17 : 20}px ${UI}`;
      const lines = wrap(ctx, CLUE_TEXT[c], lw - 24);
      lines.slice(0, 2).forEach((ln, k) => txt(ctx, ln, lx + 12, y + rowH * 0.06 + k * (small ? 19 : 23), small ? 17 : 20, PAL.text, { weight: 600, maxW: lw - 24 }));
    } else txt(ctx, 'not felt yet', lx + 12, y + rowH * 0.1, small ? 17 : 19, PAL.dim, { weight: 600 });
  });
  // candidates
  const hintIds = pl.hintT > 0 && pl.hint?.ids ? pl.hint.ids : pl.pre?.plan?.ids ?? null;
  cands.forEach((id, i) => {
    const r = I.cards[i], sel = pl.selected === id, pr = Math.min(r.w, r.h - 24);
    const hot = hintIds && hintIds.includes(id);
    ctx.fillStyle = sel ? 'rgba(232,194,106,0.22)' : 'rgba(251,241,220,0.07)'; rrect(ctx, r, 14); ctx.fill();
    if (hot && !sel) { ctx.setLineDash([8, 6]); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 3; rrect(ctx, r, 14); ctx.stroke(); ctx.setLineDash([]); }
    drawPortrait(ctx, rosterOf(id), r.x + r.w / 2, r.y + 4 + (pr - 6) / 2, pr - 6, { ring: sel ? PAL.gold : null });
    txt(ctx, shortName(rosterOf(id).name), r.x + r.w / 2, r.y + r.h - 12, clamp(r.w * 0.13, 15, 22), PAL.text, { align: 'center', weight: 800, maxW: r.w - 8 });
  });
  const feelOk = w.clue < 3;
  button(ctx, I.feel, feelOk ? 'Feel more' : 'All felt', { kind: feelOk ? 'quiet' : 'disabled', size: 26, sub: feelOk ? 'costs 10 points' : undefined });
  button(ctx, I.yes, pl.selected ? `It's ${shortName(rosterOf(pl.selected).name)}!` : 'Choose a guest', { kind: pl.selected ? 'primary' : 'disabled', size: 28 });
}

function renderCoach(ctx, st, L, pl) {
  const pre = pl.pre, A = L.play.arena;
  if (!pre || !pre.plan) return;
  const lines = pre.plan.why ?? [];
  const bh = clamp(A.h * 0.2, 110, 170), up = pl.w.me.y > 520, r = { x: A.x + 10, y: up ? A.y + 40 : A.y + A.h - bh - 10, w: A.w - 20, h: bh };
  ctx.fillStyle = 'rgba(14,10,36,0.9)'; rrect(ctx, r, 16); ctx.fill(); ctx.strokeStyle = 'rgba(232,194,106,0.6)'; ctx.lineWidth = 2; rrect(ctx, r, 16); ctx.stroke();
  txt(ctx, pre.kind === 'think' ? 'The coach is listening and thinking' : 'The coach has decided', r.x + 14, r.y + 24, 20, PAL.gold, { weight: 800, maxW: r.w - 120 });
  const k = clamp(pre.t / pre.dur, 0, 1);
  ctx.fillStyle = 'rgba(251,241,220,0.15)'; rrect(ctx, { x: r.x + r.w - 104, y: r.y + 16, w: 90, h: 10 }, 5); ctx.fill();
  ctx.fillStyle = pre.kind === 'think' ? '#9cc3e6' : PAL.gold; rrect(ctx, { x: r.x + r.w - 104, y: r.y + 16, w: 90 * k, h: 10 }, 5); ctx.fill();
  ctx.font = `500 21px ${UI}`;
  let y = r.y + 54;
  for (const ln of lines) for (const l2 of wrap(ctx, ln, r.w - 28)) { if (y < r.y + r.h - 8) txt(ctx, l2, r.x + 14, y, 21, PAL.text, { weight: 500, maxW: r.w - 28 }); y += 26; }
}

function renderHint(ctx, st, L, pl) {
  if (pl.hintT <= 0 || !pl.hint || pl.pre) return;
  const A = L.play.arena, lines = pl.hint.why ?? [];
  const bh = clamp(A.h * 0.17, 90, 140), up = pl.w.me.y > 520, r = { x: A.x + 10, y: up ? A.y + 40 : A.y + A.h - bh - 10, w: A.w - 20, h: bh };
  ctx.fillStyle = 'rgba(14,10,36,0.9)'; rrect(ctx, r, 16); ctx.fill(); ctx.strokeStyle = 'rgba(232,194,106,0.6)'; ctx.lineWidth = 2; rrect(ctx, r, 16); ctx.stroke();
  txt(ctx, 'Hint', r.x + 14, r.y + 22, 20, PAL.gold, { weight: 800 });
  ctx.font = `500 20px ${UI}`;
  let y = r.y + 50;
  for (const ln of lines) for (const l2 of wrap(ctx, ln, r.w - 28)) { if (y < r.y + r.h - 6) txt(ctx, l2, r.x + 14, y, 20, PAL.text, { weight: 500, maxW: r.w - 28 }); y += 25; }
}

function renderPlay(ctx, st, L, view, meta, helpers) {
  const pl = st.pl, P = L.play, w = pl.w, A = P.arena, wide = !!P.rail;
  meta.previewBadge = { x: A.x + 10, y: A.y + 8, align: 'left' };
  drawBackdrop(ctx, L.w + 20, L.h + 20, st.t);
  // header
  button(ctx, P.pause, '', { icon: 'pause', kind: 'quiet', size: 28 });
  button(ctx, P.hint, '', { icon: 'hint', kind: pl.auto ? 'disabled' : 'quiet', size: 28 });
  const v = VENUES[w.venueIdx];
  txt(ctx, `${v.name}${pl.auto ? ' · Watch and Learn' : w.mode === 'hide' && !wide ? ' · Hide and Dodge' : ''}`, P.title.x + 4, P.title.y + P.title.h / 2, 28, PAL.text, { font: DISPLAY, weight: 700, maxW: P.title.w, stroke: 5 });
  // the bar: sand (seek) or survival (hide)
  const b = P.bar;
  // a brass-rimmed trough with a lit fill
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, { x: b.x - 3, y: b.y - 2, w: b.w + 6, h: b.h + 7 }, b.h / 2 + 3); ctx.fill();
  const tr = ctx.createLinearGradient(0, b.y, 0, b.y + b.h); tr.addColorStop(0, '#0d0a1c'); tr.addColorStop(1, '#241c3e');
  ctx.fillStyle = tr; rrect(ctx, b, b.h / 2); ctx.fill();
  const frac = w.mode === 'seek' ? (pl.auto ? 1 : clamp(w.timeLeft / w.timeTotal, 0, 1)) : clamp(w.t / w.timeTotal, 0, 1);
  const fw = Math.max(b.h, b.w * frac);
  const bg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  if (w.mode === 'seek') { bg.addColorStop(0, '#fff0b0'); bg.addColorStop(0.5, '#e8c26a'); bg.addColorStop(1, '#b8861f'); } else { bg.addColorStop(0, '#d8fff0'); bg.addColorStop(0.5, '#6fd0b0'); bg.addColorStop(1, '#2f8f78'); }
  ctx.fillStyle = bg; rrect(ctx, { x: b.x, y: b.y, w: fw, h: b.h }, b.h / 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; rrect(ctx, { x: b.x + 4, y: b.y + 2, w: Math.max(0, fw - 8), h: b.h * 0.32 }, b.h * 0.16); ctx.fill();
  ctx.lineWidth = 2; const brim = ctx.createLinearGradient(0, b.y, 0, b.y + b.h); brim.addColorStop(0, 'rgba(255,226,150,0.9)'); brim.addColorStop(1, 'rgba(140,100,30,0.8)');
  ctx.strokeStyle = brim; rrect(ctx, b, b.h / 2); ctx.stroke();
  const label = w.mode === 'seek' ? (pl.auto ? `Caught ${w.caught.length} of ${w.party.length}` : `${mmss(w.timeLeft)} sand · caught ${w.caught.length} of ${w.party.length}`) : `Hidden ${Math.floor(w.t)} of ${HIDE_TIME} s${w.close ? ` · close calls ${w.close}` : ''}`;
  txt(ctx, label, b.x + b.w / 2, b.y + b.h / 2, 18, '#241608', { align: 'center', weight: 800, maxW: b.w - 20 });
  trayChips(ctx, st, P, pl);
  drawArena(ctx, st, L, pl, view);
  // messages
  if (w.msg) {
    const a = clamp(Math.min(w.msgT / 0.3, 1), 0, 1);
    if (w.phase !== 'feel') { ctx.save(); ctx.globalAlpha = a;
    chip(ctx, A.x + A.w / 2, A.y + 58, w.msg, 28, { align: 'center', fill: 'rgba(14,10,36,0.9)', stroke: 'rgba(232,194,106,0.6)', maxW: A.w - 30, color: PAL.gold });
    ctx.restore(); }
  }
  // controls
  const hide = w.mode === 'hide', playing = w.phase === 'seek' && !pl.auto;
  const callCd = w.me.clapCd, cdMax = hide ? TEASE_CD : CLAP_CD;
  const enabled = !pl.auto && w.phase === 'seek';
  button(ctx, P.btnA, hide ? 'Tease' : 'Call', { kind: enabled && callCd <= 0 ? 'primary' : 'disabled', size: 32, icon: 'clap', sub: callCd > 0 && enabled ? `ready in ${Math.ceil(callCd)}` : hide ? 'lure the seeker' : 'make them answer' });
  if (callCd > 0) { ctx.fillStyle = 'rgba(232,194,106,0.8)'; ctx.fillRect(P.btnA.x + 12, P.btnA.y + P.btnA.h - 8, (P.btnA.w - 24) * (1 - callCd / cdMax), 4); }
  if (!hide) {
    const rc = w.me.rec > 0 || w.me.reach > 0;
    button(ctx, P.btnB, 'Reach', { kind: enabled && !rc ? 'gold' : 'disabled', size: 32, icon: 'hand', sub: rc && enabled ? 'arms recovering' : 'sweep your arms' });
  } else {
    button(ctx, P.btnB, 'Stand still', { kind: enabled ? 'quiet' : 'disabled', size: 30, sub: 'silent' });
    GAITS.forEach((gname, i) => button(ctx, P.gait[i], gname, { kind: pl.gait === i ? 'gold' : 'ghost', size: 26 }));
  }
  if (!wide && P.rail === null) { /* tall layout: nothing else */ }
  if (w.phase === 'feel') renderIdentify(ctx, st, L, pl);
  renderCoach(ctx, st, L, pl);
  renderHint(ctx, st, L, pl);
  if (pl.meet) renderMeet(ctx, st, L, pl);
  if (pl.paused || pl.over) renderPause(ctx, st, L, pl, helpers);
}

function renderPause(ctx, st, L, pl, helpers) {
  const items = helpers.pauseItems(pl), M = menuRects(L, items.length);
  ctx.fillStyle = 'rgba(8,6,20,0.66)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, M.panel, { fill: 'rgba(24,18,52,0.97)', rad: 28 }); edgeStroke(ctx, M.panel, 28, 0.3);
  const title = pl.over ? (pl.w.done === 'won' ? 'Round complete' : 'Round over') : 'Paused';
  txt(ctx, title, M.panel.x + M.panel.w / 2, M.panel.y + 54, 42, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: M.panel.w - 40, stroke: 6 });
  items.forEach((it, i) => {
    const label = it === 'think' ? `Think time: ${THINK_TIMES[st.prefs.thinkIdx]} s (change)` : PAUSE_LABEL[it];
    button(ctx, M.btns[i], label, { kind: it === 'resume' || it === 'again' ? 'primary' : 'ghost', size: 30 });
  });
}

// ---- result -----------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const Rr = L.result, p = Rr.panel, res = st.result, wide = L.mode === 'wide';
  if (!res) return;
  ctx.fillStyle = 'rgba(8,6,20,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, p, { fill: 'rgba(24,18,52,0.96)', rad: 30 }); edgeStroke(ctx, p, 30, 0.35);
  const hide = res.mode === 'hide';
  const head = res.won ? (hide ? 'You stayed hidden!' : 'Everyone is caught!') : res.how === 'caught' ? 'The seeker found you' : 'The sand has run out';
  txt(ctx, head, p.x + p.w / 2, p.y + 56, 44, res.won ? PAL.gold : '#ff9a8a', { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: p.w - 50 });
  txt(ctx, `${res.venueName} · ${hide ? 'Hide and Dodge' : 'Seeker'}`, p.x + p.w / 2, p.y + 100, 24, PAL.dim, { align: 'center', weight: 600, maxW: p.w - 50 });
  featherRow(ctx, p.x + p.w / 2, p.y + (wide ? 170 : 170), res.feathers, wide ? 80 : 84, 1.05);
  txt(ctx, `${res.score} points`, p.x + p.w / 2, p.y + (wide ? 250 : 250), 50, PAL.text, { align: 'center', font: DISPLAY, weight: 700, stroke: 7, maxW: p.w - 60 });
  if (res.newBest) txt(ctx, 'New best in this room', p.x + p.w / 2, p.y + (wide ? 290 : 290), 24, PAL.gold, { align: 'center', weight: 800 });
  const rows = hide
    ? [['Time hidden', `${res.seconds} s of ${HIDE_TIME}`], ['Close calls', String(res.close)], ['Teases', String(res.teases)], ['Time spent running', `${res.runSeconds} s`]]
    : [['Guests caught', `${res.caught} of ${res.total}`], ['Sand left', mmss(res.timeLeft)], ['Wrong names', String(res.wrong)], ['Clues felt beyond the first', String(res.feels)], ['Hints used', String(res.hints)]];
  const x0 = p.x + 40, wd = p.w - 80;
  let y = p.y + (wide ? 336 : 338);
  const rh = wide ? 34 : 36, limit = Rr.again.y - 40;
  for (const [a, b] of rows) {
    if (y > limit) break;
    txt(ctx, a, x0, y, wide ? 22 : 24, PAL.dim, { weight: 600, maxW: wd * 0.65 }); txt(ctx, b, x0 + wd, y, wide ? 24 : 26, PAL.text, { align: 'right', weight: 800, maxW: wd * 0.35 });
    y += rh;
  }
  // the party gathers round the candle table: real 3D people laughing and clapping (a still-life of the caught moment when WebGL is off)
  {
    const f3 = globalThis.__people3d, party = st.pl?.w?.party;
    const top = y - 6, avail = Rr.again.y - 18 - top;
    if (f3 && f3.cheer && !f3.pending && !f3.off && party && avail >= 130 && res.won !== undefined) {
      const hh = Math.min(avail, 380), ww = Math.min(p.w - 36, hh * 1.7), cx = p.x + p.w / 2 - ww / 2, cy = top + (avail - hh) / 2;
      const roster = [...party.map((id) => rosterOf(id)).filter(Boolean), SEEKER].slice(0, 7);
      ctx.save(); ctx.beginPath(); ctx.roundRect(cx, cy, ww, hh, 18); ctx.clip(); ctx.translate(cx, cy);
      const bg = ctx.createLinearGradient(0, 0, 0, hh); bg.addColorStop(0, '#2a1d3f'); bg.addColorStop(1, '#120d22'); ctx.fillStyle = bg; ctx.fillRect(0, 0, ww, hh);
      const sc = Math.hypot(ctx.getTransform().a, ctx.getTransform().b);
      f3.cheer(ctx, ww, hh, st.t, roster, sc);
      ctx.restore();
      ctx.strokeStyle = 'rgba(232,194,106,0.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(cx, cy, ww, hh, 18); ctx.stroke();
    }
  }
  button(ctx, Rr.again, 'Play again', { kind: 'primary', size: 30 });
  button(ctx, Rr.rooms, 'Rooms', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, cx = S.x + S.w / 2, cy = S.y + S.h / 2, bw = Math.min(S.w - 40, 560);
  panel(ctx, { x: cx - bw / 2, y: cy - 190, w: bw, h: 380 }, { fill: 'rgba(24,18,52,0.96)', rad: 28 });
  txt(ctx, 'That is the free web demo', cx, cy - 110, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: bw - 40 });
  ctx.font = `500 26px ${UI}`;
  wrap(ctx, 'Get the full game on iPhone and Android for all four rooms, Hide and Dodge and your saved feathers.', bw - 80).forEach((ln, i) => txt(ctx, ln, cx, cy - 30 + i * 36, 26, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back to the menu', cx, cy + 150, 24, PAL.dim, { align: 'center', weight: 600 });
}

function settingsBlocks(st) {
  const p = st.prefs, row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('think', 'Think time', 'cycle', () => `${THINK_TIMES[p.thinkIdx]} s`, 'In Watch and Learn, before each move'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Fewer sparks and no screen shake'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [row('restore', () => (st.owned ? 'Full game unlocked' : 'Restore purchase'),
      'button', () => '', () => st.restoreMsg || (st.owned ? 'Thank you for playing' : 'Already bought it? Get it back'),
      { btn: () => (st.restoreBusy ? 'Checking' : st.owned ? 'Owned' : 'Restore'), off: () => st.owned || st.restoreBusy })]),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(22,18,48,0.95)', stroke: 'rgba(232,194,106,0.5)', maxW: L.S.w - 40 });
  ctx.restore();
}

export function render(ctx, st, L, view, meta, helpers) {
  const { w, h } = L, sc = st.scene;
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, helpers); drawToast(ctx, st, L); return; }
  meta.previewBadge = null;
  drawBackdrop(ctx, w + 20, h + 20, st.t);
  if (sc === 'title') renderTitle(ctx, st, L);
  else if (sc === 'venues') renderVenues(ctx, st, L);
  else if (sc === 'result') { if (st.pl) renderPlayFrozen(ctx, st, L, view, meta, helpers); renderResult(ctx, st, L); }
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: 'About', blocks: ABOUT });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
  else if (sc === 'rules') { const pg = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `${st.rulesPage + 1}/${RULES.length}  ${pg.title}`, blocks: pg.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  drawToast(ctx, st, L);
}
// Behind the result panel: the last frame of the round, dimmed by the panel's own overlay.
function renderPlayFrozen(ctx, st, L, view, meta, helpers) {
  const pl = st.pl, keep = pl.paused, keepOver = pl.over;
  pl.paused = false; pl.over = false; pl.meet = false;
  const hold = pl.w.phase; if (pl.w.phase === 'over') pl.w.phase = 'seek';
  renderPlay(ctx, st, L, view, meta, helpers);
  pl.w.phase = hold; pl.paused = keep; pl.over = keepOver;
}
