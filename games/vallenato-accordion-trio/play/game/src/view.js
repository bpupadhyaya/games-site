// Drawing of every screen except the play screen (playview.js) and the text pages (docview.js).
import { PAL, UI, DISPLAY, rgba, drawBackdrop, drawPalm, drawAccordion, drawCaja, drawGuacharaca, drawStars, drawPartIcon, drawParticles } from './art.js';
import { txt, wrap, button, panel, rrect, chip, icon, embossText } from './ui.js';
import { drawLockup, drawCredit, drawMoreLine, edgeStroke } from './brand.js';
import { cajaGeom, guaGeom, menuRects, inRect } from './layout.js';
import { PARTS, PART, PIECES, AIRES, WHY, gradeWord, togetherWord, buildTimeline } from './music.js';
import { renderDoc } from './docview.js';
import { drawPlay } from './playview.js';
import { RULES, HOWTO, ABOUT, settingsBlocks } from './content.js';
import { v3 } from './v3.js';

export function render(ctx, st, L, view, meta, pauseItems) {
  const tm = st.t, sc = st.scene;
  v3.scene = sc; v3.scrimTop = false;
  // the kit's "Preview 1:29" pill: out of the way of the score while playing
  if (sc === 'play') { const P = L.play; meta.previewBadge = L.mode === 'wide' ? { x: P.left.x + P.left.w / 2, y: P.left.y + 168, align: 'center' } : { x: P.hint.x - 10, y: P.hint.y + 8, align: 'right' }; } else meta.previewBadge = null;
  if (sc === 'play') { drawPlay(ctx, st, L, tm); if (st.pl.paused || st.pl.over) renderPause(ctx, st, L, pauseItems(st.pl)); drawToast(ctx, st, L); return; }
  drawBackdrop(ctx, L.w, L.h, tm, { calm: st.prefs.calm, dim: sc === 'title' ? 0 : sc === 'songs' || sc === 'piece' ? 0.25 : 0.4 });
  if (sc === 'title') renderTitle(ctx, st, L);
  else if (sc === 'songs') renderSongs(ctx, st, L);
  else if (sc === 'piece') renderPiece(ctx, st, L);
  else if (sc === 'result') renderResult(ctx, st, L);
  else if (sc === 'calib') renderCalib(ctx, st, L);
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  else if (sc === 'rules') renderDoc(ctx, st, L, { key: 'rules', page: st.rulesPage, pages: RULES.length, title: RULES[st.rulesPage].title, blocks: RULES[st.rulesPage].blocks, nav: true });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: 'About', blocks: ABOUT });
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st), volatile: true });
  drawToast(ctx, st, L);
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const t = st.toast, a = Math.min(1, t.t / 0.2, (t.hold - t.t) / 0.3);
  ctx.save(); ctx.globalAlpha = Math.max(0, a);
  ctx.font = `700 28px ${UI}`; const w = Math.min(L.S.w - 40, ctx.measureText(t.text).width + 60);
  const r = { x: L.S.x + (L.S.w - w) / 2, y: L.S.y + L.S.h - 120, w, h: 62 };
  if (v3.on) v3.buttons.push({ r, rad: 31, kind: 'ghost', top: true });
  else { ctx.fillStyle = 'rgba(4,20,26,0.95)'; rrect(ctx, r, 31); ctx.fill(); ctx.strokeStyle = PAL.mango; ctx.lineWidth = 2; rrect(ctx, r, 31); ctx.stroke(); }
  txt(ctx, t.text, r.x + r.w / 2, r.y + r.h / 2, 28, PAL.text, { align: 'center', weight: 700, maxW: r.w - 30 });
  ctx.restore();
}

// ---- title ------------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L) {
  const T = L.title, S = L.S, wide = L.mode === 'wide', tm = st.t, calm = st.prefs.calm;
  const hero = T.hero;
  const sc = Math.min(hero.w / 700, hero.h / 780), cx = hero.x + hero.w / 2, top = hero.y + (hero.h - 780 * sc) / 2;
  const tcx = cx;
  if (v3.on) {
    v3.hero = { cx, top, sc, tm, calm };
    embossText(ctx, 'VALLENATO', tcx, top + 82 * sc, 104 * sc, { maxW: hero.w - 20 });
    embossText(ctx, 'ACCORDION TRIO', tcx, top + 166 * sc, 50 * sc, { maxW: hero.w - 20, top: '#fffaf0', mid: '#ffe9c0', bot: '#d9a066' });
    txt(ctx, 'Three parts. One groove.', tcx, top + 226 * sc, 32 * sc, PAL.mint, { align: 'center', weight: 700, stroke: 6, maxW: hero.w - 20 });
    const bw3 = 330 * sc, by3 = top + 560 * sc, bh3 = 190 * sc;
    drawCaja(ctx, cajaGeom({ x: cx - bw3 - 14 * sc, y: by3, w: bw3, h: bh3 }), { tum: calm ? 0 : Math.max(0, Math.sin(tm * 4.2 + 0.2)) ** 6, tak: calm ? 0 : Math.max(0, Math.sin(tm * 4.2 + 2.1)) ** 6 }, tm);
  } else {
    // palms in the corners
    drawPalm(ctx, hero.x + 20, hero.y + hero.h + 40, hero.h * 0.8, 0.14);
    drawPalm(ctx, hero.x + hero.w - 10, hero.y + hero.h + 60, hero.h * 0.62, -0.16);
    txt(ctx, 'VALLENATO', tcx, top + 82 * sc, 104 * sc, PAL.gold, { font: DISPLAY, weight: 400, align: 'center', stroke: 14 * sc, maxW: hero.w - 20 });
    txt(ctx, 'ACCORDION TRIO', tcx, top + 166 * sc, 50 * sc, PAL.cream, { font: DISPLAY, weight: 400, align: 'center', stroke: 10 * sc, maxW: hero.w - 20 });
    txt(ctx, 'Three parts. One groove.', tcx, top + 226 * sc, 32 * sc, PAL.mint, { align: 'center', weight: 700, stroke: 6, maxW: hero.w - 20 });
    // the accordion, breathing
    const spread = calm ? 0.5 : 0.5 + 0.4 * Math.sin(tm * 1.3);
    const aw = 640 * sc, ah = 214 * sc;
    ctx.save(); ctx.translate(cx, top + 420 * sc); ctx.rotate(calm ? -0.04 : -0.04 + Math.sin(tm * 1.3) * 0.01); ctx.translate(-cx, -(top + 420 * sc));
    drawAccordion(ctx, cx - aw / 2, top + 420 * sc - ah / 2, aw, ah, { spread });
    ctx.restore();
    // caja and guacharaca under it
    const bw = 330 * sc, by = top + 560 * sc, bh = 190 * sc;
    const cg = cajaGeom({ x: cx - bw - 14 * sc, y: by, w: bw, h: bh });
    drawCaja(ctx, cg, { tum: calm ? 0 : Math.max(0, Math.sin(tm * 4.2 + 0.2)) ** 6, tak: calm ? 0 : Math.max(0, Math.sin(tm * 4.2 + 2.1)) ** 6 }, tm);
    const gg = guaGeom({ x: cx + 14 * sc, y: by, w: bw, h: bh });
    drawGuacharaca(ctx, gg, { fork: calm ? 0 : Math.sin(tm * 4.2), lean: calm ? 0 : Math.cos(tm * 4.2), glow: 1, trail: [] }, tm);
  }
  // buttons
  button(ctx, T.play, 'Play', { kind: 'primary', size: 46, icon: 'play' });
  button(ctx, T.watch, 'Watch and Learn', { kind: 'quiet', size: 32, icon: 'play' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26, icon: 'list' });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26, icon: 'book' });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26, icon: 'info' });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26, icon: 'gear' });
  const lw = Math.min(300, S.w * 0.55), lh = lw * 190 / 700;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lh + 8, w: lw, h: lh })) drawCredit(ctx, T.credit.x, T.credit.y, 12);
}

// ---- songs --------------------------------------------------------------------------------------------------------------------------------------
function levelDots(ctx, x, y, n, col) { for (let i = 0; i < 3; i++) { ctx.fillStyle = i < n ? col : 'rgba(255,255,255,0.16)'; ctx.beginPath(); ctx.arc(x + i * 18, y, 6, 0, Math.PI * 2); ctx.fill(); } }
function bestStars(b) { if (!b) return 0; return Math.max(b.live ?? 0, ...(['gua', 'caja', 'acc'].map((p) => b.take?.[p]?.stars ?? 0))); }

function renderSongs(ctx, st, L) {
  const G = L.songs, S = L.S;
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose a piece', S.x + S.w / 2, G.titleY, 44, PAL.gold, { font: DISPLAY, weight: 400, align: 'center', stroke: 8, maxW: S.w - 2 * (G.back.w + 40) });
  PIECES.forEach((p, i) => {
    const r = G.cards[i], b = st.best[p.id], locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(5,24,30,0.82)' }); edgeStroke(ctx, r, 24, 0.18);
    txt(ctx, p.name, r.x + 22, r.y + r.h * 0.2, Math.min(36, r.h * 0.18), locked ? PAL.dim : PAL.text, { weight: 800, maxW: r.w - 44 - 90 });
    const cr = chip(ctx, r.x + 22, r.y + r.h * 0.42, AIRES[p.aire].name, 20, { fill: rgba(PAL.mango, 0.9), color: '#1c0a04' });
    txt(ctx, `${p.bpm} bpm`, cr.x + cr.w + 14, r.y + r.h * 0.42, 22, PAL.dim, { weight: 700 });
    PARTS.forEach((part, k) => {
      const yy = r.y + r.h * 0.62 + k * Math.min(26, r.h * 0.1);
      txt(ctx, PART[part].name, r.x + 22, yy, 18, PART[part].col, { weight: 700 });
      levelDots(ctx, r.x + 172, yy, p.level[part], PART[part].col);
    });
    const s = bestStars(b);
    drawStars(ctx, r.x + r.w - 70, r.y + r.h * 0.2, 24, s, 3, locked ? 0.4 : 1);
    if (b?.together !== undefined) txt(ctx, `Together ${Math.round(b.together * 100)}%`, r.x + r.w - 22, r.y + r.h * 0.62, 18, PAL.mint, { align: 'right', weight: 700, maxW: r.w * 0.4 });
    if (locked) txt(ctx, 'Full game', r.x + r.w - 22, r.y + r.h * 0.42, 18, PAL.dim, { align: 'right', weight: 700 });
  });
}

// ---- piece detail -----------------------------------------------------------------------------------------------------------------------------
function renderPiece(ctx, st, L) {
  const D = L.piece, S = L.S, p = PIECES[st.sel], b = st.best[p.id], tk = st.takes[p.id] ?? {};
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  const I = D.info;
  panel(ctx, I, { fill: 'rgba(5,24,30,0.8)' }); edgeStroke(ctx, I, 24, 0.22);
  const px = I.x + 26, pw = I.w - 52;
  txt(ctx, p.name, px, I.y + 52, 46, PAL.gold, { font: DISPLAY, weight: 400, stroke: 8, maxW: pw });
  chip(ctx, px, I.y + 110, AIRES[p.aire].name, 24, { fill: rgba(PAL.mango, 0.92), color: '#1c0a04' });
  txt(ctx, `${p.bpm} beats per minute  |  12 bars`, px + 150, I.y + 110, 24, PAL.dim, { weight: 700, maxW: pw - 160 });
  ctx.font = `500 26px ${UI}`;
  const lines = wrap(ctx, p.blurb, pw);
  let y = I.y + 168; ctx.fillStyle = PAL.text; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (const ln of lines.slice(0, 5)) { ctx.fillText(ln, px, y); y += 36; }
  y += 8;
  for (const part of PARTS) {
    if (y + 60 > I.y + I.h - 8) break;
    drawPartIcon(ctx, part, px + 22, y + 18, 18, PART[part].col);
    txt(ctx, PART[part].name, px + 56, y + 6, 24, PART[part].col, { weight: 800 });
    levelDots(ctx, px + 56 + 150, y + 6, p.level[part], PART[part].col);
    ctx.font = `500 21px ${UI}`; ctx.fillStyle = PAL.dim;
    const w = wrap(ctx, WHY[part][p.aire], pw - 56);
    w.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, px + 56, y + 36 + i * 26));
    y += 36 + Math.min(2, w.length) * 26 + 16;
  }
  // a miniature of the score: the first four bars of all three parts, and the order of the Live Trio spotlight
  const msY = y + 4, msH = I.y + I.h - 20 - msY;
  if (msH > 120) drawMiniScore(ctx, { x: px, y: msY, w: pw, h: Math.min(msH, 230) }, p);
  // seat buttons
  PARTS.forEach((part, i) => {
    const r = D.seats[i], t = tk[part], old = b?.take?.[part];
    const label = `Take ${i + 1}: ${PART[part].name}`, sub = t ? 'recorded this session' : old ? 'best so far' : PART[part].short;
    button(ctx, r, label, { kind: t ? 'on' : 'quiet', size: 31, icon: 'rec', sub });
    const stars = t ? t.stars : old?.stars ?? 0;
    if (t || old) drawStars(ctx, r.x + r.w - 78, r.y + r.h / 2, 24, stars, 3);
  });
  button(ctx, D.live, 'Live Trio', { kind: 'primary', size: 32, sub: 'The spotlight moves, you follow', icon: 'play' });
  const any = PARTS.some((q) => tk[q]);
  button(ctx, D.hear, 'Hear my trio', { kind: any ? 'ghost' : 'disabled', size: 30, sub: any ? 'Your takes, played together' : 'Record a take first' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30 });
}

// ---- result -------------------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const Rr = L.result, res = st.result, p = Rr.panel;
  panel(ctx, p, { fill: 'rgba(5,24,30,0.93)', rad: 30, kind: 'sign' }); edgeStroke(ctx, p, 30, 0.5);
  const b = Rr.body, cx = b.x + b.w / 2, piece = PIECES[res.piece], wide = L.mode === 'wide';
  const k = Math.min(1, st.sceneT / 0.5);
  txt(ctx, res.mode === 'take' ? `${PART[res.seat].name} take` : 'Live Trio', cx, b.y + 30, 34, PAL.mint, { align: 'center', weight: 800 });
  txt(ctx, piece.name, cx, b.y + 80, 50, PAL.gold, { font: DISPLAY, weight: 400, align: 'center', stroke: 8, maxW: b.w });
  drawStars(ctx, cx, b.y + 160, 56 * (0.6 + 0.4 * k), res.stars, 3, k);
  txt(ctx, gradeWord(res.acc), cx, b.y + 224, 36, PAL.text, { align: 'center', weight: 800 });
  // numbers
  const items = [['Score', String(Math.round(res.score))], ['Accuracy', `${Math.round(res.acc * 100)}%`], ['Best streak', String(res.maxCombo)]];
  if (res.together !== null) items.push(['Together', `${Math.round(res.together * 100)}%  ${togetherWord(res.together)}`]);
  const cols = wide ? items.length : 2, cw = b.w / cols, rowH = 86;
  items.forEach((it, i) => {
    const x = b.x + (i % cols) * cw + cw / 2, y = b.y + 290 + Math.floor(i / cols) * rowH;
    txt(ctx, it[0], x, y, 20, PAL.dim, { align: 'center', weight: 700 });
    txt(ctx, it[1], x, y + 34, 32, it[0] === 'Together' ? PAL.mint : PAL.text, { align: 'center', weight: 800, maxW: cw - 12 });
  });
  const cy = b.y + 290 + Math.ceil(items.length / cols) * rowH + 6;
  const c = res.counts;
  txt(ctx, `Perfect ${c.perfect}   Great ${c.great}   Good ${c.good}   Nearly ${c.off}   Miss ${c.miss}`, cx, cy, 22, PAL.dim, { align: 'center', weight: 600, maxW: b.w });
  if (res.strays) txt(ctx, `${res.strays} extra press${res.strays === 1 ? '' : 'es'}`, cx, cy + 30, 20, PAL.dim, { align: 'center', weight: 600 });
  if (res.newBest) txt(ctx, 'New best', cx, cy + 36, 26, PAL.gold, { align: 'center', weight: 800 });
  if (res.hint) txt(ctx, res.hint, cx, cy + 36 + (res.newBest ? 34 : 0), 22, PAL.text, { align: 'center', weight: 600, maxW: b.w });
  const acts = res.actions, n = acts.length, rects = Rr.b.slice(Rr.b.length - n);
  acts.forEach((a, i) => button(ctx, rects[i], a.label, { kind: a.kind, size: 28 }));
  drawMoreLine(ctx, Rr.more.x, Math.min(L.S.y + L.S.h - 8, Rr.more.y), 15);
}

// ---- pause / finished menu ------------------------------------------------------------------------------------------------------------------
const PAUSE_LABELS = { resume: 'Resume', restart: 'Restart', quit: 'Leave', slow: 'Speed', next: 'Next piece' };
function renderPause(ctx, st, L, items) {
  const pl = st.pl, M = menuRects(L, items.length);
  if (v3.on) { v3.scrim = 0.6; v3.scrimTop = true; } else { ctx.fillStyle = 'rgba(2,10,14,0.6)'; ctx.fillRect(0, 0, L.w, L.h); }
  panel(ctx, M.panel, { fill: 'rgba(5,24,30,0.95)', rad: 28, top: true }); edgeStroke(ctx, M.panel, 28, 0.55);
  txt(ctx, pl.over ? 'Finished' : 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 58, 46, PAL.gold, { font: DISPLAY, weight: 400, align: 'center', stroke: 8 });
  items.forEach((id, i) => button(ctx, M.btns[i], id === 'slow' ? `Speed: ${st.prefs.speedIdx ? 'Slow' : 'Normal'}` : PAUSE_LABELS[id] ?? id, { kind: id === 'resume' ? 'primary' : 'quiet', size: 32, top: true }));
}

// ---- calibration ---------------------------------------------------------------------------------------------------------------------------------
function renderCalib(ctx, st, L) {
  const C = L.calib, c = st.cal, S = L.S;
  button(ctx, C.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Calibrate', S.x + S.w / 2, C.back.y + C.back.h / 2, 42, PAL.gold, { font: DISPLAY, weight: 400, align: 'center', stroke: 8 });
  const pr = C.pad.r * (1 + c.pulse * 0.1);
  ctx.fillStyle = `rgba(255,176,46,${0.25 + 0.5 * c.pulse})`; ctx.beginPath(); ctx.arc(C.pad.x, C.pad.y, pr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PAL.mango; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(C.pad.x, C.pad.y, pr, 0, Math.PI * 2); ctx.stroke();
  txt(ctx, c.phase === 'done' ? (c.result.ms === null ? 'Not enough taps' : `${c.result.ms} ms`) : 'TAP', C.pad.x, C.pad.y, 56, PAL.text, { font: DISPLAY, weight: 400, align: 'center', stroke: 8 });
  txt(ctx, c.phase === 'done' ? 'This is your average delay' : 'Tap anywhere on the beat. Twelve beats.', S.x + S.w / 2, C.pad.y + C.pad.r + 50, 26, PAL.dim, { align: 'center', weight: 600, maxW: S.w - 40 });
  if (c.phase === 'done') {
    button(ctx, C.retry, 'Try again', { kind: 'quiet', size: 30 });
    button(ctx, C.use, c.result.ms === null ? 'Back' : 'Use this', { kind: 'primary', size: 32 });
  }
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, r = { x: S.x + 30, y: S.y + S.h * 0.3, w: S.w - 60, h: 360 };
  panel(ctx, r, { fill: 'rgba(5,24,30,0.92)' }); edgeStroke(ctx, r, 24, 0.5);
  txt(ctx, 'That was the demo', r.x + r.w / 2, r.y + 70, 44, PAL.gold, { font: DISPLAY, weight: 400, align: 'center', stroke: 8, maxW: r.w - 30 });
  ctx.font = `500 28px ${UI}`;
  wrap(ctx, 'The web demo plays the first piece a few times. The full game has six pieces, all three Studio takes and the Live Trio. Get it on iPhone or Android.', r.w - 60).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 140 + i * 40, 28, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 34, 24, PAL.dim, { align: 'center', weight: 700 });
}

const miniCache = new Map();
function drawMiniScore(ctx, r, piece) {
  let tl = miniCache.get(piece.id); if (!tl) { tl = buildTimeline(piece, 1); miniCache.set(piece.id, tl); }
  const chipH = 26, topH = r.h - chipH - 14;
  ctx.fillStyle = 'rgba(255,244,224,0.05)'; rrect(ctx, { x: r.x, y: r.y, w: r.w, h: topH }, 14); ctx.fill();
  const t0 = tl.T0, t1 = tl.T0 + tl.bar * 4, bandH = topH / 3, x = (t) => r.x + 78 + ((t - t0) / (t1 - t0)) * (r.w - 90);
  for (let b = 0; b <= 4; b++) { const bx = r.x + 78 + (b / 4) * (r.w - 90); ctx.strokeStyle = 'rgba(255,238,210,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, r.y + 6); ctx.lineTo(bx, r.y + topH - 6); ctx.stroke(); }
  PARTS.forEach((part, k) => {
    const y0 = r.y + k * bandH;
    for (const n of tl.notes[part]) {
      if (n.t >= t1) continue;
      const nx = x(n.t), ny = part === 'acc' ? y0 + bandH - 8 - (n.btn / 6) * (bandH - 16) : part === 'caja' ? y0 + bandH * (n.kind === 'tum' ? 0.68 : 0.32) : y0 + bandH / 2;
      ctx.fillStyle = part === 'acc' ? (n.pull ? PAL.pull : PAL.push) : part === 'caja' ? (n.kind === 'tum' ? PAL.mango : PAL.coral) : PAL.mint;
      ctx.beginPath(); ctx.arc(nx, ny, part === 'acc' ? 5.5 : 4, 0, Math.PI * 2); ctx.fill();
    }
    txt(ctx, PART[part].name, r.x + 10, y0 + 12, 13, rgba(PART[part].col, 0.85), { weight: 800 });
  });
  // the spotlight order
  const cw = (r.w - 5 * 6) / 6, cy = r.y + r.h - chipH;
  piece.relay.forEach((seat, i) => {
    const c = { x: r.x + i * (cw + 6), y: cy, w: cw, h: chipH };
    ctx.fillStyle = rgba(PART[seat].col, 0.85); rrect(ctx, c, 13); ctx.fill();
    txt(ctx, PART[seat].short, c.x + c.w / 2, c.y + c.h / 2, 14, '#1c0a04', { align: 'center', weight: 800, maxW: c.w - 6 });
  });
}
