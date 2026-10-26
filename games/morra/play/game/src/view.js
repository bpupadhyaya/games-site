// Drawing for every screen. render() is the single entry point; the playing screen lives in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, TAU, drawTable, drawGlow, drawHand, extFor, drawRail } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay, handGeom, rivalHand, youHand } from './playview.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { RIVALS, TARGETS, THINK_TIMES, WORDS, THROWS } from './engine.js';
import { SKIN_NAMES } from './art.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function titleLine(ctx, cx, y, size, label, maxW) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${size}px ${DISPLAY}`;
  const wmax = ctx.measureText(label).width, s = wmax > maxW ? size * maxW / wmax : size;
  ctx.font = `${s}px ${DISPLAY}`;
  const g = ctx.createLinearGradient(0, y - s * 0.5, 0, y + s * 0.5);
  g.addColorStop(0, '#fff2c8'); g.addColorStop(0.5, '#ffc83d'); g.addColorStop(1, '#d9532e');
  ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.16; ctx.strokeStyle = '#1c0a14'; ctx.strokeText(label, cx, y);
  // carved depth: a stack of darker copies down and to the right
  const depth = Math.max(3, Math.round(s * 0.09));
  for (let i = depth; i >= 1; i--) { ctx.fillStyle = i > depth * 0.5 ? '#3a1c06' : '#7a4510'; ctx.fillText(label, cx + i * 0.55, y + i * 0.95); }
  ctx.shadowColor = 'rgba(255,150,60,0.55)'; ctx.shadowBlur = s * 0.25; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
  return s;
}

// The attract animation: two hands pump three times and open on a new pair of throws, over and over.
const HERO_A = [3, 5, 2, 4, 1, 0, 5, 2], HERO_B = [2, 4, 5, 1, 3, 5, 0, 4];
function hero(ctx, st, area) {
  const G = handGeom(area), s = G.s, T = 4.4, n = Math.floor(st.t / T), u = st.t - n * T;
  const a = HERO_A[n % HERO_A.length], b = HERO_B[n % HERO_B.length];
  const pumping = u < 1.5, k = clamp((u - 1.6) / 0.5, 0, 1);
  const bob = pumping ? (1 - Math.cos(((u / 0.5) % 1) * TAU)) / 2 * 0.24 * s : (1 - k) * 0.1 * s;
  ctx.save(); ctx.beginPath(); ctx.rect(area.x, area.y, area.w, area.h); ctx.clip();
  drawGlow(ctx, G.cx, (G.tipR + G.tipY) / 2, Math.min(area.w, area.h) * 0.8, 0.22);
  drawHand(ctx, G.cx, G.wrR + bob, s, { ...rivalHand(RIVALS[(n + 1) % RIVALS.length]), ext: pumping ? [0, 0, 0, 0, 0] : extFor(a, k), rot: Math.PI });
  drawHand(ctx, G.cx, G.wrY - bob, s, { ...youHand(st.prefs), ext: pumping ? [0, 0, 0, 0, 0] : extFor(b, k) });
  ctx.restore();
  if (!pumping && u < 3.6) {
    const mid = (G.tipR + G.tipY) / 2, big = clamp(s * 0.5, 34, 90);
    ctx.save(); ctx.globalAlpha = clamp((u - 1.7) / 0.2, 0, 1) * clamp((3.6 - u) / 0.3, 0, 1);
    txt(ctx, `${a + b}!`, G.cx, mid, big, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: big * 0.16 });
    ctx.restore();
  } else if (pumping) {
    const beat = Math.min(2, Math.floor(u / 0.5)), mid = (G.tipR + G.tipY) / 2, big = clamp(s * 0.4, 30, 70);
    txt(ctx, ['Uno', 'Due', 'Tre'][beat], G.cx, mid, big, '#fff1c8', { align: 'center', font: DISPLAY, weight: 400, stroke: big * 0.16 });
  }
}

export function render(ctx, st, L, view, meta, helpers) {
  const { w, h } = L, sc = st.scene;
  if (sc === 'play') { renderPlay(ctx, st, L, view, meta, helpers); drawToast(ctx, st, L); return; }
  meta.previewBadge = null;
  drawTable(ctx, w + 20, h + 20);
  if (sc === 'title') renderTitle(ctx, st, L);
  else if (sc === 'rivals') renderRivals(ctx, st, L);
  else if (sc === 'result') renderResult(ctx, st, L);
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: 'About', blocks: ABOUT });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
  else if (sc === 'rules') { const p = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `${st.rulesPage + 1}/${RULES.length}  ${p.title}`, blocks: p.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  drawToast(ctx, st, L);
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(22,10,28,0.94)', stroke: 'rgba(255,230,200,0.4)', maxW: L.S.w - 40 });
  ctx.restore();
}

export const TARGET_LABEL = (i) => `${TARGETS[i]} points`;
function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('words', 'Italian number words', 'toggle', () => p.words, 'Show uno, due, tre next to the digits'),
    row('target', 'Duel length', 'cycle', () => TARGET_LABEL(p.targetIdx), 'First to this many points wins'),
    row('think', 'Think time', 'cycle', () => `${THINK_TIMES[p.thinkIdx]} s`, 'In Watch and Learn, before each throw'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Fewer sparks and no screen shake'),
    row('hand', 'Your hand', 'cycle', () => SKIN_NAMES[p.hand ?? 0], 'The colour of your hand on the table'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [row('restore', 'Restore purchase', 'button', () => '',
      () => st.restoreMsg || (st.owned ? 'Thank you for playing' : 'Bought it before?'),
      { btn: () => (st.owned ? 'Unlocked' : st.restoreBusy ? 'Checking' : 'Restore'), disabled: () => st.owned || st.restoreBusy })]),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// A carved wooden plaque with a bevel, an inset groove and brass studs, behind the title.
function plaque(ctx, r) {
  const rad = Math.min(26, r.h * 0.2);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, '#7a4a24'); g.addColorStop(0.45, '#58321a'); g.addColorStop(1, '#2e180c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.clip();
  ctx.strokeStyle = 'rgba(20,8,2,0.28)'; ctx.lineWidth = 1.5;
  for (let y = r.y + 5; y < r.y + r.h; y += 7) { ctx.beginPath(); ctx.moveTo(r.x, y); ctx.bezierCurveTo(r.x + r.w * 0.3, y + 4, r.x + r.w * 0.6, y - 4, r.x + r.w, y + 2); ctx.stroke(); }
  const gl = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.5); gl.addColorStop(0, 'rgba(255,220,160,0.22)'); gl.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.fillStyle = gl; ctx.fillRect(r.x, r.y, r.w, r.h * 0.5);
  ctx.restore();
  // bevel: lit top-left edge, dark bottom-right
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,214,150,0.65)'; ctx.beginPath(); ctx.roundRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, rad); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.moveTo(r.x + rad, r.y + r.h - 1.5); ctx.lineTo(r.x + r.w - rad, r.y + r.h - 1.5); ctx.stroke();
  // inset groove
  const m = 10;
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(15,6,2,0.7)'; ctx.beginPath(); ctx.roundRect(r.x + m, r.y + m, r.w - 2 * m, r.h - 2 * m, rad * 0.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,214,150,0.35)'; ctx.beginPath(); ctx.roundRect(r.x + m + 2, r.y + m + 2, r.w - 2 * m, r.h - 2 * m, rad * 0.6); ctx.stroke();
  // brass studs
  for (const [sx, sy] of [[r.x + m + 12, r.y + m + 12], [r.x + r.w - m - 12, r.y + m + 12], [r.x + m + 12, r.y + r.h - m - 12], [r.x + r.w - m - 12, r.y + r.h - m - 12]]) {
    const b = ctx.createRadialGradient(sx - 2, sy - 2, 1, sx, sy, 7); b.addColorStop(0, '#fff0b0'); b.addColorStop(0.5, '#c9942e'); b.addColorStop(1, '#5a3a08');
    ctx.fillStyle = b; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- title ----------------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L) {
  const T = L.title, S = L.S, A = T.area, B = T.titleBox;
  hero(ctx, st, A);
  if (T.railTop) drawRail(ctx, T.railTop, 'bottom');
  if (T.railBottom) drawRail(ctx, T.railBottom, 'top');
  if (T.railRight) drawRail(ctx, T.railRight, 'left');
  const size = T.size, tcx = B.x + B.w / 2;
  plaque(ctx, { x: S.x + 8, y: B.y - size * 0.12, w: S.w - 16, h: size * 1.95 });
  titleLine(ctx, tcx, B.y + size * 0.7, size, 'MORRA', B.w);
  txt(ctx, 'The finger game of the Roman table', tcx, B.y + size * 1.48, Math.max(22, Math.min(32, size * 0.24)), PAL.text, { align: 'center', weight: 700, stroke: 6, maxW: B.w });
  button(ctx, T.play, 'Play', { kind: 'primary', size: 44, icon: 'play' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'quiet', size: 30, icon: 'ear' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  const lw = Math.min(300, S.w * 0.55), lh = lw * 327 / 1200;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lh + 8, w: lw, h: lh })) drawCredit(ctx, T.credit.x, T.credit.y, 12);
}

function header(ctx, G, S, text) {
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, text, S.x + S.w / 2, G.titleY, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: S.w - 2 * (G.back.w + 30) });
}

// ---- rivals ---------------------------------------------------------------------------------------------------------------------------------
function renderRivals(ctx, st, L) {
  const G = L.rivals, S = L.S;
  header(ctx, G, S, 'Choose your rival');
  RIVALS.forEach((rv, i) => {
    const r = G.cards[i], best = st.best[rv.id] ?? {}, locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(22,10,28,0.82)' }); edgeStroke(ctx, r, 24, 0.25);
    const pad = 18, small = r.h < 190, tw = r.w - pad * 2 - Math.min(150, r.h * 0.7) - 8;
    txt(ctx, rv.name, r.x + pad, r.y + r.h * (small ? 0.18 : 0.15), small ? 30 : 36, locked ? PAL.dim : PAL.text, { font: DISPLAY, weight: 400, maxW: tw });
    txt(ctx, rv.role, r.x + pad, r.y + r.h * (small ? 0.38 : 0.33), small ? 19 : 22, PAL.gold, { weight: 600, maxW: tw });
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k < rv.skill ? '#ff8a76' : 'rgba(255,244,222,0.16)'; ctx.beginPath(); ctx.arc(r.x + pad + 8 + k * 22, r.y + r.h * (small ? 0.56 : 0.5), 7, 0, TAU); ctx.fill(); }
    txt(ctx, 'skill', r.x + pad + 5 * 22 + 6, r.y + r.h * (small ? 0.56 : 0.5), 17, PAL.dim, { weight: 600 });
    ctx.font = `500 ${small ? 20 : 22}px ${UI}`;
    const lines = wrap(ctx, locked ? 'Full game: get it on iPhone and Android.' : rv.blurb, tw);
    const maxLines = small ? 2 : 3, ly = r.y + r.h * (small ? 0.74 : 0.66);
    lines.slice(0, maxLines).forEach((ln, k) => txt(ctx, ln, r.x + pad, ly + k * (small ? 24 : 26), small ? 19 : 21, PAL.dim, { weight: 500, maxW: tw }));
    if (best.wins) txt(ctx, `Won ${best.wins}`, r.x + r.w - pad, r.y + r.h * 0.16, 20, PAL.gold, { align: 'right', weight: 800 });
    // a small hand in their style, showing their favourite throw
    const fav = rv.habit.indexOf(Math.max(...rv.habit)), hs = Math.min(r.h * 0.3, 84);
    ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 24); ctx.clip();
    drawHand(ctx, r.x + r.w - pad - Math.min(150, r.h * 0.7) / 2 - 8, r.y + r.h - 4 - hs * 0.1, hs, { ...rivalHand(rv), ext: extFor(fav, 1), rot: 0 });
    ctx.restore();
  });
}

// ---- result ---------------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const Rr = L.result, p = Rr.panel, res = st.result, wide = L.mode === 'wide';
  if (!res) return;
  ctx.fillStyle = 'rgba(8,3,12,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, p, { fill: 'rgba(26,12,30,0.95)', rad: 30 }); edgeStroke(ctx, p, 30, 0.35);
  const won = res.winner === 'you';
  txt(ctx, won ? 'You win the duel!' : `${res.rivalName} wins this one`, p.x + p.w / 2, p.y + 52, 40, won ? PAL.gold : '#ff9a8a', { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: p.w - 50 });
  txt(ctx, `${res.rivalName}  ·  ${res.rounds} rounds`, p.x + p.w / 2, p.y + 96, 24, PAL.dim, { align: 'center', weight: 600, maxW: p.w - 50 });
  const lx = wide ? p.x + p.w * 0.27 : p.x + p.w / 2;
  txt(ctx, `${res.you} : ${res.rival}`, lx, p.y + 170, wide ? 90 : 100, PAL.text, { align: 'center', font: DISPLAY, weight: 400, stroke: 8, maxW: wide ? p.w * 0.45 : p.w - 60 });
  txt(ctx, 'You  :  Rival', lx, p.y + 232, 22, PAL.dim, { align: 'center', weight: 600 });
  if (res.newBest) txt(ctx, 'First win against this rival', lx, p.y + 270, 24, PAL.gold, { align: 'center', weight: 800, maxW: wide ? p.w * 0.45 : p.w - 60 });
  // your throws vs the rival's, as bars
  const bx = wide ? p.x + p.w * 0.54 : p.x + 40, bwid = wide ? p.w * 0.42 : p.w - 80;
  const by = wide ? p.y + 140 : p.y + 310, bhh = wide ? 190 : 170;
  txt(ctx, 'How often each side threw each number', bx + bwid / 2, by, 21, PAL.text, { align: 'center', weight: 700, maxW: bwid });
  const top = by + 22, base = by + bhh, mx = Math.max(1, ...res.freqYou, ...res.freqRival), cell = bwid / 6;
  for (let i = 0; i < 6; i++) {
    const cx = bx + cell * (i + 0.5), bw2 = Math.min(cell * 0.3, 26);
    const hY = (base - top - 26) * res.freqYou[i] / mx, hR = (base - top - 26) * res.freqRival[i] / mx;
    ctx.fillStyle = '#ffd36a'; rrect(ctx, { x: cx - bw2 - 2, y: base - 26 - hY, w: bw2, h: Math.max(3, hY) }, 4); ctx.fill();
    ctx.fillStyle = '#ff8a76'; rrect(ctx, { x: cx + 2, y: base - 26 - hR, w: bw2, h: Math.max(3, hR) }, 4); ctx.fill();
    txt(ctx, String(i), cx, base - 8, 22, PAL.text, { align: 'center', weight: 800 });
  }
  txt(ctx, 'You', bx + bwid * 0.35, base + 20, 18, '#ffd36a', { align: 'center', weight: 700 }); txt(ctx, 'Rival', bx + bwid * 0.65, base + 20, 18, '#ff8a76', { align: 'center', weight: 700 });
  // tells
  let ty = wide ? p.y + 360 : base + 56;
  const tx = wide ? p.x + 36 : p.x + 40, tw2 = wide ? p.w - 72 : p.w - 80;
  txt(ctx, 'What the table noticed', tx, ty, 24, PAL.gold, { weight: 800 }); ty += 34;
  ctx.font = `500 22px ${UI}`;
  const bottom = Rr.again.y - 36;
  for (const ln of res.lines) {
    for (const l2 of wrap(ctx, ln, tw2)) { if (ty > bottom) break; txt(ctx, l2, tx, ty, 22, PAL.text, { weight: 500 }); ty += 29; }
    ty += 4;
  }
  button(ctx, Rr.again, 'Play again', { kind: 'primary', size: 30 });
  button(ctx, Rr.rivals, 'Rivals', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, cx = S.x + S.w / 2, cy = S.y + S.h / 2;
  const bw = Math.min(S.w - 40, 560);
  panel(ctx, { x: cx - bw / 2, y: cy - 190, w: bw, h: 380 }, { fill: 'rgba(26,12,30,0.95)', rad: 28 });
  txt(ctx, 'That is the free web demo', cx, cy - 110, 36, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, maxW: bw - 40 });
  ctx.font = `500 26px ${UI}`;
  const lines = wrap(ctx, 'Get the free app on iPhone and Android for all five rivals, every duel length and your saved record.', bw - 80);
  lines.forEach((ln, i) => txt(ctx, ln, cx, cy - 30 + i * 36, 26, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back to the menu', cx, cy + 150, 24, PAL.dim, { align: 'center', weight: 600 });
}
