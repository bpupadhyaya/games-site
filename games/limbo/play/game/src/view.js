// Drawing for every screen. render() is the single entry point; the scene lives in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, LOOKS, drawStars, clamp, clamp01 } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay, drawWorld, MODE_NAME } from './playview.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { TUNE, roundLabel, barHeight } from './engine.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';

function titleText(ctx, cx, y, size, label, maxW) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let s = size; ctx.font = `400 ${s}px ${DISPLAY}`;
  const m = ctx.measureText(label).width; if (maxW && m > maxW) { s = size * maxW / m; ctx.font = `400 ${s}px ${DISPLAY}`; }
  ctx.lineJoin = 'round';
  // soft glow and cast shadow on the scene
  ctx.shadowColor = 'rgba(255,120,40,0.55)'; ctx.shadowBlur = s * 0.3; ctx.fillStyle = '#2a0b3a'; ctx.fillText(label, cx, y + s * 0.05);
  ctx.shadowBlur = 0;
  // extrusion: the lettering stands off the picture like carved, gilded wood
  const depth = Math.max(4, Math.round(s * 0.085));
  for (let i = depth; i >= 1; i--) {
    ctx.lineWidth = s * 0.16; ctx.strokeStyle = i > depth * 0.5 ? '#3a0d2a' : '#5a1418';
    ctx.strokeText(label, cx, y + i * 0.9); ctx.fillStyle = i > depth * 0.5 ? '#6a1a24' : '#a8341c'; ctx.fillText(label, cx, y + i * 0.9);
  }
  ctx.lineWidth = s * 0.15; ctx.strokeStyle = '#2a0b3a'; ctx.strokeText(label, cx, y);
  const g = ctx.createLinearGradient(0, y - s * 0.5, 0, y + s * 0.5);
  g.addColorStop(0, '#fffbe0'); g.addColorStop(0.3, '#ffe27a'); g.addColorStop(0.58, '#ffa63d'); g.addColorStop(0.82, '#ff6a3a'); g.addColorStop(1, '#d92f5a');
  ctx.fillStyle = g; ctx.fillText(label, cx, y);
  // bevel: bright upper-left rim, darker lower edge
  ctx.lineWidth = Math.max(1.5, s * 0.022); ctx.strokeStyle = 'rgba(255,252,225,0.85)'; ctx.strokeText(label, cx - 0.6, y - 0.8);
  const hl = ctx.createLinearGradient(0, y - s * 0.5, 0, y + s * 0.1);
  hl.addColorStop(0, 'rgba(255,255,255,0.65)'); hl.addColorStop(0.55, 'rgba(255,255,255,0.06)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillText(label, cx, y);
  ctx.restore();
}

// The hero scene on the title: a dancer doing the limbo forever, lowering the bar a notch each time.
export function heroScene(T, L) {
  const H = T.hero, U = Math.max(110, Math.min(H.w / 2.15, H.h * 0.78));
  const gy = Math.round(H.y + H.h * 0.86);
  const bx = Math.min(H.x + H.w - 0.45 * U - 20, H.x + H.w / 2 + 0.52 * U);
  return { w: L.w, h: L.h, hor: Math.round(clamp(gy - U * 0.72, L.S.y + 40, gy - 20)), gy, U, bx };
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const { w, h } = L, sc = st.scene;
  meta.previewBadge = null;
  // the canvas is transparent when the 3D presenter paints behind it: wipe last frame's 2D layer
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, pauseItems); return; }
  // backdrop: the beach in every non-play screen (title shows the live hero)
  const hs = heroScene(L.title, L);
  const hero = st.hero;
  const pl = { att: hero.att, barShown: hero.bar, look: hero.look, barFall: hero.fall, barGlow: 0, parts: [] };
  if (view && view.gl3d) { /* the 3D presenter paints the beach behind this transparent layer */ }
  else if (view && view.gl3dPending) { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b0d36'); g.addColorStop(0.5, '#a23a68'); g.addColorStop(1, '#2a1030'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  else drawWorld(ctx, st, hs, L.S.y + 8, { pl, beat: st.t * 104 / 60 });
  if (sc !== 'title' && sc !== 'result') { ctx.fillStyle = 'rgba(10,2,24,0.62)'; ctx.fillRect(0, 0, w, h); }
  else if (sc === 'result') { ctx.fillStyle = 'rgba(10,2,24,0.45)'; ctx.fillRect(0, 0, w, h); }
  if (sc === 'title') renderTitle(ctx, st, L);
  else if (sc === 'setup') renderSetup(ctx, st, L);
  else if (sc === 'result') renderResult(ctx, st, L);
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: 'About', blocks: ABOUT });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
  else if (sc === 'rules') { const p = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `${st.rulesPage + 1}/${RULES.length}  ${p.title}`, blocks: p.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  if (st.toast) {
    const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(14,4,30,0.92)', stroke: 'rgba(255,216,115,0.5)' });
    ctx.restore();
  }
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound and music', 'toggle', () => p.sound),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Less camera shake, crowd bounce and sparks'),
    row('assist', 'Balance assist', 'toggle', () => p.assist, 'The balance drifts a little more gently'),
    row('think', 'Think time (s)', 'stepper', () => p.thinkSec, 'Watch and Learn thinking time'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [row('restore', 'Restore purchase', 'button', () => '', () => st.restoreMsg || (st.owned ? 'Full game unlocked. Thank you!' : 'Already bought Limbo? Get it back'),
      { btn: () => (st.owned ? 'Unlocked' : st.restoreBusy ? 'Checking...' : 'Restore'), disabled: () => st.owned || st.restoreBusy })]),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L) {
  const T = L.title, S = L.S, wide = L.mode === 'wide';
  const tcx = wide ? T.hero.x + T.hero.w / 2 : S.x + S.w / 2, size = T.size, maxW = (wide ? T.col.x - S.x : S.w) - 40;
  titleText(ctx, tcx, T.titleY, size, 'LIMBO', maxW);
  chip(ctx, tcx, T.titleY + size * 0.66, 'HOW LOW CAN YOU GO?', Math.max(18, Math.min(size * 0.15, maxW / 17)), { align: 'center', color: PAL.goldHi, weight: 800 });
  txt(ctx, 'A beach game from Trinidad and Tobago', tcx, T.titleY + size * 0.66 + Math.max(40, size * 0.28), Math.max(20, size * 0.12), PAL.text, { align: 'center', weight: 700, stroke: 6, strokeColor: 'rgba(30,8,10,0.85)', maxW });
  panel(ctx, { x: T.col.x - 12, y: T.col.y - 12, w: T.col.w + 24, h: T.col.h + 24 }, { fill: 'rgba(14,4,32,0.62)', rad: 30 }); edgeStroke(ctx, { x: T.col.x - 12, y: T.col.y - 12, w: T.col.w + 24, h: T.col.h + 24 }, 30, 0.35);
  button(ctx, T.play, 'Play', { kind: 'primary', size: 44, icon: 'play' });
  button(ctx, T.party, 'Party', { kind: 'quiet', size: 30, sub: '2 to 4 friends' });
  button(ctx, T.prac, 'Practice', { kind: 'quiet', size: 30, icon: 'restart' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'ghost', size: 30, icon: 'eye' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  const lw = Math.min(300, S.w * 0.55), lh = lw * 354 / 1296;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lh + 8, w: lw, h: lh })) drawCredit(ctx, T.credit.x, T.credit.y, 12);
  if (st.best.round >= 0 || st.best.score > 0) txt(ctx, `Best  ${st.best.score}  ·  lowest bar ${st.best.round >= 0 ? roundLabel(st.best.round) : '-'}`, T.col.x + T.col.w / 2, T.col.y - 30, 22, PAL.goldHi, { align: 'center', weight: 700, stroke: 5, maxW: T.col.w });
}

// ---- setup (practice / party) -------------------------------------------------------------------------------------------------------------------
function renderSetup(ctx, st, L) {
  const U = L.setup, S = L.S, s = st.setup, kind = st.setupKind;
  button(ctx, U.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, kind === 'party' ? 'Party' : 'Practice', S.x + S.w / 2, U.back.y + U.back.h / 2, 46, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 7, maxW: S.w - 2 * (U.back.w + 30) });
  panel(ctx, U.panel, { fill: 'rgba(16,6,36,0.88)' }); edgeStroke(ctx, U.panel, 24, 0.3);
  const p = U.panel;
  ctx.font = `500 26px ${UI}`;
  const blurb = kind === 'party' ? 'Pass the phone around. Everyone still in takes a turn at each bar; touch the bar or topple and you are out.' : 'No tries to count. Choose the bar height and keep going until you can slide under it every time.';
  wrap(ctx, blurb, p.w - 56).forEach((ln, i) => txt(ctx, ln, p.x + 28, p.y + 34 + i * 34, 26, PAL.text, { weight: 500 }));
  const row = (r, label, val, dec, inc, canDec, canInc) => {
    ctx.fillStyle = 'rgba(255,240,220,0.07)'; rrect(ctx, r, 18); ctx.fill();
    txt(ctx, label, r.x + 20, r.y + r.h / 2, 30, PAL.text, { weight: 700, maxW: r.w * 0.34 });
    button(ctx, dec, '-', { kind: canDec ? 'quiet' : 'disabled', size: 38, noShadow: true });
    button(ctx, inc, '+', { kind: canInc ? 'quiet' : 'disabled', size: 38, noShadow: true });
    txt(ctx, val, (dec.x + dec.w + inc.x) / 2, r.y + r.h / 2, 32, PAL.gold, { align: 'center', weight: 800, maxW: inc.x - dec.x - dec.w - 8 });
  };
  if (kind === 'party') {
    row(U.row1, 'Players', String(s.players), U.aDec, U.aInc, s.players > 2, s.players < 4);
    row(U.row2, 'Start bar', roundLabel(s.startRound), U.bDec, U.bInc, s.startRound > 0, s.startRound < 6);
  } else {
    row(U.row1, 'Bar height', roundLabel(s.practiceRound), U.aDec, U.aInc, s.practiceRound > 0, s.practiceRound < TUNE.bars.length - 1);
  }
  button(ctx, U.start, 'Start', { kind: 'primary', size: 38, icon: 'play' });
}

// ---- result --------------------------------------------------------------------------------------------------------------------------------------------
const commas = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function renderResult(ctx, st, L) {
  const r = st.result, Rr = L.result, p = Rr.panel, wide = L.mode === 'wide' || p.h < 900;
  panel(ctx, p, { fill: 'rgba(16,6,36,0.92)' }); edgeStroke(ctx, p, 28, 0.55);
  const head = r.mode === 'auto' ? 'LESSON COMPLETE' : r.mode === 'party' ? 'PARTY RESULT' : r.mode === 'practice' ? 'PRACTICE' : 'GAME OVER';
  txt(ctx, head, p.x + p.w / 2, p.y + 44, 22, PAL.dim, { align: 'center', weight: 800 });
  if (r.mode === 'party') {
    txt(ctx, r.winners.length > 1 ? 'SHARED WIN' : 'WINNER', p.x + p.w / 2, p.y + 110, 24, PAL.gold, { align: 'center', weight: 800 });
    const names = r.winners.map((i) => r.players[i].name).join(' and ');
    txt(ctx, names, p.x + p.w / 2, p.y + 190, 62, PAL.text, { align: 'center', font: DISPLAY, weight: 400, stroke: 8, maxW: p.w - 60 });
    txt(ctx, `lowest bar cleared: ${r.bestRound >= 0 ? roundLabel(r.bestRound) : 'none'}`, p.x + p.w / 2, p.y + 250, 26, PAL.dim, { align: 'center', weight: 700, maxW: p.w - 60 });
    r.players.forEach((q, i) => {
      const y = p.y + 320 + i * 64, look = LOOKS[q.look % LOOKS.length], win = r.winners.includes(i);
      ctx.fillStyle = win ? 'rgba(255,216,115,0.16)' : 'rgba(255,240,220,0.06)'; rrect(ctx, { x: p.x + 32, y: y - 26, w: p.w - 64, h: 54 }, 14); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + 66, y + 1, 16, 0, Math.PI * 2); ctx.fillStyle = look.top; ctx.fill();
      txt(ctx, q.name, p.x + 96, y + 1, 28, PAL.text, { weight: 700, maxW: p.w * 0.4 });
      txt(ctx, q.bestRound >= 0 ? `${roundLabel(q.bestRound)}  ·  ${q.clears} cleared` : 'no clear', p.x + p.w - 50, y + 1, 24, win ? PAL.gold : PAL.dim, { align: 'right', weight: 700, maxW: p.w * 0.42 });
    });
  } else {
    const stars = r.bestRound >= 8 ? 3 : r.bestRound >= 5 ? 2 : r.bestRound >= 2 ? 1 : 0;
    const lx = wide ? p.x + p.w * 0.25 : p.x + p.w / 2, rx0 = wide ? p.x + p.w * 0.48 : p.x + 32, rw = wide ? p.w * 0.5 - 28 : p.w - 64;
    let y = p.y + (wide ? 120 : 130);
    if (r.mode !== 'practice') {
      txt(ctx, 'SCORE', lx, y, 22, PAL.gold, { align: 'center', weight: 800 });
      txt(ctx, commas(r.score), lx, y + 66, wide ? 76 : 96, PAL.text, { align: 'center', font: DISPLAY, weight: 400, stroke: 8, maxW: wide ? p.w * 0.4 : p.w - 60 });
    } else {
      txt(ctx, 'LOWEST BAR', lx, y, 22, PAL.gold, { align: 'center', weight: 800 });
      txt(ctx, r.bestRound >= 0 ? roundLabel(r.bestRound) : '-', lx, y + 66, wide ? 76 : 96, PAL.text, { align: 'center', font: DISPLAY, weight: 400, stroke: 8 });
    }
    y += wide ? 150 : 170;
    if (r.mode === 'solo') drawStars(ctx, lx, y + 10, wide ? 38 : 46, stars, 3, 1.3);
    if (r.newBest) chip(ctx, lx, y + (wide ? 76 : 96), 'NEW BEST', 24, { align: 'center', fill: '#e2483d', color: '#fff' });
    else if (r.mode === 'solo') txt(ctx, `Best ${st.best.score}`, lx, y + (wide ? 76 : 96), 26, PAL.dim, { align: 'center', weight: 700 });
    let ry = wide ? p.y + 120 : y + (wide ? 100 : 150);
    const tile = (x, yy, ww, label, val) => { ctx.fillStyle = 'rgba(255,240,220,0.07)'; rrect(ctx, { x, y: yy, w: ww, h: 108 }, 16); ctx.fill(); txt(ctx, label, x + ww / 2, yy + 28, 18, PAL.gold, { align: 'center', weight: 800, maxW: ww - 8 }); txt(ctx, val, x + ww / 2, yy + 74, 38, PAL.text, { align: 'center', font: DISPLAY, weight: 400, maxW: ww - 12 }); };
    const g = 10, tw = (rw - g * 2) / 3;
    tile(rx0, ry, tw, 'LOWEST BAR', r.bestRound >= 0 ? roundLabel(r.bestRound) : '-'); tile(rx0 + tw + g, ry, tw, 'CLEARED', String(r.clears)); tile(rx0 + (tw + g) * 2, ry, tw, r.mode === 'solo' ? 'MISSES' : 'ATTEMPTS', String(r.mode === 'solo' ? r.misses : r.attempts));
    ry += 130;
    if (r.mode === 'solo' || r.mode === 'auto') txt(ctx, `${r.narrow} narrow squeaks  ·  best balance ${Math.round(r.bestBalance * 100)}%`, rx0 + rw / 2, ry + 10, 24, PAL.dim, { align: 'center', weight: 600, maxW: rw });
  }
  button(ctx, Rr.again, r.mode === 'auto' ? 'Watch again' : r.mode === 'practice' ? 'Practice again' : 'Play again', { kind: 'primary', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, r = { x: S.x + S.w / 2 - Math.min(S.w - 40, 560) / 2, y: S.y + S.h / 2 - 220, w: Math.min(S.w - 40, 560), h: 440 };
  panel(ctx, r, { fill: 'rgba(16,6,36,0.94)' }); edgeStroke(ctx, r, 24, 0.6);
  txt(ctx, 'That is the preview', r.x + r.w / 2, r.y + 80, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 7, maxW: r.w - 40 });
  ctx.font = `500 28px ${UI}`;
  wrap(ctx, 'Get the full Limbo on iPhone and Android: twelve bars and beyond, Party mode for up to four, Practice and Watch and Learn.', r.w - 70).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 170 + i * 40, 28, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 40, 24, PAL.dim, { align: 'center', weight: 600 });
}
