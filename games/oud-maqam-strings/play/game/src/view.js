// Drawing every screen. Dispatches on state.scene; the play and free-play screens are in playview.js, the text screens in docview.js.
import { PAL, UI, DISPLAY, rgba, drawBackdrop, drawLamps, drawRug, drawOudIcon } from './art.js';
import { txt, wrap, button, panel, rrect, chip } from './ui.js';
import { menuRects } from './layout.js';
import { PIECES, MAQAMAT, IQA, accuracyToStars, gradeOf, tendency } from './music.js';
import { renderDoc, docMetrics } from './docview.js';
import { renderPlay, renderFree, toast, GRADE_COL, GRADE_TEXT } from './playview.js';
import { ABOUT, HOWTO, RULES, settingsBlocks } from './content.js';
import { drawCredit, drawMoreLine, edgeStroke } from './brand.js';

const CAL_BEAT = 0.75, CAL_TAPS = 8;
function stars(ctx, cx, cy, n, size) {
  for (let i = 0; i < 3; i++) {
    const x = cx + (i - 1) * size * 1.25, on = i < n;
    ctx.save(); ctx.translate(x, cy); ctx.fillStyle = on ? PAL.gold : 'rgba(255,255,255,0.14)'; ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? size * 0.22 : size * 0.52; k ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
}

function title(ctx, st, L, t) {
  const T = L.title, S = L.S;
  drawBackdrop(ctx, L.w, L.h, t, 0.8, 0.2 * Math.max(0, Math.sin(t * 2)));
  drawLamps(ctx, L.w, S.y + 6, t, 0.9, 0, Math.min(1, L.w / 760));
  const cx = L.wide ? S.x + (T.play.x - S.x) / 2 : S.x + S.w / 2;
  txt(ctx, 'OUD', cx, T.titleY + T.size * 0.7, T.size * 1.35, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, stroke: 10 });
  txt(ctx, 'MAQAM STRINGS', cx, T.titleY + T.size * 1.62, T.size * 0.5, PAL.cream, { align: 'center', font: DISPLAY, weight: 600, stroke: 6, maxW: (L.wide ? T.play.x - S.x : S.w) - 50 });
  const H = T.hero, sz = Math.min(H.w * 0.95, H.h * 1.15);
  drawRug(ctx, { x: H.x + H.w / 2 - sz * 0.5, y: H.y + H.h / 2 - sz * 0.38, w: sz, h: sz * 0.76 });
  drawOudIcon(ctx, H.x + H.w / 2, H.y + H.h / 2, sz * 0.8, -0.55);
  button(ctx, T.play, 'Play', { kind: 'primary', size: 44, icon: 'play' });
  button(ctx, T.free, 'Free play and taqsim', { kind: 'quiet', size: 32 });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'quiet', size: 32, icon: 'ear' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 28 }); button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 28 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 28 }); button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 28 });
  drawCredit(ctx, T.credit.x, T.credit.y, 20);
}

function songs(ctx, st, L, t) {
  const G = L.songs, S = L.S;
  drawBackdrop(ctx, L.w, L.h, t, 0.5, 0); drawLamps(ctx, L.w, S.y - 10, t, 0.6, 0, 0.7);
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose a piece', S.x + S.w / 2, G.titleY, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 7 });
  G.cards.forEach((r, i) => {
    const p = PIECES[i], b = st.best[p.id] ?? {}, M = MAQAMAT[p.maqam];
    panel(ctx, r, { rad: 22, fill: 'rgba(10,28,34,0.82)' });
    edgeStroke(ctx, r, 22, 0.22);
    const pad = 20, big = Math.min(36, r.h * 0.18);
    txt(ctx, p.title, r.x + pad, r.y + r.h * 0.2, big, PAL.cream, { weight: 800, font: DISPLAY, maxW: r.w - pad * 2 - 130 });
    txt(ctx, `${M.name}  ·  ${IQA[p.iqa].name}  ·  ${p.bpm} bpm`, r.x + pad, r.y + r.h * 0.4, Math.min(24, r.h * 0.11), PAL.turq, { weight: 700, maxW: r.w - pad * 2 });
    ctx.font = `500 ${Math.min(24, r.h * 0.105)}px ${UI}`;
    wrap(ctx, p.blurb, r.w - pad * 2).slice(0, 2).forEach((ln, k) => txt(ctx, ln, r.x + pad, r.y + r.h * 0.58 + k * Math.min(30, r.h * 0.13), Math.min(24, r.h * 0.105), PAL.dim, { weight: 500 }));
    stars(ctx, r.x + r.w - 76, r.y + r.h * 0.2, b.stars ?? 0, 26);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = k < p.level ? PAL.ember : 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.arc(r.x + pad + 8 + k * 24, r.y + r.h - 24, 8, 0, 6.3); ctx.fill(); }
    if (b.score) txt(ctx, `Best ${b.score}`, r.x + r.w - pad, r.y + r.h - 24, 22, PAL.gold, { align: 'right', weight: 700 });
  });
}

function piece(ctx, st, L, t) {
  const D = L.piece, S = L.S, p = PIECES[st.sel], M = MAQAMAT[p.maqam], b = st.best[p.id] ?? {};
  drawBackdrop(ctx, L.w, L.h, t, 0.6, 0); drawLamps(ctx, L.w, S.y - 10, t, 0.7, 0, 0.7);
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, p.title, S.x + S.w / 2 + D.back.w / 2 + 6, S.y + 12 + Math.max(60, L.mb) / 2, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 7, maxW: S.w - D.back.w * 2 - 60 });
  panel(ctx, D.info, { rad: 24 });
  const x = D.info.x + 28, w = D.info.w - 56; let y = D.info.y + 40;
  txt(ctx, `${M.name}  ·  ${IQA[p.iqa].name}  ·  ${p.bpm} bpm`, x, y, 30, PAL.turq, { weight: 800, maxW: w }); y += 48;
  ctx.font = `500 27px ${UI}`;
  for (const para of [p.blurb, M.blurb, IQA[p.iqa].blurb]) { for (const ln of wrap(ctx, para, w)) { txt(ctx, ln, x, y, 27, PAL.text, { weight: 500 }); y += 36; } y += 10; }
  // the scale on the neck, and the rhythm cycle
  const rx0 = x + 10, rx1 = x + w - 10, ry = y + 50;
  ctx.strokeStyle = 'rgba(255,240,220,0.22)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(rx0, ry); ctx.lineTo(rx1, ry); ctx.stroke();
  M.deg.forEach((c, i) => {
    const u = rx0 + (c / 1200) * (rx1 - rx0), q = M.q.includes(i);
    ctx.fillStyle = q ? PAL.turq : PAL.pearl; ctx.beginPath();
    if (q) { ctx.moveTo(u, ry - 12); ctx.lineTo(u + 10, ry); ctx.lineTo(u, ry + 12); ctx.lineTo(u - 10, ry); ctx.closePath(); } else ctx.arc(u, ry, 7.5, 0, 6.3);
    ctx.fill(); txt(ctx, String(i + 1), u, ry + 34, 22, q ? PAL.turq : PAL.dim, { align: 'center', weight: 700 });
  });
  txt(ctx, 'The scale on the neck (turquoise = quarter-tone)', x, ry - 34, 22, PAL.dim, { weight: 600, maxW: w });
  const iq = IQA[p.iqa].slots, cell = Math.min(70, w / 8), cx0 = x + (w - cell * 8) / 2, cyy = ry + 130;
  for (let i = 0; i < 8; i++) { const ch = iq[i], cxx = cx0 + cell * (i + 0.5); ctx.fillStyle = ch === 'D' ? PAL.ember : ch === 'T' ? PAL.turq : 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(cxx, cyy, ch === 'D' ? cell * 0.34 : ch === 'T' ? cell * 0.26 : cell * 0.1, 0, 6.3); ctx.fill(); }
  txt(ctx, 'The rhythm cycle: dum (big), tak (small)', x, cyy - 52, 22, PAL.dim, { weight: 600, maxW: w });
  stars(ctx, D.info.x + D.info.w / 2, D.info.y + D.info.h - 50, b.stars ?? 0, 38);
  button(ctx, D.learn, 'Learn the phrases', { kind: 'primary', size: 34, sub: 'listen, then echo' });
  button(ctx, D.perform, 'Perform', { kind: 'quiet', size: 34, sub: 'the whole piece for stars' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'quiet', size: 34, sub: 'the computer plays and explains' });
}

function result(ctx, st, L, t) {
  const Rr = L.result, r = st.result, p = PIECES[r.piece], P = Rr.panel;
  drawBackdrop(ctx, L.w, L.h, t, 0.4 + 0.2 * r.stars, 0); drawLamps(ctx, L.w, L.S.y - 10, t, 0.4 + 0.2 * r.stars, 0, 0.8);
  panel(ctx, P, { rad: 28, fill: 'rgba(8,22,28,0.9)' }); edgeStroke(ctx, P, 28, 0.35);
  const cx = P.x + P.w / 2; let y = P.y + 54;
  txt(ctx, p.title, cx, y, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: P.w - 40 }); y += 76;
  stars(ctx, cx, y, r.stars, 54); y += 74;
  txt(ctx, r.grade, cx, y, 36, PAL.cream, { align: 'center', font: DISPLAY, weight: 700 }); y += 56;
  txt(ctx, `${Math.round(r.score)}`, cx, y, 60, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 7 }); y += 34;
  if (r.newBest) txt(ctx, 'New best', cx, y + 10, 26, PAL.good, { align: 'center', weight: 800 });
  y += 48;
  const rows = [['perfect', r.counts.perfect], ['great', r.counts.great], ['good', r.counts.good], ['off', r.counts.off], ['miss', r.counts.miss]];
  const cw = (P.w - 60) / 5;
  rows.forEach(([k, v], i) => { const x = P.x + 30 + cw * (i + 0.5); txt(ctx, String(v), x, y, 34, GRADE_COL[k], { align: 'center', weight: 800 }); txt(ctx, GRADE_TEXT[k], x, y + 32, 17, PAL.dim, { align: 'center', weight: 700 }); });
  y += 76;
  txt(ctx, `Accuracy ${Math.round(r.acc * 100)}%   ·   Best combo ${r.maxCombo}`, cx, y, 26, PAL.text, { align: 'center', weight: 600, maxW: P.w - 40 }); y += 40;
  if (r.pitchN > 0) txt(ctx, `Your pitch: ${tendency(r.meanCents)} (${r.meanCents > 0 ? '+' : ''}${Math.round(r.meanCents)} cents on average)`, cx, y, 24, PAL.turq, { align: 'center', weight: 700, maxW: P.w - 40 });
  button(ctx, Rr.again, 'Play again', { kind: 'primary', size: 30 }); button(ctx, Rr.songs, 'Pieces', { kind: 'quiet', size: 30 }); button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 20);
}

function calib(ctx, st, L, t) {
  const C = L.calib, c = st.cal, S = L.S;
  drawBackdrop(ctx, L.w, L.h, t, 0.4, 0); drawLamps(ctx, L.w, S.y - 10, t, 0.5, 0, 0.7);
  button(ctx, C.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Calibrate latency', S.x + S.w / 2, C.back.y + C.back.h / 2 + 2, 36, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: S.w - C.back.w * 2 - 60 });
  const P = C.pad; panel(ctx, P, { rad: 26, fill: 'rgba(8,22,28,0.85)' }); edgeStroke(ctx, P, 26, 0.3);
  const cx = P.x + P.w / 2, cy = P.y + P.h * 0.5, r = Math.min(P.w, P.h) * 0.2;
  const ph = c.t > 0.8 ? ((c.t - 0.8) % CAL_BEAT) / CAL_BEAT : 0, beat = Math.max(0, 1 - ph * 5);
  ctx.save(); ctx.fillStyle = `rgba(53,199,184,${0.18 + 0.4 * beat + 0.4 * c.flash})`; ctx.beginPath(); ctx.arc(cx, cy, r * (1 + 0.18 * beat), 0, 6.3); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = c.result ? PAL.good : PAL.gold; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.3); ctx.stroke(); ctx.restore();
  const line1 = c.result ? `Saved: ${c.result.ms} ms` : 'Tap the circle in time with the click';
  txt(ctx, line1, cx, P.y + Math.max(44, P.h * 0.12), c.result ? 44 : 30, c.result ? PAL.good : PAL.cream, { align: 'center', weight: 800, maxW: P.w - 40 });
  const sub = c.result ? `Steadiness: within ${c.result.spread} ms. Tap Retry to measure again.` : `${c.errs.length} of ${CAL_TAPS} taps${c.errs.length ? `   last ${Math.round(c.errs[c.errs.length - 1] * 1000)} ms` : ''}`;
  txt(ctx, sub, cx, P.y + P.h - Math.max(44, P.h * 0.1), 24, PAL.dim, { align: 'center', weight: 600, maxW: P.w - 40 });
  if (!st.prefs.sound) txt(ctx, 'Sound is off in Settings', cx, cy + r + 44, 24, PAL.bad, { align: 'center', weight: 700 });
  button(ctx, C.retry, 'Retry', { kind: 'quiet', size: 30 }); button(ctx, C.done, 'Done', { kind: c.result ? 'primary' : 'ghost', size: 30 });
}

function demoLimit(ctx, st, L, t) {
  drawBackdrop(ctx, L.w, L.h, t, 0.4, 0);
  const M = menuRects(L, 0, 300);
  panel(ctx, M.panel, { rad: 26, fill: 'rgba(10,26,32,0.96)' });
  const cx = M.panel.x + M.panel.w / 2;
  txt(ctx, 'That is the free demo', cx, M.panel.y + 66, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: M.panel.w - 30 });
  ctx.font = `500 27px ${UI}`;
  wrap(ctx, 'Get the full Oud Maqam Strings on iPhone and Android: six pieces, four maqamat, free play and taqsim. Tap to go back.', M.panel.w - 60).forEach((ln, i) => txt(ctx, ln, cx, M.panel.y + 126 + i * 36, 27, PAL.text, { align: 'center', weight: 500 }));
}

export function docFor(st) {
  const key = st.docKey;
  if (key === 'about') return { key, title: 'About', blocks: ABOUT };
  if (key === 'howto') return { key, title: 'How to Play', blocks: HOWTO };
  if (key === 'settings') return { key: 'settings', title: 'Settings', blocks: settingsBlocks(st), live: true };
  const pg = RULES[st.rulesPage] ?? RULES[0];
  return { key: `rules${st.rulesPage}`, title: `Rules ${st.rulesPage + 1}/${RULES.length}: ${pg.title}`, blocks: pg.blocks, nav: true, page: st.rulesPage, pages: RULES.length };
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const t = st.t, sc = st.scene;
  if (sc === 'title') title(ctx, st, L, t);
  else if (sc === 'songs') songs(ctx, st, L, t);
  else if (sc === 'piece') piece(ctx, st, L, t);
  else if (sc === 'play') renderPlay(ctx, st, L, view, pauseItems, menuRects);
  else if (sc === 'free') renderFree(ctx, st, L, view);
  else if (sc === 'result') result(ctx, st, L, t);
  else if (sc === 'demo-limit') demoLimit(ctx, st, L, t);
  else if (sc === 'calib') calib(ctx, st, L, t);
  else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') {
    drawBackdrop(ctx, L.w, L.h, t, 0.3, 0);
    const d = docFor(st);
    if (d.live) d.key = `settings|${st.prefs.windowIdx}${st.prefs.assistIdx}${st.prefs.timingIdx}${st.prefs.cal}${st.prefs.thinkSec}${+st.prefs.sound}${+st.prefs.backing}${+st.prefs.haptics}${+st.prefs.marks}${+st.prefs.labels}${+st.prefs.calm}`;
    renderDoc(ctx, st, L, d);
    if (st.toast) toast(ctx, L, st.toast.text);
  }
  void docMetrics; void rgba; void accuracyToStars; void gradeOf; void chip; void rrect;
}
