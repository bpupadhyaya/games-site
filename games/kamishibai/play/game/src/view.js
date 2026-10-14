// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, titleLayout, docLayout, settingsLayout, listLayout, journeyRects, freeRects, overLayout, pauseLayout, centerCard, flipRect, tabCenter, TEXT_SCALES, host, R, clamp, grid } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, button, rr, txt, para, paraHeight, wrap, F, mix, rgba, icons, UI, NUM, setFont } from './ui.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke, drawBadgeStack } from './brand.js';
import { STORIES, STORY_IDS, CHAPTERS, TIERS, TIER_TEXT, captionFor, parTries } from './stories.js';
import { drawCard, paintScene, CW, CH } from './art.js';
import { DOCS, FACTS } from './content.js';
import { GRADES } from './engine.js';
import { GL } from './gl.js';
import { cardBackFace } from './cardface.js';

export const metrics = { max: 0, view: 0, rect: null };
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'ring', label: 'Beat ring', opts: ['Show', 'Hide'] },
  { id: 'caps', label: 'Card back lines', opts: ['Normal', 'Hide'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore'] },
];
// Purchases row: hidden in the public web demo; label follows the store state.
export const settingsRows = (s) => SETTINGS.filter((r) => r.id !== 'restore' || !s.demo).map((r) => (r.id !== 'restore' ? r : { ...r, opts: [s.owned ? 'Full game unlocked' : s.restoreBusy ? 'Checking...' : 'Restore purchase'], sub: s.restoreMsg }));
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'ring': return p.ring ? 0 : 1;
    case 'caps': return p.caps ? 0 : 1;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return -1;
  }
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => t * t * (3 - 2 * t);
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);
const fmtTime = (t) => { t = Math.max(0, Math.round(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
export { fmtTime };
const tale = (id) => STORIES[id];
const cardOf = (P, slot) => STORIES[P.story].cards[P.order[slot]];

export function render(ctx, s, view) {
  const w = view.width, h = view.height, T = theme();
  const sc = s.scene;
  if (GL.active) {
    // transparent kit canvas: clear the previous frame (the kit only fills with the transparent background colour)
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
    // the 3D scene is behind this canvas: publish how virtual units map to CSS pixels, then paint only a readability scrim
    const rat = ctx.canvas.clientWidth / Math.max(1, ctx.canvas.width), tf = ctx.getTransform();
    GL.f = { k: tf.a * rat, ox: tf.e * rat, oy: tf.f * rat, W: ctx.canvas.clientWidth, H: ctx.canvas.clientHeight, mode: 'menu', w, h };
    glScrim(ctx, s, w, h);
  } else { GL.f = null; background(ctx, w, h, s.prefs.calm ? 0 : s.t); }
  metrics.max = 0; metrics.rect = null;
  if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'journey') drawJourney(ctx, s, w, h);
  else if (sc === 'free') drawFree(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'stats') drawStats(ctx, s, w, h);
  else if (sc === 'over') drawOver(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  if (s.sceneT < 0.25 && sc !== 'play') { ctx.fillStyle = rgba(T.bg1, 1 - smooth(s.sceneT / 0.25)); ctx.fillRect(0, 0, w, h); }
}

// ---- scrims over the 3D scene (only while it runs): menus and text pages get a dark veil so the type reads, the play views stay clear ----------
function glScrim(ctx, s, w, h) {
  const sc = s.scene, T = theme();
  const veil = (a0, a1, y0 = 0, y1 = h) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, `rgba(10,6,22,${a0})`); g.addColorStop(1, `rgba(10,6,22,${a1})`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); };
  if (sc === 'play') {
    // soft darkening at the bottom where the caption / controls sit, and a vignette
    const g = ctx.createLinearGradient(0, h * 0.55, 0, h); g.addColorStop(0, 'rgba(10,6,22,0)'); g.addColorStop(1, 'rgba(10,6,22,0.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  } else if (sc === 'title') veil(0.0, 0.0);
  else { veil(0.72, 0.84); }
  void T;
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,3,16,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}

// ================================================================ the wooden stage (butai) ===================================================
export function drawStage(ctx, st, t = 0) {
  if (GL.active) return;
  const T = theme(), fr = st.frame, c = st.card, pad = st.pad;
  ctx.fillStyle = 'rgba(0,0,0,0.32)'; rr(ctx, fr.x + 3, fr.y + 6, fr.w, fr.h, pad * 0.9); ctx.fill();
  const g = ctx.createLinearGradient(0, fr.y, 0, fr.y + fr.h); g.addColorStop(0, T.woodHi); g.addColorStop(0.5, T.wood); g.addColorStop(1, T.woodLo);
  rr(ctx, fr.x, fr.y, fr.w, fr.h, pad * 0.9); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = rgba('#000000', 0.6); ctx.stroke();
  // wood grain
  ctx.save(); rr(ctx, fr.x, fr.y, fr.w, fr.h, pad * 0.9); ctx.clip(); ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.4;
  for (let i = 1; i < 9; i++) { const y = fr.y + (fr.h * i) / 9; ctx.beginPath(); ctx.moveTo(fr.x, y); ctx.bezierCurveTo(fr.x + fr.w * 0.3, y - 3, fr.x + fr.w * 0.6, y + 4, fr.x + fr.w, y - 1); ctx.stroke(); }
  ctx.restore();
  // inner recess with two open doors lying against the sides
  const rec = R(c.x - pad * 0.28, c.y - pad * 0.28, c.w + pad * 0.56, c.h + pad * 0.56);
  rr(ctx, rec.x, rec.y, rec.w, rec.h, pad * 0.3); ctx.fillStyle = '#0c0706'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = rgba(T.rim, 0.9); ctx.stroke();
  for (const side of [-1, 1]) {
    const x = side < 0 ? fr.x + pad * 0.12 : fr.x + fr.w - pad * 0.12 - (pad * 0.5);
    rr(ctx, x, c.y - pad * 0.1, pad * 0.5, c.h + pad * 0.2, pad * 0.12); ctx.fillStyle = mix(T.wood, '#000000', 0.18); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(T.rim, 0.55); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + pad * 0.25, c.y + c.h * 0.5, Math.max(2, pad * 0.07), 0, 7); ctx.fillStyle = T.rim; ctx.fill();
  }
  // roof ledge and the lantern-gold trim
  rr(ctx, fr.x - pad * 0.1, fr.y - 2, fr.w + pad * 0.2, pad * 0.34, pad * 0.12); ctx.fillStyle = mix(T.woodLo, '#000000', 0.2); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(T.rim, 0.8); ctx.stroke();
  // floor of the stage
  const fl = st.floor; rr(ctx, fl.x + 4, fl.y, fl.w - 8, fl.h - 4, 8); ctx.fillStyle = mix(T.woodLo, '#000000', 0.25); ctx.fill();
}

// A card laid into the stage: picture on cream paper with a stack edge behind it.
function stageCard(ctx, card, c, t, { calm = false, dx = 0, rot = 0, behind = true } = {}) {
  if (GL.active) return;
  if (behind) { for (let k = 2; k >= 1; k--) { ctx.fillStyle = k === 2 ? '#d9c9a0' : '#e8dbb8'; rr(ctx, c.x + k * 3, c.y + k * 3, c.w, c.h, c.w * 0.04); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke(); } }
  ctx.save();
  if (dx || rot) { ctx.translate(c.x + c.w / 2 + dx, c.y + c.h); ctx.rotate(rot); ctx.translate(-c.x - c.w / 2, -c.y - c.h); }
  drawCard(ctx, card, c, { t: calm ? 0 : t, anim: !calm, shadowAlpha: dx ? 0.45 : 0.2 });
  ctx.restore();
}

// ================================================================ play screen ============================================================
function drawPlay(ctx, s, w, h) {
  const P = s.P, perf = P.phase === 'perform';
  const L = playLayout(w, h, { n: P.n, mode: perf ? 'perform' : 'arrange', coach: !!(s.hint || (s.auto.on && !perf)) });
  if (GL.f) { GL.f.mode = perf ? 'perform' : 'arrange'; GL.f.stage = L.stage || null; GL.f.lanterns = L.lanterns || null; GL.f.grid = L.grid ? L.grid.rects : null; GL.f.land = L.land;
    if (perf && L.caption && L.pull) { const gap = L.pull.y - (L.caption.y + L.caption.h); GL.f.band = gap > 90 ? { y: L.caption.y + L.caption.h + gap * 0.5 } : null; } }
  drawInfo(ctx, s, L);
  if (perf) drawPerform(ctx, s, L); else drawArrange(ctx, s, L);
  if (s.paused) drawPaused(ctx, s, L);
  drawMsg(ctx, s, L);
}
function kindName(s) { return s.auto.on ? 'Watch and Learn' : s.P.kind === 'daily' ? 'Daily Tale' : tale(s.P.story).name; }
function drawInfo(ctx, s, L) {
  const T = theme(), P = s.P, hud = L.hud, perf = P.phase === 'perform';
  const sub = s.auto.on ? tale(P.story).name : perf ? `Card ${Math.min(s.show.i + 1, P.n)} of ${P.n}` : `${P.n} cards  ·  ${TIERS[P.tier]}  ·  checks ${P.tries}`;
  if (!L.land) {
    txt(ctx, kindName(s), hud.title.x, hud.title.y + 26, { size: F(36), weight: 700, color: T.text, maxW: L.U.w * 0.6, min: 18, fam: NUM });
    txt(ctx, sub, hud.title.x, hud.title.y + 60, { size: F(22), weight: 500, color: T.accent, maxW: L.U.w * 0.62, min: 12 });
  } else {
    const r = L.panel;
    panel(ctx, r, { radius: 26 }); edgeStroke(ctx, r, 26, 0.3);
    txt(ctx, kindName(s), hud.title.x, hud.title.y + 28, { size: F(32), weight: 700, color: T.text, maxW: r.w - 120, min: 13, fam: NUM });
    txt(ctx, sub, hud.title.x, hud.title.y + 64, { size: F(22), weight: 500, color: T.accent, maxW: r.w - 210, min: 12 });
  }
  button(ctx, L.pause, '', { icon: 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause') });
}

function cardBack(ctx, r, text) { cardBackFace(ctx, r, text); }

function drawArrange(ctx, s, L) {
  const T = theme(), P = s.P, G = L.grid, calm = s.prefs.calm;
  const frozen = s.paused;
  for (let i = 0; i < P.n; i++) {
    const r = G.rects[i], drag = s.drag && s.drag.slot === i && s.drag.moved;
    if (drag) { rr(ctx, r.x, r.y, r.w, r.h, r.w * 0.06); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(); ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.strokeStyle = rgba(T.rim, 0.6); ctx.stroke(); ctx.setLineDash([]); continue; }
    drawSlotCard(ctx, s, L, i, r, 0);
  }
  if (s.drag && s.drag.moved) {
    const r = G.rects[s.drag.slot], d = s.drag, rr2 = R(d.x - r.w / 2, d.y - r.h / 2, r.w, r.h);
    const over = G.rects.findIndex((q, k) => k !== d.slot && d.x >= q.x && d.x <= q.x + q.w && d.y >= q.y && d.y <= q.y + q.h);
    if (over >= 0 && !P.locked[over]) { const q = G.rects[over]; rr(ctx, q.x - 4, q.y - 4, q.w + 8, q.h + 8, q.w * 0.08); ctx.lineWidth = 4; ctx.strokeStyle = '#5cc8ff'; ctx.stroke(); }
    if (!GL.active) {
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(0.04); ctx.translate(-d.x, -d.y);
      drawCard(ctx, cardOf(P, d.slot), { x: rr2.x - 6, y: rr2.y - 8, w: rr2.w + 12, h: rr2.h + 9 }, { t: s.t, anim: !calm, shadowAlpha: 0.5 });
      ctx.restore();
    }
  }
  if (!s.paused && G.rects[0].y - L.gridArea.y > 60 && !s.auto.on && !s.hint) txt(ctx, 'Read the cards left to right, then top to bottom', L.gridArea.x + L.gridArea.w / 2, G.rects[0].y - 22, { size: F(22), weight: 500, color: T.dim, align: 'center', maxW: L.gridArea.w, min: 12 });
  if (s.paused) return;
  if (s.auto.on) drawAutoControls(ctx, s, L);
  else if (s.hint) drawCoach(ctx, s, L);
  else drawControls(ctx, s, L);
}
function drawSlotCard(ctx, s, L, i, r, lift) {
  const T = theme(), P = s.P, calm = s.prefs.calm, locked = P.locked[i];
  const sk = s.fx.shake[i], dx = sk !== undefined && sk < 0.45 ? Math.sin(sk * 60) * r.w * 0.025 * (1 - sk / 0.45) : 0;
  const pop = s.fx.lock[i], sc = pop !== undefined && pop < 0.35 ? 1 + 0.06 * Math.sin((Math.PI * pop) / 0.35) : 1;
  const selected = s.sel === i, hl = s.hint && s.hint.h.slot === i, hf = s.hint && s.hint.h.from === i;
  if (!GL.active) {
    ctx.save(); ctx.translate(r.x + r.w / 2 + dx, r.y + r.h / 2); ctx.scale(sc, sc); ctx.translate(-r.x - r.w / 2, -r.y - r.h / 2);
    const flipped = (P.flipped[P.order[i]] || P.flipped.all) && !s.paused;
    if (flipped) {
      const txtc = s.prefs.caps ? captionFor(cardOf(P, i), P.tier) : 'Lines are hidden in Settings.';
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, r.x + 2, r.y + 4, r.w, r.h, r.w * 0.05); ctx.fill();
      cardBack(ctx, r, txtc);
    } else drawCard(ctx, cardOf(P, i), r, { t: s.t + i * 0.7, anim: !calm && !s.paused });
    ctx.restore();
    const bw = Math.max(3, r.w * 0.012);
    if (locked) { rr(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, r.w * 0.065); ctx.lineWidth = bw * 1.6; ctx.strokeStyle = '#ffd24a'; ctx.stroke(); }
    if (selected) { rr(ctx, r.x - 5, r.y - 5, r.w + 10, r.h + 10, r.w * 0.08); ctx.lineWidth = bw * 2.4; ctx.strokeStyle = '#5cc8ff'; ctx.stroke(); }
    if (hl) { rr(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, r.w * 0.075); ctx.lineWidth = bw * 2; ctx.strokeStyle = T.good; ctx.setLineDash([10, 6]); ctx.stroke(); ctx.setLineDash([]); }
    if (hf && !hl) { rr(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, r.w * 0.075); ctx.lineWidth = bw * 2; ctx.strokeStyle = '#5cc8ff'; ctx.stroke(); }
  }
  // number badge and the flip button (always 2D: they are the touch targets)
  const bs = clamp(r.w * 0.13, 22, 40), bx = r.x + 8 + bs / 2, by = r.y + 8 + bs / 2;
  ctx.beginPath(); ctx.arc(bx, by, bs / 2, 0, 7); ctx.fillStyle = locked ? '#ffd24a' : T.woodLo; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = locked ? '#7a5200' : T.rim; ctx.stroke();
  txt(ctx, i + 1, bx, by + 1, { size: bs * 0.62, weight: 700, color: locked ? '#3a2600' : '#fff4d6', align: 'center', fam: NUM });
  if (!s.paused) { const f = flipRect(r); ctx.beginPath(); ctx.arc(f.x + f.w / 2, f.y + f.h / 2, f.w / 2, 0, 7); ctx.fillStyle = 'rgba(30,18,8,0.72)'; ctx.fill(); icons.flip(ctx, f.x + f.w / 2, f.y + f.h / 2, f.w * 0.7, '#fff4d6'); }
}

function drawControls(ctx, s, L) {
  const T = theme(), P = s.P, tl = L.tools;
  const allLocked = P.locked.every(Boolean);
  const defs = [['hang', 'Hang the cards', 'check', false], ['hint', 'Hint', 'bulb', false], ['undo', 'Undo', 'undo', P.undo.length === 0], ['flip', P.flipped.all ? 'Art' : 'Lines', 'flip', false]];
  for (const [id, label, icon, dis] of defs) {
    const r = tl[id], hang = id === 'hang';
    ctx.save(); if (dis) ctx.globalAlpha = 0.38;
    rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = hang ? T.accent : T.btn; ctx.fill();
    const fl = flashOf(s, id); if (fl) { ctx.fillStyle = `rgba(255,255,255,${0.3 * fl})`; ctx.fill(); }
    ctx.lineWidth = 1.5; ctx.strokeStyle = hang ? 'rgba(0,0,0,0)' : T.line; ctx.stroke();
    const col = hang ? T.onAccent : T.text;
    if (r.h >= 56 && r.w > 100) {
      const isz = Math.min(r.h * 0.42, 38);
      icons[icon](ctx, r.x + Math.min(40, r.w * 0.2), r.y + r.h / 2, isz, col);
      txt(ctx, label, r.x + Math.min(40, r.w * 0.2) + isz * 0.7, r.y + r.h / 2, { size: F(hang ? 24 : 22), weight: 600, color: col, maxW: r.w - Math.min(40, r.w * 0.2) - isz * 0.7 - 12, min: 12 });
    } else icons[icon](ctx, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.h * 0.5, 36), col);
    ctx.restore();
  }
}
function drawCoach(ctx, s, L) {
  const T = theme(), hnt = s.hint, C = L.ctl, B = L.coachBtns;
  panel(ctx, C, { radius: 24 });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40, ts = F(C.h > 300 ? 34 : 28);
  txt(ctx, `Card ${hnt.h.slot + 1}`, x, C.y + 14 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w, min: 18, fam: NUM });
  txt(ctx, hnt.stage === 'look' ? 'Where to look' : 'Why it fits', x, C.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim });
  const bodyTop = C.y + 14 + ts * 2.1, bodyH = B.close.y - 10 - bodyTop;
  let size = F(C.w > 500 ? 30 : 26);
  while (size > 14 && paraHeight(ctx, hnt.text, w, size, 500, 1.3) > bodyH) size -= 1;
  para(ctx, hnt.text, x, bodyTop, w, { size, weight: 500, color: T.text, lh: 1.3 });
  button(ctx, B.close, 'Close', { size: 28, flash: flashOf(s, 'close') });
  button(ctx, B.go, hnt.stage === 'look' ? 'Explain' : 'Place it', { kind: 'accent', size: 28, flash: flashOf(s, 'go') });
}
const THINK_LABEL = ['2 s', '5 s', '8 s', '10 s'];
function drawAutoControls(ctx, s, L) {
  const T = theme(), a = s.auto, C = L.ctl, rl = L.rail, hnt = s.hint;
  panel(ctx, C, { radius: 24 });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40, T0 = L.coachText;
  const ts = F(C.h > 300 ? 34 : 28), name = a.done ? 'Curtain call' : s.P.phase === 'perform' ? 'Performing' : hnt ? `Card ${hnt.h.slot + 1}` : 'Thinking';
  txt(ctx, name, x, T0.y + 14 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w, min: 18, fam: NUM });
  const phase = a.paused ? 'Paused' : a.phase === 'think' ? 'Where to look' : a.phase === 'reveal' ? 'Why it fits' : a.done ? 'Done' : 'Next step';
  txt(ctx, `Step ${a.n}  ·  ${phase}`, x, T0.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim, maxW: w * 0.6, min: 12 });
  const bodyTop = T0.y + 14 + ts * 2.1, bodyH = T0.y + T0.h - bodyTop;
  const text = hnt?.text ?? (a.done ? 'The tale is told. Tap Exit to go back.' : 'Looking for the next card.');
  let size = F(C.w > 500 ? 28 : 24);
  while (size > 14 && paraHeight(ctx, text, w, size, 500, 1.3) > bodyH) size -= 1;
  para(ctx, text, x, bodyTop, w, { size, weight: 500, color: T.text, lh: 1.3 });
  drawRail(ctx, s, rl);
  txt(ctx, `Think ${THINK_LABEL[s.prefs.thinkIdx]}`, C.x + C.w - 20, T0.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim, align: 'right' });
}
function drawRail(ctx, s, rl) {
  const a = s.auto;
  button(ctx, rl.exit, 'Exit', { icon: 'exit', size: 26, flash: flashOf(s, 'aexit') });
  button(ctx, rl.pause, a.paused ? 'Resume' : 'Pause', { icon: a.paused ? 'play' : 'pause', kind: 'accent', size: 26, flash: flashOf(s, 'apause') });
  button(ctx, rl.dec, '', { icon: 'minus', size: 26, flash: flashOf(s, 'adec') });
  button(ctx, rl.inc, '', { icon: 'plus', size: 26, flash: flashOf(s, 'ainc') });
}

// ---- perform -------------------------------------------------------------------------------------------------------------------
function lanternRow(ctx, r, att, t, calm) {
  if (GL.active) return;
  const T = theme(), n = 5, gap = Math.min(r.w / n, 120), x0 = r.x + r.w / 2 - gap * (n - 1) / 2, sz = Math.min(r.h * 0.5, 30);
  ctx.strokeStyle = rgba(T.text, 0.35); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r.x + 6, r.y + 4); ctx.quadraticCurveTo(r.x + r.w / 2, r.y + 14, r.x + r.w - 6, r.y + 4); ctx.stroke();
  for (let i = 0; i < n; i++) {
    const lit = clamp(att - i, 0, 1), x = x0 + i * gap, y = r.y + r.h * 0.55 + (calm ? 0 : Math.sin(t * 2 + i) * 1.5);
    if (lit > 0) { const g = ctx.createRadialGradient(x, y, 2, x, y, sz * 2.2); g.addColorStop(0, `rgba(255,200,90,${0.55 * lit})`); g.addColorStop(1, 'rgba(255,200,90,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, sz * 2.2, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(x, y, sz * 0.62, sz * 0.78, 0, 0, 7); ctx.fillStyle = mix('#5a3a2a', '#ffb62a', lit); ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#2b1d16'; ctx.stroke();
    rr(ctx, x - sz * 0.42, y - sz * 0.92, sz * 0.84, sz * 0.2, 3); ctx.fillStyle = '#2b1d16'; ctx.fill(); rr(ctx, x - sz * 0.42, y + sz * 0.72, sz * 0.84, sz * 0.2, 3); ctx.fill();
  }
}
function audience(ctx, fl, t, cheer, calm) {
  if (GL.active) return;
  const cols = ['#e2503c', '#3d7be0', '#f3b24a', '#5cb85c', '#a77bff', '#ff7fa6'], n = Math.max(4, Math.floor(fl.w / 70)), step = fl.w / n;
  for (let i = 0; i < n; i++) {
    const x = fl.x + step * (i + 0.5), bob = calm ? 0 : Math.sin(t * 3 + i * 1.3) * 2 - cheer * 4 * Math.abs(Math.sin(t * 9 + i)), y = fl.y + fl.h - 4 + bob;
    ctx.beginPath(); ctx.ellipse(x, y + 8, step * 0.3, 14, 0, Math.PI, 0); ctx.fillStyle = cols[i % cols.length]; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1a1008'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y - 8, 9, 0, 7); ctx.fillStyle = '#f2c9a0'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y - 10, 9.5, Math.PI, 0); ctx.fillStyle = '#2b1d16'; ctx.fill();
  }
}
const GRADE_TEXT = { perfect: 'Perfect!', good: 'Good', ok: 'Okay', rushed: 'Too soon', late: 'Too late' };
const GRADE_COL = { perfect: '#ffd24a', good: '#7fe0a8', ok: '#d9e0ff', rushed: '#ff9a6a', late: '#ff7058' };
function drawPerform(ctx, s, L) {
  const T = theme(), P = s.P, sh = s.show, st = L.stage, S = STORIES[P.story], calm = s.prefs.calm;
  drawStage(ctx, st, s.t);
  const c = st.card, cur = sh.i < P.n ? sh.i : P.n - 1;
  const next = S.cards[cur];
  if (s.pullAnim) {
    const pa = s.pullAnim, k = smooth(clamp(pa.t / 0.5, 0, 1)), prevC = S.cards[pa.card];
    stageCard(ctx, next, c, s.t, { calm, behind: false });
    stageCard(ctx, prevC, c, s.t, { calm, dx: k * c.w * 1.25 * pa.dir, rot: k * 0.12 * pa.dir, behind: false });
  } else {
    const dx = s.pullDrag ? s.pullDrag.dx : 0;
    stageCard(ctx, next, c, s.t, { calm, dx, rot: dx * 0.0004, behind: !sh.done });
  }
  // pull tab and the beat ring
  if (!sh.done && !s.pullAnim && !s.auto.on || (s.auto.on && !sh.done && !s.pullAnim)) {
    const tb = tabCenter(c), rem = sh.beat - sh.t;
    ctx.beginPath(); ctx.arc(tb.x, tb.y, tb.r, 0, 7); ctx.fillStyle = '#fff4d6'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = '#2b1d16'; ctx.stroke();
    icons.next(ctx, tb.x, tb.y, tb.r * 1.5, '#2b1d16');
    if (s.prefs.ring) {
      const inWin = Math.abs(rem) <= 0.3, late = rem < -1.3;
      const rad = rem > 0 ? tb.r * 1.15 + tb.r * 1.9 * clamp(rem / 2, 0, 1) : tb.r * 1.15 + tb.r * clamp(-rem * 1.2, 0, 2.2);
      ctx.beginPath(); ctx.arc(tb.x, tb.y, rad, 0, 7); ctx.lineWidth = Math.max(3, tb.r * 0.28); ctx.strokeStyle = inWin ? '#7fe0a8' : late ? '#ff5a4a' : '#ffd24a'; ctx.stroke();
      ctx.beginPath(); ctx.arc(tb.x, tb.y, tb.r * 1.15, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  audience(ctx, st.floor, s.t, s.cheerT > 0 ? 1 : 0, calm);
  lanternRow(ctx, L.lanterns, sh.att, s.t, calm);
  // caption
  const C = L.caption;
  panel(ctx, C, { radius: 22 });
  const full = captionFor(next, 0);
  let size = F(C.w > 560 ? 32 : 27);
  while (size > 14 && paraHeight(ctx, full, C.w - 40, size, 600, 1.3) > C.h - 44) size -= 1;
  const lines = wrap(ctx, full, C.w - 40, size, 600);
  const total = lines.reduce((a, l) => a + l.length, 0), shown = sh.done ? total : Math.floor(total * clamp(sh.t / Math.max(0.6, sh.beat * 0.75), 0, 1));
  let used = 0;
  lines.forEach((l, i) => {
    const part = l.slice(0, Math.max(0, Math.min(l.length, shown - used))); used += l.length;
    txt(ctx, l, C.x + 20, C.y + 14 + size * 0.65 + i * size * 1.3, { size, weight: 600, color: rgba(T.text, 0.18), maxW: 0 });
    if (part) txt(ctx, part, C.x + 20, C.y + 14 + size * 0.65 + i * size * 1.3, { size, weight: 600, color: T.text });
  });
  // timeline
  const bar = R(C.x + 20, C.y + C.h - 18, C.w - 40, 8);
  rr(ctx, bar.x, bar.y, bar.w, bar.h, 4); ctx.fillStyle = 'rgba(128,128,128,0.3)'; ctx.fill();
  const frac = clamp(sh.t / (sh.beat + 1.4), 0, 1), bx = bar.x + bar.w * (sh.beat / (sh.beat + 1.4));
  rr(ctx, bar.x, bar.y, Math.max(8, bar.w * frac), bar.h, 4); ctx.fillStyle = sh.t > sh.beat + 0.3 ? '#ff7058' : T.accent; ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 1.5, bar.y - 5, 3, bar.h + 10);
  // grade popup
  if (s.lastGrade && s.lastGrade.t < 1.1) {
    const g = s.lastGrade, a = 1 - g.t / 1.1;
    txt(ctx, GRADE_TEXT[g.grade], c.x + c.w / 2, c.y + c.h * 0.25 - g.t * 24, { size: F(c.w > 360 ? 60 : 44), weight: 800, color: GRADE_COL[g.grade], align: 'center', fam: NUM });
    ctx.globalAlpha = 1; void a;
  }
  // controls
  if (s.auto.on) {
    if (!s.paused) drawAutoRail(ctx, s, L);
  } else if (!s.paused && !sh.failed) {
    button(ctx, L.pull, 'Pull the card', { kind: 'accent', icon: 'next', size: 34, sub: 'or swipe it sideways', flash: flashOf(s, 'pull'), radius: 22 });
  }
  if (sh.failed) {
    const cc = centerCard(L.w, L.h, 560, 260);
    panel(ctx, cc, { radius: 26 }); edgeStroke(ctx, cc, 26, 0.5);
    txt(ctx, 'The children wandered off', cc.x + cc.w / 2, cc.y + 56, { size: F(34), weight: 700, color: T.text, align: 'center', maxW: cc.w - 40, min: 18, fam: NUM });
    para(ctx, 'The lanterns went dark. Tap to call them back and begin this card again.', cc.x + 30, cc.y + 100, cc.w - 60, { size: F(26), weight: 500, color: T.dim, align: 'center' });
    button(ctx, R(cc.x + cc.w / 2 - 130, cc.y + cc.h - 86, 260, 64), 'Try again', { kind: 'accent', size: 28, flash: flashOf(s, 'retry') });
  }
}
function drawAutoRail(ctx, s, L) {
  const T = theme(), rl = L.rail, r = rl.rect;
  panel(ctx, R(r.x - 6, r.y - 6, r.w + 12, r.h + 12), { radius: 20 });
  drawRail(ctx, s, rl);
  txt(ctx, 'Watch and Learn', r.x + r.w / 2, r.y - 22, { size: F(20), weight: 600, color: T.dim, align: 'center' });
}

function drawPaused(ctx, s, L) {
  const T = theme(), pl = pauseLayout(L.w, L.h);
  ctx.fillStyle = rgba(T.bg1, 0.86); ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, pl.card, { radius: 26 });
  edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 44, { size: F(40), weight: 700, color: T.text, align: 'center', fam: NUM });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 30, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, 'Restart tale', { size: 28, flash: flashOf(s, 'restart') });
  button(ctx, pl.settings, 'Settings', { icon: 'gear', size: 28, flash: flashOf(s, 'psettings') });
  button(ctx, pl.menu, 'Save and menu', { size: 28, flash: flashOf(s, 'pmenu') });
}
function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), w = Math.min(L.U.w - 40, 600), cx2 = L.U.x0 + L.U.w / 2;
  let size = F(24), lines = wrap(ctx, m.text, w - 36, size, 600);
  while (lines.length > 3 && size > F(18)) { size -= 1; lines = wrap(ctx, m.text, w - 36, size, 600); }
  const hh = lines.length * size * 1.22 + 22, y = L.U.y0 + (L.land ? 14 : 84);
  ctx.save(); ctx.globalAlpha = a;
  rr(ctx, cx2 - w / 2, y, w, hh, 18); ctx.fillStyle = T.dark ? 'rgba(14,8,22,0.96)' : 'rgba(255,255,255,0.97)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke();
  para(ctx, m.text, cx2 - w / 2 + 18, y + 11, w - 36, { size, weight: 600, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}

// Title lettering: gold-leaf capitals with a lacquered edge, a drop shadow and a slow glint, so it reads as a carved sign board.
function embossed(ctx, text, x, y, size, maxW, t) {
  setFont(ctx, size, 800, NUM);
  let sz = size; while (ctx.measureText(text).width > maxW && sz > 24) { sz -= 1; setFont(ctx, sz, 800, NUM); }
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = sz * 0.12; ctx.shadowOffsetY = sz * 0.07;
  ctx.fillStyle = '#2a1204'; ctx.fillText(text, x, y + sz * 0.045);
  ctx.shadowColor = 'rgba(255,170,70,0.45)'; ctx.shadowBlur = sz * 0.35; ctx.shadowOffsetY = 0;
  const g = ctx.createLinearGradient(0, y - sz * 0.5, 0, y + sz * 0.5);
  g.addColorStop(0, '#fff2c4'); g.addColorStop(0.45, '#f3c25a'); g.addColorStop(0.55, '#d99a2c'); g.addColorStop(1, '#8e5a14');
  ctx.fillStyle = g; ctx.fillText(text, x, y);
  ctx.shadowBlur = 0; ctx.lineWidth = Math.max(1, sz * 0.012); ctx.strokeStyle = 'rgba(255,248,220,0.55)'; ctx.strokeText(text, x, y - sz * 0.012);
  const w = ctx.measureText(text).width;
  ctx.restore();
  // a slow glint sweeping across the letters
  const gx = x - w / 2 + ((t * 0.18) % 1.6 - 0.3) * w;
  ctx.save(); ctx.font = `800 ${sz}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const gl = ctx.createLinearGradient(gx - sz * 0.5, 0, gx + sz * 0.5, 0); gl.addColorStop(0, 'rgba(255,255,255,0)'); gl.addColorStop(0.5, 'rgba(255,255,255,0.55)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.fillText(text, x, y);
  ctx.restore();
}

// ================================================================ title ==================================================================
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h, !!s.saved), hero = L.hero; setBrandTone(T.dark);
  const H = hero.h, tb = Math.min(170, Math.max(80, H * 0.3));
  const ph = (H - tb - 24), pad = Math.max(10, Math.min(hero.w, ph) * 0.05);
  let cw = Math.min(hero.w - 2 * pad, ((ph - 2 * pad - 36) * 4) / 3, 560); cw = Math.max(80, cw);
  const ch = cw * 0.75, fw = cw + 2 * pad, fh = ch + 2 * pad + 36, fx = hero.x + (hero.w - fw) / 2, fy = hero.y + Math.max(14, (ph - fh) / 2);
  const st = { frame: R(fx, fy, fw, fh), card: R(fx + pad, fy + pad + 6, cw, ch), pad, floor: R(fx, fy + fh - 36, fw, 36) };
  // string of lanterns above the stage
  const cyc = 4.2, k = Math.floor(s.t / cyc), tt = s.t - k * cyc, ids = STORY_IDS, cardA = STORIES[ids[k % ids.length]].cards[0], cardB = STORIES[ids[(k + 1) % ids.length]].cards[Math.min(1, STORIES[ids[(k + 1) % ids.length]].cards.length - 1)];
  if (GL.f) { GL.f.mode = 'title'; GL.f.hero = R(hero.x - 10, hero.y, hero.w + 20, fy + fh - hero.y + 4); GL.f.band = { y: fy + fh + 6 }; }
  drawStage(ctx, st, s.t);
  const slide = smooth(clamp((tt - (cyc - 0.6)) / 0.6, 0, 1));
  stageCard(ctx, slide > 0 ? cardB : cardA, st.card, s.t, { calm: s.prefs.calm, behind: true });
  if (slide > 0) stageCard(ctx, cardA, st.card, s.t, { calm: s.prefs.calm, dx: slide * st.card.w * 1.2, rot: slide * 0.1, behind: false });
  audience(ctx, st.floor, s.t, 0, s.prefs.calm);
  const ty = fy + fh + tb * 0.5;
  embossed(ctx, 'KAMISHIBAI', hero.x + hero.w / 2, ty, tb * 0.5, hero.w * 0.94, s.t);
  txt(ctx, 'PAPER-CARD STORYTELLING  ·  紙芝居', hero.x + hero.w / 2, ty + tb * 0.4, { size: tb * 0.17, weight: 600, color: T.accent, align: 'center', maxW: hero.w * 0.9, min: 13, fam: UI });
  const done = Object.keys(s.progress).length, Bt = L.buttons;
  const lab = {
    continue: ['Continue', s.saved ? `${tale(s.saved.story).name}  ·  ${s.saved.phase === 'perform' ? 'the show' : 'arranging'}` : ''],
    journey: ['The Journey', `${done} of ${STORY_IDS.length} tales told`], free: ['Free Play', 'Any tale, three levels each'],
    daily: ['Daily Tale', s.dailyDone ? `${tale(s.dailyStory).name}  ·  done today` : `${tale(s.dailyStory).name}  ·  ${s.streak ? s.streak + ' day streak' : 'new every day'}`],
    learn: ['Watch and Learn', ''], howto: ['How to Play', ''], rules: ['Rules', ''], stats: ['Stats', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear', stats: 'star' };
  for (const id of Object.keys(Bt)) {
    const prim = id === 'continue' || id === 'journey' || id === 'free' || id === 'daily', r = Bt[id];
    button(ctx, r, lab[id][0], { kind: id === 'journey' || id === 'continue' ? 'accent' : 'solid', size: prim ? 32 : 24, sub: prim ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: prim ? '' : (iconOf[id] ?? '') });
    if (id === 'daily' && s.dailyDone) icons.check(ctx, r.x + r.w - 36, r.y + r.h / 2, 28, T.good);
  }
  drawCredit(ctx, L.brand.x, L.brand.y, Math.min(16, Math.max(12.5, 13.5 / (host.px || 0.55) * 0.5 + 6)), { dim: 0.95 });
}

// ================================================================ pick screens ============================================================
function header(ctx, s, P, title) {
  const T = theme(), sc = scaleOf(s);
  txt(ctx, title, P.titleX, P.header.y + P.header.h / 2, { size: F(42), weight: 700, color: T.text, maxW: P.textDec.x - P.titleX - 14, min: 20, fam: NUM });
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
const starRow = (ctx, cx, y, size, n, have) => { for (let k = 0; k < n; k++) icons.star(ctx, cx + (k - (n - 1) / 2) * size * 1.1, y, size, k < have ? '#ffc93c' : 'rgba(128,128,128,0.4)'); };
export const bestOf = (s, id) => Math.max(0, ...['0', '1', '2'].map((t) => s.stats.best[`${id}:${t}`] ?? 0));

function drawJourney(ctx, s, w, h) {
  const T = theme(), LL = listLayout(w, h), sc = scaleOf(s), z = Math.min(sc, 1.6);
  header(ctx, s, LL, 'The Journey');
  const J = journeyRects(LL.body, CHAPTERS.map((c) => c.tales.length), sc);
  let nextId = null;
  outer: for (const ch of CHAPTERS) for (const id of ch.tales) if (!s.progress[id]) { nextId = id; break outer; }
  scrollBody(ctx, s, LL.body, () => {
    J.items.forEach((it) => {
      const ch = CHAPTERS[it.ci], hd = it.head, done = ch.tales.filter((id) => s.progress[id]).length;
      txt(ctx, ch.name, hd.x + 4, hd.y + 24 * z, { size: F(34) * z, weight: 700, color: T.text, maxW: hd.w * 0.7, min: 16, fam: NUM });
      txt(ctx, `${done} of ${ch.tales.length}`, hd.x + hd.w - 4, hd.y + 24 * z, { size: F(24) * z, weight: 600, color: T.accent, align: 'right' });
      para(ctx, ch.blurb, hd.x + 4, hd.y + 46 * z, hd.w - 8, { size: F(21) * z, weight: 400, color: T.dim, lh: 1.15 });
      it.rows.forEach((r, i) => {
        const id = ch.tales[i], S = STORIES[id], pr = s.progress[id], locked = !s.unlocked[id], isNext = id === nextId;
        panel(ctx, r, { radius: 20, fill: isNext ? rgba(T.accent, 0.16) : null, line: isNext ? T.accent : T.line });
        ctx.save(); if (locked) ctx.globalAlpha = 0.45;
        const ph = r.h - 20, pw = ph * (4 / 3), pr2 = R(r.x + 10, r.y + 10, pw, ph);
        drawCard(ctx, S.cards[S.cards.length - 1], pr2, { anim: false, shadowAlpha: 0.2 });
        const tx = pr2.x + pr2.w + 16, tw = r.w - pw - 46;
        txt(ctx, S.name, tx, r.y + r.h * 0.3, { size: F(28) * z, weight: 700, color: T.text, maxW: tw, min: 14 });
        txt(ctx, `${S.cards.length} cards`, tx, r.y + r.h * 0.55, { size: F(21) * z, weight: 500, color: T.accent });
        if (pr) starRow(ctx, tx + 36 * z, r.y + r.h * 0.8, 24 * z, 3, pr.stars);
        else txt(ctx, locked ? 'Tell the tale above first' : isNext ? 'Next tale' : 'Not told yet', tx, r.y + r.h * 0.8, { size: F(19) * z, weight: 400, color: T.dim, maxW: tw, min: 11 });
        ctx.restore();
      });
    });
    return J.contentH + 10;
  });
  button(ctx, LL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

function drawFree(ctx, s, w, h) {
  const T = theme(), LL = listLayout(w, h), sc = scaleOf(s), Fr = freeRects(LL.body, STORY_IDS.length, sc), z = Math.min(sc, 1.5);
  header(ctx, s, LL, 'Free Play');
  scrollBody(ctx, s, LL.body, () => {
    Fr.cards.forEach((c, vi) => {
      const id = STORY_IDS[vi], S = STORIES[id], r = c.r;
      panel(ctx, r, { radius: 22 });
      const ph = 100 * z, pw = ph * (4 / 3);
      drawCard(ctx, S.cards[0], R(r.x + 14, r.y + 14, pw, ph), { anim: false, shadowAlpha: 0.2 });
      const tx = r.x + 14 + pw + 14, tw = r.w - pw - 42;
      txt(ctx, S.name, tx, r.y + 30 * z, { size: F(30) * z, weight: 700, color: T.text, maxW: tw, min: 14, fam: NUM });
      txt(ctx, `${S.cards.length} cards`, tx, r.y + 62 * z, { size: F(21) * z, weight: 600, color: T.accent, maxW: tw, min: 12 });
      para(ctx, S.blurb, tx, r.y + 80 * z, tw, { size: F(19) * z, weight: 400, color: T.dim, lh: 1.15 });
      c.tiers.forEach((tr, t) => { const stars = s.stats.best[`${id}:${t}`]; button(ctx, tr, TIERS[t], { size: 24, kind: t === 1 ? 'accent' : 'solid', radius: 14, flash: flashOf(s, 'tier' + vi + t) }); if (stars) starRow(ctx, tr.x + tr.w / 2, tr.y - 8 * Math.min(z, 1), 14 * Math.min(z, 1.2), 3, stars); });
    });
    return Fr.contentH;
  });
  button(ctx, LL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ docs ===================================================================
function figRect(r, ratio = 0.75) { const w = Math.min(r.w, r.h / ratio); return R(r.x + (r.w - w) / 2, r.y, w, w * ratio); }
function drawDoc(ctx, s, w, h) {
  const T = theme(), doc = DOCS[s.doc.kind], page = doc.pages[s.doc.page], DL = docLayout(w, h), sc = scaleOf(s);
  header(ctx, s, DL, doc.title);
  const n = doc.pages.length;
  button(ctx, DL.menu, 'Menu', { icon: 'back', size: 26, flash: flashOf(s, 'back') });
  button(ctx, DL.prev, 'Prev', { size: 26, disabled: s.doc.page === 0, flash: flashOf(s, 'prev') });
  button(ctx, DL.next, 'Next', { size: 26, kind: s.doc.page < n - 1 ? 'accent' : 'solid', disabled: s.doc.page >= n - 1, flash: flashOf(s, 'next') });
  txt(ctx, `${s.doc.page + 1} / ${n}`, DL.count.x + DL.count.w / 2, DL.count.y + DL.count.h / 2, { size: F(26), weight: 600, color: T.dim, align: 'center' });
  const textR = DL.text, figR = DL.fig;
  const figCard = page.fig ? STORIES[page.fig.story].cards[page.fig.card] : null;
  const drawText = (top, width, x) => {
    let y = top;
    txt(ctx, page.title, x, y + 26 * sc, { size: F(36) * sc, weight: 700, color: T.accent, maxW: width, min: 16, fam: NUM }); y += 26 * sc + 30 * sc;
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
    if (figCard) { const fr = figRect(R(figR.x, figR.y, figR.w, figR.h)); drawCard(ctx, figCard, fr, { t: s.t, anim: !s.prefs.calm }); }
    scrollBody(ctx, s, textR, () => drawText(textR.y, textR.w - 10, textR.x));
  } else {
    scrollBody(ctx, s, textR, () => {
      let y = textR.y;
      if (figCard) { const fw = Math.min(textR.w, sc > 1.6 ? 300 : 460), fr = R(textR.x + (textR.w - fw) / 2, y, fw, fw * 0.75); drawCard(ctx, figCard, fr, { t: s.t, anim: !s.prefs.calm }); y += fr.h + 16; }
      return y - textR.y + drawText(y, textR.w - 10, textR.x);
    });
  }
}

// ================================================================ settings ===============================================================
function drawSettings(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), ROWS = settingsRows(s), SL = settingsLayout(w, h, sc, ROWS.length);
  header(ctx, s, SL, 'Settings');
  scrollBody(ctx, s, SL.body, () => {
    ROWS.forEach((row, i) => {
      const g = SL.rows[i];
      panel(ctx, g.rect, { radius: 20 });
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + g.rect.h / 2 - (row.sub ? 10 : 0), { size: F(28) * Math.min(sc, 1.5), weight: 600, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      if (row.sub) txt(ctx, row.sub, g.rect.x + 22, g.rect.y + g.rect.h - 20, { size: F(18) * Math.min(sc, 1.5), weight: 400, color: T.dim, maxW: g.rect.w - 44, min: 11 });
      const n = row.opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      row.opts.forEach((o, k) => button(ctx, seg[k], o, { size: 24, active: k === cur, radius: 14, kind: row.id === 'restore' && !s.owned ? 'accent' : 'solid', flash: flashOf(s, 'set' + i + '.' + k) }));
    });
    return SL.contentH;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ stats ==================================================================
function drawStats(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), SL = listLayout(w, h), st = s.stats, z = Math.min(sc, 1.6);
  header(ctx, s, SL, 'Stats');
  const wide = SL.body.w >= 1000;
  scrollBody(ctx, s, SL.body, () => {
    const r = SL.body, gapC = 28, lw = wide ? (r.w - gapC) * 0.54 : r.w, x = r.x; let y = r.y;
    const cols = lw > 760 ? 4 : 2, tiles = [['Tales told', st.told], ['Perfect pulls', st.perfect], ['Daily streak', s.streak], ['Best streak', st.bestStreak]];
    const th = 110 * Math.min(sc, 1.8), g = 12, tw = (lw - g * (cols - 1)) / cols;
    tiles.forEach(([l, v], i) => {
      const tr = R(x + (i % cols) * (tw + g), y + Math.floor(i / cols) * (th + g), tw, th);
      panel(ctx, tr, { radius: 20 });
      txt(ctx, v, tr.x + 20, tr.y + th * 0.42, { size: F(46) * z, weight: 700, color: T.text });
      txt(ctx, l, tr.x + 20, tr.y + th * 0.8, { size: F(22) * z, weight: 400, color: T.dim, maxW: tw - 30, min: 11 });
    });
    y += Math.ceil(tiles.length / cols) * (th + g) + 10;
    txt(ctx, 'Best stars by tale', x, y + 20 * sc, { size: F(32) * sc, weight: 700, color: T.accent, fam: NUM }); y += 50 * sc;
    for (const id of STORY_IDS) {
      const rh = 70 * Math.min(sc, 1.8), rr2 = R(x, y, lw, rh);
      panel(ctx, rr2, { radius: 16 });
      txt(ctx, STORIES[id].name, x + 20, y + rh / 2, { size: F(25) * z, weight: 600, color: T.text, maxW: lw * 0.5, min: 13 });
      starRow(ctx, x + lw - 20 - 36 * z, y + rh / 2, 22 * z, 3, Math.max(0, ...[0, 1, 2].map((t) => st.best[`${id}:${t}`] ?? 0)));
      y += rh + 8;
    }
    const leftEnd = y;
    let cx = x, cw = lw, cy;
    if (wide) { cx = x + lw + gapC; cw = r.w - lw - gapC; cy = r.y; } else { y += 14; cy = y; }
    txt(ctx, 'Last five weeks', cx, cy + 20 * sc, { size: F(32) * sc, weight: 700, color: T.accent, fam: NUM }); cy += 50 * sc;
    const cs = Math.min(wide ? 110 : 86, (cw - 6 * 8) / 7), done = new Set(st.days);
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d, i) => txt(ctx, d, cx + i * (cs + 8) + cs / 2, cy + 12, { size: F(20), weight: 500, color: T.dim, align: 'center' }));
    cy += 28;
    const today = s.daily.day, wd = (today + 4) % 7, start = today - wd - 28;
    for (let k = 0; k < 35; k++) {
      const day = start + k, ex = cx + (k % 7) * (cs + 8), ey = cy + Math.floor(k / 7) * (cs + 8), isDone = done.has(day), future = day > today;
      rr(ctx, ex, ey, cs, cs, cs * 0.2); ctx.fillStyle = isDone ? T.good : future ? 'rgba(128,128,128,0.08)' : T.btn; ctx.fill();
      if (day === today) { ctx.lineWidth = 3; ctx.strokeStyle = T.accent; ctx.stroke(); }
      if (isDone) icons.check(ctx, ex + cs / 2, ey + cs / 2, cs * 0.5, '#06241a');
    }
    cy += 5 * (cs + 8) + 10;
    return Math.max(wide ? leftEnd : 0, cy) - r.y;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ result =================================================================
function drawOver(ctx, s, w, h) {
  const T = theme(), R0 = s.result;
  if (!R0) return;
  setBrandTone(T.dark);
  const sc = scaleOf(s), O = overLayout(w, h, sc), S = STORIES[R0.story];
  drawCard(ctx, S.cards[S.cards.length - 1], O.pic, { t: s.t, anim: !s.prefs.calm });
  const body = O.body;
  scrollBody(ctx, s, body, () => {
    let y = body.y + 4;
    const compact = O.wide, tsz = compact ? 36 : 46, z = Math.min(sc, 1.5);
    txt(ctx, R0.daily ? 'Daily Tale told' : 'The end', body.x + body.w / 2, y + tsz * 0.55, { size: F(tsz) * z, weight: 700, color: T.text, align: 'center', maxW: body.w, min: 20, fam: NUM }); y += (tsz + 12) * z;
    const sz = compact ? 36 : 50;
    for (let k = 0; k < 3; k++) icons.star(ctx, body.x + body.w / 2 + (k - 1) * (sz + 10), y + sz / 2, sz, k < R0.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
    y += sz + (compact ? 8 : 16);
    const facts = [['Score', R0.score], ['Checks', R0.tries], ['Perfect pulls', R0.perfect + ' of ' + R0.cards], ['Lanterns left', R0.att.toFixed(1)]];
    const cols = body.w > 330 ? 4 : 2, fw = (body.w - 8 * (cols - 1)) / cols, fh = (compact ? 66 : 82) * Math.min(sc, 1.7);
    facts.forEach(([l, v], i) => {
      const r = R(body.x + (i % cols) * (fw + 8), y + Math.floor(i / cols) * (fh + 8), fw, fh);
      panel(ctx, r, { radius: 14 });
      txt(ctx, v, r.x + r.w / 2, r.y + fh * 0.4, { size: F(compact ? 28 : 34) * z, weight: 700, color: T.text, align: 'center', maxW: fw - 8, min: 14 });
      txt(ctx, l, r.x + r.w / 2, r.y + fh * 0.78, { size: F(18) * z, weight: 400, color: T.dim, align: 'center', maxW: fw - 6, min: 11 });
    });
    y += Math.ceil(facts.length / cols) * (fh + 8) + 4;
    if (R0.newBest) { txt(ctx, 'New best for this tale and level', body.x + body.w / 2, y + 16, { size: F(24) * sc, weight: 600, color: T.good, align: 'center', maxW: body.w, min: 12 }); y += 40 * sc; }
    if (R0.daily) y += para(ctx, `Daily streak: ${R0.streak} day${R0.streak === 1 ? '' : 's'}`, body.x, y, body.w, { size: F(28) * sc, weight: 600, color: T.accent, align: 'center' }) + 8;
    txt(ctx, 'Did you know', body.x, y + 16 * sc, { size: F(26) * sc, weight: 700, color: T.accent }); y += 38 * sc;
    y += para(ctx, R0.fact, body.x + 8, y, body.w - 16, { size: F(24) * sc, weight: 400, color: T.dim, lh: 1.3 }) + 6;
    return y - body.y + 10;
  });
  const nextLabel = R0.kind === 'journey' ? (R0.next ? 'Next tale' : 'Back to the Journey') : R0.daily ? 'Back to menu' : 'Another tale';
  button(ctx, O.btns.next, nextLabel, { kind: 'accent', size: 32, flash: flashOf(s, 'next') });
  button(ctx, O.btns.share, 'Share', { size: 28, flash: flashOf(s, 'share') });
  button(ctx, O.btns.menu, R0.kind === 'journey' ? 'Journey' : R0.daily ? 'Free Play' : 'Menu', { size: 28, flash: flashOf(s, 'menu') });
  drawMoreLine(ctx, O.more.x, O.more.y, 15);
}

function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, { radius: 28 }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the free preview', c.x + c.w / 2, c.y + 70, { size: F(36), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 18, fam: NUM });
  para(ctx, 'The full game has all ten tales, three levels each, the Daily Tale, hints that teach and Watch and Learn. Get Kamishibai on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(26), weight: 400, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
export { smooth, GRADES };
