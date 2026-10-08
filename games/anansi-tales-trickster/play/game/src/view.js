// All drawing for the screens. Reads game state and layout; never changes game state (apart from the scroll metrics and the tap
// targets it reports back through `metrics` and `hits`, in the same coordinates it drew them).
import { playLayout, titleLayout, docLayout, settingsLayout, talesLayout, galleryLayout, overLayout, pauseLayout, centerCard, TEXT_SCALES, THINK_STEPS, host, R, clamp, grid, tapU } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, button, rr, txt, para, wrap, F, rgba, icons, setFont, DISPLAY, UI } from './ui.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke } from './brand.js';
import { TALES, DOCS, PATTERNS } from './content.js';
import { beatOf, puzzleOf, narrationOf, fmtTime, nextTarget } from './engine.js';
import { appl, band, pattern, weave, drawStage, drawCloth, drawFigure, KENTE } from './art.js';

export const metrics = { max: 0, view: 0, rect: null };   // scroll body of the current screen, filled in each frame
export const hits = [];   // tap targets inside the scrolling body: { id, r } in content coordinates (before scrolling)
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'hand', label: 'Scene side', opts: ['Left', 'Right'] },
  { id: 'sound', label: 'Sound effects', opts: ['On', 'Off'] },
  { id: 'music', label: 'Music', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore'] },
];
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'hand': return p.hand === 'right' ? 1 : 0;
    case 'sound': return p.sound ? 0 : 1;
    case 'music': return p.music ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return -1;
  }
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => t * t * (3 - 2 * t);
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);
const GOLD = '#f2c14e';

export function render(ctx, s, view) {
  const w = view.width, h = view.height, T = theme();
  background(ctx, w, h, s.t);
  weave(ctx, { x: 0, y: 0, w, h }, T.dark ? 0.025 : 0.03, 8);
  metrics.max = 0; metrics.rect = null; hits.length = 0;
  const sc = s.scene;
  if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'tales') drawTales(ctx, s, w, h);
  else if (sc === 'gallery') drawGallery(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'over') drawOver(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  if (s.sceneT < 0.25 && sc !== 'play') { ctx.fillStyle = rgba(T.dark ? '#0e0a1c' : '#dcc6a0', 1 - smooth(s.sceneT / 0.25)); ctx.fillRect(0, 0, w, h); }
}

// ---- shared pieces ------------------------------------------------------------------------------------------------------------------------------
function header(ctx, s, P, title) {
  const T = theme(), sc = scaleOf(s);
  txt(ctx, title, P.titleX, P.header.y + P.header.h / 2, { size: F(48), weight: 700, color: T.text, maxW: P.textDec.x - P.titleX - 14, min: 20, font: DISPLAY });
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
  // after a wrong pick or a solve the explanation sits below the cards: bring it into view so the player always reads why
  if (s.followMsg && metrics.msgAt) { s.scrollY = clamp(Math.max(s.scrollY, metrics.msgAt.y + metrics.msgAt.h - rect.h + 14), 0, metrics.max); s.followMsg = false; }
  if (metrics.max > 0) {
    const T = theme(), bx = rect.x + rect.w + 2, th = Math.max(40, rect.h * rect.h / ch), ty = rect.y + (rect.h - th) * clamp(s.scrollY / metrics.max, 0, 1);
    rr(ctx, bx, rect.y, 5, rect.h, 3); ctx.fillStyle = 'rgba(128,128,128,0.2)'; ctx.fill();
    rr(ctx, bx, ty, 5, th, 3); ctx.fillStyle = T.accent; ctx.fill();
  }
}
// Wrapped text that reveals n characters (the storyteller speaking); returns the full block height so the layout never jumps.
function paraReveal(ctx, text, x, y, w, size, color, n, weight = 500, lh = 1.34, font = UI) {
  const lines = wrap(ctx, text, w, size, weight), step = size * lh;
  ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  let left = n;
  for (let i = 0; i < lines.length && left > 0; i++) { const l = lines[i].length + 1; ctx.fillText(left >= l ? lines[i] : lines[i].slice(0, Math.max(0, Math.floor(left))), x, y + i * step); left -= l; }
  return lines.length * step;
}
function cardBox(ctx, r, { fill, edge, glow = 0, dx = 0, lift = 0 } = {}) {
  const T = theme();
  ctx.save(); ctx.translate(dx, -lift);
  appl(ctx, (c) => c.roundRect(r.x, r.y, r.w, r.h, 16), fill ?? T.card, { sh: 3, lw: 1.8, dash: 6, stitch: 'rgba(120,70,30,0.22)', edge: edge ?? T.cardLine });
  if (glow > 0) { ctx.beginPath(); ctx.roundRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 19); ctx.lineWidth = 6; ctx.strokeStyle = `rgba(242,193,78,${0.7 + 0.3 * Math.sin(glow * 7)})`; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke(); }
  ctx.restore();
}
const CARD_GOOD = '#dff3df', CARD_BAD = '#f6d9d1', CARD_SEL = '#fdecb8';

// ================================================================ the play screen ===============================================================
export function sceneOpts(s) {
  const P = s.P, T = theme();
  const speaking = (P.phase === 'tell' || P.phase === 'after' || P.phase === 'intro' || P.phase === 'moral') && s.say && s.say.n < s.say.text.length ? 1 : 0;
  return { speak: speaking, beat: s.beatPulse > 0 ? s.beatPulse : 0, cheer: s.cheer > 0 ? 1 : 0, hop: s.cheer > 0 ? Math.abs(Math.sin(s.at * 9)) * 0.6 : 0, pose: s.cheer > 0 ? 'cheer' : P.phase === 'solve' ? 'think' : 'idle', solved: !!(P.pz && P.pz.solved) || P.phase === 'after', motif: TALES[P.tale].motif, bg0: T.bg0, bg1: T.bg1, px: s.calm ? 0 : s.px, look: s.look };
}
function drawPlay(ctx, s, w, h) {
  const T = theme(), P = s.P;
  if (!P) return;
  const auto = s.auto.on, L = playLayout(w, h, { hand: s.prefs.hand, rail: auto }), tale = TALES[P.tale], sc = scaleOf(s);
  const beat = P.phase === 'intro' ? null : tale.beats[Math.min(P.beat, tale.beats.length - 1)];
  // header
  txt(ctx, auto ? 'Watch and Learn' : tale.title, L.hdr.x, L.hdr.y + 28, { size: F(40), weight: 700, color: T.text, maxW: L.hdr.w - (!auto ? 96 / (host.px || 0.55) : 0), min: 18, font: DISPLAY });
  const sub = P.phase === 'intro' ? 'The tale begins' : P.phase === 'moral' ? 'The moral' : `Beat ${P.beat + 1} of 4${beat ? '  ·  ' + puzzleOf(P).label : ''}`;
  txt(ctx, auto ? tale.title : sub, L.hdr.x, L.hdr.y + 64, { size: F(22), weight: 600, color: T.accent, maxW: L.hdr.w - 150, min: 12 });
  for (let i = 0; i < 4; i++) {
    const done = i < P.beat || P.phase === 'moral' || P.phase === 'over' || (i === P.beat && (P.phase === 'after')), cx = L.hdr.x + L.hdr.w - 14 - (3 - i) * 36, cy = L.hdr.y + 70;
    appl(ctx, (c) => c.arc(cx, cy, 12, 0, 7), done ? KENTE[i % 5] : 'rgba(128,128,128,0.25)', { sh: done ? 2 : 0, lw: 1.2, stitch: done ? 'rgba(255,255,255,0.4)' : '', dash: 4 });
    if (i === P.beat && !done && P.phase !== 'intro') { ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke(); }
  }
  if (!auto) button(ctx, L.pause, '', { icon: 'pause', size: 30, flash: flashOf(s, 'pause'), radius: 18 });
  // the painted scene
  const cast = beat ? beat.cast : tale.beats[0].cast;
  drawStage(ctx, L.scene, tale.scene, P.phase === 'moral' ? tale.beats[3].cast : cast, s.at, sceneOpts(s));
  if (s.confetti) drawConfetti(ctx, s, L.scene);
  // the cloth panel
  panel(ctx, L.col, { radius: 22, fill: T.dark ? 'rgba(18,10,28,0.62)' : 'rgba(255,248,232,0.72)' });
  ctx.save(); ctx.beginPath(); ctx.roundRect(L.col.x, L.col.y, L.col.w, L.col.h, 22); ctx.clip(); band(ctx, L.col.x, L.col.y, L.col.w, 9, P.tale); ctx.restore();
  scrollBody(ctx, s, L.body, () => drawBody(ctx, s, L, sc));
  // controls
  if (auto) drawAutoRail(ctx, s, L);
  else drawTools(ctx, s, L);
  drawMsg(ctx, s, L);
  if (s.paused) drawPaused(ctx, s, L);
}
function drawConfetti(ctx, s, r) {
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  for (const p of s.confetti) { ctx.save(); ctx.translate(r.x + p.x * r.w, r.y + p.y * r.h); ctx.rotate(p.a); ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = KENTE[p.c % 5]; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
  ctx.restore();
}
function drawTools(ctx, s, L) {
  const P = s.P, T = theme();
  if (P.phase === 'solve') {
    const hs = P.hintStage, solved = P.pz.solved;
    button(ctx, L.btnHint, hs === 0 ? 'Hint' : hs === 1 ? 'Show me' : 'Hide hint', { icon: 'bulb', size: 27, disabled: solved, flash: flashOf(s, 'hint') });
    button(ctx, L.btnMain, solved ? 'Continue' : 'Solve it', { kind: solved ? 'accent' : 'solid', size: 28, disabled: !solved, icon: solved ? 'next' : '', flash: flashOf(s, 'main') });
  } else {
    const r = { ...L.tools };
    button(ctx, r, P.phase === 'moral' ? 'Finish the tale' : 'Continue', { kind: 'accent', size: 30, icon: 'next', flash: flashOf(s, 'main') });
    if (s.say && s.say.n < s.say.text.length) txt(ctx, 'tap to finish the line', r.x + r.w / 2, r.y - 12, { size: F(18), weight: 500, color: T.dim, align: 'center', maxW: r.w, min: 11 });
  }
}
function drawAutoRail(ctx, s, L) {
  const a = s.auto, r = L.rail, T = theme();
  button(ctx, r.exit, 'Exit', { icon: 'exit', size: 26, flash: flashOf(s, 'aexit') });
  button(ctx, r.pause, a.paused ? 'Resume' : 'Pause', { icon: a.paused ? 'play' : 'pause', size: 26, kind: 'accent', flash: flashOf(s, 'apause') });
  button(ctx, r.dec, '', { icon: 'minus', size: 26, disabled: s.prefs.thinkIdx === 0, flash: flashOf(s, 'adec') });
  button(ctx, r.inc, '', { icon: 'plus', size: 26, disabled: s.prefs.thinkIdx === THINK_STEPS.length - 1, flash: flashOf(s, 'ainc') });
  const ly = Math.min(r.exit.y, r.dec.y) - 14, base = L.col;
  txt(ctx, `Think ${THINK_STEPS[s.prefs.thinkIdx]} s`, base.x + base.w - 22, ly, { size: F(21), weight: 600, color: T.dim, align: 'right', maxW: base.w * 0.4, min: 11 });
  const lab = { think: 'THINK', reveal: 'REVEAL', act: 'ACT', wait: 'WHY IT WORKED', read: 'LISTEN', readwait: 'LISTEN' }[a.phase] ?? '';
  if (lab) txt(ctx, lab, base.x + 22, ly, { size: F(21), weight: 700, color: T.accent, align: 'left' });
}
function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), b = L.scene, w = Math.min(b.w - 30, 560);
  let size = F(24), lines = wrap(ctx, m.text, w - 36, size, 600);
  while (lines.length > 2 && size > F(18)) { size -= 1; lines = wrap(ctx, m.text, w - 36, size, 600); }
  const hh = lines.length * size * 1.22 + 22, y = b.y + 14;
  ctx.save(); ctx.globalAlpha = a;
  rr(ctx, b.x + b.w / 2 - w / 2, y, w, hh, 18); ctx.fillStyle = T.dark ? 'rgba(20,12,30,0.94)' : 'rgba(255,252,244,0.97)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke();
  para(ctx, m.text, b.x + b.w / 2 - w / 2 + 18, y + 11, w - 36, { size, weight: 600, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}
function drawPaused(ctx, s, L) {
  const T = theme(), pl = pauseLayout(L.col);
  ctx.fillStyle = rgba(T.dark ? '#0e0a1c' : '#3a2414', 0.74); rr(ctx, L.col.x, L.col.y, L.col.w, L.col.h, 22); ctx.fill();
  panel(ctx, pl.card, { radius: 26, fill: T.dark ? 'rgba(34,20,46,0.97)' : 'rgba(255,250,240,0.97)' });
  edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 44, { size: F(44), weight: 700, color: T.text, align: 'center', font: DISPLAY });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 30, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, 'Restart the tale', { size: 28, flash: flashOf(s, 'restart') });
  button(ctx, pl.settings, 'Settings', { icon: 'gear', size: 28, flash: flashOf(s, 'psettings') });
  button(ctx, pl.menu, 'Save and menu', { size: 28, flash: flashOf(s, 'pmenu') });
}

// ---- the body of the cloth panel: narration or a puzzle ----------------------------------------------------------------------------------------------
function narrationCard(ctx, s, x, y, w, sc, who, text, n) {
  const T = theme(), pad = 22 * Math.min(sc, 1.6), size = F(30) * sc;
  txt(ctx, who.toUpperCase(), x + 4, y + 12 * sc, { size: F(19) * Math.min(sc, 1.8), weight: 700, color: T.accent, maxW: w, min: 11 });
  const ty = y + 30 * Math.min(sc, 1.8), lines = wrap(ctx, text, w - 2 * pad, size, 500), th = lines.length * size * 1.34;
  const r = R(x, ty, w, th + 2 * pad);
  cardBox(ctx, r);
  paraReveal(ctx, text, x + pad, ty + pad, w - 2 * pad, size, T.cardInk, n, 500, 1.34);
  return ty + r.h - y;
}
function drawBody(ctx, s, L, sc) {
  const P = s.P, T = theme(), b = L.body, w = b.w - 10, x = b.x;
  let y = b.y + 6; metrics.msgAt = null;
  const isSolve = P.phase === 'solve';
  if (!isSolve) {
    const nar = narrationOf(P);
    if (P.phase === 'after') {
      const def = puzzleOf(P);
      txt(ctx, 'WHY IT WORKED', x + 4, y + 12 * Math.min(sc, 1.8), { size: F(19) * Math.min(sc, 1.8), weight: 700, color: T.good, maxW: w, min: 11 });
      y += 30 * Math.min(sc, 1.8);
      y += para(ctx, def.explain, x + 4, y, w - 8, { size: F(27) * sc, weight: 500, color: T.text, lh: 1.32 }) + 18 * sc;
    }
    if (nar) y += narrationCard(ctx, s, x, y, w, sc, nar.who, nar.text, s.say ? s.say.n : 1e9) + 14;
    if (P.phase === 'moral' || P.phase === 'intro') {
      if (P.phase === 'intro') { const t = TALES[P.tale]; y += 6; txt(ctx, t.sub, x + 4, y + 14, { size: F(22) * Math.min(sc, 1.6), weight: 600, color: T.dim, maxW: w, min: 12 }); y += 40; }
    }
    return y - b.y + 30;
  }
  const def = puzzleOf(P), pz = P.pz, g = 12 * Math.min(sc, 1.5);
  // hint card
  if (P.hintText && P.hintStage >= 1) {
    const size = F(25) * sc, lines = wrap(ctx, P.hintText, w - 56, size, 600), hh = lines.length * size * 1.3 + 24;
    rr(ctx, x, y, w, hh, 14); ctx.fillStyle = 'rgba(242,193,78,0.18)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = GOLD; ctx.stroke();
    icons.bulb(ctx, x + 26, y + 26, 30, GOLD);
    para(ctx, P.hintText, x + 50, y + 12, w - 64, { size, weight: 600, color: T.text, lh: 1.3 }); y += hh + g;
  }
  // question
  y += para(ctx, def.ask, x + 2, y, w - 4, { size: F(29) * sc, weight: 700, color: T.text, lh: 1.28 }) + g * 1.2;
  const target = P.hintStage === 2 ? nextTarget(P) : null;
  if (def.kind === 'choose') y = drawChoose(ctx, s, def, pz, x, y, w, sc, g, target);
  else if (def.kind === 'order') y = drawOrder(ctx, s, def, pz, x, y, w, sc, g, target);
  else if (def.kind === 'match') y = drawMatch(ctx, s, def, pz, x, y, w, sc, g, target);
  else y = drawTrap(ctx, s, def, pz, x, y, w, sc, g, target);
  if (pz.msg && !(def.kind === 'choose' && pz.msgKind === 'bad')) {   // a wrong riddle pick already shows its reason inside the card
    const good = pz.msgKind === 'good', info = pz.msgKind === 'info', size = F(25) * sc, lines = wrap(ctx, pz.msg, w - 60, size, 600), hh = lines.length * size * 1.3 + 26;
    const col = good ? T.good : info ? T.dim : T.bad;
    metrics.msgAt = { y: y - b.y + 6, h: hh };
    rr(ctx, x, y, w, hh, 14); ctx.fillStyle = rgba(good ? '#2f9d62' : info ? '#888888' : '#d9503a', T.dark ? 0.16 : 0.14); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
    ctx.fillStyle = col; ctx.font = `700 ${size * 1.15}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(good ? '✓' : info ? 'i' : '✗', x + 16, y + 11);
    para(ctx, pz.msg, x + 46, y + 13, w - 60, { size, weight: 600, color: T.text, lh: 1.3 }); y += hh + g;
  }
  return y - b.y + 20;
}
const textFit = (ctx, text, w, size) => { const lines = wrap(ctx, text, w, size, 600); return lines.length * size * 1.28; };

function drawChoose(ctx, s, def, pz, x, y, w, sc, g, target) {
  const T = theme(), size = F(26) * sc, tw = w - 88;
  pz.order.forEach((o, k) => {
    const opt = def.options[o], out = pz.out.includes(o), right = pz.right === o, th = textFit(ctx, opt.t, tw, size), whyH = out ? textFit(ctx, opt.why, tw, size * 0.86) + 6 : 0;
    const r = R(x, y, w, Math.max(76 * Math.min(sc, 1.5), tapU(), th + 34 + whyH));
    const shake = pz.shake === o && pz.shakeT > 0 ? Math.sin(pz.shakeT * 50) * 7 * pz.shakeT : 0;
    cardBox(ctx, r, { fill: right ? CARD_GOOD : out ? CARD_BAD : T.card, glow: target && target.opt === o ? s.at : 0, dx: shake });
    ctx.save(); ctx.translate(shake, 0);
    appl(ctx, (c) => c.arc(x + 34, y + 38 * Math.min(sc, 1.2), 17, 0, 7), right ? '#2f9d62' : out ? '#c8352b' : '#243a7a', { sh: 1, stitch: '', lw: 1.2 });
    ctx.fillStyle = '#fff'; ctx.font = `700 ${19}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(right ? '✓' : out ? '✗' : String(k + 1), x + 34, y + 38 * Math.min(sc, 1.2) + 1);
    para(ctx, opt.t, x + 66, y + 17, tw, { size, weight: 600, color: out ? 'rgba(58,36,20,0.62)' : T.cardInk, lh: 1.28 });
    if (out) para(ctx, opt.why, x + 66, y + 17 + th + 6, tw, { size: size * 0.86, weight: 500, color: '#9a2e20', lh: 1.28 });
    ctx.restore();
    if (!out && !pz.solved) hits.push({ id: 'opt', k, r: { ...r } });
    y += r.h + g;
  });
  return y;
}
function drawOrder(ctx, s, def, pz, x, y, w, sc, g, target) {
  const T = theme(), size = F(26) * sc, tw = w - 84;
  if (pz.placed.length) { txt(ctx, 'YOUR TELLING', x + 4, y + 10, { size: F(18) * Math.min(sc, 1.6), weight: 700, color: T.good, min: 11, maxW: w }); y += 28 * Math.min(sc, 1.5); }
  pz.placed.forEach((st, i) => {
    const text = def.steps[st].t, th = textFit(ctx, text, tw, size), r = R(x, y, w, Math.max(64 * Math.min(sc, 1.5), tapU(), th + 28));
    cardBox(ctx, r, { fill: CARD_GOOD, lift: pz.flashT > 0 && i === pz.placed.length - 1 ? pz.flashT * 10 : 0 });
    appl(ctx, (c) => c.arc(x + 32, y + r.h / 2, 16, 0, 7), '#2f9d62', { sh: 1, stitch: '', lw: 1.2 });
    ctx.fillStyle = '#fff'; ctx.font = `700 19px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x + 32, y + r.h / 2 + 1);
    para(ctx, text, x + 62, y + (r.h - th) / 2, tw, { size, weight: 600, color: T.cardInk, lh: 1.28 });
    y += r.h + g * 0.7;
  });
  const left = pz.deck.filter((st) => !pz.placed.includes(st));
  if (left.length) { y += 6; txt(ctx, 'TAP THE CARD THAT HAPPENS NEXT', x + 4, y + 10, { size: F(18) * Math.min(sc, 1.6), weight: 700, color: T.dim, min: 11, maxW: w }); y += 28 * Math.min(sc, 1.5); }
  left.forEach((st, i) => {
    const text = def.steps[st].t, th = textFit(ctx, text, tw, size), r = R(x, y, w, Math.max(70 * Math.min(sc, 1.5), tapU(), th + 30));
    const shake = pz.shake === st && pz.shakeT > 0 ? Math.sin(pz.shakeT * 50) * 7 * pz.shakeT : 0;
    cardBox(ctx, r, { glow: target && target.step === st ? s.at : 0, dx: shake });
    ctx.save(); ctx.translate(shake, 0);
    appl(ctx, (c) => c.arc(x + 32, y + r.h / 2, 16, 0, 7), '#243a7a', { sh: 1, stitch: '', lw: 1.2 });
    ctx.fillStyle = '#fff'; ctx.font = `700 17px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String.fromCharCode(65 + i), x + 32, y + r.h / 2 + 1);
    para(ctx, text, x + 62, y + (r.h - th) / 2, tw, { size, weight: 600, color: T.cardInk, lh: 1.28 });
    ctx.restore();
    if (!pz.solved) hits.push({ id: 'step', k: st, r: { ...r } });
    y += r.h + g;
  });
  return y;
}
function matchFace(ctx, text, r, ink, sc) {
  if (text.startsWith('pat:')) { pattern(ctx, text.slice(4), r.x + r.w / 2, r.y + r.h / 2 - 8, Math.min(r.h * 0.6, r.w * 0.5), ink); ctx.fillStyle = ink; ctx.font = `600 ${F(18)}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(PATTERNS[text.slice(4)].name, r.x + r.w / 2, r.y + r.h - 18); return; }
  para(ctx, text, r.x + 14, r.y + 14, r.w - 28, { size: F(24) * sc, weight: 600, color: ink, lh: 1.26 });
}
function drawMatch(ctx, s, def, pz, x, y, w, sc, g, target) {
  const T = theme(), size = F(24) * sc, gap = 14, cw = (w - gap) / 2, n = def.pairs.length;
  const cellH = (text, cwid) => (text.startsWith('pat:') ? 120 * Math.min(sc, 1.3) : Math.max(72 * Math.min(sc, 1.4), tapU(), textFit(ctx, text, cwid - 28, size) + 28));
  for (let i = 0; i < n; i++) {
    const pl = pz.L[i], pr = pz.R[i], lt = def.pairs[pl][0], rt = def.pairs[pr][1], hgt = Math.max(cellH(lt, cw), cellH(rt, cw));
    const lr = R(x, y, cw, hgt), rr2 = R(x + cw + gap, y, cw, hgt), lLocked = pz.locked.includes(pl), rLocked = pz.locked.includes(pr);
    const shakeL = pz.wrongL === pl && pz.shakeT > 0 ? Math.sin(pz.shakeT * 50) * 6 * pz.shakeT : 0, shakeR = pz.wrongR === pr && pz.shakeT > 0 ? Math.sin(pz.shakeT * 50) * 6 * pz.shakeT : 0;
    const tgtL = target && (target.pair === pl && target.part !== 'right') ? s.at : 0, tgtR = target && target.pair === pr && (target.part === 'right' || pz.sel === target.pair) ? s.at : 0;
    cardBox(ctx, lr, { fill: lLocked ? CARD_GOOD : pz.sel === pl ? CARD_SEL : T.card, glow: tgtL, dx: shakeL, edge: pz.sel === pl ? GOLD : undefined });
    cardBox(ctx, rr2, { fill: rLocked ? CARD_GOOD : T.card, glow: tgtR, dx: shakeR });
    ctx.save(); ctx.translate(shakeL, 0); matchFace(ctx, lt, lr, T.cardInk, sc); ctx.restore();
    ctx.save(); ctx.translate(shakeR, 0); matchFace(ctx, rt, rr2, T.cardInk, sc); ctx.restore();
    if (lLocked) { ctx.fillStyle = '#2f9d62'; ctx.fillRect(lr.x + lr.w - 2, lr.y + hgt / 2 - 3, gap + 4, 6); }
    if (!pz.solved && !lLocked) hits.push({ id: 'ml', k: pl, r: lr });
    if (!pz.solved && !rLocked) hits.push({ id: 'mr', k: pr, r: rr2 });
    y += hgt + g;
  }
  return y;
}
function drawTrap(ctx, s, def, pz, x, y, w, sc, g, target) {
  const T = theme(), size = F(26) * sc, tw = w - 84;
  // state chips
  let cx = x, cy = y; const cs = Math.max(F(20) * Math.min(sc, 1.5), 11.5 / (host.px || 0.55));
  for (const f of def.goal) {
    setFont(ctx, cs, 700); const lab = def.facts[f], cwid = ctx.measureText(lab).width + cs * 2.5, on = pz.flags.includes(f);
    if (cx + cwid > x + w && cx > x) { cx = x; cy += cs * 2.4; }
    appl(ctx, (c) => c.roundRect(cx, cy, cwid, cs * 2.0, cs), on ? '#f2c14e' : 'rgba(128,128,128,0.2)', { sh: on ? 2 : 0, lw: 1.2, stitch: on ? 'rgba(255,255,255,0.5)' : '', dash: 4, edge: on ? 'rgba(80,50,10,0.5)' : T.line });
    ctx.beginPath(); ctx.arc(cx + cs * 1.0, cy + cs, cs * 0.45, 0, 7); ctx.fillStyle = on ? '#2f9d62' : 'rgba(128,128,128,0.45)'; ctx.fill();
    txt(ctx, lab, cx + cs * 1.7, cy + cs * 1.02, { size: cs, weight: 700, color: on ? '#3a2414' : T.dim, maxW: cwid - cs * 1.7 - 2, min: 11 });
    cx += cwid + 10;
  }
  y = cy + cs * 2.0 + g * 1.4;
  pz.order.forEach((ti) => {
    const t = def.tools[ti], used = pz.used.includes(ti), th = textFit(ctx, t.t, tw, size), r = R(x, y, w, Math.max(72 * Math.min(sc, 1.5), tapU(), th + 30));
    const shake = pz.shake === ti && pz.shakeT > 0 ? Math.sin(pz.shakeT * 50) * 7 * pz.shakeT : 0;
    cardBox(ctx, r, { fill: used ? CARD_GOOD : T.card, glow: target && target.tool === ti ? s.at : 0, dx: shake, lift: used && pz.flashT > 0 && pz.used[pz.used.length - 1] === ti ? pz.flashT * 8 : 0 });
    ctx.save(); ctx.translate(shake, 0);
    appl(ctx, (c) => c.arc(x + 32, y + r.h / 2, 16, 0, 7), used ? '#2f9d62' : '#8a5a2a', { sh: 1, stitch: '', lw: 1.2 });
    ctx.fillStyle = '#fff'; ctx.font = `700 17px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(used ? String(pz.used.indexOf(ti) + 1) : '⚒', x + 32, y + r.h / 2 + 1);
    para(ctx, t.t, x + 62, y + (r.h - th) / 2, tw, { size, weight: 600, color: used ? 'rgba(58,36,20,0.7)' : T.cardInk, lh: 1.28 });
    ctx.restore();
    if (!used && !pz.solved) hits.push({ id: 'tool', k: ti, r: { ...r } });
    y += r.h + g;
  });
  return y;
}

// ================================================================ title ==================================================================
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h, !!s.saved), hero = L.hero; setBrandTone(T.dark);
  const H = hero.h, tb = Math.min(190, Math.max(86, H * 0.3));
  const st = R(hero.x, hero.y, hero.w, Math.max(120, H - tb - 6));
  const idx = Math.floor(s.t / 8) % TALES.length, tale = TALES[idx];
  drawStage(ctx, st, tale.scene, tale.beats[Math.floor((s.t / 4) % 4)].cast, s.at, { speak: 0.8, motif: tale.motif, bg0: T.bg0, bg1: T.bg1, px: s.calm ? 0 : s.px, look: s.look, pose: 'idle', beat: s.beatPulse > 0 ? s.beatPulse : 0 });
  const ty = st.y + st.h + tb * 0.42;
  txt(ctx, 'ANANSI TALES', hero.x + hero.w / 2, ty, { size: tb * 0.5, weight: 700, color: T.text, align: 'center', maxW: hero.w * 0.96, min: 24, font: DISPLAY });
  txt(ctx, 'FIVE SPIDER TALES FROM GHANA', hero.x + hero.w / 2, ty + tb * 0.4, { size: tb * 0.17, weight: 600, color: T.accent, align: 'center', maxW: hero.w * 0.92, min: 12, font: UI });
  const B = L.buttons, lab = {
    continue: ['Continue', s.saved ? `${TALES[s.saved.tale].title}  ·  beat ${s.saved.beat + 1}` : ''],
    tales: ['Begin a Tale', 'Five tales of wit'], gallery: ['Gallery', ''], learn: ['Watch and Learn', ''], howto: ['How to Play', ''], rules: ['Rules', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear', gallery: 'book' };
  for (const id of Object.keys(B)) {
    const prim = id === 'continue' || id === 'tales', r = B[id];
    button(ctx, r, lab[id][0], { kind: id === 'tales' || id === 'continue' ? 'accent' : 'solid', size: prim ? 34 : 24, sub: prim ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: prim ? '' : (iconOf[id] ?? '') });
  }
  drawCredit(ctx, L.brand.x, L.brand.y, Math.min(16, Math.max(12.5, 13.5 / (host.px || 0.55) * 0.5 + 6)), { dim: 0.95 });
}

// ================================================================ tales list / gallery ===============================================================
export const demoLocked = (s, i) => s.demo && i > 0;
function drawTales(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), NL = talesLayout(w, h, TALES.length, sc);
  header(ctx, s, NL, 'Begin a Tale');
  scrollBody(ctx, s, NL.body, () => {
    TALES.forEach((tale, i) => {
      const r = NL.cards[i], st = s.stats.tales[i] ?? { done: 0, stars: 0 };
      panel(ctx, r, { radius: 22, fill: rgba(tale.tint, T.dark ? 0.14 : 0.12), line: i === s.prefs.next ? T.accent : T.line });
      const th = r.h - 28, cr = R(r.x + 14, r.y + 14, Math.min(th * 0.82, r.w * 0.28), th);
      drawCloth(ctx, cr, i, s.at, { locked: demoLocked(s, i) });
      const tx = cr.x + cr.w + 18, tw = r.x + r.w - tx - 16;
      txt(ctx, tale.title, tx, r.y + 36, { size: F(34) * Math.min(sc, 1.5), weight: 700, color: T.text, maxW: tw, min: 16, font: DISPLAY });
      txt(ctx, tale.sub, tx, r.y + 36 + 32 * Math.min(sc, 1.5), { size: F(21) * Math.min(sc, 1.5), weight: 600, color: T.accent, maxW: tw, min: 12 });
      const mix = tale.beats.map((b) => b.puzzle.label).join('  ·  ');
      const ph = para(ctx, mix, tx, r.y + 36 + 62 * Math.min(sc, 1.5), tw, { size: F(20) * Math.min(sc, 1.5), weight: 400, color: T.dim, lh: 1.2 });
      const sy = r.y + r.h - 34;
      for (let k = 0; k < 3; k++) icons.star(ctx, tx + 18 + k * 34, sy, 28, k < st.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
      txt(ctx, demoLocked(s, i) ? 'Full game' : st.done ? `told ${st.done} time${st.done === 1 ? '' : 's'}` : i === 0 ? 'Start here' : 'not yet told', r.x + r.w - 20, sy, { size: F(20) * Math.min(sc, 1.5), weight: 600, color: T.dim, align: 'right', maxW: tw * 0.6, min: 11 });
      void ph;
      hits.push({ id: 'tale', k: i, r: { ...r } });
    });
    return NL.contentH;
  });
  button(ctx, NL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}
function drawGallery(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), GL = galleryLayout(w, h, TALES.length);
  header(ctx, s, GL, 'Gallery of Stories');
  scrollBody(ctx, s, GL.body, () => {
    TALES.forEach((tale, i) => {
      const r = GL.cards[i], st = s.stats.tales[i] ?? { done: 0, stars: 0 }, locked = !st.done;
      const cr = R(r.x, r.y, r.w, r.h - 56);
      drawCloth(ctx, cr, i, s.at, { locked });
      txt(ctx, tale.title, r.x + r.w / 2, r.y + r.h - 40, { size: F(24) * Math.min(sc, 1.4), weight: 700, color: T.text, align: 'center', maxW: r.w, min: 13, font: DISPLAY });
      if (locked) txt(ctx, 'Not yet told', r.x + r.w / 2, r.y + r.h - 12, { size: F(19), weight: 500, color: T.dim, align: 'center', maxW: r.w, min: 11 });
      else for (let k = 0; k < 3; k++) icons.star(ctx, r.x + r.w / 2 + (k - 1) * 30, r.y + r.h - 14, 26, k < st.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
      if (!locked) hits.push({ id: 'story', k: i, r: { ...r } });
    });
    const y = GL.cards[GL.cards.length - 1].y + GL.cards[0].h + 30;
    const note = 'The patterns on these cloths are inspired by Adinkra symbols of the Akan people, used here only as decoration. Tap a finished cloth to hear the tale told again.';
    const hh = para(ctx, note, GL.body.x + 4, y, GL.body.w - 8, { size: F(22) * sc, weight: 400, color: T.dim, align: 'center', lh: 1.3 });
    return y - GL.body.y + hh + 20;
  });
  button(ctx, GL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ docs ===================================================================
export function docOf(s) {
  if (s.doc.kind === 'story') {
    const t = TALES[s.doc.tale];
    return { title: t.title, pages: [{ title: 'The tale, told again', fig: `cloth:${s.doc.tale}`, body: [{ p: t.retold }, { h: 'The moral' }, { p: t.moral }, { p: `Pattern on this cloth: ${PATTERNS[t.motif].name}, ${PATTERNS[t.motif].say.toLowerCase()}. Inspired by Adinkra symbols of the Akan people and used here only as decoration.` }] }] };
  }
  return DOCS[s.doc.kind];
}
function drawDoc(ctx, s, w, h) {
  const T = theme(), doc = docOf(s), page = doc.pages[Math.min(s.doc.page, doc.pages.length - 1)], DL = docLayout(w, h), sc = scaleOf(s);
  header(ctx, s, DL, doc.title);
  const n = doc.pages.length;
  button(ctx, DL.menu, 'Menu', { icon: 'back', size: 26, flash: flashOf(s, 'back') });
  button(ctx, DL.prev, 'Prev', { size: 26, disabled: s.doc.page === 0, flash: flashOf(s, 'prev') });
  button(ctx, DL.next, 'Next', { size: 26, kind: s.doc.page < n - 1 ? 'accent' : 'solid', disabled: s.doc.page >= n - 1, flash: flashOf(s, 'next') });
  txt(ctx, `${s.doc.page + 1} / ${n}`, DL.count.x + DL.count.w / 2, DL.count.y + DL.count.h / 2, { size: F(26), weight: 600, color: T.dim, align: 'center' });
  const textR = DL.text, figR = DL.fig;
  const fig = (r) => { if (page.fig?.startsWith('cloth:')) drawCloth(ctx, r, +page.fig.slice(6), s.at, {}); else drawFigure(ctx, r, page.fig, s.at, T); };
  const drawText = (top, width, x) => {
    let y = top;
    txt(ctx, page.title, x, y + 26 * sc, { size: F(38) * sc, weight: 700, color: T.accent, maxW: width, min: 16, font: DISPLAY }); y += 26 * sc + 30 * sc;
    for (const b of page.body) {
      if (b.p) { y += para(ctx, b.p, x, y, width, { size: F(28) * sc, weight: 400, color: T.text, lh: 1.34 }) + 14 * sc; }
      else if (b.h) { y += para(ctx, b.h, x, y, width, { size: F(32) * sc, weight: 700, color: T.text }) + 8 * sc; }
      else if (b.li) for (const it of b.li) {
        const sz = F(27) * sc;
        ctx.beginPath(); ctx.arc(x + 8 * sc, y + sz * 0.62, 5 * sc, 0, 7); ctx.fillStyle = T.accent; ctx.fill();
        y += para(ctx, it, x + 28 * sc, y, width - 28 * sc, { size: sz, weight: 400, color: T.text, lh: 1.3 }) + 10 * sc;
      }
    }
    return y - top + 20;
  };
  if (DL.split) {
    if (page.fig) fig(figR);
    scrollBody(ctx, s, textR, () => drawText(textR.y, textR.w - 10, textR.x));
  } else {
    scrollBody(ctx, s, textR, () => {
      let y = textR.y;
      if (page.fig) {
        const fh = Math.min(textR.w, Math.max(260, textR.h * (sc > 1.6 ? 0.4 : 0.52)), 560), fr = R(textR.x + (textR.w - Math.min(textR.w, fh + 120)) / 2, y, Math.min(textR.w, fh + 120), fh);
        fig(fr); y += fr.h + 14;
      }
      return y - textR.y + drawText(y, textR.w - 10, textR.x);
    });
  }
}

// ================================================================ settings ===============================================================
function drawSettings(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), SL = settingsLayout(w, h, sc, SETTINGS.length);
  header(ctx, s, SL, 'Settings');
  scrollBody(ctx, s, SL.body, () => {
    SETTINGS.forEach((row, i) => {
      const g = SL.rows[i];
      panel(ctx, g.rect, { radius: 20 });
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + g.rect.h / 2, { size: F(28) * Math.min(sc, 1.5), weight: 600, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      const n = row.opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      row.opts.forEach((o, k) => button(ctx, seg[k], o, { size: 24, active: k === cur, radius: 14, kind: row.id === 'restore' ? 'accent' : 'solid', flash: flashOf(s, 'set' + i + '.' + k) }));
    });
    return SL.contentH;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ result =================================================================
function drawOver(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), sc = scaleOf(s), O = overLayout(w, h, sc), R0 = s.result;
  if (!R0 || !s.P) return;
  const tale = TALES[R0.tale];
  drawCloth(ctx, O.cloth, R0.tale, s.at, { glow: Math.max(0, 1 - s.sceneT / 1.2) });
  const body = O.body;
  scrollBody(ctx, s, body, () => {
    let y = body.y + 4;
    const compact = O.wide, tsz = compact ? 38 : 48;
    txt(ctx, 'The tale is told', body.x + body.w / 2, y + tsz * 0.55, { size: F(tsz) * Math.min(sc, 1.5), weight: 700, color: T.text, align: 'center', maxW: body.w, min: 22, font: DISPLAY }); y += (tsz + 8) * Math.min(sc, 1.5);
    txt(ctx, tale.title, body.x + body.w / 2, y + 12, { size: F(24) * Math.min(sc, 1.5), weight: 600, color: T.accent, align: 'center', maxW: body.w, min: 13 }); y += 40 * Math.min(sc, 1.5);
    const sz = compact ? 36 : 50;
    for (let k = 0; k < 3; k++) icons.star(ctx, body.x + body.w / 2 + (k - 1) * (sz + 10), y + sz / 2, sz, k < R0.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
    y += sz + (compact ? 8 : 14);
    const facts = [['Wrong picks', R0.misses], ['Hints', R0.hints], ['Time', fmtTime(R0.time)]];
    const cols = body.w > 300 ? 3 : 2, fw = (body.w - 8 * (cols - 1)) / cols, fh = (compact ? 66 : 80) * Math.min(sc, 1.7);
    facts.forEach(([l, v], i) => {
      const r = R(body.x + (i % cols) * (fw + 8), y + Math.floor(i / cols) * (fh + 8), fw, fh);
      panel(ctx, r, { radius: 14 });
      txt(ctx, v, r.x + r.w / 2, r.y + fh * 0.4, { size: F(compact ? 28 : 34) * Math.min(sc, 1.6), weight: 700, color: T.text, align: 'center', maxW: fw - 8, min: 14 });
      txt(ctx, l, r.x + r.w / 2, r.y + fh * 0.78, { size: F(18) * Math.min(sc, 1.6), weight: 400, color: T.dim, align: 'center', maxW: fw - 6, min: 11 });
    });
    y += Math.ceil(facts.length / cols) * (fh + 8) + 6;
    if (R0.newBest) { txt(ctx, 'New best for this tale', body.x + body.w / 2, y + 14, { size: F(26) * sc, weight: 600, color: T.good, align: 'center', maxW: body.w, min: 12 }); y += 40 * sc; }
    y += para(ctx, tale.moral, body.x, y, body.w, { size: F(24) * sc, weight: 500, color: T.dim, align: 'center', lh: 1.3 }) + 8;
    y += para(ctx, 'A new cloth hangs in your Gallery.', body.x, y, body.w, { size: F(24) * sc, weight: 600, color: T.accent, align: 'center' }) + 8;
    return y - body.y + 10;
  });
  button(ctx, O.btns.next, R0.tale + 1 < TALES.length ? 'Next tale' : 'Tell it again', { kind: 'accent', size: 32, flash: flashOf(s, 'next') });
  button(ctx, O.btns.share, 'Share', { size: 28, flash: flashOf(s, 'share') });
  button(ctx, O.btns.menu, 'Menu', { size: 28, flash: flashOf(s, 'menu') });
  drawMoreLine(ctx, O.more.x, O.more.y, 15);
}
function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, { radius: 28 }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the free preview', c.x + c.w / 2, c.y + 70, { size: F(40), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 18, font: DISPLAY });
  para(ctx, 'The full game has all five tales, the Gallery of woven story-cloths, hints and Watch and Learn. Get Anansi Tales on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(28), weight: 400, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
export { smooth };
